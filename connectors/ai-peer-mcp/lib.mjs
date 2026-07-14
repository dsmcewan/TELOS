// lib.mjs — pure response parsers + the local agy attestation, extracted so
// provenance capture is unit-testable without network or a running server.
//
// Provenance matters: a packet that self-declares `"model": "claude"` proves
// nothing. The model the API *actually answered with* (json.model) and the
// response id are real, server-issued provenance — surface them so "which model
// produced this" is captured from the response, not asserted by the caller.
//
// Two flavours of real provenance live here:
//   - REMOTE (claude/grok/codex): the server-issued model + response id, read
//     straight off the API response body.
//   - LOCAL (agy): agy is a deterministic local tool with no server id, so its
//     honest provenance is a content-addressed attestation — a hash over the
//     checkpoint it produced. Same inputs => same id, and it is reproducible by
//     anyone, which is exactly what makes it verifiable rather than self-declared.

import { createHash } from "node:crypto";

// Bump when the attestation payload shape or hashing changes (it is part of the
// provenance record so consumers can tell which scheme produced an id).
export const AGY_ENGINE_VERSION = "agy-checkpoint/1";

export function extractAnthropicText(json) {
  if (!Array.isArray(json?.content)) {
    return typeof json === "string" ? json : JSON.stringify(json, null, 2);
  }
  return json.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export function extractAnthropicResult(json) {
  return {
    text: extractAnthropicText(json),
    model: typeof json?.model === "string" ? json.model : null,
    id: typeof json?.id === "string" ? json.id : null
  };
}

// Structured-output variant: when Claude was forced to call a single tool, the
// schema-valid JSON is the tool_use block's `input`. We JSON.stringify it so the
// {text, provenance} envelope's `.text` stays a STRING (keeping the contract
// liveSeatCaller/parseTeamFiles depend on). Provenance (model/id) still comes from
// the real response, never the tool input. If no tool_use block (model declined /
// thinking), degrade to the text path so downstream parsers fail-closed.
export function extractAnthropicStructuredResult(json) {
  const blocks = Array.isArray(json?.content) ? json.content : [];
  const toolUse = blocks.find((part) => part?.type === "tool_use" && part.input && typeof part.input === "object");
  return {
    text: toolUse ? JSON.stringify(toolUse.input) : extractAnthropicText(json),
    model: typeof json?.model === "string" ? json.model : null,
    id: typeof json?.id === "string" ? json.id : null
  };
}

// Shared parser for OpenAI-compatible chat-completion responses. xAI (Grok) and
// OpenAI (Codex) return the same shape, so both Grok and Codex delegate here —
// one place to keep the provenance extraction correct.
export function extractChatCompletionResult(json) {
  return {
    text: json?.choices?.[0]?.message?.content ?? JSON.stringify(json, null, 2),
    model: typeof json?.model === "string" ? json.model : null,
    id: typeof json?.id === "string" ? json.id : null
  };
}

export function extractGrokResult(json) {
  return extractChatCompletionResult(json);
}

// Codex is reached through OpenAI's chat-completions API (OpenAI-compatible),
// so the response carries a real server-issued model + id just like Grok.
export function extractOpenAIResult(json) {
  return extractChatCompletionResult(json);
}

// Gemini (generateContent): the text (JSON when responseSchema was set) is in
// candidates[0].content.parts[].text. Provenance is the response's modelVersion +
// responseId — honest-null when absent (gemini is advisory, so a null id never
// blocks the gate). Never throws.
export function extractGeminiResult(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("")
    : null;
  return {
    text: text && text.length > 0 ? text : JSON.stringify(json, null, 2),
    model: typeof json?.modelVersion === "string" ? json.modelVersion : null,
    id: typeof json?.responseId === "string" ? json.responseId : null
  };
}

// Recursive, key-sorted JSON serialization so a hash over an object is
// independent of key insertion order. Arrays keep their order (order is
// meaningful); object keys are sorted. Mirrors the build-gate canonicalization
// intent without pulling in that module (keeps lib.mjs dependency-light).
export function stableStringify(value) {
  // Normalize undefined to null so it always serializes to valid, deterministic
  // JSON (mirrors JSON.stringify's treatment of undefined array elements).
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

// Local-deterministic provenance for the agy seat. agy has no remote model, so
// instead of borrowing another model's response id we attest to exactly what agy
// produced: response_id = "agy-" + sha256(canonical checkpoint). Reproducible,
// non-placeholder, and bound to the checkpoint content.
export function agyAttestation(checkpoint) {
  const digest = createHash("sha256").update(stableStringify(checkpoint ?? null)).digest("hex");
  return {
    provider: "local",
    model: "agy-checkpoint",
    source: "ai-peer-mcp/agy_checkpoint",
    response_id: `agy-${digest.slice(0, 40)}`,
    answered_at: null,
    attestation: "local-deterministic",
    engine_version: AGY_ENGINE_VERSION
  };
}

// Local, deterministic phase/queue governance. Pure (no network, no server) so
// it is directly unit-testable and reusable by the council's agy seat — lives
// here rather than in server.mjs for exactly that reason.
export function agyCheckpoint(args) {
  const requiredPackets = Array.isArray(args.required_packets) ? args.required_packets : [];
  const presentPackets = new Set(Array.isArray(args.present_packets) ? args.present_packets : []);
  const missingPackets = requiredPackets.filter((packet) => !presentPackets.has(packet));
  const blockedReasons = Array.isArray(args.blocked_reasons) ? [...args.blocked_reasons] : [];

  if (missingPackets.length > 0) {
    blockedReasons.push(`Missing packets: ${missingPackets.join(", ")}`);
  }
  if (args.lexi_required && !args.lexi_reference_read) {
    blockedReasons.push("LEXI is required, but LEXI_DB_REFERENCE.md has not been read.");
  }
  if (args.broad_patch_requested && !args.user_approved_patch) {
    blockedReasons.push("Broad patch requested without explicit user approval.");
  }
  if (args.protected_path_check && !/^pass(ed)?$/i.test(args.protected_path_check.trim())) {
    blockedReasons.push(`Protected path check is not pass: ${args.protected_path_check}`);
  }

  const phaseGateStatus = blockedReasons.length === 0 ? "advance" : "blocked";
  const nextOwner = phaseGateStatus === "advance" ? "codex" : chooseOwner(blockedReasons);

  return {
    packet_type: "agy-checkpoint",
    phase: args.phase ?? "unspecified",
    scope: args.scope ?? "unspecified",
    current_owner: args.current_owner ?? "unspecified",
    queue_counts: args.queue_counts ?? {},
    phase_gate_status: phaseGateStatus,
    next_owner: nextOwner,
    missing_packets: missingPackets,
    blocked_reasons: blockedReasons,
    safe_next_action: phaseGateStatus === "advance"
      ? "Proceed to the next queued execution or review step."
      : "Resolve blocked reasons before advancing the phase.",
    do_not_proceed_if: [
      "required packets are missing",
      "LEXI is required but the reference has not been read",
      "broad patching lacks explicit user approval",
      "protected path check is not pass"
    ]
  };
}

export function chooseOwner(blockedReasons) {
  const text = blockedReasons.join(" ").toLowerCase();
  if (text.includes("lexi")) return "forensic-agent";
  if (text.includes("approval") || text.includes("user")) return "user";
  if (text.includes("packet")) return "agy";
  if (text.includes("protected")) return "codex";
  return "agy";
}
