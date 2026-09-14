#!/usr/bin/env node
// Writes src/data/snapshot.json — data.js, projected into database rows, for
// the app to read.
//
// Why the app needs its own copy. public/stats/ gets the snapshot for free:
// data.js is a <script> on the page. The app cannot have that — it is a Vite
// bundle, and a file under public/ is a static asset rather than something
// `src/` may import — so the same rows are written here, where `src/` can
// import them, and kept honest by tools/roundtrip-supabase.mjs, which fails
// when this file and data.js disagree.
//
// It is the same projection the migration is generated from (toRows), so the
// app, the stats page, the migration and the verifier are all looking at one
// definition of what a column means.
//
// Written one row per line on purpose. It is 50-odd KB of generated data, and
// pretty-printing it the usual way would turn adding a beer into a diff of
// thousands of lines that nobody can read — the one-row-per-line shape makes
// the same edit three lines.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadData } from "./load-data.mjs";
import { toRows, TABLES } from "./snapshot-rows.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SNAPSHOT_PATH = join(ROOT, "src", "data", "snapshot.json");

export function renderSnapshot(rows) {
  const body = TABLES.map(
    (t) =>
      `  ${JSON.stringify(t)}: [\n` +
      (rows[t] ?? []).map((r) => `    ${JSON.stringify(r)}`).join(",\n") +
      `\n  ]`,
  ).join(",\n");
  return `{\n${body}\n}\n`;
}

export const snapshotText = () => renderSnapshot(toRows(loadData()));

export const committedSnapshot = () =>
  existsSync(SNAPSHOT_PATH) ? readFileSync(SNAPSHOT_PATH, "utf8") : null;

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = snapshotText();
  const changed = committedSnapshot() !== text;
  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, text);
  const rows = toRows(loadData());
  const counts = TABLES.map((t) => `${rows[t].length} ${t}`).join(" · ");
  console.log(`\n${changed ? "Wrote" : "Already in step"} src/data/snapshot.json — ${counts}.\n`);
}
