import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverPath = join(here, "..", "server.mjs");

const child = spawn(process.execPath, [serverPath], {
  stdio: ["pipe", "pipe", "inherit"]
});

let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drain();
});

function drain() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) throw new Error(`Invalid header: ${header}`);
    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (buffer.length < bodyEnd) return;
    const body = buffer.slice(bodyStart, bodyEnd).toString("utf8");
    buffer = buffer.slice(bodyEnd);
    const message = JSON.parse(body);
    const resolver = pending.get(message.id);
    if (resolver) {
      pending.delete(message.id);
      resolver(message);
    }
  }
}

function request(method, params = {}) {
  const id = nextId++;
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params
  });
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  return new Promise((resolve) => pending.set(id, resolve));
}

const init = await request("initialize", { protocolVersion: "2024-11-05" });
assert(!init.error, `initialize failed: ${JSON.stringify(init.error)}`);
assert(init.result.serverInfo.name === "ai-peer-mcp", "unexpected server name");

const listed = await request("tools/list");
assert(!listed.error, `tools/list failed: ${JSON.stringify(listed.error)}`);
const names = listed.result.tools.map((tool) => tool.name);
for (const required of ["claude_ask", "grok_ask", "codex_ask", "agy_checkpoint", "council_review"]) {
  assert(names.includes(required), `missing tool ${required}`);
}

const resources = await request("resources/list");
assert(!resources.error, `resources/list failed: ${JSON.stringify(resources.error)}`);
assert(Array.isArray(resources.result.resources), "resources/list did not return an array");

const resourceTemplates = await request("resources/templates/list");
assert(!resourceTemplates.error, `resources/templates/list failed: ${JSON.stringify(resourceTemplates.error)}`);
assert(Array.isArray(resourceTemplates.result.resourceTemplates), "resources/templates/list did not return an array");

const prompts = await request("prompts/list");
assert(!prompts.error, `prompts/list failed: ${JSON.stringify(prompts.error)}`);
assert(Array.isArray(prompts.result.prompts), "prompts/list did not return an array");

const checkpoint = await request("tools/call", {
  name: "agy_checkpoint",
  arguments: {
    phase: "pilot",
    scope: "shared/Coordination",
    required_packets: ["claude-intake", "grok-review"],
    present_packets: ["claude-intake"],
    protected_path_check: "pass"
  }
});
assert(!checkpoint.error, `agy_checkpoint failed: ${JSON.stringify(checkpoint.error)}`);
const text = checkpoint.result.content[0].text;
assert(text.includes("Missing packets: grok-review"), "checkpoint did not report missing packet");
// agy now carries its own local-deterministic provenance (content-addressed).
const checkpointObj = JSON.parse(text);
assert(checkpointObj.provenance && checkpointObj.provenance.attestation === "local-deterministic",
  "agy_checkpoint did not carry local-deterministic provenance");
assert(/^agy-[0-9a-f]{40}$/.test(checkpointObj.provenance.response_id || ""),
  "agy_checkpoint provenance.response_id is not a content-addressed attestation");

child.stdin.end();
child.kill();

try {
  await once(child, "exit");
} catch {
  // The process may already be gone after kill().
}

console.log("ai-peer-mcp smoke test passed");

function assert(condition, message) {
  if (!condition) {
    child.kill();
    throw new Error(message);
  }
}
