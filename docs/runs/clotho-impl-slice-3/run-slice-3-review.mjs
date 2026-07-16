#!/usr/bin/env node
// TELOS required-seat REVIEW of Clotho Task 3 (thread-ledger.mjs). Signed council
// reviews the code against frozen v12 Task 3. claude/agy/codex required;
// grok/gemini advisory. Gate already meets. Fail-closed. Does NOT merge #115.

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
const v12 = rd("docs/runs/clotho-daedalus-delta11/matured-plan-v12.md");
const vlines = v12.split("\n");
const byLine = (a, b) => vlines.slice(a - 1, b).join("\n");
const task3 = v12.slice(v12.indexOf("## Task 3:"), v12.indexOf("## Task 4a:"));
const decisions = byLine(60, 90);      // D5/D13/D16/D19/D20/D22/D24/D28/D29
const recordSchema = byLine(445, 530); // header/edge/status/trailer record + envelope shapes, D24 counts, executed/skipped
const files = ["clotho/thread-ledger.mjs", "clotho/scripts/test-ledger.mjs"];
const code = files.map((f) => `--- ${f} ---\n${rd(f)}`).join("\n\n");
const gateResult = rd("docs/runs/clotho-impl-slice-3/gate-result.json");

const reviewText = [
  "=== v12 Task 3 — AUTHORITATIVE SCOPE (frozen) ===", task3,
  "\n=== v12 decisions D5/D19/D20/D22/D24/D28/D29 (+ D13/D16) ===", decisions,
  "\n=== v12 record/envelope schema: header, edge, status, trailer; chain; D24 counts; executed/skipped ===", recordSchema,
  "\n=== v12 note: reuse merkle-dag Ed25519/envelope primitives only when they implement the normative bytes; otherwise use node:crypto (naming the proposal-ledger pattern source) ===",
  "\n=== Deterministic TELOS gate result (verifier over real artifacts) ===", gateResult,
  "\n=== IMPLEMENTATION UNDER REVIEW (PR #115) ===", code
].join("\n");
const reviewRef = "sha256:" + sha256hex(canonicalize({ kind: "slice-review", body: reviewText }));

const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) { process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex"); EPHEMERAL_SIGNERS.push(m.toLowerCase()); }
}
const BUILD_ID = "clotho-task-3-review";
const USE_CASE = "clotho-phase-1-task-3";
const TIMESTAMP = new Date().toISOString();
const PR_HEAD = "8eda6023d685abca9578b5dd953df0d5f924f80e";
const OBJECTIVE =
  `Review the Clotho Task 3 implementation (clotho/thread-ledger.mjs + test, PR #115, head ${PR_HEAD}) for FAITHFUL implementation strictly within frozen v12 Task 3 scope. ` +
  `Authorized by The Eye's implementation decision (#109) against v12 (sha256:bdc93901..., authz-005). The deterministic gate passed (finalStatus meets). ` +
  `Approve ONLY if the code implements Task 3 as written with NO reinterpretation and NO scope expansion: createLedger/verifyLedger/readEdges with the exact header/edge/status/trailer record shapes; the chain (prev_hash = sha256 of the prior full line; record_hash = sha256 of canonicalJson(payload+prev_hash); Ed25519 signature over the raw 32-byte digest; LF-terminated); D5 (the weave owns time/keypair/envelope, weavers emit none); D19 generic ledger integrity against INJECTED fixture coverage only (no committed-inventory dependency); D24 inspected_source_counts schema; D22 descriptor discipline (idempotent abort, every failure path closes the fd); D29 executed=complete-consumption semantics as enforceable at this layer; exclusive wx creation; status adjudication human-only. Zero runtime dependencies, ESM, node: stdlib + clotho-relative imports only, no spine change. Reject or revise for genuine faithfulness/scope defects only. Note: atomic no-replace publication (D20/D28) is the Task 5 driver's responsibility, not this ledger primitive.`;

const dossier = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, proposal_ref: reviewRef, required_docs: files, write_targets: ["clotho/"], protected_paths: [], trust_mode: "signed" };
const meta = { build_id: BUILD_ID, use_case: USE_CASE, proposal_ref: reviewRef, timestamp: TIMESTAMP, docs_reviewed: files };
const PACKET_SCHEMA = { type: "object", additionalProperties: false, properties: { decision: { type: "string", enum: ["approve", "revise", "reject"] }, confidence: { type: "string", enum: ["low", "medium", "high"] }, required_edits: { type: "array", items: { type: "string" } }, hard_stops: { type: "array", items: { type: "string" } }, rationale: { type: "string" } }, required: ["decision", "confidence", "required_edits", "hard_stops", "rationale"] };
function parsePacket(text, model) {
  let m = null; try { m = JSON.parse(text); } catch { /* */ }
  if (m && m.phase_gate_status) return agyApprovalPacket(m, meta);
  if (!m || typeof m !== "object") m = {};
  return { build_id: BUILD_ID, use_case: USE_CASE, model, role: "approver", docs_reviewed: meta.docs_reviewed, proposal_ref: reviewRef, decision: ["approve", "revise", "reject"].includes(m.decision) ? m.decision : "revise", required_edits: Array.isArray(m.required_edits) ? m.required_edits : [], hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [], confidence: ["low", "medium", "high"].includes(m.confidence) ? m.confidence : "low", timestamp: TIMESTAMP, rationale: typeof m.rationale === "string" ? m.rationale : "unparsable (fail-closed to revise)" };
}
function stripAP(s) { const c = JSON.parse(JSON.stringify(s)); const w = (n) => { if (!n || typeof n !== "object") return; delete n.additionalProperties; for (const v of Object.values(n)) w(v); }; w(c); return c; }
const FS = "Field semantics (STRICT): 'approve' means acceptable AS-IS; hard_stops/required_edits empty if you approve; commentary in rationale.";
function promptFor(model, _role, dsr) {
  if (model === "agy") return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, "clotho/") };
  return { tool: `${model}_ask`, args: { prompt: `Objective:\n${OBJECTIVE}\n\n${FS}\n\n=== ARTIFACT UNDER REVIEW (${reviewRef}) ===\n\n${reviewText}`, system: `You are the ${model} seat on the TELOS implementation-review council. Judge whether the code faithfully implements v12 Task 3 within frozen scope. Approve only what you would stake your seat's signature on. ${FS}`, model, max_tokens: 60000, include_provenance: true, response_schema: model === "gemini" ? stripAP(PACKET_SCHEMA) : PACKET_SCHEMA, schema_name: "telos_review_packet" } };
}
const seats = [{ model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" }, { model: "grok", role: "advisory" }, { model: "gemini", role: "advisory" }];
const { client, close } = spawnMcpClient({ command: process.execPath, serverPath: path.join(ROOT, "connectors/ai-peer-mcp/server.mjs") });
const killer = setTimeout(() => { console.error("REVIEW_TIMEOUT"); process.exit(2); }, 1_800_000);
try {
  const callSeat = (s) => liveSeatCaller({ client, promptFor, parsePacket: (t) => parsePacket(t, s.model) })(s);
  const results = await runCouncil({ seats, callSeat, dossier });
  mkdirSync(HERE, { recursive: true });
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, review_ref: reviewRef, pr: 115, pr_head: PR_HEAD, plan_ref: "sha256:bdc93901952312846d693e14925eac49c332e0364a4a2a158ae21b2d607e79d3", authorization: "authz-005", timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
  const packetsForGate = [];
  for (const r of results) {
    if (r.ok) { writeFileSync(path.join(HERE, `review-${r.model}.json`), JSON.stringify(r.packet, null, 2)); packetsForGate.push(r.packet); summary.seats.push({ model: r.model, role: r.role, ok: true, signed: !!r.signed, decision: r.packet.decision, confidence: r.packet.confidence, provenance: r.packet.provenance }); }
    else summary.seats.push({ model: r.model, role: r.role, ok: false, reason: r.reason });
  }
  const gate = validateRecords(dossier, packetsForGate);
  summary.gate = { gate_status: gate.gate_status, signing_enforced: gate.headline_checks?.signing_enforced, provenance_enforced: gate.headline_checks?.provenance_enforced, blockers: gate.blockers, warnings: gate.warnings };
  const req = seats.filter((s) => s.role === "approver").map((s) => s.model);
  const approvals = summary.seats.filter((s) => req.includes(s.model) && s.ok && s.decision === "approve");
  const passed = gate.gate_status === "pass" && approvals.length === req.length;
  summary.review_passed = passed;
  summary.acceptance = passed ? { status: "REVIEW_PASSED", note: "Task 3 passed required-seat review + gate; human acceptance remains." } : { status: "REVIEW_NOT_PASSED", note: "Fail-closed: see gate.blockers and seat decisions." };
  writeFileSync(path.join(HERE, "review-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ review_passed: passed, gate_status: gate.gate_status, blockers: gate.blockers.length, seats: summary.seats.map((s) => ({ model: s.model, ok: s.ok, decision: s.decision ?? null })) }, null, 2));
  process.exit(passed ? 0 : 3);
} catch (e) { console.error("REVIEW_ERROR: " + (e?.message || String(e))); process.exitCode = 1; }
finally { clearTimeout(killer); close(); }
