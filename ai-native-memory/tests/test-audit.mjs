#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditRoot } from "../scripts/audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "audit");
const fails = (dir, check) => auditRoot(path.join(FX, dir)).filter((f) => f.level === "FAIL" && f.check === check);

assert.equal(auditRoot(path.join(FX, "passing")).filter((f) => f.level === "FAIL").length, 0, "passing tree must have 0 FAIL");
assert.ok(fails("v-md-only-invariants", "three-representation").length >= 1, "md-only invariants flagged");
assert.ok(fails("v-invariant-no-oracle", "three-representation").length >= 1, "invariant without oracle flagged");
assert.ok(fails("v-normative-no-oracle", "taxonomy").length >= 1, "NORMATIVE without oracle flagged");
assert.ok(fails("v-pending-no-becomes", "taxonomy").length >= 1, "PENDING without becomes_normative_when flagged");
assert.ok(fails("v-superseded-loose", "taxonomy").length >= 1, "loose SUPERSEDED flagged");
console.log("test-audit: all assertions passed");
