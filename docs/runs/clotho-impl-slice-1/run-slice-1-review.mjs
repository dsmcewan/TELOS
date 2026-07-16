#!/usr/bin/env node
// TELOS required-seat REVIEW of Clotho Phase 1 Slice 1 (v12 Task 1 scaffold).
//
// The implementation PR re-enters TELOS: a signed council reviews the actual
// scaffold code against frozen v12 Task 1, deciding on the merits. claude/agy/
// codex are REQUIRED approvers; grok/gemini advisory. The deterministic gate
// already passed (docs/runs/clotho-impl-slice-1/gate-result.json, finalStatus
// meets); this is the qualitative faithfulness/scope review. Fail-closed: any
// missing required packet, invalid signature, or non-approve leaves Slice 1
// NOT accepted.
//
// This run produces the review record only. It does NOT merge PR #110 — human
// acceptance (The Eye) is separate.

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

const rd = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

// ---- assemble the artifact under review ----
const v12 = rd("docs/runs/clotho-daedalus-delta11/matured-plan-v12.md");
const task1 = v12.slice(v12.indexOf("## Task 1: Package scaffold"), v12.indexOf("## Task 2:"));
const proposal = rd("docs/clotho-phase-1-slice-1-proposal.md");
const gateResult = rd("docs/runs/clotho-impl-slice-1/gate-result.json");
const files = [
  "clotho/package.json",
  "clotho/scripts/check.mjs",
  "clotho/scripts/test-all.mjs",
  "clotho/scripts/test-registry.mjs"
];
const code = files.map((f) => `--- ${f} ---\n${rd(f)}`).join("\n\n");
const gitignoreAdd = ".gitignore change: append '.telos/clotho/' (only change outside clotho/).";

const reviewText = [
  "=== v12 Task 1 — AUTHORITATIVE SCOPE (frozen) ===", task1,
  "\n=== Slice 1 acceptance criteria and boundary (governance record) ===", proposal,
  "\n=== Deterministic TELOS gate result (verifier over real artifacts) ===", gateResult,
  "\n=== IMPLEMENTATION UNDER REVIEW (PR #110) ===", code, "\n" + gitignoreAdd
].join("\n");

const reviewRef = "sha256:" + sha256hex(canonicalize({ kind: "slice-review", body: reviewText }));

// ---- signing secrets: real when present, else ephemeral ----
const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) {
    process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex");
    EPHEMERAL_SIGNERS.push(m.toLowerCase());
  }
}

const BUILD_ID = "clotho-phase-1-slice-1-review";
const USE_CASE = "clotho-phase-1-slice-1";
const TIMESTAMP = new Date().toISOString();
const PR_HEAD = "ceba4c49080529212948144d2f174a6b9922e792"; // PR #110 head
const OBJECTIVE =
  `Review the Clotho Phase 1 Slice 1 implementation (v12 Task 1 package scaffold, PR #110, head ${PR_HEAD}) ` +
  `for FAITHFUL implementation strictly within frozen scope. Authorized by The Eye's implementation decision ` +
  `(PR #109) against v12 (sha256:bdc93901..., authz-005). The deterministic gate already passed (finalStatus meets, 10/10 checks). ` +
  `Approve ONLY if the code implements Task 1 as written with NO reinterpretation and NO scope expansion: zero-dependency ESM ` +
  `package scaffold; check.mjs recursively node --checks clotho/**/*.mjs with no shell; test-all.mjs runs a committed ordered ` +
  `list and fails closed on any unlisted test-*.mjs; the scaffold test prints 'clotho scaffold OK'; the only change outside ` +
  `clotho/ is adding .telos/clotho/ to .gitignore; no spine or existing-package source changed; .github/workflows untouched ` +
  `(Task 0 is separate). Reject or revise if anything exceeds Task 1, reinterprets it, or violates repo constraints ` +
  `(Node>=18, ESM, zero deps).`;

const WRITE_TARGETS = ["clotho/", ".gitignore"];

const dossier = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, proposal_ref: reviewRef, required_docs: files, write_targets: WRITE_TARGETS, protected_paths: [], trust_mode: "signed" };
const meta = { build_id: BUILD_ID, use_case: USE_CASE, proposal_ref: reviewRef, timestamp: TIMESTAMP, docs_reviewed: files };

const PACKET_SCHEMA = {
  type: "object", additionalProperties: false,
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
    build_id: BUILD_ID, use_case: USE_CASE, model, role: "approver", docs_reviewed: meta.docs_reviewed, proposal_ref: reviewRef,
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
  const walk = (n) => { if (!n || typeof n !== "object") return; delete n.additionalProperties; for (const v of Object.values(n)) walk(v); };
  walk(clone); return clone;
}

const FIELD_SEMANTICS =
  "Field semantics (STRICT): decision 'approve' means the code may be accepted AS-IS. " +
  "hard_stops lists ONLY conditions that must BLOCK acceptance now — if you approve, hard_stops MUST be []. " +
  "required_edits lists ONLY concrete changes you demand before acceptance — if you approve, required_edits MUST be []. " +
  "Put commentary in rationale, not the lists.";

function promptFor(model, _role, dsr) {
  if (model === "agy") return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, "clotho/") };
  return {
    tool: `${model}_ask`,
    args: {
      prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== ARTIFACT UNDER REVIEW (${reviewRef}) ===\n\n${reviewText}`,
      system: `You are the ${model} seat on the TELOS implementation-review council. Judge whether the code faithfully implements v12 Task 1 within frozen scope. Approve only what you would stake your seat's signature on. ${FIELD_SEMANTICS}`,
      model, max_tokens: 60000, include_provenance: true,
      response_schema: model === "gemini" ? stripAdditionalProperties(PACKET_SCHEMA) : PACKET_SCHEMA,
      schema_name: "telos_review_packet"
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
const killer = setTimeout(() => { console.error("REVIEW_TIMEOUT"); process.exit(2); }, 1_800_000);

try {
  const callSeat = (seatArg) => liveSeatCaller({ client, promptFor, parsePacket: (t) => parsePacket(t, seatArg.model) })(seatArg);
  const results = await runCouncil({ seats, callSeat, dossier });

  mkdirSync(HERE, { recursive: true });
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, review_ref: reviewRef, pr: 110, pr_head: PR_HEAD, plan_ref: "sha256:bdc93901952312846d693e14925eac49c332e0364a4a2a158ae21b2d607e79d3", authorization: "authz-005", timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
  const packetsForGate = [];
  for (const r of results) {
    if (r.ok) {
      writeFileSync(path.join(HERE, `review-${r.model}.json`), JSON.stringify(r.packet, null, 2));
      packetsForGate.push(r.packet);
      summary.seats.push({ model: r.model, role: r.role, ok: true, signed: !!r.signed, decision: r.packet.decision, confidence: r.packet.confidence, provenance: r.packet.provenance });
    } else summary.seats.push({ model: r.model, role: r.role, ok: false, reason: r.reason });
  }

  const gate = validateRecords(dossier, packetsForGate);
  summary.gate = { gate_status: gate.gate_status, signing_enforced: gate.headline_checks?.signing_enforced, provenance_enforced: gate.headline_checks?.provenance_enforced, blockers: gate.blockers, warnings: gate.warnings, provenance: gate.provenance };

  const requiredSeats = seats.filter((s) => s.role === "approver").map((s) => s.model);
  const approvals = summary.seats.filter((s) => requiredSeats.includes(s.model) && s.ok && s.decision === "approve");
  const passed = gate.gate_status === "pass" && approvals.length === requiredSeats.length;
  summary.review_passed = passed;
  summary.acceptance = passed
    ? { status: "REVIEW_PASSED", note: "Slice 1 passed required-seat review + gate. Human acceptance (The Eye) is the remaining, separate step." }
    : { status: "REVIEW_NOT_PASSED", note: "Fail-closed: see gate.blockers and seat decisions." };

  writeFileSync(path.join(HERE, "review-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ review_passed: passed, gate_status: gate.gate_status, blockers: gate.blockers.length, seats: summary.seats.map((s) => ({ model: s.model, ok: s.ok, decision: s.decision ?? null })) }, null, 2));
  process.exit(passed ? 0 : 3);
} catch (error) {
  console.error("REVIEW_ERROR: " + (error?.message || String(error)));
  process.exitCode = 1;
} finally {
  clearTimeout(killer);
  close();
}
