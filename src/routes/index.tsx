import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Rating } from "@/components/Rating";
import { QueryError } from "@/components/QueryError";
import { flagEmoji, whenLabel, useBeers, useCountries, type Beer } from "@/lib/beer-data";
import { placeLabel } from "@/lib/place";
import { MethodBadge } from "@/components/MethodBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JWAL BREW REVIEW — Every beer, rated" },
      {
        name: "description",
        content:
          "A running log of every beer JWAL has tasted: ratings, styles, breweries and the cities they were drunk in.",
      },
      { property: "og:title", content: "JWAL BREW REVIEW" },
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
      className="surface group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="font-display text-2xl font-semibold text-primary">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
      <ChevronRight
        size={14}
        aria-hidden="true"
        className="mt-2 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function HomePage() {
  const { data: beers, isLoading, isError, refetch } = useBeers();
  const { data: countries } = useCountries();

  const stats = useMemo(() => {
    const list = beers ?? [];
    // One pass for the three tallies, and a linear scan for the top three
    // rather than copying and sorting the whole log to take the first few.
    const originCountries = new Set<string>();
    const names = new Set<string>();
    let ratingSum = 0;
    const top: Beer[] = [];
    for (const b of list) {
      if (b.origin_cc) originCountries.add(b.origin_cc);
      names.add(b.name);
      const rating = Number(b.rating);
      ratingSum += rating;
      // Insertion into a list that is never longer than three. Ties keep the
      // earlier row, which is what a stable sort by rating did.
      let i = top.length;
      while (i > 0 && rating > Number(top[i - 1]!.rating)) i--;
      if (i < 3) {
        top.splice(i, 0, b);
        if (top.length > 3) top.pop();
      }
    }
    return {
      total: list.length,
      unique: names.size,
      avg: list.length ? ratingSum / list.length : 0,
      countries: originCountries.size,
      recent: list.slice(0, 6),
      top,
    };
  }, [beers]);

  return (
    <Shell title="JWAL BREW REVIEW" subtitle="Every pint, pour and bottle — rated.">
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
          {stats.recent[0] && (
            <section aria-label="Latest pour">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Latest pour
              </p>
              <Link
                to="/beers"
                search={{ beer: stats.recent[0].id }}
                aria-label={`Open ${stats.recent[0].name}`}
                className={`surface flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${Number(stats.recent[0].rating) >= 4 ? "hall-of-fame" : ""}`}
              >
                <BeerLogo
                  name={stats.recent[0].name}
                  logo={stats.recent[0].logo}
                  style={stats.recent[0].style}
                  className="h-16 w-16"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">
                    {stats.recent[0].name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {flagEmoji(stats.recent[0].origin_cc, countries)} {stats.recent[0].style}
                    {stats.recent[0].abv != null && ` · ${stats.recent[0].abv}%`}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <MethodBadge method={stats.recent[0].method} />
                    <span className="truncate text-[11px] text-muted-foreground">
                      {placeLabel(stats.recent[0])}
                    </span>
                  </div>
                </div>
                <span className="font-display text-2xl font-semibold text-primary">
                  {Number(stats.recent[0].rating).toFixed(2)}
                </span>
              </Link>
            </section>
          )}

          <section className="grid grid-cols-2 gap-3" aria-label="Review summary">
            <StatCard label="Reviews" value={String(stats.total)} to="/beers" />
            <StatCard label="Unique beers" value={String(stats.unique)} to="/beers" />
            <StatCard label="Avg rating" value={stats.avg.toFixed(2)} to="/insights" />
            <StatCard label="Origin countries" value={String(stats.countries)} to="/map" />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Highest rated</h2>
              <Link
                to="/insights"
                className="flex min-h-11 items-center text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Explore <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {stats.top.length ? (
              <ul className="space-y-2">
                {stats.top.map((b) => (
                  <li key={b.id}>
                    <Link
                      to="/beers"
                      search={{ beer: b.id }}
                      aria-label={`Open ${b.name}`}
                      className="surface flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <BeerLogo name={b.name} logo={b.logo} style={b.style} className="h-11 w-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{b.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {flagEmoji(b.origin_cc, countries)} {b.style}
                        </p>
                      </div>
                      <Rating value={Number(b.rating)} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
                No reviews yet.
              </p>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Recent pours</h2>
                {stats.recent[0] && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Last poured {whenLabel(stats.recent[0])}
                  </p>
                )}
              </div>
              <Link
                to="/beers"
                className="flex min-h-11 items-center text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                See all <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <ul className="space-y-2">
              {stats.recent.slice(1).map((b) => (
                <li key={b.id}>
                  <Link
                    to="/beers"
                    search={{ beer: b.id }}
                    aria-label={`Open ${b.name}`}
                    className="surface flex min-h-20 items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <BeerLogo name={b.name} logo={b.logo} style={b.style} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {placeLabel(b)} · {whenLabel(b)}
                      </p>
                    </div>
                    <Rating value={Number(b.rating)} showValue={false} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Shell>
  );
}
