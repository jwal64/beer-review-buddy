// The shape of the log, as it is written in src/data/log.ts.
//
// This is the authoring shape — a diary, the way a beer is added by hand — not
// the flat rows the app reads (those are in src/lib/snapshot.ts, produced by
// src/lib/rows.ts). `npx tsc --noEmit` checks every entry in the log against
// these types, so a misspelt style, a missing field or a rating typed as a
// string fails before `npm run check` is even asked.
//
// No runtime code: tools/ import the log in plain Node, which strips types and
// cannot follow an import of anything that does not.

export type Style =
  | "Lager"
  | "Pilsner"
  | "Wheat Beer"
  | "Belgian Ale"
  | "IPA"
  | "Pale Ale"
  | "Stout"
  | "Brown Ale"
  | "Red Ale"
  | "Shandy / Radler";

export type Method = "Bottle" | "Can" | "Draft" | "Nitro";

export type MonthName =
  "Jan" | "Feb" | "Mar" | "Apr" | "May" | "Jun" | "Jul" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec";

/** One pour, on one day, in one place. */
export interface Review {
  /** The marketed beer name. Every keyed map below uses exactly this string. */
  beer: string;
  style: Style;
  /** ISO 3166-1 alpha-2 of the brewery's home country (GB split by nation). */
  origin: string;
  abv: number;
  method: Method;
  /** Where it was drunk — must match a row in `drunkLocs`. */
  city: string;
  region: string;
  country: string;
  cc: string;
  /** Out of 5, quarter steps only. */
  rating: number;
  /** Never reviewed before. Not derivable — ask when unsure. */
  isNew: boolean;
  month: MonthName;
  monthN: number;
  year: number;
  /** Graded from memory, for a beer drunk before the log began. */
  retro?: true;
  /** A logo for this pour only, overriding the brand's file. Rarely set. */
  logo?: string;
}

/** Every city a review was logged in. */
export interface DrunkLocation {
  city: string;
  region: string;
  country: string;
  cc: string;
  lat: number;
  lng: number;
}

export interface Brewery {
  name: string;
  /** "City, Region" of the original site, not a satellite plant. */
  location: string;
  country: string;
  cc: string;
  /** ISO 639-1 of the brewery's home language. */
  lang: string;
  /** Every beer of theirs reviewed so far, `·`-separated, oldest first. */
  beers: string;
  /** This brewery's own site — never the city centre. */
  lat: number;
  lng: number;
  /** One rating per beer in `beers`, same order. */
  ratings: number[];
  /** Only when the native name differs from the marketed one. */
  nativeName?: string;
}

export interface BeerFacts {
  sub: string | null;
  color: "Pale" | "Gold" | "Amber" | "Dark" | null;
  body: "Light" | "Medium" | "Full" | null;
  /** The brewery's published figure, or null — never an estimate. */
  ibu: number | null;
  /** Per 12 fl oz; the brewery's published figure, or null. */
  cal: number | null;
  adjuncts: string[];
}

export interface WantToTry {
  beer: string;
  style: Style;
  origin: string;
  abv: number;
  region: string;
  /** The world's average on Untappd. */
  untappd: number;
  method: Method;
  /** Other names the beer is logged under, when the shelf name differs. */
  as?: string[];
}

/** One domain, or several tried in order for a brand at more than one address. */
export type BrandDomain = string | string[];
