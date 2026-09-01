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
- [ ] Add the `SUPABASE_URL` and `SUPABASE_KEY` secrets to JWAL-BEER-REVIEW so
      its **Sync from Supabase** workflow can run (user action)
- [ ] Editing screens for the shortlist, brand domains and Untappd averages —
      they are the source of truth now but are still edited in the table editor
