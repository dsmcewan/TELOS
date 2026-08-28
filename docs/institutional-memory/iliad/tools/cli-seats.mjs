// cli-seats.mjs — OAuth-authenticated CLI seat transport for the Iliad lifecycle
// runners (Eye directive 2026-08-27: ALL model calls run over OAuth, never
// metered API keys).
//
// Drop-in for the ai-peer-mcp seat surface consumed by
// run-daedalus-workshop.mjs: exports askClaude/askCodex with the same
// call/return shape ({prompt, system, model, effort, max_tokens,
// response_schema, schema_name} -> {text, model, id}).
//
// Transport per seat:
//   claude -> the Claude Code CLI (`claude -p --output-format json`). This is
//     the ONLY legitimate holder of Claude subscription OAuth (Anthropic scopes
//     Pro/Max OAuth to Claude Code/claude.ai; ai-peer-mcp itself structurally
//     rejects product-identity impersonation) — so the seat IS the CLI, it does
//     not pretend to be it.
//   codex -> the Codex CLI (`codex exec`, ChatGPT-account OAuth), read-only
//     sandbox, last-message capture.
//
// Provenance: real per-seat receipts are the CLI session/thread ids
// (source "cli/<tool>"), not HTTP response ids — weaker than provider API
// receipts and recorded honestly as such by the runner's provenance fields.
// Structured output: the schema is enforced by instruction + strict local
// parse; the returned .text is the extracted JSON string so callers'
// JSON.parse stays strict. Zero dependencies; node: imports only.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CALL_TIMEOUT_MS = Number(process.env.CLI_SEAT_TIMEOUT_MS || 1_800_000);

function run(cmd, args, { input, timeoutMs = CALL_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (e) => { clearTimeout(killer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(killer);
      if (code !== 0) reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-800)}`));
      else resolve({ stdout, stderr });
    });
    if (input != null) child.stdin.write(input);
    child.stdin.end();
  });
}

// Extract one JSON object from possibly fenced / prose-wrapped model text.
// Fail-closed: no silent fallback — a seat that cannot produce the object errors.
function extractJsonObject(text) {
  const t = String(text ?? "").trim();
  const fenced = t.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : t;
  const start = body.indexOf("{");
  if (start === -1) throw new Error("no JSON object in seat output");
  // Walk to the matching close brace (string-aware).
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { if (inStr) esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) {
      const candidate = body.slice(start, i + 1);
      JSON.parse(candidate); // throws on invalid — fail closed
      return candidate;
    } }
  }
  throw new Error("unterminated JSON object in seat output");
}

function schemaInstruction(schema, schemaName) {
  if (!schema) return "";
  return [
    "",
    `Respond with ONLY a single JSON object (no prose, no markdown fences) that validates against this JSON Schema (${schemaName || "output"}):`,
    JSON.stringify(schema)
  ].join("\n");
}

export async function askClaude(args) {
  if (typeof args?.prompt !== "string" || !args.prompt) throw new Error("prompt required");
  const prompt = args.prompt + schemaInstruction(args.response_schema, args.schema_name);
  const cliArgs = ["-p", "--output-format", "json"];
  if (args.system) cliArgs.push("--append-system-prompt", args.system);
  // model "claude" = the CLI session default (the subscription's model); an
  // explicit real model id passes through. CLI_SEAT_CLAUDE_MODEL pins the
  // claude reviewer seat to a specific SUBSCRIPTION model (OAuth, never a
  // metered key) — used when the session-default model is rate-limited (Eye
  // decision 2026-08-28: Fable 5 seat limit → pin claude-sonnet-4-6 for the
  // product-1 amendment review; recorded as a mid-review provenance change).
  const claudeModel = args.model && args.model !== "claude"
    ? args.model
    : (process.env.CLI_SEAT_CLAUDE_MODEL || null);
  if (claudeModel) cliArgs.push("--model", claudeModel);
  const { stdout } = await run("claude", cliArgs, { input: prompt });
  let envelope;
  try { envelope = JSON.parse(stdout); }
  catch { throw new Error(`claude CLI returned non-JSON envelope: ${stdout.slice(0, 300)}`); }
  if (envelope.is_error) throw new Error(`claude CLI error: ${String(envelope.result).slice(0, 300)}`);
  const raw = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result);
  const text = args.response_schema ? extractJsonObject(raw) : raw;
  const model = envelope.modelUsage ? Object.keys(envelope.modelUsage)[0] : (envelope.model || "claude-cli");
  return { text, model, id: envelope.session_id || `claude-cli-${Date.now().toString(36)}` };
}

// grok -> the Grok CLI (grok.com OAuth login), headless single-turn JSON mode.
// Envelope: {text, sessionId, requestId, modelUsage:{<model>:{...}}}.
export async function askGrok(args) {
  if (typeof args?.prompt !== "string" || !args.prompt) throw new Error("prompt required");
  const sys = args.system ? `SYSTEM CONTEXT (governs your role):\n${args.system}\n\n` : "";
  const prompt = "Do not use any tools; answer only from the provided text.\n\n" +
    sys + args.prompt + schemaInstruction(args.response_schema, args.schema_name);
  const model = args.model && args.model !== "grok" ? args.model : (process.env.CLI_SEAT_GROK_MODEL || "grok-4.5");
  // Large council prompts exceed ARG_MAX as an argv (spawn E2BIG, authz run 3) —
  // pass the prompt via a BOUNDED TEMP FILE using grok's --prompt-file (Eye ruling
  // 2026-08-28: fix the E2BIG transport). Tools suppressed by instruction.
  const outDir = mkdtempSync(path.join(tmpdir(), "cli-seat-grok-"));
  const promptFile = path.join(outDir, "prompt.txt");
  writeFileSync(promptFile, prompt);
  try {
    const cliArgs = ["--prompt-file", promptFile, "--output-format", "json", "-m", model, "--verbatim", "--max-turns", "6", "--disable-web-search"];
    const { stdout } = await run("grok", cliArgs);
    let envelope;
    try { envelope = JSON.parse(stdout); }
    catch { throw new Error(`grok CLI returned non-JSON envelope: ${stdout.slice(0, 300)}`); }
    const raw = typeof envelope.text === "string" ? envelope.text : JSON.stringify(envelope.text ?? "");
    const text = args.response_schema ? extractJsonObject(raw) : raw;
    const used = envelope.modelUsage ? Object.keys(envelope.modelUsage)[0] : model;
    return { text, model: used, id: envelope.requestId || envelope.sessionId || `grok-cli-${Date.now().toString(36)}` };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

// gemini -> the Antigravity CLI (`agy`, Google OAuth via OS keyring). Large prompts
// exceed ARG_MAX as an argv (spawn E2BIG) AND agy silently caps stream-json content
// at ~64KB. So the review PACKAGE (system + objective + full plan) is written to a
// file in a SCOPED temp workspace, and agy is instructed to read it via view_file —
// the small -p instruction fits argv, and agy reads the full 142KB from disk
// (Eye ruling 2026-08-28: fix the E2BIG transport; verified agy reads a 2082-line
// plan this way). File access is scoped to the temp dir via --add-dir; permissions
// auto-allowed in print mode via --dangerously-skip-permissions (advisory seat,
// sandboxed to the temp workspace).
export async function askGemini(args) {
  if (typeof args?.prompt !== "string" || !args.prompt) throw new Error("prompt required");
  const sys = args.system ? `SYSTEM CONTEXT (governs your role):\n${args.system}\n\n` : "";
  const pkg = sys + args.prompt; // full review package (objective + plan)
  const model = args.model && args.model !== "gemini" ? args.model : (process.env.CLI_SEAT_GEMINI_MODEL || "gemini-3.1-pro-high");
  const outDir = mkdtempSync(path.join(tmpdir(), "cli-seat-gemini-"));
  const pkgFile = path.join(outDir, "review-package.md");
  writeFileSync(pkgFile, pkg);
  const instruction =
    `Use the view_file tool to read the ENTIRE file ./review-package.md in this directory. ` +
    `It is your complete review package (role, objective, and the full plan under authorization). ` +
    `Read all of it, then respond.` +
    schemaInstruction(args.response_schema, args.schema_name) +
    `\nDo not use any tool other than view_file.`;
  try {
    const cliArgs = [`-p=${instruction}`, "--model", model, "--output-format", "json",
      "--disable-slash-commands", "--dangerously-skip-permissions", "--add-dir", outDir, "--print-timeout", "25m"];
    const { stdout } = await run("agy", cliArgs);
    let envelope;
    try { envelope = JSON.parse(stdout); }
    catch { throw new Error(`agy CLI returned non-JSON envelope: ${stdout.slice(0, 300)}`); }
    if (envelope.status && envelope.status !== "SUCCESS") throw new Error(`agy CLI status ${envelope.status}: ${String(envelope.error).slice(0,200)}`);
    const raw = typeof envelope.response === "string" ? envelope.response : JSON.stringify(envelope.response ?? "");
    const text = args.response_schema ? extractJsonObject(raw) : raw;
    return { text, model, id: envelope.conversation_id || `agy-cli-${Date.now().toString(36)}` };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

export async function askCodex(args) {
  if (typeof args?.prompt !== "string" || !args.prompt) throw new Error("prompt required");
  const sys = args.system ? `SYSTEM CONTEXT (governs your role):\n${args.system}\n\n` : "";
  const prompt = sys + args.prompt + schemaInstruction(args.response_schema, args.schema_name);
  const outDir = mkdtempSync(path.join(tmpdir(), "cli-seat-codex-"));
  const lastMsg = path.join(outDir, "last-message.txt");
  const promptFile = path.join(outDir, "prompt.txt");
  writeFileSync(promptFile, prompt);
  try {
    const cliArgs = ["exec", "--skip-git-repo-check", "-s", "read-only", "--output-last-message", lastMsg];
    // Seat alias "codex" pins the workshop's recorded reviewer model rather
    // than inheriting the operator's local config default (which may be a
    // review-tuned profile) — the pre-review's model_review is the authority.
    cliArgs.push("-m", args.model && args.model !== "codex" ? args.model : (process.env.CLI_SEAT_CODEX_MODEL || "gpt-5.6-sol"));
    cliArgs.push("-"); // read the prompt from stdin
    const { stdout, stderr } = await run("codex", cliArgs, { input: prompt });
    let raw;
    try { raw = readFileSync(lastMsg, "utf8"); }
    catch { throw new Error(`codex produced no last message: ${stderr.slice(-400)}`); }
    const text = args.response_schema ? extractJsonObject(raw) : raw;
    const combined = stdout + stderr;
    const sid = combined.match(/session id:\s*([0-9a-f-]{8,})/i) || combined.match(/"thread_id"\s*:\s*"([^"]+)"/) || combined.match(/session_id"?:\s*"?([0-9a-f-]{8,})/i);
    const mid = combined.match(/^model:\s*([\w.\-\/]+)/im);
    const pinned = args.model && args.model !== "codex" ? args.model : (process.env.CLI_SEAT_CODEX_MODEL || "gpt-5.6-sol");
    return { text, model: mid ? mid[1] : pinned, id: sid ? sid[1] : `codex-cli-${Date.now().toString(36)}` };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
