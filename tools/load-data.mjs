// Loads data.js by executing it, so the checks run against the values it
// declares rather than against a parse of the source.
//
// data.js is plain JavaScript with no imports and no exports, which is
// exactly what makes it loadable here: it declares top-level bindings and does
// nothing else. Running it in a fresh vm context with no globals also proves
// that: anything reaching for `window`, `fetch` or `document` throws instead of
// quietly working.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

// The log — data.js — and the committed logos live in public/stats/.
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "stats");

// Top-level `const`/`let` are lexical — they never become properties of the vm
// context — so the script ends with an expression that collects them, and the
// script's completion value hands them back.
const EXPORTS = [
  "FLAGS",
  "CNAMES",
  "beers",
  "drunkLocs",
  "breweries",
  "BRAND_DOMAINS",
  "UNTAPPD_GLOBAL_AVGS",
  "UNTAPPD_LAST_REFRESHED",
  "UNTAPPD_REFRESH_INTERVAL_DAYS",
  "WANT_TO_TRY",
];

// Declarations a data.js may not have yet. Collected with a typeof guard so an
// older file — one written before the binding existed — loads and reads as
// empty, rather than throwing a ReferenceError from the collector and taking
// every check down with it.
const OPTIONAL = ["BRAND_LOGOS", "BEER_FACTS"];

export function loadData(root = ROOT) {
  const src = readFileSync(join(root, "data.js"), "utf8");
  const collect =
    `\n;({${EXPORTS.join(",")}` +
    OPTIONAL.map((n) => `,${n}:typeof ${n}==='undefined'?undefined:${n}`).join("") +
    `});\n`;
  return vm.runInNewContext(src + collect, Object.create(null), { filename: "data.js" });
}
