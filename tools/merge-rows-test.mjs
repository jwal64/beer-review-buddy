#!/usr/bin/env node
// Tests mergeRows() in public/stats/supabase-rows.mjs — the rule that decides
// what the site actually shows.
//
// Why this one is worth pinning. The stats page paints the committed snapshot
// and then hydrates from Supabase. That hydrate used to *replace* the dataset
// with the database's version, so a beer data.js had and the database did not
// appeared for one frame and then vanished. Applying a migration is Lovable's
// step, not this repo's, and generated migrations have sat unapplied for days
// — so "the database is behind the file" is the normal case, not the strange
// one, and the merge is what makes the file readable through it.
//
// A merge that silently drops rows looks exactly like the bug it replaced, so
// each rule below is checked against the shapes that actually occur.
//
// Runs in milliseconds, needs nothing installed and reaches no network.
import { readFileSync } from "node:fs";
import { loadData } from "./load-data.mjs";
import { snapshotText, committedSnapshot } from "./make-snapshot.mjs";
import {
  toRows,
  fromRows,
  mergeRows,
  keyOf,
  KEYS,
  TABLES,
} from "../public/stats/supabase-rows.mjs";

const file = toRows(loadData());
const clone = (o) => JSON.parse(JSON.stringify(o));

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}
const eq = (got, want, what) => {
  if (got !== want) throw new Error(`${what}: expected ${want}, got ${got}`);
};
const hasBeer = (d, name) => d.beers.some((b) => b.beer === name);

// The state that prompted all of this: the migration carrying the newest beer
// never applied, so the database is a whole entry behind the file.
const behind = () => {
  const db = clone(file);
  const newest = file.beers[file.beers.length - 1];
  db.beers = db.beers.filter((b) => b.name !== newest.name);
  db.breweries = db.breweries.filter((b) => b.name !== newest.brewery);
  db.brand_domains = db.brand_domains.filter((b) => b.beer_name !== newest.name);
  return { db, newest };
};

check("a row only the file has survives the merge — the vanishing beer", () => {
  const { db, newest } = behind();
  eq(hasBeer(fromRows(db), newest.name), false, "replacing would drop it");
  eq(hasBeer(fromRows(mergeRows(file, db)), newest.name), true, "merged keeps it");
});

check("its brewery and brand row come with it, not just the review", () => {
  const { db, newest } = behind();
  const d = fromRows(mergeRows(file, db));
  const brewery = d.breweries.find((b) => b.name === newest.brewery);
  if (!brewery) throw new Error("brewery dropped");
  if (!brewery.beers.includes(newest.name)) throw new Error("brewery lists no such beer");
  if (!d.BRAND_DOMAINS[newest.name]) throw new Error("brand domains dropped");
});

check("a row only the database has is kept — a beer added in the app's form", () => {
  const db = clone(file);
  db.beers.push({
    id: "row-from-the-app",
    seq: null,
    created_at: "2026-09-13T10:00:00Z",
    name: "Logged In The App",
    brewery: "Heineken",
    style: "Lager",
    origin_cc: "NL",
    abv: 5,
    method: "Can",
    city: "New York",
    region: "New York",
    country: "USA",
    cc: "US",
    rating: 3.5,
    is_new: true,
    drank_on: "2026-09-13",
    logo: null,
  });
  eq(hasBeer(fromRows(mergeRows(file, db)), "Logged In The App"), true, "kept");
});

check("both at once — the file ahead on one beer, the database on another", () => {
  const { db, newest } = behind();
  db.beers.push({
    id: "x",
    seq: null,
    name: "Logged In The App",
    brewery: "Heineken",
    style: "Lager",
    origin_cc: "NL",
    abv: 5,
    method: "Can",
    city: "New York",
    region: "New York",
    country: "USA",
    cc: "US",
    rating: 3.5,
    is_new: true,
    drank_on: "2026-09-13",
    logo: null,
  });
  const d = fromRows(mergeRows(file, db));
  eq(hasBeer(d, newest.name), true, "the file's beer");
  eq(hasBeer(d, "Logged In The App"), true, "the database's beer");
  eq(d.beers.length, file.beers.length + 1, "review count");
});

// "On a matched row the file wins" is the rule the whole repo is written
// around. The database disagreeing is the shape of a migration's update half
// never running, and the file is what gets to be right.
check("on a row both have, the file's values win", () => {
  const db = clone(file);
  db.beers[0].rating = 1;
  db.beers[0].city = "Nowhere";
  const merged = mergeRows(file, db);
  eq(merged.beers[0].rating, file.beers[0].rating, "rating");
  eq(merged.beers[0].city, file.beers[0].city, "city");
});

// The file has no id or created_at to give — those columns exist only in the
// database — so a merge that let the file win *field by field* rather than
// row by row is what keeps the app able to edit a beer it matched.
check("a column only the database has survives on a matched row", () => {
  const db = clone(file);
  db.beers[0].id = "keep-me";
  db.beers[0].created_at = "2026-01-01T00:00:00Z";
  const merged = mergeRows(file, db);
  eq(merged.beers[0].id, "keep-me", "id");
  eq(merged.beers[0].created_at, "2026-01-01T00:00:00Z", "created_at");
});

check("an in-step database merges to exactly the file", () => {
  const merged = mergeRows(file, clone(file));
  for (const t of TABLES) eq(JSON.stringify(merged[t]), JSON.stringify(file[t]), `${t} unchanged`);
});

check("an empty database merges to exactly the file", () => {
  const merged = mergeRows(file, {});
  for (const t of TABLES) eq(merged[t].length, file[t].length, `${t} length`);
  eq(JSON.stringify(fromRows(merged).beers), JSON.stringify(fromRows(file).beers), "beers");
});

// Every table has to merge, not just the ones a beer touches — a want-to-try
// entry or an Untappd average added to the file lands the same way.
check("every table merges, on its own natural key", () => {
  const db = clone(file);
  for (const t of TABLES) db[t] = [];
  const merged = mergeRows(file, db);
  for (const t of TABLES) eq(merged[t].length, file[t].length, `${t} kept`);
});

check("the same beer drunk twice in one month is two rows, not one", () => {
  // The key is name + drank_on, which is what the migration matches on. Two
  // pours of one beer in one month collapse to one key by design; the check
  // is that the merge does not then lose the other one.
  const db = clone(file);
  const merged = mergeRows(file, db);
  eq(merged.beers.length, file.beers.length, "no rows invented or lost");
  const keys = new Set(file.beers.map((b) => keyOf("beers", b)));
  eq(new Set(merged.beers.map((b) => keyOf("beers", b))).size, keys.size, "key set");
});

// src/lib/snapshot.ts is the same merge, for the app. It has to be written a
// second time because `src/` cannot import a file out of public/ — Vite serves
// that directory as static assets rather than source — and two copies of a
// rule is exactly how this repo lost placeLabel once. So the halves that must
// agree are compared here rather than trusted: a key map that drifts would
// merge on a different notion of "the same row" than the migration updates on,
// and the app would quietly show a duplicate or swallow a review.
const appSrc = readFileSync(new URL("../src/lib/snapshot.ts", import.meta.url), "utf8");

check("the app's key map is the same key map", () => {
  const block = appSrc.match(/const KEYS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error("src/lib/snapshot.ts has no top-level KEYS map");
  const appKeys = {};
  for (const [, table, cols] of block[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g))
    appKeys[table] = cols.match(/"([^"]+)"/g)?.map((q) => q.slice(1, -1)) ?? [];
  eq(JSON.stringify(appKeys), JSON.stringify(KEYS), "KEYS");
});

check("the app knows the same tables, in the same order", () => {
  const block = appSrc.match(/SNAPSHOT_TABLES = \[([\s\S]*?)\] as const;/);
  if (!block) throw new Error("src/lib/snapshot.ts has no SNAPSHOT_TABLES");
  const tables = block[1].match(/"([^"]+)"/g).map((q) => q.slice(1, -1));
  eq(JSON.stringify(tables), JSON.stringify(TABLES), "TABLES");
});

// The app reads a committed projection of data.js rather than data.js itself.
// Stale is the failure that matters, and it is silent: every other check here
// would pass while the app showed the log as it stood before the last edit.
check("the app's snapshot.json is the file, projected", () => {
  eq(committedSnapshot(), snapshotText(), "src/data/snapshot.json");
});

console.log("");
if (failures) {
  console.error(`  ${failures} merge test(s) failed.\n`);
  process.exit(1);
}
console.log("  mergeRows behaves — the file is readable through a stale database.\n");
