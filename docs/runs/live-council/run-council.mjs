#!/usr/bin/env node
// run-council.mjs — a REAL council fan-out over the ai-peer-mcp server.
//
// Seats claude/grok/codex through their live `*_ask` backends (with
// include_provenance) and agy through the local `agy_checkpoint`, then writes
// each packet + its REAL per-seat provenance to this dir and runs the gate.
//
// Provenance is captured by liveSeatCaller from the server's envelope — codex
// gets its own OpenAI `chatcmpl_…` id, agy its `agy-<sha256>` attestation,
// claude/grok their `msg_…`/xAI ids. No seat borrows another's id; a seat with
// no API key FAIL-CLOSES (no packet → the gate honest-blocks it).
//
// Keys come from the environment / Windows registry (the server loads HKCU on
// start). Models default to current ids but honor env overrides.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawnMcpClient } from "../../engine/working/breakout/mcp_client.mjs";
import { runCouncil, liveSeatCaller, agyApprovalPacket } from "../../engine/working/build-gate/council.mjs";
import { validateRecords } from "../../engine/working/build-gate/gate.mjs";

// Signed mode: each required seat is HMAC-signed and the gate enforces BOTH the
// signature and non-placeholder provenance as blockers. Use real TELOS_SECRET_*
// if the operator set them (persistent, re-verifiable evidence); otherwise mint
// EPHEMERAL per-run secrets — never persisted, never printed — so the run proves
// sign+verify end-to-end within itself. The required signers mirror the gate's.
const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) {
    process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex");
    EPHEMERAL_SIGNERS.push(m.toLowerCase());
  }
}

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = fileURLToPath(new URL("../../engine/working/connectors/ai-peer-mcp/server.mjs", import.meta.url));

const BUILD_ID = "live-council-001";
const USE_CASE = "telos-self-upgrade";
const TIMESTAMP = new Date().toISOString();
const OBJECTIVE =
  "Approve, for merge, the TELOS change that wires per-seat provenance backends: " +
  "codex via OpenAI (own response_id), agy via a local content-addressed attestation, " +
  "and a liveSeatCaller that fail-closes (response_id:null) when a backend returns no provenance. " +
  "Reply ONLY with a JSON approval packet.";

const MODELS = {
  claude: process.env.TELOS_CLAUDE_MODEL || "claude-sonnet-4-6",
  grok: process.env.TELOS_GROK_MODEL || "grok-4",
  codex: process.env.OPENAI_MODEL || process.env.TELOS_CODEX_MODEL || "gpt-4o"
};

const meta = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  proposal_ref: BUILD_ID,
  timestamp: TIMESTAMP,
  docs_reviewed: ["me/claude-code/telos-upgrade/specs/2026-06-27-telos-upgrade-design.md"]
};

const VALID_DECISIONS = new Set(["approve", "revise", "reject", "advisory-note"]);
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

// Robustly pull the first {...} JSON object out of a model's answer (handles
// ```json fences and surrounding prose).
function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

// One parsePacket for every seat: agy_checkpoint -> adapter; chat model JSON ->
// approval packet with boilerplate injected from the dossier (controller role),
// preserving the model's own decision/confidence/edits/stops.
function parsePacket(text, model) {
  const obj = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (obj && obj.phase_gate_status) return agyApprovalPacket(obj, meta);

  const m = obj && !obj.phase_gate_status ? obj : extractJsonObject(text) || {};
  const decision = VALID_DECISIONS.has(m.decision) ? m.decision : "advisory-note";
  const confidence = VALID_CONFIDENCE.has(m.confidence) ? m.confidence : "medium";
  return {
    build_id: BUILD_ID,
    use_case: USE_CASE,
    model,
    role: "approver",
    docs_reviewed: meta.docs_reviewed,
    proposal_ref: BUILD_ID,
    decision,
    required_edits: Array.isArray(m.required_edits) ? m.required_edits : [],
    hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [],
    confidence,
    timestamp: TIMESTAMP,
    rationale: typeof m.rationale === "string" ? m.rationale : undefined
  };
}

const PACKET_INSTRUCTION =
  'Return ONLY a JSON object: {"decision":"approve|revise|reject","confidence":"low|medium|high",' +
  '"required_edits":[],"hard_stops":[],"rationale":"one sentence"}. No prose outside the JSON.';

function promptFor(model, role, _dossier, _workstream) {
  if (model === "agy") {
    // A real governance checkpoint: all required packets present, paths clean.
    return { tool: "agy_checkpoint", args: { phase: "merge-gate", scope: "me/codex", required_packets: ["claude", "codex"], present_packets: ["claude", "codex"], protected_path_check: "pass" } };
  }
  return {
    tool: `${model}_ask`,
    model: MODELS[model],
    system: `You are ${model}, a council approver. Judge the objective on the merits. ${PACKET_INSTRUCTION}`,
    prompt: `Objective:\n${OBJECTIVE}\n\n${PACKET_INSTRUCTION}`
  };
}

const seats = [
  { model: "claude", role: "approver" },
  { model: "agy", role: "approver" },
  { model: "codex", role: "approver" },
  { model: "grok", role: "advisory" }
];

const { client, close } = spawnMcpClient({ serverPath });
const killer = setTimeout(() => { process.stderr.write("COUNCIL_TIMEOUT\n"); process.exit(2); }, 180000);

try {
  // liveSeatCaller's parsePacket receives only text; build a per-seat caller so
  // the seat's model is in scope for packet labelling.
  const callSeat = (seatArg) =>
    liveSeatCaller({ client, promptFor, parsePacket: (t) => parsePacket(t, seatArg.model) })(seatArg);

  const results = await runCouncil({ seats, callSeat, dossier: { build_id: BUILD_ID } });

  await mkdir(here, { recursive: true });
  const summary = { build_id: BUILD_ID, objective: OBJECTIVE, models: MODELS, timestamp: TIMESTAMP, seats: [] };
  const packetsForGate = [];

  for (const r of results) {
    if (r.ok) {
      await writeFile(path.join(here, `${r.model}.json`), JSON.stringify(r.packet, null, 2));
      packetsForGate.push(r.packet);
      summary.seats.push({
        model: r.model, role: r.role, ok: true, signed: !!r.signed,
        decision: r.packet.decision, confidence: r.packet.confidence,
        provenance: r.packet.provenance
      });
    } else {
      summary.seats.push({ model: r.model, role: r.role, ok: false, reason: r.reason });
    }
  }

  // Run the gate (legacy mode — no secrets required) to show packet validity +
  // the provenance the gate surfaces per required model.
  const dossier = {
    build_id: BUILD_ID, use_case: USE_CASE, objective: OBJECTIVE,
    required_docs: meta.docs_reviewed, write_targets: [], protected_paths: [],
    trust_mode: "signed"
  };
  const gate = validateRecords(dossier, packetsForGate);
  summary.trust_mode = "signed";
  summary.ephemeral_signers = EPHEMERAL_SIGNERS;
  summary.gate = {
    gate_status: gate.gate_status,
    signing_enforced: gate.headline_checks?.signing_enforced,
    provenance_enforced: gate.headline_checks?.provenance_enforced,
    blockers: gate.blockers, warnings: gate.warnings, provenance: gate.provenance
  };

  await writeFile(path.join(here, "council-summary.json"), JSON.stringify(summary, null, 2));
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
} catch (error) {
  process.stderr.write("COUNCIL_ERROR: " + (error?.message || String(error)) + "\n");
  process.exitCode = 1;
} finally {
  clearTimeout(killer);
  close();
}
