import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Beer = {
  id: string;
  name: string;
  brewery: string | null;
  style: string;
  origin_cc: string | null;
  abv: number | null;
  method: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  cc: string | null;
  rating: number;
  is_new: boolean;
  drank_on: string;
  notes: string | null;
};

export type BreweryRow = {
  id: string;
  name: string;
  location: string | null;
  country: string | null;
  cc: string | null;
  lat: number | null;
  lng: number | null;
};

export type LocationRow = {
  id: string;
  city: string;
  region: string | null;
  country: string;
  cc: string | null;
  lat: number | null;
  lng: number | null;
};

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

export function averageRating(beers: Beer[]) {
  if (!beers.length) return 0;
  return beers.reduce((sum, b) => sum + Number(b.rating), 0) / beers.length;
}

export function flagEmoji(cc?: string | null) {
  if (!cc || cc.length !== 2) return "🌍";
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
