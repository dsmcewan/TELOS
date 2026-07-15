// test-ledger-gate.mjs — 8-case test suite for ledger-gate.mjs
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { computePlan, writePlan, mutateNode } from "../merkle.mjs";
import { computeDiskTreeHash } from "../artifact.mjs";
import { generateKeypair, makeRecord, appendLedger, writePublicKey } from "../crypto.mjs";
import { verify } from "../ledger-gate.mjs";
import { compileAndHashPlan } from "../planner.mjs";

// ---------------------------------------------------------------------------
// buildGreenFixture: real workspace, real Ed25519 keypair, real signed ledger.
// opts.testB — override B's test spec (default: process.exit(0)).
// Returns { ws, telosDir, plan, privatePem, publicJwk }.
// ---------------------------------------------------------------------------
function buildGreenFixture({ testB } = {}) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-gate-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });

  writeFileSync(path.join(ws, "A.txt"), "hello from A\n");
  writeFileSync(path.join(ws, "B.txt"), "hello from B\n");

  // Keypair must be generated BEFORE computePlan so it can be pinned into authorized_signers.
  const { privatePem, publicJwk } = generateKeypair();

  const taskDefs = [
    {
      id: "A", files: ["A.txt"], requirements: "produce A",
      test: { cmd: "node", args: ["-e", "process.exit(0)"] },
      dependencies: []
    },
    {
      id: "B", files: ["B.txt"], requirements: "produce B",
      test: testB ?? { cmd: "node", args: ["-e", "process.exit(0)"] },
      dependencies: ["A"]
    }
  ];

  const { plan } = computePlan(taskDefs, { authorizedSigners: { tester: publicJwk } });
  writePlan(telosDir, plan);

  // writePublicKey still written for tooling/bootstrapping, but is no longer the trust path.
  writePublicKey(path.join(telosDir, "keys"), "tester", publicJwk);

  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  for (const node of plan.nodes) {
    const disk = computeDiskTreeHash(node.files, ws);
    const record = makeRecord(
      { task_id: node.id, effective_hash: node.effective_hash,
        artifact_tree_hash: disk.tree_hash, artifact_files: disk.files },
      "tester", privatePem
    );
    appendLedger(ledgerPath, record);
  }

  return { ws, telosDir, plan, privatePem, publicJwk };
}

// ---------------------------------------------------------------------------
// Case 1: Happy path — all checks pass, exit 0, merge_status "ready".
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture();
  const r = verify(telosDir, { baseDir: ws });
  assert.equal(r.merge_status, "ready", "Case 1: merge_status === ready");
  assert.equal(r.exit, 0, "Case 1: exit === 0");
  assert.equal(r.summary.blocked, 0, "Case 1: blocked === 0");
  assert.equal(r.summary.passed, 2, "Case 1: passed === 2");
  console.log("Case 1 OK: happy path");
}

// ---------------------------------------------------------------------------
// Case 2: MISSING_LEDGER — B has no ledger entry.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture();
  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  // Keep only A's line (first line), discard B's.
  const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(l => l.trim());
  writeFileSync(ledgerPath, lines[0] + "\n");

  const r = verify(telosDir, { baseDir: ws });
  const nodeB = r.nodes.find(n => n.id === "B");
  assert.equal(nodeB.checks.ledger, "MISSING_LEDGER", "Case 2: B ledger === MISSING_LEDGER");
  assert.equal(nodeB.checks.lineage, "skipped", "Case 2: B lineage === skipped");
  assert.equal(nodeB.ok, false, "Case 2: B not ok");
  assert.equal(r.exit, 1, "Case 2: exit === 1");
  console.log("Case 2 OK: MISSING_LEDGER");
}

// ---------------------------------------------------------------------------
// Case 3: STALE_LINEAGE — mutate A's spec and write plan WITHOUT re-signing.
// Both A and B get STALE_LINEAGE (B depends on A so its effective_hash changes).
// ---------------------------------------------------------------------------
{
  const { ws, telosDir, plan } = buildGreenFixture();
  const { plan: newPlan } = mutateNode(plan, "A", { requirements: "changed requirements" });
  writePlan(telosDir, newPlan); // overwrite plan.json; ledger still has old hashes

  const r = verify(telosDir, { baseDir: ws });
  const nodeA = r.nodes.find(n => n.id === "A");
  const nodeB = r.nodes.find(n => n.id === "B");
  assert.equal(nodeA.checks.lineage, "STALE_LINEAGE", "Case 3: A lineage === STALE_LINEAGE");
  assert.equal(nodeA.checks.signature, "skipped", "Case 3: A signature === skipped");
  assert.equal(nodeB.checks.lineage, "STALE_LINEAGE", "Case 3: B lineage === STALE_LINEAGE");
  assert.equal(r.exit, 1, "Case 3: exit === 1");
  console.log("Case 3 OK: STALE_LINEAGE");
}

// ---------------------------------------------------------------------------
// Case 4: BAD_SIGNATURE — corrupt one char of B's ledger sig.value.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture();
  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(l => l.trim());
  // lines[0] = A, lines[1] = B
  const recB = JSON.parse(lines[1]);
  const orig = recB.sig.value;
  // Corrupt the first two data chars (never padding — guaranteed to change decoded bytes).
  const c0 = orig[0] === 'A' ? 'B' : 'A';
  const c1 = orig[1] === 'A' ? 'B' : 'A';
  const flipped = c0 + c1 + orig.slice(2);
  recB.sig = { ...recB.sig, value: flipped };
  writeFileSync(ledgerPath, lines[0] + "\n" + JSON.stringify(recB) + "\n");

  const r = verify(telosDir, { baseDir: ws });
  const nodeA = r.nodes.find(n => n.id === "A");
  const nodeB = r.nodes.find(n => n.id === "B");
  assert.equal(nodeA.checks.signature, "ok", "Case 4: A signature still ok");
  assert.equal(nodeB.checks.signature, "BAD_SIGNATURE", "Case 4: B signature === BAD_SIGNATURE");
  assert.equal(nodeB.checks.artifact, "skipped", "Case 4: B artifact === skipped");
  assert.equal(r.exit, 1, "Case 4: exit === 1");
  console.log("Case 4 OK: BAD_SIGNATURE");
}

// ---------------------------------------------------------------------------
// Case 5: UNKNOWN_SIGNER — sign B's ledger line with a key_id NOT in plan.authorized_signers.
// A passes (key_id "tester" is in the plan); B is blocked (key_id "stranger" is not).
// ---------------------------------------------------------------------------
{
  const { ws, telosDir, plan } = buildGreenFixture();

  // Generate a fresh keypair for an unauthorized identity.
  const { privatePem: strangerPem } = generateKeypair();

  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(l => l.trim());

  // Replace B's record with one signed by "stranger" (not in plan.authorized_signers).
  const nodeB = plan.nodes.find(n => n.id === "B");
  const disk = computeDiskTreeHash(nodeB.files, ws);
  const strangerRecord = makeRecord(
    { task_id: nodeB.id, effective_hash: nodeB.effective_hash,
      artifact_tree_hash: disk.tree_hash, artifact_files: disk.files },
    "stranger", strangerPem
  );
  writeFileSync(ledgerPath, lines[0] + "\n" + JSON.stringify(strangerRecord) + "\n");

  const r = verify(telosDir, { baseDir: ws });
  const nodeAReport = r.nodes.find(n => n.id === "A");
  const nodeBReport = r.nodes.find(n => n.id === "B");
  assert.equal(nodeAReport.checks.signature, "ok", "Case 5: A signature still ok");
  assert.equal(nodeBReport.checks.signature, "UNKNOWN_SIGNER", "Case 5: B signature === UNKNOWN_SIGNER");
  assert.equal(r.exit, 1, "Case 5: exit === 1");
  console.log("Case 5 OK: UNKNOWN_SIGNER (key_id not in plan.authorized_signers)");
}

// ---------------------------------------------------------------------------
// Case 6: ARTIFACT_MISMATCH — append a byte to B.txt after signing.
// A still passes; B fails artifact check.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture();
  appendFileSync(path.join(ws, "B.txt"), "extra byte");

  const r = verify(telosDir, { baseDir: ws });
  const nodeA = r.nodes.find(n => n.id === "A");
  const nodeB = r.nodes.find(n => n.id === "B");
  assert.equal(nodeA.ok, true, "Case 6: A still ok");
  assert.equal(nodeB.checks.artifact, "ARTIFACT_MISMATCH", "Case 6: B artifact === ARTIFACT_MISMATCH");
  assert.equal(nodeB.checks.test, "skipped", "Case 6: B test === skipped");
  assert.equal(r.exit, 1, "Case 6: exit === 1");
  console.log("Case 6 OK: ARTIFACT_MISMATCH");
}

// ---------------------------------------------------------------------------
// Case 7: TEST_FAILED — B's test spec is process.exit(1); signed against that
// spec so lineage + artifact pass, but the test command exits non-zero.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture({
    testB: { cmd: "node", args: ["-e", "process.exit(1)"] }
  });

  const r = verify(telosDir, { baseDir: ws });
  const nodeA = r.nodes.find(n => n.id === "A");
  const nodeB = r.nodes.find(n => n.id === "B");
  assert.equal(nodeA.ok, true, "Case 7: A still ok");
  assert.equal(nodeB.checks.lineage, "ok", "Case 7: B lineage ok (signed with correct spec)");
  assert.equal(nodeB.checks.signature, "ok", "Case 7: B signature ok");
  assert.equal(nodeB.checks.artifact, "ok", "Case 7: B artifact ok");
  assert.equal(nodeB.checks.test, "TEST_FAILED", "Case 7: B test === TEST_FAILED");
  assert.equal(r.exit, 1, "Case 7: exit === 1");
  console.log("Case 7 OK: TEST_FAILED");
}

// ---------------------------------------------------------------------------
// Case 8: PLAN_TAMPERED — hand-edit a stored effective_hash in plan.json.
// verify() detects the mismatch during the precheck and returns exit 2.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture();
  const planPath = path.join(telosDir, "plan.json");
  const planJson = JSON.parse(readFileSync(planPath, "utf8"));
  // Corrupt A's stored effective_hash
  planJson.nodes[0].effective_hash = "sha256:00000000000000000000000000000000000000000000000000000000tampered";
  writeFileSync(planPath, JSON.stringify(planJson, null, 2));

  const r = verify(telosDir, { baseDir: ws });
  assert.equal(r.reason, "PLAN_TAMPERED", "Case 8: reason === PLAN_TAMPERED");
  assert.equal(r.exit, 2, "Case 8: exit === 2");
  console.log("Case 8 OK: PLAN_TAMPERED");
}

// ---------------------------------------------------------------------------
// Case 9: I-2 guard — B has test:{} (no cmd); lineage/signature/artifact pass,
// verify() must NOT throw and must set checks.test === "TEST_FAILED".
// ---------------------------------------------------------------------------
{
  // testB = {} is truthy so ?? keeps it; plan is computed + signed against test:{}
  const { ws, telosDir } = buildGreenFixture({ testB: {} });
  let r;
  assert.doesNotThrow(() => { r = verify(telosDir, { baseDir: ws }); }, "Case 9: verify() must not throw");
  const nodeB = r.nodes.find(n => n.id === "B");
  assert.equal(nodeB.checks.lineage, "ok", "Case 9: B lineage ok");
  assert.equal(nodeB.checks.signature, "ok", "Case 9: B signature ok");
  assert.equal(nodeB.checks.artifact, "ok", "Case 9: B artifact ok");
  assert.equal(nodeB.checks.test, "TEST_FAILED", "Case 9: B test === TEST_FAILED (no cmd)");
  assert.equal(r.exit, 1, "Case 9: exit === 1");
  console.log("Case 9 OK: I-2 guard - no test command");
}

// ---------------------------------------------------------------------------
// Case 10: Closed-hole regression — attacker key written to .telos/keys/ but NOT
// in plan.authorized_signers. Pre-hardening: verify() returned "ready". Post-hardening:
// verify() must return BLOCKED (UNKNOWN_SIGNER). The directory key is ignored.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir, plan } = buildGreenFixture();

  // Attacker: generate a fresh keypair and write it to the keys directory.
  const { privatePem: evilPem, publicJwk: evilPub } = generateKeypair();
  writePublicKey(path.join(telosDir, "keys"), "evil", evilPub); // evil.pub.jwk in directory

  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  const lines = readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(l => l.trim());

  // Attacker forges a ledger entry for B using their key, key_id: "evil".
  const nodeB = plan.nodes.find(n => n.id === "B");
  const disk = computeDiskTreeHash(nodeB.files, ws);
  const evilRecord = makeRecord(
    { task_id: nodeB.id, effective_hash: nodeB.effective_hash,
      artifact_tree_hash: disk.tree_hash, artifact_files: disk.files },
    "evil", evilPem
  );
  writeFileSync(ledgerPath, lines[0] + "\n" + JSON.stringify(evilRecord) + "\n");

  // Post-hardening: "evil" is not in plan.authorized_signers → UNKNOWN_SIGNER → BLOCKED.
  // Pre-hardening this would have loaded evil.pub.jwk from the directory and returned ready.
  const r = verify(telosDir, { baseDir: ws });
  const nodeBReport = r.nodes.find(n => n.id === "B");
  assert.equal(nodeBReport.checks.signature, "UNKNOWN_SIGNER",
    "Case 10: evil key in .telos/keys/ is ignored — UNKNOWN_SIGNER (only plan-pinned keys trusted)");
  assert.notEqual(r.merge_status, "ready",
    "Case 10: merge_status must NOT be ready (attacker-forge blocked)");
  assert.equal(r.exit, 1, "Case 10: exit === 1 (blocked, not ready)");
  console.log("Case 10 OK: Closed-hole regression — attacker key in .telos/keys/ blocked (UNKNOWN_SIGNER)");
}

// ---------------------------------------------------------------------------
// Case 11: authorized_signers tamper — edit plan.authorized_signers in stored plan.json
// but leave plan_hash unchanged. recompute() will use the tampered signers to recompute
// plan_hash, which will differ from the (original) stored plan_hash → PLAN_TAMPERED exit 2.
// ---------------------------------------------------------------------------
{
  const { ws, telosDir } = buildGreenFixture();
  const planPath = path.join(telosDir, "plan.json");
  const planJson = JSON.parse(readFileSync(planPath, "utf8"));

  // Inject an unauthorized signer into authorized_signers; leave plan_hash as-is.
  const { publicJwk: evilPub } = generateKeypair();
  planJson.authorized_signers["evil"] = evilPub;
  writeFileSync(planPath, JSON.stringify(planJson, null, 2));

  const r = verify(telosDir, { baseDir: ws });
  assert.equal(r.reason, "PLAN_TAMPERED", "Case 11: reason === PLAN_TAMPERED");
  assert.equal(r.exit, 2, "Case 11: exit === 2");
  console.log("Case 11 OK: authorized_signers tamper → PLAN_TAMPERED exit 2");
}

// ---------------------------------------------------------------------------
// Obligation fixture: impl + auth-test nodes; an obligation discharged by auth-test.
// settleAuthTest — whether to write a ledger entry for auth-test.
// ---------------------------------------------------------------------------
function buildObligationFixture({ settleAuthTest = true, requiredResult = "pass" } = {}) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-obgate-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });
  writeFileSync(path.join(ws, "impl.txt"), "impl\n");
  writeFileSync(path.join(ws, "auth.test.txt"), "test\n");
  const { privatePem, publicJwk } = generateKeypair();
  const tasks = [
    { id: "impl", writes: ["impl.txt"], reads: [], requirements: "impl", test: { cmd: "node", args: ["-e", "0"] } },
    { id: "auth-test", writes: ["auth.test.txt"], reads: [], requirements: "test", test: { cmd: "node", args: ["-e", "0"] } }
  ];
  const obligations = [{ obligation_id: "verify-auth-001", concern_ref: "sha256:cA", required_result: requiredResult, check_contract_ref: "sha256:cc", discharge_node_id: "auth-test" }];
  const { plan } = compileAndHashPlan({ tasks, authorizedSigners: { tester: publicJwk }, repoRoot: ws, obligations });
  writePlan(telosDir, plan);
  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  for (const node of plan.nodes) {
    if (node.id === "auth-test" && !settleAuthTest) continue;
    const disk = computeDiskTreeHash(node.files, ws);
    appendLedger(ledgerPath, makeRecord({ task_id: node.id, effective_hash: node.effective_hash, artifact_tree_hash: disk.tree_hash, artifact_files: disk.files }, "tester", privatePem));
  }
  return { ws, telosDir, plan };
}

// Case 12: obligation discharged when its node settles → ready.
{
  const { ws, telosDir } = buildObligationFixture();
  const r = verify(telosDir, { baseDir: ws });
  assert.equal(r.merge_status, "ready", "Case 12: ready when obligation discharged");
  assert.ok(r.obligations.every((o) => o.discharged), "Case 12: obligation marked discharged");
  console.log("Case 12 OK: obligation discharged → ready");
}

// Case 13: vacuous case — the obligation's discharge node never settles → blocked, exact reason.
{
  const { ws, telosDir } = buildObligationFixture({ settleAuthTest: false });
  const r = verify(telosDir, { baseDir: ws });
  assert.equal(r.merge_status, "blocked", "Case 13: blocked when discharge node not settled");
  assert.equal(r.reason, "undischarged verification obligation", "Case 13: exact contract reason");
  assert.equal(r.safe_next_action, "discharge-obligations", "Case 13: safe_next_action");
  assert.equal(r.exit, 1, "Case 13: exit 1");
  console.log("Case 13 OK: undischarged obligation blocks (vacuous case)");
}

// Case 14: required_result != "pass" is never auto-discharged, even when the node settles green.
{
  const { ws, telosDir } = buildObligationFixture({ requiredResult: "fail" });
  const r = verify(telosDir, { baseDir: ws });
  assert.equal(r.merge_status, "blocked", "Case 14: non-pass required_result stays blocked");
  assert.equal(r.reason, "undischarged verification obligation");
  console.log("Case 14 OK: non-pass required_result blocks despite settlement");
}

console.log("test-ledger-gate.mjs OK");
