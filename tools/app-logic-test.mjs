#!/usr/bin/env node
// Tests the rules inside public/stats/app.js, without a browser.
//
// Everything else in `npm run check` asks whether the *data* is well formed.
// Nothing asked whether the code that renders it still behaves, and app.js is
// where the site's judgement lives: what a place is called, when two spellings
// are the same beer, when an average has enough behind it to be ranked, which
// city a beer is filed under, what a shortlist entry is predicted to score.
//
// Three of those are worth pinning in particular:
//
//   · **The location format** and **the map pop-out** have each been reverted
//     twice by an editing pass that never meant to touch them.
//     tools/check-invariants.mjs notices when the helpers go *missing*; this
//     notices when one is still there and no longer agrees with the other.
//   · **computeCanonLoc** is dormant — every beer is currently reviewed in
//     exactly one city, so none of it runs against real data. It activates by
//     itself the first time a beer is logged in a second city, which is
//     exactly the moment an untested rule is worst to discover.
//   · **predictRating** is the shortlist's whole point, and its MIN_N
//     fallback is invisible: a wrong one still returns a plausible number.
//
// The declarations are lifted out of app.js and evaluated (see
// loadAppScope in load-data.mjs), so these run the site's own definitions
// rather than a copy that can drift. No network, no browser, no
// dependencies — milliseconds, so `npm run check` runs it on every push.
import { loadAppScope, loadData } from "./load-data.mjs";

const { FLAGS, drunkLocs } = loadData();

// The free variables the lifted code reads. `beers` and `STATS` are the app's
// live state, reassigned per case below; the object stays the context's global,
// so an assignment here is what the next call sees.
const globals = { FLAGS, beers: [], STATS: null };

const {
  esc,
  placeLabel,
  wtNorm,
  MIN_N,
  thin,
  rankBy,
  rankable,
  barFill,
  nLabel,
  rC,
  rbC,
  avg,
  std,
  computeCanonLoc,
  predictRating,
  isDisplayNew,
} = loadAppScope(
  [
    "esc",
    "placeLabel",
    "wtNorm",
    "MIN_N",
    "thin",
    "rankBy",
    "rankable",
    "barFill",
    "nLabel",
    "rC",
    "rbC",
    "avg",
    "std",
    "HOME_CITIES",
    "computeCanonLoc",
    "predictRating",
    "isDisplayNew",
  ],
  globals,
);

let failures = 0;
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
section("esc — the rendering rule");

// A beer named Smithwick's closes the attribute it sits in and takes the rest
// of the row with it. This is the function every value passes through.
check("the five characters that break an attribute are escaped", () => {
  eq(esc(`& < > " '`), "&amp; &lt; &gt; &quot; &#39;", "escaped");
});

check("Smithwick's survives being written into an attribute", () => {
  eq(esc("Smithwick's"), "Smithwick&#39;s", "escaped");
});

// & is replaced first, or every entity the other four write gets a second
// pass and "&lt;" reaches the page as "&amp;lt;".
check("an already-escaped value is escaped once, not twice", () => {
  eq(esc("<"), "&lt;", "first pass");
  eq(esc("&lt;"), "&amp;lt;", "text that merely looks escaped");
});

check("a number is stringified and a null is empty", () => {
  eq(esc(4.5), "4.5", "number");
  eq(esc(null), "", "null");
  eq(esc(undefined), "", "undefined");
});

// ══════════════════════════════════════════════════════════════
section("placeLabel — one location format everywhere");

check("a full place reads City, Region, 🏳 Country", () => {
  eq(
    placeLabel("New Rochelle", "New York", "United States", "US"),
    "New Rochelle, New York, 🇺🇸 United States",
    "label",
  );
});

// The reason the helper exists: dropping a region that repeats its city made
// "New York, USA" read as the state rather than the city drunk in.
check("a region that repeats its city is still printed", () => {
  eq(
    placeLabel("New York", "New York", "United States", "US"),
    "New York, New York, 🇺🇸 United States",
    "New York",
  );
  eq(placeLabel("Antwerp", "Antwerp", "Belgium", "BE"), "Antwerp, Antwerp, 🇧🇪 Belgium", "Antwerp");
});

check("a missing part is dropped, never left as a dangling comma", () => {
  eq(placeLabel("Dublin", "", "Ireland", "IE"), "Dublin, 🇮🇪 Ireland", "no region");
  eq(placeLabel("Dublin", "Leinster", "", ""), "Dublin, Leinster", "no country");
  eq(placeLabel("", "", "", ""), "", "nothing at all");
  eq(placeLabel(null, undefined, null, null), "", "nulls");
});

check("flag:false and lead:false drop only what they name", () => {
  eq(
    placeLabel("Leuven", "Flemish Brabant", "Belgium", "BE", { flag: false }),
    "Leuven, Flemish Brabant, Belgium",
    "flag:false",
  );
  eq(
    placeLabel("Leuven", "Flemish Brabant", "Belgium", "BE", { lead: false }),
    "Flemish Brabant, 🇧🇪 Belgium",
    "lead:false",
  );
});

check("the parts are escaped, because a place name can carry an apostrophe", () => {
  eq(
    placeLabel("L'Aquila", "Abruzzo", "Italy", "IT"),
    "L&#39;Aquila, Abruzzo, 🇮🇹 Italy",
    "escaped",
  );
});

// A country code with no flag is a data error caught elsewhere; here it just
// must not print the word "undefined".
check("an unknown country code loses the flag, not the country", () => {
  eq(placeLabel("Somewhere", "", "Atlantis", "ZZ"), "Somewhere, Atlantis", "label");
});

// ══════════════════════════════════════════════════════════════
section("placeLabel — the app and the stats site still agree");

// The format is written twice: `placeLabel` in src/lib/place.ts for the app,
// and this one for the site. Nothing but this compares them, and they have
// been out of step before — the map said "City, Region" with the country on a
// line of its own while the beer sheet said "City, Country".
const unescape = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

let appPlaceLabel;
try {
  // Type-stripped by Node itself (22.18+). place.ts imports nothing, which is
  // what makes it loadable here.
  ({ placeLabel: appPlaceLabel } = await import("../src/lib/place.ts"));
} catch (err) {
  failures++;
  console.log(
    `  ✗ src/lib/place.ts could not be loaded — the app half of the format is unchecked\n` +
      `      ${err.message}\n` +
      `      (needs Node 22.18+, which strips the types; \`node --version\` here: ${process.version})`,
  );
}

if (appPlaceLabel) {
  check("both helpers write every real location the same way", () => {
    for (const l of drunkLocs) {
      const site = unescape(placeLabel(l.city, l.region, l.country, l.cc, { flag: false }));
      const app = appPlaceLabel(l);
      eq(app, site, `${l.city}`);
    }
  });

  check("both helpers drop a missing part the same way", () => {
    const cases = [
      { city: "Dublin", region: "", country: "Ireland" },
      { city: "Dublin", region: "Leinster", country: "" },
      { city: "", region: "", country: "Ireland" },
      { city: "New York", region: "New York", country: "United States" },
      { city: " Padded ", region: " Region ", country: " Country " },
    ];
    for (const c of cases) {
      const site = unescape(placeLabel(c.city, c.region, c.country, "", { flag: false }));
      eq(appPlaceLabel(c), site, JSON.stringify(c));
    }
  });
}

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

check("rankBy puts every qualified group above every thin one", () => {
  const list = [
    { l: "thin-5.00", a: 5, c: 1 },
    { l: "qualified-3.00", a: 3, c: 9 },
    { l: "thin-4.00", a: 4, c: 2 },
    { l: "qualified-4.50", a: 4.5, c: 3 },
  ];
  const order = [...list]
    .sort(
      rankBy(
        (o) => o.a,
        (o) => o.c,
      ),
    )
    .map((o) => o.l);
  eq(order.join(" · "), "qualified-4.50 · qualified-3.00 · thin-5.00 · thin-4.00", "order");
});

// The headline callouts read [0] off a ranked list, so a single generous pour
// in a city visited once must not be able to reach it.
check("rankable() is the slice that may be called best or worst", () => {
  const list = [{ c: 1 }, { c: 5 }, { c: 3 }];
  eq(rankable(list).length, 2, "qualified only");
  eq(rankable([{ c: 1 }, { c: 2 }]).length, 2, "falls back to the whole list when none qualify");
  eq(rankable([]).length, 0, "empty stays empty");
  eq(rankable([{ n: 1 }, { n: 9 }], (o) => o.n).length, 1, "a custom count accessor");
});

check("barFill mutes a thin bar and leaves a qualified one alone", () => {
  eq(barFill("#e9a23b", 1), "#e9a23bb3", "thin");
  eq(barFill("#e9a23b", MIN_N), "#e9a23b", "qualified");
});

check("nLabel is just the count", () => eq(nLabel(6), "(6)", "label"));

// ══════════════════════════════════════════════════════════════
section("the rating ramp");

// The chart colours and the .r5…r2 badges are the same ladder, read at the
// same boundaries. A rating sitting exactly on one belongs to the band above.
check("every boundary belongs to the band above it", () => {
  const bands = [
    [4.5, "#46c68a", "r5"],
    [4.0, "#8cc46a", "r4"],
    [3.5, "#ccb44f", "r35"],
    [3.0, "#e9a23b", "r3"],
    [2.5, "#dd8555", "r25"],
    [2.0, "#e5646f", "r2"],
  ];
  for (const [r, color, badge] of bands) {
    eq(rC(r), color, `rC(${r})`);
    eq(rbC(r), badge, `rbC(${r})`);
  }
  eq(rC(4.49), "#8cc46a", "just under 4.5");
  eq(rbC(4.49), "r4", "just under 4.5");
  eq(rC(5), "#46c68a", "top");
  eq(rbC(0), "r2", "bottom");
});

check("avg and std answer 0 for nothing rather than NaN", () => {
  eq(avg([]), 0, "avg([])");
  eq(std([]), 0, "std([])");
  near(avg([4, 5]), 4.5, "avg");
  near(std([4, 4, 4]), 0, "std of identical values");
  near(std([2, 4]), 1, "std");
});

// ══════════════════════════════════════════════════════════════
section("computeCanonLoc — the canonical location rule (dormant)");

// Nothing here runs against the committed data: every beer is currently
// reviewed in exactly one city. It starts running by itself the first time a
// beer is logged in a second one.
const loc = (city, extra = {}) => ({
  city,
  region: `${city} region`,
  country: "Country",
  cc: "XX",
  ...extra,
});
const pour = (beer, city) => ({ beer, ...loc(city) });
const canon = (rows) => {
  globals.beers = rows;
  return computeCanonLoc();
};

check("a beer reviewed in one city is left alone", () => {
  const out = canon([pour("Duvel", "Leuven"), pour("Duvel", "Leuven"), pour("Stella", "Antwerp")]);
  eq(out.size, 0, "entries");
});

check("the rarest-visited city wins", () => {
  const out = canon([
    pour("Duvel", "Leuven"),
    pour("Duvel", "Ghent"),
    pour("Stella", "Leuven"),
    pour("Jupiler", "Leuven"),
  ]);
  eq(out.get("Duvel").city, "Ghent", "canonical city");
  eq(out.get("Duvel").region, "Ghent region", "carries the city's own region");
  eq(out.get("Duvel").cc, "XX", "carries the city's own cc");
});

// The rule that is not just "rarest": a home market never wins while the beer
// has anywhere else to be filed, however many reviews the alternative holds.
check("a home city never wins while an alternative exists", () => {
  const out = canon([
    pour("Sam Adams", "New Rochelle"),
    pour("Sam Adams", "Leuven"),
    pour("Duvel", "Leuven"),
    pour("Stella", "Leuven"),
    pour("Jupiler", "Leuven"),
    pour("Peroni", "Leuven"),
  ]);
  eq(out.get("Sam Adams").city, "Leuven", "away city with five reviews still beats home with one");
});

check("both home cities falls back to the rarest of them", () => {
  const out = canon([
    pour("Sam Adams", "New Rochelle"),
    pour("Sam Adams", "New York"),
    pour("Brooklyn Lager", "New York"),
    pour("Sixpoint", "New York"),
  ]);
  eq(out.get("Sam Adams").city, "New Rochelle", "rarest home city");
});

check("a tie on review count is broken alphabetically, not by insertion order", () => {
  const out = canon([pour("Duvel", "Zagreb"), pour("Duvel", "Antwerp")]);
  eq(out.get("Duvel").city, "Antwerp", "alphabetical");
  const reversed = canon([pour("Duvel", "Antwerp"), pour("Duvel", "Zagreb")]);
  eq(reversed.get("Duvel").city, "Antwerp", "same answer whichever order they were logged in");
});

check("three cities resolve to one, not to the last one seen", () => {
  const out = canon([
    pour("Duvel", "Leuven"),
    pour("Duvel", "Ghent"),
    pour("Duvel", "Bruges"),
    pour("Stella", "Ghent"),
    pour("Jupiler", "Ghent"),
    pour("Peroni", "Leuven"),
  ]);
  eq(out.get("Duvel").city, "Bruges", "the rarest of the three");
});

// ══════════════════════════════════════════════════════════════
section("predictRating — the shortlist's guess");

// STATS as the app builds it: a total and a count per style and per country.
const stats = (styleMap = {}, countryMap = {}, globalAvg = 3.6) => {
  globals.STATS = { globalAvg, styleMap, countryMap };
};
const group = (avgRating, count) => ({ t: avgRating * count, c: count });

check("world consensus carries half the guess", () => {
  stats();
  const low = predictRating("IPA", "US", 2.0);
  const high = predictRating("IPA", "US", 4.0);
  near(high - low, 1.0, "half of a two-point swing");
});

// The MIN_N rule, and the reason it is invisible without a test: a style
// average built on one pour still returns a perfectly plausible number.
check("a style below MIN_N does not bend the guess", () => {
  stats({ IPA: group(5.0, MIN_N - 1) });
  const thinStyle = predictRating("IPA", "US", 3.5);
  stats({});
  const unknownStyle = predictRating("IPA", "US", 3.5);
  near(thinStyle, unknownStyle, "a one-pour style counts for exactly nothing");
});

check("a style at MIN_N does move it, by a quarter of its distance", () => {
  stats({ IPA: group(4.6, MIN_N) });
  const qualified = predictRating("IPA", "US", 3.5);
  stats({});
  const base = predictRating("IPA", "US", 3.5);
  near(qualified - base, (4.6 - 3.6) * 0.25, "a quarter of the gap to the global average");
});

check("a country below MIN_N does not bend the guess either", () => {
  stats({}, { BE: group(5.0, MIN_N - 1) });
  const thinCountry = predictRating("IPA", "BE", 3.5);
  stats({}, {});
  near(thinCountry, predictRating("IPA", "BE", 3.5), "a one-pour country counts for nothing");
});

check("a country at MIN_N moves it by fifteen percent of its distance", () => {
  stats({}, { BE: group(4.6, MIN_N) });
  const qualified = predictRating("IPA", "BE", 3.5);
  stats({}, {});
  near(
    qualified - predictRating("IPA", "BE", 3.5),
    (4.6 - 3.6) * 0.15,
    "fifteen percent of the gap",
  );
});

check("the serving method nudges, in the documented direction", () => {
  stats();
  const bottle = predictRating("IPA", "US", 3.5, "Bottle");
  near(predictRating("IPA", "US", 3.5, "Draft") - bottle, 0.1, "Draft");
  near(predictRating("IPA", "US", 3.5, "Nitro") - bottle, 0.05, "Nitro");
  near(predictRating("IPA", "US", 3.5, "Can") - bottle, -0.1, "Can");
  near(predictRating("IPA", "US", 3.5), bottle, "Bottle is the default");
});

check("the guess stays inside the scale it is drawn on", () => {
  stats({ IPA: group(5, 99) }, { US: group(5, 99) }, 5);
  eq(predictRating("IPA", "US", 5, "Draft") <= 5, true, "never above 5");
  stats({ IPA: group(1, 99) }, { US: group(1, 99) }, 1);
  eq(predictRating("IPA", "US", 1, "Can") >= 1, true, "never below 1");
});

// ══════════════════════════════════════════════════════════════
section("isDisplayNew — a badge that stops being news");

check("only a beer flagged new, reviewed this month, wears the badge", () => {
  const now = new Date();
  const m = now.getMonth() + 1,
    y = now.getFullYear();
  eq(isDisplayNew({ isNew: true, monthN: m, year: y }), true, "this month");
  eq(isDisplayNew({ isNew: false, monthN: m, year: y }), false, "not a new beer");
  eq(isDisplayNew({ isNew: true, monthN: (m % 12) + 1, year: y }), false, "another month");
  eq(isDisplayNew({ isNew: true, monthN: m, year: y - 1 }), false, "the same month last year");
});

// ══════════════════════════════════════════════════════════════
console.log("");
if (failures) {
  console.error(`  ${failures} app-logic test(s) failed.\n`);
  process.exit(1);
}
console.log("  app.js behaves.\n");
