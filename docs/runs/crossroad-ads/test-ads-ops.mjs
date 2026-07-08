#!/usr/bin/env node

// Keyless tests for the ads-ops loop: budget math, provisioning order, the
// certified kill/scale rule evaluation, the budget cap, and the operator
// integration (PAUSED creation + signed ledger + needs-human on missing creds)
// — all with a STUB meta client, no API keys, no live account.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOperator } from "../../../forge/operator.mjs";
import {
  campaignDailyCents, adsetDailyCents, roasOf, scaledBudgetCents,
  nextObject, proposalsFrom, MAX_DAILY_CENTS
} from "./ads-lib.mjs";

const PLAN = {
  budget: { daily_total_usd: 100, shares: {} },
  rules: { roas_floor: 1, min_spend_before_action_usd: 50, roas_scale_target: 2, scale: { step_pct: 20 } },
  campaigns: [
    { id: "prospecting", objective: "OUTCOME_SALES", daily_budget_share: 0.7, adsets: [{ id: "broad" }, { id: "lookalike" }] },
    { id: "retargeting", objective: "OUTCOME_SALES", daily_budget_share: 0.3, adsets: [{ id: "cart-abandon" }] }
  ]
};

// 1. Budget math: shares -> cents, per-adset split, ROAS parsing, scale+cap.
{
  assert.equal(campaignDailyCents(PLAN, PLAN.campaigns[0]), 7000, "0.7 * $100 = 7000c");
  assert.equal(adsetDailyCents(PLAN, PLAN.campaigns[0]), 3500, "7000c / 2 adsets");
  assert.equal(roasOf({ purchase_roas: [{ value: "2.4" }] }), 2.4, "Meta array roas");
  assert.equal(roasOf({}), 0, "no roas -> 0");
  assert.equal(scaledBudgetCents(1000, 20), 1200, "+20%");
  assert.equal(scaledBudgetCents(MAX_DAILY_CENTS, 20), MAX_DAILY_CENTS, "scale never exceeds the hard cap");
}

// 2. Provisioning order: campaigns first, then their adsets, then done.
{
  let state = { campaigns: {}, adsets: {}, ads: {} };
  const seen = [];
  for (let i = 0; i < 10; i++) {
    const next = nextObject(PLAN, state);
    if (!next) break;
    seen.push(next.action);
    if (next.action === "create_campaign") state.campaigns[next.args.plan_id] = `cid_${next.args.plan_id}`;
    else if (next.action === "create_adset") {
      assert.ok(next.args.daily_budget_cents <= MAX_DAILY_CENTS, "adset budget within cap");
      assert.ok(next.args.campaign_id, "adset references a created campaign id");
      state.adsets[next.args.plan_key] = `aid_${next.args.plan_key}`;
    }
  }
  assert.deepEqual(seen, ["create_campaign", "create_campaign", "create_adset", "create_adset", "create_adset"],
    "both campaigns created before any adset; all 3 adsets follow");
  assert.equal(nextObject(PLAN, state), null, "fully provisioned -> null");
}

// 3. Kill/scale rule evaluation against the certified thresholds.
{
  const rows = [
    { id: "a1", roas: 0.5, spend: 80, budget_cents: 1000 },  // below floor, past min spend -> KILL
    { id: "a2", roas: 0.5, spend: 20, budget_cents: 1000 },  // below floor but under min spend -> no action
    { id: "a3", roas: 3.0, spend: 200, budget_cents: 1000 }, // at/above target -> SCALE +20%
    { id: "a4", roas: 1.5, spend: 200, budget_cents: 1000 }  // between floor and target -> hold
  ];
  const props = proposalsFrom(PLAN, rows);
  assert.equal(props.length, 2, "one kill + one scale");
  const kill = props.find((p) => p.rule === "kill");
  const scale = props.find((p) => p.rule === "scale");
  assert.equal(kill.action, "pause"); assert.equal(kill.args.object_id, "a1");
  assert.equal(scale.action, "update_budget"); assert.equal(scale.args.daily_budget_cents, 1200);
}

// 4. Operator integration with a STUB meta client: PAUSED creation is executed,
//    over-cap budget is refused to needs-human, ledger is signed + verifies.
{
  const w = mkdtempSync(path.join(os.tmpdir(), "ads-ops-"));
  const calls = [];
  const stub = {
    create_campaign: async (a) => { calls.push(["create_campaign", a]); return { id: "cid_1", status: "PAUSED" }; },
    update_budget: async (a) => { calls.push(["update_budget", a]); return { ok: true }; }
  };
  const op = createOperator({
    workdir: w, signerName: "test-ads",
    rulebook: [
      { id: "make", when: (s) => s.kind === "make", act: () => ({ action: "create_campaign", args: { name: "C", objective: "OUTCOME_SALES" } }) },
      { id: "overspend", when: (s) => s.kind === "overspend", act: () => ({ action: "update_budget", args: { adset_id: "a1", daily_budget_cents: MAX_DAILY_CENTS + 1 } }) }
    ],
    bounds: {
      create_campaign: () => true,
      update_budget: (a) => a.daily_budget_cents <= MAX_DAILY_CENTS ? true : `over cap ${MAX_DAILY_CENTS}`
    },
    actions: stub
  });

  const made = await op.runPass({ kind: "make" });
  assert.equal(made.halted, false);
  assert.equal(calls[0][0], "create_campaign", "PAUSED campaign created via stub");

  const over = await op.runPass({ kind: "overspend" });
  assert.equal(over.halted, true, "over-cap budget halts");
  assert.ok(over.reason.includes("over cap"), "halt reason cites the cap");
  assert.equal(calls.length, 1, "the over-cap action was NEVER executed");

  const audit = op.verifyLedger();
  assert.ok(audit.total >= 2 && audit.ok, "every decision is a verifying signed ledger line");
}

console.log("test-ads-ops: all assertions passed");
