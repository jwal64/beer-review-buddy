import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// These mirror the tables, which are the source of truth for the static site
// at jwal64/JWAL-BEER-REVIEW as well as for this app. A column that is not null
// here is one that site cannot render without — see its CLAUDE.md.
import type { Tables } from "@/integrations/supabase/types";

export type Beer = Tables<"beers">;
export type BreweryRow = Tables<"breweries">;
export type LocationRow = Tables<"locations">;
export type CountryRow = Tables<"countries">;
export type BrandDomainRow = Tables<"brand_domains">;
export type WantToTryRow = Tables<"want_to_try">;
export type UntappdAverageRow = Tables<"untappd_averages">;

// The ten styles the site has a colour for. A style outside this list renders
// uncoloured there and fails its data check, so the form offers only these.
export const STYLES = [
  "Lager",
  "Pilsner",
  "Wheat Beer",
  "Belgian Ale",
  "IPA",
  "Pale Ale",
  "Stout",
  "Brown Ale",
  "Red Ale",
  "Shandy / Radler",
] as const;

/**
 * How long a fetched table is treated as fresh.
 *
 * Without this, React Query's default of 0 refetches a table the moment any
 * new component subscribes to it — and every refetch hands back a new array
 * or Map. That churn is not free: it is what used to rebuild the map's pins
 * (and, before that, the whole map) the instant a marker was clicked and the
 * beer list mounted its logos. Writes call invalidateQueries, which overrides
 * this, so nothing goes stale after a beer is added or edited.
 */
const FRESH_FOR = 5 * 60 * 1000;

export const METHODS = ["Draft", "Bottle", "Can", "Nitro"] as const;

export function useBeers() {
  return useQuery({
    queryKey: ["beers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beers")
        .select("*")
        .order("drank_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Beer[];
    },
    staleTime: FRESH_FOR,
  });
}

export function useBreweries() {
  return useQuery({
    queryKey: ["breweries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("breweries").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as BreweryRow[];
    },
    staleTime: FRESH_FOR,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("locations").select("*").order("city");
      if (error) throw error;
      return (data ?? []) as LocationRow[];
    },
    staleTime: FRESH_FOR,
  });
}

// A country code has to carry both a flag and a display name; one without the
// other renders a blank or the literal code on the site. The form picks from
// this list rather than letting a code be typed.
export function useCountries() {
  return useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("countries").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as CountryRow[];
    },
    staleTime: FRESH_FOR,
  });
}

// One row per beer name, holding both halves of "where does this logo come
// from": the committed file for the brand, and the domains to fall back to if
// there isn't one. Both hooks below read it, under one query key, so the two
// views of the table cost a single request.
function brandDomainsQuery() {
  return {
    queryKey: ["brand_domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_domains").select("*");
      if (error) throw error;
      return (data ?? []) as BrandDomainRow[];
    },
    staleTime: FRESH_FOR,
  };
}

// Beer name → the domains its logo is looked up from. A beer with no row here
// renders a placeholder forever, in this app and on the site both, so the form
// asks for one when a beer has none.
export function useBrandDomains() {
  return useQuery({
    ...brandDomainsQuery(),
    select: (rows: BrandDomainRow[]) => {
      const map = new Map<string, string[]>();
      for (const row of rows) map.set(row.beer_name, row.domains);
      return map;
    },
  });
}

// Beer name → the logo file committed for that brand, under the static site's
// logos/. This is where a logo normally comes from: it is the same picture on
// every render, it works offline, and no third party can withdraw it. The
// domains are what happens when a beer has no file yet.
export function useBrandLogos() {
  return useQuery({
    ...brandDomainsQuery(),
    select: (rows: BrandDomainRow[]) => {
      const map = new Map<string, string>();
      for (const row of rows) if (row.logo) map.set(row.beer_name, row.logo);
      return map;
    },
  });
}

// The standing shortlist of beers not yet drunk. Nothing is ever deleted from
// it — an entry with a matching review crosses itself off and is scored
// against the prediction made beforehand, which is the only thing that makes
// the scorecard worth having. `seq` is the order it was authored in.
export function useWantToTry() {
  return useQuery({
    queryKey: ["want_to_try"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("want_to_try")
        .select("*")
        .order("seq", { ascending: true, nullsFirst: false })
        .order("beer");
      if (error) throw error;
      return (data ?? []) as WantToTryRow[];
    },
    staleTime: FRESH_FOR,
  });
}

// The world's average for a beer, keyed by the exact name as reviewed. It is
// what makes the contrarian read possible: my rating is only interesting held
// against what everyone else thought.
export function useUntappdAverages() {
  return useQuery({
    queryKey: ["untappd_averages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("untappd_averages").select("*");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of (data ?? []) as UntappdAverageRow[])
        map.set(row.beer_name, Number(row.avg));
      return map;
    },
    staleTime: FRESH_FOR,
  });
}

export function averageRating(beers: Beer[]) {
  if (!beers.length) return 0;
  return beers.reduce((sum, b) => sum + Number(b.rating), 0) / beers.length;
}

// The flag for a country code. Prefer the one the countries table stores —
// it is what the site renders, and the codes are not all two letters: the UK is
// split into GB-ENG, GB-SCT, GB-WLS and GB-NIR, which no arithmetic on letters
// can turn into a flag.
export function flagEmoji(cc?: string | null, countries?: CountryRow[]) {
  if (!cc) return "🌍";
  const known = countries?.find((c) => c.cc === cc)?.flag;
  if (known) return known;
  if (cc.length !== 2) return "🌍";
  return String.fromCodePoint(
    ...cc
      .toUpperCase()
      .split("")
      .map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

export function formatMonth(date: string) {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
