# Fix the missing Amstel Light entry

The Amstel Light entry exists in the data file, but the migration that was supposed to carry it into the database never ran — so the app (which reads only the database) doesn't show it at all. Verified: the database holds 79 beers and has no Amstel Light review, no Amstel brewery, no Tarrytown location, and no Amstel Light brand-domain row.

## The fix

Run the newest migration file (`supabase/migrations/20260905170720_sync_beer_log.sql`) directly against the database using the backend tools. That file contains the entire beer log as add-and-update statements, so one run:

- inserts the Amstel Light review, its brewery, the Tarrytown location, and its brand domain
- repairs every other row that drifted, without touching anything the app added itself

## Verify

- Query the database to confirm the Amstel Light review, brewery, Tarrytown and brand-domain rows now exist (beer count should go 79 → 80).
- Open the app's preview and confirm Amstel Light appears on Home/Beers with its logo.

## Notes

- No data-file or app-code changes are needed — this is purely the database catching up to the file.
- No migration files are edited or deleted; running the existing one is exactly what it's for.
