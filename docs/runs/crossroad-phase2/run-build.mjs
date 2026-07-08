#!/usr/bin/env node
// run-build.mjs — Crossroad Threads Phase 2: BUILD the commerce infrastructure
// from the certified launch-audit gap lists.
//
// The Phase-1 launch audit (docs/runs/crossroad-threads) PASSED and produced,
// in each artifact's "Phase 2 Work Items", the buildable spec. This run authors
// the real deliverables — AWS CDK, Dockerized order/transaction/POD services,
// security controls, AWS CI, and the ad campaign plan — grounded against two
// READ-ONLY evidence sources snapshotted into workdir: the certified audit
// artifacts (audit/*.md) and the CrossroadThreads repo (source/*). Same forge
// machinery: manifest-validated workstreams, ratchet, adversarial claim-graded
// bouts, gemini referee, defeat memory, market gate.
//
//   node docs/runs/crossroad-phase2/run-build.mjs   (re-run to resume; exit 0 = gate PASS)

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePlan, writePlan } from "../../../merkle-dag/merkle.mjs";
import { runBuild } from "../../../merkle-dag/orchestrate.mjs";
import { openState, foldDefs, styxGenerateFiles, bankVerifyFailures, runBouts, approvalEvidenceDigest, loadKeys, pinResearch, withTransientRetry } from "../../../forge/ratchet.mjs";
import { validateManifest, workstreamsFromManifest, defsFromManifest, dossierFromManifest } from "../../../forge/manifest.mjs";
import { createSeatRouter } from "../../../breakout/seat_router.mjs";
import { defaultSeatRegistry } from "../../../build-gate/seat-registry.mjs";
import { generatorDispatch } from "../../../saas-forge/generator.mjs";
import { runMarketGate } from "../../../saas-forge/forge.mjs";
import { liveGenerators, makeCouncilFactFns, councilApprovals } from "../../../saas-forge/live.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const auditRun = path.resolve(here, "../crossroad-threads/workdir");
const workdir = path.join(here, "workdir");
const telosDir = path.join(workdir, ".telos");
await mkdir(telosDir, { recursive: true });
const CHECK_NODE = fileURLToPath(new URL("../../../saas-forge/checks/check-node.mjs", import.meta.url));

const loadJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const log = (m) => console.log(`[phase2] ${m}`);

// ---- the manifest IS the build spec -----------------------------------------
const manifest = validateManifest(loadJson(path.join(here, "manifest.json"), null));
const dossierMeta = dossierFromManifest(manifest);
const wsWithChecks = workstreamsFromManifest(manifest);

// ---- EVIDENCE SNAPSHOT: the certified audit + the repo, pinned read-only ----
const SNAPSHOT = [
  [path.join(auditRun, "audit/COMMERCE-GAP.md"), "audit/COMMERCE-GAP.md"],
  [path.join(auditRun, "audit/LAUNCH-ARCHITECTURE.md"), "audit/LAUNCH-ARCHITECTURE.md"],
  [path.join(auditRun, "audit/SECURITY.md"), "audit/SECURITY.md"],
  [path.join(auditRun, "audit/OPERATIONS.md"), "audit/OPERATIONS.md"],
  [path.join(auditRun, "audit/ADVERTISING.md"), "audit/ADVERTISING.md"],
  [path.join(auditRun, "source/next.config.ts"), "source/next.config.ts"],
  [path.join(auditRun, "source/.github/workflows/deploy.yml"), "source/deploy.yml"],
  [path.join(auditRun, "source/content/designs.json"), "source/designs.json"],
  [path.join(auditRun, "source/package.json"), "source/package.json"]
];
await pinResearch(workdir, "snapshot", async () => {
  const copied = [];
  for (const [from, to] of SNAPSHOT) {
    const dest = path.join(workdir, to);
    mkdirSync(path.dirname(dest), { recursive: true });
    try { copyFileSync(from, dest); copied.push(to); } catch (e) { log(`snapshot: could not copy ${to} (${e.code})`); }
  }
  return { copied, note: "certified Phase-1 audit artifacts + CrossroadThreads source, read-only evidence for the Phase-2 build" };
}, log);

const keys = loadKeys(workdir, ["claude", "codex"], log);

const router = createSeatRouter(defaultSeatRegistry());
let seatCalls = 0;
const seatCallsByTool = {};
const retryingCall = withTransientRetry((n, a) => router.callTool(n, a), { log });
const callTool = (name, args) => {
  seatCalls++;
  seatCallsByTool[name] = (seatCallsByTool[name] || 0) + 1;
  return retryingCall(name, args);
};

let summary = { generated_for: dossierMeta.build_id, live: true, phase: "phase2-build",
  transport: "seat-router default (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)" };

try {
  const signed = process.env.TELOS_SIGNED === "1";
  summary.trust_mode = signed ? "signed" : "advisory";

  const state = openState(workdir);
  const rawDefs = defsFromManifest(manifest, { checkNodePath: CHECK_NODE });
  const defs = foldDefs(rawDefs, state, log);
  const defById = new Map(defs.map((d) => [d.id, d]));
  const { plan, errors } = computePlan(defs, {
    authorizedSigners: { claude: keys.claude.publicJwk, codex: keys.codex.publicJwk }
  });
  if (errors) throw new Error(`plan invalid: ${JSON.stringify(errors)}`);
  writePlan(telosDir, plan);

  const generateFiles = styxGenerateFiles({
    state,
    generate: liveGenerators({ callTool, evidenceBaseDir: workdir })({ stack: [] }),
    binary: () => false,
    log
  });
  const { report, trace } = await runBuild({
    telosDir, baseDir: workdir,
    dispatch: generatorDispatch({ baseDir: workdir, generateFiles, signerForTask: (id) => manifest.workstreams.find((w) => w.id === id)?.signer || "claude" }),
    signerFor: (m) => keys[m]?.privatePem
  });
  const settledNow = trace.filter((t) => t.action === "settled").map((t) => t.id);
  const halts = trace.filter((t) => t.action !== "settled").map((t) => ({ id: t.id, action: t.action, reason: (t.reason || t.detail || "").toString().slice(0, 400) }));
  for (const h of halts) log(`build halt ${h.id}: ${h.action} ${h.reason}`);
  log(`build: merge_status=${report.merge_status}; settled: ${settledNow.join(", ") || "(none — ratcheted)"}`);
  summary.build = { merge_status: report.merge_status, settled_this_invocation: settledNow, halts };

  if (report.merge_status !== "ready") {
    const infra = bankVerifyFailures(halts, state, log);
    summary.result = infra ? "error: infrastructure failure (quota/network) during build — top up or check connectivity, then resume" : "build-incomplete (re-run to continue from the ledger)";
    summary.blockers = report.blockers || [];
    process.exitCode = 1;
  } else {
    const makeFns = makeCouncilFactFns({ callTool });
    const hashById = new Map(plan.nodes.map((n) => [n.id, n.effective_hash]));
    const records = await runBouts({ workstreams: wsWithChecks, state, makeFns, defById, hashById, telosDir, log });
    summary.teams = records.map((t) => ({
      workstream: t.workstream, converged: t.converged, finalStatus: t.finalStatus,
      rounds: t.rounds?.length ?? 0, referee: t.referee ?? null
    }));

    const allConverged = records.length === manifest.workstreams.length && records.every((t) => t.converged);
    if (!allConverged) {
      summary.result = "bouts-incomplete (re-run to continue; converged teams are ratcheted)";
      process.exitCode = 1;
    } else {
      log("gate: collecting council approvals...");
      const approvalMeta = { ...dossierMeta, objective: dossierMeta.objective + approvalEvidenceDigest(records, workdir) };
      const approvals = await councilApprovals({ callTool })({ dossierMeta: approvalMeta, architecture: { stack: [] } });
      const verdict = runMarketGate({ projectRoot: workdir, dossierMeta, teamRecords: records, approvals, signed });
      summary.gate_status = verdict.gate_status;
      summary.approvals_provenance = (verdict.provenance || []).map((p) => ({ model: p.model, has_provenance: p.has_provenance, response_id: p.response_id }));
      summary.blockers = verdict.blockers || [];
      summary.result = verdict.gate_status === "pass" ? "PASS" : "gate-blocked";
      process.exitCode = verdict.gate_status === "pass" ? 0 : 1;
    }
  }
} catch (error) {
  summary.error = error?.message || String(error);
  summary.result = "error (re-run to resume from the last checkpoint)";
  process.exitCode = 1;
} finally {
  router.close();
}

summary.seat_calls = seatCalls;
summary.seat_call_breakdown = seatCallsByTool;
saveJson(path.join(here, "run-summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
log(`result: ${summary.result} (seat calls: ${seatCalls})`);
process.exit(process.exitCode || 0);
