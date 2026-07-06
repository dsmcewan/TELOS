#!/usr/bin/env node
// run-audit.mjs — TELOS audits its own launch, signed, through itself.
//
// Batch 7, the dogfood gate: the TELOS-as-a-service manifest (manifest.json —
// the product spec for the factory itself) runs through the same machinery it
// sells: manifest-validated workstreams, council-authored artifacts grounded
// against a SELF-SNAPSHOT of this repository (key modules, CI, README, and the
// machine's own gate-PASSED run summaries), dual-adversary claim-graded bouts,
// gemini referee, defeat memory, and the market gate under trust_mode SIGNED
// (mandatory here — the factory takes its own strongest medicine).
//
//   node docs/runs/telos-self-audit/run-audit.mjs
//   (requires TELOS_SECRET_{CLAUDE,AGY,CODEX}; re-run to resume; exit 0 = gate PASS)

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
const repoRoot = path.resolve(here, "../../..");
const workdir = path.join(here, "workdir");
const telosDir = path.join(workdir, ".telos");
await mkdir(telosDir, { recursive: true });
const CHECK_NODE = fileURLToPath(new URL("../../../saas-forge/checks/check-node.mjs", import.meta.url));

const loadJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const log = (m) => console.log(`[self-audit] ${m}`);

// ---- the manifest IS the product spec ---------------------------------------
const manifest = validateManifest(loadJson(path.join(here, "manifest.json"), null));
const dossierMeta = dossierFromManifest(manifest);
const wsWithChecks = workstreamsFromManifest(manifest);

// ---- SELF-SNAPSHOT: the evidence the audit cites, pinned once ----------------
// Copies of the modules and run summaries the claims cite, frozen under
// workdir/source so the bouts' anchors resolve and hashes stay stable.
const SNAPSHOT = [
  ["README.md", "source/README.md"],
  ["forge/ratchet.mjs", "source/forge/ratchet.mjs"],
  ["forge/driver.mjs", "source/forge/driver.mjs"],
  ["forge/manifest.mjs", "source/forge/manifest.mjs"],
  ["forge/operator.mjs", "source/forge/operator.mjs"],
  ["forge/claims.mjs", "source/forge/claims.mjs"],
  ["build-gate/seat-registry.mjs", "source/build-gate/seat-registry.mjs"],
  ["build-gate/model-profiles.mjs", "source/build-gate/model-profiles.mjs"],
  ["build-gate/sign.mjs", "source/build-gate/sign.mjs"],
  ["breakout/breakout.mjs", "source/breakout/breakout.mjs"],
  [".github/workflows/ci.yml", "source/ci.yml"],
  ["docs/runs/saas-forge-plugin-seats/run-summary.json", "source/runs/demo-run-summary.json"],
  ["docs/runs/signed-plugin-gate/run-summary.json", "source/runs/signed-gate-run-summary.json"],
  ["docs/runs/crossroad-threads/run-summary.json", "source/runs/crossroad-run-summary.json"]
];
await pinResearch(workdir, "snapshot", async () => {
  const copied = [];
  for (const [from, to] of SNAPSHOT) {
    const dest = path.join(workdir, to);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(repoRoot, from), dest);
    copied.push(to);
  }
  return { copied, note: "self-snapshot of the modules and certified run summaries the audit cites" };
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

let summary = { generated_for: dossierMeta.build_id, live: true, phase: "self-audit",
  transport: "seat-router default (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)" };

try {
  // Signed mode is MANDATORY for the self-audit — refuse to run without secrets.
  for (const s of ["CLAUDE", "AGY", "CODEX"]) {
    if (!process.env[`TELOS_SECRET_${s}`]) throw new Error(`TELOS_SECRET_${s} required — the self-audit runs signed or not at all.`);
  }
  summary.trust_mode = "signed";

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
      log("gate: collecting council approvals (signed)...");
      const approvalMeta = {
        ...dossierMeta,
        objective: dossierMeta.objective + approvalEvidenceDigest(records, workdir)
      };
      const approvals = await councilApprovals({ callTool })({ dossierMeta: approvalMeta, architecture: { stack: [] } });
      const verdict = runMarketGate({ projectRoot: workdir, dossierMeta, teamRecords: records, approvals, signed: true });
      summary.gate_status = verdict.gate_status;
      summary.approvals_provenance = (verdict.provenance || []).map((p) => ({
        model: p.model, has_provenance: p.has_provenance, response_id: p.response_id
      }));
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
