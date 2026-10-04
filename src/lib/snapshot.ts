// The beer log. This is the whole data layer.
//
// `src/data/log.ts` is the source of truth — a beer is added by editing it —
// and this file is what the app reads from it: the log, flattened into rows by
// `toRows` in ./rows, sorted and given stable ids, once, at module load.
//
// There is no database behind any of this, and no generated copy. There used
// to be both, and each was a way for what was committed to differ from what
// was shown, silently, while every check stayed green (CLAUDE.md, "History").
// Now the bundle is built from the log itself, so the only way for the app to
// show a beer is for it to be in the committed file.
//
// Relative imports with their extension, not `@/`: the chain from here down
// imports nothing at runtime but the log, so tools/ can load it in plain Node.
import * as LOG from "../data/log.ts";
import { toRows } from "./rows.ts";

/** A review — one pour, on one day, in one place. */
export interface Beer {
  id: string;
  seq: number | null;
  name: string;
  brewery: string | null;
  style: string;
  origin_cc: string;
  abv: number;
  method: string;
  city: string;
  region: string;
  country: string;
  cc: string;
  rating: number;
  is_new: boolean;
  /** The log records a month, not a day, so this is the first of that month. */
  drank_on: string;
  /**
   * Graded from memory, for a beer drunk before the log began. It has no real
   * date — `drank_on` is only when it was logged — so it is shown as "Retro"
   * (`whenLabel`), sorts behind every dated review and stays out of the
   * month-by-month charts.
   */
  retro: boolean;
  /** A logo for this pour only, overriding the brand's. Rarely set. */
  logo: string | null;
}

export interface BreweryRow {
  name: string;
  location: string;
  country: string;
  cc: string;
  lang: string;
  native_name: string | null;
  lat: number;
  lng: number;
}

export interface LocationRow {
  id: string;
  city: string;
  region: string | null;
  country: string;
  cc: string;
  lat: number;
  lng: number;
}

export interface CountryRow {
  cc: string;
  flag: string | null;
  name: string | null;
}

/** Where a beer's logo comes from: the committed file, then the domains. */
export interface BrandDomainRow {
  beer_name: string;
  domains: string[];
  logo: string | null;
}

/**
 * What a beer is, apart from how it was rated. `ibu` and `cal` (per 12 fl oz)
 * are the figures a brewery publishes — null where nobody does, never a guess.
 */
export interface BeerFactsRow {
  beer_name: string;
  sub: string | null;
  color: "Pale" | "Gold" | "Amber" | "Dark" | null;
  body: "Light" | "Medium" | "Full" | null;
  ibu: number | null;
  cal: number | null;
  adjuncts: string[];
}

export interface WantToTryRow {
  seq: number | null;
  beer: string;
  style: string;
  origin: string;
  abv: number;
  region: string;
  untappd: number;
  method: string;
  /** Names this beer is logged under, when the shelf name isn't the logged one. */
  aka: string[] | null;
}

export interface UntappdAverageRow {
  beer_name: string;
  avg: number;
}

const raw = toRows(LOG);

// Rows are identified by what makes them unique in the log, so a React key is
// stable across reloads and a row can be pointed at without a database id.
const slug = (...parts: (string | number)[]) => parts.map((p) => String(p)).join("::");

// Built once, at module load. Every hook hands back these same arrays, so the
// memoised selects in beer-data.ts keep their identity and the map's pins —
// and the pop-out a click just opened — are not rebuilt on every render.
// See "Map Rule: The Pop-out Stays Open" in CLAUDE.md.
export const BEERS: Beer[] = raw.beers
  .map((b) => ({ ...b, id: slug("beer", b.name, b.drank_on) }))
  .sort(
    (a, b) =>
      Number(a.retro) - Number(b.retro) ||
      String(b.drank_on).localeCompare(String(a.drank_on)) ||
      (Number(b.seq) || 0) - (Number(a.seq) || 0),
  );

export const BREWERIES: BreweryRow[] = [...raw.breweries].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export const LOCATIONS: LocationRow[] = raw.locations
  .map((l) => ({ ...l, id: slug("loc", l.city, l.cc) }))
  .sort((a, b) => a.city.localeCompare(b.city));

export const COUNTRIES: CountryRow[] = [...raw.countries].sort((a, b) =>
  String(a.name ?? "").localeCompare(String(b.name ?? "")),
);

export const BRAND_DOMAINS: BrandDomainRow[] = raw.brand_domains;

export const BEER_FACTS: BeerFactsRow[] = raw.beer_facts;

export const WANT_TO_TRY: WantToTryRow[] = [...raw.want_to_try].sort(
  (a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0),
);

export const UNTAPPD_AVERAGES: UntappdAverageRow[] = raw.untappd_averages;
