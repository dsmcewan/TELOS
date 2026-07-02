#!/usr/bin/env node
// run-ratchet.mjs — the LIVE saas-forge build as a RATCHET: every invocation
// resumes from proven progress instead of starting over. Built for hostile
// environments (process reaping, sleep): a killed run costs only the work not
// yet settled; nothing proven is ever re-bought.
//
// Ratchet stages (all state in the stable ./workdir, git-ignored):
//   keys     persisted signing keypairs — fresh keys would re-hash the plan and
//            forward-invalidate the ledger, defeating resume by design
//   A build  merkle-dag runBuild resumes natively: readySet skips settled-valid
//            ledger nodes, so only unbuilt/invalidated nodes re-dispatch
//   B bouts  one checkpoint per CONVERGED team breakout; non-converged teams
//            re-fight on the next invocation, informed by the durable defeat
//            memory and refereed by gemini
//   C gate   never checkpointed — the market gate re-verifies from disk every
//            time; a verifier that resumes is not a verifier
//
// Transport: the seat router (claude/agy_checkpoint via ai-peer-mcp;
// grok/gemini/codex via the claude-plugins seat servers). No wall-clock timer:
// the gemini referee ends adversarial loops on judgment.
//
//   node docs/runs/saas-forge-plugin-seats/run-ratchet.mjs
//   (re-run after any interruption; exits 0 only on a passed gate)

import { readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openState, foldDefs, styxGenerateFiles, bankVerifyFailures, runBouts, approvalEvidenceDigest, loadKeys, pinResearch } from "../../../forge/ratchet.mjs";
import { validateManifest, workstreamsFromManifest, defsFromManifest } from "../../../forge/manifest.mjs";
import { computePlan, writePlan } from "../../../merkle-dag/merkle.mjs";
import { runBuild } from "../../../merkle-dag/orchestrate.mjs";
import { createSeatRouter } from "../../../breakout/seat_router.mjs";
import { defaultSeatRegistry, withLoadout } from "../../../build-gate/seat-registry.mjs";
import { researchArchitecture, makeContext7DocsFor, offlineDocsFor } from "../../../saas-forge/research.mjs";
import { convergenceTaskDefs, signerForTask } from "../../../saas-forge/plan.mjs";
import { generatorDispatch } from "../../../saas-forge/generator.mjs";
import { runMarketGate } from "../../../saas-forge/forge.mjs";
import { liveGenerators, makeCouncilFactFns, councilApprovals } from "../../../saas-forge/live.mjs";
import { WORKSTREAMS } from "../../../saas-forge/workstreams.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const workdir = path.join(here, "workdir");
const telosDir = path.join(workdir, ".telos");
await mkdir(telosDir, { recursive: true });

const ALL = WORKSTREAMS.map((w) => w.id);
const dossierMeta = {
  build_id: "saas-forge-plugin-seats",
  idea_id: "idea-convergence",
  use_case: "forge-live-plugin-seats",
  objective:
    "Forge the convergence demo live through the seat-router plugin backends. " +
    "SCOPE: the seven fixture workstreams (product-architecture, business-positioning, backend-schema, security-trust, " +
    "accuracy-evals, scale-operations, frontend-brand-experience), each authoring its declared files in the run workdir. " +
    "'Live' means REAL provider API calls with per-seat response-id provenance — nothing fabricated. " +
    "SEAT ENUMERATION (all traversal via breakout/seat_router.mjs over build-gate/seat-registry.mjs; routing is fail-closed — " +
    "an unrouted tool throws, so NO seat can bypass the router): claude -> ai-peer-mcp (Anthropic API); codex -> codex-api " +
    "plugin server (OpenAI gpt-5.5, xhigh); grok -> grok plugin server (xAI grok-4.3, adversary); gemini -> gemini plugin " +
    "server (Google gemini-3.1-pro-preview, bout referee); agy -> Antigravity CLI plugin server (co-adversary, " +
    "content-addressed provenance) plus the agy_checkpoint LOCAL governance approver on ai-peer-mcp. Each backend is " +
    "authorized via its operator-held API key or signed-in CLI session. " +
    "SUCCESS CRITERIA (verified, not asserted): every workstream's deterministic checks re-verified from disk by the gate; " +
    "every artifact survived a dual-adversary breakout (grok + agy) with the gemini referee; every approval packet carries " +
    "real provenance (a missing/duplicate response_id blocks); all nodes settled on the append-only Ed25519 ledger. " +
    "SAFEGUARDS: observability via persisted fight logs (.telos/fights), the signed ledger, and run summaries; " +
    "rollback/fallback via forward-invalidation (a changed spec re-hashes, stale ledger lines fall invalid, the ratchet " +
    "workdir preserves every prior state); the gate fails closed on any missing evidence.",
  required_market_workstreams: ALL
};
const telos = "Make the convergence demo market-ready.";

const loadJson = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};
const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const log = (m) => console.log(`[ratchet] ${m}`);

const keys = loadKeys(workdir, ["claude", "codex"], log);

// The run's PLUGIN LOADOUT: extra MCP servers beyond the council seats, reached
// through the router's namespaced form ("server:tool"). Declare more here — or
// in ~/.telos/loadout.json / TELOS_LOADOUT — and any harness stage can use them.
const router = createSeatRouter(withLoadout(defaultSeatRegistry(), {
  context7: { command: "cmd", args: ["/c", "npx", "-y", "@upstash/context7-mcp"], framing: "ndjson" }
}));
let seatCalls = 0;
const seatCallsByTool = {};
const callTool = (name, args) => {
  seatCalls++;
  seatCallsByTool[name] = (seatCallsByTool[name] || 0) + 1;
  return router.callTool(name, args);
};

// Live Context7 research through the loadout. Fail-open per domain to the
// offline KB — research enrichment must never block OR HANG the build (a dead
// docs server rejects via timeout instead of leaving an unsettled await).
function context7DocsFor() {
  const withTimeout = (p, ms, what) => Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000}s`)), ms))
  ]);
  const c7 = (tool, args) => withTimeout(callTool(tool, args), 45_000, tool);
  const extractId = (text) => (String(text).match(/\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/) || [null])[0];
  const live = makeContext7DocsFor({
    resolve: async (name, q) => {
      const id = extractId(await c7("context7:resolve-library-id", { libraryName: name, query: q }));
      if (!id) throw new Error(`context7: no library id for ${name}`);
      return id;
    },
    queryDocs: async (id, q) => {
      try {
        return await c7("context7:get-library-docs", { context7CompatibleLibraryID: id, topic: q, tokens: 2500 });
      } catch {
        return await c7("context7:query-docs", { libraryId: id, query: q });
      }
    }
  });
  return async (domain, query) => {
    try {
      const doc = await live(domain, query);
      log(`research ${domain}: context7 -> ${doc.library}${doc.libraryId ? ` (${doc.libraryId})` : ""}`);
      return doc;
    } catch (e) {
      log(`research ${domain}: context7 unavailable (${String(e.message).slice(0, 80)}) -> offline KB`);
      return offlineDocsFor(domain, query);
    }
  };
}

let summary = { generated_for: dossierMeta.build_id, live: true, ratchet: true,
  transport: "seat-router default (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)" };

try {
  // ---- Stage A: build (resumes natively via the ledger) --------------------
  // Repair recursion: a bout that ended needs-work persisted its surviving
  // blockers. Injecting them into the node's REQUIREMENTS changes its
  // effective_hash — forward-invalidation re-dispatches exactly that node, and
  // the builder regenerates the artifact with the blockers in its prompt. The
  // bout then re-fights the NEW artifact: fight -> verdict -> respec -> rebuild.
  const state = openState(workdir);

  // Research is PINNED: performed once (live Context7, offline fallback) and
  // persisted — re-rolling research each invocation would re-hash every node
  // and defeat the ratchet. Delete workdir/architecture.json to re-research.
  const architecture = await pinResearch(workdir, "architecture",
    () => researchArchitecture({ telos, workstreams: ALL, docsFor: context7DocsFor() }), log);

  // One-time manifest emission (Batch 2 migration): materialize the spec —
  // including the architecture-dependent checks, resolved against the PINNED
  // research — as data. `TELOS_EMIT_MANIFEST=1 node run-ratchet.mjs`
  if (process.env.TELOS_EMIT_MANIFEST === "1") {
    const inlineDefs = convergenceTaskDefs(architecture);
    const manifest = {
      build_id: dossierMeta.build_id,
      idea_id: dossierMeta.idea_id,
      use_case: dossierMeta.use_case,
      telos,
      objective: dossierMeta.objective,
      workstreams: WORKSTREAMS.map((ws) => {
        const def = inlineDefs.find((d) => d.id === ws.id);
        return {
          id: ws.id, signer: ws.signer, lens: ws.lens, dependencies: ws.dependencies,
          files: ws.files, requirements: def.requirements,
          checks: ws.checks(architecture),
          test: def.test,
          isUi: !!ws.isUi, findingsKey: ws.findingsKey, finding: ws.finding
        };
      })
    };
    validateManifest(manifest);
    saveJson(path.join(here, "manifest.json"), manifest);
    console.log(`manifest emitted: ${path.join(here, "manifest.json")}`);
    process.exit(0);
  }

  // The spec comes from manifest.json when present (declarative path, tests
  // carried verbatim so plan hashes are stable); the in-file workstreams
  // remain the authoring source it was emitted from.
  const manifestPath = path.join(here, "manifest.json");
  const manifest = loadJson(manifestPath, null);
  let rawDefs, wsSource;
  if (manifest) {
    validateManifest(manifest);
    wsSource = workstreamsFromManifest(manifest);
    rawDefs = defsFromManifest(manifest, { checkNodePath: "unused-explicit-tests" });
    log(`spec: loaded from manifest.json (${wsSource.length} workstreams)`);
  } else {
    wsSource = WORKSTREAMS.map((ws) => ({ ...ws, checks: ws.checks(architecture) }));
    rawDefs = convergenceTaskDefs(architecture);
    log("spec: manifest.json absent — using in-file workstreams");
  }
  const defs = foldDefs(rawDefs, state, log);
  const defById = new Map(defs.map((d) => [d.id, d]));
  const { plan, errors } = computePlan(defs, {
    authorizedSigners: { claude: keys.claude.publicJwk, codex: keys.codex.publicJwk }
  });
  if (errors) throw new Error(`plan invalid: ${JSON.stringify(errors)}`);
  writePlan(telosDir, plan);

  const generateFiles = styxGenerateFiles({
    state,
    generate: liveGenerators({ callTool })(architecture),
    log
  });
  const dispatch = generatorDispatch({
    baseDir: workdir,
    generateFiles,
    signerForTask
  });
  const { report, trace } = await runBuild({
    telosDir, baseDir: workdir, dispatch,
    signerFor: (m) => keys[m]?.privatePem
  });
  const settledNow = trace.filter((t) => t.action === "settled").map((t) => t.id);
  const halts = trace.filter((t) => t.action !== "settled").map((t) => ({ id: t.id, action: t.action, reason: (t.reason || t.detail || "").toString().slice(0, 300) }));
  for (const h of halts) log(`build halt ${h.id}: ${h.action} ${h.reason}`);
  log(`build: merge_status=${report.merge_status}; settled this invocation: ${settledNow.join(", ") || "(none — already ratcheted)"}`);
  summary.build = { merge_status: report.merge_status, settled_this_invocation: settledNow, halts };
  if (report.merge_status !== "ready") {
    bankVerifyFailures(halts, state, log);
    summary.result = "build-incomplete (re-run to continue from the ledger)";
    summary.blockers = report.blockers || [];
    process.exitCode = 1;
  } else {
    // ---- Stage B: team bouts (Styx skip, closure, checkpoints — forge/) -----
    const makeFns = makeCouncilFactFns({ callTool });
    const hashById = new Map(plan.nodes.map((n) => [n.id, n.effective_hash]));
    const records = await runBouts({ workstreams: wsSource, state, makeFns, defById, hashById, telosDir, log });
    summary.teams = records.map((t) => ({
      workstream: t.workstream, converged: t.converged, finalStatus: t.finalStatus,
      rounds: t.rounds?.length ?? 0, referee: t.referee ?? null
    }));

    const allConverged = records.length === ALL.length && records.every((t) => t.converged);
    if (!allConverged) {
      summary.result = "bouts-incomplete (re-run to continue; converged teams are ratcheted)";
      process.exitCode = 1;
    } else if (process.env.TELOS_SKIP_GATE === "1") {
      // Replay/verification mode: prove the ratchet + Styx stages alone.
      summary.result = "ALL-CONVERGED (gate skipped by TELOS_SKIP_GATE)";
      process.exitCode = 0;
    } else {
      // ---- Stage C: approvals + gate (always re-verified, never resumed) ----
      log("gate: collecting council approvals...");
      const approvalMeta = {
        ...dossierMeta,
        objective: dossierMeta.objective + approvalEvidenceDigest(records, workdir)
      };
      const approvals = await councilApprovals({ callTool })({ dossierMeta: approvalMeta, architecture });
      // TELOS_SIGNED=1 runs the gate under trust_mode "signed": approval
      // packets are HMAC-signed inside runCouncil (TELOS_SECRET_<MODEL>) and
      // the gate verifies signature + provenance + disk — the strictest
      // posture, here composed with the plugin seat transport.
      const signed = process.env.TELOS_SIGNED === "1";
      summary.trust_mode = signed ? "signed" : "advisory";
      const verdict = runMarketGate({ projectRoot: workdir, dossierMeta, teamRecords: records, approvals, signed });
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
log(`result: ${summary.result} (seat calls this invocation: ${seatCalls})`);
process.exit(process.exitCode || 0);
