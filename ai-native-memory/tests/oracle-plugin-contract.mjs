#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tests = [
  "test-lib.mjs",
  "test-audit.mjs",
  "test-gate.mjs",
  "test-init.mjs",
  "test-verify.mjs"
];
let failed = 0;
for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(HERE, test)], { stdio: "inherit" });
  if (result.status !== 0) failed++;
}
console.log(`oracle-plugin-contract: ${tests.length - failed}/${tests.length} checks passed`);
process.exit(failed ? 1 : 0);
