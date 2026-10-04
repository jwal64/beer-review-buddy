#!/usr/bin/env node
// Tests the rules inside the app's src/lib/, without a browser.
//
// Everything else in `npm run check` asks whether the *data* is well formed.
// This asks whether the code that judges it still behaves: what a place is
// called, when two spellings are the same beer, when an average has enough
// behind it to be ranked, what a shortlist entry is predicted to score, when a
// review stops being news, and what the Passport awards.
//
// Two of those are worth pinning in particular:
//
//   · **The location format** has been reverted twice by an editing pass
//     that never meant to touch it. tools/check-invariants.mjs notices when
//     the helper goes *missing*; this notices when it is still there and no
//     longer writes places the way the rule says.
//   · **predictRating** is the shortlist's whole point, and its MIN_N
//     fallback is invisible: a wrong one still returns a plausible number.
//
// The modules are imported directly: Node (22.18+) strips the types itself,
// and each module here imports nothing at runtime — type imports are erased —
// which is what makes them loadable without a build. No network, no browser,
// no dependencies — milliseconds, so `npm run check` runs it on every push.
import { loadData } from "./load-data.mjs";

let failures = 0;
async function load(path) {
  try {
    return await import(path);
  } catch (err) {
    failures++;
    console.log(
      `  ✗ ${path} could not be loaded\n      ${err.message}\n` +
        `      (needs Node 22.18+, which strips the types; \`node --version\` here: ${process.version})`,
    );
    return null;
  }
}

const place = await load("../src/lib/place.ts");
const insights = await load("../src/lib/insights.ts");
const when = await load("../src/lib/when.ts");
const progress = await load("../src/lib/progress.ts");
const continents = await load("../src/data/continents.ts");
const snapshot = await load("../src/lib/snapshot.ts");
if (!place || !insights || !when || !progress || !continents || !snapshot) {
  console.error(`\n  ${failures} module(s) failed to load.\n`);
  process.exit(1);
}

const { placeLabel } = place;
const { wtNorm, MIN_N, thin, rankBy, rankable, groupRatings, summarise, predictRating } = insights;
const { whenLabel, isDisplayNew } = when;
const { drunkLocs, FLAGS } = loadData();

function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}
const eq = (got, want, what) => {
  if (got !== want)
    throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
};
const near = (got, want, what) => {
  if (Math.abs(got - want) > 1e-9) throw new Error(`${what}: expected ${want}, got ${got}`);
};
const section = (title) => console.log(`\n  ${title}`);

// ══════════════════════════════════════════════════════════════
section("placeLabel — one location format everywhere");

check("a full place reads City, Region, Country", () => {
  eq(
    placeLabel({ city: "New Rochelle", region: "New York", country: "United States" }),
    "New Rochelle, New York, United States",
    "label",
  );
});

// The reason the helper exists: dropping a region that repeats its city made
// "New York, USA" read as the state rather than the city drunk in.
check("a region that repeats its city is still printed", () => {
  eq(
    placeLabel({ city: "New York", region: "New York", country: "United States" }),
    "New York, New York, United States",
    "New York",
  );
  eq(
    placeLabel({ city: "Antwerp", region: "Antwerp", country: "Belgium" }),
    "Antwerp, Antwerp, Belgium",
    "Antwerp",
  );
});

check("a missing part is dropped, never left as a dangling comma", () => {
  eq(
    placeLabel({ city: "Dublin", region: "", country: "Ireland" }),
    "Dublin, Ireland",
    "no region",
  );
  eq(
    placeLabel({ city: "Dublin", region: "Leinster", country: "" }),
    "Dublin, Leinster",
    "no country",
  );
  eq(placeLabel({ city: "", region: "", country: "" }), "", "nothing at all");
  eq(placeLabel({ city: null, region: undefined, country: null }), "", "nulls");
  eq(placeLabel(null), "", "no row");
});

check("padding is trimmed rather than printed", () => {
  eq(
    placeLabel({ city: " Padded ", region: " Region ", country: " Country " }),
    "Padded, Region, Country",
    "trimmed",
  );
});

check("every real location has all three parts", () => {
  for (const l of drunkLocs) {
    const label = placeLabel(l);
    eq(label.split(", ").length, 3, `${l.city} → "${label}"`);
  }
});

// ══════════════════════════════════════════════════════════════
section("wtNorm — when two spellings are the same beer");

check("case, accents, punctuation and ß are flattened", () => {
  eq(wtNorm("Smithwick's"), "smithwicks", "apostrophe");
  eq(wtNorm("Smithwicks"), wtNorm("Smithwick's"), "with and without");
  eq(wtNorm("Żywiec"), "zywiec", "accent");
  eq(wtNorm("Paulaner Hefe-Weißbier"), "paulaner hefe weissbier", "ß and hyphen");
  eq(wtNorm("  ERDINGER   Weissbier  "), "erdinger weissbier", "case and spacing");
  eq(wtNorm("Pilsner Urquell"), wtNorm("pilsner urquell"), "case only");
});

// Deliberately no looser than that: a shortlist entry is crossed off by name,
// so a rule that let one beer answer for another would score the prediction
// against the wrong pour.
check("a different beer from the same brewery is not the same beer", () => {
  if (wtNorm("Peroni Original") === wtNorm("Peroni Nastro Azzurro"))
    throw new Error("Peroni Original crossed off Peroni Nastro Azzurro");
  if (wtNorm("Paulaner Hefe") === wtNorm("Paulaner Hefe-Weißbier"))
    throw new Error("a prefix matched the fuller name — that is what `as:[…]` is for");
});

check("nothing normalises to a crash", () => {
  eq(wtNorm(null), "", "null");
  eq(wtNorm(undefined), "", "undefined");
  eq(wtNorm("!!!"), "", "punctuation only");
});

// ══════════════════════════════════════════════════════════════
section(`MIN_N — a group needs ${MIN_N} reviews before it ranks`);

check("thin() is the threshold, and nothing else hardcodes the number", () => {
  eq(thin(MIN_N - 1), true, "under");
  eq(thin(MIN_N), false, "at");
  eq(thin(MIN_N + 1), false, "over");
  eq(thin(0), true, "empty");
});

const g = (label, avg, count) => ({ label, avg, count });

check("rankBy puts every qualified group above every thin one", () => {
  const list = [
    g("thin-5.00", 5, 1),
    g("qualified-3.00", 3, 9),
    g("thin-4.00", 4, 2),
    g("qualified-4.50", 4.5, 3),
  ];
  const order = [...list].sort(rankBy).map((o) => o.label);
  eq(order.join(" · "), "qualified-4.50 · qualified-3.00 · thin-5.00 · thin-4.00", "order");
});

check("a tie on average is broken alphabetically", () => {
  const order = [g("Zagreb", 4, 5), g("Antwerp", 4, 5)].sort(rankBy).map((o) => o.label);
  eq(order.join(" · "), "Antwerp · Zagreb", "order");
});

// The headline callouts read [0] off a ranked list, so a single generous pour
// in a city visited once must not be able to reach it.
check("rankable() is the slice that may be called best or worst", () => {
  eq(rankable([g("a", 3, 1), g("b", 3, 5), g("c", 3, 3)]).length, 2, "qualified only");
  eq(rankable([g("a", 3, 1), g("b", 3, 2)]).length, 2, "falls back to the whole list");
  eq(rankable([]).length, 0, "empty stays empty");
});

check("groupRatings averages per key, ranked, and skips rows with no key", () => {
  const rows = [
    { k: "IPA", r: 4 },
    { k: "IPA", r: 3 },
    { k: "IPA", r: 5 },
    { k: "Stout", r: 5 },
    { k: null, r: 1 },
  ];
  const out = groupRatings(
    rows,
    (x) => x.k,
    (x) => x.r,
  );
  eq(out.map((o) => o.label).join(" · "), "IPA · Stout", "qualified IPA outranks a one-pour Stout");
  near(out[0].avg, 4, "IPA average");
  eq(out[0].count, 3, "IPA count");
  eq(out.length, 2, "the keyless row is skipped");
});

check("summarise answers zeros for nothing rather than NaN", () => {
  const empty = summarise([]);
  eq(empty.mean, 0, "mean");
  eq(empty.stdDev, 0, "stdDev");
  const s = summarise([2, 4]);
  near(s.mean, 3, "mean");
  near(s.stdDev, 1, "population std");
  near(s.median, 3, "even-length median");
  near(summarise([4, 4, 4]).stdDev, 0, "identical values");
});

// ══════════════════════════════════════════════════════════════
section("predictRating — the shortlist's guess");

const GLOBAL = 3.6;
const guess = ({
  style = {},
  country = {},
  globalAvg = GLOBAL,
  untappd = 3.5,
  method = "Bottle",
  origin = "US",
} = {}) =>
  predictRating({
    style: "IPA",
    origin,
    untappd,
    method,
    globalAvg,
    styleGroups: new Map(Object.entries(style).map(([k, [avg, count]]) => [k, g(k, avg, count)])),
    countryGroups: new Map(
      Object.entries(country).map(([k, [avg, count]]) => [k, g(k, avg, count)]),
    ),
  });

check("world consensus carries half the guess", () => {
  near(guess({ untappd: 4 }) - guess({ untappd: 2 }), 1.0, "half of a two-point swing");
});

// The MIN_N rule, and the reason it is invisible without a test: a style
// average built on one pour still returns a perfectly plausible number.
check("a style below MIN_N does not bend the guess", () => {
  near(guess({ style: { IPA: [5, MIN_N - 1] } }), guess(), "a thin style counts for nothing");
});

check("a style at MIN_N does move it, by a quarter of its distance", () => {
  near(
    guess({ style: { IPA: [4.6, MIN_N] } }) - guess(),
    (4.6 - GLOBAL) * 0.25,
    "a quarter of the gap to the global average",
  );
});

check("a country below MIN_N does not bend the guess either", () => {
  near(
    guess({ origin: "BE", country: { BE: [5, MIN_N - 1] } }),
    guess({ origin: "BE" }),
    "a thin country counts for nothing",
  );
});

check("a country at MIN_N moves it by fifteen percent of its distance", () => {
  near(
    guess({ origin: "BE", country: { BE: [4.6, MIN_N] } }) - guess({ origin: "BE" }),
    (4.6 - GLOBAL) * 0.15,
    "fifteen percent of the gap",
  );
});

check("the serving method nudges, in the documented direction", () => {
  const bottle = guess();
  near(guess({ method: "Draft" }) - bottle, 0.1, "Draft");
  near(guess({ method: "Nitro" }) - bottle, 0.05, "Nitro");
  near(guess({ method: "Can" }) - bottle, -0.1, "Can");
  near(guess({ method: null }), bottle, "no method is a bottle");
});

check("the guess stays inside the scale it is drawn on", () => {
  const top = guess({
    style: { IPA: [5, 99] },
    country: { US: [5, 99] },
    globalAvg: 5,
    untappd: 5,
    method: "Draft",
  });
  eq(top <= 5, true, "never above 5");
  const bottom = guess({
    style: { IPA: [1, 99] },
    country: { US: [1, 99] },
    globalAvg: 1,
    untappd: 1,
    method: "Can",
  });
  eq(bottom >= 1, true, "never below 1");
});

// ══════════════════════════════════════════════════════════════
section("whenLabel and isDisplayNew — dates as the app prints them");

check("a dated review prints its month; a retro one prints Retro", () => {
  eq(whenLabel({ retro: false, drank_on: "2026-09-01" }), "September 2026", "dated");
  eq(whenLabel({ retro: true, drank_on: "2026-09-01" }), "Retro", "retro");
});

check("only a beer flagged new, reviewed this month, wears the badge", () => {
  const now = new Date();
  const ym = (y, m) => `${y}-${String(m).padStart(2, "0")}-01`;
  const m = now.getMonth() + 1,
    y = now.getFullYear();
  eq(isDisplayNew({ is_new: true, drank_on: ym(y, m) }), true, "this month");
  eq(isDisplayNew({ is_new: false, drank_on: ym(y, m) }), false, "not a new beer");
  eq(isDisplayNew({ is_new: true, drank_on: ym(y, (m % 12) + 1) }), false, "another month");
  eq(isDisplayNew({ is_new: true, drank_on: ym(y - 1, m) }), false, "the same month last year");
});

// ══════════════════════════════════════════════════════════════
section("progress — badges, stamps, streaks, goals and bingo");

const {
  BADGES,
  badges,
  chronological,
  passport,
  nextStamps,
  streak,
  goals,
  styleBingo,
  bingoLines,
} = progress;

// A review row as the app holds it, with only what a case cares about set.
let seq = 0;
const pour = (over = {}) => ({
  id: `t${++seq}`,
  seq,
  name: `Beer ${seq}`,
  brewery: null,
  style: "Lager",
  origin_cc: "US",
  abv: 5,
  method: "Bottle",
  city: "New Rochelle",
  region: "New York",
  country: "USA",
  cc: "US",
  rating: 3.5,
  is_new: true,
  drank_on: "2026-01-01",
  retro: false,
  logo: null,
  ...over,
});
const noCtx = { breweries: [], facts: new Map(), world: new Map(), shortlist: [] };
const one = (id) => BADGES.filter((b) => b.id === id);

check("a retro review comes first in the diary, however it was logged", () => {
  const order = chronological([
    pour({ name: "dated", drank_on: "2026-01-01" }),
    pour({ name: "retro", drank_on: "2026-06-01", retro: true }),
  ]).map((b) => b.name);
  eq(order.join(" · "), "retro · dated", "order");
});

check("a badge is earned on the review that tips it, and not before", () => {
  const diary = [
    pour({ origin_cc: "US", drank_on: "2026-01-01" }),
    pour({ origin_cc: "US", drank_on: "2026-02-01" }),
    ...["DE", "BE", "NL", "IE", "MX", "JP", "CZ", "PL"].map((cc) =>
      pour({ origin_cc: cc, drank_on: "2026-03-01" }),
    ),
    pour({ origin_cc: "IT", drank_on: "2026-04-01" }),
  ];
  const [flags] = badges(diary, noCtx, one("ten-flags"));
  eq(flags.earned, true, "earned");
  eq(flags.earnedOn, "2026-04-01", "the tenth country's month");
  eq(flags.current, 10, "current");
  const [notYet] = badges(diary.slice(0, -1), noCtx, one("ten-flags"));
  eq(notYet.earned, false, "nine is not ten");
  eq(notYet.earnedOn, null, "no date until earned");
  eq(notYet.current, 9, "progress still counts");
});

check("a badge a retro review tips is earned, with no date", () => {
  const [b] = badges(
    [pour({ drank_on: "2026-05-01" }), pour({ rating: 5, retro: true })],
    noCtx,
    one("perfect-pour"),
  );
  eq(b.earned, true, "earned");
  eq(b.earnedOn, "retro", "dated as retro");
});

check("progress is capped at the target", () => {
  const [b] = badges([pour({ rating: 5 }), pour({ rating: 5 })], noCtx, one("perfect-pour"));
  eq(b.current, 1, "1 of 1, not 2 of 1");
});

// earnedOn is found by binary search, which is only right if no measure ever
// goes down as reviews are added. Checked over the real log, every badge.
check("every badge only ever grows as the diary does", () => {
  const facts = new Map(snapshot.BEER_FACTS.map((f) => [f.beer_name, f]));
  const world = new Map(snapshot.UNTAPPD_AVERAGES.map((u) => [u.beer_name, u.avg]));
  const ctx = { breweries: snapshot.BREWERIES, facts, world, shortlist: snapshot.WANT_TO_TRY };
  const diary = chronological(snapshot.BEERS);
  for (const def of BADGES) {
    let last = -1;
    for (let i = 0; i <= diary.length; i++) {
      const v = def.measure(diary.slice(0, i), ctx);
      if (v < last) throw new Error(`${def.id} fell from ${last} to ${v} at review ${i}`);
      last = v;
    }
  }
});

check("every flag has a continent", () => {
  const missing = Object.keys(FLAGS).filter((cc) => !continents.CONTINENTS[cc]);
  eq(missing.join(", "), "", "codes with no continent");
});

check("the passport stamps each nation but counts the UK once against the world", () => {
  const p = passport([
    pour({ origin_cc: "GB-ENG", retro: true }),
    pour({ origin_cc: "GB-SCT", drank_on: "2026-02-01" }),
    pour({ origin_cc: "GB-SCT", drank_on: "2026-03-01" }),
    pour({ origin_cc: "PR", drank_on: "2026-03-01" }),
    pour({ origin_cc: "US", drank_on: "2026-04-01" }),
  ]);
  eq(p.brewed.map((s) => s.cc).join(" · "), "GB-ENG · GB-SCT · PR · US", "four stamps");
  eq(p.brewed[0].first, "retro", "a retro stamp has no date");
  eq(p.brewed[1].first, "2026-02-01", "first stamp, not latest");
  eq(p.brewed[1].count, 2, "count");
  eq(p.world.visited, 2, "the UK and the US");
  eq(p.world.total, 195, "the world");
  eq(p.continents.find((c) => c.name === "Europe").visited, 1, "one European nation");
});

check("next stamps skip what is stamped or crossed off, one per country", () => {
  const e = (beer, origin, guess, actual = null) => ({ row: { beer, origin }, guess, actual });
  const out = nextStamps(
    [
      e("Tsingtao", "CN", 3.2),
      e("Harbin", "CN", 3.4),
      e("Coopers", "AU", 3.6),
      e("Already had", "TH", 4.0, 3.5),
      e("Duvel", "BE", 4.5),
    ],
    [{ cc: "BE" }],
  ).map((x) => x.row.beer);
  eq(out.join(" · "), "Coopers · Harbin", "best per new country, best first");
});

check("a streak runs across a year boundary and survives an unlogged month in progress", () => {
  const diary = ["2025-11-01", "2025-12-01", "2026-01-01"].map((d) => pour({ drank_on: d }));
  const jan = streak(diary, new Date(2026, 0, 20));
  eq(jan.current, 3, "Nov → Jan");
  eq(jan.loggedThisMonth, true, "logged");
  const feb = streak(diary, new Date(2026, 1, 3));
  eq(feb.current, 3, "still alive in February before anything is logged");
  eq(feb.loggedThisMonth, false, "at risk");
  const mar = streak(diary, new Date(2026, 2, 3));
  eq(mar.current, 0, "a whole empty month ends it");
  eq(mar.longest, 3, "the record stands");
  eq(mar.recent.length, 12, "twelve months shown");
});

check("a retro review never counts toward a streak", () => {
  const s = streak([pour({ drank_on: "2026-01-01", retro: true })], new Date(2026, 0, 15));
  eq(s.current, 0, "streak");
  eq(s.longest, 0, "longest");
});

check("goals count dated reviews in their year only, against pace", () => {
  const diary = [
    pour({ drank_on: "2026-01-01", is_new: true, origin_cc: "DE" }),
    pour({ drank_on: "2026-02-01", is_new: false, origin_cc: "DE" }),
    pour({ drank_on: "2025-12-01", is_new: true, origin_cc: "US" }),
    pour({ drank_on: "2026-03-01", is_new: true, origin_cc: "BE", retro: true }),
  ];
  const [g] = goals(
    diary,
    [{ year: 2026, reviews: 10, new_beers: 4, countries: null }],
    new Date(2026, 6, 2, 12),
  );
  eq(g.metrics.map((m) => m.key).join(","), "reviews,new_beers", "an unset target is not shown");
  eq(g.metrics[0].current, 2, "two dated reviews in 2026");
  eq(g.metrics[1].current, 1, "one new beer in 2026");
  near(Math.round(g.metrics[0].pace * 10) / 10, 5, "half the year, half the target");
  const [c] = goals(diary, [{ year: 2026, reviews: null, new_beers: null, countries: 5 }]);
  eq(c.metrics[0].current, 1, "DE is new in 2026; US was 2025, BE only retro");
});

check("style bingo fills a cell from the facts and counts finished lines", () => {
  const f = (beer_name, color, body) => [
    beer_name,
    { beer_name, color, body, sub: null, ibu: null, cal: null, adjuncts: [] },
  ];
  const facts = new Map([
    f("A", "Pale", "Light"),
    f("B", "Pale", "Medium"),
    f("C", "Pale", "Full"),
    f("D", "Dark", "Full"),
    f("Shortlisted", "Gold", "Light"),
  ]);
  const cells = styleBingo(
    ["A", "B", "C", "D", "A"].map((name) => pour({ name })),
    facts,
    [{ row: { beer: "Shortlisted" }, guess: 3.9, actual: null }],
  );
  eq(cells.length, 12, "4 colours × 3 bodies");
  eq(
    cells.find((c) => c.color === "Pale" && c.body === "Light").beers.length,
    1,
    "a beer counts once",
  );
  eq(
    cells.find((c) => c.color === "Gold" && c.body === "Light").suggestion.row.beer,
    "Shortlisted",
    "a suggestion for an empty cell",
  );
  eq(bingoLines(cells), 1, "the Pale row is complete");
});

// ══════════════════════════════════════════════════════════════
console.log("");
if (failures) {
  console.error(`  ${failures} app-logic test(s) failed.\n`);
  process.exit(1);
}
console.log("  The app's rules behave.\n");
