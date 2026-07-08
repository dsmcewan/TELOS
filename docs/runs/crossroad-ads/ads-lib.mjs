// ads-lib.mjs — shared plumbing for the Crossroad ads-ops loop.
//
// Wires the certified campaign plan (docs/runs/crossroad-phase2/deliverables/
// ads/campaign-plan.json) to the meta-ads MCP server (connectors/meta-ads-mcp)
// through the seat router's loadout. The meta-ads server enforces the hard
// safety invariants (PAUSED-only creation, daily-budget cap, no delete); this
// lib is the thin typed client + the plan/credential helpers the operator uses.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeatRouter } from "../../../breakout/seat_router.mjs";
import { defaultSeatRegistry, withLoadout } from "../../../build-gate/seat-registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
export const META_SERVER = path.join(repoRoot, "connectors/meta-ads-mcp/server.mjs");
export const PLAN_PATH = path.join(repoRoot, "docs/runs/crossroad-phase2/deliverables/ads/campaign-plan.json");

export const REQUIRED_ENV = ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID"];
export const hasMetaCreds = () => REQUIRED_ENV.every((k) => !!process.env[k]);
export const missingCreds = () => REQUIRED_ENV.filter((k) => !process.env[k]);

export const loadPlan = () => JSON.parse(readFileSync(PLAN_PATH, "utf8"));

/** Open a real seat router with the meta-ads server loaded. Returns {callTool, close}. */
export function openMetaRouter() {
  const router = createSeatRouter(withLoadout(defaultSeatRegistry(), {
    "meta-ads": { command: "node", args: [META_SERVER], framing: "ndjson" }
  }));
  return { callTool: (tool, args) => router.callTool(`meta-ads:${tool}`, args), close: () => router.close() };
}

// Parse an MCP tool result (text content that is JSON) into an object.
function parseResult(text) {
  if (text && typeof text === "object") return text;
  try { return JSON.parse(String(text)); } catch { return { raw: String(text) }; }
}

/** A typed meta-ads client over any callTool(tool,args)->text (real or stubbed). */
export function metaTools(callTool) {
  const call = async (tool, args) => parseResult(await callTool(tool, args));
  return {
    createCampaign: (a) => call("create_campaign", a),
    createAdset: (a) => call("create_adset", a),
    createAd: (a) => call("create_ad", a),
    getInsights: (a) => call("get_insights", a),
    listObjects: (a) => call("list_objects", a),
    updateBudget: (a) => call("update_budget", a),
    pause: (a) => call("pause", a)
  };
}

// ---- plan math (cents, budget shares, scale step) --------------------------
export const usd = (n) => Math.round(n * 100); // dollars -> cents
export const MAX_DAILY_CENTS = Number(process.env.META_MAX_DAILY_CENTS) || 2000;

/** Daily budget in cents for a campaign's share of the plan's daily total. */
export function campaignDailyCents(plan, campaign) {
  const totalUsd = plan.budget?.daily_total_usd ?? 0;
  const share = campaign.daily_budget_share ?? plan.budget?.shares?.[campaign.id] ?? 0;
  return usd(totalUsd * share);
}

/** Per-adset daily cents: the campaign budget split evenly across its adsets. */
export function adsetDailyCents(plan, campaign) {
  const n = Math.max(1, (campaign.adsets || []).length);
  return Math.floor(campaignDailyCents(plan, campaign) / n);
}

/** A ROAS number from an insights row (Meta returns purchase_roas as an array). */
export function roasOf(insightsRow) {
  if (!insightsRow) return 0;
  const pr = insightsRow.purchase_roas;
  if (Array.isArray(pr)) return Number(pr[0]?.value ?? 0);
  if (typeof pr === "number") return pr;
  return Number(insightsRow.roas ?? 0);
}
export const spendOf = (row) => Number(row?.spend ?? 0);

/** The scale rule's next budget: current +step%, hard-capped at the server cap. */
export function scaledBudgetCents(currentCents, stepPct) {
  const next = Math.round(currentCents * (1 + (stepPct || 0) / 100));
  return Math.min(next, MAX_DAILY_CENTS);
}

// ---- provisioning order + ops rule evaluation (pure, testable) --------------

/** Broad default targeting for a PAUSED object (human finalizes in Ads Manager). */
export function targetingFor(adset) {
  const geo = adset.geo || adset.targeting?.geo || ["US"];
  return { geo_locations: { countries: Array.isArray(geo) ? geo : [geo] }, age_min: 18, ...(adset.targeting || {}) };
}

/** The next object to provision from plan vs persisted state (campaign→adset). */
export function nextObject(plan, state) {
  for (const c of plan.campaigns || []) {
    if (!state.campaigns[c.id]) {
      return { action: "create_campaign", args: { plan_id: c.id, name: `Crossroad — ${c.id}`, objective: c.objective || "OUTCOME_SALES" } };
    }
  }
  for (const c of plan.campaigns || []) {
    const cents = Math.min(adsetDailyCents(plan, c), MAX_DAILY_CENTS);
    for (const a of c.adsets || []) {
      const key = `${c.id}/${a.id || a.name}`;
      if (!state.adsets[key]) {
        return { action: "create_adset", args: {
          plan_key: key, name: `${c.id} — ${a.id || a.name}`, campaign_id: state.campaigns[c.id],
          daily_budget_cents: cents, targeting: targetingFor(a),
          optimization_goal: a.optimization_goal || "OFFSITE_CONVERSIONS", billing_event: a.billing_event || "IMPRESSIONS"
        } };
      }
    }
  }
  return null; // fully provisioned
}

/** Ordered kill/scale proposals from adset insight rows and the plan's rules. */
export function proposalsFrom(plan, adsetRows) {
  const rules = plan.rules || {};
  const floor = rules.roas_floor ?? rules.kill?.threshold ?? 1;
  const minSpend = rules.min_spend_before_action_usd ?? 50;
  const target = rules.roas_scale_target ?? rules.scale?.threshold ?? 2;
  const step = rules.scale?.step_pct ?? 20;
  const out = [];
  for (const r of adsetRows) {
    if (r.spend >= minSpend && r.roas < floor) {
      out.push({ rule: "kill", action: "pause", args: { object_id: r.id }, why: `ROAS ${r.roas} < floor ${floor} after $${r.spend} spend` });
    } else if (r.roas >= target) {
      const next = scaledBudgetCents(r.budget_cents, step);
      if (next > r.budget_cents) out.push({ rule: "scale", action: "update_budget", args: { adset_id: r.id, daily_budget_cents: next }, why: `ROAS ${r.roas} >= target ${target}; +${step}% to ${next}c` });
    }
  }
  return out;
}
