# Finish the real-logo pass

Ten beers still show a drawn stand-in instead of the brand's own artwork, and three beers point at logo images hosted on other people's websites. This finishes both.

## What you'll see afterwards

- Every beer on Home, Beers, the map and the stats page shows the brand's genuine logo.
- No logo is loaded from an outside website any more, so none of them can break when someone else changes their site.

## 1. Stop borrowing three logos from other sites

Three beers currently point at images hosted elsewhere:

- Dos Equis Lager Especial — a WordPress blog
- Estrella Jalisco — a beer shop's site
- Pacífico Clara — Wikipedia

All three now have a genuine file saved in the project, so these three pointers get cleared and the saved files take over.

## 2. Replace the ten drawn stand-ins with official artwork

Current status of each brand's own website, checked just now:

| Beer | Source to use |
|---|---|
| Affligem Tripel | affligem.be responds — fetch from there |
| Singha | singha.com and boonrawd.co.th respond — fetch |
| Amstel | amstel.com responds — fetch (never fetched; no network last time) |
| Daura | estrelladamm.com responds — fetch |
| Mahou Cinco Estrellas | mahou.es responds — fetch |
| Pacífico Clara | already replaced with the official mark |
| Almaza Pilsener | site refuses connections — needs an official alternative source |
| Mythos | old site is gone — needs an official alternative source |
| Newcastle Brown Ale | old sites are gone — needs an official alternative source |
| Smithwick's | old sites are gone — needs an official alternative source |

For the five reachable ones, the existing logo fetcher is pointed at the working address and run per brand. For the four dead ones, each brand's current official presence is researched individually (current owner's brand page, official press/media kit, Wikimedia's official-artwork entry) and the artwork saved by hand. Anything that can't be sourced officially keeps its current drawn stand-in rather than getting a wrong or unofficial image.

## 3. Look at every logo before finishing

The whole set is rendered onto one sheet and reviewed by eye — that's the only way to catch a bottle photograph or a generated grey letter, since those pass every automatic check.

## Technical notes

- Clearing the three borrowed pointers is a `beers.logo` → `null` update, written as a new file in `supabase/migrations/` (never an edit to an applied one). Each brand already has the right `logos/…` path on its `brand_domains` row.
- New artwork is re-encoded to WebP at 256px longest edge, saved under `public/stats/logos/`, and its `BRAND_LOGOS` entry updated in `public/stats/data.js`. The fetcher won't overwrite a file it didn't write, so a stand-in is deleted first.
- `public/stats/logos/README.md` is updated so it lists only the stand-ins that genuinely remain.
- Validation: `npm run check`, `bunx tsgo --noEmit`, `npm run logo-sheet`, plus a browser pass over Home / Beers / Map / Insights at 1280×1800.
- The map pop-out behaviour and the City, Region, Country location format are untouched; `npm run check` runs the invariant guard that protects both.
