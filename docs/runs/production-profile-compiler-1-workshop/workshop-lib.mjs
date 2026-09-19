import { createHash } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

import {
  OBLIGATION_FIELDS,
  PARALLEL_ROLES,
  deriveParallelState,
  runParallelDaedalus,
  validateObligationCoverage
} from "../../../build-gate/daedalus.mjs";
import { generateKeypair } from "../../../merkle-dag/crypto.mjs";
import {
  makeProposalEvent,
  proposalEventHash,
  verifyProposalChain
} from "../../../merkle-dag/proposal-ledger.mjs";
import { canonicalize, sha256hex } from "../../../merkle-dag/vendor.mjs";
import {
  applySparseIntegration,
  createReviewCapsule,
  loadReviewRegistry,
  runReviewPreflight
} from "./review-compiler.mjs";

const CONTRACT_V1 = "production-profile-compiler-daedalus-workshop/1";
const CONTRACT_V2 = "production-profile-compiler-daedalus-workshop/2";
const INPUT_KEYS_V1 = Object.freeze([
  "candidate",
  "design",
  "preReview",
  "methodology",
  "comprehension"
]);
const INPUT_KEYS_V2 = Object.freeze([...INPUT_KEYS_V1, "ruling"]);
const PROPOSAL_ID = "production-profile-compiler-1-workshop";
const GOVERNED_RUN_RELATIVE = "docs/runs/production-profile-compiler-1-workshop";
const ATTEMPT_RE = /^attempt-[0-9]{3}$/;
const REF_RE = /^sha256:([0-9a-f]{64})$/;
const OBLIGATION_ID_RE = /^PPC-W[0-9]{2,}$/;
const MATRIX_ROW_KEYS = Object.freeze(["obligation_id", ...OBLIGATION_FIELDS]);
const RESULT_KEYS = Object.freeze([
  "kind",
  "component",
  "id",
  "contract",
  "mode",
  "selected_attempt",
  "state",
  "reason",
  "terminal",
  "authorization_granted",
  "implementation_started",
  "inputs",
  "candidate_plan",
  "frame_ref",
  "integrated_candidate",
  "matured_plan",
  "matured_plan_changed",
  "sources",
  "integration",
  "verifications",
  "conflicts",
  "independent_recheck",
  "signed_events",
  "creation_lineage"
]);
const RESULT_PROVENANCE_KEYS = Object.freeze([
  "provider",
  "model",
  "response_id",
  "source",
  "response_artifact_ref"
]);
const SECRET_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
  /\bsk-ant-[A-Za-z0-9_-]{16,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bxai-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bgh[oprsu]_[A-Za-z0-9]{20,}\b/
];
const WORKSHOP_STAGE = Object.freeze({
  "parallel-authorship": "negotiation",
  integration: "candidate",
  "parallel-verification": "review"
});

function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function nonempty(value) {
  return typeof value === "string" && value === value.trim() && value.length > 0;
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = haystack.indexOf(needle, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + Math.max(1, needle.length);
  }
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function relativePosix(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function isGovernedRun(repoRoot, runDir) {
  return relativePosix(repoRoot, runDir) === GOVERNED_RUN_RELATIVE;
}

function expectedProvider(seat) {
  if (seat === "claude") return "anthropic";
  if (seat === "codex") return "openai";
  return null;
}

function expectedLiveSources(seat) {
  if (seat === "claude") return new Set(["ai-peer-mcp/claude_ask", "claude-code/print"]);
  if (seat === "codex") return new Set(["ai-peer-mcp/codex_ask", "codex-cli/exec"]);
  return new Set();
}

function validateProvenance(call, provenance, mode) {
  const label = `${call.role}/${call.phase}`;
  if (!exactKeys(provenance, ["provider", "model", "response_id", "source"])) {
    throw new Error(`${label}: provenance must have a closed shape`);
  }
  for (const field of ["provider", "model", "response_id", "source"]) {
    if (!nonempty(provenance[field])) throw new Error(`${label}: provenance.${field} must be a nonempty trimmed string`);
  }
  if (provenance.provider !== expectedProvider(call.seat)) {
    throw new Error(`${label}: provenance provider does not match seat`);
  }
  if (mode === "live") {
    if (!expectedLiveSources(call.seat).has(provenance.source)
      || /smoke|fixture/i.test(`${provenance.model}:${provenance.response_id}`)) {
      throw new Error(`${label}: live provenance is not provider-real`);
    }
  } else if (provenance.source !== "workshop-smoke") {
    throw new Error(`${label}: smoke provenance source mismatch`);
  }
}

function validateObligations(obligations) {
  if (!Array.isArray(obligations) || obligations.length === 0) {
    throw new Error("constraints/author: obligations must be a nonempty array");
  }
  if (obligations.some((id) => !nonempty(id) || !OBLIGATION_ID_RE.test(id))) {
    throw new Error("constraints/author: obligation IDs must match PPC-WNN");
  }
  if (new Set(obligations).size !== obligations.length) {
    throw new Error("constraints/author: obligation IDs must be unique");
  }
}

function readRequiredFile(repoRoot, relative) {
  if (!nonempty(relative) || path.isAbsolute(relative) || relative.includes("\\") || relative.split("/").some((part) => part === ".." || part === "." || part === "")) {
    throw new Error(`invalid repository-relative input path: ${JSON.stringify(relative)}`);
  }
  const rootReal = realpathSync(repoRoot);
  const absolute = path.resolve(rootReal, ...relative.split("/"));
  const real = realpathSync(absolute);
  if (!inside(rootReal, real) || real !== absolute || !statSync(real).isFile()) {
    throw new Error(`input path is not a regular in-repository file: ${relative}`);
  }
  return { path: relative, absolute, text: readFileSync(real, "utf8") };
}

function rawSha256Ref(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function contractForPaths(paths) {
  if (exactKeys(paths, INPUT_KEYS_V1)) {
    return { contract: CONTRACT_V1, inputKeys: INPUT_KEYS_V1 };
  }
  if (exactKeys(paths, INPUT_KEYS_V2)) {
    return { contract: CONTRACT_V2, inputKeys: INPUT_KEYS_V2 };
  }
  throw new Error("paths must name exactly the V1 inputs or those inputs plus ruling for V2");
}

function inputKeysForContract(contract) {
  if (contract === CONTRACT_V1) return INPUT_KEYS_V1;
  if (contract === CONTRACT_V2) return INPUT_KEYS_V2;
  return null;
}

function validateControllerRuling(inputs, inputSummary) {
  let ruling;
  try {
    ruling = JSON.parse(inputs.ruling.text);
  } catch (error) {
    throw new Error(`controller ruling is not JSON: ${error.message}`);
  }
  if (!exactKeys(ruling, [
    "kind",
    "id",
    "authority",
    "decision",
    "candidate_plan",
    "file_ingress",
    "implementation_authorized",
    "provider_calls_authorized",
    "non_authorization"
  ])) {
    throw new Error("controller ruling must have a closed shape");
  }
  if (ruling.kind !== "controller-ruling"
    || ruling.id !== "production-profile-file-ingress-v1"
    || ruling.authority !== "The Eye"
    || ruling.decision !== "approved") {
    throw new Error("controller ruling identity or decision mismatch");
  }
  if (!exactKeys(ruling.candidate_plan, ["path", "raw_sha256"])
    || ruling.candidate_plan.path !== inputs.candidate.path
    || ruling.candidate_plan.raw_sha256 !== inputSummary.candidate.raw_sha256) {
    throw new Error("controller ruling candidate binding does not match the frozen candidate");
  }
  if (!exactKeys(ruling.file_ingress, [
    "allowed_formats",
    "image_handling",
    "unsafe_xlsx_handling",
    "classification"
  ])
    || JSON.stringify(ruling.file_ingress.allowed_formats) !== JSON.stringify(["csv", "json", "xlsx"])
    || ruling.file_ingress.image_handling !== "block"
    || ruling.file_ingress.unsafe_xlsx_handling !== "reject-entire-workbook"
    || ruling.file_ingress.classification !== "inherit-complete-profile-data-classification") {
    throw new Error("controller ruling file-ingress decision mismatch");
  }
  if (ruling.implementation_authorized !== false
    || ruling.provider_calls_authorized !== false
    || ruling.non_authorization !== "This ruling matures candidate requirements only; it grants no implementation, authority-record, commit, provider-call, or deployment authorization.") {
    throw new Error("controller ruling must preserve the non-authorization boundary");
  }
  return ruling;
}

export function prepareWorkshopFrame({ repoRoot, paths, mode }) {
  if (!["live", "smoke"].includes(mode)) {
    throw new Error(`invalid workshop mode: ${JSON.stringify(mode)}`);
  }
  const rootReal = realpathSync(repoRoot);
  const { contract, inputKeys } = contractForPaths(paths);
  const inputs = Object.fromEntries(inputKeys.map((key) => [key, readRequiredFile(rootReal, paths[key])]));
  const inputSummary = Object.fromEntries(inputKeys.map((key) => [key, {
    path: inputs[key].path,
    raw_sha256: rawSha256Ref(Buffer.from(inputs[key].text))
  }]));
  if (contract === CONTRACT_V2) validateControllerRuling(inputs, inputSummary);

  let comprehension;
  try {
    comprehension = JSON.parse(inputs.comprehension.text);
  } catch (error) {
    throw new Error(`comprehension artifact is not JSON: ${error.message}`);
  }
  if (comprehension.result !== "COMPREHENSION_PASSED"
    || comprehension.comprehension_checks?.passed !== 19
    || comprehension.comprehension_checks?.failed !== 0) {
    throw new Error("comprehension artifact must report COMPREHENSION_PASSED with 19 passed and 0 failed");
  }

  return {
    contract,
    inputs,
    inputSummary,
    frame: buildFrozenFrame(inputs, inputSummary, mode, contract)
  };
}

export function assertNoSecretMaterial(value) {
  const text = typeof value === "string" ? value : canonicalize(value);
  if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
    throw new Error("seat response contains likely secret material and cannot be persisted");
  }
}

function buildFrozenFrame(inputs, inputSummary, mode, contract) {
  const v2 = contract === CONTRACT_V2;
  return [
    "# FROZEN DAEDALUS FRAME",
    "",
    `Contract: ${contract}`,
    `Workshop evidence mode: ${mode}`,
    v2
      ? "The Eye's approved design, controller ruling, quest boundary, methodology, comprehension result, and candidate plan below are fixed workshop inputs."
      : "The Eye's approved design, quest boundary, methodology, comprehension result, and candidate plan below are fixed workshop inputs.",
    "The workshop may mature the candidate plan but may not authorize it, implement it, weaken an Eye ruling, or alter CURRENT-AUTHORITY.json.",
    "",
    `## Approved design (${inputs.design.path}, ${inputSummary.design.raw_sha256})`,
    inputs.design.text,
    "",
    `## Iliad pre-review (${inputs.preReview.path}, ${inputSummary.preReview.raw_sha256})`,
    inputs.preReview.text,
    "",
    `## Daedalus methodology (${inputs.methodology.path}, ${inputSummary.methodology.raw_sha256})`,
    inputs.methodology.text,
    "",
    `## Daedalus comprehension result (${inputs.comprehension.path}, ${inputSummary.comprehension.raw_sha256})`,
    inputs.comprehension.text,
    "",
    ...(v2 ? [
      `## Controller ruling (${inputs.ruling.path}, ${inputSummary.ruling.raw_sha256})`,
      inputs.ruling.text,
      ""
    ] : []),
    `## Candidate implementation plan (${inputs.candidate.path}, ${inputSummary.candidate.raw_sha256})`,
    inputs.candidate.text
  ].join("\n");
}

function creationLineage(result) {
  return [
    ...(result.sources || []).map((source) => ({
      seat: source.seat,
      role: source.role,
      phase: "author",
      provider: source.provenance?.provider,
      model: source.provenance?.model,
      response_id: source.provenance?.response_id,
      response_artifact_ref: source.provenance?.response_artifact_ref
    })),
    {
      seat: result.integration?.seat,
      role: "integration",
      phase: "integrate",
      provider: result.integration?.provenance?.provider,
      model: result.integration?.provenance?.model,
      response_id: result.integration?.provenance?.response_id,
      response_artifact_ref: result.integration?.provenance?.response_artifact_ref
    },
    ...(result.verifications || []).map((verification) => ({
      seat: verification.seat,
      role: verification.role,
      phase: "verify",
      provider: verification.provenance?.provider,
      model: verification.provenance?.model,
      response_id: verification.provenance?.response_id,
      response_artifact_ref: verification.provenance?.response_artifact_ref,
      verdict: verification.verdict
    }))
  ];
}

function provenanceKey(seat, provenance) {
  const expectedProvider = seat === "claude" ? "anthropic" : seat === "codex" ? "openai" : "";
  const provider = provenance?.provider || expectedProvider;
  const responseId = provenance?.response_id;
  if (!nonempty(provider) || !nonempty(responseId) || /^(?:self|placeholder)|_self$/i.test(responseId)) return null;
  return `${provider.toLowerCase()}:${responseId}`;
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx" });
}

function atomicWrite(file, bytes) {
  const temporary = `${file}.tmp-${process.pid}`;
  writeFileSync(temporary, bytes, { flag: "wx" });
  renameSync(temporary, file);
}

function strictJson(file) {
  const bytes = readFileSync(file);
  const value = JSON.parse(bytes.toString("utf8"));
  return { bytes, value };
}

function strictJsonLines(file) {
  const text = readFileSync(file, "utf8");
  if (!text.endsWith("\n")) throw new Error(`${file}: missing final LF`);
  const body = text.slice(0, -1);
  if (body.length === 0) return [];
  const lines = body.split("\n");
  if (lines.some((line) => line.trim() === "")) throw new Error(`${file}: blank line`);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${file}: invalid JSON line ${index + 1}: ${error.message}`);
    }
  });
}

export function applyIntegrationResponse(candidate, response) {
  if (typeof candidate !== "string") throw new Error("candidate must be a string");
  if (!exactKeys(response, ["decision", "maturation_summary", "replacements", "obligation_matrix"])) {
    throw new Error("integration response has an open or incomplete shape");
  }
  if (!["preserve", "revise"].includes(response.decision)) {
    throw new Error(`unknown integration decision: ${JSON.stringify(response.decision)}`);
  }
  if (!nonempty(response.maturation_summary)) {
    throw new Error("maturation_summary must be a nonempty trimmed string");
  }
  if (!Array.isArray(response.replacements) || !Array.isArray(response.obligation_matrix)) {
    throw new Error("replacements and obligation_matrix must be arrays");
  }
  if (response.obligation_matrix.length === 0) {
    throw new Error("obligation_matrix must not be empty");
  }
  const matrixIds = [];
  response.obligation_matrix.forEach((row, index) => {
    if (!exactKeys(row, MATRIX_ROW_KEYS)) {
      throw new Error(`matrix row ${index} has an open or incomplete shape`);
    }
    for (const field of MATRIX_ROW_KEYS) {
      if (!nonempty(row[field])) throw new Error(`matrix row ${index} field ${field} must be a nonempty trimmed string`);
    }
    if (!OBLIGATION_ID_RE.test(row.obligation_id)) {
      throw new Error(`matrix row ${index} obligation_id must match PPC-WNN`);
    }
    matrixIds.push(row.obligation_id);
  });
  if (new Set(matrixIds).size !== matrixIds.length) {
    throw new Error("obligation_matrix obligation IDs must be unique");
  }
  if (response.decision === "preserve" && response.replacements.length !== 0) {
    throw new Error("preserve requires zero replacements");
  }
  if (response.decision === "revise" && response.replacements.length === 0) {
    throw new Error("revise requires at least one replacement");
  }

  const indexed = response.replacements.map((replacement, index) => {
    if (!exactKeys(replacement, ["old", "new", "reason"])) {
      throw new Error(`replacement ${index} has an open or incomplete shape`);
    }
    if (typeof replacement.old !== "string" || replacement.old.length === 0) {
      throw new Error(`replacement ${index} old must be a nonempty string`);
    }
    if (typeof replacement.new !== "string" || !nonempty(replacement.reason)) {
      throw new Error(`replacement ${index} new/reason is invalid`);
    }
    if (replacement.old === replacement.new) {
      throw new Error(`replacement ${index} is a no-op`);
    }
    if (countOccurrences(candidate, replacement.old) !== 1) {
      throw new Error(`replacement ${index} old text must occur exactly once`);
    }
    const start = candidate.indexOf(replacement.old);
    return { ...replacement, start, end: start + replacement.old.length };
  }).sort((a, b) => a.start - b.start);

  for (let index = 1; index < indexed.length; index += 1) {
    if (indexed[index].start < indexed[index - 1].end) {
      throw new Error(`replacement ${index} overlaps an earlier replacement`);
    }
  }

  let plan = candidate;
  for (const replacement of [...indexed].sort((a, b) => b.start - a.start)) {
    plan = `${plan.slice(0, replacement.start)}${replacement.new}${plan.slice(replacement.end)}`;
  }
  return {
    plan,
    changed: plan !== candidate,
    replacement_count: indexed.length,
    replacements: indexed.map(({ old, new: next, reason }) => ({ old, new: next, reason })),
    obligation_matrix: response.obligation_matrix,
    maturation_summary: response.maturation_summary
  };
}

export function createArtifactStore(artifactsDir, { create = true } = {}) {
  if (create) mkdirSync(artifactsDir, { recursive: true });
  else if (!existsSync(artifactsDir)) throw new Error(`artifact directory missing: ${artifactsDir}`);
  const directory = realpathSync(artifactsDir);

  function artifactPath(ref) {
    const match = REF_RE.exec(ref);
    if (!match) throw new Error(`invalid artifact ref: ${JSON.stringify(ref)}`);
    return path.join(directory, `${match[1]}.json`);
  }

  function write(value) {
    const bytes = Buffer.from(canonicalize(value));
    const hex = sha256hex(bytes);
    const ref = `sha256:${hex}`;
    const file = artifactPath(ref);
    try {
      writeFileSync(file, bytes, { flag: "wx" });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const existing = readFileSync(file);
      if (!existing.equals(bytes)) throw new Error(`artifact collision at ${file}`);
    }
    return { ref, path: file };
  }

  function read(ref) {
    const file = artifactPath(ref);
    const meta = lstatSync(file);
    if (!meta.isFile() || meta.isSymbolicLink()) throw new Error(`artifact is not a regular file: ${file}`);
    const bytes = readFileSync(file);
    const actual = `sha256:${sha256hex(bytes)}`;
    if (actual !== ref) throw new Error(`artifact hash mismatch: expected ${ref}, got ${actual}`);
    let value;
    try {
      value = JSON.parse(bytes.toString("utf8"));
    } catch (error) {
      throw new Error(`artifact is not JSON: ${file}: ${error.message}`);
    }
    if (Buffer.from(canonicalize(value)).compare(bytes) !== 0) {
      throw new Error(`artifact is not canonical JSON: ${file}`);
    }
    return value;
  }

  return { directory, write, read, artifactPath };
}

function responseArtifact(store, call, raw, mode) {
  if (!raw || typeof raw !== "object" || !raw.provenance || !raw.response) {
    throw new Error(`${call.role}/${call.phase}: seat response lacks response or provenance`);
  }
  validateProvenance(call, raw.provenance, mode);
  assertNoSecretMaterial(raw.response);
  assertNoSecretMaterial(raw.provenance);
  const stored = store.write({
    kind: "seat-response",
    seat: call.seat,
    role: call.role,
    phase: call.phase,
    response: raw.response,
    provenance: raw.provenance
  });
  return {
    ...raw.provenance,
    response_artifact_ref: stored.ref
  };
}

function appendSignedEvent({ file, events, privatePem, now, stage, planHash, artifactRefs, policyResult }) {
  const parent = events.length ? proposalEventHash(events.at(-1)) : null;
  const event = makeProposalEvent({
    proposal_id: PROPOSAL_ID,
    sequence: events.length + 1,
    stage,
    plan_hash: planHash,
    parent_event_hash: parent,
    artifact_refs: artifactRefs,
    actor: { seat: "controller", role: "workshop-controller" },
    provenance: null,
    policy_result: policyResult,
    recorded_at: now()
  }, privatePem);
  const descriptor = openSync(file, "a");
  try {
    appendFileSync(descriptor, `${JSON.stringify(event)}\n`);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  events.push(event);
  return event;
}

export async function runWorkshop({
  repoRoot,
  runDir,
  attemptId,
  mode,
  paths,
  callSeat,
  reviewRegistryText = null,
  now = () => new Date().toISOString()
}) {
  if (!ATTEMPT_RE.test(attemptId)) throw new Error(`invalid attempt id: ${JSON.stringify(attemptId)}`);
  if (!["live", "smoke"].includes(mode)) throw new Error(`invalid workshop mode: ${JSON.stringify(mode)}`);
  if (typeof callSeat !== "function") throw new Error("callSeat must be a function");
  const rootReal = realpathSync(repoRoot);
  const runAbsolute = path.resolve(runDir);
  if (!inside(rootReal, runAbsolute)) throw new Error("runDir must remain inside repoRoot");
  mkdirSync(runAbsolute, { recursive: true });
  const runReal = realpathSync(runAbsolute);
  if (!inside(rootReal, runReal) || runReal !== runAbsolute) throw new Error("runDir must not traverse a symlink");
  const governedRun = isGovernedRun(rootReal, runReal);
  if (mode === "smoke" && governedRun) {
    throw new Error("smoke evidence is prohibited in the governed workshop directory");
  }
  if (mode === "live" && !governedRun) {
    throw new Error("live evidence is fixed to the governed workshop directory");
  }

  const {
    contract,
    inputs,
    inputSummary,
    frame
  } = prepareWorkshopFrame({ repoRoot: rootReal, paths, mode });
  const sparseReview = reviewRegistryText !== null;
  const loadedRegistry = sparseReview
    ? loadReviewRegistry({ registryText: reviewRegistryText, inputs })
    : null;
  const reviewPreflight = sparseReview
    ? runReviewPreflight({ loadedRegistry, inputs })
    : null;
  if (reviewPreflight?.status === "blocked") {
    return {
      state: "blocked",
      reason: "mechanical-preflight",
      terminal: "needs-work",
      mode,
      contract,
      authorization_granted: false,
      implementation_started: false,
      preflight: reviewPreflight
    };
  }
  const commonReviewCapsule = sparseReview
    ? createReviewCapsule({
      role: "constraints",
      loadedRegistry,
      preflight: reviewPreflight,
      inputs
    })
    : null;
  const modelFrame = sparseReview
    ? canonicalize({
      kind: "deterministic-sparse-review-frame",
      contract: loadedRegistry.registry.contract,
      registry_ref: loadedRegistry.registry_ref,
      preflight_ref: commonReviewCapsule.capsule.preflight_ref,
      input_refs: reviewPreflight.input_refs,
      obligations: commonReviewCapsule.capsule.obligations,
      passages: commonReviewCapsule.capsule.passages
    })
    : frame;

  const attemptsDir = path.join(runReal, "attempts");
  mkdirSync(attemptsDir, { recursive: true });
  const attemptDir = path.join(attemptsDir, attemptId);
  mkdirSync(attemptDir, { recursive: false });
  const artifactsDir = path.join(attemptDir, "artifacts");
  const store = createArtifactStore(artifactsDir);
  const eventFile = path.join(attemptDir, "events.jsonl");
  writeFileSync(path.join(attemptDir, "candidate-plan.md"), inputs.candidate.text, { flag: "wx" });

  const frameArtifact = store.write({
    kind: "workshop-frame",
    contract,
    mode,
    inputs: inputSummary,
    frame
  });

  const { privatePem, publicJwk } = generateKeypair();
  writeJson(path.join(attemptDir, "event-signing-public.jwk"), publicJwk);
  const events = [];
  const responseRefs = new Map();
  appendSignedEvent({
    file: eventFile,
    events,
    privatePem,
    now,
    stage: "draft",
    planHash: inputSummary.candidate.raw_sha256,
    artifactRefs: [frameArtifact.ref],
    policyResult: {
      workshop_mode: "parallel",
      evidence_mode: mode,
      contract,
      candidate_path: inputs.candidate.path
    }
  });

  const wrappedCallSeat = async (call) => {
    const reviewCapsule = sparseReview
      ? createReviewCapsule({
        role: call.phase === "author"
          ? call.role
          : call.phase === "integrate"
            ? "integration"
            : `verify-${call.role}`,
        loadedRegistry,
        preflight: reviewPreflight,
        inputs
      })
      : null;
    const raw = await callSeat({
      ...call,
      ...(sparseReview ? {
        review_mode: "sparse",
        review_capsule: reviewCapsule.capsule,
        review_capsule_ref: reviewCapsule.capsule_ref
      } : {})
    });
    if (!raw || typeof raw !== "object" || !raw.provenance || !raw.response) {
      throw new Error(`${call.role}/${call.phase}: seat response lacks response or provenance`);
    }
    if (call.phase === "author") {
      if (sparseReview) {
        if (!exactKeys(raw.response, ["findings"])
          || !Array.isArray(raw.response.findings)
          || raw.response.findings.length !== loadedRegistry.registry.obligations.length) {
          throw new Error(`${call.role}/author: sparse findings must exactly cover the registry`);
        }
        const findingIds = raw.response.findings.map((finding) => finding?.obligation_id);
        const registryIds = loadedRegistry.registry.obligations.map((obligation) => obligation.obligation_id);
        if (new Set(findingIds).size !== findingIds.length
          || canonicalize([...findingIds].sort()) !== canonicalize(registryIds)) {
          throw new Error(`${call.role}/author: sparse finding coverage mismatch`);
        }
        const provenance = responseArtifact(store, call, raw, mode);
        responseRefs.set(`${call.phase}:${call.role}`, provenance.response_artifact_ref);
        return {
          plan: canonicalize(raw.response),
          ...(call.role === "constraints" ? { obligations: registryIds } : {}),
          provenance
        };
      }
      const plan = raw.plan ?? raw.response?.plan;
      const expectedKeys = call.role === "constraints" ? ["plan", "obligations"] : ["plan"];
      if (!exactKeys(raw.response, expectedKeys)) {
        throw new Error(`${call.role}/author: response must have a closed shape`);
      }
      if (typeof plan !== "string" || plan.trim().length === 0 || raw.response?.plan !== plan) {
        throw new Error(`${call.role}/author: response.plan mismatch`);
      }
      if (call.role === "constraints") {
        const obligations = raw.obligations ?? raw.response?.obligations;
        if (!Array.isArray(obligations)
          || JSON.stringify(obligations) !== JSON.stringify(raw.response?.obligations)) {
          throw new Error("constraints/author: response.obligations mismatch");
        }
        validateObligations(obligations);
        const provenance = responseArtifact(store, call, raw, mode);
        responseRefs.set(`${call.phase}:${call.role}`, provenance.response_artifact_ref);
        return { plan, obligations, provenance };
      }
      const provenance = responseArtifact(store, call, raw, mode);
      responseRefs.set(`${call.phase}:${call.role}`, provenance.response_artifact_ref);
      return { plan, provenance };
    }
    if (call.phase === "integrate") {
      const materialized = sparseReview
        ? applySparseIntegration({
          candidate: inputs.candidate.text,
          registry: loadedRegistry.registry,
          response: raw.response
        })
        : applyIntegrationResponse(inputs.candidate.text, raw.response);
      if (sparseReview) {
        const integratedInputs = {
          ...inputs,
          candidate: {
            ...inputs.candidate,
            text: materialized.plan
          }
        };
        const integratedRegistry = loadReviewRegistry({
          registryText: reviewRegistryText,
          inputs: integratedInputs
        });
        const integratedPreflight = runReviewPreflight({
          loadedRegistry: integratedRegistry,
          inputs: integratedInputs
        });
        if (integratedPreflight.status !== "pass") {
          throw new Error("integration/integrate: integrated candidate failed mechanical preflight");
        }
      }
      const declared = (call.sources || []).find((source) => source.role === "constraints")?.obligations;
      const coverage = validateObligationCoverage(materialized.obligation_matrix, declared);
      if (!coverage.covered) {
        throw new Error(`integration/integrate: obligation ${coverage.reason}`);
      }
      const provenance = responseArtifact(store, call, raw, mode);
      responseRefs.set(`${call.phase}:${call.role}`, provenance.response_artifact_ref);
      return {
        plan: materialized.plan,
        obligation_matrix: materialized.obligation_matrix,
        provenance
      };
    }
    const verdict = raw.verdict ?? raw.response?.verdict;
    const conflicts = raw.conflicts ?? raw.response?.conflicts;
    if (!exactKeys(raw.response, ["verdict", "conflicts"])) {
      throw new Error(`${call.role}/verify: response must have a closed shape`);
    }
    if (!["preserved", "violated"].includes(verdict)) {
      throw new Error(`${call.role}/verify: verdict must be preserved or violated`);
    }
    if (!Array.isArray(conflicts) || conflicts.some((conflict) => !nonempty(conflict))) {
      throw new Error(`${call.role}/verify: conflicts must be an array of nonempty trimmed strings`);
    }
    if ((verdict === "preserved" && conflicts.length !== 0)
      || (verdict === "violated" && conflicts.length === 0)) {
      throw new Error(`${call.role}/verify: verdict/conflicts semantics mismatch`);
    }
    if (verdict !== raw.response?.verdict
      || JSON.stringify(conflicts) !== JSON.stringify(raw.response?.conflicts)) {
      throw new Error(`${call.role}/verify: response mismatch`);
    }
    const provenance = responseArtifact(store, call, raw, mode);
    responseRefs.set(`${call.phase}:${call.role}`, provenance.response_artifact_ref);
    return { verdict, conflicts, provenance };
  };

  let integratedRawSha = inputSummary.candidate.raw_sha256;
  const appendWorkshopEvent = async (event) => {
    const mapped = WORKSHOP_STAGE[event.stage];
    if (!mapped) throw new Error(`unknown workshop event stage: ${event.stage}`);
    if (event.stage === "integration") {
      const integration = store.read(event.artifact_refs[0]);
      integratedRawSha = rawSha256Ref(Buffer.from(integration.plan));
    }
    let artifactRefs = event.artifact_refs;
    if (event.stage === "parallel-verification") {
      const constraintsRef = responseRefs.get("verify:constraints");
      const implementationRef = responseRefs.get("verify:implementation");
      if (!constraintsRef || !implementationRef) {
        throw new Error("parallel verification event lacks both verifier response artifacts");
      }
      artifactRefs = [event.artifact_refs[0], constraintsRef, implementationRef];
    }
    appendSignedEvent({
      file: eventFile,
      events,
      privatePem,
      now,
      stage: mapped,
      planHash: event.stage === "parallel-authorship" ? inputSummary.candidate.raw_sha256 : integratedRawSha,
      artifactRefs,
      policyResult: { workshop_stage: event.stage, ...event.policy_result }
    });
  };

  const result = await runParallelDaedalus({
    frame: modelFrame,
    callSeat: wrappedCallSeat,
    writeArtifact: store.write,
    appendEvent: appendWorkshopEvent
  });
  const independent = deriveParallelState({
    sources: result.sources,
    integration: result.integration,
    verifications: result.verifications
  });
  const integrationArtifact = store.read(result.integration.candidate_ref);
  const integratedPlan = integrationArtifact.plan;
  const integratedPlanSha = rawSha256Ref(Buffer.from(integratedPlan));
  writeFileSync(path.join(attemptDir, "integrated-candidate.md"), integratedPlan, { flag: "wx" });

  const lineages = creationLineage(result);

  const converged = result.state === "converged-parallel" && result.terminal === "submit";
  const summary = {
    kind: "evidence",
    component: "daedalus",
    id: "production-profile-compiler-1-workshop",
    contract,
    mode,
    selected_attempt: attemptId,
    state: result.state,
    reason: result.reason,
    terminal: result.terminal ?? null,
    authorization_granted: false,
    implementation_started: false,
    inputs: inputSummary,
    candidate_plan: {
      raw_sha256: inputSummary.candidate.raw_sha256,
      path: relativePosix(rootReal, path.join(runReal, "candidate-plan.md")),
      attempt_path: relativePosix(rootReal, path.join(attemptDir, "candidate-plan.md"))
    },
    frame_ref: frameArtifact.ref,
    integrated_candidate: {
      artifact_ref: result.integration.candidate_ref,
      raw_sha256: integratedPlanSha,
      attempt_path: relativePosix(rootReal, path.join(attemptDir, "integrated-candidate.md"))
    },
    matured_plan: converged ? {
      artifact_ref: result.integration.candidate_ref,
      raw_sha256: integratedPlanSha,
      path: relativePosix(rootReal, path.join(runReal, "matured-plan.md")),
      attempt_path: relativePosix(rootReal, path.join(attemptDir, "matured-plan.md"))
    } : null,
    matured_plan_changed: integratedPlan !== inputs.candidate.text,
    sources: result.sources,
    integration: result.integration,
    verifications: result.verifications,
    conflicts: result.conflicts,
    independent_recheck: {
      state: independent.state,
      reason: independent.reason,
      terminal: independent.terminal ?? null,
      candidate_ref: independent.candidate_ref,
      conflicts: independent.conflicts
    },
    signed_events: {
      path: relativePosix(rootReal, eventFile),
      public_key_path: relativePosix(rootReal, path.join(attemptDir, "event-signing-public.jwk")),
      count: events.length,
      head_hash: proposalEventHash(events.at(-1))
    },
    creation_lineage: lineages
  };
  const resultBytes = `${JSON.stringify(summary, null, 2)}\n`;
  writeFileSync(path.join(attemptDir, "result.json"), resultBytes, { flag: "wx" });

  if (converged) {
    writeFileSync(path.join(attemptDir, "matured-plan.md"), integratedPlan, { flag: "wx" });
    atomicWrite(path.join(runReal, "matured-plan.md"), integratedPlan);
  } else if (existsSync(path.join(runReal, "matured-plan.md"))) {
    unlinkSync(path.join(runReal, "matured-plan.md"));
  }
  atomicWrite(path.join(runReal, "candidate-plan.md"), inputs.candidate.text);
  atomicWrite(path.join(runReal, "result.json"), resultBytes);
  return summary;
}

function collectFiles(directory, prefix = "") {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      out.push({ relative, absolute, kind: "symlink" });
    } else if (entry.isDirectory()) {
      out.push(...collectFiles(absolute, relative));
    } else {
      out.push({ relative, absolute, kind: "file" });
    }
  }
  return out;
}

export function verifyWorkshop({ repoRoot, runDir, allowSmoke = false }) {
  const errors = [];
  let eventCount = 0;
  let provenanceCount = 0;
  const fail = (message) => errors.push(message);
  try {
    const rootReal = realpathSync(repoRoot);
    const runReal = realpathSync(runDir);
    if (!inside(rootReal, runReal)) fail("run directory escapes repository root");
    const governedRun = isGovernedRun(rootReal, runReal);
    const top = strictJson(path.join(runReal, "result.json"));
    const result = top.value;
    if (!exactKeys(result, RESULT_KEYS)
      || result.kind !== "evidence"
      || result.component !== "daedalus") {
      fail("result evidence envelope mismatch");
    }
    if (!inputKeysForContract(result.contract) || result.id !== PROPOSAL_ID) {
      fail("result contract or id mismatch");
    }
    if (!["live", "smoke"].includes(result.mode)) fail("invalid result mode");
    if (result.mode === "smoke" && governedRun) {
      fail("smoke evidence is prohibited in the governed workshop directory");
    }
    if (result.mode === "live" && !governedRun) {
      fail("live evidence is fixed to the governed workshop directory");
    }
    if (result.mode === "smoke" && !allowSmoke) {
      fail("smoke workshop cannot satisfy live workshop verification");
    }
    if (result.state !== "converged-parallel" || result.terminal !== "submit") {
      fail(`selected workshop attempt is not converged for submission: state=${result.state} terminal=${result.terminal}`);
    }
    if (!ATTEMPT_RE.test(result.selected_attempt)) fail("invalid selected_attempt");
    const attemptDir = path.join(runReal, "attempts", result.selected_attempt);
    const attemptReal = realpathSync(attemptDir);
    if (!inside(runReal, attemptReal) || attemptReal !== attemptDir) fail("attempt path escapes or traverses a symlink");
    const attemptResult = strictJson(path.join(attemptReal, "result.json"));
    if (!attemptResult.bytes.equals(top.bytes)) fail("top-level and attempt result bytes differ");
    const expectedCandidatePath = relativePosix(rootReal, path.join(runReal, "candidate-plan.md"));
    const expectedAttemptCandidatePath = relativePosix(rootReal, path.join(attemptReal, "candidate-plan.md"));
    if (!exactKeys(result.candidate_plan, ["raw_sha256", "path", "attempt_path"])
      || result.candidate_plan.path !== expectedCandidatePath
      || result.candidate_plan.attempt_path !== expectedAttemptCandidatePath) {
      fail("candidate-plan path binding mismatch");
    }
    if (!exactKeys(result.integrated_candidate, ["artifact_ref", "raw_sha256", "attempt_path"])
      || result.integrated_candidate.artifact_ref !== result.integration?.candidate_ref
      || result.integrated_candidate.attempt_path !== relativePosix(rootReal, path.join(attemptReal, "integrated-candidate.md"))) {
      fail("integrated-candidate binding mismatch");
    }
    if (!exactKeys(result.signed_events, ["path", "public_key_path", "count", "head_hash"])
      || result.signed_events.path !== relativePosix(rootReal, path.join(attemptReal, "events.jsonl"))
      || result.signed_events.public_key_path !== relativePosix(rootReal, path.join(attemptReal, "event-signing-public.jwk"))) {
      fail("signed-event path binding mismatch");
    }
    if (!exactKeys(result.independent_recheck, ["state", "reason", "terminal", "candidate_ref", "conflicts"])) {
      fail("independent-recheck envelope mismatch");
    }

    const inputKeys = inputKeysForContract(result.contract) || [];
    if (!exactKeys(result.inputs, inputKeys)) fail("result inputs are not the closed workshop input set");
    const liveInputs = {};
    const liveInputSummary = {};
    let canonicalCandidate = null;
    for (const name of inputKeys) {
      const input = result.inputs?.[name];
      try {
        if (!exactKeys(input, ["path", "raw_sha256"])) fail(`${name} input binding has an open or incomplete shape`);
        let live = readRequiredFile(rootReal, input.path);
        if (name === "candidate") {
          canonicalCandidate = live;
          live = {
            path: input.path,
            absolute: path.join(attemptReal, "candidate-plan.md"),
            text: readFileSync(path.join(attemptReal, "candidate-plan.md"), "utf8")
          };
        }
        liveInputs[name] = live;
        const actual = rawSha256Ref(Buffer.from(live.text));
        liveInputSummary[name] = { path: live.path, raw_sha256: actual };
        if (actual !== input.raw_sha256) fail(`${name} input hash mismatch`);
      } catch (error) {
        fail(`${name} input invalid: ${error.message}`);
      }
    }
    if (canonicalCandidate) {
      const canonicalHash = rawSha256Ref(Buffer.from(canonicalCandidate.text));
      const allowedCanonicalHashes = new Set([
        result.inputs?.candidate?.raw_sha256,
        result.matured_plan?.raw_sha256
      ].filter(nonempty));
      if (!allowedCanonicalHashes.has(canonicalHash)) {
        fail("canonical plan path matches neither the frozen candidate nor the integrated matured plan");
      }
    }
    try {
      const comprehension = JSON.parse(liveInputs.comprehension.text);
      if (comprehension.result !== "COMPREHENSION_PASSED"
        || comprehension.comprehension_checks?.passed !== 19
        || comprehension.comprehension_checks?.failed !== 0) {
        fail("comprehension artifact no longer reports 19/19 COMPREHENSION_PASSED");
      }
    } catch (error) {
      fail(`comprehension artifact invalid: ${error.message}`);
    }
    if (result.contract === CONTRACT_V2) {
      try {
        validateControllerRuling(liveInputs, liveInputSummary);
      } catch (error) {
        fail(error.message);
      }
    }
    try {
      const attemptCandidate = readFileSync(path.join(attemptReal, "candidate-plan.md"));
      const topCandidate = readFileSync(path.join(runReal, "candidate-plan.md"));
      const liveCandidate = Buffer.from(liveInputs.candidate.text);
      if (!attemptCandidate.equals(topCandidate) || !topCandidate.equals(liveCandidate)) {
        fail("candidate-plan snapshot differs from the frozen candidate input");
      }
      if (rawSha256Ref(topCandidate) !== result.candidate_plan?.raw_sha256
        || result.candidate_plan?.raw_sha256 !== result.inputs?.candidate?.raw_sha256) {
        fail("candidate-plan snapshot hash mismatch");
      }
    } catch (error) {
      fail(`candidate-plan snapshot invalid: ${error.message}`);
    }

    const allFiles = collectFiles(attemptReal);
    for (const file of allFiles) {
      if (file.kind === "symlink") fail(`symlinked workshop evidence: ${file.relative}`);
      if (/(^|\/)(?:[^/]*private[^/]*|[^/]*\.pem)$/i.test(file.relative)) {
        fail(`private-key-like file persisted: ${file.relative}`);
      }
    }

    const store = createArtifactStore(path.join(attemptReal, "artifacts"), { create: false });
    const artifactFiles = readdirSync(store.directory).sort();
    const artifactRefs = new Set();
    for (const file of artifactFiles) {
      const match = /^([0-9a-f]{64})\.json$/.exec(file);
      if (!match) {
        fail(`unexpected artifact filename: ${file}`);
        continue;
      }
      const ref = `sha256:${match[1]}`;
      try {
        store.read(ref);
        artifactRefs.add(ref);
      } catch (error) {
        fail(error.message);
      }
    }
    const referencedArtifacts = new Set();
    const requireArtifact = (ref, label) => {
      if (typeof ref === "string") referencedArtifacts.add(ref);
      if (!artifactRefs.has(ref)) fail(`${label} artifact missing: ${ref}`);
    };
    requireArtifact(result.frame_ref, "frame");
    for (const source of result.sources || []) {
      requireArtifact(source.artifact_ref, `${source.role} source`);
      requireArtifact(source.provenance?.response_artifact_ref, `${source.role} response`);
    }
    requireArtifact(result.integration?.candidate_ref, "integration");
    requireArtifact(result.integration?.provenance?.response_artifact_ref, "integration response");
    for (const verification of result.verifications || []) {
      requireArtifact(verification.provenance?.response_artifact_ref, `${verification.role} verification response`);
    }
    for (const ref of artifactRefs) {
      if (!referencedArtifacts.has(ref)) fail(`unreferenced artifact: ${ref}`);
    }

    try {
      const frameArtifact = store.read(result.frame_ref);
      const expectedFrame = buildFrozenFrame(liveInputs, liveInputSummary, result.mode, result.contract);
      const expected = {
        kind: "workshop-frame",
        contract: result.contract,
        mode: result.mode,
        inputs: liveInputSummary,
        frame: expectedFrame
      };
      if (canonicalize(frameArtifact) !== canonicalize(expected)) fail("frame artifact does not equal live frozen inputs");
    } catch (error) {
      fail(`frame artifact invalid: ${error.message}`);
    }

    const verifiedSources = [];
    if (!Array.isArray(result.sources) || result.sources.length !== 2) fail("result must contain exactly two source nodes");
    for (const source of result.sources || []) {
      try {
        const sourceKeys = source.role === "constraints"
          ? ["role", "seat", "artifact_ref", "obligations", "provenance", "provenance_key"]
          : ["role", "seat", "artifact_ref", "provenance", "provenance_key"];
        if (!exactKeys(source, sourceKeys) || !exactKeys(source.provenance, RESULT_PROVENANCE_KEYS)) {
          fail(`${source.role} source envelope mismatch`);
        }
        const sourceArtifact = store.read(source.artifact_ref);
        const responseArtifact = store.read(source.provenance.response_artifact_ref);
        const expectedSeat = PARALLEL_ROLES[source.role];
        const expectedProvenanceKey = provenanceKey(sourceArtifact.seat, sourceArtifact.provenance);
        if (source.provenance_key !== expectedProvenanceKey) {
          fail(`${source.role} source provenance-key mismatch`);
        }
        if (sourceArtifact.kind !== "source-node"
          || sourceArtifact.role !== source.role
          || sourceArtifact.seat !== source.seat
          || source.seat !== expectedSeat
          || sourceArtifact.body !== responseArtifact.response?.plan
          || canonicalize(sourceArtifact.provenance) !== canonicalize(source.provenance)
          || responseArtifact.kind !== "seat-response"
          || responseArtifact.role !== source.role
          || responseArtifact.phase !== "author"
          || responseArtifact.seat !== source.seat
          || canonicalize(responseArtifact.provenance) !== canonicalize({
            provider: source.provenance.provider,
            model: source.provenance.model,
            response_id: source.provenance.response_id,
            source: source.provenance.source
          })) {
          fail(`${source.role} source/response semantic mismatch`);
        }
        if (source.role === "constraints"
          && canonicalize(sourceArtifact.obligations) !== canonicalize(responseArtifact.response?.obligations)) {
          fail("constraints obligation source/response mismatch");
        }
        if (source.role === "constraints"
          && canonicalize(sourceArtifact.obligations) !== canonicalize(source.obligations)) {
          fail("constraints obligation result/artifact mismatch");
        }
        verifiedSources.push({
          role: sourceArtifact.role,
          seat: sourceArtifact.seat,
          artifact_ref: source.artifact_ref,
          obligations: sourceArtifact.obligations,
          provenance: sourceArtifact.provenance,
          provenance_key: provenanceKey(sourceArtifact.seat, sourceArtifact.provenance)
        });
      } catch (error) {
        fail(`${source.role} source evidence invalid: ${error.message}`);
      }
    }

    let integrationArtifact;
    let verifiedIntegration;
    try {
      if (!exactKeys(result.integration, [
        "candidate_ref",
        "descends_from",
        "obligation_matrix",
        "seat",
        "provenance",
        "provenance_key"
      ]) || !exactKeys(result.integration?.provenance, RESULT_PROVENANCE_KEYS)) {
        fail("integration envelope mismatch");
      }
      integrationArtifact = store.read(result.integration.candidate_ref);
      const integrationResponse = store.read(result.integration.provenance.response_artifact_ref);
      if (result.integration.provenance_key !== provenanceKey(result.integration.seat, integrationArtifact.provenance)) {
        fail("integration provenance-key mismatch");
      }
      if (integrationArtifact.kind !== "integration-candidate") fail("integration artifact kind mismatch");
      const materialized = applyIntegrationResponse(liveInputs.candidate.text, integrationResponse.response);
      if (materialized.plan !== integrationArtifact.plan
        || canonicalize(materialized.obligation_matrix) !== canonicalize(integrationArtifact.obligation_matrix)
        || canonicalize(integrationArtifact.provenance) !== canonicalize(result.integration.provenance)
        || canonicalize(integrationArtifact.obligation_matrix) !== canonicalize(result.integration.obligation_matrix)
        || canonicalize(integrationArtifact.descends_from) !== canonicalize(result.integration.descends_from)
        || result.integration.seat !== PARALLEL_ROLES.implementation
        || integrationResponse.kind !== "seat-response"
        || integrationResponse.role !== "integration"
        || integrationResponse.phase !== "integrate"
        || integrationResponse.seat !== result.integration.seat
        || canonicalize(integrationResponse.provenance) !== canonicalize({
          provider: result.integration.provenance.provider,
          model: result.integration.provenance.model,
          response_id: result.integration.provenance.response_id,
          source: result.integration.provenance.source
        })) {
        fail("integration response does not materialize the recorded candidate");
      }
      if (canonicalize(integrationArtifact.obligation_matrix) !== canonicalize(result.integration.obligation_matrix)
        || canonicalize(integrationArtifact.descends_from) !== canonicalize(result.integration.descends_from)) {
        fail("integration result/artifact mismatch");
      }
      if (integrationArtifact.plan !== readFileSync(path.join(attemptReal, "integrated-candidate.md"), "utf8")) {
        fail("integrated candidate bytes differ from integration artifact");
      }
      const integratedSha = rawSha256Ref(Buffer.from(integrationArtifact.plan));
      if (integratedSha !== result.integrated_candidate.raw_sha256) fail("integrated candidate raw hash mismatch");
      const changed = integrationArtifact.plan !== liveInputs.candidate.text;
      if (result.matured_plan_changed !== changed) fail("matured-plan changed flag mismatch");
      verifiedIntegration = {
        candidate_ref: result.integration.candidate_ref,
        descends_from: integrationArtifact.descends_from,
        obligation_matrix: integrationArtifact.obligation_matrix,
        seat: PARALLEL_ROLES.implementation,
        provenance: integrationArtifact.provenance,
        provenance_key: provenanceKey(PARALLEL_ROLES.implementation, integrationArtifact.provenance)
      };
    } catch (error) {
      fail(`integration artifact invalid: ${error.message}`);
    }

    const verifiedVerifications = [];
    if (!Array.isArray(result.verifications) || result.verifications.length !== 2) {
      fail("result must contain exactly two verification responses");
    }
    for (const verification of result.verifications || []) {
      try {
        if (!exactKeys(verification, [
          "role",
          "seat",
          "verdict",
          "conflicts",
          "provenance",
          "provenance_key"
        ]) || !exactKeys(verification.provenance, RESULT_PROVENANCE_KEYS)) {
          fail(`${verification.role} verification envelope mismatch`);
        }
        const responseArtifact = store.read(verification.provenance.response_artifact_ref);
        const expectedSeat = PARALLEL_ROLES[verification.role];
        if (verification.provenance_key !== provenanceKey(verification.seat, verification.provenance)) {
          fail(`${verification.role} verification provenance-key mismatch`);
        }
        if (responseArtifact.kind !== "seat-response"
          || responseArtifact.role !== verification.role
          || responseArtifact.phase !== "verify"
          || responseArtifact.seat !== verification.seat
          || verification.seat !== expectedSeat
          || responseArtifact.response?.verdict !== verification.verdict
          || canonicalize(responseArtifact.response?.conflicts) !== canonicalize(verification.conflicts)
          || canonicalize(responseArtifact.provenance) !== canonicalize({
            provider: verification.provenance.provider,
            model: verification.provenance.model,
            response_id: verification.provenance.response_id,
            source: verification.provenance.source
          })) {
          fail(`${verification.role} verification response mismatch`);
        }
        verifiedVerifications.push({
          role: responseArtifact.role,
          seat: responseArtifact.seat,
          verdict: responseArtifact.response.verdict,
          conflicts: responseArtifact.response.conflicts,
          provenance: verification.provenance,
          provenance_key: provenanceKey(responseArtifact.seat, verification.provenance)
        });
      } catch (error) {
        fail(`${verification.role} verification evidence invalid: ${error.message}`);
      }
    }

    const recheck = deriveParallelState({
      sources: verifiedSources,
      integration: verifiedIntegration,
      verifications: verifiedVerifications
    });
    if (recheck.state !== result.independent_recheck?.state
      || recheck.reason !== result.independent_recheck?.reason
      || (recheck.terminal ?? null) !== result.independent_recheck?.terminal
      || recheck.candidate_ref !== result.independent_recheck?.candidate_ref) {
      fail("independent state recheck mismatch");
    }
    if (result.state !== recheck.state || result.reason !== recheck.reason || (result.terminal ?? null) !== (recheck.terminal ?? null)) {
      fail("recorded workshop state differs from re-derived state");
    }
    if (canonicalize(result.conflicts) !== canonicalize(recheck.conflicts)
      || canonicalize(result.independent_recheck?.conflicts) !== canonicalize(recheck.conflicts)) {
      fail("recorded conflict set mismatch");
    }

    if (result.state === "converged-parallel") {
      if (result.terminal !== "submit" || result.authorization_granted !== false || result.implementation_started !== false) {
        fail("converged result misstates terminal or authority boundary");
      }
      if (!exactKeys(result.matured_plan, ["artifact_ref", "raw_sha256", "path", "attempt_path"])
        || result.matured_plan.artifact_ref !== result.integration?.candidate_ref
        || result.matured_plan.path !== relativePosix(rootReal, path.join(runReal, "matured-plan.md"))
        || result.matured_plan.attempt_path !== relativePosix(rootReal, path.join(attemptReal, "matured-plan.md"))) {
        fail("matured-plan path binding mismatch");
      }
      const attemptMatured = readFileSync(path.join(attemptReal, "matured-plan.md"));
      const topMatured = readFileSync(path.join(runReal, "matured-plan.md"));
      if (!attemptMatured.equals(topMatured)) fail("top-level and attempt matured-plan bytes differ");
      if (integrationArtifact && integrationArtifact.plan !== topMatured.toString("utf8")) {
        fail("matured plan differs from integration artifact");
      }
      if (rawSha256Ref(topMatured) !== result.matured_plan?.raw_sha256) fail("matured plan raw hash mismatch");
    } else {
      if (result.matured_plan !== null) fail("non-converged result must not publish a matured plan");
      if (existsSync(path.join(runReal, "matured-plan.md"))) {
        fail("non-converged selected attempt retained a stale top-level matured plan");
      }
    }

    const publicJwk = strictJson(path.join(attemptReal, "event-signing-public.jwk")).value;
    const events = strictJsonLines(path.join(attemptReal, "events.jsonl"));
    eventCount = events.length;
    const chain = verifyProposalChain(events, publicJwk, { proposalId: PROPOSAL_ID });
    if (!chain.ok) fail(`signed event chain invalid: ${chain.errors.join("; ")}`);
    if (events.length !== 4 || JSON.stringify(events.map((event) => event.stage)) !== JSON.stringify(["draft", "negotiation", "candidate", "review"])) {
      fail("signed event stage sequence mismatch");
    }
    if (events[0]?.artifact_refs?.[0] !== result.frame_ref) fail("draft event is not bound to frame artifact");
    if (events[0]?.policy_result?.evidence_mode !== result.mode) {
      fail("signed draft event does not bind the workshop evidence mode");
    }
    const sourceRefs = (result.sources || []).map((source) => source.artifact_ref);
    if (JSON.stringify(events[1]?.artifact_refs) !== JSON.stringify(sourceRefs)) fail("negotiation event is not bound to both source artifacts");
    const expectedReviewRefs = [
      result.integration?.candidate_ref,
      (result.verifications || []).find((entry) => entry.role === "constraints")?.provenance?.response_artifact_ref,
      (result.verifications || []).find((entry) => entry.role === "implementation")?.provenance?.response_artifact_ref
    ];
    if (events[2]?.artifact_refs?.[0] !== result.integration?.candidate_ref
      || canonicalize(events[3]?.artifact_refs) !== canonicalize(expectedReviewRefs)) {
      fail("candidate/review events are not bound to integration artifact");
    }
    if (events[0]?.plan_hash !== result.inputs?.candidate?.raw_sha256
      || events[1]?.plan_hash !== result.inputs?.candidate?.raw_sha256
      || events[2]?.plan_hash !== result.integrated_candidate?.raw_sha256
      || events[3]?.plan_hash !== result.integrated_candidate?.raw_sha256) {
      fail("signed event plan-hash sequence mismatch");
    }
    if (events[3]?.policy_result?.state !== result.state
      || (events[3]?.policy_result?.terminal ?? null) !== result.terminal) {
      fail("signed final review event does not bind the recorded terminal");
    }
    if (proposalEventHash(events.at(-1)) !== result.signed_events?.head_hash) fail("signed event head hash mismatch");
    if (events.length !== result.signed_events?.count) fail("signed event count mismatch");

    const lineage = result.creation_lineage || [];
    provenanceCount = lineage.length;
    const expectedLineage = creationLineage({
      sources: verifiedSources,
      integration: verifiedIntegration,
      verifications: verifiedVerifications
    });
    if (canonicalize(lineage) !== canonicalize(expectedLineage)) fail("creation lineage mismatch");
    const keys = lineage.map((entry) => `${entry.provider}:${entry.response_id}`);
    if (lineage.length !== 5 || new Set(keys).size !== 5 || keys.some((key) => key.includes(":undefined"))) {
      fail("creation lineage must contain five real pairwise-distinct calls");
    }
    if (result.mode === "live") {
      for (const entry of lineage) {
        const provider = entry.seat === "claude" ? "anthropic" : entry.seat === "codex" ? "openai" : null;
        if (entry.provider !== provider
          || !nonempty(entry.model)
          || !nonempty(entry.response_id)
          || /smoke|fixture/i.test(`${entry.model}:${entry.response_id}`)) {
          fail(`live lineage is not provider-real for ${entry.role}/${entry.phase}`);
        }
        const evidence = store.read(entry.response_artifact_ref);
        if (!expectedLiveSources(entry.seat).has(evidence.provenance?.source)) {
          fail(`live lineage source mismatch for ${entry.role}/${entry.phase}`);
        }
      }
    } else if (lineage.some((entry) => {
      try {
        return store.read(entry.response_artifact_ref).provenance?.source !== "workshop-smoke";
      } catch {
        return true;
      }
    })) {
      fail("smoke lineage contains a non-smoke source");
    }
    for (const entry of lineage) requireArtifact(entry.response_artifact_ref, `${entry.role}/${entry.phase} lineage response`);
  } catch (error) {
    fail(error.message);
  }
  let mode = null;
  let state = null;
  let terminal = null;
  try {
    const result = JSON.parse(readFileSync(path.join(runDir, "result.json"), "utf8"));
    mode = result.mode ?? null;
    state = result.state ?? null;
    terminal = result.terminal ?? null;
  } catch {}
  return {
    ok: errors.length === 0,
    errors,
    event_count: eventCount,
    provenance_count: provenanceCount,
    mode,
    state,
    terminal
  };
}
