import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
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
import { flagEmoji, formatMonth, useBeers, type Beer } from "@/lib/beer-data";
import { Search } from "lucide-react";

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

function BeersPage() {
  const { data: beers, isLoading } = useBeers();
  const [query, setQuery] = useState("");
  const [style, setStyle] = useState("All");
  const [selected, setSelected] = useState<Beer | null>(null);

  const styles = useMemo(
    () => ["All", ...Array.from(new Set((beers ?? []).map((b) => b.style))).sort()],
    [beers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (beers ?? []).filter((b) => {
      const matchesStyle = style === "All" || b.style === style;
      const matchesQuery =
        !q ||
        b.name.toLowerCase().includes(q) ||
        (b.brewery ?? "").toLowerCase().includes(q) ||
        (b.city ?? "").toLowerCase().includes(q);
      return matchesStyle && matchesQuery;
    });
  }, [beers, query, style]);

  return (
    <Shell title="All beers" subtitle={`${filtered.length} reviews`}>
      <div className="space-y-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search beer, brewery or city"
            className="h-11 rounded-xl pl-9"
          />
        </div>

        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {styles.map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                s === style
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => setSelected(b)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:bg-secondary"
                >
                  <BeerLogo name={b.name} brewery={b.brewery} className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">
                      {b.name}
                      {b.is_new && (
                        <Badge className="h-4 px-1.5 text-[10px] uppercase">New</Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {flagEmoji(b.origin_cc)} {b.style} · {b.abv}% · {b.method}
                    </p>
                    <Rating value={Number(b.rating)} className="mt-1" />
                  </div>
                </button>
              </li>
            ))}
            {!filtered.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No beers match that search.
              </p>
            )}
          </ul>
        )}
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader className="flex-row items-center gap-3 space-y-0 text-left">
                <BeerLogo
                  name={selected.name}
                  brewery={selected.brewery}
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
                    ["Origin", `${flagEmoji(selected.origin_cc)} ${selected.origin_cc ?? "—"}`],
                    [
                      "Drunk in",
                      [selected.city, selected.country].filter(Boolean).join(", ") || "—",
                    ],
                    ["When", formatMonth(selected.drank_on)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-border bg-card p-3">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {k}
                      </dt>
                      <dd className="mt-0.5 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Shell>
  );
}
