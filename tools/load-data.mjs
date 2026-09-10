// Loads data.js the way the browser does — by executing it — so the checks run
// against the same values the site renders, not against a parse of the source.
//
// data.js is plain browser JavaScript with no imports and no exports, which is
// exactly what makes it loadable here: it declares top-level bindings and does
// nothing else. Running it in a fresh vm context with no globals also proves
// that: anything reaching for `window`, `fetch` or `document` throws instead of
// quietly working.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

// The site — data.js, app.js, logos/ — lives in public/stats/, served whole by
// the app around it. The tools read it there.
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
const OPTIONAL = ["BRAND_LOGOS"];

export function loadData(root = ROOT) {
  const src = readFileSync(join(root, "data.js"), "utf8");
  const collect =
    `\n;({${EXPORTS.join(",")}` +
    OPTIONAL.map((n) => `,${n}:typeof ${n}==='undefined'?undefined:${n}`).join("") +
    `});\n`;
  return vm.runInNewContext(src + collect, Object.create(null), { filename: "data.js" });
}

// app.js is the app, not data — it can't be executed outside a browser: it
// reads the DOM at top level and draws charts into it. Its rules are testable
// all the same, because the ones worth testing are pure functions of their
// arguments sitting at the top level of the file. Lift those declarations out
// by name and evaluate them alone, so a check runs the app's own definition
// rather than a copy of it that can drift.

// Where a declaration ends. Read character by character rather than matched
// with a regular expression, because app.js holds all three things that make
// a regular expression wrong here: an apostrophe inside a `//` comment, a `{`
// inside a string, and a `/` that opens a regex rather than dividing.
const QUOTES = new Set(['"', "'"]);

// A `/` starts a regex rather than a division when what precedes it cannot end
// an expression. app.js divides (`sM.t/sM.c` in predictRating) and writes
// regexes (the escapes in `esc`, the flattening in `wtNorm`), and telling the
// two apart is what decides whether a `'` inside is a quote.
const BEFORE_REGEX = new Set([..."(,=:[!&|?{};+-*%~^<>", undefined]);

function prevMeaningful(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  return j < 0 ? undefined : src[j];
}

function skipQuoted(src, i) {
  const q = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] === q) return j + 1;
  }
  throw new Error("unterminated string in app.js");
}

function skipRegex(src, i) {
  let inClass = false;
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] === "[") inClass = true;
    else if (src[j] === "]") inClass = false;
    else if (src[j] === "/" && !inClass) return j + 1; // flags are plain letters
  }
  throw new Error("unterminated regex in app.js");
}

function skipTemplate(src, i) {
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] === "`") return j + 1;
    if (src[j] === "$" && src[j + 1] === "{") {
      // A hole holds expression code, which can carry strings, regexes and
      // templates of its own, so walk it the same way the file is walked.
      let depth = 1;
      j += 2;
      while (j < src.length && depth) {
        if (src[j] === "{") {
          depth++;
          j++;
        } else if (src[j] === "}") {
          depth--;
          j++;
        } else j = step(src, j);
      }
      j--; // the loop's own j++ lands on the character after the hole
    }
  }
  throw new Error("unterminated template literal in app.js");
}

// Advance past whatever starts at i — a comment, a string, a template, a
// regex — or by a single plain character.
function step(src, i) {
  const c = src[i],
    n = src[i + 1];
  if (c === "/" && n === "/") {
    const e = src.indexOf("\n", i);
    return e < 0 ? src.length : e;
  }
  if (c === "/" && n === "*") {
    const e = src.indexOf("*/", i + 2);
    return e < 0 ? src.length : e + 2;
  }
  if (QUOTES.has(c)) return skipQuoted(src, i);
  if (c === "`") return skipTemplate(src, i);
  if (c === "/" && BEFORE_REGEX.has(prevMeaningful(src, i))) return skipRegex(src, i);
  return i + 1;
}

function declEnd(src, start, isFunction) {
  let depth = 0,
    body = false;
  for (let i = start; i < src.length;) {
    const next = step(src, i);
    if (next > i + 1) {
      i = next;
      continue;
    } // a comment, string, template or regex, whole
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") {
      depth++;
      if (c === "{") body = true;
    } else if (c === ")" || c === "]" || c === "}") {
      depth--;
      // A function declaration ends when its body closes; a const ends at the
      // `;`, which is what carries `const f = () => {…};` past the same brace.
      if (isFunction && body && depth === 0) return i + 1;
    } else if (!isFunction && c === ";" && depth === 0) return i + 1;
    i++;
  }
  throw new Error("a declaration in app.js never ends");
}

// The source text of one top-level declaration, by name. `^` under the `m`
// flag is what keeps this to the top level: everything nested is indented.
function lift(src, name) {
  const m = new RegExp(`^(?:const|let|function)\\s+${name}\\b`, "m").exec(src);
  if (!m) throw new Error(`app.js has no top-level declaration of \`${name}\``);
  return {
    at: m.index,
    text: src.slice(m.index, declEnd(src, m.index, m[0].startsWith("function"))),
  };
}

/**
 * Evaluate named top-level declarations from app.js, and hand them back.
 *
 * `globals` becomes the context's global object — the free variables the
 * lifted code reads (`beers`, `STATS`, `FLAGS`) are supplied through it, and
 * it stays live, so assigning to it afterwards is what the next case sees.
 * Anything not supplied throws a ReferenceError rather than quietly working.
 */
export function loadAppScope(names, globals = {}, root = ROOT) {
  const src = readFileSync(join(root, "app.js"), "utf8");
  // Source order, so a declaration is never read before the one it is built
  // from — and so the evaluated text reads like the file it came from.
  const decls = names.map((n) => lift(src, n)).sort((a, b) => a.at - b.at);
  // Top-level `const`/`let` are lexical: they never become properties of the
  // context, so the script ends with an expression that collects them.
  const collect = `\n;({${names.join(",")}});\n`;
  return vm.runInContext(decls.map((d) => d.text).join("\n") + collect, vm.createContext(globals), {
    filename: "app.js",
  });
}

// The style → colour map every style has to appear in, and the name
// normaliser that decides when a shortlist entry and a review are the same
// beer: data contracts that happen to live in app.js.
export function loadStyleColors(root = ROOT) {
  return loadAppScope(["sC"], {}, root).sC;
}

export function loadAppConst(name, root = ROOT) {
  return loadAppScope([name], {}, root)[name];
}
