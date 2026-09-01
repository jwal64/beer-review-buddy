/**
 * The analytics behind the Insights tab.
 *
 * The stats site at /stats works these same numbers out in public/stats/app.js.
 * The rules are restated here rather than imported because that file is
 * dependency-free browser JavaScript served as-is, with no module boundary to
 * reach into. Where a rule appears in both places — MIN_N, the prediction
 * blend, the trait list, the quantile method — the shapes are kept identical
 * on purpose, so the app and the site never disagree about a "best", a
 * "weakest" or a "must try".
 */
import type { Beer, BreweryRow, WantToTryRow } from "./beer-data";

// ── Ranking rule: minimum sample size ─────────────────────────
// A group needs at least this many reviews before its average may win or lose
// a ranking. Without it a country visited once tops the table on one generous
// pour. This is the only place the number is written — every caption on the
// page is generated from it.
export const MIN_N = 3;

export const thin = (n: number) => n < MIN_N;

export type Group = {
  label: string;
  avg: number;
  count: number;
};

/** Qualified groups first, best average first; thin ones after, in the same order. */
export function rankBy<T extends Group>(a: T, b: T) {
  const aThin = thin(a.count) ? 1 : 0;
  const bThin = thin(b.count) ? 1 : 0;
  if (aThin !== bThin) return aThin - bThin;
  if (a.avg !== b.avg) return b.avg - a.avg;
  return a.label.localeCompare(b.label);
}

/** The slice that may be called best or worst — the whole list if nothing qualifies. */
export function rankable<T extends Group>(groups: T[]): T[] {
  const qualified = groups.filter((g) => !thin(g.count));
  return qualified.length ? qualified : groups;
}

/** Average rating per key, already ranked. Rows with no key are skipped. */
export function groupRatings<T>(
  rows: T[],
  key: (row: T) => string | null | undefined,
  rating: (row: T) => number,
): Group[] {
  const acc = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    const k = key(row);
    if (!k) continue;
    const cur = acc.get(k) ?? { total: 0, count: 0 };
    cur.total += rating(row);
    cur.count += 1;
    acc.set(k, cur);
  }
  return [...acc.entries()]
    .map(([label, { total, count }]) => ({ label, avg: total / count, count }))
    .sort(rankBy);
}

export const beerRating = (b: Beer) => Number(b.rating);

/** Average rating per beer name — one row per beer however many times it was poured. */
export function perBeerAverages(beers: Beer[]): Group[] {
  return groupRatings(beers, (b) => b.name, beerRating);
}

// ── Statistical summary ───────────────────────────────────────
export type Summary = {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  count: number;
};

export function summarise(values: number[]): Summary {
  const n = values.length;
  if (!n) return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, q1: 0, q3: 0, count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / n;
  // Index-based quartiles, matching the stats site exactly — a different
  // method here would print a different Q1 for the same reviews.
  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2 : sorted[Math.floor(n / 2)]!;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
  return {
    mean,
    median,
    stdDev,
    min: sorted[0]!,
    max: sorted[n - 1]!,
    q1: sorted[Math.floor(n * 0.25)]!,
    q3: sorted[Math.floor(n * 0.75)]!,
    count: n,
  };
}

/** The rating bands the site calls quintiles, widest band first. */
export const RATING_BANDS = [
  { label: "Excellent", range: "4.50–5.00", min: 4.5, tone: "pos" },
  { label: "Good", range: "4.00–4.25", min: 4.0, tone: "pos" },
  { label: "Solid", range: "3.50–3.75", min: 3.5, tone: "flat" },
  { label: "Average", range: "3.00–3.25", min: 3.0, tone: "flat" },
  { label: "Below par", range: "2.50–2.75", min: 2.5, tone: "neg" },
  { label: "Poor", range: "under 2.50", min: -Infinity, tone: "neg" },
] as const;

export function bandCounts(ratings: number[]) {
  return RATING_BANDS.map((band, i) => {
    const upper = i === 0 ? Infinity : RATING_BANDS[i - 1]!.min;
    return { ...band, count: ratings.filter((r) => r >= band.min && r < upper).length };
  });
}

/** Every quarter step from 1.00 to 5.00 that anything actually landed on. */
export function ratingHistogram(ratings: number[]) {
  const acc = new Map<number, number>();
  for (const r of ratings) acc.set(r, (acc.get(r) ?? 0) + 1);
  return [...acc.entries()].sort(([a], [b]) => a - b).map(([rating, count]) => ({ rating, count }));
}

/** Pearson's r — the honest answer to "stronger = better?". */
export function correlation(pairs: Array<[number, number]>) {
  const n = pairs.length;
  if (n < 2) return 0;
  const mx = pairs.reduce((s, [x]) => s + x, 0) / n;
  const my = pairs.reduce((s, [, y]) => s + y, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (const [x, y] of pairs) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den ? num / den : 0;
}

/** Plain words for a correlation, so the number is never left to speak alone. */
export function correlationVerdict(r: number) {
  const strength =
    Math.abs(r) < 0.1
      ? "no"
      : Math.abs(r) < 0.3
        ? "a weak"
        : Math.abs(r) < 0.5
          ? "a moderate"
          : "a strong";
  if (strength === "no") return "No relationship — strength says nothing about how I rate it.";
  return `${strength[0]!.toUpperCase()}${strength.slice(1)} ${r > 0 ? "positive" : "negative"} relationship — stronger beers score ${r > 0 ? "higher" : "lower"}.`;
}

// ── Months ────────────────────────────────────────────────────
export type MonthPoint = {
  /** YYYY-MM, which sorts chronologically as a string. */
  key: string;
  label: string;
  count: number;
  avg: number;
};

export function byMonth(beers: Beer[]): MonthPoint[] {
  const acc = new Map<string, number[]>();
  for (const b of beers) {
    const key = b.drank_on.slice(0, 7);
    acc.set(key, [...(acc.get(key) ?? []), beerRating(b)]);
  }
  return [...acc.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ratings]) => ({
      key,
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" }),
      count: ratings.length,
      avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
    }));
}

/** Calendar month of the year, for the seasonal read. */
export function bySeason(beers: Beer[]) {
  const names = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const acc = names.map(() => [] as number[]);
  for (const b of beers) {
    const m = Number(b.drank_on.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) acc[m]!.push(beerRating(b));
  }
  return names.map((label, i) => ({
    label,
    count: acc[i]!.length,
    avg: acc[i]!.length ? acc[i]!.reduce((s, r) => s + r, 0) / acc[i]!.length : 0,
  }));
}

// ── Taste profile ─────────────────────────────────────────────
// The same eight traits the stats site draws. A trait measured off one or two
// pours is noise, so the count travels with the value and the caller says
// "need 3" rather than drawing a bar that looks like a finding.
export type Trait = { label: string; avg: number; count: number };

export function tasteProfile(beers: Beer[]): Trait[] {
  const tests: Array<[string, (b: Beer) => boolean]> = [
    ["Wheat beer bias", (b) => b.style === "Wheat Beer"],
    ["Dark beer tolerance", (b) => b.style === "Stout" || b.style === "Brown Ale"],
    ["Lager appreciation", (b) => b.style.includes("Lager")],
    ["German beer premium", (b) => b.origin_cc === "DE"],
    ["American beer discount", (b) => b.origin_cc === "US"],
    [
      "Artisan vs macro",
      (b) => b.style.includes("Belgian") || b.style.includes("IPA") || b.style.includes("Wheat"),
    ],
    ["High ABV preference", (b) => Number(b.abv ?? 0) >= 6],
    ["Draft & nitro premium", (b) => b.method === "Draft" || b.method === "Nitro"],
  ];
  return tests.map(([label, test]) => {
    const hits = beers.filter(test);
    return {
      label,
      count: hits.length,
      avg: hits.length ? hits.reduce((s, b) => s + beerRating(b), 0) / hits.length : 0,
    };
  });
}

// ── The world's opinion ───────────────────────────────────────
export type Contrarian = { name: string; mine: number; world: number; delta: number };

/** My average for a beer against the world's, biggest disagreement first. */
export function contrarianRows(beers: Beer[], world: Map<string, number>): Contrarian[] {
  return perBeerAverages(beers)
    .filter((g) => world.has(g.label))
    .map((g) => ({
      name: g.label,
      mine: g.avg,
      world: world.get(g.label)!,
      delta: g.avg - world.get(g.label)!,
    }))
    .sort((a, b) => b.delta - a.delta);
}

// ── The want-to-try shortlist ─────────────────────────────────
/**
 * Case, accents, apostrophes and punctuation flattened; what is left has to
 * match word for word. Deliberately strict — a looser rule would let
 * "Peroni Original" cross off "Peroni Nastro Azzurro".
 */
export const wtNorm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\u00df/g, "ss")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * 50% world consensus, 25% style bias, 15% country bias, 10% base anchor and a
 * nudge for how it is served. A style or country average only counts as signal
 * at MIN_N or more; below that the term falls back to the global average,
 * which makes it contribute nothing rather than bending the guess toward a
 * single pour.
 */
export function predictRating({
  style,
  origin,
  untappd,
  method,
  globalAvg,
  styleGroups,
  countryGroups,
}: {
  style: string;
  origin: string | null;
  untappd: number;
  method: string | null;
  globalAvg: number;
  styleGroups: Map<string, Group>;
  countryGroups: Map<string, Group>;
}) {
  const signal = (g: Group | undefined) => (g && !thin(g.count) ? g.avg : globalAvg);
  const styleAvg = signal(styleGroups.get(style));
  const countryAvg = signal(origin ? countryGroups.get(origin) : undefined);
  const methodAdj =
    method === "Draft" ? 0.1 : method === "Nitro" ? 0.05 : method === "Can" ? -0.1 : 0;
  const t =
    untappd * 0.5 +
    (globalAvg + (styleAvg - globalAvg)) * 0.25 +
    (globalAvg + (countryAvg - globalAvg)) * 0.15 +
    globalAvg * 0.1 +
    methodAdj;
  return Math.min(5, Math.max(1, t));
}

/** Verdict on a predicted rating — the same four words the site uses. */
export const wtVerdict = (guess: number) =>
  guess >= 4 ? "Must try" : guess >= 3.5 ? "Worth it" : guess >= 3 ? "Decent" : "Long shot";

export type ShortlistEntry = {
  row: WantToTryRow;
  guess: number;
  /** The rating actually given, once the beer has been drunk under any of its names. */
  actual: number | null;
};

/**
 * Every shortlist entry, scored, and told whether it has been crossed off.
 * Nothing is ever removed from the list: an entry with a matching review moves
 * to the scorecard, where the guess made beforehand is held against the rating
 * given after.
 */
export function scoreShortlist(
  rows: WantToTryRow[],
  beers: Beer[],
  globalAvg: number,
  styleGroups: Map<string, Group>,
  countryGroups: Map<string, Group>,
): ShortlistEntry[] {
  const reviewed = new Map<string, number[]>();
  for (const b of beers) {
    const k = wtNorm(b.name);
    reviewed.set(k, [...(reviewed.get(k) ?? []), beerRating(b)]);
  }
  return rows.map((row) => {
    let actual: number | null = null;
    for (const name of [row.beer, ...(row.aka ?? [])]) {
      const hit = reviewed.get(wtNorm(name));
      if (hit?.length) {
        actual = hit.reduce((s, r) => s + r, 0) / hit.length;
        break;
      }
    }
    return {
      row,
      actual,
      guess: predictRating({
        style: row.style,
        origin: row.origin,
        untappd: Number(row.untappd ?? globalAvg),
        method: row.method,
        globalAvg,
        styleGroups,
        countryGroups,
      }),
    };
  });
}

// ── Labels ────────────────────────────────────────────────────
/** ISO 639-1 → the language's English name, for the brewing-language ranking. */
export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  de: "German",
  nl: "Dutch",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  ja: "Japanese",
  cs: "Czech",
  pl: "Polish",
  da: "Danish",
  pt: "Portuguese",
  sv: "Swedish",
  no: "Norwegian",
  zh: "Chinese",
  th: "Thai",
  el: "Greek",
  af: "Afrikaans",
  ar: "Arabic",
};

/** Beer name → the language its brewery brews in. */
export function beerLanguages(beers: Beer[], breweries: BreweryRow[]) {
  const byName = new Map(breweries.map((br) => [br.name, br.lang]));
  return groupRatings(
    beers,
    (b) => {
      const lang = b.brewery ? byName.get(b.brewery) : null;
      return lang ? (LANGUAGE_NAMES[lang] ?? lang) : null;
    },
    beerRating,
  );
}
