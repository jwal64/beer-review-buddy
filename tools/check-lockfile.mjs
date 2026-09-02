#!/usr/bin/env node
// Fails when bun.lock and package.json disagree about what this project
// depends on.
//
// CLAUDE.md asks for `bun install` to be run alongside every package.json
// edit, because Lovable builds with bun and refuses a manifest its lockfile
// disagrees with. Nothing checked that it had been: npm — which CI and the
// session hook use — reads package.json and never looks at bun.lock, so a
// forgotten `bun install` passed every check here and surfaced as a failed
// Lovable deploy after the merge, which is the slowest place to learn it.
//
// The obvious check, `bun install --frozen-lockfile`, cannot run here. Eleven
// resolution URLs in bun.lock point at Lovable's own registry mirror
// (europe-west4-npm.pkg.dev/lovable-core-prod), which answers 403 to anyone
// outside their sandbox — so an install on a runner fails for a reason that
// has nothing to do with drift, and a check that always fails teaches nobody
// anything.
//
// So this compares the two files as text instead: every dependency in the
// manifest must appear in the lockfile's workspace block under the same
// range, and vice versa. No network, no registry, no install — which is also
// why it can live in tools/ with everything else that needs nothing.
//
//     node tools/check-lockfile.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './load-data.mjs';

// ROOT is public/stats/; the manifest and lockfile sit at the repo root.
const REPO = join(ROOT, '..', '..');

// Bun writes a text lockfile — JSON but for trailing commas, which JSON.parse
// refuses. Strip those rather than take a dependency on a JSON5 parser.
const readLock = () => JSON.parse(
  readFileSync(join(REPO, 'bun.lock'), 'utf8').replace(/,(\s*[}\]])/g, '$1'));

const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
const lock = readLock();

const workspace = lock.workspaces?.[''];
if (!workspace) {
  console.error('bun.lock has no root workspace — is it a bun text lockfile?');
  process.exit(1);
}

const errors = [];

// optionalDependencies are deliberately left out: bun records them in the
// workspace block only when they resolve, so requiring them here would fail
// on a platform-specific package that simply did not apply.
for (const field of ['dependencies', 'devDependencies']) {
  const manifest = pkg[field] ?? {};
  const locked = workspace[field] ?? {};

  for (const [name, range] of Object.entries(manifest)) {
    if (!(name in locked)) {
      errors.push(`${field}: "${name}" is in package.json but not in bun.lock — run \`bun install\``);
    } else if (locked[name] !== range) {
      errors.push(`${field}: "${name}" is ${range} in package.json but ${locked[name]} in bun.lock — run \`bun install\``);
    }
  }

  for (const name of Object.keys(locked)) {
    if (!(name in manifest)) {
      errors.push(`${field}: "${name}" is in bun.lock but no longer in package.json — run \`bun install\``);
    }
  }
}

const counted = ['dependencies', 'devDependencies']
  .reduce((n, f) => n + Object.keys(pkg[f] ?? {}).length, 0);

if (errors.length) {
  console.error(`\n${errors.length} lockfile error(s):`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('\nbun.lock is out of step with package.json. Lovable installs with bun,');
  console.error('so this fails its build after the merge unless it is fixed first.\n');
  process.exit(1);
}

console.log(`\nLockfile in step — ${counted} dependencies agree across package.json and bun.lock.\n`);
