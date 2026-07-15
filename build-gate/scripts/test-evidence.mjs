// test-evidence.mjs — closed-whitelist evidence verifier: dispatch, per-kind verifiers, sandbox.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair, makeRecord, appendLedger } from "../../merkle-dag/crypto.mjs";
import { computeDiskTreeHash } from "../../merkle-dag/artifact.mjs";
import { compileAndHashPlan } from "../../merkle-dag/planner.mjs";
import { writePlan } from "../../merkle-dag/merkle.mjs";
import { signPacket } from "../sign.mjs";
import {
  EVIDENCE_KINDS, deriveClaimId, verifyEvidence, scrubbedEnv, testProvenance
} from "../evidence.mjs";

// Build a real workspace + a plan with a node whose test we can point evidence at.
function fixture() {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-evi-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });
  writeFileSync(path.join(ws, "a.txt"), "hello\n");
  const { privatePem, publicJwk } = generateKeypair();
  const tasks = [{ id: "A", writes: ["a.txt"], reads: [], requirements: "a", test: { cmd: "node", args: ["-e", "process.exit(1)"] } }];
  const { plan } = compileAndHashPlan({ tasks, authorizedSigners: { tester: publicJwk }, repoRoot: ws });
  writePlan(telosDir, plan);
  const disk = computeDiskTreeHash(plan.nodes[0].files, ws);
  appendLedger(path.join(telosDir, "ledger.jsonl"), makeRecord({ task_id: "A", effective_hash: plan.nodes[0].effective_hash, artifact_tree_hash: disk.tree_hash, artifact_files: disk.files }, "tester", privatePem));
  return { ws, telosDir, plan, privatePem, publicJwk };
}

// Case 1: closed dispatch — frozen registry, unknown kind, forbidden + unregistered params.
{
  assert.ok(Object.isFrozen(EVIDENCE_KINDS), "registry frozen");
  assert.match((await verifyEvidence({ kind: "nope", params: {} })).rejected, /unregistered evidence kind/);
  assert.match((await verifyEvidence({ kind: "plan-hash-mismatch", params: { cmd: "rm -rf /" } })).rejected, /forbidden param/);
  assert.match((await verifyEvidence({ kind: "plan-hash-mismatch", params: { script: "x" } })).rejected, /forbidden param/);
  assert.match((await verifyEvidence({ kind: "plan-hash-mismatch", params: { bogus: 1 } })).rejected, /unregistered claim parameter/);
  console.log("Case 1 OK: closed dispatch");
}

// Case 2: arbitrary model-authored evidence "script" is rejected WITHOUT execution (sentinel proof).
{
  const { ws, telosDir } = fixture();
  const sentinel = path.join(ws, "SENTINEL");
  // A malicious claim tries to smuggle a command; the forbidden-param guard rejects pre-FS.
  const r = await verifyEvidence({ kind: "declared-test-failure", concern_ref: "sha256:c", params: { node_id: "A", command: `node -e "require('fs').writeFileSync('${sentinel}','x')"` } }, { baseDir: ws, telosDir });
  assert.equal(r.accepted, false, "rejected");
  assert.equal(existsSync(sentinel), false, "sentinel NOT created — nothing executed");
  console.log("Case 2 OK: model-authored script rejected without execution");
}

// Case 3: scrubbedEnv strips secrets + NODE_OPTIONS.
{
  const env = scrubbedEnv({ PATH: "/x", TELOS_SECRET_FOO: "s", ANTHROPIC_API_KEY: "k", TELOS_ED25519_SK_X: "z", NODE_OPTIONS: "--require evil", HOME: "/h" });
  assert.deepEqual(Object.keys(env).sort(), ["PATH"], "only PATH survives");
  console.log("Case 3 OK: scrubbedEnv");
}

// Case 4: plan-hash-mismatch (pure) — matches vs tampered.
{
  const { ws, telosDir } = fixture();
  const ok = await verifyEvidence({ kind: "plan-hash-mismatch", concern_ref: "sha256:c", params: {} }, { baseDir: ws, telosDir });
  assert.equal(ok.reproduced, false, "no mismatch for a consistent plan");
  const bad = await verifyEvidence({ kind: "plan-hash-mismatch", concern_ref: "sha256:c", params: { expected_plan_hash: "sha256:wrong" } }, { baseDir: ws, telosDir });
  assert.equal(bad.reproduced, true, "mismatch vs wrong expected hash");
  console.log("Case 4 OK: plan-hash-mismatch");
}

// Case 5: artifact-hash-mismatch (pure) — disk vs signed ledger tree hash.
{
  const { ws, telosDir } = fixture();
  const clean = await verifyEvidence({ kind: "artifact-hash-mismatch", concern_ref: "sha256:c", params: { node_id: "A" } }, { baseDir: ws, telosDir });
  assert.equal(clean.reproduced, false, "no drift");
  writeFileSync(path.join(ws, "a.txt"), "DRIFTED\n");
  const drift = await verifyEvidence({ kind: "artifact-hash-mismatch", concern_ref: "sha256:c", params: { node_id: "A" } }, { baseDir: ws, telosDir });
  assert.equal(drift.reproduced, true, "drift detected");
  console.log("Case 5 OK: artifact-hash-mismatch");
}

// Case 6: schema-violation uses the CLOSED registry only.
{
  const { ws, telosDir } = fixture();
  writeFileSync(path.join(ws, "packet.json"), JSON.stringify({ decision: "approve", confidence: "high", required_edits: [], considerations: [], concerns: [], rationale: "ok" }));
  const valid = await verifyEvidence({ kind: "schema-violation", concern_ref: "sha256:c", params: { schema_name: "review", target_path: "packet.json" } }, { baseDir: ws, telosDir });
  assert.equal(valid.reproduced, false, "valid review packet -> no violation");
  const unknown = await verifyEvidence({ kind: "schema-violation", concern_ref: "sha256:c", params: { schema_name: "not-a-schema", target_path: "packet.json" } }, { baseDir: ws, telosDir });
  assert.match(unknown.rejected, /closed registry/, "unknown schema rejected");
  console.log("Case 6 OK: schema-violation closed registry");
}

// Case 7: signature-failure (HMAC) — a tampered signed packet reproduces the failure.
{
  const { ws, telosDir } = fixture();
  process.env.TELOS_SECRET_TESTER = "s3cr3t";
  const signed = signPacket({ model: "tester", decision: "approve" }, "s3cr3t");
  writeFileSync(path.join(ws, "signed.json"), JSON.stringify(signed));
  const good = await verifyEvidence({ kind: "signature-failure", concern_ref: "sha256:c", params: { sig_kind: "hmac", target_path: "signed.json", seat: "tester" } }, { baseDir: ws, telosDir });
  assert.equal(good.reproduced, false, "valid signature -> no failure");
  const tamperedPacket = { ...signed, decision: "reject" };
  writeFileSync(path.join(ws, "tampered.json"), JSON.stringify(tamperedPacket));
  const bad = await verifyEvidence({ kind: "signature-failure", concern_ref: "sha256:c", params: { sig_kind: "hmac", target_path: "tampered.json", seat: "tester" } }, { baseDir: ws, telosDir });
  assert.equal(bad.reproduced, true, "tampered signature -> failure reproduced");
  delete process.env.TELOS_SECRET_TESTER;
  console.log("Case 7 OK: signature-failure (hmac)");
}

// Case 8: declarative-file-assertion via the safe whitelist; empty needle rejected.
{
  const { ws, telosDir } = fixture();
  const present = await verifyEvidence({ kind: "declarative-file-assertion", concern_ref: "sha256:c", params: { assertion: { type: "file_exists", path: "a.txt" }, expected: true } }, { baseDir: ws, telosDir });
  assert.equal(present.reproduced, true, "file_exists matches expected");
  const empty = await verifyEvidence({ kind: "declarative-file-assertion", concern_ref: "sha256:c", params: { assertion: { type: "file_contains", path: "a.txt", needle: "" }, expected: true } }, { baseDir: ws, telosDir });
  assert.match(empty.rejected, /empty needle/, "empty needle rejected");
  console.log("Case 8 OK: declarative-file-assertion");
}

// Case 9: declared-test-failure — isolation UNAVAILABLE rejects without execution (fail closed).
{
  const { ws, telosDir } = fixture();
  const sentinel = path.join(ws, "RAN");
  const unavailableRunner = () => ({ available: false, reason: "stubbed unavailable" });
  const r = await verifyEvidence(
    { kind: "declared-test-failure", concern_ref: "sha256:c", params: { node_id: "A" } },
    { baseDir: ws, telosDir, isolationRunner: unavailableRunner, authorizedTestRefs: new Set([require_hash(telosDir)]) }
  );
  assert.equal(r.accepted, false, "rejected when isolation unavailable");
  assert.match(r.rejected, /isolation unavailable/);
  assert.equal(existsSync(sentinel), false, "nothing executed");
  console.log("Case 9 OK: isolation-unavailable -> rejected without execution");
}

// Case 10: declared-test-failure — a test INTRODUCED by the current candidate is obligation-only.
{
  const { ws, telosDir } = fixture();
  const stubRunner = () => ({ available: true, status: 1, network_isolation: "netns" });
  const r = await verifyEvidence(
    { kind: "declared-test-failure", concern_ref: "sha256:c", params: { node_id: "A" } },
    { baseDir: ws, telosDir, isolationRunner: stubRunner } // no authorized/baseline refs -> introduced
  );
  assert.equal(r.accepted, false, "introduced test rejected");
  assert.match(r.rejected, /obligation-only/);
  console.log("Case 10 OK: candidate-introduced test rejected (obligation-only)");
}

// Case 11: declared-test-failure — a previously-authorized test runs in the (stub) sandbox and
// reports the reproduced result; the writeProposalEvent callback receives the composed body.
{
  const { ws, telosDir } = fixture();
  const testRef = require_hash(telosDir);
  const stubRunner = () => ({ available: true, status: 1, network_isolation: "netns" });
  let captured = null;
  const r = await verifyEvidence(
    { kind: "declared-test-failure", concern_ref: "sha256:c", plan_hash: "sha256:p", params: { node_id: "A" } },
    { baseDir: ws, telosDir, isolationRunner: stubRunner, authorizedTestRefs: new Set([testRef]), writeProposalEvent: async (body) => { captured = body; return { event_hash: "sha256:e" }; } }
  );
  assert.equal(r.accepted, true, "accepted for previously-authorized test");
  assert.equal(r.reproduced, true, "exit 1 -> failure reproduced");
  assert.equal(captured.event_kind, "evidence-verification", "callback received event body");
  assert.equal(captured.evidence_kind, "declared-test-failure");
  console.log("Case 11 OK: previously-authorized test runs + event callback");
}

// helper: the test-ref of node A (H(node.test)) so tests can mark it authorized/baseline.
import { readPlan, recompute } from "../../merkle-dag/merkle.mjs";
import { canonicalize, sha256hex } from "../../merkle-dag/vendor.mjs";
function require_hash(telosDir) {
  const node = recompute(readPlan(telosDir)).plan.nodes.find((n) => n.id === "A");
  return "sha256:" + sha256hex(canonicalize(node.test));
}

console.log("test-evidence.mjs OK");
