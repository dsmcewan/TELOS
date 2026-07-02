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
      "ai-peer": { command: "node", serverPath: AI_PEER_SERVER, framing: "content-length" },
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
