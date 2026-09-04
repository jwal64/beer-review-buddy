# Beer Review Buddy — Development Guide

Everything lives here now. One repo, hosted by Lovable, holding three parts:

| Part | Where | What it is |
|------|-------|------------|
| The app | `src/` | React/TanStack, mobile-first: Home, Beers, Map, and the add-a-beer form. Reads and writes Supabase directly. |
| The stats site | `public/stats/` | The full analytics site — charts, maps, the passport, the want-to-try scorecard. Static files, no build step, served whole at `/stats`. Moved intact from `jwal64/JWAL-BEER-REVIEW`. |
| The tools | `tools/` | Node scripts: validate, migration, sync, round-trip, SRI, smoke, logo audit. Zero-dependency, except the three that drive a browser (smoke, logo audit, logo fetch). |

And two stores that are kept in step:

- **Supabase** is the runtime store. The app reads and writes it; the stats
  page hydrates from it on load (`public/stats/live-data.js`), so a beer added
  minutes ago appears with no deploy.
- **`public/stats/data.js`** is the authoring surface and the committed
  snapshot. Beers are added by editing it (the SOP below); it also paints the
  stats page instantly and keeps it working offline. `npm run migration` turns
  its current state into SQL that carries it into Supabase; `npm run sync`
  pulls Supabase back into it.

On a matched row the file wins — that is what makes it the authoring surface.
A row only the database knows (a beer logged through the app's own form) is
never touched by a migration; run `npm run sync` to pull those into the file.
Never log the same pour both ways: the file writes it as the first of its
month, the form with a real date, and the two would land as two rows.

## Making Changes with Claude

Any edit — a feature in the app, a tweak to the stats site, a schema change —
follows the same loop, and the loop is what makes it land on Lovable:

1. **Start from the latest `main`.** Lovable commits its own edits straight to
   `main`, so fetch and merge it into the working branch first — the tree on
   disk may be behind what Lovable has already changed.
2. **Make the edit**, respecting the rules in this file.
3. **Validate before pushing** — Lovable deploys `main`, so `main` stays green:

   ```sh
   npm run check          # data rules + projection round-trip + bun.lock (always)
   npx tsc --noEmit       # if src/ changed
   npx eslint <files>     # if src/ or tools/ changed; prettier --write first
   npx vite build         # if src/, vite.config.ts or package.json changed
   npm run smoke          # if public/stats/ changed (needs a browser)
   ```

4. **Merge to `main`.** That is the publish button: Lovable syncs the commit,
   applies any new file in `supabase/migrations/`, and redeploys. A branch that
   is only pushed exists on GitHub and nowhere else.

A remote Claude session gets its dependencies automatically — the
`SessionStart` hook in `.claude/hooks/session-start.sh` runs `npm install` when
the container starts, so all of the commands above work from the first turn.
The data tools in `tools/` need nothing installed at all.

The hook finds the repository from its own path, not from `CLAUDE_PROJECT_DIR`.
That variable is unset in a session with more than one repository attached, and
under `set -u` reading it ended the hook before it installed anything — silently,
and looking exactly like a session that needed no dependencies, because the
`tools/` checks need none and kept working. If `npx tsc`, `npm run smoke` or
`npm run fetch-logos` ever reports a missing module, check `node_modules` exists
before believing anything else.

### Features that must survive every pass

Two features have now been reverted twice by a Lovable editing pass that never
set out to touch them, so they are written down here, guarded by a check, and
repeated for Lovable in `AGENTS.md`:

1. **The map pop-out stays open** — the two module-scope selects in
   `src/lib/beer-data.ts` ("Map Rule: The Pop-out Stays Open" below).
2. **One location format everywhere** — `placeLabel` in `src/lib/place.ts` and
   in `public/stats/app.js` ("Location Rule: City, Region, Country" below).

`node tools/check-invariants.mjs` fails when either one goes missing, and
`npm run check` runs it, so CI turns red on the push that drops them rather
than a person noticing weeks later.

**How they were lost, both times.** Not by anyone deleting them. Lovable's
editing pass branched from a commit *older* than the merge that added them, and
its merge back into `main` resolved every file it had touched in favour of its
own copy — so `src/lib/place.ts` was deleted, the hoisted selects were folded
back inline, and the CLAUDE.md section describing both was dropped, all inside
a merge commit called "Hardened map & insights" whose stated subject was
something else entirely. The same pass also deleted an already-applied
migration file, `supabase/migrations/20260903121905_drop_redundant_logo_constraint.sql`.

**So the rule for any pass, Lovable's or a Claude session's, is:** start from
the current `main`, and when a merge asks which side of a file to keep, keep
the side that has these features rather than the side your branch was cut
from. A change you did not intend to make is not yours to resolve — if you did
not mean to remove `placeLabel`, don't.

### Git rules (Lovable)

**Never rewrite pushed history** — no force-push, rebase, amend or squash of
anything already pushed (see AGENTS.md): Lovable mirrors this repository, and
rewriting it rewrites Lovable's copy of the project history. Merge commits
only.

### Rules that keep an edit Lovable-safe

- **`vite.config.ts` is Lovable's.** `@lovable.dev/vite-tanstack-config`
  already bundles the TanStack, React, Tailwind, nitro and path-alias plugins —
  adding any of them again breaks the build with duplicate plugins. Pass extra
  config through its `defineConfig({ vite: { … } })`, and only when necessary.
- **`package.json` changes need `bun.lock` updated too** (`bun install`).
  Lovable builds with bun; a manifest the lockfile disagrees with fails its
  install. CI and the session hook use npm, which is fine — just keep both
  files in the same commit. `npm run check` enforces this now
  (`tools/check-lockfile.mjs`), so a forgotten `bun install` fails here rather
  than in a Lovable deploy after the merge. It compares the two files as text:
  `bun install --frozen-lockfile` cannot be the check, because eleven
  resolution URLs in `bun.lock` point at Lovable's own registry mirror
  (`europe-west4-npm.pkg.dev/lovable-core-prod`), which answers 403 to anyone
  outside their sandbox. Editing only the `scripts` block needs no
  `bun install` — the lockfile records dependencies, and the check only reads
  those.
- **Schema changes are new migration files, never edits to applied ones.** A
  file in `supabase/migrations/` that has run is history; changing it does
  nothing to the database and desynchronises the migration record. Add a new
  `<YYYYMMDDHHMMSS>_name.sql`, written to be safe on replay and against a
  database already in use — backfill before a `NOT NULL`, add-and-update
  rather than delete, `if not exists` on DDL. The existing migrations are the
  worked example.
- **`src/integrations/supabase/types.ts` follows every schema change, by
  hand.** There is no CLI regeneration here; the file mirrors the tables, and
  the app's type-safety is only as truthful as it is.
- **The stats site stays dependency-free.** `public/stats/` is plain browser
  JavaScript served as-is — no imports in `data.js`/`app.js`, no build step,
  CDN scripts pinned with SRI hashes (`npm run sri` re-derives them; never
  hand-write one). `live-data.js` and `supabase-rows.mjs` are the only module
  code, and `supabase-rows.mjs` is shared with the node tools — a change to
  what a column means happens there and nowhere else.
- **Secrets stay out.** The only key in the tree is Supabase's publishable
  key, which is public by design. The service-role key never appears in code,
  migrations, or workflows.

## Standard Operating Procedure: Adding a Beer

This is the normal flow — the owner describes a beer they drank, and a Claude
session makes these edits. Everything happens in `public/stats/data.js`, then
one command turns it into a migration.

### Step 1: Add the review to `beers[]`

```js
{beer:"BeerName",           // Marketed/displayed beer name
 style:"Category",          // One of: Lager, Pilsner, Wheat Beer, Belgian Ale, IPA, Pale Ale, Stout, Brown Ale, Red Ale, Shandy / Radler
 origin:"XX",               // ISO 3166-1 alpha-2 of the BREWERY's home country (see UK exception below)
 abv:5.0,                   // Alcohol by volume (number)
 method:"Bottle",           // "Bottle", "Can", "Draft", or "Nitro"
 city:"CityName",           // City where the beer was CONSUMED (not brewed)
 region:"RegionName",       // Region/state where consumed
 country:"CountryName",     // Country where consumed (full name; must match CNAMES[cc])
 cc:"XX",                   // ISO 3166-1 alpha-2 of consumption country
 rating:3.50,               // Out of 5.00, quarter steps only
 isNew:true,                // true if this beer has never been reviewed before — not derivable, ask if unsure
 month:"Mar", monthN:3, year:2026},
```

Append it at the end of `beers[]` (the list reads as a diary, oldest first),
under its month's comment header. The file is written by `npm run sync` with
padded columns; a hand-added line does not need to match the padding — the
next sync normalises it.

### UK Exception: Split GB by Constituent Country

For breweries based in the United Kingdom, do **not** use the plain `GB` code.
Use the specific constituent-country code, based on where the brewery actually
is:

| Constituent Country | `origin`/`cc` code | Full `country` name |
|----------------------|---------------------|----------------------|
| England              | `GB-ENG`            | England              |
| Scotland             | `GB-SCT`            | Scotland             |
| Wales                | `GB-WLS`            | Wales                |
| Northern Ireland     | `GB-NIR`            | Northern Ireland     |

These codes already exist in `FLAGS` and `CNAMES`. Plain `GB` / "Great
Britain" is only a fallback when the nation genuinely can't be determined.
`lang` stays `"en"` for all four.

### Step 2: Add or update the brewery in `breweries[]` (REQUIRED)

Every beer must be listed by a brewery. If the brewery is already there, add
the beer's name to its `beers` string (` · `-separated) and its rating to
`ratings` at the same position — the two are read as a pair. If not:

```js
{name:"Brewery Name",           // Official name — this is what a beer row's brewery column points at
 location:"City, Region",       // The original/founding site, not a satellite plant
 country:"CountryName", cc:"XX",
 lang:"xx",                     // ISO 639-1 of the brewery's home language (de, ja, pl, cs, …)
 beers:"Beer1 · Beer2",         // Every beer of theirs reviewed so far
 lat:49.6853, lng:19.1925,      // The brewery city's coordinates
 ratings:[3.50],                // One rating per listed beer, same order
 // only when the native name differs from the marketed one:
 nativeName:"NativeBeerName"},
```

In the database, `beers` and `ratings` have no columns — they are derived from
the reviews, because a beer row names its own brewery. In the file they are
written out, and `npm run check` fails if they disagree with the reviews.

### Step 2.5: Add the brand domain to `BRAND_DOMAINS` (REQUIRED)

A beer with no entry renders the 🍺 placeholder forever — in the app and on the
stats page both; there is no name-based guess behind it.

```js
"Radeberger Pilsner":"radeberger.de",
"Pilsner Urquell":["pilsnerurquell.com","prazdroj.cz"],
```

The array form is for a brand that lives at more than one address, tried in
order. **Every domain listed must belong to that brand** — a parent company's
domain is not a fallback: Heineken's logo on an Almaza is a confidently wrong
answer, which is worse than no logo.

### Step 2.6: Fetch the logo (REQUIRED)

Every beer's logo is a **file in this repo**, under `public/stats/logos/`, named
in `BRAND_LOGOS` in data.js. `npm run check` fails on a beer that has none — so
this is a step, not an option:

```sh
npm run fetch-logos        # needs open internet; fetches only what's missing
npm run logo-sheet         # renders every logo onto one sheet — then look at it
```

`fetch-logos` walks a ladder for the beer's brand domains and takes the first
tier that answers: the icons the site declares, then the logo drawn in its
header (inline SVG included), then the favicon services, then a square-ish
`og:image`. It writes the file, and writes the `BRAND_LOGOS` entry.

**Look at the sheet.** No check can tell a brand's mark from a photograph of a
bottle or a generated grey letter — both load, both are the right size, both
pass everything. A person spots either in a second. If one is wrong, fix the
domain in `BRAND_DOMAINS` and re-fetch that beer:

```sh
npm run fetch-logos -- --force --only "Sol"
```

For a brand that no source has, draw or save the logo into
`public/stats/logos/` yourself and add the entry to `BRAND_LOGOS` by hand. The
fetcher leaves a file it did not write alone, `--force` included. Nine logos
are here that way and are drawn approximations rather than the brand's own
artwork — `public/stats/logos/README.md` lists them and says why each one had
to be drawn.

A single beer can still override its brand's file with `logo:"logos/<file>"`
on its own `beers[]` entry — that is the per-review escape hatch, for artwork
that belongs to one pour rather than to the brand.

### Step 3: Research checklist

1. **Brewery location** — city and region of the original site.
2. **Coordinates** — of the brewery city.
3. **Language code** — the brewery's home language (see the reference table
   near the end of this file).
4. **Native name** — record `nativeName` when it differs from the marketed
   name (Pilsner Urquell → Plzeňský Prazdroj, Sapporo → サッポロビール).
5. **Country maps** — the brewery's and the city's codes must exist in `FLAGS`
   and `CNAMES`; add them if not.

### Step 4: Add the consumption city to `drunkLocs[]` (if new)

```js
{city:"CityName", region:"RegionName", country:"CountryName", cc:"XX", lat:0.0000, lng:-0.0000},
```

Without it the maps drop the review, and `npm run check` fails.

### Step 5: Check, generate the migration, commit

```sh
npm run check       # every rule above, enforced; plus the projection round-trip
npm run migration   # writes supabase/migrations/<stamp>_sync_beer_log.sql
```

`npm run migration` runs the check itself and refuses to generate from a file
that fails it. Commit **both** the edited `data.js` and the new migration in
one commit, and merge to `main` — Lovable applies the migration to the
database and redeploys. The stats page shows the beer twice over: the snapshot
already carries it, and the live hydration confirms it against the database.

The generated SQL is the whole file written as add-and-update statements: on a
match the file wins, a row only the database knows is left alone, nothing
deletes, and replaying it is a no-op. `npm run check` in CI runs on every push.

Two things no check can verify on its own: that the logo which came back is
actually the brand's logo and not a photograph of a bottle (`npm run logo-sheet`
and look at it — see "Logos" below), and that a `nativeName` was recorded where
one exists.

## Standard Operating Procedure: The Want-To-Try Shortlist

The `want_to_try` table is the standing list of beers not yet drunk; it reaches
the site as `WANT_TO_TRY` in `public/stats/data.js`. The "What to try" sub-section of Insights
renders it, and `predictRating()` scores each entry against my taste so far.

### Nothing is ever removed from it

An entry is not deleted when the beer gets drunk. `drawWantToTry()` looks for a
review of each entry on every render, and the answer decides which half of the
section it appears in:

- **no review** → it stays on the shortlist, ranked by predicted rating
- **a review** → it leaves the shortlist and appears under "Crossed off",
  where the guess made beforehand is scored against the rating given after

So the only data-entry step when you finally drink something on the list is the
normal one: add the review. The section updates itself, the KPI counts move, and
the calibration chart gains a bar. Deleting the row instead would throw away the
prediction, which is the only thing that makes the scorecard worth having.

### Adding an entry

An entry is authored in `WANT_TO_TRY` in `public/stats/data.js`, like everything
else, and `npm run migration` carries it into the `want_to_try` table:

```js
{beer:'Tsingtao', style:'Lager', origin:'CN', abv:4.7, region:'Qingdao, Shandong', untappd:3.29, method:'Bottle'},
```

Same rules as a beer: `style` needs a colour in `sC`, `origin` needs `FLAGS` +
`CNAMES` (UK split by nation as everywhere else), `method` is one of the four,
and the beer needs a `BRAND_DOMAINS` entry — a shortlist card renders a logo
like anything else. `untappd` is the world's average, from the same source as
`UNTAPPD_GLOBAL_AVGS`.

### `as` — when the shelf name isn't the logged name

Crossing off is done by name, through `wtNorm()` in `app.js`: case, accents,
apostrophes and punctuation are flattened, and what's left has to match word for
word. That is deliberately strict — a looser rule would let *Peroni Original*
cross off *Peroni Nastro Azzurro*.

When a beer really is logged under a different name, say so — `as` in data.js,
which the migration carries into the table as `aka`:

```js
{beer:'Paulaner Hefe', ..., as:['Paulaner Hefe-Weißbier']},
```

`npm run check` warns when a shortlist entry looks like an already-reviewed beer
under another name ("still on the shortlist, but "…" is already reviewed"). Read
that warning as a prompt to add an `as` — or, if they are genuinely different
beers, to leave it alone.

### The prediction

`predictRating(style, origin, untappd, method)` blends 50% world consensus, 25%
style bias, 15% country bias, 10% base anchor and a serving-method nudge. It is
recomputed on every render, so a guess shifts as the rest of the data does — an
already-crossed-off beer's guess is not frozen at the value it had on the day.
The `MIN_N` rule applies: a style or country average under three reviews falls
back to the global average rather than bending the prediction toward one pour.

## Rendering Rule: `esc()` Everything

`app.js` builds HTML with template literals and `innerHTML`. **Every value that
comes from the data goes through `esc()` first** — beer names, brewery names,
cities, regions, styles, methods:

```js
`<div class="beer-card" data-beer="${esc(b.beer)}">${esc(b.beer)}</div>`
```

Not decoration: a beer named `Smithwick's` or a brewery with a `<` in its name
closes the attribute early and takes the rest of the row with it. `esc()` handles
`& < > " '` and stringifies whatever it's given, so wrapping a number is never
wrong — when in doubt, wrap.

Two exceptions, both deliberate:

- **Canvas text** — Chart.js labels and tooltips are drawn, not parsed. Escaping
  there renders a literal `&amp;`.
- **Values that are already HTML** — `logoImg(...)`, a nested `.map(...).join('')`,
  a `cond ? '<span>' : ''`. Escaping those prints the tags.

Leaflet's `bindTooltip` / `bindPopup` **do** parse HTML: escape there.

## CDN Rule: Pin and Hash

Chart.js and Leaflet load from jsDelivr at an exact version with an `integrity`
hash. Changing either version means re-deriving the hash:

```sh
npm run sri -- --write
```

`npm run sri` takes the hash from the npm registry, not from the CDN, and
verifies the download against the integrity npm published for that version. A
wrong hash means the browser refuses the file and the charts or the map simply
never appear — so never hand-write one.

## Location Rule: City, Region, Country

A place is written one way everywhere: **City, State/Region, Country** —
"New Rochelle, New York, United States". Not "City, Country" in one place and
"City, Region" with the country on its own line in the next.

Both surfaces have a helper, and neither one should be inlined again:

| Surface | Helper |
|---------|--------|
| the app | `placeLabel(row)` in `src/lib/place.ts` — plain text; the caller adds the flag |
| the stats site | `placeLabel(city, region, country, cc, opts)` in `app.js` — returns escaped HTML with the flag in front of the country |

Both drop a part the row doesn't have rather than leaving a dangling comma, and
both say a region only once when it repeats its city ("Antwerp, Antwerp"). The
stats-site helper takes two options: `flag:false` where a flag would be noise,
and `lead:false` for the two places that have already printed the city in bold
above — the city is still passed there, because it is what tells the region it
would be a repeat.

Table **columns** are the exception, and stay split: the beers table's City,
Region and Country columns already read as the format across the row, and
folding them into one cell would only make the neighbouring column a repeat.

## Map Rule: The Pop-out Stays Open

Clicking a dot on the app's map opens its popup and it **stays open**. That is
not free, and the thing that breaks it is subtle enough to be reintroduced by
anyone tidying `src/lib/beer-data.ts`:

`selectBrandDomains` and `selectBrandLogos` live at **module scope** in
`src/lib/beer-data.ts`. React Query memoises a `select`'s result on the select
function's *identity* (`options.select === this.#selectFn`), so an inline arrow
— a new function on every render — rebuilds the `Map` on every render and hands
back an object nothing can compare equal. The map page depends on that
identity: its pins are redrawn when the data behind them changes, so a `Map`
that is "new" every render makes every click redraw the pins and `clearLayers()`
takes the popup the click had just opened. **Do not inline those two selects**,
and do not add a third inline `select` over the same query.

The city popup also names each beer's brewery (`beerRows(..., withBrewery)`) —
a dot's answer is the beer, the place and who made it. A brewery pin doesn't
repeat it, being the brewery already. And the map's filter carries a `title`
next to its `label`: the heading names the place in full ("Leuven, Flemish
Brabant, Belgium") while the rows are still matched on the bare city.

Both of these are guarded by `node tools/check-invariants.mjs`, which
`npm run check` runs — see "Features that must survive every pass" below.

## Location Rule: Canonical / Most-Unique Location

When the **same beer** (same `beer` name) has been reviewed in **more than one
consumption city**, all location-based **aggregation/display** attributes that beer to a
single **canonical location** — its **most unique** city.

- **Most unique = rarest-visited**: the city with the **fewest total reviews** in the
  database wins. All of the beer's reviews are folded into (merged onto) that one city.
- **Home bases are never canonical when an alternative exists**: **New Rochelle** and
  **New York, New York** are home markets and are never chosen as the canonical location
  for a beer as long as that beer has any other consumption city. (If a beer's only cities
  are both home cities, the standard rarest-visited metric decides between them.)
- **Tie-breaking** is deterministic: `[homePenalty, rawReviewCount, cityName]` — non-home
  beats home, then fewest reviews, then alphabetical.

### What this affects (and what it doesn't)

- **Relabeled (aggregate views)**: CITY tab chart/cards, the "drunk" map (dots, legend,
  table), the **markets** count, and TOP MARKET. A folded home-city contribution may cause
  the markets count to drop — this is intended.
- **Left honest (per-session logs)**: the main beers table rows, the beer-detail modal's
  "ALL SESSIONS" list, and the "LATEST" activity readout still show each session's **true**
  consumption city. The rule never rewrites where an individual pour actually happened.

### Data-entry implication

Keep recording each review's **real** consumption city/region/country/cc as
normal — do **not** pre-apply this rule when adding data. It is enforced at display time in
`app.js` by `computeCanonLoc()` / the `CANON_LOC` map (recomputed in `refreshStats()`),
so it stays correct automatically as data changes. Ensure any consumption city involved
exists in `drunkLocs[]` as usual.

> Note: as of the latest data, every beer is reviewed in exactly one city, so this rule is
> currently dormant and changes nothing visible; it activates automatically the first time a
> beer is logged in a second city.

## Ranking Rule: Minimum Sample Size (`MIN_N`)

A group needs **at least `MIN_N` reviews (currently 3)** before its average is allowed to
win or lose a ranking. Without this, a country visited once tops the table on a single
generous pour, and a style tried once becomes "my weakest".

`MIN_N` and its helpers live at the top of the stats section in `app.js`:

| Helper | What it does |
|--------|--------------|
| `MIN_N` | The threshold. **The only place the number is written.** |
| `thin(n)` | `true` when a count is below the threshold |
| `rankBy(avgFn, countFn)` | Sort comparator: qualified groups first (best average first), thin ones after |
| `rankable(list, countFn)` | The slice that may be called best/worst; falls back to the whole list if nothing qualifies |
| `barFill(hex, n)` | Mutes a chart bar's color when the group is thin |
| `nLabel(n)` | `"(6)"` — the sample size appended to a chart label |
| `ttWithN(n)` | Chart tooltip that states the sample size and flags thin groups |
| `stampMinNHints()` | Writes "3+ reviews to rank" into every `[data-minn]` caption |

### What this affects

- **Ordering**: style, country, city, brewing-language and brewery lists sort qualified
  first, then thin. `STATS.styleRanked[0]` etc. are therefore always a real result.
- **Headline callouts** (Highlights panel): best/worst style, top country, top city and
  best serving method are picked from the qualified subset only.
- **Country rankings over time** (bump chart): ranks the **running average** through each
  month, and a country enters the chart the month its cumulative count reaches `MIN_N`.
- **Seasonal heatmap**: cells under `MIN_N` are left uncolored — the color reads as a
  verdict, so it's withheld until the sample supports one.
- **Taste profile**: a trait below `MIN_N` shows "n reviews · need 3" instead of a bar.
- **What to try** (`predictRating()` + the rationale chips on a shortlist card): a style
  or country average only counts as signal at `MIN_N`+; below that the term falls back to
  the global average and the chip claiming "I like X" is not written at all.

### What it does not affect

Nothing is hidden or dropped. Thin groups still chart, still list, and still count toward
the totals — they sort to the tail and render muted (`.rank-thin` / `.rb-thin` in
`style.css`). Per-beer views (the beers table, the detail modal, the contrarian chart,
best/worst pour of a month) are single observations, not averages, so the rule never
touches them.

### Changing the threshold

Edit `MIN_N` in `app.js` and everything follows, including the on-screen captions —
they are generated from the constant via `data-minn`, so no text needs updating. Do **not**
hardcode "3" in HTML or CSS.

## Logos

**Every beer's logo is a file in this repo.** `public/stats/logos/`, one per
beer name, named in `BRAND_LOGOS` in data.js and in the `logo` column of
`brand_domains` behind it. That is where a logo comes from: the same picture on
every render, working offline, and nobody else's to withdraw.

It was not always. Until this changed, every logo was fetched at page load from
Brandfetch, then Google, then Icon Horse — and Brandfetch began answering 403
to the public client ID both surfaces embedded, for every domain and every URL
shape. The first tier resolved nothing for anybody. 97 of 101 beers fell
through to Google's *default* 16px favicon and the site rendered a hundred
identical grey globes for a month. Nothing in the repo had changed; nothing in
the repo could have prevented it, because every check there was only asked
whether a beer had a *domain*.

### The chain now

**committed `logos/` file → Google favicons (256) → Icon Horse → DuckDuckGo → 🍺**

The first tier answers for every beer that has been fetched, so the rest is
what happens to a beer added through the app's own form before
`npm run fetch-logos` has run for it. Still tiered by *source*, not by domain:
every domain a beer lists is tried at each tier before dropping to the next.

Two details in those URLs are load-bearing. Google serves favicons at 16, 32,
64, 128 and 256; asked for a size it does not serve it answers the 16px default
rather than failing, so `sz=512` looked like a working tier while returning a
globe — don't raise it. And Brandfetch is *gone*, not merely deprioritised:
leaving it in costs a failed request per logo and buys nothing.

### Getting a logo

```sh
npm run fetch-logos                        # everything with no file yet
npm run fetch-logos -- --force --only "Sol"
npm run fetch-logos -- --data-only         # just re-point data.js at logos/
npm run logo-sheet                         # all of them on one sheet, to look at
```

`tools/fetch-logos.mjs` needs open internet and Chromium. It walks a ladder per
brand and takes the first *tier* that answers — the order is a judgement about
what a thing is, not how big it is:

1. **the icons the site declares** — square, made to be shrunk, the brand's own
2. **the logo drawn in its header** — the mark itself, often inline SVG that
   reading the HTML as text would never find; serialised with its computed fill
   written onto every node, because those colours live in a stylesheet that is
   not coming with it
3. **the favicon services** — the same icons, second-hand
4. **`og:image`, only if roughly square** — usually a hero photograph, so it is
   fenced and last

Rasters are re-encoded to WebP at the image's own longest edge, capped at
256px. SVG is written through untouched. A file the tool did not write is never
replaced, `--force` included — so a logo drawn by hand stays.

### Looking at them

`npm run logo-sheet` renders every file onto one page, each on a half-light,
half-dark tile. **Do this, and look at it.** It is the only check that can tell
a brand's mark from a photograph of a bottle or from a generated grey letter —
both load, both are the right size, both pass everything else. That sheet is
what caught 29 beers whose "logo" was a 1200×630 social card, and 12 more that
Icon Horse had answered with a capital letter on a grey square.

Two known shapes of wrong, both now rejected by the fetcher, both worth
recognising if they come back:

- **a generated lettermark** — Icon Horse draws one for a domain it cannot find
  an icon for and serves it 200 OK at exactly 256×256. A confident wrong answer
  is worse than no answer.
- **a photograph** — a site's biggest header image is often a lifestyle shot.
  Only an element that *calls itself* a logo is taken now.

### What checks what

| What | When | Catches |
|------|------|---------|
| `npm run check` | on every push, in CI | a beer with no `BRAND_DOMAINS` entry, **and a beer with no committed logo file** — both are errors |
| the `brand_domains` check constraints | when the row is written | a domain that isn't a bare domain; a `logo` that is a URL rather than a path into `logos/` |
| `[DOMAIN CHECK]` console warning | automatically on load | a missing domain, in the browser |
| `npm run logos` | run it yourself, and monthly in CI | what each beer *actually* resolves to in a browser |
| `npm run logo-sheet` | after any fetch | whether the thing that resolved is the brand's logo at all |

`npm run logos` (`tools/audit-logos.mjs`) drives `auditLogos()` in headless
Chromium and exits non-zero on anything that didn't resolve. The **Logo audit**
workflow runs it on the 1st of each month and opens a `logo-audit` issue
listing what fell through, closing it once everything resolves again. Read its
result for two things: **`PLACEHOLDER`** (no source answered; the beer shows 🍺)
and **`suspect`** (something answered, but at favicon size — a generic globe).
With a committed file for every beer, both should now be empty; either one
means a file went missing or a `BRAND_LOGOS` entry points nowhere.

The placeholder is also what you see with no network, or behind a proxy that
blocks those CDNs — which is why `npm run logos` probes a few brands that
certainly have logos before auditing anything, and reports the connection
rather than printing a hundred false failures. It exits 0 on that (a skip, not
a pass); `--strict` makes it a failure instead, which is what CI uses so a run
that checked nothing can't read as all-clear.

`tools/probe-logo-sources.mjs` is the tool for the next time a whole tier goes
quiet: it asks every candidate source shape what it actually returns for a real
brand domain — status, type, bytes, pixel size — which is how the 403 and the
`sz=512` default were found.

## Design System: Dark

A calm, modern dark product surface — deep neutral charcoal ground, softly
elevated cards, one honey accent, rich (never neon) data color. Hierarchy comes
from size, weight and muted text. Set throughout in **Plus Jakarta Sans**, one
family, sentence case.

Three things are deliberately absent, because together they read as a trading
terminal rather than a product: **monospace type**, **all-caps tracked labels**,
and **glow**. Don't reintroduce them.

### Where a color is written

**`:root` in `style.css` is the only place.** Do not hardcode a hex anywhere else
— not in CSS rules, not in inline styles in `app.js`.

`app.js` reads the tokens off `:root` at boot through `cssVar()` and freezes
them into `THEME` (canvas and Leaflet can't resolve CSS variables). So changing a
token in `style.css` retints the charts, map markers and passport stamps too, with
nothing to keep in sync by hand. The literals in the `THEME` object are fallbacks
for the case where the stylesheet hasn't landed — update them alongside the CSS.

| Token | Role |
|-------|------|
| `--bg` | the charcoal ground |
| `--surface` | cards and panels, one step up |
| `--surface-2` / `-3` / `-4` | hovers, wells, tracks |
| `--border` / `--border-strong` | hairlines; `-strong` for fields and edges |
| `--text` / `--text-2` / `--text-3` | body, secondary, captions |
| `--accent` / `--accent-hi` | honey: `--accent` fills and draws, `--accent-hi` is the lighter cut for text |
| `--on-accent` | the near-black ink for text sitting *on* the accent |
| `--pos` `--neg` `--warn` `--info` `--purple` | semantics |
| `--edge` | the whisper of a top edge on raised surfaces |
| `--glow` | a soft focus ring — *not* a bloom |

`--edge` is **composed, never replaced**: a rule that adds a shadow on hover must
restate it (`box-shadow: var(--edge), var(--shadow-md)`) or the card goes flat.

### Type

One family, one rule worth knowing: Plus Jakarta Sans ships an unusually narrow
word space (~0.16em against a typical 0.25em) which closes up entirely at caption
sizes — "Average rating" renders as one word. `body` sets `word-spacing: 0.075em`
to correct it, and body tracking stays at normal so nothing eats back into it.
Negative tracking belongs only on large type (`.kpi-val`, `.tb-title`,
`.merged-section-head`).

`--fs-label` (12px) is the caption size: tile labels, table heads, section
markers. Sentence case, in `--text-3`.

### Categorical palettes (`app.js`)

Rich, evenly spaced hues held deliberately short of neon — full saturation on a
dark ground is what tips a chart into looking like a trading screen. A new entry
should sit at the same middle brightness.

| Constant | Covers |
|----------|--------|
| `sC` | beer style → color (add a color here for any new `style`; `npm run check` fails without it) |
| `rC(r)` | rating → color ramp; mirrors the `.r5`…`.r2` badges in `style.css` |
| `MONTH_COLORS`, `BUMP_COLORS`, `LANG_COLORS`, `STAMP_INKS` | month, bump-chart, brewing-language and passport series |

`barFill(hex, n)` dims an under-`MIN_N` bar to 70% of its own color — no further.
Alpha over a dark ground darkens toward mud, and the sort order, the `(n)` in the
label and the tooltip already carry the "not ranked" reading.

## Language Code Reference

| Code | Language       | Countries                      |
|------|----------------|--------------------------------|
| `en` | English        | US, IE, JM, GB, AU, SG        |
| `de` | German         | DE                             |
| `nl` | Dutch          | NL, BE (Flemish)               |
| `fr` | French         | FR, BE (Wallonia), CA (Quebec) |
| `es` | Spanish        | ES, MX, AR                     |
| `it` | Italian        | IT                             |
| `ja` | Japanese       | JP                             |
| `cs` | Czech          | CZ                             |
| `pl` | Polish         | PL                             |
| `da` | Danish         | DK                             |
| `pt` | Portuguese     | PT, BR                         |
| `sv` | Swedish        | SE                             |
| `no` | Norwegian      | NO                             |
| `zh` | Chinese        | CN                             |
| `th` | Thai           | TH                             |
| `el` | Greek          | GR                             |
| `af` | Afrikaans      | ZA                             |
| `ar` | Arabic         | LB                             |

## Notable Native Beer Names

These beers have native-language names that differ from their marketed names.
They are stored as `native_name` on the brewery row:

| Marketed Name           | Native Name        | Language |
|-------------------------|--------------------|----------|
| Pilsner Urquell         | Plzeňský Prazdroj  | Czech    |
| Sapporo Premium         | サッポロビール        | Japanese |
| Kirin Ichiban           | キリン一番搾り        | Japanese |
| Birra Moretti           | Birra Moretti      | Italian  |
| Erdinger Weißbier       | Erdinger Weißbier  | German   |
| Hofbräu Münchner Weiße  | Hofbräu Münchner Weiße | German |
| Almaza Pilsener         | ألمازة             | Arabic   |
