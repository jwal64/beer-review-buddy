# Beer Review Buddy — Development Guide

Everything lives here now. One repo, hosted by Lovable, holding three parts:

| Part | Where | What it is |
|------|-------|------------|
| The app | `src/` | React/TanStack, mobile-first: Home, Beers, Map, Insights. Reads the committed log; no network, no writes. |
| The stats site | `public/stats/` | The full analytics site — charts, maps, the passport, the want-to-try scorecard. Static files, no build step, served whole at `/stats`. Moved intact from `jwal64/JWAL-BEER-REVIEW`. |
| The tools | `tools/` | Node scripts: validate, snapshot, round-trip, invariants, SRI, smoke, logo audit. Zero-dependency, except the three that drive a browser (smoke, logo audit, logo fetch). |

There is **one store**, and it is a file:

**`public/stats/data.js`** is the log. Every review, brewery, location, brand
domain, Untappd average and want-to-try entry is written there, by hand, and
what is committed is exactly what the site shows. `npm run snapshot` projects
it into `src/data/snapshot.json`, which is the same data as flat rows — the
shape the app wants, since the app is a Vite bundle and cannot read a file out
of `public/`. Both are committed; `npm run check` fails if they disagree.

There used to be a Supabase database as well, and it is worth knowing why
there isn't. Carrying `data.js` into it meant a generated migration, applying
a migration was the host's step rather than this repo's, and it stopped
happening — silently, for days at a time, across three merges, while every
check stayed green. Both surfaces read the database and let it win, so a beer
that had been added, checked, committed and merged was simply not on the site
and nothing said so. The database has been removed rather than worked around:
there is no second copy of the log to drift, no migration to apply, and no
step between merging and being live.

## Making Changes with Claude

Any edit — a feature in the app, a tweak to the stats site, a new beer —
follows the same loop, and the loop is what makes it land on Lovable:

1. **Start from the latest `main`.** Lovable commits its own edits straight to
   `main`, so fetch and merge it into the working branch first — the tree on
   disk may be behind what Lovable has already changed.
2. **Make the edit**, respecting the rules in this file.
3. **Validate before pushing** — Lovable deploys `main`, so `main` stays green:

   ```sh
   npm run check          # data rules + round-trip + snapshot + bun.lock + tests (always)
   npm run test           # just the tests, when that is all you changed
   npx tsc --noEmit       # if src/ changed
   npx eslint <files>     # if src/ or tools/ changed; prettier --write first
   npx vite build         # if src/, vite.config.ts or package.json changed
   npm run smoke          # if public/stats/ changed (needs a browser)
   ```

4. **Merge to `main`.** That is the publish button, and the whole of it:
   Lovable syncs the commit and redeploys, and what deploys is what shows.
   A branch that is only pushed exists on GitHub and nowhere else.

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

Three things have been lost to a Lovable editing pass that never set out to
touch them, so they are written down here, guarded by a check, and repeated for
Lovable in `AGENTS.md`:

1. **The map pop-out stays open** — the two module-scope selects in
   `src/lib/beer-data.ts` ("Map Rule: The Pop-out Stays Open" below).
2. **One location format everywhere** — `placeLabel` in `src/lib/place.ts` and
   in `public/stats/app.js` ("Location Rule: City, Region, Country" below).
3. **The app's data layer** — `src/lib/snapshot.ts` (which must export `BEERS`
   and import `@/data/snapshot.json`) and `src/lib/beer-data.ts` importing from
   it. This is the whole of how the app gets the log. Pointing any of it back
   at a network call reintroduces the gap between what is committed and what is
   shown — the gap that hid a beer for a week while every check stayed green.

`node tools/check-invariants.mjs` fails when any of them goes missing, and
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

### The tests

`tools/app-logic-test.mjs` — plain Node, no network, milliseconds. `npm run
check` runs it and CI gives it a step of its own; `npm run test` runs it alone.

It pins the rules inside `public/stats/app.js`: `esc()`, both halves of the
location format, `wtNorm()`, the `MIN_N` helpers, the rating ramp,
`computeCanonLoc()`, `predictRating()` and `isDisplayNew()`. Three are worth
knowing about:

- **The two `placeLabel`s are compared to each other**, over every location in
  `drunkLocs`. Nothing else does: the format is written twice, once in
  `src/lib/place.ts` and once in `app.js`, and a check that only asks whether
  both exist passes happily while they disagree.
- **`computeCanonLoc()` is dormant** — every beer is currently reviewed in
  exactly one city, so none of it runs against the committed data. It starts
  running by itself the first time a beer is logged in a second city, which is
  the worst moment to discover an untested rule.
- **`predictRating()`'s `MIN_N` fallback is invisible.** A wrong one still
  returns a plausible number, so nothing on the page would look broken.

The declarations are lifted out of `app.js` and evaluated by `loadAppScope()`
in `tools/load-data.mjs`, so the tests run the site's own definitions rather
than a copy, and app.js keeps its no-imports, no-exports shape. A test that
fails with "app.js has no top-level declaration of …" means the declaration was
renamed or indented, not that the rule broke.

`tools/roundtrip-snapshot.mjs` is the other half of the safety net, and matters
more than it used to: the app reads `src/data/snapshot.json` rather than
`data.js`, so it sends the data through the projection and back and fails if
anything comes back different — and fails if the committed snapshot is out of
step with `data.js`. A stale snapshot is the one way the app can now show the
wrong thing, and it is silent, so `npm run check` refuses it.

`check-invariants.mjs` asks whether a feature is still *there*; the tests ask
whether it still *behaves*. Adding a tool to the `check` script also requires a
step for it in `.github/workflows/checks.yml`; `check-invariants.mjs` compares
the two and fails when they drift.

`npx tsc --noEmit` type-checks `src/`, and `npm run smoke` drives the built
page in a browser. Nothing yet covers the React components or the drawing half
of `app.js`.

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
- **There is no database, and no migrations.** A change to what a column
  means is a change to `data.js`, to `tools/snapshot-rows.mjs` (the projection)
  and to the row types in `src/lib/snapshot.ts` — and `npm run check` proves
  the three agree. Anything under `supabase/` is the remains of the old store
  and is not wired to anything; do not add to it, and do not reintroduce a
  client for it.
- **`src/lib/snapshot.ts` owns the app's row types.** They are hand-written
  and describe exactly what `npm run snapshot` emits. Add a field to a row and
  it is added in both places, or `npx tsc --noEmit` says so.
- **The stats site stays dependency-free.** `public/stats/` is plain browser
  JavaScript served as-is — no imports in `data.js`/`app.js`, no build step,
  CDN scripts pinned with SRI hashes (`npm run sri` re-derives them; never
  hand-write one). `data.js` and `app.js` are the whole of it — there is no
  module code there at all now, and nothing on the page fetches anything but
  the two pinned CDN libraries.
- **Secrets stay out.** There is nothing to authenticate to any more, so
  there is no key in the tree at all. Keep it that way: a feature that needs a
  secret needs a conversation first.

## Standard Operating Procedure: Adding a Beer

This is the normal flow — the owner describes a beer they drank, and a Claude
session makes these edits. Everything happens in `public/stats/data.js`, and
one command generates everything downstream of it.

### How a beer arrives

Two ways in, and they meet in the same place — an edit to `data.js`.

1. **From a phone.** The app's Beers tab has a **+**, which opens `/add`: pick
   where you drank it, then tap through to a pre-filled GitHub issue and attach
   the Untappd screenshot. That files it under the `beer` label, which is the
   queue. Nothing is written to the repo by that — it cannot be, and should not
   be: a brewery's coordinates, its language, a native name and a fetched logo
   are research, not form fields, which is exactly what the screenshot is handed
   over for.
2. **Straight to a Claude session** — the screenshot and where it was drunk,
   the way it has always worked.

Either way the work below is the same. **When starting from an issue, close it
with the commit** (`Closes #N`) so the queue drains.

The city matters more than the rest of it: it has to match a row in
`drunkLocs` exactly or `npm run check` fails, which is why `/add` offers the
places already in the log rather than a free-text box.

### The short version

```sh
# 1. edit public/stats/data.js — the review, the brewery, the domain, the city
npm run fetch-logos        # 2. the logo (needs internet); then look at it:
npm run logo-sheet
npm run check && npm run snapshot   # 3. check, then write what the app reads
# 4. commit all of it, merge to main. That is the publish button.
```

**It is live when that merge deploys.** Both surfaces read the committed log
and nothing else — the stats page loads `data.js` directly, the app the
snapshot projected from it — so there is no database to be behind, no
migration to apply, and no step between merging and being live. Step 6 is the
long version of why that is worth saying out loud.

Two things no check can do for you, both worth thirty seconds: **look at the
logo sheet** — nothing automated tells a brand's mark from a photograph of a
bottle — and record a `nativeName` where one exists.

If `npm run fetch-logos` can reach nothing (a sandbox with no egress answers
`403` at `CONNECT` for every logo source, which looks identical to the brand
having no logo), draw one into `public/stats/logos/` by hand and add it to
`BRAND_LOGOS` — `public/stats/logos/README.md` is the guide, and a file you
place by hand has to be listed under `kept` in `logo-fetch-report.json` or the
next fetch overwrites it.

### The long version

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
under its month's comment header. The existing lines are written with padded
columns; a hand-added line does not need to match the padding.

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
 lat:49.6853, lng:19.1925,      // This brewery's own site — not the city centre
 ratings:[3.50],                // One rating per listed beer, same order
 // only when the native name differs from the marketed one:
 nativeName:"NativeBeerName"},
```

**Point the coordinates at the brewery, not at its city.** Two breweries in one
city that both carry the city-centre point land on the same pixel at every
zoom, and the one written later paints over the earlier one and takes its
clicks with it — so that brewery's beers have no reachable pin, on the app's
map or the stats site's, and nothing about the page looks wrong. It has
happened twice, to Amstel under Heineken and to Miller Lite under Pabst, both
times by copying the coordinates of the brewery already there. `npm run check`
now fails on two breweries sharing a point.

In the projected rows, `beers` and `ratings` have no column — they are derived
from the reviews, because a beer row names its own brewery. In the file they
are written out, and `npm run check` fails if they disagree with the reviews.

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
header (inline SVG included), then an image on the brand's own site that names
this beer, then the favicon services, then a square-ish `og:image`. It writes
the file, and writes the `BRAND_LOGOS` entry.

**Look at the sheet.** No check can tell a brand's mark from a photograph of a
bottle or a generated grey letter — both load, both are the right size, both
pass everything. A person spots either in a second. If one is wrong, fix the
domain in `BRAND_DOMAINS` and re-fetch that beer:

```sh
npm run fetch-logos -- --force --only "Sol"
```

For a brand that no source has, draw or save the logo into
`public/stats/logos/` yourself and add the entry to `BRAND_LOGOS` by hand. The
fetcher leaves a file it did not write alone, `--force` included — but only
because `logo-fetch-report.json` records which files are its own, so **a file
you hand-place or hand-edit has to be added to `kept` there** or the next run
overwrites it. Thirty-three logos are here that way; two of them are drawn
approximations rather than the brand's own artwork, and
`public/stats/logos/README.md` lists those two and says why each one had to be
drawn. It also records where the rest came from, which matters when this
environment's egress policy blocks every logo source: `npm run fetch-logos`
resolves nothing here, but anonymous git reads of public GitHub repositories
are served, and a brand-logo collection cloned that way is where eight of the
drawings found their real marks. Untappd's label bucket, `untappd.s3.amazonaws.com`,
is reachable too, by exact key only; that is where Hop Commander, Killsner
and Big Wave found theirs.

Three things that file also records, because no check can catch any of them: a
logo can be the brand's real artwork and still render as nothing (an SVG whose
art lives in a sprite it does not carry; a WebP that is entirely transparent),
a mark drawn for a light label can measure invisible against this site's
charcoal ground and needs the white tile `modelo-especial.webp` already uses,
and a brand's own favicon is still a better answer than a drawing of its label.

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

### Step 5: Check, publish the snapshot, commit

```sh
npm run check       # every rule above, plus the projection round trip
npm run snapshot    # writes src/data/snapshot.json — what the app reads
```

`npm run check` fails when the snapshot is out of step with `data.js`, so a
forgotten `npm run snapshot` is caught here rather than by the app quietly
showing the log as it stood before your edit.

Commit `data.js` and `src/data/snapshot.json` together, and merge to `main`.

### Step 6: There is no step 6

**It is live when the merge deploys.** Both surfaces read the committed log
and nothing else:

| Surface | Reads |
|---------|-------|
| the stats site, `/stats` | `public/stats/data.js`, as a `<script>` |
| the app | `src/data/snapshot.json`, bundled |

No database, no migration to apply, nothing between merging and being live,
and nothing that can be a beer behind. The app makes no data request at all,
which is also why it works offline and paints instantly.

This is worth spelling out because for a long stretch it was the opposite, and
that cost more than anything else in this project. Adding a beer used to end
with "merge to `main` — Lovable applies the migration", and that last step is
the one part that did not happen in this repo and that nothing here could
force. It silently stopped happening on 2 September and stayed stopped across
three merges. Both surfaces let the database win — the stats page painted the
new beer and then *replaced it with the database's answer*, and the app read
Supabase and nothing else — so a beer that had been added, checked, committed
and merged appeared for one frame and then vanished, or never appeared at all.
Every check was green throughout, because every check was asking whether the
file was right, and the file was right.

The fix was to stop having two copies of the log. The database is gone, along
with the 22 migrations, the migration generator, the live-sync verifier and
its workflow, the nightly sync and the Supabase client. What is committed is
what is shown.

### Renaming a beer

Rename it in `data.js`, run `npm run snapshot`, commit both. That is all — the
rename is the whole change, because there is only one copy of the log.

This used to be a hazard worth a section of its own: reviews were matched on
`name` + `drank_on`, the generated SQL never deleted, so renaming a beer that
a migration had already applied inserted the new name and stranded the old row,
which then showed on the site forever as a review `data.js` had no record of.
Nothing can strand now.

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
else, and `npm run snapshot` carries it into the rows the app reads:

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
which the projection carries into the rows as `aka`:

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

Both drop a part the row doesn't have rather than leaving a dangling comma. A
city and its region can share a name by coincidence rather than identity — New
York City sits in New York State, Antwerp the city in Antwerp the province —
so neither helper collapses a region that repeats its city: "New York, New
York, United States" and "Antwerp, Antwerp, Belgium" are both printed in full,
because dropping the second one made "New York, USA" read as the state rather
than the city that was actually drunk in. The stats-site helper takes two
options: `flag:false` where a flag would be noise, and `lead:false` for the two
places that have already printed the city in bold above.

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
3. **an image on the brand's own site that names this beer** — a brewery that
   makes several beers puts one mark in its header, its own, and each beer's
   mark on that beer's page. So the site's links are followed to a page naming
   the beer, and `/magna/`, `/marcas/magna/` and the rest are tried directly,
   because a splash screen or age gate is what answers the bare domain on a
   good many brewery sites and carries no links at all. Naming is the claim,
   which is the rule tier 2 already uses — moved from the company to the brand.
   JPEGs are refused here as they are there
4. **the favicon services** — the same icons, second-hand. Note what they
   answer for a multi-brand site: asked about `cerveceradepr.com`, which
   declares no icon, Google returns the **WordPress logo**, twice now
5. **`og:image`, only if roughly square** — usually a hero photograph, so it is
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
