# Jwal's Brew Reviews — simple mobile-first rebuild

Rebuild the beer review site in this Lovable project as a mobile-first app with three screens, keeping the dark theme of the current site, and moving the data from Google Sheets into Lovable Cloud with an in-app "Add beer" form.

## Theme (carried over from the repo)

- Dark background (near-black `#0f0f11`), warm amber/gold accent, green/red for good/bad ratings
- Plus Jakarta Sans typography
- Rounded cards, subtle borders, generous spacing — but far fewer widgets per screen than today

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
