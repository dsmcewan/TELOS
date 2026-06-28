#!/usr/bin/env node

// Provenance parser tests: the REAL response model/id are captured from the API
// JSON, not the requested model string. Pure, keyless.

import assert from "node:assert/strict";
import {
  extractAnthropicResult,
  extractAnthropicStructuredResult,
  extractGrokResult,
  extractAnthropicText,
  extractOpenAIResult,
  extractGeminiResult,
  agyAttestation,
  agyCheckpoint
} from "../lib.mjs";

// Anthropic STRUCTURED: the JSON is the tool_use block's input, stringified; model
// + id still come from the response, never the tool input.
{
  const json = {
    id: "msg_struct",
    model: "claude-x",
    content: [
      { type: "text", text: "let me decide" },
      { type: "tool_use", name: "approval", input: { decision: "approve", confidence: "high" } }
    ]
  };
  const r = extractAnthropicStructuredResult(json);
  assert.equal(r.text, JSON.stringify({ decision: "approve", confidence: "high" }), "tool input becomes stringified text");
  assert.equal(r.model, "claude-x");
  assert.equal(r.id, "msg_struct");
  // No tool_use block (declined) => degrade to text, never throw.
  const declined = extractAnthropicStructuredResult({ id: "m", model: "c", content: [{ type: "text", text: "no" }] });
  assert.equal(declined.text, "no", "falls back to text when no tool_use block");
}

// Gemini: text from candidates parts; provenance from modelVersion/responseId;
// honest-null when absent; never throws.
{
  const json = { modelVersion: "gemini-x", responseId: "resp_9", candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
  const r = extractGeminiResult(json);
  assert.equal(r.text, '{"ok":true}');
  assert.equal(r.model, "gemini-x");
  assert.equal(r.id, "resp_9");
  const bare = extractGeminiResult({ candidates: [{ content: { parts: [{ text: "hi" }] } }] });
  assert.equal(bare.text, "hi");
  assert.equal(bare.model, null, "no modelVersion => honest-null model");
  assert.equal(bare.id, null, "no responseId => honest-null id");
  assert.doesNotThrow(() => extractGeminiResult({}), "never throws on a malformed response");
}

// Anthropic: model + id come from the response body, not the request.
{
  const json = {
    id: "msg_01ABC",
    model: "claude-opus-4-8",
    content: [{ type: "text", text: "hello" }, { type: "thinking", text: "ignored" }]
  };
  const r = extractAnthropicResult(json);
  assert.equal(r.text, "hello");
  assert.equal(r.model, "claude-opus-4-8");
  assert.equal(r.id, "msg_01ABC");
}

// Grok / xAI shape.
{
  const json = { id: "grok-123", model: "grok-4", choices: [{ message: { content: "world" } }] };
  const r = extractGrokResult(json);
  assert.equal(r.text, "world");
  assert.equal(r.model, "grok-4");
  assert.equal(r.id, "grok-123");
}

// Missing provenance fields degrade to null, never throw.
{
  const r = extractAnthropicResult({ content: [{ type: "text", text: "x" }] });
  assert.equal(r.text, "x");
  assert.equal(r.model, null);
  assert.equal(r.id, null);

  const g = extractGrokResult({ choices: [{ message: { content: "y" } }] });
  assert.equal(g.model, null);
  assert.equal(g.id, null);
}

// extractAnthropicText handles a non-content payload without crashing.
{
  assert.equal(typeof extractAnthropicText({ error: "boom" }), "string");
}

// OpenAI / codex shape: model + id come from the response body, not the request.
// (xAI is OpenAI-compatible, so this mirrors the Grok shape.)
{
  const json = {
    id: "chatcmpl_01ABC",
    model: "gpt-4o-2024-08-06",
    choices: [{ message: { content: "codex says hi" } }]
  };
  const r = extractOpenAIResult(json);
  assert.equal(r.text, "codex says hi");
  assert.equal(r.model, "gpt-4o-2024-08-06");
  assert.equal(r.id, "chatcmpl_01ABC");
}

// Missing OpenAI provenance fields degrade to null, never throw.
{
  const r = extractOpenAIResult({ choices: [{ message: { content: "z" } }] });
  assert.equal(r.text, "z");
  assert.equal(r.model, null);
  assert.equal(r.id, null);
}

// agy attestation: deterministic, content-addressed, never a placeholder.
// agy is a LOCAL deterministic tool — it has no server-issued model id, so its
// honest provenance is a reproducible hash over the checkpoint it produced.
{
  const checkpoint = {
    packet_type: "agy-checkpoint",
    phase: "phase-1",
    phase_gate_status: "advance",
    next_owner: "codex",
    blocked_reasons: []
  };
  const a1 = agyAttestation(checkpoint);
  const a2 = agyAttestation(checkpoint);

  assert.equal(a1.response_id, a2.response_id, "same checkpoint -> same attestation id (deterministic)");
  assert.match(a1.response_id, /^agy-[0-9a-f]{40}$/, "attestation id is agy-<sha256 prefix>");
  assert.equal(a1.source, "ai-peer-mcp/agy_checkpoint");
  assert.equal(a1.model, "agy-checkpoint");
  assert.equal(a1.attestation, "local-deterministic");
  assert.ok(typeof a1.engine_version === "string" && a1.engine_version.length > 0, "carries an engine_version");

  // The gate blocks placeholder response_ids via /^$|_self$|^self$|placeholder/i.
  // A real attestation id must survive that filter.
  assert.ok(!/^$|_self$|^self$|placeholder/i.test(a1.response_id), "attestation id is not a placeholder");

  // Different checkpoint content => different attestation (it is genuinely bound).
  const blocked = agyAttestation({ ...checkpoint, phase_gate_status: "blocked" });
  assert.notEqual(a1.response_id, blocked.response_id, "different checkpoint -> different attestation id");

  // Key ORDER must not change the hash (canonical / stable stringify).
  const reordered = { blocked_reasons: [], next_owner: "codex", phase_gate_status: "advance", phase: "phase-1", packet_type: "agy-checkpoint" };
  assert.equal(agyAttestation(reordered).response_id, a1.response_id, "attestation is key-order independent");
}

// agyCheckpoint (now a pure lib function): advance vs blocked, and the
// attestation is bound to that exact checkpoint.
{
  const advance = agyCheckpoint({ required_packets: ["a"], present_packets: ["a"], protected_path_check: "pass" });
  assert.equal(advance.phase_gate_status, "advance");
  assert.deepEqual(advance.blocked_reasons, []);

  const blocked = agyCheckpoint({ required_packets: ["a", "b"], present_packets: ["a"] });
  assert.equal(blocked.phase_gate_status, "blocked");
  assert.ok(blocked.blocked_reasons.some((r) => r.includes("Missing packets: b")));

  // Different governance outcome => different attestation id.
  assert.notEqual(agyAttestation(advance).response_id, agyAttestation(blocked).response_id);
}

console.log("provenance: all tests passed");
