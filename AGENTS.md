<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Do not revert these features

Four things in this project must survive every editing pass — two features
already reverted twice by a pass that never set out to change them, the check
that catches a third kind of loss, and the merge that makes a newly added beer
visible at all. **They are intentional, they are
finished, and no pass may remove, inline, simplify or "harden" them away.**
Read this list before editing any of the files it names.

### 1. The map pop-out stays open

Clicking a dot on the app's map opens its popup and it stays open.

- `selectBrandDomains` and `selectBrandLogos` in `src/lib/beer-data.ts` **must
  stay declared at module scope.** They look like they belong inline inside
  `useBrandDomains` / `useBrandLogos`. They do not. React Query memoises a
  `select`'s result on the select function's *identity*, so an inline arrow is
  a new function every render, which rebuilds the `Map` every render, which
  redraws the map's pins on every click, and `clearLayers()` closes the popup
  the click just opened. Moving them inline is not a tidy-up; it is the bug.
- `src/routes/map.tsx` keeps `beerRows(..., withBrewery)` — the city popup
  names each beer's brewery — and keeps `title` alongside `label` on the map
  filter, so the heading can read "Leuven, Flemish Brabant, Belgium" while the
  rows still match on the bare city.

### 2. One location format everywhere: City, Region, Country

A place is written "New Rochelle, New York, United States" on every surface.

- **`src/lib/place.ts` must exist** and export `placeLabel`. Do not delete it,
  and do not inline it back into its callers: `src/routes/map.tsx`,
  `src/routes/beers.tsx`, `src/routes/index.tsx`, `src/components/BeerForm.tsx`.
- **`public/stats/app.js` must keep its `placeLabel` helper** and its call
  sites. It returns escaped HTML and takes `{flag, lead}`.
- The beers table's separate City / Region / Country **columns** are the one
  deliberate exception and stay split.

### 3. The live-data check stays wired up

`.github/workflows/verify-live.yml`, `tools/verify-live.mjs` and
`tools/verify-live-test.mjs` — and the `verify-live-test.mjs` entry in the
`check` script in `package.json`. Do not delete, rename, disable or unwire any
of them.

They are the only thing that notices when a migration is merged to `main` and
then never applied to Supabase. It has happened, for days, with every other
check green.

A pass that has already deleted an applied migration file can delete the thing
that notices. This is the one check whose absence restores exactly the silence
it was built to end.

`CLAUDE.md`, "Step 6", has the detail.

### 4. The snapshot merge — how a beer is visible at all

Four things, and all four are load-bearing:

- **`mergeRows()` in `public/stats/supabase-rows.mjs`** — the rule.
- **the `mergeRows(` call in `public/stats/live-data.js`** — the stats page.
- **`withSnapshot()` in `src/lib/snapshot.ts`**, and **its use in
  `src/lib/beer-data.ts`** — the app. `src/data/snapshot.json` is generated
  (`npm run snapshot`); do not hand-edit it, and do not delete it.

A beer is added by editing `public/stats/data.js`. Carrying that into Supabase
is a migration, and applying a migration is **not** something this repo can
do — it did not happen for days at a time, across three merges, while every
check stayed green.

So both surfaces merge the database *into* the committed snapshot instead of
replacing the snapshot with it: on a row both have the file wins, a row only
the database has is added, and **a row only the file has is kept**. That last
one is the entire point. Before it, the stats page painted a newly added beer
and then replaced it with the database's answer — it appeared for one frame
and vanished — and the app, which reads Supabase and nothing else, never had
it at all.

Reverting any part of this to "just use what the database returns" looks like
a simplification and is the bug coming back. `tools/merge-rows-test.mjs` pins
it, including that the key map — written once in `.mjs` and once in TypeScript,
because `src/` cannot import out of `public/` — still says the same thing in
both places.

The repo's three tests — `tools/verify-live-test.mjs`,
`tools/merge-rows-test.mjs` and `tools/app-logic-test.mjs`, the last covering
the rules inside `public/stats/app.js` — are plain Node, need nothing installed and run in
milliseconds. Each is named in the `check` script **and** has a step in
`.github/workflows/checks.yml`, and `check-invariants.mjs` fails when a tool
appears in one and not the other. That is not hypothetical tidiness: the
live-data test was named in the check script, documented as running on every
push, and run by nothing in CI.

### How these keep getting lost — and how to stop

Nobody deleted them on purpose. The pass branched from a commit older than the
merge that added them, and then resolved its merge back into `main` in favour
of its own copy of every file it had touched. `src/lib/place.ts` vanished, the
hoisted selects folded back inline, and the section of `CLAUDE.md` documenting
both was dropped — inside a merge commit whose subject was an unrelated
"Hardened map & insights". The same merge also deleted an already-applied
migration, `supabase/migrations/20260903121905_drop_redundant_logo_constraint.sql`.

So, on every pass:

1. **Start from the current `main`**, not from whatever commit the last pass
   began at. Fetch and merge before editing.
2. **When a merge asks which side of a file to keep, keep the side that has
   these features.** A change you did not intend to make is not yours to
   resolve — if you did not set out to remove `placeLabel`, don't.
3. **Never delete a file in `supabase/migrations/`.** An applied migration is
   history; removing the file desynchronises the migration record. Schema
   changes are new files only.
4. **Run `npm run check` before pushing.** It runs
   `node tools/check-invariants.mjs`, which fails when any of the three is
   missing. A red check here means a revert, not a flaky test — restore what
   it names instead of changing the check.

`CLAUDE.md` carries the full reasoning under "Features that must survive every
pass", "Map Rule: The Pop-out Stays Open", "Location Rule: City, Region,
Country" and "Step 6: Verifying the database actually got it".
