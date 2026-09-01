import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Shell } from "@/components/Shell";
import { Skeleton } from "@/components/ui/skeleton";
import { averageRating, flagEmoji, useBeers, useCountries, type Beer } from "@/lib/beer-data";
import { ChevronRight, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — JWAL's Brew Reviews" },
      {
        name: "description",
        content: "Highlights from the log: best styles, top countries and how ratings trend.",
      },
      { property: "og:title", content: "Insights — JWAL's Brew Reviews" },
      {
        property: "og:description",
        content: "Highlights from the log: best styles, top countries and how ratings trend.",
      },
    ],
  }),
  component: InsightsPage,
});

// A group needs MIN_N reviews before its average may win or lose a ranking —
// the same rule the stats site enforces, so the two never disagree on a
// "best" or "weakest". Thin groups still render, muted and sorted last.
const MIN_N = 3;

type Group = { label: string; avg: number; count: number };

function groupBy(beers: Beer[], key: (b: Beer) => string | null | undefined): Group[] {
  const map = new Map<string, number[]>();
  for (const b of beers) {
    const k = key(b);
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(Number(b.rating));
    map.set(k, list);
  }
  return [...map.entries()]
    .map(([label, ratings]) => ({
      label,
      avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
      count: ratings.length,
    }))
    .sort((a, b) => {
      const aThin = a.count < MIN_N ? 1 : 0;
      const bThin = b.count < MIN_N ? 1 : 0;
      if (aThin !== bThin) return aThin - bThin;
      if (a.avg !== b.avg) return b.avg - a.avg;
      return a.label.localeCompare(b.label);
    });
}

// The slice allowed to be called best/worst; everything if nothing qualifies.
function rankable(groups: Group[]) {
  const qualified = groups.filter((g) => g.count >= MIN_N);
  return qualified.length ? qualified : groups;
}

function HighlightCard({
  label,
  group,
  flag,
}: {
  label: string;
  group?: Group | undefined;
  flag?: string | undefined;
}) {
  if (!group) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-display text-lg font-semibold text-primary">
        {flag ? `${flag} ` : ""}
        {group.label}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {group.avg.toFixed(2)} avg · {group.count} review{group.count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function BarList({ groups }: { groups: Group[] }) {
  return (
    <ul className="space-y-2.5">
      {groups.map((g) => {
        const thin = g.count < MIN_N;
        return (
          <li key={g.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className={`truncate font-medium ${thin ? "text-muted-foreground" : ""}`}>
                {g.label}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {g.avg.toFixed(2)} ({g.count})
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${thin ? "bg-primary/40" : "bg-primary"}`}
                style={{ width: `${(g.avg / 5) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function InsightsPage() {
  const { data: beers, isLoading } = useBeers();
  const { data: countries } = useCountries();

  const insights = useMemo(() => {
    const list = beers ?? [];
    const styles = groupBy(list, (b) => b.style);
    const byCountry = groupBy(list, (b) => b.origin_cc);
    const methods = groupBy(list, (b) => b.method);

    const rankedStyles = rankable(styles);
    const months = new Map<string, Beer[]>();
    for (const b of list) {
      const key = b.drank_on.slice(0, 7);
      months.set(key, [...(months.get(key) ?? []), b]);
    }
    const monthly = [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([month, group]) => ({
        month,
        count: group.length,
        avg: averageRating(group),
      }));

    return {
      styles,
      bestStyle: rankedStyles[0],
      weakestStyle: rankedStyles[rankedStyles.length - 1],
      topCountry: rankable(byCountry)[0],
      bestMethod: rankable(methods)[0],
      monthly,
      maxMonthCount: Math.max(1, ...monthly.map((m) => m.count)),
    };
  }, [beers]);

  const countryName = (cc?: string) => countries?.find((c) => c.cc === cc)?.name ?? cc ?? "Unknown";

  return (
    <Shell title="Insights" subtitle="What the log says about my taste.">
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          <section className="grid grid-cols-2 gap-3">
            <HighlightCard label="Best style" group={insights.bestStyle} />
            <HighlightCard label="Weakest style" group={insights.weakestStyle} />
            <HighlightCard
              label="Top country"
              group={
                insights.topCountry && {
                  ...insights.topCountry,
                  label: countryName(insights.topCountry.label),
                }
              }
              flag={insights.topCountry && flagEmoji(insights.topCountry.label, countries)}
            />
            <HighlightCard label="Best serving" group={insights.bestMethod} />
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Ratings by style</h2>
              <span className="text-[11px] text-muted-foreground">{MIN_N}+ reviews to rank</span>
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <BarList groups={insights.styles} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Recent months</h2>
            <div className="rounded-2xl border border-border bg-card p-4">
              <ul className="space-y-2.5">
                {insights.monthly.map((m) => (
                  <li key={m.month} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {new Date(m.month + "-01T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(m.count / insights.maxMonthCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {m.count} · {m.avg.toFixed(2)} avg
                    </span>
                  </li>
                ))}
                {!insights.monthly.length && (
                  <p className="py-4 text-center text-sm text-muted-foreground">No reviews yet.</p>
                )}
              </ul>
            </div>
          </section>

          {/* The full analytics site — charts, maps, the passport and the
              want-to-try scorecard — still lives at /stats as a static page.
              This is the one deliberate document link out of the app. */}
          <a
            href="/stats/index.html"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
          >
            <ExternalLink size={18} className="shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">The full stats site</p>
              <p className="text-xs text-muted-foreground">
                Every chart, the maps, the passport and the want-to-try scorecard.
              </p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
          </a>
        </div>
      )}
    </Shell>
  );
}
