#!/usr/bin/env node
// Tests the comparison inside tools/verify-live.mjs, without a network.
//
// The verifier is the thing that notices when a migration never reached the
// database. A verifier that quietly says "fine" is worse than none at all —
// it is the same silence, with a green tick over it. So its judgement is
// pinned here against a database made to be wrong in each of the ways that
// have actually happened, and one way that must never be called wrong: a
// `numeric` column arriving as the string "2.50".
//
// Runs in milliseconds, needs nothing installed and reaches no network, so
// `npm run check` runs it on every push.
import { loadData } from "./load-data.mjs";
import { toRows } from "../public/stats/supabase-rows.mjs";
import { compareAll } from "./verify-live.mjs";

const expected = toRows(loadData());
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
const kinds = (r) => r.errors.map((e) => e.kind).sort();

// A database that is exactly the file.
check("an in-step database is clean", () => {
  const r = compareAll(expected, clone(expected));
  eq(r.errors.length, 0, "errors");
  eq(r.notices.length, 0, "notices");
});

// PostgREST returns `numeric` as a string. If this ever fails, the verifier
// reports every rating and every coordinate in the file as a difference and
// the real signal drowns.
check("numeric columns arriving as strings are not differences", () => {
  const db = clone(expected);
  const strung = (rows) =>
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          typeof v === "number" ? String(v.toFixed(k === "rating" || k === "abv" ? 2 : 4)) : v,
        ]),
      ),
    );
  db.beers = strung(db.beers);
  db.breweries = strung(db.breweries);
  db.locations = strung(db.locations);
  const r = compareAll(expected, db);
  eq(r.errors.length, 0, "errors");
});

// The failure this whole tool exists for: the merge happened, the migration
// did not run, the newest beer is in the file and nowhere else.
check("a migration that never applied shows as missing rows", () => {
  const db = clone(expected);
  const dropped = db.beers.pop();
  db.brand_domains = db.brand_domains.filter((b) => b.beer_name !== dropped.name);
  const r = compareAll(expected, db);
  eq(kinds(r).join(","), "missing,missing", "kinds");
  eq(r.errors[0].table, "beers", "table");
  eq(r.errors[0].row, `${dropped.name} · ${dropped.drank_on}`, "row label");
});

// Half-applied: the insert ran, the update did not.
check("a value the database disagrees with shows as differs", () => {
  const db = clone(expected);
  db.beers[0].rating = 1.25;
  const r = compareAll(expected, db);
  eq(kinds(r).join(","), "differs", "kinds");
  if (!String(r.errors[0].detail).includes("rating")) throw new Error("detail should name rating");
});

// The Amstel case: PR #13 wrote "Amstel", the correction renamed it to
// "Amstel Light", and the generated SQL — matching on name + drank_on, never
// deleting — would have left the old row behind for good.
check("a rename strands a migration row, and it is an error", () => {
  const db = clone(expected);
  db.beers.push({ ...db.beers.at(-1), name: "Amstel", seq: 999 });
  const r = compareAll(expected, db);
  eq(kinds(r).join(","), "orphan", "kinds");
  eq(r.notices.length, 0, "notices");
  if (!r.errors[0].detail.includes("rename")) throw new Error("detail should explain the rename");
});

// The same shape of leftover, one table over.
check("a stranded brand_domains row is an error too", () => {
  const db = clone(expected);
  db.brand_domains.push({ beer_name: "Amstel", domains: ["amstel.com"], logo: null });
  const r = compareAll(expected, db);
  eq(kinds(r).join(","), "orphan", "kinds");
});

// And the thing that must NOT be called an error: a beer logged in the app.
// Migrations leave those alone on purpose; the answer is `npm run sync`.
check("a beer added through the app is a notice, not an error", () => {
  const db = clone(expected);
  db.beers.push({ ...db.beers.at(-1), name: "Zywiec", seq: null, drank_on: "2026-10-01" });
  db.brand_domains.push({ beer_name: "Zywiec", domains: ["zywiec.com.pl"], logo: null });
  const r = compareAll(expected, db);
  eq(r.errors.length, 0, "errors");
  eq(r.notices.length, 2, "notices");
  eq(r.notices[0].kind, "db-only", "kind");
});

// Two rows on one key: the migration's update would rewrite both.
check("two database rows sharing a key are an error", () => {
  const db = clone(expected);
  db.beers.push(clone(db.beers.at(-1)));
  const r = compareAll(expected, db);
  if (!kinds(r).includes("duplicate")) throw new Error("expected a duplicate");
});

// An empty table reads as "everything is missing", not as "nothing to check".
check("an empty database is every row missing", () => {
  const db = clone(expected);
  db.beers = [];
  const r = compareAll(expected, db);
  eq(r.errors.length, expected.beers.length, "errors");
  eq(
    kinds(r).every((k) => k === "missing"),
    true,
    "all missing",
  );
});

// A null the file writes and a null the database holds are the same absence.
check("null and undefined agree", () => {
  const db = clone(expected);
  db.breweries = db.breweries.map(({ native_name, ...rest }) =>
    native_name === null ? rest : { native_name, ...rest },
  );
  const r = compareAll(expected, db);
  eq(r.errors.length, 0, "errors");
});

console.log("");
if (failures) {
  console.error(`  ${failures} verify-live test(s) failed.\n`);
  process.exit(1);
}
console.log("  verify-live comparison behaves.\n");
