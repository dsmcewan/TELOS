#!/usr/bin/env node
// TELOS authorization run for the Lachesis enrollment quest, cycle 1 (Iliad lifecycle).
//
// Sequence: The Eye commissioned Lachesis (2026-07-18) -> Iliad pre-review + entry-ritual
// comprehension gate -> Daedalus workshop matured the APPROACH over 10 adversarial rounds
// (converged-for-submission, rev10) -> TELOS AUTHORIZES (this run) -> Argo implements.
// A real signed council over the matured approach's content address: claude/agy/codex are
// REQUIRED approvers, grok/gemini advisory. Every chat seat reviews the FULL matured approach
// and returns a strict JSON approval packet bound to its own real provenance; agy is the local
// deterministic governance checkpoint derived from the dossier. The gate (trust_mode "signed")
// certifies from packets + signatures + provenance — never a seat's self-report. Fail-closed:
// any missing required packet, invalid signature, placeholder provenance, or non-approve
// decision leaves Lachesis UNAUTHORIZED.
//
// SCOPE OF THIS AUTHORIZATION: Argo implementation of the cycle-1 matured plan ONLY (a new
// zero-dependency `lachesis/` package that MEASURES the committed Clotho weave snapshot as
// data). The ENROLLMENT-FLIP (moving Lachesis out of registered-unimplemented + changing the
// verify-contracts expectation) is HELD for a separate Eye ruling per the pre-review — it is
// NOT authorized by this council.
//
// Run from Windows node (loadWin32Env pulls API keys + TELOS_SECRET_* from HKCU).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

await imp("connectors/ai-peer-mcp/server.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } = await imp("build-gate/council.mjs");
const { validateRecords } = await imp("build-gate/gate.mjs");
const { spawnMcpClient } = await imp("breakout/mcp_client.mjs");

// ---------- bind the exact plan under authorization ----------
const PLAN_PATH = "docs/runs/atropos-1-workshop/candidate-approach.md";
const PREREVIEW_PATH = "docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-atropos-1.json";
const EXPECTED_PLAN_REF = "sha256:041b5aaf96639cada7a5c3948586afba2340ef0d8896b851bd324edf980ef5be";
const REVIEWED_HEAD = "4427a2d"; // matured-approach.md committed head

const CONTRACT_PATH = "atropos/memory/CONTRACTS/supersession.json";
const contractText = readFileSync(path.join(ROOT, CONTRACT_PATH), "utf8");
const planText = readFileSync(path.join(ROOT, PLAN_PATH), "utf8");
const planRef = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: planText }));
if (planRef !== EXPECTED_PLAN_REF) {
  console.error(`PLAN DRIFT: ${PLAN_PATH} recomputes to ${planRef}, expected ${EXPECTED_PLAN_REF}. Refusing to authorize.`);
  process.exit(1);
}

// ---------- signing secrets: real registry values when present, else ephemeral ----------
const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) {
    process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex");
    EPHEMERAL_SIGNERS.push(m.toLowerCase());
  }
}

const BUILD_ID = "iliad-atropos-1-authz";
const USE_CASE = "iliad-atropos-cycle-1";
const TIMESTAMP = new Date().toISOString();
const OBJECTIVE =
  `Authorize (RATIFY) the Atropos enrollment-quest cycle-1 matured approach ` +
  `(content address ${planRef}; Daedalus-matured over 13 adversarial rounds; reviewed head ${REVIEWED_HEAD}). ` +
  `HONEST SEQUENCE NOTE: under The Eye's build-mode directive the implementation was built BEFORE this council ` +
  `(atropos/ exists: 31 passing assertions incl. a golden run over the real CURRENT-AUTHORITY and an executable ` +
  `read-only oracle); this council is the deferred TELOS authorization stage, ratifying or rejecting the plan ` +
  `on its merits. Judge the PLAN AS IMPLEMENTED on its own terms: ` +
  `Atropos cycle-1 is a zero-dependency, READ-ONLY supersession-consistency verifier over CURRENT-AUTHORITY#superseded ` +
  `(the only populated supersession surface: 4 plan-version retirements v11-v14 -> active v15). ` +
  `(1) NORMATIVE verdict: closed entry shape + types; must_not_govern_new_work===true; unique plan_version; ` +
  `active_plan not itself superseded; superseded_by resolves with no self/dangling/cycle; chain terminates at ` +
  `active_plan.version whose sha256 is DISK-RESOLVED via sanctioned canonicalize/sha256hex. ` +
  `(2) Node-backed retirement (SUPERSEDED records / weave supersedes edges) is UNREPRESENTABLE in the current ` +
  `schema and DEFERRED as an explicit NON-CLAIM. (3) READ-ONLY: never mutates CURRENT-AUTHORITY; retirement ` +
  `stays a human CHANGE-PROTOCOL act; enforced by an executable allowlist oracle (no fs-write APIs). ` +
  `(4) BOUNDARY: never imports clotho/; sole sanctioned import merkle-dag/vendor.mjs. ` +
  `Do NOT require it to perform retirement, verify node-backed surfaces, or cryptographically authenticate ` +
  `CURRENT-AUTHORITY - all explicitly disclaimed. Approve ONLY if the plan is consistent with its pre-review, ` +
  `the registered meaning (verification half of "retires"), the repository trust model (fail-closed, closed sets, ` +
  `read-only, zero-dependency), and its own decisions - with no remaining contradiction.`;

// Write targets from the plan (agy derives protected_path_check from these).
const WRITE_TARGETS = ["atropos/"];

const dossier = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  objective: OBJECTIVE,
  proposal_ref: planRef,
  required_docs: [PLAN_PATH, PREREVIEW_PATH, CONTRACT_PATH],
  write_targets: WRITE_TARGETS,
  protected_paths: [],
  trust_mode: "signed"
};

const meta = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  proposal_ref: planRef,
  timestamp: TIMESTAMP,
  docs_reviewed: [PLAN_PATH, PREREVIEW_PATH, CONTRACT_PATH]
};

// ---------- strict packet schema (native structured output on every chat seat) ----------
const PACKET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["approve", "revise", "reject"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    required_edits: { type: "array", items: { type: "string" } },
    hard_stops: { type: "array", items: { type: "string" } },
    rationale: { type: "string" }
  },
  required: ["decision", "confidence", "required_edits", "hard_stops", "rationale"]
};

function parsePacket(text, model) {
  let m = null;
  try { m = JSON.parse(text); } catch { /* fall through */ }
  if (m && m.phase_gate_status) return agyApprovalPacket(m, meta);
  if (!m || typeof m !== "object") m = {};
  return {
    build_id: BUILD_ID,
    use_case: USE_CASE,
    model,
    role: "approver",
    docs_reviewed: meta.docs_reviewed,
    proposal_ref: planRef,
    decision: ["approve", "revise", "reject"].includes(m.decision) ? m.decision : "revise",
    required_edits: Array.isArray(m.required_edits) ? m.required_edits : [],
    hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [],
    confidence: ["low", "medium", "high"].includes(m.confidence) ? m.confidence : "low",
    timestamp: TIMESTAMP,
    rationale: typeof m.rationale === "string" ? m.rationale : "unparsable seat response (fail-closed to revise)"
  };
}

function stripAdditionalProperties(schema) {
  const clone = JSON.parse(JSON.stringify(schema));
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    delete node.additionalProperties;
    for (const v of Object.values(node)) walk(v);
  };
  walk(clone);
  return clone;
}

const FIELD_SEMANTICS =
  "Field semantics (STRICT): decision 'approve' means the plan may be implemented AS-IS. " +
  "hard_stops lists ONLY conditions that must BLOCK authorization right now — if you approve unconditionally, hard_stops MUST be []. " +
  "required_edits lists ONLY concrete changes you demand before approval — if you approve, required_edits MUST be []. " +
  "Do NOT restate the plan's invariants, strengths, or constraints in either list; put commentary in rationale.";

function promptFor(model, _role, dsr) {
  if (model === "agy") {
    return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, "atropos/") };
  }
  return {
    tool: `${model}_ask`,
    args: {
      prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== PLAN UNDER AUTHORIZATION (${PLAN_PATH}, ${planRef}) ===\n\n${planText}\n\n=== NORMATIVE CONTRACT UNDER AUTHORIZATION (${CONTRACT_PATH}) ===\n\n${contractText}`,
      system: `You are the ${model} seat on the TELOS authorization council. Judge the plan on the merits against the objective. Approve only what you would stake your seat's signature on. ${FIELD_SEMANTICS}`,
      model,
      max_tokens: 60000,
      include_provenance: true,
      response_schema: model === "gemini" ? stripAdditionalProperties(PACKET_SCHEMA) : PACKET_SCHEMA,
      schema_name: "telos_approval_packet"
    }
  };
}

const seats = [
  { model: "claude", role: "approver" },
  { model: "agy", role: "approver" },
  { model: "codex", role: "approver" },
  { model: "grok", role: "advisory" },
  { model: "gemini", role: "advisory" }
];

const serverPath = path.join(ROOT, "connectors/ai-peer-mcp/server.mjs");
const { client, close } = spawnMcpClient({ command: process.execPath, serverPath });
const killer = setTimeout(() => { console.error("AUTHZ_TIMEOUT"); process.exit(2); }, 1_800_000);

try {
  const callSeat = (seatArg) =>
    liveSeatCaller({ client, promptFor, parsePacket: (t) => parsePacket(t, seatArg.model) })(seatArg);

  const results = await runCouncil({ seats, callSeat, dossier });

  mkdirSync(HERE, { recursive: true });
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, plan_ref: planRef, reviewed_head: REVIEWED_HEAD, enrollment_flip: "HELD for a separate Eye ruling (not authorized by this council)", timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
  const packetsForGate = [];

  for (const r of results) {
    if (r.ok) {
      writeFileSync(path.join(HERE, `${r.model}.json`), JSON.stringify(r.packet, null, 2));
      packetsForGate.push(r.packet);
      summary.seats.push({ model: r.model, role: r.role, ok: true, signed: !!r.signed, decision: r.packet.decision, confidence: r.packet.confidence, provenance: r.packet.provenance });
    } else {
      summary.seats.push({ model: r.model, role: r.role, ok: false, reason: r.reason });
    }
  }

  const gate = validateRecords(dossier, packetsForGate);
  summary.gate = {
    gate_status: gate.gate_status,
    signing_enforced: gate.headline_checks?.signing_enforced,
    provenance_enforced: gate.headline_checks?.provenance_enforced,
    blockers: gate.blockers,
    warnings: gate.warnings,
    provenance: gate.provenance
  };

  const requiredSeats = seats.filter((s) => s.role === "approver").map((s) => s.model);
  const approvals = summary.seats.filter((s) => requiredSeats.includes(s.model) && s.ok && s.decision === "approve");
  const gatePassed = gate.gate_status === "pass";
  summary.authorized = gatePassed && approvals.length === requiredSeats.length;
  summary.authorization = summary.authorized
    ? { status: "AUTHORIZED", id: "authz-atropos-1", plan_ref: planRef, note: "Argo implementation of the Lachesis cycle-1 matured plan is authorized by the signed council under the TELOS gate. Enrollment-flip HELD for a separate Eye ruling." }
    : { status: "NOT_AUTHORIZED", note: "Fail-closed: see gate.blockers and seat decisions." };

  writeFileSync(path.join(HERE, "authorization-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ authorized: summary.authorized, gate_status: gate.gate_status, blockers: gate.blockers.length, seats: summary.seats.map((s) => ({ model: s.model, ok: s.ok, decision: s.decision ?? null })) }, null, 2));
  process.exit(summary.authorized ? 0 : 3);
} catch (error) {
  console.error("AUTHZ_ERROR: " + (error?.message || String(error)));
  process.exitCode = 1;
} finally {
  clearTimeout(killer);
  close();
}
