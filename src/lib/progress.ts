/**
 * The Passport tab: badges, stamps, streaks, goals and style bingo — the log
 * read as a game rather than as statistics.
 *
 * Everything here is a pure function of the rows, recomputed on every render,
 * so a badge is earned the moment the review that earns it is committed and
 * nothing is stored that could disagree with the log. No runtime imports but
 * relative `.ts` modules that have none themselves, so
 * tools/app-logic-test.mjs runs it in plain Node.
 *
 * One rule runs through all of it: **a retro review counts, but it has no
 * date.** It was drunk before the log began, so it fills a badge's progress
 * and stamps a country, but it never says *when* — that reads "Retro" — and it
 * never counts toward a streak or a year's goal.
 */
import type { Style } from "../data/log-types.ts";
import {
  CONTINENTS,
  CONTINENT_ORDER,
  CONTINENT_SIZES,
  sovereign,
  type Continent,
} from "../data/continents.ts";
import { wtNorm, type ShortlistEntry } from "./insights.ts";
import type { Beer, BeerFactsRow, BreweryRow, GoalRow, WantToTryRow } from "./snapshot.ts";

/** When something first happened: a review's `drank_on`, or "retro" when no date exists. */
export type When = string | "retro";

// Retro reviews happened before the log began, so they come first; the rest
// read as the diary does — by month, then the order they were logged in.
export function chronological(beers: Beer[]): Beer[] {
  return [...beers].sort(
    (a, b) =>
      Number(b.retro) - Number(a.retro) ||
      a.drank_on.localeCompare(b.drank_on) ||
      (a.seq ?? 0) - (b.seq ?? 0),
  );
}

const whenOf = (b: Beer): When => (b.retro ? "retro" : b.drank_on);

const distinct = <T>(rows: T[], key: (r: T) => string | null | undefined) =>
  new Set(rows.map(key).filter((k): k is string => !!k)).size;

/** The largest number of distinct `value`s sharing one `group`. */
function mostPerGroup<T>(rows: T[], group: (r: T) => string | null, value: (r: T) => string) {
  const acc = new Map<string, Set<string>>();
  for (const r of rows) {
    const g = group(r);
    if (!g) continue;
    const set = acc.get(g) ?? new Set<string>();
    set.add(value(r));
    acc.set(g, set);
  }
  return Math.max(0, ...[...acc.values()].map((s) => s.size));
}

// A Record over the union, so adding a style to log-types.ts without adding it
// here is a type error rather than a badge that can never be earned.
const STYLE_SET: Record<Style, true> = {
  Lager: true,
  Pilsner: true,
  "Wheat Beer": true,
  "Belgian Ale": true,
  IPA: true,
  "Pale Ale": true,
  Stout: true,
  "Brown Ale": true,
  "Red Ale": true,
  "Shandy / Radler": true,
};
export const ALL_STYLES = Object.keys(STYLE_SET) as Style[];
export const ALL_METHODS = ["Draft", "Bottle", "Can", "Nitro"] as const;

// ── Badges ────────────────────────────────────────────────────

/** What a badge measure may look at besides the reviews themselves. */
export interface BadgeContext {
  breweries: BreweryRow[];
  facts: Map<string, BeerFactsRow>;
  world: Map<string, number>;
  shortlist: WantToTryRow[];
}

export interface BadgeDef {
  id: string;
  emoji: string;
  title: string;
  /** What it takes, in a phrase. */
  how: string;
  target: number;
  /**
   * How far a set of reviews has got. Must never decrease as reviews are
   * added — earnedOn is found by walking the diary forward until it reaches
   * the target.
   */
  measure: (beers: Beer[], ctx: BadgeContext) => number;
}

const brewingLanguage = (b: Beer, ctx: BadgeContext) =>
  ctx.breweries.find((br) => br.name === b.brewery)?.lang ?? null;

export const BADGES: BadgeDef[] = [
  {
    id: "first-pour",
    emoji: "🍺",
    title: "First pour",
    how: "Log a review",
    target: 1,
    measure: (bs) => bs.length,
  },
  {
    id: "half-century",
    emoji: "🍻",
    title: "Half century",
    how: "50 reviews",
    target: 50,
    measure: (bs) => bs.length,
  },
  {
    id: "centurion",
    emoji: "💯",
    title: "Centurion",
    how: "100 reviews",
    target: 100,
    measure: (bs) => bs.length,
  },
  {
    id: "ten-flags",
    emoji: "🚩",
    title: "Ten flags",
    how: "Beers from 10 brewing countries",
    target: 10,
    measure: (bs) => distinct(bs, (b) => b.origin_cc),
  },
  {
    id: "twenty-five-flags",
    emoji: "🗺️",
    title: "Twenty-five flags",
    how: "Beers from 25 brewing countries",
    target: 25,
    measure: (bs) => distinct(bs, (b) => b.origin_cc),
  },
  {
    id: "fifty-flags",
    emoji: "🌐",
    title: "Fifty flags",
    how: "Beers from 50 brewing countries",
    target: 50,
    measure: (bs) => distinct(bs, (b) => b.origin_cc),
  },
  {
    id: "six-continents",
    emoji: "🧭",
    title: "Six continents",
    how: "A beer brewed on every inhabited continent",
    target: CONTINENT_ORDER.length,
    measure: (bs) => distinct(bs, (b) => CONTINENTS[b.origin_cc]),
  },
  {
    id: "style-sweep",
    emoji: "🎨",
    title: "Style sweep",
    how: `All ${ALL_STYLES.length} styles`,
    target: ALL_STYLES.length,
    measure: (bs) => distinct(bs, (b) => (b.style in STYLE_SET ? b.style : null)),
  },
  {
    id: "every-pour",
    emoji: "🫗",
    title: "Every pour",
    how: "Draft, bottle, can and nitro",
    target: ALL_METHODS.length,
    measure: (bs) =>
      distinct(bs, (b) =>
        (ALL_METHODS as readonly string[]).includes(b.method) ? b.method : null,
      ),
  },
  {
    id: "top-shelf",
    emoji: "⭐",
    title: "Top shelf",
    how: "Rate a beer 4.50 or higher",
    target: 1,
    measure: (bs) => bs.filter((b) => b.rating >= 4.5).length,
  },
  {
    id: "perfect-pour",
    emoji: "🏆",
    title: "Perfect pour",
    how: "Rate a beer 5.00",
    target: 1,
    measure: (bs) => bs.filter((b) => b.rating >= 5).length,
  },
  {
    id: "heavyweight",
    emoji: "💪",
    title: "Heavyweight",
    how: "A beer of 8% ABV or more",
    target: 1,
    measure: (bs) => bs.filter((b) => b.abv >= 8).length,
  },
  {
    id: "regular",
    emoji: "🏠",
    title: "Regular",
    how: "10 different beers in one city",
    target: 10,
    measure: (bs) =>
      mostPerGroup(
        bs,
        (b) => `${b.city}::${b.cc}`,
        (b) => b.name,
      ),
  },
  {
    id: "loyalist",
    emoji: "🤝",
    title: "Loyalist",
    how: "3 different beers from one brewery",
    target: 3,
    measure: (bs) =>
      mostPerGroup(
        bs,
        (b) => b.brewery,
        (b) => b.name,
      ),
  },
  {
    id: "ten-cities",
    emoji: "🚗",
    title: "Ten cities",
    how: "Drink in 10 different cities",
    target: 10,
    measure: (bs) => distinct(bs, (b) => `${b.city}::${b.cc}`),
  },
  {
    id: "abroad",
    emoji: "✈️",
    title: "Abroad",
    how: "Drink in 5 different countries",
    target: 5,
    measure: (bs) => distinct(bs, (b) => b.cc),
  },
  {
    id: "polyglot",
    emoji: "🗣️",
    title: "Polyglot",
    how: "Beers brewed in 8 languages",
    target: 8,
    measure: (bs, ctx) => distinct(bs, (b) => brewingLanguage(b, ctx)),
  },
  {
    id: "dark-side",
    emoji: "🌑",
    title: "Dark side",
    how: "5 different dark beers",
    target: 5,
    measure: (bs, ctx) =>
      distinct(bs, (b) => (ctx.facts.get(b.name)?.color === "Dark" ? b.name : null)),
  },
  {
    id: "contrarian",
    emoji: "🙃",
    title: "Contrarian",
    how: "A full point away from the world's average",
    target: 1,
    measure: (bs, ctx) =>
      bs.filter((b) => {
        const w = ctx.world.get(b.name);
        return w != null && Math.abs(b.rating - w) >= 1;
      }).length,
  },
  {
    id: "shortlist-slayer",
    emoji: "📋",
    title: "Shortlist slayer",
    how: "Cross 10 beers off the shortlist",
    target: 10,
    measure: (bs, ctx) => {
      const drunk = new Set(bs.map((b) => wtNorm(b.name)));
      return ctx.shortlist.filter((e) =>
        [e.beer, ...(e.aka ?? [])].some((n) => drunk.has(wtNorm(n))),
      ).length;
    },
  },
];

export interface BadgeState {
  def: BadgeDef;
  current: number;
  earned: boolean;
  /** The review that tipped it; null until earned. */
  earnedOn: When | null;
}

export function badges(beers: Beer[], ctx: BadgeContext, defs: BadgeDef[] = BADGES): BadgeState[] {
  const diary = chronological(beers);
  return defs.map((def) => {
    const current = def.measure(diary, ctx);
    const earned = current >= def.target;
    let earnedOn: When | null = null;
    if (earned) {
      // The measures only ever grow, so the first prefix to reach the target
      // ends with the review that earned it. Binary search keeps it cheap.
      let lo = 1,
        hi = diary.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (def.measure(diary.slice(0, mid), ctx) >= def.target) hi = mid;
        else lo = mid + 1;
      }
      const tipping = diary[lo - 1];
      earnedOn = tipping ? whenOf(tipping) : null;
    }
    return { def, current: Math.min(current, def.target), earned, earnedOn };
  });
}

/** Earned first, most recent first; then the rest, closest to done first. */
export function sortBadges(list: BadgeState[]): BadgeState[] {
  const rank = (w: When | null) => (w === "retro" ? "0000" : (w ?? ""));
  return [...list].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return rank(b.earnedOn).localeCompare(rank(a.earnedOn));
    return b.current / b.def.target - a.current / a.def.target;
  });
}

// ── Passport ──────────────────────────────────────────────────

export interface Stamp {
  cc: string;
  /** The first review that stamped it. */
  first: When;
  count: number;
  continent: Continent | null;
}

function stamps(beers: Beer[], key: (b: Beer) => string): Stamp[] {
  const acc = new Map<string, Stamp>();
  for (const b of chronological(beers)) {
    const cc = key(b);
    if (!cc) continue;
    const cur = acc.get(cc);
    if (cur) cur.count += 1;
    else acc.set(cc, { cc, first: whenOf(b), count: 1, continent: CONTINENTS[cc] ?? null });
  }
  return [...acc.values()];
}

export interface ContinentProgress {
  name: Continent;
  visited: number;
  total: number;
}

export interface Passport {
  /** Where the beers were brewed — the passport proper. */
  brewed: Stamp[];
  /** Where they were drunk. */
  drunk: Stamp[];
  continents: ContinentProgress[];
  /** Sovereign brewing countries, against the world's 195. */
  world: { visited: number; total: number };
}

export function passport(beers: Beer[]): Passport {
  const brewed = stamps(beers, (b) => b.origin_cc);
  const drunk = stamps(beers, (b) => b.cc);
  const nations = new Set(brewed.map((s) => sovereign(s.cc)));
  const continents = CONTINENT_ORDER.map((name) => ({
    name,
    visited: [...nations].filter((cc) => CONTINENTS[cc] === name).length,
    total: CONTINENT_SIZES[name],
  }));
  const total = Object.values(CONTINENT_SIZES).reduce((s, n) => s + n, 0);
  return { brewed, drunk, continents, world: { visited: nations.size, total } };
}

/**
 * Shortlist beers that would stamp a brewing country the passport lacks — the
 * best-predicted one per new country, best first.
 */
export function nextStamps(scored: ShortlistEntry[], brewed: Stamp[], limit = 5): ShortlistEntry[] {
  const have = new Set(brewed.map((s) => s.cc));
  const best = new Map<string, ShortlistEntry>();
  for (const e of scored) {
    if (e.actual != null || have.has(e.row.origin)) continue;
    const cur = best.get(e.row.origin);
    if (!cur || e.guess > cur.guess) best.set(e.row.origin, e);
  }
  return [...best.values()].sort((a, b) => b.guess - a.guess).slice(0, limit);
}

// ── Streaks ───────────────────────────────────────────────────

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const prevMonth = (key: string) => {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};

export interface Streak {
  /** Consecutive months with a dated review, ending this month or last. */
  current: number;
  longest: number;
  /** Whether this month already has a review — if not, the streak is at risk. */
  loggedThisMonth: boolean;
  /** The last twelve months, oldest first, and whether each has a review. */
  recent: Array<{ month: string; logged: boolean }>;
}

export function streak(beers: Beer[], now: Date = new Date()): Streak {
  const months = new Set(beers.filter((b) => !b.retro).map((b) => b.drank_on.slice(0, 7)));
  const thisMonth = monthKey(now);
  const loggedThisMonth = months.has(thisMonth);

  // A streak survives a month that hasn't happened yet: until it ends, last
  // month's run is still alive.
  let current = 0;
  let cursor = loggedThisMonth ? thisMonth : prevMonth(thisMonth);
  while (months.has(cursor)) {
    current += 1;
    cursor = prevMonth(cursor);
  }

  let longest = 0;
  for (const m of months) {
    if (months.has(prevMonth(m))) continue; // not the start of a run
    let len = 0,
      k = m;
    while (months.has(k)) {
      len += 1;
      const [y, mm] = k.split("-").map(Number) as [number, number];
      k = mm === 12 ? `${y + 1}-01` : `${y}-${String(mm + 1).padStart(2, "0")}`;
    }
    longest = Math.max(longest, len);
  }

  const recent: Streak["recent"] = [];
  let k = thisMonth;
  for (let i = 0; i < 12; i++) {
    recent.unshift({ month: k, logged: months.has(k) });
    k = prevMonth(k);
  }
  return { current, longest, loggedThisMonth, recent };
}

// ── Goals ─────────────────────────────────────────────────────

export interface GoalMetric {
  key: "reviews" | "new_beers" | "countries";
  label: string;
  current: number;
  target: number;
  /** Where the count would be by `now` if the year ran exactly on pace. */
  pace: number;
}

export interface GoalProgress {
  year: number;
  metrics: GoalMetric[];
}

/** The fraction of `year` that has passed by `now`: 0 before it, 1 after. */
export function yearElapsed(year: number, now: Date): number {
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

export function goals(beers: Beer[], rows: GoalRow[], now: Date = new Date()): GoalProgress[] {
  const firstStamp = new Map(passport(beers).brewed.map((s) => [s.cc, s.first]));
  return rows.map((g) => {
    const inYear = beers.filter((b) => !b.retro && b.drank_on.startsWith(`${g.year}-`));
    const elapsed = yearElapsed(g.year, now);
    const counts: Record<GoalMetric["key"], number> = {
      reviews: inYear.length,
      new_beers: inYear.filter((b) => b.is_new).length,
      countries: [...firstStamp.values()].filter((w) => w !== "retro" && w.startsWith(`${g.year}-`))
        .length,
    };
    const labels: Record<GoalMetric["key"], string> = {
      reviews: "Reviews",
      new_beers: "New beers",
      countries: "New countries",
    };
    const metrics = (["reviews", "new_beers", "countries"] as const)
      .filter((key) => g[key] != null && (g[key] ?? 0) > 0)
      .map((key) => {
        const target = g[key] ?? 0;
        return { key, label: labels[key], current: counts[key], target, pace: target * elapsed };
      });
    return { year: g.year, metrics };
  });
}

// ── Style bingo ───────────────────────────────────────────────

export const BINGO_COLORS = ["Pale", "Gold", "Amber", "Dark"] as const;
export const BINGO_BODIES = ["Light", "Medium", "Full"] as const;

export interface BingoCell {
  color: (typeof BINGO_COLORS)[number];
  body: (typeof BINGO_BODIES)[number];
  /** Distinct beers reviewed in this cell. */
  beers: string[];
  /** For an empty cell, the best-predicted shortlist beer that would fill it. */
  suggestion: ShortlistEntry | null;
}

/**
 * Colour × body, from BEER_FACTS: twelve squares, each filled by any beer
 * whose facts land there. A shortlist beer can only suggest itself for a cell
 * when its own facts are recorded.
 */
export function styleBingo(
  beers: Beer[],
  facts: Map<string, BeerFactsRow>,
  scored: ShortlistEntry[] = [],
): BingoCell[] {
  const cells: BingoCell[] = [];
  for (const color of BINGO_COLORS)
    for (const body of BINGO_BODIES) {
      const names = new Set<string>();
      for (const b of beers) {
        const f = facts.get(b.name);
        if (f?.color === color && f.body === body) names.add(b.name);
      }
      let suggestion: ShortlistEntry | null = null;
      if (!names.size)
        for (const e of scored) {
          const f = facts.get(e.row.beer);
          if (e.actual == null && f?.color === color && f.body === body)
            if (!suggestion || e.guess > suggestion.guess) suggestion = e;
        }
      cells.push({ color, body, beers: [...names].sort(), suggestion });
    }
  return cells;
}

/** Completed lines: a colour with every body, or a body in every colour. A 4×3 card has no diagonals. */
export function bingoLines(cells: BingoCell[]): number {
  const filled = (c: string, b: string) =>
    cells.some((x) => x.color === c && x.body === b && x.beers.length > 0);
  const rows = BINGO_COLORS.filter((c) => BINGO_BODIES.every((b) => filled(c, b))).length;
  const cols = BINGO_BODIES.filter((b) => BINGO_COLORS.every((c) => filled(c, b))).length;
  return rows + cols;
}
