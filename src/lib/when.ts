// When a review happened, as the app prints it. Kept free of runtime imports
// (the Beer type is erased) so tools/app-logic-test.mjs can load it in Node.
import type { Beer } from "./snapshot";

// One formatter, built once. `toLocaleDateString` with an options object
// constructs a fresh Intl.DateTimeFormat on every call, which is the expensive
// part — and this is called once per row of the beers list, on every keystroke
// typed into its search box.
const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export function formatMonth(date: string) {
  return MONTH_FORMAT.format(new Date(date + "T00:00:00"));
}

/** When a review happened, as printed: "September 2026", or "Retro" for one graded from memory. */
export function whenLabel(beer: Pick<Beer, "retro" | "drank_on">) {
  return beer.retro ? "Retro" : formatMonth(beer.drank_on);
}

// The "New" badge. `is_new` marks a beer as never reviewed before, for good — it doesn't
// expire. Showing that badge forever would make it noise, so the badge only
// shows while the review is still current-month news. Recomputed on every
// call (not memoized) so a long-lived tab crossing a month boundary
// re-flags correctly without a reload.
export function isDisplayNew(beer: Pick<Beer, "is_new" | "drank_on">) {
  if (!beer.is_new) return false;
  // `drank_on` is always exactly "YYYY-MM-DD", so reading the calendar month
  // off the string is identical to parsing it at local midnight and calling getMonth()/getFullYear(), and does not allocate a
  // Date per row. `now` is still read per call, so a tab left open across a
  // month boundary re-flags without a reload.
  const now = new Date();
  const month = now.getMonth() + 1;
  return +beer.drank_on.slice(0, 4) === now.getFullYear() && +beer.drank_on.slice(5, 7) === month;
}
