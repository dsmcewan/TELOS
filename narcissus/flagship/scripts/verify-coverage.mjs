// Functional-blade contract: coverage == inventory. Every command in the closed registry must be exercised
// (referenced as cmd-<COMMAND>) by the E2E suite, else the surface has an untested interactive action.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const cmdSrc = readFileSync(path.join(HERE, "../src/commands.ts"), "utf8");
const start = cmdSrc.indexOf("COMMANDS = [");
const COMMANDS = [...cmdSrc.slice(start).matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
const spec = readFileSync(path.join(HERE, "../tests/e2e/flagship.spec.ts"), "utf8");
// A cmd-<COMMAND> reference counts only when it appears INSIDE a test body —
// comment-stripped and after the first `test(` — so a mention in a header
// comment or import can never satisfy coverage.
const stripped = spec.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const firstTest = stripped.indexOf("test(");
const testRegion = firstTest >= 0 ? stripped.slice(firstTest) : "";
const missing = COMMANDS.filter((c) => !testRegion.includes(`cmd-${c}`));
if (!COMMANDS.length) { console.error("no commands parsed"); process.exit(1); }
if (firstTest < 0) { console.error("no test( blocks found in the E2E spec"); process.exit(1); }
if (missing.length) { console.error("UNCOVERED COMMANDS:", missing.join(", ")); process.exit(1); }
console.log(`verify-coverage: all ${COMMANDS.length} registered commands exercised in the E2E suite`);
process.exit(0);
