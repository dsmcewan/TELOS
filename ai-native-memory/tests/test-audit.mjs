#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditRoot, auditMemoryDir } from "../scripts/audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "audit");
const fails = (dir, check) => auditRoot(path.join(FX, dir)).filter((f) => f.level === "FAIL" && f.check === check);

assert.equal(auditRoot(path.join(FX, "passing")).filter((f) => f.level === "FAIL").length, 0, "passing tree must have 0 FAIL");
assert.ok(fails("v-md-only-invariants", "three-representation").length >= 1, "md-only invariants flagged");
assert.ok(fails("v-invariant-no-oracle", "three-representation").length >= 1, "invariant without oracle flagged");
assert.ok(fails("v-normative-no-oracle", "taxonomy").length >= 1, "NORMATIVE without oracle flagged");
assert.ok(fails("v-pending-no-becomes", "taxonomy").length >= 1, "PENDING without becomes_normative_when flagged");
assert.ok(fails("v-superseded-loose", "taxonomy").length >= 1, "loose SUPERSEDED flagged");
assert.ok(fails("v-stale-query", "query-freshness").length >= 1, "stale derived query flagged");
assert.ok(fails("v-mirror-drift", "mirror-sync").length >= 1, "mirror drift flagged");
assert.ok(fails("v-dangling-anchor", "staleness").length >= 1, "dangling anchor flagged");
assert.ok(fails("v-authority-drift", "staleness").length >= 1, "authority drift flagged");

// A string-valued derived_from (pre-guard schema) must not crash the audit — it should
// WARN, not throw, and must not register as a query-freshness FAIL.
const tmp = mkdtempSync(path.join(tmpdir(), "anm-audit-string-derived-from-"));
const memDir = path.join(tmp, "memory");
mkdirSync(memDir, { recursive: true });
writeFileSync(path.join(memDir, "comprehension-queries.json"), JSON.stringify({
  queries: [
    { id: "q-1", answer_kind: "enum", expected: "NORMATIVE-CURRENT", derived_from: "CONTRACTS/example.json#status" }
  ]
}));
let stringDerivedFromFindings;
assert.doesNotThrow(() => { stringDerivedFromFindings = auditMemoryDir(memDir, tmp); }, "string-valued derived_from must not throw");
assert.equal(stringDerivedFromFindings.filter((f) => f.level === "FAIL" && f.check === "query-freshness").length, 0, "string-valued derived_from must yield zero query-freshness FAIL");

console.log("test-audit: all assertions passed");
