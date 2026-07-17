#!/usr/bin/env node
// Daedalus NEXT-PHASE workshop for Clotho slice 6 (Iliad lifecycle beat).
// claude + codex review the slice-6 IMPLEMENTATION APPROACH against the frozen
// Task 6 clause. The plan v15 is FIXED; only the approach is matured.
//
// Usage:
//   node docs/runs/clotho-slice6-daedalus/run-workshop.mjs           # LIVE
//   node docs/runs/clotho-slice6-daedalus/run-workshop.mjs --smoke   # keyless wiring proof

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
const v15 = readFileSync(path.join(ROOT, "docs/runs/clotho-daedalus-delta14/matured-plan-v15.md"), "utf8");
const task6 = v15.slice(v15.indexOf("## Task 6:"), v15.indexOf("## Task 7:"));
const DECISIONS = readFileSync(path.join(ROOT, "clotho/memory/DECISIONS/task-6-7-decisions.md"), "utf8");

const VERIFY_SPEC = [
  "# FROZEN TASK 6 CLAUSE (the approach must satisfy this; it is NOT reviewable)",
  task6,
  "\n# FROZEN TASK 6/7 DECISION RECORDS",
  DECISIONS,
  "\n# RECORDED SLICE-5 INTEGRATION CONTRACTS (honor these)",
  "- currentDocs is a Map<docAddressKey, text_sha256|null> (null = deleted/ambiguous)",
  "- kind->producer: git=introduced-by, code=depends-on, test=verified-by, doc=documented-in, ledger=motivated-by/evidenced-by/discharges"
].join("\n");

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

const SEAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan_revision: { type: "string", description: "The COMPLETE revised approach markdown, or empty string to keep the candidate byte-identical." },
    objections: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { scope: { type: "string" }, claim: { type: "string" } }, required: ["scope", "claim"] }
    },
    dispositions: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { objection_hash: { type: "string" }, action: { type: "string", enum: ["resolved", "superseded", "withdrawn"] }, note: { type: "string" } }, required: ["objection_hash", "action", "note"] }
    }
  },
  required: ["plan_revision", "objections", "dispositions"]
};

function seatPrompt({ role, candidateBody, openMenu, seat }) {
  const menu = openMenu.length
    ? openMenu.map((o) => `- ${o.objection_hash} (raised by ${o.raised_by_seat}): [${o.scope}] ${o.claim}`).join("\n")
    : "(none)";
  const roleBrief = role === "author"
    ? "You are the AUTHOR this round. The candidate is the slice-6 IMPLEMENTATION APPROACH for the frozen Task 6 (flagship acceptance). Improve it only where it conflicts with the frozen clause, is unsafe, or leaves R1-R3 unresolved — settle R1-R3 explicitly in the revised text if the frozen material decides them. If sound as-is, return plan_revision as an EMPTY STRING."
    : "You are the REVIEWER this round. Hunt real defects: a step violating the frozen clause (eight-group semantics, one-to-one matching, D3 review-set rules, D25 provenance in expectations, D31 doc-skipped clause resolution, D35 coverage directions, the 120s ceiling, exact-JSON-only matches), a wrong reading of the repository_ref question (R1), or an unpublishable review-set plan (R2). If sound, return plan_revision as an EMPTY STRING (binding approval to the exact artifact).";
  return [
    roleBrief,
    "",
    "=== THE FROZEN MATERIAL ===",
    VERIFY_SPEC,
    "",
    "Rules: the PLAN IS FIXED (a genuine plan defect = objection scope 'plan-escalation', routed to The Eye). Objections {scope, claim} for real defects only; retire only your own via menu hash; convergence = zero open objections + reviewer binds the exact artifact. Repo constraints non-negotiable (Node >=18, ESM, zero deps, fail-closed, advisory posture).",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE (slice-6 implementation approach) ===",
    candidateBody
  ].join("\n");
}

async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation engineer in the Daedalus next-phase workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion. The frozen plan is not reviewable here.",
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

function makeSmokeCallSeat() {
  let calls = 0;
  return async ({ seat, openMenu, candidateBody }) => {
    calls++;
    const provenance = { provider: seat === "claude" ? "anthropic" : "openai", model: "smoke", response_id: `smoke_${seat}_${calls}`, source: "smoke" };
    if (calls === 1) return { plan_revision: candidateBody + "\n<!-- smoke r1 -->", objections: [{ scope: "smoke", claim: "smoke objection" }], dispositions: [], provenance };
    if (calls <= 3) return { plan_revision: "", objections: [], dispositions: [], provenance };
    return { plan_revision: "", objections: [], dispositions: openMenu.filter((o) => o.raised_by_seat === seat).map((o) => ({ objection_hash: o.objection_hash, action: "resolved", note: "smoke resolved" })), provenance };
  };
}

const callSeat = SMOKE ? makeSmokeCallSeat() : liveCallSeat;
const result = await runDaedalusWorkshop({ draft, callSeat, writeArtifact, appendEvent });

const summary = {
  run: "clotho-slice6-daedalus (next-phase evaluation, Iliad lifecycle)",
  mode: SMOKE ? "smoke" : "live",
  state: result.state,
  reason: result.reason,
  terminal: result.terminal ?? null,
  rounds: result.rounds.length,
  final_candidate_ref: result.final_candidate_ref,
  creation_lineage: result.creation_lineage.map((l) => ({ seat: l.seat, round: l.round, provider: l.provenance?.provider, model: l.provenance?.model, response_id: l.provenance?.response_id }))
};
writeFileSync(path.join(HERE, "result.json"), JSON.stringify(summary, null, 2));
if (result.state === "converged-for-submission") {
  const ref = result.final_candidate_ref.replace(/^sha256:/, "");
  const art = JSON.parse(readFileSync(path.join(ARTIFACTS, ref + ".json"), "utf8"));
  writeFileSync(path.join(HERE, "matured-approach.md"), art.plan);
}
console.log(JSON.stringify(summary, null, 2));
process.exit(result.state === "converged-for-submission" ? 0 : 3);
