#!/usr/bin/env node
// test-build-orchestrator.mjs — the autonomous builder end to end, KEYLESS.
// Proves the composition: decompose -> council approval gate (fail-closed) ->
// content-addressed plan -> teams build as workers -> Rule-3 verify -> signed
// ledger -> done() ready. No API keys: council + teams are deterministic mocks;
// the Ed25519 substrate is real.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLedger } from "../../merkle-dag/crypto.mjs";
import { buildProject, makeTeamDispatch, makeTeamKeyring } from "../build-orchestrator.mjs";
import { planTeams, teamForNode } from "../teams.mjs";

// A gate-valid dossier (non-market keeps the council gate to the 3 required seats).
function makeDossier() {
  return {
    build_id: "ap1",
    use_case: "autonomous-build",
    objective: "build a tiny project autonomously",
    required_docs: [],
    write_targets: []
  };
}

// Council seat caller: approves for every model; doubles as the Planning team's
// decompose source when intent==="decompose". Packets bind to the given dossier
// ids so the gate's build_id/use_case checks pass.
function makeCallSeat({ decision = "approve", tasks, buildId = "ap1", useCase = "autonomous-build" } = {}) {
  return async ({ model, intent }) => {
    if (intent === "decompose") return { tasks };
    return {
      packet: {
        build_id: buildId, use_case: useCase, model, role: "approver",
        docs_reviewed: [], proposal_ref: buildId, decision, required_edits: [],
        hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z"
      },
      provenance: { model: `real-${model}`, source: "mock", response_id: `r_${model}` }
    };
  };
}

// Team build caller: writes the node's declared files (so Rule-3 verify passes).
const buildTeam = async ({ team, node }) => ({
  files: node.files.map((p) => ({ path: p, content: `// ${node.id} built by team ${team.id}\n` }))
});

const tasks = [
  { id: "core", writes: ["out/core.txt"], reads: [], requirements: "core module", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" },
  { id: "app", writes: ["out/app.txt"], reads: ["out/core.txt"], requirements: "app on core", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" }
];

function fixture() {
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-teams-"));
  const telosDir = path.join(baseDir, ".telos");
  mkdirSync(telosDir, { recursive: true });
  const teams = planTeams(makeDossier());
  const { keyring, signerFor } = makeTeamKeyring(teams);
  return { baseDir, telosDir, keyring, signerFor };
}

// --- Happy path: hand-authored tasks build all the way to merge_status:ready ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "make a tiny project", tasks,
    callSeat: makeCallSeat(), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 20
  });

  assert.equal(result.phase, "build", "reached the build phase");
  assert.equal(result.ok, true, "build ok");
  assert.equal(result.report.merge_status, "ready", "done() gate reports ready");
  const ledger = readLedger(path.join(telosDir, "ledger.jsonl"));
  assert.equal(ledger.length, 2, "both nodes settled into the signed ledger");
  assert.ok(ledger.every((r) => r.sig && r.sig.alg === "Ed25519"), "ledger entries are Ed25519-signed");
  const settled = result.trace.filter((t) => t.action === "settled").map((t) => t.id).sort();
  assert.deepEqual(settled, ["app", "core"], "both nodes appear settled in the trace");
  console.log("OK: happy path -> ready");
}

// --- Fail-closed sequencing: a council 'revise' blocks at approval; NO plan, NO ledger ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "x", tasks,
    callSeat: makeCallSeat({ decision: "revise" }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir
  });

  assert.equal(result.phase, "approval", "stopped at the approval phase");
  assert.equal(result.ok, false, "not ok");
  assert.ok(result.blocked.some((b) => /decision is 'revise'/.test(b)), "blocked on the revise decision");
  // Per the amended sibling contract (Required Point 1), the candidate plan is compiled + written
  // BEFORE council review, so plan.json now EXISTS at an approval block — but NO ledger is written,
  // which is the load-bearing fail-closed guarantee (no execution).
  assert.equal(existsSync(path.join(telosDir, "plan.json")), true, "candidate plan written before review (reordered)");
  assert.equal(existsSync(path.join(telosDir, "ledger.jsonl")), false, "no ledger written when approval fails");
  console.log("OK: fail-closed — approval blocks before any execution (plan written, no ledger)");
}

// --- Autonomous decompose: omit tasks, the Planning team proposes them, build reaches ready ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "decompose me",
    callSeat: makeCallSeat({ tasks }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 20
  });

  assert.equal(result.ok, true, "autonomous decomposition built to ready");
  assert.equal(result.report.merge_status, "ready", "Planning-team tasks survived the gate + Rule-3 verify");
  console.log("OK: autonomous decompose -> ready");
}

// --- Decompose fail-closed: an empty decomposition stops before approval/plan ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "nothing",
    callSeat: makeCallSeat({ tasks: [] }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir
  });
  assert.equal(result.phase, "decompose", "stopped at decompose");
  assert.equal(result.ok, false, "empty decomposition is fail-closed");
  console.log("OK: empty decomposition blocks");
}

// --- A team verify-failure does NOT settle: bad test => node blocked, no ledger entry ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const badTasks = [
    { id: "good", writes: ["out/good.txt"], reads: [], requirements: "ok", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" },
    { id: "bad", writes: ["out/bad.txt"], reads: [], requirements: "fails its own test", test: { cmd: "node", args: ["-e", "process.exit(1)"] }, workstream: "product-architecture" }
  ];
  const result = await buildProject({
    dossier: makeDossier(), telos: "x", tasks: badTasks,
    callSeat: makeCallSeat(), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 5
  });
  assert.equal(result.report.merge_status, "blocked", "a failing node blocks the merge (Rule 3 not bypassed)");
  const ledger = readLedger(path.join(telosDir, "ledger.jsonl"));
  assert.deepEqual(ledger.map((r) => r.task_id), ["good"], "only the verified node settled; the failing one did not");
  console.log("OK: Rule-3 verify is load-bearing");
}

// --- makeTeamDispatch unit: a team writing OUTSIDE baseDir is rejected (path escape) ---
{
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-disp-"));
  const team = { id: "rogue", signer: "rogue" };
  const dispatch = makeTeamDispatch({
    routeFor: () => team,
    callTeam: async () => ({ files: [{ path: "../escape.txt", content: "x" }] }),
    baseDir, dossier: {}
  });
  const out = await dispatch({ id: "n", files: ["../escape.txt"] });
  assert.equal(out.ok, false, "path-escaping write is rejected");
  assert.match(out.reason, /escapes baseDir/, "reason names the escape");
  console.log("OK: dispatch rejects path escape");
}

// --- makeTeamDispatch unit: a declared path cannot escape physically through
// an existing symlink/junction component. No byte may land outside baseDir. ---
{
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-disp-physical-"));
  const outside = mkdtempSync(path.join(os.tmpdir(), "telos-disp-outside-"));
  symlinkSync(outside, path.join(baseDir, "escape-link"), process.platform === "win32" ? "junction" : "dir");
  const team = { id: "rogue", signer: "rogue" };
  const dispatch = makeTeamDispatch({
    routeFor: () => team,
    callTeam: async () => ({ files: [{ path: "escape-link/pwned.txt", content: "x" }] }),
    baseDir, dossier: {}
  });
  const out = await dispatch({ id: "n", files: ["escape-link/pwned.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "process.exit(0)"] } });
  assert.equal(out.ok, false, "symlink/junction-escaping write is rejected");
  assert.match(out.reason, /escapes baseDir/, "reason names physical escape");
  assert.equal(existsSync(path.join(outside, "pwned.txt")), false, "nothing was written outside baseDir");
  console.log("OK: dispatch rejects physical symlink/junction escape");
}

// --- makeTeamDispatch unit: a team writing an UNDECLARED file is rejected (control-plane guard) ---
{
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-disp-clamp-"));
  mkdirSync(path.join(baseDir, ".telos"), { recursive: true });
  const team = { id: "rogue", signer: "rogue" };
  // The team returns its declared file PLUS a stealth write into the .telos/
  // control plane (resolves cleanly under baseDir, so the escape check alone
  // would let it through).
  const dispatch = makeTeamDispatch({
    routeFor: () => team,
    callTeam: async () => ({ files: [
      { path: "out/ok.txt", content: "declared" },
      { path: ".telos/ledger.jsonl", content: "forged ledger line" }
    ] }),
    baseDir, dossier: {}
  });
  const out = await dispatch({ id: "n", files: ["out/ok.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "process.exit(0)"] } });
  assert.equal(out.ok, false, "an undeclared write is rejected");
  assert.match(out.reason, /not declared by its node spec/, "reason names the undeclared write");
  assert.equal(existsSync(path.join(baseDir, ".telos", "ledger.jsonl")), false, "the control-plane file was never written");
  console.log("OK: dispatch rejects writes outside the node's declared files");
}

// --- makeTeamDispatch unit: a team that declines surfaces a respec for the repair loop ---
{
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-disp2-"));
  const team = { id: "t", signer: "t" };
  const dispatch = makeTeamDispatch({
    routeFor: () => team,
    callTeam: async () => ({ ok: false, reason: "needs more spec", respec: { requirements: "clarified" } }),
    baseDir, dossier: {}
  });
  const out = await dispatch({ id: "n", files: [] });
  assert.equal(out.ok, false, "decline is a halt");
  assert.deepEqual(out.respec, { requirements: "clarified" }, "respec passes through to runBuild's repair loop");
  console.log("OK: dispatch surfaces respec on decline");
}

// --- Market-bound full fan-out: nodes route to DISTINCT teams; market-readiness
// gate (incl. breakout re-verify) stays load-bearing; build reaches ready ---
{
  const marketDossier = {
    build_id: "mk1", idea_id: "idea-mk1", use_case: "autonomous-market-build",
    objective: "market-bound autonomous build", trust_mode: "advisory",
    market_bound: true, user_facing_frontend: true,
    required_market_workstreams: [
      "business-positioning", "product-architecture", "backend-schema",
      "security-trust", "accuracy-evals", "scale-operations", "frontend-brand-experience"
    ],
    required_docs: [], write_targets: ["out/schema.mjs", "out/ui.mjs", "out/threat.md", "out/runbook.md"],
    affected_directories: ["."]
  };
  const marketTasks = [
    { id: "schema", writes: ["out/schema.mjs"], reads: [], requirements: "schema", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "backend-schema" },
    { id: "ui", writes: ["out/ui.mjs"], reads: ["out/schema.mjs"], requirements: "ui", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "frontend-brand-experience" },
    { id: "threat", writes: ["out/threat.md"], reads: ["out/schema.mjs"], requirements: "threat model", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "security-trust" },
    { id: "runbook", writes: ["out/runbook.md"], reads: ["out/ui.mjs"], requirements: "runbook", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "scale-operations" }
  ];
  const marketPacket = (model, workstreams, extra = {}) => ({
    build_id: "mk1", idea_id: "idea-mk1", model, project_state: "demo",
    workstreams_reviewed: workstreams, business_thesis: "thesis", target_users: ["u"],
    architecture_findings: [], backend_schema_findings: [], security_findings: [],
    accuracy_eval_findings: [], scalability_findings: [], frontend_design_findings: [],
    lexi_class_ui_status: "not-applicable", go_to_market_blockers: [],
    recommendation_to_claude: "proceed", timestamp: "2026-06-28T12:00:00-04:00", ...extra
  });
  const marketPackets = [
    marketPacket("claude", ["business-positioning", "product-architecture", "frontend-brand-experience"], {
      lexi_class_ui_status: "meets",
      breakout: {
        workstream: "frontend-brand-experience", claimedStatus: "meets", finalStatus: "meets",
        converged: true, surviving_blockers: [], go_to_market_blockers: [],
        checks: [
          { type: "file_exists", path: "market-evidence/fe.md" },
          { type: "file_contains", path: "market-evidence/fe.md", needle: "mk1" }
        ],
        rounds: [{ round: 1, blockers: ["x"], resolved: ["x"] }, { round: 2, blockers: [], resolved: [] }]
      }
    }),
    marketPacket("codex", ["backend-schema", "accuracy-evals", "scale-operations"]),
    marketPacket("grok", ["security-trust"])
  ];

  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-mk-"));
  const telosDir = path.join(baseDir, ".telos");
  mkdirSync(telosDir, { recursive: true });
  mkdirSync(path.join(baseDir, "market-evidence"), { recursive: true });
  writeFileSync(path.join(baseDir, "market-evidence", "fe.md"), "frontend evidence for mk1\n");

  const teams = planTeams(marketDossier);
  // The market roster fans out to the build/verify teams, not just the backbone.
  assert.deepEqual(teams.map((t) => t.id).sort(),
    ["architecture", "backend", "breakout", "business", "evals", "frontend", "integrity", "ops", "planning", "security"],
    "market-bound dossier convenes the full team roster");

  const { keyring, signerFor } = makeTeamKeyring(teams);
  const result = await buildProject({
    dossier: marketDossier, telos: "x", tasks: marketTasks,
    callSeat: makeCallSeat({ buildId: "mk1", useCase: "autonomous-market-build" }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, marketPackets,
    source: { dossierDir: baseDir }, maxRepairRounds: 20
  });

  assert.equal(result.ok, true, "market-bound build reached ready (market gate + breakout re-verify passed)");
  assert.equal(result.report.merge_status, "ready", "merge_status ready");

  // Nodes routed to DISTINCT teams (the whole point of the fan-out).
  const used = new Set(marketTasks.map((t) => teamForNode(t, teams).id));
  assert.deepEqual([...used].sort(), ["backend", "frontend", "ops", "security"], "nodes fan out to distinct build teams");

  // Each node settled under its OWNING team's signer (not one shared signer).
  const ledger = readLedger(path.join(telosDir, "ledger.jsonl"));
  const bySigner = new Map(ledger.map((r) => [r.task_id, r.signer]));
  assert.equal(bySigner.get("schema"), "backend", "schema settled by backend");
  assert.equal(bySigner.get("ui"), "frontend", "ui settled by frontend");
  assert.equal(bySigner.get("threat"), "security", "threat settled by security");
  assert.equal(bySigner.get("runbook"), "ops", "runbook settled by ops");
  console.log("OK: market-bound full fan-out -> ready, distinct teams + signers");
}

// --- Market-bound stays fail-closed: a missing required workstream blocks at approval ---
{
  const dossier = {
    build_id: "mk2", idea_id: "idea-mk2", use_case: "u", objective: "o", trust_mode: "advisory",
    market_bound: true, user_facing_frontend: false,
    required_market_workstreams: ["backend-schema", "security-trust"],
    required_docs: [], write_targets: ["out/x.txt"], affected_directories: ["."]
  };
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-mk2-"));
  const telosDir = path.join(baseDir, ".telos");
  mkdirSync(telosDir, { recursive: true });
  const { keyring, signerFor } = makeTeamKeyring(planTeams(dossier));
  // Market packet covers only backend-schema, NOT security-trust => gate must block.
  const marketPackets = [{
    build_id: "mk2", idea_id: "idea-mk2", model: "codex", project_state: "demo",
    workstreams_reviewed: ["backend-schema"], business_thesis: "t", target_users: ["u"],
    architecture_findings: [], backend_schema_findings: [], security_findings: [],
    accuracy_eval_findings: [], scalability_findings: [], frontend_design_findings: [],
    lexi_class_ui_status: "not-applicable", go_to_market_blockers: [],
    recommendation_to_claude: "proceed", timestamp: "2026-06-28T12:00:00-04:00"
  }];
  const result = await buildProject({
    dossier, telos: "x",
    tasks: [{ id: "x", writes: ["out/x.txt"], reads: [], requirements: "r", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "backend-schema" }],
    callSeat: makeCallSeat({ buildId: "mk2", useCase: "u" }), callTeam: buildTeam, keyring, signerFor, baseDir, telosDir,
    marketPackets, source: { dossierDir: baseDir }
  });
  assert.equal(result.phase, "approval", "blocked at approval");
  assert.ok(result.blocked.some((b) => /security-trust/.test(b)), "blocked on the unreviewed required workstream");
  // Reordered: candidate written before review, so plan.json exists — but no ledger (no execution).
  assert.equal(existsSync(path.join(telosDir, "plan.json")), true, "candidate plan written before review");
  assert.equal(existsSync(path.join(telosDir, "ledger.jsonl")), false, "no ledger written when market gate fails");
  console.log("OK: market-bound fail-closed on missing workstream");
}

// --- project sense: a brownfield collision is ADVISORY, build still reaches ready ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  // Pre-create one of the write targets => a collision the situation report flags.
  mkdirSync(path.join(baseDir, "out"), { recursive: true });
  writeFileSync(path.join(baseDir, "out", "core.txt"), "pre-existing content");

  const result = await buildProject({
    dossier: makeDossier(), telos: "x", tasks,
    callSeat: makeCallSeat(), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 20
  });

  assert.ok(result.situation, "buildProject returns a situation report");
  assert.equal(result.situation.mode, "brownfield", "pre-existing write target => brownfield");
  assert.ok(result.situation.collisions.some((c) => c.path === "out/core.txt"), "collision is reported");
  assert.equal(result.ok, true, "collision is advisory — build still reaches ready");
  assert.equal(result.report.merge_status, "ready");
  console.log("OK: project sense — brownfield collision is advisory, still ready");
}

// --- block_on_collision opt-in: greenfield-only enforcement blocks fail-closed ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  mkdirSync(path.join(baseDir, "out"), { recursive: true });
  writeFileSync(path.join(baseDir, "out", "core.txt"), "pre-existing");
  const dossier = { ...makeDossier(), block_on_collision: true };

  const result = await buildProject({
    dossier, telos: "x", tasks,
    callSeat: makeCallSeat(), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir
  });
  assert.equal(result.phase, "situation", "block_on_collision stops at the situation phase");
  assert.equal(result.ok, false, "fail-closed when greenfield-only is requested");
  assert.equal(existsSync(path.join(telosDir, "plan.json")), false, "no plan written when collision blocks");
  console.log("OK: block_on_collision opt-in fails closed on a collision");
}

console.log("test-build-orchestrator.mjs OK");
