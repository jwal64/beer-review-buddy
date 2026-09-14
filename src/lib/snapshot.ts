// The committed beer log, merged underneath whatever the database returns.
//
// WHY THIS EXISTS
//
// `public/stats/data.js` is the authoring surface — a beer is added by editing
// it — and `supabase/migrations/` carries that into the database. Applying a
// migration is Lovable's step, not this repo's, and generated migrations have
// sat unapplied for days while every check stayed green. The app read Supabase
// and nothing else, so for all that time a beer that had been added, checked,
// committed and merged simply was not in the app. Nothing looked broken; the
// beer was just missing.
//
// So the app now reads the same way the stats page does: paint what the file
// says, and let the database *add* to it rather than replace it.
//
//   in both       → the file's values win (it is the authoring surface), but
//                   the database's `id` and `created_at` are kept, so the row
//                   stays editable
//   file only     → kept. This is the case that used to disappear
//   database only → kept. A beer logged through this app's own form is exactly
//                   this, and is why the app reads the database at all
//
// The merge rule, and the natural key each table is matched on, are the same
// ones in public/stats/supabase-rows.mjs — tools/merge-rows-test.mjs fails if
// the two definitions of a key ever drift apart. src/ cannot import that file
// (it lives under public/, which Vite serves as a static asset rather than
// source), which is why the key map is written twice and pinned by a test.
import snapshot from "@/data/snapshot.json";

export const SNAPSHOT_TABLES = [
  "countries",
  "locations",
  "breweries",
  "beers",
  "brand_domains",
  "want_to_try",
  "untappd_averages",
  "app_meta",
] as const;

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];

// What makes two rows the same row. `beers` is name + drank_on because that is
// what the generated migration matches on: merging on a different key than the
// SQL updates on would fold together rows the migration treats as distinct.
const KEYS: Record<SnapshotTable, readonly string[]> = {
  countries: ["cc"],
  locations: ["city", "cc"],
  breweries: ["name"],
  beers: ["name", "drank_on"],
  brand_domains: ["beer_name"],
  want_to_try: ["beer"],
  untappd_averages: ["beer_name"],
  app_meta: ["key"],
};

type Row = Record<string, unknown>;

const keyOf = (table: SnapshotTable, row: Row) =>
  KEYS[table].map((k) => String(row[k])).join(" ␟ ");

/**
 * The marker on a row that exists in the file but not in the database.
 *
 * It is a real, stable id so React keys and `<Select>` values work, and it is
 * recognisable so a write can refuse to address a row the database does not
 * have — an `update ... where id = 'snapshot:…'` matches nothing and would
 * report success having changed nothing at all.
 */
export const SNAPSHOT_ID_PREFIX = "snapshot:";

export const isSnapshotOnly = (row: { id?: string | null } | null | undefined) =>
  typeof row?.id === "string" && row.id.startsWith(SNAPSHOT_ID_PREFIX);

// Columns every table has and the projection has no value for, because they
// belong to the database rather than to the log: a synthetic id, and a
// timestamp. For a review the timestamp is the day it was drunk, which is the
// only honest answer and keeps it sorting where it belongs.
function hydrate(table: SnapshotTable, row: Row): Row {
  const drankOn = typeof row["drank_on"] === "string" ? row["drank_on"] : null;
  return {
    created_at: drankOn ? `${drankOn}T00:00:00.000Z` : "1970-01-01T00:00:00.000Z",
    updated_at: "1970-01-01T00:00:00.000Z",
    ...row,
    id: `${SNAPSHOT_ID_PREFIX}${table}:${keyOf(table, row)}`,
  };
}

const FILE_ROWS = snapshot as unknown as Record<SnapshotTable, Row[]>;

// Newest first, which is how the app lists reviews. Within one month every
// row shares a date — data.js records a month, not a day — so `seq` carries
// the order they were logged in, and a row the app added (no seq) is newest.
function compareBeers(a: Row, b: Row) {
  const date = String(b["drank_on"]).localeCompare(String(a["drank_on"]));
  if (date) return date;
  const seq = (Number(b["seq"]) || 0) - (Number(a["seq"]) || 0);
  if (seq) return seq;
  return String(b["created_at"] ?? "").localeCompare(String(a["created_at"] ?? ""));
}

const SORTS: Partial<Record<SnapshotTable, (a: Row, b: Row) => number>> = {
  beers: compareBeers,
  breweries: (a, b) => String(a["name"]).localeCompare(String(b["name"])),
  locations: (a, b) => String(a["city"]).localeCompare(String(b["city"])),
  countries: (a, b) => String(a["name"] ?? "").localeCompare(String(b["name"] ?? "")),
  want_to_try: (a, b) => (Number(a["seq"]) || 0) - (Number(b["seq"]) || 0),
};

/**
 * Merge the committed snapshot of `table` underneath the rows the database
 * returned, in the order the app wants to show them.
 *
 * Returns a new array every call, so callers hold it behind React Query's
 * cache — which is what keeps the map's pins (and its pop-out) from being
 * rebuilt on every render. See the note on the module-scope selects in
 * beer-data.ts.
 */
export function withSnapshot<T>(table: SnapshotTable, dbRows: readonly T[]): T[] {
  const byKey = new Map((dbRows as readonly Row[]).map((r) => [keyOf(table, r), r]));
  const merged: Row[] = (FILE_ROWS[table] ?? []).map((fileRow) => {
    const k = keyOf(table, fileRow);
    const hit = byKey.get(k);
    byKey.delete(k);
    // The file wins on every column it has a value for; the database keeps the
    // ones only it can know — `id` above all, which is what the form edits on.
    return hit ? { ...hit, ...fileRow } : hydrate(table, fileRow);
  });
  for (const only of byKey.values()) merged.push(only);
  const sort = SORTS[table];
  return (sort ? merged.sort(sort) : merged) as T[];
}
