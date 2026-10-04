# Beer Review Buddy — Development Guide

One repo, hosted by Lovable, holding three parts:

| Part | Where | What it is |
|------|-------|------------|
| The app | `src/` | React/TanStack, mobile-first: Home, Beers, Map, Insights. Reads the committed log; no network, no writes. |
| The log | `src/data/log.ts` | Every review, brewery, place, logo and fact — the one store, typed, written by hand. |
| The tools | `tools/` | Node scripts: validate, lockfile, invariants, tests, smoke, logo fetch and sheet. Zero-dependency, except the three that drive a browser (smoke, logo fetch, logo sheet). |

There is **one store**, and it is a file:

**`src/data/log.ts`** is the log. Every review, brewery, location, brand
domain, logo, beer fact, Untappd average and want-to-try entry is written
there, by hand, and what is committed is exactly what the app shows: the app
imports the file, and `src/lib/rows.ts` flattens it into the rows the screens
read, at build time. There is no generated copy to keep in step and no
database (see "History" at the end for why both matter). The file is typed
against `src/data/log-types.ts`, so `npx tsc --noEmit` rejects a misspelt
style or a missing field, and `npm run check` enforces everything a type
cannot.

`/stats` redirects to `/insights`: the old static stats site is gone. One
manual step remains between merging and being live, and it is Lovable's:
**Publish** (see step 4 below).

## Making Changes with Claude

Any edit — a feature in the app or a new beer — follows the same loop, and the
loop is what makes it land on Lovable:

1. **Start from the latest `main`.** Lovable commits its own edits straight to
   `main`, so fetch and merge it into the working branch first — the tree on
   disk may be behind what Lovable has already changed.
2. **Make the edit**, respecting the rules in this file.
3. **Validate before pushing** — Lovable deploys `main`, so `main` stays green:

   ```sh
   npm run check          # data rules + bun.lock + invariants + tests (always)
   npm run test           # just the logic tests, when that is all you changed
   npx tsc --noEmit       # if src/ changed — the log included
   npx eslint <files>     # if src/ or tools/ changed; prettier --write first
   npx vite build         # if src/, vite.config.ts or package.json changed
   npm run smoke          # if src/ changed: every route in a real browser
   ```

4. **Merge to `main`, then Publish in Lovable.** Merging is what gets the
   change *into Lovable*: Lovable syncs `main` into its editor and preview.
   It does **not** put it on the live site. The published site only changes
   when the owner opens Lovable's publish dialog and clicks **Publish
   changes** — a step nothing in this repo can trigger. So a merged, green,
   synced change can sit off the live site indefinitely; when the owner
   says "it's merged but not on the site", the answer is almost always that
   publish. Say so at the end of every change: *merged — now Publish in
   Lovable*. A branch that is only pushed exists on GitHub and nowhere else.

   If Lovable's Git settings say it and GitHub have **diverged** (each has
   commits the other lacks), any new push to `main` makes Lovable take
   GitHub's version; edits it could not sync land on a `lovable-sync`
   branch on GitHub. Merge anything worth keeping from there into `main`.

A remote Claude session gets its dependencies automatically — the
`SessionStart` hook in `.claude/hooks/session-start.sh` runs `npm install` when
the container starts, so all of the commands above work from the first turn.
The data tools in `tools/` need nothing installed at all.
It also sets `CHROMIUM_PATH` to the container's preinstalled Chromium, which
is not the build this repo's playwright expects; without it every tool that
drives a browser fails with "Executable doesn't exist".

The hook finds the repository from its own path, not from `CLAUDE_PROJECT_DIR`.
That variable is unset in a session with more than one repository attached, and
under `set -u` reading it ended the hook before it installed anything — silently.
If `npx tsc`, `npm run smoke` or `npm run fetch-logos` ever reports a missing
module, check `node_modules` exists before believing anything else.

### Features that must survive every pass

Three things have been lost to a Lovable editing pass that never set out to
touch them, so they are written down here, guarded by a check, and repeated for
Lovable in `AGENTS.md`:

1. **The map pop-out stays open** — the two module-scope selects in
   `src/lib/beer-data.ts` ("Map Rule: The Pop-out Stays Open" below).
2. **One location format everywhere** — `placeLabel` in `src/lib/place.ts`
   ("Location Rule: City, Region, Country" below).
3. **The app's data layer** — `src/lib/snapshot.ts` (which must export `BEERS`
   and import `"../data/log.ts"`) and `src/lib/beer-data.ts` importing from
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
something else entirely.

**So the rule for any pass, Lovable's or a Claude session's, is:** start from
the current `main`, and when a merge asks which side of a file to keep, keep
the side that has these features rather than the side your branch was cut
from. A change you did not intend to make is not yours to resolve — if you did
not mean to remove `placeLabel`, don't.

### The tests

`tools/app-logic-test.mjs` — plain Node, no network, milliseconds. `npm run
check` runs it and CI gives it a step of its own; `npm run test` runs it alone.

It imports the app's own modules — `src/lib/place.ts`, `src/lib/insights.ts`,
`src/lib/when.ts` — and pins `placeLabel`, `wtNorm()`, the `MIN_N` helpers,
`groupRatings()`, `summarise()`, `predictRating()`, `whenLabel()` and
`isDisplayNew()`. Node 22.18+ strips the types itself, so there is no build
step; what makes a module loadable is that it **imports nothing at runtime**
(type-only imports are erased). Keep it that way for anything under test: a
module that reaches for `@/…`, React or React Query cannot be loaded in plain
Node. That is why the date helpers live in `when.ts` rather than in
`beer-data.ts`, which re-exports them.

`predictRating()`'s `MIN_N` fallback is worth knowing about: a wrong one still
returns a plausible number, so nothing on the page would look broken.

`tools/validate-data.mjs` is the other half of the safety net: every rule in
this file that a type cannot express — a review's city with no `drunkLocs` row,
a brewery's `beers`/`ratings` out of step with the reviews, a beer with no logo
file, two breweries on one point, a flag with no country name. It imports the
log the same way the app does (`tools/load-data.mjs`), so it checks exactly
what will be built.

`npm run smoke` (`tools/smoke-test.mjs`) starts `vite dev` and drives Chromium
through every route at phone size: each heading renders with no uncaught
error, the beers list and the insight panels fill in, a committed logo loads
from `/logos/`, a map pin's popup is still open after the click that opened
it, and `/stats` lands on Insights. It
uses the dev server because the production build targets Cloudflare Workers.

`check-invariants.mjs` asks whether a feature is still *there*; the tests ask
whether it still *behaves*. Adding a tool to the `check` script also requires a
step for it in `.github/workflows/checks.yml`; `check-invariants.mjs` compares
the two and fails when they drift. `npx tsc --noEmit` type-checks `src/`, the
log included, and CI runs it as a job of its own.

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
  files in the same commit. `npm run check` enforces this
  (`tools/check-lockfile.mjs`), so a forgotten `bun install` fails here rather
  than in a Lovable deploy after the merge. It compares the two files as text:
  `bun install --frozen-lockfile` cannot be the check, because some resolution
  URLs in `bun.lock` point at Lovable's own registry mirror
  (`europe-west4-npm.pkg.dev/lovable-core-prod`), which answers 403 to anyone
  outside their sandbox. Editing only the `scripts` block needs no
  `bun install` — the lockfile records dependencies, and the check only reads
  those.
- **There is no database, and no migrations.** A new field is a change to
  `src/data/log-types.ts` (the authoring shape), to `src/lib/rows.ts` (the
  projection) and to the row types in `src/lib/snapshot.ts` — and
  `npx tsc --noEmit` proves the three agree. The old `supabase/` directory,
  its generated client and the `@supabase/supabase-js` dependency are
  deleted; do not reintroduce any of them.
- **`src/lib/snapshot.ts` owns the app's row types.** They are hand-written
  and describe exactly what `toRows()` returns.
- **The log stays plain data.** `src/data/log.ts` holds values and nothing
  else — no functions, no runtime imports (its one import is type-only).
  `tools/` import it in plain Node, which strips types and nothing more, and
  the chain `snapshot.ts → rows.ts → log.ts` uses relative imports with their
  `.ts` extension rather than `@/` so Node can follow it too.
- **Secrets stay out.** There is nothing to authenticate to, so there is no
  key in the tree at all. Keep it that way: a feature that needs a secret
  needs a conversation first.

## Standard Operating Procedure: Adding a Beer

**Every new beer entry follows the `/add-beer` skill**
(`.claude/skills/add-beer/SKILL.md`): start from the latest `main`, the data
steps below, `npm run check && npx tsc --noEmit`, one commit on a branch,
opened as a pull request into `main` for the owner to merge (no
rebase/squash/force-push), then remind the owner to Publish in Lovable once
merged.

This is the normal flow — the owner describes a beer they drank, and a Claude
session makes these edits. Everything happens in `src/data/log.ts`; the app
reads it directly, so there is nothing to regenerate.

### How a beer arrives

Two ways in, and they meet in the same place — an edit to the log.

1. **From a phone.** The app's Beers tab has a **+**, which opens `/add`: pick
   where you drank it, then tap through to a pre-filled GitHub issue and attach
   the Untappd screenshot. That files it under the `beer` label, which is the
   queue. Nothing is written to the repo by that — it cannot be, and should not
   be: a brewery's coordinates, its language, a native name and a fetched logo
   are research, not form fields, which is exactly what the screenshot is handed
   over for.
2. **Straight to a Claude session** — the screenshot and where it was drunk.

Either way the work below is the same. **When starting from an issue, close it
with the commit** (`Closes #N`) so the queue drains.

The city matters more than the rest of it: it has to match a row in
`drunkLocs` exactly or `npm run check` fails, which is why `/add` offers the
places already in the log rather than a free-text box.

### The short version

```sh
# 1. edit src/data/log.ts — the review, the brewery, the domain, the facts, the city
npm run fetch-logos        # 2. the logo (needs internet); then look at it:
npm run logo-sheet
npm run check && npx tsc --noEmit   # 3. every rule, and every type
# 4. commit all of it, open a PR into main
# 5. once merged, the owner clicks Publish → Publish changes in Lovable
```

Two things no check can do for you, both worth thirty seconds: **look at the
logo sheet** — nothing automated tells a brand's mark from a photograph of a
bottle — and record a `nativeName` where one exists.

If `npm run fetch-logos` can reach nothing (a sandbox with no egress answers
`403` at `CONNECT` for every logo source, which looks identical to the brand
having no logo), draw one into `public/logos/` by hand and add it to
`BRAND_LOGOS` — `public/logos/README.md` is the guide, and a file you
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


**Retro reviews.** A beer drunk before the log began and graded from memory
gets `retro:true` after `year` (and normally `isNew:false`). Its
`month`/`monthN`/`year` are the month it was *logged*, which keeps the diary
in order, but the app never shows that date: it prints "Retro" (`whenLabel()`
in `src/lib/when.ts`) and keeps the review out of every month-by-month chart
and the recent feed. It still counts in every average and ranking. The
existing lines are written with padded columns; a hand-added line does not
need to match the padding.

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
clicks with it — so that brewery's beers have no reachable pin on the map,
and nothing about the page looks wrong. It has
happened twice, to Amstel under Heineken and to Miller Lite under Pabst, both
times by copying the coordinates of the brewery already there. `npm run check`
now fails on two breweries sharing a point.

In the projected rows, `beers` and `ratings` have no column — they are derived
from the reviews, because a beer row names its own brewery. In the file they
are written out, and `npm run check` fails if they disagree with the reviews.

### Step 2.5: Add the brand domain to `BRAND_DOMAINS` (REQUIRED)

A beer with no entry and no logo file renders a monogram forever; there is no
name-based guess behind it.

```js
"Radeberger Pilsner":"radeberger.de",
"Pilsner Urquell":["pilsnerurquell.com","prazdroj.cz"],
```

The array form is for a brand that lives at more than one address, tried in
order. **Every domain listed must belong to that brand** — a parent company's
domain is not a fallback: Heineken's logo on an Almaza is a confidently wrong
answer, which is worse than no logo.

### Step 2.6: Fetch the logo (REQUIRED)

Every beer's logo is a **file in this repo**, under `public/logos/`, named
in `BRAND_LOGOS` in the log. `npm run check` fails on a beer that has none — so
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
`public/logos/` yourself and add the entry to `BRAND_LOGOS` by hand. The
fetcher leaves a file it did not write alone, `--force` included — but only
because `logo-fetch-report.json` records which files are its own, so **a file
you hand-place or hand-edit has to be added to `kept` there** or the next run
overwrites it. Fifty-two logos are here that way; three of them are drawn
approximations rather than the brand's own artwork, and
`public/logos/README.md` lists those three and says why each one had to be
drawn. It also records where the rest came from, which matters when this
environment's egress policy blocks every logo source: `npm run fetch-logos`
resolves nothing here, but anonymous git reads of public GitHub repositories
are served, and a brand-logo collection cloned that way is where eight of the
drawings found their real marks. Untappd's label bucket, `untappd.s3.amazonaws.com`,
is reachable too, by exact key only; that is where Hop Commander, Killsner,
Big Wave and Toasted Lager found theirs.

Three things that file also records, because no check can catch any of them: a
logo can be the brand's real artwork and still render as nothing (an SVG whose
art lives in a sprite it does not carry; a WebP that is entirely transparent),
a mark drawn for a light label can measure invisible against this site's
charcoal ground and needs the white tile `modelo-especial.webp` already uses,
and a brand's own favicon is still a better answer than a drawing of its label.

A single beer can still override its brand's file with `logo:"logos/<file>"`
on its own `beers[]` entry — that is the per-review escape hatch, for artwork
that belongs to one pour rather than to the brand.

### Step 2.7: Add the beer's facts to `BEER_FACTS` (REQUIRED)

What the beer *is*, apart from how it was rated. Keyed by beer name, like the
logo, because these are facts about the beer rather than about one pour — a
beer drunk twice has one entry. `npm run check` fails on a logged beer with
none.

```js
"Grolsch":{sub:"Dutch Pilsner",color:"Pale",body:"Light",ibu:12,cal:142,adjuncts:[]},
```

- `sub` — the specific style, from the vocabulary already in the file (reuse a
  name rather than coining a near-duplicate; the Beer profile chart groups on it).
- `color` — `Pale`, `Gold`, `Amber` or `Dark`. `body` — `Light`, `Medium` or `Full`.
- `ibu` and `cal` (per 12 fl oz) — **the brewery's published figure, or `null`.**
  Never an estimate and never borrowed from a similar beer: the charts count
  only the beers that have the figure and say how many that was, so a guess
  poisons a result that is otherwise honest. Convert per-100 ml by ×3.55.
  Homebrew-clone recipes are not a source.
- `adjuncts` — documented non-barley-malt ingredients (`rice`, `corn`,
  `wheat`, `coriander`, `orange peel`, `sugar`…), or `[]` when none is documented.

A beer that cannot be identified at all gets `color:null, body:null` rather than
a guess (`Ocean SJU` is one). The projection (`beer_facts` in
`tools/snapshot-rows.mjs`), the row type (`BeerFactsRow` in `src/lib/snapshot.ts`)
and `toRows()` all carry it.

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


### Step 5: Check and commit

```sh
npm run check       # every rule above
npx tsc --noEmit    # every type: a misspelt style, a missing field
```

Commit `src/data/log.ts` (with any logo files and `logo-fetch-report.json`)
and open the PR. There is nothing to regenerate: the app is built from the log.

### Step 6: Publish in Lovable

Merging syncs the change into Lovable; it does not deploy it. The owner opens
Lovable's publish dialog and clicks **Publish changes**, and then it is live.
Tell the owner this in the reply that reports the PR. Toasted Lager sat
merged, green and synced but off the site on 2 October for exactly this
reason.

### Renaming a beer

Rename it in the log — in `beers[]`, the brewery's `beers` string and every
keyed map (`BRAND_DOMAINS`, `BRAND_LOGOS`, `BEER_FACTS`, `UNTAPPD_GLOBAL_AVGS`)
— and commit. `npm run check` flags any key left pointing at the old name.

## Standard Operating Procedure: The Want-To-Try Shortlist

`WANT_TO_TRY` in `src/data/log.ts` is the standing list of beers not yet
drunk. The **Next** tab of Insights renders it, and `predictRating()` in
`src/lib/insights.ts` scores each entry against my taste so far.

### Nothing is ever removed from it

An entry is not deleted when the beer gets drunk. `scoreShortlist()` in
`src/lib/insights.ts` looks for a review of each entry on every render, and the
answer decides which half of the tab it appears in:

- **no review** → it stays on the shortlist, ranked by predicted rating
- **a review** → it leaves the shortlist and appears under "Crossed off",
  where the guess made beforehand is scored against the rating given after

So the only data-entry step when you finally drink something on the list is the
normal one: add the review. The tab updates itself and the counts move. Deleting the row instead would throw away the
prediction, which is the only thing that makes the scorecard worth having.

### Adding an entry

An entry is authored in `WANT_TO_TRY` in `src/data/log.ts`, like everything
else:

```js
{beer:'Tsingtao', style:'Lager', origin:'CN', abv:4.7, region:'Qingdao, Shandong', untappd:3.29, method:'Bottle'},
```

Same rules as a beer: `style` needs a colour in `sC`, `origin` needs `FLAGS` +
`CNAMES` (UK split by nation as everywhere else), `method` is one of the four,
and the beer needs a `BRAND_DOMAINS` entry — a shortlist card renders a logo
like anything else. `untappd` is the world's average, from the same source as
`UNTAPPD_GLOBAL_AVGS`.

### `as` — when the shelf name isn't the logged name

Crossing off is done by name, through `wtNorm()` in `src/lib/insights.ts`: case, accents,
apostrophes and punctuation are flattened, and what's left has to match word for
word. That is deliberately strict — a looser rule would let *Peroni Original*
cross off *Peroni Nastro Azzurro*.

When a beer really is logged under a different name, say so — `as` in the
log, which the projection carries into the rows as `aka`:

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


## Location Rule: City, Region, Country

A place is written one way everywhere: **City, State/Region, Country** —
"New Rochelle, New York, United States". Not "City, Country" in one place and
"City, Region" with the country on its own line in the next.

The helper is `placeLabel(row)` in `src/lib/place.ts` — plain text; the caller
adds the flag. Do not inline it again. It drops a part the row doesn't have
rather than leaving a dangling comma. A city and its region can share a name
by coincidence rather than identity — New York City sits in New York State,
Antwerp the city in Antwerp the province — so it never collapses a region that
repeats its city: "New York, New York, United States" and "Antwerp, Antwerp,
Belgium" are both printed in full, because dropping the second one made
"New York, USA" read as the state rather than the city that was actually drunk
in.

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
`npm run check` runs, and the popup staying open is proved in a browser by
`npm run smoke`, which clicks a pin and checks the popup is still there —
see "Features that must survive every pass" above.


Leaflet's `bindPopup` parses HTML, so every data value written into a popup
goes through the `esc()` at the top of `src/routes/map.tsx`. Everywhere else
React escapes for you.

## Ranking Rule: Minimum Sample Size (`MIN_N`)

A group needs **at least `MIN_N` reviews (currently 3)** before its average is
allowed to win or lose a ranking. Without this, a country visited once tops the
table on a single generous pour, and a style tried once becomes "my weakest".

`MIN_N` and its helpers live at the top of `src/lib/insights.ts`:

| Helper | What it does |
|--------|--------------|
| `MIN_N` | The threshold. **The only place the number is written.** |
| `thin(n)` | `true` when a count is below the threshold |
| `rankBy(a, b)` | Sort comparator: qualified groups first (best average first), thin ones after |
| `rankable(groups)` | The slice that may be called best/worst; falls back to the whole list if nothing qualifies |
| `groupRatings(rows, key, rating)` | Average per key, already ranked |

It decides the order of every style, country, city, language and brewery list
on Insights; which group a headline may call best or worst; whether a seasonal
cell or a taste-profile trait shows a verdict or "need 3"; and, in
`predictRating()`, whether a style or country average counts as signal at all
— below `MIN_N` that term falls back to the global average.

Nothing is hidden or dropped: thin groups still chart, still list and still
count toward the totals — they sort to the tail. Per-beer views (the beers
list, a beer's sheet, "my rating vs the world") are single observations, not
averages, so the rule never touches them. Change the threshold in one place;
captions are generated from the constant, so do not hardcode "3" anywhere.

## Logos

**Every beer's logo is a file in this repo.** `public/logos/`, one per
beer name, named in `BRAND_LOGOS` in the log and carried into the `logo`
field of the `brand_domains` rows. That is where a logo comes from: the same picture on
every render, working offline, and nobody else's to withdraw. (They used to be
fetched at page load, until Brandfetch began refusing the public client ID and
97 of 101 beers rendered Google's default grey globe for a month.)

### The chain

**committed `logos/` file → Google favicons (256) → Icon Horse → DuckDuckGo → monogram**

`beerLogoSources()` in `src/lib/logos.ts` builds it and `BeerLogo` walks it.
The first tier answers for every beer that has been fetched, so the rest is
what happens to a beer whose logo has not been fetched yet. Tiered by
*source*, not by domain: every domain a beer lists is tried at each tier before
dropping to the next.

Two details in those URLs are load-bearing. Google serves favicons at 16, 32,
64, 128 and 256; asked for a size it does not serve it answers the 16px default
rather than failing, so `sz=512` looked like a working tier while returning a
globe — don't raise it. And Brandfetch is *gone*, not merely deprioritised:
leaving it in costs a failed request per logo and buys nothing.

### Getting a logo

```sh
npm run fetch-logos                        # everything with no file yet
npm run fetch-logos -- --force --only "Sol"
npm run fetch-logos -- --data-only         # just re-point the log at logos/
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
| `npm run logo-sheet` | after any fetch | whether the file is the brand's logo at all |

`tools/probe-logo-sources.mjs` is the tool for the next time a whole tier goes
quiet: it asks every candidate source shape what it actually returns for a real
brand domain — status, type, bytes, pixel size — which is how the 403 and the
`sz=512` default were found.

## Design

The app's theme lives in `src/styles.css` as CSS variables (`--background`,
`--card`, `--primary`, `--muted-foreground`, `--chart-1`…`--chart-5`, …) and
reaches components through Tailwind (`bg-card`, `text-primary`). Use the
tokens; do not hardcode a colour in a component. The one exception is the
categorical style palette, `STYLE_COLORS` in `src/lib/style-colors.ts` — every
`style` in the log needs an entry there, and `npm run check` fails without one.
Type is Manrope for text and Sora for display (`font-display`).

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


## History

**Why there is no database.** Carrying the log (then `data.js`) into a
Supabase database meant a generated migration, applying a migration was the
host's step rather than this repo's, and it stopped happening — silently, from 2 September, across
three merges, while every check stayed green. Every surface read the database
and let it win, so a beer that had been added, checked, committed and merged
appeared for one frame and then vanished, or never appeared at all. Every check
was asking whether the file was right, and the file was right. The database,
its 22 migrations, the migration generator, the live-sync verifier, the nightly
sync and the client are all gone: what is committed is what is shown.

**Why there is no generated snapshot.** The log used to be
`public/stats/data.js`, a plain script the stats site loaded with a `<script>`
tag; the app could not import a file out of `public/`, so `npm run snapshot`
projected it into a committed `src/data/snapshot.json`, and a round-trip check
failed when the two disagreed. A forgotten `npm run snapshot` was the one way
left for the app to show the log as it stood before an edit. Once the stats
site was gone the log could move into `src/` as a typed module, and the copy,
the command and the check went with it.

**Why there is no stats site.** `public/stats/` was a second, dependency-free
rendering of the same log — charts, maps, a passport — with its own copy of the
location format, the date label, the logo chain, `MIN_N` and the prediction,
kept in step with the app by tests that compared the two. Every rule written
twice was a rule that could disagree with itself. The app had grown to cover
it, so the site was deleted and the tests now pin the app's one copy.
