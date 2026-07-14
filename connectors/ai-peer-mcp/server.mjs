#!/usr/bin/env node

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractAnthropicResult, extractAnthropicStructuredResult, extractGrokResult, extractOpenAIResult, extractGeminiResult, agyAttestation, agyCheckpoint } from "./lib.mjs";

function loadWin32Env() {
  if (process.platform !== "win32") return;
  try {
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
  } catch (e) {
    // Ignored
  }
}
loadWin32Env();

function mapModelName(model) {
  if (!model) return model;
  const lower = model.trim().toLowerCase();
  if (lower === "claude fable" || lower === "fable" || lower === "claude") {
    return "claude-fable-5";
  }
  if (lower === "claude opus" || lower === "opus") {
    return "claude-opus-4-8";
  }
  if (lower === "claude sonnet" || lower === "sonnet") {
    return "claude-sonnet-4-6";
  }
  if (lower === "grok") {
    return "grok-4.3";
  }
  // Codex is served by OpenAI; a bare "codex" resolves to the current flagship
  // chat model so `model: "codex"` works the way `model: "grok"` does.
  if (lower === "codex" || lower === "gpt") {
    return "gpt-5.5";
  }
  // Gemini is served by Google; a bare "gemini" resolves to the current pro
  // model. Real selection stays env-overridable via GEMINI_MODEL.
  if (lower === "gemini" || lower === "gemini pro") {
    return "gemini-3.1-pro-preview";
  }
  return model;
}

const SERVER_INFO = {
  name: "ai-peer-mcp",
  version: "0.1.0"
};

const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_XAI_BASE_URL = "https://api.x.ai/v1";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEBUG = process.env.AI_PEER_DEBUG === "1";

// Transport: globalThis.fetch by default (unit tests mock it), or a plain
// node:https client when AI_PEER_LONG_TIMEOUT=1 — undici's ~300s header
// timeout aborts long max-effort generations as a bare "fetch failed", and
// live seat runners opt into patience instead (see build-gate/seat-registry).
async function doFetch(url, opts = {}) {
  if (process.env.AI_PEER_LONG_TIMEOUT !== "1") return fetch(url, opts);
  const { request } = await import("node:https");
  const timeoutMs = Number(process.env.AI_PEER_TIMEOUT_MS) || 1_800_000;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: opts.method || "GET",
      headers: {
        ...(opts.headers || {}),
        ...(opts.body ? { "Content-Length": Buffer.byteLength(opts.body) } : {})
      },
      timeout: timeoutMs
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({
        ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
        status: res.statusCode || 0,
        text: async () => text,
        json: async () => JSON.parse(text)
      }));
    });
    req.on("timeout", () => req.destroy(new Error(`request timed out after ${timeoutMs / 1000}s`)));
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Only run the stdio server loop when executed directly (node server.mjs). When
// imported by a unit test, the ask* functions are exercised without starting the
// reader (which would otherwise hold the process open on stdin).
const IS_MAIN = !!process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

let inputBuffer = Buffer.alloc(0);

if (IS_MAIN) {
  process.stdin.on("data", (chunk) => {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);
    drainMessages();
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });
}

function drainMessages() {
  while (true) {
    const headerEnd = inputBuffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const header = inputBuffer.slice(0, headerEnd).toString("utf8");
    const match = header.match(/content-length:\s*(\d+)/i);
    if (!match) {
      inputBuffer = inputBuffer.slice(headerEnd + 4);
      continue;
    }

    const length = Number(match[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + length;
    if (inputBuffer.length < bodyEnd) return;

    const body = inputBuffer.slice(bodyStart, bodyEnd).toString("utf8");
    inputBuffer = inputBuffer.slice(bodyEnd);

    handleMessage(body).catch((error) => {
      sendError(null, -32603, error instanceof Error ? error.message : String(error));
    });
  }
}

async function handleMessage(body) {
  let message;
  try {
    message = JSON.parse(body);
  } catch (error) {
    debugLog("parse-error", { message: error instanceof Error ? error.message : String(error) });
    sendError(null, -32700, "Parse error");
    return;
  }

  if (!message || typeof message !== "object") {
    debugLog("invalid-request", {});
    sendError(null, -32600, "Invalid Request");
    return;
  }

  if (message.id === undefined) {
    debugLog("notification", { method: message.method });
    return;
  }

  try {
    debugLog("request", { id: message.id, method: message.method });
    const result = await dispatch(message.method, message.params ?? {});
    debugLog("response", {
      id: message.id,
      method: message.method,
      summary: summarizeResult(result)
    });
    sendResponse(message.id, result);
  } catch (error) {
    debugLog("error", {
      id: message.id,
      method: message.method,
      message: error instanceof Error ? error.message : String(error)
    });
    sendError(message.id, -32603, error instanceof Error ? error.message : String(error));
  }
}

async function dispatch(method, params) {
  switch (method) {
    case "initialize":
      return {
        protocolVersion: params.protocolVersion ?? "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: SERVER_INFO
      };

    case "tools/list":
      return { tools: toolDefinitions() };

    case "tools/call":
      return callTool(params);

    case "resources/list":
      return { resources: [] };

    case "resources/templates/list":
      return { resourceTemplates: [] };

    case "prompts/list":
      return { prompts: [] };

    default:
      throw new Error(`Unsupported method: ${method}`);
  }
}

function toolDefinitions() {
  return [
    {
      name: "claude_ask",
      description: "Ask Claude through the Anthropic Messages API. Requires ANTHROPIC_API_KEY and a model via input or ANTHROPIC_MODEL. Set include_provenance to return a JSON envelope {text, provenance:{model,response_id,source}} instead of raw text.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          system: { type: "string" },
          model: { type: "string" },
          max_tokens: { type: "integer", minimum: 1, maximum: 8192 },
          temperature: { type: "number", minimum: 0, maximum: 1 },
          include_provenance: { type: "boolean" },
          response_schema: { type: "object" },
          schema_name: { type: "string" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "grok_ask",
      description: "Ask Grok through xAI's OpenAI-compatible chat completions API. Requires XAI_API_KEY and a model via input or XAI_MODEL. Set include_provenance to return a JSON envelope {text, provenance:{model,response_id,source}} instead of raw text.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          system: { type: "string" },
          model: { type: "string" },
          max_tokens: { type: "integer", minimum: 1, maximum: 8192 },
          temperature: { type: "number", minimum: 0, maximum: 1 },
          include_provenance: { type: "boolean" },
          response_schema: { type: "object" },
          schema_name: { type: "string" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "codex_ask",
      description: "Ask Codex through OpenAI's chat completions API. Requires OPENAI_API_KEY and a model via input or OPENAI_MODEL (OPENAI_BASE_URL overrides the endpoint). Set include_provenance to return a JSON envelope {text, provenance:{model,response_id,source}} instead of raw text.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          system: { type: "string" },
          model: { type: "string" },
          max_tokens: { type: "integer", minimum: 1, maximum: 8192 },
          temperature: { type: "number", minimum: 0, maximum: 1 },
          include_provenance: { type: "boolean" },
          response_schema: { type: "object" },
          schema_name: { type: "string" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "gemini_ask",
      description: "Ask Gemini (the callable Google model behind Antigravity) through the Gemini API. Requires GEMINI_API_KEY and a model via input or GEMINI_MODEL (GEMINI_BASE_URL overrides the endpoint). Pass response_schema for native structured JSON. Set include_provenance to return a JSON envelope {text, provenance:{model,response_id,source}} instead of raw text.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          system: { type: "string" },
          model: { type: "string" },
          max_tokens: { type: "integer", minimum: 1, maximum: 8192 },
          temperature: { type: "number", minimum: 0, maximum: 1 },
          include_provenance: { type: "boolean" },
          response_schema: { type: "object" },
          schema_name: { type: "string" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "agy_checkpoint",
      description: "Run a local Agy governance checkpoint for phase gates, queue state, and missing handoff packets. No external API key required.",
      inputSchema: {
        type: "object",
        properties: {
          phase: { type: "string" },
          scope: { type: "string" },
          current_owner: { type: "string" },
          queue_counts: { type: "object" },
          required_packets: { type: "array", items: { type: "string" } },
          present_packets: { type: "array", items: { type: "string" } },
          blocked_reasons: { type: "array", items: { type: "string" } },
          protected_path_check: { type: "string" },
          lexi_required: { type: "boolean" },
          lexi_reference_read: { type: "boolean" },
          broad_patch_requested: { type: "boolean" },
          user_approved_patch: { type: "boolean" }
        }
      }
    },
    {
      name: "council_review",
      description: "Ask Claude for a proposal and Grok for adversarial review. Requires both Anthropic and xAI credentials.",
      inputSchema: {
        type: "object",
        properties: {
          objective: { type: "string" },
          context: { type: "string" },
          claude_system: { type: "string" },
          grok_system: { type: "string" },
          claude_model: { type: "string" },
          grok_model: { type: "string" },
          max_tokens: { type: "integer", minimum: 1, maximum: 8192 }
        },
        required: ["objective"]
      }
    }
  ];
}

async function callTool(params) {
  const name = params.name;
  const args = params.arguments ?? {};

  switch (name) {
    case "claude_ask":
      return askResult(await askClaude(args), "ai-peer-mcp/claude_ask", args.include_provenance, "anthropic");
    case "grok_ask":
      return askResult(await askGrok(args), "ai-peer-mcp/grok_ask", args.include_provenance, "xai");
    case "codex_ask":
      return askResult(await askCodex(args), "ai-peer-mcp/codex_ask", args.include_provenance, "openai");
    case "gemini_ask":
      return askResult(await askGemini(args), "ai-peer-mcp/gemini_ask", args.include_provenance, "google");
    case "agy_checkpoint": {
      // agy is local + deterministic: stamp the checkpoint with a content-addressed
      // attestation so it carries its OWN provenance (not a borrowed model id).
      const checkpoint = agyCheckpoint(args);
      const stamped = { ...checkpoint, provenance: agyAttestation(checkpoint) };
      return textResult(JSON.stringify(stamped, null, 2));
    }
    case "council_review":
      return textResult(JSON.stringify(await councilReview(args), null, 2));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Shape an ask-tool result. Default: raw prose (back-compat — breakout/live.mjs
// feeds this straight into the next model). With include_provenance: a JSON
// envelope {text, provenance:{model,response_id,source}} so the council can bind
// the packet to the model's REAL response.
function askResult(result, source, includeProvenance, provider) {
  if (!includeProvenance) return textResult(result.text);
  return textResult(JSON.stringify({
    text: result.text,
    provenance: { provider, model: result.model, response_id: result.id, source, answered_at: new Date().toISOString() }
  }));
}

export async function askClaude(args) {
  requireString(args.prompt, "prompt");
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const rawModel = args.model || process.env.ANTHROPIC_MODEL;
  if (!rawModel) {
    throw new Error("Missing Claude model. Pass model or set ANTHROPIC_MODEL.");
  }
  const model = mapModelName(rawModel);

  // Structured output: Anthropic forces schema-valid JSON via a single tool call.
  // We force the model to call one tool whose input_schema IS the requested schema;
  // the JSON is then the tool_use block's `input`.
  const structured = args.response_schema && typeof args.response_schema === "object";
  const schemaName = args.schema_name || "telos_output";

  const body = {
    model,
    max_tokens: args.max_tokens ?? 2000,
    // Only send temperature when explicitly requested; newer Claude models
    // reject it as deprecated. (Forced tools also dislike a sampled temperature.)
    temperature: typeof args.temperature === "number" ? args.temperature : undefined,
    system: args.system || undefined,
    messages: [
      {
        role: "user",
        content: args.prompt
      }
    ]
  };
  if (structured) {
    body.tools = [{ name: schemaName, description: "Return the result as structured JSON.", input_schema: args.response_schema }];
    body.tool_choice = { type: "tool", name: schemaName };
  }

  const response = await doFetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION
    },
    body: JSON.stringify(body)
  });

  const json = await parseApiResponse(response, "Anthropic");
  // Returns { text, model, id } — model/id are the API's actual response
  // provenance, not the requested model string. Structured mode reads the JSON
  // from the tool_use block (and falls back to text if the model declined).
  return structured ? extractAnthropicStructuredResult(json) : extractAnthropicResult(json);
}

// OpenAI-compatible structured output (xAI Grok and OpenAI Codex share the shape):
// response_format json_schema in strict mode forces schema-valid JSON in the
// message content. No schema => omitted (today's plain-text behavior).
function jsonSchemaResponseFormat(args) {
  if (!args.response_schema || typeof args.response_schema !== "object") return undefined;
  return {
    type: "json_schema",
    json_schema: { name: args.schema_name || "telos_output", strict: true, schema: args.response_schema }
  };
}

export async function askGrok(args) {
  requireString(args.prompt, "prompt");
  const apiKey = requireEnv("XAI_API_KEY");
  const rawModel = args.model || process.env.XAI_MODEL;
  if (!rawModel) {
    throw new Error("Missing Grok model. Pass model or set XAI_MODEL.");
  }
  const model = mapModelName(rawModel);

  const messages = [];
  if (args.system) {
    messages.push({ role: "system", content: args.system });
  }
  messages.push({ role: "user", content: args.prompt });

  const baseUrl = (process.env.XAI_BASE_URL || DEFAULT_XAI_BASE_URL).replace(/\/$/, "");
  const response = await doFetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: args.max_tokens ?? 2000,
      temperature: args.temperature ?? 0,
      response_format: jsonSchemaResponseFormat(args)
    })
  });

  const json = await parseApiResponse(response, "xAI");
  return extractGrokResult(json);
}

export async function askCodex(args) {
  requireString(args.prompt, "prompt");
  const apiKey = requireEnv("OPENAI_API_KEY");
  const rawModel = args.model || process.env.OPENAI_MODEL;
  if (!rawModel) {
    throw new Error("Missing Codex model. Pass model or set OPENAI_MODEL.");
  }
  const model = mapModelName(rawModel);

  const messages = [];
  if (args.system) {
    messages.push({ role: "system", content: args.system });
  }
  messages.push({ role: "user", content: args.prompt });

  const baseUrl = (process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).replace(/\/$/, "");
  const response = await doFetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: args.max_tokens ?? 2000,
      // Only send temperature when explicitly requested; some OpenAI models
      // reject a non-default temperature.
      temperature: typeof args.temperature === "number" ? args.temperature : undefined,
      response_format: jsonSchemaResponseFormat(args)
    })
  });

  const json = await parseApiResponse(response, "OpenAI");
  // Returns { text, model, id } — model/id are the API's real response
  // provenance, not the requested model string.
  return extractOpenAIResult(json);
}

export async function askGemini(args) {
  requireString(args.prompt, "prompt");
  const apiKey = requireEnv("GEMINI_API_KEY");
  const rawModel = args.model || process.env.GEMINI_MODEL;
  if (!rawModel) {
    throw new Error("Missing Gemini model. Pass model or set GEMINI_MODEL.");
  }
  const model = mapModelName(rawModel);

  const structured = args.response_schema && typeof args.response_schema === "object";
  const baseUrl = (process.env.GEMINI_BASE_URL || DEFAULT_GEMINI_BASE_URL).replace(/\/$/, "");
  const response = await doFetch(`${baseUrl}/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: args.prompt }] }],
      // Gemini's system prompt is a separate {parts:[{text}]} field, not a role.
      systemInstruction: args.system ? { parts: [{ text: args.system }] } : undefined,
      generationConfig: {
        maxOutputTokens: args.max_tokens ?? 2000,
        temperature: typeof args.temperature === "number" ? args.temperature : undefined,
        responseMimeType: structured ? "application/json" : undefined,
        responseSchema: structured ? args.response_schema : undefined
      }
    })
  });

  const json = await parseApiResponse(response, "Gemini");
  // model/id come from the real response (modelVersion/responseId); honest-null
  // when absent (gemini rides as advisory, so a null id never blocks the gate).
  return extractGeminiResult(json);
}

async function councilReview(args) {
  requireString(args.objective, "objective");
  const maxTokens = args.max_tokens ?? 2000;
  const context = args.context ? `\n\nContext:\n${args.context}` : "";

  const claude = await askClaude({
    prompt: `Objective:\n${args.objective}${context}\n\nReturn a concise, decision-ready proposal.`,
    system: args.claude_system || "You are Claude, the lead information architect. Be explicit, evidence-first, and mark unknowns.",
    model: args.claude_model,
    max_tokens: maxTokens,
    temperature: 0
  });

  const grok = await askGrok({
    prompt: `Objective:\n${args.objective}${context}\n\nClaude proposal:\n${claude.text}\n\nAttack this for unsupported inference, missing evidence, archive contamination, and execution risk. Return approve/reject/needs-revision with reasons.`,
    system: args.grok_system || "You are Grok, the adversarial checker. Be skeptical, concrete, and source-demanding.",
    model: args.grok_model,
    max_tokens: maxTokens,
    temperature: 0
  });

  return {
    objective: args.objective,
    claude_proposal: claude.text,
    grok_review: grok.text,
    // Provenance: the models the APIs ACTUALLY answered with, plus response ids.
    provenance: {
      claude: { model: claude.model, response_id: claude.id },
      grok: { model: grok.model, response_id: grok.id }
    }
  };
}

async function parseApiResponse(response, provider) {
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${provider} API error ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required string argument: ${name}`);
  }
}

function textResult(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

function sendResponse(id, result) {
  writeJson({
    jsonrpc: "2.0",
    id,
    result
  });
}

function sendError(id, code, message) {
  writeJson({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message
    }
  });
}

function writeJson(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function summarizeResult(result) {
  if (Array.isArray(result?.tools)) return { tools: result.tools.map((tool) => tool.name) };
  if (Array.isArray(result?.resources)) return { resources: result.resources.length };
  if (Array.isArray(result?.resourceTemplates)) return { resourceTemplates: result.resourceTemplates.length };
  if (Array.isArray(result?.prompts)) return { prompts: result.prompts.length };
  if (result?.serverInfo) return { serverInfo: result.serverInfo };
  return {};
}

function debugLog(event, payload) {
  if (!DEBUG) return;
  process.stderr.write(`[ai-peer-mcp] ${event} ${JSON.stringify(payload)}\n`);
}
