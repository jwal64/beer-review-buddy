import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
import { QueryError } from "@/components/QueryError";
import { averageRating, flagEmoji, formatMonth, useBeers, useCountries } from "@/lib/beer-data";
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

function StatCard({
  label,
  value,
  to,
}: {
  label: string;
  value: string;
  to: "/beers" | "/map" | "/insights";
}) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}. Open ${to.slice(1)}`}
      className="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="font-display text-2xl font-semibold text-primary">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      <ChevronRight size={14} aria-hidden="true" className="mt-2 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function HomePage() {
  const { data: beers, isLoading, isError, refetch } = useBeers();
  const { data: countries } = useCountries();

  const stats = useMemo(() => {
    const list = beers ?? [];
    const originCountries = new Set(list.map((b) => b.origin_cc).filter(Boolean));
    const top = [...list].sort((a, b) => Number(b.rating) - Number(a.rating)).slice(0, 3);
    return {
      total: list.length,
      unique: new Set(list.map((b) => b.name)).size,
      avg: averageRating(list),
      countries: originCountries.size,
      recent: list.slice(0, 5),
      top,
    };
  }, [beers]);

  return (
    <Shell title="JWAL's Brew Reviews" subtitle="Every pint, pour and bottle — rated.">
      {isLoading ? (
        <div className="space-y-3" aria-label="Loading home">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <QueryError what="reviews" onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-7">
          <section className="grid grid-cols-2 gap-3" aria-label="Review summary">
            <StatCard label="Reviews" value={String(stats.total)} to="/beers" />
            <StatCard label="Unique beers" value={String(stats.unique)} to="/beers" />
            <StatCard label="Avg rating" value={stats.avg.toFixed(2)} to="/insights" />
            <StatCard label="Origin countries" value={String(stats.countries)} to="/map" />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Highest rated</h2>
              <Link to="/insights" className="flex min-h-11 items-center text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Explore <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {stats.top.length ? (
              <ul className="space-y-2">
                {stats.top.map((b) => (
                  <li key={b.id} className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-3">
                    <BeerLogo name={b.name} logo={b.logo} style={b.style} className="h-11 w-11" />
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
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">No reviews yet.</p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Recent pours</h2>
                {stats.recent[0] && <p className="mt-0.5 text-xs text-muted-foreground">Last poured {formatMonth(stats.recent[0].drank_on)}</p>}
              </div>
              <Link to="/beers" className="flex min-h-11 items-center text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                See all <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <ul className="space-y-2">
              {stats.recent.map((b) => (
                <li key={b.id} className="flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <BeerLogo name={b.name} logo={b.logo} style={b.style} className="h-11 w-11" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.city} · {formatMonth(b.drank_on)}
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
