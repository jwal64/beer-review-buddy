import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
import {
  averageRating,
  flagEmoji,
  formatMonth,
  useBeers,
  useCountries,
  place,
} from "@/lib/beer-data";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JWAL's Brew Reviews — Every beer, rated" },
      {
        name: "description",
        content:
          "A running log of every beer JWAL has tasted: ratings, styles, breweries and the cities they were drunk in.",
      },
      { property: "og:title", content: "JWAL's Brew Reviews" },
      {
        property: "og:description",
        content: "Ratings, styles and breweries from every beer in the log.",
      },
    ],
  }),
  component: HomePage,
});

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-display text-2xl font-semibold text-primary">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function HomePage() {
  const { data: beers, isLoading } = useBeers();
  // Needed for the UK's constituent-country flags — see the note in beers.tsx.
  const { data: countries } = useCountries();

  const stats = useMemo(() => {
    const list = beers ?? [];
    const countries = new Set(list.map((b) => b.origin_cc).filter(Boolean));
    const top = [...list].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 3);
    return {
      total: list.length,
      unique: new Set(list.map((b) => b.name)).size,
      avg: averageRating(list),
      countries: countries.size,
      recent: list.slice(0, 5),
      top,
    };
  }, [beers]);

  return (
    <Shell title="JWAL's Brew Reviews" subtitle="Every pint, pour and bottle — rated.">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          <section className="grid grid-cols-2 gap-3">
            <StatCard label="Reviews" value={String(stats.total)} />
            <StatCard label="Unique beers" value={String(stats.unique)} />
            <StatCard label="Avg rating" value={stats.avg.toFixed(2)} />
            <StatCard label="Countries" value={String(stats.countries)} />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Highest rated</h2>
            </div>
            <ul className="space-y-2">
              {stats.top.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <BeerLogo name={b.name} logo={b.logo} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {flagEmoji(b.origin_cc, countries)} {b.style}
                    </p>
                  </div>
                  <Rating value={Number(b.rating)} />
                </li>
              ))}
            </ul>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Recent pours</h2>
              <Link to="/beers" className="flex items-center text-xs font-medium text-primary">
                See all <ChevronRight size={14} />
              </Link>
            </div>
            <ul className="space-y-2">
              {stats.recent.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <BeerLogo name={b.name} logo={b.logo} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {place(b.city, b.region, b.country)} · {formatMonth(b.drank_on)}
                    </p>
                  </div>
                  <Rating value={Number(b.rating)} showValue={false} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Shell>
  );
}
