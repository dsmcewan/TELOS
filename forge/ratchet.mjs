// ratchet.mjs — the adversarial-convergence doctrine as composable stages.
//
// Extracted (not rewritten) from the two gate-PASSED live runs:
//   docs/runs/saas-forge-plugin-seats/run-ratchet.mjs   (build forge, demo)
//   docs/runs/crossroad-threads/run-audit.mjs           (launch audit, Crossroad)
//
// The doctrine these stages encode, earned failure-by-failure:
//   RATCHET   every invocation resumes from proven progress; a killed run costs
//             only the unproven remainder (ledger skips settled-valid nodes,
//             checkpoints skip converged bouts)
//   STYX      a crossing is permanent: a converged team's spec is FROZEN and its
//             artifact PRESERVED; it never re-fights. Iteration pressure flows
//             through plan/build respec, never through re-judging verdicts.
//   RESPEC    adversary blockers fold into the node's requirements — the hash
//             changes, forward-invalidation rebuilds exactly that node with the
//             demands in the builder's prompt
//   CLOSURE   after three bouts a workstream's contract closes: only unresolved
//             prior blockers or internal factual defects remain admissible —
//             unbounded novelty never terminates on documents
//   BANKING   a failing node test's own diagnostic becomes a banked blocker, so
//             the regenerating builder fixes the exact failure
//   DIGEST    gate approvers receive evidence DERIVED at approval time (checks
//             re-verified from disk, bout records, work-item counts) — never
//             assertions
//
// All state lives in the run's workdir as plain JSON; every helper is
// synchronous-IO, zero-dep, and safe to re-run.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateKeypair } from "../merkle-dag/crypto.mjs";
import { reverifyRecord } from "../breakout/verifier.mjs";
import { runBreakout } from "../breakout/breakout.mjs";
import { renderClaimRules } from "./claims.mjs";

export const loadJson = (p, fallback) => {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; }
};
export const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

/** Persisted signing keypairs — fresh keys would re-hash the plan and defeat resume. */
export function loadKeys(workdir, signers = ["claude", "codex"], log = () => {}) {
  const keysPath = path.join(workdir, "keys.json");
  let keys = loadJson(keysPath, null);
  if (!keys) {
    keys = Object.fromEntries(signers.map((s) => [s, generateKeypair()]));
    saveJson(keysPath, keys);
    log("generated and persisted run keypairs");
  } else {
    log("reusing persisted run keypairs");
  }
  return keys;
}

/** Pinned research/brief: produced once, reused every invocation (stable hashes). */
export async function pinResearch(workdir, name, produce, log = () => {}) {
  const p = path.join(workdir, `${name}.json`);
  let value = loadJson(p, null);
  if (!value) {
    value = await produce();
    saveJson(p, value);
    log(`${name}: pinned`);
  } else {
    log(`${name}: reusing pinned ${name}`);
  }
  return value;
}

/** The run's persisted recursion state: banked blockers + converged checkpoints. */
export function openState(workdir) {
  const blockersPath = path.join(workdir, "checkpoint.blockers.json");
  const teamsPath = path.join(workdir, "checkpoint.teams.json");
  const fightCountsPath = path.join(workdir, "fight-counts.json");
  return {
    workdir,
    blockersPath, teamsPath, fightCountsPath,
    boutBlockers: loadJson(blockersPath, {}),
    done: loadJson(teamsPath, {}),
    fightCounts: loadJson(fightCountsPath, {}),
    saveBlockers() { saveJson(this.blockersPath, this.boutBlockers); },
    saveDone() { saveJson(this.teamsPath, this.done); },
    saveFightCounts() { saveJson(this.fightCountsPath, this.fightCounts); }
  };
}

/**
 * RESPEC + STYX over raw task defs:
 *   - a converged team's frozen def is used verbatim (immune to blocker
 *     bookkeeping and cascades); backfilled for pre-Styx checkpoints
 *   - a contested team's banked blockers fold into its requirements
 */
export function foldDefs(rawDefs, state, log = () => {}) {
  for (const [id, rec] of Object.entries(state.done)) {
    if (rec.converged && !rec.frozen_def) {
      rec.frozen_def = rawDefs.find((d) => d.id === id) || null;
      log(`styx: backfilled frozen spec for prior win ${id}`);
      state.saveDone();
    }
  }
  return rawDefs.map((def) => {
    if (state.done[def.id]?.converged && state.done[def.id].frozen_def) return state.done[def.id].frozen_def;
    const raised = state.boutBlockers[def.id];
    if (!Array.isArray(raised) || raised.length === 0) return def;
    log(`respec ${def.id}: ${raised.length} blocker(s) folded into requirements`);
    return {
      ...def,
      requirements: def.requirements +
        "\nPRIOR BOUT BLOCKERS — the adversarial council raised these against the previous version of this artifact; the new version MUST concretely resolve each one:\n" +
        raised.slice(0, 6).map((b) => `- ${String(b).slice(0, 300)}`).join("\n")
    };
  });
}

/**
 * STYX artifact preservation: a converged team's files re-settle from disk
 * byte-identical when a merkle cascade forces a re-lineage — the seat is never
 * re-invoked. Wraps any generateFiles.
 */
export function styxGenerateFiles({ state, generate, binary = (rel) => /\.(png|jpe?g|gif|webp|ico)$/i.test(rel), log = () => {} }) {
  return async (injected) => {
    if (state.done[injected.id]?.converged) {
      const files = {};
      let complete = true;
      for (const rel of injected.files) {
        try {
          files[rel] = readFileSync(path.join(state.workdir, rel), binary(rel) ? undefined : "utf8");
        } catch { complete = false; }
      }
      if (complete) {
        log(`styx: ${injected.id} re-settled from its preserved artifact (no regeneration)`);
        return files;
      }
    }
    return generate(injected);
  };
}

// Provider quota/billing/transport failures are NOT artifact defects — they are
// infrastructure, and banking them as blockers pollutes the real list and makes
// a node look broken when only the wallet or the wire is. (Learned the hard way
// during the self-audit: repeated "credit balance too low" errors banked onto a
// converging workstream.)
export const INFRA_ERROR = /credit balance|insufficient_quota|quota exceeded|rate limit|429|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed|getaddrinfo|socket hang up/i;

// Network flakiness (ECONNRESET/ETIMEDOUT/ENOTFOUND/socket hang up) — NOT
// billing. A single reset should retry the call, not abort the whole pass.
// (Distinct from INFRA_ERROR: quota/credit failures are NOT retryable here —
// retrying a billing failure buys nothing; they surface for a clean halt.)
const NETWORK_FLAKE = /ECONNRESET|ETIMEDOUT|ENOTFOUND|socket hang up|getaddrinfo|fetch failed|network|EAI_AGAIN/i;
const isBilling = (s) => /credit balance|insufficient_quota|quota exceeded|billing|429|rate limit/i.test(s);

/**
 * Wrap a callTool so transient NETWORK failures retry in place (a blip on one
 * seat call must not abort a pass of dozens). Billing/quota failures are NOT
 * retried — they propagate immediately for a clean halt. Handles both a
 * rejected promise and an isError-style text envelope carrying the error.
 */
export function withTransientRetry(callTool, { retries = 3, backoffMs = 4000, log = () => {} } = {}) {
  return async (name, args) => {
    for (let attempt = 0; ; attempt++) {
      let text, thrown = null;
      try { text = await callTool(name, args); }
      catch (e) { thrown = e; }
      const errStr = thrown ? String(thrown.message || thrown)
        : (typeof text === "string" && /"?isError"?|^Error:/.test(text) && NETWORK_FLAKE.test(text) ? text : null);
      const flaky = errStr && NETWORK_FLAKE.test(errStr) && !isBilling(errStr);
      if (!flaky || attempt >= retries) {
        if (thrown) throw thrown;
        return text;
      }
      log(`transient network error on ${name} (attempt ${attempt + 1}/${retries}), retrying in ${backoffMs / 1000}s: ${errStr.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
    }
  };
}

/**
 * BANKING: a failing node test's own diagnostic becomes a banked blocker so the
 * rebuild fixes the exact failure — EXCEPT infrastructure failures (quota,
 * network), which are surfaced (return true) for the caller to halt on, not
 * banked as artifact defects.
 * @returns {boolean} true if any halt was an infrastructure failure.
 */
export function bankVerifyFailures(halts, state, log = () => {}) {
  let infra = false;
  for (const h of halts) {
    if (!h.reason) continue;
    if (INFRA_ERROR.test(String(h.reason))) {
      infra = true;
      log(`infrastructure failure on ${h.id} (quota/network) — NOT banked as a blocker: ${String(h.reason).slice(0, 120)}`);
      continue;
    }
    const raised = state.boutBlockers[h.id] || [];
    const entry = `BUILD VERIFY FAILURE (from the node's own test): ${String(h.reason).slice(0, 400)}`;
    if (!raised.includes(entry)) {
      state.boutBlockers[h.id] = [entry, ...raised].slice(0, 8);
      state.saveBlockers();
      log(`banked verify failure as blocker for ${h.id}`);
    }
  }
  return infra;
}

/** CLOSURE: after three bouts the contract closes — count and render the clause. */
export function contractClosure(state, wsId) {
  state.fightCounts[wsId] = (state.fightCounts[wsId] || 0) + 1;
  state.saveFightCounts();
  const n = state.fightCounts[wsId];
  return n > 3
    ? `\n=== CONTRACT CLOSED (bout ${n}) === This artifact has been through ${n - 1} adversarial cycles. Valid blockers may ONLY cite (a) a PRIOR BOUT BLOCKER from this contract that remains unresolved, or (b) an internal factual defect (contradiction, broken example). NO new demands.`
    : "";
}

/**
 * The bout stage: one adversarial breakout per workstream with Styx skip,
 * closure, fight-log persistence, and win/blocker checkpointing.
 *   workstreams  [{id, files, checks, lens, signer, isUi, findingsKey, finding}]
 *   makeFns      makeCouncilFactFns({callTool}) result
 *   defById      folded defs (contract source)
 */
export async function runBouts({ workstreams, state, makeFns, defById, hashById, telosDir, maxRounds, log = () => {} }) {
  // Cost economics: within-bout rounds ARGUE about a frozen artifact; the real
  // improvement happens BETWEEN passes (respec -> rebuild). A tight round cap
  // therefore both saves money and converges faster — money flows to rebuilds,
  // not to re-litigating a document the builder cannot change mid-bout. The
  // referee still ends genuine loops earlier; this bounds the pathological case
  // where adversaries keep surfacing new (real) blockers on an unchanging file.
  const roundCap = Number.isInteger(maxRounds) ? maxRounds
    : (Number.isInteger(Number(process.env.TELOS_MAX_ROUNDS)) && process.env.TELOS_MAX_ROUNDS ? Number(process.env.TELOS_MAX_ROUNDS) : undefined);
  const records = [];
  for (const ws of workstreams) {
    const checks = ws.checks;
    if (state.done[ws.id]?.converged) {
      log(`bout ${ws.id}: across the river (converged in a prior invocation — never re-fought)`);
      records.push(state.done[ws.id]);
      continue;
    }
    log(`bout ${ws.id}: fighting...`);
    const closure = contractClosure(state, ws.id);
    // Epistemic claim typing: declared claims join the contract with per-grade
    // adjudication rules — challengers judge each claim AT its grade.
    const claimRules = renderClaimRules(ws.claims);
    const fns = makeFns({
      workstream: ws.id, checks, baseDir: state.workdir,
      contract: (defById.get(ws.id)?.requirements || "") + claimRules + closure,
      // Only the workstream's own files are editable; source anchors are
      // read-only evidence (the self-audit deadlocked when adversaries demanded
      // the builder edit TELOS's own source instead of the audit document).
      authoredFiles: ws.files
    });
    const record = await runBreakout(
      { workstream: ws.id, claimedStatus: "meets", goalStatus: "meets",
        evidence: `${ws.id} artifacts: ${ws.files.join(", ")}`,
        ...(roundCap ? { maxRounds: roundCap } : {}) },
      fns
    );
    const full = {
      ...record, checks, lens: ws.lens, signer: ws.signer, isUi: !!ws.isUi,
      finding: ws.finding, findingsKey: ws.findingsKey,
      node_hash: hashById?.get(ws.id) ?? null, frozen_def: defById.get(ws.id) ?? null
    };
    const fightsDir = path.join(telosDir, "fights");
    mkdirSync(fightsDir, { recursive: true });
    saveJson(path.join(fightsDir, `${ws.id}.json`),
      { workstream: ws.id, converged: record.converged, rounds: record.rounds, referee: record.referee ?? null });
    if (record.converged) {
      state.done[ws.id] = full;
      state.saveDone();
      delete state.boutBlockers[ws.id];
      state.saveBlockers();
      log(`bout ${ws.id}: CONVERGED in ${record.rounds.length} round(s) — checkpointed`);
    } else {
      state.boutBlockers[ws.id] = record.surviving_blockers;
      state.saveBlockers();
      log(`bout ${ws.id}: needs-work (${record.surviving_blockers.length} surviving; referee: ${record.referee?.reason ?? "rounds"})`);
    }
    records.push(full);
  }
  return records;
}

/**
 * DIGEST: evidence for gate approvers, derived at approval time — checks
 * re-verified from disk NOW, bout records from the checkpoints, enumerated
 * Phase-2 work-item counts from the artifacts.
 */
export function approvalEvidenceDigest(records, workdir) {
  const lines = records.map((r) => {
    const rv = reverifyRecord({ checks: r.checks }, workdir);
    const passed = rv.reverifiable - (rv.failing?.length || 0);
    let phase2 = 0;
    try {
      const first = (r.frozen_def?.files || [])[0];
      if (first) {
        const doc = readFileSync(path.join(workdir, first), "utf8");
        const m = doc.match(/Phase 2 Work Items[\s\S]*?(?=\n#|$)/i);
        phase2 = m ? (m[0].match(/^\s*(?:[-*]|\d+[.)])\s+/gm) || []).length : 0;
      }
    } catch { /* count stays 0 */ }
    return `- ${r.workstream}: ${passed}/${rv.reverifiable} deterministic checks RE-VERIFIED FROM DISK at approval time; ` +
      `converged in ${r.rounds?.length ?? "?"} adversarial round(s) vs grok+agy` +
      `${r.referee ? "; referee ruling recorded" : ""}; fight log persisted at .telos/fights/${r.workstream}.json` +
      `${phase2 ? `; ${phase2} enumerated Phase 2 work items` : ""}`;
  }).join("\n");
  return "\n\nEVIDENCE DIGEST (derived from disk and run records at approval time, not asserted):\n" + lines +
    "\nApproval packets in this council carry real per-seat provenance (model + response_id from the actual API " +
    "response); the gate independently blocks on missing, placeholder, or duplicate provenance and re-verifies " +
    "every deterministic check from disk — an approver need not re-run them to rely on them.";
}
