#!/usr/bin/env node
// Daedalus DELTA-11 workshop: integrate the delta-11 normative amendments
// (AM-35..AM-39) plus The Eye's frozen advisory/non-sandbox SCOPE DECISION into
// the converged Clotho Phase 1 plan v11, producing candidate v12. Under spec v2,
// which remains CHALLENGEABLE on mechanism (process rule: a governing spec is
// normative, not immune from challenge) — but the HUMAN SCOPE DECISION is FIXED.
//
// Seats: claude (claude-fable-5) and codex (gpt-5.6-sol) through
// connectors/ai-peer-mcp — real per-seat provenance required for convergence.
//
// Frozen inputs (released via PR #105, merge anchor bd516836…):
//   docs/clotho-phase-1-scope-decision.md          (The Eye — advisory/non-sandbox)
//   docs/clotho-phase-1-plan-amendments-11.md       (AM-35..AM-39)
// Prior converged plan:
//   docs/runs/clotho-daedalus-delta10/matured-plan-v11.md  (sha256:f5d9cd52…)
// Source dissent (authz-004, preserved NOT_AUTHORIZED):
//   docs/runs/clotho-authorization-4/codex.json     (4 hard stops + required edits)
//
// Usage:
//   node docs/runs/clotho-daedalus-delta11/run-daedalus-delta11.mjs           # LIVE (spends budget)
//   node docs/runs/clotho-daedalus-delta11/run-daedalus-delta11.mjs --smoke   # keyless wiring proof
//
// Outputs (under this directory): artifacts/<hash>.json, events.jsonl,
// result.json, matured-plan-v12.md (final candidate).

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

// ---------- draft: converged plan v11 + AM-35..39 + frozen scope decision ----------
const MATURED = readFileSync(path.join(ROOT, "docs/runs/clotho-daedalus-delta10/matured-plan-v11.md"), "utf8");
const AMENDMENTS = readFileSync(path.join(ROOT, "docs/clotho-phase-1-plan-amendments-11.md"), "utf8");
const SCOPE_DECISION = readFileSync(path.join(ROOT, "docs/clotho-phase-1-scope-decision.md"), "utf8");
const SPEC_V2 = readFileSync(path.join(ROOT, "docs/clotho-phase-1-design.md"), "utf8");
const REMEDIATION = readFileSync(path.join(ROOT, "docs/clotho-phase-1-remediation.md"), "utf8");
// The dissent that motivates this delta rides along verbatim: the codex seat's
// four authz-004 hard stops + required edits + rationale.
const DISSENT = JSON.parse(readFileSync(path.join(ROOT, "docs/runs/clotho-authorization-4/codex.json"), "utf8"));
const dissentBrief = [
  "# SOURCE DISSENT (codex required seat, TELOS authz-004 — preserved NOT_AUTHORIZED)",
  "", "## Hard stops:", ...DISSENT.hard_stops.map((h, i) => `${i + 1}. ${h}`),
  "", "## Required edits:", ...DISSENT.required_edits.map((e, i) => `${i + 1}. ${e}`),
  "", "## Rationale:", DISSENT.rationale
].join("\n");

// The Eye's supplementary maturation directives for THIS delta. These are FIXED
// (human-decided), on top of the frozen scope decision and AM-35..AM-39.
const EYE_DIRECTIVES = [
  "# THE EYE'S SUPPLEMENTARY MATURATION DIRECTIVES (delta-11) — FIXED, NON-CHALLENGEABLE",
  "",
  "## Mandatory maturation outcomes — v12 must apply all five amendments WITHOUT DILUTION",
  "- AM-35: advisory / non-sandbox scope; NO isolation guarantee anywhere.",
  "- AM-36: provenance covers the SUPPORTED STATIC dependency model only.",
  "- AM-37: missing coverage evidence produces conservative UNKNOWN coverage.",
  "- AM-38: publication-time re-read, re-derivation, exact comparison, hash recheck, ABORT on drift.",
  "- AM-39: invoked weaver identity MUST equal returned attribution.",
  "",
  "## Cold-review caveat — materialize in the NORMATIVE QUERY INTERFACE (not prose only)",
  "Add to the query result a closed-schema field `coverage: \"verified\" | \"unverified\"` and specify EXACTLY:",
  "1. which query results contain the field;",
  "2. when each value is emitted;",
  "3. how it relates to `coverageUnknown`;",
  "4. that `coverageUnknown: []` is legal ONLY under a verified manifest proving all consulted producers executed;",
  "5. closed-schema rejection behavior for missing, unknown, or contradictory values;",
  "6. corresponding positive AND negative tests.",
  "Put this in the normative interface/schema tables, not only in explanatory prose.",
  "",
  "## HARD GUARDS — the workshop MUST NOT:",
  "- add executable loader-evasion-route coverage (of any kind);",
  "- restore language claiming loader isolation is proven;",
  "- describe the advisory scanner as containment / a capability boundary / a sandbox;",
  "- modify authz-004 or any prior authorization record;",
  "- rewrite or replace prior Daedalus evidence (deltas 1-10 are read-only history);",
  "- describe provider provenance as signatures (provenance != HMAC signature);",
  "- start implementation;",
  "- convene authz-005;",
  "- open Argo.",
  "",
  "The plan MAY preserve the deterministic scanner checks (D27/D32) as TRUSTED-CODE",
  "REVIEW SIGNALS, but every surrounding claim must remain consistent with the",
  "non-sandbox decision. Removing an overclaim is required; removing a deterministic",
  "check is NOT required and must not be used to weaken advisory review value."
].join("\n");

const draft = [
  MATURED,
  "\n\n---\n\n# NORMATIVE AMENDMENTS TO INTEGRATE (AM-35..AM-39)\n",
  AMENDMENTS,
  "\n\n---\n\n# FROZEN HUMAN SCOPE DECISION (The Eye) — BINDING, NON-CHALLENGEABLE\n",
  SCOPE_DECISION,
  "\n\n---\n\n",
  EYE_DIRECTIVES,
  "\n\n---\n\n",
  dissentBrief,
  "\n\n---\n\n# Appendix A: remediation history (READ-ONLY historical context)\n",
  REMEDIATION,
  "\n\n---\n\n# Appendix B: governing spec v2.8 (CHALLENGEABLE on mechanism — see workshop rules)\n",
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
      description: "The COMPLETE revised plan markdown (AM-35..39 integrated; scope decision honored; the coverage field materialized in the interface; any accepted spec-amendment proposals listed in a final 'Proposed spec amendments' section), or empty string to keep the candidate byte-identical."
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
    ? "You are the AUTHOR this round. This is a DELTA workshop: the candidate contains the converged plan v11, then NORMATIVE AMENDMENTS AM-35..AM-39, then The Eye's FROZEN SCOPE DECISION and supplementary directives. Integrate every amendment into the plan body as a single coherent implementation-ready plan (candidate v12); delete the amendment/decision/directive appendices once integrated; keep every already-converged mechanism the amendments reaffirm. Produce the COMPLETE revised plan in plan_revision. If you make no changes, return plan_revision as an empty string."
    : "You are the REVIEWER this round. Review the exact candidate below: are AM-35..AM-39 faithfully integrated, is the scope decision honored, and is the `coverage` field materialized in the interface — all WITHOUT regressing converged mechanisms and WITHOUT violating any hard guard? If it is ready as-is, return plan_revision as an EMPTY STRING (this binds your approval to the author's exact artifact — required for convergence). Only include a non-empty plan_revision if a defect genuinely requires changing the text.";
  return [
    roleBrief,
    "",
    "Rules of the workshop:",
    "- Amendment REQUIREMENTS (AM-35..AM-39) are fixed (The Eye decided them); you may object to an amendment's MECHANISM and integrate a better one, never drop the requirement.",
    "- THE HUMAN SCOPE DECISION IS FIXED AND NON-CHALLENGEABLE: Clotho Phase 1 is advisory / non-sandboxed. You may NOT reintroduce any claim of proven loader isolation, structural loader prohibition, containment, capability boundary, or sandbox. Removing overclaims is mandatory.",
    "- HARD GUARDS (non-negotiable): do NOT add executable loader-evasion-route coverage; do NOT restore isolation-proven language; do NOT frame the advisory scanner as containment; do NOT modify authz-004; do NOT rewrite prior Daedalus evidence; do NOT describe provider provenance as signatures; do NOT start implementation, convene authz-005, or open Argo.",
    "- MATERIALIZE the `coverage: \"verified\" | \"unverified\"` field in the normative query interface per The Eye's directive (the six exact specifics + positive/negative tests) — not in prose alone.",
    "- Preserve the deterministic scanner checks (D27/D32) as TRUSTED-CODE REVIEW SIGNALS; keeping a check is fine, but no surrounding claim may contradict the non-sandbox decision.",
    "- THE GOVERNING SPEC IS CHALLENGEABLE ON MECHANISM: if the spec (appendix) contains a defect, raise an objection with scope prefixed 'spec:' and include proposed replacement text in the claim; collect accepted spec proposals in a final 'Proposed spec amendments' section of plan_revision for The Eye. Do NOT design around a spec mistake. (This does not license reintroducing any descoped claim.)",
    "- Raise objections ONLY for real defects. Each objection: {scope, claim}. Do not re-raise anything already on the open menu.",
    "- Dispositions: you may retire ONLY objections YOUR seat raised, by their menu hash, and only when the current candidate actually addresses them (resolved), a new objection replaces them (superseded), or they were mistaken (withdrawn).",
    "- Convergence requires zero open objections AND the reviewer binding the author's exact artifact.",
    "- Repo constraints are non-negotiable: Node >=18, ESM, ZERO runtime dependencies, spine read-only (no package may import from clotho/), closed sets, fail-closed, advisory-only posture.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE (converged plan v11 + amendments + frozen scope decision + directives + challengeable spec appendix) ===",
    candidateBody
  ].join("\n");
}

// ---------- live seats ----------
async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation-plan engineer in the Daedalus delta workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion; the plan text is the only deliverable. Honor The Eye's fixed scope decision and hard guards exactly.",
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
console.log(`Daedalus DELTA-11 workshop — ${SMOKE ? "SMOKE (stub seats)" : "LIVE (fable-5/high + gpt-5.6-sol/high)"}`);

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
  if (typeof finalArtifact.plan === "string") writeFileSync(path.join(HERE, "matured-plan-v12.md"), finalArtifact.plan);
} catch { /* result.json still records the ref */ }

console.log(`state=${summary.state} reason=${summary.reason} rounds=${summary.rounds}`);
console.log(`final_candidate_ref=${summary.final_candidate_ref}`);
if (summary.unresolved_objections.length) console.log(`UNRESOLVED: ${summary.unresolved_objections.length}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, matured-plan-v12.md, events.jsonl, artifacts/}`);
if (summary.state !== "converged-for-submission") process.exit(2);
