#!/usr/bin/env node
// Loader subsystem redesign-from-invariants — PARALLEL-authorship workshop
// (docs/daedalus-methodology.md), driven through the hardened runParallelDaedalus
// (PR #100). Two seats author IN PARALLEL from the frozen frame:
//   - constraints = codex (gpt-5.6-sol): invariants, trust boundaries, failure
//     semantics, proof obligations, adversarial acceptance tests. DECLARES the
//     obligation ID set the integrator must cover exactly.
//   - implementation = claude (claude-fable-5): the smaller replacement model —
//     architecture, interfaces, static closure, task decomposition.
// The integrator (claude) produces one spec descending from BOTH, mapping every
// declared obligation through the five-field matrix; each seat then verifies its
// own contract survived. Convergence -> submit; any conflict -> The Eye.
//
// The frozen frame is docs/runs/clotho-loader-redesign/frame.md. The deliverable
// is a redesigned loader SPEC section (a Clotho plan delta), NOT a .mjs patch.
//
// Usage:
//   node docs/runs/clotho-loader-redesign/run-loader-redesign.mjs --smoke   # keyless wiring proof (HOLD)
//   node docs/runs/clotho-loader-redesign/run-loader-redesign.mjs           # LIVE (real codex + claude budget)
//
// Outputs (under this directory): artifacts/<hash>.json, events.jsonl,
// result.json, redesigned-loader-spec.md (the converged candidate, if converged).

import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { runParallelDaedalus, deriveParallelState } = await imp("build-gate/daedalus.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const seatModule = await imp("connectors/ai-peer-mcp/server.mjs");

const SMOKE = process.argv.includes("--smoke");
const H = (v) => "sha256:" + sha256hex(canonicalize(v));

// ---------- frozen frame ----------
const FRAME = readFileSync(path.join(HERE, "frame.md"), "utf8");

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

// ---------- per-phase seat response schemas ----------
const AUTHOR_SCHEMA_CONSTRAINTS = {
  type: "object", additionalProperties: false,
  properties: {
    plan: { type: "string", description: "The constraints design (markdown): invariants, trust boundaries, failure semantics, normative schemas, proof obligations, adversarial acceptance tests. Must structurally foreclose F1/F2/F3 without reintroducing a form-recognizer." },
    obligations: { type: "array", items: { type: "string" }, description: "Stable obligation IDs (e.g. LOAD-INV-1, LOAD-INV-2) you bind the integrator to cover EXACTLY — one per invariant / proof obligation. This set is frozen and content-addressed." }
  },
  required: ["plan", "obligations"]
};
const AUTHOR_SCHEMA_IMPLEMENTATION = {
  type: "object", additionalProperties: false,
  properties: {
    plan: { type: "string", description: "The implementation design (markdown): the smaller replacement model — architecture, interfaces, data flow, static closure checked against disk (no runtime loader hook), task decomposition, and the S4 behavioral-delta accounting vs the four retired mechanisms." }
  },
  required: ["plan"]
};
const INTEGRATE_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    plan: { type: "string", description: "The ONE integrated loader-redesign spec, descending from BOTH source designs — every constraints invariant preserved, the implementation's smaller model realized." },
    obligation_matrix: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          obligation_id: { type: "string", description: "Exactly one of the constraints-declared obligation IDs. The matrix must cover the declared set as a bijection: no missing, no invented, no duplicate." },
          invariant: { type: "string" },
          mechanism: { type: "string", description: "The enforcement mechanism realizing the invariant." },
          task: { type: "string", description: "The concrete build task." },
          negative_test: { type: "string", description: "The adversarial test that fails if the invariant is violated." },
          exit_criterion: { type: "string", description: "How the obligation is discharged." }
        },
        required: ["obligation_id", "invariant", "mechanism", "task", "negative_test", "exit_criterion"]
      }
    }
  },
  required: ["plan", "obligation_matrix"]
};
const VERIFY_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["preserved", "violated"], description: "\"preserved\" ONLY if your entire contract survived integration unweakened; otherwise \"violated\"." },
    conflicts: { type: "array", items: { type: "string" }, description: "Specific contract violations if verdict is \"violated\"; empty array if \"preserved\". A conflict routes the workshop to The Eye — do not blend." }
  },
  required: ["verdict", "conflicts"]
};

const SYSTEM = [
  "You are a principled specification engineer in the Daedalus PARALLEL-authorship workshop of the TELOS build-gate project (docs/daedalus-methodology.md).",
  "This is a REDESIGN-FROM-INVARIANTS of the Clotho loader subsystem: two seats author IN PARALLEL from one frozen frame; outputs are content-addressed and integrated — never blended by compromise.",
  "Precision over politeness; evidence over assertion. Repo constraints are non-negotiable: Node >= 18, ESM, ZERO runtime dependencies, closed sets, fail-closed.",
  "The deliverable is a redesigned loader SPEC section (a Clotho plan delta), NOT code. Do not reintroduce an enumerate-the-forms scanner; the whole point is to retire it."
].join("\n");

// ---------- live seats ----------
function askFor(seat) { return seat === "claude" ? seatModule.askClaude : seatModule.askCodex; }
function providerFor(seat) { return seat === "claude" ? "anthropic" : "openai"; }

function authorPrompt(role) {
  if (role === "constraints") {
    return [
      "You are the CONSTRAINTS seat — you own invariants, trust boundaries, failure semantics, normative schemas, proof obligations, and adversarial acceptance tests.",
      "From the FROZEN FRAME below, author the constraints design for the loader redesign. Your invariants must structurally foreclose F1 (illustrative set), F2 (capability/provenance drift), and F3 (open form-set) — NOT by a better recognizer, but by a set that is closed by construction.",
      "Your adversarial acceptance tests MUST include, as must-defeat cases, each historical evasion: an illustrative/underspecified permitted set, a capability/provenance derivation drift, and a generated OR aliased loader-evasion, plus require-style / dynamic / side-effect forms (S6).",
      "Declare `obligations`: a frozen list of stable obligation IDs (e.g. LOAD-INV-1 ...), one per invariant / proof obligation, that the integrator must cover EXACTLY.",
      "Return `plan` = your constraints design in markdown.",
      "",
      "=== FROZEN FRAME ===",
      FRAME
    ].join("\n");
  }
  return [
    "You are the IMPLEMENTATION seat — you own architecture, interfaces, data flow, task decomposition, sequencing, and delivery.",
    "From the FROZEN FRAME below, author the implementation design for the SMALLER replacement model: closed by construction, not by detection; a static declared load closure checked against disk ground truth (the TELOS gate re-reads disk) — NO runtime loader hook (that is loader machinery and a runtime dependency).",
    "Carry the behavioral-delta accounting (S4) and show a NET-NEGATIVE surface versus the four retired mechanisms (scanner + safe-export allowlist + separate closure derivation + recognizer-coupling). Preserve the legitimate non-loader uses the allowlist served, or show them no longer needed (S5).",
    "Return `plan` = your implementation design in markdown.",
    "",
    "=== FROZEN FRAME ===",
    FRAME
  ].join("\n");
}

function integratePrompt(sources) {
  const cons = sources.find((s) => s.role === "constraints") || {};
  const impl = sources.find((s) => s.role === "implementation") || {};
  const ids = Array.isArray(cons.obligations) ? cons.obligations : [];
  return [
    "You are the INTEGRATOR (implementation seat). Produce ONE integrated loader-redesign spec that DESCENDS FROM BOTH source designs below — preserve every constraints invariant AND realize the implementation's smaller model. Do not silently drop or weaken either contract; if they genuinely cannot both hold, that is a conflict for The Eye, surfaced at verification — not a blend.",
    "Then produce the obligation matrix: EXACTLY one row per declared obligation ID (a bijection — no missing, no invented, no duplicate), each row mapping obligation_id -> invariant -> mechanism -> task -> negative_test -> exit_criterion.",
    "",
    `Declared obligation IDs to cover EXACTLY: ${JSON.stringify(ids)}`,
    "",
    "=== CONSTRAINTS SOURCE ===",
    cons.body != null ? cons.body : "(body not provided)",
    "",
    "=== IMPLEMENTATION SOURCE ===",
    impl.body != null ? impl.body : "(body not provided)"
  ].join("\n");
}

function verifyPrompt(role, yourSource, integration) {
  const own = role === "constraints"
    ? "Did the integrated spec preserve EVERY invariant and obligation you declared, with no weakening and NO reintroduced form-recognizer?"
    : "Did the integrated spec preserve your implementation design — the smaller model, the static declared closure (no runtime hook), and the net-negative surface?";
  return [
    `You are the ${role.toUpperCase()} seat verifying YOUR OWN contract survived integration.`,
    own,
    "Return verdict \"preserved\" ONLY if your entire contract held; otherwise \"violated\" with specific conflicts. A conflict routes to The Eye — be exact, do not blend.",
    "",
    "=== YOUR SOURCE DESIGN ===",
    yourSource && yourSource.body != null ? yourSource.body : "(body not provided)",
    "",
    "=== INTEGRATED SPEC ===",
    integration && integration.plan != null ? integration.plan : "(plan not provided)",
    "",
    "=== OBLIGATION MATRIX ===",
    integration && integration.obligation_matrix ? JSON.stringify(integration.obligation_matrix, null, 2) : "(matrix not provided)"
  ].join("\n");
}

async function liveCallParallelSeat({ seat, role, phase, sources, integration }) {
  const ask = askFor(seat);
  const provider = providerFor(seat);
  let prompt, schema, schemaName;
  if (phase === "author") {
    prompt = authorPrompt(role);
    schema = role === "constraints" ? AUTHOR_SCHEMA_CONSTRAINTS : AUTHOR_SCHEMA_IMPLEMENTATION;
    schemaName = `loader_author_${role}`;
  } else if (phase === "integrate") {
    prompt = integratePrompt(sources || []);
    schema = INTEGRATE_SCHEMA;
    schemaName = "loader_integration";
  } else {
    const yourSource = (sources || [])[0];
    prompt = verifyPrompt(role, yourSource, integration);
    schema = VERIFY_SCHEMA;
    schemaName = `loader_verify_${role}`;
  }
  const r = await ask({
    prompt, system: SYSTEM, model: seat,
    effort: "high", // per the live-run mechanics: delta workshops run at high after the quota exhaustion
    max_tokens: 60000,
    response_schema: schema, schema_name: schemaName
  });
  let parsed;
  try { parsed = JSON.parse(r.text); }
  catch (e) {
    writeFileSync(path.join(HERE, `unparsable-${seat}-${role}-${phase}-${Date.now()}.txt`), r.text ?? "");
    throw new Error(`Seat ${seat}/${role}/${phase} returned unparsable JSON (saved for inspection): ${e.message}`);
  }
  const provenance = { provider, model: r.model, response_id: r.id, source: `ai-peer-mcp/${seat === "claude" ? "claude_ask" : "codex_ask"}` };
  if (phase === "author") return { plan: typeof parsed.plan === "string" ? parsed.plan : "", ...(role === "constraints" ? { obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [] } : {}), provenance };
  if (phase === "integrate") return { plan: typeof parsed.plan === "string" ? parsed.plan : "", obligation_matrix: Array.isArray(parsed.obligation_matrix) ? parsed.obligation_matrix : [], provenance };
  return { verdict: parsed.verdict, conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [], provenance };
}

// ---------- smoke seats (keyless wiring proof) ----------
function makeSmokeCallSeat() {
  let n = 0;
  const OBL = ["LOAD-INV-1", "LOAD-INV-2"];
  return async ({ seat, role, phase }) => {
    n++;
    const provenance = { provider: providerFor(seat), model: "smoke", response_id: `smoke_${seat}_${role}_${phase}_${n}`, source: "smoke" };
    if (phase === "author") return { plan: `# ${role} source design (smoke)\n`, ...(role === "constraints" ? { obligations: OBL } : {}), provenance };
    if (phase === "integrate") return { plan: "# integrated loader redesign (smoke)\n", obligation_matrix: OBL.map((id) => ({ obligation_id: id, invariant: `invariant ${id}`, mechanism: `mechanism ${id}`, task: `task ${id}`, negative_test: `negative test ${id}`, exit_criterion: `exit ${id}` })), provenance };
    return { verdict: "preserved", conflicts: [], provenance };
  };
}

// ---------- run ----------
if (!SMOKE) {
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    if (!process.env[key]) {
      console.error(`Missing ${key}. Set both seat keys in the environment (constraints=codex/OPENAI, implementation=claude/ANTHROPIC), or run with --smoke.`);
      process.exit(1);
    }
  }
}

const callSeat = SMOKE ? makeSmokeCallSeat() : liveCallParallelSeat;
console.log(`Loader redesign — PARALLEL workshop — ${SMOKE ? "SMOKE (stub seats, keyless wiring proof)" : "LIVE (codex/gpt-5.6-sol + claude/fable-5, effort high)"}`);

const result = await runParallelDaedalus({ frame: FRAME, callSeat, writeArtifact, appendEvent });

const summary = {
  mode: SMOKE ? "smoke" : "live",
  state: result.state,
  reason: result.reason,
  terminal: result.terminal ?? null,
  candidate_ref: result.candidate_ref ?? null,
  declared_obligations: (result.sources || []).find((s) => s.role === "constraints")?.obligations ?? null,
  obligation_rows: (result.integration && result.integration.obligation_matrix) ? result.integration.obligation_matrix.length : 0,
  conflicts: result.conflicts ?? [],
  creation_lineage: [
    ...(result.sources || []).map((s) => ({ seat: s.seat, role: s.role, phase: "author", provenance_key: s.provenance_key })),
    ...(result.integration ? [{ seat: result.integration.seat, role: "integration", phase: "integrate", provenance_key: result.integration.provenance_key }] : []),
    ...(result.verifications || []).map((v) => ({ seat: v.seat, role: v.role, phase: "verify", verdict: v.verdict, provenance_key: v.provenance_key }))
  ]
};
writeFileSync(path.join(HERE, "result.json"), JSON.stringify(summary, null, 2));

// Re-derive the state from the returned artifacts as an independent check (the gate never trusts a caller).
const recheck = deriveParallelState({ sources: result.sources, integration: result.integration, verifications: result.verifications });
summary.independent_recheck = { state: recheck.state, reason: recheck.reason, terminal: recheck.terminal };
writeFileSync(path.join(HERE, "result.json"), JSON.stringify(summary, null, 2));

if (result.state === "converged-parallel" && result.candidate_ref) {
  const finalFile = path.join(ARTIFACTS, String(result.candidate_ref).replace(/^sha256:/, "") + ".json");
  try {
    const art = JSON.parse(readFileSync(finalFile, "utf8"));
    if (typeof art.plan === "string") writeFileSync(path.join(HERE, "redesigned-loader-spec.md"), art.plan);
  } catch { /* result.json still records candidate_ref */ }
}

console.log(`state=${summary.state} reason=${summary.reason} terminal=${summary.terminal ?? "-"}`);
console.log(`declared_obligations=${JSON.stringify(summary.declared_obligations)} matrix_rows=${summary.obligation_rows}`);
console.log(`independent_recheck=${summary.independent_recheck.state} (${summary.independent_recheck.reason})`);
if (summary.conflicts.length) console.log(`CONFLICTS -> The Eye: ${JSON.stringify(summary.conflicts)}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, redesigned-loader-spec.md (if converged), events.jsonl, artifacts/}`);
if (result.state !== "converged-parallel") process.exit(2);
