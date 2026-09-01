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
  });
}

// Beer name → the domains its logo is looked up from. A beer with no row here
// renders a placeholder forever, in this app and on the site both, so the form
// asks for one when a beer has none.
export function useBrandDomains() {
  return useQuery({
    queryKey: ["brand_domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brand_domains").select("*");
      if (error) throw error;
      const map = new Map<string, string[]>();
      for (const row of (data ?? []) as BrandDomainRow[]) map.set(row.beer_name, row.domains);
      return map;
    },
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
