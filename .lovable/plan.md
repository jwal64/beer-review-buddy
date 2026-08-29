# Jwal's Brew Reviews — simple mobile-first rebuild

Rebuild the beer review site in this Lovable project as a mobile-first app with three screens, keeping the dark theme of the current site, and moving the data from Google Sheets into Lovable Cloud with an in-app "Add beer" form.

## Theme (refreshed)

Same family as today — dark, calm, beer-warm — but modernised now that you've given permission to change it:

- Deep charcoal/espresso background with a warmer tone than the current flat near-black, layered card surfaces
- Amber/gold accent for ratings and highlights, muted green and clay-red for good/bad
- New type pairing: a characterful display face for headings and numbers, clean sans for body (replacing Plus Jakarta Sans everywhere)
- Softer radii, bigger touch targets, one clear focal element per screen

## Beer logos

- Each beer/brewery gets its real logo shown on the list rows, detail sheet, and top-rated cards
- Logos sourced from official brand marks for the ~39 breweries in your data (Heineken, Guinness, Duvel, Estrella Damm, Sapporo, Żywiec, etc.), stored in Lovable Cloud storage with a `logo_url` on the brewery record
- Any brewery without a usable logo falls back to a styled monogram tile so the layout never breaks
- New beers added through the form can have a logo uploaded or pasted by URL


## Screens

1. **Home** — four headline stats (total beers, average rating, breweries tried, hit rate), a "recently drunk" feed of the latest reviews, top-rated list, and a compact rating-by-style chart. Insights folded in here.
2. **All beers** — one search box plus simple filter chips (style, country, rating). Tap a beer to open a detail sheet with rating, ABV, style, brewery, where and when you drank it.
3. **Map** — pins for where beers were brewed and where you drank them; tap a pin to see the beers from there.

Navigation is a fixed bottom bar on mobile and a slim left rail on desktop. Removed from the old UI: command palette, brewery drawer, the merged country/city/language/market sections, and most secondary charts.

## Add / edit beers

A floating "+" button opens a form: beer, brewery, style, ABV, rating, drink method, city/country, date. Edit and delete from the beer detail sheet. This replaces the spreadsheet workflow.

## Data

- Lovable Cloud database with `beers`, `breweries`, and `locations` tables, seeded from the CSVs in the repo (53 beers plus brewery and location rows) so the app is populated from the first load.
- Public read access so anyone with the link can browse; sign-in required to add or edit, so only you can write.

## Technical notes

- TanStack Start routes: `/` (Home), `/beers`, `/map`; beer detail as a sheet over the list.
- Recharts for the style chart; Leaflet loaded client-side only for the map.
- Design tokens (dark palette, amber accent) defined in `src/styles.css`; no hardcoded colors in components.
- Cloud tables get RLS: `SELECT` for everyone, insert/update/delete restricted to authenticated users, plus an email/password sign-in screen for you.
- Original repo stays untouched — I can't push to it. Once this looks right you can connect this project to GitHub via Git sync (new repo or the existing one) and the code lands there.

## Other recommendations (not in scope unless you want them)

- Untappd import instead of manual entry
- Photo upload per beer (Cloud storage) so the feed has bottle/can shots
- Shareable public profile link and per-beer share cards
- "What to try next" suggestions based on your style ratings
