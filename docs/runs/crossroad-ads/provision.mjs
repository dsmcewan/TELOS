#!/usr/bin/env node
// provision.mjs — provision the certified campaign plan as PAUSED Meta objects.
//
// Reads docs/runs/crossroad-phase2/deliverables/ads/campaign-plan.json and
// creates its campaigns -> adsets -> ads through the meta-ads server, which
// forces status=PAUSED and caps daily budgets. Every creation is a signed
// ledger line; every object's Meta id is persisted (provision-state.json) so
// re-runs are idempotent. Without Meta credentials the operator records a
// needs-human go-live checklist and halts — it never fabricates an ad account.
//
//   node docs/runs/crossroad-ads/provision.mjs
//   (with META_ACCESS_TOKEN, META_AD_ACCOUNT_ID, META_PAGE_ID exported)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOperator, renderInbox } from "../../../forge/operator.mjs";
import { loadPlan, hasMetaCreds, missingCreds, metaTools, openMetaRouter, nextObject, MAX_DAILY_CENTS } from "./ads-lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const workdir = path.join(here, "workdir");
mkdirSync(workdir, { recursive: true });
const statePath = path.join(workdir, "provision-state.json");
const loadState = () => { try { return JSON.parse(readFileSync(statePath, "utf8")); } catch { return { campaigns: {}, adsets: {}, ads: {} }; } };
const saveState = (s) => writeFileSync(statePath, JSON.stringify(s, null, 2) + "\n");
const log = (m) => console.log(`[provision] ${m}`);

async function main() {
  const plan = loadPlan();
  const router = hasMetaCreds() ? openMetaRouter() : null;
  const meta = router ? metaTools(router.callTool) : null;

  const bounds = {
    // Missing creds always halts to needs-human (the go-live gate).
    go_live_preflight: (a) => `Meta credentials absent: ${a.missing.join(", ")}. Complete docs/runs/crossroad-threads/HUMAN-SETUP.md, export the env vars, then re-run provision.`,
    create_campaign: () => true,
    create_adset: (a) => a.daily_budget_cents <= MAX_DAILY_CENTS ? true : `daily_budget_cents ${a.daily_budget_cents} exceeds cap ${MAX_DAILY_CENTS}`,
    create_ad: () => true
  };
  const actions = {
    create_campaign: async (a) => {
      const r = await meta.createCampaign({ name: a.name, objective: a.objective });
      const s = loadState(); s.campaigns[a.plan_id] = r.id || r.campaign_id || r.raw; saveState(s);
      return { created: "campaign", plan_id: a.plan_id, id: s.campaigns[a.plan_id], status: "PAUSED" };
    },
    create_adset: async (a) => {
      const r = await meta.createAdset({ name: a.name, campaign_id: a.campaign_id, daily_budget_cents: a.daily_budget_cents, targeting: a.targeting, optimization_goal: a.optimization_goal, billing_event: a.billing_event });
      const s = loadState(); s.adsets[a.plan_key] = r.id || r.adset_id || r.raw; saveState(s);
      return { created: "adset", plan_key: a.plan_key, id: s.adsets[a.plan_key], daily_budget_cents: a.daily_budget_cents, status: "PAUSED" };
    }
  };

  const rulebook = [
    { id: "preflight-credentials", when: () => !hasMetaCreds(), act: () => ({ action: "go_live_preflight", args: { missing: missingCreds() } }) },
    { id: "provision-next", when: (s) => !!s.next, act: (s) => s.next }
  ];

  const op = createOperator({ workdir, rulebook, bounds, actions, signerName: "crossroad-ads" });

  let created = 0, halted = false, reason = "";
  for (let i = 0; i < 50; i++) {
    const state = loadState();
    const snapshot = { next: hasMetaCreds() ? nextObject(plan, state) : null };
    if (hasMetaCreds() && !snapshot.next) break; // fully provisioned
    const r = await op.runPass(snapshot);
    created += r.decisions.filter((d) => d.outcome === "executed").length;
    if (r.halted) { halted = true; reason = r.reason; break; }
    if (!hasMetaCreds()) break;
  }

  if (router) router.close();
  const inbox = renderInbox(workdir);
  const audit = op.verifyLedger();
  log(`ledger: ${audit.total} signed lines, ${audit.invalid} invalid (ok=${audit.ok})`);
  if (halted) {
    log(`HALTED — ${reason}`);
    log(`needs-human: ${inbox.open} open item(s) — see ${path.join(workdir, "INBOX.md")}`);
    log("result: needs-human (ads-ops loop is armed; awaiting Meta credentials / go-live)");
    process.exit(0);
  }
  log(`provisioned ${created} PAUSED object(s) this run; state at ${statePath}`);
  log("result: provisioned (all objects PAUSED — going live is a human click in Ads Manager)");
}

main().catch((e) => { console.error(`[provision] error: ${e?.message || e}`); process.exit(1); });
