#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const INIT = path.join(HERE, "..", "scripts", "init.mjs");
const root = mkdtempSync(path.join(tmpdir(), "anm-init-"));
try {
  const r1 = spawnSync(process.execPath, [INIT, root, "widget"], { encoding: "utf8" });
  assert.equal(r1.status, 0, r1.stderr);
  for (const f of ["AI-START-HERE.md", "AUTHORITY.json", "LOAD-ORDER.json",
    "widget/memory/IDENTITY.md", "widget/memory/INVARIANTS.json", "widget/memory/NON-CLAIMS.json",
    "widget/memory/CONTRACTS/component.json", "widget/memory/comprehension-queries.json",
    "widget/memory/DECISIONS/rejected-alternatives.md", "widget/memory/FAILURE-MODES.md"]) {
    assert.ok(existsSync(path.join(root, f)), `scaffolded: ${f}`);
  }
  // idempotent: second run must not overwrite (marker survives)
  const marker = path.join(root, "widget/memory/IDENTITY.md");
  const orig = readFileSync(marker, "utf8");
  const r2 = spawnSync(process.execPath, [INIT, root, "widget"], { encoding: "utf8" });
  assert.equal(r2.status, 0);
  assert.equal(readFileSync(marker, "utf8"), orig, "no overwrite");
  // scaffolded contract is honest: SPECIFIED-PENDING
  const c = JSON.parse(readFileSync(path.join(root, "widget/memory/CONTRACTS/component.json"), "utf8"));
  assert.equal(c.status, "SPECIFIED-PENDING-IMPLEMENTATION");
} finally { rmSync(root, { recursive: true, force: true }); }
console.log("test-init: all assertions passed");
