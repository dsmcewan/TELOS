#!/usr/bin/env node
// TELOS re-authorization run for Clotho Phase 1 plan v13 (authz-006).
//
// Sequence: Task 4a implementation surfaced a genuine frozen-scope ambiguity ->
// The Eye ruled (PACKAGE_ROOTS = TELOS spine) -> Daedalus delta-12 integrated the
// ruling (AM-40) into v12 -> The Eye released v13 (PR #118 squash-merged 226d18b)
// -> TELOS RE-AUTHORIZES (this run) -> Argo resumes Task 4a. A real signed council
// over the plan's content address: claude/agy/codex REQUIRED approvers,
// grok/gemini advisory. Every chat seat reviews the FULL v13 plan text and returns
// a strict JSON approval packet bound to its own real provenance; agy is the local
// deterministic governance checkpoint derived from the dossier. The gate
// (trust_mode "signed") certifies from packets + signatures + provenance — never a
// seat's self-report. Fail-closed: any missing required packet, invalid signature,
// placeholder provenance, or non-approve decision leaves v13 UNAUTHORIZED.
//
// v13 = v12 + AM-40 only. v12's terms are unchanged (advisory, non-sandboxed, no
// claim of proven loader isolation). AM-40 narrows PACKAGE_ROOTS to the five
// TELOS-spine packages with an explicit, mechanically-proven exclusion of the
// three sibling products, deferred for conscious enrollment at the Iliad. Judge
// v13 on ITS OWN terms.
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
const PLAN_PATH = "docs/runs/clotho-daedalus-delta12/matured-plan-v13.md";
const SPEC_PATH = "docs/clotho-phase-1-design.md";
const EXPECTED_PLAN_REF = "sha256:f9368b5748de6c2670193558783b60b7f74fd94de9196c9664d42269f3d2bc04";
const MERGE_ANCHOR = "226d18bafb92a4fab70f8cc1382076dc6f550f6f"; // PR #118 squash-merge commit
const REVIEWED_HEAD = "ad14c14a20789a7c5d917aed116acb992d8fd7e8"; // v13 reviewed head (delta-12 release)
const PRIOR_AUTHZ = "authz-005"; // v12 authorization this extends

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

const BUILD_ID = "clotho-phase-1-authz-006";
const USE_CASE = "clotho-phase-1";
const TIMESTAMP = new Date().toISOString();
const OBJECTIVE =
  `Re-authorize Argo execution of the Clotho Phase 1 implementation plan v13 ` +
  `(content address ${planRef}; released by The Eye via PR #118, squash-merge ${MERGE_ANCHOR}; extends ${PRIOR_AUTHZ} which authorized v12). ` +
  `v13 = v12 + the single narrow amendment AM-40 (The Eye's PACKAGE_ROOTS scope ruling): PACKAGE_ROOTS is EXACTLY the five TELOS-spine packages ` +
  `(breakout, build-gate, clotho, connectors/ai-peer-mcp, merkle-dag); the three sibling products (ai-forge, forge, saas-forge) are an EXPLICIT committed exclusion ` +
  `proven exhaustive by a discover-all/union/disjoint unit, DEFERRED for conscious enrollment at the system-of-systems umbrella (the Iliad), not absorbed into the Phase 1 self-weave. ` +
  `v13 differs from the already-authorized v12 at EXACTLY two points (the Task 4a inventory clause and the inventory.mjs file-description row); every other frozen decision is reaffirmed unchanged ` +
  `(advisory / non-sandboxed posture per AM-35..AM-39; D17/AM-17 inventory staging; D24/D26/D31; D32; D33; zero-dependency; spine read-only). ` +
  `Judge v13 on ITS OWN advisory/non-sandbox terms — do NOT require it to prove loader isolation. ` +
  `Approve ONLY if the plan is implementation-ready and consistent with its governing spec (v2.8, advisory posture), the repository's trust model ` +
  `(fail-closed, closed sets, spine read-only, advisory-only Clotho), and its own decisions and exit criteria — with AM-40 correctly narrowing scope.`;

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
  return {
    tool: `${model}_ask`,
    args: {
      prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== PLAN UNDER AUTHORIZATION (${PLAN_PATH}, ${planRef}) ===\n\n${planText}`,
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
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, plan_ref: planRef, merge_anchor: MERGE_ANCHOR, reviewed_head: REVIEWED_HEAD, extends: PRIOR_AUTHZ, timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
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
    ? { status: "AUTHORIZED", plan_ref: planRef, note: "Argo execution of Clotho Phase 1 plan v13 is authorized by the signed council under the TELOS gate; extends authz-005." }
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
