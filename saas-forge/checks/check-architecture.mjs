#!/usr/bin/env node
// check-architecture.mjs — deterministic test for the `architecture` build node.
// Runs with cwd = project root (set by defaultVerifyNode). Asserts the generated
// architecture doc exists and references every library passed as an arg (the
// researched stack). Exits non-zero on any failure so the node never settles.

import { existsSync, readFileSync, statSync } from "node:fs";

function fail(msg) {
  console.error(`check-architecture: ${msg}`);
  process.exit(1);
}

const DOC = "docs/ARCHITECTURE.md";
if (!existsSync(DOC) || statSync(DOC).size === 0) fail(`missing or empty ${DOC}`);

const doc = readFileSync(DOC, "utf8");
const required = process.argv.slice(2);
for (const lib of required) {
  if (!doc.includes(lib)) fail(`architecture doc does not reference required stack library: ${lib}`);
}

console.log(`check-architecture: OK (${required.length} stack libraries referenced)`);
