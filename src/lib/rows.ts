// The log, flattened into the rows the app reads.
//
// src/data/log.ts is written as a diary: a brewery lists the beers it makes, a
// review names its month. The screens want flat rows instead — a beer that
// names its brewery, a date they can sort on. This is that translation,
// written once and run once, at module load, by src/lib/snapshot.ts.
//
// Two brewery fields deliberately have no row of their own: `beers` (the
// `·`-joined list of what it makes) and `ratings` (what each scored). Both are
// derivable from the reviews, so the rows never carry them; `npm run check`
// fails when the log's copy disagrees with the reviews.
//
// No runtime imports — only types — so tools/ can run it in plain Node.
import type * as Log from "../data/log.ts";
import type {
  BeerFactsRow,
  BrandDomainRow,
  BreweryRow,
  CountryRow,
  LocationRow,
  UntappdAverageRow,
  WantToTryRow,
  Beer,
} from "./snapshot.ts";

type LogModule = typeof Log;

export interface Rows {
  countries: CountryRow[];
  locations: Omit<LocationRow, "id">[];
  breweries: BreweryRow[];
  beers: Omit<Beer, "id">[];
  brand_domains: BrandDomainRow[];
  beer_facts: BeerFactsRow[];
  want_to_try: WantToTryRow[];
  untappd_averages: UntappdAverageRow[];
}

// The log records a month, not a day — a review is "Mar 2026", never the 14th.
// Rows carry a date because a date is what sorts, so it anchors to the first.
export const monthStart = (year: number, monthN: number) =>
  `${year}-${String(monthN).padStart(2, "0")}-01`;

export const splitBeers = (s: string | null | undefined) =>
  String(s ?? "")
    .split("·")
    .map((x) => x.trim())
    .filter(Boolean);

export function toRows(log: LogModule): Rows {
  // Which brewery makes each beer. In the log the link runs the other way —
  // a brewery lists its beers — so it is inverted once, here.
  const breweryOf = new Map<string, string>();
  for (const br of log.breweries) for (const n of splitBeers(br.beers)) breweryOf.set(n, br.name);

  return {
    countries: Object.keys({ ...log.FLAGS, ...log.CNAMES })
      .sort()
      .map((cc) => ({ cc, flag: log.FLAGS[cc] ?? null, name: log.CNAMES[cc] ?? null })),

    locations: log.drunkLocs.map((l) => ({
      city: l.city,
      region: l.region,
      country: l.country,
      cc: l.cc,
      lat: l.lat,
      lng: l.lng,
    })),

    breweries: log.breweries.map((br) => ({
      name: br.name,
      location: br.location,
      country: br.country,
      cc: br.cc,
      lang: br.lang,
      native_name: br.nativeName ?? null,
      lat: br.lat,
      lng: br.lng,
    })),

    // `seq` preserves the order reviews were logged in within a month: they
    // all share the first-of-the-month date, so without it a month's beers
    // would shuffle among themselves.
    beers: log.beers.map((b, i) => ({
      seq: i + 1,
      name: b.beer,
      brewery: breweryOf.get(b.beer) ?? null,
      style: b.style,
      origin_cc: b.origin,
      abv: b.abv,
      method: b.method,
      city: b.city,
      region: b.region,
      country: b.country,
      cc: b.cc,
      rating: b.rating,
      is_new: b.isNew,
      drank_on: monthStart(b.year, b.monthN),
      // A retro review has no real date: `drank_on` is only when it was
      // logged, which keeps the diary in order, and the app prints "Retro".
      retro: b.retro === true,
      logo: b.logo ?? null,
    })),

    // One row per beer name, carrying both halves of where its logo comes
    // from: the committed file, and the domains to fall back to without one.
    brand_domains: Object.entries(log.BRAND_DOMAINS).map(([beer_name, v]) => ({
      beer_name,
      domains: Array.isArray(v) ? v : [v],
      logo: log.BRAND_LOGOS[beer_name] ?? null,
    })),

    // What each beer is, as opposed to how it was rated. A figure nobody
    // publishes is null — never an estimate.
    beer_facts: Object.entries(log.BEER_FACTS).map(([beer_name, f]) => ({
      beer_name,
      sub: f.sub ?? null,
      color: f.color ?? null,
      body: f.body ?? null,
      ibu: f.ibu ?? null,
      cal: f.cal ?? null,
      adjuncts: f.adjuncts ?? [],
    })),

    want_to_try: log.WANT_TO_TRY.map((e, i) => ({
      seq: i + 1,
      beer: e.beer,
      style: e.style,
      origin: e.origin,
      abv: e.abv,
      region: e.region,
      untappd: e.untappd,
      method: e.method,
      aka: e.as ?? null,
    })),

    untappd_averages: Object.entries(log.UNTAPPD_GLOBAL_AVGS).map(([beer_name, avg]) => ({
      beer_name,
      avg,
    })),
  };
}
