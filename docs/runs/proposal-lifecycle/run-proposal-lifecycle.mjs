#!/usr/bin/env node
// run-proposal-lifecycle.mjs — keyless, deterministic end-to-end evidence for the proposal lifecycle.
// Composes the real substrate (merkle-dag) + the real recorder/gate over an ephemeral
// proposal-controller key, and writes run-summary.json. No API keys, no network.
//
//   node docs/runs/proposal-lifecycle/run-proposal-lifecycle.mjs
//
// Three variants:
//   1. authorized  — candidate -> authorized decision -> runBuild reaches merge_status "ready"
//   2. obligation  — an undischarged verification obligation blocks done() with the exact reason
//   3. blocked     — a verified-blocker decision refuses runBuild (DECISION_NOT_AUTHORIZED)
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeypair } from "../../../merkle-dag/crypto.mjs";
import { compileAndHashPlan, assignNodeLineages } from "../../../merkle-dag/planner.mjs";
import { writePlan } from "../../../merkle-dag/merkle.mjs";
import { runBuild } from "../../../merkle-dag/orchestrate.mjs";
import { verify } from "../../../merkle-dag/ledger-gate.mjs";
import { computeDiskTreeHash } from "../../../merkle-dag/artifact.mjs";
import { PROPOSAL_KEY_ID, POLICY_CHECK_KEYS } from "../../../merkle-dag/proposal-ledger.mjs";
import { makeProposalRecorder } from "../../../build-gate/proposal-recorder.mjs";
import { validateProposalLifecycle } from "../../../build-gate/proposal-gate.mjs";

const allPass = () => Object.fromEntries(POLICY_CHECK_KEYS.map((k) => [k, "pass"]));

// decision 6: runBuild's requireAuthorizedDecision path re-verifies ledger-reconstructable lifecycle
// state at execution time (a hold appended after the authorized decision blocks). Injected because
// merkle-dag must not import build-gate.
const lifecycleVerify = ({ telosDir, nowMs }) => validateProposalLifecycle({ telosDir, requiredModels: [], packets: [], nowMs });

function setup({ proposalId, obligations } = {}) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-run-pl-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });
  writeFileSync(path.join(ws, "impl.txt"), "impl\n");
  if (obligations) writeFileSync(path.join(ws, "auth.test.txt"), "test\n");
  const c = generateKeypair();
  const signerFor = () => c.privatePem;
  const tasks = [{ id: "impl", writes: ["impl.txt"], reads: [], requirements: "impl", test: { cmd: "node", args: ["-e", "0"] } }];
  if (obligations) tasks.push({ id: "auth-test", writes: ["auth.test.txt"], reads: [], requirements: "test", test: { cmd: "node", args: ["-e", "0"] } });
  const defs = tasks.map((t) => ({ id: t.id, files: t.writes, requirements: t.requirements, test: t.test, dependencies: [] }));
  const lifecycle = { contract_ref: "sha256:contract", proposal_id: proposalId, predecessor_plan_hash: null, ...assignNodeLineages(defs, { proposalId }) };
  const { plan } = compileAndHashPlan({ tasks, authorizedSigners: { [PROPOSAL_KEY_ID]: c.publicJwk }, repoRoot: ws, obligations, lifecycle });
  writePlan(telosDir, plan);
  return { ws, telosDir, plan, signerFor };
}

const dispatch = (ws, settleAll = true) => async (injected) => {
  if (!settleAll && injected.id === "auth-test") return { ok: false, reason: "auth-test intentionally not built (undischarged)" };
  for (const f of injected.files) writeFileSync(path.join(ws, f), `content ${injected.id}`);
  return { ok: true, signer: PROPOSAL_KEY_ID };
};
const verifyNode = () => async (node, baseDir) => { const disk = computeDiskTreeHash(node.files, baseDir); return { ok: true, tree_hash: disk.tree_hash, files: disk.files }; };

async function variantAuthorized() {
  const { ws, telosDir, plan, signerFor } = setup({ proposalId: "proposal-run-1" });
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId: "proposal-run-1" });
  rec.recordDraft({ inputRefs: ["sha256:idea"] });
  rec.recordCreationCall({ seat: "claude", provenance: { provider: "anthropic", response_id: "a1" } });
  rec.recordCandidate({ planHash: plan.plan_hash });
  const pl = validateProposalLifecycle({ telosDir, packets: [], requiredModels: [], signed: false });
  rec.recordDecision({ planHash: plan.plan_hash, checks: allPass(), blockers: [], findings: [] });
  const build = await runBuild({ telosDir, baseDir: ws, dispatch: dispatch(ws), verifyNode: verifyNode(), signerFor, requireAuthorizedDecision: true, lifecycleVerify, maxRounds: 5 });
  return { variant: "authorized", plan_hash: plan.plan_hash, lifecycle_checks_ok: pl.checks.written_plan === "pass", merge_status: build.report ? build.report.merge_status : null, runBuild_error: build.error || null };
}

async function variantObligation() {
  const obligations = [{ obligation_id: "verify-auth-001", concern_ref: "sha256:cA", required_result: "pass", check_contract_ref: "sha256:cc", discharge_node_id: "auth-test" }];
  const { ws, telosDir, plan, signerFor } = setup({ proposalId: "proposal-run-2", obligations });
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId: "proposal-run-2" });
  rec.recordDraft({ inputRefs: ["sha256:idea2"] });
  rec.recordCandidate({ planHash: plan.plan_hash });
  rec.recordDecision({ planHash: plan.plan_hash, checks: allPass(), blockers: [], findings: [] });
  // build only the impl node; the obligation's discharge node (auth-test) is left unsettled
  await runBuild({ telosDir, baseDir: ws, dispatch: dispatch(ws, false), verifyNode: verifyNode(), signerFor, requireAuthorizedDecision: true, lifecycleVerify, maxRounds: 5 });
  const gate = verify(telosDir, { baseDir: ws });
  return { variant: "obligation", plan_hash: plan.plan_hash, merge_status: gate.merge_status, reason: gate.reason || null, safe_next_action: gate.safe_next_action };
}

async function variantBlocked() {
  const { ws, telosDir, plan, signerFor } = setup({ proposalId: "proposal-run-3" });
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId: "proposal-run-3" });
  rec.recordDraft({ inputRefs: ["sha256:idea3"] });
  rec.recordCandidate({ planHash: plan.plan_hash });
  const { decision } = rec.recordDecision({ planHash: plan.plan_hash, checks: { ...allPass(), concerns: "fail" }, blockers: ["verified blocker: cross-tenant read"], findings: [{ code: "VERIFIED_BLOCKER", class: "protocol", reparable: false, requires_human: false, ref: null }] });
  const build = await runBuild({ telosDir, baseDir: ws, dispatch: dispatch(ws), verifyNode: verifyNode(), signerFor, requireAuthorizedDecision: true, lifecycleVerify, maxRounds: 5 });
  return { variant: "blocked", plan_hash: plan.plan_hash, decision, runBuild_error: build.error || null };
}

async function main() {
  const results = { generated_by: "run-proposal-lifecycle.mjs", live: false, keyless: true, variants: [] };
  results.variants.push(await variantAuthorized());
  results.variants.push(await variantObligation());
  results.variants.push(await variantBlocked());
  const here = path.dirname(fileURLToPath(import.meta.url));
  writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results, null, 2));

  // Acceptance assertions (this run doubles as executable evidence).
  const [a, o, b] = results.variants;
  const ok = a.merge_status === "ready" && !a.runBuild_error
    && o.merge_status === "blocked" && o.reason === "undischarged verification obligation"
    && b.decision === "blocked" && b.runBuild_error === "DECISION_NOT_AUTHORIZED";
  if (!ok) { console.error("ACCEPTANCE FAILED"); process.exitCode = 1; }
  else console.log("\nACCEPTANCE OK: authorized->ready, undischarged-obligation blocked, verified-blocker refused");
}

main();
