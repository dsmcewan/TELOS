#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  canonicalize,
  sha256hex,
  contentAddress,
  hasValidContentAddress,
  importSpecifiers,
  renderRecordList,
  resolveWithin,
  RECORD_KINDS,
  RECORD_STATUSES,
  finding,
  printFindings
} from "../scripts/lib/record.mjs";

// canonicalize: key order does not matter; array order does
assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
assert.notEqual(canonicalize({ a: [1, 2] }), canonicalize({ a: [2, 1] }));
assert.equal(canonicalize({ a: 1, b: 2 }), '{"a":1,"b":2}');
// sha256hex deterministic
assert.equal(sha256hex("x"), sha256hex("x"));
assert.match(sha256hex("x"), /^[0-9a-f]{64}$/);
// contentAddress: minus-id rule — id in the record does not change the address
const rec = { kind: "invariant", statement: "s", id: "sha256:junk" };
const { id, ...rest } = rec;
assert.equal(contentAddress(rec), "sha256:" + sha256hex(canonicalize(rest)));
// shared record, rendering, path-safety, and literal-import primitives
const addressed = { kind: "invariant", statement: "s" };
addressed.id = contentAddress(addressed);
assert.equal(hasValidContentAddress(addressed), true);
assert.equal(hasValidContentAddress({ ...addressed, statement: "changed" }), false);
assert.equal(RECORD_KINDS.has("contract"), true);
assert.equal(RECORD_KINDS.has("invented-kind"), false);
assert.equal(RECORD_STATUSES.has("NORMATIVE-CURRENT"), true);
assert.equal(RECORD_STATUSES.has("INVENTED-STATUS"), false);
assert.equal(
  renderRecordList("Example invariants", [addressed]),
  `# Example invariants (rendered)\n\n- **${addressed.id}** [unspecified] s\n`
);
assert.equal(resolveWithin("/repo", "component/memory"), "/repo/component/memory");
assert.throws(() => resolveWithin("/repo", "../outside"), /escapes repository root/);
assert.throws(() => resolveWithin("/repo", "/outside"), /repository-relative/);
assert.deepEqual(
  importSpecifiers('import x from "node:x"; import "./side.mjs"; await import("../dynamic.mjs");'),
  ["node:x", "./side.mjs", "../dynamic.mjs"]
);
// findings
const f = finding("FAIL", "three-representation", "x/memory", "missing INVARIANTS.json");
assert.deepEqual(Object.keys(f).sort(), ["check", "detail", "level", "path"]);
assert.equal(printFindings([f], "audit"), 2);
assert.equal(printFindings([], "audit"), 0);
console.log("test-lib: all assertions passed");
