#!/usr/bin/env node
// Turns the current data.js into a Supabase migration — the second half of
// adding a beer. Edit public/stats/data.js, then:
//
//   npm run check       # every rule CLAUDE.md states
//   npm run migration   # writes supabase/migrations/<stamp>_sync_beer_log.sql
//
// Commit both and merge to main. Then check that the database actually got it
// — `npm run verify-live` — because the merge is not the end and the applying
// is not ours. See CLAUDE.md, "Step 6: Verifying the database actually got it".
// The SQL adds and updates only (see tools/export-supabase-seed.mjs) — a beer
// logged through the app's own form is never touched by it.
//
// The check runs first, every time. A migration is applied to the real
// database by machinery with nobody watching, so a data.js that fails its own
// rules must not get as far as generating one.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', 'supabase', 'migrations');

execFileSync(process.execPath, [join(HERE, 'validate-data.mjs')], { stdio: 'inherit' });

const sql = execFileSync(process.execPath, [join(HERE, 'export-supabase-seed.mjs')], {
  encoding: 'utf8',
});

// The SQL is deterministic, so if the newest sync migration already says
// exactly this, the database is already being told everything data.js knows —
// a second copy would apply as a no-op and just be noise in the history.
const previous = readdirSync(MIGRATIONS)
  .filter(f => f.endsWith('_sync_beer_log.sql'))
  .sort()
  .at(-1);
if (previous && readFileSync(join(MIGRATIONS, previous), 'utf8') === sql) {
  console.log(`No migration written — ${previous} already carries exactly this data.`);
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const out = join(MIGRATIONS, `${stamp}_sync_beer_log.sql`);
writeFileSync(out, sql);
console.log(`Wrote ${out}`);
console.log('');
console.log('Commit it together with public/stats/data.js and merge to main.');
console.log('');
console.log('Then make sure the database actually got it:');
console.log('');
console.log('  npm run verify-live');
console.log('');
console.log('Merging is not the end. Applying the migration is Lovable\'s step,');
console.log('not this repo\'s, and generated migrations like this one have sat');
console.log('unapplied for days while every check stayed green — the site does');
console.log('not show the gap, it shows the beer and then loses it on hydration.');
console.log('If verify-live reports missing rows, paste this file into the');
console.log('Supabase SQL editor and run it. That is safe and repeatable.');
