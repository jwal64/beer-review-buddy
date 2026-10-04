import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { BeerLogo } from "@/components/BeerLogo";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { flagEmoji, useCountries } from "@/lib/beer-data";
import { useProgress } from "@/hooks/use-progress";
import { wtVerdict } from "@/lib/insights";
import { BINGO_BODIES, BINGO_COLORS, type BadgeState, type When } from "@/lib/progress";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Passport — JWAL BREW REVIEW" },
      {
        name: "description",
        content:
          "Badges, country stamps, monthly streaks, yearly goals and style bingo — the beer log as a game.",
      },
      { property: "og:title", content: "Passport — JWAL BREW REVIEW" },
    ],
  }),
  component: PassportPage,
});

const SUBTITLE = "Badges, stamps, streaks and goals.";

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

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="font-display text-xl font-semibold tracking-tight text-primary">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

/**
 * A single ratio against a limit. The track is a lighter step of the fill's
 * own hue, so the whole bar reads as one quantity; an optional tick marks
 * where the count would be on pace.
 */
function Meter({
  value,
  max,
  pace,
  label,
  muted,
}: {
  value: number;
  max: number;
  pace?: number | undefined;
  label: string;
  muted?: boolean | undefined;
}) {
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / Math.max(1, max)) * 100))}%`;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="relative h-2 overflow-hidden rounded-full bg-primary/15"
    >
      <div
        className={`h-full rounded-full ${muted ? "bg-primary/45" : "bg-primary"}`}
        style={{ width: pct(value) }}
      />
      {pace != null && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-foreground/70"
          style={{ left: pct(pace) }}
        />
      )}
    </div>
  );
}

const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const MONTH_ONLY = new Intl.DateTimeFormat("en-US", { month: "short" });

/** "Mar 2026", or "Retro" for something only a retro review did. */
const stampDate = (w: When | null) =>
  w == null ? "" : w === "retro" ? "Retro" : SHORT_MONTH.format(new Date(`${w}T00:00:00`));

// ── The page ──────────────────────────────────────────────────

function PassportPage() {
  const { data: p, isLoading, isError, refetch } = useProgress();
  const { data: countries } = useCountries();
  const countryName = (cc: string) => countries?.find((c) => c.cc === cc)?.name ?? cc;

  if (isLoading) {
    return (
      <Shell title="Passport" subtitle={SUBTITLE}>
        <div className="space-y-3" aria-label="Loading passport">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell title="Passport" subtitle={SUBTITLE}>
        <QueryError what="the passport" onRetry={() => void refetch()} />
      </Shell>
    );
  }

  const goal = p.goals.find((g) => g.year === p.thisYear) ?? p.goals.at(-1);
  const filledCells = p.bingo.filter((c) => c.beers.length).length;

  return (
    <Shell title="Passport" subtitle={SUBTITLE}>
      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="stamps">Stamps</TabsTrigger>
          <TabsTrigger value="bingo">Bingo</TabsTrigger>
        </TabsList>

        {/* ── Progress ── */}
        <TabsContent value="progress" className="mt-5 space-y-7">
          <section className="grid grid-cols-3 gap-2.5">
            <StatTile label="Badges" value={`${p.earned}/${p.badges.length}`} />
            <StatTile label="Countries" value={String(p.passport.brewed.length)} sub="brewed in" />
            <StatTile
              label="Month streak"
              value={String(p.streak.current)}
              sub={`best ${p.streak.longest}`}
            />
          </section>

          {goal && goal.metrics.length > 0 && (
            <Panel title={`${goal.year} goals`} caption="tick = on pace today">
              <ul className="space-y-4">
                {goal.metrics.map((m) => {
                  const ahead = Math.round(m.current - m.pace);
                  const done = m.current >= m.target;
                  return (
                    <li key={m.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {m.current} of {m.target} ·{" "}
                          {done
                            ? "done"
                            : ahead >= 0
                              ? `${ahead === 0 ? "on pace" : `${ahead} ahead`}`
                              : `${-ahead} behind`}
                        </span>
                      </div>
                      <Meter
                        value={m.current}
                        max={m.target}
                        pace={done ? undefined : m.pace}
                        label={`${m.label}: ${m.current} of ${m.target}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          <Panel
            title="Streak"
            caption={
              p.streak.loggedThisMonth
                ? "this month is logged"
                : p.streak.current
                  ? "log a beer this month to keep it"
                  : "log a beer to start one"
            }
          >
            <ol className="grid grid-cols-12 gap-1" aria-label="The last twelve months">
              {p.streak.recent.map((m) => {
                const label = MONTH_ONLY.format(new Date(`${m.month}-01T00:00:00`));
                return (
                  <li key={m.month} className="flex flex-col items-center gap-1">
                    <span
                      title={`${label}: ${m.logged ? "logged" : "nothing logged"}`}
                      className={`h-6 w-full rounded-md ${
                        m.logged
                          ? "bg-primary"
                          : "border border-dashed border-border bg-secondary/40"
                      }`}
                    />
                    <span className="text-[9px] text-muted-foreground">{label.slice(0, 1)}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-sm">
              <span className="font-semibold">
                {p.streak.current} month{p.streak.current === 1 ? "" : "s"}
              </span>{" "}
              <span className="text-muted-foreground">in a row · longest {p.streak.longest}</span>
            </p>
          </Panel>

          <Panel title="Badges" caption={`${p.earned} of ${p.badges.length} earned`}>
            <ul className="grid grid-cols-2 gap-2.5">
              {p.badges.map((b) => (
                <BadgeCard key={b.def.id} badge={b} />
              ))}
            </ul>
          </Panel>
        </TabsContent>

        {/* ── Stamps ── */}
        <TabsContent value="stamps" className="mt-5 space-y-7">
          <Panel
            title="The world"
            caption={`${p.passport.world.visited} of ${p.passport.world.total} countries`}
          >
            <Meter
              value={p.passport.world.visited}
              max={p.passport.world.total}
              label={`Brewing countries: ${p.passport.world.visited} of ${p.passport.world.total}`}
            />
            <ul className="mt-4 space-y-3">
              {p.passport.continents.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className={c.visited ? "font-medium" : "text-muted-foreground"}>
                      {c.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {c.visited} of {c.total}
                    </span>
                  </div>
                  <Meter
                    value={c.visited}
                    max={c.total}
                    label={`${c.name}: ${c.visited} of ${c.total}`}
                  />
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Counted as sovereign countries: England, Scotland, Wales and Northern Ireland stamp
              separately but count as one United Kingdom here.
            </p>
          </Panel>

          <Panel title="Brewed in" caption="first stamped">
            <ul className="grid grid-cols-3 gap-2">
              {p.passport.brewed.map((s) => (
                <li
                  key={s.cc}
                  className="flex flex-col items-center rounded-xl border border-dashed border-primary/40 px-1.5 py-2.5 text-center"
                >
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {flagEmoji(s.cc, countries)}
                  </span>
                  <span className="mt-1.5 w-full truncate text-[11px] font-medium">
                    {countryName(s.cc)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {stampDate(s.first)} · {s.count}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Drunk in" caption={`${p.passport.drunk.length} countries`}>
            <ul className="flex flex-wrap gap-2">
              {p.passport.drunk.map((s) => (
                <li
                  key={s.cc}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs"
                >
                  <span aria-hidden="true">{flagEmoji(s.cc, countries)}</span>
                  {countryName(s.cc)}
                  <span className="text-muted-foreground">{s.count}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Next stamps" caption="from the shortlist">
            {p.next.length ? (
              <ul className="space-y-2">
                {p.next.map((e) => (
                  <li key={e.row.beer} className="flex items-center gap-3">
                    <BeerLogo name={e.row.beer} style={e.row.style} className="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{e.row.beer}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {flagEmoji(e.row.origin, countries)} new stamp: {countryName(e.row.origin)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold text-primary">{e.guess.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">{wtVerdict(e.guess)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">
                Every country on the shortlist is already stamped.
              </p>
            )}
          </Panel>
        </TabsContent>

        {/* ── Bingo ── */}
        <TabsContent value="bingo" className="mt-5 space-y-7">
          <Panel
            title="Style bingo"
            caption={`${filledCells} of ${p.bingo.length} · ${p.bingoLines} line${p.bingoLines === 1 ? "" : "s"}`}
          >
            <table className="w-full table-fixed border-separate border-spacing-1.5 text-center">
              <thead>
                <tr>
                  <th className="w-14" />
                  {BINGO_BODIES.map((body) => (
                    <th
                      key={body}
                      scope="col"
                      className="text-[11px] font-medium text-muted-foreground"
                    >
                      {body}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BINGO_COLORS.map((color) => (
                  <tr key={color}>
                    <th
                      scope="row"
                      className="text-left text-[11px] font-medium text-muted-foreground"
                    >
                      {color}
                    </th>
                    {BINGO_BODIES.map((body) => {
                      const cell = p.bingo.find((c) => c.color === color && c.body === body);
                      const n = cell?.beers.length ?? 0;
                      return (
                        <td
                          key={body}
                          title={
                            n
                              ? cell?.beers.join(", ")
                              : cell?.suggestion
                                ? `Try ${cell.suggestion.row.beer}`
                                : `No ${color.toLowerCase()}, ${body.toLowerCase()}-bodied beer yet`
                          }
                          className={`h-16 rounded-xl align-middle ${
                            n
                              ? "bg-primary text-primary-foreground"
                              : "border border-dashed border-border bg-secondary/30"
                          }`}
                        >
                          {n ? (
                            <span className="font-display text-lg font-semibold">{n}</span>
                          ) : (
                            <span className="block px-1 text-[10px] leading-tight text-muted-foreground">
                              {cell?.suggestion ? cell.suggestion.row.beer : "—"}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Colour against body, from each beer&apos;s facts. A full row or column is a line; an
              empty square names a shortlist beer that would fill it, when one is known.
            </p>
          </Panel>
        </TabsContent>
      </Tabs>
    </Shell>
  );
}

function BadgeCard({ badge: b }: { badge: BadgeState }) {
  return (
    <li
      className={`rounded-xl border p-3 ${
        b.earned ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/30"
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          className={`text-2xl leading-none ${b.earned ? "" : "opacity-40 grayscale"}`}
          aria-hidden="true"
        >
          {b.def.emoji}
        </span>
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold leading-tight ${b.earned ? "" : "text-muted-foreground"}`}
          >
            {b.def.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{b.def.how}</p>
        </div>
      </div>
      {b.earned ? (
        <p className="mt-2 text-[11px] font-medium text-primary">
          {b.earnedOn === "retro" ? "Earned in a retro review" : `Earned ${stampDate(b.earnedOn)}`}
        </p>
      ) : (
        <div className="mt-2.5">
          <Meter
            value={b.current}
            max={b.def.target}
            muted
            label={`${b.def.title}: ${b.current} of ${b.def.target}`}
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {b.current} / {b.def.target}
          </p>
        </div>
      )}
    </li>
  );
}
