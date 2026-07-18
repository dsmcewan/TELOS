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
const missing = COMMANDS.filter((c) => !spec.includes(`cmd-${c}`));
if (!COMMANDS.length) { console.error("no commands parsed"); process.exit(1); }
if (missing.length) { console.error("UNCOVERED COMMANDS:", missing.join(", ")); process.exit(1); }
console.log(`verify-coverage: all ${COMMANDS.length} registered commands exercised in the E2E suite`);
process.exit(0);
