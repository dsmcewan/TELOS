#!/usr/bin/env node
// Runs every tests/test-*.mjs as a child process; exit 1 if any fails.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE).filter((f) => /^test-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(HERE, f)], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(`run: ${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
