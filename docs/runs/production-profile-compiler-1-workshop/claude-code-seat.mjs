import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 1_800_000;
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function appendBounded(current, chunk, label) {
  const next = current + chunk;
  if (Buffer.byteLength(next) > MAX_CAPTURE_BYTES) {
    throw new Error(`Claude Code ${label} exceeded ${MAX_CAPTURE_BYTES} bytes`);
  }
  return next;
}

function parseEnvelope(stdout) {
  let envelope;
  try {
    envelope = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Claude Code returned invalid JSON: ${error.message}`);
  }
  if (envelope?.type !== "result"
    || envelope?.subtype !== "success"
    || envelope?.is_error !== false
    || !envelope.structured_output
    || typeof envelope.structured_output !== "object"
    || Array.isArray(envelope.structured_output)
    || !nonempty(envelope.uuid)) {
    throw new Error("Claude Code returned an incomplete or unsuccessful structured result");
  }
  const models = Object.keys(envelope.modelUsage || {}).sort();
  if (models.length === 0 || models.some((model) => !nonempty(model))) {
    throw new Error("Claude Code result lacks actual model provenance");
  }
  return {
    text: JSON.stringify(envelope.structured_output),
    model: models.join("+"),
    id: envelope.uuid,
    providerUsage: {
      model_usage: envelope.modelUsage
    }
  };
}

function failureDetail(stdout, stderr) {
  const stderrDetail = stderr.trim().slice(-2000);
  if (stderrDetail) return stderrDetail;
  try {
    const envelope = JSON.parse(stdout);
    return [
      nonempty(envelope?.subtype) ? envelope.subtype : null,
      nonempty(envelope?.terminal_reason) ? envelope.terminal_reason : null,
      ...(Array.isArray(envelope?.errors)
        ? envelope.errors.filter(nonempty).map((error) => error.slice(0, 500))
        : [])
    ].filter(Boolean).join(": ");
  } catch {
    return "";
  }
}

export async function callClaudeCode(args, {
  executable = process.env.CLAUDE_CODE_EXECUTABLE || "claude",
  env = process.env
} = {}) {
  if (!nonempty(args?.prompt)) throw new Error("Claude Code prompt must be nonempty");
  if (!nonempty(args?.system)) throw new Error("Claude Code system prompt must be nonempty");
  if (!args?.response_schema || typeof args.response_schema !== "object") {
    throw new Error("Claude Code response_schema must be an object");
  }
  const promptBytes = Buffer.byteLength(args.system) + Buffer.byteLength(args.prompt);
  if (args.max_input_bytes !== undefined
    && (!Number.isSafeInteger(args.max_input_bytes) || args.max_input_bytes <= 0)) {
    throw new Error("Claude Code input byte budget must be a positive safe integer");
  }
  if (args.max_input_bytes !== undefined && promptBytes > args.max_input_bytes) {
    throw new Error(`Claude Code input exceeds byte budget: ${promptBytes} > ${args.max_input_bytes}`);
  }

  const childEnv = { ...env };
  delete childEnv.ANTHROPIC_API_KEY;
  delete childEnv.ANTHROPIC_AUTH_TOKEN;
  delete childEnv.OPENAI_API_KEY;
  const model = nonempty(args.model) ? args.model : "sonnet";
  const effort = nonempty(args.effort) ? args.effort : "high";
  const maxBudget = childEnv.CLAUDE_CODE_MAX_BUDGET_USD;
  if (maxBudget !== undefined
    && (!nonempty(maxBudget) || !Number.isFinite(Number(maxBudget)) || Number(maxBudget) <= 0)) {
    throw new Error("CLAUDE_CODE_MAX_BUDGET_USD must be a positive number when supplied");
  }
  const timeoutMs = Number(childEnv.CLAUDE_CODE_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const cliArgs = [
    "-p",
    "--safe-mode",
    "--bare",
    "--system-prompt", args.system,
    "--model", model,
    "--effort", effort,
    "--output-format", "json",
    "--json-schema", JSON.stringify(args.response_schema),
    "--tools", "",
    "--no-session-persistence"
  ];
  if (maxBudget !== undefined) cliArgs.push("--max-budget-usd", maxBudget);
  const startedAt = Date.now();

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
        reject(new Error(`Claude Code timed out after ${timeoutMs}ms`));
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
        reject(new Error(`Claude Code failed to start: ${error.message}`));
      }
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const detail = failureDetail(stdout, stderr);
        reject(new Error(`Claude Code exited ${code ?? signal}${detail ? `: ${detail}` : ""}`));
        return;
      }
      try {
        const parsed = parseEnvelope(stdout);
        resolve({
          text: parsed.text,
          model: parsed.model,
          id: parsed.id,
          usage: {
            prompt_bytes: promptBytes,
            response_bytes: Buffer.byteLength(stdout),
            elapsed_ms: Math.max(0, Date.now() - startedAt),
            provider: parsed.providerUsage
          }
        });
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(args.prompt);
  });
}
