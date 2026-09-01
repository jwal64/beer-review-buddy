# Beer Review Buddy — Development Guide

Everything lives here now. One repo, hosted by Lovable, holding three parts:

| Part | Where | What it is |
|------|-------|------------|
| The app | `src/` | React/TanStack, mobile-first: Home, Beers, Map, and the add-a-beer form. Reads and writes Supabase directly. |
| The stats site | `public/stats/` | The full analytics site — charts, maps, the passport, the want-to-try scorecard. Static files, no build step, served whole at `/stats`. Moved intact from `jwal64/JWAL-BEER-REVIEW`. |
| The tools | `tools/` | Zero-dependency Node scripts: validate, migration, sync, round-trip, SRI, smoke, logo audit. |

And two stores that are kept in step:

- **Supabase** is the runtime store. The app reads and writes it; the stats
  page hydrates from it on load (`public/stats/live-data.js`), so a beer added
  minutes ago appears with no deploy.
- **`public/stats/data.js`** is the authoring surface and the committed
  snapshot. Beers are added by editing it (the SOP below); it also paints the
  stats page instantly and keeps it working offline. `npm run migration` turns
  its current state into SQL that carries it into Supabase; `npm run sync`
  pulls Supabase back into it.

On a matched row the file wins — that is what makes it the authoring surface.
A row only the database knows (a beer logged through the app's own form) is
never touched by a migration; run `npm run sync` to pull those into the file.
Never log the same pour both ways: the file writes it as the first of its
month, the form with a real date, and the two would land as two rows.

## Git rules (Lovable)

This repo is connected to Lovable, which deploys `main` and syncs commits both
ways. **Never rewrite pushed history** — no force-push, rebase, amend or squash
of anything already pushed (see AGENTS.md). Merge commits only. A change is
live once it lands on `main`: Lovable applies any new file in
`supabase/migrations/` and redeploys the site.

## Standard Operating Procedure: Adding a Beer

This is the normal flow — the owner describes a beer they drank, and a Claude
session makes these edits. Everything happens in `public/stats/data.js`, then
one command turns it into a migration.

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
under its month's comment header. The file is written by `npm run sync` with
padded columns; a hand-added line does not need to match the padding — the
next sync normalises it.

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
 lat:49.6853, lng:19.1925,      // The brewery city's coordinates
 ratings:[3.50],                // One rating per listed beer, same order
 // only when the native name differs from the marketed one:
 nativeName:"NativeBeerName"},
```

In the database, `beers` and `ratings` have no columns — they are derived from
the reviews, because a beer row names its own brewery. In the file they are
written out, and `npm run check` fails if they disagree with the reviews.

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

### Step 2.6: Optional — local logo override

For a brand no logo service knows: save a file into `public/stats/logos/` and
add `logo:"logos/<filename>"` as the last field of the beer's entry. The local
file becomes that beer's primary source, with the service chain as fallback.

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

### Step 5: Check, generate the migration, commit

```sh
npm run check       # every rule above, enforced; plus the projection round-trip
npm run migration   # writes supabase/migrations/<stamp>_sync_beer_log.sql
```

`npm run migration` runs the check itself and refuses to generate from a file
that fails it. Commit **both** the edited `data.js` and the new migration in
one commit, and merge to `main` — Lovable applies the migration to the
database and redeploys. The stats page shows the beer twice over: the snapshot
already carries it, and the live hydration confirms it against the database.

The generated SQL is the whole file written as add-and-update statements: on a
match the file wins, a row only the database knows is left alone, nothing
deletes, and replaying it is a no-op. `npm run check` in CI runs on every push.

Two things no check can verify, because they need a browser and the open
internet: that a new domain actually resolves a real logo (`npm run logos`, or
`auditLogos()` in the console — see "Verifying Logos" below), and that a
`nativeName` was recorded where one exists.

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
else, and `npm run migration` carries it into the `want_to_try` table:

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
which the migration carries into the table as `aka`:

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

## Verifying Logos

Beers render their real brand logo at runtime through a four-tier chain, tried in
order until one answers:

**local `logos/` override → Brandfetch CDN → Google favicons → Icon Horse → 🍺**

The chain is tiered by *source*, not by domain: every domain a beer lists is tried
at each tier before dropping to the next, because a real Brandfetch logo for a
beer's second domain beats a 16px favicon for its first.

A domain being *present* proves nothing — whether a real logo sits behind it needs
a browser that can reach those CDNs. Four things do the checking:

| What | When | Catches |
|------|------|---------|
| the `brand_domains` check constraint | when the row is written | a domain that isn't a bare domain (scheme or path) |
| `npm run check` | on every push, in CI | beers with no `BRAND_DOMAINS` entry at all, across `beers[]` and `WANT_TO_TRY` |
| `[DOMAIN CHECK]` console warning | automatically on load | the same gap, in the browser |
| `npm run logos` | run it yourself, and monthly in CI | what each beer *actually* resolves to |
| `auditLogos()` in the console | run it manually | the same, from inside a page you already have open |

`npm run logos` (`tools/audit-logos.mjs`) drives `auditLogos()` in headless
Chromium and exits non-zero on anything that didn't resolve, so the answer stops
depending on somebody remembering to open a console. The **Logo audit** workflow
runs it on the 1st of each month and opens a `logo-audit` issue listing what
fell through, closing it once everything resolves again — a logo can break with
no change to this repo, when a brand moves domain or a service drops it.

Either way, read the result for two things:

- **`PLACEHOLDER`** — no source answered; the beer shows 🍺.
- **`suspect`** — something answered, but at favicon size (≤32px), which usually
  means a generic globe standing in for a domain the service doesn't know.

Both mean the domain needs correcting in `BRAND_DOMAINS` in data.js
(then `npm run migration`). If a brand simply isn't
in any of the services, save the logo into `logos/` and point the beer's `logo`
column at it (Step 2.6) — that is the only way to make a logo certain. A `logo`
that is a remote URL rather than a file in `logos/` is a hotlink to someone
else's server: it works until it doesn't, and `npm run check` warns about it.

The placeholder is also what you see with no network, or behind a proxy that
blocks those CDNs — which is why `npm run logos` probes a few brands that
certainly have logos before auditing anything, and reports the connection rather
than printing a hundred false failures. It exits 0 on that (a skip, not a pass);
`--strict` makes it a failure instead, which is what CI uses so a run that
checked nothing can't read as all-clear.

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
