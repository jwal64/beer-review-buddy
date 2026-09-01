# Beer Review Buddy

The whole beer log, in one place, hosted by Lovable:

- **The app** (`/`) — add a beer in seconds, from a phone. Home, Beers, Map.
- **The stats site** (`/stats`) — the full analytics: charts, maps, the
  passport, the want-to-try scorecard. Static files in `public/stats/`, moved
  intact from [jwal64/JWAL-BEER-REVIEW](https://github.com/jwal64/JWAL-BEER-REVIEW),
  which this repo supersedes.
- **Supabase** — the runtime store both of them read.

## How a beer gets in

Two doors, one log:

1. **Through Claude** (the usual way): describe the beer, and the session edits
   `public/stats/data.js`, runs `npm run check && npm run migration`, and
   commits the file with the generated migration. Merged to `main`, Lovable
   applies the migration and redeploys. The SOP lives in [CLAUDE.md](CLAUDE.md).
2. **Through the app's form**: writes straight to Supabase. The stats page
   picks it up live; `npm run sync` pulls it back into `data.js` whenever the
   file should catch up.

The stats page paints instantly from the committed `data.js` snapshot, then
hydrates from the database (`public/stats/live-data.js`) — so it is current
without a deploy, and still works offline or if the database is unreachable.

## The commands

| Command | What it does |
|---------|--------------|
| `npm run check` | Every data rule CLAUDE.md states, plus the projection round-trip. Runs in CI on every push. |
| `npm run migration` | Turns the current `data.js` into `supabase/migrations/<stamp>_sync_beer_log.sql` (checks first) |
| `npm run sync` | Rewrites `data.js` from the database (needs `SUPABASE_URL` + `SUPABASE_KEY`) |
| `npm run seed` | The migration SQL to stdout, for inspection |
| `npm run sri` | Re-derives the stats page's CDN `integrity` hashes from npm |
| `npm run smoke` | Opens the stats page in a real browser and checks it renders (needs `npm i`) |
| `npm run logos` | Checks every beer actually resolves a logo, against the live CDNs (needs `npm i`) |

## The tables

| Table | Holds |
|-------|-------|
| `beers` | One row per pour. `brewery` names a row in `breweries` — that is the link |
| `breweries` | Where a beer is made, its language and, when it differs, the beer's native name |
| `locations` | Every city a review was logged in, with coordinates for the map |
| `countries` | Country code → flag and display name. Both are needed; one without the other renders blank |
| `brand_domains` | Beer name → the domains its logo is looked up from |
| `want_to_try` | The standing shortlist. Nothing is ever deleted: an entry with a matching review crosses itself off and is scored against the prediction made beforehand |
| `untappd_averages` | The world's average per beer, for the contrarian chart |
| `app_meta` | When the Untappd figures were last re-verified, and how long before that is stale |

Two things the site shows are **not** columns: which beers a brewery makes, and
what each scored. Both are derived from the reviews, because a beer row names
its own brewery. The projection between the tables and `data.js` is written
once, in `public/stats/supabase-rows.mjs`, and shared by the browser and every
tool.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a06373af-e75c-4aae-839e-f32d42a00d49).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
