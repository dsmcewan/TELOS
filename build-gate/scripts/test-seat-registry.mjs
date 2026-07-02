#!/usr/bin/env node

// Seat-registry tests: the default registry keeps the trust-relevant routes on
// ai-peer-mcp (claude_ask, agy_checkpoint), sends the chat seats to their plugin
// servers with argMap translation, and honors TELOS_PLUGINS_DIR.

import assert from "node:assert/strict";
import { join } from "node:path";
import { defaultSeatRegistry, mapAskArgs } from "../seat-registry.mjs";

// 1. mapAskArgs: response_schema -> schema, schema_name dropped, undefined pruned.
{
  const mapped = mapAskArgs({
    prompt: "p", system: undefined, model: "m",
    include_provenance: true, response_schema: { type: "object" }, schema_name: "approval"
  });
  assert.deepEqual(mapped, {
    prompt: "p", model: "m", include_provenance: true, schema: { type: "object" }
  });
  assert.deepEqual(mapAskArgs({ prompt: "p" }), { prompt: "p" }, "no schema -> untouched");
}

// 2. Trust-relevant seats stay on ai-peer-mcp; chat seats route to plugin servers.
{
  const reg = defaultSeatRegistry({ dir: join("X", "plugins") });

  assert.equal(reg.tools.claude_ask.server, "ai-peer");
  assert.equal(reg.tools.agy_checkpoint.server, "ai-peer",
    "the agy APPROVAL seat is local governance — it must not become a model call");
  assert.equal(reg.tools.agy_checkpoint.argMap, undefined);

  for (const [councilTool, pluginTool, server] of [
    ["grok_ask", "ask_grok", "grok"],
    ["gemini_ask", "ask_gemini", "gemini"],
    ["codex_ask", "ask_codex", "codex"],
    ["agy_ask", "ask_agy", "agy"]
  ]) {
    const route = reg.tools[councilTool];
    assert.equal(route.server, server);
    assert.equal(route.tool, pluginTool);
    assert.equal(route.argMap, mapAskArgs, `${councilTool} translates ask args`);
    const srv = reg.servers[server];
    assert.equal(srv.framing, "ndjson");
    assert.ok(srv.serverPath.startsWith(join("X", "plugins")),
      `${server} server path honors the plugins dir override`);
    assert.ok(srv.serverPath.endsWith(join("servers", "mcp-server.mjs")));
  }

  assert.equal(reg.servers["ai-peer"].framing, "content-length");
  assert.ok(reg.servers["ai-peer"].serverPath.endsWith("server.mjs"));
  assert.ok(reg.servers.codex.serverPath.includes("codex-api-plugin"),
    "codex seat maps to the codex-api plugin directory");
}

// 3. TELOS_PLUGINS_DIR env override reaches the default dir.
{
  const prev = process.env.TELOS_PLUGINS_DIR;
  process.env.TELOS_PLUGINS_DIR = join("Y", "override");
  try {
    const reg = defaultSeatRegistry();
    assert.ok(reg.servers.grok.serverPath.startsWith(join("Y", "override")));
  } finally {
    if (prev === undefined) delete process.env.TELOS_PLUGINS_DIR;
    else process.env.TELOS_PLUGINS_DIR = prev;
  }
}

console.log("test-seat-registry: all assertions passed");
