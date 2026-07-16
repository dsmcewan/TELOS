#!/usr/bin/env node
// TELOS required-seat REVIEW of Clotho Task 2 (registry.mjs). The implementation
// PR re-enters TELOS: a signed council reviews the actual code against frozen v12
// Task 2. claude/agy/codex required approvers; grok/gemini advisory. The
// deterministic gate already passed (gate-result.json, finalStatus meets). This
// is the qualitative faithfulness/scope review. Fail-closed. Does NOT merge #113.

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
const task2 = v12.slice(v12.indexOf("## Task 2:"), v12.indexOf("## Task 3:"));
const decisions = byLine(60, 80);       // D13 content-bound locators; D16 repository_ref; D18 shallow/full-clone contract
const identity = byLine(235, 470);      // canonicalJson, deriveNodeId, locator schemas, source-ref forms, status coupling, endpoint matrix, and the signed-edge shape (from_node/to_node/from_locator/to_locator)
const task4a = byLine(996, 1075);       // context: weaver-facing git wrapper is separate from Task 2's test-only fixture allowlist
const files = ["clotho/registry.mjs", "clotho/scripts/test-registry.mjs"];
const code = files.map((f) => `--- ${f} ---\n${rd(f)}`).join("\n\n");
const gateResult = rd("docs/runs/clotho-impl-slice-2/gate-result.json");

const reviewText = [
  "=== v12 Task 2 — AUTHORITATIVE SCOPE (frozen) ===", task2,
  "\n=== v12 decisions D13 / D16 / D18 (content-bound locators; repository_ref derivation; shallow/full-clone contract) ===", decisions,
  "\n=== v12 identity + locator schemas + source-ref forms + status/assertor coupling + endpoint matrix + SIGNED-EDGE SHAPE (from_node, to_node, from_locator:{kind,locator}, to_locator:{kind,locator}) ===", identity,
  "\n=== v12 Task 4a (context: the weaver-facing git wrapper is a SEPARATE later deliverable; Task 2's real-git fixture uses its own private test-only allowlist) ===", task4a,
  "\n=== Deterministic TELOS gate result (verifier over real artifacts) ===", gateResult,
  "\n=== IMPLEMENTATION UNDER REVIEW (PR #113, revised) ===", code
].join("\n");
const reviewRef = "sha256:" + sha256hex(canonicalize({ kind: "slice-review", body: reviewText }));

const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) { process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex"); EPHEMERAL_SIGNERS.push(m.toLowerCase()); }
}

const BUILD_ID = "clotho-task-2-review";
const USE_CASE = "clotho-phase-1-task-2";
const TIMESTAMP = new Date().toISOString();
const PR_HEAD = "952087094e86fc92162a750bd74742b35ff73c8c";
const OBJECTIVE =
  `Review the REVISED Clotho Task 2 implementation (clotho/registry.mjs + test, PR #113, head ${PR_HEAD}) for FAITHFUL implementation strictly within frozen v12 Task 2 scope. ` +
  `Authorized by The Eye's implementation decision (#109) against v12 (sha256:bdc93901..., authz-005). The deterministic gate passed (finalStatus meets). ` +
  `This revision applies The Eye's two rulings and the prior review's fixes: (A) edgeInput carries explicit from_node/to_node (64-hex) AND from_locator/to_locator ({kind,locator}); stated ids are validated against deriveNodeId(locator) and a mismatch is REJECTED (the endpoint matrix uses the locator kinds) — see the v12 signed-edge shape in the bundle; (B) the real-git fixture runs through a PRIVATE, fixture-only, no-shell git allowlist in the test (not the Task 4a weaver-facing wrapper). Also: forEach passes the facade not the private set; WEAVER_IDS and ShallowRepositoryError are NOT public exports; exact outer schemas on deriveNodeId/docAddressKey; nonempty model:<seat>; deriveRepositoryRef accepts only exact git-output forms (malformed != shallow). ` +
  `Approve ONLY if the code faithfully implements v12 Task 2 within frozen scope (exact closed sets as read-only facades; canonicalJson; per-kind locator schemas + content bindings; the endpoint matrix; status/assertor coupling; explicit edge id-vs-locator validation; the shallow/full-clone contract vs real git + injected units), with zero runtime dependencies, ESM, node: stdlib only, no spine change, and no scope expansion. The bundle includes v12 Task 2, decisions D13/D16/D18, the identity/locator/source-ref/endpoint/signed-edge sections, and Task 4a context. Reject or revise only for genuine faithfulness/scope defects.`;

const WRITE_TARGETS = ["clotho/"];
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
  try { m = JSON.parse(text); } catch { /* fall */ }
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
  "Field semantics (STRICT): 'approve' means the code may be accepted AS-IS. hard_stops lists ONLY blocking conditions (empty if you approve). required_edits lists ONLY demanded changes (empty if you approve). Commentary in rationale.";

function promptFor(model, _role, dsr) {
  if (model === "agy") return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, "clotho/") };
  return {
    tool: `${model}_ask`,
    args: {
      prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== ARTIFACT UNDER REVIEW (${reviewRef}) ===\n\n${reviewText}`,
      system: `You are the ${model} seat on the TELOS implementation-review council. Judge whether the code faithfully implements v12 Task 2 within frozen scope. Approve only what you would stake your seat's signature on. ${FIELD_SEMANTICS}`,
      model, max_tokens: 60000, include_provenance: true,
      response_schema: model === "gemini" ? stripAdditionalProperties(PACKET_SCHEMA) : PACKET_SCHEMA,
      schema_name: "telos_review_packet"
    }
  };
}

const seats = [
  { model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" },
  { model: "grok", role: "advisory" }, { model: "gemini", role: "advisory" }
];

const serverPath = path.join(ROOT, "connectors/ai-peer-mcp/server.mjs");
const { client, close } = spawnMcpClient({ command: process.execPath, serverPath });
const killer = setTimeout(() => { console.error("REVIEW_TIMEOUT"); process.exit(2); }, 1_800_000);

try {
  const callSeat = (seatArg) => liveSeatCaller({ client, promptFor, parsePacket: (t) => parsePacket(t, seatArg.model) })(seatArg);
  const results = await runCouncil({ seats, callSeat, dossier });

  mkdirSync(HERE, { recursive: true });
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE, review_ref: reviewRef, pr: 113, pr_head: PR_HEAD, plan_ref: "sha256:bdc93901952312846d693e14925eac49c332e0364a4a2a158ae21b2d607e79d3", authorization: "authz-005", timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
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
    ? { status: "REVIEW_PASSED", note: "Task 2 passed required-seat review + gate. Human acceptance (The Eye) is the remaining, separate step." }
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
