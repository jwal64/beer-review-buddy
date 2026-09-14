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

// Every tools/*.mjs the `check` script runs, named in the order it runs them.
const checkScriptTools = () => [
  ...new Set(JSON.parse(read("package.json")).scripts.check.match(/tools\/[\w-]+\.mjs/g) ?? []),
];

// Each rule: the file it lives in, what has to be there, and what a person
// reading the failure needs to know to put it back.
const RULES = [
  {
    file: "src/lib/snapshot.ts",
    needs: [
      [/export const BEERS/, "`export const BEERS`"],
      [/from "@\/data\/snapshot.json"/, "the import of `@/data/snapshot.json`"],
    ],
    why:
      "The app's entire data layer. src/data/snapshot.json is data.js " +
      "projected into rows, and this is what reads it. There is no database " +
      "behind the app any more, so replacing this with a fetch is not a " +
      'restoration — see CLAUDE.md, "Adding a Beer".',
  },
  {
    file: "src/lib/beer-data.ts",
    needs: [[/from "@\/lib\/snapshot"/, "the import from `@/lib/snapshot`"]],
    why:
      "Every hook here serves the committed log. Pointing one back at a " +
      "network call reintroduces the gap between what is committed and what " +
      "is shown, which is the thing this repo spent longest not noticing.",
  },
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
    file: "package.json",
    needs: [
      [/tools\/roundtrip-snapshot\.mjs/, "`tools/roundtrip-snapshot.mjs` in the check script"],
      [/tools\/app-logic-test\.mjs/, "`tools/app-logic-test.mjs` in the check script"],
    ],
    why:
      "The app reads src/data/snapshot.json rather than data.js, so the " +
      "projection between them has to be proved lossless and proved in step on " +
      "every push — a stale snapshot shows the log as it was before the last " +
      "edit, with nothing else failing. The same goes for the rules inside " +
      "app.js: the location format, the crossing-off rule, MIN_N, the canonical " +
      "location and the shortlist's prediction.",
  },
  {
    // The workflow names its steps one at a time rather than running the whole
    // script, which reads better when one goes red — and drifts in silence when
    // a tool is added to the script and not to the workflow. That gap was real
    // once: a test was named in the check script, described in CLAUDE.md as
    // running on every push, and run by nothing. Green ticks over a test that
    // had never run is the same silence every other check here exists to end.
    file: ".github/workflows/checks.yml",
    needs: checkScriptTools().map((tool) => [
      new RegExp(`node ${tool.replace(/[/.]/g, "\\$&")}`),
      `a \`node ${tool}\` step — the check script runs it, so CI has to`,
    ]),
    why:
      "Every tool in the check script needs a step here, or `npm run check` " +
      "passes locally while CI quietly checks less than it claims to.",
  },
  ...["src/routes/beers.tsx", "src/routes/index.tsx"].map((file) => ({
    file,
    needs: [[/placeLabel\(/, "a `placeLabel(` call"]],
    why: "This surface writes a place, so it writes it through the shared helper.",
  })),
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
