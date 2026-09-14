// The beer log. This is the whole data layer.
//
// `public/stats/data.js` is the source of truth — a beer is added by editing
// it — and `src/data/snapshot.json` is that file projected into flat rows by
// `npm run snapshot`. The app reads the projection because it cannot read
// data.js itself: this is a Vite bundle, and `public/` is served as static
// assets rather than offered as source.
//
// There is no database behind any of this. There was, and it is worth knowing
// why there isn't: carrying data.js into Supabase meant a migration, applying
// a migration was the host's step rather than this repo's, and it stopped
// happening — silently, for days at a time, while every check stayed green. A
// beer that had been added, checked, committed and merged simply was not on
// the site. The log lives in one file now, and what is committed is what is
// shown.
//
// tools/roundtrip-supabase.mjs proves the projection loses nothing, and
// `npm run check` fails when snapshot.json is out of step with data.js — the
// one way this file can now be wrong is by being stale.
import snapshot from "@/data/snapshot.json";

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
  /** data.js records a month, not a day, so this is the first of that month. */
  drank_on: string;
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

interface RawSnapshot {
  countries: CountryRow[];
  locations: Omit<LocationRow, "id">[];
  breweries: BreweryRow[];
  beers: Omit<Beer, "id">[];
  brand_domains: BrandDomainRow[];
  want_to_try: WantToTryRow[];
  untappd_averages: UntappdAverageRow[];
}

const raw = snapshot as unknown as RawSnapshot;

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

export const WANT_TO_TRY: WantToTryRow[] = [...raw.want_to_try].sort(
  (a, b) => (Number(a.seq) || 0) - (Number(b.seq) || 0),
);

export const UNTAPPD_AVERAGES: UntappdAverageRow[] = raw.untappd_averages;
