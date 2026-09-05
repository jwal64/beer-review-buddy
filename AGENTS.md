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

Three things in this project must survive every editing pass — two features
already reverted twice by a pass that never set out to change them, and the
check that catches a third kind of loss. **They are intentional, they are
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
then never applied to Supabase. That failure is otherwise completely silent:
`public/stats/live-data.js` replaces the committed snapshot with the database's
version on load, so a beer whose migration never ran appears for a moment and
then disappears, and the app never shows it at all. It has happened, for days,
with every other check green.

A pass that has already deleted an applied migration file can delete the thing
that notices. This is the one check whose absence restores exactly the silence
it was built to end.

`CLAUDE.md`, "Step 6: Verifying the database actually got it", has the detail.

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
