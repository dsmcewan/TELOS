#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import * as fs from "node:fs";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { agyAttestation, agyCheckpoint } from "../../../connectors/ai-peer-mcp/lib.mjs";
import { signPacket } from "../../../build-gate/sign.mjs";
import * as runnerModule from "./run-authorization.mjs";

import {
  CONSTANTS,
  PROVIDER_FETCH_PRELOAD_SOURCE,
  buildAuthorizationSummary,
  canonicalRef,
  canonicalize,
  claimAuthorizationAttempt,
  classifyCandidateBindingResults,
  classifyPacketProvenance,
  captureHeldProviderSourceGraph,
  createAgyReviewBinding,
  createProviderChildEnvironment,
  createProviderTransportProfile,
  createRevisionLineage,
  createHeldProviderChildBootstrap,
  derivePriorResponseIds,
  loadExactReviewInputs,
  installHeldProviderModuleHooks,
  makeTerminalFailure,
  publishAtomicExclusiveJson,
  projectAdvisoryNonVetoGate,
  responseSchemaForSeat,
  runDurableAuthorizationPhase,
  runDeterministicPreflight,
  runLive,
  spawnProviderMcpTransport,
  stripAdditionalProperties,
  validateCandidateBindings,
  validateCouncilConfiguration,
  validateCurrentAuthority,
  validatePlanIdentity,
  validatePriorAttemptInventory,
  validatePriorSummary,
  validateRevisionLineage,
  validateFreshPacketHashes,
  validateFreshPacketProvenance,
  validateAgyCheckpointBinding
} from "./run-authorization.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const RUNNER = path.join(HERE, "run-authorization.mjs");
const TEST = path.join(HERE, "test-runner.mjs");
const FIXTURE_AGY_CHECKPOINT_REF = `sha256:${"a".repeat(64)}`;
const FIXTURE_SEAT_SECRETS = Object.freeze({
  claude: "fixture-claude-signer",
  agy: "fixture-agy-signer",
  codex: "fixture-codex-signer",
  grok: "fixture-grok-signer",
  gemini: "fixture-gemini-signer"
});
const fixtureSignatureOptions = (model) => ({ signatureSecret: FIXTURE_SEAT_SECRETS[model] });
const FIXTURE_SAFE_FAILURE_MESSAGES = Object.freeze({
  SEAT_CALL_FAILED: "Provider seat call failed.",
  INVALID_PROVIDER_IDENTITY: "Seat packet failed exact routed provider identity validation.",
  INVALID_PACKET_PROVENANCE: "Seat packet failed fresh provenance validation.",
  INVALID_CANDIDATE_BINDING: "Seat packet failed exact candidate binding validation.",
  SENSITIVE_PACKET_CONTENT: "Seat packet contained active sensitive content.",
  INVALID_PACKET_SIGNATURE: "Seat packet failed exact signature validation.",
  MCP_CHILD_ERROR: "Provider transport child failed.",
  MCP_CHILD_EXIT: "Provider transport child exited unexpectedly.",
  PROVIDER_ERROR: "Provider transport failed.",
  CONTROLLER_VALIDATION_FAILED: "Authorization controller validation failed."
});

const ROUTED_PROVENANCE = Object.freeze({
  claude: Object.freeze({
    provider: "anthropic",
    model: "claude-fable-5",
    source: "ai-peer-mcp/claude_ask",
    tool: "claude_ask"
  }),
  agy: Object.freeze({
    provider: "local",
    model: "agy-checkpoint",
    source: "ai-peer-mcp/agy_checkpoint",
    tool: "agy_checkpoint",
    answered_at: null,
    attestation: "local-deterministic",
    engine_version: "agy-checkpoint/1"
  }),
  codex: Object.freeze({
    provider: "openai",
    model: "gpt-5.6-sol",
    source: "ai-peer-mcp/codex_ask",
    tool: "codex_ask"
  }),
  grok: Object.freeze({
    provider: "xai",
    model: "grok-4.5",
    source: "ai-peer-mcp/grok_ask",
    tool: "grok_ask"
  }),
  gemini: Object.freeze({
    provider: "google",
    model: "gemini-3.1-pro-preview",
    source: "ai-peer-mcp/gemini_ask",
    tool: "gemini_ask"
  })
});

function routedProvenance(model, responseId = model === "agy"
  ? `agy-${FIXTURE_AGY_CHECKPOINT_REF.slice("sha256:".length, "sha256:".length + 40)}`
  : `fresh-${model}`) {
  return {
    ...ROUTED_PROVENANCE[model],
    response_id: responseId,
    ...(model === "agy" ? {} : { answered_at: "2026-07-22T12:00:00.000Z" })
  };
}

function copiedHeldGraph(held) {
  return {
    ...held,
    entries: held.entries.map((entry) => ({ ...entry, source: Buffer.from(entry.source) })),
    local_edges: held.local_edges.map((edge) => ({ ...edge })),
    allowed_builtins: [...held.allowed_builtins],
    parent_roots: [...held.parent_roots]
  };
}

function verifyDecisionChain(summary) {
  const chain = summary.decision_chain;
  assert.ok(chain, "durable summary omitted decision_chain");
  assert.equal(chain.schema_version, "telos.authz-013-provisional-merkle-decision-chain.v1");
  assert.equal(chain.status, "PROVISIONAL_NON_AUTHORITATIVE");
  assert.equal(chain.authoritative, false);
  assert.equal(chain.grants_authority, false);
  assert.equal(chain.compact_authority_claimed, false);
  const seed = {
    schema_version: "telos.authz-013-provisional-merkle-decision-seed.v1",
    authorization_id: summary.authorization_id,
    build_id: summary.build_id,
    candidate_ref: summary.plan_ref,
    revision_lineage_ref: summary.revision_lineage_ref,
    provider_transport_ref: summary.provider_transport_ref,
    policy_ref: canonicalRef(CONSTANTS.DECISION_CHAIN_POLICY),
    authoritative: false,
    grants_authority: false
  };
  assert.equal(chain.seed_ref, canonicalRef(seed));
  let priorRoot = chain.seed_ref;
  for (const [sequence, node] of chain.nodes.entries()) {
    assert.equal(node.schema_version, "telos.authz-013-provisional-merkle-decision-node.v1");
    assert.equal(node.sequence, sequence);
    assert.equal(node.prior_root, priorRoot);
    assert.equal(node.outcome_ref, canonicalRef(node.outcome));
    assert.ok(node.evidence_refs && typeof node.evidence_refs === "object" && !Array.isArray(node.evidence_refs));
    for (const ref of Object.values(node.evidence_refs)) assert.match(ref, /^sha256:[0-9a-f]{64}$/);
    const body = {
      schema_version: node.schema_version,
      sequence: node.sequence,
      transition: node.transition,
      subject: node.subject,
      prior_root: node.prior_root,
      outcome_ref: node.outcome_ref,
      evidence_refs: node.evidence_refs
    };
    assert.equal(node.node_ref, canonicalRef(body));
    assert.equal(node.new_root, canonicalRef({
      schema_version: "telos.authz-013-provisional-merkle-decision-root.v1",
      prior_root: node.prior_root,
      node_ref: node.node_ref
    }));
    priorRoot = node.new_root;
  }
  assert.equal(chain.final_root, priorRoot);
  assert.equal(summary.decision_chain_final_root, priorRoot);
  return chain;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function rawJsonSha256(value) {
  return `sha256:${createHash("sha256").update(jsonBytes(value)).digest("hex")}`;
}

function durableDecisionPublicationRef(filename, seat, packetRawSha256) {
  return canonicalRef({
    schema_version: "telos.authz-013-provisional-durable-decision-publication.v1",
    authorization_id: CONSTANTS.AUTHORIZATION_ID,
    candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
    filename,
    seat,
    packet_raw_sha256: packetRawSha256
  });
}

function rehashStandaloneEnvelopeNode(envelope) {
  const node = envelope.decision_node;
  node.outcome_ref = canonicalRef(node.outcome);
  const body = {
    schema_version: node.schema_version,
    sequence: node.sequence,
    transition: node.transition,
    subject: node.subject,
    prior_root: node.prior_root,
    outcome_ref: node.outcome_ref,
    evidence_refs: node.evidence_refs
  };
  node.node_ref = canonicalRef(body);
  node.new_root = canonicalRef({
    schema_version: "telos.authz-013-provisional-merkle-decision-root.v1",
    prior_root: node.prior_root,
    node_ref: node.node_ref
  });
  envelope.new_root = node.new_root;
  return envelope;
}

function rehashAcceptedEnvelopePacket(envelope, filename, {
  signatureSecret = FIXTURE_SEAT_SECRETS[envelope.seat?.model],
  resign = true
} = {}) {
  if (resign) envelope.packet = signPacket(envelope.packet, signatureSecret);
  const packetRawSha256 = rawJsonSha256(envelope.packet);
  envelope.decision_node.evidence_refs.packet_raw_sha256 = packetRawSha256;
  envelope.decision_node.evidence_refs.publication_ref = durableDecisionPublicationRef(
    filename,
    envelope.seat,
    packetRawSha256
  );
  return rehashStandaloneEnvelopeNode(envelope);
}

function runNode(args) {
  return spawnSync("/usr/bin/node", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, TELOS_AUTHZ013_TEST_NO_PROVIDERS: "1" }
  });
}

function sha256File(file) {
  return `sha256:${createHash("sha256").update(readFileSync(file)).digest("hex")}`;
}

function repositorySnapshot() {
  const names = execFileSync("git", ["-C", ROOT, "ls-files", "-co", "--exclude-standard", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  return {
    status: execFileSync("git", ["-C", ROOT, "status", "--porcelain=v1", "-z"]).toString("hex"),
    files: names.map((name) => ({ name, hash: sha256File(path.join(ROOT, name)) }))
  };
}

function attemptSnapshot() {
  if (!statSync(HERE).isDirectory()) throw new Error("attempt directory missing");
  return readdirSync(HERE, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      kind: entry.isFile() ? "file" : entry.isDirectory() ? "directory" : "other",
      hash: entry.isFile() ? sha256File(path.join(HERE, entry.name)) : null
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function expectReject(fn, pattern) {
  assert.throws(fn, pattern);
}

function successfulResult(model, role, decision = "approve") {
  return {
    model,
    role,
    ok: true,
    signed: true,
    packet: {
      model,
      role,
      decision,
      confidence: "high",
      provenance: routedProvenance(model),
      ...(model === "agy" ? { agy_checkpoint_ref: FIXTURE_AGY_CHECKPOINT_REF } : {})
    }
  };
}

function allSuccessfulResults() {
  return CONSTANTS.SEATS.map(({ model, role }) => successfulResult(model, role));
}

function gateFixture({ gateStatus = "pass", blockers = [], warnings = [] } = {}) {
  return {
    gate_status: gateStatus,
    blockers,
    warnings,
    provenance: [],
    headline_checks: { signing_enforced: true, provenance_enforced: true }
  };
}

function decisionChainForResults(results, providerTransport, { failureRefFor = null } = {}) {
  let chain = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  for (const result of results) {
    if (result.ok === true) {
      const packetRawSha256 = `sha256:${createHash("sha256").update(`${JSON.stringify(result.packet, null, 2)}\n`).digest("hex")}`;
      chain = runnerModule.appendProvisionalDecisionNode(chain, {
        transition: "seat",
        subject: { kind: "seat", model: result.model, role: result.role },
        outcome: { status: "accepted-published", decision: result.packet?.decision ?? null, signed: result.signed === true },
        evidenceRefs: {
          packet_raw_sha256: packetRawSha256,
          publication_ref: canonicalRef({
            schema_version: "telos.authz-013-provisional-durable-decision-publication.v1",
            authorization_id: CONSTANTS.AUTHORIZATION_ID,
            candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
            filename: `${result.model}.json`,
            seat: { model: result.model, role: result.role },
            packet_raw_sha256: packetRawSha256
          })
        }
      });
    } else {
      const candidateReasonCode = result?.failure?.reason_code
        || result?.validation_failure?.reason_code
        || (/^[A-Z][A-Z0-9_]+:/.exec(result?.reason || "")?.[0]?.slice(0, -1))
        || "SEAT_CALL_FAILED";
      const reasonCode = FIXTURE_SAFE_FAILURE_MESSAGES[candidateReasonCode]
        ? candidateReasonCode
        : "SEAT_CALL_FAILED";
      const expectedFailureRef = canonicalRef({
        schema_version: "telos.authz-013-sanitized-failure-projection.v1",
        reason_code: reasonCode,
        message: FIXTURE_SAFE_FAILURE_MESSAGES[reasonCode] || FIXTURE_SAFE_FAILURE_MESSAGES.SEAT_CALL_FAILED,
        terminal: false,
        child_exit_code: null,
        child_signal: null
      });
      chain = runnerModule.appendProvisionalDecisionNode(chain, {
        transition: "seat",
        subject: { kind: "seat", model: result.model, role: result.role },
        outcome: { status: "failed", decision: null, reason_code: reasonCode },
        evidenceRefs: { failure_ref: failureRefFor ? failureRefFor(result) : expectedFailureRef }
      });
    }
  }
  return chain;
}

function appendUncheckedDecisionNode(chain, { transition, subject, outcome, evidenceRefs }) {
  const sequence = chain.nodes.length;
  const exactSubject = JSON.parse(canonicalize(subject));
  const exactOutcome = JSON.parse(canonicalize(outcome));
  const exactEvidenceRefs = JSON.parse(canonicalize(evidenceRefs));
  const body = {
    schema_version: "telos.authz-013-provisional-merkle-decision-node.v1",
    sequence,
    transition,
    subject: exactSubject,
    prior_root: chain.final_root,
    outcome_ref: canonicalRef(exactOutcome),
    evidence_refs: exactEvidenceRefs
  };
  const node = {
    ...body,
    outcome: exactOutcome,
    node_ref: canonicalRef(body)
  };
  node.new_root = canonicalRef({
    schema_version: "telos.authz-013-provisional-merkle-decision-root.v1",
    prior_root: node.prior_root,
    node_ref: node.node_ref
  });
  return {
    ...chain,
    seed: { ...chain.seed },
    nonclaims: [...chain.nonclaims],
    nodes: [...chain.nodes.map((entry) => clone(entry)), node],
    final_root: node.new_root
  };
}

function buildSummary(options) {
  const providerTransport = options.providerTransport || createProviderTransportProfile();
  return buildAuthorizationSummary({
    ...options,
    providerTransport,
    decisionChain: decisionChainForResults(options.results || [], providerTransport)
  });
}

async function runLifecycleFixture({
  failurePoint,
  codexDecision = "approve",
  publishJson,
  unsignedModel = null,
  signedFlagFalseModel = null,
  failedModel = null,
  rawFailureReason = null,
  transportErrorMessage = "fixture stdout failed",
  closeErrorMessage = null,
  crashAfterEnvelopeModel = null,
  captureRunError = false,
  successfulPacketMutator = null,
  signedPacketMutator = null,
  environmentOverrides = {}
} = {}) {
  const sourceReview = runDeterministicPreflight({ sourceReview: true });
  const livePreflight = { ...sourceReview, live_eligible: true };
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), `authz-013-lifecycle-${failurePoint}-`));
  const fixtureEnvironment = {
    ANTHROPIC_API_KEY: "fixture-anthropic",
    OPENAI_API_KEY: "fixture-openai",
    TELOS_SECRET_CLAUDE: FIXTURE_SEAT_SECRETS.claude,
    TELOS_SECRET_AGY: FIXTURE_SEAT_SECRETS.agy,
    TELOS_SECRET_CODEX: FIXTURE_SEAT_SECRETS.codex,
    TELOS_SECRET_GROK: FIXTURE_SEAT_SECRETS.grok,
    TELOS_SECRET_GEMINI: FIXTURE_SEAT_SECRETS.gemini,
    ...environmentOverrides
  };
  const child = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdin.write = () => true;
  child.stdout = new EventEmitter();
  child.kill = () => {
    if (closeErrorMessage) throw new Error(closeErrorMessage);
    if (failurePoint === "expected-close-after-fifth") {
      child.stdout.emit("end");
      child.stdout.emit("close");
      child.emit("exit", 0, null);
    }
    return true;
  };
  const emitFailure = (point) => {
    if (point === "required-agy") child.stdout.emit("end");
    if (point === "between-required-advisory") child.stdout.emit("end");
    if (point === "active-grok") child.stdout.emit("close");
    if (point === "active-gemini") {
      child.stdout.emit("error", new Error(transportErrorMessage));
      child.stdout.emit("error", new Error("fixture repeated stdout failure"));
    }
    if (point === "after-fifth-gate") child.emit("exit", 9, null);
  };
  let calls = 0;
  const councilModule = {
    agyApprovalPacket: () => { throw new Error("fake council returns complete packets directly"); },
    agyCheckpointArgs: () => ({}),
    liveSeatCaller: () => async () => { throw new Error("fake council owns the fixture call"); },
    async runCouncil({ seats, dossier }) {
      assert.equal(seats.length, 1);
      const seat = seats[0];
      calls += 1;
      if ((failurePoint === "required-agy" && seat.model === "agy")
        || (failurePoint === "active-grok" && seat.model === "grok")
        || (failurePoint === "active-gemini" && seat.model === "gemini")) {
        queueMicrotask(() => emitFailure(failurePoint));
        return new Promise(() => {});
      }
      if (seat.model === failedModel) {
        return [{
          model: seat.model,
          role: seat.role,
          ok: false,
          signed: false,
          reason: rawFailureReason
        }];
      }
      const decision = seat.model === "codex" ? codexDecision : "approve";
      const agyResponseId = routedProvenance("agy").response_id;
      let packet = {
        model: seat.model,
        role: seat.role,
        decision,
        confidence: "high",
        required_edits: [],
        hard_stops: [],
        provenance: routedProvenance(seat.model, seat.model === "agy" ? undefined : `fresh-live-${seat.model}`),
        proposal_ref: dossier.proposal_ref,
        build_id: dossier.build_id,
        use_case: dossier.use_case,
        docs_reviewed: [CONSTANTS.PLAN_PATH, CONSTANTS.SPEC_PATH],
        timestamp: "2026-07-22T12:00:00.000Z",
        revision_lineage_ref: dossier.revision_lineage_ref,
        revision_lineage: dossier.revision_lineage,
        provider_transport_ref: dossier.provider_transport_ref,
        provider_transport: dossier.provider_transport,
        provider_preload_raw_sha256: dossier.provider_preload_raw_sha256,
        agy_review_input_ref: dossier.agy_review_input_ref,
        ...(seat.model === "agy"
          ? { agy_checkpoint_ref: FIXTURE_AGY_CHECKPOINT_REF, response_id: agyResponseId }
          : { rationale: "fixture" })
      };
      if (typeof successfulPacketMutator === "function") {
        packet = successfulPacketMutator({
          environment: fixtureEnvironment,
          packet: clone(packet),
          seat: { ...seat }
        }) || packet;
      }
      const signed = seat.model !== unsignedModel;
      if (signed) packet = signPacket(packet, fixtureEnvironment[`TELOS_SECRET_${seat.model.toUpperCase()}`]);
      if (typeof signedPacketMutator === "function") {
        packet = signedPacketMutator({
          environment: fixtureEnvironment,
          packet: clone(packet),
          seat: { ...seat },
          signed
        }) || packet;
      }
      const result = {
        model: seat.model,
        role: seat.role,
        ok: true,
        signed: seat.model === signedFlagFalseModel ? false : signed,
        packet
      };
      return [result];
    }
  };
  let gateCalls = 0;
  const logs = [];
  const consoleErrors = [];
  const exitCodes = [];
  const originalConsoleError = console.error;
  let crashTriggered = false;
  try {
    console.error = (...args) => consoleErrors.push(args.map(String).join(" "));
    let runError = null;
    try {
      await runLive(livePreflight, {
      outputDirectory,
      log: (value) => logs.push(String(value)),
      setExitCode: (value) => exitCodes.push(value),
      now: () => "2026-07-22T12:00:00.000Z",
      environment: fixtureEnvironment,
      publishJson: (directory, filename, value) => {
        if (crashTriggered && filename === "authorization-summary.json") {
          throw new Error("simulated stop before terminal summary");
        }
        const publication = (publishJson || publishAtomicExclusiveJson)(directory, filename, value);
        if (filename === `${crashAfterEnvelopeModel}.json`) {
          crashTriggered = true;
          throw new Error("simulated crash after durable decision envelope");
        }
        if (failurePoint === "between-required-advisory" && filename === "codex.json") emitFailure(failurePoint);
        return publication;
      },
      importModule: async (relative) => {
        if (relative === "connectors/ai-peer-mcp/lib.mjs") return { agyAttestation };
        if (relative === "build-gate/council.mjs") return councilModule;
        if (relative === "build-gate/gate.mjs") return {
          validateRecords() {
            gateCalls += 1;
            if (failurePoint === "after-fifth-gate" && gateCalls === 1) emitFailure(failurePoint);
            return gateFixture();
          }
        };
        if (relative === "breakout/mcp_client.mjs") return { createMcpClient: () => ({}) };
        throw new Error(`unexpected import ${relative}`);
      },
      spawnTransport: () => ({ client: {}, child, close: () => child.kill() })
      });
    } catch (error) {
      runError = error;
      if (!crashAfterEnvelopeModel && !captureRunError) throw error;
    }
    const summaryPath = path.join(outputDirectory, "authorization-summary.json");
    const summary = existsSync(summaryPath) ? JSON.parse(readFileSync(summaryPath, "utf8")) : null;
    const files = Object.fromEntries(readdirSync(outputDirectory).map((name) => [name, readFileSync(path.join(outputDirectory, name))]));
    return { summary, files, calls, gateCalls, logs, consoleErrors, exitCodes, runError };
  } finally {
    console.error = originalConsoleError;
    rmSync(outputDirectory, { recursive: true, force: true });
  }
}

test("revision lineage is closed, canonical, content-addressed, and non-authoritative", () => {
  const lineage = createRevisionLineage();
  assert.deepEqual(Object.keys(lineage).sort(), CONSTANTS.REVISION_LINEAGE_KEYS.slice().sort());
  assert.equal(lineage.schema_version, "telos.authorization-revision-lineage.provisional.v1");
  assert.equal(lineage.status, "PROVISIONAL_NON_AUTHORITATIVE");
  assert.equal(lineage.authoritative, false);
  assert.equal(lineage.grants_authority, false);
  assert.equal(lineage.mutation_of, "authz-012");
  assert.equal("extends" in lineage, false);
  assert.equal("retry_of" in lineage, false);
  assert.equal(lineage.prior_candidate_ref, CONSTANTS.PRIOR_CANDIDATE_REF);
  assert.equal(lineage.candidate_ref, CONSTANTS.EXPECTED_PLAN_REF);
  assert.match(canonicalRef(lineage), /^sha256:[0-9a-f]{64}$/);
  assert.equal(validateRevisionLineage(lineage, canonicalRef(lineage)), true);
});

test("pure validators reject every required deterministic mutation", () => {
  const lineage = createRevisionLineage();
  const lineageRef = canonicalRef(lineage);
  const providerTransport = createProviderTransportProfile();
  const providerTransportRef = canonicalRef(providerTransport);
  const agyReviewInput = createAgyReviewBinding(loadExactReviewInputs());
  const agyReviewInputRef = canonicalRef(agyReviewInput);
  const priorSummary = clone(CONSTANTS.EXPECTED_PRIOR_SUMMARY_SEMANTICS);
  const inventory = clone(CONSTANTS.PRIOR_ATTEMPT_FILES);
  const seats = clone(CONSTANTS.SEATS);
  const transport = clone(CONSTANTS.TRANSPORT_POLICY);
  const dossier = {
    build_id: CONSTANTS.BUILD_ID,
    use_case: CONSTANTS.USE_CASE,
    proposal_ref: CONSTANTS.EXPECTED_PLAN_REF,
    revision_lineage_ref: lineageRef,
    revision_lineage: lineage,
    provider_transport_ref: providerTransportRef,
    provider_transport: providerTransport,
    provider_preload_raw_sha256: providerTransport.preload_raw_sha256,
    agy_review_input_ref: agyReviewInputRef,
    agy_review_input: agyReviewInput
  };
  const packets = seats.map(({ model, role }) => ({
    model,
    role,
    build_id: dossier.build_id,
    use_case: dossier.use_case,
    proposal_ref: dossier.proposal_ref,
    revision_lineage_ref: lineageRef,
    revision_lineage: clone(lineage),
    provider_transport_ref: providerTransportRef,
    provider_transport: clone(providerTransport),
    provider_preload_raw_sha256: providerTransport.preload_raw_sha256,
    agy_review_input_ref: agyReviewInputRef
  }));

  assert.equal(validatePlanIdentity(clone(CONSTANTS.PLAN_IDENTITY)), true);
  assert.equal(validatePriorSummary(priorSummary), true);
  assert.equal(validatePriorAttemptInventory(inventory), true);
  assert.equal(validateCandidateBindings(dossier, packets), true);
  assert.equal(validateCouncilConfiguration(seats, transport), true);
  assert.equal(validateCurrentAuthority({ active_authorization: { id: "authz-008" } }), true);

  const badPlan = clone(CONSTANTS.PLAN_IDENTITY);
  badPlan.candidate_ref = CONSTANTS.PRIOR_CANDIDATE_REF;
  expectReject(() => validatePlanIdentity(badPlan), /plan identity/i);

  const badSummary = clone(priorSummary);
  badSummary.seats[2].decision = "approve";
  expectReject(() => validatePriorSummary(badSummary), /prior summary/i);

  const badInventory = clone(inventory);
  badInventory[0].raw_sha256 = "sha256:" + "0".repeat(64);
  expectReject(() => validatePriorAttemptInventory(badInventory), /prior inventory/i);

  const badCandidatePacket = clone(packets);
  badCandidatePacket[0].proposal_ref = CONSTANTS.PRIOR_CANDIDATE_REF;
  expectReject(() => validateCandidateBindings(dossier, badCandidatePacket), /candidate binding/i);

  const badLineagePacket = clone(packets);
  badLineagePacket[1].revision_lineage.mutation_of = "authz-011";
  expectReject(() => validateCandidateBindings(dossier, badLineagePacket), /candidate binding/i);

  const badSourceGraphDossier = clone(dossier);
  badSourceGraphDossier.provider_transport.source_graph.entries[0].raw_sha256 = `sha256:${"0".repeat(64)}`;
  badSourceGraphDossier.provider_transport_ref = canonicalRef(badSourceGraphDossier.provider_transport);
  expectReject(() => validateCandidateBindings(badSourceGraphDossier, packets), /candidate binding/i);

  const badSeats = clone(seats);
  [badSeats[0], badSeats[1]] = [badSeats[1], badSeats[0]];
  expectReject(() => validateCouncilConfiguration(badSeats, transport), /seat order/i);

  const badTransport = clone(transport);
  badTransport.per_seat_automatic_retries = 1;
  expectReject(() => validateCouncilConfiguration(seats, badTransport), /transport policy/i);

  expectReject(
    () => validateCurrentAuthority({ active_authorization: { id: "authz-007" } }),
    /authority predecessor/i
  );
});

test("prior packet bytes cannot be accepted as fresh current results", () => {
  const fresh = CONSTANTS.SEATS.map(({ model }) => ({
    model,
    raw_sha256: `sha256:${createHash("sha256").update(`fresh-${model}`).digest("hex")}`
  }));
  assert.equal(validateFreshPacketHashes(fresh), true);
  const reused = clone(fresh);
  reused[2].raw_sha256 = CONSTANTS.PRIOR_PACKET_HASHES.codex;
  expectReject(() => validateFreshPacketHashes(reused), /prior packet/i);
});

test("fresh packet hashes accept exact seat subsequences and reject unsafe partial sets", () => {
  const partial = ["claude", "codex", "gemini"].map((model) => ({
    model,
    raw_sha256: `sha256:${createHash("sha256").update(`partial-${model}`).digest("hex")}`
  }));
  assert.equal(validateFreshPacketHashes(partial), true);
  expectReject(() => validateFreshPacketHashes([partial[1], partial[0]]), /order/i);
  expectReject(() => validateFreshPacketHashes([partial[0], partial[0]]), /duplicate/i);
  expectReject(
    () => validateFreshPacketHashes([{ model: "unknown", raw_sha256: partial[0].raw_sha256 }]),
    /unknown/i
  );
});

test("fresh packet provenance rejects authz-012 response reuse and current duplicates", () => {
  const priorSummary = {
    seats: CONSTANTS.SEATS.map(({ model, role }) => ({
      model,
      role,
      ok: true,
      provenance: { response_id: `prior-${model}` }
    }))
  };
  const priorResponseIds = derivePriorResponseIds(priorSummary);
  assert.deepEqual(priorResponseIds, CONSTANTS.SEATS.map(({ model }) => `prior-${model}`));
  const currentPackets = CONSTANTS.SEATS.map(({ model, role }) => ({
    model,
    role,
    provenance: routedProvenance(model),
    ...(model === "agy" ? { agy_checkpoint_ref: FIXTURE_AGY_CHECKPOINT_REF } : {})
  }));
  assert.equal(validateFreshPacketProvenance(currentPackets, priorResponseIds), true);

  const reused = clone(currentPackets);
  reused[3].provenance.response_id = priorResponseIds[1];
  expectReject(() => validateFreshPacketProvenance(reused, priorResponseIds), /authz-012.*response_id/i);

  const duplicated = clone(currentPackets);
  duplicated[4].provenance.response_id = duplicated[0].provenance.response_id;
  expectReject(() => validateFreshPacketProvenance(duplicated, priorResponseIds), /duplicate.*response_id/i);
});

test("every successful packet including advisory requires a nonempty trimmed response_id", () => {
  const priorResponseIds = CONSTANTS.SEATS.map(({ model }) => `prior-${model}`);
  for (const invalid of [undefined, null, "", "   ", 42, " padded-id "]) {
    const packet = { model: "grok", role: "advisory", provenance: routedProvenance("grok") };
    if (invalid !== undefined) packet.provenance.response_id = invalid;
    else delete packet.provenance.response_id;
    expectReject(() => validateFreshPacketProvenance([packet], priorResponseIds), /nonempty trimmed.*response_id/i);
  }
});

test("successful seats require exact closed routed provider identity from fixed seat policy", () => {
  const priorResponseIds = CONSTANTS.SEATS.map(({ model }) => `prior-${model}`);
  const baseline = allSuccessfulResults();
  assert.ok(classifyPacketProvenance(baseline, priorResponseIds).results.every((result) => result.ok));

  for (const [index, seat] of CONSTANTS.SEATS.entries()) {
    for (const field of ["tool", "provider", "source", "model"]) {
      const mutated = clone(baseline);
      mutated[index].packet.provenance[field] = `wrong-${field}`;
      const classified = classifyPacketProvenance(mutated, priorResponseIds);
      assert.equal(classified.results[index].ok, false, `${seat.model} accepted wrong ${field}`);
      assert.equal(classified.results[index].validation_failure.reason_code, "INVALID_PROVIDER_IDENTITY");
    }
    const extra = clone(baseline);
    extra[index].packet.provenance.untrusted_route = "self-asserted";
    const extraClassified = classifyPacketProvenance(extra, priorResponseIds);
    assert.equal(extraClassified.results[index].ok, false, `${seat.model} accepted an extra provenance claim`);
    assert.equal(extraClassified.results[index].validation_failure.reason_code, "INVALID_PROVIDER_IDENTITY");
  }

  const swapped = clone(baseline);
  swapped[0].packet.provenance = { ...routedProvenance("codex"), response_id: "fresh-swapped-route" };
  const swappedClassified = classifyPacketProvenance(swapped, priorResponseIds);
  assert.equal(swappedClassified.results[0].ok, false);
  assert.equal(swappedClassified.results[0].validation_failure.reason_code, "INVALID_PROVIDER_IDENTITY");

  const forgedAgyId = clone(baseline);
  forgedAgyId[1].packet.provenance.response_id = "agy-" + "b".repeat(40);
  const forgedIdClassification = classifyPacketProvenance(forgedAgyId, priorResponseIds);
  assert.equal(forgedIdClassification.results[1].ok, false, "Agy accepted an ID not derived from its checkpoint ref");
  assert.equal(forgedIdClassification.results[1].validation_failure.reason_code, "INVALID_PROVIDER_IDENTITY");

  const malformedAgyRef = clone(baseline);
  malformedAgyRef[1].packet.agy_checkpoint_ref = `sha256:${"z".repeat(64)}`;
  const malformedRefClassification = classifyPacketProvenance(malformedAgyRef, priorResponseIds);
  assert.equal(malformedRefClassification.results[1].ok, false, "Agy accepted a malformed checkpoint ref");
  assert.equal(malformedRefClassification.results[1].validation_failure.reason_code, "INVALID_PROVIDER_IDENTITY");
});

test("provisional direct-HTTPS preload uses an explicit timeout-free agent and activates in a child", () => {
  assert.doesNotMatch(
    PROVIDER_FETCH_PRELOAD_SOURCE,
    /setTimeout|setInterval|new\s+AbortController|\.setTimeout\s*\(|\.destroy\s*\(|\btimeout\s*:\s*[1-9]/
  );
  const baseline = createProviderTransportProfile({});
  const hostileAmbient = createProviderTransportProfile({
    AI_PEER_LONG_TIMEOUT: "1",
    AI_PEER_TIMEOUT_MS: "1",
    NODE_OPTIONS: "--require=/hostile.cjs",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    OPENAI_BASE_URL: "https://hostile.invalid"
  });
  assert.deepEqual(hostileAmbient, baseline);
  assert.equal(canonicalRef(hostileAmbient), canonicalRef(baseline));
  assert.equal(baseline.schema_version, "telos.local-provider-transport-evidence.provisional.v1");
  assert.equal(baseline.authoritative, false);
  assert.equal(baseline.grants_authority, false);
  assert.deepEqual(baseline.host_platform_policy, {
    supported_platform: "linux",
    native_linux_only: true,
    win32_behavior: "fail-closed-before-preflight-or-live-provider-execution",
    registry_hydration: "unreachable-by-policy"
  });
  assert.match(baseline.execution_nonclaims.join("\n"), /does not claim a closed Windows child/i);
  assert.throws(() => runnerModule.assertPinnedTransportPlatform("win32"), /native Linux|linux-only/i);
  assert.deepEqual(baseline.agent, {
    implementation: "node:https.Agent",
    options: { keepAlive: false, timeout: 0 },
    uses_global_agent: false,
    meaning: "No client-set elapsed cap for current direct HTTPS POST calls."
  });
  assert.deepEqual(baseline.support_constraints, {
    protocol: "https:",
    method: "POST",
    request_input: "string-or-URL-only",
    request_body: "buffered-string-buffer-arraybuffer-view-or-arraybuffer",
    response_body: "fully-buffered-before-Response",
    redirects: "unsupported-fail-closed",
    request_object_input: "unsupported-fail-closed",
    abort_semantics: "unsupported-fail-closed",
    fetch_semantics_claimed: false
  });
  assert.deepEqual(baseline.child_args.slice(0, 2), ["--import", baseline.preload_data_url]);
  assert.equal(Object.isFrozen(baseline.child_args), true);
  assert.throws(() => { baseline.child_args[1] = "data:text/javascript,hostile"; }, /read only|Cannot assign/i);
  assert.throws(
    () => Object.defineProperty(baseline, "child_args", { value: ["hostile"] }),
    /redefine|configurable/i
  );
  const probe = runNode([
    ...baseline.child_args.slice(0, 2),
    "--input-type=module",
    "--eval",
    "const {globalAgent}=await import('node:https');const agent=globalThis.__TELOS_AUTHZ013_HTTPS_AGENT__;console.log(JSON.stringify({active:globalThis.__TELOS_AUTHZ013_HTTPS_FETCH__===true,name:globalThis.fetch.name,explicit:agent!==globalAgent,timeout:agent.options.timeout,globalTimeout:globalAgent.options.timeout}))"
  ]);
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.deepEqual(JSON.parse(probe.stdout), {
    active: true,
    name: "telosHttpsFetch",
    explicit: true,
    timeout: 0,
    globalTimeout: 5000
  });
});

test("held provider graph is pinned to the reachable reviewed source commit and closed over exact identities", () => {
  const held = captureHeldProviderSourceGraph();
  assert.equal(held.module_source_commit, CONSTANTS.PLAN_IDENTITY.commit);
  assert.equal(held.object_format, "sha1");
  assert.equal(held.entries.length, 15);
  assert.equal(new Set(held.entries.map((entry) => entry.path)).size, 15);
  for (const entry of held.entries) {
    assert.match(entry.blob, /^git:[0-9a-f]{40}$/);
    assert.match(entry.raw_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.equal(entry.source.length, entry.byte_length);
    assert.equal(`sha256:${createHash("sha256").update(entry.source).digest("hex")}`, entry.raw_sha256);
    assert.equal(
      `git:${execFileSync("git", ["-C", ROOT, "rev-parse", `${CONSTANTS.PLAN_IDENTITY.commit.slice(4)}:${entry.path}`], { encoding: "utf8" }).trim()}`,
      entry.blob
    );
  }
  const profile = createProviderTransportProfile();
  assert.equal(profile.source_graph.graph_ref, held.graph_ref);
  assert.deepEqual(profile.source_graph.entries, held.entries.map(({ source: _source, ...entry }) => entry));
  assert.equal(profile.hook_policy.mode, "node-v24-synchronous-register-hooks-closed-held-source-map");
  assert.match(profile.preload_raw_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.match(profile.fetch_adapter_raw_sha256, /^sha256:[0-9a-f]{64}$/);
  assert.ok(profile.preload_data_url.length < 120 * 1024, "child bootstrap exceeded conservative argv budget");
  assert.deepEqual(profile.child_argv_shape, ["--import", "<held-child-bootstrap-data-url>", "<held-server-entry-path>"]);
  const corruptedEntries = held.entries.map((entry, index) => index === 0
    ? { ...entry, source: Buffer.concat([entry.source, Buffer.from("\nimport './unlisted.mjs';\n")]) }
    : entry);
  assert.throws(
    () => installHeldProviderModuleHooks({ ...held, entries: corruptedEntries }),
    /held provider source bytes drifted|identity drifted/i
  );
});

test("parent held-source hooks ignore atomic replacement of every captured working-tree path", async () => {
  const held = captureHeldProviderSourceGraph();
  const callerHeld = copiedHeldGraph(held);
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "authz-013-held-parent-"));
  let hooks;
  try {
    for (const entry of held.entries) {
      const target = path.join(fixtureRoot, entry.path);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, entry.source, { flag: "wx" });
    }
    hooks = installHeldProviderModuleHooks(callerHeld, { root: fixtureRoot });
    for (const entry of callerHeld.entries) entry.source.fill(0);
    for (const entry of held.entries) {
      const target = path.join(fixtureRoot, entry.path);
      const replacement = `${target}.replacement`;
      writeFileSync(replacement, `throw new Error(${JSON.stringify(`mutable path executed: ${entry.path}`)});\n`, { flag: "wx" });
      renameSync(replacement, target);
    }
    const [agyLib, council, gate, mcpClient] = await Promise.all([
      hooks.importRoot("connectors/ai-peer-mcp/lib.mjs"),
      hooks.importRoot("build-gate/council.mjs"),
      hooks.importRoot("build-gate/gate.mjs"),
      hooks.importRoot("breakout/mcp_client.mjs")
    ]);
    assert.equal(typeof agyLib.agyAttestation, "function");
    assert.equal(typeof council.runCouncil, "function");
    assert.equal(typeof gate.validateRecords, "function");
    assert.equal(typeof mcpClient.createMcpClient, "function");
    hooks.assertAllParentSourcesLoaded();
  } finally {
    hooks?.deregister();
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("child bootstrap executes held server and lib bytes after both paths are atomically replaced", () => {
  const held = captureHeldProviderSourceGraph();
  const callerHeld = copiedHeldGraph(held);
  const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "authz-013-held-child-"));
  try {
    for (const relative of ["connectors/ai-peer-mcp/server.mjs", "connectors/ai-peer-mcp/lib.mjs"]) {
      const entry = held.entries.find(({ path: entryPath }) => entryPath === relative);
      const target = path.join(fixtureRoot, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, entry.source, { flag: "wx" });
    }
    const execution = createHeldProviderChildBootstrap(callerHeld, { root: fixtureRoot });
    for (const entry of callerHeld.entries) entry.source.fill(0);
    for (const relative of ["connectors/ai-peer-mcp/server.mjs", "connectors/ai-peer-mcp/lib.mjs"]) {
      const target = path.join(fixtureRoot, relative);
      const replacement = `${target}.replacement`;
      writeFileSync(replacement, `throw new Error(${JSON.stringify(`mutable child path executed: ${relative}`)});\n`, { flag: "wx" });
      renameSync(replacement, target);
    }
    const probe = spawnSync(process.execPath, execution.child_args, {
      cwd: fixtureRoot,
      encoding: "utf8",
      input: "",
      env: { ...process.env, NODE_OPTIONS: "" },
      timeout: 5000
    });
    assert.equal(probe.status, 0, probe.stderr || probe.stdout);
    assert.doesNotMatch(probe.stderr, /mutable child path executed/);
    assert.match(execution.bootstrap_raw_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(execution.bootstrap_source, /function validateHeldChildSource/);
    assert.match(execution.bootstrap_source, /createHash\("sha1"\)/);
    assert.match(
      execution.bootstrap_source,
      /load\(url,[\s\S]*validateHeldChildSource\(entry\)[\s\S]*Buffer\.from\(entry\.source\)/
    );
    assert.equal(
      createHeldProviderChildBootstrap(held).bootstrap_raw_sha256,
      createProviderTransportProfile().preload_raw_sha256
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("provider child environment is closed, hostile ambient is stripped, and secret values are never profiled", () => {
  const ambient = {
    ANTHROPIC_API_KEY: "anthropic-secret",
    OPENAI_API_KEY: "openai-secret",
    XAI_API_KEY: "",
    GEMINI_API_KEY: "",
    OPENAI_BASE_URL: "https://hostile.invalid",
    XAI_BASE_URL: "https://hostile.invalid",
    GEMINI_BASE_URL: "https://hostile.invalid",
    NODE_OPTIONS: "--require=/hostile.cjs",
    NODE_EXTRA_CA_CERTS: "/hostile.pem",
    NODE_TLS_REJECT_UNAUTHORIZED: "0",
    HTTPS_PROXY: "https://hostile.invalid",
    ANTHROPIC_VERSION: "hostile-version"
  };
  const profile = createProviderTransportProfile(ambient);
  const renderedProfile = JSON.stringify(profile);
  for (const secret of ["anthropic-secret", "openai-secret"]) {
    assert.equal(renderedProfile.includes(secret), false);
  }
  assert.deepEqual(profile.environment.credential_variable_names, [
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "XAI_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY"
  ]);
  assert.equal(profile.environment.inherits_parent_environment, false);
  assert.deepEqual(profile.environment.credential_presence_policy.grok, {
    optional: "XAI_API_KEY",
    role: "advisory",
    missing_behavior: "per-seat-failure-non-veto"
  });
  assert.deepEqual(profile.environment.credential_presence_policy.gemini, {
    optional: "GEMINI_API_KEY",
    role: "advisory",
    missing_behavior: "per-seat-failure-non-veto"
  });
  const childEnvironment = createProviderChildEnvironment(ambient);
  assert.deepEqual(Object.keys(childEnvironment).sort(), [
    ...Object.keys(profile.environment.exact_non_secret_values),
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY"
  ].sort());
  for (const hostileName of ["OPENAI_BASE_URL", "XAI_BASE_URL", "GEMINI_BASE_URL", "NODE_OPTIONS", "NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "HTTPS_PROXY"]) {
    assert.equal(hostileName in childEnvironment, false, `${hostileName} escaped the closed environment`);
  }
  let spawned;
  const transport = spawnProviderMcpTransport({
    command: "/usr/bin/node",
    args: ["--import", "data:text/javascript,", "/server.mjs"],
    childEnvironment,
    spawn(command, args, options) {
      spawned = { command, args, options };
      return {
        stdin: { write() {} },
        stdout: { on() {} },
        kill() {}
      };
    },
    createClient() {
      return { callTool() {} };
    }
  });
  assert.deepEqual(spawned.options.env, childEnvironment);
  assert.deepEqual(spawned.options.stdio, ["pipe", "pipe", "ignore"]);
  assert.equal("PATH" in spawned.options.env, false);
  assert.equal(transport.client.callTool instanceof Function, true);
  let killedAfterClientFailure = false;
  assert.throws(() => spawnProviderMcpTransport({
    command: "/usr/bin/node",
    args: ["/server.mjs"],
    childEnvironment,
    spawn() {
      return {
        stdin: { write() {} },
        stdout: { on() {} },
        kill() { killedAfterClientFailure = true; }
      };
    },
    createClient() { throw new Error("client construction failed"); }
  }), /client construction failed/);
  assert.equal(killedAfterClientFailure, true);
  const withOptionalAdvisory = createProviderChildEnvironment({
    ANTHROPIC_AUTH_TOKEN: "token",
    OPENAI_API_KEY: "openai",
    XAI_API_KEY: "xai",
    GEMINI_API_KEY: "gemini"
  });
  assert.equal(withOptionalAdvisory.XAI_API_KEY, "xai");
  assert.equal(withOptionalAdvisory.GEMINI_API_KEY, "gemini");
  assert.throws(
    () => createProviderChildEnvironment({ OPENAI_API_KEY: "o" }),
    /ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY.*before spawn/i
  );
  assert.throws(
    () => createProviderChildEnvironment({ ANTHROPIC_API_KEY: "a" }),
    /OPENAI_API_KEY.*before spawn/i
  );
});

test("preload fails closed on unsupported fetch semantics before any HTTPS request", () => {
  const profile = createProviderTransportProfile();
  const probe = runNode([
    ...profile.child_args.slice(0, 2),
    "--input-type=module",
    "--eval",
    "const cases=[()=>fetch('https://example.invalid',{method:'GET'}),()=>fetch(new Request('https://example.invalid',{method:'POST'}),{body:'x'}),()=>fetch('https://example.invalid',{method:'POST',body:'x',redirect:'follow'}),()=>fetch('https://example.invalid',{method:'POST',body:'x',signal:new AbortController().signal})];console.log(JSON.stringify(await Promise.all(cases.map(async(fn)=>{try{await fn();return 'accepted'}catch(e){return e.message}}))))"
  ]);
  assert.equal(probe.status, 0, probe.stderr || probe.stdout);
  assert.deepEqual(JSON.parse(probe.stdout), [
    "TELOS provider transport supports direct HTTPS POST only",
    "TELOS provider transport does not support Request inputs",
    "TELOS provider transport does not support redirect semantics",
    "TELOS provider transport does not support AbortSignal semantics"
  ]);
});

test("Agy checkpoint scope binds the exact captured plan and design identities", () => {
  const reviewInputs = loadExactReviewInputs();
  const binding = createAgyReviewBinding(reviewInputs);
  assert.equal(binding.schema_version, "telos.local-agy-review-input-binding.provisional.v1");
  assert.equal(binding.authoritative, false);
  assert.equal(binding.grants_authority, false);
  assert.equal(binding.candidate_ref, CONSTANTS.EXPECTED_PLAN_REF);
  assert.deepEqual(binding.plan, {
    path: CONSTANTS.PLAN_PATH,
    raw_sha256: CONSTANTS.PLAN_IDENTITY.raw_sha256,
    text: reviewInputs.plan_text
  });
  assert.deepEqual(binding.design, {
    path: CONSTANTS.SPEC_PATH,
    raw_sha256: CONSTANTS.DESIGN_RAW_SHA256,
    text: reviewInputs.spec_text
  });
  const bareCheckpoint = agyCheckpoint({
    phase: "merge-gate",
    scope: canonicalize(binding),
    protected_path_check: "pass"
  });
  const responseId = `agy-${canonicalRef(bareCheckpoint).slice("sha256:".length, "sha256:".length + 40)}`;
  const checkpoint = { ...bareCheckpoint, provenance: agyAttestation(bareCheckpoint) };
  assert.deepEqual(validateAgyCheckpointBinding(checkpoint, binding, { attest: agyAttestation }), {
    agy_review_input_ref: canonicalRef(binding),
    agy_checkpoint_ref: canonicalRef(bareCheckpoint),
    response_id: responseId
  });
  const results = allSuccessfulResults();
  results[1].packet.agy_review_input_ref = canonicalRef(binding);
  results[1].packet.agy_checkpoint_ref = canonicalRef(bareCheckpoint);
  const summary = buildSummary({
    results,
    gate: gateFixture(),
    agyReviewInputRef: canonicalRef(binding),
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.agy_review_input_ref, canonicalRef(binding));
  assert.equal(summary.seats[1].agy_checkpoint_ref, canonicalRef(bareCheckpoint));
  assert.throws(
    () => validateAgyCheckpointBinding({ ...checkpoint, scope: checkpoint.scope.replace(CONSTANTS.EXPECTED_PLAN_REF, CONSTANTS.PRIOR_CANDIDATE_REF) }, binding, { attest: agyAttestation }),
    /Agy.*exact review inputs/i
  );
  for (const field of ["provider", "model", "answered_at", "engine_version", "source", "attestation", "response_id", "extra"]) {
    const mutated = clone(checkpoint);
    mutated.provenance[field] = field === "answered_at" ? "2026-07-22T00:00:00.000Z" : `mutated-${field}`;
    assert.throws(
      () => validateAgyCheckpointBinding(mutated, binding, { attest: agyAttestation }),
      /full local deterministic attestation/i,
      `mutated ${field} was accepted`
    );
  }
  for (const invalidBare of [
    { ...bareCheckpoint, phase_gate_status: false },
    { ...bareCheckpoint, phase_gate_status: "unknown" },
    Object.fromEntries(Object.entries(bareCheckpoint).filter(([key]) => key !== "phase_gate_status")),
    { decision: "approve", confidence: "high", scope: canonicalize(binding) },
    { ...bareCheckpoint, unexpected: "field" }
  ]) {
    assert.throws(
      () => validateAgyCheckpointBinding(
        { ...invalidBare, provenance: agyAttestation(invalidBare) },
        binding,
        { attest: agyAttestation }
      ),
      /Agy checkpoint.*exact|Agy checkpoint schema/i
    );
  }
  assert.throws(() => validateAgyCheckpointBinding(checkpoint, binding), /exact attester is required/i);
});

test("durable phase converts early controller failures and propagates summary write failure", async () => {
  for (const stage of ["provider-import", "random-signer", "spawn", "empty-gate"]) {
    const persisted = [];
    const result = await runDurableAuthorizationPhase({
      async execute() { throw new Error(stage); },
      async persistFailure(error) {
        persisted.push(error.message);
        return `summary:${error.message}`;
      }
    });
    assert.equal(result, `summary:${stage}`);
    assert.deepEqual(persisted, [stage]);
  }
  await assert.rejects(
    runDurableAuthorizationPhase({
      async execute() { throw new Error("import failed"); },
      async persistFailure() { throw new Error("summary write failed"); }
    }),
    /summary write failed/
  );
});

test("atomic JSON publication is exclusive, fully durable before visibility, and leaves no truncated final", () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-atomic-"));
  try {
    const target = path.join(outputDirectory, "claude.json");
    const pending = path.join(outputDirectory, ".authz-013-claude.json.pending");
    publishAtomicExclusiveJson(outputDirectory, "claude.json", { complete: true });
    assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { complete: true });
    assert.equal(existsSync(pending), false);
    assert.throws(
      () => publishAtomicExclusiveJson(outputDirectory, "claude.json", { replacement: true }),
      /already exists|EEXIST|immutable/i
    );
    assert.deepEqual(JSON.parse(readFileSync(target, "utf8")), { complete: true });

    let writes = 0;
    const failingFs = {
      ...fs,
      writeSync(fd, bytes, offset, length) {
        writes += 1;
        if (writes === 1) return fs.writeSync(fd, bytes, offset, Math.min(7, length));
        throw new Error("injected partial write failure");
      }
    };
    assert.throws(
      () => publishAtomicExclusiveJson(outputDirectory, "agy.json", { complete: true }, { fsOps: failingFs }),
      /injected partial write failure/
    );
    assert.equal(existsSync(path.join(outputDirectory, "agy.json")), false);
    assert.equal(existsSync(path.join(outputDirectory, ".authz-013-agy.json.pending")), true);

    let directoryFd = null;
    const rejectingDirectorySyncFs = {
      ...fs,
      openSync(target, flags, mode) {
        const fd = fs.openSync(target, flags, mode);
        if (target === outputDirectory) directoryFd = fd;
        return fd;
      },
      fsyncSync(fd) {
        if (fd === directoryFd) {
          const error = new Error("injected unsupported directory sync");
          error.code = "EINVAL";
          throw error;
        }
        return fs.fsyncSync(fd);
      }
    };
    assert.throws(
      () => publishAtomicExclusiveJson(outputDirectory, "codex.json", { complete: true }, { fsOps: rejectingDirectorySyncFs }),
      /injected unsupported directory sync/
    );
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("durable seat files atomically bind each packet to its exact decision node and root", async () => {
  const { summary, files } = await runLifecycleFixture({ failurePoint: "durable-envelope-success" });
  const expectedEnvelopeKeys = [
    "authorization_id", "authoritative", "build_id", "candidate_ref", "compact_authority_claimed",
    "decision_node", "failure", "grants_authority", "new_root", "packet", "policy_ref",
    "provider_transport_ref", "revision_lineage_ref", "schema_version", "seat", "status"
  ].sort();
  for (const seat of CONSTANTS.SEATS) {
    const filename = `${seat.model}.json`;
    const envelope = JSON.parse(files[filename].toString("utf8"));
    assert.equal(
      runnerModule.validateDurableDecisionEnvelope(envelope, filename, fixtureSignatureOptions(seat.model)),
      true
    );
    assert.deepEqual(Object.keys(envelope).sort(), expectedEnvelopeKeys);
    assert.equal(envelope.schema_version, "telos.authz-013-provisional-durable-decision-envelope.v1");
    assert.equal(envelope.status, "PROVISIONAL_NON_AUTHORITATIVE");
    assert.equal(envelope.authoritative, false);
    assert.equal(envelope.grants_authority, false);
    assert.equal(envelope.compact_authority_claimed, false);
    assert.equal(envelope.policy_ref, canonicalRef(CONSTANTS.DECISION_CHAIN_POLICY));
    assert.deepEqual(envelope.seat, seat);
    assert.equal(envelope.packet.model, seat.model);
    assert.equal(envelope.failure, null);
    assert.equal(envelope.new_root, envelope.decision_node.new_root);
    assert.deepEqual(
      envelope.decision_node,
      summary.decision_chain.nodes.find((node) => node.subject?.model === seat.model)
    );
  }
});

test("accepted envelopes require a closed packet and the exact seat HMAC secret", async () => {
  const { files } = await runLifecycleFixture({ failurePoint: "durable-envelope-signature-contract" });
  const original = JSON.parse(files["claude.json"].toString("utf8"));
  const options = fixtureSignatureOptions("claude");

  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(original, "claude.json"),
    /signature.*secret|nonempty.*secret|HMAC.*secret/i
  );
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      original,
      "claude.json",
      fixtureSignatureOptions("codex")
    ),
    /signature|HMAC/i
  );

  const missingSignature = clone(original);
  delete missingSignature.packet.signature;
  rehashAcceptedEnvelopePacket(missingSignature, "claude.json", { resign: false });
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(missingSignature, "claude.json", options),
    /signature|HMAC/i
  );

  const badHmac = clone(original);
  badHmac.packet.signature.value = "0".repeat(64);
  rehashAcceptedEnvelopePacket(badHmac, "claude.json", { resign: false });
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(badHmac, "claude.json", options),
    /signature|HMAC/i
  );

  const signatureSchemaDrift = clone(original);
  signatureSchemaDrift.packet.signature.untrusted = true;
  rehashAcceptedEnvelopePacket(signatureSchemaDrift, "claude.json", { resign: false });
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(signatureSchemaDrift, "claude.json", options),
    /signature.*schema|exact.*signature|closed.*signature/i
  );

  for (const mutate of [
    (packet) => { packet.grants_authority = true; },
    (packet) => { packet.confidence = "certain"; },
    (packet) => { packet.required_edits = [7]; },
    (packet) => { packet.hard_stops = [null]; },
    (packet) => { packet.docs_reviewed = [CONSTANTS.SPEC_PATH, CONSTANTS.PLAN_PATH]; },
    (packet) => { packet.timestamp = "today"; },
    (packet) => { packet.rationale = 7; }
  ]) {
    const forged = clone(original);
    mutate(forged.packet);
    rehashAcceptedEnvelopePacket(forged, "claude.json");
    assert.throws(
      () => runnerModule.validateDurableDecisionEnvelope(forged, "claude.json", options),
      /packet.*schema|exact.*packet|closed.*packet|types|timestamp|docs/i
    );
  }

  const claudeWithAgyFields = clone(original);
  claudeWithAgyFields.packet.agy_checkpoint_ref = FIXTURE_AGY_CHECKPOINT_REF;
  claudeWithAgyFields.packet.response_id = claudeWithAgyFields.packet.provenance.response_id;
  rehashAcceptedEnvelopePacket(claudeWithAgyFields, "claude.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      claudeWithAgyFields,
      "claude.json",
      options
    ),
    /packet.*schema|exact.*packet|closed.*packet/i
  );

  const agyEnvelope = JSON.parse(files["agy.json"].toString("utf8"));
  agyEnvelope.packet.rationale = "remote-only field on Agy";
  rehashAcceptedEnvelopePacket(agyEnvelope, "agy.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      agyEnvelope,
      "agy.json",
      fixtureSignatureOptions("agy")
    ),
    /packet.*schema|exact.*packet|closed.*packet/i
  );

  const agyResponseMismatch = JSON.parse(files["agy.json"].toString("utf8"));
  agyResponseMismatch.packet.response_id = "agy-top-level-mismatch";
  rehashAcceptedEnvelopePacket(agyResponseMismatch, "agy.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      agyResponseMismatch,
      "agy.json",
      fixtureSignatureOptions("agy")
    ),
    /response_id|packet.*schema|exact.*packet|closed.*packet/i
  );

  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-signature-publication-"));
  try {
    const filename = "claude.json";
    const target = path.join(outputDirectory, filename);
    writeFileSync(target, jsonBytes(original));
    const receipt = { path: target, raw_sha256: rawJsonSha256(original) };
    assert.throws(
      () => runnerModule.validateDurableDecisionPublication(
        receipt,
        original,
        outputDirectory,
        filename
      ),
      /signature.*secret|nonempty.*secret|HMAC.*secret/i
    );
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("accepted durable envelopes reject hash-valid packet/node decision disagreement", async () => {
  const { files } = await runLifecycleFixture({ failurePoint: "durable-envelope-semantic-tamper" });
  const envelope = JSON.parse(files["claude.json"].toString("utf8"));
  envelope.packet.decision = envelope.decision_node.outcome.decision === "approve" ? "revise" : "approve";
  rehashAcceptedEnvelopePacket(envelope, "claude.json");

  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      envelope,
      "claude.json",
      fixtureSignatureOptions("claude")
    ),
    /packet.*decision|decision.*packet|semantic.*correspond/i
  );
});

test("accepted durable envelopes bind candidate, transport lineage, and routed provider identity", async () => {
  const { files } = await runLifecycleFixture({ failurePoint: "durable-envelope-nested-binding" });
  const original = JSON.parse(files["claude.json"].toString("utf8"));

  const wrongProposal = clone(original);
  wrongProposal.packet.proposal_ref = `sha256:${"0".repeat(64)}`;
  rehashAcceptedEnvelopePacket(wrongProposal, "claude.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      wrongProposal,
      "claude.json",
      fixtureSignatureOptions("claude")
    ),
    /proposal|candidate|packet.*binding/i
  );

  const wrongProvider = clone(original);
  wrongProvider.packet.provenance.provider = "unrouted-provider";
  rehashAcceptedEnvelopePacket(wrongProvider, "claude.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      wrongProvider,
      "claude.json",
      fixtureSignatureOptions("claude")
    ),
    /routed.*provider|provider.*identity|provenance/i
  );

  const wrongLineageObject = clone(original);
  wrongLineageObject.packet.revision_lineage.candidate_ref = `sha256:${"1".repeat(64)}`;
  rehashAcceptedEnvelopePacket(wrongLineageObject, "claude.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      wrongLineageObject,
      "claude.json",
      fixtureSignatureOptions("claude")
    ),
    /lineage|revision.*ref|packet.*binding/i
  );

  const wrongTransportObject = clone(original);
  wrongTransportObject.packet.provider_transport.preload_raw_sha256 = `sha256:${"2".repeat(64)}`;
  rehashAcceptedEnvelopePacket(wrongTransportObject, "claude.json");
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      wrongTransportObject,
      "claude.json",
      fixtureSignatureOptions("claude")
    ),
    /transport|preload|packet.*binding/i
  );

  const unsigned = await runLifecycleFixture({
    failurePoint: "durable-envelope-failure-ref-binding",
    unsignedModel: "grok"
  });
  const wrongFailureRefs = JSON.parse(unsigned.files["grok.json"].toString("utf8"));
  wrongFailureRefs.revision_lineage_ref = `sha256:${"3".repeat(64)}`;
  wrongFailureRefs.provider_transport_ref = `sha256:${"4".repeat(64)}`;
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(wrongFailureRefs, "grok.json"),
    /lineage|transport|seed.*ref|exact.*ref|closed provisional schema/i
  );
});

test("seat envelope filename fixes its exact serial sequence", async () => {
  const { files } = await runLifecycleFixture({ failurePoint: "durable-envelope-sequence-tamper" });
  const envelope = JSON.parse(files["claude.json"].toString("utf8"));
  envelope.decision_node.sequence = 4;
  rehashStandaloneEnvelopeNode(envelope);

  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(
      envelope,
      "claude.json",
      fixtureSignatureOptions("claude")
    ),
    /sequence|serial|fixed.*order/i
  );
});

test("durable publication validation reads the exact regular target and rejects forged receipts", async () => {
  const { files } = await runLifecycleFixture({ failurePoint: "durable-envelope-readback" });
  const envelope = JSON.parse(files["claude.json"].toString("utf8"));
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-publication-readback-"));
  const wrongDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-publication-wrong-"));
  const filename = "claude.json";
  const expectedPath = path.join(outputDirectory, filename);
  const wrongPath = path.join(wrongDirectory, filename);
  const receipt = { path: expectedPath, raw_sha256: rawJsonSha256(envelope) };
  try {
    assert.throws(
      () => runnerModule.validateDurableDecisionPublication(
        receipt,
        envelope,
        outputDirectory,
        filename,
        fixtureSignatureOptions("claude")
      ),
      /missing|regular|target|read-back|receipt/i
    );

    writeFileSync(expectedPath, jsonBytes(envelope));
    writeFileSync(wrongPath, jsonBytes(envelope));
    assert.throws(
      () => runnerModule.validateDurableDecisionPublication(
        { ...receipt, path: wrongPath },
        envelope,
        outputDirectory,
        filename,
        fixtureSignatureOptions("claude")
      ),
      /exact.*path|path.*drift|receipt/i
    );

    const tampered = clone(envelope);
    tampered.packet.rationale = "tampered after publication";
    writeFileSync(expectedPath, jsonBytes(tampered));
    assert.throws(
      () => runnerModule.validateDurableDecisionPublication(
        receipt,
        envelope,
        outputDirectory,
        filename,
        fixtureSignatureOptions("claude")
      ),
      /bytes|hash|read-back|envelope.*drift/i
    );
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
    rmSync(wrongDirectory, { recursive: true, force: true });
  }
});

test("visible complete envelope without a validated receipt suppresses terminal summary", async () => {
  const secret = "provider-secret-visible-unadopted";
  let summaryAttempts = 0;
  const stopped = await runLifecycleFixture({
    failurePoint: "visible-unadopted-envelope",
    captureRunError: true,
    publishJson(directory, filename, value) {
      if (filename === "authorization-summary.json") summaryAttempts += 1;
      const publication = publishAtomicExclusiveJson(directory, filename, value);
      if (filename === "claude.json") throw new Error(`publisher failed after visibility: ${secret}`);
      return publication;
    }
  });

  assert.equal(summaryAttempts, 0);
  assert.equal(stopped.summary, null);
  assert.equal(stopped.files["authorization-summary.json"], undefined);
  assert.match(stopped.runError?.message || "", /CONTROLLER_VALIDATION_FAILED|controller validation failed/i);
  assert.equal((stopped.runError?.message || "").includes(secret), false);
  assert.equal(stopped.logs.join("\n").includes(secret), false);
  const envelope = JSON.parse(stopped.files["claude.json"].toString("utf8"));
  assert.equal(
    runnerModule.validateDurableDecisionEnvelope(envelope, "claude.json", fixtureSignatureOptions("claude")),
    true
  );
  assert.equal(envelope.decision_node.sequence, 0);
});

test("default atomic publisher post-link fsync failure leaves a safe visible-unadopted prefix", async () => {
  const secret = "post-link-fsync-secret";
  let failDirectorySync = false;
  let summaryAttempts = 0;
  const fsOps = {
    closeSync: fs.closeSync,
    fsyncSync(fd) {
      if (failDirectorySync && fs.fstatSync(fd).isDirectory()) {
        failDirectorySync = false;
        throw new Error(secret);
      }
      return fs.fsyncSync(fd);
    },
    linkSync: fs.linkSync,
    openSync: fs.openSync,
    unlinkSync: fs.unlinkSync,
    writeSync: fs.writeSync
  };
  const stopped = await runLifecycleFixture({
    failurePoint: "post-link-directory-fsync",
    captureRunError: true,
    publishJson(directory, filename, value) {
      if (filename === "authorization-summary.json") summaryAttempts += 1;
      if (filename !== "claude.json") return publishAtomicExclusiveJson(directory, filename, value);
      failDirectorySync = true;
      return publishAtomicExclusiveJson(directory, filename, value, { fsOps });
    }
  });

  assert.equal(summaryAttempts, 0);
  assert.equal(stopped.summary, null);
  assert.match(stopped.runError?.message || "", /CONTROLLER_VALIDATION_FAILED|controller validation failed/i);
  assert.equal((stopped.runError?.message || "").includes(secret), false);
  assert.deepEqual(stopped.logs, []);
  assert.deepEqual(stopped.exitCodes, []);
  const envelope = JSON.parse(stopped.files["claude.json"].toString("utf8"));
  assert.equal(
    runnerModule.validateDurableDecisionEnvelope(envelope, "claude.json", fixtureSignatureOptions("claude")),
    true
  );
  assert.ok(stopped.files[".authz-013-claude.json.pending"]);
});

test("terminal summary revalidates every adopted durable envelope before publication", async () => {
  for (const mutation of ["tamper", "delete"]) {
    let summaryAttempts = 0;
    const stopped = await runLifecycleFixture({
      failurePoint: `adopted-envelope-${mutation}`,
      captureRunError: true,
      publishJson(directory, filename, value) {
        if (filename === "authorization-summary.json") summaryAttempts += 1;
        const publication = publishAtomicExclusiveJson(directory, filename, value);
        if (filename === "gemini.json") {
          const claudePath = path.join(directory, "claude.json");
          if (mutation === "delete") {
            rmSync(claudePath, { force: true });
          } else {
            const tampered = JSON.parse(readFileSync(claudePath, "utf8"));
            tampered.packet.rationale = "tampered after validated adoption";
            writeFileSync(claudePath, jsonBytes(tampered));
          }
        }
        return publication;
      }
    });

    assert.equal(summaryAttempts, 0, `${mutation} still attempted a terminal summary`);
    assert.equal(stopped.summary, null);
    assert.equal(stopped.files["authorization-summary.json"], undefined);
    assert.match(stopped.runError?.message || "", /CONTROLLER_VALIDATION_FAILED|controller validation failed/i);
    assert.deepEqual(stopped.logs, []);
    assert.deepEqual(stopped.exitCodes, []);
  }
});

test("terminal summary claim release and success logging require exact target read-back", async () => {
  let summaryAttempts = 0;
  const stopped = await runLifecycleFixture({
    failurePoint: "forged-summary-receipt",
    captureRunError: true,
    publishJson(directory, filename, value) {
      if (filename !== "authorization-summary.json") {
        return publishAtomicExclusiveJson(directory, filename, value);
      }
      summaryAttempts += 1;
      return {
        path: path.join(directory, filename),
        raw_sha256: rawJsonSha256(value)
      };
    }
  });

  assert.equal(summaryAttempts, 1);
  assert.equal(stopped.summary, null);
  assert.equal(stopped.files["authorization-summary.json"], undefined);
  assert.ok(stopped.files[".authz-013-attempt.claim"]);
  assert.match(stopped.runError?.message || "", /CONTROLLER_VALIDATION_FAILED|publication.*validation|read-back/i);
  assert.deepEqual(stopped.logs, []);
  assert.deepEqual(stopped.exitCodes, []);
});

test("terminal summary rechecks adopted envelopes after summary read-back before release", async () => {
  let summaryAttempts = 0;
  const stopped = await runLifecycleFixture({
    failurePoint: "summary-publisher-mutates-adopted-envelope",
    captureRunError: true,
    publishJson(directory, filename, value) {
      const publication = publishAtomicExclusiveJson(directory, filename, value);
      if (filename === "authorization-summary.json") {
        summaryAttempts += 1;
        const claudePath = path.join(directory, "claude.json");
        const tampered = JSON.parse(readFileSync(claudePath, "utf8"));
        tampered.packet.rationale = "mutated synchronously during summary publication";
        writeFileSync(claudePath, jsonBytes(tampered));
      }
      return publication;
    }
  });

  assert.equal(summaryAttempts, 1);
  assert.ok(stopped.summary, "the otherwise exact summary target should remain visible");
  assert.ok(stopped.files[".authz-013-attempt.claim"]);
  assert.equal(
    stopped.runError?.message,
    "CONTROLLER_VALIDATION_FAILED: Authorization controller validation failed."
  );
  assert.deepEqual(stopped.logs, []);
  assert.deepEqual(stopped.exitCodes, []);
});

test("failed seats and generic transport deaths publish closed decision envelopes", async () => {
  const unsigned = await runLifecycleFixture({ failurePoint: "unsigned-envelope", unsignedModel: "grok" });
  const unsignedEnvelope = JSON.parse(unsigned.files["grok.json"].toString("utf8"));
  assert.equal(runnerModule.validateDurableDecisionEnvelope(unsignedEnvelope, "grok.json"), true);
  assert.equal(unsignedEnvelope.packet, null);
  assert.equal(unsignedEnvelope.failure.reason_code, "INVALID_PACKET_SIGNATURE");
  assert.equal(unsignedEnvelope.decision_node.outcome.status, "failed");

  const activeDeath = await runLifecycleFixture({ failurePoint: "required-agy" });
  const agyEnvelope = JSON.parse(activeDeath.files["agy.json"].toString("utf8"));
  assert.equal(runnerModule.validateDurableDecisionEnvelope(agyEnvelope, "agy.json"), true);
  assert.equal(agyEnvelope.packet, null);
  assert.equal(agyEnvelope.failure.reason_code, "MCP_CHILD_ERROR");
  assert.equal(agyEnvelope.decision_node.outcome.status, "transport-death");

  const betweenSeats = await runLifecycleFixture({ failurePoint: "between-required-advisory" });
  const transportEnvelope = JSON.parse(betweenSeats.files["provider-transport.json"].toString("utf8"));
  assert.equal(runnerModule.validateDurableDecisionEnvelope(transportEnvelope, "provider-transport.json"), true);
  assert.equal(transportEnvelope.seat, null);
  assert.equal(transportEnvelope.packet, null);
  assert.equal(transportEnvelope.failure.reason_code, "MCP_CHILD_ERROR");
  assert.equal(transportEnvelope.decision_node.transition, "transport");
});

test("runtime converts missing, bad, and schema-invalid signed packets to safe signature failures", async () => {
  const runs = [
    await runLifecycleFixture({
      failurePoint: "runtime-missing-packet-signature",
      signedPacketMutator({ packet, seat }) {
        if (seat.model === "claude") delete packet.signature;
        return packet;
      }
    }),
    await runLifecycleFixture({
      failurePoint: "runtime-bad-packet-hmac",
      signedPacketMutator({ packet, seat }) {
        if (seat.model === "claude") packet.signature.value = "0".repeat(64);
        return packet;
      }
    }),
    await runLifecycleFixture({
      failurePoint: "runtime-extra-authority-field",
      successfulPacketMutator({ packet, seat }) {
        if (seat.model === "claude") packet.grants_authority = true;
        return packet;
      }
    }),
    await runLifecycleFixture({
      failurePoint: "runtime-valid-hmac-signed-flag-false",
      signedFlagFalseModel: "claude"
    })
  ];

  for (const run of runs) {
    const envelope = JSON.parse(run.files["claude.json"].toString("utf8"));
    assert.equal(envelope.packet, null);
    assert.equal(envelope.failure.reason_code, "INVALID_PACKET_SIGNATURE");
    assert.equal(envelope.decision_node.outcome.status, "failed");
    const diagnostic = run.summary.validation_diagnostics.find((entry) => (
      entry.model === "claude" && entry.reason_code === "INVALID_PACKET_SIGNATURE"
    ));
    assert.ok(diagnostic);
    assert.equal(diagnostic.observed_raw_sha256, null);
    assert.equal(diagnostic.observed_response_id, null);
    assert.equal(diagnostic.advisory_content, null);
  }
});

test("ordinary-seat and transport-death failure reason classes cannot be swapped", async () => {
  const providerTransport = createProviderTransportProfile();
  const empty = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  const ref = `sha256:${"5".repeat(64)}`;
  for (const outcome of [
    { status: "failed", decision: null, reason_code: "MCP_CHILD_ERROR" },
    { status: "transport-death", decision: null, reason_code: "INVALID_PACKET_SIGNATURE" }
  ]) {
    const forged = appendUncheckedDecisionNode(empty, {
      transition: "seat",
      subject: { kind: "seat", model: "claude", role: "approver" },
      outcome,
      evidenceRefs: { failure_ref: ref }
    });
    assert.throws(
      () => runnerModule.validateProvisionalDecisionChain(forged),
      /reason.*class|ordinary.*failure|transport.*failure|reason_code/i
    );
  }

  const unsigned = await runLifecycleFixture({
    failurePoint: "ordinary-reason-class-swap",
    unsignedModel: "grok"
  });
  const ordinaryEnvelope = JSON.parse(unsigned.files["grok.json"].toString("utf8"));
  ordinaryEnvelope.failure.reason_code = "MCP_CHILD_ERROR";
  ordinaryEnvelope.failure.message = FIXTURE_SAFE_FAILURE_MESSAGES.MCP_CHILD_ERROR;
  ordinaryEnvelope.failure.terminal = false;
  ordinaryEnvelope.decision_node.outcome.reason_code = "MCP_CHILD_ERROR";
  ordinaryEnvelope.decision_node.evidence_refs.failure_ref = canonicalRef(ordinaryEnvelope.failure);
  rehashStandaloneEnvelopeNode(ordinaryEnvelope);
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(ordinaryEnvelope, "grok.json"),
    /reason.*class|ordinary.*failure|transport.*failure|reason_code/i
  );

  const activeDeath = await runLifecycleFixture({ failurePoint: "required-agy" });
  const transportEnvelope = JSON.parse(activeDeath.files["agy.json"].toString("utf8"));
  transportEnvelope.failure.reason_code = "INVALID_PACKET_SIGNATURE";
  transportEnvelope.failure.message = FIXTURE_SAFE_FAILURE_MESSAGES.INVALID_PACKET_SIGNATURE;
  transportEnvelope.failure.terminal = true;
  transportEnvelope.decision_node.outcome.reason_code = "INVALID_PACKET_SIGNATURE";
  transportEnvelope.decision_node.evidence_refs.failure_ref = canonicalRef(transportEnvelope.failure);
  rehashStandaloneEnvelopeNode(transportEnvelope);
  assert.throws(
    () => runnerModule.validateDurableDecisionEnvelope(transportEnvelope, "agy.json"),
    /reason.*class|ordinary.*failure|transport.*failure|reason_code/i
  );
});

test("post-publication crash leaves one secret-verifiable envelope with no packet-before-node gap", async () => {
  const crashed = await runLifecycleFixture({
    failurePoint: "post-envelope-crash",
    crashAfterEnvelopeModel: "claude"
  });
  assert.equal(
    crashed.runError?.message,
    "CONTROLLER_VALIDATION_FAILED: Authorization controller validation failed."
  );
  assert.equal(crashed.summary, null);
  assert.equal(crashed.files["authorization-summary.json"], undefined);
  const envelope = JSON.parse(crashed.files["claude.json"].toString("utf8"));
  assert.equal(
    runnerModule.validateDurableDecisionEnvelope(envelope, "claude.json", fixtureSignatureOptions("claude")),
    true
  );
  assert.equal(envelope.packet.model, "claude");
  assert.equal(envelope.decision_node.sequence, 0);
  assert.equal(envelope.new_root, envelope.decision_node.new_root);
  assert.equal(
    envelope.decision_node.evidence_refs.packet_raw_sha256,
    `sha256:${createHash("sha256").update(`${JSON.stringify(envelope.packet, null, 2)}\n`).digest("hex")}`
  );
});

test("provider failures are fixed, secret-free, and byte-identical across raw error text", async () => {
  const canaryA = "sk-live-CANARY-ALPHA";
  const canaryB = "token-CANARY-BETA";
  const first = await runLifecycleFixture({
    failurePoint: "raw-provider-failure",
    failedModel: "grok",
    rawFailureReason: JSON.stringify({ error: { message: `upstream reflected ${canaryA}` } })
  });
  const second = await runLifecycleFixture({
    failurePoint: "raw-provider-failure",
    failedModel: "grok",
    rawFailureReason: `HTTP 401 bearer ${canaryB}`
  });
  assert.deepEqual(first.files["grok.json"], second.files["grok.json"]);
  const firstEnvelope = JSON.parse(first.files["grok.json"].toString("utf8"));
  const secondEnvelope = JSON.parse(second.files["grok.json"].toString("utf8"));
  assert.deepEqual(firstEnvelope.failure, secondEnvelope.failure);
  assert.deepEqual(firstEnvelope.decision_node, secondEnvelope.decision_node);
  assert.equal(firstEnvelope.new_root, secondEnvelope.new_root);
  assert.equal(firstEnvelope.failure.reason_code, "SEAT_CALL_FAILED");

  const transportCanary = "api-key-CANARY-TRANSPORT";
  const activeTransport = await runLifecycleFixture({
    failurePoint: "active-gemini",
    transportErrorMessage: `socket reflected ${transportCanary}`
  });
  const closeCanary = "close-token-CANARY";
  const closeFailure = await runLifecycleFixture({
    failurePoint: "close-error-sanitized",
    closeErrorMessage: closeCanary
  });
  assert.match(closeFailure.consoleErrors.join("\n"), /provider transport close failed/i);

  const renderedCases = [first, second, activeTransport, closeFailure].map((entry) => [
    ...Object.values(entry.files).map((bytes) => bytes.toString("utf8")),
    ...entry.logs,
    ...entry.consoleErrors
  ].join("\n"));
  for (const rendered of renderedCases) {
    for (const canary of [canaryA, canaryB, transportCanary, closeCanary]) {
      assert.equal(rendered.includes(canary), false, `secret canary escaped durable/log boundary: ${canary}`);
    }
  }
});

test("signed successful packets containing active secrets fail before hashing and never persist content", async () => {
  const cases = [
    { field: "rationale", environmentName: "OPENAI_API_KEY", canary: "sk-sensitive-rationale-alpha" },
    { field: "required_edits", environmentName: "ANTHROPIC_API_KEY", canary: "sk-sensitive-edit-beta" },
    { field: "hard_stops", environmentName: "TELOS_SECRET_CLAUDE", canary: "sk-sensitive-stop-gamma" }
  ];
  const runs = [];
  for (const { field, environmentName, canary } of cases) {
    const run = await runLifecycleFixture({
      failurePoint: `sensitive-success-${field}`,
      environmentOverrides: { [environmentName]: canary },
      successfulPacketMutator({ packet, seat }) {
        if (seat.model !== "claude") return packet;
        packet[field] = field === "rationale" ? `reflected ${canary}` : [`reflected ${canary}`];
        return packet;
      }
    });
    runs.push(run);
    const envelope = JSON.parse(run.files["claude.json"].toString("utf8"));
    assert.equal(envelope.packet, null);
    assert.equal(envelope.failure.reason_code, "SENSITIVE_PACKET_CONTENT");
    assert.equal(envelope.decision_node.outcome.status, "failed");
    const diagnostic = run.summary.validation_diagnostics.find((entry) => (
      entry.model === "claude" && entry.reason_code === "SENSITIVE_PACKET_CONTENT"
    ));
    assert.ok(diagnostic);
    assert.equal(diagnostic.observed_raw_sha256, null);
    assert.equal(diagnostic.observed_response_id, null);
    assert.equal(diagnostic.advisory_content, null);
    const rendered = [
      ...Object.values(run.files).map((bytes) => bytes.toString("utf8")),
      ...run.logs,
      ...run.consoleErrors,
      run.runError?.message || ""
    ].join("\n");
    assert.equal(rendered.includes(canary), false, `active secret escaped ${field} rejection boundary`);
  }

  const stableCanary = "sk-sensitive-rationale-delta";
  const stable = await runLifecycleFixture({
    failurePoint: "sensitive-success-rationale-stable",
    environmentOverrides: { OPENAI_API_KEY: stableCanary },
    successfulPacketMutator({ packet, seat }) {
      if (seat.model === "claude") packet.rationale = `reflected ${stableCanary}`;
      return packet;
    }
  });
  assert.deepEqual(runs[0].files["claude.json"], stable.files["claude.json"]);
});

test("attempt claim admits exactly one writer and remains exclusive until terminal release", () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-claim-"));
  try {
    const claim = claimAuthorizationAttempt(outputDirectory);
    assert.equal(existsSync(path.join(outputDirectory, ".authz-013-attempt.claim")), true);
    assert.throws(() => claimAuthorizationAttempt(outputDirectory), /claim|EEXIST|already exists/i);
    claim.release();
    assert.equal(existsSync(path.join(outputDirectory, ".authz-013-attempt.claim")), false);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("live mode refuses unknown pending publication state before any provider phase", async () => {
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-orphan-"));
  try {
    writeFileSync(path.join(outputDirectory, ".authz-013-unknown.pending"), "partial", { flag: "wx" });
    const sourceReview = runDeterministicPreflight({ sourceReview: true });
    await assert.rejects(
      runLive({ ...sourceReview, live_eligible: true }, {
        outputDirectory,
        log: () => {},
        setExitCode: () => {},
        importModule: async () => { throw new Error("provider phase must not run"); }
      }),
      /pending|orphan|immutable/i
    );
    assert.deepEqual(readdirSync(outputDirectory), [".authz-013-unknown.pending"]);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("live durable phase persists exact-input and import failures without providers", async () => {
  const sourceReview = runDeterministicPreflight({ sourceReview: true });
  const livePreflight = { ...sourceReview, live_eligible: true };
  for (const failureStage of ["exact-input", "provider-import"]) {
    const outputDirectory = mkdtempSync(path.join(os.tmpdir(), `authz-013-${failureStage}-`));
    try {
      const options = { outputDirectory, log: () => {}, setExitCode: () => {} };
      options.publishJson = (directory, filename, value) => {
        assert.equal(existsSync(path.join(directory, ".authz-013-attempt.claim")), true, `claim missing before ${filename}`);
        return publishAtomicExclusiveJson(directory, filename, value);
      };
      if (failureStage === "exact-input") {
        options.readFile = () => { throw new Error("injected exact-input failure"); };
      } else {
        options.importModule = async () => { throw new Error("injected provider-import failure"); };
      }
      await runLive(livePreflight, options);
      const summary = JSON.parse(readFileSync(path.join(outputDirectory, "authorization-summary.json"), "utf8"));
      assert.equal(summary.authorized, false);
      assert.equal(summary.terminal_failure.reason_code, "CONTROLLER_VALIDATION_FAILED");
      assert.equal(summary.terminal_failure.message, "Authorization controller validation failed.");
      assert.ok(summary.seats.every((seat) => seat.state === "incomplete"));
      assert.equal(summary.seats.some((seat) => "decision" in seat), false);
      const chain = verifyDecisionChain(summary);
      assert.equal(chain.nodes.at(-1).transition, "terminal");
      assert.equal(chain.nodes.at(-1).outcome.status, "NOT_AUTHORIZED");
      assert.equal(chain.nodes.at(-1).outcome.decision_source, "controller");
      assert.equal(chain.nodes.filter((node) => node.transition === "seat").length, 0);
      const incompleteState = chain.nodes.find((node) => node.transition === "state");
      assert.equal(incompleteState?.subject.kind, "controller");
      assert.equal(incompleteState?.outcome.status, "incomplete-seats-recorded");
      assert.equal(incompleteState?.outcome.incomplete_count, 5);
      assert.equal(
        readdirSync(outputDirectory).includes("revision-lineage.json"),
        failureStage === "provider-import"
      );
      assert.equal(existsSync(path.join(outputDirectory, ".authz-013-attempt.claim")), false);
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  }
});

test("live serial council preserves completed seats when a later child dies", async () => {
  const sourceReview = runDeterministicPreflight({ sourceReview: true });
  const livePreflight = { ...sourceReview, live_eligible: true };
  const outputDirectory = mkdtempSync(path.join(os.tmpdir(), "authz-013-partial-"));
  const child = new EventEmitter();
  child.stdin = new EventEmitter();
  child.stdin.write = () => true;
  child.stdout = new EventEmitter();
  child.kill = () => true;
  let calls = 0;
  const councilModule = {
    agyApprovalPacket: () => { throw new Error("agy must not complete in this fixture"); },
    agyCheckpointArgs: () => ({}),
    liveSeatCaller: () => async () => { throw new Error("fake council owns the fixture call"); },
    async runCouncil({ seats, dossier }) {
      assert.equal(seats.length, 1, "live council must execute exactly one serial seat at a time");
      calls += 1;
      if (calls === 2) {
        queueMicrotask(() => child.emit("exit", 9, null));
        return new Promise(() => {});
      }
      const seat = seats[0];
      const packet = signPacket({
        model: seat.model,
        role: seat.role,
        decision: "approve",
        confidence: "high",
        required_edits: [],
        hard_stops: [],
        rationale: "fixture",
        provenance: routedProvenance("claude", "fresh-live-claude"),
        proposal_ref: dossier.proposal_ref,
        build_id: dossier.build_id,
        use_case: dossier.use_case,
        docs_reviewed: [CONSTANTS.PLAN_PATH, CONSTANTS.SPEC_PATH],
        timestamp: "2026-07-22T12:00:00.000Z",
        revision_lineage_ref: dossier.revision_lineage_ref,
        revision_lineage: dossier.revision_lineage,
        provider_transport_ref: dossier.provider_transport_ref,
        provider_transport: dossier.provider_transport,
        provider_preload_raw_sha256: dossier.provider_preload_raw_sha256,
        agy_review_input_ref: dossier.agy_review_input_ref
      }, FIXTURE_SEAT_SECRETS.claude);
      return [{
        model: seat.model,
        role: seat.role,
        ok: true,
        signed: true,
        packet
      }];
    }
  };
  try {
    await runLive(livePreflight, {
      outputDirectory,
      log: () => {},
      setExitCode: () => {},
      environment: {
        ANTHROPIC_API_KEY: "fixture-anthropic",
        OPENAI_API_KEY: "fixture-openai",
        TELOS_SECRET_CLAUDE: "fixture-claude-signer",
        TELOS_SECRET_AGY: "fixture-agy-signer",
        TELOS_SECRET_CODEX: "fixture-codex-signer"
      },
      importModule: async (relative) => {
        if (relative === "connectors/ai-peer-mcp/lib.mjs") return { agyAttestation };
        if (relative === "build-gate/council.mjs") return councilModule;
        if (relative === "build-gate/gate.mjs") return { validateRecords: () => gateFixture() };
        if (relative === "breakout/mcp_client.mjs") return { createMcpClient: () => ({}) };
        throw new Error(`unexpected import ${relative}`);
      },
      spawnTransport: () => ({ client: {}, child, close: () => child.kill() })
    });
    const summary = JSON.parse(readFileSync(path.join(outputDirectory, "authorization-summary.json"), "utf8"));
    assert.equal(existsSync(path.join(outputDirectory, "claude.json")), true);
    assert.equal(JSON.parse(readFileSync(path.join(outputDirectory, "claude.json"), "utf8")).packet.model, "claude");
    assert.equal(JSON.parse(readFileSync(path.join(outputDirectory, "agy.json"), "utf8")).failure.reason_code, "MCP_CHILD_EXIT");
    assert.equal(readdirSync(outputDirectory).some((name) => name.endsWith(".pending")), false);
    assert.equal(summary.terminal_failure.reason_code, "MCP_CHILD_EXIT");
    assert.deepEqual(summary.seats.map(({ model, state }) => ({ model, state })), [
      { model: "claude", state: "succeeded" },
      { model: "agy", state: "failed" },
      { model: "codex", state: "incomplete" },
      { model: "grok", state: "incomplete" },
      { model: "gemini", state: "incomplete" }
    ]);
    assert.equal(summary.seats[0].decision, "approve");
    assert.ok(summary.seats.slice(1).every((seat) => !("decision" in seat)));
    assert.equal(calls, 2);
  } finally {
    rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test("required-seat stdout EOF preserves the earlier packet and its own durable failure envelope", async () => {
  const { summary, files } = await runLifecycleFixture({ failurePoint: "required-agy" });
  assert.equal(summary.terminal_failure.reason_code, "MCP_CHILD_ERROR");
  assert.equal(summary.authorized, false);
  assert.equal(summary.seats[0].state, "succeeded");
  assert.equal(summary.seats[1].state, "failed");
  assert.ok(summary.seats.slice(2).every((seat) => seat.state === "incomplete"));
  assert.ok(files["claude.json"]);
  assert.equal(JSON.parse(files["agy.json"].toString("utf8")).failure.reason_code, "MCP_CHILD_ERROR");
});

test("transport death between required and advisory phases is a non-veto warning", async () => {
  const { summary, files, calls } = await runLifecycleFixture({ failurePoint: "between-required-advisory" });
  assert.equal(summary.terminal_failure, null);
  assert.equal(summary.authorized, true);
  assert.equal(summary.seats[0].state, "succeeded");
  assert.equal(summary.seats[1].state, "succeeded");
  assert.equal(summary.seats[2].state, "succeeded");
  assert.equal(summary.seats[3].state, "incomplete");
  assert.equal(summary.seats[4].state, "incomplete");
  assert.match(summary.gate.warnings.join("\n"), /advisory.*transport|transport.*advisory/i);
  assert.equal(calls, 3);
  assert.ok(files["codex.json"]);
  assert.ok(files["provider-transport.json"]);
  const chain = verifyDecisionChain(summary);
  assert.ok(chain.nodes.some((node) => node.transition === "transport" && node.outcome.status === "transport-death"));
  const incompleteState = chain.nodes.find((node) => node.transition === "state");
  assert.equal(incompleteState?.subject.kind, "controller");
  assert.equal(incompleteState?.outcome.status, "incomplete-seats-recorded");
  assert.equal(incompleteState?.outcome.incomplete_count, 2);
});

test("Grok-active transport death is advisory-only while required dissent still governs", async () => {
  const approved = await runLifecycleFixture({ failurePoint: "active-grok" });
  assert.equal(approved.summary.terminal_failure, null);
  assert.equal(approved.summary.authorized, true);
  assert.equal(approved.summary.seats[3].state, "failed");
  assert.equal(approved.summary.seats[4].state, "incomplete");
  assert.match(approved.summary.gate.warnings.join("\n"), /transport/i);
  assert.equal(JSON.parse(approved.files["grok.json"].toString("utf8")).packet, null);

  const dissented = await runLifecycleFixture({ failurePoint: "active-grok", codexDecision: "revise" });
  assert.equal(dissented.summary.terminal_failure, null);
  assert.equal(dissented.summary.authorized, false);
  assert.equal(dissented.summary.seats[2].decision, "revise");
});

test("Gemini-active stdout error preserves Grok and cannot veto required approval", async () => {
  const { summary, files } = await runLifecycleFixture({ failurePoint: "active-gemini" });
  assert.equal(summary.terminal_failure, null);
  assert.equal(summary.authorized, true);
  assert.equal(summary.seats[3].state, "succeeded");
  assert.equal(summary.seats[4].state, "failed");
  assert.ok(files["grok.json"]);
  assert.equal(JSON.parse(files["gemini.json"].toString("utf8")).packet, null);
});

test("transport closure after fifth durable response or during gate is recorded without fabricated failure", async () => {
  for (const failurePoint of ["after-fifth-gate", "expected-close-after-fifth"]) {
    const { summary, files, calls } = await runLifecycleFixture({ failurePoint });
    assert.equal(summary.terminal_failure, null, failurePoint);
    assert.equal(summary.authorized, true, failurePoint);
    assert.ok(summary.seats.every((seat) => seat.state === "succeeded"), failurePoint);
    assert.equal(calls, 5, failurePoint);
    assert.ok(files["gemini.json"], failurePoint);
    if (failurePoint === "after-fifth-gate") {
      assert.match(summary.gate.warnings.join("\n"), /transport/i);
    }
  }
});

test("packet publication failure never reports an unpublished seat as succeeded", async () => {
  const { summary, files } = await runLifecycleFixture({
    failurePoint: "packet-publication",
    publishJson(directory, filename, value) {
      if (filename === "agy.json") throw new Error("injected Agy packet publication failure");
      return publishAtomicExclusiveJson(directory, filename, value);
    }
  });
  assert.equal(summary.terminal_failure.reason_code, "CONTROLLER_VALIDATION_FAILED");
  assert.equal(summary.seats[0].state, "succeeded");
  assert.equal(summary.seats[1].state, "incomplete");
  assert.ok(files["claude.json"]);
  assert.equal(files["agy.json"], undefined);
});

test("unsigned completed responses are failed and never become durable accepted packets", async () => {
  const advisory = await runLifecycleFixture({ failurePoint: "unsigned-advisory", unsignedModel: "grok" });
  assert.equal(advisory.summary.authorized, true);
  assert.equal(advisory.summary.seats[3].state, "failed");
  assert.equal(JSON.parse(advisory.files["grok.json"].toString("utf8")).failure.reason_code, "INVALID_PACKET_SIGNATURE");

  const required = await runLifecycleFixture({ failurePoint: "unsigned-required", unsignedModel: "codex" });
  assert.equal(required.summary.authorized, false);
  assert.equal(required.summary.seats[2].state, "failed");
  assert.equal(JSON.parse(required.files["codex.json"].toString("utf8")).failure.reason_code, "INVALID_PACKET_SIGNATURE");
});

test("decision-chain nodes reject hash-valid nested schema drift and authority-like claims", () => {
  const providerTransport = createProviderTransportProfile();
  const empty = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  const ref = `sha256:${"1".repeat(64)}`;
  for (const mutation of [
    {
      subject: { kind: "seat", model: "claude", role: "approver", authoritative: true },
      outcome: { status: "accepted-published", decision: "approve", signed: true },
      evidenceRefs: { packet_raw_sha256: ref, publication_ref: ref }
    },
    {
      subject: { kind: "seat", model: "claude", role: "approver" },
      outcome: { status: "accepted-published", decision: "approve", signed: true, grants_authority: true },
      evidenceRefs: { packet_raw_sha256: ref, publication_ref: ref }
    },
    {
      subject: { kind: "seat", model: "claude", role: "approver" },
      outcome: { status: "accepted-published", decision: "approve", signed: true },
      evidenceRefs: { packet_raw_sha256: ref, publication_ref: ref, untrusted_ref: ref }
    }
  ]) {
    assert.throws(
      () => runnerModule.appendProvisionalDecisionNode(empty, { transition: "seat", ...mutation }),
      /exact closed|schema|evidence/i
    );
  }
});

test("exported decision-chain validator enforces the fixed serial transition state machine", () => {
  const providerTransport = createProviderTransportProfile();
  const empty = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  const ref = `sha256:${"2".repeat(64)}`;
  const seatNode = (chain, model, role, status = "failed") => appendUncheckedDecisionNode(chain, {
    transition: "seat",
    subject: { kind: "seat", model, role },
    outcome: status === "transport-death"
      ? { status, decision: null, reason_code: "MCP_CHILD_ERROR" }
      : { status, decision: null, reason_code: "SEAT_CALL_FAILED" },
    evidenceRefs: { failure_ref: ref }
  });
  const transportNode = (chain) => appendUncheckedDecisionNode(chain, {
    transition: "transport",
    subject: { kind: "provider-transport" },
    outcome: { status: "transport-death", reason_code: "MCP_CHILD_ERROR" },
    evidenceRefs: { failure_ref: ref }
  });
  const stateNode = (chain, incompleteCount) => appendUncheckedDecisionNode(chain, {
    transition: "state",
    subject: { kind: "controller", authorization_id: CONSTANTS.AUTHORIZATION_ID },
    outcome: { status: "incomplete-seats-recorded", incomplete_count: incompleteCount },
    evidenceRefs: { incomplete_seats_ref: ref }
  });

  const claudePrefix = seatNode(empty, "claude", "approver");
  assert.equal(runnerModule.validateProvisionalDecisionChain(claudePrefix), true);
  const unfinishedAgyDeath = seatNode(claudePrefix, "agy", "approver", "transport-death");
  assert.equal(runnerModule.validateProvisionalDecisionChain(unfinishedAgyDeath), true);

  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(seatNode(empty, "codex", "approver")),
    /fixed.*prefix|expected.*claude|seat.*order/i
  );
  const duplicateDeath = transportNode(transportNode(claudePrefix));
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(duplicateDeath),
    /single.*transport|duplicate.*death|after.*death/i
  );
  const continuedAfterDeath = seatNode(unfinishedAgyDeath, "codex", "approver");
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(continuedAfterDeath),
    /after.*death|provider.*transition|terminal.*transport/i
  );
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(stateNode(claudePrefix, 5)),
    /incomplete.*count|remaining.*seat|state.*drift/i
  );
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(stateNode(stateNode(empty, 5), 5)),
    /duplicate.*state|at most one.*state|after.*state/i
  );
});

test("exported decision-chain validator enforces exact terminal combinations", () => {
  const providerTransport = createProviderTransportProfile();
  const empty = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  const ref = `sha256:${"3".repeat(64)}`;
  const forged = appendUncheckedDecisionNode(empty, {
    transition: "terminal",
    subject: { kind: "authorization", authorization_id: CONSTANTS.AUTHORIZATION_ID },
    outcome: {
      status: "AUTHORIZED",
      decision_source: "controller",
      next_action: "return-to-daedalus"
    },
    evidenceRefs: {
      gate_projection_ref: ref,
      results_ref: ref,
      validation_diagnostics_ref: ref
    }
  });
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(forged),
    /terminal.*combination|AUTHORIZED.*gate|controller.*failure/i
  );
});

test("AUTHORIZED requires the exact accepted approving required trio while advisory transport death stays non-veto", () => {
  const providerTransport = createProviderTransportProfile();
  const empty = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  const ref = `sha256:${"4".repeat(64)}`;
  const seatNode = (chain, model, role, outcome) => appendUncheckedDecisionNode(chain, {
    transition: "seat",
    subject: { kind: "seat", model, role },
    outcome,
    evidenceRefs: outcome.status === "accepted-published"
      ? { packet_raw_sha256: ref, publication_ref: ref }
      : { failure_ref: ref }
  });
  const stateNode = (chain, incompleteCount) => appendUncheckedDecisionNode(chain, {
    transition: "state",
    subject: { kind: "controller", authorization_id: CONSTANTS.AUTHORIZATION_ID },
    outcome: { status: "incomplete-seats-recorded", incomplete_count: incompleteCount },
    evidenceRefs: { incomplete_seats_ref: ref }
  });
  const authorizedNode = (chain) => appendUncheckedDecisionNode(chain, {
    transition: "terminal",
    subject: { kind: "authorization", authorization_id: CONSTANTS.AUTHORIZATION_ID },
    outcome: { status: "AUTHORIZED", decision_source: "gate", next_action: "submit-to-the-eye" },
    evidenceRefs: {
      gate_projection_ref: ref,
      results_ref: ref,
      validation_diagnostics_ref: ref
    }
  });
  const approved = { status: "accepted-published", decision: "approve", signed: true };

  const failedClaude = seatNode(empty, "claude", "approver", {
    status: "failed",
    decision: null,
    reason_code: "SEAT_CALL_FAILED"
  });
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(authorizedNode(stateNode(failedClaude, 4))),
    /AUTHORIZED.*required|required.*trio|approv/i
  );

  let revisedRequired = seatNode(empty, "claude", "approver", approved);
  revisedRequired = seatNode(revisedRequired, "agy", "approver", approved);
  revisedRequired = seatNode(revisedRequired, "codex", "approver", {
    status: "accepted-published",
    decision: "revise",
    signed: true
  });
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(authorizedNode(stateNode(revisedRequired, 2))),
    /AUTHORIZED.*required|required.*trio|approv/i
  );

  let legalAdvisoryDeath = seatNode(empty, "claude", "approver", approved);
  legalAdvisoryDeath = seatNode(legalAdvisoryDeath, "agy", "approver", approved);
  legalAdvisoryDeath = seatNode(legalAdvisoryDeath, "codex", "approver", approved);
  legalAdvisoryDeath = seatNode(legalAdvisoryDeath, "grok", "advisory", {
    status: "transport-death",
    decision: null,
    reason_code: "MCP_CHILD_ERROR"
  });
  legalAdvisoryDeath = stateNode(legalAdvisoryDeath, 1);
  assert.equal(
    runnerModule.validateProvisionalDecisionChain(authorizedNode(legalAdvisoryDeath)),
    true
  );
});

test("decision-chain seed rejects fully rehashed non-SHA lineage and transport refs", () => {
  const providerTransport = createProviderTransportProfile();
  const empty = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  for (const [field, value] of [
    ["revision_lineage_ref", "not-a-content-reference"],
    ["provider_transport_ref", `sha256:${"A".repeat(64)}`]
  ]) {
    const forged = clone(empty);
    forged.seed[field] = value;
    forged.seed_ref = canonicalRef(forged.seed);
    forged.final_root = forged.seed_ref;
    assert.throws(
      () => runnerModule.validateProvisionalDecisionChain(forged),
      /seed.*SHA|lineage.*ref|transport.*ref|content.*reference/i
    );
  }
});

test("decision-chain nonclaims and policy are immutable and seed-bound", () => {
  const providerTransport = createProviderTransportProfile();
  const chain = runnerModule.createProvisionalDecisionChain({
    revisionLineageRef: canonicalRef(createRevisionLineage()),
    providerTransportRef: canonicalRef(providerTransport)
  });
  const expectedNonclaims = [
    "This local content-addressed decision chain is provisional evidence, not ratified Compact authority.",
    "Its roots bind recorded controller transitions; they do not authenticate providers, Git, Node, or the operating system."
  ];
  assert.deepEqual(CONSTANTS.DECISION_CHAIN_NONCLAIMS, expectedNonclaims);
  assert.equal(Object.isFrozen(CONSTANTS.DECISION_CHAIN_NONCLAIMS), true);
  assert.equal(Object.isFrozen(CONSTANTS.DECISION_CHAIN_POLICY), true);
  assert.deepEqual(chain.nonclaims, expectedNonclaims);
  assert.equal(chain.seed.policy_ref, canonicalRef(CONSTANTS.DECISION_CHAIN_POLICY));

  const mutatedPolicy = clone(CONSTANTS.DECISION_CHAIN_POLICY);
  mutatedPolicy.nonclaims[0] = "This chain grants ratified Compact implementation authority.";
  const mutatedPolicyRef = canonicalRef(mutatedPolicy);
  assert.notEqual(mutatedPolicyRef, chain.seed.policy_ref);
  assert.notEqual(canonicalRef({ ...chain.seed, policy_ref: mutatedPolicyRef }), chain.seed_ref);

  const mutatedOuter = clone(chain);
  mutatedOuter.nonclaims = [
    "This chain grants ratified Compact implementation authority.",
    "The Eye is bypassed and Task 1 may begin."
  ];
  assert.throws(
    () => runnerModule.validateProvisionalDecisionChain(mutatedOuter),
    /nonclaim|policy|authority boundary/i
  );
});

test("terminal summary rejects reordered, fabricated, or evidence-mismatched seat nodes", () => {
  const providerTransport = createProviderTransportProfile();
  const results = allSuccessfulResults();
  const reordered = [results[2], results[0], results[1], results[3], results[4]];
  assert.throws(
    () => buildAuthorizationSummary({
      results,
      gate: gateFixture(),
      providerTransport,
      decisionChain: decisionChainForResults(reordered, providerTransport),
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /seat order|ordered.*seat|seat prefix|fixed.*prefix|contradict/i
  );

  const requiredOnly = results.slice(0, 3);
  const fabricatedGrok = { model: "grok", role: "advisory", ok: false, reason: "fabricated failure" };
  assert.throws(
    () => buildAuthorizationSummary({
      results: requiredOnly,
      gate: gateFixture(),
      providerTransport,
      decisionChain: decisionChainForResults([...requiredOnly, fabricatedGrok], providerTransport),
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /no matching failed result|fabricated|contradict|result prefix|next fixed serial seat/i
  );

  const failedResults = [...requiredOnly, { model: "grok", role: "advisory", ok: false, reason: "provider unavailable" }];
  assert.throws(
    () => buildAuthorizationSummary({
      results: failedResults,
      gate: gateFixture(),
      providerTransport,
      decisionChain: decisionChainForResults(failedResults, providerTransport, {
        failureRefFor: () => `sha256:${"9".repeat(64)}`
      }),
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /failure evidence|evidence.*grok|contradict/i
  );
});

test("terminal summary requires council results to be the exact fixed-seat prefix", () => {
  const providerTransport = createProviderTransportProfile();
  const results = allSuccessfulResults();
  const skippedAgy = [results[0], results[2]];
  assert.throws(
    () => buildAuthorizationSummary({
      results: skippedAgy,
      gate: gateFixture({ gateStatus: "blocked", blockers: ["Agy result was skipped."] }),
      providerTransport,
      decisionChain: decisionChainForResults(skippedAgy, providerTransport),
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /exact.*prefix|expected.*agy|fixed.*seat/i
  );
});

test("unresolved seat transport death must identify the next fixed serial seat", () => {
  const providerTransport = createProviderTransportProfile();
  const results = [allSuccessfulResults()[0]];
  const terminalFailure = makeTerminalFailure("mcp-child-error", {
    message: "forged future-seat transport death"
  });
  let chain = decisionChainForResults(results, providerTransport);
  chain = appendUncheckedDecisionNode(chain, {
    transition: "seat",
    subject: { kind: "seat", model: "gemini", role: "advisory" },
    outcome: {
      status: "transport-death",
      decision: null,
      reason_code: terminalFailure.reason_code
    },
    evidenceRefs: { failure_ref: canonicalRef(terminalFailure) }
  });
  assert.throws(
    () => buildAuthorizationSummary({
      results,
      gate: gateFixture({ gateStatus: "blocked", blockers: ["Provider transport died."] }),
      terminalFailure,
      providerTransport,
      decisionChain: chain,
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /next.*serial.*seat|next.*unresolved.*seat|seat.*prefix/i
  );
});

test("provider transport death is a single terminal transition boundary", () => {
  const providerTransport = createProviderTransportProfile();
  const claude = allSuccessfulResults()[0];
  const terminalFailure = makeTerminalFailure("mcp-child-error", {
    message: "provider transport died"
  });
  const appendTransportDeath = (chain) => appendUncheckedDecisionNode(chain, {
    transition: "transport",
    subject: { kind: "provider-transport" },
    outcome: { status: "transport-death", reason_code: terminalFailure.reason_code },
    evidenceRefs: { failure_ref: canonicalRef(terminalFailure) }
  });

  let duplicateDeaths = decisionChainForResults([claude], providerTransport);
  duplicateDeaths = appendTransportDeath(duplicateDeaths);
  duplicateDeaths = appendTransportDeath(duplicateDeaths);
  assert.throws(
    () => buildAuthorizationSummary({
      results: [claude],
      gate: gateFixture({ gateStatus: "blocked", blockers: ["Provider transport died."] }),
      terminalFailure,
      providerTransport,
      decisionChain: duplicateDeaths,
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /single.*transport|multiple.*transport|transport.*once/i
  );

  const failedAgy = { model: "agy", role: "approver", ok: false, reason: "provider unavailable" };
  let continuedAfterDeath = decisionChainForResults([claude], providerTransport);
  continuedAfterDeath = appendTransportDeath(continuedAfterDeath);
  continuedAfterDeath = appendUncheckedDecisionNode(continuedAfterDeath, {
    transition: "seat",
    subject: { kind: "seat", model: "agy", role: "approver" },
    outcome: { status: "failed", decision: null, reason_code: "SEAT_CALL_FAILED" },
    evidenceRefs: {
      failure_ref: canonicalRef({
        model: "agy",
        role: "approver",
        reason: "provider unavailable",
        validation_failure: null
      })
    }
  });
  assert.throws(
    () => buildAuthorizationSummary({
      results: [claude, failedAgy],
      gate: gateFixture({ gateStatus: "blocked", blockers: ["Provider transport died."] }),
      terminalFailure,
      providerTransport,
      decisionChain: continuedAfterDeath,
      timestamp: "2026-07-22T12:00:00.000Z"
    }),
    /only after.*prefix|after.*transport|terminal.*boundary|transport.*followed/i
  );
});

test("durable summaries carry a deterministic provisional Merkle chain for every seat transition and terminal decision", async () => {
  const first = await runLifecycleFixture({ failurePoint: "decision-chain-success" });
  const second = await runLifecycleFixture({ failurePoint: "decision-chain-success" });
  const firstChain = verifyDecisionChain(first.summary);
  const secondChain = verifyDecisionChain(second.summary);
  assert.deepEqual(firstChain, secondChain);
  assert.equal(firstChain.nodes.length, 6);
  for (const seat of CONSTANTS.SEATS) {
    const node = firstChain.nodes.find((entry) => entry.subject?.model === seat.model);
    assert.equal(node?.transition, "seat");
    assert.equal(node?.outcome.status, "accepted-published");
    assert.equal(node?.outcome.decision, "approve");
    assert.match(node.evidence_refs.packet_raw_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(node.evidence_refs.publication_ref, /^sha256:[0-9a-f]{64}$/);
  }
  const terminal = firstChain.nodes.at(-1);
  assert.equal(terminal.transition, "terminal");
  assert.equal(terminal.outcome.status, "AUTHORIZED");
  assert.equal(terminal.outcome.decision_source, "gate");

  const requiredDeath = await runLifecycleFixture({ failurePoint: "required-agy" });
  const deathChain = verifyDecisionChain(requiredDeath.summary);
  assert.equal(deathChain.nodes.length, 4);
  assert.equal(deathChain.nodes.find((node) => node.subject?.model === "claude")?.outcome.status, "accepted-published");
  assert.equal(deathChain.nodes.find((node) => node.subject?.model === "agy")?.outcome.status, "transport-death");
  assert.equal(deathChain.nodes.find((node) => node.transition === "state")?.outcome.incomplete_count, 3);
  assert.equal(deathChain.nodes.at(-1).outcome.status, "NOT_AUTHORIZED");
  assert.equal(deathChain.nodes.at(-1).outcome.decision_source, "controller");

  const unsigned = await runLifecycleFixture({ failurePoint: "unsigned-advisory-chain", unsignedModel: "grok" });
  const unsignedChain = verifyDecisionChain(unsigned.summary);
  assert.equal(unsignedChain.nodes.find((node) => node.subject?.model === "grok")?.outcome.status, "failed");
  assert.equal(unsignedChain.nodes.find((node) => node.subject?.model === "gemini")?.outcome.status, "accepted-published");
  assert.equal(unsignedChain.nodes.at(-1).outcome.status, "AUTHORIZED");
});

test("exact review loader reads each root once and returns only verified captured text", () => {
  const planBytes = readFileSync(path.join(ROOT, CONSTANTS.PLAN_PATH));
  const specBytes = readFileSync(path.join(ROOT, CONSTANTS.SPEC_PATH));
  const calls = [];
  const loaded = loadExactReviewInputs({
    root: "/virtual-root",
    readFile(file) {
      calls.push(file);
      if (file.endsWith(CONSTANTS.PLAN_PATH)) return Buffer.from(planBytes);
      if (file.endsWith(CONSTANTS.SPEC_PATH)) return Buffer.from(specBytes);
      throw new Error(`unexpected read ${file}`);
    }
  });
  assert.deepEqual(calls, [
    path.join("/virtual-root", CONSTANTS.PLAN_PATH),
    path.join("/virtual-root", CONSTANTS.SPEC_PATH)
  ]);
  assert.equal(loaded.plan_text, planBytes.toString("utf8"));
  assert.equal(loaded.spec_text, specBytes.toString("utf8"));
  assert.equal(loaded.plan_raw_sha256, CONSTANTS.PLAN_IDENTITY.raw_sha256);
  assert.equal(loaded.candidate_ref, CONSTANTS.EXPECTED_PLAN_REF);
  assert.equal(loaded.spec_raw_sha256, CONSTANTS.DESIGN_RAW_SHA256);
});

test("approver death produces durable closed NOT_AUTHORIZED return summary", () => {
  const results = allSuccessfulResults();
  results[0] = { model: "claude", role: "approver", ok: false, reason: "socket hang up" };
  const summary = buildSummary({
    results,
    gate: gateFixture({ gateStatus: "blocked", blockers: ["Missing required claude approval packet."] }),
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.authorized, false);
  assert.equal(summary.authorization.status, "NOT_AUTHORIZED");
  assert.equal(summary.next_action, "return-to-daedalus");
  assert.deepEqual(summary.seats[0], {
    model: "claude",
    role: "approver",
    ok: false,
    state: "failed",
    reason: "SEAT_CALL_FAILED: Provider seat call failed."
  });
  assert.equal(summary.seats[1].state, "succeeded");
  assert.deepEqual(summary.gate.blockers, ["Missing required claude approval packet."]);
});

test("advisory death stays explicit but cannot block required-trio authorization", () => {
  const results = allSuccessfulResults();
  results[3] = { model: "grok", role: "advisory", ok: false, reason: "provider unavailable" };
  const summary = buildSummary({
    results,
    gate: gateFixture({ warnings: ["No Grok advisory packet present."] }),
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.authorized, true);
  assert.equal(summary.authorization.status, "AUTHORIZED");
  assert.equal(summary.next_action, "submit-to-the-eye");
  assert.equal(summary.gate.gate_status, "pass");
  assert.deepEqual(summary.gate.blockers, []);
  assert.deepEqual(summary.gate.warnings, ["No Grok advisory packet present."]);
  assert.deepEqual(summary.seats[3], {
    model: "grok",
    role: "advisory",
    ok: false,
    state: "failed",
    reason: "SEAT_CALL_FAILED: Provider seat call failed."
  });
});

test("malformed provenance becomes an explicit seat failure without advisory veto", () => {
  const priorResponseIds = CONSTANTS.SEATS.map(({ model }) => `prior-${model}`);
  const advisoryMalformed = allSuccessfulResults();
  advisoryMalformed[3].packet.provenance.response_id = "   ";
  const advisoryClassification = classifyPacketProvenance(advisoryMalformed, priorResponseIds);
  assert.equal(advisoryClassification.results[3].ok, false);
  assert.equal(advisoryClassification.results[3].validation_failure.reason_code, "INVALID_PACKET_PROVENANCE");
  assert.deepEqual(advisoryClassification.diagnostics.map((entry) => entry.model), ["grok"]);
  assert.equal(advisoryClassification.diagnostics[0].advisory_content, null);
  assert.equal(advisoryClassification.diagnostics[0].observed_response_id, null);
  const advisorySummary = buildSummary({
    results: advisoryClassification.results,
    gate: gateFixture({ warnings: ["No Grok advisory packet present."] }),
    validationDiagnostics: advisoryClassification.diagnostics,
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(advisorySummary.authorized, true);
  assert.equal(advisorySummary.seats[3].state, "failed");
  assert.equal(advisorySummary.validation_diagnostics[0].role, "advisory");

  const requiredMalformed = allSuccessfulResults();
  requiredMalformed[0].packet.provenance.response_id = null;
  const requiredClassification = classifyPacketProvenance(requiredMalformed, priorResponseIds);
  const requiredSummary = buildSummary({
    results: requiredClassification.results,
    gate: gateFixture({ gateStatus: "blocked", blockers: ["Missing required claude approval packet."] }),
    validationDiagnostics: requiredClassification.diagnostics,
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(requiredSummary.authorized, false);
  assert.equal(requiredSummary.next_action, "return-to-daedalus");
  assert.equal(requiredSummary.seats[0].state, "failed");
});

test("packet classification consumes stale IDs, raw-byte reuse, duplicates, and validator throws deterministically", () => {
  const priorResponseIds = CONSTANTS.SEATS.map(({ model }) => `prior-${model}`);
  const reusedId = allSuccessfulResults();
  reusedId[0].packet.provenance.response_id = priorResponseIds[0];
  const reusedIdClassification = classifyPacketProvenance(reusedId, priorResponseIds);
  assert.equal(reusedIdClassification.results[0].ok, false);
  assert.equal(reusedIdClassification.diagnostics[0].message, "Seat packet failed fresh provenance validation.");

  const rawReuse = allSuccessfulResults();
  const rawReuseClassification = classifyPacketProvenance(rawReuse, priorResponseIds, {
    hashPacket(packet) {
      return packet.model === "codex" ? CONSTANTS.PRIOR_PACKET_HASHES.codex : `sha256:${createHash("sha256").update(packet.model).digest("hex")}`;
    }
  });
  assert.equal(rawReuseClassification.results[2].ok, false);
  assert.equal(rawReuseClassification.diagnostics[0].observed_raw_sha256, null);

  const duplicate = allSuccessfulResults();
  duplicate[4].packet.provenance.response_id = duplicate[3].packet.provenance.response_id;
  const duplicateClassification = classifyPacketProvenance(duplicate, priorResponseIds, {
    hashPacket(packet) {
      return packet.model === "gemini" || packet.model === "grok"
        ? "sha256:" + "a".repeat(64)
        : `sha256:${createHash("sha256").update(packet.model).digest("hex")}`;
    }
  });
  assert.equal(duplicateClassification.results[3].ok, true);
  assert.equal(duplicateClassification.results[4].ok, false);
  assert.equal(
    duplicateClassification.diagnostics[0].message,
    "Seat packet failed fresh provenance validation."
  );

  const dossier = { sentinel: true };
  const advisoryThrow = allSuccessfulResults();
  const advisoryBindings = classifyCandidateBindingResults(advisoryThrow, dossier, {
    validate(_dossier, packets) {
      if (packets[0].model === "grok") throw new Error("advisory binding bad");
    }
  });
  assert.equal(advisoryBindings.results[3].ok, false);
  assert.equal(advisoryBindings.diagnostics[0].non_veto, true);
  const requiredBindings = classifyCandidateBindingResults(allSuccessfulResults(), dossier, {
    validate(_dossier, packets) {
      if (packets[0].model === "claude") throw new Error("required binding bad");
    }
  });
  assert.equal(requiredBindings.results[0].ok, false);
  assert.equal(requiredBindings.diagnostics[0].non_veto, false);
});

test("advisory-only gate defects are retained as non-veto warnings while required defects block", () => {
  const requiredPass = gateFixture({ warnings: ["No Grok advisory packet present."] });
  const fullWithAdvisoryDefect = gateFixture({
    gateStatus: "blocked",
    blockers: ["grok hard_stops is non-empty.", "Grok resolution is malformed."],
    warnings: ["Gemini advisory is incomplete."]
  });
  const projected = projectAdvisoryNonVetoGate(requiredPass, fullWithAdvisoryDefect);
  assert.equal(projected.gate_status, "pass");
  assert.deepEqual(projected.blockers, []);
  assert.deepEqual(projected.warnings, [
    "No Grok advisory packet present.",
    "Gemini advisory is incomplete.",
    "Advisory non-veto gate diagnostic: grok hard_stops is non-empty.",
    "Advisory non-veto gate diagnostic: Grok resolution is malformed."
  ]);

  const requiredBlocked = gateFixture({
    gateStatus: "blocked",
    blockers: ["codex decision is 'revise', not 'approve'."]
  });
  const stillBlocked = projectAdvisoryNonVetoGate(requiredBlocked, {
    ...fullWithAdvisoryDefect,
    blockers: [...requiredBlocked.blockers, ...fullWithAdvisoryDefect.blockers]
  });
  assert.equal(stillBlocked.gate_status, "blocked");
  assert.deepEqual(stillBlocked.blockers, requiredBlocked.blockers);
});

test("required-seat revise remains NOT_AUTHORIZED even with all five successful calls", () => {
  const results = allSuccessfulResults();
  results[2] = successfulResult("codex", "approver", "revise");
  const summary = buildSummary({
    results,
    gate: gateFixture({ gateStatus: "blocked", blockers: ["codex decision is 'revise', not 'approve'."] }),
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.authorized, false);
  assert.equal(summary.authorization.status, "NOT_AUTHORIZED");
  assert.equal(summary.next_action, "return-to-daedalus");
  assert.equal(summary.seats[2].state, "succeeded");
  assert.equal(summary.seats[2].decision, "revise");
  assert.deepEqual(summary.gate.blockers, ["codex decision is 'revise', not 'approve'."]);
});

test("all five fresh successes remain eligible for exact gate authorization", () => {
  const summary = buildSummary({
    results: allSuccessfulResults(),
    gate: gateFixture(),
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.authorized, true);
  assert.equal(summary.authorization.status, "AUTHORIZED");
  assert.equal(summary.next_action, "submit-to-the-eye");
  assert.deepEqual(summary.seats.map((seat) => seat.state), ["succeeded", "succeeded", "succeeded", "succeeded", "succeeded"]);
});

test("terminal child failure produces closed NOT_AUTHORIZED return evidence", () => {
  const terminalFailure = makeTerminalFailure("mcp-child-exit", {
    message: "MCP child exited unexpectedly",
    code: 17,
    signal: null
  });
  const summary = buildSummary({
    results: [],
    gate: gateFixture({
      gateStatus: "blocked",
      blockers: ["Missing required claude approval packet.", "Missing required agy approval packet.", "Missing required codex approval packet."]
    }),
    terminalFailure,
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.terminal_failure.reason_code, "MCP_CHILD_EXIT");
  assert.equal(summary.terminal_failure.child_exit_code, 17);
  assert.equal(summary.authorized, false);
  assert.equal(summary.authorization.status, "NOT_AUTHORIZED");
  assert.equal(summary.next_action, "return-to-daedalus");
  assert.deepEqual(summary.seats.map((seat) => seat.state), ["incomplete", "incomplete", "incomplete", "incomplete", "incomplete"]);
  assert.match(summary.gate.blockers.at(-1), /MCP_CHILD_EXIT/);
});

test("controller validation failure is a durable closed NOT_AUTHORIZED terminal record", () => {
  const terminalFailure = makeTerminalFailure("controller-validation", { message: "candidate validator threw" });
  const summary = buildSummary({
    results: [],
    gate: gateFixture({ gateStatus: "blocked", blockers: ["Controller validation failed."] }),
    terminalFailure,
    validationDiagnostics: [{ reason_code: "CONTROLLER_VALIDATION_FAILED", message: "candidate validator threw" }],
    timestamp: "2026-07-22T12:00:00.000Z"
  });
  assert.equal(summary.terminal_failure.reason_code, "CONTROLLER_VALIDATION_FAILED");
  assert.equal(summary.authorized, false);
  assert.equal(summary.next_action, "return-to-daedalus");
  assert.equal(summary.validation_diagnostics[0].reason_code, "CONTROLLER_VALIDATION_FAILED");
});

test("Gemini alone receives recursively relaxed response schema", () => {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      nested: {
        type: "object",
        additionalProperties: false,
        properties: { value: { type: "string" } }
      },
      rows: {
        type: "array",
        items: { type: "object", additionalProperties: false, properties: {} }
      }
    }
  };
  const stripped = stripAdditionalProperties(schema);
  assert.equal("additionalProperties" in stripped, false);
  assert.equal("additionalProperties" in stripped.properties.nested, false);
  assert.equal("additionalProperties" in stripped.properties.rows.items, false);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(responseSchemaForSeat("gemini", schema), stripped);
  for (const model of ["claude", "agy", "codex", "grok"]) {
    assert.deepEqual(responseSchemaForSeat(model, schema), schema);
    assert.equal(responseSchemaForSeat(model, schema).additionalProperties, false);
  }
});

test("source-review preflight derives exact anchors and performs no writes", () => {
  const repositoryBefore = repositorySnapshot();
  const attemptBefore = attemptSnapshot();
  const result = runNode([RUNNER, "--preflight", "--source-review"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "source-review");
  assert.equal(report.live_eligible, false);
  assert.equal(report.authorization_id, "authz-013");
  assert.equal(report.build_id, "daedalus-family-lifecycle-authz-013");
  assert.equal(report.candidate_ref, "sha256:00b3faadd8669ecb5144527421fb033344963bb38b96ca0b91eb21536dd472b3");
  assert.equal(report.prior_candidate_ref, "sha256:88e15cc7b72f19c64c6131fb5bf805f3368723139d0a514232e406b3a056de8b");
  assert.equal(report.prior_attempt.authorization_id, "authz-012");
  assert.equal(report.prior_attempt.commit, "git:3a39f50db437b3e94e78bcd4e3fa79e4143e624c");
  assert.equal(report.prior_attempt.tree, "git:07d78e7ed3ceb20103f08e2cefb3d8986b2a4988");
  assert.equal(report.prior_attempt.directory_tree, "git:99e89154f8c46422bd6011e41157be19e2cb8abf");
  assert.match(report.revision_lineage_ref, /^sha256:[0-9a-f]{64}$/);
  assert.equal(report.provider_transport_ref, canonicalRef(report.provider_transport));
  assert.equal(report.provider_preload_raw_sha256, report.provider_transport.preload_raw_sha256);
  assert.equal(report.provider_transport.authoritative, false);
  assert.equal(report.provider_transport.grants_authority, false);
  assert.equal(report.provider_transport.agent.options.timeout, 0);
  assert.equal(report.provider_transport.agent.uses_global_agent, false);
  assert.equal(report.provider_transport.environment.inherits_parent_environment, false);
  assert.equal("preload_data_url" in report.provider_transport, false);
  assert.equal("child_args" in report.provider_transport, false);
  assert.deepEqual(repositorySnapshot(), repositoryBefore);
  assert.deepEqual(attemptSnapshot(), attemptBefore);
});

test("unknown, repeated, and write-capable test flags fail without writes", () => {
  for (const args of [
    [RUNNER, "--preflight", "--wat"],
    [RUNNER, "--preflight", "--preflight"],
    [RUNNER, "--preflight", "--source-review", "--live"],
    [RUNNER, "--source-review"]
  ]) {
    const before = attemptSnapshot();
    const result = runNode(args);
    assert.notEqual(result.status, 0, `${args.join(" ")} unexpectedly succeeded`);
    assert.deepEqual(attemptSnapshot(), before);
  }
});

test("preflight path has no static provider import and both sources parse", () => {
  const source = readFileSync(RUNNER, "utf8");
  assert.doesNotMatch(source, /^\s*import\s+.*(?:connectors\/ai-peer|build-gate\/council|breakout\/mcp_client)/m);
  assert.doesNotMatch(source, /importModule = \(relative\) => import\(pathToFileURL/);
  assert.match(source, /installHeldProviderModuleHooks\(heldProviderSources/);
  assert.match(source, /createHeldProviderChildBootstrap\(heldProviderSources\)/);
  assert.match(source, /args: childExecution\.child_args/);
  const liveStart = source.indexOf("export async function runLive(");
  const durablePhase = source.indexOf("await runDurableAuthorizationPhase({", liveStart);
  const liveLoader = source.indexOf("const reviewInputs = loadExactReviewInputs(");
  const lineageWrite = source.indexOf("publishJson(outputDirectory, \"revision-lineage.json\"", liveLoader);
  const providerImports = source.indexOf("if (importModule === null) providerHooks = installHeldProviderModuleHooks", liveLoader);
  assert.ok(
    liveStart > 0 && durablePhase > liveStart && liveLoader > durablePhase && lineageWrite > liveLoader && providerImports > lineageWrite,
    "one durable phase must cover exact review bytes and lineage write before provider imports"
  );
  const promptStart = source.indexOf("const promptFor =");
  const promptEnd = source.indexOf("const childEnvironment =", promptStart);
  assert.ok(promptStart > 0 && promptEnd > promptStart);
  assert.doesNotMatch(source.slice(promptStart, promptEnd), /readFileSync/);
  assert.match(source.slice(promptStart, promptEnd), /agyCheckpointArgs\(dsr, agyReviewScope\)/);
  assert.match(source, /validateAgyCheckpointBinding\(parsed, agyReviewBinding, \{ attest: agyAttestation \}\)/);
  assert.doesNotMatch(source, /model === "agy" && parsed\?\.phase_gate_status/);
  assert.match(source, /runDurableAuthorizationPhase\(/);
  assert.match(source, /publishJson\(outputDirectory, "authorization-summary\.json", summary\)[\s\S]*summaryPersisted = true/);
  assert.match(source, /child\.stdin\.on\("error", onStdinError\)/);
  assert.match(source, /child\.stdout\.on\("error", onStdoutError\)/);
  assert.match(source, /child\.stdout\.once\("end", onStdoutEnd\)/);
  assert.match(source, /child\.stdout\.once\("close", onStdoutClose\)/);
  assert.match(source, /for \(const seat of SEATS\)[\s\S]*runCouncil\(\{ seats: \[seat\], callSeat, dossier, maxConcurrency: 1 \}\)/);
  assert.match(source, /spawnProviderMcpTransport\(/);
  assert.doesNotMatch(source, /spawnMcpClient/);
  for (const file of [RUNNER, TEST]) {
    const result = runNode(["--check", file]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
