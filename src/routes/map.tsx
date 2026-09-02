import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBeers,
  useBrandDomains,
  useBrandLogos,
  useBreweries,
  useCountries,
  useLocations,
  flagEmoji,
  type Beer,
  type CountryRow,
} from "@/lib/beer-data";
import { beerLogo, breweryLogo, type DomainMap, type LogoMap } from "@/lib/logos";
import { ClientOnly } from "@tanstack/react-router";
// Bundled with the app — the map's layout breaks entirely without this
// stylesheet, so it must not depend on a third-party CDN being up.
import "leaflet/dist/leaflet.css";

// Leaflet's bindPopup parses HTML, so every data value interpolated into a
// popup goes through this first — a brewery with an apostrophe or a "<" in
// its name would otherwise take the popup markup with it.
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );

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

type MapMode = "drank" | "brewed";

function MapPage() {
  const beers = useBeers();
  const breweries = useBreweries();
  const locations = useLocations();
  const countries = useCountries();
  const { data: domains } = useBrandDomains();
  const { data: logos } = useBrandLogos();
  const loading = beers.isLoading || breweries.isLoading || locations.isLoading;
  const [filter, setFilter] = useState<{ kind: string; label: string } | null>(null);
  const [mode, setMode] = useState<MapMode>("drank");

  const setModeAndClear = (m: MapMode) => {
    setMode(m);
    setFilter(null);
  };

  const filteredBeers = useMemo(() => {
    const list = beers.data ?? [];
    if (!filter) return [];
    // Exact, not a substring test: a beer row names its brewery in full, and
    // several breweries carry their owner's name in brackets. Asking whether
    // "Birra Moretti (Heineken Italia)" contains "Heineken" is true, which
    // listed Heineken's beers under Moretti's pin.
    if (filter.kind === "brewery") return list.filter((b) => b.brewery === filter.label);
    if (filter.kind === "city") return list.filter((b) => b.city === filter.label);
    return list;
  }, [beers.data, filter]);

  // One flag per country a beer was actually drunk in — deduped by code, not
  // by city, so a country visited in three cities still shows once.
  //
  // Read off the reviews rather than the locations table: a location row can
  // exist with nothing logged against it (npm run check only warns about
  // those), and this list claims somewhere a beer was drunk.
  const drankCountries = useMemo(() => {
    const byCc = new Map<string, { cc: string; country: string }>();
    for (const b of beers.data ?? []) {
      if (b.cc && b.country && !byCc.has(b.cc)) byCc.set(b.cc, { cc: b.cc, country: b.country });
    }
    return [...byCc.values()].sort((a, b) => a.country.localeCompare(b.country));
  }, [beers.data]);

  return (
    <Shell title="Beer map" subtitle="Where it was brewed, where it was drunk.">
      {loading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      ) : (
        <>
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setModeAndClear("drank")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "drank"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              Where I drank it
            </button>
            <button
              onClick={() => setModeAndClear("brewed")}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "brewed"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              Where it was brewed
            </button>
          </div>

          <ClientOnly fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
            <LeafletMap
              mode={mode}
              breweries={breweries.data ?? []}
              beers={beers.data ?? []}
              domains={domains}
              logos={logos}
              locations={locations.data ?? []}
              countries={countries.data ?? []}
              onPick={setFilter}
            />
          </ClientOnly>

          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            {mode === "brewed" ? (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Brewery
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-chart-3" /> Drank here
              </span>
            )}
          </div>

          {drankCountries.length > 0 && (
            <section className="mt-5">
              <h2 className="mb-2 font-display text-lg font-semibold">
                Countries I've had a beer in
              </h2>
              <div className="flex flex-wrap gap-2">
                {drankCountries.map((c) => (
                  <span
                    key={c.cc}
                    title={c.country}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium"
                  >
                    <span className="text-base leading-none">
                      {flagEmoji(c.cc, countries.data)}
                    </span>
                    {c.country}
                  </span>
                ))}
              </div>
            </section>
          )}

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
                      <BeerLogo name={b.name} logo={b.logo} className="h-11 w-11" />
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

// ── What a pin says when you click it ────────────────────────
// The popup is the answer to the click: where this is, its flag, and every
// beer that belongs to it with its own flag, style, serving and score. It is
// built as an HTML string because Leaflet parses one — which is exactly why
// every value below goes through esc() first.

const rating2 = (r: number) => Number(r).toFixed(2);

const avgOf = (list: Beer[]) =>
  list.length ? list.reduce((sum, b) => sum + Number(b.rating), 0) / list.length : 0;

/** "3 beers · 3.42 avg", or an honest sentence when the pin has nothing yet. */
const tally = (list: Beer[], nothingWord: string) =>
  list.length
    ? `${list.length} beer${list.length === 1 ? "" : "s"} · ${rating2(avgOf(list))} avg`
    : `nothing logged ${nothingWord}`;

/** A beer's logo tile: monogram underneath, image over it, letter uncovered
 *  again if the image fails. */
function logoCell(beer: Beer, domains: DomainMap | undefined, logos: LogoMap | undefined) {
  const src = beerLogo(beer.name, domains, beer.logo ?? logos?.get(beer.name));
  const img = src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()" />` : "";
  return `<span class="bm-pop-logo"><span>${esc(beer.name.charAt(0))}</span>${img}</span>`;
}

/** One line per pour: logo, name, where it is from, what it is, what it got. */
function beerRows(
  list: Beer[],
  domains: DomainMap | undefined,
  logos: LogoMap | undefined,
  countries: CountryRow[],
) {
  if (!list.length) return "";
  return `<div class="bm-pop-list">${list
    .map((b) => {
      const meta = [b.style, b.method].filter(Boolean).join(" · ");
      return `<div class="bm-pop-row">
          ${logoCell(b, domains, logos)}
          <div style="min-width:0">
            <div class="bm-pop-name">${esc(b.name)}</div>
            <div class="bm-pop-meta">${flagEmoji(b.origin_cc, countries)} ${esc(meta)}</div>
          </div>
          <div class="bm-pop-rating">${esc(rating2(b.rating))}</div>
        </div>`;
    })
    .join("")}</div>`;
}

/** A city pin: where it was drunk, and what was drunk there. */
function cityPopup(
  loc: { city: string; region: string | null; country: string; cc: string | null },
  poured: Beer[],
  domains: DomainMap | undefined,
  logos: LogoMap | undefined,
  countries: CountryRow[],
) {
  // "Antwerp, Antwerp" — several cities share their region's name, and saying
  // it twice reads like a mistake.
  const where = [loc.city, loc.region === loc.city ? null : loc.region].filter(Boolean).join(", ");
  return `<div class="bm-pop">
      <div class="bm-pop-title">${flagEmoji(loc.cc, countries)} ${esc(where)}</div>
      <div class="bm-pop-sub">${esc(loc.country)}</div>
      <div class="bm-pop-sub">${esc(tally(poured, "here"))}</div>
      ${beerRows(poured, domains, logos, countries)}
    </div>`;
}

/** A brewery pin: who brews there, and which of their beers are in the log. */
function breweryPopup(
  brewery: { name: string; location: string | null; country: string | null; cc: string | null },
  made: Beer[],
  domains: DomainMap | undefined,
  logos: LogoMap | undefined,
  countries: CountryRow[],
  logo: string | null,
) {
  const mark = logo
    ? `<span class="bm-pop-logo"><span>${esc(brewery.name.charAt(0))}</span><img src="${esc(logo)}" alt="" loading="lazy" onerror="this.remove()" /></span>`
    : "";
  return `<div class="bm-pop">
      <div class="bm-pop-title">${mark}<span>${flagEmoji(brewery.cc, countries)} ${esc(brewery.name)}</span></div>
      <div class="bm-pop-sub">${esc(
        [brewery.location, brewery.country].filter(Boolean).join(" · "),
      )}</div>
      <div class="bm-pop-sub">${esc(tally(made, "yet"))}</div>
      ${beerRows(made, domains, logos, countries)}
    </div>`;
}

function LeafletMap({
  mode,
  breweries,
  locations,
  beers,
  domains,
  logos,
  countries,
  onPick,
}: {
  mode: MapMode;
  breweries: ReturnType<typeof useBreweries>["data"] extends infer T ? NonNullable<T> : never;
  locations: NonNullable<ReturnType<typeof useLocations>["data"]>;
  // A brewery's logo is borrowed from a beer it makes — brand domains are
  // keyed by beer, not by brewery.
  beers: Beer[];
  domains: DomainMap | undefined;
  logos: LogoMap | undefined;
  countries: CountryRow[];
  onPick: (f: { kind: string; label: string }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const [ready, setReady] = useState(false);

  // Picking is read through a ref so the marker effect never has to depend on
  // the callback's identity: it changes on every parent render, and a render
  // is exactly what picking causes.
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  // The map is built once and torn down only on unmount. It used to be rebuilt
  // whenever any of its data changed, which quietly broke every first click:
  // picking a marker mounts the beer list, the list's logos re-subscribe to
  // brand_domains, that query hands back a fresh Map, and the "data changed"
  // rebuild then destroyed the map — taking the popup the click had just
  // opened, and the reader's zoom and pan, with it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !ref.current || mapRef.current) return;

      const map = L.map(ref.current).setView([41, -30], 2.2);

      // Esri's World Dark Gray canvas — keyless, unlike Carto's basemaps,
      // which now stamp "API KEY REQUIRED" across anonymous requests. Base
      // paints the ground, Reference adds the place labels; native tiles stop
      // at zoom 16. The stats site's maps use the same provider.
      const esri = (v: string) =>
        `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_${v}/MapServer/tile/{z}/{y}/{x}`;
      L.tileLayer(esri("Base"), {
        maxZoom: 16,
        attribution: "Powered by Esri · © OpenStreetMap contributors",
      }).addTo(map);
      L.tileLayer(esri("Reference"), { maxZoom: 16 }).addTo(map);

      leafletRef.current = L;
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      leafletRef.current = null;
      setReady(false);
    };
  }, []);

  // Only the pins are redrawn when the data behind them changes. They live in
  // their own layer group, so clearing them leaves the map, its tiles and the
  // reader's view where they were.
  useEffect(() => {
    const L = leafletRef.current;
    const layer = layerRef.current;
    if (!L || !layer) return;
    layer.clearLayers();

    const dot = (color: string) =>
      L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid rgba(255,255,255,.85);box-shadow:0 1px 6px rgba(0,0,0,.5)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

    const breweryIcon = dot("#3b82f6");
    const cityIcon = dot("#6fb3e0");

    // Only the active toggle's markers go on the map — never both sets at
    // once, so a brewery pin is never mistaken for a place it was drunk.
    if (mode === "brewed") {
      breweries
        .filter((b) => b.lat != null && b.lng != null)
        .forEach((b) => {
          const marker = L.marker([b.lat!, b.lng!], { icon: breweryIcon }).addTo(layer);
          marker.bindPopup(
            breweryPopup(
              b,
              beers.filter((x) => x.brewery === b.name),
              domains,
              logos,
              countries,
              breweryLogo(b.name, beers, domains, logos),
            ),
            { maxWidth: 260, minWidth: 208 },
          );
          marker.on("click", () => pickRef.current({ kind: "brewery", label: b.name }));
        });
    } else {
      locations
        .filter((l) => l.lat != null && l.lng != null)
        .forEach((l) => {
          const marker = L.marker([l.lat!, l.lng!], { icon: cityIcon }).addTo(layer);
          marker.bindPopup(
            cityPopup(
              l,
              beers.filter((x) => x.city === l.city && x.cc === l.cc),
              domains,
              logos,
              countries,
            ),
            { maxWidth: 260, minWidth: 208 },
          );
          marker.on("click", () => pickRef.current({ kind: "city", label: l.city }));
        });
    }
  }, [ready, mode, breweries, locations, beers, domains, logos, countries]);

  return (
    <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-2xl border border-border" />
  );
}
