// Loads the log — src/data/log.ts — for the checks and the logo tools.
//
// It is imported, not parsed: Node (22.18+) strips the types itself, so the
// tools see exactly the values the app is built from. log.ts imports nothing
// at runtime (its one import is type-only and erased), which is what keeps it
// loadable here with no build step and no dependencies.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Where the log lives. */
export const LOG_PATH = join(REPO, "src", "data", "log.ts");

/** What a logo path in the log (`logos/<file>`) is relative to. */
export const PUBLIC = join(REPO, "public");

const LOG = await import(LOG_PATH);

/**
 * The log's declarations, as a plain object. A deep copy, so a tool that
 * mutates what it was handed cannot change what the next caller sees.
 */
export function loadData() {
  return structuredClone({ ...LOG });
}
