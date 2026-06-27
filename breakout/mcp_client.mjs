// mcp_client.mjs — minimal MCP stdio client for the ai-peer-mcp server.
//
// Speaks JSON-RPC over Content-Length-framed stdio (the same framing the server
// uses) and exposes callTool(name, args) -> text. The transport is injected, so
// the protocol is testable with no child process and no API keys; spawnMcpClient
// wires it to a real `node server.mjs` for live runs.

import { spawn as nodeSpawn } from "node:child_process";

export function frameMessage(obj) {
  const body = JSON.stringify(obj);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

export function createFrameDecoder() {
  let buffer = Buffer.alloc(0);
  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8")]);
      const messages = [];
      while (true) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) break;
        const header = buffer.slice(0, headerEnd).toString("utf8");
        const match = header.match(/content-length:\s*(\d+)/i);
        if (!match) {
          buffer = buffer.slice(headerEnd + 4);
          continue;
        }
        const length = Number(match[1]);
        const start = headerEnd + 4;
        const end = start + length;
        if (buffer.length < end) break;
        const body = buffer.slice(start, end).toString("utf8");
        buffer = buffer.slice(end);
        try {
          messages.push(JSON.parse(body));
        } catch {
          // skip unparseable frame
        }
      }
      return messages;
    }
  };
}

export function createMcpClient({ send, onData }) {
  let nextId = 1;
  const pending = new Map();
  const decoder = createFrameDecoder();

  onData((chunk) => {
    for (const msg of decoder.push(chunk)) {
      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || `MCP error ${msg.error.code}`));
        else resolve(msg.result);
      }
    }
  });

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      send(frameMessage({ jsonrpc: "2.0", id, method, params }));
    });
  }

  let initialized = null;
  function initialize() {
    if (!initialized) {
      initialized = request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "breakout", version: "0.1.0" }
      });
    }
    return initialized;
  }

  return {
    initialize,
    async callTool(name, args) {
      await initialize();
      const result = await request("tools/call", { name, arguments: args });
      const parts = Array.isArray(result?.content) ? result.content : [];
      return parts
        .filter((p) => p?.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join("\n");
    }
  };
}

/**
 * Spawn the ai-peer-mcp server and return a live MCP client. Requires the
 * server's env (ANTHROPIC_API_KEY / XAI_API_KEY etc.) to be set; the user runs
 * this path. Default serverPath assumes the standard vault layout.
 */
export function spawnMcpClient({
  command = "node",
  serverPath = "../connectors/ai-peer-mcp/server.mjs",
  env = {}
} = {}) {
  const child = nodeSpawn(command, [serverPath], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "inherit"]
  });
  const client = createMcpClient({
    send: (str) => child.stdin.write(str),
    onData: (cb) => child.stdout.on("data", cb)
  });
  return { client, child, close: () => child.kill() };
}
