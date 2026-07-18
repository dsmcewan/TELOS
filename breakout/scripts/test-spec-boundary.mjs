#!/usr/bin/env node

// Declarative check-spec BOUNDARY tests. The gate re-verifies a breakout record
// by rebuilding checks from JSON specs (`safeCheckFromSpec` / `reverifyRecord`),
// so the spec parser is a trust boundary: it must REJECT or SKIP anything that
// isn't a read-only, base-dir-confined check, and it must never build an
// executable (`command`) check on the gate path. These tests feed it malformed
// and hostile specs and assert it holds — the "compiler rejects bad programs"
// side of the verifier. Keyless and deterministic: no LLM, no network.

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeCheckFromSpec, reverifyRecord } from "../verifier.mjs";

const hereDir = path.dirname(fileURLToPath(import.meta.url));

// --- safeCheckFromSpec: malformed specs are SKIPPED (not built, not run) -----

// 1. Non-object specs (null / undefined / string / number) are skipped.
for (const bad of [null, undefined, "file_exists", 42, true]) {
  const check = safeCheckFromSpec(bad, hereDir);
  assert.equal(check.skip, true, `non-object spec ${JSON.stringify(bad)} must skip`);
}

// 2. An object with no recognized type is skipped (nothing to build).
{
  const check = safeCheckFromSpec({ path: "x.txt" }, hereDir);
  assert.equal(check.skip, true, "spec without a type must skip");
}

// 3. An unknown / hostile type is skipped — only file_exists / file_contains are
//    ever built from a spec; a novel type is ignored, never executed.
for (const type of ["command", "delete_everything", "eval", "http_get", "FILE_EXISTS"]) {
  const check = safeCheckFromSpec({ type, path: "x", command: "x" }, hereDir);
  assert.equal(check.skip, true, `type '${type}' must skip on the gate path`);
}

// 4. An array is an object but carries no type -> skipped (no accidental build).
{
  const check = safeCheckFromSpec([], hereDir);
  assert.equal(check.skip, true, "array spec must skip");
}

// --- safeCheckFromSpec: hostile PATHS are rejected as a failing check ---------
// (These are recognized types with a bad path: not skipped, but built as a check
//  that fails without touching the filesystem — confinement before I/O.)

// 5. A non-string path can't resolve -> rejected failing check, not a throw.
for (const badPath of [123, null, undefined, {}, ["x"]]) {
  const check = safeCheckFromSpec({ type: "file_exists", path: badPath }, hereDir);
  assert.notEqual(check.skip, true, "recognized type is built, not skipped");
  const result = check.run();
  assert.equal(result.ok, false, `non-string path ${JSON.stringify(badPath)} must fail`);
  assert.match(check.description, /unsafe|escaping/i);
}

// 6. A relative path escaping the base dir is rejected regardless of existence.
{
  const check = safeCheckFromSpec(
    { type: "file_exists", path: "../../../../../../etc/hosts" },
    hereDir
  );
  assert.equal(check.run().ok, false, "traversal path must be rejected");
  assert.match(check.run().detail, /outside the allowed base dir/);
}

// 7. An ABSOLUTE path (outside the base dir) is rejected — confinement holds even
//    when the target exists. Built from the base's parent so it's outside on any OS.
{
  const absOutside = path.resolve(hereDir, "..", "..", "outside-target");
  assert.ok(path.isAbsolute(absOutside));
  const check = safeCheckFromSpec({ type: "file_exists", path: absOutside }, hereDir);
  assert.equal(check.run().ok, false, "absolute path outside base must be rejected");
  assert.match(check.description, /unsafe|escaping/i);
}

// --- reverifyRecord: hostile records don't crash and don't smuggle execution --

// 8. A null / malformed record has no checks: nothing reverifiable, nothing run.
for (const bad of [null, undefined, {}, { checks: "not-an-array" }, { checks: 5 }]) {
  const r = reverifyRecord(bad, hereDir);
  assert.equal(r.reverifiable, 0, "malformed record exposes no reverifiable checks");
  assert.equal(r.skipped, 0);
  assert.deepEqual(r.facts, []);
}

// 9. A mixed batch: an escaping read-only check (reverifiable but FAILING), a
//    command spec (SKIPPED, never executed), and a valid file_exists (passes).
//    Locks the three distinct fates and proves one bad check fails the record.
{
  const selfName = path.basename(fileURLToPath(import.meta.url));
  const r = reverifyRecord(
    {
      checks: [
        { type: "file_exists", path: "../../../../../../etc/hosts" }, // escape -> fail
        { type: "command", command: process.execPath, args: ["-e", "process.exit(0)"] }, // -> skip
        { type: "file_exists", path: selfName } // real, present -> pass
      ]
    },
    hereDir
  );
  assert.equal(r.reverifiable, 2, "two read-only checks are reverifiable; command is not");
  assert.equal(r.skipped, 1, "the command spec is skipped, never run by the gate");
  assert.equal(r.allPass, false, "the escaping check must sink the record");
}

// 10. Direct proof the gate path never builds an executable check: a command spec
//     through safeCheckFromSpec yields a skip, so no subprocess can be spawned
//     from a packet-declared command during re-verification.
{
  const check = safeCheckFromSpec(
    { type: "command", command: process.execPath, args: ["-e", "process.exit(0)"] },
    hereDir
  );
  assert.equal(check.skip, true, "command spec must never build a runnable check on the gate path");
}

console.log("test-spec-boundary: all assertions passed");
