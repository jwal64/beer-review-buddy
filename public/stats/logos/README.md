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

They exist because the fetcher walked every tier for those eight brands and
came back with nothing: dead or unreachable brand sites, no `P154` logo on
Wikidata, and Icon Horse answering four of them with a generated grey capital,
which the fetcher now refuses. `logo-fetch-report.json` records each ladder in
full under `missing`. If one of those brands ever publishes a reachable logo,
these are the files to replace — delete the file *and* its `BRAND_LOGOS` line,
then re-fetch, since the fetcher will not overwrite a file it did not write.

**A file the fetcher did not write is never replaced**, `--force` included: it
knows which files are its own from `logo-fetch-report.json`, and leaves the
rest alone.

## What to check before trusting one

`npm run logo-sheet` draws every logo on a half-light, half-dark tile. Look at
it. Nothing automated can tell a brand's mark from a photograph of a bottle or
from a generated grey letter — all three load, are the right size, and pass
every check there is.

## What is still wrong here

Written down because the alternative is that somebody rediscovers each of
these by squinting at the contact sheet. None of them is a bug in the
fetcher — each is a brand whose logo is genuinely not available from any
source the fetcher can reach, and each needs the brand's own artwork saved
here by hand.

**No file at all** — `npm run check` fails on these, which is the point:

| Beer | Why |
|------|-----|
| Modelo Especial | modelousa.com serves a JPEG photograph of a man holding a bottle and calls it the logo; its declared icon is under 48px; no Wikipedia article is this brand (Grupo Modelo is the company, not the beer) and Commons has no file named for it |
| Modelo Oro | the same site, the same three answers |
| Negra Modelo | the same again |

**A file that is not the brand's mark.** These pass the check and render, and
they are wrong. Deleting them would not help — the runtime chain falls back to
the same favicon the file was made from, so the page would show the same
picture and the check would fail as well:

| Beer | What it actually shows | Why |
|------|------------------------|-----|
| Magna | the WordPress logo | cerveceradepr.com is a bare WordPress install and that is its favicon; no measurement catches "this is a CMS default" |
| Sol | a blue arrow | cervezasol.com answers with an icon that belongs to whoever runs the page, not to the beer |
| Pub Ale | a blue dot | boddingtons.co.uk, the same story |
| Estrella Jalisco | a very faint wide wordmark | the only mark on the site is a 584×51 Wix asset, nearly invisible at any size a card draws |

**Drawings, not marks.** Nine files here are approximations somebody drew —
a generic shield with the brewery's name set in Georgia, and so on. They look
like logos and they are not the brand's artwork. They are listed in the
section above; the fetcher leaves them alone, and any of them can be replaced
simply by putting a real file here under the same name.
