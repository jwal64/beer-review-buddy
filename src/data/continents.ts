// Which continent each country code belongs to, for the passport.
//
// Every code in FLAGS needs a row here — `npm run check` fails on one that
// has none — so a beer from a new country means adding it in three places:
// FLAGS, CNAMES and here. Transcontinental countries follow the UN geoscheme
// (Turkey and Lebanon are Western Asia).
//
// No imports: tools/ load this in plain Node.

export type Continent =
  "Europe" | "Asia" | "Africa" | "North America" | "South America" | "Oceania";

/** Sovereign countries per continent, by UN membership — 195 with the two observers. */
export const CONTINENT_SIZES: Record<Continent, number> = {
  Europe: 44,
  Asia: 48,
  Africa: 54,
  "North America": 23,
  "South America": 12,
  Oceania: 14,
};

export const CONTINENT_ORDER: Continent[] = [
  "Europe",
  "North America",
  "South America",
  "Asia",
  "Africa",
  "Oceania",
];

export const CONTINENTS: Record<string, Continent> = {
  AR: "South America",
  AT: "Europe",
  AU: "Oceania",
  BE: "Europe",
  BG: "Europe",
  BR: "South America",
  CA: "North America",
  CN: "Asia",
  CO: "South America",
  CU: "North America",
  CZ: "Europe",
  DE: "Europe",
  DK: "Europe",
  DO: "North America",
  EE: "Europe",
  ES: "Europe",
  FI: "Europe",
  FR: "Europe",
  GB: "Europe",
  "GB-ENG": "Europe",
  "GB-NIR": "Europe",
  "GB-SCT": "Europe",
  "GB-WLS": "Europe",
  GR: "Europe",
  HR: "Europe",
  IE: "Europe",
  IT: "Europe",
  JM: "North America",
  JP: "Asia",
  KR: "Asia",
  LB: "Asia",
  ME: "Europe",
  MX: "North America",
  NL: "Europe",
  NO: "Europe",
  NZ: "Oceania",
  PE: "South America",
  PL: "Europe",
  PR: "North America",
  PT: "Europe",
  RO: "Europe",
  SE: "Europe",
  SG: "Asia",
  SI: "Europe",
  TH: "Asia",
  TR: "Asia",
  UA: "Europe",
  US: "North America",
  ZA: "Africa",
};

/**
 * The sovereign country a code counts as when measuring the world: England,
 * Scotland, Wales and Northern Ireland are one United Kingdom, and Puerto Rico
 * is part of the United States. The passport still stamps each one on its own.
 */
export const SOVEREIGN: Record<string, string> = {
  "GB-ENG": "GB",
  "GB-NIR": "GB",
  "GB-SCT": "GB",
  "GB-WLS": "GB",
  PR: "US",
};

export const sovereign = (cc: string) => SOVEREIGN[cc] ?? cc;
