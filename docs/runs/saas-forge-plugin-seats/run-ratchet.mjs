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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeypair } from "../../../merkle-dag/crypto.mjs";
import { computePlan, writePlan } from "../../../merkle-dag/merkle.mjs";
import { runBuild } from "../../../merkle-dag/orchestrate.mjs";
import { runBreakout } from "../../../breakout/breakout.mjs";
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

// ---- persisted keys (stable plan hash across invocations) ------------------
const keysPath = path.join(workdir, "keys.json");
let keys = loadJson(keysPath, null);
if (!keys) {
  keys = { claude: generateKeypair(), codex: generateKeypair() };
  saveJson(keysPath, keys);
  log("generated and persisted run keypairs");
} else {
  log("reusing persisted run keypairs");
}

// The run's PLUGIN LOADOUT: extra MCP servers beyond the council seats, reached
// through the router's namespaced form ("server:tool"). Declare more here — or
// in ~/.telos/loadout.json / TELOS_LOADOUT — and any harness stage can use them.
const router = createSeatRouter(withLoadout(defaultSeatRegistry(), {
  context7: { command: "cmd", args: ["/c", "npx", "-y", "@upstash/context7-mcp"], framing: "ndjson" }
}));
const callTool = (name, args) => router.callTool(name, args);

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
  const blockersPath = path.join(workdir, "checkpoint.blockers.json");
  const boutBlockers = loadJson(blockersPath, {});

  // Research is PINNED: performed once (live Context7, offline fallback) and
  // persisted — re-rolling research each invocation would re-hash every node
  // and defeat the ratchet. Delete workdir/architecture.json to re-research.
  const archPath = path.join(workdir, "architecture.json");
  let architecture = loadJson(archPath, null);
  if (!architecture) {
    architecture = await researchArchitecture({ telos, workstreams: ALL, docsFor: context7DocsFor() });
    saveJson(archPath, architecture);
    log(`research: pinned architecture (${architecture.stack.map((s) => s.library).join(", ")})`);
  } else {
    log("research: reusing pinned architecture");
  }
  // THE STYX RULE — a crossing is permanent. A converged team's spec is FROZEN
  // (stored def reused verbatim, immune to blocker bookkeeping and cascades)
  // and its artifact is PRESERVED (re-settles from disk byte-identical if a
  // merkle cascade forces a re-lineage; the seat is never re-invoked). Only an
  // operator deleting the checkpoint sends a soul back to the river.
  const teamsPath = path.join(workdir, "checkpoint.teams.json");
  const done = loadJson(teamsPath, {});
  const rawDefs = convergenceTaskDefs(architecture);
  for (const [id, rec] of Object.entries(done)) {
    if (rec.converged && !rec.frozen_def) {
      rec.frozen_def = rawDefs.find((d) => d.id === id) || null;
      log(`styx: backfilled frozen spec for prior win ${id}`);
      saveJson(teamsPath, done);
    }
  }

  const defs = rawDefs.map((def) => {
    if (done[def.id]?.converged && done[def.id].frozen_def) return done[def.id].frozen_def;
    const raised = boutBlockers[def.id];
    if (!Array.isArray(raised) || raised.length === 0) return def;
    log(`respec ${def.id}: ${raised.length} bout blocker(s) folded into requirements`);
    return {
      ...def,
      requirements: def.requirements +
        "\nPRIOR BOUT BLOCKERS — the adversarial council raised these against the previous version of this artifact; the new version MUST concretely resolve each one:\n" +
        raised.slice(0, 6).map((b) => `- ${String(b).slice(0, 300)}`).join("\n")
    };
  });
  const defById = new Map(defs.map((d) => [d.id, d]));
  const { plan, errors } = computePlan(defs, {
    authorizedSigners: { claude: keys.claude.publicJwk, codex: keys.codex.publicJwk }
  });
  if (errors) throw new Error(`plan invalid: ${JSON.stringify(errors)}`);
  writePlan(telosDir, plan);

  const isBinaryRel = (rel) => /\.(png|jpe?g|gif|webp|ico)$/i.test(rel);
  const liveGen = liveGenerators({ callTool })(architecture);
  const generateFiles = async (injected) => {
    // Styx: a converged team's artifact re-settles from disk, never regenerates.
    if (done[injected.id]?.converged) {
      const files = {};
      let complete = true;
      for (const rel of injected.files) {
        try {
          files[rel] = readFileSync(path.join(workdir, rel), isBinaryRel(rel) ? undefined : "utf8");
        } catch { complete = false; }
      }
      if (complete) {
        log(`styx: ${injected.id} re-settled from its preserved artifact (no regeneration)`);
        return files;
      }
    }
    return liveGen(injected);
  };
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
    // A failing node test is a blocker RAISED BY THE TEST ITSELF: bank its
    // diagnostic into the same respec recursion the bout blockers use, so the
    // next pass regenerates the artifact knowing exactly what the test said.
    for (const h of halts) {
      if (!h.reason) continue;
      const raised = boutBlockers[h.id] || [];
      const entry = `BUILD VERIFY FAILURE (from the node's own test): ${h.reason.slice(0, 400)}`;
      if (!raised.includes(entry)) {
        boutBlockers[h.id] = [entry, ...raised].slice(0, 8);
        saveJson(blockersPath, boutBlockers);
        log(`banked verify failure as blocker for ${h.id}`);
      }
    }
    summary.result = "build-incomplete (re-run to continue from the ledger)";
    summary.blockers = report.blockers || [];
    process.exitCode = 1;
  } else {
    // ---- Stage B: team bouts (checkpoint per converged team) ----------------
    // Styx rule: a converged team NEVER re-fights — its spec is frozen and its
    // artifact preserved, so the win it earned still describes what's on disk.
    const makeFns = makeCouncilFactFns({ callTool });
    const hashById = new Map(plan.nodes.map((n) => [n.id, n.effective_hash]));
    const records = [];
    for (const ws of WORKSTREAMS) {
      const checks = ws.checks(architecture);
      if (done[ws.id]?.converged) {
        log(`bout ${ws.id}: across the river (converged in a prior invocation — never re-fought)`);
        records.push(done[ws.id]);
        continue;
      }
      log(`bout ${ws.id}: fighting...`);
      // Contract closure: after three bouts a workstream's contract CLOSES —
      // adversaries may only verify the folded prior blockers are resolved or
      // cite factual defects. Unbounded novelty never terminates on documents.
      const fightCountsPath = path.join(workdir, 'fight-counts.json');
      const fightCounts = loadJson(fightCountsPath, {});
      fightCounts[ws.id] = (fightCounts[ws.id] || 0) + 1;
      saveJson(fightCountsPath, fightCounts);
      const closure = fightCounts[ws.id] > 3
        ? `\n=== CONTRACT CLOSED (bout ${fightCounts[ws.id]}) === This artifact has been through ${fightCounts[ws.id] - 1} adversarial cycles. Valid blockers may ONLY cite (a) a PRIOR BOUT BLOCKER from this contract that remains unresolved, or (b) an internal factual defect (contradiction, broken example). NO new demands.`
        : "";
      const fns = makeFns({ workstream: ws.id, checks, baseDir: workdir, contract: (defById.get(ws.id)?.requirements || "") + closure });
      const record = await runBreakout(
        { workstream: ws.id, claimedStatus: "meets", goalStatus: "meets",
          evidence: `${ws.id} artifacts: ${ws.files.join(", ")}` },
        fns
      );
      const full = { ...record, checks, lens: ws.lens, signer: ws.signer, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey, node_hash: hashById.get(ws.id), frozen_def: defById.get(ws.id) ?? null };
      // Persist the fight log as evidence either way; checkpoint only a win.
      const fightsDir = path.join(telosDir, "fights");
      mkdirSync(fightsDir, { recursive: true });
      saveJson(path.join(fightsDir, `${ws.id}.json`),
        { workstream: ws.id, converged: record.converged, rounds: record.rounds, referee: record.referee ?? null });
      if (record.converged) {
        done[ws.id] = full;
        saveJson(teamsPath, done);
        delete boutBlockers[ws.id];
        saveJson(blockersPath, boutBlockers);
        log(`bout ${ws.id}: CONVERGED in ${record.rounds.length} round(s) — checkpointed`);
      } else {
        boutBlockers[ws.id] = record.surviving_blockers;
        saveJson(blockersPath, boutBlockers);
        log(`bout ${ws.id}: needs-work (${record.surviving_blockers.length} surviving; referee: ${record.referee?.reason ?? "rounds"}) — blockers respec the node next invocation`);
      }
      records.push(full);
    }
    summary.teams = records.map((t) => ({
      workstream: t.workstream, converged: t.converged, finalStatus: t.finalStatus,
      rounds: t.rounds?.length ?? 0, referee: t.referee ?? null
    }));

    const allConverged = records.length === ALL.length && records.every((t) => t.converged);
    if (!allConverged) {
      summary.result = "bouts-incomplete (re-run to continue; converged teams are ratcheted)";
      process.exitCode = 1;
    } else {
      // ---- Stage C: approvals + gate (always re-verified, never resumed) ----
      log("gate: collecting council approvals...");
      const approvals = await councilApprovals({ callTool })({ dossierMeta, architecture });
      const verdict = runMarketGate({ projectRoot: workdir, dossierMeta, teamRecords: records, approvals });
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

saveJson(path.join(here, "run-summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
log(`result: ${summary.result}`);
process.exit(process.exitCode || 0);
