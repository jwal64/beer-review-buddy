# UI, UX and code polish pass

A tune-up of the app itself (Home, Beers, Map, Insights, the add/edit form) — no
schema changes, no changes to the stats site or the data tools.

## What I found

From a scripted pass over the four screens at mobile width:

- Every screen loads and titles are correct; no page errors or hydration warnings.
- Beer logos fell back to the letter monogram on every card in that run, and the
  console shows repeated 404s from the logo chain. Whether that is the sandbox's
  network or genuinely wrong domains has to be confirmed before anything is
  "fixed" — first step below.
- The Beers list has search and style chips but no sort control, and a row shows
  no date, so the list can't be read as a diary.
- Home shows four stat tiles with no way to reach the detail behind them.
- Three files carry most of the app: `insights.tsx` (840 lines), `BeerForm.tsx`
  (573), `map.tsx` (424).

## Plan

**1. Confirm the logo situation.** Run the existing logo audit against the live
data and read what each beer actually resolves to. If domains are wrong, correct
them; if the chain is fine and only the sandbox is blocked, leave it and make the
fallback nicer (see 2).

**2. UI polish**
- Better fallback tile: style-tinted monogram instead of a flat grey square, so a
  logo-less beer still reads as a beer.
- Beers list: add a sort control (recent / rating / name / ABV), show the date on
  each row, and show a real empty state and a result count.
- Home: make the four stat tiles tappable, each landing on the relevant view;
  add a "last poured" line so the page has a sense of recency.
- Consistent loading skeletons and error states across all four screens (today a
  failed fetch mostly renders as nothing).
- Touch targets, focus rings and `aria-label`s on the icon-only controls; check
  the bottom nav clears the iOS home indicator.

**3. UX in the add/edit form**
- Keep the field order but group it into clear sections with a sticky save bar,
  so the long sheet is usable one-handed.
- Inline field-level errors instead of one toast per failed rule.
- Guard against losing a half-typed review when the sheet is dismissed.

**4. Code health (no behaviour change)**
- Split `insights.tsx` into a route plus chart components, and `BeerForm.tsx`
  into its brewery-picker / place-picker / review-fields parts.
- Pull the repeated card and list-row markup into shared components.
- Remove dead code, run prettier + eslint + typecheck clean.

## Verification

Typecheck and lint clean, `npm run check` still passes, and a scripted pass over
all four screens plus an add-a-beer round trip with no console errors.

## Out of scope

Schema or migrations, `public/stats/`, the shortlist/brand-domain editing screens
still listed as open in the roadmap.
