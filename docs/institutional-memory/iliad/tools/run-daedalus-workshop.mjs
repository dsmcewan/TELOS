#!/usr/bin/env node
// run-daedalus-workshop.mjs — the PARAMETERIZED next-phase Daedalus workshop
// harness (Iliad lifecycle tooling). Generalizes the three near-copy slice
// harnesses (slice5/6/7) per the slice-7 retrospective optimization.
//
//   node docs/institutional-memory/iliad/tools/run-daedalus-workshop.mjs \
//     --candidate <path.md> --spec <path> [--spec <path> ...] \
//     --out <run-dir> [--smoke] [--max-tokens 30000]
//
// The candidate is the APPROACH under review; --spec files are the FROZEN
// material it must satisfy (concatenated into the verify-spec, not reviewable).
// Seats: claude (author, odd rounds) + codex (reviewer) via ai-peer-mcp direct
// import; real per-seat provenance required; terminal is submit-not-authorization.
// Outputs under --out: artifacts/, events.jsonl, result.json, matured-approach.md.

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { runDaedalusWorkshop } = await imp("build-gate/daedalus.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const seatModule = await imp("connectors/ai-peer-mcp/server.mjs");

// ---- args ---------------------------------------------------------------------
const args = { specs: [], maxTokens: 30000, smoke: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--candidate") args.candidate = argv[++i];
  else if (argv[i] === "--spec") args.specs.push(argv[++i]);
  else if (argv[i] === "--out") args.out = argv[++i];
  else if (argv[i] === "--max-tokens") args.maxTokens = Number(argv[++i]);
  else if (argv[i] === "--smoke") args.smoke = true;
  else throw new Error(`unknown arg: ${argv[i]}`);
}
if (!args.candidate || !args.out || args.specs.length === 0) {
  throw new Error("usage: --candidate <md> --spec <path> [--spec ...] --out <dir> [--smoke]");
}

const H = (v) => "sha256:" + sha256hex(canonicalize(v));
const OUT = path.resolve(ROOT, args.out);
mkdirSync(path.join(OUT, "artifacts"), { recursive: true });

const draft = readFileSync(path.resolve(ROOT, args.candidate), "utf8");
const VERIFY_SPEC = args.specs
  .map((s) => `# FROZEN MATERIAL: ${s}\n` + readFileSync(path.resolve(ROOT, s), "utf8"))
  .join("\n\n---\n\n");

function writeArtifact(value) {
  const ref = H(value);
  writeFileSync(path.join(OUT, "artifacts", ref.replace(/^sha256:/, "") + ".json"), JSON.stringify(value, null, 2));
  return { ref };
}
async function appendEvent(event) {
  appendFileSync(path.join(OUT, "events.jsonl"), JSON.stringify({ ...event, at: new Date().toISOString() }) + "\n");
}

const SEAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan_revision: { type: "string", description: "The COMPLETE revised approach markdown, or empty string to keep the candidate byte-identical." },
    objections: { type: "array", items: { type: "object", additionalProperties: false, properties: { scope: { type: "string" }, claim: { type: "string" } }, required: ["scope", "claim"] } },
    dispositions: { type: "array", items: { type: "object", additionalProperties: false, properties: { objection_hash: { type: "string" }, action: { type: "string", enum: ["resolved", "superseded", "withdrawn"] }, note: { type: "string" } }, required: ["objection_hash", "action", "note"] } }
  },
  required: ["plan_revision", "objections", "dispositions"]
};

function seatPrompt({ role, candidateBody, openMenu, seat }) {
  const menu = openMenu.length
    ? openMenu.map((o) => `- ${o.objection_hash} (raised by ${o.raised_by_seat}): [${o.scope}] ${o.claim}`).join("\n")
    : "(none)";
  const roleBrief = role === "author"
    ? "You are the AUTHOR this round. The candidate is an IMPLEMENTATION APPROACH the frozen material governs. Improve it only where it genuinely conflicts with the frozen material, is unsafe, or leaves a listed risk unresolved — settle listed risks explicitly in the revised text when the frozen material decides them. If sound as-is, return plan_revision as an EMPTY STRING."
    : "You are the REVIEWER this round. Hunt real defects: a step violating the frozen material, an unsound mechanism, an oracle that would not discriminate, an unresolved listed risk. If sound, return plan_revision as an EMPTY STRING (binding your approval to the author's exact artifact).";
  return [
    roleBrief,
    "",
    "=== THE FROZEN MATERIAL (NOT reviewable; a genuine defect in it is an objection with scope 'plan-escalation', routed to The Eye) ===",
    VERIFY_SPEC,
    "",
    "Rules: objections {scope, claim} for real defects only; retire only your own via menu hash; convergence = zero open objections + reviewer binds the exact artifact. Repo constraints non-negotiable: Node >=18, ESM, ZERO runtime dependencies, fail-closed, advisory/non-sandbox posture, spine read-only.",
    "",
    `Open objection menu (your seat is "${seat}"):`,
    menu,
    "",
    "=== CANDIDATE ===",
    candidateBody
  ].join("\n");
}

async function liveCallSeat({ seat, role, candidateBody, openMenu }) {
  const ask = seat === "claude" ? seatModule.askClaude : seatModule.askCodex;
  const provider = seat === "claude" ? "anthropic" : "openai";
  const r = await ask({
    prompt: seatPrompt({ role, candidateBody, openMenu, seat }),
    system: "You are a principled implementation engineer in the Daedalus next-phase workshop of the TELOS build-gate project. Precision over politeness; evidence over assertion; the approach text is the only deliverable.",
    model: seat,
    effort: "high",
    max_tokens: args.maxTokens,
    response_schema: SEAT_SCHEMA,
    schema_name: "daedalus_seat_response"
  });
  let parsed;
  try { parsed = JSON.parse(r.text); }
  catch (e) {
    writeFileSync(path.join(OUT, `unparsable-${seat}-${Date.now()}.txt`), r.text ?? "");
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

const callSeat = args.smoke ? makeSmokeCallSeat() : liveCallSeat;
const result = await runDaedalusWorkshop({ draft, callSeat, writeArtifact, appendEvent });

const summary = {
  run: `${path.basename(OUT)} (next-phase evaluation, Iliad lifecycle; parameterized harness)`,
  mode: args.smoke ? "smoke" : "live",
  candidate: args.candidate,
  specs: args.specs,
  state: result.state,
  reason: result.reason,
  terminal: result.terminal ?? null,
  rounds: result.rounds.length,
  final_candidate_ref: result.final_candidate_ref,
  creation_lineage: result.creation_lineage.map((l) => ({ seat: l.seat, round: l.round, provider: l.provenance?.provider, model: l.provenance?.model, response_id: l.provenance?.response_id }))
};
writeFileSync(path.join(OUT, "result.json"), JSON.stringify(summary, null, 2));
if (result.state === "converged-for-submission") {
  const ref = result.final_candidate_ref.replace(/^sha256:/, "");
  const art = JSON.parse(readFileSync(path.join(OUT, "artifacts", ref + ".json"), "utf8"));
  writeFileSync(path.join(OUT, "matured-approach.md"), art.plan);
}
console.log(JSON.stringify(summary, null, 2));
process.exit(result.state === "converged-for-submission" ? 0 : 3);
