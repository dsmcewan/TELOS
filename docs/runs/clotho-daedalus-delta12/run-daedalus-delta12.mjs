#!/usr/bin/env node
// Daedalus DELTA-12 workshop: integrate the narrow normative amendment AM-40
// (The Eye's PACKAGE_ROOTS scope ruling) into the converged Clotho Phase 1 plan
// v12, producing candidate v13. The HUMAN SCOPE RULING is FIXED; the workshop
// integrates it faithfully with cold review, changing nothing else.
//
// Seats: claude (claude-fable-5) and codex (gpt-5.6-sol) through
// connectors/ai-peer-mcp — real per-seat provenance required for convergence.
//
// Frozen inputs:
//   docs/runs/clotho-daedalus-delta11/matured-plan-v12.md   (v12, sha256:bdc93901…)
//   docs/clotho-phase-1-plan-amendments-12.md               (AM-40 — PACKAGE_ROOTS ruling)
//
// Usage:
//   node docs/runs/clotho-daedalus-delta12/run-daedalus-delta12.mjs           # LIVE (spends budget)
//   node docs/runs/clotho-daedalus-delta12/run-daedalus-delta12.mjs --smoke   # keyless wiring proof
//
// Outputs (under this directory): artifacts/<hash>.json, events.jsonl,
// result.json, matured-plan-v13.md (final candidate).

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

// ---------- draft: v12 with AM-40 ALREADY deterministically integrated (v13) ----------
// The candidate handed to the workshop is v12 with The Eye's AM-40 ruling woven
// into the Task 4a inventory clause and the inventory.mjs file-description row (a
// precise, byte-verified two-point edit vs v12 — see the diff in this delta's
// evidence). The seats VERIFY the integration against AM-40 and bind it, rather
// than reproducing the ~168KB plan from scratch. AM-40 + The Eye's directives ride
// in the prompt as the verification spec (not in the candidate body).
const MATURED_V13 = readFileSync(path.join(HERE, "v13-candidate-input.md"), "utf8");
const AMENDMENT = readFileSync(path.join(ROOT, "docs/clotho-phase-1-plan-amendments-12.md"), "utf8");

const EYE_DIRECTIVES = [
  "# THE EYE'S MATURATION DIRECTIVES (delta-12) — FIXED, NON-CHALLENGEABLE",
  "",
  "## Mandatory outcome — v13 must apply AM-40 WITHOUT DILUTION",
  "- PACKAGE_ROOTS is EXACTLY the five TELOS-spine packages: breakout, build-gate,",
  "  clotho, connectors/ai-peer-mcp, merkle-dag.",
  "- PACKAGE_ROOTS_EXCLUDE is EXACTLY the three products: ai-forge, forge, saas-forge.",
  "- A unit mechanically discovers every tracked package.json directory and requires",
  "  discovered == PACKAGE_ROOTS ∪ PACKAGE_ROOTS_EXCLUDE and PACKAGE_ROOTS ∩",
  "  PACKAGE_ROOTS_EXCLUDE == ∅ — nothing silently omitted, membership cannot drift.",
  "- The three products are DEFERRED, to be consciously enrolled later at the",
  "  system-of-systems umbrella (the Iliad), not absorbed into the Phase 1 self-weave.",
  "",
  "## The ruling is FIXED; only its integration MECHANISM is in scope",
  "You may improve HOW AM-40 is woven into the Task 4a inventory clause and the",
  "inventory.mjs file description, never WHAT it decides. Do not re-open the all-eight",
  "reading — The Eye closed it.",
  "",
  "## HARD GUARDS — the workshop MUST NOT:",
  "- widen/narrow PACKAGE_ROOTS beyond the five spine packages, change the exclusion",
  "  set, or weaken the completeness/disjointness contract;",
  "- reintroduce any descoped claim (loader isolation proven, containment, sandbox,",
  "  capability boundary) — the AM-35..AM-39 advisory / non-sandbox posture stands;",
  "- alter any OTHER frozen decision (D17/AM-17, D24/D26/D31, D32, D33, zero-dep,",
  "  spine-read-only) — AM-40 is narrow;",
  "- modify any prior authorization or Daedalus evidence (deltas 1-11 and v12 are",
  "  read-only history);",
  "- describe provider provenance as an HMAC signature;",
  "- start or resume implementation, convene the re-authorization, or open Argo."
].join("\n");

const draft = MATURED_V13;
// The verification spec the seats hold the candidate against (prompt-side only).
const VERIFY_SPEC = [
  "# NORMATIVE AMENDMENT THE CANDIDATE MUST ALREADY SATISFY (AM-40 — The Eye's PACKAGE_ROOTS scope ruling)",
  "",
  AMENDMENT,
  "\n\n---\n\n",
  EYE_DIRECTIVES
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
      description: "The COMPLETE revised plan markdown (AM-40 integrated into the Task 4a inventory clause + inventory.mjs file description; the amendment appendix and directives deleted once integrated), or empty string to keep the candidate byte-identical."
    },
    objections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          scope: { type: "string", description: "Plan section or mechanism." },
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
    ? "You are the AUTHOR this round. This is a NARROW DELTA workshop. The candidate below is the converged plan v12 with The Eye's AM-40 ruling ALREADY integrated (a precise two-point edit: the Task 4a inventory clause and the `clotho/inventory.mjs` file-description row). Your job is to VERIFY the integration is faithful, complete, and narrow (AM-40 satisfied exactly; nothing else in the plan changed; no hard guard breached). If it is correct, return plan_revision as an EMPTY STRING (keep the candidate byte-identical). Only return a non-empty plan_revision — the COMPLETE revised plan — if you find a genuine integration defect that requires a text change."
    : "You are the REVIEWER this round. The candidate below is v12 with AM-40 already integrated. Verify: PACKAGE_ROOTS is exactly the five spine packages; PACKAGE_ROOTS_EXCLUDE is exactly the three products; the discover-all/union/disjoint completeness contract is present; the Iliad deferral is stated; NO other plan text changed; no hard-guard violation. If it is correct as-is, return plan_revision as an EMPTY STRING (this binds your approval to the author's exact artifact — required for convergence). Only raise an objection or return a non-empty plan_revision for a genuine defect.";
  return [
    roleBrief,
    "",
    "=== THE RULING THE CANDIDATE MUST ALREADY SATISFY (verify against this) ===",
    VERIFY_SPEC,
    "",
    "Rules of the workshop:",
    "- The AM-40 REQUIREMENT is fixed (The Eye decided it): PACKAGE_ROOTS is the five TELOS-spine packages; the three forge products are an explicit committed exclusion; a unit discovers every package.json dir and proves discovered == ROOTS ∪ EXCLUDE and ROOTS ∩ EXCLUDE == ∅. You may improve the integration MECHANISM/wording, never the decision.",
    "- THE HUMAN SCOPE RULING IS FIXED AND NON-CHALLENGEABLE: do NOT re-open the all-eight reading; do NOT widen/narrow PACKAGE_ROOTS or change the exclusion set or weaken the completeness/disjointness contract.",
    "- HARD GUARDS (non-negotiable): do NOT reintroduce any descoped claim (loader isolation proven, containment, capability boundary, sandbox); do NOT alter any OTHER frozen decision (D17/AM-17, D24/D26/D31, D32, D33, zero-dep, spine-read-only); do NOT modify prior authorizations or Daedalus evidence; do NOT describe provenance as an HMAC signature; do NOT start/resume implementation, convene the re-authorization, or open Argo.",
    "- Raise objections ONLY for real defects in the INTEGRATION (faithfulness of AM-40, an accidental change elsewhere, a hard-guard breach). Each objection: {scope, claim}. Do not re-raise anything already on the open menu.",
    "- Dispositions: you may retire ONLY objections YOUR seat raised, by their menu hash, and only when the current candidate actually addresses them (resolved), a new objection replaces them (superseded), or they were mistaken (withdrawn).",
    "- Convergence requires zero open objections AND the reviewer binding the author's exact artifact.",
    "- Repo constraints are non-negotiable: Node >=18, ESM, ZERO runtime dependencies, spine read-only, closed sets, fail-closed, advisory-only posture.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE (v12 with AM-40 already integrated — verify against the ruling above) ===",
    candidateBody
  ].join("\n");
}

// ---------- live seats ----------
async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation-plan engineer in the Daedalus delta workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion; the plan text is the only deliverable. Honor The Eye's fixed scope ruling and hard guards exactly.",
    model: seat,
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
console.log(`Daedalus DELTA-12 workshop — ${SMOKE ? "SMOKE (stub seats)" : "LIVE (fable-5/high + gpt-5.6-sol/high)"}`);

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
  if (typeof finalArtifact.plan === "string") writeFileSync(path.join(HERE, "matured-plan-v13.md"), finalArtifact.plan);
} catch { /* result.json still records the ref */ }

console.log(`state=${summary.state} reason=${summary.reason} rounds=${summary.rounds}`);
console.log(`final_candidate_ref=${summary.final_candidate_ref}`);
if (summary.unresolved_objections.length) console.log(`UNRESOLVED: ${summary.unresolved_objections.length}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, matured-plan-v13.md, events.jsonl, artifacts/}`);
if (summary.state !== "converged-for-submission") process.exit(2);
