#!/usr/bin/env node
// Loader redesign RUN 2 — Option C (unrepresentability by construction).
// Parallel-authorship workshop driven through the hardened runParallelDaedalus
// (spine, unmodified). The frame (frame-v2.md) commissions a FEASIBILITY problem:
// find a positive construction making loader acquisition/transfer unrepresentable
// with no runtime mediation, OR prove the frame unsatisfiable.
//
// Three legitimate terminals — submit | needs-eye | infeasible-under-frame — and
// the third is NOT representable in the spine's deriveParallelState (which only
// knows preserved/violated). So this wrapper derives the terminal ITSELF from the
// captured seat outputs (Phase 6), using the spine only for the mechanics and the
// hardening guarantees (five distinct real provenance keys, exact obligation
// bijection, content-bound descent) that back the `submit` path.
//
// The Run 1 runner (docs/runs/clotho-loader-redesign/run-loader-redesign.mjs) is
// NOT altered; the bounded transient-retry discipline is reused, not imported.
//
// Usage:
//   node .../run-loader-redesign-2.mjs --smoke[=submit|conflict|infeasible]  # keyless terminal-logic proof
//   node .../run-loader-redesign-2.mjs                                       # LIVE (codex + claude budget)

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

const SMOKE_ARG = process.argv.find((a) => a === "--smoke" || a.startsWith("--smoke="));
const SMOKE = !!SMOKE_ARG;
const SMOKE_SCENARIO = SMOKE_ARG && SMOKE_ARG.includes("=") ? SMOKE_ARG.split("=")[1] : "submit";
const H = (v) => "sha256:" + sha256hex(canonicalize(v));

const FRAME = readFileSync(path.join(HERE, "frame-v2.md"), "utf8");

const ARTIFACTS = path.join(HERE, "artifacts");
mkdirSync(ARTIFACTS, { recursive: true });
function writeArtifact(value) {
  const ref = H(value);
  writeFileSync(path.join(ARTIFACTS, ref.replace(/^sha256:/, "") + ".json"), JSON.stringify(value, null, 2));
  return { ref };
}
const EVENTS = path.join(HERE, "events.jsonl");
function nowIso() { try { return new Date().toISOString(); } catch { return null; } }
async function appendEvent(event) { appendFileSync(EVENTS, JSON.stringify({ ...event, at: nowIso() }) + "\n"); }

// ---------- per-phase schemas ----------
const AUTHOR_CONSTRAINTS = {
  type: "object", additionalProperties: false,
  properties: {
    plan: { type: "string", description: "Constraints design (markdown): exact invariants, trust boundaries, positive-construction PROOF requirements, filesystem-snapshot obligation, symmetric surface-accounting methodology, adversarial tests. You OWN the invariants; you must NOT prescribe a runtime compartment as the answer." },
    obligations: { type: "array", items: { type: "string" }, description: "Fresh exact obligation IDs (LOAD-C-INV-1 ...), one per invariant. Frozen; the integrator must cover this set as an exact bijection." }
  },
  required: ["plan", "obligations"]
};
const AUTHOR_IMPLEMENTATION = {
  type: "object", additionalProperties: false,
  properties: {
    feasibility: { type: "string", enum: ["feasible", "infeasible"], description: "\"infeasible\" if you conclude the COMPLETE frame cannot be satisfied by any positive construction without smuggling a static residual or runtime mediation." },
    plan: { type: "string", description: "The candidate positive construction (authority/value model, interfaces, data flow, Node-18 zero-dep feasibility, task decomposition) — OR, if infeasible, the precise impossibility argument." },
    infeasibility_basis: { type: "array", items: { type: "string" }, description: "If infeasible: the specific frame criteria that cannot be jointly satisfied and why. Empty if feasible." }
  },
  required: ["feasibility", "plan", "infeasibility_basis"]
};
const LEDGER_ROW = {
  type: "object", additionalProperties: false,
  properties: {
    side: { type: "string", enum: ["added", "retired"], description: "Whether this semantic distinction is INTRODUCED by the redesign or RETIRED from the old four-mechanism model." },
    category: { type: "string", description: "One of: schema, authority-store, parser, resolver, validation-branch, failure-outcome, sync-obligation, runtime-machinery, snapshot-machinery, compatibility-translation, proof-mechanism." },
    item: { type: "string", description: "The one independently meaningful semantic distinction this row counts." }
  },
  required: ["side", "category", "item"]
};
const INTEGRATE = {
  type: "object", additionalProperties: false,
  properties: {
    feasibility: { type: "string", enum: ["feasible", "infeasible"] },
    plan: { type: "string", description: "ONE integrated candidate descending from both sources — OR the agreed impossibility conclusion. You may NOT substitute runtime mediation, accept a static residual, add a source-form blacklist, replace proof with manual annotations, or silently alter either source contract. A genuine conflict must survive to verification." },
    obligation_matrix: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          obligation_id: { type: "string", description: "Exactly one declared obligation ID. Bijection over the declared set; empty matrix only if feasibility=infeasible." },
          invariant: { type: "string" }, mechanism: { type: "string" }, task: { type: "string" },
          negative_test: { type: "string" }, exit_criterion: { type: "string" }
        },
        required: ["obligation_id", "invariant", "mechanism", "task", "negative_test", "exit_criterion"]
      }
    },
    surface_delta_ledger: { type: "array", items: LEDGER_ROW, description: "One row per independently meaningful semantic distinction, symmetric across added/retired. Net (added−retired) must be strictly negative for submit; zero or positive is refusal." },
    source_snapshot_mechanism: { type: "string", description: "The race-free byte-acquisition construction (e.g. pinned Git tree/blob, descriptor-relative no-follow). Required for submit; a repeated lstat walk + path reopen is insufficient." }
  },
  required: ["feasibility", "plan", "obligation_matrix", "surface_delta_ledger", "source_snapshot_mechanism"]
};
const VERIFY = {
  type: "object", additionalProperties: false,
  properties: {
    verdict: { type: "string", enum: ["preserved", "violated", "infeasible-under-frame"], description: "\"preserved\": your contract survived intact. \"violated\": it was weakened/substituted/inverted. \"infeasible-under-frame\": you agree the COMPLETE frame cannot be satisfied and the impossibility argument is complete." },
    conflicts: { type: "array", items: { type: "string" }, description: "Specific violations, or the specific reasons the impossibility argument is/ isn't complete. Empty only for a clean \"preserved\"." }
  },
  required: ["verdict", "conflicts"]
};

const SYSTEM = [
  "You are a principled specification engineer in the Daedalus PARALLEL-authorship workshop of the TELOS build-gate project.",
  "This is RUN 2 of the Clotho loader redesign: Option C — find a POSITIVE CONSTRUCTION that makes loader acquisition and loader-capable value transfer UNREPRESENTABLE, with NO runtime loader mediation, OR prove the frame unsatisfiable (infeasible-under-frame).",
  "Run 1 failed because an integrator closed aliased loader-value reachability by adding a runtime vm.SourceTextModule compartment — the forbidden machinery. Do not repeat that. Do not restore a dangerous-form scanner. Do not accept a residual hole. Do not prove safety by author-asserted labels.",
  "Attack forms are TEST VECTORS, not the enforcement model. Precision over politeness. Node>=18, ESM, ZERO runtime deps, closed sets, fail-closed. Deliverable is a spec section, not code."
].join("\n");

// ---------- prompts ----------
function authorPrompt(role) {
  if (role === "constraints") {
    return [
      "You are the CONSTRAINTS seat. From the FROZEN FRAME below, author the constraints design: exact invariants, trust boundaries, the positive-construction proof requirements (C1–C7), the race-free source-snapshot obligation (C6), the SYMMETRIC surface-accounting methodology (C7), and adversarial tests drawn from the frame's proof cases (as test vectors, not per-form rules).",
      "You must NOT prescribe a runtime compartment, an import hook, or any runtime mediation as the answer. Your job is to state what must be TRUE and PROVEN, not how to intercept loads at runtime.",
      "Declare `obligations`: the fresh exact ID set (LOAD-C-INV-1 ...), one per invariant, that the integrator must cover as an exact bijection.",
      "Return `plan` = your constraints design (markdown).", "", "=== FROZEN FRAME ===", FRAME
    ].join("\n");
  }
  return [
    "You are the IMPLEMENTATION seat. From the FROZEN FRAME below, author a candidate POSITIVE CONSTRUCTION in which loader acquisition and loader-capable value transfer are unrepresentable — a closed cross-unit value model (C3), an exact transitive authority closure (C1), no ambient loader authority (C2), race-free byte acquisition (C6) — with NO runtime loader compartment and NO dangerous-form scanner.",
    "If, after genuine effort, you conclude the COMPLETE frame cannot be satisfied by any positive construction without smuggling a static residual (Run 1's aliased-value hole) or runtime mediation (Run 1's compartment), return feasibility=\"infeasible\" with a precise `infeasibility_basis`. Returning infeasible with a complete argument is a VALID, honorable outcome — inventing frame-breaking machinery to force feasibility is not.",
    "Carry an HONEST behavioral-delta intent (C7). Return `feasibility`, `plan`, `infeasibility_basis`.", "", "=== FROZEN FRAME ===", FRAME
  ].join("\n");
}
function integratePrompt(sources) {
  const cons = sources.find((s) => s.role === "constraints") || {};
  const impl = sources.find((s) => s.role === "implementation") || {};
  const ids = Array.isArray(cons.obligations) ? cons.obligations : [];
  return [
    "You are the INTEGRATOR. Produce ONE candidate descending from BOTH source designs — the constraints contract AND the implementation construction — such that BOTH are simultaneously true. This is the Option-C question: does a third construction make both contracts hold at once?",
    "You may NOT: substitute runtime mediation (no vm.SourceTextModule, module.register, --loader, import hooks, resolver callbacks); accept a static residual (Run 1's aliased-value hole); add a source-form blacklist; replace proof with manual annotations (loaderSafe:true etc.); or silently alter/select one source contract over the other. If the two contracts are genuinely incompatible, DO NOT blend — carry the tension forward so the verifiers surface it.",
    "If you conclude no construction satisfies both, set feasibility=\"infeasible\" with the impossibility argument in `plan` and an empty obligation_matrix.",
    "Otherwise set feasibility=\"feasible\", cover EVERY declared obligation ID as an exact bijection in `obligation_matrix`, provide a strictly-symmetric `surface_delta_ledger` (one row per semantic distinction, honest added/retired), and a race-free `source_snapshot_mechanism`.",
    "", `Declared obligation IDs to cover EXACTLY: ${JSON.stringify(ids)}`, "",
    "=== CONSTRAINTS SOURCE ===", cons.body != null ? cons.body : "(missing)", "",
    "=== IMPLEMENTATION SOURCE ===", impl.body != null ? impl.body : "(missing)"
  ].join("\n");
}
function verifyPrompt(role, yourSource, integration) {
  const own = role === "constraints"
    ? "Do the integrated candidate and its obligation matrix ESTABLISH every invariant you declared — by positive construction, with a complete race-free snapshot proof and an honest symmetric ledger — with NO residual hole and NO runtime mediation?"
    : "Does the integrated candidate PRESERVE your construction — closed value model, no ambient loader authority, no runtime compartment, race-free bytes — without inverting your enforcement point or substituting machinery you forbade?";
  return [
    `You are the ${role.toUpperCase()} seat verifying the integrated candidate against YOUR contract.`,
    own,
    "Return verdict \"preserved\" ONLY if your entire contract holds. Return \"violated\" if it was weakened, substituted, inverted, or a residual/runtime path was smuggled in. Return \"infeasible-under-frame\" ONLY if the candidate is an impossibility conclusion AND you agree the COMPLETE frame cannot be satisfied and the argument is complete. Any disagreement or incompleteness is a conflict for The Eye — be exact, do not blend.",
    "", "=== YOUR SOURCE DESIGN ===", yourSource && yourSource.body != null ? yourSource.body : "(missing)",
    "", "=== INTEGRATED CANDIDATE ===", integration && integration.plan != null ? integration.plan : "(missing)",
    "", "=== OBLIGATION MATRIX ===", integration && integration.obligation_matrix ? JSON.stringify(integration.obligation_matrix, null, 2) : "(none)",
    "", "=== SURFACE-DELTA LEDGER ===", integration && integration.surface_delta_ledger ? JSON.stringify(integration.surface_delta_ledger, null, 2) : "(none)",
    "", "=== SOURCE SNAPSHOT MECHANISM ===", integration && integration.source_snapshot_mechanism || "(none)"
  ].join("\n");
}

// ---------- transient retry (reused discipline; never retries 4xx funding/auth) ----------
function isTransient(err) {
  const m = String(err && err.message || "");
  if (/API error 4\d\d/.test(m)) return false;
  return /API error 5\d\d/.test(m) || /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up|network|timeout/i.test(m);
}
async function askWithRetry(ask, args, label) {
  const backoffs = [5000, 15000, 45000];
  for (let attempt = 0; ; attempt++) {
    try { return await ask(args); }
    catch (e) {
      if (attempt >= backoffs.length || !isTransient(e)) throw e;
      console.log(`[retry] ${label} transient (${attempt + 1}/${backoffs.length}): ${String(e.message).slice(0, 140)} — ${backoffs[attempt] / 1000}s`);
      await new Promise((r) => setTimeout(r, backoffs[attempt]));
    }
  }
}

// ---------- side-channel capture (spine carries only a subset of each response) ----------
const CAPTURED = {};
function askFor(seat) { return seat === "claude" ? seatModule.askClaude : seatModule.askCodex; }
function providerFor(seat) { return seat === "claude" ? "anthropic" : "openai"; }

async function liveCallParallelSeat({ seat, role, phase, sources, integration }) {
  const ask = askFor(seat);
  let prompt, schema, schemaName;
  if (phase === "author") { prompt = authorPrompt(role); schema = role === "constraints" ? AUTHOR_CONSTRAINTS : AUTHOR_IMPLEMENTATION; schemaName = `run2_author_${role}`; }
  else if (phase === "integrate") { prompt = integratePrompt(sources || []); schema = INTEGRATE; schemaName = "run2_integration"; }
  else { prompt = verifyPrompt(role, (sources || [])[0], integration); schema = VERIFY; schemaName = `run2_verify_${role}`; }
  const r = await askWithRetry(ask, { prompt, system: SYSTEM, model: seat, effort: "high", max_tokens: 60000, response_schema: schema, schema_name: schemaName }, `${seat}/${role}/${phase}`);
  let parsed;
  try { parsed = JSON.parse(r.text); }
  catch (e) { writeFileSync(path.join(HERE, `unparsable-${seat}-${role}-${phase}-${Date.now()}.txt`), r.text ?? ""); throw new Error(`Seat ${seat}/${role}/${phase} unparsable JSON: ${e.message}`); }
  const provenance = { provider: providerFor(seat), model: r.model, response_id: r.id, source: `ai-peer-mcp/${seat === "claude" ? "claude_ask" : "codex_ask"}`, answered_at: nowIso() };
  CAPTURED[`${phase}:${role}`] = { ...parsed, seat, role, phase, provenance };
  if (phase === "author") return { plan: parsed.plan ?? "", ...(role === "constraints" ? { obligations: Array.isArray(parsed.obligations) ? parsed.obligations : [] } : {}), provenance };
  if (phase === "integrate") return { plan: parsed.plan ?? "", obligation_matrix: Array.isArray(parsed.obligation_matrix) ? parsed.obligation_matrix : [], provenance };
  return { verdict: parsed.verdict, conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [], provenance };
}

// ---------- smoke stubs (keyless terminal-logic proof; distinct real provenance per call) ----------
function makeSmoke(scenario) {
  let n = 0;
  const OBL = ["LOAD-C-INV-1", "LOAD-C-INV-2"];
  const row = (id) => ({ obligation_id: id, invariant: "inv " + id, mechanism: "mech " + id, task: "task " + id, negative_test: "neg " + id, exit_criterion: "exit " + id });
  const ledgerNeg = [
    { side: "retired", category: "resolver", item: "form scanner" }, { side: "retired", category: "authority-store", item: "safe-export allowlist" },
    { side: "retired", category: "resolver", item: "separate closure derivation" }, { side: "retired", category: "compatibility-translation", item: "recognizer coupling" },
    { side: "added", category: "schema", item: "closed authority graph" }
  ]; // added 1, retired 4 -> net -3
  return async ({ seat, role, phase }) => {
    n++;
    const provenance = { provider: providerFor(seat), model: "smoke", response_id: `smoke_${seat}_${role}_${phase}_${n}`, source: "smoke", answered_at: nowIso() };
    const cap = (obj) => { CAPTURED[`${phase}:${role}`] = { ...obj, seat, role, phase, provenance }; return obj; };
    if (phase === "author") {
      if (role === "constraints") { cap({ plan: "# constraints (smoke)\n", obligations: OBL }); return { plan: "# constraints (smoke)\n", obligations: OBL, provenance }; }
      const feas = scenario === "infeasible" ? "infeasible" : "feasible";
      cap({ feasibility: feas, plan: "# impl (smoke)\n", infeasibility_basis: feas === "infeasible" ? ["C2 and C6 cannot both hold under zero-dep Node 18"] : [] });
      return { plan: "# impl (smoke)\n", provenance };
    }
    if (phase === "integrate") {
      if (scenario === "infeasible") { cap({ feasibility: "infeasible", plan: "# impossibility (smoke)\n", obligation_matrix: [], surface_delta_ledger: [], source_snapshot_mechanism: "" }); return { plan: "# impossibility (smoke)\n", obligation_matrix: [], provenance }; }
      cap({ feasibility: "feasible", plan: "# integrated candidate (smoke)\n", obligation_matrix: OBL.map(row), surface_delta_ledger: ledgerNeg, source_snapshot_mechanism: "pinned git tree/blob from a fixed commit; descriptor-relative no-follow reads" });
      return { plan: "# integrated candidate (smoke)\n", obligation_matrix: OBL.map(row), provenance };
    }
    // verify
    let verdict;
    if (scenario === "infeasible") verdict = "infeasible-under-frame";
    else if (scenario === "conflict") verdict = role === "constraints" ? "violated" : "preserved";
    else verdict = "preserved";
    cap({ verdict, conflicts: verdict === "preserved" || verdict === "infeasible-under-frame" ? [] : ["smoke conflict"] });
    return { verdict, conflicts: verdict === "preserved" ? [] : ["smoke conflict"], provenance };
  };
}

// ---------- Phase 6: independent terminal derivation ----------
function ledgerNet(ledger) {
  if (!Array.isArray(ledger) || !ledger.length) return null;
  let added = 0, retired = 0;
  for (const r of ledger) { if (!r || (r.side !== "added" && r.side !== "retired")) return null; r.side === "added" ? added++ : retired++; }
  return { added, retired, net: added - retired };
}
function deriveTerminal(result) {
  const vC = CAPTURED["verify:constraints"] || {}, vI = CAPTURED["verify:implementation"] || {};
  const integ = CAPTURED["integrate:integration"] || {};
  const verdicts = { constraints: vC.verdict ?? null, implementation: vI.verdict ?? null };
  const net = ledgerNet(integ.surface_delta_ledger);
  const snapshot = typeof integ.source_snapshot_mechanism === "string" && integ.source_snapshot_mechanism.trim();
  // 1. Agreed infeasibility — both verifiers conclude the complete frame is unsatisfiable.
  if (vC.verdict === "infeasible-under-frame" && vI.verdict === "infeasible-under-frame")
    return { terminal: "infeasible-under-frame", reason: "both-verifiers-agree-frame-unsatisfiable", verdicts, ledger_net: net, snapshot_present: !!snapshot };
  // 2. Submit — spine's hardened converged verdict + honest strictly-negative surface + snapshot proof.
  if (result.state === "converged-parallel") {
    const problems = [];
    if (!net) problems.push("surface-ledger-malformed-or-empty");
    else if (net.net >= 0) problems.push(`surface-not-strictly-negative(added=${net.added},retired=${net.retired},net=${net.net})`);
    if (!snapshot) problems.push("source-snapshot-proof-absent");
    if (!problems.length) return { terminal: "submit", reason: "both-preserved+negative-surface+snapshot", verdicts, ledger_net: net, snapshot_present: true };
    return { terminal: "needs-eye", reason: "preserved-but:" + problems.join("+"), verdicts, ledger_net: net, snapshot_present: !!snapshot };
  }
  // 3. Everything else — disagreement, substitution, incomplete accounting, uncertain feasibility.
  return { terminal: "needs-eye", reason: "unresolved:" + (result.reason || result.state), verdicts, ledger_net: net, snapshot_present: !!snapshot };
}

// ---------- run ----------
if (!SMOKE) {
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"]) {
    if (!process.env[key]) { console.error(`Missing ${key}. Fund both seats (Anthropic + OpenAI) or run with --smoke.`); process.exit(1); }
  }
}
const callSeat = SMOKE ? makeSmoke(SMOKE_SCENARIO) : liveCallParallelSeat;
console.log(`Loader redesign RUN 2 (Option C) — ${SMOKE ? `SMOKE[${SMOKE_SCENARIO}]` : "LIVE (codex/gpt-5.6-sol + claude/fable-5, effort high)"}`);

const result = await runParallelDaedalus({ frame: FRAME, callSeat, writeArtifact, appendEvent });
// Independent cross-check of the spine's structural verdict (never trust the caller/driver).
const recheck = deriveParallelState({ sources: result.sources, integration: result.integration, verifications: result.verifications });
const term = deriveTerminal(result);

const consAuthor = CAPTURED["author:constraints"] || {}, implAuthor = CAPTURED["author:implementation"] || {}, integ = CAPTURED["integrate:integration"] || {};
const summary = {
  run: "loader-redesign-2 (Option C)", mode: SMOKE ? `smoke:${SMOKE_SCENARIO}` : "live",
  terminal: term.terminal, terminal_reason: term.reason,
  spine_state: result.state, spine_reason: result.reason, independent_recheck: { state: recheck.state, reason: recheck.reason, terminal: recheck.terminal },
  implementation_feasibility: implAuthor.feasibility ?? null, integration_feasibility: integ.feasibility ?? null,
  declared_obligations: (result.sources || []).find((s) => s.role === "constraints")?.obligations ?? null,
  obligation_rows: (result.integration && result.integration.obligation_matrix) ? result.integration.obligation_matrix.length : 0,
  verifier_verdicts: term.verdicts, surface_delta: term.ledger_net, surface_counting: "one row per independently meaningful semantic distinction; net = added − retired; strictly negative required for submit",
  source_snapshot_mechanism: integ.source_snapshot_mechanism ?? null, snapshot_present: term.snapshot_present,
  candidate_ref: result.candidate_ref ?? null,
  infeasibility_basis: implAuthor.infeasibility_basis ?? null,
  conflicts: { constraints: (CAPTURED["verify:constraints"] || {}).conflicts ?? [], implementation: (CAPTURED["verify:implementation"] || {}).conflicts ?? [] },
  creation_lineage: [
    ...(result.sources || []).map((s) => ({ seat: s.seat, role: s.role, phase: "author", provenance: s.provenance, provenance_key: s.provenance_key })),
    ...(result.integration ? [{ seat: result.integration.seat, role: "integration", phase: "integrate", provenance: result.integration.provenance, provenance_key: result.integration.provenance_key }] : []),
    ...(result.verifications || []).map((v) => ({ seat: v.seat, role: v.role, phase: "verify", verdict: v.verdict, provenance: v.provenance, provenance_key: v.provenance_key }))
  ]
};
writeFileSync(path.join(HERE, "result.json"), JSON.stringify(summary, null, 2));

// ---------- terminal-specific deliverable ----------
function candidatePlan() {
  if (!result.candidate_ref) return null;
  try { return JSON.parse(readFileSync(path.join(ARTIFACTS, String(result.candidate_ref).replace(/^sha256:/, "") + ".json"), "utf8")).plan; } catch { return null; }
}
if (term.terminal === "submit") {
  const plan = candidatePlan();
  if (typeof plan === "string") writeFileSync(path.join(HERE, "candidate.md"), plan);
} else if (term.terminal === "infeasible-under-frame") {
  writeFileSync(path.join(HERE, "infeasible.md"), [
    "# Loader redesign Run 2 — infeasible-under-frame",
    "", "Both verifiers agree the complete frame (frame-v2.md) cannot be satisfied by a positive",
    "construction without smuggling a static residual or runtime mediation. No merge, no residual, no",
    "compartment was accepted.", "",
    "## Implementation impossibility basis", ...(implAuthor.infeasibility_basis || []).map((b) => `- ${b}`),
    "", "## Integrator conclusion", integ.plan || "(see artifacts)",
    "", "## Verifier agreement",
    `- constraints: ${(CAPTURED["verify:constraints"] || {}).verdict} — ${JSON.stringify((CAPTURED["verify:constraints"] || {}).conflicts || [])}`,
    `- implementation: ${(CAPTURED["verify:implementation"] || {}).verdict} — ${JSON.stringify((CAPTURED["verify:implementation"] || {}).conflicts || [])}`,
    "", "The human-held Eye decides what follows; this is a finding, not a decision."
  ].join("\n"));
} else {
  writeFileSync(path.join(HERE, "needs-eye.md"), [
    "# Loader redesign Run 2 — needs-eye",
    "", `Terminal: needs-eye. Reason: ${term.reason}.`,
    `Spine state: ${result.state} (${result.reason}); independent recheck: ${recheck.state} (${recheck.reason}).`,
    `Verifier verdicts: constraints=${term.verdicts.constraints}, implementation=${term.verdicts.implementation}.`,
    `Surface delta: ${JSON.stringify(term.ledger_net)}; snapshot present: ${term.snapshot_present}.`,
    "", "## Constraints verifier conflicts", ...((CAPTURED["verify:constraints"] || {}).conflicts || []).map((c) => `- ${c}`),
    "", "## Implementation verifier conflicts", ...((CAPTURED["verify:implementation"] || {}).conflicts || []).map((c) => `- ${c}`),
    "", "No blending. The human-held Eye adjudicates the fork; no seat output is the decision."
  ].join("\n"));
}

console.log(`terminal=${term.terminal} reason=${term.reason}`);
console.log(`spine_state=${result.state} recheck=${recheck.state} feas(impl)=${summary.implementation_feasibility} feas(integ)=${summary.integration_feasibility}`);
console.log(`obligations=${JSON.stringify(summary.declared_obligations)} rows=${summary.obligation_rows} verdicts=${JSON.stringify(term.verdicts)}`);
console.log(`surface_delta=${JSON.stringify(term.ledger_net)} snapshot=${term.snapshot_present}`);
console.log(`candidate_ref=${summary.candidate_ref ?? "-"}`);
console.log(`Outputs: ${path.relative(ROOT, HERE)}/{result.json, (candidate|needs-eye|infeasible).md, events.jsonl, artifacts/}`);
// Exit code encodes terminal for the launcher: 0 submit, 2 needs-eye, 3 infeasible-under-frame.
process.exit(term.terminal === "submit" ? 0 : term.terminal === "infeasible-under-frame" ? 3 : 2);
