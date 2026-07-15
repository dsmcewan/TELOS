#!/usr/bin/env node
// Daedalus DELTA workshop: integrate the normative amendments (AM-30..AM-31) into
// the previously converged Clotho Phase 1 plan, under spec v2 — which is
// CHALLENGEABLE this time (process rule: a governing specification is normative,
// not immune from challenge).
//
// Seats: claude (claude-fable-5, effort max) and codex (gpt-5.6-sol, xhigh)
// through connectors/ai-peer-mcp — real per-seat provenance required for
// convergence.
//
// Usage:
//   node docs/runs/clotho-daedalus-delta8/run-daedalus-delta8.mjs           # live
//   node docs/runs/clotho-daedalus-delta8/run-daedalus-delta8.mjs --smoke   # keyless wiring proof
//
// Outputs (under this directory): artifacts/<hash>.json, events.jsonl,
// result.json, matured-plan-v9.md (final candidate).

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { runDaedalusWorkshop, objectionLedgerFrom } = await imp("build-gate/daedalus.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const seatModule = await imp("connectors/ai-peer-mcp/server.mjs");

const SMOKE = process.argv.includes("--smoke");
const H = (v) => "sha256:" + sha256hex(canonicalize(v));

// ---------- draft: matured plan + amendments; spec v2 as CHALLENGEABLE appendix ----------
const MATURED = readFileSync(path.join(ROOT, "docs/runs/clotho-daedalus-delta7/matured-plan-v8.md"), "utf8");
const AMENDMENTS = readFileSync(path.join(ROOT, "docs/clotho-phase-1-plan-amendments-8.md"), "utf8");
const SPEC_V2 = readFileSync(path.join(ROOT, "docs/clotho-phase-1-design.md"), "utf8");
const draft = [
  MATURED,
  "\n\n---\n\n# NORMATIVE AMENDMENTS TO INTEGRATE (AM-30..AM-31)\n",
  AMENDMENTS,
  "\n\n---\n\n# Appendix: governing spec v2.6 (CHALLENGEABLE — see workshop rules)\n",
  SPEC_V2
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
    plan_revision: {
      type: "string",
      description: "The COMPLETE revised plan markdown (amendments integrated; any accepted spec-amendment proposals listed in a final 'Proposed spec amendments' section), or empty string to keep the candidate byte-identical."
    },
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scope: { type: "string", description: "Plan section or mechanism; prefix with 'spec:' when the objection targets the governing spec." },
          claim: { type: "string", description: "The specific defect: what is wrong and why it matters. For spec: objections, include the proposed replacement text." }
        },
        required: ["scope", "claim"]
      }
    },
    dispositions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
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
    ? "You are the AUTHOR this round. This is a DELTA workshop: the candidate contains an already-converged plan followed by NORMATIVE AMENDMENTS AM-30..AM-31. Integrate every amendment into the plan body (a single coherent implementation-ready plan; delete the amendment appendix once integrated), keeping every already-converged mechanism that the amendments reaffirm. Produce the COMPLETE revised plan in plan_revision. If you make no changes, return plan_revision as an empty string."
    : "You are the REVIEWER this round. Review the exact candidate below: are all amendments AM-30..AM-31 faithfully integrated without regressing the converged mechanisms? If it is ready as-is, return plan_revision as an EMPTY STRING (this binds your approval to the author's exact artifact — required for convergence). Only include a non-empty plan_revision if a defect genuinely requires changing the text.";
  return [
    roleBrief,
    "",
    "Rules of the workshop:",
    "- Amendment REQUIREMENTS are fixed (The Eye decided them); you may object to an amendment's MECHANISM and integrate a better one, never drop the requirement.",
    "- THE GOVERNING SPEC IS CHALLENGEABLE: a governing specification is normative, not immune from challenge. If the spec (appendix) contains a defect, raise an objection with scope prefixed 'spec:' and include proposed replacement text in the claim; collect accepted spec proposals in a final 'Proposed spec amendments' section of plan_revision for The Eye. Do NOT design around a spec mistake.",
    "- Raise objections ONLY for real defects. Each objection: {scope, claim}. Do not re-raise anything already on the open menu.",
    "- Dispositions: you may retire ONLY objections YOUR seat raised, by their menu hash, and only when the current candidate actually addresses them (resolved), a new objection replaces them (superseded), or they were mistaken (withdrawn).",
    "- Convergence requires zero open objections AND the reviewer binding the author's exact artifact.",
    "- Repo constraints are non-negotiable: Node >=18, ESM, ZERO runtime dependencies, spine read-only (no package may import from clotho/), closed sets, fail-closed, advisory-only posture.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE (converged plan + amendments to integrate + challengeable spec appendix) ===",
    candidateBody
  ].join("\n");
}

// ---------- live seats ----------
async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation-plan engineer in the Daedalus delta workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion; the plan text is the only deliverable.",
    model: seat,
    // Surgical three-amendment delta: high effort (The Eye, after the quota
    // exhaustion) — the heavy reasoning happened in earlier rounds.
    effort: "high",
    max_tokens: 60000,
    response_schema: SEAT_SCHEMA,
    schema_name: "daedalus_seat_response"
  });
  let parsed;
  try {
    parsed = JSON.parse(r.text);
  } catch (e) {
    writeFileSync(path.join(HERE, `unparsable-${seat}-${Date.now()}.txt`), r.text ?? "");
    throw new Error(`Seat ${seat} returned unparsable JSON (saved for inspection): ${e.message}`);
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
if (!SMOKE) {
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    if (!process.env[key]) {
      console.error(`Missing ${key}. Set both seat keys in the environment, or run with --smoke.`);
      process.exit(1);
    }
  }
}

const callSeat = SMOKE ? makeSmokeCallSeat() : liveCallSeat;
console.log(`Daedalus DELTA-8 workshop — ${SMOKE ? "SMOKE (stub seats)" : "LIVE (fable-5/high + gpt-5.6-sol/high)"}`);

const result = await runDaedalusWorkshop({ draft, callSeat, writeArtifact, appendEvent });

const summary = {
  mode: SMOKE ? "smoke" : "live",
  state: result.state,
  reason: result.reason,
  terminal: result.terminal ?? null,
  rounds: result.rounds.length,
  final_candidate_ref: result.final_candidate_ref,
  unresolved_objections: [...objectionLedgerFrom(result.rounds)]
    .filter(([, e]) => e.status === "open").map(([h, e]) => ({ hash: h, scope: e.objection.scope, claim: e.objection.claim })),
  creation_lineage: result.creation_lineage.map((l) => ({ seat: l.seat, round: l.round, provenance: l.provenance }))
};
writeFileSync(path.join(HERE, "result.json"), JSON.stringify(summary, null, 2));

const finalFile = path.join(ARTIFACTS, String(result.final_candidate_ref).replace(/^sha256:/, "") + ".json");
try {
  const finalArtifact = JSON.parse(readFileSync(finalFile, "utf8"));
  if (typeof finalArtifact.plan === "string") writeFileSync(path.join(HERE, "matured-plan-v9.md"), finalArtifact.plan);
} catch { /* result.json still records the ref */ }

console.log(`state=${summary.state} reason=${summary.reason} rounds=${summary.rounds}`);
console.log(`final_candidate_ref=${summary.final_candidate_ref}`);
if (summary.unresolved_objections.length) console.log(`UNRESOLVED: ${summary.unresolved_objections.length}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, matured-plan-v9.md, events.jsonl, artifacts/}`);
if (summary.state !== "converged-for-submission") process.exit(2);
