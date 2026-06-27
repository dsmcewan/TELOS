#!/usr/bin/env node

import assert from "node:assert/strict";
import { execSync, spawn } from "node:child_process";
import { once } from "node:events";

console.log("Starting MCP Server Stress & Registry Tests...");

// ----------------------------------------------------
// 1. Dynamic HKCU Registry Key Env Var Loading Test
// ----------------------------------------------------
if (process.platform === "win32") {
  console.log("Running HKCU Registry environment loading test...");
  
  // Set up temporary registry keys
  const testKey1 = "TEST_TEMP_REG_SZ";
  const testVal1 = "RegistryValueWith Spaces";
  const testKey2 = "TEST_TEMP_REG_EXPAND";
  const testVal2 = "%TEST_TEMP_REG_SZ%\\Subfolder";

  // Clean up any stale keys first, just in case
  try { execSync(`reg delete HKCU\\Environment /v ${testKey1} /f`, { stdio: "ignore" }); } catch {}
  try { execSync(`reg delete HKCU\\Environment /v ${testKey2} /f`, { stdio: "ignore" }); } catch {}

  // Delete from process.env to ensure we start clean
  delete process.env[testKey1];
  delete process.env[testKey2];

  try {
    // Add keys to registry
    execSync(`reg add HKCU\\Environment /v ${testKey1} /t REG_SZ /d "${testVal1}" /f`, { stdio: "inherit" });
    execSync(`reg add HKCU\\Environment /v ${testKey2} /t REG_EXPAND_SZ /d "${testVal2}" /f`, { stdio: "inherit" });

    // Now, run the HKCU querying logic (extracted from server.mjs)
    function loadWin32Env() {
      const output = execSync("reg query HKCU\\Environment", { stdio: ["ignore", "pipe", "ignore"] }).toString();
      const lines = output.split(/\r?\n/);
      const registryVars = new Map();
      
      for (const line of lines) {
        const match = line.match(/^\s+(\S+)\s+(REG_SZ|REG_EXPAND_SZ)\s+(.+)$/);
        if (match) {
          const name = match[1];
          const type = match[2];
          const value = match[3].trim();
          registryVars.set(name, { type, value });
        }
      }
      
      for (const [name, info] of registryVars.entries()) {
        if (!process.env[name]) {
          let finalValue = info.value;
          if (info.type === "REG_EXPAND_SZ") {
            finalValue = finalValue.replace(/%([^%]+)%/g, (m, key) => {
              if (process.env[key] !== undefined) {
                return process.env[key];
              }
              if (registryVars.has(key)) {
                return registryVars.get(key).value;
              }
              return m;
            });
          }
          process.env[name] = finalValue;
        }
      }
      return registryVars;
    }

    const regVars = loadWin32Env();

    // Assert the variables are present and correct in process.env
    assert.equal(process.env[testKey1], testVal1, "REG_SZ variable was not loaded correctly.");
    assert.equal(process.env[testKey2], `${testVal1}\\Subfolder`, "REG_EXPAND_SZ variable was not expanded correctly.");
    console.log("Registry variable expansion checks passed.");

  } finally {
    // Clean up registry
    try { execSync(`reg delete HKCU\\Environment /v ${testKey1} /f`, { stdio: "inherit" }); } catch {}
    try { execSync(`reg delete HKCU\\Environment /v ${testKey2} /f`, { stdio: "inherit" }); } catch {}
    delete process.env[testKey1];
    delete process.env[testKey2];
    console.log("Registry cleanup complete.");
  }
} else {
  console.log("Skipping HKCU environment loading test (not on win32).");
}

// ----------------------------------------------------
// 2. agy_checkpoint Tool Verification
// ----------------------------------------------------
console.log("Running agy_checkpoint tool stress tests...");

// We will spawn the server and call agy_checkpoint with various configurations
const serverPath = "./server.mjs";
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

// Initialize server
const init = await request("initialize", { protocolVersion: "2024-11-05" });
assert(!init.error, `initialize failed: ${JSON.stringify(init.error)}`);

// Helper to call agy_checkpoint tool
async function callCheckpoint(args) {
  const response = await request("tools/call", {
    name: "agy_checkpoint",
    arguments: args
  });
  assert(!response.error, `agy_checkpoint tool error: ${JSON.stringify(response.error)}`);
  return JSON.parse(response.result.content[0].text);
}

// Test A: Blocked due to missing packets
const r1 = await callCheckpoint({
  required_packets: ["claude-intake", "codex-review"],
  present_packets: ["claude-intake"]
});
assert.equal(r1.phase_gate_status, "blocked");
assert.ok(r1.blocked_reasons.some(r => r.includes("Missing packets: codex-review")));
assert.equal(r1.next_owner, "agy", "Owner choice should be 'agy' for missing packets");

// Test B: Blocked due to LEXI checks
const r2 = await callCheckpoint({
  lexi_required: true,
  lexi_reference_read: false
});
assert.equal(r2.phase_gate_status, "blocked");
assert.ok(r2.blocked_reasons.some(r => r.includes("LEXI is required, but LEXI_DB_REFERENCE.md has not been read")));
assert.equal(r2.next_owner, "forensic-agent", "Owner choice should be 'forensic-agent' for LEXI blocks");

// Test C: Blocked due to broad patch without user approval
const r3 = await callCheckpoint({
  broad_patch_requested: true,
  user_approved_patch: false
});
assert.equal(r3.phase_gate_status, "blocked");
assert.ok(r3.blocked_reasons.some(r => r.includes("Broad patch requested without explicit user approval")));
assert.equal(r3.next_owner, "user", "Owner choice should be 'user' for user approval blocks");

// Test D: Blocked due to protected path check failure
const r4 = await callCheckpoint({
  protected_path_check: "fail"
});
assert.equal(r4.phase_gate_status, "blocked");
assert.ok(r4.blocked_reasons.some(r => r.includes("Protected path check is not pass")));
assert.equal(r4.next_owner, "codex", "Owner choice should be 'codex' for protected path blocks");

// Test E: Passing case
const r5 = await callCheckpoint({
  required_packets: ["claude-intake"],
  present_packets: ["claude-intake"],
  lexi_required: true,
  lexi_reference_read: true,
  protected_path_check: "pass"
});
assert.equal(r5.phase_gate_status, "advance");
assert.equal(r5.next_owner, "codex");
assert.equal(r5.blocked_reasons.length, 0);

// Close MCP server connection
child.stdin.end();
child.kill();

try {
  await once(child, "exit");
} catch {}

console.log("All MCP server stress tests completed successfully!");
