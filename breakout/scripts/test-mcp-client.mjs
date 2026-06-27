#!/usr/bin/env node

// MCP stdio client tests. The transport is faked (a tiny in-process echo server),
// so the JSON-RPC framing + correlation are verified with no real child process
// and no API keys. The live spawn path is exercised separately with keys.

import assert from "node:assert/strict";
import { frameMessage, createFrameDecoder, createMcpClient } from "../mcp_client.mjs";

// 1. Content-Length framing round-trips, including a message split across chunks.
{
  const decoder = createFrameDecoder();
  const framed = frameMessage({ jsonrpc: "2.0", id: 7, result: { ok: true } });
  const mid = Math.floor(framed.length / 2);
  assert.deepEqual(decoder.push(framed.slice(0, mid)), [], "partial frame yields nothing");
  const msgs = decoder.push(framed.slice(mid));
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].id, 7);
  assert.equal(msgs[0].result.ok, true);
}

// 2. callTool initializes once, then calls the tool, and returns its text content.
{
  let onDataCb = null;
  const serverDecoder = createFrameDecoder();
  const sent = [];
  const send = (str) => {
    sent.push(str);
    for (const req of serverDecoder.push(str)) {
      if (req.method === "initialize") {
        onDataCb(frameMessage({ jsonrpc: "2.0", id: req.id, result: { serverInfo: { name: "fake" } } }));
      } else if (req.method === "tools/call") {
        onDataCb(frameMessage({
          jsonrpc: "2.0",
          id: req.id,
          result: { content: [{ type: "text", text: `echo:${req.params.name}` }] }
        }));
      }
    }
  };
  const client = createMcpClient({ send, onData: (cb) => { onDataCb = cb; } });
  const text = await client.callTool("grok_ask", { prompt: "hi" });
  assert.equal(text, "echo:grok_ask");

  const methods = sent.map((s) => JSON.parse(s.split("\r\n\r\n")[1]).method);
  assert.deepEqual(methods, ["initialize", "tools/call"], "initialize must precede the tool call");
}

// 3. A tool error rejects the callTool promise.
{
  let onDataCb = null;
  const serverDecoder = createFrameDecoder();
  const send = (str) => {
    for (const req of serverDecoder.push(str)) {
      if (req.method === "initialize") {
        onDataCb(frameMessage({ jsonrpc: "2.0", id: req.id, result: {} }));
      } else {
        onDataCb(frameMessage({ jsonrpc: "2.0", id: req.id, error: { code: -32603, message: "Missing XAI_API_KEY" } }));
      }
    }
  };
  const client = createMcpClient({ send, onData: (cb) => { onDataCb = cb; } });
  await assert.rejects(() => client.callTool("grok_ask", { prompt: "hi" }), /Missing XAI_API_KEY/);
}

console.log("mcp-client: all tests passed");
