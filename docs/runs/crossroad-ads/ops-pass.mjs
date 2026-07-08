#!/usr/bin/env node
// ops-pass.mjs — one bounded ops pass over the live (PAUSED-provisioned) ads.
//
// Reads insights for each provisioned adset, evaluates the CERTIFIED plan's
// numeric rules (kill: ROAS below floor after the min-spend window -> pause;
// scale: ROAS at/above target -> raise daily budget one step, hard-capped), and
// executes only bounded actions through the meta-ads server. Every decision is
// a signed ledger line; out-of-bounds or missing creds -> needs-human. The loop
// never invents metrics: with no credentials or no provisioned objects it halts.
//
//   node docs/runs/crossroad-ads/ops-pass.mjs

import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOperator, renderInbox } from "../../../forge/operator.mjs";
import { loadPlan, hasMetaCreds, missingCreds, metaTools, openMetaRouter, roasOf, spendOf, proposalsFrom, MAX_DAILY_CENTS } from "./ads-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const workdir = path.join(here, "workdir");
mkdirSync(workdir, { recursive: true });
const statePath = path.join(workdir, "provision-state.json");
const loadState = () => { try { return JSON.parse(readFileSync(statePath, "utf8")); } catch { return { campaigns: {}, adsets: {}, ads: {} }; } };
const log = (m) => console.log(`[ops-pass] ${m}`);

async function main() {
  const plan = loadPlan();
  const state = loadState();
  const adsetEntries = Object.entries(state.adsets || {});

  const bounds = {
    go_live_preflight: (a) => `Meta credentials absent: ${a.missing.join(", ")}. Complete HUMAN-SETUP.md and re-run.`,
    not_provisioned: () => "No provisioned adsets found. Run provision.mjs (with Meta credentials) before an ops pass.",
    pause: () => true, // pausing is always in-bounds (the safe direction)
    update_budget: (a) => a.daily_budget_cents <= MAX_DAILY_CENTS ? true : `daily_budget_cents ${a.daily_budget_cents} exceeds cap ${MAX_DAILY_CENTS}`
  };

  const router = hasMetaCreds() && adsetEntries.length ? openMetaRouter() : null;
  const meta = router ? metaTools(router.callTool) : null;

  const actions = {
    pause: async (a) => { await meta.pause({ object_id: a.object_id }); return { paused: a.object_id }; },
    update_budget: async (a) => { await meta.updateBudget({ adset_id: a.adset_id, daily_budget_cents: a.daily_budget_cents }); return { adset: a.adset_id, daily_budget_cents: a.daily_budget_cents }; }
  };

  // Gather live metrics (only when we can) and derive proposals.
  let proposals = [];
  if (router) {
    const rows = [];
    for (const [key, id] of adsetEntries) {
      let ins = {}, obj = {};
      try { const r = await meta.getInsights({ object_id: id, date_preset: "last_7d" }); ins = (r.data && r.data[0]) || r; } catch { /* no data yet */ }
      try { const l = await meta.listObjects({ kind: "adsets" }); obj = (l.data || []).find((o) => o.id === id) || {}; } catch { /* ignore */ }
      rows.push({ key, id, roas: roasOf(ins), spend: spendOf(ins), budget_cents: Number(obj.daily_budget ?? 0) });
    }
    proposals = proposalsFrom(plan, rows);
    log(`evaluated ${rows.length} adset(s); ${proposals.length} rule-driven proposal(s)`);
  }

  const rulebook = [
    { id: "preflight-credentials", when: () => !hasMetaCreds(), act: () => ({ action: "go_live_preflight", args: { missing: missingCreds() } }) },
    { id: "preflight-provisioned", when: () => hasMetaCreds() && adsetEntries.length === 0, act: () => ({ action: "not_provisioned", args: {} }) },
    { id: "apply-proposal", when: (s) => !!s.proposal, act: (s) => ({ action: s.proposal.action, args: s.proposal.args }) }
  ];

  const op = createOperator({ workdir, rulebook, bounds, actions, signerName: "crossroad-ads" });

  let executed = 0, halted = false, reason = "";
  if (!hasMetaCreds() || !adsetEntries.length) {
    const r = await op.runPass({});
    halted = r.halted; reason = r.reason;
  } else {
    for (const proposal of proposals) {
      const r = await op.runPass({ proposal });
      executed += r.decisions.filter((d) => d.outcome === "executed").length;
      if (r.halted) { halted = true; reason = r.reason; break; }
    }
  }

  if (router) router.close();
  const inbox = renderInbox(workdir);
  const audit = op.verifyLedger();
  log(`ledger: ${audit.total} signed lines, ${audit.invalid} invalid (ok=${audit.ok})`);
  if (halted) {
    log(`HALTED — ${reason}`);
    log(`needs-human: ${inbox.open} open — see ${path.join(workdir, "INBOX.md")}`);
    log("result: needs-human");
    process.exit(0);
  }
  log(`executed ${executed} bounded action(s) this pass (kills/scales per the certified rules)`);
  log("result: ops-pass-complete");
}

main().catch((e) => { console.error(`[ops-pass] error: ${e?.message || e}`); process.exit(1); });
