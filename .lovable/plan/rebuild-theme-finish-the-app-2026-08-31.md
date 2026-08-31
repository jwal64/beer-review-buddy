# Rebuild theme + finish the app

Two things: replace the current espresso/amber theme with the **Midnight Pilsner** palette you picked, and finish the remaining screens so the app is complete.

## New theme — Midnight Pilsner

- Deep navy-black background (#0a0f1c), dark blue card surfaces (#101a2e), electric blue accent (#3b82f6), cool off-white text (#e8eef7)
- Ratings, active nav items, chips and buttons switch from amber to the electric blue
- Typography moves to a sharper pairing: Sora for headings/numbers, Manrope for body
- All screens (Home, All Beers, detail sheet, bottom nav, sign-in) updated via the design tokens in `src/styles.css` — no hardcoded colors

## Finish the app

1. **Map screen** (`/map`) — the missing third tab: Leaflet map loaded client-side only, dark-styled tiles, pins for every brewery and drinking location; tapping a pin lists the beers from there. This also clears the current navigation typing error.
2. **Add / edit / delete beers** — floating "+" button opens a form (beer, brewery, style, ABV, rating, method, city/country, date); edit and delete from the beer detail sheet.
3. **Sign-in** — an email/password screen so only you can add or edit; public visitors can still browse everything.

## GitHub repo

- I'll check whether this project is connected to GitHub. If it isn't, connecting/creating a repo is done by you in **Git Settings → Connect GitHub → create new repository** (it needs your GitHub account authorization); the code then syncs there. I'll verify the connection state first and guide you through the one click if needed.

## Already done (no changes needed)

- Database with your 52 reviews, 32 breweries, 14 locations seeded in Lovable Cloud
- Real brewery logos on list rows, detail sheet and top-rated cards (loaded by brand domain)
