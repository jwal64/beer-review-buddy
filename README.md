# Beer Review Buddy

Add a beer in seconds, from a phone. **This app, and the Supabase database
behind it, is the source of truth for the whole beer log.**

The static site at
[jwal64/JWAL-BEER-REVIEW](https://github.com/jwal64/JWAL-BEER-REVIEW) — the
charts, the maps, the passport, the want-to-try scorecard — is generated from
these tables. It used to be the other way round: the reviews lived in a
`data.js` file there and this app held a partial copy. The
`beer_buddy_source_of_truth` migration reversed it.

```
  this app                     Supabase              JWAL-BEER-REVIEW
  (add a beer, on a phone) ──> beers, breweries, ──> data.js ──> the site
                               locations, brand
                               domains, want-to-try
                                     │
                                     └── npm run sync, nightly in CI
```

## What that means when changing things here

The site cannot render what this database does not store, and it will not
render a review that is missing a piece. So:

- **A beer needs its brewery, its place and a logo domain.** `origin_cc` comes
  from the brewery; `city`/`region`/`country`/`cc` come from the place. That is
  why the form's brewery and place fields are pickers that can create what they
  do not find, rather than free text.
- **The database enforces most of the site's rules itself** — a rating in
  quarter steps, a known serving method, a brewery with a language, a bare logo
  domain. A failed insert is usually one of those, and the message says which.
- **Don't drop a column because this app does not show it.** `lang`,
  `native_name`, `seq` and `logo` are all rendered over there.

The full set of rules is in that repo's
[CLAUDE.md](https://github.com/jwal64/JWAL-BEER-REVIEW/blob/main/CLAUDE.md); the
projection between these tables and `data.js` is written once, in its
`tools/supabase-rows.mjs`.

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
its own brewery.

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
