#!/usr/bin/env node

// Deterministic verifier tests. Checks are real (file existence, a real
// subprocess) — no LLM, no keys. A `meets` is earned only when every check
// actually passes; no rhetoric can move it.

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { verifyChecks, runVerifiedBreakout, fileExistsCheck, commandCheck, buildCheck } from "../verifier.mjs";

const thisFile = fileURLToPath(import.meta.url);

// 1. verifyChecks: all passing -> allPass true.
{
  const out = await verifyChecks([
    { id: "a", description: "a", run: () => ({ ok: true, detail: "ok" }) },
    { id: "b", description: "b", run: async () => ({ ok: true, detail: "ok" }) }
  ]);
  assert.equal(out.allPass, true);
  assert.equal(out.facts.length, 2);
  assert.deepEqual(out.failing, []);
}

// 2. verifyChecks: one failing -> allPass false, failing carries it.
{
  const out = await verifyChecks([
    { id: "a", description: "a passes", run: () => ({ ok: true }) },
    { id: "b", description: "b fails", run: () => ({ ok: false, detail: "nope" }) }
  ]);
  assert.equal(out.allPass, false);
  assert.equal(out.failing.length, 1);
  assert.equal(out.failing[0].id, "b");
}

// 3. A check that throws is a failure, not a crash.
{
  const out = await verifyChecks([{ id: "boom", description: "throws", run: () => { throw new Error("kaboom"); } }]);
  assert.equal(out.allPass, false);
  assert.match(out.facts[0].detail, /kaboom/);
}

// 4. fileExistsCheck against a real file passes; a bogus path fails.
{
  const real = await verifyChecks([fileExistsCheck("self", thisFile)]);
  assert.equal(real.allPass, true);
  const bogus = await verifyChecks([fileExistsCheck("nope", thisFile + ".does-not-exist")]);
  assert.equal(bogus.allPass, false);
}

// 5. commandCheck runs a real subprocess and reads its exit code.
{
  const pass = await verifyChecks([commandCheck("ok", "exit 0", process.execPath, ["-e", "process.exit(0)"])]);
  assert.equal(pass.allPass, true);
  const fail = await verifyChecks([commandCheck("bad", "exit 1", process.execPath, ["-e", "process.exit(1)"])]);
  assert.equal(fail.allPass, false);
}

// 6. runVerifiedBreakout: all checks pass -> converged meets, gate-shaped record.
{
  const r = await runVerifiedBreakout(
    { workstream: "frontend-brand-experience", claimedStatus: "meets" },
    [fileExistsCheck("self", thisFile), commandCheck("ok", "exit 0", process.execPath, ["-e", "0"])]
  );
  assert.equal(r.converged, true);
  assert.equal(r.finalStatus, "meets");
  assert.deepEqual(r.surviving_blockers, []);
  assert.ok(Array.isArray(r.verified_facts) && r.verified_facts.length === 2);
  assert.ok(Array.isArray(r.rounds) && r.rounds.length >= 1);
  assert.equal(r.workstream, "frontend-brand-experience");
}

// 7. Invariant: a single failing check forces needs-work, never meets.
{
  const r = await runVerifiedBreakout(
    { workstream: "frontend-brand-experience", claimedStatus: "meets" },
    [fileExistsCheck("self", thisFile), fileExistsCheck("missing", thisFile + ".nope")]
  );
  assert.equal(r.converged, false);
  assert.equal(r.finalStatus, "needs-work");
  assert.ok(r.surviving_blockers.length >= 1);
  assert.ok(!(r.finalStatus === "meets"));
}

// 8. reverifyRecord: rebuilds read-only checks from declarative specs and runs
//    them against the real filesystem, confined to baseDir.
import { reverifyRecord } from "../verifier.mjs";
import { dirname } from "node:path";

const hereDir = dirname(thisFile);
const selfName = thisFile.split(/[\\/]/).pop();

// real file specs pass; reverifiable count reflects the read-only checks.
{
  const r = reverifyRecord(
    { checks: [
      { type: "file_exists", path: selfName },
      { type: "file_contains", path: selfName, needle: "reverifyRecord" },
    ] },
    hereDir
  );
  assert.equal(r.allPass, true);
  assert.equal(r.reverifiable, 2);
  assert.equal(r.skipped, 0);
}

// a missing file fails the re-verification.
{
  const r = reverifyRecord({ checks: [{ type: "file_exists", path: selfName + ".nope" }] }, hereDir);
  assert.equal(r.allPass, false);
  assert.equal(r.reverifiable, 1);
}

// a path escaping baseDir is rejected even if the real file exists (confinement).
{
  const r = reverifyRecord(
    { checks: [{ type: "file_exists", path: "../../../../../../Windows/System32/drivers/etc/hosts" }] },
    hereDir
  );
  assert.equal(r.allPass, false);
}

// command/unknown specs are SKIPPED, never executed by re-verification.
{
  const r = reverifyRecord(
    { checks: [{ type: "command", command: process.execPath, args: ["-e", "process.exit(0)"] }] },
    hereDir
  );
  assert.equal(r.reverifiable, 0);
  assert.equal(r.skipped, 1);
}

// 9. runVerifiedBreakout with NO checks must NOT converge to meets (empty set of
//    facts is not evidence of anything).
{
  const r = await runVerifiedBreakout({ workstream: "x", claimedStatus: "meets" }, []);
  assert.equal(r.converged, false);
  assert.equal(r.finalStatus, "needs-work");
  assert.ok(r.surviving_blockers.length >= 1);
}

// 10. buildCheck builds runnable checks for all types (incl command) for live use.
{
  const cmd = buildCheck({ type: "command", command: process.execPath, args: ["-e", "process.exit(0)"] });
  assert.equal((await cmd.run()).ok, true);
  const exists = buildCheck({ type: "file_exists", path: selfName }, hereDir);
  assert.equal((await exists.run()).ok, true);
}

// --- sufficiency signals (TELOS upgrade) ---
{
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const path = (await import("node:path")).default;
  const { reverifyRecord } = await import("../verifier.mjs");

  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-suff-"));
  writeFileSync(path.join(dir, "full.txt"), "hello #69e7ff world");
  writeFileSync(path.join(dir, "empty.txt"), "");

  const existsOnly = reverifyRecord({ checks: [{ type: "file_exists", path: "full.txt" }] }, dir);
  assert.equal(existsOnly.hasFileContains, false, "existence-only must report hasFileContains=false");
  assert.deepEqual(existsOnly.emptyEvidenceFiles, [], "non-empty file is not empty-evidence");

  const withContains = reverifyRecord({ checks: [{ type: "file_contains", path: "full.txt", needle: "#69e7ff" }] }, dir);
  assert.equal(withContains.hasFileContains, true, "file_contains must set hasFileContains=true");

  const emptyEvidence = reverifyRecord({ checks: [{ type: "file_exists", path: "empty.txt" }] }, dir);
  assert.deepEqual(emptyEvidence.emptyEvidenceFiles, ["empty.txt"], "zero-byte file_exists is empty-evidence");

  console.log("test-verifier sufficiency OK");
}

// 11. Empty-needle bypass is closed: a file_contains spec with needle:"" on a
//     zero-byte file must NOT satisfy hasFileContains, and the file MUST be
//     flagged in emptyEvidenceFiles.
{
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const path = (await import("node:path")).default;
  const { reverifyRecord } = await import("../verifier.mjs");

  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-bypass-"));
  writeFileSync(path.join(dir, "empty.txt"), "");
  writeFileSync(path.join(dir, "real.txt"), "actual-content-marker");

  // Empty needle on zero-byte file: must NOT count as hasFileContains, must flag emptyEvidenceFiles.
  const emptyNeedle = reverifyRecord(
    { checks: [{ type: "file_contains", path: "empty.txt", needle: "" }] },
    dir
  );
  assert.equal(emptyNeedle.hasFileContains, false, "empty needle must not satisfy hasFileContains");
  assert.ok(emptyNeedle.emptyEvidenceFiles.includes("empty.txt"), "zero-byte file_contains target must appear in emptyEvidenceFiles");

  // Whitespace-only needle should also not satisfy hasFileContains.
  const wsNeedle = reverifyRecord(
    { checks: [{ type: "file_contains", path: "empty.txt", needle: "   " }] },
    dir
  );
  assert.equal(wsNeedle.hasFileContains, false, "whitespace-only needle must not satisfy hasFileContains");

  // Non-empty needle on non-empty file: must set hasFileContains=true and must NOT flag as empty.
  const realContains = reverifyRecord(
    { checks: [{ type: "file_contains", path: "real.txt", needle: "actual-content-marker" }] },
    dir
  );
  assert.equal(realContains.hasFileContains, true, "real needle on real file must set hasFileContains=true");
  assert.ok(!realContains.emptyEvidenceFiles.includes("real.txt"), "non-empty file must not appear in emptyEvidenceFiles");

  console.log("test-verifier empty-needle bypass OK");
}

console.log("verifier: all tests passed");
