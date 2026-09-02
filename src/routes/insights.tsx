import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, ChevronRight } from "lucide-react";
import {
  averageRating,
  flagEmoji,
  useBeers,
  useBreweries,
  useCountries,
  useUntappdAverages,
  useWantToTry,
  place,
} from "@/lib/beer-data";
import {
  MIN_N,
  bandCounts,
  beerLanguages,
  beerRating,
  bySeason,
  byMonth,
  contrarianRows,
  correlation,
  correlationVerdict,
  groupRatings,
  perBeerAverages,
  ratingHistogram,
  rankable,
  scoreShortlist,
  summarise,
  tasteProfile,
  thin,
  wtVerdict,
  type Group,
} from "@/lib/insights";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights — JWAL's Brew Reviews" },
      {
        name: "description",
        content:
          "The whole log read back: best styles and countries, how ratings trend, where my taste disagrees with the world, and what to try next.",
      },
      { property: "og:title", content: "Insights — JWAL's Brew Reviews" },
      {
        property: "og:description",
        content:
          "Ratings by style, country and city, taste profile, and the want-to-try scorecard.",
      },
    ],
  }),
  component: InsightsPage,
});

// ── Layout pieces ─────────────────────────────────────────────

function Panel({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {caption && <span className="shrink-0 text-[11px] text-muted-foreground">{caption}</span>}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">{children}</div>
    </section>
  );
}

/** The caption every ranked panel carries, written from MIN_N rather than typed. */
const RANK_HINT = `${MIN_N}+ reviews to rank`;

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="font-display text-xl font-semibold tracking-tight text-primary">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
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
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-display text-base font-semibold text-primary">
        {flag ? `${flag} ` : ""}
        {group.label}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {group.avg.toFixed(2)} avg · {group.count} review{group.count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/**
 * A ranked list of averages. Thin groups still list and still count — they
 * sort to the tail and render muted, because the sample doesn't support
 * calling them best or worst, not because they don't exist.
 */
function BarList({
  groups,
  limit,
  plain,
}: {
  groups: Array<Group & { icon?: string }>;
  limit?: number | undefined;
  /**
   * Per-beer views are single observations, not averages, so the MIN_N rule
   * never touches them — the site says so explicitly. Plain mode drops the
   * muting and the sample-size reading with it.
   */
  plain?: boolean | undefined;
}) {
  const shown = limit ? groups.slice(0, limit) : groups;
  if (!shown.length) {
    return <p className="py-3 text-center text-sm text-muted-foreground">Nothing here yet.</p>;
  }
  return (
    <ul className="space-y-2.5">
      {shown.map((g) => {
        const muted = !plain && thin(g.count);
        return (
          <li key={g.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className={`truncate ${muted ? "text-muted-foreground" : "font-medium"}`}>
                {g.icon ? `${g.icon} ` : ""}
                {g.label}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {g.avg.toFixed(2)}
                {plain ? "" : ` (${g.count})`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className={`h-full rounded-full ${muted ? "bg-primary/40" : "bg-primary"}`}
                style={{ width: `${(g.avg / 5) * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Charts, drawn as inline SVG ───────────────────────────────
// Hand-drawn rather than pulled from a chart library: these render on the
// server with everything else, cost the phone nothing to download, and take
// their colour from the same tokens as the rest of the app.

const CHART_W = 320;

/** Reviews per month as bars, with the month's average riding over them. */
function MonthlyChart({
  points,
}: {
  points: Array<{ label: string; count: number; avg: number }>;
}) {
  const h = 120;
  const pad = { top: 8, bottom: 18 };
  const plot = h - pad.top - pad.bottom;
  const maxCount = Math.max(1, ...points.map((p) => p.count));
  const step = CHART_W / Math.max(1, points.length);
  const barW = Math.min(22, step * 0.62);
  const y = (avg: number) => pad.top + plot - (avg / 5) * plot;

  if (!points.length) {
    return <p className="py-3 text-center text-sm text-muted-foreground">No reviews yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_W} ${h}`}
        className="h-[120px] w-full min-w-[280px]"
        role="img"
        aria-label="Reviews per month, with each month's average rating"
      >
        {points.map((p, i) => {
          const barH = (p.count / maxCount) * plot;
          return (
            <g key={p.label + i}>
              <rect
                x={i * step + (step - barW) / 2}
                y={pad.top + plot - barH}
                width={barW}
                height={barH}
                rx={3}
                fill="var(--chart-2)"
                opacity={0.55}
              />
              <text
                x={i * step + step / 2}
                y={h - 5}
                textAnchor="middle"
                fontSize={9}
                fill="var(--muted-foreground)"
              >
                {p.label}
              </text>
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.map((p, i) => `${i * step + step / 2},${y(p.avg)}`).join(" ")}
        />
        {points.map((p, i) => (
          <circle
            key={`d${p.label}${i}`}
            cx={i * step + step / 2}
            cy={y(p.avg)}
            r={2.5}
            fill="var(--primary)"
          />
        ))}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-chart-2/60" /> reviews
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 rounded-sm bg-primary" /> average (0–5)
        </span>
      </div>
    </div>
  );
}

/** How the ratings themselves are spread — every quarter step that was used. */
function DistributionChart({ bins }: { bins: Array<{ rating: number; count: number }> }) {
  const h = 110;
  const pad = { top: 8, bottom: 18 };
  const plot = h - pad.top - pad.bottom;
  const max = Math.max(1, ...bins.map((b) => b.count));
  const step = CHART_W / Math.max(1, bins.length);
  const barW = Math.min(26, step * 0.68);

  if (!bins.length) {
    return <p className="py-3 text-center text-sm text-muted-foreground">No reviews yet.</p>;
  }

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${h}`}
      className="h-[110px] w-full"
      role="img"
      aria-label="How many reviews landed on each rating"
    >
      {bins.map((b, i) => {
        const barH = (b.count / max) * plot;
        return (
          <g key={b.rating}>
            <rect
              x={i * step + (step - barW) / 2}
              y={pad.top + plot - barH}
              width={barW}
              height={barH}
              rx={3}
              fill="var(--primary)"
              opacity={0.35 + 0.65 * (b.rating / 5)}
            />
            <text
              x={i * step + step / 2}
              y={pad.top + plot - barH - 3}
              textAnchor="middle"
              fontSize={8}
              fill="var(--muted-foreground)"
            >
              {b.count}
            </text>
            <text
              x={i * step + step / 2}
              y={h - 5}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted-foreground)"
            >
              {b.rating.toFixed(2).replace(/0$/, "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Does strength predict a good score? One dot per review, plus Pearson's r. */
function AbvScatter({ points }: { points: Array<{ abv: number; rating: number; name: string }> }) {
  const h = 150;
  const pad = { top: 8, right: 6, bottom: 20, left: 26 };
  const w = CHART_W;
  // Beers cluster between about 4% and 9%, so an axis anchored at 0 squeezes
  // every dot into a third of the width. Fit it to the range in the log.
  const lo = Math.floor(Math.min(...points.map((p) => p.abv)) - 0.5);
  const hi = Math.ceil(Math.max(...points.map((p) => p.abv)) + 0.5);
  const x = (abv: number) =>
    pad.left + ((abv - lo) / Math.max(1, hi - lo)) * (w - pad.left - pad.right);
  const y = (r: number) => pad.top + (1 - r / 5) * (h - pad.top - pad.bottom);

  if (!points.length) {
    return <p className="py-3 text-center text-sm text-muted-foreground">No reviews yet.</p>;
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[150px] w-full"
      role="img"
      aria-label="Alcohol by volume against the rating given"
    >
      {[1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <line
            x1={pad.left}
            x2={w - pad.right}
            y1={y(r)}
            y2={y(r)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={2} y={y(r) + 3} fontSize={8} fill="var(--muted-foreground)">
            {r}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <circle
          key={`${p.name}-${i}`}
          cx={x(p.abv)}
          cy={y(p.rating)}
          r={3}
          fill="var(--chart-3)"
          opacity={0.75}
        >
          <title>{`${p.name} · ${p.abv}% · ${p.rating.toFixed(2)}`}</title>
        </circle>
      ))}
      {[lo, (lo + hi) / 2, hi].map((a, i) => (
        <text
          key={a}
          x={x(a)}
          y={h - 5}
          // The end labels sit on the plot edges, so they are anchored inward
          // rather than centred — a centred one is half cut off.
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          fontSize={9}
          fill="var(--muted-foreground)"
        >
          {a.toFixed(0)}%
        </text>
      ))}
    </svg>
  );
}

/**
 * The calendar year, one cell a month. A cell under MIN_N is left uncoloured —
 * the colour reads as a verdict, so it is withheld until the sample supports
 * one.
 */
function SeasonGrid({ months }: { months: Array<{ label: string; avg: number; count: number }> }) {
  const ranked = months.filter((m) => m.count > 0 && !thin(m.count));
  const lo = Math.min(...ranked.map((m) => m.avg));
  const hi = Math.max(...ranked.map((m) => m.avg));
  // Averages sit in a narrow band, so the fill is stretched across the range
  // actually observed — over a fixed 0–5 every month comes out the same blue.
  const intensity = (avg: number) => (hi > lo ? 22 + ((avg - lo) / (hi - lo)) * 68 : 55);
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {months.map((m) => {
        const isRanked = m.count > 0 && !thin(m.count);
        return (
          <div
            key={m.label}
            className="rounded-lg border border-border p-1.5 text-center"
            style={
              isRanked
                ? {
                    background: `color-mix(in oklab, var(--primary) ${Math.round(intensity(m.avg))}%, transparent)`,
                  }
                : undefined
            }
            title={
              m.count
                ? `${m.label}: ${m.avg.toFixed(2)} avg over ${m.count} review${m.count === 1 ? "" : "s"}`
                : `${m.label}: no reviews`
            }
          >
            <div className="text-[10px] text-muted-foreground">{m.label}</div>
            {/* A thin month still shows what it scored — the withheld fill and
                the muted ink are what say "not ranked", the same way a thin bar
                does. A bare count here would read as a rating. */}
            <div className={`text-[11px] font-semibold ${isRanked ? "" : "text-muted-foreground"}`}>
              {m.count ? m.avg.toFixed(2) : "–"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Where my rating sits against the world's, biggest disagreement first. */
function DivergingList({
  rows,
}: {
  rows: Array<{ name: string; mine: number; world: number; delta: number }>;
}) {
  const widest = Math.max(0.5, ...rows.map((r) => Math.abs(r.delta)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium">{r.name}</span>
            <span
              className={`shrink-0 text-[11px] ${r.delta >= 0 ? "text-primary" : "text-destructive"}`}
            >
              {r.delta >= 0 ? "+" : ""}
              {r.delta.toFixed(2)}
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary">
            <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
            <div
              className={`absolute top-0 h-2 ${r.delta >= 0 ? "rounded-r-full bg-primary" : "rounded-l-full bg-destructive"}`}
              style={
                r.delta >= 0
                  ? { left: "50%", width: `${(Math.abs(r.delta) / widest) * 50}%` }
                  : { right: "50%", width: `${(Math.abs(r.delta) / widest) * 50}%` }
              }
            />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            me {r.mine.toFixed(2)} · world {r.world.toFixed(2)}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── The page ──────────────────────────────────────────────────

function InsightsPage() {
  const { data: beers, isLoading } = useBeers();
  const { data: countries } = useCountries();
  const { data: breweries } = useBreweries();
  const { data: shortlist } = useWantToTry();
  const { data: world } = useUntappdAverages();

  const s = useMemo(() => {
    const list = beers ?? [];
    const ratings = list.map(beerRating);
    const styles = groupRatings(list, (b) => b.style, beerRating);
    const origins = groupRatings(list, (b) => b.origin_cc, beerRating);
    const cities = groupRatings(list, (b) => b.city, beerRating);
    const methods = groupRatings(list, (b) => b.method, beerRating);
    const breweryGroups = groupRatings(list, (b) => b.brewery, beerRating);
    const globalAvg = averageRating(list);
    const styleMap = new Map(styles.map((g) => [g.label, g]));
    const originMap = new Map(origins.map((g) => [g.label, g]));
    const months = byMonth(list);
    const scored = scoreShortlist(shortlist ?? [], list, globalAvg, styleMap, originMap);
    const abvPairs = list
      .filter((b) => b.abv != null)
      .map((b) => ({ abv: Number(b.abv), rating: beerRating(b), name: b.name }));

    return {
      total: list.length,
      unique: new Set(list.map((b) => b.name)).size,
      globalAvg,
      countries: new Set(list.map((b) => b.origin_cc).filter(Boolean)).size,
      breweryCount: new Set(list.map((b) => b.brewery).filter(Boolean)).size,
      markets: new Set(list.map((b) => b.city).filter(Boolean)).size,
      newBeers: list.filter((b) => b.is_new).length,
      styles,
      origins,
      cities,
      methods,
      breweryGroups,
      languages: beerLanguages(list, breweries ?? []),
      months,
      season: bySeason(list),
      summary: summarise(ratings),
      bands: bandCounts(ratings),
      histogram: ratingHistogram(ratings),
      traits: tasteProfile(list),
      abvPairs,
      abvR: correlation(abvPairs.map((p) => [p.abv, p.rating] as [number, number])),
      contrarian: contrarianRows(list, world ?? new Map()),
      bestStyle: rankable(styles)[0],
      weakestStyle: rankable(styles).at(-1),
      topCountry: rankable(origins)[0],
      bestMethod: rankable(methods)[0],
      topCity: rankable(cities)[0],
      topBrewery: rankable(breweryGroups)[0],
      openList: scored.filter((e) => e.actual == null).sort((a, b) => b.guess - a.guess),
      crossed: scored
        .filter((e) => e.actual != null)
        .sort((a, b) => Math.abs((b.actual ?? 0) - b.guess) - Math.abs((a.actual ?? 0) - a.guess)),
      bestBeers: perBeerAverages(list)
        .slice()
        .sort((a, b) => b.avg - a.avg || a.label.localeCompare(b.label))
        .slice(0, 6),
    };
  }, [beers, breweries, shortlist, world]);

  const countryName = (cc?: string) => countries?.find((c) => c.cc === cc)?.name ?? cc ?? "Unknown";

  if (isLoading) {
    return (
      <Shell title="Insights" subtitle="What the log says about my taste.">
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </Shell>
    );
  }

  const namedCountry = (g?: Group) => (g ? { ...g, label: countryName(g.label) } : undefined);

  return (
    <Shell title="Insights" subtitle="What the log says about my taste.">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="taste">Taste</TabsTrigger>
          <TabsTrigger value="places">Places</TabsTrigger>
          <TabsTrigger value="next">Next</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="mt-5 space-y-7">
          <section className="grid grid-cols-3 gap-2.5">
            <StatTile label="Reviews" value={String(s.total)} />
            <StatTile label="Unique beers" value={String(s.unique)} />
            <StatTile label="Avg rating" value={s.globalAvg.toFixed(2)} />
            <StatTile label="Countries" value={String(s.countries)} />
            <StatTile label="Breweries" value={String(s.breweryCount)} />
            <StatTile label="Markets" value={String(s.markets)} />
          </section>

          <section className="grid grid-cols-2 gap-3">
            <HighlightCard label="Best style" group={s.bestStyle} />
            <HighlightCard label="Weakest style" group={s.weakestStyle} />
            <HighlightCard
              label="Top country"
              group={namedCountry(s.topCountry)}
              flag={s.topCountry ? flagEmoji(s.topCountry.label, countries) : undefined}
            />
            <HighlightCard label="Best serving" group={s.bestMethod} />
          </section>

          <Panel title="Reviews per month" caption="volume and average">
            <MonthlyChart points={s.months.slice(-12)} />
          </Panel>

          <Panel title="Rating distribution">
            <DistributionChart bins={s.histogram} />
          </Panel>

          <Panel title="Statistical summary">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ["Mean", s.summary.mean.toFixed(3)],
                ["Median", s.summary.median.toFixed(2)],
                ["Std deviation", s.summary.stdDev.toFixed(3)],
                ["Range", `${s.summary.min.toFixed(2)}–${s.summary.max.toFixed(2)}`],
                ["Q1 (25th)", s.summary.q1.toFixed(2)],
                ["Q3 (75th)", s.summary.q3.toFixed(2)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="How the ratings land">
            <ul className="space-y-2">
              {s.bands.map((b) => (
                <li key={b.label} className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">
                    {b.label} <span className="text-muted-foreground">· {b.range}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    <span className="font-semibold text-foreground">{b.count}</span> (
                    {s.total ? Math.round((b.count / s.total) * 100) : 0}%)
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Seasonal read" caption={RANK_HINT}>
            <SeasonGrid months={s.season} />
          </Panel>
        </TabsContent>

        {/* ── Taste ── */}
        <TabsContent value="taste" className="mt-5 space-y-7">
          <Panel title="Ratings by style" caption={RANK_HINT}>
            <BarList groups={s.styles} />
          </Panel>

          <Panel title="Serving method" caption={RANK_HINT}>
            <BarList groups={s.methods} />
          </Panel>

          <Panel title="Taste profile" caption={`${MIN_N}+ reviews to read`}>
            <ul className="space-y-2.5">
              {s.traits.map((t) => {
                const muted = thin(t.count);
                return (
                  <li key={t.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span
                        className={`truncate ${muted ? "text-muted-foreground" : "font-medium"}`}
                      >
                        {t.label}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {muted
                          ? `${t.count} review${t.count === 1 ? "" : "s"} · need ${MIN_N}`
                          : `${t.avg.toFixed(2)}/5 · ${t.count}x`}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: muted ? 0 : `${(t.avg / 5) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Stronger = better?" caption={`r = ${s.abvR.toFixed(2)}`}>
            <AbvScatter points={s.abvPairs} />
            <p className="mt-2 text-[11px] text-muted-foreground">{correlationVerdict(s.abvR)}</p>
          </Panel>

          <Panel title="My rating vs the world" caption="biggest gaps">
            {s.contrarian.length ? (
              <>
                <DivergingList rows={s.contrarian.slice(0, 5)} />
                {s.contrarian.length > 10 && (
                  <>
                    <div className="my-3 border-t border-border" />
                    <DivergingList rows={s.contrarian.slice(-5)} />
                  </>
                )}
              </>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">
                No world averages recorded yet.
              </p>
            )}
          </Panel>

          <Panel title="Best pours" caption="every session averaged">
            <BarList groups={s.bestBeers} plain />
          </Panel>
        </TabsContent>

        {/* ── Places ── */}
        <TabsContent value="places" className="mt-5 space-y-7">
          <section className="grid grid-cols-2 gap-3">
            <HighlightCard label="Top market" group={s.topCity} />
            <HighlightCard label="Top brewery" group={s.topBrewery} />
          </section>

          <Panel title="Ratings by country" caption={RANK_HINT}>
            <BarList
              groups={s.origins.map((g) => ({
                ...g,
                label: countryName(g.label),
                icon: flagEmoji(g.label, countries),
              }))}
            />
          </Panel>

          <Panel title="Ratings by city" caption={RANK_HINT}>
            <BarList groups={s.cities} limit={12} />
          </Panel>

          <Panel title="Brewing language" caption={RANK_HINT}>
            <BarList groups={s.languages} />
          </Panel>

          <Panel title="Breweries" caption={RANK_HINT}>
            <BarList groups={s.breweryGroups} limit={12} />
          </Panel>
        </TabsContent>

        {/* ── What to try next ── */}
        <TabsContent value="next" className="mt-5 space-y-7">
          <section className="grid grid-cols-3 gap-2.5">
            <StatTile label="On the list" value={String(s.openList.length)} />
            <StatTile label="Crossed off" value={String(s.crossed.length)} />
            <StatTile
              label="Guess error"
              value={
                s.crossed.length
                  ? (
                      s.crossed.reduce((sum, e) => sum + Math.abs(e.guess - (e.actual ?? 0)), 0) /
                      s.crossed.length
                    ).toFixed(2)
                  : "–"
              }
              sub="mean miss"
            />
          </section>

          <Panel title="The shortlist" caption="ranked by predicted rating">
            {s.openList.length ? (
              <ul className="space-y-3">
                {s.openList.map((e) => (
                  <li key={e.row.beer} className="flex items-center gap-3">
                    <BeerLogo name={e.row.beer} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {flagEmoji(e.row.origin, countries)} {e.row.beer}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {e.row.style}
                        {e.row.abv != null ? ` · ${Number(e.row.abv)}%` : ""}
                        {e.row.region
                          ? ` · ${place("", e.row.region, countries?.find((c) => c.cc === e.row.origin)?.name)}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-sm font-semibold text-primary">
                        {e.guess.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{wtVerdict(e.guess)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Nothing left on the list.
              </p>
            )}
          </Panel>

          <Panel title="Crossed off" caption="guess against what I gave it">
            {s.crossed.length ? (
              <ul className="space-y-2.5">
                {s.crossed.map((e) => {
                  const actual = e.actual ?? 0;
                  const miss = actual - e.guess;
                  return (
                    <li
                      key={e.row.beer}
                      className="flex items-baseline justify-between gap-2 text-sm"
                    >
                      <span className="truncate">{e.row.beer}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        guessed {e.guess.toFixed(2)} · gave{" "}
                        <span className="font-semibold text-foreground">{actual.toFixed(2)}</span>{" "}
                        <span className={miss >= 0 ? "text-primary" : "text-destructive"}>
                          ({miss >= 0 ? "+" : ""}
                          {miss.toFixed(2)})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Nothing crossed off yet.
              </p>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {/* The static site carries the things a phone screen cannot: the full
          world maps, the passport, and every chart at desk size. */}
      <a
        href="/stats/index.html"
        className="mt-7 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
      >
        <ExternalLink size={18} className="shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">The full stats site</p>
          <p className="text-xs text-muted-foreground">
            The world maps, the passport, and every chart at desk size.
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
      </a>
    </Shell>
  );
}
