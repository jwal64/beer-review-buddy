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

Two files are here that way, and both are **drawn approximations in the
house idiom** — a brand-coloured field, the wordmark, one characteristic
device — not the brand's own artwork:

`augustiner-helles` · `daura`

There were twelve, then four, then five when `killsner` joined them; the
section below this one is where three of those five went. The two left are what
no reachable source has: Augustiner's Bavarian brewery mark, and Daura, whose
own mark exists nowhere but Damm's site. If either brand ever publishes a
reachable logo, that is the file to replace — delete it *and* its
`BRAND_LOGOS` line, then re-fetch, since the fetcher will not overwrite a file
it did not write.

Daura is the one to think twice about. Estrella Damm's own label *is* reachable
and is already in the tree as `estrella-damm.svg`, so copying it onto Daura the
way `grolsch-puur-weizen` copies `grolsch` was available and was **not** taken:
the drawing at least says "Daura", and a mark that names a different beer is
not an improvement on one that names the right one. That is the opposite call
to the two Modelos below, and deliberately — there the drawing named the right
beer *badly*, here it names it plainly.

## Marks from Untappd's own bucket

`hop-commander` · `killsner` · `big-wave-golden-ale`

The first two were drawings — a cartoon hop on navy, two wavy lines on
green, each with its name typed underneath — and Big Wave was Kona's 48px
teal hibiscus favicon. Stiegl came through here too, and left again; see
below.

Every brand site, every favicon service and Wikimedia still answer `403` at
`CONNECT` here. But the files Untappd serves from `assets.untappd.com` sit in
a public S3 bucket, and `untappd.s3.amazonaws.com` **is** reachable. Its
listing is denied, so a file has to be asked for by its exact key —
`site/beer_logos/beer-<bid>_<hash>_sm.jpeg` for a beer's label,
`site/brewery_logos/brewery-<id>_<hash>.jpeg` for a brewery's — and the hash
is not derivable: it comes from the beer's own Untappd page. A wrong key
answers `403` and a right one `200`, so there is no guessing a file into the
tree by accident. Only the `_sm` size (100×100) exists for these; the page
never draws a logo taller than 64px, so that is enough.

| Beer | key | what it is |
|------|-----|------------|
| Hop Commander | `beer_logos/beer-871255_7b1a9_sm.jpeg` | the green `HOP COMMANDER` wordmark from the can |
| Killsner | `brewery_logos/brewery-277977_93f5e.jpeg` | Kills Boro's own mark, the hand-lettered `KILLS BORO` in its black splash |
| Big Wave Golden Ale | `brewery_logos/brewery-konabrewingcompany_1988.jpeg` | Kona's roundel: `KONA` over the orange gecko, `BREWING CO.`, `Liquid Aloha · Hawaii` |

**Killsner is the one with a caveat.** Several searches named a label key for
it, `beer-4183963_1e922`, and the bucket answers `403` to every extension and
size of it — no label is stored under that key, and none was found under any
other. What the Untappd pages that do list Killsner carry is the brewery's
mark, so that is the file: the brewery's own artwork instead of a drawing of
a can, the same trade `bloodline-blood-orange-ipa` makes with Flying Dog's
wings. If a Killsner label ever turns up, this is the file to replace. Big
Wave is the same trade: no label key for `beer-9657` turned up, so it wears
Kona's own roundel.

**Stiegl is the brand's own badge, not Untappd's label.** The Goldbräu label
from this bucket (`beer_logos/beer-5539_7ca11_sm.jpeg`) was here briefly and
was not good enough: a 100px JPEG of a tilted shield, soft at every size the
page draws. The real mark had been in the tree once already. On 2 September
the fetcher took a 300×300 `Salzburger Stiegl` badge from `stiegl.at` (the
red script and staircase on a white shield, transparent around it), and the
next re-fetch replaced it with the fully transparent WebP recorded below.
That file is still in the history (`public/stats/logos/stiegl-goldbrau.webp`
at `6a32035`, blob `26d8ca4`), and `stiegl-goldbrau.webp` is it again, scaled
to the fetcher's 256px cap. Untappd's brewery logo for Stiegl
(`brewery_logos/brewery-1202_5af88.jpeg`) is the same badge at 100px.

What was done to each, all presentation rather than redrawing:

- **Hop Commander** had Untappd's white ground flooded out from the border,
  the same way `harp-lager` was, so the wordmark sits on the page's own
  ground. It reads on charcoal as it is.
- **Killsner and Big Wave sit on white rounded tiles**, like
  `modelo-especial.webp`. Kills Boro's mark is a black splash and Kona's is
  dark brown, and both vanish on `--bg`; the white ground is what they were
  drawn against.

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

## Eight drawings replaced by the real marks

The egress wall never lifted. Every brand domain, Google, Icon Horse,
DuckDuckGo and both Wikimedia hosts still answer `403` at `CONNECT`, so
`npm run fetch-logos` still resolves nothing here — but that is a statement
about *those hosts*, not about the session. Anonymous git reads of public
GitHub repositories are served, and `detain/svg-logos` is 120,484 brand SVGs
traced from vector originals. Eight of the twelve drawings had a real mark
sitting in it:

| Beer | file | what it is now |
|------|------|----------------|
| Guinness Draught | `guinness-draught.svg` | the gold harp over `GUINNESS` / `DRAUGHT` — the beer's own lockup, not the company's |
| Newcastle Brown Ale | `newcastle-brown-ale.webp` | the blue-star label, "The One and Only" band and all |
| Singha | `singha.svg` | the lion in its roundel over the `PREMIUM BEER` ribbon |
| Smithwick's | `smithwicks.svg` | the green plate, castle and red bar |
| Pacífico Clara | `pacifico-clara.svg` | `CERVEZA PACIFICO CLARA` in the gold wordmark |
| Estrella Jalisco | `estrella-jalisco.svg` | the red star badge and `La Cerveza Tapatía` |
| Sol | `sol.svg` | the ornate red-and-gold `Sol` script |
| Pub Ale | `pub-ale.svg` | Boddingtons' barrel-in-an-arch |

Three more files were not drawings but were wrong anyway, and are the brands'
artwork now for the same reason:

| Beer | was | is |
|------|-----|----|
| Michelob Ultra | a bare red ribbon — the brand's favicon, and nothing of the mark | the eagle crest over the `Michelob ULTRA` lockup |
| Żywiec | a 407-byte red `Ż` | the full crest: the two dancers, the 1856 shield, the `ŻYWIEC` ribbon |
| Negra Modelo | a byte copy of `modelo-especial.webp`, so it wore the *Especial* script | the gold `NEGRA MODELO` banner and `LA CREMA DE LA CERVEZA` |

Negra Modelo is worth noting twice: it is the first of the three Modelos to get
a mark of its own, so the warning above it — that the crest names a different
product — now applies only to `modelo-oro.webp`.

**It is not the banner any more.** The owner supplied the mark they want: the
current Negra label, `CERVEZA` / `Modelo` in the white serif between the two
gold lions, the `1925` ribbon, and `Negra` in white script underneath, on
black. It went through two wrong answers first, and both are worth knowing:

- the gold `NEGRA MODELO` ribbon above, from `detain/svg-logos` — Negra's
  older mark, not the one the owner drinks;
- Untappd's own copy of the right label (`beer_logos/beer-5852_694d6_sm.jpeg`),
  which is the right artwork at only 100px, soft enough that the `Negra`
  script barely reads.

`negra-modelo.webp` is the supplied 1200×630 image cropped to its artwork,
centred on its own black ground with a 6% margin, scaled to the fetcher's
256px cap and given the tiles' ⅙-side corner radius. The black is the
label's own ground rather than a tile added behind it, and it is kept rather
than flooded out: the faint brewery watermark behind `Modelo` would survive
as a grey ghost, and the thin script with it.

**Two things were done to every file taken from that collection**, and both are
presentation rather than redrawing:

- **The plate comes off.** Every file in it sits on one 192.756 square canvas
  whose first path is an opaque full-bleed rectangle — white for eleven of
  them, black for Guinness. Left in, each logo would have arrived here as a
  solid square on a site whose other ninety are transparent. The plate is the
  file's packaging, not the mark, and it is the *first* path in the document,
  so it lifts out cleanly: `d="M0 0h192.756v192.756H0V0z"`.
- **The heavy three are rasters.** `.bc-logo` never draws a logo taller than
  64px, so Newcastle's 168 KB vector, Michelob's 143 KB and Żywiec's 75 KB are
  stored as WebP at the fetcher's own 256px cap instead — 22, 15 and 25 KB, at
  four times the resolution the page can use. The other eight stayed vector;
  they were small enough that the question never arose.

**Where the caveats are.** Two of the eight carry a real mark that names a
sibling product, the same trade the Modelos record below:

- **Pub Ale** wears the Boddingtons arch, which reads `BITTER`. The arch and
  the barrel are the brand's mark across the range; `BITTER` is the variant
  inside it. The drawing it replaced said `PUB ALE` correctly and was a drawing.
- **Guinness Draught** is exactly right, and is the one to *not* re-fetch
  casually: `guinness.com` answered Wikidata `P154` with a photograph of the
  St James's Gate facade once already.

A third caveat is about the ground rather than the mark: Guinness's wordmark is
white and Estrella Jalisco's `La Cerveza Tapatía` is black, so each disappears
on one half of `npm run logo-sheet`'s tile. Both surfaces here are dark, so
both read where it counts — but the sheet will keep looking half-wrong, and
that is the sheet being honest rather than the file being broken.

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

Six files are hand-placed but are **the brands' own artwork**, supplied by the
owner rather than drawn or fetched:

- `modelo-especial.webp` — the Modelo crest, replacing the storefront
  photograph above. The crest is navy on transparent, drawn for a light label,
  and on this site's charcoal ground the wordmark disappeared while only the
  gold lions read, so it is masked onto a white tile with the corner radius the
  other tiles use. That is presentation, not redrawing: the mark itself is
  untouched.
- `pilsner-urquell.webp` — the real seal-and-wordmark, replacing the drawn
  stand-in that replaced the empty sprite-only SVG (`#shape-logo-pilsner`,
  above). Supplied by the owner from Wikimedia Commons, since
  `upload.wikimedia.org` and `thumb.wikimedia.org` are both blocked by this
  environment's egress policy and no session here could have fetched it. The
  wordmark's forest green and the seal's dark red both measure under 2.5:1
  contrast against `--bg`, so — same reasoning as `modelo-especial.webp` — it
  sits on a white tile at the source's own resolution (256×256, content
  scaled to 80% with a ⅙-side corner radius) rather than being recoloured.
- `harp-lager.webp` — the Harp badge, replacing an `icon.horse` answer that was
  a generic blue-and-white glyph, not Harp's mark at all. Its white surround is
  flooded out from the border, so the badge sits on the ground like every other
  logo while the white *inside* the badge stays part of the mark.
- `budweiser.webp` — the bowtie, replacing the drawn stand-in that replaced
  Budvar's mark. Same border-only flood as Harp, which is what keeps the white
  script inside the bowtie; red on charcoal needs no tile behind it.
- `modelo-oro.webp` — a **byte-identical copy of `modelo-especial.webp`**, at
  the owner's instruction, because no source has a separate mark for it. Know
  what this costs: the crest carries the *Especial* script, so Modelo Oro
  displays a mark naming a different product. That was a deliberate trade
  against the drawing it replaced. If a distinct Modelo Oro mark ever turns up,
  this is the file to replace. `negra-modelo` was the same copy once and now
  carries its own Negra label, supplied by the owner — one down, one to go.

  It is a separate file rather than two `BRAND_LOGOS` entries pointing at one
  path, and that is load-bearing: `fetch-logos` finds a beer's file by
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

`rothaus-pils-tannen-zapfle.webp` is the same story: the owner supplied
Rothaus's actual mark — the Waldmann figure with the two fir trees and the
`Rothaus` script — directly, at 300×300 with a transparent ground, because
every fetcher tier for `rothaus.de` (site icons, Wikidata `P154`, the favicon
services, DuckDuckGo) answered `403` at `CONNECT` from this environment's
egress policy rather than `404` from the brand, so there was no ladder to
walk. It replaced a drawn stand-in (a fir cone and wordmark) from the same
session, which never had the real artwork to work from. Stored at the fetcher's
own 256px cap; no tile needed — the figure's colours and the red script both
read on `--bg` at full saturation.

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

## One that looks odd and is staying

`ocean-sju` (a black porthole ring) reads as a thin answer, and it is **the
brand's own site favicon**, fetched from the brand's own domain.
`big-wave-golden-ale` was the other one here, Kona's 48px hibiscus; it has
left for Kona's full roundel (above).

It is the brand's digital mark rather than its label art, which is a real
limitation but not a wrong answer. Replacing a brand's own icon with someone's
drawing of what the label looks like would be the confidently-wrong trade this
file keeps warning about, so it stays — and note what *did* replace three of
its neighbours: `zywiec`, `michelob-ultra` and `big-wave-golden-ale` were on
this list, and they left it for the brands' real artwork, not for a drawing.

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
