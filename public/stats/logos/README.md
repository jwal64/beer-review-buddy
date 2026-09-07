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

Thirteen files are here that way, and every one of them is a **drawn
approximation in the house idiom** — a brand-coloured field, the wordmark, one
characteristic device — not the brand's own artwork:

`augustiner-helles` · `estrella-jalisco` · `guinness-draught` ·
`hop-commander` · `daura` · `newcastle-brown-ale` · `pacifico-clara` ·
`pilsner-urquell` · `pub-ale` · `singha` · `smithwicks` · `sol` ·
`stiegl-goldbrau`

Five of them — `daura`, `newcastle-brown-ale`, `pacifico-clara`, `singha` and
`smithwicks` — exist because the fetcher walked every tier for those brands and
came back with nothing: dead or unreachable brand sites, no `P154` logo on
Wikidata, and Icon Horse answering four of them with a generated grey capital,
which the fetcher now refuses. `logo-fetch-report.json` records each ladder in
full under `missing`. If one of those brands ever publishes a reachable logo,
these are the files to replace — delete the file *and* its `BRAND_LOGOS` line,
then re-fetch, since the fetcher will not overwrite a file it did not write.

## Five drawings that became the real thing

`affligem-tripel` · `almaza-pilsener` · `magna` · `mahou-cinco-estrellas` ·
`mythos` were all on the list above, all recorded as brands whose ladder came
back empty. Four of them had never been walked down the right road: the domain
in `BRAND_DOMAINS` was not the brand's.

| Beer | was | is | what answered |
|------|-----|----|---------------|
| Affligem Tripel | `affligembeer.be` | `affligembeer.com` | site header logo, SVG |
| Almaza Pilsener | `almaza.com` | `almaza.com.lb` | site `og:image` |
| Mahou Cinco Estrellas | `mahou.es` | `mahou.com` | site `rel="icon"`, 192px |
| Mythos | `mythosbrewery.gr` | `mythosbeer.gr` | site header logo |

`almaza.com` was dropped rather than kept as a fallback: it is not the
brewery's, and a logo from whoever does own it is exactly the confidently-wrong
answer this file keeps warning about.

**Magna is the one worth reading twice.** Its domain was right all along, and
it still came back with the WordPress logo — the same CMS default recorded
further down this file, fetched again, years later, by a run that was supposed
to fix it. `cerveceradepr.com` declares no icon, and its header mark is the
brewery's rather than any one beer's, so the ladder fell through to the favicon
services, and what Google holds for a WordPress site with no icon of its own is
WordPress's.

That is what the **brand page image** tier in `tools/fetch-logos.mjs` is for. A
brewery that makes several beers keeps each beer's mark on that beer's page, so
the fetcher now follows the site's own links to a page naming the beer — and
tries `/magna/`, `/marcas/magna/` and the rest directly, because
`cerveceradepr.com` answers its bare domain with a splash that carries no links
at all. Magna's file is now `Magna-01.png` from the brewery's own uploads: the
crowned lion, the wordmark, the *Premium Lager* ribbon.

The tier ranks with the site's declared icons and above the header, and it
refuses JPEGs exactly as the header and `og:image` tiers do. It is the general
answer to a specific shape of wrong: **a brewery's own domain is not the same
thing as a beer's own mark**, and a favicon service asked about a multi-brand
site will answer confidently about the wrong one — or about its CMS.

The other eight were added later, when a pass over the whole contact sheet found
each of them rendering something that was not the brand's mark. What was there
before, and why the answer had to be a drawing:

| Beer | What the file held | Why |
|------|--------------------|-----|
| `augustiner-helles` | a 179-byte SVG wrapper | `<use xlink:href="#icon-logo">` — the artwork is a sprite symbol on the brand's page, and does not travel with the file |
| `pilsner-urquell` | a 222-byte SVG wrapper | the same, `#shape-logo-pilsner` |
| `stiegl-goldbrau` | a valid 300×300 WebP | **every pixel of it transparent.** The worst kind: it decodes, so the `onerror` chain never fires and no fallback is tried |
| `pub-ale` | a 112-byte blue dot | DuckDuckGo's generic answer for `boddingtons.co.uk`, not the barrel-and-bee |
| `sol` | a blue-violet chevron | Google's favicon for `solbeer.com`; Sol's mark is a red-and-yellow sun |
| `guinness-draught` | a 375 KB photograph | Wikidata `P154` answered with a **photo of the St James's Gate facade** |
| `hop-commander` | a 1536×415 photograph | the "site header logo" tier took a dark brewery interior shot |
| `estrella-jalisco` | the real wordmark, 256×22 | correct artwork, unusable shape: `object-fit:contain` letterboxes it into a ~24×2px hairline in the 24px inline box |

Two of those are failure shapes the sheet had not caught before, and both are
worth recognising because **no check catches them**: an SVG whose artwork lives
in a sprite the file does not carry, and a file that is entirely transparent.
The first at least fails to decode and falls down the remote chain; the second
renders as nothing, forever, while passing every check there is.

The session that drew these could not have fetched anything either — the same
egress wall as before, and wider: every brand site, both Wikimedia hosts, and
all three favicon services answered `403` at `CONNECT`. `npm run fetch-logos`
is the right tool the moment a session can reach them again.

Four more beers were wrong for the **opposite** reason — the fetcher answered
for these, and answered *wrong*:

`budweiser` · `modelo-especial` · `modelo-oro` · `negra-modelo`

All four carry the brand's own artwork now (below), so none of them is a
drawing any more. They stay listed under `kept` in `logo-fetch-report.json`
rather than `fetched`, which is what stops the fetcher overwriting them — so
the two bad ladders no longer survive in that file, and this is the record of
them:

- **The three Modelos** all resolved to `site header logo` on their shared
  domain `modelousa.com`, and what that header held was
  `cdn/shop/files/97898_EWH_009_08.jpg` — a 330×413 storefront **photograph of
  a man in a room**. One domain for three beers meant one identical photo for
  three beers. The fetcher refuses photographs now (`clear < 0.02 &&
  colours > 1200`), so this particular answer cannot come back. All three carry
  the supplied Modelo crest now. Note what that shared domain still means: no
  source here has a separate mark for Negra Modelo or Modelo Oro, so the three
  share one picture by decision rather than by accident — see below.
- **Budweiser** resolved to `wikidata P154` for `budweiser.com` and came back
  with `Budejovicky_Budvar_logo.png` — the mark of **Budějovický Budvar**, the
  Czech brewery, on a beer this repo records as `origin:"US"`, brewed by
  Anheuser-Busch in St. Louis. "Budweiser" is Budvar's trademark across much of
  Europe, so the two brands genuinely collide on Wikidata. `budweiser.webp` is
  Anheuser-Busch's bowtie now, so the site is correct — but **the trap is still
  live:** deleting that file and re-fetching is likely to put the Czech logo
  straight back. Leave the hand-placed file unless you have checked by eye that
  what replaces it is the bowtie.

The sessions that drew the stand-ins could not have fetched anything anyway —
their egress policy denied every logo source (the brand sites, Wikimedia,
Google, Icon Horse and DuckDuckGo all refused `CONNECT`), which is its own
reason a drawing was the only way to get a correct logo into the tree at the
time. The drawings are in this branch's history if one is ever wanted back.

Five files are hand-placed but are **the brands' own artwork**, supplied by the
owner rather than drawn or fetched:

- `modelo-especial.webp` — the Modelo crest, replacing the storefront
  photograph above. The crest is navy on transparent, drawn for a light label,
  and on this site's charcoal ground the wordmark disappeared while only the
  gold lions read, so it is masked onto a white tile with the corner radius the
  other tiles use. That is presentation, not redrawing: the mark itself is
  untouched.
- `harp-lager.webp` — the Harp badge, replacing an `icon.horse` answer that was
  a generic blue-and-white glyph, not Harp's mark at all. Its white surround is
  flooded out from the border, so the badge sits on the ground like every other
  logo while the white *inside* the badge stays part of the mark.
- `budweiser.webp` — the bowtie, replacing the drawn stand-in that replaced
  Budvar's mark. Same border-only flood as Harp, which is what keeps the white
  script inside the bowtie; red on charcoal needs no tile behind it.
- `negra-modelo.webp` and `modelo-oro.webp` — **byte-identical copies of
  `modelo-especial.webp`**, at the owner's instruction, because no source has a
  separate mark for either beer. Know what this costs: the crest carries the
  *Especial* script, so both beers display a mark naming a different product.
  That was a deliberate trade against the drawings they replaced. If a distinct
  Negra Modelo or Modelo Oro mark ever turns up, these are the two files to
  replace.

  They are separate files rather than three `BRAND_LOGOS` entries pointing at
  one path, and that is load-bearing: `fetch-logos` finds a beer's file by
  `slug(name)`, so a beer with no `<slug>.<ext>` of its own reads as having no
  file at all — it would be queued for fetching, and `--data-only` would
  rewrite `BRAND_LOGOS` from what is on disk and drop the shared entry. The two
  Peronis already duplicate one mark the same way.

`amstel-light.webp` is hand-placed too, but it is not a drawing: it is the
brand's own roundel, cut from the owner's Untappd check-in screenshot at the
tile's own 150px and masked to the tile's rounded corners. Every fetcher tier
for `amstellight.com` and `amstel.com` answered 403 from the session that
added it, so there was no ladder to walk. Note that it is the **Amstel Bier**
roundel — the marketed mark for the light variant is not what the check-in
carried — so it is a fair candidate to replace if a session ever reaches those
domains and finds an Amstel Light mark of its own.

## Marks that were right, and still did not render

A logo can be the brand's own artwork, decode perfectly, be the right size, and
still show the reader nothing. Five files were drawn for a light label — dark
ink on transparent — and this site's ground is `--bg: #0f0f11`. Composited
there they measured **0–1.7% readable**: `leffe-blonde` (near-black),
`wrench` (black), `la-fin-du-monde` (Unibroue's navy `U`),
`ringnes` (dark green) and `bloodline-blood-orange-ipa` (Flying Dog's black
wings).

All five now sit on a **white rounded tile**, which is exactly what
`modelo-especial.webp` and `amstel-light.webp` already do, for the same reason.
It is presentation, not redrawing: the mark is trimmed to its own bounding box
and centred with a 10% margin, at a corner radius of ⅙ the side — matching
`.beer-logo-inline`'s 4px on 24px — and is never recoloured or cropped. The
tile follows the source's own resolution rather than always hitting 256px,
because upscaling a 48px icon only softens it (`la-fin-du-monde` is 96×96). All
five now read at **77–97%**.

Reach for the tile only when the mark genuinely disappears. `harp-lager` and
`budweiser` are hand-placed and need no tile — red and gold read on charcoal
perfectly well, and a tile behind them would be noise.

## Two beers wearing their parent brand's mark

`grolsch-puur-weizen` and `frisse-lentebok` both had grolsch.com's 144×144
apple-touch-icon, which is the Grolsch wordmark **cropped to "Gro"** — and in
dark green, so unreadable on the ground as well as truncated. Both are now
byte-identical copies of `grolsch.webp`, the full wordmark with the red seal.

Same trade as the two Modelos, and the same reason they are separate files
rather than three `BRAND_LOGOS` entries pointing at one path: `fetch-logos`
finds a beer's file by `slug(name)`, so a beer with no `<slug>.<ext>` of its
own reads as having no file at all.

## One repair rather than a replacement

`tennents.svg` carried Tennent's real artwork all along and still would not
decode: the fetcher wrote `<use xlink:href="…">` without ever declaring
`xmlns:xlink`, which is a fatal XML error when an SVG is loaded as an `<img>`
source rather than inlined. Adding the one namespace declaration was the whole
fix. Worth trying first on any SVG here that renders as a broken image —
`augustiner-helles` and `pilsner-urquell` were checked the same way and were
genuinely empty, which is what sent them to the drawing pile.

## Four that look odd and are staying

`zywiec` (a red `Ż`), `michelob-ultra` (a bare red ribbon), `ocean-sju` (a black
porthole ring) and `big-wave-golden-ale` (a 48px teal hibiscus) all read as
thin answers, and all four are **the brand's own site favicon**, fetched from
the brand's own domain. `zywiec.svg` in particular is a hand-authored path in
Żywiec's brand red `#E4002B` — not one of the generated grey capitals the
fetcher now refuses.

They are the brands' digital marks rather than their label art, which is a real
limitation but not a wrong answer. Replacing a brand's own icon with someone's
drawing of what the label looks like would be the confidently-wrong trade this
file keeps warning about, so they stay.

**A file the fetcher did not write is never replaced**, `--force` included: it
knows which files are its own from `logo-fetch-report.json`, and leaves the
rest alone. Everything described above is recorded under `kept` there, which is
what makes that true — **if you hand-place or hand-edit a file, add it to
`kept`**, or the next `fetch-logos` run will overwrite the work.

## What to check before trusting one

`npm run logo-sheet` draws every logo on a half-light, half-dark tile. Look at
it. Nothing automated can tell a brand's mark from a photograph of a bottle or
from a generated grey letter — all three load, are the right size, and pass
every check there is.
