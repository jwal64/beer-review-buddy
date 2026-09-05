# logos/

Every beer's logo, one file per beer name. This directory is not an override
mechanism any more — it is where logos live.

A beer's file is named in `BRAND_LOGOS` in `../data.js`, and behind that in the
`logo` column of the `brand_domains` table. `npm run check` fails on a beer that
has neither.

## Why they are here rather than fetched

They used to be fetched at page load from Brandfetch, then Google, then Icon
Horse. Brandfetch began answering 403 to the public client ID the site
embedded — every domain, every URL shape — so the first tier resolved nothing,
and 97 of 101 beers fell through to Google's *default* 16px favicon. The site
rendered a hundred identical grey globes for a month. Nothing in the repo had
changed, and nothing in it could have noticed.

A file we hold cannot be withdrawn by the service that was lending it. The
remote chain is still there, as the fallback for a beer added through the app's
form before anyone has fetched its logo.

## Getting one

```sh
npm run fetch-logos                        # everything with no file yet
npm run fetch-logos -- --force --only "Sol"
npm run logo-sheet                         # then look at the result
```

`tools/fetch-logos.mjs` takes the first tier that answers for the beer's brand
domains: the icons the site declares, then the logo drawn in its header, then
the favicon services, then a square-ish `og:image`. Rasters land as WebP at the
image's own longest edge, capped at 256px; SVG is written through untouched.

## Putting one here by hand

For a brand no source has, save the file yourself — any format a browser
renders (`.svg`, `.png`, `.webp`, `.jpg`) — as `<beer-name-slugified>.<ext>`,
and add its entry to `BRAND_LOGOS`. `logos/daura.svg` is the worked example.

Nine files are here that way, and every one of them is a **drawn approximation
in the house idiom** — a brand-coloured field, the wordmark, one characteristic
device — not the brand's own artwork:

`affligem-tripel` · `almaza-pilsener` · `daura` · `mahou-cinco-estrellas` ·
`mythos` · `newcastle-brown-ale` · `pacifico-clara` · `singha` · `smithwicks`

They exist because the fetcher walked every tier for those nine brands and
came back with nothing: dead or unreachable brand sites, no `P154` logo on
Wikidata, and Icon Horse answering four of them with a generated grey capital,
which the fetcher now refuses. `logo-fetch-report.json` records each ladder in
full under `missing`. If one of those brands ever publishes a reachable logo,
these are the files to replace — delete the file *and* its `BRAND_LOGOS` line,
then re-fetch, since the fetcher will not overwrite a file it did not write.

`amstel-light.webp` is hand-placed too, but it is not a drawing: it is the
brand's own roundel, cut from the owner's Untappd check-in screenshot at the
tile's own 150px and masked to the tile's rounded corners. Every fetcher tier
for `amstellight.com` and `amstel.com` answered 403 from the session that
added it, so there was no ladder to walk. Note that it is the **Amstel Bier**
roundel — the marketed mark for the light variant is not what the check-in
carried — so it is a fair candidate to replace if a session ever reaches those
domains and finds an Amstel Light mark of its own.

**A file the fetcher did not write is never replaced**, `--force` included: it
knows which files are its own from `logo-fetch-report.json`, and leaves the
rest alone.

## What to check before trusting one

`npm run logo-sheet` draws every logo on a half-light, half-dark tile. Look at
it. Nothing automated can tell a brand's mark from a photograph of a bottle or
from a generated grey letter — all three load, are the right size, and pass
every check there is.
