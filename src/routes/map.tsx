import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
import { Skeleton } from "@/components/ui/skeleton";
import { useBeers, useBreweries, useLocations, type Beer } from "@/lib/beer-data";
import { breweryLogo } from "@/lib/logos";
import { ClientOnly } from "@tanstack/react-router";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Beer map — JWAL's Brew Reviews" },
      {
        name: "description",
        content: "Every brewery and drinking spot from the beer log, on one map.",
      },
      { property: "og:title", content: "Beer map — JWAL's Brew Reviews" },
      {
        property: "og:description",
        content: "Every brewery and drinking spot from the beer log, on one map.",
      },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const beers = useBeers();
  const breweries = useBreweries();
  const locations = useLocations();
  const loading = beers.isLoading || breweries.isLoading || locations.isLoading;
  const [filter, setFilter] = useState<{ kind: string; label: string } | null>(null);

  const filteredBeers = useMemo(() => {
    const list = beers.data ?? [];
    if (!filter) return [];
    if (filter.kind === "brewery")
      return list.filter((b) => b.brewery && filter.label.toLowerCase().includes(b.brewery.toLowerCase()));
    if (filter.kind === "city") return list.filter((b) => b.city === filter.label);
    return list;
  }, [beers.data, filter]);

  return (
    <Shell title="Beer map" subtitle="Where it was brewed, where it was drunk.">
      {loading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      ) : (
        <>
          <ClientOnly fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
            <LeafletMap
              breweries={breweries.data ?? []}
              locations={locations.data ?? []}
              onPick={setFilter}
            />
          </ClientOnly>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Brewery
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-chart-3" /> Drank here
            </span>
          </div>

          {filter && (
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">{filter.label}</h2>
                <button
                  onClick={() => setFilter(null)}
                  className="text-xs font-medium text-primary"
                >
                  Clear
                </button>
              </div>
              {filteredBeers.length ? (
                <ul className="space-y-2">
                  {filteredBeers.map((b: Beer) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <BeerLogo name={b.name} brewery={b.brewery} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {b.style} · {b.method}
                        </p>
                      </div>
                      <Rating value={Number(b.rating)} showValue={false} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No beers logged for this spot.</p>
              )}
            </section>
          )}
        </>
      )}
    </Shell>
  );
}

function LeafletMap({
  breweries,
  locations,
  onPick,
}: {
  breweries: ReturnType<typeof useBreweries>["data"] extends infer T
    ? NonNullable<T>
    : never;
  locations: NonNullable<ReturnType<typeof useLocations>["data"]>;
  onPick: (f: { kind: string; label: string }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current || mapRef.current) return;

      const map = L.map(ref.current, { attributionControl: false }).setView([41, -30], 2.2);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
      }).addTo(map);

      const dot = (color: string) =>
        L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid rgba(255,255,255,.85);box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

      const breweryIcon = dot("#3b82f6");
      const cityIcon = dot("#6fb3e0");

      breweries
        .filter((b) => b.lat != null && b.lng != null)
        .forEach((b) => {
          const logo = breweryLogo(b.name);
          const marker = L.marker([b.lat!, b.lng!], { icon: breweryIcon }).addTo(map);
          marker.bindPopup(
            `<div style="font-family:Manrope,sans-serif;display:flex;align-items:center;gap:8px;color:#0a0f1c">
              ${logo ? `<img src="${logo}" width="20" height="20" style="object-fit:contain" alt="" />` : ""}
              <strong>${b.name}</strong>
            </div>`,
          );
          marker.on("click", () => onPick({ kind: "brewery", label: b.name }));
        });

      locations
        .filter((l) => l.lat != null && l.lng != null)
        .forEach((l) => {
          const marker = L.marker([l.lat!, l.lng!], { icon: cityIcon }).addTo(map);
          marker.bindPopup(
            `<div style="font-family:Manrope,sans-serif;color:#0a0f1c"><strong>${l.city}</strong>, ${l.country}</div>`,
          );
          marker.on("click", () => onPick({ kind: "city", label: l.city }));
        });
    })();

    return () => {
      cancelled = true;
    };
  }, [breweries, locations, onPick]);

  return (
    <div
      ref={ref}
      className="h-[420px] w-full overflow-hidden rounded-2xl border border-border"
    />
  );
}
