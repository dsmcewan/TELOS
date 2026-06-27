#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { validateGate, validateRecords } from "../gate.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ex = (p) => path.join(PKG_ROOT, p);

const passReport = await validateGate(
  ex("examples/pass/dossier.json"),
  ex("examples/pass/packets")
);
assert.equal(passReport.gate_status, "pass");
assert.equal(passReport.safe_next_action, "begin-build");
assert.deepEqual(passReport.blockers, []);

const missingDocReport = await validateGate(
  ex("examples/missing-doc/dossier.json"),
  ex("examples/missing-doc/packets")
);
assert.equal(missingDocReport.gate_status, "blocked");
assert.ok(
  missingDocReport.blockers.some((blocker) => blocker.includes("Required doc was not reviewed")),
  "missing documentation coverage should block the gate"
);

const protectedPathReport = await validateGate(
  ex("examples/protected-path/dossier.json"),
  ex("examples/protected-path/packets")
);
assert.equal(protectedPathReport.gate_status, "blocked");
assert.ok(
  protectedPathReport.blockers.some((blocker) => blocker.includes("protected path")),
  "protected write targets should block the gate"
);

const reviseReport = validateRecords(
  {
    build_id: "revise-demo",
    use_case: "codex-revise",
    objective: "Show Codex revise blocks.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: []
  },
  [
    approvalPacket("revise-demo", "codex-revise", "claude", ["doc-a"]),
    approvalPacket("revise-demo", "codex-revise", "agy", []),
    {
      ...approvalPacket("revise-demo", "codex-revise", "codex", []),
      decision: "revise",
      required_edits: ["Add a protected-path test."]
    }
  ]
);
assert.equal(reviseReport.gate_status, "blocked");
assert.ok(
  reviseReport.blockers.some((blocker) => blocker.includes("codex decision is 'revise'")),
  "Codex revise should block the gate"
);

const agyHardStopReport = validateRecords(
  {
    build_id: "agy-stop-demo",
    use_case: "agy-hard-stop",
    objective: "Show Agy hard stops block.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: []
  },
  [
    approvalPacket("agy-stop-demo", "agy-hard-stop", "claude", ["doc-a"]),
    {
      ...approvalPacket("agy-stop-demo", "agy-hard-stop", "agy", []),
      hard_stops: ["Missing phase ledger."]
    },
    approvalPacket("agy-stop-demo", "agy-hard-stop", "codex", [])
  ]
);
assert.equal(agyHardStopReport.gate_status, "blocked");
assert.ok(
  agyHardStopReport.blockers.some((blocker) => blocker.includes("agy has hard stops")),
  "Agy hard stops should block the gate"
);

const grokUnresolvedReport = validateRecords(
  {
    build_id: "grok-demo",
    use_case: "grok-unresolved",
    objective: "Show unresolved Grok hard stops block.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: [],
    grok_objections: []
  },
  [
    approvalPacket("grok-demo", "grok-unresolved", "claude", ["doc-a"]),
    approvalPacket("grok-demo", "grok-unresolved", "agy", []),
    approvalPacket("grok-demo", "grok-unresolved", "codex", []),
    {
      ...approvalPacket("grok-demo", "grok-unresolved", "grok", []),
      role: "adversarial-review",
      decision: "advisory-note",
      hard_stops: ["Archive copy drift risk."]
    }
  ]
);
assert.equal(grokUnresolvedReport.gate_status, "blocked");
assert.ok(
  grokUnresolvedReport.blockers.some((blocker) => blocker.includes("Grok hard stop is unresolved")),
  "unresolved Grok hard stops should block the gate"
);

const cliPass = spawnSync(
  process.execPath,
  ["gate.mjs", "validate", "examples/pass/dossier.json", "examples/pass/packets"],
  { cwd: new URL("..", import.meta.url), encoding: "utf8" }
);
assert.equal(cliPass.status, 0, cliPass.stderr);
assert.match(cliPass.stdout, /"gate_status": "pass"/);

const cliBlocked = spawnSync(
  process.execPath,
  ["gate.mjs", "validate", "examples/protected-path/dossier.json", "examples/protected-path/packets"],
  { cwd: new URL("..", import.meta.url), encoding: "utf8" }
);
assert.equal(cliBlocked.status, 1, cliBlocked.stderr);
assert.match(cliBlocked.stdout, /"gate_status": "blocked"/);

const prototypePassReport = await validateGate(
  ex("examples/prototype-pass/dossier.json"),
  ex("examples/prototype-pass/packets"),
  { capabilityDir: ex("examples/prototype-pass/capabilities") }
);
assert.equal(prototypePassReport.gate_status, "pass");
assert.deepEqual(
  prototypePassReport.required_capability_models,
  ["claude", "codex", "agy", "grok"]
);
assert.deepEqual(
  prototypePassReport.capability_packets_seen,
  ["agy", "claude", "codex", "grok"]
);

const capabilityBlockedReport = await validateGate(
  ex("examples/capability-blocked/dossier.json"),
  ex("examples/capability-blocked/packets"),
  { capabilityDir: ex("examples/capability-blocked/capabilities") }
);
assert.equal(capabilityBlockedReport.gate_status, "blocked");
assert.ok(
  capabilityBlockedReport.blockers.some((blocker) => blocker.includes("requires user/plugin/API setup")),
  "unresolved user setup should block prototype gate"
);

const convergenceDemoReport = await validateGate(
  ex("examples/convergence-demo/dossier.json"),
  ex("examples/convergence-demo/packets"),
  {
    capabilityDir: ex("examples/convergence-demo/capabilities"),
    marketReadinessDir: ex("examples/convergence-demo/market")
  }
);
assert.equal(convergenceDemoReport.gate_status, "pass");
assert.deepEqual(
  convergenceDemoReport.capability_packets_seen,
  ["agy", "claude", "codex", "grok"]
);
assert.deepEqual(
  convergenceDemoReport.required_market_workstreams,
  [
    "business-positioning",
    "product-architecture",
    "backend-schema",
    "security-trust",
    "accuracy-evals",
    "scale-operations",
    "frontend-brand-experience"
  ]
);
assert.deepEqual(
  convergenceDemoReport.market_packets_seen,
  ["agy", "claude", "codex", "grok"]
);

const notPresentedReport = validateRecords(
  {
    build_id: "not-presented-demo",
    idea_id: "idea-not-presented",
    use_case: "capability-not-presented",
    telos: "Show missing capabilities must be presented to Claude.",
    objective: "Negative test.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: [],
    required_capability_models: ["codex"]
  },
  [
    approvalPacket("not-presented-demo", "capability-not-presented", "claude", ["doc-a"]),
    approvalPacket("not-presented-demo", "capability-not-presented", "agy", []),
    approvalPacket("not-presented-demo", "capability-not-presented", "codex", [])
  ],
  {},
  [
    {
      build_id: "not-presented-demo",
      idea_id: "idea-not-presented",
      model: "codex",
      telos: "Show missing capabilities must be presented to Claude.",
      docs_needed: [],
      skills_needed: [],
      connectors_needed: [],
      available_now: [],
      missing_capabilities: ["local helper script"],
      can_build_during_planning: ["local helper script"],
      built_during_planning: [],
      must_request_user_or_install: [],
      presented_to_claude: false,
      recommendation_to_claude: "Do not build until this is surfaced.",
      timestamp: "2026-06-26T13:00:00-04:00"
    }
  ]
);
assert.equal(notPresentedReport.gate_status, "blocked");
assert.ok(
  notPresentedReport.blockers.some((blocker) => blocker.includes("not presented to Claude")),
  "missing capabilities not presented to Claude should block"
);

const marketNeedsWorkReport = validateRecords(
  {
    build_id: "market-needs-work-demo",
    idea_id: "idea-market-needs-work",
    use_case: "market-readiness-needs-work",
    objective: "Show weak frontend design blocks market-bound builds.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: [],
    market_bound: true,
    user_facing_frontend: true,
    required_market_workstreams: ["frontend-brand-experience"]
  },
  [
    approvalPacket("market-needs-work-demo", "market-readiness-needs-work", "claude", ["doc-a"]),
    approvalPacket("market-needs-work-demo", "market-readiness-needs-work", "agy", []),
    approvalPacket("market-needs-work-demo", "market-readiness-needs-work", "codex", [])
  ],
  {},
  [],
  [
    marketPacket({
      buildId: "market-needs-work-demo",
      ideaId: "idea-market-needs-work",
      model: "codex",
      workstreams: ["frontend-brand-experience"],
      lexiStatus: "needs-work",
      blockers: []
    })
  ]
);
assert.equal(marketNeedsWorkReport.gate_status, "blocked");
assert.ok(
  marketNeedsWorkReport.blockers.some((blocker) => blocker.includes("LEXI-class UI")),
  "LEXI-class frontend needs-work should block market-bound user-facing builds"
);

// --- "meets" requires a passing breakout record ---------------------------
function marketMeetsDossier(id) {
  return {
    build_id: id,
    idea_id: `idea-${id}`,
    use_case: id,
    objective: "Show meets requires a breakout record.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: [],
    market_bound: true,
    user_facing_frontend: true,
    required_market_workstreams: ["frontend-brand-experience"]
  };
}
function marketMeetsApprovals(id) {
  return [
    approvalPacket(id, id, "claude", ["doc-a"]),
    approvalPacket(id, id, "agy", []),
    approvalPacket(id, id, "codex", [])
  ];
}

// A claim of meets with NO breakout record is blocked.
const meetsNoBreakout = validateRecords(
  marketMeetsDossier("meets-no-breakout"),
  marketMeetsApprovals("meets-no-breakout"),
  {},
  [],
  [marketPacket({ buildId: "meets-no-breakout", ideaId: "idea-meets-no-breakout", model: "claude", workstreams: ["frontend-brand-experience"], lexiStatus: "meets" })]
);
assert.equal(meetsNoBreakout.gate_status, "blocked");
assert.ok(
  meetsNoBreakout.blockers.some((b) => b.toLowerCase().includes("breakout")),
  "meets without a breakout record must block"
);

// A claim of meets backed by an UNCONVERGED breakout record is blocked.
const meetsBadBreakout = validateRecords(
  marketMeetsDossier("meets-bad-breakout"),
  marketMeetsApprovals("meets-bad-breakout"),
  {},
  [],
  [marketPacket({
    buildId: "meets-bad-breakout", ideaId: "idea-meets-bad-breakout", model: "claude",
    workstreams: ["frontend-brand-experience"], lexiStatus: "meets",
    breakout: { workstream: "frontend-brand-experience", finalStatus: "needs-work", converged: false, surviving_blockers: ["still broken"], rounds: [{ round: 1, blockers: ["still broken"], resolved: [] }] }
  })]
);
assert.equal(meetsBadBreakout.gate_status, "blocked");
assert.ok(
  meetsBadBreakout.blockers.some((b) => b.toLowerCase().includes("breakout")),
  "meets with an unconverged breakout must block"
);

// A claim of meets backed by a passing breakout record passes the gate.
const meetsGoodBreakout = validateRecords(
  marketMeetsDossier("meets-good-breakout"),
  marketMeetsApprovals("meets-good-breakout"),
  {},
  [],
  [marketPacket({ buildId: "meets-good-breakout", ideaId: "idea-meets-good-breakout", model: "claude", workstreams: ["frontend-brand-experience"], lexiStatus: "meets", breakout: passingBreakout() })]
);
assert.equal(
  meetsGoodBreakout.gate_status,
  "pass",
  `meets with a passing breakout record should pass; blockers: ${JSON.stringify(meetsGoodBreakout.blockers)}`
);

// FABRICATED FACTS: converged:true is asserted, but the gate RE-RUNS the record's
// declared checks and one fails (a file that does not exist) -> blocked. This is
// the core of the fix: the gate's verdict comes from its own re-verification,
// not from the packet's self-reported boolean.
const meetsFabricated = validateRecords(
  marketMeetsDossier("meets-fabricated"),
  marketMeetsApprovals("meets-fabricated"),
  {},
  [],
  [marketPacket({
    buildId: "meets-fabricated", ideaId: "idea-meets-fabricated", model: "claude",
    workstreams: ["frontend-brand-experience"], lexiStatus: "meets",
    breakout: {
      workstream: "frontend-brand-experience", finalStatus: "meets", converged: true,
      surviving_blockers: [], go_to_market_blockers: [],
      // self-reports success, but this file does not exist under the base dir
      checks: [{ type: "file_exists", path: "this-artifact-was-never-produced.png" }],
      rounds: [{ round: 1, blockers: [], resolved: [] }]
    }
  })]
);
assert.equal(meetsFabricated.gate_status, "blocked");
assert.ok(
  meetsFabricated.blockers.some((b) => b.toLowerCase().includes("re-verif")),
  `fabricated 'meets' must be caught by gate re-verification; blockers: ${JSON.stringify(meetsFabricated.blockers)}`
);

// NO RE-VERIFIABLE CHECKS: a record claiming meets but carrying no declarative
// read-only checks the gate can re-run -> blocked (cannot be confirmed).
const meetsNoChecks = validateRecords(
  marketMeetsDossier("meets-no-checks"),
  marketMeetsApprovals("meets-no-checks"),
  {},
  [],
  [marketPacket({
    buildId: "meets-no-checks", ideaId: "idea-meets-no-checks", model: "claude",
    workstreams: ["frontend-brand-experience"], lexiStatus: "meets",
    breakout: {
      workstream: "frontend-brand-experience", finalStatus: "meets", converged: true,
      surviving_blockers: [], go_to_market_blockers: [],
      checks: [{ type: "command", command: "npm", args: ["test"] }], // not gate-re-verifiable
      rounds: [{ round: 1, blockers: [], resolved: [] }]
    }
  })]
);
assert.equal(meetsNoChecks.gate_status, "blocked");
assert.ok(
  meetsNoChecks.blockers.some((b) => b.toLowerCase().includes("re-verif") || b.toLowerCase().includes("verifiable")),
  `'meets' with no gate-verifiable checks must block; blockers: ${JSON.stringify(meetsNoChecks.blockers)}`
);

const marketBlockerReport = validateRecords(
  {
    build_id: "market-blocker-demo",
    idea_id: "idea-market-blocker",
    use_case: "market-readiness-blocker",
    objective: "Show go-to-market blockers block market-bound builds.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    protected_paths: [],
    market_bound: true,
    required_market_workstreams: ["security-trust"]
  },
  [
    approvalPacket("market-blocker-demo", "market-readiness-blocker", "claude", ["doc-a"]),
    approvalPacket("market-blocker-demo", "market-readiness-blocker", "agy", []),
    approvalPacket("market-blocker-demo", "market-readiness-blocker", "codex", [])
  ],
  {},
  [],
  [
    marketPacket({
      buildId: "market-blocker-demo",
      ideaId: "idea-market-blocker",
      model: "grok",
      workstreams: ["security-trust"],
      blockers: ["Threat model is missing for auth and secrets."]
    })
  ]
);
assert.equal(marketBlockerReport.gate_status, "blocked");
assert.ok(
  marketBlockerReport.blockers.some((blocker) => blocker.includes("go-to-market blockers")),
  "go-to-market blockers should block market-bound builds"
);

const marketPassCli = spawnSync(
  process.execPath,
  [
    "gate.mjs",
    "validate",
    "examples/market-pass/dossier.json",
    "examples/market-pass/packets",
    "--market-readiness",
    "examples/market-pass/market"
  ],
  { cwd: new URL("..", import.meta.url), encoding: "utf8" }
);
assert.equal(marketPassCli.status, 0, marketPassCli.stderr);
assert.match(marketPassCli.stdout, /"gate_status": "pass"/);

// Test 1: Sibling paths like me/gemini-addon are NOT blocked when me/gemini/ is protected.
const siblingPathReport = validateRecords(
  {
    build_id: "sibling-demo",
    use_case: "sibling-check",
    objective: "Verify sibling paths are not blocked.",
    required_docs: ["doc-a"],
    write_targets: ["me/gemini-addon/foo.txt"],
    protected_paths: ["me/gemini/"]
  },
  [
    approvalPacket("sibling-demo", "sibling-check", "claude", ["doc-a"]),
    approvalPacket("sibling-demo", "sibling-check", "agy", []),
    approvalPacket("sibling-demo", "sibling-check", "codex", [])
  ]
);
assert.equal(siblingPathReport.gate_status, "pass");

// Test 2: A write target containing directory traversal (e.g. shared/../../CHATGPT/exploit.md) is blocked.
const traversalReport = validateRecords(
  {
    build_id: "traversal-demo",
    use_case: "traversal-check",
    objective: "Verify traversal is blocked.",
    required_docs: ["doc-a"],
    write_targets: ["shared/../../CHATGPT/exploit.md"],
    protected_paths: ["CHATGPT/"]
  },
  [
    approvalPacket("traversal-demo", "traversal-check", "claude", ["doc-a"]),
    approvalPacket("traversal-demo", "traversal-check", "agy", []),
    approvalPacket("traversal-demo", "traversal-check", "codex", [])
  ]
);
assert.equal(traversalReport.gate_status, "blocked");
assert.ok(
  traversalReport.blockers.some((blocker) => blocker.includes("inside protected path")),
  "traversal write target should block the gate"
);

// Test 3: LEXI gate verify lexi_reference_read is true and canonical docs_reviewed has "shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md" (case/slash insensitive).
// Case A: lexi_required is true but lexi_reference_read is false.
const lexiReadFailReport = validateRecords(
  {
    build_id: "lexi-fail-demo",
    use_case: "lexi-check",
    objective: "LEXI check",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: false
  },
  [
    approvalPacket("lexi-fail-demo", "lexi-check", "claude", ["doc-a", "shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md"]),
    approvalPacket("lexi-fail-demo", "lexi-check", "agy", []),
    approvalPacket("lexi-fail-demo", "lexi-check", "codex", [])
  ]
);
assert.equal(lexiReadFailReport.gate_status, "blocked");
assert.ok(
  lexiReadFailReport.blockers.some((blocker) => blocker.includes("lexi_reference_read is not true")),
  "lexi_reference_read false should block"
);

// Case B: lexi_required is true, lexi_reference_read is true, but docs_reviewed lacks the reference doc.
const lexiDocFailReport = validateRecords(
  {
    build_id: "lexi-doc-fail-demo",
    use_case: "lexi-check",
    objective: "LEXI check",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: true
  },
  [
    approvalPacket("lexi-doc-fail-demo", "lexi-check", "claude", ["doc-a"]),
    approvalPacket("lexi-doc-fail-demo", "lexi-check", "agy", []),
    approvalPacket("lexi-doc-fail-demo", "lexi-check", "codex", [])
  ]
);
assert.equal(lexiDocFailReport.gate_status, "blocked");
assert.ok(
  lexiDocFailReport.blockers.some((blocker) => blocker.includes("LEXI reference document")),
  "missing LEXI DB reference doc in reviewed docs should block"
);

// Case C: lexi_required is true, lexi_reference_read is true, and doc is reviewed (with case/slash variation: "SHARED\\Filing_Package_July_2026\\lexi_db_reference.md")
const lexiPassReport = validateRecords(
  {
    build_id: "lexi-pass-demo",
    use_case: "lexi-check",
    objective: "LEXI check",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: true
  },
  [
    approvalPacket("lexi-pass-demo", "lexi-check", "claude", ["doc-a", "SHARED\\Filing_Package_July_2026\\lexi_db_reference.md"]),
    approvalPacket("lexi-pass-demo", "lexi-check", "agy", []),
    approvalPacket("lexi-pass-demo", "lexi-check", "codex", [])
  ]
);
assert.equal(lexiPassReport.gate_status, "pass");

// PROVENANCE: the gate cannot authenticate model identity, so it surfaces whether
// each required approval carries a `provenance` block and WARNS when it does not.
const provReport = validateRecords(
  {
    build_id: "prov-demo",
    use_case: "prov-check",
    objective: "Surface provenance.",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"]
  },
  [
    { ...approvalPacket("prov-demo", "prov-check", "claude", ["doc-a"]), provenance: { model: "claude-opus-4-8", source: "ai-peer-mcp", response_id: "msg_01ABC" } },
    approvalPacket("prov-demo", "prov-check", "agy", []),
    approvalPacket("prov-demo", "prov-check", "codex", [])
  ]
);
// still passes (provenance is advisory, not a blocker)
assert.equal(provReport.gate_status, "pass");
// report carries per-required-model provenance status
const claudeProv = provReport.provenance.find((p) => p.model === "claude");
assert.equal(claudeProv.has_provenance, true);
assert.equal(claudeProv.response_model, "claude-opus-4-8");
const agyProv = provReport.provenance.find((p) => p.model === "agy");
assert.equal(agyProv.has_provenance, false);
// and warns about the self-declared (unauthenticated) ones
assert.ok(
  provReport.warnings.some((w) => /provenance/i.test(w) && /agy/.test(w)),
  `missing provenance should warn; warnings: ${JSON.stringify(provReport.warnings)}`
);

// (#5a) required-doc membership is path-normalized: separators (\ vs /) and case.
const docNormReport = validateRecords(
  { build_id: "doc-norm", use_case: "doc-norm", objective: "x", required_docs: ["build-gate/gate.mjs"], write_targets: ["shared/Coordination/example.md"] },
  [
    approvalPacket("doc-norm", "doc-norm", "claude", ["build-gate\\Gate.mjs"]),
    approvalPacket("doc-norm", "doc-norm", "agy", []),
    approvalPacket("doc-norm", "doc-norm", "codex", [])
  ]
);
assert.equal(
  docNormReport.gate_status,
  "pass",
  `a \\-separated, differently-cased doc path should satisfy required_docs; blockers: ${JSON.stringify(docNormReport.blockers)}`
);

// (#5b) duplicate-model packets are surfaced (first wins, but no longer silently).
const dupReport = validateRecords(
  { build_id: "dup", use_case: "dup", objective: "x", required_docs: ["doc-a"], write_targets: ["shared/Coordination/example.md"] },
  [
    approvalPacket("dup", "dup", "claude", ["doc-a"]),
    approvalPacket("dup", "dup", "claude", ["doc-a"]),
    approvalPacket("dup", "dup", "agy", []),
    approvalPacket("dup", "dup", "codex", [])
  ]
);
assert.ok(
  dupReport.warnings.some((w) => /duplicate/i.test(w) && /claude/.test(w)),
  `a duplicate-model packet should warn; warnings: ${JSON.stringify(dupReport.warnings)}`
);

// (#5c) the report surfaces which headline checks actually evaluated (visibility:
// a minimal dossier no longer silently runs only the base checks).
const headlineReport = validateRecords(
  { build_id: "hl", use_case: "hl", objective: "x", required_docs: ["doc-a"], write_targets: ["shared/Coordination/example.md"] },
  [approvalPacket("hl", "hl", "claude", ["doc-a"]), approvalPacket("hl", "hl", "agy", []), approvalPacket("hl", "hl", "codex", [])]
);
assert.ok(headlineReport.headline_checks, "report should carry headline_checks");
assert.equal(headlineReport.headline_checks.market_evaluated, false);
assert.equal(headlineReport.headline_checks.capability_evaluated, false);

// (#4) Dogfood: the gate must pass its own construction through itself.
const selfReport = await validateGate(ex("examples/self/dossier.json"), ex("examples/self/packets"));
assert.equal(
  selfReport.gate_status,
  "pass",
  `the gate must pass its own build; blockers: ${JSON.stringify(selfReport.blockers)}`
);
assert.ok(selfReport.provenance.every((p) => p.has_provenance), "self approval packets carry provenance");
assert.ok(
  !selfReport.warnings.some((w) => /provenance/i.test(w)),
  `a clean dogfood has no provenance warnings; warnings: ${JSON.stringify(selfReport.warnings)}`
);

console.log("build-gate tests passed");

function approvalPacket(buildId, useCase, model, docsReviewed) {
  const roleByModel = {
    claude: "builder",
    agy: "checkpoint",
    codex: "implementation-review",
    grok: "adversarial-review"
  };

  return {
    build_id: buildId,
    use_case: useCase,
    model,
    role: roleByModel[model],
    docs_reviewed: docsReviewed,
    proposal_ref: "shared/Coordination/Multi-Model Agentic Build Gate.md",
    decision: "approve",
    required_edits: [],
    hard_stops: [],
    confidence: "high",
    timestamp: "2026-06-26T12:00:00-04:00"
  };
}

function marketPacket({ buildId, ideaId, model, workstreams, lexiStatus = "meets", blockers = [], breakout }) {
  const packet = {
    build_id: buildId,
    idea_id: ideaId,
    model,
    project_state: "demo",
    workstreams_reviewed: workstreams,
    business_thesis: "A focused product thesis.",
    target_users: ["professional users"],
    architecture_findings: [],
    backend_schema_findings: [],
    security_findings: [],
    accuracy_eval_findings: [],
    scalability_findings: [],
    frontend_design_findings: [],
    lexi_class_ui_status: lexiStatus,
    go_to_market_blockers: blockers,
    recommendation_to_claude: "Proceed only if blockers are resolved.",
    timestamp: "2026-06-26T14:00:00-04:00"
  };
  if (breakout !== undefined) packet.breakout = breakout;
  return packet;
}

function passingBreakout(workstream = "frontend-brand-experience") {
  return {
    workstream,
    claimedStatus: "meets",
    finalStatus: "meets",
    converged: true,
    surviving_blockers: [],
    go_to_market_blockers: [],
    // Declarative, read-only checks the gate re-runs itself. Paths are absolute
    // so they resolve correctly regardless of the caller's cwd.
    checks: [
      { type: "file_exists", path: ex("gate.mjs") },
      { type: "file_contains", path: ex("package.json"), needle: "v4-build-gate" }
    ],
    rounds: [
      { round: 1, blockers: ["data computed but not rendered"], resolved: ["data computed but not rendered"] },
      { round: 2, blockers: [], resolved: [] }
    ]
  };
}
