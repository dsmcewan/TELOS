#!/usr/bin/env node
// Daedalus DELTA-14 workshop: apply The Eye's AM-41 SHEBANG CARVE-OUT
// (admit one optional leading shebang; resolves the authz-007 weave.mjs contradiction) to the
// authorized Clotho Phase 1 plan v14, producing candidate v15. The HUMAN RULING
// is FIXED; the workshop integrates it faithfully with cold review, nothing else.
//
// Seats: claude (claude-fable-5) and codex (gpt-5.6-sol) through
// connectors/ai-peer-mcp — real per-seat provenance required for convergence.
//
// Frozen inputs:
//   docs/runs/clotho-daedalus-delta13/matured-plan-v14.md   (v14, sha256:f152f166…)
//   docs/clotho-phase-1-plan-amendments-13.md               (AM-41 — source-profile ruling)
//
// Usage:
//   node docs/runs/clotho-daedalus-delta14/run-daedalus-delta13.mjs           # LIVE (spends budget)
//   node docs/runs/clotho-daedalus-delta14/run-daedalus-delta13.mjs --smoke   # keyless wiring proof
//
// Outputs (under this directory): artifacts/<hash>.json, events.jsonl,
// result.json, matured-plan-v15.md (final candidate).

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

// ---------- draft: v14 with the AM-41 SHEBANG CARVE-OUT applied (v15) ----------
// v14 already carries AM-41 (the enforced source-profile). authz-007 caught a
// plan contradiction: AM-41's blanket hashbang rejection collided with Task 5's
// requirement that clotho/weave.mjs (a closure entry point) carry a Node shebang.
// The Eye ruled: admit ONE optional leading shebang line (#! at byte 0, first
// line, LF/CRLF-terminated, removed before lexing), reject #! elsewhere. This
// candidate is v14 with that carve-out applied to the AM-41 block (a precise,
// byte-verified 2-edit refinement vs v14). The seats VERIFY the carve-out against
// the refined AM-41 and bind it. AM-41 + directives ride in the prompt.
const MATURED_V15 = readFileSync(path.join(HERE, "v15-candidate-input.md"), "utf8");
const AMENDMENT = readFileSync(path.join(ROOT, "docs/clotho-phase-1-plan-amendments-13.md"), "utf8");

const EYE_DIRECTIVES = [
  "# THE EYE'S MATURATION DIRECTIVES (delta-14) — FIXED, NON-CHALLENGEABLE",
  "",
  "## Mandatory outcome — v15 = v14 + the AM-41 shebang carve-out, WITHOUT DILUTION",
  "- The AM-41 enforced closed source profile stands unchanged EXCEPT for the",
  "  shebang carve-out below; everything else in v14 is byte-identical.",
  "- The scanner admits AT MOST ONE optional leading shebang line, permitted ONLY",
  "  when `#!` begins at byte offset 0, is the first line, and terminates with LF",
  "  or CRLF; the scanner removes that one line before lexical classification",
  "  (Node's executable-module convention — e.g. Task 5's weave.mjs).",
  "- A `#!` ANYWHERE ELSE still FAILS CLOSED with unsupported-module-lexical-profile:",
  "  a `#!` with preceding whitespace, not at byte 0 / not line 1, a second `#!`",
  "  line; a `#!` inside a string or comment is not a hashbang.",
  "- This resolves the authz-007 contradiction (weave.mjs may keep its shebang and",
  "  still derive its closure) WITHOUT broadening the scanner into Annex-B parsing",
  "  and WITHOUT overriding codex.",
  "",
  "## The ruling is FIXED; only its integration MECHANISM is in scope",
  "You may improve HOW the shebang carve-out is woven into the AM-41 clause, never",
  "WHAT it decides. Do not weaken the exact leading-shebang conditions; do not admit",
  "a hashbang anywhere else; do not require a full ES parser; do not otherwise alter",
  "the AM-41 profile.",
  "",
  "## HARD GUARDS — the workshop MUST NOT:",
  "- weaken the closed-profile contract into an unenforced assumption, or permit a",
  "  supported-profile input to be misclassified;",
  "- require a complete ECMAScript lexer/parser;",
  "- reintroduce any descoped claim (loader isolation proven, containment beyond D21,",
  "  sandbox, capability boundary) — the AM-35..AM-39 advisory / non-sandbox posture",
  "  stands;",
  "- alter any OTHER frozen decision (AM-40, D17/AM-17, D24/D26/D31, D32, the D33",
  "  accepted-form set, zero-dep, spine-read-only) — AM-41 is narrow;",
  "- modify any prior authorization or Daedalus evidence (deltas 1-12 and v12/v13 are",
  "  read-only history);",
  "- describe provider provenance as an HMAC signature;",
  "- start or resume implementation, convene the re-authorization, or open Argo."
].join("\n");

const draft = MATURED_V15;
// The verification spec the seats hold the candidate against (prompt-side only).
const VERIFY_SPEC = [
  "# NORMATIVE AMENDMENT THE CANDIDATE MUST ALREADY SATISFY (AM-41 — The Eye's enforced-source-profile ruling)",
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
      description: "The COMPLETE revised plan markdown (AM-41 integrated into the Task 4a D33 shared-grammar clause; the amendment appendix and directives deleted once integrated), or empty string to keep the candidate byte-identical."
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
    ? "You are the AUTHOR this round. This is a NARROW DELTA workshop. The candidate below is the authorized plan v14 (which already carries AM-41) with The Eye's AM-41 SHEBANG CARVE-OUT applied — a precise 2-edit refinement of the AM-41 block that admits one optional leading shebang line (#! at byte 0, first line, LF/CRLF-terminated, removed before lexing) and rejects #! elsewhere. Your job is to VERIFY the carve-out is faithful and narrow (the exact leading-shebang conditions; #! elsewhere still fails closed; the rest of AM-41 and the whole plan otherwise byte-identical to v14; no hard guard breached). If correct, return plan_revision as an EMPTY STRING (keep the candidate byte-identical). Only return a non-empty plan_revision — the COMPLETE revised plan — if you find a genuine defect that requires a text change."
    : "You are the REVIEWER this round. The candidate below is v14 with the AM-41 shebang carve-out applied. Verify: the scanner admits AT MOST ONE leading shebang ONLY when #! begins at byte offset 0, is the first line, and terminates LF/CRLF, removed before lexing; a #! anywhere else (preceding whitespace, not byte-0/not-line-1, a second #!, or inside a string/comment) still FAILS CLOSED with `unsupported-module-lexical-profile`; the rest of the AM-41 enforced source profile is unchanged; NOTHING else in the plan changed vs v14; no hard-guard violation. If correct as-is, return plan_revision as an EMPTY STRING (this binds your approval to the author's exact artifact). Only raise an objection or return a non-empty plan_revision for a genuine defect.";
  return [
    roleBrief,
    "",
    "=== THE RULING THE CANDIDATE MUST ALREADY SATISFY (verify against this) ===",
    VERIFY_SPEC,
    "",
    "Rules of the workshop:",
    "- The AM-41 REQUIREMENT is fixed (The Eye decided it): the D33 scanner is correct over a closed, mechanically enforced source profile; supported forms are classified correctly despite whitespace/comments/strings/aliases/options/token-context; every out-of-profile construct fails closed with the stable diagnostic (tested + enforced); this is NOT a full ES parser and NOT an override of codex. You may improve the integration MECHANISM/wording, never the decision.",
    "- THE HUMAN RULING IS FIXED AND NON-CHALLENGEABLE: do NOT weaken the closed-profile contract into an unenforced 'cannot occur' assumption; do NOT require a complete ECMAScript lexer/parser; do NOT permit a supported-profile input to be misclassified.",
    "- HARD GUARDS (non-negotiable): do NOT reintroduce any descoped claim (loader isolation proven, containment beyond D21, capability boundary, sandbox); do NOT alter any OTHER frozen decision (AM-40, D17/AM-17, D24/D26/D31, D32, the D33 accepted-form set, zero-dep, spine-read-only); do NOT modify prior authorizations or Daedalus evidence; do NOT describe provenance as an HMAC signature; do NOT start/resume implementation, convene the re-authorization, or open Argo.",
    "- Raise objections ONLY for real defects in the INTEGRATION (faithfulness of AM-41, an accidental change elsewhere, a hard-guard breach). Each objection: {scope, claim}. Do not re-raise anything already on the open menu.",
    "- Dispositions: you may retire ONLY objections YOUR seat raised, by their menu hash, and only when the current candidate actually addresses them (resolved), a new objection replaces them (superseded), or they were mistaken (withdrawn).",
    "- Convergence requires zero open objections AND the reviewer binding the author's exact artifact.",
    "- Repo constraints are non-negotiable: Node >=18, ESM, ZERO runtime dependencies, spine read-only, closed sets, fail-closed, advisory-only posture.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE (v14 with the AM-41 shebang carve-out applied — verify against the ruling above) ===",
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
console.log(`Daedalus DELTA-14 workshop — ${SMOKE ? "SMOKE (stub seats)" : "LIVE (fable-5/high + gpt-5.6-sol/high)"}`);

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
  if (typeof finalArtifact.plan === "string") writeFileSync(path.join(HERE, "matured-plan-v15.md"), finalArtifact.plan);
} catch { /* result.json still records the ref */ }

console.log(`state=${summary.state} reason=${summary.reason} rounds=${summary.rounds}`);
console.log(`final_candidate_ref=${summary.final_candidate_ref}`);
if (summary.unresolved_objections.length) console.log(`UNRESOLVED: ${summary.unresolved_objections.length}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, matured-plan-v15.md, events.jsonl, artifacts/}`);
if (summary.state !== "converged-for-submission") process.exit(2);
