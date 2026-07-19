#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  packageBoundaryProblems,
  readJson
} from "../scripts/lib/record.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootIndex = process.argv.indexOf("--root");
if (rootIndex >= 0 && !process.argv[rootIndex + 1]) {
  console.error("oracle-plugin-contract: --root requires a path");
  process.exit(1);
}
const ROOT = rootIndex >= 0
  ? path.resolve(process.argv[rootIndex + 1])
  : path.dirname(scriptDirectory);
const HERE = path.join(ROOT, "tests");
const tests = [
  "test-lib.mjs",
  "test-audit.mjs",
  "test-gate.mjs",
  "test-init.mjs",
  "test-verify.mjs"
];
let failed = 0;
try {
  const contract = readJson(path.join(ROOT, "memory", "CONTRACTS", "plugin.json"));
  if (contract.zero_dependencies !== true) {
    failed++;
    console.error("oracle-plugin-contract: contract zero_dependencies must be true");
  }
} catch (error) {
  failed++;
  console.error(`oracle-plugin-contract: cannot verify contract zero_dependencies: ${error.message}`);
}
const boundaryProblems = packageBoundaryProblems(ROOT);
if (boundaryProblems.length > 0) {
  failed++;
  for (const problem of boundaryProblems) {
    console.error(`oracle-plugin-contract: ${problem}`);
  }
}
for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(HERE, test)], { stdio: "inherit" });
  if (result.status !== 0) {
    failed++;
    const detail = result.error
      ? `spawn failed: ${result.error.message}`
      : result.signal
        ? `terminated by signal ${result.signal}`
        : `exited ${result.status}`;
    console.error(`oracle-plugin-contract: ${test} ${detail}`);
  }
}
const total = tests.length + 2;
console.log(`oracle-plugin-contract: ${total - failed}/${total} checks passed`);
process.exit(failed ? 1 : 0);
