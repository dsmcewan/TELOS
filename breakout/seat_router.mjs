// seat_router.mjs — multi-server MCP router for council seats.
//
// liveSeatCaller (build-gate/council.mjs) only needs { callTool(name, args) },
// historically satisfied by a single ai-peer-mcp client. This router keeps that
// exact interface while routing each council tool name to the MCP server that
// owns it — the original ai-peer-mcp server, or a claude-plugins seat server
// (grok / gemini / codex-api / agy) speaking ndjson framing.
//
// Trust posture: routing is fail-closed. A tool with no route throws (the seat
// then has no packet and the gate blocks); the router never falls back to a
// different backend than the registry declares. Provenance is untouched — it
// flows through verbatim from whichever server answered.
//
// Registry shape (see build-gate/seat-registry.mjs for the default):
//   {
//     servers: { name: { command, serverPath, framing?, env? } },
//     tools:   { councilToolName: { server, tool, argMap? } }
//   }
// argMap(args) -> args lets a route translate the council's argument names to
// the target server's (e.g. response_schema -> schema for plugin seats).

import { spawnMcpClient } from "./mcp_client.mjs";

export function createSeatRouter(registry, { spawn = spawnMcpClient } = {}) {
  if (!registry || typeof registry !== "object") throw new Error("seat-router: a registry is required");
  const servers = registry.servers || {};
  const tools = registry.tools || {};
  const live = new Map(); // server name -> { client, close }

  function clientFor(name) {
    let entry = live.get(name);
    if (!entry) {
      const srv = servers[name];
      if (!srv) throw new Error(`seat-router: tool routed to unknown server "${name}"`);
      entry = spawn({
        command: srv.command,
        serverPath: srv.serverPath,
        args: srv.args,
        env: srv.env,
        framing: srv.framing
      });
      live.set(name, entry);
    }
    return entry.client;
  }

  return {
    async callTool(name, args) {
      const route = tools[name];
      if (route) {
        const mapped = route.argMap ? route.argMap(args || {}) : (args || {});
        return clientFor(route.server).callTool(route.tool, mapped);
      }
      // Namespaced loadout form: "server:tool" reaches any registered plugin
      // server directly (docs research, search, ...). Explicit council routes
      // always win above; unknown servers still fail closed.
      const sep = name.indexOf(":");
      if (sep > 0) {
        const serverName = name.slice(0, sep);
        const toolName = name.slice(sep + 1);
        if (servers[serverName] && toolName) {
          return clientFor(serverName).callTool(toolName, args || {});
        }
      }
      throw new Error(`seat-router: no route for tool "${name}" (fail-closed)`);
    },
    close() {
      for (const { close } of live.values()) {
        try { close(); } catch { /* already dead */ }
      }
      live.clear();
    }
  };
}
