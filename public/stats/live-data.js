// Hydrates the page from the Supabase database behind the app, then repaints.
//
// data.js, loaded before this, is a committed snapshot: it paints instantly,
// works offline, and is what every check in tools/ validates. This script then
// fetches what the database holds right now — the same tables the app writes —
// and *merges* it into the snapshot, repainting only if the result differs.
// A beer added minutes ago through the app's form appears without a deploy.
//
// Merged, not swapped in. The snapshot is the authoring surface, so on a row
// both have the file wins; a row only the database has is added; and a row
// only the file has is KEPT. That last one is the whole point: applying a
// migration is Lovable's step, not this repo's, and a generated migration
// that had not been applied used to make a newly added beer paint for one
// frame and then vanish here — which reads exactly like the edit was never
// made. Now the file carries it until the database catches up.
//
// If the fetch fails — no network, the database unreachable, this file opened
// straight from disk — the snapshot simply stands. Nothing here may break the
// page: every step is wrapped, and the only output on failure is one
// console.info.
//
// The key below is Supabase's *publishable* key: public by design, shipped to
// every browser by the app itself, and allowed only what row-level security
// grants the anonymous role — reading. Writing needs a signed-in session.
(function () {
  'use strict';
  var SUPABASE_URL = 'https://fpdyzrzxuykgbnvxqkxi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_QDyD36Vcrte9v787D2W-0g_YaJNLLE2';
  var TABLES = ['countries', 'locations', 'breweries', 'beers',
                'brand_domains', 'want_to_try', 'untappd_averages', 'app_meta'];

  function fetchTable(name) {
    return fetch(SUPABASE_URL + '/rest/v1/' + name + '?select=*', {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
    }).then(function (res) {
      if (!res.ok) throw new Error(name + ' → HTTP ' + res.status);
      return res.json();
    });
  }

  // Replace an object's entries, or an array's elements, without replacing the
  // thing itself — BRAND_DOMAINS and friends are consts, so the bindings can't
  // be reassigned, but what they hold can.
  function refill(target, source) {
    if (Array.isArray(target)) {
      target.splice.apply(target, [0, target.length].concat(source));
    } else {
      Object.keys(target).forEach(function (k) { delete target[k]; });
      Object.assign(target, source);
    }
  }

  // The file side of the merge, read off the globals data.js declared. Read at
  // hydrate time, before anything below reassigns them, so it is always the
  // committed snapshot rather than a half-merged state.
  function snapshot() {
    return {
      FLAGS: FLAGS, CNAMES: CNAMES, beers: beers, drunkLocs: drunkLocs,
      breweries: breweries, BRAND_DOMAINS: BRAND_DOMAINS,
      BRAND_LOGOS: BRAND_LOGOS, WANT_TO_TRY: WANT_TO_TRY,
      UNTAPPD_GLOBAL_AVGS: UNTAPPD_GLOBAL_AVGS,
      UNTAPPD_LAST_REFRESHED: UNTAPPD_LAST_REFRESHED,
      UNTAPPD_REFRESH_INTERVAL_DAYS: UNTAPPD_REFRESH_INTERVAL_DAYS,
    };
  }

  function hydrate() {
    // The projection lives in one module, shared with the node tools, so the
    // browser and the sync can never disagree about what a column means.
    var rowsByTable = {};
    Promise.all([
      import('./supabase-rows.mjs'),
      Promise.all(TABLES.map(fetchTable)).then(function (results) {
        TABLES.forEach(function (t, i) { rowsByTable[t] = results[i]; });
      }),
    ]).then(function (loaded) {
      var rows = loaded[0];
      // An empty read is a failed read: the snapshot is never traded for
      // nothing. Judged on what actually came back, before the merge — after
      // it, the file's own rows would answer for the database's silence.
      if (!(rowsByTable.beers || []).length || !(rowsByTable.breweries || []).length)
        throw new Error('empty read');

      var d = rows.fromRows(rows.mergeRows(rows.toRows(snapshot()), rowsByTable));

      var same =
        JSON.stringify([d.beers, d.breweries, d.drunkLocs, d.WANT_TO_TRY, d.BRAND_DOMAINS, d.UNTAPPD_GLOBAL_AVGS]) ===
        JSON.stringify([beers, breweries, drunkLocs, WANT_TO_TRY, BRAND_DOMAINS, UNTAPPD_GLOBAL_AVGS]);
      if (same) {
        console.info('[LIVE DATA] snapshot already holds everything the database does (' + d.beers.length + ' reviews)');
        return;
      }

      beers = d.beers;
      breweries = d.breweries;
      drunkLocs = d.drunkLocs;
      refill(FLAGS, d.FLAGS);
      refill(CNAMES, d.CNAMES);
      refill(BRAND_DOMAINS, d.BRAND_DOMAINS);
      refill(UNTAPPD_GLOBAL_AVGS, d.UNTAPPD_GLOBAL_AVGS);
      refill(WANT_TO_TRY, d.WANT_TO_TRY);
      reloadData();
      console.info('[LIVE DATA] repainted, snapshot merged with the database — ' + d.beers.length + ' reviews');
    }).catch(function (err) {
      console.info('[LIVE DATA] using the data.js snapshot (' + err.message + ')');
    });
  }

  // After load, so app.js has finished its own first paint from the snapshot.
  if (document.readyState === 'complete') hydrate();
  else window.addEventListener('load', hydrate);
})();
