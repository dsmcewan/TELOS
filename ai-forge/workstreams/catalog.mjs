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
    path.win32.isAbsolute(file) ||
    path.posix.isAbsolute(normalized) ||
    normalized.startsWith("/")
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

function makeAllowedString(maxLen = maxBodyLen) {
  const blockedCorpus = blockedTerms.join("");
  for (let codePoint = 0x20; codePoint <= 0x10ffff; codePoint += 1) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
    const candidateChar = String.fromCodePoint(codePoint);
    if (blockedCorpus.includes(candidateChar)) continue;
    const candidate = candidateChar.repeat(Math.max(1, Math.min(8, maxLen)));
    if (!blockedTerms.some((term) => candidate.toLowerCase().includes(term.toLowerCase()))) {
      return candidate;
    }
  }
  throw new Error("unable to generate allowed selftest fixture");
}

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
  checkInput(makeAllowedString());
  let blocked = false;
  try {
    checkInput(blockedTerms[0]);
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
  const thresholdsJsonLiteral = JSON.stringify(JSON.stringify(blockedTerms));
  const escapeRegExpPatternSourceLiteral = JSON.stringify("[.*+?^${}()|[\\]\\\\]");
  return `const blockedTerms = JSON.parse(${thresholdsJsonLiteral});
const redactionMarker = "[REDACTED]";
const escapeRegExpPattern = new RegExp(${escapeRegExpPatternSourceLiteral}, "g");

function makeAllowedString() {
  const blockedCorpus = blockedTerms.join("");
  for (let codePoint = 0x20; codePoint <= 0x10ffff; codePoint += 1) {
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) continue;
    const candidateChar = String.fromCodePoint(codePoint);
    if (blockedCorpus.includes(candidateChar)) continue;
    const candidate = candidateChar.repeat(8);
    if (!blockedTerms.some((term) => candidate.toLowerCase().includes(term.toLowerCase()))) {
      return candidate;
    }
  }
  throw new Error("unable to generate allowed selftest fixture");
}

function escapeRegExp(value) {
  return value.replace(escapeRegExpPattern, "\\\\$&");
}

function buildBlockedTermPatterns(term) {
  const variants = new Set([term]);
  const lower = term.toLowerCase();
  const upper = term.toUpperCase();
  if (lower.length === term.length) variants.add(lower);
  if (upper.length === term.length) variants.add(upper);
  if (term.includes("ß") || term.includes("ẞ")) {
    variants.add(term.replaceAll("ß", "ẞ"));
    variants.add(term.replaceAll("ẞ", "ß"));
  }
  const source = Array.from(variants, (variant) => escapeRegExp(variant)).sort((a, b) => b.length - a.length).join("|");
  return new RegExp(source, "giu");
}

function redactStringValue(value) {
  let redacted = value;
  for (const term of blockedTerms) {
    redacted = redacted.replace(buildBlockedTermPatterns(term), redactionMarker);
  }
  return redacted;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isOrdinaryObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function cloneRedactedObject(value, seen) {
  const clone = Object.create(Object.getPrototypeOf(value));
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
      throw new Error(\`unsupported accessor property on output: \${String(key)}\`);
    }
    if (Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      descriptor.value = redactJsonValue(descriptor.value, seen);
    }
    Object.defineProperty(clone, key, descriptor);
  }
  return clone;
}

function cloneRedactedArray(value, seen) {
  const clone = [];
  const deferredLengthDescriptor = [];
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) continue;
    if (typeof descriptor.get === "function" || typeof descriptor.set === "function") {
      throw new Error(\`unsupported accessor property on output: \${String(key)}\`);
    }
    if (Object.prototype.hasOwnProperty.call(descriptor, "value") && key !== "length") {
      descriptor.value = redactJsonValue(descriptor.value, seen);
    }
    if (key === "length") {
      deferredLengthDescriptor.push(descriptor);
      continue;
    }
    Object.defineProperty(clone, key, descriptor);
  }
  for (const descriptor of deferredLengthDescriptor) {
    Object.defineProperty(clone, "length", descriptor);
  }
  return clone;
}

function redactJsonValue(value, seen = new WeakSet()) {
  if (typeof value === "string") return redactStringValue(value);
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) {
    throw new Error("output must not contain circular references");
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return cloneRedactedArray(value, seen);
    }
    if (value instanceof Map) {
      return new Map(
        Array.from(value.entries(), ([key, entryValue]) => [key, redactJsonValue(entryValue, seen)])
      );
    }
    if (value instanceof Set) {
      return new Set(Array.from(value.values(), (entryValue) => redactJsonValue(entryValue, seen)));
    }
    if (isPlainObject(value)) {
      return cloneRedactedObject(value, seen);
    }
    if (isOrdinaryObject(value)) {
      return cloneRedactedObject(value, seen);
    }
    const tag = Object.prototype.toString.call(value);
    throw new Error(\`unsupported output container type: \${tag}\`);
  } finally {
    seen.delete(value);
  }
}

export function redactOutput(output) {
  if (typeof output === "string") {
    return redactStringValue(output);
  }
  return redactJsonValue(output);
}

if (process.argv.includes("--selftest")) {
  const blockedTerm = blockedTerms[0];
  const cleanText = makeAllowedString();
  const clean = redactOutput({ ok: true, note: cleanText });
  if (typeof clean !== "object" || clean == null || clean.note !== cleanText) {
    throw new Error("expected clean object output to remain an object");
  }
  const samplePrefix = makeAllowedString();
  const sampleSuffix = makeAllowedString();
  const sampleInput = samplePrefix + blockedTerm + sampleSuffix;
  const sample = redactOutput(sampleInput);
  if (sample !== samplePrefix + redactionMarker + sampleSuffix) {
    throw new Error("expected secret to be redacted");
  }
  const objectSample = redactOutput({
    note: samplePrefix + blockedTerm,
    nested: { value: blockedTerm + sampleSuffix },
  });
  if (
    JSON.stringify(objectSample) !== JSON.stringify({
      note: samplePrefix + redactionMarker,
      nested: { value: redactionMarker + sampleSuffix },
    })
  ) {
    throw new Error("expected object output redaction");
  }
  const keyedSample = redactOutput({ password: undefined, nested: { token: blockedTerm }, list: [blockedTerm] });
  if (!("password" in keyedSample) || !("nested" in keyedSample) || !("token" in keyedSample.nested)) {
    throw new Error("expected object keys to be preserved during redaction");
  }
  if (keyedSample.password !== undefined || keyedSample.nested.token !== redactionMarker || keyedSample.list[0] !== redactionMarker) {
    throw new Error("expected string leaf values to be redacted without changing container structure");
  }
  const mapSample = redactOutput(new Map([["note", blockedTerm]]));
  if (!(mapSample instanceof Map) || mapSample.get("note") !== redactionMarker) {
    throw new Error("expected Map output redaction");
  }
  const setSample = redactOutput(new Set([blockedTerm]));
  if (!(setSample instanceof Set) || JSON.stringify(Array.from(setSample)) !== JSON.stringify([redactionMarker])) {
    throw new Error("expected Set output redaction");
  }
  class Envelope {
    constructor(note, nested) {
      this.note = note;
      this.nested = nested;
    }
  }
  const instanceSample = redactOutput(new Envelope(samplePrefix + blockedTerm, { token: blockedTerm }));
  if (!(instanceSample instanceof Envelope) || instanceSample.note !== samplePrefix + redactionMarker || instanceSample.nested.token !== redactionMarker) {
    throw new Error("expected object instances to preserve prototype and redact string leaf values");
  }
  let circular = false;
  try {
    const cycle = { note: blockedTerm };
    cycle.self = cycle;
    redactOutput(cycle);
  } catch (error) {
    circular = /circular/i.test(String(error && error.message));
  }
  if (!circular) throw new Error("expected circular output rejection");
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
  const thresholdsJsonLiteral = JSON.stringify(JSON.stringify(thresholds));
  const passingScoresJsonLiteral = JSON.stringify(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(thresholds).map(([key, value]) => [key, Math.min(1, value + (1 - value) / 2)])
      )
    )
  );

  return `const thresholds = JSON.parse(${thresholdsJsonLiteral});
const thresholdKeys = Object.keys(thresholds);

function validateScores(scores) {
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    throw new Error("scores must be an object");
  }
  const providedKeys = Object.keys(scores);
  for (const key of thresholdKeys) {
    if (!Object.hasOwn(scores, key)) {
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
  const passingScores = JSON.parse(${passingScoresJsonLiteral});
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
