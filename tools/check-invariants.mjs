#!/usr/bin/env node
// Fails when a feature that has already been reverted twice has been reverted
// again.
//
// Two of them, both described in CLAUDE.md and repeated for Lovable in
// AGENTS.md: the map pop-out that stays open, and the single City, Region,
// Country location format. Neither was ever deleted on purpose. An editing
// pass branched from a commit older than the merge that added them, then
// resolved its own merge back into main in favour of its copy of every file it
// had touched — so src/lib/place.ts was deleted and the two module-scope
// React Query selects were folded back inline, inside a merge commit whose
// subject was something else entirely. Nothing noticed. The map's popup began
// closing on click again and the same place read three ways on one page, and
// both were found by looking at the app rather than by a check.
//
// This is that check. It is deliberately shallow — it asks whether the load-
// bearing shapes are still in the files, not whether they still work — because
// what it is defending against is a whole feature going missing, not a subtle
// regression inside one. A grep is enough to catch a deletion, and a grep needs
// nothing installed, which is what lets it run beside the other tools/ checks
// on a bare runner.
//
//     node tools/check-invariants.mjs
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const read = (f) => (existsSync(join(REPO, f)) ? readFileSync(join(REPO, f), "utf8") : null);

// Each rule: the file it lives in, what has to be there, and what a person
// reading the failure needs to know to put it back.
const RULES = [
  {
    file: "src/lib/place.ts",
    needs: [[/export function placeLabel/, "`export function placeLabel`"]],
    why:
      "The app's half of the City, Region, Country format. Deleting it, or " +
      "inlining it back into its callers, is the revert CLAUDE.md's " +
      '"Location Rule: City, Region, Country" describes.',
  },
  {
    file: "src/lib/beer-data.ts",
    needs: [
      [/^const selectBrandDomains\s*=/m, "`const selectBrandDomains =` at module scope"],
      [/^const selectBrandLogos\s*=/m, "`const selectBrandLogos =` at module scope"],
    ],
    why:
      "These two must stay at module scope. React Query memoises a select's " +
      "result on the select function's identity, so an inline arrow rebuilds " +
      "the Map every render, the map page redraws its pins on every click, and " +
      "clearLayers() closes the popup the click just opened. See CLAUDE.md, " +
      '"Map Rule: The Pop-out Stays Open".',
  },
  {
    file: "src/routes/map.tsx",
    needs: [
      [/placeLabel\(/, "a `placeLabel(` call"],
      [/withBrewery/, "`withBrewery` — the city popup names each beer's brewery"],
      [
        /title:\s*placeLabel\(/,
        "`title: placeLabel(` — the filter heading names the place in full",
      ],
    ],
    why:
      "The map popup writes its place the same way every other surface does, " +
      "and a city dot answers with the beer, the place and who made it.",
  },
  {
    file: "public/stats/app.js",
    needs: [[/^const placeLabel\s*=/m, "`const placeLabel =`"]],
    why:
      "The stats site's half of the same format. Without it the map popup, the " +
      "beers table, the city cards and the highlights each invent their own.",
  },
  {
    file: ".github/workflows/verify-live.yml",
    needs: [
      [/node tools\/verify-live\.mjs/, "a `node tools/verify-live.mjs` run"],
      [/branches:\s*\[main\]/, "`branches: [main]` — it has to run on the merge"],
    ],
    why:
      "The only thing that notices when a migration is merged to main and then " +
      "never applied to Supabase. Without it that failure is silent: live-data.js " +
      "replaces the committed snapshot with the database's version, so the new " +
      "beer appears for a moment and then vanishes. See CLAUDE.md, " +
      '"Verifying the database actually got it".',
  },
  {
    file: "tools/verify-live.mjs",
    needs: [[/export function compareAll/, "`export function compareAll`"]],
    why:
      "The comparison the workflow runs, and the export its test drives. " +
      "Deleting either leaves the workflow green over nothing.",
  },
  {
    file: "package.json",
    needs: [[/tools\/verify-live-test\.mjs/, "`tools/verify-live-test.mjs` in the check script"]],
    why:
      'A verifier that quietly says "fine" is worse than no verifier, so its ' +
      "judgement is pinned by a test that npm run check runs on every push.",
  },
  ...["src/routes/beers.tsx", "src/routes/index.tsx", "src/components/BeerForm.tsx"].map(
    (file) => ({
      file,
      needs: [[/placeLabel\(/, "a `placeLabel(` call"]],
      why: "This surface writes a place, so it writes it through the shared helper.",
    }),
  ),
];

const problems = [];

for (const { file, needs, why } of RULES) {
  const src = read(file);
  if (src === null) {
    problems.push(`${file} is missing.\n    ${why}`);
    continue;
  }
  for (const [pattern, what] of needs) {
    if (!pattern.test(src)) problems.push(`${file} no longer contains ${what}.\n    ${why}`);
  }
}

if (problems.length) {
  console.error("\nA feature that must survive every pass has gone missing:\n");
  for (const p of problems) console.error(`  ✗ ${p}\n`);
  console.error(
    "These are intentional and finished. Restore them rather than relaxing this\n" +
      "check — it exists because the same two features have been reverted twice by\n" +
      "a merge that resolved a stale branch in its own favour. AGENTS.md says what\n" +
      'to keep; CLAUDE.md says why, under "Features that must survive every pass".\n',
  );
  process.exit(1);
}

console.log(`✓ ${RULES.length} standing features still in place`);
