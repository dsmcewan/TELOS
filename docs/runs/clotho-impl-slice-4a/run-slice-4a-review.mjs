#!/usr/bin/env node
// TELOS required-seat REVIEW of Clotho Task 4a (closed inventory, substrate, git +
// code weavers). Signed council reviews the code against frozen v15 Task 4a.
// claude/agy/codex required; grok/gemini advisory. Gate already meets.
// Fail-closed. Does NOT merge #117.

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
// Judge against v13 — v12 + AM-40 (The Eye's PACKAGE_ROOTS ruling), authorized by
// authz-006. The Task 4a clause now carries the explicit PACKAGE_ROOTS /
// PACKAGE_ROOTS_EXCLUDE scope, so the council reviews against unambiguous scope.
const v15 = rd("docs/runs/clotho-daedalus-delta14/matured-plan-v15.md");
const vlines = v15.split("\n");
const byLine = (a, b) => vlines.slice(a - 1, b).join("\n");
const task4a = v15.slice(v15.indexOf("## Task 4a:"), v15.indexOf("## Task 4b:"));
const decisions = byLine(60, 95); // decision table incl. D17/D21/D24/D26/D27/D29/D30/D32/D33 (unchanged by AM-40)

const implFiles = ["clotho/inventory.mjs", "clotho/weavers/util.mjs", "clotho/weavers/git.mjs", "clotho/weavers/code.mjs"];
const testFiles = ["clotho/scripts/test-closure.mjs", "clotho/scripts/test-inventory.mjs", "clotho/scripts/test-util.mjs", "clotho/scripts/test-git.mjs", "clotho/scripts/test-code.mjs"];
// registry.mjs is a member of BOTH committed weaver closures ({registry,git} and
// {registry,code,util}); include its bytes so seats can independently confirm it
// is leaf (no accepted relative imports) and the committed inventories complete.
// registry.mjs (closure member, above) + test-all.mjs (proves the five new
// test-*.mjs suites are registered, so the green gate provably covers them).
const contextFiles = ["clotho/registry.mjs", "clotho/scripts/test-all.mjs"];
const files = [...implFiles, ...testFiles];
const reviewFiles = [...implFiles, ...contextFiles, ...testFiles];
const code = reviewFiles.map((f) => `--- ${f} ---\n${rd(f)}`).join("\n\n");
const gateResult = rd("docs/runs/clotho-impl-slice-4a/gate-result.json");

const reviewText = [
  "=== v15 Task 4a — AUTHORITATIVE SCOPE (frozen; incl. AM-40 PACKAGE_ROOTS + AM-41 enforced source profile) ===", task4a,
  "\n=== v15 decision table (incl. D17/D21/D24/D26/D27/D29/D30/D32/D33; unchanged by AM-40/AM-41) ===", decisions,
  "\n=== v15 note: reuse merkle-dag vendor primitives + clotho/registry; the ONE D33 classifier/resolver in util is shared by BOTH the closure derivation and the (Task 5) advisory scanner (AM-34 test 19). Per AM-17 only git+code weaver inventories are committed at THIS PR. AM-41: the shared scanner is correct over a closed enforced source profile and FAILS CLOSED (unsupported-module-lexical-profile) on the exact out-of-profile set b1-b6, with one optional leading shebang admitted ===",
  "\n=== Deterministic TELOS gate result (verifier over real artifacts) ===", gateResult,
  "\n=== IMPLEMENTATION UNDER REVIEW (PR #117) ===", code
].join("\n");
const reviewRef = "sha256:" + sha256hex(canonicalize({ kind: "slice-review", body: reviewText }));

const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) { process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex"); EPHEMERAL_SIGNERS.push(m.toLowerCase()); }
}
const BUILD_ID = "clotho-task-4a-review";
const USE_CASE = "clotho-phase-1-task-4a";
const TIMESTAMP = new Date().toISOString();
const PR_HEAD = "0e73ca6982eb766761637f05fff87ebe133d6ab9";
const OBJECTIVE =
  `Review the Clotho Task 4a implementation (clotho/inventory.mjs, clotho/weavers/{util,git,code}.mjs, clotho/scripts/test-{closure,inventory,util,git,code}.mjs, PR #117, head ${PR_HEAD}) for FAITHFUL implementation strictly within frozen v15 Task 4a scope (v15 = v12 + AM-40 PACKAGE_ROOTS ruling + AM-41 enforced source-profile ruling). ` +
  `Authorized by The Eye's implementation decision (#109) against v15 (sha256:05a48700..., authz-008; extends authz-006), per-task cadence. The deterministic gate passed (finalStatus meets). ` +
  `Approve ONLY if the code implements Task 4a as written with NO reinterpretation and NO scope expansion: (a) the closed inventory commits exact sorted package roots, DOC_ROOTS + the docs/runs and self-weave exclusions, contract-files (D31), the five weaver ids + integer versions, the per-weaver REQUIRED_INVENTORY_IDS table EXACTLY equal to the frozen normative table (git->[package-files,package-symbols], code->[package-modules], test->[package-manifests,test-files], doc->[doc-files], ledger->[contract-files,ledger-sources,run-sources]) with a unit proving equality, and the exact frozen LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS mapping (D32, deep-frozen, keys exactly {module,node:module}, each value exactly ["builtinModules","isBuiltin"]) with deep-equal/deep-freeze/mutation units; (b) per D17/AM-17 ONLY the git and code weaver implementation-file closures are committed at this PR, and NO inventory names a nonexistent file; (c) util.mjs exports the ONE D33 module-load classifier + relative resolver used by BOTH the closure derivation and (future) advisory scanner (AM-34 test 19), a dependency-free comment/string-aware lexer + Phase-1 export scanner (export function|async function|const|class), the real-file walker rejecting root escape and symlinked input, the D26/D29 counted-iterator (count only on completed consumption; accounting only via the driver-held accessor), the D21 physical-containment helper (lstat every component, reject symlink components, never follow to decide containment), and the no-shell weaver-facing git wrapper permitting ONLY the exact subcommands/arg shapes; (d) test-closure.mjs derives each committed weaver closure with the SHARED classifier/resolver and proves the committed inventories EQUAL the derived closures (never trusted), covering every accepted form via a form-only fixture plus all fatal/no-edge failure modes; (e) git.mjs emits introduced-by via exactly \`git log -S<symbol> --format=%H --reverse -- <path>\` and \`git log --format=%H --reverse -- <path>\`, first result, git:<sha>, malformed output fatal, no-result warns; (f) code.mjs emits depends-on across all four endpoint shapes with symbol- vs file-level threading, unrepresentable-consumer ONLY for unresolvable specifiers, unused imports emit no edge, dedup. Zero runtime dependencies, ESM, node: stdlib + clotho-relative + permitted merkle-dag/vendor imports only; spine read-only. Reject or revise for genuine faithfulness/scope defects only. Note: the orchestrator inventory, atomic publication, the D34 re-derivation, and the test/doc/ledger weavers are LATER tasks (4b/5), not this PR.`;

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
  return { tool: `${model}_ask`, args: { prompt: `Objective:\n${OBJECTIVE}\n\n${FS}\n\n=== ARTIFACT UNDER REVIEW (${reviewRef}) ===\n\n${reviewText}`, system: `You are the ${model} seat on the TELOS implementation-review council. Judge whether the code faithfully implements v15 Task 4a within frozen scope. Approve only what you would stake your seat's signature on. ${FS}`, model, max_tokens: 60000, include_provenance: true, response_schema: model === "gemini" ? stripAP(PACKET_SCHEMA) : PACKET_SCHEMA, schema_name: "telos_review_packet" } };
}
const seats = [{ model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" }, { model: "grok", role: "advisory" }, { model: "gemini", role: "advisory" }];
const { client, close } = spawnMcpClient({ command: process.execPath, serverPath: path.join(ROOT, "connectors/ai-peer-mcp/server.mjs") });
const killer = setTimeout(() => { console.error("REVIEW_TIMEOUT"); process.exit(2); }, 1_800_000);
try {
  const callSeat = (s) => liveSeatCaller({ client, promptFor, parsePacket: (t) => parsePacket(t, s.model) })(s);
  const results = await runCouncil({ seats, callSeat, dossier });
  mkdirSync(HERE, { recursive: true });
  const summary = { build_id: BUILD_ID, use_case: USE_CASE, review_ref: reviewRef, pr: 117, pr_head: PR_HEAD, plan_ref: "sha256:f9368b5748de6c2670193558783b60b7f74fd94de9196c9664d42269f3d2bc04", authorization: "authz-006", timestamp: TIMESTAMP, trust_mode: "signed", ephemeral_signers: EPHEMERAL_SIGNERS, seats: [] };
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
  summary.acceptance = passed ? { status: "REVIEW_PASSED", note: "Task 4a passed required-seat review + gate; human acceptance remains." } : { status: "REVIEW_NOT_PASSED", note: "Fail-closed: see gate.blockers and seat decisions." };
  writeFileSync(path.join(HERE, "review-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ review_passed: passed, gate_status: gate.gate_status, blockers: gate.blockers.length, seats: summary.seats.map((s) => ({ model: s.model, ok: s.ok, decision: s.decision ?? null })) }, null, 2));
  process.exit(passed ? 0 : 3);
} catch (e) { console.error("REVIEW_ERROR: " + (e?.message || String(e))); process.exitCode = 1; }
finally { clearTimeout(killer); close(); }
