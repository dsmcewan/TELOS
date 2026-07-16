#!/usr/bin/env node
// check.mjs — recursively `node --check` every .mjs file below clotho/, in
// POSIX path order. No shell: each file is checked via
// execFileSync(process.execPath, ["--check", file]). A syntax error in any file
// makes this fail closed (execFileSync throws on non-zero exit).

import { readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function collectMjs(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...collectMjs(full));
    else if (entry.endsWith(".mjs")) found.push(full);
  }
  return found;
}

// POSIX path order: normalize to forward-slash repo-relative paths, then sort.
const files = collectMjs(ROOT)
  .map((full) => path.relative(ROOT, full).split(path.sep).join("/"))
  .sort();

for (const rel of files) {
  execFileSync(process.execPath, ["--check", path.join(ROOT, rel)], { stdio: "pipe" });
}

console.log(`clotho check OK (${files.length} files)`);
