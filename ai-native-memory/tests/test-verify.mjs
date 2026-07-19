#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "verify");
const V = path.join(HERE, "..", "scripts", "verify.mjs");
const run = (fixture) => {
  const temporary = mkdtempSync(path.join(tmpdir(), `anm-verify-${fixture}-`));
  const staged = path.join(temporary, "fixture");
  try {
    cpSync(path.join(FX, fixture), staged, { recursive: true });
    const recordSet = path.join(staged, "record-set");
    if (existsSync(recordSet)) renameSync(recordSet, path.join(staged, "memory"));
    return spawnSync(
      process.execPath,
      [V, path.join(staged, "verify-map.json")],
      { encoding: "utf8" }
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
assert.equal(run("passing").status, 0, "declared oracle exits 0");
assert.equal(run("failing").status, 2, "declared failing oracle exits 2");
assert.equal(run("missing").status, 2, "missing contract exits 2");
assert.equal(run("empty").status, 2, "empty map cannot certify");
assert.equal(run("mismatch").status, 2, "map cannot substitute another oracle");
assert.equal(run("duplicate").status, 2, "duplicate contract entry rejected");
assert.equal(run("uncovered").status, 2, "uncovered normative contract rejected");
assert.equal(run("cwd-escape").status, 2, "oracle cwd cannot escape repository root");
console.log("test-verify: all assertions passed");
