// How a place is written, everywhere.
//
// One format across the app and the stats site: **City, State/Region,
// Country** — "New Rochelle, New York, United States". Before this, every
// surface invented its own: the map popup said "City, Region" with the country
// on a line of its own, the beer sheet said "City, Country" and dropped the
// region, the home feed said the city alone. Same place, three readings.
//
// A city and its region can legitimately share a name — New York City sits in
// New York State, Antwerp the city in Antwerp the province — and that is
// coincidence, not redundancy: the two are still different kinds of place.
// Collapsing the pair used to read as tidying but actually erased the
// distinction, so "New York, USA" looked like it meant the state rather than
// the city that was actually drunk in. Both parts are printed in full now.
//
// The one thing the format still has to survive is a missing part: locations
// arrive from the form as well as from the authored file, so region or
// country can be empty. A missing part is dropped, never rendered as
// "undefined" or as a dangling comma.

type Place = {
  city?: string | null;
  region?: string | null;
  country?: string | null;
};

/** "City, Region, Country", skipping whatever the row doesn't have. */
export function placeLabel(place: Place | null | undefined): string {
  if (!place) return "";
  const city = place.city?.trim() || "";
  const region = place.region?.trim() || "";
  const country = place.country?.trim() || "";
  return [city, region, country].filter(Boolean).join(", ");
}
