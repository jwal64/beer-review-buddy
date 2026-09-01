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
import type { BreweryRow } from "@/lib/beer-data";

export type DomainMap = Map<string, string[]>;

function favicon(domain: string, size = 128) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

/** The logo for a beer, by its exact name. */
export function beerLogo(beerName: string, domains?: DomainMap) {
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
  beers?: { name: string; brewery: string | null }[],
  domains?: DomainMap,
) {
  const mine = beers?.find((b) => b.brewery === name);
  const domain = mine ? domains?.get(mine.name)?.[0] : undefined;
  return domain ? favicon(domain) : null;
}

/** Breweries that have no beer with a known domain — nothing to draw for them. */
export function breweriesWithoutLogos(
  breweries: BreweryRow[],
  beers: { name: string; brewery: string | null }[],
  domains: DomainMap,
) {
  return breweries.filter((br) => !breweryLogo(br.name, beers, domains));
}
