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

// 11. Empty-needle bypass is fully closed (all modes): a file_contains spec whose
//     needle is empty / whitespace / missing is not evidence, so the check must
//     FAIL re-verification (not merely be excluded from the signed-mode floor).
//     This closes the unsigned-mode vacuous pass where allPass stayed true.
{
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const path = (await import("node:path")).default;
  const { reverifyRecord } = await import("../verifier.mjs");

  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-bypass-"));
  writeFileSync(path.join(dir, "empty.txt"), "");
  writeFileSync(path.join(dir, "real.txt"), "actual-content-marker");

  // Empty needle: the check FAILS (closes the unsigned vacuous pass), still counts
  // as reverifiable, and never satisfies hasFileContains (signed-mode floor).
  const emptyNeedle = reverifyRecord({ checks: [{ type: "file_contains", path: "empty.txt", needle: "" }] }, dir);
  assert.equal(emptyNeedle.allPass, false, "empty needle must fail re-verification, not pass vacuously");
  assert.equal(emptyNeedle.reverifiable, 1, "the empty-needle check still ran (counts as reverifiable)");
  assert.equal(emptyNeedle.hasFileContains, false, "empty needle must not satisfy hasFileContains");

  // The bug was String.includes(""): an empty needle on a NON-empty file must fail too.
  const emptyOnReal = reverifyRecord({ checks: [{ type: "file_contains", path: "real.txt", needle: "" }] }, dir);
  assert.equal(emptyOnReal.allPass, false, "empty needle on a non-empty file must also fail");

  // Whitespace-only and missing needle must also fail (match the realNeedle predicate).
  const wsNeedle = reverifyRecord({ checks: [{ type: "file_contains", path: "real.txt", needle: "   " }] }, dir);
  assert.equal(wsNeedle.allPass, false, "whitespace-only needle must fail");
  assert.equal(wsNeedle.hasFileContains, false, "whitespace-only needle must not satisfy hasFileContains");
  const missingNeedle = reverifyRecord({ checks: [{ type: "file_contains", path: "real.txt" }] }, dir);
  assert.equal(missingNeedle.allPass, false, "missing needle must fail (no includes('undefined') match)");

  // Non-empty needle on non-empty file still passes and sets hasFileContains.
  const realContains = reverifyRecord({ checks: [{ type: "file_contains", path: "real.txt", needle: "actual-content-marker" }] }, dir);
  assert.equal(realContains.allPass, true, "real needle on real file passes");
  assert.equal(realContains.hasFileContains, true, "real needle on real file must set hasFileContains=true");
  assert.ok(!realContains.emptyEvidenceFiles.includes("real.txt"), "non-empty file must not appear in emptyEvidenceFiles");

  // The live path (buildCheck -> runVerifiedBreakout) must also fail closed.
  const liveEmpty = await runVerifiedBreakout(
    { workstream: "x", claimedStatus: "meets" },
    [buildCheck({ type: "file_contains", path: "real.txt", needle: "" }, dir)]
  );
  assert.equal(liveEmpty.converged, false, "live breakout must not converge on an empty-needle check");
  assert.equal(liveEmpty.finalStatus, "needs-work");

  console.log("test-verifier empty-needle bypass OK");
}

// 12. baseDir confinement is physical as well as lexical in both verifier
//     modes. Read-only gate checks and live-built file checks must not follow a
//     symlink/junction to evidence outside baseDir.
{
  const { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } = await import("node:fs");
  const os = await import("node:os");
  const path = (await import("node:path")).default;

  const root = mkdtempSync(path.join(os.tmpdir(), "telos-verifier-confinement-"));
  const base = path.join(root, "base");
  const outside = path.join(root, "outside");
  mkdirSync(base);
  mkdirSync(outside);
  writeFileSync(path.join(outside, "evidence.txt"), "outside-marker");
  symlinkSync(outside, path.join(base, "escape-link"), process.platform === "win32" ? "junction" : "dir");

  const specs = [
    { type: "file_exists", path: "../outside/evidence.txt" },
    { type: "file_contains", path: "../outside/evidence.txt", needle: "outside-marker" },
    { type: "file_exists", path: "escape-link/evidence.txt" },
    { type: "file_contains", path: "escape-link/evidence.txt", needle: "outside-marker" },
  ];

  const confinementResults = [];
  for (const spec of specs) {
    const gateResult = reverifyRecord({ checks: [spec] }, base);
    const liveResult = await verifyChecks([buildCheck(spec, base)]);
    confinementResults.push({
      type: spec.type,
      path: spec.path,
      gatePass: gateResult.allPass,
      livePass: liveResult.allPass,
    });
  }
  assert.deepEqual(
    confinementResults,
    specs.map((spec) => ({ type: spec.type, path: spec.path, gatePass: false, livePass: false })),
    "file_exists/file_contains must reject lexical and physical escapes in both verifier modes"
  );

  console.log("test-verifier physical confinement OK");
}

console.log("verifier: all tests passed");
