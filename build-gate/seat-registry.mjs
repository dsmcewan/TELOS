// seat-registry.mjs — the seat -> backend registry (previously convention-only).
//
// Maps each council tool name to the MCP server that owns it and the tool name
// on that server. Two backend families:
//
//   - ai-peer-mcp (connectors/ai-peer-mcp/server.mjs): claude_ask stays here
//     (no plugin equivalent), and agy_checkpoint stays here BY DESIGN — the agy
//     approval seat is local governance derived from the dossier, not a model
//     call, and must remain so (see contracts).
//   - claude-plugins seat servers (grok / gemini / codex-api / agy): ndjson-framed
//     stdio MCP servers that return the same {text, provenance:{model,
//     response_id, source}} envelope under include_provenance:true. Grok/gemini/
//     codex chat seats route here; ask_agy is additionally exposed as an
//     ADVISORY model seat (content-addressed provenance) — it does not replace
//     the agy_checkpoint approver.
//
// Plugin location is env-overridable (TELOS_PLUGINS_DIR), defaulting to
// ~/claude-plugins. Model ids stay env/per-call — this file names backends, not
// models (see model-profiles.mjs).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const AI_PEER_SERVER = fileURLToPath(new URL("../connectors/ai-peer-mcp/server.mjs", import.meta.url));

export function pluginsDir() {
  return process.env.TELOS_PLUGINS_DIR || join(homedir(), "claude-plugins");
}

// Council seats speak ai-peer-mcp argument names; plugin seat servers use
// `schema` (provider-native strict structured output) and have no schema_name.
export function mapAskArgs(args = {}) {
  const { response_schema, schema_name, ...rest } = args;
  const out = { ...rest };
  if (response_schema !== undefined) out.schema = response_schema;
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/**
 * Merge a LOADOUT of extra MCP plugin servers into a registry. Their tools are
 * reached through the router's namespaced form — `callTool("name:tool", args)`
 * — so a run can declare any plugins it wants (docs research, search, anything
 * MCP-shaped) without touching the council seat routes. Loadout servers can
 * also be declared in a JSON file via TELOS_LOADOUT (or ~/.telos/loadout.json):
 *   { "servers": { "context7": { "command": "cmd", "args": ["/c","npx","-y","@upstash/context7-mcp"], "framing": "ndjson" } } }
 * Council tool routes always win: a loadout server can never shadow a seat.
 */
export function withLoadout(registry, servers = {}) {
  let fileServers = {};
  const loadoutPath = process.env.TELOS_LOADOUT || join(homedir(), ".telos", "loadout.json");
  try {
    const parsed = JSON.parse(readFileSync(loadoutPath, "utf8"));
    if (parsed && typeof parsed.servers === "object" && parsed.servers) fileServers = parsed.servers;
  } catch { /* no loadout file — programmatic servers only */ }
  return {
    ...registry,
    servers: { ...fileServers, ...servers, ...registry.servers }
  };
}

/**
 * Build the default registry consumed by breakout/seat_router.mjs.
 *   { servers: { name: {command, serverPath, framing} },
 *     tools:   { councilTool: {server, tool, argMap?} } }
 */
export function defaultSeatRegistry({ dir = pluginsDir() } = {}) {
  const pluginServer = (pluginName) => ({
    command: "node",
    serverPath: join(dir, `${pluginName}-plugin`, "servers", "mcp-server.mjs"),
    framing: "ndjson"
  });
  return {
    servers: {
      "ai-peer": { command: "node", serverPath: AI_PEER_SERVER, framing: "content-length", env: { AI_PEER_LONG_TIMEOUT: "1" } },
      grok: pluginServer("grok"),
      gemini: pluginServer("gemini"),
      codex: pluginServer("codex-api"),
      agy: pluginServer("agy")
    },
    tools: {
      claude_ask: { server: "ai-peer", tool: "claude_ask" },
      agy_checkpoint: { server: "ai-peer", tool: "agy_checkpoint" },
      grok_ask: { server: "grok", tool: "ask_grok", argMap: mapAskArgs },
      gemini_ask: { server: "gemini", tool: "ask_gemini", argMap: mapAskArgs },
      codex_ask: { server: "codex", tool: "ask_codex", argMap: mapAskArgs },
      agy_ask: { server: "agy", tool: "ask_agy", argMap: mapAskArgs }
    }
  };
}
