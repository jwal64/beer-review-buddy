# Notes for Lovable

A standing punch-list for the app (`src/`) so a Lovable credit spend lands on
something real instead of a guess. Ordered so the top of the list is the best
return: cheap to fix, and each is a genuine bug or gap found by reading the
current code, not a wishlist item.

Re-read this before spending credits, delete an item once it's shipped, and
add to it — this file is meant to stay current, not to be written once.

## 1. Deleting a beer has no confirmation

`src/components/BeerForm.tsx` — `handleDelete()`. Tapping "Delete this beer"
fires the Supabase delete immediately; there's no "are you sure?" step. It's
the only destructive, unrecoverable action in the app and it's one tap away
from the edit sheet. Wrap it in an `AlertDialog` (already a dependency,
`src/components/ui/alert-dialog.tsx`) before the delete call.

## 2. Saving a logo domain from the form can silently drop the others

Same file, in `handleSubmit()`:

```ts
if (domain) {
  const { error } = await supabase
    .from("brand_domains")
    .upsert({ beer_name: name, domains: [domain] }, { onConflict: "beer_name" });
```

This *replaces* the beer's `domains` array with a single entry rather than
appending. A beer that already has two or three fallback domains (the array
form CLAUDE.md describes — brand site, local TLD, the parent brewery's site)
loses all but the one just typed the next time someone edits that beer and
fills in the domain field. Fetch the existing row first and merge, or only
write when the field is empty and the beer truly has none yet.

## 3. New brewery / new place pickers don't catch near-duplicates

Same file — `addingBrewery` and `addingPlace` both insert straight from
free-text input with no check against the existing `breweries[]` /
`locations[]` lists besides an exact `Select` match. A typo or a different
capitalization ("De Koninck" vs "de Koninck") creates a second row instead of
reusing the first, and nothing in the UI surfaces that until the map or the
brewery list shows a near-duplicate. A case-insensitive/trimmed check before
insert, with a "did you mean an existing one?" prompt, would catch this at
the point of entry instead of leaving it for a `npm run check` failure or a
later cleanup.

## 4. The app itself has no automated test coverage

`npm run smoke` (`tools/smoke-test.mjs`) only opens `/stats` — the static
site. Nothing exercises the React app: the add/edit/delete flow in
`BeerForm.tsx`, the auth flow in `routes/auth.tsx`, or routing/rendering in
general. `BeerForm.tsx` alone is 570+ lines of interdependent manual
validation (brewery picker ↔ new-brewery fields, place picker ↔ new-place
fields, the domain fallback logic above) with nothing to catch a regression
before it reaches production. A small Vitest + Testing Library suite over
`BeerForm` (submit with/without a new brewery, rating step validation, the
delete flow) would be the highest-leverage addition here — it's the one file
most likely to break silently.

## 5. `insights.ts` and `public/stats/app.js` can drift with no check

`src/lib/insights.ts` says so itself in its header comment: it deliberately
re-implements `MIN_N`, the ranking rule and `predictRating()` rather than
importing them, because the stats site is dependency-free browser JS with no
module boundary to share code across. That's a reasonable constraint, but
nothing currently verifies the two stay identical — a rule changed in one and
not the other disagrees silently (the app says one beer is the "best style",
`/stats` says another). Worth either a small script that diffs the two rule
sets' outputs against a fixture, or a comment-linked pair of TODOs so a future
edit to one is a prompt to check the other.

## 6. Next roadmap item: editing screens for shortlist / domains / Untappd averages

Carried over from `roadmap.md`, which is otherwise all checked off. Right now
`want_to_try`, `brand_domains` and `untappd_averages` are only editable
through Claude (editing `data.js`) or the Supabase table editor — there's no
in-app UI. Building that is what would let the two recurring maintenance
issues below actually get done without a data-file edit each time.

---

**Not on this list on purpose:** issues
[#4](https://github.com/jwal64/beer-review-buddy/issues/4) (Untappd refresh)
and [#5](https://github.com/jwal64/beer-review-buddy/issues/5) (logo audit)
are auto-filed monthly against `data.js` — that's data curation for a Claude
session per the SOPs in `CLAUDE.md`, not app code, so it isn't a Lovable
credit spend. Item 6 above is what would eventually make them go away.
