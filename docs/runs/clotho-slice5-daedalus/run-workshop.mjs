#!/usr/bin/env node
// Daedalus NEXT-PHASE workshop for Clotho slice 5 (the Iliad lifecycle's
// next-phase-evaluation step, The Eye's direction 2026-07-17): claude and codex
// maturely review the slice-5 IMPLEMENTATION APPROACH (approach-candidate.md)
// against the frozen Task 5 decisions. The plan v15 itself is FIXED — a plan
// defect found here escalates to The Eye; the workshop only matures the approach.
//
// Seats: claude + codex through connectors/ai-peer-mcp (direct module import,
// same wiring as docs/runs/clotho-daedalus-delta14). Real per-seat provenance
// required for convergence; terminal is submit-not-authorization.
//
// Usage:
//   node docs/runs/clotho-slice5-daedalus/run-workshop.mjs           # LIVE (spends budget)
//   node docs/runs/clotho-slice5-daedalus/run-workshop.mjs --smoke   # keyless wiring proof

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { runDaedalusWorkshop } = await imp("build-gate/daedalus.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const seatModule = await imp("connectors/ai-peer-mcp/server.mjs");

const SMOKE = process.argv.includes("--smoke");
const H = (v) => "sha256:" + sha256hex(canonicalize(v));

const draft = readFileSync(path.join(HERE, "approach-candidate.md"), "utf8");
const DECISIONS = readFileSync(path.join(ROOT, "clotho/memory/DECISIONS/task-5-decisions.md"), "utf8");
const v15 = readFileSync(path.join(ROOT, "docs/runs/clotho-daedalus-delta14/matured-plan-v15.md"), "utf8");
const task5 = v15.slice(v15.indexOf("## Task 5:"), v15.indexOf("## Task 6:"));
const INTERFACES = task5.slice(0, task5.indexOf("**The `coverage` field"));

const VERIFY_SPEC = [
  "# FROZEN TASK 5 DECISIONS (the approach must satisfy these; they are NOT reviewable)",
  DECISIONS,
  "\n# FROZEN TASK 5 INTERFACES (from plan v15 — the full 36KB clause at docs/runs/clotho-daedalus-delta14/matured-plan-v15.md is the implementation's normative text)",
  INTERFACES
].join("\n");

// ---------- injected artifact store + event log ----------
const ARTIFACTS = path.join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });
function writeArtifact(value) {
  const ref = H(value);
  writeFileSync(path.join(ARTIFACTS, ref.replace(/^sha256:/, "") + ".json"), JSON.stringify(value, null, 2));
  return { ref };
}
const EVENTS = path.join(HERE, "events.jsonl");
async function appendEvent(event) {
  appendFileSync(EVENTS, JSON.stringify({ ...event, at: new Date().toISOString() }) + "\n");
}

// ---------- seat response schema ----------
const SEAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan_revision: { type: "string", description: "The COMPLETE revised approach markdown, or empty string to keep the candidate byte-identical." },
    objections: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          scope: { type: "string", description: "Approach section or mechanism." },
          claim: { type: "string", description: "The specific defect: what is wrong and why it matters." }
        },
        required: ["scope", "claim"]
      }
    },
    dispositions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          objection_hash: { type: "string", description: "A hash from the open-objection menu. Only hashes YOUR seat raised." },
          action: { type: "string", enum: ["resolved", "superseded", "withdrawn"] },
          note: { type: "string", description: "Why this disposition is justified by the current candidate." }
        },
        required: ["objection_hash", "action", "note"]
      }
    }
  },
  required: ["plan_revision", "objections", "dispositions"]
};

function seatPrompt({ role, candidateBody, openMenu, seat }) {
  const menu = openMenu.length
    ? openMenu.map((o) => `- ${o.objection_hash} (raised by ${o.raised_by_seat}): [${o.scope}] ${o.claim}`).join("\n")
    : "(none)";
  const roleBrief = role === "author"
    ? "You are the AUTHOR this round. The candidate is the slice-5 IMPLEMENTATION APPROACH (sequencing, concurrency, oracles, risks) for the frozen Task 5. Improve it only where it genuinely conflicts with the frozen decisions/interfaces, is unsafe, or leaves a listed risk unresolved. Answer the candidate's R1-R3 risk questions explicitly (in the revised text) if you can settle them from the frozen material. If the approach is sound as-is, return plan_revision as an EMPTY STRING."
    : "You are the REVIEWER this round. Hunt real defects in the APPROACH: a step that violates a frozen decision (D35/AM-37 coverage schema, D34/AM-38 re-derivation+abort, D10/AM-39 attribution, D26/D29 counted accounting, D19/AM-20 close equality, D28 atomic publish, AM-41 shebang), a concurrency choice that breaks counted accounting or determinism, a missing failure-window case, an oracle that would not discriminate. If sound, return plan_revision as an EMPTY STRING (binding your approval to the author's exact artifact).";
  return [
    roleBrief,
    "",
    "=== THE FROZEN MATERIAL THE APPROACH MUST SATISFY ===",
    VERIFY_SPEC,
    "",
    "Rules of the workshop:",
    "- The PLAN IS FIXED (v15, authz-008). You review the APPROACH, never the plan. A genuine plan defect is an objection with scope 'plan-escalation' — it routes to The Eye, not into a rewrite.",
    "- Raise objections ONLY for real defects. Each objection: {scope, claim}. Do not re-raise anything on the open menu.",
    "- Dispositions: retire ONLY objections YOUR seat raised, by menu hash, only when genuinely addressed/superseded/mistaken.",
    "- Convergence requires zero open objections AND the reviewer binding the author's exact artifact.",
    "- Repo constraints are non-negotiable: Node >=18, ESM, ZERO runtime dependencies, spine read-only, closed sets, fail-closed, advisory-only posture.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE (slice-5 implementation approach) ===",
    candidateBody
  ].join("\n");
}

// ---------- live seats ----------
async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation engineer in the Daedalus next-phase workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion; the approach text is the only deliverable. The frozen plan is not reviewable here.",
    model: seat,
    effort: "high",
    max_tokens: 30000,
    response_schema: SEAT_SCHEMA,
    schema_name: "daedalus_seat_response"
  });
  let parsed;
  try { parsed = JSON.parse(r.text); }
  catch (e) {
    writeFileSync(path.join(HERE, `unparsable-${seat}-${Date.now()}.txt`), r.text ?? "");
    throw new Error(`Seat ${seat} returned unparsable JSON (saved): ${e.message}`);
  }
  return {
    plan_revision: typeof parsed.plan_revision === "string" ? parsed.plan_revision : "",
    objections: Array.isArray(parsed.objections) ? parsed.objections : [],
    dispositions: Array.isArray(parsed.dispositions) ? parsed.dispositions : [],
    provenance: { provider, model: r.model, response_id: r.id, source: `ai-peer-mcp/${seat === "claude" ? "claude_ask" : "codex_ask"}` }
  };
}

// ---------- smoke seats (keyless wiring proof) ----------
function makeSmokeCallSeat() {
  let calls = 0;
  return async ({ seat, openMenu, candidateBody }) => {
    calls++;
    const provenance = { provider: seat === "claude" ? "anthropic" : "openai", model: "smoke", response_id: `smoke_${seat}_${calls}`, source: "smoke" };
    if (calls === 1) return { plan_revision: candidateBody + "\n<!-- smoke r1 -->", objections: [{ scope: "smoke", claim: "smoke objection" }], dispositions: [], provenance };
    if (calls === 2) return { plan_revision: "", objections: [], dispositions: [], provenance };
    if (calls === 3) return { plan_revision: "", objections: [], dispositions: [], provenance };
    return { plan_revision: "", objections: [], dispositions: openMenu.filter((o) => o.raised_by_seat === seat).map((o) => ({ objection_hash: o.objection_hash, action: "resolved", note: "smoke resolved" })), provenance };
  };
}

// ---------- run ----------
const callSeat = SMOKE ? makeSmokeCallSeat() : liveCallSeat;
const result = await runDaedalusWorkshop({ draft, callSeat, writeArtifact, appendEvent });

const summary = {
  run: "clotho-slice5-daedalus (next-phase evaluation, Iliad lifecycle)",
  mode: SMOKE ? "smoke" : "live",
  state: result.state,
  reason: result.reason,
  terminal: result.terminal ?? null,
  rounds: result.rounds.length,
  final_candidate_ref: result.final_candidate_ref,
  open_objections: result.rounds.length ? undefined : [],
  creation_lineage: result.creation_lineage.map((l) => ({ seat: l.seat, round: l.round, provider: l.provenance?.provider, model: l.provenance?.model, response_id: l.provenance?.response_id }))
};
writeFileSync(path.join(HERE, "result.json"), JSON.stringify(summary, null, 2));

// Persist the matured approach when the workshop converged.
if (result.state === "converged-for-submission") {
  const ref = result.final_candidate_ref.replace(/^sha256:/, "");
  const art = JSON.parse(readFileSync(path.join(ARTIFACTS, ref + ".json"), "utf8"));
  writeFileSync(path.join(HERE, "matured-approach.md"), art.plan);
}
console.log(JSON.stringify(summary, null, 2));
process.exit(result.state === "converged-for-submission" ? 0 : 3);
