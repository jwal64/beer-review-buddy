import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Search, Plus, Pencil } from "lucide-react";
import { placeLabel } from "@/lib/place";
import { useSession } from "@/lib/use-session";
import { BeerForm } from "@/components/BeerForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/beers")({
  head: () => ({
    meta: [
      { title: "All beers — JWAL's Brew Reviews" },
      {
        name: "description",
        content: "Search and filter every beer in the log by name, style or brewery.",
      },
      { property: "og:title", content: "All beers — JWAL's Brew Reviews" },
      {
        property: "og:description",
        content: "Search and filter every beer in the log by name, style or brewery.",
      },
    ],
  }),
  component: BeersPage,
});

const SORTS = {
  Recent: (a: Beer, b: Beer) => b.drank_on.localeCompare(a.drank_on),
  Rating: (a: Beer, b: Beer) => Number(b.rating) - Number(a.rating),
  Name: (a: Beer, b: Beer) => a.name.localeCompare(b.name),
  ABV: (a: Beer, b: Beer) => Number(b.abv ?? 0) - Number(a.abv ?? 0),
} satisfies Record<string, (a: Beer, b: Beer) => number>;

type SortKey = keyof typeof SORTS;

function BeersPage() {
  const { data: beers, isLoading, isError, refetch } = useBeers();
  const { data: countries } = useCountries();
  const { isSignedIn } = useSession();
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("All");
  const [sort, setSort] = useState<SortKey>("Recent");
  const [selected, setSelected] = useState<Beer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBeer, setEditingBeer] = useState<Beer | null>(null);

  const styles = useMemo(
    () => ["All", ...Array.from(new Set((beers ?? []).map((b) => b.style))).sort()],
    [beers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (beers ?? [])
      .filter((b) => {
        const matchesStyle = style === "All" || b.style === style;
        const matchesQuery =
          !q ||
          b.name.toLowerCase().includes(q) ||
          (b.brewery ?? "").toLowerCase().includes(q) ||
          (b.city ?? "").toLowerCase().includes(q);
        return matchesStyle && matchesQuery;
      })
      .sort(SORTS[sort]);
  }, [beers, query, style, sort]);

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
            placeholder="Search beer, brewery or city"
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

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </p>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort beers"
              className="h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {Object.keys(SORTS).map((key) => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </label>
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
            {filtered.map((b) => (
              <li key={b.id}>
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
            <p className="mt-1 text-xs text-muted-foreground">Try a different search or style.</p>
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
                {isSignedIn && (
                  <Button
                    variant="secondary"
                    className="h-10 w-full rounded-xl"
                    onClick={() => {
                      setEditingBeer(selected);
                      setSelected(null);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={14} />
                    Edit this beer
                  </Button>
                )}
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

      {isSignedIn && (
        <Button
          type="button"
          onClick={() => {
            setEditingBeer(null);
            setFormOpen(true);
          }}
          aria-label="Add a beer"
          size="icon"
          className="fixed bottom-24 right-5 z-50 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          <Plus size={26} />
        </Button>
      )}

      <BeerForm
        key={editingBeer?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        beer={editingBeer}
        onDeleted={() => setEditingBeer(null)}
      />
    </Shell>
  );
}
