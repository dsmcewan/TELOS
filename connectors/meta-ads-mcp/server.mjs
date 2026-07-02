#!/usr/bin/env node
// meta-ads-mcp — zero-dep stdio MCP server wrapping the Meta Marketing API for
// the agent-operated ads loop. ndjson framing (loadout-compatible: reached via
// the seat router as `meta:<tool>`).
//
// SAFETY INVARIANTS (not configurable off):
//   - every created campaign/adset/ad defaults to status PAUSED — going live is
//     a human click in Ads Manager, never an API default
//   - update_budget refuses daily budgets above META_MAX_DAILY_CENTS
//     (default 2000 = $20/day) — the certified plan's bounds, enforced twice
//   - no delete tool exists; pause is the strongest destructive action
//
// Env: META_ACCESS_TOKEN (system-user token), META_AD_ACCOUNT_ID (act_...),
//      META_PAGE_ID, META_API_VERSION (default v23.0), META_MAX_DAILY_CENTS.

import readline from "node:readline";
import { request as httpsRequest } from "node:https";

const API_VERSION = process.env.META_API_VERSION || "v23.0";
const BASE = `https://graph.facebook.com/${API_VERSION}`;
const MAX_DAILY_CENTS = Number(process.env.META_MAX_DAILY_CENTS) || 2000;
const SERVER_INFO = { name: "meta-ads", version: "0.1.0" };

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — complete HUMAN-SETUP.md section A first.`);
  return v;
}

function graph(method, path, params = {}) {
  return new Promise((resolve, reject) => {
    const token = env("META_ACCESS_TOKEN");
    const payload = new URLSearchParams({ ...flatten(params), access_token: token }).toString();
    const isGet = method === "GET";
    const url = isGet ? `${BASE}${path}?${payload}` : `${BASE}${path}`;
    const req = httpsRequest(url, {
      method,
      headers: isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(payload) },
      timeout: 120_000,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => {
        let json;
        try { json = JSON.parse(text); } catch { return reject(new Error(`Meta API non-JSON response: ${text.slice(0, 400)}`)); }
        if (json.error) return reject(new Error(`Meta API error: ${JSON.stringify(json.error).slice(0, 600)}`));
        resolve(json);
      });
    });
    req.on("timeout", () => req.destroy(new Error("Meta API request timed out")));
    req.on("error", reject);
    if (!isGet) req.write(payload);
    req.end();
  });
}

// Graph API takes JSON-encoded values for object/array params.
function flatten(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return out;
}

const acct = () => env("META_AD_ACCOUNT_ID");

const TOOLS = {
  create_campaign: {
    description: "Create a campaign (ALWAYS status=PAUSED). Args: name, objective (e.g. OUTCOME_SALES), special_ad_categories (default []).",
    schema: { type: "object", properties: { name: { type: "string" }, objective: { type: "string" }, special_ad_categories: { type: "array" } }, required: ["name", "objective"] },
    run: (a) => graph("POST", `/${acct()}/campaigns`, {
      name: a.name, objective: a.objective, status: "PAUSED",
      special_ad_categories: a.special_ad_categories || []
    })
  },
  create_adset: {
    description: "Create an ad set (ALWAYS status=PAUSED; daily_budget_cents capped). Args: name, campaign_id, daily_budget_cents, targeting (Meta targeting spec), optimization_goal, billing_event, promoted_pixel_id?, custom_event_type?.",
    schema: { type: "object", properties: { name: { type: "string" }, campaign_id: { type: "string" }, daily_budget_cents: { type: "number" }, targeting: { type: "object" }, optimization_goal: { type: "string" }, billing_event: { type: "string" }, promoted_pixel_id: { type: "string" }, custom_event_type: { type: "string" } }, required: ["name", "campaign_id", "daily_budget_cents", "targeting", "optimization_goal", "billing_event"] },
    run: (a) => {
      if (a.daily_budget_cents > MAX_DAILY_CENTS) throw new Error(`daily_budget_cents ${a.daily_budget_cents} exceeds cap ${MAX_DAILY_CENTS} — needs-human`);
      return graph("POST", `/${acct()}/adsets`, {
        name: a.name, campaign_id: a.campaign_id, status: "PAUSED",
        daily_budget: a.daily_budget_cents, targeting: a.targeting,
        optimization_goal: a.optimization_goal, billing_event: a.billing_event,
        ...(a.promoted_pixel_id ? { promoted_object: { pixel_id: a.promoted_pixel_id, custom_event_type: a.custom_event_type || "PURCHASE" } } : {})
      });
    }
  },
  create_ad: {
    description: "Create an ad from a creative spec (ALWAYS status=PAUSED). Args: name, adset_id, creative (Meta creative spec, e.g. {object_story_spec:...}).",
    schema: { type: "object", properties: { name: { type: "string" }, adset_id: { type: "string" }, creative: { type: "object" } }, required: ["name", "adset_id", "creative"] },
    run: async (a) => {
      const cr = await graph("POST", `/${acct()}/adcreatives`, { name: `${a.name} creative`, ...a.creative });
      return graph("POST", `/${acct()}/ads`, { name: a.name, adset_id: a.adset_id, status: "PAUSED", creative: { creative_id: cr.id } });
    }
  },
  get_insights: {
    description: "Read performance insights. Args: object_id (account/campaign/adset/ad id), date_preset (default last_7d), fields (default spend,impressions,clicks,ctr,actions,purchase_roas), level?.",
    schema: { type: "object", properties: { object_id: { type: "string" }, date_preset: { type: "string" }, fields: { type: "string" }, level: { type: "string" } }, required: ["object_id"] },
    run: (a) => graph("GET", `/${a.object_id}/insights`, {
      date_preset: a.date_preset || "last_7d",
      fields: a.fields || "spend,impressions,clicks,ctr,cpc,actions,purchase_roas",
      ...(a.level ? { level: a.level } : {})
    })
  },
  list_objects: {
    description: "List campaigns/adsets/ads with status. Args: kind (campaigns|adsets|ads), fields (default name,status,effective_status,daily_budget).",
    schema: { type: "object", properties: { kind: { type: "string" }, fields: { type: "string" } }, required: ["kind"] },
    run: (a) => graph("GET", `/${acct()}/${a.kind}`, { fields: a.fields || "name,status,effective_status,daily_budget", limit: 100 })
  },
  update_budget: {
    description: `Update an ad set's daily budget (cents; hard cap ${MAX_DAILY_CENTS}). Args: adset_id, daily_budget_cents.`,
    schema: { type: "object", properties: { adset_id: { type: "string" }, daily_budget_cents: { type: "number" } }, required: ["adset_id", "daily_budget_cents"] },
    run: (a) => {
      if (a.daily_budget_cents > MAX_DAILY_CENTS) throw new Error(`daily_budget_cents ${a.daily_budget_cents} exceeds cap ${MAX_DAILY_CENTS} — needs-human`);
      return graph("POST", `/${a.adset_id}`, { daily_budget: a.daily_budget_cents });
    }
  },
  pause: {
    description: "Pause a campaign, ad set, or ad. Args: object_id. (The strongest destructive action this server offers.)",
    schema: { type: "object", properties: { object_id: { type: "string" } }, required: ["object_id"] },
    run: (a) => graph("POST", `/${a.object_id}`, { status: "PAUSED" })
  }
};

function toolList() {
  return Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description, inputSchema: t.schema }));
}

function send(msg) { process.stdout.write(JSON.stringify(msg) + "\n"); }

async function handle(req) {
  const { id, method, params } = req;
  switch (method) {
    case "initialize":
      send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: SERVER_INFO } });
      break;
    case "notifications/initialized": break;
    case "ping": send({ jsonrpc: "2.0", id, result: {} }); break;
    case "tools/list": send({ jsonrpc: "2.0", id, result: { tools: toolList() } }); break;
    case "tools/call": {
      try {
        const tool = TOOLS[params?.name];
        if (!tool) throw new Error(`Unknown tool: ${params?.name}`);
        const result = await tool.run(params.arguments || {});
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }] } });
      } catch (err) {
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true } });
      }
      break;
    }
    default:
      if (id !== undefined) send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let req;
  try { req = JSON.parse(line); } catch { return; }
  handle(req).catch((err) => {
    if (req.id !== undefined) send({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: err.message } });
  });
});
