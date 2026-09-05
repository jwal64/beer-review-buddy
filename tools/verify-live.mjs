#!/usr/bin/env node
// Asks the live database whether it actually holds what data.js says it holds.
//
// Adding a beer is five steps and only the first four happen in this repo:
// edit public/stats/data.js, `npm run migration`, commit, merge to main — and
// then Lovable applies the new file in supabase/migrations/. That last step is
// somebody else's machinery. Nothing here can force it, and until this tool
// existed nothing here could even tell whether it had happened.
//
// It failing silently is the expensive part. public/stats/live-data.js paints
// the committed snapshot first and then, if the database disagrees, *replaces
// the whole dataset with the database's version* and repaints. So a migration
// that never applied does not leave the new beer on screen — the beer appears
// for a moment and then vanishes, which reads exactly like the edit never
// happened. The app is blunter still: src/ reads Supabase and nothing else, so
// the beer simply is not there.
//
//   npm run verify-live                 # compare now
//   npm run verify-live -- --wait 900   # give Lovable up to 15 minutes first
//   npm run verify-live -- --json out.json
//
// Exit codes are the point of the thing:
//
//   0  the database agrees with data.js (notices may still be printed)
//   1  it does not — something in data.js never reached the database
//   2  the database could not be reached at all, so nothing was checked;
//      --strict makes that a failure instead, which is what CI wants so a run
//      that checked nothing cannot read as all-clear.
//
// It reads with the publishable key — public by design, the same one the app
// and the stats page ship to every browser, and allowed only what row-level
// security grants the anonymous role: reading. This tool never writes.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadData } from "./load-data.mjs";
import { toRows, TABLES } from "../public/stats/supabase-rows.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const arg = (n, d) => {
  const i = argv.indexOf(n);
  return i === -1 ? d : argv[i + 1];
};

const WAIT = Math.max(0, Number(arg("--wait", 0)) || 0);
const POLL = Math.max(5, Number(arg("--poll", 30)) || 30);
const STRICT = flag("--strict");
const JSON_OUT = arg("--json", null);

// ── Which row is which ────────────────────────────────────────
//
// The natural key of each table — what makes two rows the same row. `beers`
// uses name + drank_on because that is exactly what the generated migration
// matches on (tools/export-supabase-seed.mjs): checking on a different key
// than the SQL updates on would report differences the migration could never
// have fixed.
const KEYS = {
  countries: ["cc"],
  locations: ["city", "cc"],
  breweries: ["name"],
  beers: ["name", "drank_on"],
  brand_domains: ["beer_name"],
  want_to_try: ["beer"],
  untappd_averages: ["beer_name"],
  app_meta: ["key"],
};

const keyOf = (table, row) => KEYS[table].map((k) => String(row[k])).join(" ␟ ");
const label = (table, row) => KEYS[table].map((k) => row[k]).join(" · ");

// ── Comparing a value ─────────────────────────────────────────
//
// PostgREST hands back a `numeric` column as a string — `rating` and `abv`
// both are — so "3.50" and 3.5 are the same rating and must not be reported as
// a difference. Coordinates get a whisker of tolerance for the same reason a
// float always does. Everything else is compared as text.
const EPS = 1e-9;
function same(exp, act) {
  if (exp === null || exp === undefined) return act === null || act === undefined;
  if (act === null || act === undefined) return false;
  if (Array.isArray(exp)) {
    return Array.isArray(act) && act.length === exp.length && exp.every((v, i) => same(v, act[i]));
  }
  if (typeof exp === "number") {
    const n = act === "" ? NaN : Number(act);
    return Number.isFinite(n) && Math.abs(n - exp) <= EPS * Math.max(1, Math.abs(exp));
  }
  if (typeof exp === "boolean") return Boolean(act) === exp;
  return String(act) === String(exp);
}

const show = (v) => (v === null || v === undefined ? "null" : JSON.stringify(v));

// ── The comparison ────────────────────────────────────────────
//
// Three verdicts, and which one a row gets is the whole design:
//
//   missing  data.js has it, the database does not → the migration carrying it
//            was never applied. An error.
//   differs  both have it and they disagree → the update half of the migration
//            never ran. On a match the file wins, so this is an error too.
//   orphan   the database has a row data.js does not, and it was written by a
//            migration rather than by the app. That is what a rename leaves
//            behind: reviews are matched on name + drank_on and the generated
//            SQL never deletes, so changing a beer's name inserts the new row
//            and strands the old one. An error — the fix is an explicit delete
//            in the next migration. (`seq` is the tell: the seed sets it, the
//            app's own form never does. The schema says so at
//            supabase/migrations/20260901120000_beer_buddy_source_of_truth.sql:28.)
//
// And one verdict that is not an error at all:
//
//   db-only  a row only the database knows, that the app plausibly wrote —
//            a beer logged through the form. Migrations leave those alone by
//            design; the answer is `npm run sync`, not alarm.
export function compareAll(expected, actual) {
  const errors = [];
  const notices = [];

  // A beer the app wrote brings its brand_domains row with it, so an extra
  // domain row is only innocent if some beer, anywhere, still uses it.
  const liveBeerNames = new Set([
    ...(actual.beers ?? []).map((r) => r.name),
    ...(actual.want_to_try ?? []).map((r) => r.beer),
  ]);

  for (const table of TABLES) {
    const exp = expected[table] ?? [];
    const act = actual[table] ?? [];
    const actBy = new Map();
    for (const row of act) {
      const k = keyOf(table, row);
      // Two rows sharing a natural key is itself a problem: the migration's
      // update would rewrite both, and the stats page would render a duplicate.
      if (actBy.has(k)) {
        errors.push({
          kind: "duplicate",
          table,
          row: label(table, row),
          detail: "two rows in the database share this key",
        });
      }
      actBy.set(k, row);
    }

    const seen = new Set();
    for (const row of exp) {
      const k = keyOf(table, row);
      seen.add(k);
      const live = actBy.get(k);
      if (!live) {
        errors.push({ kind: "missing", table, row: label(table, row) });
        continue;
      }
      // Only the columns data.js is the author of. The database's own id and
      // timestamps are not data.js's business.
      const bad = Object.keys(row)
        .filter((c) => !same(row[c], live[c]))
        .map((c) => `${c}: file ${show(row[c])} ≠ db ${show(live[c])}`);
      if (bad.length) errors.push({ kind: "differs", table, row: label(table, row), detail: bad });
    }

    for (const [k, row] of actBy) {
      if (seen.has(k)) continue;
      const stranded =
        table === "beers"
          ? row.seq !== null && row.seq !== undefined
          : table === "brand_domains" || table === "untappd_averages"
            ? !liveBeerNames.has(row.beer_name)
            : false;
      if (stranded) {
        errors.push({
          kind: "orphan",
          table,
          row: label(table, row),
          detail:
            table === "beers"
              ? `written by a migration (seq ${row.seq}) but no longer in data.js — a rename left it behind`
              : "names a beer that exists nowhere — left behind by a rename",
        });
      } else {
        notices.push({ kind: "db-only", table, row: label(table, row) });
      }
    }
  }

  return { errors, notices };
}

// ── Where the database is ─────────────────────────────────────
//
// Env first (so a run can be pointed somewhere else), then the tracked .env
// the app builds against, then the constants in live-data.js. Whichever wins,
// live-data.js is cross-checked against it: the stats page reading a different
// project than this tool verified would make every result here meaningless.
function readPairs(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function connection() {
  const env = existsSync(join(ROOT, ".env"))
    ? readPairs(readFileSync(join(ROOT, ".env"), "utf8"))
    : {};
  const live = readFileSync(join(ROOT, "public", "stats", "live-data.js"), "utf8");
  const grab = (re) => (re.exec(live) || [])[1] ?? null;
  const liveUrl = grab(/SUPABASE_URL\s*=\s*'([^']+)'/);
  const liveKey = grab(/SUPABASE_KEY\s*=\s*'([^']+)'/);

  const url = process.env.SUPABASE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL || liveUrl;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    liveKey;
  if (!url || !key) throw new Error("no Supabase URL/key found in env, .env or live-data.js");

  const warn =
    liveUrl && liveUrl.replace(/\/$/, "") !== String(url).replace(/\/$/, "")
      ? `the stats page hydrates from ${liveUrl}, which is not the database checked here (${url})`
      : null;
  return { url: String(url).replace(/\/$/, ""), key, warn };
}

async function fetchAll({ url, key }) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const PAGE = 1000;
  const out = {};
  for (const table of TABLES) {
    const rows = [];
    for (let offset = 0; ; offset += PAGE) {
      const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=${PAGE}&offset=${offset}`, {
        headers,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${table} → HTTP ${res.status} ${body}`.trim());
      }
      const page = await res.json();
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    out[table] = rows;
  }
  return out;
}

// ── Reporting ─────────────────────────────────────────────────

function render({ errors, notices }, expected, actual) {
  const lines = [];
  const n = (t, rows) => `${rows.length} ${t}`;
  lines.push("");
  lines.push(
    `  data.js  ${expected.beers.length} reviews · ${expected.breweries.length} breweries · ${expected.brand_domains.length} brands`,
  );
  lines.push(
    `  database ${actual.beers.length} reviews · ${actual.breweries.length} breweries · ${actual.brand_domains.length} brands`,
  );
  lines.push("");

  if (errors.length) {
    const missing = errors.filter((e) => e.kind === "missing");
    lines.push(`  ${errors.length} problem(s):`);
    lines.push("");
    for (const e of errors) {
      lines.push(`   ✗ ${e.kind.padEnd(9)} ${e.table} — ${e.row}`);
      for (const d of [].concat(e.detail ?? [])) lines.push(`       ${d}`);
    }
    lines.push("");
    if (missing.length) {
      lines.push("  Rows data.js has that the database does not mean the migration");
      lines.push("  carrying them was never applied. Fix it by hand in a minute:");
      lines.push("");
      lines.push("    open the newest supabase/migrations/*_sync_beer_log.sql,");
      lines.push("    paste it into the Supabase SQL editor, run it.");
      lines.push("");
      lines.push("  It is add-and-update only, so running it is safe even if");
      lines.push("  Lovable later applies it too.");
      lines.push("");
    }
    if (errors.some((e) => e.kind === "orphan")) {
      lines.push("  An orphan is a row a rename stranded: the generated SQL matches");
      lines.push("  a review on name + drank_on and never deletes, so the new name");
      lines.push("  was inserted and the old row stayed. Add an explicit");
      lines.push("  `delete from public.<table> where …` at the top of the next");
      lines.push("  migration, the way 20260905170720_sync_beer_log.sql does.");
      lines.push("");
    }
  }

  if (notices.length) {
    lines.push(`  ${notices.length} row(s) only the database has — normal for a beer added`);
    lines.push("  through the app's own form. Run `npm run sync` to bring them into");
    lines.push("  data.js:");
    lines.push("");
    for (const x of notices) lines.push(`   · ${x.table} — ${x.row}`);
    lines.push("");
  }

  if (!errors.length && !notices.length) {
    lines.push("  The database holds exactly what data.js holds. Nothing to do.");
    lines.push("");
  } else if (!errors.length) {
    lines.push("  Everything data.js holds is in the database.");
    lines.push("");
  }
  return lines.join("\n");
}

// ── Run ───────────────────────────────────────────────────────

// Importing this file — the test alongside it does — must not set off a run.
// Only being the thing node was pointed at does that.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const expected = toRows(loadData());
  let conn;
  try {
    conn = connection();
  } catch (err) {
    console.error(`\n  Cannot verify: ${err.message}\n`);
    process.exit(STRICT ? 1 : 2);
  }
  if (conn.warn) console.warn(`\n  ! ${conn.warn}\n`);

  const deadline = Date.now() + WAIT * 1000;
  let result,
    actual,
    unreachable = null;

  for (;;) {
    try {
      actual = await fetchAll(conn);
      unreachable = null;
      result = compareAll(expected, actual);
    } catch (err) {
      unreachable = err;
      result = null;
    }

    const settled = result && !result.errors.length;
    const timeLeft = deadline - Date.now();
    if (settled || timeLeft <= 0) break;

    // Lovable applies a migration some minutes after the merge, so a difference
    // right after a push is not yet news. Only wait on something that waiting
    // could fix — a database that is behind, or one that would not answer.
    const why = unreachable
      ? `unreachable (${unreachable.message})`
      : `${result.errors.length} difference(s)`;
    const secs = Math.min(POLL, Math.ceil(timeLeft / 1000));
    console.log(`  ${why} — waiting ${secs}s, ${Math.ceil(timeLeft / 1000)}s left`);
    await new Promise((r) => setTimeout(r, secs * 1000));
  }

  if (unreachable) {
    console.error(`\n  Could not reach the database — nothing was checked.`);
    console.error(`  ${unreachable.message}`);
    console.error(`\n  A sandbox with no route to Supabase looks exactly like this;`);
    console.error(`  so does the project being down. Neither is a pass.\n`);
    process.exit(STRICT ? 1 : 2);
  }

  const report = render(result, expected, actual);
  console.log(report);

  if (JSON_OUT) {
    writeFileSync(
      JSON_OUT,
      JSON.stringify(
        {
          checkedAt: new Date().toISOString(),
          url: conn.url,
          counts: {
            file: Object.fromEntries(TABLES.map((t) => [t, (expected[t] ?? []).length])),
            db: Object.fromEntries(TABLES.map((t) => [t, (actual[t] ?? []).length])),
          },
          errors: result.errors,
          notices: result.notices,
          report,
        },
        null,
        2,
      ) + "\n",
    );
  }

  process.exit(result.errors.length ? 1 : 0);
}
