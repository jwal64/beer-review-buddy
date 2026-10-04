# Beer Review Buddy

The whole beer log, in one place, hosted by Lovable:

- **The app** (`/`) — Home, Beers, Map and Insights, mobile-first. It reads
  the committed log and nothing else, so it works offline and paints
  instantly. (`/stats`, the old static stats site, now redirects to Insights.)
- **`src/data/log.ts`** — the log, the one store: every review, brewery,
  place, logo and fact, typed and written by hand. The app imports it
  directly; there is no database and no generated copy.

## How a beer gets in

Two doors, one log:

1. **Through Claude** (the usual way): describe the beer, and the session edits
   `src/data/log.ts`, runs `npm run check && npx tsc --noEmit`, and opens a
   pull request into `main`. The SOP lives in [CLAUDE.md](CLAUDE.md).
2. **Through the app's form**: the Beers tab's **+** files a GitHub issue
   with the Untappd screenshot, and a Claude session turns it into the same
   edit as door 1.

What is committed is what is shown, once it has been published. **Merging to
`main` is not publishing** — Lovable syncs the commit into its editor, and the
live site changes when you click **Publish → Publish changes** there.

## The commands

| Command | What it does |
|---------|--------------|
| `npm run check` | Every data rule CLAUDE.md states, the lockfile, the invariants and the logic tests. Runs in CI on every push. |
| `npx tsc --noEmit` | Type-checks the app and the log. Also a CI job. |
| `npm run test` | The logic tests for `src/lib/` on their own |
| `npm run smoke` | Starts the app and checks every route in a real browser (needs `npm i`) |
| `npm run fetch-logos` | Fetches the logo for any beer that has no file yet, from its brand's own site (needs `npm i` and open internet) |
| `npm run logo-sheet` | Draws every logo onto one sheet, so they can be looked at (needs `npm i`) |

## The rows the app reads

`src/lib/rows.ts` flattens the log into these, once, at build time:

| Table | Holds |
|-------|-------|
| `beers` | One row per pour. `brewery` names a row in `breweries` — that is the link |
| `breweries` | Where a beer is made, its language and, when it differs, the beer's native name |
| `locations` | Every city a review was logged in, with coordinates for the map |
| `countries` | Country code → flag and display name. Both are needed; one without the other renders blank |
| `brand_domains` | Beer name → its logo: the file committed under `public/logos/`, and the domains to fall back to when there isn't one |
| `beer_facts` | What each beer is: sub-style, colour, body, published IBU and calories, adjuncts |
| `want_to_try` | The standing shortlist. Nothing is ever deleted: an entry with a matching review crosses itself off and is scored against the prediction made beforehand |
| `untappd_averages` | The world's average per beer, for "my rating vs the world" |

Two things the app shows are **not** columns: which beers a brewery makes, and
what each scored. Both are derived from the reviews, because a beer row names
its own brewery; `npm run check` fails when the log's copy disagrees with
the reviews.

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
