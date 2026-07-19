// build-orchestrator.mjs — the autonomous builder. Composes TELOS's two existing
// halves into one fail-closed pipeline:
//
//   idea+telos --decompose--> tasks[] --compileAndHashPlan--> content-addressed plan
//     --COUNCIL APPROVAL GATE (runCouncil -> validateRecords)-->   [MUST pass first]
//     --runBuild: each node dispatched to its OWNING TEAM (team = worker)-->
//     --Rule-3 defaultVerifyNode re-derives facts--> Ed25519 ledger --done()--> ready
//
// The orchestrator adds NO new trust surface: teams are workers behind
// orchestrate.mjs `dispatch` (Rule 1 — they see only the node spec), verification
// stays defaultVerifyNode (Rule 3 — re-derive hash + run test), and the
// controller remains the sole ledger writer. A team's word is never load-bearing.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCouncil } from "./council.mjs";
import { validateRecords } from "./gate.mjs";
import { planTeams, teamForNode, authorizedSignersFor } from "./teams.mjs";
import { decompose } from "./decompose.mjs";
import { senseProject, detectConventions } from "./situation.mjs";
import { runNodeTest } from "./test-runner.mjs";
import { compileAndHashPlan } from "../merkle-dag/planner.mjs";
import { runBuild, defaultVerifyNode } from "../merkle-dag/orchestrate.mjs";
import { writePlan } from "../merkle-dag/merkle.mjs";
import { generateKeypair } from "../merkle-dag/crypto.mjs";
import { resolveUnder } from "../merkle-dag/vendor.mjs";
import { runProposalLifecycle } from "./proposal-orchestrator.mjs";

/**
 * Build a dispatch(injected) for runBuild that routes each node to its owning
 * team and lets that team WRITE the node's files. Verification is NOT done here —
 * it stays in verifyNode (Rule 3), so the team cannot self-certify.
 *
 * Routing is by node id, NOT by reading the node spec: Rule 1 (orchestrate.mjs)
 * injects only {id,requirements,files,test,effective_hash} and compileAndHashPlan
 * drops the task's `workstream` field, so the owning team is decided BEFORE the
 * build (from the original tasks) and looked up here via routeFor(id).
 *   routeFor (id) -> team object   (precomputed in buildProject from the task list)
 *   callTeam ({ team, node, dossier, attempt, priorFailure }) -> { files:[{path,content}] }
 *            | { ok:false, reason, respec? }
 *            the team's seats produce the artifacts; for live wiring this is built
 *            over ai-peer-mcp + teamPrompts, for tests it is a deterministic mock.
 *
 * RUNTIME ADAPTATION (inner loop): after the team writes its files, the dispatch
 * runs the node's OWN test (capturing stdio) and, on failure, RE-CALLS the team
 * with that failure detail so it can self-correct — up to `maxAttempts`. The team
 * only ever learns about its own node's own prior failure (Rule 1 intact). This is
 * advisory pre-flight: verification stays in verifyNode (Rule 3), so the team can
 * never self-certify. If the inner loop exhausts, the dispatch hands a `respec`
 * UP so runBuild's existing halt->mutate->re-dispatch gives a second outer level.
 */
export function makeTeamDispatch({ routeFor, callTeam, baseDir, dossier, maxAttempts = 2 }) {
  return async (injected) => {
    const team = routeFor(injected.id);
    let priorFailure = null;
    let lastDetail = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let out;
      try {
        out = await callTeam({ team, node: injected, dossier, attempt, priorFailure });
      } catch (e) {
        return { ok: false, reason: `team ${team?.id} threw: ${e?.message || String(e)}` };
      }
      if (!out || out.ok === false) {
        return { ok: false, reason: out?.reason || `team ${team?.id} declined`, respec: out?.respec };
      }
      const files = Array.isArray(out.files) ? out.files : [];
      // Clamp writes to the node's DECLARED files (Rule 1 injects the exact list
      // the node owns). Rule 3 only ever hashes those, and runBuild's
      // write-disjoint guard is computed from them, so an undeclared write —
      // notably into the .telos/ control plane, which resolves cleanly under
      // baseDir — would slip past both. Enforce it HERE, on the trusted side that
      // does the writing, not only in the optional live callTeam (parseTeamFiles).
      const declared = new Set(
        (injected.files || [])
          .map((rel) => resolveUnder(baseDir, rel))
          .filter((abs) => abs !== null)
      );
      for (const f of files) {
        if (!f || typeof f.path !== "string") return { ok: false, reason: `team ${team.id} returned a malformed file` };
        const resolved = resolveUnder(baseDir, f.path);
        if (resolved === null) return { ok: false, reason: `team ${team.id} path escapes baseDir: ${f.path}` };
        if (!declared.has(resolved)) return { ok: false, reason: `team ${team.id} wrote a file not declared by its node spec: ${f.path}` };
        mkdirSync(path.dirname(resolved), { recursive: true });
        const rechecked = resolveUnder(baseDir, f.path);
        if (rechecked === null || rechecked !== resolved) return { ok: false, reason: `team ${team.id} path escapes baseDir: ${f.path}` };
        writeFileSync(rechecked, typeof f.content === "string" ? f.content : String(f.content ?? ""));
      }
      // The team checks its OWN work before submitting. On pass, settle (the signer
      // key_id MUST be in plan.authorized_signers or the ledger gate rejects it).
      const res = await runNodeTest(injected, baseDir);
      if (res.ok) return { ok: true, signer: team.signer || team.id };
      priorFailure = { detail: res.detail, stdout: res.stdout, stderr: res.stderr, status: res.status };
      lastDetail = res.detail;
    }
    // Inner loop exhausted -> hand a respec up. Mutating `requirements` re-derives
    // the node's effective_hash so the substrate re-dispatches it next round, with
    // the failure embedded — a second, outer adaptation level. Still own-node-only.
    return {
      ok: false,
      reason: `team ${team.id} failed its node test after ${maxAttempts} attempt(s): ${lastDetail}`,
      respec: { requirements: `${injected.requirements}\n\n[adaptation] prior test failure: ${lastDetail}` }
    };
  };
}

/**
 * Generate one Ed25519 keypair per team signer and return both the public
 * keyring (for authorized_signers) and a signerFor(key_id) -> privatePem. Keys
 * are ephemeral per run (the controller is the sole signer); persisting them is a
 * deployment concern, not the orchestrator's. Returns { keyring, signerFor }.
 */
export function makeTeamKeyring(teams) {
  const roster = Array.isArray(teams) && teams.length ? teams : planTeams({});
  const keyring = {};
  const privates = {};
  for (const t of roster) {
    const keyId = t.signer || t.id;
    if (keyring[keyId]) continue;
    const { privatePem, publicJwk } = generateKeypair();
    keyring[keyId] = publicJwk;
    privates[keyId] = privatePem;
  }
  return { keyring, signerFor: (keyId) => privates[keyId] };
}

/**
 * Drive an autonomous build end to end.
 *   dossier   the build request (build_id, use_case, objective, required_docs,
 *             write_targets, optional trust_mode/market_bound) — same shape the gate validates.
 *   telos     the telos statement / intent string (passed to the Planning team).
 *   tasks     OPTIONAL hand-authored task list; omit to let the Planning team decompose.
 *   callSeat  council approval seat caller ({model,role,dossier}) -> {packet,provenance}
 *             (also used by decompose for the Planning team).
 *   callTeam  build execution caller ({team,node,dossier}) -> {files} | {ok:false,...}.
 *   keyring   { key_id: publicJwk } for authorized_signers (use makeTeamKeyring).
 *   signerFor (key_id) -> privatePem (use makeTeamKeyring).
 *
 * Returns a phased result: it STOPS at the first failing phase and never advances
 * to execution unless the council approval gate passed (fail-closed sequencing).
 *   { phase: "decompose"|"approval"|"plan"|"build", ok, ... }
 */
export async function buildProject({ dossier, telos, tasks, callSeat, callTeam, callWorkshopSeat, callParallelSeat, keyring, signerFor, baseDir, telosDir, marketPackets = [], source, maxRepairRounds = 8, adaptAttempts = 2, concurrency, nowMs = 0, maxRevisions }) {
  const teams = planTeams(dossier);

  // PROJECT SENSE (conventions): read the real project BEFORE decompose so the
  // Planning team can prefer the project's actual test command. Pure/read-only.
  const conventions = detectConventions({ baseDir });

  // 1. Tasks: hand-authored, or proposed by the Planning team (data only).
  let taskList;
  try {
    taskList = Array.isArray(tasks) ? tasks : await decompose({ dossier, telos, callSeat, teams, conventions });
  } catch (e) {
    return { phase: "decompose", ok: false, blocked: [e?.message || String(e)], teams, situation: senseProject({ baseDir, dossier, tasks: [] }) };
  }

  // Full situational report now that the task list (hence write targets) is known.
  // Collisions/protected-on-disk are ADVISORY (Rule 3 still re-derives every
  // artifact; the gate's validateProtectedPaths is the authority on protected
  // writes). Opt-in greenfield-only enforcement via dossier.block_on_collision.
  const situation = senseProject({ baseDir, dossier, tasks: taskList });
  if (dossier?.block_on_collision === true && situation.collisions.length > 0) {
    return { phase: "situation", ok: false, blocked: situation.collisions.map((c) => `write target already exists (block_on_collision): ${c.path}`), situation, teams };
  }

  // PROPOSAL-LIFECYCLE delegation (decision 1): the opt-in audited-judgment path composes the
  // recorder + Daedalus workshop + outer revision loop + gate-reconstructed authorization. The legacy
  // advisory path below is byte-identical. runProposalLifecycle owns compile/review/decision/execution.
  if (dossier?.proposal_lifecycle === true) {
    return await runProposalLifecycle({
      dossier, taskList, teams, situation, callSeat, callWorkshopSeat, callParallelSeat, callTeam,
      keyring, signerFor, baseDir, telosDir, marketPackets, source,
      maxRepairRounds, adaptAttempts, concurrency, nowMs, maxRevisions
    });
  }

  // 2. Compile + persist the content-addressed plan FIRST (Required Point 1: candidate compilation
  // precedes council review, so the council reviews the exact plan hash it authorizes). The sibling
  // contract's phase order is situation|decompose|plan|approval|build.
  const authorizedSigners = authorizedSignersFor(teams, keyring);
  const compiled = compileAndHashPlan({ tasks: taskList, authorizedSigners, repoRoot: baseDir });
  if (compiled.errors) {
    return { phase: "plan", ok: false, blocked: compiled.errors, advisories: compiled.advisories, teams, situation };
  }
  writePlan(telosDir, compiled.plan);
  const planHash = compiled.plan.plan_hash;

  // 3. COUNCIL REVIEW of the exact written candidate. In proposal-lifecycle mode each required seat's
  // packet is bound to the recomputed plan hash (proposal_ref) via runCouncil's context; in legacy
  // mode behavior is unchanged (packets keep the dossier build_id).
  const councilContext = dossier?.proposal_lifecycle === true
    ? { invocations: ["claude", "agy", "codex"].map((seat) => ({ seat, proposal_ref: planHash })) }
    : null;
  const council = await runCouncil({ callSeat, dossier, context: councilContext });
  const packets = council.filter((r) => r && r.ok && r.packet).map((r) => r.packet);
  const gateSource = dossier?.proposal_lifecycle === true ? { ...(source || {}), telosDir, baseDir } : (source || {});
  const report = validateRecords(dossier, packets, gateSource, [], marketPackets);
  if (report.blockers.length > 0) {
    return { phase: "approval", ok: false, blocked: report.blockers, council: report, teams, situation, plan: compiled.plan };
  }

  // Decide each node's owning team NOW, while the task list still carries
  // `workstream` (Rule 1 strips it from the dispatched spec). Route by id at build time.
  const nodeTeam = new Map(taskList.map((t) => [t.id, teamForNode(t, teams)]));
  const routeFor = (id) => nodeTeam.get(id) || teamForNode({}, teams);

  // 4. Execute: teams build, the controller verifies (Rule 3) and settles the ledger. The written
  // plan hash is passed as a TOCTOU strengthening (the plan was just written, so it matches).
  const build = await runBuild({
    telosDir,
    baseDir,
    dispatch: makeTeamDispatch({ routeFor, callTeam, baseDir, dossier, maxAttempts: adaptAttempts }),
    verifyNode: defaultVerifyNode,
    signerFor,
    maxRounds: maxRepairRounds,
    concurrency,
    authorizedPlanHash: planHash
  });

  return {
    phase: "build",
    ok: build.report.merge_status === "ready",
    report: build.report,
    trace: build.trace,
    council: report,
    plan: compiled.plan,
    advisories: compiled.advisories,
    situation,
    teams
  };
}
