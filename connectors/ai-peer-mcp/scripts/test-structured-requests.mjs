#!/usr/bin/env node
// test-structured-requests.mjs — each backend must build its provider's NATIVE
// structured-output request when a response_schema is passed, and the plain
// request when it is absent (back-compat). Keyless: globalThis.fetch is mocked to
// capture the request and return a canned response; no network, no real keys.
import assert from "node:assert/strict";
import { askClaude, askGrok, askCodex, askGemini } from "../server.mjs";

// Dummy keys so requireEnv passes (never used — fetch is mocked).
process.env.ANTHROPIC_API_KEY = "test";
process.env.XAI_API_KEY = "test";
process.env.OPENAI_API_KEY = "test";
process.env.GEMINI_API_KEY = "test";

const realFetch = globalThis.fetch;
let last = null;
function mockFetch(responseJson) {
  globalThis.fetch = async (url, opts) => {
    last = { url, opts, body: JSON.parse(opts.body) };
    return { ok: true, status: 200, text: async () => JSON.stringify(responseJson) };
  };
}
function restore() { globalThis.fetch = realFetch; last = null; }

const SCHEMA = { type: "object", properties: { decision: { type: "string" } }, required: ["decision"], additionalProperties: false };

// --- OpenAI/xAI: response_format json_schema strict when schema given ---
for (const [name, ask, model] of [["grok", askGrok, "grok"], ["codex", askCodex, "codex"]]) {
  mockFetch({ model: `${name}-x`, id: "chatcmpl_1", choices: [{ message: { content: '{"decision":"approve"}' } }] });
  await ask({ prompt: "p", model, response_schema: SCHEMA, schema_name: "approval" });
  const rf = last.body.response_format;
  assert.ok(rf, `${name}: response_format present with schema`);
  assert.equal(rf.type, "json_schema");
  assert.equal(rf.json_schema.strict, true, `${name}: strict mode`);
  assert.equal(rf.json_schema.name, "approval");
  assert.deepEqual(rf.json_schema.schema, SCHEMA, `${name}: passes the schema through`);
  restore();

  mockFetch({ model: `${name}-x`, id: "chatcmpl_2", choices: [{ message: { content: "hi" } }] });
  await ask({ prompt: "p", model });
  assert.equal(last.body.response_format, undefined, `${name}: no response_format without a schema (back-compat)`);
  restore();
}
console.log("OK: grok/codex emit response_format json_schema strict");

// --- Anthropic: forced single tool call when schema given; plain messages without ---
{
  mockFetch({ model: "claude-x", id: "msg_1", content: [{ type: "tool_use", name: "approval", input: { decision: "approve" } }] });
  const out = await askClaude({ prompt: "p", model: "sonnet", response_schema: SCHEMA, schema_name: "approval" });
  assert.ok(Array.isArray(last.body.tools) && last.body.tools[0].input_schema, "claude: forced tool carries input_schema");
  assert.deepEqual(last.body.tools[0].input_schema, SCHEMA);
  assert.deepEqual(last.body.tool_choice, { type: "tool", name: "approval" }, "claude: tool_choice forces the one tool");
  assert.equal(out.text, JSON.stringify({ decision: "approve" }), "claude: structured text is the tool input, stringified");
  assert.equal(out.model, "claude-x", "claude: provenance model from response");
  assert.equal(out.id, "msg_1", "claude: provenance id from response");
  restore();

  mockFetch({ model: "claude-x", id: "msg_2", content: [{ type: "text", text: "hi" }] });
  await askClaude({ prompt: "p", model: "sonnet" });
  assert.equal(last.body.tools, undefined, "claude: no tools without a schema (back-compat)");
  restore();
}
console.log("OK: claude forces a tool call for structured output");

// --- Gemini: responseSchema + responseMimeType, correct URL + header ---
{
  mockFetch({ modelVersion: "gemini-x", responseId: "resp_1", candidates: [{ content: { parts: [{ text: '{"decision":"approve"}' }] } }] });
  const out = await askGemini({ prompt: "p", system: "sys", model: "gemini", response_schema: SCHEMA, schema_name: "approval" });
  assert.match(last.url, /:generateContent$/, "gemini: generateContent endpoint");
  assert.equal(last.opts.headers["x-goog-api-key"], "test", "gemini: x-goog-api-key header (not Bearer)");
  assert.equal(last.body.generationConfig.responseMimeType, "application/json", "gemini: JSON mime");
  assert.deepEqual(last.body.generationConfig.responseSchema, SCHEMA, "gemini: responseSchema passed");
  assert.deepEqual(last.body.systemInstruction, { parts: [{ text: "sys" }] }, "gemini: systemInstruction shape");
  assert.equal(last.body.contents[0].parts[0].text, "p", "gemini: prompt in contents");
  assert.equal(out.text, '{"decision":"approve"}', "gemini: text from candidates parts");
  assert.equal(out.model, "gemini-x", "gemini: provenance model from modelVersion");
  assert.equal(out.id, "resp_1", "gemini: provenance id from responseId");
  restore();

  mockFetch({ modelVersion: "gemini-x", responseId: "resp_2", candidates: [{ content: { parts: [{ text: "hi" }] } }] });
  await askGemini({ prompt: "p", model: "gemini" });
  assert.equal(last.body.generationConfig.responseSchema, undefined, "gemini: no responseSchema without a schema");
  assert.equal(last.body.systemInstruction, undefined, "gemini: no systemInstruction without system");
  restore();
}
console.log("OK: gemini emits responseSchema with x-goog-api-key");

// --- fail-closed: a missing key throws (no fetch) ---
{
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(() => askGemini({ prompt: "p", model: "gemini" }), /GEMINI_API_KEY/, "gemini fail-closes without a key");
  process.env.GEMINI_API_KEY = "test";
}
console.log("OK: missing key fail-closes");

console.log("test-structured-requests.mjs OK");
