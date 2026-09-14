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
data layer that decides whether a newly added beer is visible at all. **They are intentional, they are
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

### 3. The app reads the committed log, not a network

`src/lib/snapshot.ts` (which must export `BEERS` and import
`@/data/snapshot.json`) and `src/lib/beer-data.ts` importing from it. Do not
point either back at a database, a fetch, or an API route.

There is no backend. `public/stats/data.js` is the log; `src/data/snapshot.json`
is that file projected into rows by `npm run snapshot`, because the app is a
Vite bundle and cannot read a file out of `public/`. Both are committed, and
`npm run check` fails when they disagree.

This is not a limitation to route around — it is the fix for the most expensive
bug this project has had. There was a Supabase database; carrying `data.js`
into it meant a generated migration; applying a migration was the host's step
and it silently stopped happening for days at a time across three merges. Both
surfaces read the database and let it win, so a beer that had been added,
checked, committed and merged appeared for one frame and then vanished, or
never appeared at all, with every check green. The database was removed rather
than worked around.

Anything under `supabase/` is the remains of that store and is wired to
nothing. `src/integrations/supabase/` still holds auto-generated files that
nothing imports; leave them or remove them, but do not wire them back up.

The repo's tests — `tools/app-logic-test.mjs` (the rules inside
`public/stats/app.js`) and `tools/roundtrip-snapshot.mjs` (that the projection
loses nothing and the committed snapshot is in step) — are plain Node, need
nothing installed and run in milliseconds. Each is named in the `check` script
**and** has a step in `.github/workflows/checks.yml`, and
`tools/check-invariants.mjs` fails when a tool is in one and not the other.

`CLAUDE.md` carries the full reasoning under "Features that must survive every
pass", "Map Rule: The Pop-out Stays Open", "Location Rule: City, Region,
Country" and "Step 6: There is no step 6".
