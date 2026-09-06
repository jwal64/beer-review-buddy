# Fix the missing Amstel Light entry — and make future adds sync instantly

The Amstel Light entry exists in the data file, but the migration that was supposed to carry it into the database never ran — so the app (which reads only the database) doesn't show it at all. Verified: the database holds 79 beers and has no Amstel Light review, no Amstel brewery, no Tarrytown location, and no Amstel Light brand-domain row.

## Part 1 — Fix Amstel Light now

Run the newest migration file (`supabase/migrations/20260905170720_sync_beer_log.sql`) directly against the database using the backend tools. That file contains the entire beer log as add-and-update statements, so one run:

- inserts the Amstel Light review, its brewery, the Tarrytown location, and its brand domain
- repairs every other row that drifted, without touching anything the app added itself

Then verify: database beer count goes 79 → 80, the Amstel rows exist, and Amstel Light appears in the app preview with its logo.

## Part 2 — Make every future entry sync immediately

The gap happened because adding a beer generated a migration file and waited for something else to run it — which silently didn't. From now on, whenever a beer (or any data change) is added in a session here:

- The same session applies the change straight to the database using the built-in database tools — no waiting on an outside step.
- Immediately after, the database is read back to confirm the new rows are really there before the session calls it done.
- The existing generated-migration file is still created so the repo's history stays complete, but it's a record, not the delivery mechanism.

No new code is needed for this — it's a change in how the add-a-beer flow is carried out in sessions, backed by the verify-live check that already exists. I'll note the rule in the project guide so every future session follows it.

## Notes

- No data-file or app-code changes are needed for Part 1 — this is purely the database catching up to the file.
- No migration files are edited or deleted; running the existing one is exactly what it's for.
