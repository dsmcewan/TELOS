import path from "node:path";

import { makeDesignWorkstream } from "./design.mjs";

export const designWorkstream = makeDesignWorkstream;

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  return value;
}

function normalizeRequirements(value) {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "")) {
    return value.join("\n");
  }
  throw new Error("requirements must be a non-empty string or an array of non-empty strings");
}

function requireRelativeFile(file) {
  requireString(file, "file");
  const normalized = file.replaceAll("\\", "/");
  if (
    path.isAbsolute(file) ||
    /^[A-Za-z]:\//.test(normalized) ||
    normalized.startsWith("//")
  ) {
    throw new Error("file must be relative to the project root");
  }
  const segments = normalized.split("/");
  if (normalized === "." || normalized === ".." || segments.some((segment) => segment === "..")) {
    throw new Error("file must be relative to the project root");
  }
  return normalized;
}

function baseWorkstream(options) {
  const id = requireString(options.id, "id");
  const signer = requireString(options.signer, "signer");
  const file = requireRelativeFile(options.file);
  const requirements = normalizeRequirements(options.requirements);
  const finding = requireString(options.finding, "finding");
  const dependencies = options.dependencies == null ? undefined : requireStringArray(options.dependencies, "dependencies");
  const findingsKey = options.findingsKey == null ? "architecture_findings" : requireString(options.findingsKey, "findingsKey");
  const source = requireString(options.source, "source");
  const needle = options.needle == null ? undefined : requireString(options.needle, "needle");

  const workstream = {
    id,
    signer,
    lens: signer,
    files: [file],
    requirements,
    render: () => ({ [file]: source }),
    checks: () => {
      const checks = [{ type: "file_exists", path: file }];
      if (needle) checks.push({ type: "file_contains", path: file, needle });
      return checks;
    },
    findingsKey,
    finding
  };

  if (dependencies) workstream.dependencies = dependencies;
  if (options.selftest !== false) {
    workstream.nodeTest = { cmd: "node", args: [file, "--selftest"] };
  }
  return workstream;
}

export function moduleWorkstream(options) {
  return baseWorkstream({
    ...options,
    source: requireString(options?.source, "source")
  });
}

function renderInputGuardrailSource(blockedTerms, maxBodyLen) {
  return `const blockedTerms = ${JSON.stringify(blockedTerms)};
const maxBodyLen = ${JSON.stringify(maxBodyLen)};

function normalizeInput(input) {
  if (typeof input === "string") return input;
  return JSON.stringify(input);
}

export function checkInput(input) {
  const body = normalizeInput(input);
  if (typeof body !== "string") {
    throw new Error("input must be serializable");
  }
  if (body.length > maxBodyLen) {
    throw new Error("input body exceeds maximum length");
  }
  const lower = body.toLowerCase();
  for (const term of blockedTerms) {
    if (lower.includes(term.toLowerCase())) {
      throw new Error(\`input contains blocked term: \${term}\`);
    }
  }
  return input;
}

if (process.argv.includes("--selftest")) {
  checkInput({ message: "hello world" });
  let blocked = false;
  try {
    checkInput({ message: blockedTerms[0] });
  } catch (error) {
    blocked = /blocked term/i.test(String(error && error.message));
  }
  if (!blocked) throw new Error("expected blocked term rejection");

  let oversized = false;
  try {
    checkInput({ body: "x".repeat(maxBodyLen + 1) });
  } catch (error) {
    oversized = /maximum length/i.test(String(error && error.message));
  }
  if (!oversized) throw new Error("expected oversize rejection");
}
`;
}

function renderOutputGuardrailSource(blockedTerms) {
  return `const blockedTerms = ${JSON.stringify(blockedTerms)};

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\\]\\\\]/g, "\\\\$&");
}

export function redactOutput(output) {
  const isString = typeof output === "string";
  let text = isString ? output : JSON.stringify(output);
  if (typeof text !== "string") {
    throw new Error("output must be serializable");
  }
  for (const term of blockedTerms) {
    const pattern = new RegExp(escapeRegExp(term), "gi");
    text = text.replace(pattern, "[REDACTED]");
  }
  return isString ? text : JSON.parse(text);
}

if (process.argv.includes("--selftest")) {
  const blockedTerm = blockedTerms[0];
  const sample = redactOutput("This " + blockedTerm.toUpperCase() + " should disappear.");
  if (sample.toLowerCase().includes(blockedTerm.toLowerCase()) || !sample.includes("[REDACTED]")) {
    throw new Error("expected secret to be redacted");
  }
  const clean = redactOutput({ ok: true, note: "visible" });
  if (typeof clean !== "object" || clean == null || clean.note !== "visible") {
    throw new Error("expected clean object output to remain an object");
  }
  const objectSample = redactOutput({ note: "hide " + blockedTerm, nested: { value: blockedTerm.toUpperCase() } });
  const serialized = JSON.stringify(objectSample);
  if (/secret/i.test(serialized) || !serialized.includes("[REDACTED]")) {
    throw new Error("expected object output redaction");
  }
}
`;
}

export function guardrailWorkstream(options) {
  const id = requireString(options?.id, "id");
  const file = requireRelativeFile(options?.file);
  const mode = requireString(options?.mode, "mode");
  const signer = options?.signer == null ? "grok" : requireString(options.signer, "signer");
  const finding = requireString(options?.finding, "finding");
  const dependencies = options?.dependencies == null ? undefined : requireStringArray(options.dependencies, "dependencies");
  const blockedTerms = options?.blockedTerms == null
    ? ["password", "secret"]
    : requireStringArray(options.blockedTerms, "blockedTerms");
  const maxBodyLen = options?.maxBodyLen == null ? 256 : options.maxBodyLen;
  if (Array.isArray(options?.blockedTerms) && options.blockedTerms.length === 0) {
    throw new Error("blockedTerms must be an array of non-empty strings");
  }
  if (mode === "input") {
    if (!Number.isInteger(maxBodyLen) || maxBodyLen <= 0) {
      throw new Error("maxBodyLen must be a positive integer");
    }
    return baseWorkstream({
      id,
      signer,
      file,
      requirements: `Export checkInput(input) that rejects blocked terms and oversized request bodies in ${file}.`,
      source: renderInputGuardrailSource(blockedTerms, maxBodyLen),
      finding,
      dependencies,
      findingsKey: options?.findingsKey,
      needle: "export function checkInput"
    });
  }
  if (mode === "output") {
    return baseWorkstream({
      id,
      signer,
      file,
      requirements: `Export redactOutput(output) that redacts blocked terms in ${file}.`,
      source: renderOutputGuardrailSource(blockedTerms),
      finding,
      dependencies,
      findingsKey: options?.findingsKey,
      needle: "export function redactOutput"
    });
  }
  throw new Error('mode must be "input" or "output"');
}

function requireThresholds(thresholds) {
  if (!thresholds || typeof thresholds !== "object" || Array.isArray(thresholds)) {
    throw new Error("thresholds must be an object");
  }
  const entries = Object.entries(thresholds);
  if (entries.length === 0) {
    throw new Error("thresholds must be a non-empty object");
  }
  for (const [key, value] of entries) {
    requireString(key, "threshold key");
    if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value > 1) {
      throw new Error("threshold values must be numbers between 0 and 1");
    }
  }
  if (!entries.some(([, value]) => value > 0)) {
    throw new Error("thresholds must include at least one threshold greater than 0");
  }
  return thresholds;
}

function renderScorecardSource(thresholds) {
  return `const thresholds = ${JSON.stringify(thresholds)};
const thresholdKeys = Object.keys(thresholds);

function validateScores(scores) {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    throw new Error("scores must be an object");
  }
  const providedKeys = Object.keys(scores);
  for (const key of thresholdKeys) {
    if (!(key in scores)) {
      throw new Error(\`missing score: \${key}\`);
    }
  }
  for (const key of providedKeys) {
    if (!Object.prototype.hasOwnProperty.call(thresholds, key)) {
      throw new Error(\`unknown score key: \${key}\`);
    }
    const value = scores[key];
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(\`score for \${key} must be numeric\`);
    }
    if (value < 0 || value > 1) {
      throw new Error(\`score for \${key} must be between 0 and 1\`);
    }
  }
  return scores;
}

export function computeScorecard(scores) {
  const validScores = validateScores(scores);
  const passed = Object.fromEntries(
    thresholdKeys.map((key) => [key, validScores[key] >= thresholds[key]])
  );
  return { scores: validScores, passed };
}

export function assertThresholds(scores) {
  const scorecard = computeScorecard(scores);
  for (const key of thresholdKeys) {
    if (!scorecard.passed[key]) {
      throw new Error(\`score for \${key} is below threshold\`);
    }
  }
  return true;
}

if (process.argv.includes("--selftest")) {
  const passingScores = ${JSON.stringify(Object.fromEntries(Object.entries(thresholds).map(([key, value]) => [key, Math.min(1, value + (1 - value) / 2)])))};
  const result = computeScorecard(passingScores);
  for (const key of thresholdKeys) {
    if (result.passed[key] !== true) {
      throw new Error(\`expected passing score for \${key}\`);
    }
  }

  let below = false;
  try {
    const belowKey = thresholdKeys.find((key) => thresholds[key] > 0);
    const failingScores = { ...passingScores, [belowKey]: Math.max(0, thresholds[belowKey] - 0.01) };
    const failingResult = computeScorecard(failingScores);
    if (failingResult.passed[belowKey] !== false) {
      throw new Error("expected below-threshold scorecard result");
    }
    assertThresholds(failingScores);
  } catch (error) {
    below = /below threshold/i.test(String(error && error.message));
  }
  if (!below) throw new Error("expected below-threshold rejection");
}
`;
}

export function scorecardWorkstream(options) {
  const id = requireString(options?.id, "id");
  const file = requireRelativeFile(options?.file);
  const signer = options?.signer == null ? "agy" : requireString(options.signer, "signer");
  const thresholds = requireThresholds(options?.thresholds);
  const finding = requireString(options?.finding, "finding");
  const dependencies = options?.dependencies == null ? undefined : requireStringArray(options.dependencies, "dependencies");

  return baseWorkstream({
    id,
    signer,
    file,
    requirements: `Export computeScorecard(scores) and assertThresholds(scores) for thresholds ${JSON.stringify(thresholds)}.`,
    source: renderScorecardSource(thresholds),
    finding,
    dependencies,
    findingsKey: options?.findingsKey,
    needle: "export function computeScorecard"
  });
}

function renderAuditSource() {
  return `import { mkdirSync, mkdtempSync, readFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export function appendAudit(file, event) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), event });
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, line + "\\n", "utf8");
}

if (process.argv.includes("--selftest")) {
  const root = mkdtempSync(path.join(tmpdir(), "audit-selftest-"));
  const file = path.join(root, "audit.log");
  const payload = { action: "append", ok: true };
  appendAudit(file, payload);
  const lines = readFileSync(file, "utf8").trim().split("\\n");
  if (lines.length !== 1) throw new Error("expected one audit line");
  const record = JSON.parse(lines[0]);
  if (typeof record.timestamp !== "string" || Number.isNaN(Date.parse(record.timestamp))) {
    throw new Error("expected ISO timestamp");
  }
  if (JSON.stringify(record.event) !== JSON.stringify(payload)) {
    throw new Error("expected event payload");
  }
}
`;
}

export function auditWorkstream(options) {
  const id = requireString(options?.id, "id");
  const file = requireRelativeFile(options?.file);
  const signer = options?.signer == null ? "codex" : requireString(options.signer, "signer");
  const finding = requireString(options?.finding, "finding");
  const dependencies = options?.dependencies == null ? undefined : requireStringArray(options.dependencies, "dependencies");

  return baseWorkstream({
    id,
    signer,
    file,
    requirements: `Export appendAudit(file, event) that appends JSONL audit records in ${file}.`,
    source: renderAuditSource(),
    finding,
    dependencies,
    findingsKey: options?.findingsKey,
    needle: "appendAudit"
  });
}
