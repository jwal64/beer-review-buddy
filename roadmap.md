# Roadmap

- [x] Rebuild UI as mobile-first 3 screens (Home, Beers, Map)
- [x] Midnight Pilsner theme
- [x] Add/edit/delete beer form + sign-in
- [x] Re-import full dataset from GitHub repo (79 beers, 65 breweries, 27 cities)
- [x] Connect project to a new GitHub repo (user action: chat Plus menu → GitHub → Connect project)
- [x] Become the source of truth: widen the schema to everything the static site
      renders (brewery `lang`/`native_name`, per-beer `logo`/`seq`, and the
      `countries`, `brand_domains`, `want_to_try`, `untappd_averages` and
      `app_meta` tables), and seed it from that site's `data.js` one last time
- [x] Capture the full model in the add-beer form — brewery and place pickers
      that can create what they don't find, so a review is never saved missing
      its origin country, region or logo domain
- [x] Serve brand logos from `brand_domains` instead of the hardcoded map, which
      was still keyed on the beer names of the first import and had stopped
      resolving
- [x] Move the whole stats site here (`public/stats/`, served at `/stats`),
      with live hydration from Supabase and the committed `data.js` as its
      instant offline snapshot — one repo, hosted by Lovable
- [x] The add-a-beer-via-Claude flow: edit `data.js`, `npm run migration`,
      merge — Lovable applies the migration (SOP in CLAUDE.md)
- [x] Hold every beer's logo in the repo rather than fetching it from a stranger
      on every render: 101 files in `public/stats/logos/`, named by a `logo`
      column on `brand_domains`, fetched by `npm run fetch-logos` from each
      brand's own site and checked by `npm run check`. Brandfetch had begun
      refusing the public client ID both surfaces embedded, and 97 of 101 beers
      had been quietly rendering a grey globe
- [x] Finish app optimization pass: resilient query errors, sorted beer diary, accessible controls, and verified committed logo rendering
- [ ] Archive jwal64/JWAL-BEER-REVIEW and turn off its GitHub Pages once the
      Lovable URL serves `/stats` (user action)
- [ ] Editing screens for the shortlist, brand domains and Untappd averages —
      still edited via Claude or the table editor for now
- [x] Stop the map pop-outs and the City, Region, Country location format
      being reverted: both restored, written down in AGENTS.md for Lovable and
      in CLAUDE.md under "Features that must survive every pass", and guarded
      by `node tools/check-invariants.mjs` so CI fails on the push that drops
      them. (A standing rule rather than a to-do — it lived here as an
      unchecked box, which reads as work nobody had done yet, and it was
      reverted again anyway. Prose in a roadmap is not enforcement.)
- [ ] Replace the nine drawn-approximation logos with the brands' official
      artwork where one is publicly available
