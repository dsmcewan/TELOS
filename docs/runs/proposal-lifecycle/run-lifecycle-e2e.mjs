#!/usr/bin/env node
// run-lifecycle-e2e.mjs — the FLAGSHIP keyless evidence: drives the proposal lifecycle THROUGH the
// autonomous entry point buildProject({ dossier: { proposal_lifecycle: true } }), so the cited proof
// exercises the recorder + Daedalus workshop + cold review + processReviewPackets + the outer revision
// loop + gate-reconstructed authorization + execution — not just the primitives in isolation.
//
//   node docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs
//
// Two variants, both keyless (ephemeral controller key, mock seats with DISJOINT creation/review
// provenance, no API keys, no network):
//   1. discharged — a review requires a verification; the revised candidate mints a dedicated verify
//                   node; execution discharges it -> merge_status "ready".
//   2. control    — same flow, but the remediation omits the marker so the verify check FAILS; the
//                   decision is still "authorized" (the concern is cleared by verification-required),
//                   yet merge_status is NOT "ready" — proving the obligation is load-bearing at Rule 3.
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject, makeTeamKeyring } from "../../../build-gate/build-orchestrator.mjs";
import { planTeams } from "../../../build-gate/teams.mjs";
import { readProposalEvents } from "../../../merkle-dag/proposal-ledger.mjs";

const NEEDLE = "AUTH_GUARD", TARGET = "out.txt";

async function variant({ poison }) {
  let uid = 0;
  const prov = (provider) => ({ provider, response_id: `resp-${++uid}`, tool: "mock" });
  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-e2e-")); mkdirSync(path.join(dir, ".telos"), { recursive: true });
  const teams = planTeams({});
  const { keyring, signerFor } = makeTeamKeyring(teams);
  delete process.env.TELOS_PROPOSAL_CONTROLLER_SK; // ephemeral over a fresh telosDir
  const dossier = { build_id: "b1", use_case: "governance", objective: "add an auth boundary", proposal_lifecycle: true, write_targets: [TARGET], required_docs: [] };
  const tasks = [{ id: "A", writes: [TARGET], reads: [], requirements: "write the auth boundary", test: { cmd: "node", args: ["-e", "process.exit(0)"] } }];

  const rp = (model, decision, concerns = []) => ({ build_id: "b1", use_case: "governance", model, role: "approver", hard_stops: [], docs_reviewed: [], timestamp: new Date(0).toISOString(), decision, confidence: "high", required_edits: [], considerations: [], concerns, rationale: "ok" });
  const verifyConcern = { scope: "plan", claim: "auth boundary must be verified", severity: "high", judgment_class: "hold-request", evidence_refs: [], required_verification: { requested: true, check_contract: { kind: "assert-file-contains", params_json: JSON.stringify({ target: TARGET, needle: NEEDLE }) }, required_result: "pass" } };
  let calls = 0;
  const callSeat = async ({ model }) => {
    const iteration = Math.ceil(++calls / 3);
    if (model === "agy") return { packet: rp("agy", "approve"), provenance: prov("agentic") };
    if (iteration === 1 && model === "claude") return { packet: rp("claude", "revise", [verifyConcern]), provenance: prov("anthropic") };
    return { packet: rp(model, "approve"), provenance: prov(model === "claude" ? "anthropic" : "openai") };
  };
  const callWorkshopSeat = async ({ seat }) => ({ plan_revision: "", objections: [], dispositions: [], provenance: prov(seat === "claude" ? "anthropic" : "openai") });
  // the dispatched node spec (Rule 1) exposes `files` (the declared write list).
  const callTeam = async ({ node }) => ({ files: (node.files || node.writes || []).map((f) => ({ path: f, content: poison ? "no marker" : `function login(){ ${NEEDLE}(); }` })) });

  const res = await buildProject({ dossier, telos: "t", tasks, callSeat, callWorkshopSeat, callTeam, keyring, signerFor, baseDir: dir, telosDir: path.join(dir, ".telos"), nowMs: 1000, maxRevisions: 3 });
  const events = readProposalEvents(path.join(dir, ".telos")).events;
  const verifyNode = (res.report?.nodes || []).find((n) => n.id.startsWith("verify-"));
  return {
    variant: poison ? "control" : "discharged",
    decision: res.decision,
    merge_status: res.report ? res.report.merge_status : null,
    verify_node_settled: verifyNode ? verifyNode.ok : null,
    verify_node_obligation_check: verifyNode ? (verifyNode.checks.obligations || null) : null,
    revise_then_authorize: events.filter((e) => e.stage === "decision").map((e) => e.decision),
    minted_verify_node: !!verifyNode
  };
}

const discharged = await variant({ poison: false });
const control = await variant({ poison: true });
const summary = { generated_by: "run-lifecycle-e2e.mjs", entry_point: "buildProject({ proposal_lifecycle: true })", keyless: true, variants: [discharged, control] };
console.log(JSON.stringify(summary, null, 2));

const ok =
  discharged.decision === "authorized" && discharged.merge_status === "ready" && discharged.verify_node_settled === true &&
  control.decision === "authorized" && control.merge_status !== "ready" && control.verify_node_obligation_check === "UNDISCHARGED_OBLIGATION";

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "run-lifecycle-e2e-summary.json");
writeFileSync(outPath, JSON.stringify({ ...summary, acceptance_ok: ok }, null, 2) + "\n");
if (!ok) { console.error("ACCEPTANCE FAILED"); process.exit(1); }
console.log("\nACCEPTANCE OK: revise->authorize->discharge->ready via buildProject; negative control authorized-but-not-ready (obligation load-bearing at Rule 3)");
