#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { callClaudeCode } from "./claude-code-seat.mjs";
import {
  applySparseIntegration,
  createReviewCapsule,
  loadReviewRegistry,
  runReviewPreflight,
  verifyReviewCapsule
} from "./review-compiler.mjs";
import {
  applyIntegrationResponse,
  assertNoSecretMaterial,
  createArtifactStore,
  runWorkshop,
  verifyWorkshop
} from "./workshop-lib.mjs";

const candidate = "# Candidate\n\nAlpha.\n\nBeta.\n";
const matrix = [{
  obligation_id: "PPC-W01",
  invariant: "candidate remains bound",
  mechanism: "exact replacement controller",
  task: "materialize the integrated candidate",
  negative_test: "ambiguous replacement is rejected",
  exit_criterion: "materialized bytes are uniquely derived"
}];

const fixturePaths = Object.freeze({
  candidate: "candidate.md",
  design: "design.md",
  preReview: "pre-review.json",
  methodology: "methodology.md",
  comprehension: "reader-validation.json"
});
const fixturePathsV2 = Object.freeze({
  ...fixturePaths,
  ruling: "controller-ruling.json"
});

function rawSha256Ref(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function controllerRuling(candidateText = candidate) {
  return {
    kind: "controller-ruling",
    id: "production-profile-file-ingress-v1",
    authority: "The Eye",
    decision: "approved",
    candidate_plan: {
      path: fixturePaths.candidate,
      raw_sha256: rawSha256Ref(candidateText)
    },
    file_ingress: {
      allowed_formats: ["csv", "json", "xlsx"],
      image_handling: "block",
      unsafe_xlsx_handling: "reject-entire-workbook",
      classification: "inherit-complete-profile-data-classification"
    },
    implementation_authorized: false,
    provider_calls_authorized: false,
    non_authorization: "This ruling matures candidate requirements only; it grants no implementation, authority-record, commit, provider-call, or deployment authorization."
  };
}

function writeFixtureInputs(root, runDir) {
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(root, fixturePaths.candidate), candidate);
  writeFileSync(path.join(root, fixturePaths.design), "# Design\n");
  writeFileSync(path.join(root, fixturePaths.preReview), "{\"kind\":\"evidence\"}\n");
  writeFileSync(path.join(root, fixturePaths.methodology), "# Methodology\n");
  writeFileSync(path.join(root, fixturePaths.comprehension), JSON.stringify({
    result: "COMPREHENSION_PASSED",
    comprehension_checks: { passed: 19, failed: 0 }
  }));
}

function makeFixtureCallSeat({
  revise = false,
  conflictRole = null,
  secret = null,
  openImplementation = false,
  invalidVerifierRole = null
} = {}) {
  let call = 0;
  return async ({ seat, role, phase }) => {
    call += 1;
    const provenance = {
      provider: seat === "claude" ? "anthropic" : "openai",
      model: `${seat}-fixture`,
      response_id: `fixture-${call}`,
      source: "workshop-smoke"
    };
    if (phase === "author" && role === "constraints") {
      const response = {
        plan: secret || "# Constraint source\n",
        obligations: ["PPC-W01"]
      };
      return { ...response, provenance, response };
    }
    if (phase === "author") {
      const response = {
        plan: "# Implementation source\n",
        ...(openImplementation ? { uncontracted: "must not persist" } : {})
      };
      return { ...response, provenance, response };
    }
    if (phase === "integrate") {
      return {
        provenance,
        response: revise ? {
          decision: "revise",
          maturation_summary: "Bind the opening claim to the controller.",
          replacements: [{
            old: "Alpha.",
            new: "Alpha is controller-bound.",
            reason: "Make the evidence boundary exact."
          }],
          obligation_matrix: matrix
        } : {
          decision: "preserve",
          maturation_summary: "No material revision is required.",
          replacements: [],
          obligation_matrix: matrix
        }
      };
    }
    if (role === invalidVerifierRole) {
      const response = { verdict: "maybe", conflicts: [] };
      return { ...response, provenance, response };
    }
    const violated = role === conflictRole;
    const response = {
      verdict: violated ? "violated" : "preserved",
      conflicts: violated ? [`${role} contract was weakened`] : []
    };
    return { ...response, provenance, response };
  };
}

{
  assert.throws(() => assertNoSecretMaterial({
    plan: "-----BEGIN PRIVATE KEY-----\nnot-for-disk\n-----END PRIVATE KEY-----"
  }), /secret material/);
  assert.throws(() => assertNoSecretMaterial({
    plan: `token ${"sk-ant-" + "A".repeat(32)}`
  }), /secret material/);
  assert.doesNotThrow(() => assertNoSecretMaterial({
    plan: "Environment variable names such as ANTHROPIC_API_KEY are documentation, not secret values."
  }));
  console.log("Case 0 OK: likely secret material is rejected before persistence");
}

{
  const preserved = applyIntegrationResponse(candidate, {
    decision: "preserve",
    maturation_summary: "The candidate already satisfies the frozen frame.",
    replacements: [],
    obligation_matrix: matrix
  });
  assert.equal(preserved.plan, candidate);
  assert.equal(preserved.changed, false);

  const revised = applyIntegrationResponse(candidate, {
    decision: "revise",
    maturation_summary: "Make the evidence statement exact.",
    replacements: [{
      old: "Alpha.",
      new: "Alpha is controller-bound.",
      reason: "Remove an ambiguous trust-boundary statement."
    }],
    obligation_matrix: matrix
  });
  assert.equal(revised.plan, "# Candidate\n\nAlpha is controller-bound.\n\nBeta.\n");
  assert.equal(revised.changed, true);
  assert.equal(revised.replacement_count, 1);

  assert.throws(() => applyIntegrationResponse("x x", {
    decision: "revise",
    maturation_summary: "Ambiguous edit.",
    replacements: [{ old: "x", new: "y", reason: "Must resolve uniquely." }],
    obligation_matrix: matrix
  }), /exactly once/);
  assert.throws(() => applyIntegrationResponse(candidate, {
    decision: "preserve",
    maturation_summary: "Contradictory preserve.",
    replacements: [{ old: "Alpha.", new: "A.", reason: "Not empty." }],
    obligation_matrix: matrix
  }), /preserve.*zero replacements/);
  assert.throws(() => applyIntegrationResponse(candidate, {
    decision: "revise",
    maturation_summary: "No effective edit.",
    replacements: [{ old: "Alpha.", new: "Alpha.", reason: "No-op." }],
    obligation_matrix: matrix
  }), /no-op/);
  assert.throws(() => applyIntegrationResponse(candidate, {
    decision: "preserve",
    maturation_summary: "Open matrix row.",
    replacements: [],
    obligation_matrix: [{ ...matrix[0], uncontracted: "must be rejected" }]
  }), /matrix row 0.*open or incomplete/);
  assert.throws(() => applyIntegrationResponse(candidate, {
    decision: "preserve",
    maturation_summary: "Blank matrix field.",
    replacements: [],
    obligation_matrix: [{ ...matrix[0], mechanism: " " }]
  }), /matrix row 0.*mechanism/);
  console.log("Case 1 OK: integration materialization is exact and fail-closed");
}

{
  const dir = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-artifacts-"));
  try {
    const store = createArtifactStore(path.join(dir, "artifacts"));
    const first = store.write({ kind: "fixture", value: 1 });
    assert.match(first.ref, /^sha256:[0-9a-f]{64}$/);
    assert.deepEqual(store.read(first.ref), { kind: "fixture", value: 1 });
    writeFileSync(first.path, "{\"kind\":\"tampered\"}\n");
    assert.throws(() => store.read(first.ref), /artifact hash mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("Case 2 OK: artifact store rejects tampering");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-run-"));
  const runDir = path.join(root, "docs/runs/workshop");
  const paths = {
    candidate: "candidate.md",
    design: "design.md",
    preReview: "pre-review.json",
    methodology: "methodology.md",
    comprehension: "reader-validation.json"
  };
  try {
    mkdirSync(runDir, { recursive: true });
    writeFileSync(path.join(root, paths.candidate), candidate);
    writeFileSync(path.join(root, paths.design), "# Design\n");
    writeFileSync(path.join(root, paths.preReview), "{\"kind\":\"evidence\"}\n");
    writeFileSync(path.join(root, paths.methodology), "# Methodology\n");
    writeFileSync(path.join(root, paths.comprehension), JSON.stringify({
      result: "COMPREHENSION_PASSED",
      comprehension_checks: { passed: 19, failed: 0 }
    }));

    let call = 0;
    const callSeat = async ({ seat, role, phase }) => {
      call += 1;
      const provenance = {
        provider: seat === "claude" ? "anthropic" : "openai",
        model: `${seat}-fixture`,
        response_id: `fixture-${call}`,
        source: "workshop-smoke"
      };
      if (phase === "author" && role === "constraints") {
        return {
          plan: "# Constraint source\n",
          obligations: ["PPC-W01"],
          provenance,
          response: { plan: "# Constraint source\n", obligations: ["PPC-W01"] }
        };
      }
      if (phase === "author") {
        return {
          plan: "# Implementation source\n",
          provenance,
          response: { plan: "# Implementation source\n" }
        };
      }
      if (phase === "integrate") {
        return {
          response: {
            decision: "preserve",
            maturation_summary: "No material revision is required.",
            replacements: [],
            obligation_matrix: matrix
          },
          provenance
        };
      }
      return {
        verdict: "preserved",
        conflicts: [],
        provenance,
        response: { verdict: "preserved", conflicts: [] }
      };
    };

    const summary = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths,
      callSeat,
      now: (() => {
        let tick = 0;
        return () => `2026-07-20T00:00:0${tick++}.000Z`;
      })()
    });
    assert.equal(summary.state, "converged-parallel");
    assert.equal(summary.terminal, "submit");
    assert.equal(summary.matured_plan_changed, false);
    assert.equal(call, 5);
    assert.equal(readFileSync(path.join(runDir, "candidate-plan.md"), "utf8"), candidate);
    const signedEvents = readFileSync(path.join(runDir, "attempts/attempt-001/events.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(signedEvents[3].artifact_refs, [
      summary.integration.candidate_ref,
      summary.verifications.find((entry) => entry.role === "constraints").provenance.response_artifact_ref,
      summary.verifications.find((entry) => entry.role === "implementation").provenance.response_artifact_ref
    ]);

    const smokeBlocked = verifyWorkshop({ repoRoot: root, runDir });
    assert.equal(smokeBlocked.ok, false);
    assert.ok(smokeBlocked.errors.some((error) => error.includes("smoke workshop")));

    const verified = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(verified.ok, true, verified.errors.join("; "));
    assert.equal(verified.event_count, 4);
    assert.equal(verified.provenance_count, 5);

    const topResultPath = path.join(runDir, "result.json");
    const attemptResultPath = path.join(runDir, "attempts/attempt-001/result.json");
    const topResult = JSON.parse(readFileSync(topResultPath, "utf8"));
    const writeBothResults = (value) => {
      const bytes = `${JSON.stringify(value, null, 2)}\n`;
      writeFileSync(topResultPath, bytes);
      writeFileSync(attemptResultPath, bytes);
    };
    const falseChanged = structuredClone(topResult);
    falseChanged.matured_plan_changed = true;
    writeBothResults(falseChanged);
    const changedMismatch = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(changedMismatch.ok, false);
    assert.ok(changedMismatch.errors.some((error) => error.includes("changed flag mismatch")));
    writeBothResults(topResult);

    const falseLineage = structuredClone(topResult);
    falseLineage.creation_lineage[0].response_id = "fabricated-distinct-id";
    writeBothResults(falseLineage);
    const lineageMismatch = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(lineageMismatch.ok, false);
    assert.ok(lineageMismatch.errors.some((error) => error.includes("creation lineage mismatch")));
    writeBothResults(topResult);

    const falseObligation = structuredClone(topResult);
    falseObligation.sources.find((source) => source.role === "constraints").obligations = ["PPC-W99"];
    writeBothResults(falseObligation);
    const obligationMismatch = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(obligationMismatch.ok, false);
    assert.ok(obligationMismatch.errors.some((error) => error.includes("obligation result/artifact mismatch")));
    writeBothResults(topResult);

    const falseDescent = structuredClone(topResult);
    falseDescent.integration.descends_from = [...falseDescent.integration.descends_from].reverse();
    writeBothResults(falseDescent);
    const descentMismatch = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(descentMismatch.ok, false);
    assert.ok(descentMismatch.errors.some((error) => error.includes("integration result/artifact mismatch")));
    writeBothResults(topResult);

    const falseEnvelope = structuredClone(topResult);
    falseEnvelope.kind = "claim";
    falseEnvelope.candidate_plan.path = "docs/runs/forged-candidate.md";
    falseEnvelope.integrated_candidate.artifact_ref = `sha256:${"0".repeat(64)}`;
    falseEnvelope.matured_plan.path = "docs/runs/forged-matured.md";
    falseEnvelope.sources[0].provenance_key = "openai:forged-source";
    falseEnvelope.integration.provenance_key = "anthropic:forged-integration";
    falseEnvelope.verifications[0].provenance_key = "openai:forged-verification";
    falseEnvelope.conflicts = [{ role: "forged", detail: ["not artifact-derived"] }];
    falseEnvelope.independent_recheck.conflicts = falseEnvelope.conflicts;
    falseEnvelope.signed_events.path = "docs/runs/forged-events.jsonl";
    writeBothResults(falseEnvelope);
    const envelopeMismatch = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(envelopeMismatch.ok, false);
    for (const expected of [
      "result evidence envelope mismatch",
      "candidate-plan path binding mismatch",
      "integrated-candidate binding mismatch",
      "matured-plan path binding mismatch",
      "constraints source provenance-key mismatch",
      "integration provenance-key mismatch",
      "constraints verification provenance-key mismatch",
      "recorded conflict set mismatch",
      "signed-event path binding mismatch"
    ]) {
      assert.ok(envelopeMismatch.errors.some((error) => error.includes(expected)), expected);
    }
    writeBothResults(topResult);

    const artifactsDir = path.join(runDir, "attempts/attempt-001/artifacts");
    const artifactStore = createArtifactStore(artifactsDir);
    const extra = artifactStore.write({ kind: "unreferenced", value: true });
    const contaminated = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(contaminated.ok, false);
    assert.ok(contaminated.errors.some((error) => error.includes("unreferenced artifact")));
    unlinkSync(extra.path);

    const integrationRef = topResult.integration.candidate_ref.replace("sha256:", "");
    const integrationPath = path.join(artifactsDir, `${integrationRef}.json`);
    const original = readFileSync(integrationPath);
    writeFileSync(integrationPath, original.toString("utf8").replace("integration-candidate", "tampered-candidate"));
    const tampered = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(tampered.ok, false);
    assert.ok(tampered.errors.some((error) => error.includes("artifact hash mismatch")));
    writeFileSync(integrationPath, original);

    rmSync(artifactsDir, { recursive: true, force: true });
    const missingArtifacts = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(missingArtifacts.ok, false);
    assert.equal(existsSync(artifactsDir), false, "verification must be read-only");

    rmSync(path.join(runDir, "attempts/attempt-001"), { recursive: true, force: true });
    cpSync(path.join(runDir, "result.json"), path.join(runDir, "orphan-result.json"));
    const missingAttempt = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(missingAttempt.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 3 OK: smoke workshop converges and verifier fails closed");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-revised-"));
  const runDir = path.join(root, "docs/runs/workshop");
  try {
    writeFixtureInputs(root, runDir);
    const summary = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: makeFixtureCallSeat({ revise: true })
    });
    assert.equal(summary.matured_plan_changed, true);
    const initial = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(initial.ok, true, initial.errors.join("; "));

    const matured = readFileSync(path.join(runDir, "matured-plan.md"));
    writeFileSync(path.join(root, fixturePaths.candidate), matured);
    const historical = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(historical.ok, true, historical.errors.join("; "));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 4 OK: a revised plan remains verifiable after canonical adoption");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-stale-"));
  const runDir = path.join(root, "docs/runs/workshop");
  try {
    writeFixtureInputs(root, runDir);
    await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: makeFixtureCallSeat()
    });
    const priorMatured = readFileSync(path.join(runDir, "matured-plan.md"));
    const conflicted = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-002",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: makeFixtureCallSeat({ conflictRole: "constraints" })
    });
    assert.equal(conflicted.state, "conflict");
    assert.equal(conflicted.terminal, "needs-eye");
    assert.equal(existsSync(path.join(runDir, "matured-plan.md")), false);

    writeFileSync(path.join(runDir, "matured-plan.md"), priorMatured);
    const stale = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(stale.ok, false);
    assert.ok(stale.errors.some((error) => error.includes("stale top-level matured plan")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 5 OK: a later conflict removes and rejects stale matured output");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-secret-"));
  const runDir = path.join(root, "docs/runs/workshop");
  const secret = `sk-ant-${"A".repeat(32)}`;
  try {
    writeFixtureInputs(root, runDir);
    await assert.rejects(runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: makeFixtureCallSeat({ secret })
    }), /secret material/);
    const artifactsDir = path.join(runDir, "attempts/attempt-001/artifacts");
    const persisted = readdirSync(artifactsDir)
      .map((file) => readFileSync(path.join(artifactsDir, file), "utf8"))
      .join("\n");
    assert.equal(persisted.includes(secret), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 6 OK: rejected secret-bearing output never reaches the artifact store");
}

{
  for (const [attemptId, callSeat, message] of [
    ["attempt-001", makeFixtureCallSeat({ openImplementation: true }), /implementation\/author.*closed shape/],
    ["attempt-002", makeFixtureCallSeat({ invalidVerifierRole: "constraints" }), /constraints\/verify.*verdict/]
  ]) {
    const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-schema-"));
    const runDir = path.join(root, "docs/runs/workshop");
    try {
      writeFixtureInputs(root, runDir);
      await assert.rejects(runWorkshop({
        repoRoot: root,
        runDir,
        attemptId,
        mode: "smoke",
        paths: fixturePaths,
        callSeat
      }), message);
      const artifactsDir = path.join(runDir, "attempts", attemptId, "artifacts");
      const persisted = readdirSync(artifactsDir)
        .map((file) => readFileSync(path.join(artifactsDir, file), "utf8"))
        .join("\n");
      assert.equal(persisted.includes("must not persist"), false);
      assert.equal(persisted.includes('"verdict":"maybe"'), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
  console.log("Case 7 OK: open or invalid seat responses are rejected before persistence");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-governed-"));
  const customRunDir = path.join(root, "docs/runs/workshop");
  const governedRunDir = path.join(root, "docs/runs/production-profile-compiler-1-workshop");
  try {
    writeFixtureInputs(root, customRunDir);
    mkdirSync(governedRunDir, { recursive: true });
    await assert.rejects(runWorkshop({
      repoRoot: root,
      runDir: governedRunDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: makeFixtureCallSeat()
    }), /smoke.*governed workshop directory/);

    await runWorkshop({
      repoRoot: root,
      runDir: customRunDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: makeFixtureCallSeat()
    });
    rmSync(governedRunDir, { recursive: true, force: true });
    cpSync(customRunDir, governedRunDir, { recursive: true });
    const governed = verifyWorkshop({
      repoRoot: root,
      runDir: governedRunDir,
      allowSmoke: true
    });
    assert.equal(governed.ok, false);
    assert.ok(governed.errors.some((error) => error.includes("governed workshop directory")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 8 OK: library APIs cannot opt smoke evidence into the governed path");
}

{
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(here, "../../..");
  const temporaryRelative = `docs/runs/production-profile-compiler-1-workshop/.cli-smoke-${process.pid}`;
  const temporary = path.join(repoRoot, temporaryRelative);
  try {
    execFileSync(process.execPath, [
      path.join(here, "run-workshop.mjs"),
      "--smoke",
      "--attempt",
      "attempt-999",
      "--run-dir",
      temporaryRelative
    ], { cwd: repoRoot, stdio: "pipe" });
    assert.throws(() => execFileSync(process.execPath, [
      path.join(here, "verify-workshop.mjs"),
      "--run-dir",
      temporaryRelative
    ], { cwd: repoRoot, encoding: "utf8" }), (error) => error.status === 3);
    const output = execFileSync(process.execPath, [
      path.join(here, "verify-workshop.mjs"),
      "--allow-smoke",
      "--run-dir",
      temporaryRelative
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.match(output, /WORKSHOP SMOKE VERIFIED/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  console.log("Case 9 OK: CLI smoke run is independently verifiable");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-live-source-"));
  const runDir = path.join(root, "docs/runs/production-profile-compiler-1-workshop");
  let call = 0;
  try {
    writeFixtureInputs(root, runDir);
    const fixtureSeat = makeFixtureCallSeat();
    const callSeat = async (request) => {
      const response = await fixtureSeat(request);
      call += 1;
      response.provenance = {
        provider: request.seat === "claude" ? "anthropic" : "openai",
        model: request.seat === "claude" ? "claude-sonnet-5" : "gpt-5.6-sol",
        response_id: `provider-response-${call}`,
        source: request.seat === "claude" ? "claude-code/print" : "ai-peer-mcp/codex_ask"
      };
      return response;
    };
    const summary = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "live",
      paths: fixturePaths,
      callSeat
    });
    assert.equal(summary.state, "converged-parallel");
    const verified = verifyWorkshop({ repoRoot: root, runDir });
    assert.equal(verified.ok, true, verified.errors.join("; "));
    assert.equal(verified.provenance_count, 5);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 10 OK: live Claude CLI provenance is explicit and independently verifiable");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-claude-code-seat-"));
  const executable = path.join(root, "claude-fixture.mjs");
  try {
    writeFileSync(executable, `#!/usr/bin/env node
let prompt = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) prompt += chunk;
if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.OPENAI_API_KEY) process.exit(40);
if (prompt !== "fixture prompt") process.exit(41);
const schemaIndex = process.argv.indexOf("--json-schema");
if (schemaIndex < 0 || JSON.parse(process.argv[schemaIndex + 1]).required[0] !== "marker") process.exit(42);
if (!process.argv.includes("--bare")) process.exit(43);
if (process.argv.includes("--max-budget-usd")) process.exit(44);
process.stdout.write(JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  structured_output: { marker: "CLAUDE_CODE_SEAT_OK" },
  uuid: "provider-cli-response-1",
  modelUsage: {
    "claude-haiku-4-5": { outputTokens: 2 },
    "claude-sonnet-5": { outputTokens: 12 }
  }
}));
`);
    chmodSync(executable, 0o700);
    const response = await callClaudeCode({
      prompt: "fixture prompt",
      system: "fixture system",
      model: "sonnet",
      effort: "high",
      response_schema: {
        type: "object",
        additionalProperties: false,
        properties: { marker: { type: "string" } },
        required: ["marker"]
      }
    }, {
      executable,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: "must-not-reach-child",
        ANTHROPIC_AUTH_TOKEN: "must-not-reach-child",
        OPENAI_API_KEY: "must-not-reach-child"
      }
    });
    assert.equal(response.text, "{\"marker\":\"CLAUDE_CODE_SEAT_OK\"}");
    assert.equal(response.model, "claude-haiku-4-5+claude-sonnet-5");
    assert.equal(response.id, "provider-cli-response-1");
    assert.equal(response.usage.prompt_bytes, Buffer.byteLength("fixture system") + Buffer.byteLength("fixture prompt"));
    assert.equal(response.usage.response_bytes > 0, true);
    assert.equal(response.usage.provider.model_usage["claude-sonnet-5"].outputTokens, 12);
    assert.equal(Number.isInteger(response.usage.elapsed_ms), true);

    writeFileSync(executable, `#!/usr/bin/env node
if (process.argv.includes("--max-turns")) {
  process.stderr.write("one-turn cap must not constrain structured long-context integration");
  process.exit(8);
}
process.stdin.resume();
process.stdin.on("end", () => {
  process.stdout.write(JSON.stringify({
    type: "result",
    subtype: "error_max_budget_usd",
    is_error: true,
    terminal_reason: "budget_exhausted",
    errors: ["Reached maximum budget ($3)"],
    uuid: "provider-cli-response-2"
  }));
  process.exit(1);
});
`);
    await assert.rejects(callClaudeCode({
      prompt: "fixture prompt",
      system: "fixture system",
      model: "sonnet",
      effort: "high",
      response_schema: {
        type: "object",
        properties: { marker: { type: "string" } },
        required: ["marker"]
      }
    }, {
      executable,
      env: {
        ...process.env,
        CLAUDE_CODE_MAX_BUDGET_USD: "3"
      }
    }), /error_max_budget_usd.*budget_exhausted.*Reached maximum budget/);

    const spawnMarker = path.join(root, "claude-spawned");
    writeFileSync(executable, `#!/usr/bin/env node
require("node:fs").writeFileSync(${JSON.stringify(spawnMarker)}, "spawned");
process.exit(50);
`);
    await assert.rejects(callClaudeCode({
      prompt: "fixture prompt",
      system: "fixture system",
      model: "sonnet",
      effort: "high",
      max_input_bytes: 1,
      response_schema: {
        type: "object",
        properties: { marker: { type: "string" } },
        required: ["marker"]
      }
    }, { executable }), /input.*byte budget/i);
    assert.equal(existsSync(spawnMarker), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 11 OK: Claude CLI transport is structured, isolated, and reports fail-closed causes");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-workshop-ruling-"));
  const runDir = path.join(root, "docs/runs/workshop");
  try {
    writeFixtureInputs(root, runDir);
    writeFileSync(path.join(root, fixturePathsV2.ruling), `${JSON.stringify(controllerRuling(), null, 2)}\n`);
    const summary = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePathsV2,
      callSeat: makeFixtureCallSeat()
    });
    assert.equal(summary.contract, "production-profile-compiler-daedalus-workshop/2");
    assert.equal(summary.inputs.ruling.path, fixturePathsV2.ruling);
    const verified = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
    assert.equal(verified.ok, true, verified.errors.join("; "));

    const stale = controllerRuling();
    stale.candidate_plan.raw_sha256 = `sha256:${"0".repeat(64)}`;
    writeFileSync(path.join(root, fixturePathsV2.ruling), `${JSON.stringify(stale, null, 2)}\n`);
    let calls = 0;
    await assert.rejects(runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-002",
      mode: "smoke",
      paths: fixturePathsV2,
      callSeat: async (request) => {
        calls += 1;
        return makeFixtureCallSeat()(request);
      }
    }), /controller ruling.*candidate/i);
    assert.equal(calls, 0);
    assert.equal(existsSync(path.join(runDir, "attempts/attempt-002")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 12 OK: a V2 frame requires an exact candidate-bound non-authorizing Eye ruling");
}

{
  const before = readdirSync(path.join(path.dirname(new URL(import.meta.url).pathname), "attempts")).sort();
  const output = execFileSync(process.execPath, [
    path.join(path.dirname(new URL(import.meta.url).pathname), "run-workshop.mjs"),
    "--preflight"
  ], {
    encoding: "utf8",
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      CLAUDE_CODE_OAUTH: ""
    }
  });
  const report = JSON.parse(output);
  assert.equal(report.kind, "workshop-preflight");
  assert.equal(report.contract, "production-profile-compiler-daedalus-workshop/2");
  assert.equal(report.provider_calls_authorized, false);
  assert.equal(report.aggregate_spending_limit_usd, null);
  assert.equal(report.budget_status, "awaiting-eye-approval");
  assert.equal(report.call_plan.length, 5);
  assert.equal(report.call_plan.filter((call) => Number.isInteger(call.prompt_bytes)).length, 2);
  assert.equal(report.call_plan.filter((call) => call.prompt_bytes === null).length, 3);
  assert.ok(report.frozen_frame.bytes > 0);
  assert.ok(report.known_prompt_bytes > report.frozen_frame.bytes * 2);
  assert.deepEqual(
    readdirSync(path.join(path.dirname(new URL(import.meta.url).pathname), "attempts")).sort(),
    before
  );
  console.log("Case 13 OK: preflight is read-only, provider-free, and budget-blocked");
}

{
  const { callCodexCli } = await import("./codex-cli-seat.mjs");
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-codex-cli-seat-"));
  const executable = path.join(root, "codex");
  try {
    writeFileSync(executable, `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
  process.stderr.write("provider secret reached child");
  process.exit(9);
}
const outputIndex = args.indexOf("--output-last-message");
writeFileSync(args[outputIndex + 1], JSON.stringify({ marker: "CODEX_CLI_SEAT_OK" }));
process.stdout.write(JSON.stringify({ type: "thread.started", thread_id: "codex-thread-1" }) + "\\n");
process.stdout.write(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 10, output_tokens: 2 } }) + "\\n");
`);
    chmodSync(executable, 0o700);
    const response = await callCodexCli({
      prompt: "fixture prompt",
      system: "fixture system",
      model: "gpt-5.6-sol",
      effort: "high",
      response_schema: {
        type: "object",
        additionalProperties: false,
        properties: { marker: { type: "string" } },
        required: ["marker"]
      }
    }, {
      executable,
      env: {
        ...process.env,
        OPENAI_API_KEY: "must-not-reach-child",
        ANTHROPIC_API_KEY: "must-not-reach-child",
        ANTHROPIC_AUTH_TOKEN: "must-not-reach-child"
      }
    });
    assert.equal(response.text, "{\"marker\":\"CODEX_CLI_SEAT_OK\"}");
    assert.equal(response.model, "gpt-5.6-sol");
    assert.equal(response.id, "codex-thread-1");
    assert.equal(response.usage.provider.input_tokens, 10);
    assert.equal(response.usage.provider.output_tokens, 2);
    assert.equal(response.usage.response_bytes > 0, true);
    assert.equal(Number.isInteger(response.usage.elapsed_ms), true);

    const spawnMarker = path.join(root, "codex-spawned");
    writeFileSync(executable, `#!/usr/bin/env node
require("node:fs").writeFileSync(${JSON.stringify(spawnMarker)}, "spawned");
process.exit(50);
`);
    await assert.rejects(callCodexCli({
      prompt: "fixture prompt",
      system: "fixture system",
      model: "gpt-5.6-sol",
      effort: "high",
      max_input_bytes: 1,
      response_schema: {
        type: "object",
        properties: { marker: { type: "string" } },
        required: ["marker"]
      }
    }, { executable }), /input.*byte budget/i);
    assert.equal(existsSync(spawnMarker), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 14 OK: Codex CLI subscription transport is structured and secret-isolated");
}

{
  const fixtureInputs = {
    design: { path: "design.md", text: "# Design\n\nBinding design text.\n" },
    candidate: {
      path: "candidate.md",
      text: "# Candidate\n\nBinding candidate text.\n\nRequired mechanism.\n"
    }
  };
  const registry = {
    review_registry_version: 1,
    contract: "production-profile-compiler-review/1",
    obligations: [{
      obligation_id: "PPC-W01",
      invariant: "The exact design remains binding.",
      negative_test: "A stale design binding blocks.",
      exit_criterion: "The exact design binding verifies.",
      source_bindings: [{
        input: "design",
        literal: "Binding design text."
      }],
      mechanical_checks: [{
        check_id: "candidate-required-mechanism",
        kind: "contains-all",
        input: "candidate",
        scope: null,
        values: ["Required mechanism."],
        expected_count: null
      }]
    }]
  };
  const loaded = loadReviewRegistry({
    registryText: JSON.stringify(registry),
    inputs: fixtureInputs
  });
  assert.deepEqual(
    loaded.registry.obligations.map((entry) => entry.obligation_id),
    ["PPC-W01"]
  );
  assert.match(loaded.registry_ref, /^sha256:[0-9a-f]{64}$/);
  assert.equal(loaded.bindings["PPC-W01"][0].text, "Binding design text.");
  assert.match(loaded.bindings["PPC-W01"][0].bytes_sha256, /^sha256:[0-9a-f]{64}$/);

  const unknownKey = structuredClone(registry);
  unknownKey.extra = true;
  assert.throws(() => loadReviewRegistry({
    registryText: JSON.stringify(unknownKey),
    inputs: fixtureInputs
  }), /registry.*closed shape/i);

  const duplicate = structuredClone(registry);
  duplicate.obligations.push(structuredClone(duplicate.obligations[0]));
  assert.throws(() => loadReviewRegistry({
    registryText: JSON.stringify(duplicate),
    inputs: fixtureInputs
  }), /obligation IDs.*unique/i);

  const ambiguousInputs = structuredClone(fixtureInputs);
  ambiguousInputs.design.text += "\nBinding design text.\n";
  assert.throws(() => loadReviewRegistry({
    registryText: JSON.stringify(registry),
    inputs: ambiguousInputs
  }), /source binding.*exactly once/i);

  const unknownKind = structuredClone(registry);
  unknownKind.obligations[0].mechanical_checks[0].kind = "model-decides";
  assert.throws(() => loadReviewRegistry({
    registryText: JSON.stringify(unknownKind),
    inputs: fixtureInputs
  }), /mechanical check kind/i);
  console.log("Case 15 OK: controller review registry is closed, ordered, and source-bound");
}

{
  const fixtureInputs = {
    design: { path: "design.md", text: "# Design\n\nBinding design text.\n" },
    candidate: {
      path: "candidate.md",
      text: [
        "# Candidate",
        "",
        "START REVIEW SCOPE",
        "Required alpha.",
        "Required beta.",
        "One marker.",
        "END REVIEW SCOPE",
        "",
        "Forbidden text is outside the scope."
      ].join("\n")
    }
  };
  const registry = {
    review_registry_version: 1,
    contract: "production-profile-compiler-review/1",
    obligations: [{
      obligation_id: "PPC-W01",
      invariant: "The scoped candidate requirements remain complete.",
      negative_test: "A missing, forbidden, or duplicate literal blocks.",
      exit_criterion: "Every mechanical predicate passes.",
      source_bindings: [{
        input: "design",
        literal: "Binding design text."
      }],
      mechanical_checks: [{
        check_id: "contains-required",
        kind: "contains-all",
        input: "candidate",
        scope: {
          start_literal: "START REVIEW SCOPE",
          end_literal: "END REVIEW SCOPE"
        },
        values: ["Required alpha.", "Required beta."],
        expected_count: null
      }, {
        check_id: "exact-marker",
        kind: "exact-count",
        input: "candidate",
        scope: {
          start_literal: "START REVIEW SCOPE",
          end_literal: "END REVIEW SCOPE"
        },
        values: ["One marker."],
        expected_count: 1
      }, {
        check_id: "exclude-forbidden",
        kind: "excludes-all",
        input: "candidate",
        scope: {
          start_literal: "START REVIEW SCOPE",
          end_literal: "END REVIEW SCOPE"
        },
        values: ["Forbidden text"],
        expected_count: null
      }]
    }]
  };
  const loadedRegistry = loadReviewRegistry({
    registryText: JSON.stringify(registry),
    inputs: fixtureInputs
  });
  const passed = runReviewPreflight({ loadedRegistry, inputs: fixtureInputs });
  assert.equal(passed.status, "pass");
  assert.deepEqual(
    passed.checks.map((check) => check.check_id),
    ["contains-required", "exact-marker", "exclude-forbidden"]
  );
  assert.ok(passed.checks.every((check) => check.status === "pass"));
  assert.ok(passed.checks.every((check) => check.evidence_refs.length > 0));

  const failingInputs = structuredClone(fixtureInputs);
  failingInputs.candidate.text = failingInputs.candidate.text
    .replace("Required beta.", "")
    .replace("One marker.", "One marker.\nOne marker.")
    .replace("Required alpha.", "Required alpha.\nForbidden text");
  const blocked = runReviewPreflight({ loadedRegistry, inputs: failingInputs });
  assert.equal(blocked.status, "blocked");
  assert.deepEqual(
    blocked.checks.filter((check) => check.status === "fail").map((check) => check.check_id),
    ["contains-required", "exact-marker", "exclude-forbidden"]
  );
  assert.match(blocked.registry_ref, /^sha256:[0-9a-f]{64}$/);
  console.log("Case 16 OK: deterministic mechanical preflight is scoped and fail-closed");
}

{
  const registry = {
    review_registry_version: 1,
    contract: "production-profile-compiler-review/1",
    obligations: [{
      obligation_id: "PPC-W01",
      invariant: "Alpha remains controller-bound.",
      negative_test: "An ambiguous alpha mechanism blocks.",
      exit_criterion: "The alpha mechanism and task resolve uniquely.",
      source_bindings: [{ input: "design", literal: "Alpha design." }],
      mechanical_checks: []
    }, {
      obligation_id: "PPC-W02",
      invariant: "Beta remains fail-closed.",
      negative_test: "An omitted beta task blocks.",
      exit_criterion: "The beta mechanism and task resolve uniquely.",
      source_bindings: [{ input: "design", literal: "Beta design." }],
      mechanical_checks: []
    }]
  };
  const inputs = {
    design: { path: "design.md", text: "Alpha design.\nBeta design.\n" },
    candidate: { path: "candidate.md", text: candidate }
  };
  const loaded = loadReviewRegistry({
    registryText: JSON.stringify(registry),
    inputs
  });
  const response = {
    decision: "revise",
    maturation_summary: "Bind alpha while preserving beta.",
    replacements: [{
      old: "Alpha.",
      new: "Alpha uses controller enforcement.",
      reason: "PPC-W01 requires controller enforcement.",
      obligation_ids: ["PPC-W01"]
    }],
    mappings: [{
      obligation_id: "PPC-W01",
      mechanism_quote: "Alpha uses controller enforcement.",
      task_quote: "Alpha uses controller enforcement."
    }, {
      obligation_id: "PPC-W02",
      mechanism_quote: "Beta.",
      task_quote: "Beta."
    }]
  };
  const materialized = applySparseIntegration({
    candidate,
    registry: loaded.registry,
    response
  });
  assert.equal(
    materialized.plan,
    "# Candidate\n\nAlpha uses controller enforcement.\n\nBeta.\n"
  );
  assert.equal(materialized.obligation_matrix.length, 2);
  assert.deepEqual(materialized.obligation_matrix[0], {
    obligation_id: "PPC-W01",
    invariant: "Alpha remains controller-bound.",
    mechanism: "Alpha uses controller enforcement.",
    task: "Alpha uses controller enforcement.",
    negative_test: "An ambiguous alpha mechanism blocks.",
    exit_criterion: "The alpha mechanism and task resolve uniquely."
  });
  assert.equal(materialized.mapping_evidence.length, 2);
  assert.match(materialized.mapping_evidence[0].mechanism.bytes_sha256, /^sha256:[0-9a-f]{64}$/);

  const modelMatrix = structuredClone(response);
  modelMatrix.obligation_matrix = matrix;
  assert.throws(() => applySparseIntegration({
    candidate,
    registry: loaded.registry,
    response: modelMatrix
  }), /integration response.*closed shape/i);

  const missingMapping = structuredClone(response);
  missingMapping.mappings.pop();
  assert.throws(() => applySparseIntegration({
    candidate,
    registry: loaded.registry,
    response: missingMapping
  }), /mapping.*coverage/i);

  const ambiguous = structuredClone(response);
  ambiguous.mappings[1].mechanism_quote = "a";
  assert.throws(() => applySparseIntegration({
    candidate,
    registry: loaded.registry,
    response: ambiguous
  }), /mechanism quote.*exactly once/i);
  console.log("Case 17 OK: the controller applies sparse integration and materializes the matrix");
}

{
  const inputs = {
    design: {
      path: "design.md",
      text: "# Design\n\nConstraint source passage.\nImplementation source passage.\n"
    },
    candidate: { path: "candidate.md", text: candidate }
  };
  const registry = {
    review_registry_version: 1,
    contract: "production-profile-compiler-review/1",
    obligations: [{
      obligation_id: "PPC-W01",
      invariant: "The source passage remains bound.",
      negative_test: "A stale passage blocks.",
      exit_criterion: "The capsule verifies against current bytes.",
      source_bindings: [{
        input: "design",
        literal: "Constraint source passage."
      }],
      mechanical_checks: []
    }]
  };
  const loadedRegistry = loadReviewRegistry({
    registryText: JSON.stringify(registry),
    inputs
  });
  const preflight = runReviewPreflight({ loadedRegistry, inputs });
  const compiled = createReviewCapsule({
    role: "constraints",
    loadedRegistry,
    preflight,
    inputs
  });
  assert.equal(compiled.capsule.role, "constraints");
  assert.equal(compiled.capsule.passages.length, 1);
  assert.equal(compiled.capsule.passages[0].text, "Constraint source passage.");
  assert.match(compiled.capsule_ref, /^sha256:[0-9a-f]{64}$/);
  assert.doesNotThrow(() => verifyReviewCapsule({
    capsule: compiled.capsule,
    loadedRegistry,
    preflight,
    inputs
  }));

  const staleInputs = structuredClone(inputs);
  staleInputs.design.text = staleInputs.design.text.replace("source passage", "changed passage");
  assert.throws(() => verifyReviewCapsule({
    capsule: compiled.capsule,
    loadedRegistry,
    preflight,
    inputs: staleInputs
  }), /capsule passage.*stale/i);
  assert.equal(JSON.stringify(compiled.capsule).includes("/home/"), false);
  console.log("Case 18 OK: review capsules are compact, content-addressed, and byte-bound");
}

{
  const root = mkdtempSync(path.join(os.tmpdir(), "ppc-sparse-workshop-"));
  const runDir = path.join(root, "docs/runs/workshop");
  try {
    writeFixtureInputs(root, runDir);
    const registry = {
      review_registry_version: 1,
      contract: "production-profile-compiler-review/1",
      obligations: [{
        obligation_id: "PPC-W01",
        invariant: "The candidate remains controller-bound.",
        negative_test: "Removing Alpha blocks preflight.",
        exit_criterion: "Alpha maps to a unique mechanism and task.",
        source_bindings: [{
          input: "design",
          literal: "# Design"
        }],
        mechanical_checks: [{
          check_id: "candidate-has-alpha",
          kind: "contains-all",
          input: "candidate",
          scope: null,
          values: ["Alpha."],
          expected_count: null
        }]
      }]
    };
    let calls = 0;
    const sparseCallSeat = async ({ seat, role, phase, review_mode }) => {
      calls += 1;
      assert.equal(review_mode, "sparse");
      const provenance = {
        provider: seat === "claude" ? "anthropic" : "openai",
        model: `${seat}-sparse-fixture`,
        response_id: `sparse-${calls}`,
        source: "workshop-smoke"
      };
      if (phase === "author") {
        const response = {
          findings: [{
            finding_id: `${role}-PPC-W01`,
            obligation_id: "PPC-W01",
            disposition: "satisfied",
            evidence_quotes: [{ input: "candidate", quote: "Alpha." }],
            detail: "The candidate contains the uniquely bound mechanism.",
            proposed_replacement: null
          }]
        };
        return { provenance, response };
      }
      if (phase === "integrate") {
        return {
          provenance,
          response: {
            decision: "preserve",
            maturation_summary: "The sparse findings require no candidate change.",
            replacements: [],
            mappings: [{
              obligation_id: "PPC-W01",
              mechanism_quote: "Alpha.",
              task_quote: "Alpha."
            }]
          }
        };
      }
      const response = { verdict: "preserved", conflicts: [] };
      return { ...response, provenance, response };
    };
    const summary = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: "attempt-001",
      mode: "smoke",
      paths: fixturePaths,
      callSeat: sparseCallSeat,
      reviewRegistryText: JSON.stringify(registry)
    });
    assert.equal(calls, 5);
    assert.equal(summary.state, "converged-parallel");
    assert.equal(summary.integration.obligation_matrix.length, 1);
    assert.equal(summary.integration.obligation_matrix[0].invariant, registry.obligations[0].invariant);
    assert.equal(summary.integration.obligation_matrix[0].mechanism, "Alpha.");

    const blockedRoot = mkdtempSync(path.join(os.tmpdir(), "ppc-sparse-blocked-"));
    try {
      const blockedRunDir = path.join(blockedRoot, "docs/runs/workshop");
      writeFixtureInputs(blockedRoot, blockedRunDir);
      writeFileSync(
        path.join(blockedRoot, fixturePaths.candidate),
        candidate.replace("Alpha.", "Removed.")
      );
      let blockedCalls = 0;
      const blocked = await runWorkshop({
        repoRoot: blockedRoot,
        runDir: blockedRunDir,
        attemptId: "attempt-001",
        mode: "smoke",
        paths: fixturePaths,
        callSeat: async () => {
          blockedCalls += 1;
          throw new Error("must not be called");
        },
        reviewRegistryText: JSON.stringify(registry)
      });
      assert.equal(blocked.state, "blocked");
      assert.equal(blocked.reason, "mechanical-preflight");
      assert.equal(blockedCalls, 0);
    } finally {
      rmSync(blockedRoot, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log("Case 19 OK: sparse review preserves five calls and blocks mechanical failures pre-provider");
}

{
  const here = path.dirname(new URL(import.meta.url).pathname);
  const repoRoot = path.resolve(here, "../../..");
  const actualPaths = {
    candidate: "docs/superpowers/plans/2026-07-20-deterministic-production-profile-compiler.md",
    design: "docs/superpowers/specs/2026-07-20-deterministic-production-profile-compiler-design.md",
    preReview: "docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-20-production-profile-compiler-1.json",
    methodology: "docs/daedalus-methodology.md",
    comprehension: "docs/runs/production-profile-compiler-1-workshop/reader-validation-artifact.json",
    ruling: "docs/runs/production-profile-compiler-1-workshop/controller-ruling-file-ingress.json"
  };
  const inputs = Object.fromEntries(Object.entries(actualPaths).map(([name, relative]) => [
    name,
    {
      path: relative,
      text: readFileSync(path.join(repoRoot, relative), "utf8")
    }
  ]));
  const registryText = readFileSync(path.join(here, "review-registry.v1.json"), "utf8");
  const loaded = loadReviewRegistry({ registryText, inputs });
  assert.deepEqual(
    loaded.registry.obligations.map((obligation) => obligation.obligation_id),
    Array.from({ length: 29 }, (_, index) => `PPC-W${String(index + 1).padStart(2, "0")}`)
  );
  assert.deepEqual(
    loaded.registry.obligations.flatMap((obligation) => (
      obligation.mechanical_checks.map((check) => check.check_id)
    )),
    [
      "authority-input-bindings",
      "portable-root-and-separator-matrix",
      "complete-execution-source-closure",
      "runtime-tier-cannot-use-structural-substitute",
      "demo-immutable-attempt-publication"
    ]
  );
  const preflight = runReviewPreflight({ loadedRegistry: loaded, inputs });
  assert.equal(preflight.status, "pass");
  assert.ok(preflight.checks.every((check) => check.status === "pass"));
  for (const obligation of loaded.registry.obligations) {
    for (const check of obligation.mechanical_checks) {
      const mutatedInputs = structuredClone(inputs);
      for (const value of check.values) {
        mutatedInputs[check.input].text = mutatedInputs[check.input].text.replaceAll(value, "");
      }
      const mutatedLoaded = loadReviewRegistry({ registryText, inputs: mutatedInputs });
      const mutated = runReviewPreflight({
        loadedRegistry: mutatedLoaded,
        inputs: mutatedInputs
      });
      assert.equal(mutated.status, "blocked");
      assert.deepEqual(
        mutated.checks.filter((row) => row.status === "fail").map((row) => row.check_id),
        [check.check_id]
      );
    }
  }
  {
    const driftedInputs = structuredClone(inputs);
    const firstCheck = loaded.registry.obligations
      .flatMap((obligation) => obligation.mechanical_checks)
      .find((check) => check.input === "candidate");
    driftedInputs.candidate.text = driftedInputs.candidate.text.replaceAll(firstCheck.values[0], "");
    assert.notEqual(driftedInputs.candidate.text, inputs.candidate.text);
    assert.throws(
      () => runReviewPreflight({ loadedRegistry: loaded, inputs: driftedInputs }),
      /loaded source binding is stale/
    );
  }
  console.log("Case 20 OK: the real registry passes and every mechanical contract has a discriminating mutation");
}

console.log("test-workshop.mjs OK");
