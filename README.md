# Beer Review Buddy

The whole beer log, in one place, hosted by Lovable:

- **The app** (`/`) — add a beer in seconds, from a phone. Home, Beers, Map.
- **The stats site** (`/stats`) — the full analytics: charts, maps, the
  passport, the want-to-try scorecard. Static files in `public/stats/`, moved
  intact from [jwal64/JWAL-BEER-REVIEW](https://github.com/jwal64/JWAL-BEER-REVIEW),
  which this repo supersedes.
- **`public/stats/data.js`** — the log, the one store both of them read. The
  app reads it through `src/data/snapshot.json`, projected by `npm run snapshot`.

## How a beer gets in

Two doors, one log:

1. **Through Claude** (the usual way): describe the beer, and the session edits
   `public/stats/data.js`, runs `npm run check && npm run snapshot`, and
   merges to `main`. Lovable syncs it; it goes live when you click
   **Publish → Publish changes** in Lovable. The SOP lives in [CLAUDE.md](CLAUDE.md).
2. **Through the app's form**: the Beers tab's **+** files a GitHub issue
   with the Untappd screenshot, and a Claude session turns it into the same
   edit as door 1.

Neither surface fetches its data: what is committed is what is shown, once
it has been published. **Merging to `main` is not publishing** — Lovable syncs
the commit into its editor, and the live site changes when you click
**Publish → Publish changes** there.

## The commands

| Command | What it does |
|---------|--------------|
| `npm run check` | Every data rule CLAUDE.md states, plus the projection round-trip. Runs in CI on every push. |
| `npm run snapshot` | Projects `data.js` into `src/data/snapshot.json`, the rows the app reads |
| `npm run test` | The `app.js` logic tests on their own |
| `npm run sri` | Re-derives the stats page's CDN `integrity` hashes from npm |
| `npm run smoke` | Opens the stats page in a real browser and checks it renders (needs `npm i`) |
| `npm run logos` | Checks every beer actually resolves a logo, against the live CDNs (needs `npm i`) |
| `npm run fetch-logos` | Fetches the logo for any beer that has no file yet, from its brand's own site (needs `npm i` and open internet) |
| `npm run logo-sheet` | Draws every logo onto one sheet, so they can be looked at (needs `npm i`) |

## The rows (`src/data/snapshot.json`)

| Table | Holds |
|-------|-------|
| `beers` | One row per pour. `brewery` names a row in `breweries` — that is the link |
| `breweries` | Where a beer is made, its language and, when it differs, the beer's native name |
| `locations` | Every city a review was logged in, with coordinates for the map |
| `countries` | Country code → flag and display name. Both are needed; one without the other renders blank |
| `brand_domains` | Beer name → its logo: the file committed under `public/stats/logos/`, and the domains to fall back to when there isn't one |
| `want_to_try` | The standing shortlist. Nothing is ever deleted: an entry with a matching review crosses itself off and is scored against the prediction made beforehand |
| `untappd_averages` | The world's average per beer, for the contrarian chart |
| `app_meta` | When the Untappd figures were last re-verified, and how long before that is stale |

Two things the site shows are **not** columns: which beers a brewery makes, and
what each scored. Both are derived from the reviews, because a beer row names
its own brewery. The projection from `data.js` to these rows is written
once, in `tools/snapshot-rows.mjs`, and `npm run check` round-trips it.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a06373af-e75c-4aae-839e-f32d42a00d49).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt — and live once you **Publish** there.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
