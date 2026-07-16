#!/usr/bin/env node
// TELOS authorization run for Clotho Phase 1 plan v11.
//
// Sequence: Daedalus (done) -> The Eye (released, PR #94 merged 698e3d85) ->
// TELOS AUTHORIZES (this run) -> Argo executes. A real signed council over the
// plan's content address: claude/agy/codex REQUIRED approvers, grok/gemini
// advisory. Every chat seat reviews the FULL plan text and returns a strict
// JSON approval packet bound to its own real provenance; agy is the local
// deterministic governance checkpoint derived from the dossier. The gate
// (trust_mode "signed") certifies from packets + signatures + provenance —
// never a seat's self-report. Fail-closed: any missing required packet,
// invalid signature, placeholder provenance, or non-approve decision leaves
// the plan UNAUTHORIZED.
//
// Run from Windows node (loadWin32Env pulls API keys + TELOS_SECRET_* from
// HKCU): "/mnt/c/Program Files/nodejs/node.exe" docs/runs/clotho-authorization-4/run-authorization-4.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

// Import order matters: the seat server module's loadWin32Env() (win32) fills
// process.env with API keys AND TELOS_SECRET_* from the registry BEFORE the
// secret check below.
await imp("connectors/ai-peer-mcp/server.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } = await imp("build-gate/council.mjs");
const { validateRecords } = await imp("build-gate/gate.mjs");
const { spawnMcpClient } = await imp("breakout/mcp_client.mjs");

// ---------- bind the exact plan under authorization ----------
const PLAN_PATH = "docs/runs/clotho-daedalus-delta10/matured-plan-v11.md";
const SPEC_PATH = "docs/clotho-phase-1-design.md";
const EXPECTED_PLAN_REF = "sha256:f5d9cd52f12ec9abb4c613c469437d0079af7fdf249c5a842f94c451d55fc30c";
const MERGE_ANCHOR = "7c200e5643043d72578e617dc7e8650370c775e6"; // PR #94 regular merge commit
const REVIEWED_HEAD = "5e9fa7ab3f3429578677a3a9252686316b200bda"; // The Eye's cold-read source head

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

const BUILD_ID = "clotho-phase-1-authz-004";
const USE_CASE = "clotho-phase-1";
const TIMESTAMP = new Date().toISOString();
const OBJECTIVE =
  `Authorize Argo execution of the Clotho Phase 1 implementation plan v11 ` +
  `(content address ${planRef}; released by The Eye via PR #94, merge commit ${MERGE_ANCHOR}). ` +
  `The plan builds clotho/, an advisory zero-dependency knowledge-graph package proven by weaving TELOS itself. ` +
  `Approve ONLY if the plan is implementation-ready and consistent with its governing spec (v2.8), the repository's ` +
  `trust model (fail-closed, closed sets, spine read-only, advisory-only Clotho), and its own decisions and exit criteria.`;

// Write targets from the plan (agy derives protected_path_check from these).
const WRITE_TARGETS = ["clotho/", ".github/workflows/ci.yml", ".gitignore", "docs/runs/clotho-self-weave/", "docs/STATUS.md", "docs/ROADMAP.md"];

const dossier = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  objective: OBJECTIVE,
  proposal_ref: planRef,
  required_docs: [PLAN_PATH, SPEC_PATH],
  write_targets: WRITE_TARGETS,
  protected_paths: [],
  trust_mode: "signed"
};

const meta = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  proposal_ref: planRef,
  timestamp: TIMESTAMP,
  docs_reviewed: [PLAN_PATH, SPEC_PATH]
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

// Gemini's responseSchema rejects `additionalProperties` — strip it for that seat.
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
  "Field semantics (STRICT): decision 'approve' means the plan may be executed AS-IS. " +
  "hard_stops lists ONLY conditions that must BLOCK authorization right now — if you approve unconditionally, hard_stops MUST be []. " +
  "required_edits lists ONLY concrete changes you demand before approval — if you approve, required_edits MUST be []. " +
  "Do NOT restate the plan's invariants, strengths, or constraints in either list; put commentary in rationale.";

function promptFor(model, _role, dsr) {
  if (model === "agy") {
    return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, "clotho/") };
  }
  // Explicit args path: liveSeatCaller passes spec.args verbatim, letting us set
  // max_tokens — a merits review of a 1283-line plan at approver-tier (seat
  // default) effort exhausts the seat's default completion budget otherwise
  // (observed live: codex finish_reason "length" with zero answer).
  return {
    tool: `${model}_ask`,
    args: {
      prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== PLAN UNDER AUTHORIZATION (${PLAN_PATH}, ${planRef}) ===\n\n${planText}`,
      system: `You are the ${model} seat on the TELOS authorization council. Judge the plan on the merits against the objective. Approve only what you would stake your seat's signature on. ${FIELD_SEMANTICS}`,
      model, // bare seat name -> mapModelName -> current frontier id; effort = seat default (approver tier)
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
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, plan_ref: planRef, merge_anchor: MERGE_ANCHOR, reviewed_head: REVIEWED_HEAD, timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
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
    ? { status: "AUTHORIZED", plan_ref: planRef, note: "Argo execution of Clotho Phase 1 plan v11 is authorized by the signed council under the TELOS gate." }
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
