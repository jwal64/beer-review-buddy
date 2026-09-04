// How a place is written, everywhere.
//
// One format across the app and the stats site: **City, State/Region,
// Country** — "New Rochelle, New York, United States". Before this, every
// surface invented its own: the map popup said "City, Region" with the country
// on a line of its own, the beer sheet said "City, Country" and dropped the
// region, the home feed said the city alone. Same place, three readings.
//
// Two things the format has to survive, both real in the data:
//
//   - a region that repeats its city ("Antwerp, Antwerp") — said once, because
//     saying it twice reads as a mistake rather than as precision
//   - a missing part: locations arrive from the form as well as from the
//     authored file, so region or country can be empty. A missing part is
//     dropped, never rendered as "undefined" or as a dangling comma.

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
  return [city, region === city ? "" : region, country].filter(Boolean).join(", ");
}
