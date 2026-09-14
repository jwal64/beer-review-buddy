import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, ExternalLink, MapPin } from "lucide-react";

import { Shell } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocations, useBeers } from "@/lib/beer-data";
import { placeLabel } from "@/lib/place";

export const Route = createFileRoute("/add")({ component: AddBeer });

const REPO = "jwal64/beer-review-buddy";

/**
 * Capture a beer from a phone.
 *
 * The log is a committed file — public/stats/data.js — so there is nothing to
 * write to from here, and nothing worth putting a credential on a phone for.
 * What this page does instead is file the beer as a GitHub issue, which is a
 * queue that survives being at a pub with 4% battery, and which a Claude
 * session turns into the actual entry: the brewery's city and coordinates, its
 * language, the native name, the brand domain and the fetched logo are all
 * research, and the screenshot is the input to it.
 *
 * GitHub's own composer takes the screenshot, because a URL cannot carry an
 * image. So the one thing this page is really for is the city: it has to match
 * a row in `drunkLocs` exactly or `npm run check` fails on the entry, and
 * picking from the places already in the log is how that stays true.
 */
function AddBeer() {
  const { data: locations } = useLocations();
  const { data: beers } = useBeers();
  const [where, setWhere] = useState("");
  const [custom, setCustom] = useState(false);

  // Most recent first: the next beer is far more likely to be where the last
  // few were than somewhere alphabetically early.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of beers ?? []) {
      const label = placeLabel(b);
      if (label && !seen.has(label)) {
        seen.add(label);
        out.push(label);
      }
    }
    return out.slice(0, 8);
  }, [beers]);

  const issueUrl = useMemo(() => {
    const params = new URLSearchParams({
      template: "add-a-beer.yml",
      title: "Add a beer",
    });
    if (where.trim()) params.set("where", where.trim());
    return `https://github.com/${REPO}/issues/new?${params.toString()}`;
  }, [where]);

  return (
    <Shell title="Add a beer" subtitle="Screenshot it, say where, done.">
      <div className="space-y-5">
        <ol className="space-y-3">
          {[
            {
              icon: MapPin,
              title: "Where did you drink it?",
              body: "Pick a place you have been before, or add a new one.",
            },
            {
              icon: Camera,
              title: "Attach the Untappd screenshot",
              body: "GitHub's composer opens next — tap the photo button and pick it.",
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon size={14} />
                  {title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Somewhere you have been
          </p>
          <div className="flex flex-wrap gap-2">
            {recent.map((place) => (
              <button
                key={place}
                type="button"
                onClick={() => {
                  setWhere(place);
                  setCustom(false);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${
                  where === place && !custom
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                {place}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCustom(true);
                setWhere("");
              }}
              className={`rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${
                custom
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              Somewhere new
            </button>
          </div>
        </div>

        {custom && (
          <div>
            <label htmlFor="where" className="mb-1.5 block text-xs text-muted-foreground">
              City, region and country — all three, so the map can place it.
            </label>
            <Input
              id="where"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder="Ischia, Campania, Italy"
              autoComplete="off"
            />
          </div>
        )}

        <Button asChild disabled={!where.trim()} className="h-12 w-full rounded-xl text-base">
          <a href={issueUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} />
            File it on GitHub
          </a>
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {locations?.length ?? 0} places in the log. The beer appears here once the entry is
          committed and deployed.
        </p>
      </div>
    </Shell>
  );
}
