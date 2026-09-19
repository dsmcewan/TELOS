import { spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_TIMEOUT_MS = 1_800_000;
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function appendBounded(current, chunk, label) {
  const next = current + chunk;
  if (Buffer.byteLength(next) > MAX_CAPTURE_BYTES) {
    throw new Error(`Codex CLI ${label} exceeded ${MAX_CAPTURE_BYTES} bytes`);
  }
  return next;
}

function parseEvents(stdout) {
  const lines = stdout.split("\n").filter((line) => line.trim() !== "");
  const events = lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`Codex CLI returned invalid JSONL at line ${index + 1}: ${error.message}`);
    }
  });
  const started = events.filter((event) => event?.type === "thread.started" && nonempty(event.thread_id));
  const completed = events.filter((event) => event?.type === "turn.completed");
  if (started.length !== 1 || completed.length !== 1) {
    throw new Error("Codex CLI returned incomplete or ambiguous execution provenance");
  }
  const rawUsage = completed[0].usage;
  const usage = rawUsage
    && typeof rawUsage === "object"
    && !Array.isArray(rawUsage)
    && Object.values(rawUsage).every((value) => Number.isFinite(value) && value >= 0)
    ? Object.fromEntries(Object.entries(rawUsage).sort(([left], [right]) => (
      left < right ? -1 : left > right ? 1 : 0
    )))
    : null;
  return { threadId: started[0].thread_id, usage };
}

function parseResponse(file) {
  let response;
  try {
    response = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Codex CLI returned invalid structured JSON: ${error.message}`);
  }
  if (response === null || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("Codex CLI structured response must be an object");
  }
  return response;
}

function combinedPrompt(system, prompt) {
  return [
    "=== BINDING SYSTEM INSTRUCTIONS ===",
    system,
    "",
    "=== TASK ===",
    prompt
  ].join("\n");
}

export async function callCodexCli(args, {
  executable = process.env.CODEX_CLI_EXECUTABLE || "codex",
  env = process.env
} = {}) {
  if (!nonempty(args?.prompt)) throw new Error("Codex CLI prompt must be nonempty");
  if (!nonempty(args?.system)) throw new Error("Codex CLI system prompt must be nonempty");
  if (!nonempty(args?.model)) throw new Error("Codex CLI model must be nonempty");
  if (!args?.response_schema || typeof args.response_schema !== "object") {
    throw new Error("Codex CLI response_schema must be an object");
  }
  const transmittedPrompt = combinedPrompt(args.system, args.prompt);
  const promptBytes = Buffer.byteLength(transmittedPrompt);
  if (args.max_input_bytes !== undefined
    && (!Number.isSafeInteger(args.max_input_bytes) || args.max_input_bytes <= 0)) {
    throw new Error("Codex CLI input byte budget must be a positive safe integer");
  }
  if (args.max_input_bytes !== undefined && promptBytes > args.max_input_bytes) {
    throw new Error(`Codex CLI input exceeds byte budget: ${promptBytes} > ${args.max_input_bytes}`);
  }

  const temporary = mkdtempSync(path.join(os.tmpdir(), "telos-codex-seat-"));
  const schemaFile = path.join(temporary, "schema.json");
  const responseFile = path.join(temporary, "response.json");
  writeFileSync(schemaFile, `${JSON.stringify(args.response_schema)}\n`, { flag: "wx" });

  const childEnv = { ...env };
  delete childEnv.ANTHROPIC_API_KEY;
  delete childEnv.ANTHROPIC_AUTH_TOKEN;
  delete childEnv.OPENAI_API_KEY;
  const effort = nonempty(args.effort) ? args.effort : "high";
  const timeoutMs = Number(childEnv.CODEX_CLI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  const cliArgs = [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--sandbox", "read-only",
    "--model", args.model,
    "--config", `model_reasoning_effort="${effort}"`,
    "--output-schema", schemaFile,
    "--output-last-message", responseFile,
    "--json",
    "-"
  ];

  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(executable, cliArgs, {
        cwd: process.cwd(),
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        if (!settled) {
          settled = true;
          reject(new Error(`Codex CLI timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        try {
          stdout = appendBounded(stdout, chunk, "stdout");
        } catch (error) {
          child.kill("SIGTERM");
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        }
      });
      child.stderr.on("data", (chunk) => {
        try {
          stderr = appendBounded(stderr, chunk, "stderr");
        } catch (error) {
          child.kill("SIGTERM");
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        }
      });
      child.on("error", (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error(`Codex CLI failed to start: ${error.message}`));
        }
      });
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          const detail = stderr.trim().slice(-2000);
          reject(new Error(`Codex CLI exited ${code ?? signal}${detail ? `: ${detail}` : ""}`));
          return;
        }
        try {
          const provenance = parseEvents(stdout);
          const response = parseResponse(responseFile);
          resolve({
            text: JSON.stringify(response),
            model: args.model,
            id: provenance.threadId,
            usage: {
              prompt_bytes: promptBytes,
              response_bytes: Buffer.byteLength(JSON.stringify(response)),
              elapsed_ms: Math.max(0, Date.now() - startedAt),
              provider: provenance.usage
            }
          });
        } catch (error) {
          reject(error);
        }
      });
      child.stdin.end(transmittedPrompt);
    });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
