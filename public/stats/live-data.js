// Hydrates the page from the Supabase database behind the app, then repaints.
//
// data.js, loaded before this, is a committed snapshot: it paints instantly,
// works offline, and is what every check in tools/ validates. This script then
// fetches what the database holds right now — the same tables the app writes —
// and, only if anything differs from the snapshot, swaps it in and calls
// reloadData() (app.js). A beer added minutes ago appears without a deploy.
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
      var d = loaded[0].fromRows(rowsByTable);
      // An empty read is a failed read: the snapshot is never traded for
      // nothing.
      if (!d.beers.length || !d.breweries.length) throw new Error('empty read');

      var same =
        JSON.stringify([d.beers, d.breweries, d.drunkLocs, d.WANT_TO_TRY, d.BRAND_DOMAINS, d.UNTAPPD_GLOBAL_AVGS]) ===
        JSON.stringify([beers, breweries, drunkLocs, WANT_TO_TRY, BRAND_DOMAINS, UNTAPPD_GLOBAL_AVGS]);
      if (same) {
        console.info('[LIVE DATA] snapshot already matches the database (' + d.beers.length + ' reviews)');
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
      console.info('[LIVE DATA] repainted from the database — ' + d.beers.length + ' reviews');
    }).catch(function (err) {
      console.info('[LIVE DATA] using the data.js snapshot (' + err.message + ')');
    });
  }

  // After load, so app.js has finished its own first paint from the snapshot.
  if (document.readyState === 'complete') hydrate();
  else window.addEventListener('load', hydrate);
})();
