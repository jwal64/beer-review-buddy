// Where a beer's logo is looked up.
//
// These used to be two hardcoded maps in this file. They were keyed on the beer
// names of the first import — "Sapporo", "Ichiban", "Modelo", "1664" — and the
// names in the database are now the full ones the log actually uses: "Sapporo
// Premium", "Kirin Ichiban", "Modelo Especial", "Kronenbourg 1664". Every one
// of those had quietly stopped resolving.
//
// So the domains come from the brand_domains table instead, which is the same
// place the static site reads them from. One list, one set of names, and a beer
// added here carries its logo to both.
//
// The source chain is the stats site's, tier for tier:
//   local logos/ override → Brandfetch CDN → Google favicons → Icon Horse → monogram
// Tiered by SOURCE, not by domain: every domain a beer lists is tried at each
// tier before dropping to the next, because a real Brandfetch logo for a
// beer's second domain beats a 16px favicon for its first.
import type { BreweryRow } from "@/lib/beer-data";

export type DomainMap = Map<string, string[]>;

// Brandfetch's public dev client ID — the same one the stats site embeds.
const BRANDFETCH_CLIENT_ID = "1idIddY24o2pZE9n2hu";

const brandfetch = (domain: string) =>
  `https://cdn.brandfetch.io/${domain}/w/1024/h/1024?c=${BRANDFETCH_CLIENT_ID}`;
const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=512`;
const iconHorse = (domain: string) => `https://icon.horse/icon/${domain}`;

/** Google's favicon service answers a generic globe for domains it doesn't
 * know — at 16px, whatever size was asked for. A "loaded" image from that
 * tier at favicon size is a miss, not a hit, and the chain should move on. */
export function isSuspectFavicon(url: string, naturalWidth: number) {
  return url.includes("google.com/s2") && naturalWidth > 0 && naturalWidth <= 32;
}

/** A beer's `logo` column as a URL. `logos/<file>` names a file that lives in
 * `public/stats/logos/`, so it resolves under /stats/; anything absolute is a
 * hotlink recorded as-is (npm run check already warns about those). */
function localLogoUrl(logo: string) {
  return /^https?:\/\//.test(logo) ? logo : `/stats/${logo}`;
}

/** Every URL worth trying for a beer's logo, best first. */
export function beerLogoSources(
  beerName: string,
  domains?: DomainMap,
  localLogo?: string | null,
): string[] {
  const sources: string[] = [];
  if (localLogo) sources.push(localLogoUrl(localLogo));
  const doms = domains?.get(beerName) ?? [];
  for (const d of doms) sources.push(brandfetch(d));
  for (const d of doms) sources.push(favicon(d));
  for (const d of doms) sources.push(iconHorse(d));
  return sources;
}

/** The single best-guess logo URL for a beer — for places that can't walk the
 * chain. Prefers the local override, then the first domain's favicon (the
 * tier that essentially never 404s). */
export function beerLogo(beerName: string, domains?: DomainMap, localLogo?: string | null) {
  if (localLogo) return localLogoUrl(localLogo);
  const domain = domains?.get(beerName)?.[0];
  return domain ? favicon(domain) : null;
}

/**
 * The logo for a brewery. Brand domains are keyed by beer, not by brewery, so
 * this borrows the domain of a beer that brewery makes — which is the right
 * answer for the many breweries named after their one beer, and a reasonable
 * one for the rest.
 */
export function breweryLogo(
  name: string,
  beers?: { name: string; brewery: string | null; logo?: string | null }[],
  domains?: DomainMap,
) {
  const mine = beers?.find((b) => b.brewery === name);
  return mine ? beerLogo(mine.name, domains, mine.logo) : null;
}

/** Breweries that have no beer with a known domain — nothing to draw for them. */
export function breweriesWithoutLogos(
  breweries: BreweryRow[],
  beers: { name: string; brewery: string | null }[],
  domains: DomainMap,
) {
  return breweries.filter((br) => !breweryLogo(br.name, beers, domains));
}
