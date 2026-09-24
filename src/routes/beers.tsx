import { createFileRoute, Link } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
import { QueryError } from "@/components/QueryError";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  flagEmoji,
  formatMonth,
  isDisplayNew,
  useBeers,
  useCountries,
  type Beer,
} from "@/lib/beer-data";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import { placeLabel } from "@/lib/place";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/beers")({
  head: () => ({
    meta: [
      { title: "All beers — JWAL BREW REVIEW" },
      {
        name: "description",
        content:
          "Search, filter and sort every beer in the log by name, style, brewery, city or country.",
      },
      { property: "og:title", content: "All beers — JWAL BREW REVIEW" },
      {
        property: "og:description",
        content:
          "Search, filter and sort every beer in the log by name, style, brewery, city or country.",
      },
    ],
  }),
  component: BeersPage,
});

type Cmp = (a: Beer, b: Beer) => number;

const byRating: Cmp = (a, b) => Number(b.rating) - Number(a.rating);

// `name` turns a brewery's country code into the name it sorts by, so "GB-SCT"
// files under Scotland rather than beside Germany's "DE".
const SORTS = {
  Recent: () => (a, b) => b.drank_on.localeCompare(a.drank_on),
  Rating: () => byRating,
  Name: () => (a, b) => a.name.localeCompare(b.name),
  ABV: () => (a, b) => Number(b.abv ?? 0) - Number(a.abv ?? 0),
  // Country of origin A–Z, best-rated first within each country.
  Country: (name) => (a, b) => name(a.origin_cc).localeCompare(name(b.origin_cc)) || byRating(a, b),
} satisfies Record<string, (name: (cc: string) => string) => Cmp>;

type SortKey = keyof typeof SORTS;

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function BeersPage() {
  const { data: beers, isLoading, isError, refetch } = useBeers();
  const { data: countries } = useCountries();
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("All");
  const [origin, setOrigin] = useState("All");
  const [sort, setSort] = useState<SortKey>("Recent");
  const [reversed, setReversed] = useState(false);
  const [selected, setSelected] = useState<Beer | null>(null);

  const styles = useMemo(
    () => ["All", ...Array.from(new Set((beers ?? []).map((b) => b.style))).sort()],
    [beers],
  );

  // The typed value drives the input; a deferred copy drives the list.
  //
  // Every keystroke re-renders every matching row, and a row is not cheap: a
  // logo, a formatted month and ten star SVGs from <Rating>. Deferring lets
  // React paint the character you just typed first and re-filter after, which
  // keeps the field responsive without a timer to tune or cancel.
  const deferredQuery = useDeferredValue(query);

  const countryName = useMemo(() => {
    const names = new Map((countries ?? []).map((c) => [c.cc, c.name ?? c.cc]));
    return (cc: string) => names.get(cc) ?? cc;
  }, [countries]);

  // Every brewing country in the log, A–Z by name, with how many reviews each.
  const origins = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of beers ?? []) counts.set(b.origin_cc, (counts.get(b.origin_cc) ?? 0) + 1);
    return [...counts]
      .map(([cc, n]) => ({ cc, n, name: countryName(cc) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [beers, countryName]);

  const cmp = useMemo(() => SORTS[sort](countryName), [sort, countryName]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return (beers ?? [])
      .filter((b) => {
        const matchesStyle = style === "All" || b.style === style;
        const matchesOrigin = origin === "All" || b.origin_cc === origin;
        const matchesQuery =
          !q ||
          b.name.toLowerCase().includes(q) ||
          (b.brewery ?? "").toLowerCase().includes(q) ||
          (b.city ?? "").toLowerCase().includes(q) ||
          countryName(b.origin_cc).toLowerCase().includes(q);
        return matchesStyle && matchesOrigin && matchesQuery;
      })
      .sort((a, b) => (reversed ? -1 : 1) * cmp(a, b));
  }, [beers, deferredQuery, style, origin, cmp, reversed, countryName]);

  return (
    <Shell title="All beers" subtitle={`${filtered.length} of ${beers?.length ?? 0} reviews`}>
      <div className="space-y-4">
        <div className="relative">
          <Search
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beer, brewery or place"
            aria-label="Search beers"
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <div
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
          role="group"
          aria-label="Filter by style"
        >
          {styles.map((s) => (
            <Button
              key={s}
              type="button"
              variant={s === style ? "default" : "secondary"}
              aria-pressed={s === style}
              onClick={() => setStyle(s)}
              className="h-auto shrink-0 rounded-full px-3 py-1.5 text-xs"
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            aria-label="Filter by country of origin"
            className={`${selectClass} min-w-0 flex-1`}
          >
            <option value="All">All countries</option>
            {origins.map((o) => (
              <option key={o.cc} value={o.cc}>
                {flagEmoji(o.cc, countries)} {o.name} ({o.n})
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as SortKey);
              setReversed(false);
            }}
            aria-label="Sort beers"
            className={selectClass}
          >
            {Object.keys(SORTS).map((key) => (
              <option key={key} value={key}>
                Sort: {key}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant={reversed ? "default" : "secondary"}
            size="icon"
            aria-pressed={reversed}
            aria-label="Reverse order"
            title="Reverse order"
            onClick={() => setReversed((r) => !r)}
            className="h-9 w-9 shrink-0 rounded-lg"
          >
            <ArrowUpDown size={16} />
          </Button>
          <p className="sr-only" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2" aria-label="Loading beers">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <QueryError what="beers" onRetry={() => void refetch()} />
        ) : filtered.length ? (
          <ul className="space-y-2">
            {filtered.map((b, i) => (
              <li key={b.id}>
                {sort === "Country" && filtered[i - 1]?.origin_cc !== b.origin_cc && (
                  <h2 className="px-1 pb-1 pt-3 text-xs font-semibold text-muted-foreground">
                    {flagEmoji(b.origin_cc, countries)} {countryName(b.origin_cc)}
                  </h2>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(b)}
                  className="flex min-h-20 w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BeerLogo name={b.name} logo={b.logo} style={b.style} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 truncate text-sm font-semibold">
                      {b.name}
                      {isDisplayNew(b) && (
                        <Badge className="h-4 px-1.5 text-[10px] uppercase">New</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {flagEmoji(b.origin_cc, countries)} {b.style}
                      {b.abv != null && ` · ${b.abv}%`} · {b.method}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Rating value={Number(b.rating)} />
                      <span className="text-[11px] text-muted-foreground">
                        {formatMonth(b.drank_on)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
            <p className="text-sm font-medium">No beers found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try a different search, style or country.
            </p>
          </div>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader className="flex-row items-center gap-3 space-y-0 text-left">
                <BeerLogo
                  name={selected.name}
                  logo={selected.logo}
                  style={selected.style}
                  className="h-14 w-14"
                />
                <div>
                  <SheetTitle className="font-display">{selected.name}</SheetTitle>
                  <SheetDescription>{selected.brewery ?? "Unknown brewery"}</SheetDescription>
                </div>
              </SheetHeader>
              <div className="mt-4 space-y-3 pb-6">
                <Rating value={Number(selected.rating)} size={20} />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Style", selected.style],
                    ["ABV", selected.abv ? `${selected.abv}%` : "—"],
                    ["Served", selected.method ?? "—"],
                    [
                      "Origin",
                      `${flagEmoji(selected.origin_cc, countries)} ${
                        countries?.find((c) => c.cc === selected.origin_cc)?.name ??
                        selected.origin_cc ??
                        "—"
                      }`,
                    ],
                    ["Drunk in", placeLabel(selected) || "—"],
                    ["When", formatMonth(selected.drank_on)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-border bg-card p-3">
                      <dt className="text-[11px] text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {/* Capture a beer from a phone. It files a GitHub issue rather than
          writing anywhere: the log is a committed file, so there is nothing to
          write to, and a brewery's coordinates, language and logo are research
          rather than form fields. See src/routes/add.tsx. */}
      <Link
        to="/add"
        aria-label="Add a beer"
        className="fixed bottom-24 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <Plus size={26} />
      </Link>
    </Shell>
  );
}
