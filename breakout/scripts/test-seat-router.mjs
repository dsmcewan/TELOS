#!/usr/bin/env node

// Seat-router tests. Spawning is faked (each fake server records its calls), so
// routing, lazy spawn-per-server, argMap translation, ndjson framing, and the
// fail-closed unknown-tool path are verified with no child processes.

import assert from "node:assert/strict";
import { createNdjsonDecoder, createMcpClient } from "../mcp_client.mjs";
import { createSeatRouter } from "../seat_router.mjs";

// 1. ndjson framing round-trips, including a message split across chunks.
{
  const decoder = createNdjsonDecoder();
  const line = JSON.stringify({ jsonrpc: "2.0", id: 3, result: { ok: true } }) + "\n";
  const mid = Math.floor(line.length / 2);
  assert.deepEqual(decoder.push(line.slice(0, mid)), [], "partial line yields nothing");
  const msgs = decoder.push(line.slice(mid));
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].id, 3);
}

// 2. An ndjson client speaks newline-delimited JSON-RPC end to end.
{
  let onDataCb = null;
  const send = (str) => {
    assert.ok(str.endsWith("\n"), "ndjson client must send newline-terminated messages");
    const req = JSON.parse(str);
    const result = req.method === "initialize"
      ? { serverInfo: { name: "fake-ndjson" } }
      : { content: [{ type: "text", text: `nd:${req.params.name}` }] };
    onDataCb(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }) + "\n");
  };
  const client = createMcpClient({ send, onData: (cb) => { onDataCb = cb; }, framing: "ndjson" });
  assert.equal(await client.callTool("ask_grok", { prompt: "hi" }), "nd:ask_grok");
}

// A fake spawn: returns a client whose callTool records (server, tool, args).
function fakeSpawnFactory(calls, closed) {
  return (opts) => ({
    client: {
      async callTool(tool, args) {
        calls.push({ serverPath: opts.serverPath, framing: opts.framing, tool, args });
        return `answered:${tool}`;
      }
    },
    close: () => closed.push(opts.serverPath)
  });
}

const REGISTRY = {
  servers: {
    "ai-peer": { command: "node", serverPath: "AI_PEER", framing: "content-length" },
    grok: { command: "node", serverPath: "GROK", framing: "ndjson" }
  },
  tools: {
    claude_ask: { server: "ai-peer", tool: "claude_ask" },
    grok_ask: {
      server: "grok",
      tool: "ask_grok",
      argMap: (args) => {
        const { response_schema, schema_name, ...rest } = args;
        return response_schema === undefined ? rest : { ...rest, schema: response_schema };
      }
    }
  }
};

// 3. Tools route to their owning server with the target tool name; servers spawn
//    lazily and only once each.
{
  const calls = [], closed = [];
  const router = createSeatRouter(REGISTRY, { spawn: fakeSpawnFactory(calls, closed) });

  assert.equal(await router.callTool("claude_ask", { prompt: "a" }), "answered:claude_ask");
  assert.equal(await router.callTool("grok_ask", { prompt: "b" }), "answered:ask_grok");
  assert.equal(await router.callTool("grok_ask", { prompt: "c" }), "answered:ask_grok");

  assert.equal(calls[0].serverPath, "AI_PEER");
  assert.equal(calls[1].serverPath, "GROK");
  assert.equal(calls[1].framing, "ndjson");
  assert.equal(calls[1].tool, "ask_grok", "council name grok_ask maps to plugin tool ask_grok");
  assert.equal(calls.length, 3);

  router.close();
  assert.deepEqual(closed.sort(), ["AI_PEER", "GROK"], "close() shuts every spawned server");
}

// 4. argMap translates council argument names (response_schema -> schema) and
//    routes without one pass args through verbatim.
{
  const calls = [];
  const router = createSeatRouter(REGISTRY, { spawn: fakeSpawnFactory(calls, []) });
  await router.callTool("grok_ask", {
    prompt: "p", include_provenance: true,
    response_schema: { type: "object" }, schema_name: "approval"
  });
  assert.deepEqual(calls[0].args, {
    prompt: "p", include_provenance: true, schema: { type: "object" }
  }, "response_schema becomes schema; schema_name is dropped");

  await router.callTool("claude_ask", { prompt: "p", response_schema: { type: "object" } });
  assert.deepEqual(calls[1].args, { prompt: "p", response_schema: { type: "object" } },
    "ai-peer route passes args verbatim");
}

// 5. Namespaced loadout routing: "server:tool" reaches a registered server
//    directly; explicit council routes still win; unknown servers fail closed.
{
  const calls = [];
  const registry = {
    servers: { ...REGISTRY.servers, context7: { command: "cmd", serverPath: "C7", framing: "ndjson" } },
    tools: { ...REGISTRY.tools, "sneaky:alias": { server: "ai-peer", tool: "explicit_wins" } }
  };
  const router = createSeatRouter(registry, { spawn: fakeSpawnFactory(calls, []) });

  assert.equal(await router.callTool("context7:resolve-library-id", { libraryName: "react" }),
    "answered:resolve-library-id");
  assert.equal(calls[0].serverPath, "C7", "namespaced call reaches the loadout server");
  assert.deepEqual(calls[0].args, { libraryName: "react" }, "loadout args pass through verbatim");

  assert.equal(await router.callTool("sneaky:alias", {}), "answered:explicit_wins",
    "an explicit route always wins over namespaced parsing");

  await assert.rejects(() => router.callTool("ghost:tool", {}), /no route/,
    "namespaced call to an unregistered server fails closed");
}

// 6. Fail-closed: an unrouted tool throws before any spawn; a route to a missing
//    server also throws.
{
  const calls = [];
  const router = createSeatRouter(REGISTRY, { spawn: fakeSpawnFactory(calls, []) });
  await assert.rejects(() => router.callTool("mystery_ask", {}), /no route/);
  assert.equal(calls.length, 0, "no backend is contacted for an unrouted tool");

  const broken = createSeatRouter(
    { servers: {}, tools: { x_ask: { server: "ghost", tool: "x" } } },
    { spawn: fakeSpawnFactory(calls, []) }
  );
  await assert.rejects(() => broken.callTool("x_ask", {}), /unknown server/);
}

console.log("test-seat-router: all assertions passed");
