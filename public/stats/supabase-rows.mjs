// The projection between data.js and the Supabase tables behind
// beer-review-buddy — written once, here, and used in both directions.
//
// tools/export-supabase-seed.mjs turns data.js into rows (the one-time
// cutover, and a way to regenerate the seed). tools/sync-from-supabase.mjs
// turns rows back into data.js (every sync from now on). Both call into this
// file, so the two directions can never disagree about what a column means.
//
// Two fields deliberately have no column of their own:
//
//   breweries[].beers    the `·`-joined list of that brewery's beers
//   breweries[].ratings  the rating of each, in the same order
//
// Both are derivable from the reviews now that a beer row carries its own
// `brewery`, and a derived field cannot drift out of step with the thing it
// mirrors. They are recomputed on the way back in.

export const TABLES = [
  'countries', 'locations', 'breweries', 'beers',
  'brand_domains', 'want_to_try', 'untappd_averages', 'app_meta',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// data.js records a month, not a day — a review is "Mar 2026", never the 14th.
// The column is a date because a date is what a database should hold and what
// the app's date picker writes, so the seed anchors to the first of the month
// and the trip back reads the month off whatever day is stored.
export const monthStart = (year, monthN) =>
  `${year}-${String(monthN).padStart(2, '0')}-01`;

export function monthParts(drankOn) {
  const [y, m] = String(drankOn).split('-').map(Number);
  return { month: MONTHS[m - 1], monthN: m, year: y };
}

// ── data.js → rows ────────────────────────────────────────────

export function toRows(D) {
  // Which brewery makes each beer. In data.js the link runs the other way —
  // a brewery lists its beers — so it is inverted once, here.
  const breweryOf = new Map();
  for (const br of D.breweries)
    for (const n of splitBeers(br.beers)) breweryOf.set(n, br.name);

  return {
    countries: Object.keys({ ...D.FLAGS, ...D.CNAMES }).sort().map(cc => ({
      cc, flag: D.FLAGS[cc] ?? null, name: D.CNAMES[cc] ?? null,
    })),

    locations: D.drunkLocs.map(l => ({
      city: l.city, region: l.region, country: l.country, cc: l.cc,
      lat: l.lat, lng: l.lng,
    })),

    breweries: D.breweries.map(br => ({
      name: br.name, location: br.location, country: br.country, cc: br.cc,
      lang: br.lang, native_name: br.nativeName ?? null,
      lat: br.lat, lng: br.lng,
    })),

    // `seq` preserves the order reviews were logged in within a month. Without
    // it every sync would reshuffle the beers of a month among themselves,
    // because they all share the first-of-the-month date.
    beers: D.beers.map((b, i) => ({
      seq: i + 1,
      name: b.beer, brewery: breweryOf.get(b.beer) ?? null, style: b.style,
      origin_cc: b.origin, abv: b.abv, method: b.method,
      city: b.city, region: b.region, country: b.country, cc: b.cc,
      rating: b.rating, is_new: b.isNew,
      drank_on: monthStart(b.year, b.monthN),
      logo: b.logo ?? null,
    })),

    // One row per beer name, carrying both halves of where its logo comes
    // from: the file committed for the brand, and the domains to fall back to
    // when there isn't one. Keyed by name rather than by review, so a beer
    // drunk six times and a beer only on the shortlist are the same one entry.
    brand_domains: Object.entries(D.BRAND_DOMAINS).map(([beer_name, v]) => ({
      beer_name, domains: Array.isArray(v) ? v : [v],
      logo: D.BRAND_LOGOS?.[beer_name] ?? null,
    })),

    want_to_try: D.WANT_TO_TRY.map((e, i) => ({
      seq: i + 1,
      beer: e.beer, style: e.style, origin: e.origin, abv: e.abv,
      region: e.region, untappd: e.untappd, method: e.method,
      aka: e.as ?? null,
    })),

    untappd_averages: Object.entries(D.UNTAPPD_GLOBAL_AVGS)
      .map(([beer_name, avg]) => ({ beer_name, avg })),

    app_meta: [
      { key: 'untappd_last_refreshed', value: String(D.UNTAPPD_LAST_REFRESHED) },
      { key: 'untappd_refresh_interval_days', value: String(D.UNTAPPD_REFRESH_INTERVAL_DAYS) },
    ],
  };
}

// ── rows → data.js values ─────────────────────────────────────

export const splitBeers = s =>
  String(s || '').split('·').map(x => x.trim()).filter(Boolean);

// A row's numbers arrive from PostgREST as strings when the column is
// `numeric` — `rating` and `abv` both are — so everything numeric is coerced
// rather than trusted. A rating of "3.50" would sail through every check and
// then sort as text in the charts.
const num = v => (v === null || v === undefined ? null : Number(v));

export function fromRows(rows) {
  const FLAGS = {}, CNAMES = {};
  for (const c of rows.countries ?? []) {
    if (c.flag) FLAGS[c.cc] = c.flag;
    if (c.name) CNAMES[c.cc] = c.name;
  }

  const ordered = sortBeers(rows.beers ?? []);

  // The two derived brewery fields are rebuilt as the reviews are read, in the
  // same pass and the same order: a brewery lists its beers oldest review
  // first, and the rating beside each is that beer's own. A beer reviewed
  // twice is listed once, under the brewery that made it.
  const byBrewery = new Map();

  const beers = ordered.map(b => {
    const { month, monthN, year } = monthParts(b.drank_on);
    const entry = {
      beer: b.name, style: b.style, origin: b.origin_cc, abv: num(b.abv),
      method: b.method, city: b.city, region: b.region, country: b.country,
      cc: b.cc, rating: num(b.rating), isNew: !!b.is_new, month, monthN, year,
    };
    if (b.logo) entry.logo = b.logo;

    if (b.brewery) {
      if (!byBrewery.has(b.brewery)) byBrewery.set(b.brewery, []);
      const list = byBrewery.get(b.brewery);
      if (!list.some(x => x.beer === entry.beer)) list.push(entry);
    }
    return entry;
  });

  const breweries = (rows.breweries ?? []).map(br => {
    const mine = byBrewery.get(br.name) ?? [];
    const entry = {
      name: br.name, location: br.location, country: br.country, cc: br.cc,
      lang: br.lang,
      beers: mine.map(b => b.beer).join(' · '),
      ...(br.native_name ? { nativeName: br.native_name } : {}),
      lat: num(br.lat), lng: num(br.lng),
      ratings: mine.map(b => b.rating),
    };
    return entry;
  });

  const drunkLocs = (rows.locations ?? []).map(l => ({
    city: l.city, region: l.region, country: l.country, cc: l.cc,
    lat: num(l.lat), lng: num(l.lng),
  }));

  const BRAND_DOMAINS = {}, BRAND_LOGOS = {};
  for (const d of rows.brand_domains ?? []) {
    const list = (d.domains ?? []).filter(Boolean);
    if (list.length) BRAND_DOMAINS[d.beer_name] = list.length === 1 ? list[0] : list;
    if (d.logo) BRAND_LOGOS[d.beer_name] = d.logo;
  }

  const UNTAPPD_GLOBAL_AVGS = {};
  for (const u of rows.untappd_averages ?? []) UNTAPPD_GLOBAL_AVGS[u.beer_name] = num(u.avg);

  const WANT_TO_TRY = bySeq(rows.want_to_try ?? []).map(e => ({
    beer: e.beer, style: e.style, origin: e.origin, abv: num(e.abv),
    region: e.region, untappd: num(e.untappd), method: e.method,
    ...(e.aka?.length ? { as: e.aka } : {}),
  }));

  const meta = Object.fromEntries((rows.app_meta ?? []).map(m => [m.key, m.value]));

  return {
    FLAGS, CNAMES, beers, drunkLocs, breweries, BRAND_DOMAINS, BRAND_LOGOS,
    UNTAPPD_GLOBAL_AVGS, WANT_TO_TRY,
    UNTAPPD_LAST_REFRESHED: meta.untappd_last_refreshed ?? '',
    UNTAPPD_REFRESH_INTERVAL_DAYS: Number(meta.untappd_refresh_interval_days ?? 14),
  };
}

// Reviews read as a diary, so the order has to be stable and meaningful:
// oldest month first, then the order they were logged within that month.
// `seq` carries that for everything seeded from data.js; a beer added in the
// app has none and falls in behind on when the row was created.
const bySeq = rows => [...rows].sort((a, b) => (a.seq ?? 1e9) - (b.seq ?? 1e9));

export function sortBeers(rows) {
  return [...rows].sort((a, b) =>
    String(a.drank_on).localeCompare(String(b.drank_on)) ||
    (a.seq ?? 1e9) - (b.seq ?? 1e9) ||
    String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) ||
    String(a.name).localeCompare(String(b.name)));
}

// ── merging the file with the database ────────────────────────
//
// The natural key of each table — what makes two rows the same row. `beers`
// uses name + drank_on because that is what the generated migration matches
// on, so the merge, the migration and tools/verify-live.mjs all agree about
// which rows are "the same row" by construction rather than by coincidence.
export const KEYS = {
  countries: ['cc'],
  locations: ['city', 'cc'],
  breweries: ['name'],
  beers: ['name', 'drank_on'],
  brand_domains: ['beer_name'],
  want_to_try: ['beer'],
  untappd_averages: ['beer_name'],
  app_meta: ['key'],
};

export const keyOf = (table, row) =>
  KEYS[table].map(k => String(row[k])).join(' ␟ ');

// data.js is the authoring surface: "on a matched row the file wins" is the
// rule the whole repo is written around, and this is where that rule is
// applied at display time rather than only at migration time.
//
// It matters because the database is not guaranteed to be in step. Applying a
// migration is Lovable's step, not this repo's, and generated migrations have
// sat unapplied for days. Until this function existed the hydrate *replaced*
// the snapshot wholesale, so a beer the file had and the database did not
// painted for one frame and then vanished — which reads exactly like the edit
// was never made.
//
//   in both      → the file's values, over the database's row, so a column
//                  only the database has (`id`, `created_at`) survives and the
//                  app can still edit that beer
//   file only    → kept. This is the fix: these used to be dropped
//   database only→ kept, appended. A beer logged through the app's own form
//                  is exactly this, and is why the hydrate exists at all
export function mergeRows(fileRows, dbRows) {
  const out = {};
  for (const t of TABLES) {
    const file = fileRows?.[t] ?? [];
    const byKey = new Map((dbRows?.[t] ?? []).map(r => [keyOf(t, r), r]));
    out[t] = file.map(r => {
      const k = keyOf(t, r);
      const hit = byKey.get(k);
      byKey.delete(k);
      return hit ? { ...hit, ...r } : r;
    }).concat([...byKey.values()]);
  }
  return out;
}
