#!/usr/bin/env node
// Live Daedalus workshop over the Clotho Phase 1 plan skeleton.
//
// Seats: claude (claude-fable-5, effort max) and codex (gpt-5.6-sol, effort max)
// through connectors/ai-peer-mcp — real per-seat provenance (provider:response_id),
// which deriveWorkshopState requires for convergence.
//
// Usage:
//   node docs/runs/clotho-daedalus/run-daedalus.mjs           # live (needs ANTHROPIC_API_KEY + OPENAI_API_KEY)
//   node docs/runs/clotho-daedalus/run-daedalus.mjs --smoke   # keyless wiring proof (stub seats)
//
// Outputs (under this directory): artifacts/<hash>.json (content-addressed),
// events.jsonl, result.json, matured-plan.md (the final candidate body).

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Max-effort seats can generate for many minutes; opt into the patient transport
// BEFORE the seat module is used (doFetch reads this per call).
process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");

// pathToFileURL: Windows ESM rejects bare absolute paths in dynamic import().
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { runDaedalusWorkshop, objectionLedgerFrom } = await imp("build-gate/daedalus.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
// Import the seat module eagerly: on win32 its loadWin32Env() pulls the API keys
// from HKCU\Environment into process.env BEFORE the key guard below runs.
const seatModule = await imp("connectors/ai-peer-mcp/server.mjs");

const SMOKE = process.argv.includes("--smoke");
const H = (v) => "sha256:" + sha256hex(canonicalize(v));

// ---------- draft: spec + plan skeleton, verbatim ----------
const SPEC = readFileSync(path.join(ROOT, "docs/clotho-phase-1-design.md"), "utf8");
const PLAN = readFileSync(path.join(ROOT, "docs/clotho-phase-1-plan.md"), "utf8");
const draft = `${PLAN}\n\n---\n\n# Appendix: governing spec (context, do not rewrite)\n\n${SPEC}`;

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

// ---------- seat response schema (strict-mode compatible: all required) ----------
const SEAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan_revision: {
      type: "string",
      description: "The COMPLETE revised plan markdown, or empty string to keep the candidate byte-identical."
    },
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scope: { type: "string", description: "The plan section or mechanism the objection targets." },
          claim: { type: "string", description: "The specific defect: what is wrong and why it matters." }
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
    ? "You are the AUTHOR this round. Mature the candidate plan: resolve open questions with concrete decisions, tighten task boundaries, add missing steps/tests, and produce the COMPLETE revised plan in plan_revision. If you make no changes, return plan_revision as an empty string."
    : "You are the REVIEWER this round. Review the exact candidate below. If it is ready as-is, return plan_revision as an EMPTY STRING (this binds your approval to the author's exact artifact — required for convergence). Only include a non-empty plan_revision if a defect genuinely requires changing the text.";
  return [
    roleBrief,
    "",
    "Rules of the workshop:",
    "- Raise objections ONLY for real defects (wrong invariant, missing failure mode, untestable step, violated repo constraint). Each objection: {scope, claim}. Do not re-raise anything already on the open menu.",
    "- Dispositions: you may retire ONLY objections YOUR seat raised, by their menu hash, and only when the current candidate actually addresses them (action resolved), a new objection replaces them (superseded), or they were mistaken (withdrawn).",
    "- Convergence requires zero open objections AND the reviewer binding the author's exact artifact — do not hold objections open rhetorically, and do not retire them without justification.",
    "- Repo constraints are non-negotiable: Node >=18, ESM, ZERO runtime dependencies, spine read-only (no package may import from clotho/), closed sets, fail-closed, advisory-only posture.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE PLAN ===",
    candidateBody
  ].join("\n");
}

// ---------- live seats ----------
async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation-plan engineer in the Daedalus workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion; the plan text is the only deliverable.",
    model: seat, // bare seat name -> mapModelName -> claude-fable-5 / gpt-5.6-sol
    max_tokens: 60000, // deep-effort seats think against this budget; plan bodies are large
    response_schema: SEAT_SCHEMA,
    schema_name: "daedalus_seat_response"
  });
  let parsed;
  try {
    parsed = JSON.parse(r.text);
  } catch (e) {
    // Fail closed: an unparsable seat response is a failed round, not fabricated content.
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

// ---------- smoke seats (keyless wiring proof; NOT evidence of a real workshop) ----------
function makeSmokeCallSeat() {
  let calls = 0;
  return async ({ seat, role, candidateBody, openMenu }) => {
    calls++;
    const provenance = { provider: seat === "claude" ? "anthropic" : "openai", model: "smoke", response_id: `smoke_${seat}_${calls}`, source: "smoke" };
    if (calls === 1) {
      // Round 1 author: revises, raises one objection.
      return { plan_revision: candidateBody + "\n<!-- smoke: authored r1 -->", objections: [{ scope: "smoke", claim: "smoke objection" }], dispositions: [], provenance };
    }
    if (calls === 2) {
      // Round 1 reviewer: binds the author's artifact (empty revision), no new objections.
      return { plan_revision: "", objections: [], dispositions: [], provenance };
    }
    if (calls === 3) {
      // Round 2 author is codex — it may NOT retire claude's objection.
      return { plan_revision: "", objections: [], dispositions: [], provenance };
    }
    // Round 2 reviewer is claude: retires ITS OWN objection and binds -> converged.
    return { plan_revision: "", objections: [], dispositions: openMenu.filter((o) => o.raised_by_seat === seat).map((o) => ({ objection_hash: o.objection_hash, action: "resolved", note: "smoke resolved" })), provenance };
  };
}

// ---------- run ----------
if (!SMOKE) {
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    if (!process.env[key]) {
      console.error(`Missing ${key}. Set both seat keys in the environment, or run with --smoke for a keyless wiring proof.`);
      process.exit(1);
    }
  }
}

const callSeat = SMOKE ? makeSmokeCallSeat() : liveCallSeat;
console.log(`Daedalus workshop over Clotho Phase 1 plan — ${SMOKE ? "SMOKE (stub seats)" : "LIVE (fable-5/max + gpt-5.6-sol/max)"}`);

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

// Extract the final candidate body for human review.
const finalFile = path.join(ARTIFACTS, String(result.final_candidate_ref).replace(/^sha256:/, "") + ".json");
try {
  const finalArtifact = JSON.parse(readFileSync(finalFile, "utf8"));
  if (typeof finalArtifact.plan === "string") writeFileSync(path.join(HERE, "matured-plan.md"), finalArtifact.plan);
} catch { /* final ref may be the initial draft in degenerate runs; result.json still records it */ }

console.log(`state=${summary.state} reason=${summary.reason} rounds=${summary.rounds}`);
console.log(`final_candidate_ref=${summary.final_candidate_ref}`);
if (summary.unresolved_objections.length) console.log(`UNRESOLVED: ${summary.unresolved_objections.length}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, matured-plan.md, events.jsonl, artifacts/}`);
if (summary.state !== "converged-for-submission") process.exit(2);
