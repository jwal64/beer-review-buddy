#!/usr/bin/env node
// Tests the rules inside the app's src/lib/, without a browser.
//
// Everything else in `npm run check` asks whether the *data* is well formed.
// This asks whether the code that judges it still behaves: what a place is
// called, when two spellings are the same beer, when an average has enough
// behind it to be ranked, what a shortlist entry is predicted to score, and
// when a review stops being news.
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
if (!place || !insights || !when) {
  console.error(`\n  ${failures} module(s) failed to load.\n`);
  process.exit(1);
}

const { placeLabel } = place;
const { wtNorm, MIN_N, thin, rankBy, rankable, groupRatings, summarise, predictRating } = insights;
const { whenLabel, isDisplayNew } = when;
const { drunkLocs } = loadData();

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
console.log("");
if (failures) {
  console.error(`  ${failures} app-logic test(s) failed.\n`);
  process.exit(1);
}
console.log("  The app's rules behave.\n");
