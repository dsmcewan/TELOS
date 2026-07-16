#!/usr/bin/env node
// test-all.mjs — runs the committed, ordered Clotho test list, each in a fresh
// Node process. Adding a test file REQUIRES adding it to TESTS below; this unit
// fails closed if a `test-*.mjs` file exists anywhere under clotho/ that is not
// listed, so a new test can never be silently skipped.

import { readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// This runner matches the `test-*.mjs` pattern but is NOT a test; exclude it
// from the unlisted-test scan below.
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url)).split(path.sep).join("/");

// Committed ordered test list (POSIX-relative to clotho/). Grows one entry per
// task as real tests land.
const TESTS = [
  "scripts/test-registry.mjs"
];

function collectTestFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectTestFiles(full));
    else if (/^test-.*\.mjs$/.test(entry)) {
      found.push(path.relative(ROOT, full).split(path.sep).join("/"));
    }
  }
  return found;
}

const listed = new Set(TESTS);
const unlisted = collectTestFiles(ROOT).filter((rel) => rel !== SELF && !listed.has(rel)).sort();
if (unlisted.length) {
  console.error(`unlisted test file(s) — add to test-all.mjs TESTS: ${unlisted.join(", ")}`);
  process.exit(1);
}

for (const rel of TESTS) {
  execFileSync(process.execPath, [path.join(ROOT, rel)], { stdio: "inherit" });
}

console.log(`clotho test-all OK (${TESTS.length} tests)`);
