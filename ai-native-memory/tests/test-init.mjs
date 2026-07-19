#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentAddress, renderRecordList } from "../scripts/lib/record.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INIT = path.join(HERE, "..", "scripts", "init.mjs");
const root = mkdtempSync(path.join(tmpdir(), "anm init "));
try {
  const r1 = spawnSync(process.execPath, [INIT, root, "widget"], { encoding: "utf8" });
  assert.equal(r1.status, 0, r1.stderr);
  const expected = [
    "AI-START-HERE.md",
    "CURRENT-AUTHORITY.json",
    "MEMORY-MANIFEST.json",
    "LOAD-ORDER.json",
    "widget/memory/README.md",
    "widget/memory/IDENTITY.md",
    "widget/memory/INVARIANTS.json",
    "widget/memory/INVARIANTS.md",
    "widget/memory/NON-CLAIMS.json",
    "widget/memory/NON-CLAIMS.md",
    "widget/memory/CONTRACTS/component.json",
    "widget/memory/comprehension-queries.json",
    "widget/memory/DECISIONS/rejected-alternatives.md",
    "widget/memory/FAILURE-MODES.md",
    "widget/memory/EVIDENCE/README.md"
  ];
  for (const file of expected) {
    assert.ok(existsSync(path.join(root, file)), `scaffolded: ${file}`);
  }

  const authority = JSON.parse(readFileSync(path.join(root, "CURRENT-AUTHORITY.json"), "utf8"));
  assert.equal(authority.active, null);
  const loadOrder = JSON.parse(readFileSync(path.join(root, "LOAD-ORDER.json"), "utf8"));
  assert.equal(typeof loadOrder.token_budget.guidance, "string");
  const manifest = JSON.parse(readFileSync(path.join(root, "MEMORY-MANIFEST.json"), "utf8"));
  assert.deepEqual(manifest.components, ["widget"]);

  const recordsByFile = new Map();
  for (const file of [
    "widget/memory/INVARIANTS.json",
    "widget/memory/NON-CLAIMS.json",
    "widget/memory/CONTRACTS/component.json"
  ]) {
    const value = JSON.parse(readFileSync(path.join(root, file), "utf8"));
    const records = Array.isArray(value) ? value : [value];
    recordsByFile.set(file, records);
    for (const record of records) {
      assert.equal(record.status, "SPECIFIED-PENDING-IMPLEMENTATION");
      assert.equal(record.becomes_normative_when, "");
      assert.equal(record.id, contentAddress(record));
    }
  }

  assert.equal(
    readFileSync(path.join(root, "widget/memory/INVARIANTS.md"), "utf8"),
    renderRecordList("Invariants", recordsByFile.get("widget/memory/INVARIANTS.json"))
  );
  assert.equal(
    readFileSync(path.join(root, "widget/memory/NON-CLAIMS.md"), "utf8"),
    renderRecordList("Non-claims", recordsByFile.get("widget/memory/NON-CLAIMS.json"))
  );

  const firstRun = new Map(expected.map((file) => [
    file,
    readFileSync(path.join(root, file), "utf8")
  ]));
  // idempotent: second run must not overwrite any generated file
  const r2 = spawnSync(process.execPath, [INIT, root, "widget"], { encoding: "utf8" });
  assert.equal(r2.status, 0);
  for (const file of expected) {
    assert.equal(readFileSync(path.join(root, file), "utf8"), firstRun.get(file), `no overwrite: ${file}`);
  }
} finally { rmSync(root, { recursive: true, force: true }); }
console.log("test-init: all assertions passed");
