#!/usr/bin/env node
// Prepare authz-013 for a fresh five-seat review of the revised Daedalus-family
// lifecycle candidate. Preflight is deterministic and provider-free. Council
// approval can only submit the exact candidate to The Eye; it cannot authorize
// implementation, start Task 1, or mutate CURRENT-AUTHORITY.json.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn as nodeSpawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  writeSync
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const RUNNER_PATH = "docs/runs/daedalus-family-lifecycle-authorization-5/run-authorization.mjs";
const TEST_PATH = "docs/runs/daedalus-family-lifecycle-authorization-5/test-runner.mjs";
const PLAN_PATH = "docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md";
const SPEC_PATH = "docs/superpowers/specs/2026-07-21-daedalus-family-multi-model-seat-lifecycle-design.md";
const PRIOR_ATTEMPT_RELATIVE_DIR = "docs/runs/daedalus-family-lifecycle-authorization-4";
const PRIOR_ATTEMPT_DIR = path.join(ROOT, PRIOR_ATTEMPT_RELATIVE_DIR);
const MODULE_SOURCE_COMMIT = "f2db463bf34b0aa679f8f8cde214f4e9d12cfa5d";

const HELD_PROVIDER_SOURCE_DESCRIPTORS = Object.freeze([
  ["breakout/mcp_client.mjs", "f2a7fde2175f8f2f2b4cf9793c3c0d8d2b8eaed3", 4620, "b60eecb4f137859ef6110cd3dcb64e4bd93f4462bd56b6c574648ebf418c25ce"],
  ["breakout/verifier.mjs", "717f211d274f5ea0a75a3966d9337eb6b24777a1", 12121, "750a340d30d46f24c30bc8d32ff1e95728eb9bd4fa5832a1050ba460d836dc7d"],
  ["build-gate/check-registry.mjs", "e33363e6d2f26079b1619ba32bce5b2f5f7360c7", 7815, "3abf5bf0c430987aec6d2ed2f671e8a07444a4d74eaeb36c001aaac0cbdf55b9"],
  ["build-gate/concerns.mjs", "7eb3d227d06690eb3d65699f80fa62362bc0df05", 20529, "f264abdfeca4b93cc282570f7c13aa62cc37a90f5a8903defdb8a2a16224b647"],
  ["build-gate/council.mjs", "f42c322733fd83bfbea97c991a4153ca3c69a0b6", 13377, "088035e6d0931d997af5146a0e165f5025bc2eadbb24f7f91694ca58b8f15c19"],
  ["build-gate/gate.mjs", "c5332063f3646161341213ff5adce99aca5f725a", 39133, "037ee73c8108f8ea21f333bb1586025a59d4c2c6359e1d052527edf66b77368d"],
  ["build-gate/proposal-gate.mjs", "5b22afae5d045a897323f97ea61aa5057df2aab0", 17057, "8b441983ee692f9f445ddb6af09e8f5dac6850c71aa0f9b9be497b0c55ebc2a3"],
  ["build-gate/schemas.mjs", "2beaeedd5a76f560c901e27d01c458171a291a4f", 10618, "0cbd338ee018629e9bb2181102d4315bbb57d17a6642a1e9c322a239088567e5"],
  ["build-gate/sign.mjs", "d80fa823603050914aea5e9ecec63e54a8671ab0", 3269, "ca3b01d37ea733d24e6d607e812918b6cd197fa5d3bd4a69f8deac4044d73ad7"],
  ["connectors/ai-peer-mcp/lib.mjs", "001427352a9958ac34b727cb7efca006fc99b0eb", 8346, "e4f46a294c7397ee2f6593e118328f8e90e8c8cbb9809525e0ba9813f051b3a8"],
  ["connectors/ai-peer-mcp/server.mjs", "376073381c89fb00d10d8c3b1f3e57f916e04962", 32880, "e60f81774dbd07208fa022fd8914cc6ab5a1bc492e0aaffb2fac6dbb3b12be80"],
  ["merkle-dag/merkle.mjs", "c47e3731f40ab967e165c54569ade1c965f1eca8", 10447, "d354181df9b2c896389eae71f97155a944f9af766ddc840f5a7fd638b50d9353"],
  ["merkle-dag/obligation.mjs", "3a6f43fb1321a8d8bf7ca86308fadc3a8de33ff0", 9662, "3f54162b4cac06c827ace282c308b9fc35e9e1487553fbd427d2929d5fd7cae8"],
  ["merkle-dag/proposal-ledger.mjs", "84bcbd3ba3297bfda69f7060d1eea2b9e2365772", 16689, "8da512094966fe0c6121c303d70df870ac443530685f68d647a600005041cc5a"],
  ["merkle-dag/vendor.mjs", "a0750c0e5ca1b098412d7dade16c4f7e0aff0d43", 5527, "082dc2b3f40e11637729e7a3503e19fc7fe0cc43310cb889c4e856eebb15e7ab"]
].map(([sourcePath, blob, byteLength, raw]) => Object.freeze({
  path: sourcePath,
  blob: `git:${blob}`,
  byte_length: byteLength,
  raw_sha256: `sha256:${raw}`,
  mode: "100644",
  type: "blob"
})));

const HELD_PROVIDER_LOCAL_EDGES = Object.freeze([
  ["connectors/ai-peer-mcp/server.mjs", "./lib.mjs", "connectors/ai-peer-mcp/lib.mjs"],
  ["build-gate/council.mjs", "./sign.mjs", "build-gate/sign.mjs"],
  ["build-gate/gate.mjs", "../breakout/verifier.mjs", "breakout/verifier.mjs"],
  ["build-gate/gate.mjs", "./sign.mjs", "build-gate/sign.mjs"],
  ["build-gate/gate.mjs", "./proposal-gate.mjs", "build-gate/proposal-gate.mjs"],
  ["build-gate/gate.mjs", "./schemas.mjs", "build-gate/schemas.mjs"],
  ["build-gate/proposal-gate.mjs", "../merkle-dag/vendor.mjs", "merkle-dag/vendor.mjs"],
  ["build-gate/proposal-gate.mjs", "../merkle-dag/merkle.mjs", "merkle-dag/merkle.mjs"],
  ["build-gate/proposal-gate.mjs", "../merkle-dag/obligation.mjs", "merkle-dag/obligation.mjs"],
  ["build-gate/proposal-gate.mjs", "../merkle-dag/proposal-ledger.mjs", "merkle-dag/proposal-ledger.mjs"],
  ["build-gate/proposal-gate.mjs", "./concerns.mjs", "build-gate/concerns.mjs"],
  ["build-gate/proposal-gate.mjs", "./check-registry.mjs", "build-gate/check-registry.mjs"],
  ["merkle-dag/merkle.mjs", "./vendor.mjs", "merkle-dag/vendor.mjs"],
  ["merkle-dag/merkle.mjs", "./obligation.mjs", "merkle-dag/obligation.mjs"],
  ["merkle-dag/obligation.mjs", "./vendor.mjs", "merkle-dag/vendor.mjs"],
  ["merkle-dag/proposal-ledger.mjs", "./vendor.mjs", "merkle-dag/vendor.mjs"],
  ["build-gate/concerns.mjs", "../merkle-dag/vendor.mjs", "merkle-dag/vendor.mjs"],
  ["build-gate/concerns.mjs", "./check-registry.mjs", "build-gate/check-registry.mjs"],
  ["build-gate/check-registry.mjs", "../merkle-dag/vendor.mjs", "merkle-dag/vendor.mjs"]
].map(([parent, specifier, target]) => Object.freeze({ parent, specifier, target })));

const HELD_PROVIDER_BUILTINS = Object.freeze([
  "node:child_process", "node:crypto", "node:fs", "node:fs/promises", "node:https",
  "node:os", "node:path", "node:process", "node:url"
]);
const HELD_PARENT_ROOTS = Object.freeze([
  "connectors/ai-peer-mcp/lib.mjs",
  "build-gate/council.mjs",
  "build-gate/gate.mjs",
  "breakout/mcp_client.mjs"
]);

export const PROVIDER_FETCH_PRELOAD_SOURCE = `import { Agent, request } from "node:https";
const telosHttpsAgent = new Agent({ keepAlive: false, timeout: 0 });
globalThis.__TELOS_AUTHZ013_HTTPS_FETCH__ = true;
globalThis.__TELOS_AUTHZ013_HTTPS_AGENT__ = telosHttpsAgent;
globalThis.fetch = function telosHttpsFetch(input, init = {}) {
  if (typeof Request !== "undefined" && input instanceof Request) {
    return Promise.reject(new TypeError("TELOS provider transport does not support Request inputs"));
  }
  if (!(typeof input === "string" || input instanceof URL)) {
    return Promise.reject(new TypeError("TELOS provider transport requires a string or URL input"));
  }
  if (String(init.method || "GET").toUpperCase() !== "POST") {
    return Promise.reject(new TypeError("TELOS provider transport supports direct HTTPS POST only"));
  }
  if (init.redirect !== undefined) {
    return Promise.reject(new TypeError("TELOS provider transport does not support redirect semantics"));
  }
  if (init.signal !== undefined && init.signal !== null) {
    return Promise.reject(new TypeError("TELOS provider transport does not support AbortSignal semantics"));
  }
  const body = init.body;
  const bufferedBody = typeof body === "string" || Buffer.isBuffer(body) || ArrayBuffer.isView(body)
    ? body
    : body instanceof ArrayBuffer
      ? Buffer.from(body)
      : null;
  if (bufferedBody === null) {
    return Promise.reject(new TypeError("TELOS provider transport requires a buffered request body"));
  }
  return new Promise((resolve, reject) => {
    let target;
    try {
      target = input instanceof URL ? input : new URL(String(input));
    } catch (error) {
      reject(error);
      return;
    }
    if (target.protocol !== "https:") {
      reject(new Error("TELOS provider transport requires https:"));
      return;
    }
    const headers = new Headers(init.headers || {});
    const req = request(target, {
      method: "POST",
      headers: Object.fromEntries(headers.entries()),
      agent: telosHttpsAgent
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      response.once("error", reject);
      response.once("end", () => {
        const body = Buffer.concat(chunks);
        resolve(new Response(body, {
          status: response.statusCode || 500,
          statusText: response.statusMessage || "",
          headers: response.headers
        }));
      });
    });
    req.once("error", reject);
    req.write(bufferedBody);
    req.end();
  });
};
`;

const PROVIDER_CREDENTIAL_VARIABLE_NAMES = Object.freeze([
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY"
]);

const PROVIDER_EXACT_NON_SECRET_ENVIRONMENT = Object.freeze({
  AI_PEER_LONG_TIMEOUT: "0",
  AI_PEER_TIMEOUT_MS: "",
  AI_PEER_DEBUG: "0",
  ANTHROPIC_VERSION: "2023-06-01"
});

const PROVIDER_DENIED_AMBIENT_VARIABLES = Object.freeze([
  "ANTHROPIC_MODEL",
  "XAI_MODEL",
  "OPENAI_MODEL",
  "GEMINI_MODEL",
  "XAI_BASE_URL",
  "OPENAI_BASE_URL",
  "GEMINI_BASE_URL",
  "NODE_OPTIONS",
  "NODE_EXTRA_CA_CERTS",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "OPENSSL_CONF",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy"
]);

const REVISION_LINEAGE_KEYS = [
  "schema_version",
  "node_type",
  "status",
  "authoritative",
  "grants_authority",
  "authority_predecessor",
  "mutation_of",
  "prior_candidate_ref",
  "candidate_ref",
  "plan",
  "design",
  "prior_attempt"
];

const SEATS = Object.freeze([
  Object.freeze({ model: "claude", role: "approver" }),
  Object.freeze({ model: "agy", role: "approver" }),
  Object.freeze({ model: "codex", role: "approver" }),
  Object.freeze({ model: "grok", role: "advisory" }),
  Object.freeze({ model: "gemini", role: "advisory" })
]);

const REMOTE_ACCEPTED_PACKET_KEYS = Object.freeze([
  "build_id",
  "use_case",
  "proposal_ref",
  "revision_lineage_ref",
  "revision_lineage",
  "provider_transport_ref",
  "provider_transport",
  "provider_preload_raw_sha256",
  "agy_review_input_ref",
  "timestamp",
  "docs_reviewed",
  "model",
  "role",
  "decision",
  "required_edits",
  "hard_stops",
  "confidence",
  "rationale",
  "provenance",
  "signature"
]);

const AGY_ACCEPTED_PACKET_KEYS = Object.freeze([
  "build_id",
  "use_case",
  "model",
  "role",
  "docs_reviewed",
  "proposal_ref",
  "decision",
  "required_edits",
  "hard_stops",
  "confidence",
  "timestamp",
  "revision_lineage_ref",
  "revision_lineage",
  "provider_transport_ref",
  "provider_transport",
  "provider_preload_raw_sha256",
  "agy_review_input_ref",
  "agy_checkpoint_ref",
  "response_id",
  "provenance",
  "signature"
]);

const ACCEPTED_PACKET_SIGNATURE_KEYS = Object.freeze(["alg", "signed_fields", "value"]);

const ROUTED_PROVENANCE_POLICY = Object.freeze({
  claude: Object.freeze({
    keys: Object.freeze(["answered_at", "model", "provider", "response_id", "source", "tool"]),
    tool: "claude_ask",
    provider: "anthropic",
    source: "ai-peer-mcp/claude_ask",
    response_model: "claude-fable-5"
  }),
  agy: Object.freeze({
    keys: Object.freeze(["answered_at", "attestation", "engine_version", "model", "provider", "response_id", "source", "tool"]),
    tool: "agy_checkpoint",
    provider: "local",
    source: "ai-peer-mcp/agy_checkpoint",
    response_model: "agy-checkpoint",
    answered_at: null,
    attestation: "local-deterministic",
    engine_version: "agy-checkpoint/1"
  }),
  codex: Object.freeze({
    keys: Object.freeze(["answered_at", "model", "provider", "response_id", "source", "tool"]),
    tool: "codex_ask",
    provider: "openai",
    source: "ai-peer-mcp/codex_ask",
    response_model: "gpt-5.6-sol"
  }),
  grok: Object.freeze({
    keys: Object.freeze(["answered_at", "model", "provider", "response_id", "source", "tool"]),
    tool: "grok_ask",
    provider: "xai",
    source: "ai-peer-mcp/grok_ask",
    response_model: "grok-4.5"
  }),
  gemini: Object.freeze({
    keys: Object.freeze(["answered_at", "model", "provider", "response_id", "source", "tool"]),
    tool: "gemini_ask",
    provider: "google",
    source: "ai-peer-mcp/gemini_ask",
    response_model: "gemini-3.1-pro-preview"
  })
});

const DECISION_CHAIN_VERSIONS = Object.freeze({
  chain: "telos.authz-013-provisional-merkle-decision-chain.v1",
  seed: "telos.authz-013-provisional-merkle-decision-seed.v1",
  node: "telos.authz-013-provisional-merkle-decision-node.v1",
  root: "telos.authz-013-provisional-merkle-decision-root.v1"
});

const DURABLE_DECISION_VERSIONS = Object.freeze({
  envelope: "telos.authz-013-provisional-durable-decision-envelope.v1",
  publication: "telos.authz-013-provisional-durable-decision-publication.v1",
  failure: "telos.authz-013-sanitized-failure-projection.v1"
});

const INTERNAL_TERMINAL_FAILURE = Symbol("authz-013-internal-terminal-failure");
const SUPPRESS_TERMINAL_SUMMARY = Symbol("authz-013-suppress-terminal-summary");

const SAFE_FAILURE_MESSAGES = Object.freeze({
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

const ORDINARY_SEAT_FAILURE_REASON_CODES = Object.freeze([
  "SEAT_CALL_FAILED",
  "INVALID_PROVIDER_IDENTITY",
  "INVALID_PACKET_PROVENANCE",
  "INVALID_CANDIDATE_BINDING",
  "SENSITIVE_PACKET_CONTENT",
  "INVALID_PACKET_SIGNATURE"
]);

const TRANSPORT_FAILURE_REASON_CODES = Object.freeze([
  "MCP_CHILD_ERROR",
  "MCP_CHILD_EXIT",
  "PROVIDER_ERROR"
]);

const DECISION_CHAIN_NONCLAIMS = Object.freeze([
  "This local content-addressed decision chain is provisional evidence, not ratified Compact authority.",
  "Its roots bind recorded controller transitions; they do not authenticate providers, Git, Node, or the operating system."
]);

const DECISION_CHAIN_POLICY = Object.freeze({
  schema_version: "telos.authz-013-provisional-merkle-decision-policy.v1",
  status: "PROVISIONAL_NON_AUTHORITATIVE",
  authoritative: false,
  grants_authority: false,
  compact_authority_claimed: false,
  seat_order: SEATS,
  maximum_provider_transport_deaths: 1,
  provider_transitions_after_death: false,
  maximum_state_transitions: 1,
  maximum_terminal_transitions: 1,
  nonclaims: DECISION_CHAIN_NONCLAIMS
});

const TRANSPORT_POLICY = Object.freeze({
  council_max_concurrency: 1,
  per_seat_automatic_retries: 0
});

const PRIOR_ATTEMPT_FILES = Object.freeze([
  Object.freeze({ path: "agy.json", raw_sha256: "sha256:342b85d6876e8447f997b65976db5b70c1d72f8f008b758a2bc959d920f3b75d" }),
  Object.freeze({ path: "authorization-summary.json", raw_sha256: "sha256:a9799332987a99ca565cfbe3a9c187f16d6cfc0dca4015765c86bef2998b1fcb" }),
  Object.freeze({ path: "claude.json", raw_sha256: "sha256:b7514a4fcb5acb16a85f1f159c288330e7ea879c53e2b11d97b1b7cc6c01e54f" }),
  Object.freeze({ path: "codex.json", raw_sha256: "sha256:4f77270eef15f880f43633dc6502260f3ef61a4837c3f75a786c19926bae70be" }),
  Object.freeze({ path: "gemini.json", raw_sha256: "sha256:3823ccb194ba0c5afcc992e7c1779c8c2c236f2927bbb3110075ca58d5fa201d" }),
  Object.freeze({ path: "grok.json", raw_sha256: "sha256:5f01fed7d065a4049d316b54dd3f8ad9fc6f9c0de8fc6ae2e39ced740c81ac12" }),
  Object.freeze({ path: "retry-node.json", raw_sha256: "sha256:7c0b00c2f0de99c218abdb3b2f5780e6a066c66995c22268a230f1661a453bca" }),
  Object.freeze({ path: "run-authorization.mjs", raw_sha256: "sha256:e1d5c5928999cb4472ac0d7b604b1dce128e4bb547bdab80d858dab66febd7eb" })
]);

const PRIOR_PACKET_HASHES = Object.freeze({
  claude: "sha256:b7514a4fcb5acb16a85f1f159c288330e7ea879c53e2b11d97b1b7cc6c01e54f",
  agy: "sha256:342b85d6876e8447f997b65976db5b70c1d72f8f008b758a2bc959d920f3b75d",
  codex: "sha256:4f77270eef15f880f43633dc6502260f3ef61a4837c3f75a786c19926bae70be",
  grok: "sha256:5f01fed7d065a4049d316b54dd3f8ad9fc6f9c0de8fc6ae2e39ced740c81ac12",
  gemini: "sha256:3823ccb194ba0c5afcc992e7c1779c8c2c236f2927bbb3110075ca58d5fa201d"
});

const PLAN_IDENTITY = Object.freeze({
  commit: "git:f2db463bf34b0aa679f8f8cde214f4e9d12cfa5d",
  parent: "git:3a39f50db437b3e94e78bcd4e3fa79e4143e624c",
  tree: "git:04ded20f982a762116571854805bc096b133f218",
  blob: "git:37928e7ca96d23166bce7b9c320c81f8fcded2ed",
  raw_sha256: "sha256:896471abddc90343335980bd508f09cf6d0d895996f017818a160e13a3ff19bd",
  candidate_ref: "sha256:00b3faadd8669ecb5144527421fb033344963bb38b96ca0b91eb21536dd472b3"
});

const EXPECTED_PRIOR_SUMMARY_SEMANTICS = Object.freeze({
  authorization_id: "authz-012",
  build_id: "daedalus-family-lifecycle-authz-012",
  plan_ref: "sha256:88e15cc7b72f19c64c6131fb5bf805f3368723139d0a514232e406b3a056de8b",
  authorized: false,
  authorization: Object.freeze({
    status: "NOT_AUTHORIZED",
    plan_ref: "sha256:88e15cc7b72f19c64c6131fb5bf805f3368723139d0a514232e406b3a056de8b"
  }),
  terminal_failure: null,
  seats: Object.freeze([
    Object.freeze({ model: "claude", role: "approver", ok: true, decision: "approve" }),
    Object.freeze({ model: "agy", role: "approver", ok: true, decision: "approve" }),
    Object.freeze({ model: "codex", role: "approver", ok: true, decision: "revise" }),
    Object.freeze({ model: "grok", role: "advisory", ok: true, decision: "approve" }),
    Object.freeze({ model: "gemini", role: "advisory", ok: true, decision: "approve" })
  ]),
  gate: Object.freeze({ gate_status: "blocked", warnings: Object.freeze([]) })
});

const CONSTANTS = Object.freeze({
  AUTHORIZATION_ID: "authz-013",
  BUILD_ID: "daedalus-family-lifecycle-authz-013",
  USE_CASE: "multi-model-seats-daedalus-family-lifecycle",
  AUTHORITY_PREDECESSOR: "authz-008",
  MUTATION_OF: "authz-012",
  PLAN_PATH,
  SPEC_PATH,
  PLAN_IDENTITY,
  EXPECTED_PLAN_REF: PLAN_IDENTITY.candidate_ref,
  PRIOR_CANDIDATE_REF: "sha256:88e15cc7b72f19c64c6131fb5bf805f3368723139d0a514232e406b3a056de8b",
  DESIGN_BLOB: "git:55376e1ca6042ebcb4ed69ce647ea04ecdf72528",
  DESIGN_RAW_SHA256: "sha256:5c972b176df402d22a65273520d2342541cd213717e80c8460577a7ad6c920c9",
  PRIOR_ATTEMPT_COMMIT: "git:3a39f50db437b3e94e78bcd4e3fa79e4143e624c",
  PRIOR_ATTEMPT_PARENT: "git:12f6bfc70390863e218249e2b6424947ff2933e2",
  PRIOR_ATTEMPT_TREE: "git:07d78e7ed3ceb20103f08e2cefb3d8986b2a4988",
  PRIOR_ATTEMPT_DIRECTORY_TREE: "git:99e89154f8c46422bd6011e41157be19e2cb8abf",
  PRIOR_SUMMARY_RAW_SHA256: "sha256:a9799332987a99ca565cfbe3a9c187f16d6cfc0dca4015765c86bef2998b1fcb",
  PRIOR_SUMMARY_CANONICAL_REF: "sha256:f032db579fdd5e8abc8ccd3e1ef8da24e7c7996d3caab8a395c6beb479d660ed",
  PRIOR_DISK_TREE_REF: "sha256:b6021eebd7dc40b45820417ea33c4fd9eee7b40a1bd6d3d7f841e7caf444e831",
  PRIOR_RETRY_RAW_SHA256: "sha256:7c0b00c2f0de99c218abdb3b2f5780e6a066c66995c22268a230f1661a453bca",
  PRIOR_RETRY_CANONICAL_REF: "sha256:d69ac2d5bd3bb34947c6734d3fee5c7ea47003c4e4bcad65dbc51af88b3add05",
  REVISION_LINEAGE_KEYS: Object.freeze(REVISION_LINEAGE_KEYS),
  SEATS,
  DECISION_CHAIN_NONCLAIMS,
  DECISION_CHAIN_POLICY,
  ROUTED_PROVENANCE_POLICY,
  TRANSPORT_POLICY,
  PRIOR_ATTEMPT_FILES,
  PRIOR_PACKET_HASHES,
  EXPECTED_PRIOR_SUMMARY_SEMANTICS
});

const AUTHORITY_CRITICAL_FILES = Object.freeze([
  PLAN_PATH,
  SPEC_PATH,
  "CURRENT-AUTHORITY.json",
  "build-gate/council.mjs",
  "build-gate/gate.mjs",
  "build-gate/sign.mjs",
  "breakout/mcp_client.mjs",
  "merkle-dag/artifact.mjs",
  "merkle-dag/vendor.mjs",
  "connectors/ai-peer-mcp/server.mjs",
  "connectors/ai-peer-mcp/lib.mjs",
  ...PRIOR_ATTEMPT_FILES.map((entry) => `${PRIOR_ATTEMPT_RELATIVE_DIR}/${entry.path}`)
]);

const OUTPUT_FILES = Object.freeze([
  "revision-lineage.json",
  "authorization-summary.json",
  "claude.json",
  "agy.json",
  "codex.json",
  "grok.json",
  "gemini.json",
  "provider-transport.json"
]);

const ATOMIC_FS_OPS = Object.freeze({
  closeSync,
  fsyncSync,
  linkSync,
  openSync,
  unlinkSync,
  writeSync
});

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const sorted = Object.create(null);
    for (const key of Object.keys(value).sort()) sorted[key] = sortValue(value[key]);
    return sorted;
  }
  return value;
}

export function canonicalize(value) {
  return JSON.stringify(sortValue(value));
}

function rawSha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function canonicalRef(value) {
  return rawSha256(canonicalize(value));
}

function decisionChainSeed({ revisionLineageRef, providerTransportRef }) {
  return {
    schema_version: DECISION_CHAIN_VERSIONS.seed,
    authorization_id: CONSTANTS.AUTHORIZATION_ID,
    build_id: CONSTANTS.BUILD_ID,
    candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
    revision_lineage_ref: revisionLineageRef,
    provider_transport_ref: providerTransportRef,
    policy_ref: canonicalRef(DECISION_CHAIN_POLICY),
    authoritative: false,
    grants_authority: false
  };
}

export function createProvisionalDecisionChain({ revisionLineageRef, providerTransportRef } = {}) {
  if (!/^sha256:[0-9a-f]{64}$/.test(revisionLineageRef || "")
    || !/^sha256:[0-9a-f]{64}$/.test(providerTransportRef || "")) {
    fail("provisional decision chain requires exact revision-lineage and provider-transport refs.");
  }
  const seed = decisionChainSeed({ revisionLineageRef, providerTransportRef });
  const seedRef = canonicalRef(seed);
  return {
    schema_version: DECISION_CHAIN_VERSIONS.chain,
    status: "PROVISIONAL_NON_AUTHORITATIVE",
    authoritative: false,
    grants_authority: false,
    compact_authority_claimed: false,
    nonclaims: [...DECISION_CHAIN_NONCLAIMS],
    seed,
    seed_ref: seedRef,
    nodes: [],
    final_root: seedRef
  };
}

function sortedPlainObject(value) {
  return JSON.parse(canonicalize(value));
}

function exactObjectKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && exactEqual(Object.keys(value).sort(), [...keys].sort());
}

function canonicalPacketWithoutSignature(packet) {
  const { signature: _signature, ...unsignedPacket } = packet;
  return canonicalize(unsignedPacket);
}

function acceptedPacketSchemaDefects(packet, seat) {
  const defects = [];
  const expectedKeys = seat?.model === "agy" ? AGY_ACCEPTED_PACKET_KEYS : REMOTE_ACCEPTED_PACKET_KEYS;
  if (!exactObjectKeys(packet, expectedKeys)) return ["top-level packet keys are not exact"];
  const requiredStringFields = [
    "build_id", "use_case", "proposal_ref", "revision_lineage_ref", "provider_transport_ref",
    "provider_preload_raw_sha256", "agy_review_input_ref", "timestamp", "model", "role",
    "decision", "confidence"
  ];
  if (seat?.model !== "agy") requiredStringFields.push("rationale");
  for (const field of requiredStringFields) {
    if (typeof packet[field] !== "string") defects.push(`${field} is not a string`);
  }
  if (!exactEqual(packet.docs_reviewed, [PLAN_PATH, SPEC_PATH])) defects.push("docs_reviewed is not exact");
  if (!Array.isArray(packet.required_edits) || !packet.required_edits.every((value) => typeof value === "string")) {
    defects.push("required_edits is not a string array");
  }
  if (!Array.isArray(packet.hard_stops) || !packet.hard_stops.every((value) => typeof value === "string")) {
    defects.push("hard_stops is not a string array");
  }
  if (!["approve", "revise", "reject"].includes(packet.decision)) defects.push("decision is not exact");
  if (!["low", "medium", "high"].includes(packet.confidence)) defects.push("confidence is not exact");
  let canonicalTimestamp = false;
  if (typeof packet.timestamp === "string" && packet.timestamp) {
    try { canonicalTimestamp = new Date(packet.timestamp).toISOString() === packet.timestamp; } catch {}
  }
  if (!canonicalTimestamp) defects.push("timestamp is not canonical ISO");
  if (!packet.revision_lineage || typeof packet.revision_lineage !== "object" || Array.isArray(packet.revision_lineage)) {
    defects.push("revision_lineage is not an object");
  }
  if (!packet.provider_transport || typeof packet.provider_transport !== "object" || Array.isArray(packet.provider_transport)) {
    defects.push("provider_transport is not an object");
  }
  if (!packet.provenance || typeof packet.provenance !== "object" || Array.isArray(packet.provenance)) {
    defects.push("provenance is not an object");
  }
  if (seat?.model === "agy") {
    if (typeof packet.agy_checkpoint_ref !== "string"
      || !/^sha256:[0-9a-f]{64}$/.test(packet.agy_checkpoint_ref)) {
      defects.push("agy_checkpoint_ref is not exact");
    }
    if (typeof packet.response_id !== "string" || !packet.response_id.trim()
      || packet.response_id !== packet.response_id.trim()
      || packet.response_id !== packet.provenance?.response_id) {
      defects.push("Agy response_id is not exact");
    }
  }
  return defects;
}

function acceptedPacketSignatureDefects(packet, signatureSecret) {
  const defects = [];
  if (typeof signatureSecret !== "string" || signatureSecret.length === 0) {
    return ["signatureSecret must be a nonempty HMAC secret"];
  }
  if (!exactObjectKeys(packet?.signature, ACCEPTED_PACKET_SIGNATURE_KEYS)
    || packet.signature.alg !== "HMAC-SHA256"
    || packet.signature.signed_fields !== "canonical-minus-signature"
    || !/^[0-9a-f]{64}$/.test(packet.signature.value || "")) {
    return ["signature is not the exact closed HMAC schema"];
  }
  const expected = createHmac("sha256", signatureSecret)
    .update(canonicalPacketWithoutSignature(packet))
    .digest();
  const observed = Buffer.from(packet.signature.value, "hex");
  if (observed.length !== expected.length || !timingSafeEqual(observed, expected)) {
    defects.push("HMAC signature does not match");
  }
  return defects;
}

function acceptedPacketVerificationDefects(packet, seat, signatureSecret) {
  return [
    ...acceptedPacketSchemaDefects(packet, seat),
    ...acceptedPacketSignatureDefects(packet, signatureSecret)
  ];
}

function validateDecisionNodeDomain({ transition, subject, outcome, evidence_refs: evidenceRefs }) {
  const shaRef = (value) => /^sha256:[0-9a-f]{64}$/.test(value || "");
  if (transition === "seat") {
    if (!exactObjectKeys(subject, ["kind", "model", "role"]) || subject.kind !== "seat") {
      fail("seat decision subject is not the exact closed seat schema.");
    }
    const seat = SEATS.find(({ model }) => model === subject.model);
    if (!seat || seat.role !== subject.role) fail("seat decision subject does not match the fixed seat policy.");
    if (outcome?.status === "accepted-published") {
      if (!exactObjectKeys(outcome, ["decision", "signed", "status"])
        || !["approve", "revise", "reject"].includes(outcome.decision) || outcome.signed !== true
        || !exactObjectKeys(evidenceRefs, ["packet_raw_sha256", "publication_ref"])
        || !shaRef(evidenceRefs.packet_raw_sha256) || !shaRef(evidenceRefs.publication_ref)) {
        fail("accepted seat decision is not the exact closed publication schema.");
      }
      return true;
    }
    if (["failed", "transport-death"].includes(outcome?.status)) {
      const allowedReasonCodes = outcome.status === "failed"
        ? ORDINARY_SEAT_FAILURE_REASON_CODES
        : TRANSPORT_FAILURE_REASON_CODES;
      if (!exactObjectKeys(outcome, ["decision", "reason_code", "status"])
        || outcome.decision !== null || !/^[A-Z][A-Z0-9_]*$/.test(outcome.reason_code || "")
        || !allowedReasonCodes.includes(outcome.reason_code)
        || !exactObjectKeys(evidenceRefs, ["failure_ref"]) || !shaRef(evidenceRefs.failure_ref)) {
        fail("failed seat decision is not the exact closed ordinary/transport failure reason class.");
      }
      return true;
    }
    fail(`unsupported seat decision outcome ${outcome?.status || "<missing>"}.`);
  }
  if (transition === "transport") {
    if (!exactObjectKeys(subject, ["kind"]) || subject.kind !== "provider-transport"
      || !exactObjectKeys(outcome, ["reason_code", "status"]) || outcome.status !== "transport-death"
      || !/^[A-Z][A-Z0-9_]*$/.test(outcome.reason_code || "")
      || !TRANSPORT_FAILURE_REASON_CODES.includes(outcome.reason_code)
      || !exactObjectKeys(evidenceRefs, ["failure_ref"]) || !shaRef(evidenceRefs.failure_ref)) {
      fail("transport decision is not the exact closed transport failure reason class.");
    }
    return true;
  }
  if (transition === "state") {
    if (!exactObjectKeys(subject, ["authorization_id", "kind"])
      || subject.kind !== "controller" || subject.authorization_id !== CONSTANTS.AUTHORIZATION_ID
      || !exactObjectKeys(outcome, ["incomplete_count", "status"])
      || outcome.status !== "incomplete-seats-recorded"
      || !Number.isInteger(outcome.incomplete_count) || outcome.incomplete_count < 1 || outcome.incomplete_count > SEATS.length
      || !exactObjectKeys(evidenceRefs, ["incomplete_seats_ref"]) || !shaRef(evidenceRefs.incomplete_seats_ref)) {
      fail("controller state transition is not the exact closed incomplete-seat schema.");
    }
    return true;
  }
  if (transition === "terminal") {
    const evidenceKeys = Object.keys(evidenceRefs || {}).sort();
    const baseEvidenceKeys = ["gate_projection_ref", "results_ref", "validation_diagnostics_ref"].sort();
    const failureEvidenceKeys = [...baseEvidenceKeys, "terminal_failure_ref"].sort();
    if (!exactObjectKeys(subject, ["authorization_id", "kind"])
      || subject.kind !== "authorization" || subject.authorization_id !== CONSTANTS.AUTHORIZATION_ID
      || !exactObjectKeys(outcome, ["decision_source", "next_action", "status"])
      || !["AUTHORIZED", "NOT_AUTHORIZED"].includes(outcome.status)
      || !["controller", "gate"].includes(outcome.decision_source)
      || !["submit-to-the-eye", "return-to-daedalus"].includes(outcome.next_action)
      || (!exactEqual(evidenceKeys, baseEvidenceKeys) && !exactEqual(evidenceKeys, failureEvidenceKeys))
      || !Object.values(evidenceRefs || {}).every(shaRef)) {
      fail("terminal decision is not the exact closed authorization schema.");
    }
    return true;
  }
  fail(`unsupported provisional decision transition ${transition || "<missing>"}.`);
}

export function validateProvisionalDecisionChain(chain) {
  const expectedChainKeys = [
    "authoritative", "compact_authority_claimed", "final_root", "grants_authority", "nodes",
    "nonclaims", "schema_version", "seed", "seed_ref", "status"
  ];
  if (!chain || typeof chain !== "object" || Array.isArray(chain)
    || !exactEqual(Object.keys(chain).sort(), expectedChainKeys)) {
    fail("provisional decision chain is not the exact closed chain shape.");
  }
  if (chain.schema_version !== DECISION_CHAIN_VERSIONS.chain
    || chain.status !== "PROVISIONAL_NON_AUTHORITATIVE"
    || chain.authoritative !== false
    || chain.grants_authority !== false
    || chain.compact_authority_claimed !== false
    || !exactEqual(chain.nonclaims, DECISION_CHAIN_NONCLAIMS)) {
    fail("provisional decision chain authority boundary drifted.");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(chain.seed?.revision_lineage_ref || "")
    || !/^sha256:[0-9a-f]{64}$/.test(chain.seed?.provider_transport_ref || "")) {
    fail("provisional decision chain seed lineage and transport refs must be exact lowercase SHA-256 content references.");
  }
  const expectedSeed = decisionChainSeed({
    revisionLineageRef: chain.seed?.revision_lineage_ref,
    providerTransportRef: chain.seed?.provider_transport_ref
  });
  if (!exactEqual(chain.seed, expectedSeed) || chain.seed_ref !== canonicalRef(expectedSeed)) {
    fail("provisional decision chain seed identity drifted.");
  }
  if (!Array.isArray(chain.nodes)) fail("provisional decision chain nodes are missing.");
  let priorRoot = chain.seed_ref;
  let terminalSeen = false;
  let stateSeen = false;
  let providerTransportDeathSeen = false;
  let seatPrefixLength = 0;
  const seatNodesByModel = new Map();
  for (const [sequence, node] of chain.nodes.entries()) {
    const expectedNodeKeys = [
      "evidence_refs", "new_root", "node_ref", "outcome", "outcome_ref", "prior_root",
      "schema_version", "sequence", "subject", "transition"
    ];
    if (!node || typeof node !== "object" || Array.isArray(node)
      || !exactEqual(Object.keys(node).sort(), expectedNodeKeys)) {
      fail(`provisional decision node ${sequence} is not the exact closed node shape.`);
    }
    if (terminalSeen) fail("provisional decision chain contains a node after its terminal decision.");
    if (node.schema_version !== DECISION_CHAIN_VERSIONS.node || node.sequence !== sequence
      || !["seat", "transport", "state", "terminal"].includes(node.transition)
      || !node.subject || typeof node.subject !== "object" || Array.isArray(node.subject)
      || !node.outcome || typeof node.outcome !== "object" || Array.isArray(node.outcome)
      || !node.evidence_refs || typeof node.evidence_refs !== "object" || Array.isArray(node.evidence_refs)
      || Object.keys(node.evidence_refs).length === 0
      || !Object.values(node.evidence_refs).every((ref) => /^sha256:[0-9a-f]{64}$/.test(ref))) {
      fail(`provisional decision node ${sequence} fields are invalid.`);
    }
    validateDecisionNodeDomain(node);
    if (node.transition === "seat") {
      if (providerTransportDeathSeen || stateSeen) {
        fail("provisional decision chain contains a provider transition after transport death or controller state.");
      }
      const expectedSeat = SEATS[seatPrefixLength];
      if (!expectedSeat || node.subject.model !== expectedSeat.model || node.subject.role !== expectedSeat.role) {
        fail(`provisional decision chain seat nodes must be the exact fixed prefix; expected ${expectedSeat?.model || "<end>"}, received ${node.subject.model}.`);
      }
      seatPrefixLength += 1;
      seatNodesByModel.set(node.subject.model, node);
      if (node.outcome.status === "transport-death") providerTransportDeathSeen = true;
    } else if (node.transition === "transport") {
      if (providerTransportDeathSeen || stateSeen) {
        fail("provisional decision chain permits only a single transport death and no provider transition after death or state.");
      }
      providerTransportDeathSeen = true;
    } else if (node.transition === "state") {
      if (stateSeen) fail("provisional decision chain permits at most one controller state transition.");
      const expectedIncompleteCount = SEATS.length - seatPrefixLength;
      if (node.outcome.incomplete_count !== expectedIncompleteCount) {
        fail(`controller state incomplete count drifted; expected ${expectedIncompleteCount}, received ${node.outcome.incomplete_count}.`);
      }
      stateSeen = true;
    } else if (node.transition === "terminal") {
      const hasTerminalFailure = Object.hasOwn(node.evidence_refs, "terminal_failure_ref");
      const exactTerminalCombination = (
        node.outcome.status === "AUTHORIZED"
        && node.outcome.decision_source === "gate"
        && node.outcome.next_action === "submit-to-the-eye"
        && !hasTerminalFailure
      ) || (
        node.outcome.status === "NOT_AUTHORIZED"
        && node.outcome.decision_source === "gate"
        && node.outcome.next_action === "return-to-daedalus"
        && !hasTerminalFailure
      ) || (
        node.outcome.status === "NOT_AUTHORIZED"
        && node.outcome.decision_source === "controller"
        && node.outcome.next_action === "return-to-daedalus"
        && hasTerminalFailure
      );
      if (!exactTerminalCombination) {
        fail("terminal decision is not an exact legal status/source/action/failure combination.");
      }
      if (node.outcome.status === "AUTHORIZED") {
        const requiredTrioApproved = SEATS
          .filter((seat) => seat.role === "approver")
          .every((seat) => {
            const seatNode = seatNodesByModel.get(seat.model);
            return seatNode?.outcome?.status === "accepted-published"
              && seatNode.outcome.signed === true
              && seatNode.outcome.decision === "approve";
          });
        if (!requiredTrioApproved) {
          fail("AUTHORIZED requires the exact accepted, signed, approving required trio.");
        }
      }
      if (seatPrefixLength < SEATS.length && !stateSeen) {
        fail("terminal decision with remaining incomplete seats requires the exact controller state transition.");
      }
    }
    if (node.prior_root !== priorRoot || node.outcome_ref !== canonicalRef(node.outcome)) {
      fail(`provisional decision node ${sequence} predecessor or outcome ref drifted.`);
    }
    const body = {
      schema_version: node.schema_version,
      sequence: node.sequence,
      transition: node.transition,
      subject: node.subject,
      prior_root: node.prior_root,
      outcome_ref: node.outcome_ref,
      evidence_refs: node.evidence_refs
    };
    if (node.node_ref !== canonicalRef(body)) fail(`provisional decision node ${sequence} content ref drifted.`);
    const expectedRoot = canonicalRef({
      schema_version: DECISION_CHAIN_VERSIONS.root,
      prior_root: node.prior_root,
      node_ref: node.node_ref
    });
    if (node.new_root !== expectedRoot) fail(`provisional decision node ${sequence} Merkle root drifted.`);
    priorRoot = node.new_root;
    terminalSeen = node.transition === "terminal";
  }
  if (chain.final_root !== priorRoot) fail("provisional decision chain final root drifted.");
  return true;
}

export function appendProvisionalDecisionNode(chain, { transition, subject, outcome, evidenceRefs } = {}) {
  validateProvisionalDecisionChain(chain);
  if (chain.nodes.at(-1)?.transition === "terminal") fail("cannot append after the terminal decision node.");
  if (!["seat", "transport", "state", "terminal"].includes(transition)) fail(`unsupported provisional decision transition ${transition || "<missing>"}.`);
  if (!subject || typeof subject !== "object" || Array.isArray(subject)) fail("provisional decision subject must be a closed object.");
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) fail("provisional decision outcome must be a closed object.");
  if (!evidenceRefs || typeof evidenceRefs !== "object" || Array.isArray(evidenceRefs)
    || Object.keys(evidenceRefs).length === 0
    || !Object.values(evidenceRefs).every((ref) => /^sha256:[0-9a-f]{64}$/.test(ref))) {
    fail("provisional decision evidence refs must be a nonempty closed SHA-256 map.");
  }
  const sequence = chain.nodes.length;
  const exactSubject = sortedPlainObject(subject);
  const exactOutcome = sortedPlainObject(outcome);
  const exactEvidenceRefs = sortedPlainObject(evidenceRefs);
  validateDecisionNodeDomain({
    transition,
    subject: exactSubject,
    outcome: exactOutcome,
    evidence_refs: exactEvidenceRefs
  });
  const outcomeRef = canonicalRef(exactOutcome);
  const body = {
    schema_version: DECISION_CHAIN_VERSIONS.node,
    sequence,
    transition,
    subject: exactSubject,
    prior_root: chain.final_root,
    outcome_ref: outcomeRef,
    evidence_refs: exactEvidenceRefs
  };
  const nodeRef = canonicalRef(body);
  const newRoot = canonicalRef({
    schema_version: DECISION_CHAIN_VERSIONS.root,
    prior_root: chain.final_root,
    node_ref: nodeRef
  });
  const node = {
    ...body,
    outcome: exactOutcome,
    node_ref: nodeRef,
    new_root: newRoot
  };
  const nextChain = {
    ...chain,
    seed: { ...chain.seed },
    nonclaims: [...chain.nonclaims],
    nodes: [...chain.nodes.map((entry) => sortedPlainObject(entry)), node],
    final_root: newRoot
  };
  validateProvisionalDecisionChain(nextChain);
  return nextChain;
}

function durableDecisionPublicationRef(filename, seat, packetRawSha256) {
  return canonicalRef({
    schema_version: DURABLE_DECISION_VERSIONS.publication,
    authorization_id: CONSTANTS.AUTHORIZATION_ID,
    candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
    filename,
    seat,
    packet_raw_sha256: packetRawSha256
  });
}

function validateStandaloneDecisionNode(node) {
  const expectedNodeKeys = [
    "evidence_refs", "new_root", "node_ref", "outcome", "outcome_ref", "prior_root",
    "schema_version", "sequence", "subject", "transition"
  ];
  if (!node || typeof node !== "object" || Array.isArray(node)
    || !exactEqual(Object.keys(node).sort(), expectedNodeKeys)
    || node.schema_version !== DECISION_CHAIN_VERSIONS.node
    || !Number.isInteger(node.sequence) || node.sequence < 0
    || !/^sha256:[0-9a-f]{64}$/.test(node.prior_root || "")
    || !["seat", "transport"].includes(node.transition)
    || !node.subject || typeof node.subject !== "object" || Array.isArray(node.subject)
    || !node.outcome || typeof node.outcome !== "object" || Array.isArray(node.outcome)
    || !node.evidence_refs || typeof node.evidence_refs !== "object" || Array.isArray(node.evidence_refs)
    || Object.keys(node.evidence_refs).length === 0
    || !Object.values(node.evidence_refs).every((ref) => /^sha256:[0-9a-f]{64}$/.test(ref))) {
    fail("durable decision envelope node is not an exact seat/transport decision node.");
  }
  validateDecisionNodeDomain(node);
  if (node.outcome_ref !== canonicalRef(node.outcome)) fail("durable decision envelope outcome ref drifted.");
  const body = {
    schema_version: node.schema_version,
    sequence: node.sequence,
    transition: node.transition,
    subject: node.subject,
    prior_root: node.prior_root,
    outcome_ref: node.outcome_ref,
    evidence_refs: node.evidence_refs
  };
  if (node.node_ref !== canonicalRef(body)) fail("durable decision envelope node ref drifted.");
  const expectedRoot = canonicalRef({
    schema_version: DECISION_CHAIN_VERSIONS.root,
    prior_root: node.prior_root,
    node_ref: node.node_ref
  });
  if (node.new_root !== expectedRoot) fail("durable decision envelope node root drifted.");
  return true;
}

function createDurableDecisionEnvelope(nextChain, {
  filename,
  packet = null,
  failure = null,
  signatureSecret = null
} = {}) {
  validateProvisionalDecisionChain(nextChain);
  const node = nextChain.nodes.at(-1);
  if (!node || !["seat", "transport"].includes(node.transition)) {
    fail("durable decision envelope requires a newly prepared seat or transport node.");
  }
  const seat = node.transition === "seat"
    ? { model: node.subject.model, role: node.subject.role }
    : null;
  const envelope = {
    schema_version: DURABLE_DECISION_VERSIONS.envelope,
    status: "PROVISIONAL_NON_AUTHORITATIVE",
    authoritative: false,
    grants_authority: false,
    compact_authority_claimed: false,
    authorization_id: CONSTANTS.AUTHORIZATION_ID,
    build_id: CONSTANTS.BUILD_ID,
    candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
    policy_ref: nextChain.seed.policy_ref,
    revision_lineage_ref: nextChain.seed.revision_lineage_ref,
    provider_transport_ref: nextChain.seed.provider_transport_ref,
    seat,
    packet: packet === null ? null : JSON.parse(JSON.stringify(packet)),
    failure: failure === null ? null : sortedPlainObject(failure),
    decision_node: sortedPlainObject(node),
    new_root: node.new_root
  };
  validateDurableDecisionEnvelope(envelope, filename, { signatureSecret });
  return envelope;
}

export function validateDurableDecisionEnvelope(envelope, filename, { signatureSecret = null } = {}) {
  const exactRevisionLineage = createRevisionLineage();
  const exactRevisionLineageRef = canonicalRef(exactRevisionLineage);
  const exactProviderTransport = createProviderTransportProfile();
  const exactProviderTransportRef = canonicalRef(exactProviderTransport);
  const expectedKeys = [
    "authorization_id", "authoritative", "build_id", "candidate_ref", "compact_authority_claimed",
    "decision_node", "failure", "grants_authority", "new_root", "packet", "policy_ref",
    "provider_transport_ref", "revision_lineage_ref", "schema_version", "seat", "status"
  ];
  if (!exactObjectKeys(envelope, expectedKeys)
    || envelope.schema_version !== DURABLE_DECISION_VERSIONS.envelope
    || envelope.status !== "PROVISIONAL_NON_AUTHORITATIVE"
    || envelope.authoritative !== false
    || envelope.grants_authority !== false
    || envelope.compact_authority_claimed !== false
    || envelope.authorization_id !== CONSTANTS.AUTHORIZATION_ID
    || envelope.build_id !== CONSTANTS.BUILD_ID
    || envelope.candidate_ref !== CONSTANTS.EXPECTED_PLAN_REF
    || envelope.policy_ref !== canonicalRef(DECISION_CHAIN_POLICY)
    || envelope.revision_lineage_ref !== exactRevisionLineageRef
    || envelope.provider_transport_ref !== exactProviderTransportRef
    || typeof filename !== "string" || !OUTPUT_FILES.includes(filename)) {
    fail("durable decision envelope is not the exact closed provisional schema.");
  }
  validateStandaloneDecisionNode(envelope.decision_node);
  if (envelope.new_root !== envelope.decision_node.new_root) fail("durable decision envelope root does not bind its exact node.");
  const node = envelope.decision_node;
  if (filename === "provider-transport.json") {
    if (envelope.seat !== null || node.transition !== "transport") {
      fail("provider transport envelope does not bind the exact transport subject.");
    }
  } else {
    const model = filename.replace(/\.json$/, "");
    const seat = SEATS.find((entry) => entry.model === model);
    const expectedSequence = SEATS.findIndex((entry) => entry.model === model);
    if (!seat || node.transition !== "seat" || !exactEqual(envelope.seat, seat)
      || node.sequence !== expectedSequence
      || !exactEqual(node.subject, { kind: "seat", model: seat.model, role: seat.role })) {
      fail("seat decision envelope does not bind its fixed filename, seat, and serial sequence.");
    }
  }
  if (node.outcome.status === "accepted-published") {
    const packetVerificationDefects = acceptedPacketVerificationDefects(
      envelope.packet,
      envelope.seat,
      signatureSecret
    );
    if (packetVerificationDefects.length > 0) {
      fail("accepted durable decision envelope packet/signature schema or HMAC secret validation failed.");
    }
    const responseId = envelope.packet?.provenance?.response_id;
    const routedIdentityDefects = routedProviderIdentityDefects(
      envelope.seat?.model,
      envelope.seat?.role,
      envelope.packet
    );
    if (!envelope.packet || typeof envelope.packet !== "object" || Array.isArray(envelope.packet)
      || envelope.failure !== null || envelope.packet.model !== envelope.seat.model
      || envelope.packet.role !== envelope.seat.role
      || envelope.packet.decision !== node.outcome.decision
      || envelope.packet.proposal_ref !== envelope.candidate_ref
      || envelope.packet.build_id !== envelope.build_id
      || envelope.packet.use_case !== CONSTANTS.USE_CASE
      || envelope.packet.revision_lineage_ref !== envelope.revision_lineage_ref
      || envelope.packet.provider_transport_ref !== envelope.provider_transport_ref
      || !envelope.packet.revision_lineage || typeof envelope.packet.revision_lineage !== "object"
      || Array.isArray(envelope.packet.revision_lineage)
      || !envelope.packet.provider_transport || typeof envelope.packet.provider_transport !== "object"
      || Array.isArray(envelope.packet.provider_transport)
      || canonicalRef(envelope.packet.revision_lineage) !== envelope.revision_lineage_ref
      || canonicalRef(envelope.packet.provider_transport) !== envelope.provider_transport_ref
      || !exactEqual(envelope.packet.revision_lineage, exactRevisionLineage)
      || !exactEqual(envelope.packet.provider_transport, exactProviderTransport)
      || envelope.packet.provider_preload_raw_sha256 !== envelope.packet.provider_transport?.preload_raw_sha256
      || typeof responseId !== "string" || !responseId.trim() || responseId !== responseId.trim()
      || routedIdentityDefects.length > 0) {
      fail("accepted durable decision envelope requires exact packet/node, candidate, lineage, transport, and routed provider identity correspondence.");
    }
    const packetRawSha256 = rawSha256(jsonBytes(envelope.packet));
    if (node.evidence_refs.packet_raw_sha256 !== packetRawSha256
      || node.evidence_refs.publication_ref !== durableDecisionPublicationRef(filename, envelope.seat, packetRawSha256)) {
      fail("accepted durable decision envelope packet evidence drifted.");
    }
  } else {
    if (envelope.packet !== null || !envelope.failure) {
      fail("failed durable decision envelope requires null packet and a sanitized failure.");
    }
    validateSanitizedFailureProjection(envelope.failure);
    if (node.outcome.reason_code !== envelope.failure.reason_code
      || node.evidence_refs.failure_ref !== canonicalRef(envelope.failure)
      || envelope.failure.terminal !== (node.outcome.status === "transport-death")) {
      fail("failed durable decision envelope failure evidence drifted.");
    }
  }
  return true;
}

function validateExactJsonPublication(publication, intendedValue, outputDirectory, filename, validateParsed = null) {
  if (typeof outputDirectory !== "string" || !outputDirectory
    || typeof filename !== "string" || path.basename(filename) !== filename
    || !OUTPUT_FILES.includes(filename)) {
    fail("exact JSON publication validation requires a closed output directory and filename.");
  }
  const expectedPath = path.join(outputDirectory, filename);
  const expectedBytes = Buffer.from(jsonBytes(intendedValue), "utf8");
  const expectedRawSha256 = rawSha256(expectedBytes);
  if (!exactObjectKeys(publication, ["path", "raw_sha256"])
    || publication.path !== expectedPath
    || publication.raw_sha256 !== expectedRawSha256) {
    fail(`exact JSON publication receipt path or hash drifted for ${filename}.`);
  }
  let targetStatus;
  try {
    targetStatus = lstatSync(expectedPath);
  } catch {
    fail(`exact JSON publication target is missing for ${filename}.`);
  }
  if (!targetStatus.isFile() || targetStatus.isSymbolicLink()) {
    fail(`exact JSON publication target is not a regular non-symlink file for ${filename}.`);
  }
  let actualBytes;
  try {
    actualBytes = readFileSync(expectedPath);
  } catch {
    fail(`exact JSON publication target read-back failed for ${filename}.`);
  }
  if (!actualBytes.equals(expectedBytes) || rawSha256(actualBytes) !== expectedRawSha256) {
    fail(`exact JSON publication target bytes or hash drifted for ${filename}.`);
  }
  let parsed;
  try {
    parsed = JSON.parse(actualBytes.toString("utf8"));
  } catch {
    fail(`exact JSON publication target is not valid JSON for ${filename}.`);
  }
  if (typeof validateParsed === "function") validateParsed(parsed);
  if (!exactEqual(parsed, intendedValue)) {
    fail(`exact JSON publication parsed value drifted for ${filename}.`);
  }
  return Object.freeze({
    path: expectedPath,
    raw_sha256: expectedRawSha256,
    raw_bytes: Buffer.from(actualBytes),
    value: parsed
  });
}

export function validateDurableDecisionPublication(
  publication,
  envelope,
  outputDirectory,
  filename,
  { signatureSecret = null } = {}
) {
  validateDurableDecisionEnvelope(envelope, filename, { signatureSecret });
  return validateExactJsonPublication(
    publication,
    envelope,
    outputDirectory,
    filename,
    (parsed) => validateDurableDecisionEnvelope(parsed, filename, { signatureSecret })
  );
}

let cachedHeldProviderSourceGraph = null;

function gitBuffer(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], {
    encoding: null,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    fail(`Git held-source capture failed for ${args.join(" ")}: ${boundedText(result.stderr?.toString("utf8") || "unknown Git error")}`);
  }
  return Buffer.from(result.stdout);
}

function publicHeldGraph(held) {
  return {
    module_source_commit: held.module_source_commit,
    object_format: held.object_format,
    entries: held.entries.map(({ source: _source, ...entry }) => ({ ...entry })),
    local_edges: held.local_edges.map((edge) => ({ ...edge })),
    allowed_builtins: [...held.allowed_builtins],
    parent_roots: [...held.parent_roots],
    graph_ref: held.graph_ref
  };
}

function validateHeldProviderSourceEntry(actual, expected) {
  const { source, ...identity } = actual || {};
  if (!Buffer.isBuffer(source) || !exactEqual(identity, expected)) {
    fail(`held provider source identity drifted for ${expected.path}.`);
  }
  if (source.length !== expected.byte_length || rawSha256(source) !== expected.raw_sha256) {
    fail(`held provider source bytes drifted for ${expected.path}.`);
  }
  const blobOid = createHash("sha1")
    .update(`blob ${source.length}\0`)
    .update(source)
    .digest("hex");
  if (`git:${blobOid}` !== expected.blob) fail(`held provider Git blob identity drifted for ${expected.path}.`);
  return true;
}

function validateHeldGraphSources(held) {
  if (!held || !Array.isArray(held.entries) || held.entries.length !== HELD_PROVIDER_SOURCE_DESCRIPTORS.length) {
    fail("held provider graph must contain the exact closed source set.");
  }
  for (let index = 0; index < HELD_PROVIDER_SOURCE_DESCRIPTORS.length; index += 1) {
    const expected = HELD_PROVIDER_SOURCE_DESCRIPTORS[index];
    const actual = held.entries[index];
    validateHeldProviderSourceEntry(actual, expected);
  }
  const graphIdentity = {
    module_source_commit: held.module_source_commit,
    object_format: held.object_format,
    entries: held.entries.map(({ source: _source, ...entry }) => entry),
    local_edges: held.local_edges,
    allowed_builtins: held.allowed_builtins,
    parent_roots: held.parent_roots
  };
  if (canonicalRef(graphIdentity) !== held.graph_ref) fail("held provider source graph reference drifted.");
  return true;
}

export function captureHeldProviderSourceGraph({ root = ROOT, moduleSourceCommit = MODULE_SOURCE_COMMIT } = {}) {
  if (root === ROOT && moduleSourceCommit === MODULE_SOURCE_COMMIT && cachedHeldProviderSourceGraph) {
    return cachedHeldProviderSourceGraph;
  }
  if (moduleSourceCommit !== MODULE_SOURCE_COMMIT) fail("held provider sources require the pinned reachable module-source commit.");
  const objectFormat = gitBuffer(root, ["rev-parse", "--show-object-format"]).toString("utf8").trim();
  if (objectFormat !== "sha1") fail(`unsupported Git object format ${objectFormat || "<missing>"} for held source capture.`);
  const paths = HELD_PROVIDER_SOURCE_DESCRIPTORS.map((entry) => entry.path);
  const treeRecords = gitBuffer(root, ["ls-tree", "-rz", moduleSourceCommit, "--", ...paths])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const treeByPath = new Map(treeRecords.map((record) => {
    const tab = record.indexOf("\t");
    const [mode, type, oid] = record.slice(0, tab).split(" ");
    return [record.slice(tab + 1), { mode, type, oid }];
  }));
  const entries = HELD_PROVIDER_SOURCE_DESCRIPTORS.map((descriptor) => {
    const tree = treeByPath.get(descriptor.path);
    if (!tree || tree.mode !== descriptor.mode || tree.type !== descriptor.type || `git:${tree.oid}` !== descriptor.blob) {
      fail(`pinned held-source tree identity drifted for ${descriptor.path}.`);
    }
    const source = gitBuffer(root, ["cat-file", "blob", `${moduleSourceCommit}:${descriptor.path}`]);
    const entry = Object.freeze({ ...descriptor, source });
    const imported = [];
    const sourceText = source.toString("utf8");
    const staticPattern = /^\s*import\b[\s\S]*?\sfrom\s*["']([^"']+)["'];/gm;
    const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
    let match;
    while ((match = staticPattern.exec(sourceText)) !== null) imported.push(match[1]);
    while ((match = dynamicPattern.exec(sourceText)) !== null) imported.push(match[1]);
    const localImports = imported.filter((specifier) => specifier.startsWith(".")).sort();
    const expectedLocal = HELD_PROVIDER_LOCAL_EDGES
      .filter((edge) => edge.parent === descriptor.path)
      .map((edge) => edge.specifier)
      .sort();
    if (!exactEqual(localImports, expectedLocal)) fail(`closed local import graph drifted for ${descriptor.path}.`);
    const invalidBuiltin = imported.find((specifier) => specifier.startsWith("node:") && !HELD_PROVIDER_BUILTINS.includes(specifier));
    const bareImport = imported.find((specifier) => !specifier.startsWith(".") && !specifier.startsWith("node:"));
    if (invalidBuiltin || bareImport) fail(`unallowlisted provider import ${invalidBuiltin || bareImport} in ${descriptor.path}.`);
    return entry;
  });
  const graphIdentity = {
    module_source_commit: `git:${moduleSourceCommit}`,
    object_format: objectFormat,
    entries: entries.map(({ source: _source, ...entry }) => entry),
    local_edges: HELD_PROVIDER_LOCAL_EDGES,
    allowed_builtins: HELD_PROVIDER_BUILTINS,
    parent_roots: HELD_PARENT_ROOTS
  };
  const held = Object.freeze({
    ...graphIdentity,
    entries: Object.freeze(entries),
    graph_ref: canonicalRef(graphIdentity)
  });
  validateHeldGraphSources(held);
  if (root === ROOT && moduleSourceCommit === MODULE_SOURCE_COMMIT) cachedHeldProviderSourceGraph = held;
  return held;
}

export function installHeldProviderModuleHooks(held, { root = ROOT, register = registerHooks } = {}) {
  validateHeldGraphSources(held);
  if (typeof register !== "function") fail("held provider module execution requires node:module.registerHooks.");
  const ownedEntries = held.entries.map((entry) => {
    const { source, ...identity } = entry;
    return Object.freeze({ ...identity, source: Buffer.from(source) });
  });
  const sourceByUrl = new Map(ownedEntries.map((entry) => [
    pathToFileURL(path.join(root, entry.path)).href,
    entry
  ]));
  const rootUrls = new Map(held.parent_roots.map((relative) => [relative, pathToFileURL(path.join(root, relative)).href]));
  const edgeByParentAndSpecifier = new Map(held.local_edges.map((edge) => [
    `${pathToFileURL(path.join(root, edge.parent)).href}\0${edge.specifier}`,
    pathToFileURL(path.join(root, edge.target)).href
  ]));
  const loaded = new Set();
  const registered = register({
    resolve(specifier, context, nextResolve) {
      const parentUrl = context.parentURL;
      if (specifier.startsWith("node:")) {
        if (parentUrl && sourceByUrl.has(parentUrl) && !held.allowed_builtins.includes(specifier)) {
          throw new Error(`HELD_PROVIDER_IMPORT_BLOCKED: ${specifier} from ${parentUrl}`);
        }
        return nextResolve(specifier, context);
      }
      if (parentUrl && sourceByUrl.has(parentUrl)) {
        const target = edgeByParentAndSpecifier.get(`${parentUrl}\0${specifier}`);
        if (!target) throw new Error(`HELD_PROVIDER_IMPORT_BLOCKED: ${specifier} from ${parentUrl}`);
        return { url: target, format: "module", shortCircuit: true };
      }
      const candidate = specifier.startsWith("file:")
        ? specifier
        : path.isAbsolute(specifier) ? pathToFileURL(specifier).href : null;
      if (candidate && [...rootUrls.values()].includes(candidate)) {
        return { url: candidate, format: "module", shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      const entry = sourceByUrl.get(url);
      if (!entry) return nextLoad(url, context);
      const expected = HELD_PROVIDER_SOURCE_DESCRIPTORS.find(({ path: relative }) => relative === entry.path);
      validateHeldProviderSourceEntry(entry, expected);
      loaded.add(entry.path);
      return { format: "module", source: Buffer.from(entry.source), shortCircuit: true };
    }
  });
  return Object.freeze({
    importRoot(relative) {
      const url = rootUrls.get(relative);
      if (!url) fail(`held provider import root ${relative} is not allowlisted.`);
      return import(url);
    },
    assertAllParentSourcesLoaded() {
      const expected = held.entries.map((entry) => entry.path).filter((relative) => relative !== "connectors/ai-peer-mcp/server.mjs");
      const missing = expected.filter((relative) => !loaded.has(relative));
      if (missing.length > 0) fail(`held parent source graph did not load: ${missing.join(", ")}.`);
      return true;
    },
    deregister() { registered.deregister(); }
  });
}

export function createHeldProviderChildBootstrap(held, { root = ROOT } = {}) {
  validateHeldGraphSources(held);
  const childPaths = ["connectors/ai-peer-mcp/server.mjs", "connectors/ai-peer-mcp/lib.mjs"];
  const payload = childPaths.map((relative) => {
    const entry = held.entries.find(({ path: entryPath }) => entryPath === relative);
    return {
      path: relative,
      url: pathToFileURL(path.join(root, relative)).href,
      absolute_path: path.join(root, relative),
      blob: entry.blob,
      byte_length: entry.byte_length,
      raw_sha256: entry.raw_sha256,
      source_base64: entry.source.toString("base64")
    };
  });
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  const fetchBody = PROVIDER_FETCH_PRELOAD_SOURCE.replace('import { Agent, request } from "node:https";\n', "");
  const bootstrapSource = `import { registerHooks } from "node:module";
import { createHash } from "node:crypto";
import { Agent, request } from "node:https";
const payload = JSON.parse(Buffer.from(${JSON.stringify(encodedPayload)}, "base64").toString("utf8"));
const byUrl = new Map();
function validateHeldChildSource(entry) {
  const source = entry?.source;
  if (!Buffer.isBuffer(source)) throw new Error("HELD_CHILD_SOURCE_NOT_BUFFER: " + (entry?.path || "<missing>"));
  const digest = "sha256:" + createHash("sha256").update(source).digest("hex");
  const blob = "git:" + createHash("sha1").update("blob " + source.length + "\\0").update(source).digest("hex");
  if (source.length !== entry.byte_length || digest !== entry.raw_sha256 || blob !== entry.blob) {
    throw new Error("HELD_CHILD_SOURCE_IDENTITY_MISMATCH: " + entry.path);
  }
  return true;
}
for (const entry of payload) {
  const owned = { ...entry, source: Buffer.from(Buffer.from(entry.source_base64, "base64")) };
  validateHeldChildSource(owned);
  byUrl.set(entry.url, owned);
}
const server = payload.find((entry) => entry.path === "connectors/ai-peer-mcp/server.mjs");
const library = payload.find((entry) => entry.path === "connectors/ai-peer-mcp/lib.mjs");
const allowedBuiltins = new Set(["node:child_process", "node:crypto", "node:https", "node:url"]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("node:")) {
      if (context.parentURL && byUrl.has(context.parentURL) && !allowedBuiltins.has(specifier)) throw new Error("HELD_CHILD_IMPORT_BLOCKED: " + specifier);
      return nextResolve(specifier, context);
    }
    if (!context.parentURL && (specifier === server.absolute_path || specifier === server.url)) return { url: server.url, format: "module", shortCircuit: true };
    if (context.parentURL === server.url && specifier === "./lib.mjs") return { url: library.url, format: "module", shortCircuit: true };
    if (context.parentURL && byUrl.has(context.parentURL)) throw new Error("HELD_CHILD_IMPORT_BLOCKED: " + specifier);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const entry = byUrl.get(url);
    if (!entry) return nextLoad(url, context);
    validateHeldChildSource(entry);
    return { format: "module", source: Buffer.from(entry.source), shortCircuit: true };
  }
});
${fetchBody}`;
  const preloadDataUrl = `data:text/javascript;base64,${Buffer.from(bootstrapSource, "utf8").toString("base64")}`;
  if (preloadDataUrl.length >= 120 * 1024) fail("held child bootstrap exceeds the conservative argv-size budget.");
  return Object.freeze({
    bootstrap_source: bootstrapSource,
    bootstrap_raw_sha256: rawSha256(bootstrapSource),
    preload_data_url: preloadDataUrl,
    child_args: Object.freeze(["--import", preloadDataUrl, payload[0].absolute_path])
  });
}

function pendingPublicationName(filename) {
  if (!OUTPUT_FILES.includes(filename) || path.basename(filename) !== filename) {
    fail(`atomic publication target ${filename || "<missing>"} is not a closed authorization output.`);
  }
  return `.authz-013-${filename}.pending`;
}

function syncDirectoryWhereSupported(directory, fsOps) {
  let directoryFd;
  try {
    directoryFd = fsOps.openSync(directory, "r");
    fsOps.fsyncSync(directoryFd);
  } catch (error) {
    const unsupportedOnWindows = process.platform === "win32"
      && ["EINVAL", "ENOTSUP", "EISDIR", "EPERM"].includes(error?.code);
    if (!unsupportedOnWindows) throw error;
  } finally {
    if (directoryFd !== undefined) fsOps.closeSync(directoryFd);
  }
}

export function publishAtomicExclusiveJson(directory, filename, value, { fsOps = ATOMIC_FS_OPS } = {}) {
  if (typeof directory !== "string" || !directory) fail("atomic publication requires an explicit directory.");
  const pending = path.join(directory, pendingPublicationName(filename));
  const target = path.join(directory, filename);
  const bytes = Buffer.from(jsonBytes(value), "utf8");
  let fd;
  try {
    fd = fsOps.openSync(pending, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const written = fsOps.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isInteger(written) || written <= 0) fail(`atomic publication made no write progress for ${filename}.`);
      offset += written;
    }
    fsOps.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fsOps.closeSync(fd);
  }
  fsOps.linkSync(pending, target);
  syncDirectoryWhereSupported(directory, fsOps);
  fsOps.unlinkSync(pending);
  syncDirectoryWhereSupported(directory, fsOps);
  return Object.freeze({ path: target, raw_sha256: rawSha256(bytes) });
}

export function claimAuthorizationAttempt(directory, { fsOps = ATOMIC_FS_OPS } = {}) {
  if (typeof directory !== "string" || !directory) fail("authorization attempt claim requires an explicit directory.");
  const claimPath = path.join(directory, ".authz-013-attempt.claim");
  const bytes = Buffer.from(`${CONSTANTS.AUTHORIZATION_ID}\n`, "utf8");
  let fd;
  try {
    fd = fsOps.openSync(claimPath, "wx", 0o600);
    let offset = 0;
    while (offset < bytes.length) {
      const written = fsOps.writeSync(fd, bytes, offset, bytes.length - offset);
      if (!Number.isInteger(written) || written <= 0) fail("authorization attempt claim made no write progress.");
      offset += written;
    }
    fsOps.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fsOps.closeSync(fd);
  }
  syncDirectoryWhereSupported(directory, fsOps);
  let released = false;
  return Object.freeze({
    path: claimPath,
    release() {
      if (released) fail("authorization attempt claim was already released.");
      fsOps.unlinkSync(claimPath);
      syncDirectoryWhereSupported(directory, fsOps);
      released = true;
    }
  });
}

export function assertPinnedTransportPlatform(platform = process.platform) {
  if (platform !== "linux") {
    fail(`AUTHZ-013 pinned provider transport is native Linux-only; refusing ${platform || "unknown"} before registry hydration or provider execution.`);
  }
  return true;
}

export function createProviderTransportProfile(_ambientEnvironment = process.env, {
  heldGraph = null
} = {}) {
  assertPinnedTransportPlatform();
  const exactHeldGraph = heldGraph || captureHeldProviderSourceGraph();
  const childExecution = createHeldProviderChildBootstrap(exactHeldGraph);
  const profile = {
    schema_version: "telos.local-provider-transport-evidence.provisional.v1",
    status: "PROVISIONAL_LOCAL_EVIDENCE",
    authoritative: false,
    grants_authority: false,
    host_platform_policy: {
      supported_platform: "linux",
      native_linux_only: true,
      win32_behavior: "fail-closed-before-preflight-or-live-provider-execution",
      registry_hydration: "unreachable-by-policy"
    },
    claim: "No client-set elapsed cap for current direct HTTPS POST calls.",
    implementation: "node:https-buffered-direct-post",
    runtime: {
      exec_path: process.execPath,
      node_version: process.version,
      platform: process.platform,
      architecture: process.arch
    },
    agent: {
      implementation: "node:https.Agent",
      options: { keepAlive: false, timeout: 0 },
      uses_global_agent: false,
      meaning: "No client-set elapsed cap for current direct HTTPS POST calls."
    },
    support_constraints: {
      protocol: "https:",
      method: "POST",
      request_input: "string-or-URL-only",
      request_body: "buffered-string-buffer-arraybuffer-view-or-arraybuffer",
      response_body: "fully-buffered-before-Response",
      redirects: "unsupported-fail-closed",
      request_object_input: "unsupported-fail-closed",
      abort_semantics: "unsupported-fail-closed",
      fetch_semantics_claimed: false
    },
    fetch_adapter_raw_sha256: rawSha256(PROVIDER_FETCH_PRELOAD_SOURCE),
    preload_raw_sha256: childExecution.bootstrap_raw_sha256,
    preload_value: "omitted-by-size; deterministically derived from the exact held child source buffers and this public policy",
    child_entry_url: pathToFileURL(path.join(ROOT, "connectors/ai-peer-mcp/server.mjs")).href,
    child_argv_shape: ["--import", "<held-child-bootstrap-data-url>", "<held-server-entry-path>"],
    source_graph: publicHeldGraph(exactHeldGraph),
    hook_policy: {
      mode: "node-v24-synchronous-register-hooks-closed-held-source-map",
      local_resolution: "exact-parent-specifier-edge-allowlist",
      local_loads: "held-buffers-only",
      builtin_resolution: "exact-node-prefix-allowlist-via-next-resolve",
      parent_expected_load_count: 14,
      child_expected_load_count: 2,
      mutable_path_execution: false
    },
    execution_nonclaims: [
      "Does not attest the Node runtime, operating system kernel, Git executable, or repository object database as trust roots.",
      "Does not claim ratified schema authority or provider-response truth beyond separately validated packets.",
      "Does not claim a closed Windows child; native win32 is rejected before preflight or live provider execution."
    ],
    environment: {
      mode: "closed-allowlist-with-secret-values-omitted-from-evidence",
      inherits_parent_environment: false,
      exact_non_secret_values: { ...PROVIDER_EXACT_NON_SECRET_ENVIRONMENT },
      credential_variable_names: [...PROVIDER_CREDENTIAL_VARIABLE_NAMES],
      credential_presence_policy: {
        claude: { at_least_one_of: ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"] },
        codex: { required: "OPENAI_API_KEY" },
        grok: {
          optional: "XAI_API_KEY",
          role: "advisory",
          missing_behavior: "per-seat-failure-non-veto"
        },
        gemini: {
          optional: "GEMINI_API_KEY",
          role: "advisory",
          missing_behavior: "per-seat-failure-non-veto"
        }
      },
      denied_ambient_variable_names: [...PROVIDER_DENIED_AMBIENT_VARIABLES]
    }
  };
  Object.defineProperties(profile, {
    preload_data_url: { value: childExecution.preload_data_url, enumerable: false },
    child_args: { value: childExecution.child_args, enumerable: false }
  });
  return profile;
}

function presentSecret(environment, name) {
  const value = environment?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createProviderChildEnvironment(ambientEnvironment = process.env) {
  const claudeToken = presentSecret(ambientEnvironment, "ANTHROPIC_AUTH_TOKEN");
  const claudeKey = presentSecret(ambientEnvironment, "ANTHROPIC_API_KEY");
  if (!claudeToken && !claudeKey) {
    fail("ANTHROPIC_AUTH_TOKEN or ANTHROPIC_API_KEY is required before spawn.");
  }
  if (!presentSecret(ambientEnvironment, "OPENAI_API_KEY")) fail("OPENAI_API_KEY is required before spawn.");
  const closed = { ...PROVIDER_EXACT_NON_SECRET_ENVIRONMENT };
  for (const name of PROVIDER_CREDENTIAL_VARIABLE_NAMES) {
    const value = presentSecret(ambientEnvironment, name);
    if (value !== null) closed[name] = value;
  }
  return closed;
}

function validateClosedProviderEnvironment(childEnvironment) {
  if (!childEnvironment || typeof childEnvironment !== "object" || Array.isArray(childEnvironment)) {
    fail("provider child environment must be a closed object.");
  }
  const allowed = new Set([
    ...Object.keys(PROVIDER_EXACT_NON_SECRET_ENVIRONMENT),
    ...PROVIDER_CREDENTIAL_VARIABLE_NAMES
  ]);
  for (const [name, value] of Object.entries(childEnvironment)) {
    if (!allowed.has(name)) fail(`provider child environment contains non-allowlisted variable ${name}.`);
    if (typeof value !== "string") fail(`provider child environment variable ${name} must be a string.`);
  }
  for (const [name, value] of Object.entries(PROVIDER_EXACT_NON_SECRET_ENVIRONMENT)) {
    if (childEnvironment[name] !== value) fail(`provider child environment exact value drifted for ${name}.`);
  }
  createProviderChildEnvironment(childEnvironment);
  return true;
}

export function spawnProviderMcpTransport({
  command,
  args,
  childEnvironment,
  spawn = nodeSpawn,
  createClient
}) {
  validateClosedProviderEnvironment(childEnvironment);
  if (typeof command !== "string" || !command) fail("provider child command must be explicit.");
  if (!Array.isArray(args) || args.some((entry) => typeof entry !== "string")) fail("provider child arguments must be explicit strings.");
  if (typeof spawn !== "function" || typeof createClient !== "function") fail("provider child transport requires spawn and client constructors.");
  const child = spawn(command, args, {
    env: childEnvironment,
    stdio: ["pipe", "pipe", "ignore"]
  });
  let client;
  try {
    client = createClient({
      send: (value) => child.stdin.write(value),
      onData: (callback) => child.stdout.on("data", callback),
      framing: "content-length"
    });
  } catch (error) {
    try { child.kill(); } catch {}
    throw error;
  }
  return { client, child, close: () => child.kill() };
}

export function loadExactReviewInputs({ root = ROOT, readFile = readFileSync } = {}) {
  const planBytes = readFile(path.join(root, PLAN_PATH));
  const specBytes = readFile(path.join(root, SPEC_PATH));
  if (!Buffer.isBuffer(planBytes) || !Buffer.isBuffer(specBytes)) fail("exact review input loader requires raw Buffer reads.");
  const planRawSha256 = rawSha256(planBytes);
  const specRawSha256 = rawSha256(specBytes);
  const planText = planBytes.toString("utf8");
  const specText = specBytes.toString("utf8");
  const candidateRef = canonicalRef({ kind: "candidate", plan: planText });
  if (planRawSha256 !== PLAN_IDENTITY.raw_sha256) fail("exact live plan bytes do not match the pinned raw SHA-256.");
  if (candidateRef !== PLAN_IDENTITY.candidate_ref) fail("exact live plan bytes do not match the pinned canonical candidate.");
  if (specRawSha256 !== CONSTANTS.DESIGN_RAW_SHA256) fail("exact live design bytes do not match the pinned raw SHA-256.");
  return Object.freeze({
    plan_text: planText,
    spec_text: specText,
    plan_raw_sha256: planRawSha256,
    spec_raw_sha256: specRawSha256,
    candidate_ref: candidateRef
  });
}

export function createAgyReviewBinding(reviewInputs) {
  const binding = {
    schema_version: "telos.local-agy-review-input-binding.provisional.v1",
    authoritative: false,
    grants_authority: false,
    candidate_ref: reviewInputs?.candidate_ref,
    plan: {
      path: PLAN_PATH,
      raw_sha256: reviewInputs?.plan_raw_sha256,
      text: reviewInputs?.plan_text
    },
    design: {
      path: SPEC_PATH,
      raw_sha256: reviewInputs?.spec_raw_sha256,
      text: reviewInputs?.spec_text
    }
  };
  if (binding.candidate_ref !== CONSTANTS.EXPECTED_PLAN_REF
    || binding.plan.raw_sha256 !== PLAN_IDENTITY.raw_sha256
    || binding.design.raw_sha256 !== CONSTANTS.DESIGN_RAW_SHA256
    || typeof binding.plan.text !== "string"
    || typeof binding.design.text !== "string"
    || rawSha256(binding.plan.text) !== binding.plan.raw_sha256
    || rawSha256(binding.design.text) !== binding.design.raw_sha256
    || canonicalRef({ kind: "candidate", plan: binding.plan.text }) !== binding.candidate_ref) {
    fail("Agy review binding does not match the exact captured plan and design identities.");
  }
  return binding;
}

export function validateAgyCheckpointBinding(checkpoint, binding, { attest } = {}) {
  if (typeof attest !== "function") fail("Agy exact attester is required for checkpoint validation.");
  const expectedKeys = [
    "blocked_reasons",
    "current_owner",
    "do_not_proceed_if",
    "missing_packets",
    "next_owner",
    "packet_type",
    "phase",
    "phase_gate_status",
    "provenance",
    "queue_counts",
    "safe_next_action",
    "scope"
  ];
  if (!checkpoint || typeof checkpoint !== "object" || Array.isArray(checkpoint)
    || !exactEqual(Object.keys(checkpoint).sort(), expectedKeys)) {
    fail("Agy checkpoint schema is not the exact closed connector result.");
  }
  const stringArray = (value) => Array.isArray(value) && value.every((entry) => typeof entry === "string");
  if (checkpoint.packet_type !== "agy-checkpoint"
    || typeof checkpoint.phase !== "string"
    || typeof checkpoint.scope !== "string"
    || typeof checkpoint.current_owner !== "string"
    || !checkpoint.queue_counts || typeof checkpoint.queue_counts !== "object" || Array.isArray(checkpoint.queue_counts)
    || !["advance", "blocked"].includes(checkpoint.phase_gate_status)
    || typeof checkpoint.next_owner !== "string"
    || !stringArray(checkpoint.missing_packets)
    || !stringArray(checkpoint.blocked_reasons)
    || typeof checkpoint.safe_next_action !== "string"
    || !stringArray(checkpoint.do_not_proceed_if)) {
    fail("Agy checkpoint schema contains invalid exact connector fields.");
  }
  if (checkpoint?.scope !== canonicalize(binding)) {
    fail("Agy checkpoint is not bound to the exact review inputs.");
  }
  const { provenance, ...bareCheckpoint } = checkpoint || {};
  const checkpointRef = canonicalRef(bareCheckpoint);
  const expectedAttestation = attest(bareCheckpoint);
  if (!exactEqual(provenance, expectedAttestation)) {
    fail("Agy checkpoint full local deterministic attestation does not exactly match the returned checkpoint.");
  }
  return {
    agy_review_input_ref: canonicalRef(binding),
    agy_checkpoint_ref: checkpointRef,
    response_id: expectedAttestation.response_id
  };
}

export async function runDurableAuthorizationPhase({ execute, persistFailure } = {}) {
  if (typeof execute !== "function" || typeof persistFailure !== "function") {
    fail("durable authorization phase requires execute and persistFailure callbacks.");
  }
  try {
    return await execute();
  } catch (error) {
    return await persistFailure(error);
  }
}

function exactEqual(actual, expected) {
  return canonicalize(actual) === canonicalize(expected);
}

function fail(message) {
  throw new Error(`AUTHORIZATION PREFLIGHT FAILED: ${message}`);
}

export function createRevisionLineage() {
  return {
    schema_version: "telos.authorization-revision-lineage.provisional.v1",
    node_type: "authorization-revision-lineage",
    status: "PROVISIONAL_NON_AUTHORITATIVE",
    authoritative: false,
    grants_authority: false,
    authority_predecessor: CONSTANTS.AUTHORITY_PREDECESSOR,
    mutation_of: CONSTANTS.MUTATION_OF,
    prior_candidate_ref: CONSTANTS.PRIOR_CANDIDATE_REF,
    candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
    plan: {
      path: PLAN_PATH,
      commit: PLAN_IDENTITY.commit,
      parent: PLAN_IDENTITY.parent,
      tree: PLAN_IDENTITY.tree,
      blob: PLAN_IDENTITY.blob,
      raw_sha256: PLAN_IDENTITY.raw_sha256
    },
    design: {
      path: SPEC_PATH,
      blob: CONSTANTS.DESIGN_BLOB,
      raw_sha256: CONSTANTS.DESIGN_RAW_SHA256
    },
    prior_attempt: {
      authorization_id: CONSTANTS.MUTATION_OF,
      commit: CONSTANTS.PRIOR_ATTEMPT_COMMIT,
      parent: CONSTANTS.PRIOR_ATTEMPT_PARENT,
      repository_tree: CONSTANTS.PRIOR_ATTEMPT_TREE,
      attempt_directory_tree: CONSTANTS.PRIOR_ATTEMPT_DIRECTORY_TREE,
      summary_raw_sha256: CONSTANTS.PRIOR_SUMMARY_RAW_SHA256,
      summary_canonical_ref: CONSTANTS.PRIOR_SUMMARY_CANONICAL_REF,
      complete_disk_tree_ref: CONSTANTS.PRIOR_DISK_TREE_REF,
      retry_node_raw_sha256: CONSTANTS.PRIOR_RETRY_RAW_SHA256,
      retry_node_canonical_ref: CONSTANTS.PRIOR_RETRY_CANONICAL_REF
    }
  };
}

export function validateRevisionLineage(lineage, lineageRef) {
  const expected = createRevisionLineage();
  if (!exactEqual(Object.keys(lineage || {}).sort(), REVISION_LINEAGE_KEYS.slice().sort())) {
    fail("revision lineage is not a closed object with the exact required fields.");
  }
  if (!exactEqual(lineage, expected)) {
    fail("revision lineage bindings do not exactly match authz-012 -> authz-013.");
  }
  if (lineage.extends !== undefined || lineage.retry_of !== undefined) {
    fail("revision lineage must use mutation_of and must not use extends or retry_of.");
  }
  if (lineage.authoritative !== false || lineage.grants_authority !== false) {
    fail("revision lineage must remain provisional, non-authoritative, and authority-free.");
  }
  if (lineageRef !== canonicalRef(lineage)) {
    fail("revision lineage ref is not the canonical content-addressed identity.");
  }
  return true;
}

export function validatePlanIdentity(identity) {
  if (!exactEqual(identity, PLAN_IDENTITY)) fail("plan identity does not match the exact reviewed commit/tree/blob/candidate bindings.");
  return true;
}

function priorSummaryProjection(summary) {
  return {
    authorization_id: summary?.authorization_id,
    build_id: summary?.build_id,
    plan_ref: summary?.plan_ref,
    authorized: summary?.authorized,
    authorization: {
      status: summary?.authorization?.status,
      plan_ref: summary?.authorization?.plan_ref
    },
    terminal_failure: summary?.terminal_failure ?? null,
    seats: Array.isArray(summary?.seats)
      ? summary.seats.map((seat) => ({
          model: seat?.model,
          role: seat?.role,
          ok: seat?.ok,
          decision: seat?.decision
        }))
      : null,
    gate: {
      gate_status: summary?.gate?.gate_status,
      warnings: summary?.gate?.warnings
    }
  };
}

export function validatePriorSummary(summary) {
  const projection = priorSummaryProjection(summary);
  if (!exactEqual(projection, EXPECTED_PRIOR_SUMMARY_SEMANTICS)) {
    fail("prior summary semantics do not exactly match the fresh authz-012 five-seat NOT_AUTHORIZED revision state.");
  }
  return true;
}

export function validatePriorAttemptInventory(inventory) {
  if (!exactEqual(inventory, PRIOR_ATTEMPT_FILES)) fail("prior inventory or raw file hashes do not exactly match authz-012.");
  return true;
}

export function validateCouncilConfiguration(seats, transportPolicy) {
  if (!exactEqual(seats, SEATS)) fail("seat order or role assignment is not exactly claude/agy/codex/grok/gemini.");
  if (!exactEqual(transportPolicy, TRANSPORT_POLICY)) fail("transport policy is not exactly serial with zero automatic retries.");
  return true;
}

export function validateCurrentAuthority(authority) {
  if (authority?.active_authorization?.id !== CONSTANTS.AUTHORITY_PREDECESSOR) {
    fail(`current-authority predecessor is not ${CONSTANTS.AUTHORITY_PREDECESSOR}.`);
  }
  return true;
}

export function validateCandidateBindings(dossier, packets) {
  const expectedLineage = createRevisionLineage();
  const expectedLineageRef = canonicalRef(expectedLineage);
  const expectedProviderTransport = createProviderTransportProfile();
  const expectedProviderTransportRef = canonicalRef(expectedProviderTransport);
  const expectedReviewInputBinding = createAgyReviewBinding({
    candidate_ref: dossier?.agy_review_input?.candidate_ref,
    plan_raw_sha256: dossier?.agy_review_input?.plan?.raw_sha256,
    spec_raw_sha256: dossier?.agy_review_input?.design?.raw_sha256,
    plan_text: dossier?.agy_review_input?.plan?.text,
    spec_text: dossier?.agy_review_input?.design?.text
  });
  const expectedReviewInputBindingRef = canonicalRef(expectedReviewInputBinding);
  if (dossier?.agy_review_input_ref !== expectedReviewInputBindingRef) fail("Agy review input ref is not exact.");
  validateRevisionLineage(dossier?.revision_lineage, dossier?.revision_lineage_ref);
  const expected = {
    proposal_ref: CONSTANTS.EXPECTED_PLAN_REF,
    build_id: CONSTANTS.BUILD_ID,
    use_case: CONSTANTS.USE_CASE,
    revision_lineage_ref: expectedLineageRef,
    revision_lineage: expectedLineage,
    provider_transport_ref: expectedProviderTransportRef,
    provider_transport: expectedProviderTransport,
    provider_preload_raw_sha256: expectedProviderTransport.preload_raw_sha256,
    agy_review_input_ref: expectedReviewInputBindingRef
  };
  const dossierBinding = {
    proposal_ref: dossier?.proposal_ref,
    build_id: dossier?.build_id,
    use_case: dossier?.use_case,
    revision_lineage_ref: dossier?.revision_lineage_ref,
    revision_lineage: dossier?.revision_lineage,
    provider_transport_ref: dossier?.provider_transport_ref,
    provider_transport: dossier?.provider_transport,
    provider_preload_raw_sha256: dossier?.provider_preload_raw_sha256,
    agy_review_input_ref: dossier?.agy_review_input_ref
  };
  if (!exactEqual(dossierBinding, expected)) fail("candidate binding in dossier is not exact.");
  if (!Array.isArray(packets)) fail("candidate binding packet set is missing.");
  for (const packet of packets) {
    const binding = {
      proposal_ref: packet?.proposal_ref,
      build_id: packet?.build_id,
      use_case: packet?.use_case,
      revision_lineage_ref: packet?.revision_lineage_ref,
      revision_lineage: packet?.revision_lineage,
      provider_transport_ref: packet?.provider_transport_ref,
      provider_transport: packet?.provider_transport,
      provider_preload_raw_sha256: packet?.provider_preload_raw_sha256,
      agy_review_input_ref: packet?.agy_review_input_ref
    };
    if (!exactEqual(binding, expected)) fail(`candidate binding mismatch for packet ${packet?.model || "unknown"}.`);
  }
  return true;
}

export function validateFreshPacketHashes(packetHashes) {
  if (!Array.isArray(packetHashes)) fail("fresh packet hash set must be an array.");
  const prior = new Set(Object.values(PRIOR_PACKET_HASHES));
  const seenModels = new Set();
  const seenHashes = new Set();
  let priorSeatIndex = -1;
  for (const entry of packetHashes) {
    const seatIndex = SEATS.findIndex((seat) => seat.model === entry?.model);
    if (seatIndex < 0) fail(`unknown seat ${entry?.model || "<missing>"} in fresh packet hash set.`);
    if (seenModels.has(entry.model)) fail(`duplicate fresh packet seat ${entry.model}.`);
    if (seatIndex <= priorSeatIndex) fail(`fresh packet hash set is out of declared seat order at ${entry.model}.`);
    if (!/^sha256:[0-9a-f]{64}$/.test(entry?.raw_sha256 || "")) fail(`fresh packet hash for ${entry.model} is malformed.`);
    if (prior.has(entry.raw_sha256)) fail(`prior packet hash was reused for current seat ${entry.model}.`);
    if (seenHashes.has(entry.raw_sha256)) fail(`fresh packet hash is duplicated at seat ${entry.model}.`);
    seenModels.add(entry.model);
    seenHashes.add(entry.raw_sha256);
    priorSeatIndex = seatIndex;
  }
  return true;
}

export function derivePriorResponseIds(priorSummary) {
  if (!Array.isArray(priorSummary?.seats) || priorSummary.seats.length !== SEATS.length) {
    fail("authz-012 summary must contain exactly five seats before deriving response IDs.");
  }
  const responseIds = priorSummary.seats.map((seat, index) => {
    const expected = SEATS[index];
    if (seat?.model !== expected.model || seat?.role !== expected.role || seat?.ok !== true) {
      fail(`authz-012 summary seat ${index} is not the exact successful ${expected.model}/${expected.role} call.`);
    }
    const responseId = seat?.provenance?.response_id;
    if (typeof responseId !== "string" || !responseId) {
      fail(`authz-012 summary seat ${expected.model} has no authenticated response_id.`);
    }
    return responseId;
  });
  if (new Set(responseIds).size !== responseIds.length) fail("authz-012 summary response IDs are not pairwise distinct.");
  return responseIds;
}

function routedProviderIdentityDefects(model, role, packet) {
  const policy = ROUTED_PROVENANCE_POLICY[model];
  const defects = [];
  if (!policy) return [`no fixed routed provenance policy exists for ${model || "<missing>"}`];
  if (packet?.model !== model) defects.push(`packet model is not the trusted ${model} seat`);
  if (packet?.role !== role) defects.push(`packet role is not the trusted ${role} role`);
  const provenance = packet?.provenance;
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) {
    return [...defects, "provenance is not a closed object"];
  }
  if (!exactEqual(Object.keys(provenance).sort(), [...policy.keys].sort())) {
    defects.push(`provenance keys are not the exact closed ${model} route shape`);
  }
  if (provenance.tool !== policy.tool) defects.push(`provenance.tool is not ${policy.tool}`);
  if (provenance.provider !== policy.provider) defects.push(`provenance.provider is not ${policy.provider}`);
  if (provenance.source !== policy.source) defects.push(`provenance.source is not ${policy.source}`);
  if (provenance.model !== policy.response_model) defects.push(`provenance.model is not ${policy.response_model}`);
  if (model === "agy") {
    if (provenance.answered_at !== null) defects.push("Agy provenance.answered_at is not null");
    if (provenance.attestation !== policy.attestation) defects.push(`Agy provenance.attestation is not ${policy.attestation}`);
    if (provenance.engine_version !== policy.engine_version) defects.push(`Agy provenance.engine_version is not ${policy.engine_version}`);
    const checkpointRef = packet?.agy_checkpoint_ref;
    if (!/^sha256:[0-9a-f]{64}$/.test(checkpointRef || "")) {
      defects.push("Agy packet agy_checkpoint_ref is not a canonical SHA-256 ref");
    } else if (provenance.response_id !== `agy-${checkpointRef.slice("sha256:".length, "sha256:".length + 40)}`) {
      defects.push("Agy provenance.response_id is not derived from agy_checkpoint_ref");
    }
  } else {
    const answeredAt = provenance.answered_at;
    let canonicalIso = false;
    if (typeof answeredAt === "string" && answeredAt) {
      try { canonicalIso = new Date(answeredAt).toISOString() === answeredAt; } catch {}
    }
    if (!canonicalIso) defects.push("remote provenance.answered_at is not a canonical ISO timestamp");
  }
  return defects;
}

export function validateFreshPacketProvenance(packets, priorResponseIds) {
  if (!Array.isArray(packets)) fail("fresh packet provenance set must be an array.");
  if (!Array.isArray(priorResponseIds) || priorResponseIds.length !== SEATS.length || new Set(priorResponseIds).size !== SEATS.length) {
    fail("authenticated authz-012 response ID set must contain five pairwise-distinct IDs.");
  }
  const prior = new Set(priorResponseIds);
  const current = new Set();
  for (const packet of packets) {
    const seat = SEATS.find(({ model }) => model === packet?.model);
    if (!seat) fail(`current packet has no trusted seat policy for ${packet?.model || "<missing>"}.`);
    const responseId = packet?.provenance?.response_id;
    if (typeof responseId !== "string" || !responseId.trim() || responseId !== responseId.trim()) {
      fail(`current successful ${packet?.model || "unknown"} packet requires a nonempty trimmed provenance.response_id.`);
    }
    const identityDefects = routedProviderIdentityDefects(seat.model, seat.role, packet);
    if (identityDefects.length > 0) fail(`current ${seat.model} packet has invalid routed provider identity: ${identityDefects.join("; ")}.`);
    if (prior.has(responseId)) fail(`current ${packet?.model || "unknown"} packet reuses an authz-012 response_id.`);
    if (current.has(responseId)) fail(`duplicate current response_id on packet ${packet?.model || "unknown"}.`);
    current.add(responseId);
  }
  return true;
}

function sanitizedFailureProjection(reasonCode, {
  terminal = false,
  childExitCode = null,
  childSignal = null
} = {}) {
  const message = SAFE_FAILURE_MESSAGES[reasonCode];
  if (!message) fail(`unsupported sanitized failure reason ${reasonCode || "<missing>"}.`);
  const terminalReasonCode = TRANSPORT_FAILURE_REASON_CODES.includes(reasonCode)
    || reasonCode === "CONTROLLER_VALIDATION_FAILED";
  if ((terminal === true) !== terminalReasonCode) {
    fail("sanitized failure terminal flag does not match its exact reason-code class.");
  }
  return Object.freeze({
    schema_version: DURABLE_DECISION_VERSIONS.failure,
    reason_code: reasonCode,
    message,
    terminal: terminal === true,
    child_exit_code: Number.isInteger(childExitCode) && childExitCode >= 0 && childExitCode <= 255 ? childExitCode : null,
    child_signal: typeof childSignal === "string" && /^SIG[A-Z0-9]+$/.test(childSignal) ? childSignal : null
  });
}

function validateSanitizedFailureProjection(failure) {
  const terminalReasonCode = TRANSPORT_FAILURE_REASON_CODES.includes(failure?.reason_code)
    || failure?.reason_code === "CONTROLLER_VALIDATION_FAILED";
  if (!exactObjectKeys(failure, [
    "child_exit_code", "child_signal", "message", "reason_code", "schema_version", "terminal"
  ]) || failure.schema_version !== DURABLE_DECISION_VERSIONS.failure
    || failure.message !== SAFE_FAILURE_MESSAGES[failure.reason_code]
    || typeof failure.terminal !== "boolean"
    || failure.terminal !== terminalReasonCode
    || !(failure.child_exit_code === null
      || (Number.isInteger(failure.child_exit_code) && failure.child_exit_code >= 0 && failure.child_exit_code <= 255))
    || !(failure.child_signal === null
      || (typeof failure.child_signal === "string" && /^SIG[A-Z0-9]+$/.test(failure.child_signal)))) {
    fail("durable failure projection is not the exact closed sanitized schema.");
  }
  return true;
}

export function normalizeProviderSeatResult(seat, result) {
  const expectedSeat = SEATS.find(({ model }) => model === seat?.model);
  if (!expectedSeat || expectedSeat.role !== seat?.role) fail("provider seat result normalization requires the fixed seat identity.");
  if (result?.ok === true) return result;
  const failure = sanitizedFailureProjection("SEAT_CALL_FAILED");
  return {
    model: expectedSeat.model,
    role: expectedSeat.role,
    ok: false,
    signed: false,
    reason_code: failure.reason_code,
    reason: `${failure.reason_code}: ${failure.message}`,
    failure
  };
}

function activePacketSecretValues(environment) {
  const names = [
    ...PROVIDER_CREDENTIAL_VARIABLE_NAMES,
    ...SEATS.map(({ model }) => `TELOS_SECRET_${model.toUpperCase()}`)
  ];
  return Object.freeze([...new Set(names
    .map((name) => environment?.[name])
    .filter((value) => typeof value === "string" && value.length > 0))]);
}

function serializableStringContainsActiveSecret(value, activeSecrets, seen = new Set()) {
  if (typeof value === "string") return activeSecrets.some((secret) => value.includes(secret));
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => serializableStringContainsActiveSecret(entry, activeSecrets, seen));
  }
  return Object.keys(value).some((key) => (
    activeSecrets.some((secret) => key.includes(secret))
    || serializableStringContainsActiveSecret(value[key], activeSecrets, seen)
  ));
}

function packetValidationFailure(result, reasonCode, _message, _observedRawSha256 = null, _observedResponseId = null) {
  const failure = sanitizedFailureProjection(reasonCode);
  const diagnostic = {
    reason_code: reasonCode,
    model: result.model,
    role: result.role,
    non_veto: result.role === "advisory",
    message: failure.message,
    observed_raw_sha256: null,
    observed_response_id: null,
    advisory_content: null
  };
  return {
    result: {
      model: result.model,
      role: result.role,
      ok: false,
      signed: false,
      reason_code: reasonCode,
      reason: `${reasonCode}: ${failure.message}`,
      failure,
      validation_failure: diagnostic
    },
    diagnostic
  };
}

export function classifyPacketProvenance(results, priorResponseIds, {
  hashPacket = (packet) => rawSha256(`${JSON.stringify(packet, null, 2)}\n`)
} = {}) {
  validateResultSequence(results);
  if (!Array.isArray(priorResponseIds) || priorResponseIds.length !== SEATS.length || new Set(priorResponseIds).size !== SEATS.length) {
    fail("authenticated authz-012 response ID set must contain five pairwise-distinct IDs.");
  }
  const priorIds = new Set(priorResponseIds);
  const priorHashes = new Set(Object.values(PRIOR_PACKET_HASHES));
  const observedIds = new Set();
  const observedHashes = new Set();
  const classified = [];
  const diagnostics = [];
  for (const result of results) {
    if (result?.ok !== true) {
      classified.push(result);
      continue;
    }
    const packet = result.packet;
    const responseId = packet?.provenance?.response_id;
    const packetHash = hashPacket(packet);
    const defects = [];
    const identityDefects = routedProviderIdentityDefects(result.model, result.role, packet);
    if (!/^sha256:[0-9a-f]{64}$/.test(packetHash || "")) defects.push("current packet raw SHA-256 is malformed");
    if (priorHashes.has(packetHash)) defects.push("authz-012 raw packet bytes were reused");
    if (observedHashes.has(packetHash)) defects.push("duplicate current packet hash");
    if (typeof responseId !== "string" || !responseId.trim() || responseId !== responseId.trim()) {
      defects.push("current successful packet requires a nonempty trimmed provenance.response_id");
    } else {
      if (priorIds.has(responseId)) defects.push("authz-012 provenance.response_id was reused");
      if (observedIds.has(responseId)) defects.push("duplicate current response_id");
    }
    observedHashes.add(packetHash);
    if (typeof responseId === "string") observedIds.add(responseId);
    if (identityDefects.length === 0 && defects.length === 0) {
      classified.push(result);
      continue;
    }
    const failure = packetValidationFailure(
      result,
      identityDefects.length > 0 ? "INVALID_PROVIDER_IDENTITY" : "INVALID_PACKET_PROVENANCE",
      [...identityDefects, ...defects].join("; "),
      packetHash,
      responseId
    );
    classified.push(failure.result);
    diagnostics.push(failure.diagnostic);
  }
  return { results: classified, diagnostics };
}

export function classifyCandidateBindingResults(results, dossier, { validate = validateCandidateBindings } = {}) {
  validateResultSequence(results);
  const classified = [];
  const diagnostics = [];
  for (const result of results) {
    if (result?.ok !== true) {
      classified.push(result);
      continue;
    }
    try {
      validate(dossier, [result.packet]);
      classified.push(result);
    } catch (error) {
      const failure = packetValidationFailure(
        result,
        "INVALID_CANDIDATE_BINDING",
        error?.message || "candidate binding validator failed"
      );
      classified.push(failure.result);
      diagnostics.push(failure.diagnostic);
    }
  }
  return { results: classified, diagnostics };
}

export function projectAdvisoryNonVetoGate(requiredGate, completeGate) {
  if (!requiredGate || !completeGate || !Array.isArray(requiredGate.blockers) || !Array.isArray(requiredGate.warnings)
    || !Array.isArray(completeGate.blockers) || !Array.isArray(completeGate.warnings)) {
    fail("advisory gate projection requires closed gate reports.");
  }
  const requiredBlockers = new Set(requiredGate.blockers);
  const warnings = [];
  const addWarning = (warning) => {
    if (!warnings.includes(warning)) warnings.push(warning);
  };
  for (const warning of requiredGate.warnings) addWarning(warning);
  for (const warning of completeGate.warnings) addWarning(warning);
  for (const blocker of completeGate.blockers) {
    if (!requiredBlockers.has(blocker)) addWarning(`Advisory non-veto gate diagnostic: ${blocker}`);
  }
  return {
    ...requiredGate,
    gate_status: requiredGate.gate_status,
    blockers: [...requiredGate.blockers],
    warnings,
    advisory_projection: {
      authoritative: false,
      grants_authority: false,
      demoted_blockers: completeGate.blockers.filter((blocker) => !requiredBlockers.has(blocker))
    }
  };
}

export function stripAdditionalProperties(schema) {
  const clone = JSON.parse(JSON.stringify(schema));
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    delete value.additionalProperties;
    for (const child of Object.values(value)) visit(child);
  };
  visit(clone);
  return clone;
}

export function responseSchemaForSeat(model, schema) {
  return model === "gemini" ? stripAdditionalProperties(schema) : JSON.parse(JSON.stringify(schema));
}

function boundedText(value, limit = 240) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, limit);
}

export function makeTerminalFailure(kind, { message, code = null, signal = null } = {}) {
  const reasonCodes = {
    "mcp-child-error": "MCP_CHILD_ERROR",
    "mcp-child-exit": "MCP_CHILD_EXIT",
    "provider-error": "PROVIDER_ERROR",
    "controller-validation": "CONTROLLER_VALIDATION_FAILED"
  };
  const reasonCode = reasonCodes[kind];
  if (!reasonCode) fail(`unsupported terminal failure kind ${kind}.`);
  const failure = sanitizedFailureProjection(reasonCode, {
    terminal: true,
    childExitCode: code,
    childSignal: signal
  });
  return Object.freeze({
    record_version: "telos.authorization-terminal-failure.v1",
    kind,
    reason_code: reasonCode,
    message: failure.message,
    child_exit_code: failure.child_exit_code,
    child_signal: failure.child_signal
  });
}

function terminalFailureProjection(failure) {
  return sanitizedFailureProjection(failure.reason_code, {
    terminal: true,
    childExitCode: failure.child_exit_code,
    childSignal: failure.child_signal
  });
}

function validateResultSequence(results) {
  if (!Array.isArray(results)) fail("council results must be an array.");
  const seen = new Set();
  for (const [resultIndex, result] of results.entries()) {
    const seatIndex = SEATS.findIndex((seat) => seat.model === result?.model);
    if (seatIndex < 0) fail(`unknown council result seat ${result?.model || "<missing>"}.`);
    if (seen.has(result.model)) fail(`duplicate council result seat ${result.model}.`);
    const expectedSeat = SEATS[resultIndex];
    if (!expectedSeat || result.model !== expectedSeat.model) {
      fail(`council results must be the exact fixed-seat prefix; expected ${expectedSeat?.model || "<end>"} at index ${resultIndex}, received ${result.model}.`);
    }
    if (result?.role !== expectedSeat.role) fail(`council result role mismatch for ${result.model}.`);
    seen.add(result.model);
  }
}

function seatDecisionSubject(model, role) {
  return { kind: "seat", model, role };
}

function appendAcceptedPublishedSeatDecision(chain, result) {
  const packetRawSha256 = rawSha256(jsonBytes(result.packet));
  const filename = `${result.model}.json`;
  return appendProvisionalDecisionNode(chain, {
    transition: "seat",
    subject: seatDecisionSubject(result.model, result.role),
    outcome: {
      status: "accepted-published",
      decision: result.packet?.decision ?? null,
      signed: result.signed === true
    },
    evidenceRefs: {
      packet_raw_sha256: packetRawSha256,
      publication_ref: durableDecisionPublicationRef(
        filename,
        { model: result.model, role: result.role },
        packetRawSha256
      )
    }
  });
}

function failedSeatReasonCode(result) {
  const candidate = result?.failure?.reason_code
    || result?.validation_failure?.reason_code
    || result?.reason_code;
  return SAFE_FAILURE_MESSAGES[candidate] ? candidate : "SEAT_CALL_FAILED";
}

function failedSeatProjection(result) {
  if (result?.failure) {
    validateSanitizedFailureProjection(result.failure);
    if (result.failure.terminal !== false) fail("ordinary failed seat result cannot carry a terminal failure projection.");
    return result.failure;
  }
  return sanitizedFailureProjection(failedSeatReasonCode(result));
}

function failedSeatEvidenceRef(result) {
  return canonicalRef(failedSeatProjection(result));
}

function appendFailedSeatDecision(chain, result) {
  const reasonCode = failedSeatReasonCode(result);
  return appendProvisionalDecisionNode(chain, {
    transition: "seat",
    subject: seatDecisionSubject(result.model, result.role),
    outcome: {
      status: "failed",
      decision: null,
      reason_code: reasonCode
    },
    evidenceRefs: {
      failure_ref: failedSeatEvidenceRef(result)
    }
  });
}

function appendSeatTransportDeath(chain, seat, failure) {
  const projection = terminalFailureProjection(failure);
  return appendProvisionalDecisionNode(chain, {
    transition: "seat",
    subject: seatDecisionSubject(seat.model, seat.role),
    outcome: {
      status: "transport-death",
      decision: null,
      reason_code: failure.reason_code
    },
    evidenceRefs: { failure_ref: canonicalRef(projection) }
  });
}

function appendTransportDeath(chain, failure) {
  const projection = terminalFailureProjection(failure);
  return appendProvisionalDecisionNode(chain, {
    transition: "transport",
    subject: { kind: "provider-transport" },
    outcome: {
      status: "transport-death",
      reason_code: failure.reason_code
    },
    evidenceRefs: { failure_ref: canonicalRef(projection) }
  });
}

function finalizeDecisionChain(chain, { results, gate, terminalFailure, authorized, validationDiagnostics }) {
  validateProvisionalDecisionChain(chain);
  if (chain.nodes.some((node) => node.transition === "terminal")) fail("decision chain was already terminal before summary construction.");
  if (chain.nodes.some((node) => node.transition === "state")) fail("decision chain cannot pre-mint controller state transitions before summary construction.");
  let completed = chain;
  const resultByModel = new Map(results.map((result) => [result.model, result]));
  const terminalFailureRef = terminalFailure ? canonicalRef(terminalFailure) : null;
  let representedResultCount = 0;
  let providerTransportDeathSeen = false;
  let unresolvedSeatDeathSeen = false;
  for (const node of chain.nodes) {
    if (!["seat", "transport"].includes(node.transition)) continue;
    if (providerTransportDeathSeen) {
      fail("a single provider transport-death boundary permits no later seat or transport transition.");
    }
    if (node.transition === "transport") {
      if (representedResultCount !== results.length) {
        fail("generic provider transport death is valid only after the exact represented result prefix.");
      }
      providerTransportDeathSeen = true;
      continue;
    }
    const representedResult = results[representedResultCount];
    if (representedResult) {
      if (node.subject?.model !== representedResult.model) {
        fail(`decision-chain seat prefix expected ${representedResult.model}, received ${node.subject?.model || "<missing>"}.`);
      }
      representedResultCount += 1;
    } else {
      const nextSeat = SEATS[results.length];
      if (unresolvedSeatDeathSeen || node.outcome?.status !== "transport-death"
        || !nextSeat || node.subject?.model !== nextSeat.model) {
        fail(`decision chain may extend beyond the exact result prefix only with one transport-death for the next fixed serial seat ${nextSeat?.model || "<none>"}.`);
      }
      unresolvedSeatDeathSeen = true;
    }
    if (node.outcome?.status === "transport-death") providerTransportDeathSeen = true;
  }
  if (representedResultCount !== results.length) {
    fail(`decision-chain seat prefix represents ${representedResultCount} of ${results.length} council results.`);
  }
  const seatNodes = new Map();
  let priorSeatIndex = -1;
  for (const node of chain.nodes.filter((entry) => entry.transition === "seat")) {
    const model = node.subject?.model;
    const seatIndex = SEATS.findIndex((seat) => seat.model === model);
    if (seatIndex < 0 || seatNodes.has(model)) {
      fail(`decision chain contains an unknown or duplicate seat transition ${model || "<missing>"}.`);
    }
    if (seatIndex <= priorSeatIndex) fail(`decision chain seat order contradicts the fixed council order at ${model}.`);
    const result = resultByModel.get(model);
    if (node.outcome.status === "accepted-published") {
      if (result?.ok !== true) fail(`accepted decision node for ${model} contradicts the council result.`);
      const expectedPacketHash = rawSha256(jsonBytes(result.packet));
      const expectedPublicationRef = durableDecisionPublicationRef(
        `${model}.json`,
        { model, role: result.role },
        expectedPacketHash
      );
      if (node.outcome.decision !== result.packet?.decision || node.outcome.signed !== true
        || result.signed !== true || node.evidence_refs.packet_raw_sha256 !== expectedPacketHash
        || node.evidence_refs.publication_ref !== expectedPublicationRef) {
        fail(`accepted decision node publication evidence contradicts the ${model} result.`);
      }
    } else if (node.outcome.status === "failed") {
      if (!result || result.ok === true) fail(`failed decision node for ${model} has no matching failed result.`);
      if (node.outcome.reason_code !== failedSeatReasonCode(result)
        || node.evidence_refs.failure_ref !== failedSeatEvidenceRef(result)) {
        fail(`failure evidence for ${model} contradicts the failed result.`);
      }
    } else if (node.outcome.status === "transport-death") {
      const matchingFailure = result?.terminal_failure || (!result ? terminalFailure : null);
      if (!matchingFailure || node.outcome.reason_code !== matchingFailure.reason_code
        || node.evidence_refs.failure_ref !== canonicalRef(terminalFailureProjection(matchingFailure))) {
        fail(`transport-death evidence for ${model} contradicts the recorded failure.`);
      }
    }
    seatNodes.set(model, node);
    priorSeatIndex = seatIndex;
  }

  const admissibleTransportFailureRefs = new Set([
    ...(terminalFailure ? [canonicalRef(terminalFailureProjection(terminalFailure))] : []),
    ...validationDiagnostics
      .map((entry) => entry?.transport_failure_ref)
      .filter((ref) => /^sha256:[0-9a-f]{64}$/.test(ref || ""))
  ]);
  for (const node of chain.nodes.filter((entry) => entry.transition === "transport")) {
    if (!admissibleTransportFailureRefs.has(node.evidence_refs.failure_ref)) {
      fail("provider transport-death node has no matching terminal failure or advisory diagnostic.");
    }
  }

  for (const result of results) {
    if (!seatNodes.has(result.model)) {
      fail(`decision-chain seat prefix omits the actual ${result.model} transition.`);
    }
  }

  const incompleteSeats = SEATS
    .filter((seat) => !resultByModel.has(seat.model))
    .map((seat) => ({
      model: seat.model,
      role: seat.role,
      state: "incomplete",
      ...(terminalFailure
        ? { reason_code: terminalFailure.reason_code }
        : { reason: "seat result missing" })
    }));
  if (incompleteSeats.length > 0) {
    completed = appendProvisionalDecisionNode(completed, {
      transition: "state",
      subject: { kind: "controller", authorization_id: CONSTANTS.AUTHORIZATION_ID },
      outcome: {
        status: "incomplete-seats-recorded",
        incomplete_count: incompleteSeats.length
      },
      evidenceRefs: {
        incomplete_seats_ref: canonicalRef(incompleteSeats)
      }
    });
  }
  const gateProjection = {
    gate_status: gate.gate_status,
    blockers: [...gate.blockers],
    warnings: [...gate.warnings],
    signing_enforced: gate.headline_checks?.signing_enforced ?? null,
    provenance_enforced: gate.headline_checks?.provenance_enforced ?? null
  };
  const terminalEvidence = {
    gate_projection_ref: canonicalRef(gateProjection),
    results_ref: canonicalRef(results),
    validation_diagnostics_ref: canonicalRef(validationDiagnostics)
  };
  if (terminalFailureRef) terminalEvidence.terminal_failure_ref = terminalFailureRef;
  completed = appendProvisionalDecisionNode(completed, {
    transition: "terminal",
    subject: { kind: "authorization", authorization_id: CONSTANTS.AUTHORIZATION_ID },
    outcome: {
      status: authorized ? "AUTHORIZED" : "NOT_AUTHORIZED",
      decision_source: terminalFailure ? "controller" : "gate",
      next_action: authorized ? "submit-to-the-eye" : "return-to-daedalus"
    },
    evidenceRefs: terminalEvidence
  });
  validateProvisionalDecisionChain(completed);
  const completedSeatNodes = completed.nodes.filter((node) => node.transition === "seat");
  for (const result of results) {
    const node = completedSeatNodes.find((entry) => entry.subject.model === result.model);
    if (!node) fail(`terminal decision chain omits the actual ${result.model} transition.`);
  }
  return completed;
}

export function buildAuthorizationSummary({
  results = [],
  gate,
  terminalFailure = null,
  objective = "Fresh authz-013 review of the exact revised Daedalus-family lifecycle candidate.",
  preparationSource = null,
  providerTransport = createProviderTransportProfile(),
  timestamp,
  ephemeralSigners = [],
  validationDiagnostics = [],
  agyReviewInputRef = null,
  decisionChain = null
} = {}) {
  validateResultSequence(results);
  if (!gate || typeof gate !== "object" || !Array.isArray(gate.blockers) || !Array.isArray(gate.warnings)) {
    fail("summary construction requires a closed generic-gate result.");
  }
  if (typeof timestamp !== "string" || !timestamp) fail("summary construction requires an explicit timestamp.");
  if (agyReviewInputRef !== null && !/^sha256:[0-9a-f]{64}$/.test(agyReviewInputRef)) {
    fail("summary Agy review input ref must be a canonical SHA-256 ref or null.");
  }
  const byModel = new Map(results.map((result) => [result.model, result]));
  const seats = SEATS.map((seat) => {
    const result = byModel.get(seat.model);
    if (!result) {
      return {
        model: seat.model,
        role: seat.role,
        ok: false,
        state: "incomplete",
        ...(terminalFailure ? { reason_code: terminalFailure.reason_code } : { reason: "seat result missing" })
      };
    }
    if (!result.ok) {
      const failure = result.terminal_failure
        ? terminalFailureProjection(result.terminal_failure)
        : failedSeatProjection(result);
      return {
        model: seat.model,
        role: seat.role,
        ok: false,
        state: "failed",
        reason: `${failure.reason_code}: ${failure.message}`
      };
    }
    return {
      model: seat.model,
      role: seat.role,
      ok: true,
      state: "succeeded",
      signed: Boolean(result.signed),
      decision: result.packet?.decision ?? null,
      confidence: result.packet?.confidence ?? null,
      provenance: result.packet?.provenance ?? null,
      ...(seat.model === "agy" ? {
        agy_review_input_ref: result.packet?.agy_review_input_ref ?? agyReviewInputRef,
        agy_checkpoint_ref: result.packet?.agy_checkpoint_ref ?? null
      } : {})
    };
  });
  const blockers = [...gate.blockers];
  const invalidRequiredSeats = SEATS.filter((seat) => seat.role === "approver").filter(({ model }) => {
    const result = byModel.get(model);
    return result?.ok !== true || result.signed !== true || result.packet?.decision !== "approve";
  });
  if (invalidRequiredSeats.length > 0 && gate.gate_status === "pass") {
    blockers.push(`Required council approval incomplete or invalid for ${invalidRequiredSeats.map((seat) => seat.model).join(", ")}.`);
  }
  if (terminalFailure) {
    blockers.push(`Terminal authorization failure ${terminalFailure.reason_code}: ${terminalFailure.message}`);
  }
  const authorized = !terminalFailure && invalidRequiredSeats.length === 0 && gate.gate_status === "pass";
  const lineage = createRevisionLineage();
  const lineageRef = canonicalRef(lineage);
  const providerTransportRef = canonicalRef(providerTransport);
  if (!exactEqual(providerTransport, createProviderTransportProfile())) fail("summary provider transport profile is not exact.");
  if (!decisionChain) fail("summary construction requires the live provisional decision chain.");
  const expectedSeed = decisionChainSeed({
    revisionLineageRef: lineageRef,
    providerTransportRef
  });
  if (!exactEqual(decisionChain.seed, expectedSeed)) fail("summary decision-chain seed does not bind the exact lineage and transport refs.");
  const completedDecisionChain = finalizeDecisionChain(decisionChain, {
    results,
    gate: { ...gate, gate_status: authorized ? "pass" : "blocked", blockers },
    terminalFailure,
    authorized,
    validationDiagnostics
  });
  return {
    authorization_id: CONSTANTS.AUTHORIZATION_ID,
    build_id: CONSTANTS.BUILD_ID,
    use_case: CONSTANTS.USE_CASE,
    objective,
    plan_ref: CONSTANTS.EXPECTED_PLAN_REF,
    plan_file_sha256: PLAN_IDENTITY.raw_sha256,
    authority_predecessor: CONSTANTS.AUTHORITY_PREDECESSOR,
    mutation_of: CONSTANTS.MUTATION_OF,
    prior_candidate_ref: CONSTANTS.PRIOR_CANDIDATE_REF,
    revision_lineage_ref: lineageRef,
    revision_lineage: lineage,
    preparation_source: preparationSource,
    transport_policy: TRANSPORT_POLICY,
    provider_transport_ref: providerTransportRef,
    provider_transport: providerTransport,
    provider_preload_raw_sha256: providerTransport.preload_raw_sha256,
    decision_chain: completedDecisionChain,
    decision_chain_final_root: completedDecisionChain.final_root,
    agy_review_input_ref: agyReviewInputRef,
    timestamp,
    trust_mode: "signed",
    ephemeral_signers: [...ephemeralSigners],
    terminal_failure: terminalFailure,
    validation_diagnostics: validationDiagnostics.map((entry) => ({ ...entry })),
    seats,
    gate: {
      gate_status: authorized ? "pass" : "blocked",
      signing_enforced: gate.headline_checks?.signing_enforced ?? null,
      provenance_enforced: gate.headline_checks?.provenance_enforced ?? null,
      blockers,
      warnings: [...gate.warnings],
      provenance: Array.isArray(gate.provenance) ? gate.provenance : []
    },
    authorized,
    next_action: authorized ? "submit-to-the-eye" : "return-to-daedalus",
    authorization: {
      status: authorized ? "AUTHORIZED" : "NOT_AUTHORIZED",
      plan_ref: CONSTANTS.EXPECTED_PLAN_REF,
      note: authorized
        ? "Council approval only certifies/submits this exact candidate to The Eye; it does not grant implementation authority, start Task 1, or mutate CURRENT-AUTHORITY.json."
        : "Fail-closed: return this exact attempt to Daedalus; no implementation authority, Task 1 start, or CURRENT-AUTHORITY.json mutation."
    }
  };
}

function git(args, allowedStatuses = [0]) {
  const result = spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" });
  if (result.error) fail(`cannot run Git (${result.error.message}).`);
  if (!allowedStatuses.includes(result.status)) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join(" ").trim();
    fail(`git ${args.join(" ")} exited ${result.status}${detail ? `: ${detail}` : "."}`);
  }
  return result.stdout.trim();
}

function assertTrackedClean(file) {
  git(["ls-files", "--error-unmatch", "--", file]);
  const worktree = spawnSync("git", ["-C", ROOT, "diff", "--quiet", "--", file]);
  if (worktree.status !== 0) fail(`working-tree drift in authority-critical file ${file}.`);
  const index = spawnSync("git", ["-C", ROOT, "diff", "--cached", "--quiet", "--", file]);
  if (index.status !== 0) fail(`index drift in authority-critical file ${file}.`);
}

function assertCommit(commitRef, parentRef, treeRef, label) {
  const commit = commitRef.replace(/^git:/, "");
  const parent = parentRef.replace(/^git:/, "");
  const resolved = git(["rev-parse", "--verify", `${commit}^{commit}`]);
  if (resolved !== commit) fail(`${label} commit resolves to ${resolved}, expected ${commit}.`);
  const lineage = git(["rev-list", "--parents", "-n", "1", commit]).split(/\s+/);
  if (!exactEqual(lineage, [commit, parent])) fail(`${label} commit does not have the exact sole parent ${parent}.`);
  const tree = git(["rev-parse", "--verify", `${commit}^{tree}`]);
  if (`git:${tree}` !== treeRef) fail(`${label} repository tree git:${tree} does not equal ${treeRef}.`);
}

function diskTree(files, baseDir) {
  const entries = [...files].sort().map((file) => {
    const absolute = path.resolve(baseDir, file);
    const relative = path.relative(path.resolve(baseDir), absolute);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return { path: file, filehash: null, status: "escape" };
    if (!existsSync(absolute)) return { path: file, filehash: null, status: "missing" };
    return { path: file, filehash: rawSha256(readFileSync(absolute)), status: "present" };
  });
  return { tree_hash: canonicalRef({ files: entries }), files: entries };
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
  } catch (error) {
    fail(`cannot parse ${relativePath} (${error?.message || String(error)}).`);
  }
}

function assertPlanAndDesign() {
  assertCommit(PLAN_IDENTITY.commit, PLAN_IDENTITY.parent, PLAN_IDENTITY.tree, "plan");
  const planCommit = PLAN_IDENTITY.commit.replace(/^git:/, "");
  const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", planCommit]).split("\n").filter(Boolean);
  if (!exactEqual(changed, [PLAN_PATH])) fail("plan commit changed paths are not exactly the revised plan.");
  const planBlob = git(["rev-parse", "--verify", `${planCommit}:${PLAN_PATH}`]);
  if (`git:${planBlob}` !== PLAN_IDENTITY.blob) fail("plan blob does not match the reviewed plan blob.");
  const designBlob = git(["rev-parse", "--verify", `${planCommit}:${SPEC_PATH}`]);
  if (`git:${designBlob}` !== CONSTANTS.DESIGN_BLOB) fail("design blob does not match the reviewed design blob.");
  const planBytes = readFileSync(path.join(ROOT, PLAN_PATH));
  const planText = planBytes.toString("utf8");
  const identity = {
    commit: PLAN_IDENTITY.commit,
    parent: PLAN_IDENTITY.parent,
    tree: PLAN_IDENTITY.tree,
    blob: `git:${planBlob}`,
    raw_sha256: rawSha256(planBytes),
    candidate_ref: canonicalRef({ kind: "candidate", plan: planText })
  };
  validatePlanIdentity(identity);
  if (rawSha256(readFileSync(path.join(ROOT, SPEC_PATH))) !== CONSTANTS.DESIGN_RAW_SHA256) {
    fail("design raw SHA-256 does not match the reviewed design.");
  }
  return { planText, identity };
}

function assertPriorAttempt() {
  assertCommit(
    CONSTANTS.PRIOR_ATTEMPT_COMMIT,
    CONSTANTS.PRIOR_ATTEMPT_PARENT,
    CONSTANTS.PRIOR_ATTEMPT_TREE,
    "authz-012"
  );
  const commit = CONSTANTS.PRIOR_ATTEMPT_COMMIT.replace(/^git:/, "");
  const directoryTree = git(["rev-parse", "--verify", `${commit}:${PRIOR_ATTEMPT_RELATIVE_DIR}`]);
  if (`git:${directoryTree}` !== CONSTANTS.PRIOR_ATTEMPT_DIRECTORY_TREE) {
    fail("authz-012 attempt-directory tree does not match the exact anchor.");
  }
  const entries = readdirSync(PRIOR_ATTEMPT_DIR, { withFileTypes: true });
  const nonFile = entries.find((entry) => !entry.isFile());
  if (nonFile) fail(`authz-012 contains non-file entry ${nonFile.name}.`);
  const names = entries.map((entry) => entry.name).sort();
  const expectedNames = PRIOR_ATTEMPT_FILES.map((entry) => entry.path).sort();
  if (!exactEqual(names, expectedNames)) fail("authz-012 file inventory is not exact.");
  const actualInventory = PRIOR_ATTEMPT_FILES.map((entry) => ({
    path: entry.path,
    raw_sha256: rawSha256(readFileSync(path.join(PRIOR_ATTEMPT_DIR, entry.path)))
  }));
  validatePriorAttemptInventory(actualInventory);
  const summary = readJson(`${PRIOR_ATTEMPT_RELATIVE_DIR}/authorization-summary.json`);
  validatePriorSummary(summary);
  if (canonicalRef(summary) !== CONSTANTS.PRIOR_SUMMARY_CANONICAL_REF) fail("authz-012 summary canonical ref does not match.");
  const priorResponseIds = derivePriorResponseIds(summary);
  const retryNode = readJson(`${PRIOR_ATTEMPT_RELATIVE_DIR}/retry-node.json`);
  if (canonicalRef(retryNode) !== CONSTANTS.PRIOR_RETRY_CANONICAL_REF) fail("authz-012 retry-node canonical ref does not match.");
  const tree = diskTree(expectedNames, PRIOR_ATTEMPT_DIR);
  if (tree.tree_hash !== CONSTANTS.PRIOR_DISK_TREE_REF) fail("authz-012 complete disk-tree ref does not match.");
  return { priorResponseIds };
}

function preparationCommitIdentity() {
  const head = git(["rev-parse", "--verify", "HEAD"]);
  const line = git(["rev-list", "--parents", "-n", "1", head]).split(/\s+/);
  const changed = git(["diff-tree", "--no-commit-id", "--name-only", "-r", head]).split("\n").filter(Boolean).sort();
  const requiredChanged = [RUNNER_PATH, TEST_PATH].sort();
  if (line.length !== 2 || line[0] !== head || `git:${line[1]}` !== PLAN_IDENTITY.commit) return null;
  if (!exactEqual(changed, requiredChanged)) return null;
  for (const file of requiredChanged) assertTrackedClean(file);
  const runnerBlob = git(["rev-parse", "--verify", `${head}:${RUNNER_PATH}`]);
  const testBlob = git(["rev-parse", "--verify", `${head}:${TEST_PATH}`]);
  return {
    commit: `git:${head}`,
    parent: PLAN_IDENTITY.commit,
    tree: `git:${git(["rev-parse", "--verify", `${head}^{tree}`])}`,
    runner: { path: RUNNER_PATH, blob: `git:${runnerBlob}`, raw_sha256: rawSha256(readFileSync(path.join(ROOT, RUNNER_PATH))) },
    test: { path: TEST_PATH, blob: `git:${testBlob}`, raw_sha256: rawSha256(readFileSync(path.join(ROOT, TEST_PATH))) }
  };
}

function sourceReviewIdentity() {
  for (const file of [RUNNER_PATH, TEST_PATH]) {
    const absolute = path.join(ROOT, file);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile() || lstatSync(absolute).isSymbolicLink()) {
      fail(`source-review file ${file} must be a regular non-symlink file.`);
    }
  }
  return {
    runner: { path: RUNNER_PATH, raw_sha256: rawSha256(readFileSync(path.join(ROOT, RUNNER_PATH))), blob: null },
    test: { path: TEST_PATH, raw_sha256: rawSha256(readFileSync(path.join(ROOT, TEST_PATH))), blob: null }
  };
}

function runDeterministicPreflight({ sourceReview = false } = {}) {
  assertPinnedTransportPlatform();
  validateCouncilConfiguration(SEATS, TRANSPORT_POLICY);
  const authority = readJson("CURRENT-AUTHORITY.json");
  validateCurrentAuthority(authority);
  for (const file of AUTHORITY_CRITICAL_FILES) assertTrackedClean(file);
  assertPlanAndDesign();
  const { priorResponseIds } = assertPriorAttempt();
  const lineage = createRevisionLineage();
  const lineageRef = canonicalRef(lineage);
  validateRevisionLineage(lineage, lineageRef);
  const heldProviderSources = captureHeldProviderSourceGraph();
  const providerTransport = createProviderTransportProfile(process.env, { heldGraph: heldProviderSources });
  const providerTransportRef = canonicalRef(providerTransport);
  const preparation = sourceReview ? null : preparationCommitIdentity();
  if (!sourceReview && !preparation) {
    fail("executing HEAD is not the clean preparation commit with sole plan-commit parent and exactly the runner/test path delta.");
  }
  const sources = preparation || sourceReviewIdentity();
  const report = {
    preflight: "PASS",
    mode: sourceReview ? "source-review" : "preparation-commit",
    live_eligible: !sourceReview && Boolean(preparation),
    authorization_id: CONSTANTS.AUTHORIZATION_ID,
    build_id: CONSTANTS.BUILD_ID,
    authority_predecessor: CONSTANTS.AUTHORITY_PREDECESSOR,
    mutation_of: CONSTANTS.MUTATION_OF,
    candidate_ref: CONSTANTS.EXPECTED_PLAN_REF,
    prior_candidate_ref: CONSTANTS.PRIOR_CANDIDATE_REF,
    revision_lineage_ref: lineageRef,
    revision_lineage: lineage,
    transport_policy: TRANSPORT_POLICY,
    provider_transport_ref: providerTransportRef,
    provider_transport: providerTransport,
    provider_preload_raw_sha256: providerTransport.preload_raw_sha256,
    seats: SEATS,
    plan: PLAN_IDENTITY,
    prior_attempt: {
      authorization_id: CONSTANTS.MUTATION_OF,
      commit: CONSTANTS.PRIOR_ATTEMPT_COMMIT,
      parent: CONSTANTS.PRIOR_ATTEMPT_PARENT,
      tree: CONSTANTS.PRIOR_ATTEMPT_TREE,
      directory_tree: CONSTANTS.PRIOR_ATTEMPT_DIRECTORY_TREE,
      summary_raw_sha256: CONSTANTS.PRIOR_SUMMARY_RAW_SHA256,
      summary_canonical_ref: CONSTANTS.PRIOR_SUMMARY_CANONICAL_REF,
      disk_tree_ref: CONSTANTS.PRIOR_DISK_TREE_REF,
      retry_node_raw_sha256: CONSTANTS.PRIOR_RETRY_RAW_SHA256,
      retry_node_canonical_ref: CONSTANTS.PRIOR_RETRY_CANONICAL_REF
    },
    prior_response_ids: priorResponseIds,
    executing_source: sources,
    note: sourceReview
      ? "Source review validates deterministic authority, Git, plan, candidate, prior-attempt, and revision-lineage bindings but is explicitly non-live-eligible."
      : "Preparation commit and deterministic bindings are exact; live mode must separately pass immutable output checks before provider imports."
  };
  Object.defineProperty(report, "held_provider_sources", {
    value: heldProviderSources,
    enumerable: false,
    writable: false
  });
  return report;
}

function parseArguments(args) {
  if (args.length === 0) return { mode: "live", sourceReview: false };
  const counts = new Map();
  for (const arg of args) counts.set(arg, (counts.get(arg) || 0) + 1);
  if ([...counts.values()].some((count) => count > 1)) fail("repeated flags are forbidden.");
  const allowed = new Set(["--preflight", "--source-review"]);
  const unknown = args.find((arg) => !allowed.has(arg));
  if (unknown) fail(`unknown or write-capable flag ${unknown}.`);
  if (!counts.has("--preflight")) fail("--source-review is valid only with --preflight.");
  if (counts.has("--source-review") && !counts.has("--preflight")) fail("source-review requires preflight.");
  return { mode: "preflight", sourceReview: counts.has("--source-review") };
}

function assertImmutableOutputsAbsent(outputDirectory = HERE) {
  if (!existsSync(outputDirectory)) return;
  const allowedSources = new Set([path.basename(RUNNER_PATH), path.basename(TEST_PATH)]);
  const existing = readdirSync(outputDirectory).find((file) => (
    OUTPUT_FILES.includes(file)
    || file.endsWith(".pending")
    || file.startsWith(".authz-013-")
    || !allowedSources.has(file)
  ));
  if (existing) fail(`immutable, pending, or orphan live output ${existing} already exists; create a new attempt directory.`);
}

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function runLive(preflight, {
  outputDirectory = HERE,
  readFile = readFileSync,
  makeDirectory = mkdirSync,
  publishJson = publishAtomicExclusiveJson,
  claimAttempt = claimAuthorizationAttempt,
  importModule = null,
  spawnTransport = spawnProviderMcpTransport,
  environment = process.env,
  randomSource = randomBytes,
  now = () => new Date().toISOString(),
  log = console.log,
  setExitCode = (code) => { process.exitCode = code; }
} = {}) {
  assertPinnedTransportPlatform();
  if (process.env.TELOS_AUTHZ013_TEST_NO_PROVIDERS === "1") fail("provider execution is disabled in the test path.");
  if (!preflight.live_eligible) fail("live mode requires the exact preparation commit and never accepts source-review mode.");
  assertImmutableOutputsAbsent(outputDirectory);
  const heldProviderSources = preflight.held_provider_sources || captureHeldProviderSourceGraph();
  const timestamp = now();
  const objective = [
    `Conduct fresh serial authz-013 review of revised candidate ${CONSTANTS.EXPECTED_PLAN_REF}, mutation_of authz-012 candidate ${CONSTANTS.PRIOR_CANDIDATE_REF}, under provisional non-authoritative revision lineage ${preflight.revision_lineage_ref}.`,
    `Use provisional local provider transport evidence ${preflight.provider_transport_ref} with fixed preload ${preflight.provider_preload_raw_sha256}; it claims only no client-set elapsed cap for the current direct HTTPS POST calls and grants no authority.`,
    "Call claude, agy, codex, grok, and gemini exactly once in that order with zero in-process retry; every decision must be fresh and no authz-012 packet may be reused.",
    "Agy supplies a deterministic local governance/input receipt over the exact captured plan and design bytes; it is not a semantic model review.",
    "The required trio remains claude, agy, and codex; grok and gemini remain advisory at this TELOS boundary.",
    "Approval only certifies and submits this exact candidate to The Eye. It grants no implementation authority, cannot start Task 1, and cannot mutate CURRENT-AUTHORITY.json."
  ].join(" ");
  const ephemeralSigners = [];
  let validatedResults = [];
  let validationDiagnostics = [];
  let agyReviewInputRef = null;
  let attemptClaim = null;
  let summaryWriteAttempted = false;
  let summaryPersisted = false;
  const adoptedDurableEnvelopes = new Map();
  let decisionChain = createProvisionalDecisionChain({
    revisionLineageRef: preflight.revision_lineage_ref,
    providerTransportRef: preflight.provider_transport_ref
  });
  const fixedControllerError = ({ suppressTerminalSummary = false } = {}) => {
    const terminalFailure = makeTerminalFailure("controller-validation");
    const error = new Error(`${terminalFailure.reason_code}: ${terminalFailure.message}`);
    error.terminal_failure = terminalFailure;
    error[INTERNAL_TERMINAL_FAILURE] = true;
    if (suppressTerminalSummary) error[SUPPRESS_TERMINAL_SUMMARY] = true;
    return error;
  };
  const durableFilenameForNode = (node) => node.transition === "transport"
    ? "provider-transport.json"
    : `${node.subject.model}.json`;
  const validateAdoptedDurablePrefix = (completedChain) => {
    validateProvisionalDecisionChain(completedChain);
    const durableNodes = completedChain.nodes.filter((node) => ["seat", "transport"].includes(node.transition));
    if (durableNodes.length !== adoptedDurableEnvelopes.size) {
      fail("adopted durable envelope inventory does not equal the decision-chain provider prefix.");
    }
    for (const node of durableNodes) {
      const filename = durableFilenameForNode(node);
      const adopted = adoptedDurableEnvelopes.get(filename);
      if (!adopted || !exactEqual(adopted.envelope.decision_node, node)
        || !adopted.raw_bytes.equals(Buffer.from(jsonBytes(adopted.envelope), "utf8"))) {
        fail(`adopted durable envelope inventory drifted for ${filename}.`);
      }
      const signatureSecret = node.transition === "seat" && node.outcome.status === "accepted-published"
        ? environment[`TELOS_SECRET_${node.subject.model.toUpperCase()}`]
        : null;
      validateDurableDecisionPublication(
        { path: adopted.path, raw_sha256: adopted.raw_sha256 },
        adopted.envelope,
        outputDirectory,
        filename,
        { signatureSecret }
      );
    }
    return true;
  };
  const persistSummary = (summary) => {
    if (!attemptClaim) fail("terminal summary publication requires ownership of the authorization attempt claim.");
    try {
      validateAdoptedDurablePrefix(summary.decision_chain);
    } catch {
      throw fixedControllerError({ suppressTerminalSummary: true });
    }
    summaryWriteAttempted = true;
    try {
      const publication = publishJson(outputDirectory, "authorization-summary.json", summary);
      validateExactJsonPublication(
        publication,
        summary,
        outputDirectory,
        "authorization-summary.json"
      );
      validateAdoptedDurablePrefix(summary.decision_chain);
    } catch {
      throw fixedControllerError({ suppressTerminalSummary: true });
    }
    summaryPersisted = true;
    attemptClaim.release();
    attemptClaim = null;
    log(JSON.stringify({
      authorization_id: CONSTANTS.AUTHORIZATION_ID,
      authorized: summary.authorized,
      gate_status: summary.gate.gate_status,
      next_action: summary.next_action,
      terminal_failure: summary.terminal_failure?.reason_code ?? null
    }, null, 2));
    setExitCode(summary.authorized ? 0 : 3);
  };
  const durableFailureGate = (failure) => ({
    gate_status: "blocked",
    signing_enforced: null,
    provenance_enforced: null,
    blockers: [`Durable authorization failure ${failure.reason_code}: ${failure.message}`],
    warnings: [],
    provenance: [],
    headline_checks: { signing_enforced: null, provenance_enforced: null }
  });
  const persistControllerFailure = (error) => {
    if (error?.[SUPPRESS_TERMINAL_SUMMARY] === true) throw fixedControllerError({ suppressTerminalSummary: true });
    if (summaryWriteAttempted || summaryPersisted || !attemptClaim) {
      if (error?.[INTERNAL_TERMINAL_FAILURE] === true) throw error;
      throw fixedControllerError({ suppressTerminalSummary: true });
    }
    const internalTerminalFailure = error?.[INTERNAL_TERMINAL_FAILURE] === true;
    const terminalFailure = internalTerminalFailure
      ? error.terminal_failure
      : makeTerminalFailure("controller-validation");
    const controllerDiagnostics = internalTerminalFailure ? validationDiagnostics : [
      ...validationDiagnostics,
      {
        reason_code: "CONTROLLER_VALIDATION_FAILED",
        model: null,
        role: "controller",
        non_veto: false,
        message: SAFE_FAILURE_MESSAGES.CONTROLLER_VALIDATION_FAILED,
        observed_raw_sha256: null,
        observed_response_id: null,
        advisory_content: null
      }
    ];
    return persistSummary(buildAuthorizationSummary({
      results: validatedResults,
      gate: durableFailureGate(terminalFailure),
      terminalFailure,
      objective,
      preparationSource: preflight.executing_source,
      providerTransport: createProviderTransportProfile(process.env, { heldGraph: heldProviderSources }),
      timestamp,
      ephemeralSigners,
      validationDiagnostics: controllerDiagnostics,
      agyReviewInputRef,
      decisionChain
    }));
  };

  await runDurableAuthorizationPhase({
    execute: async () => {
      makeDirectory(outputDirectory, { recursive: true });
      attemptClaim = claimAttempt(outputDirectory);
      const reviewInputs = loadExactReviewInputs({ root: ROOT, readFile });
      const agyReviewBinding = createAgyReviewBinding(reviewInputs);
      agyReviewInputRef = canonicalRef(agyReviewBinding);
      const agyReviewScope = canonicalize(agyReviewBinding);
      validateHeldGraphSources(heldProviderSources);
      const expectedProviderTransport = createProviderTransportProfile(process.env, { heldGraph: heldProviderSources });
      if (!exactEqual(preflight.provider_transport, expectedProviderTransport)) fail("preflight provider transport profile drifted before live execution.");
      if (preflight.provider_transport_ref !== canonicalRef(expectedProviderTransport)) fail("preflight provider transport ref drifted before live execution.");
      if (preflight.provider_preload_raw_sha256 !== expectedProviderTransport.preload_raw_sha256) fail("preflight provider preload identity drifted before live execution.");
      const planText = reviewInputs.plan_text;
      const specText = reviewInputs.spec_text;
      const lineageBindings = {
        revision_lineage_ref: preflight.revision_lineage_ref,
        revision_lineage: preflight.revision_lineage,
        provider_transport_ref: preflight.provider_transport_ref,
        provider_transport: preflight.provider_transport,
        provider_preload_raw_sha256: preflight.provider_preload_raw_sha256,
        agy_review_input_ref: agyReviewInputRef
      };
      const dossier = {
        build_id: CONSTANTS.BUILD_ID,
        use_case: CONSTANTS.USE_CASE,
        objective,
        proposal_ref: CONSTANTS.EXPECTED_PLAN_REF,
        ...lineageBindings,
        agy_review_input: agyReviewBinding,
        required_docs: [PLAN_PATH, SPEC_PATH],
        write_targets: ["/home/colchis/plugins/multi-model-seats/"],
        protected_paths: [],
        trust_mode: "signed"
      };
      const lineagePublication = publishJson(outputDirectory, "revision-lineage.json", preflight.revision_lineage);
      validateExactJsonPublication(
        lineagePublication,
        preflight.revision_lineage,
        outputDirectory,
        "revision-lineage.json",
        (parsed) => validateRevisionLineage(parsed, canonicalRef(parsed))
      );
      let transport = null;
      let providerHooks = null;
      let expectedChildClose = false;
      let cleanupChildWatch = () => {};
      const closeExpectedly = () => {
        if (!transport || expectedChildClose) return;
        expectedChildClose = true;
        cleanupChildWatch();
        try { transport.close(); } catch (error) {
          console.error("AUTHZ_CLOSE_ERROR: provider transport close failed.");
        }
      };
      try {
        // Provider-facing modules load only after exact input verification and
        // immutable lineage publication; every live-phase failure is summary-bound.
        if (importModule === null) providerHooks = installHeldProviderModuleHooks(heldProviderSources);
        const heldImport = importModule || ((relative) => providerHooks.importRoot(relative));
        const { agyAttestation } = await heldImport("connectors/ai-peer-mcp/lib.mjs");
        const { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } = await heldImport("build-gate/council.mjs");
        const { validateRecords } = await heldImport("build-gate/gate.mjs");
        const { createMcpClient } = await heldImport("breakout/mcp_client.mjs");
        providerHooks?.assertAllParentSourcesLoaded();

        for (const seat of ["CLAUDE", "AGY", "CODEX", "GROK", "GEMINI"]) {
          if (!environment[`TELOS_SECRET_${seat}`]) {
            environment[`TELOS_SECRET_${seat}`] = randomSource(24).toString("hex");
            ephemeralSigners.push(seat.toLowerCase());
          }
        }
        const activePacketSecrets = activePacketSecretValues(environment);
        const meta = {
          build_id: CONSTANTS.BUILD_ID,
          use_case: CONSTANTS.USE_CASE,
          proposal_ref: CONSTANTS.EXPECTED_PLAN_REF,
          ...lineageBindings,
          timestamp,
          docs_reviewed: [PLAN_PATH, SPEC_PATH]
        };
        const packetSchema = {
          type: "object",
          additionalProperties: false,
          properties: {
            decision: { type: "string", enum: ["approve", "revise", "reject"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            required_edits: { type: "array", items: { type: "string" } },
            hard_stops: { type: "array", items: { type: "string" } },
            rationale: { type: "string" }
          },
          required: ["decision", "confidence", "required_edits", "hard_stops", "rationale"]
        };
        const parsePacket = (text, model, role) => {
          let parsed;
          try { parsed = JSON.parse(text); } catch { parsed = {}; }
          if (model === "agy") {
            const receipt = validateAgyCheckpointBinding(parsed, agyReviewBinding, { attest: agyAttestation });
            return { ...agyApprovalPacket(parsed, meta), role, ...lineageBindings, ...receipt };
          }
          return {
            ...meta,
            model,
            role,
            decision: ["approve", "revise", "reject"].includes(parsed?.decision) ? parsed.decision : "revise",
            required_edits: Array.isArray(parsed?.required_edits) ? parsed.required_edits : [],
            hard_stops: Array.isArray(parsed?.hard_stops) ? parsed.hard_stops : [],
            confidence: ["low", "medium", "high"].includes(parsed?.confidence) ? parsed.confidence : "low",
            rationale: typeof parsed?.rationale === "string" ? parsed.rationale : "unparsable seat response (fail-closed to revise)"
          };
        };
        const promptFor = (model, _role, dsr) => {
          if (model === "agy") return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, agyReviewScope) };
          return {
            tool: `${model}_ask`,
            args: {
              prompt: `${objective}\n\n=== DESIGN ===\n${specText}\n\n=== REVISED PLAN ===\n${planText}`,
              system: `You are the ${model} TELOS authorization seat. Evaluate afresh. Approval only submits the exact candidate to The Eye and grants no implementation authority.`,
              model,
              max_tokens: 30000,
              include_provenance: true,
              response_schema: responseSchemaForSeat(model, packetSchema),
              schema_name: "telos_approval_packet"
            }
          };
        };

        const childEnvironment = createProviderChildEnvironment(environment);
        const childExecution = createHeldProviderChildBootstrap(heldProviderSources);
        if (childExecution.bootstrap_raw_sha256 !== preflight.provider_transport.preload_raw_sha256
          || !exactEqual(preflight.provider_transport.child_argv_shape, ["--import", "<held-child-bootstrap-data-url>", "<held-server-entry-path>"])
          || preflight.provider_transport.source_graph.graph_ref !== heldProviderSources.graph_ref) {
          fail("freshly derived held child bootstrap does not match the public transport evidence.");
        }
        transport = spawnTransport({
          command: process.execPath,
          args: childExecution.child_args,
          childEnvironment,
          spawn: nodeSpawn,
          createClient: createMcpClient
        });
        const { client, child } = transport;
        const terminalError = (failure) => {
          const error = new Error(`${failure.reason_code}: ${failure.message}`);
          error.terminal_failure = failure;
          error[INTERNAL_TERMINAL_FAILURE] = true;
          return error;
        };
        let latchedTransportFailure = null;
        let resolveTransportFailure;
        const transportFailureSignal = new Promise((resolve) => { resolveTransportFailure = resolve; });
        const latchTransportFailure = (failure) => {
          if (expectedChildClose || latchedTransportFailure) return;
          latchedTransportFailure = failure;
          resolveTransportFailure(failure);
        };
        const onError = (error) => latchTransportFailure(makeTerminalFailure("mcp-child-error", {
            message: error?.message || "MCP child emitted an error"
          }));
        const onStdinError = (error) => latchTransportFailure(makeTerminalFailure("mcp-child-error", {
            message: `MCP child stdin failed (${error?.message || "unknown error"})`
          }));
        const onStdoutError = (error) => latchTransportFailure(makeTerminalFailure("mcp-child-error", {
          message: `MCP child stdout failed (${error?.message || "unknown error"})`
        }));
        const onStdoutEnd = () => latchTransportFailure(makeTerminalFailure("mcp-child-error", {
          message: "MCP child stdout ended unexpectedly"
        }));
        const onStdoutClose = () => latchTransportFailure(makeTerminalFailure("mcp-child-error", {
          message: "MCP child stdout closed unexpectedly"
        }));
        const onExit = (code, signal) => latchTransportFailure(makeTerminalFailure("mcp-child-exit", {
            message: `MCP child exited unexpectedly (code ${Number.isInteger(code) ? code : "null"}, signal ${signal || "null"})`,
            code,
            signal
          }));
        child.on("error", onError);
        child.once("exit", onExit);
        child.stdin.on("error", onStdinError);
        child.stdout.on("error", onStdoutError);
        child.stdout.once("end", onStdoutEnd);
        child.stdout.once("close", onStdoutClose);
        cleanupChildWatch = () => {
          child.off("error", onError);
          child.off("exit", onExit);
          child.stdin.off("error", onStdinError);
          child.stdout.off("error", onStdoutError);
          child.stdout.off("end", onStdoutEnd);
          child.stdout.off("close", onStdoutClose);
        };
        const callSeat = (seat) => liveSeatCaller({
          client,
          promptFor,
          parsePacket: (text) => parsePacket(text, seat.model, seat.role)
        })(seat);
        let results = [];
        const durablePacketModels = new Set();
        const transportWarnings = [];
        let transportDecisionRecorded = false;
        const requiredDurableComplete = () => SEATS
          .filter((seat) => seat.role === "approver")
          .every((seat) => durablePacketModels.has(seat.model));
        const allDurableComplete = () => SEATS.every((seat) => durablePacketModels.has(seat.model));
        const recordAdvisoryTransportFailure = (failure, seat = null) => {
          const warning = `Advisory non-veto transport failure ${failure.reason_code}: ${failure.message}`;
          if (transportWarnings.includes(warning)) return;
          transportWarnings.push(warning);
          validationDiagnostics = [
            ...validationDiagnostics,
            {
              reason_code: "ADVISORY_TRANSPORT_FAILURE",
              model: seat?.model ?? null,
              role: seat?.role ?? "transport",
              non_veto: true,
              message: warning,
              transport_failure_ref: canonicalRef(terminalFailureProjection(failure)),
              observed_raw_sha256: null,
              observed_response_id: null,
              advisory_content: null
            }
          ];
        };
        const publishPreparedDecision = (nextChain, {
          filename,
          packet = null,
          failure = null,
          signatureSecret = null
        }) => {
          const envelope = createDurableDecisionEnvelope(nextChain, {
            filename,
            packet,
            failure,
            signatureSecret
          });
          try {
            const publication = publishJson(outputDirectory, filename, envelope);
            const verification = validateDurableDecisionPublication(
              publication,
              envelope,
              outputDirectory,
              filename,
              { signatureSecret }
            );
            return { envelope, filename, verification };
          } catch (error) {
            const target = path.join(outputDirectory, filename);
            const pending = path.join(outputDirectory, pendingPublicationName(filename));
            const visibleOrPending = [target, pending].some((candidate) => {
              try {
                lstatSync(candidate);
                return true;
              } catch {
                return false;
              }
            });
            if (visibleOrPending) {
              throw fixedControllerError({ suppressTerminalSummary: true });
            }
            throw error;
          }
        };
        const adoptPublishedDecision = ({ envelope, filename, verification }) => {
          adoptedDurableEnvelopes.set(filename, Object.freeze({
            envelope: JSON.parse(JSON.stringify(envelope)),
            path: verification.path,
            raw_sha256: verification.raw_sha256,
            raw_bytes: Buffer.from(verification.raw_bytes)
          }));
        };
        const prepareSeatTransportFailure = (seat, failure) => {
          const projection = terminalFailureProjection(failure);
          const failed = {
            model: seat.model,
            role: seat.role,
            ok: false,
            signed: false,
            reason_code: projection.reason_code,
            reason: `${projection.reason_code}: ${projection.message}`,
            failure: projection,
            terminal_failure: failure
          };
          const nextChain = appendSeatTransportDeath(decisionChain, seat, failure);
          const published = publishPreparedDecision(nextChain, {
            filename: `${seat.model}.json`,
            failure: projection
          });
          return { failed, nextChain, published };
        };
        const appendActiveAdvisoryFailure = (seat, failure) => {
          const { failed, nextChain, published } = prepareSeatTransportFailure(seat, failure);
          results = [...results, failed];
          validatedResults = [...validatedResults, failed];
          decisionChain = nextChain;
          adoptPublishedDecision(published);
          transportDecisionRecorded = true;
          recordAdvisoryTransportFailure(failure, seat);
        };
        const recordTransportDecision = (failure) => {
          if (transportDecisionRecorded) return;
          const nextChain = appendTransportDeath(decisionChain, failure);
          const published = publishPreparedDecision(nextChain, {
            filename: "provider-transport.json",
            failure: terminalFailureProjection(failure)
          });
          decisionChain = nextChain;
          adoptPublishedDecision(published);
          transportDecisionRecorded = true;
        };
        const throwTerminalTransportFailure = (failure, seat = null) => {
          if (seat) {
            const { failed, nextChain, published } = prepareSeatTransportFailure(seat, failure);
            results = [...results, failed];
            validatedResults = [...validatedResults, failed];
            decisionChain = nextChain;
            adoptPublishedDecision(published);
            transportDecisionRecorded = true;
          }
          else recordTransportDecision(failure);
          throw terminalError(failure);
        };
        const yieldTransportEvents = () => new Promise((resolve) => setImmediate(resolve));
        for (const seat of SEATS) {
          if (latchedTransportFailure) {
            if (!requiredDurableComplete()) throwTerminalTransportFailure(latchedTransportFailure);
            recordTransportDecision(latchedTransportFailure);
            recordAdvisoryTransportFailure(latchedTransportFailure);
            break;
          }
          const outcome = await Promise.race([
            runCouncil({ seats: [seat], callSeat, dossier, maxConcurrency: 1 })
              .then((seatResults) => ({ kind: "seat", seatResults })),
            transportFailureSignal.then((failure) => ({ kind: "transport", failure }))
          ]);
          if (outcome.kind === "transport") {
            if (seat.role === "approver" || !requiredDurableComplete()) throwTerminalTransportFailure(outcome.failure, seat);
            appendActiveAdvisoryFailure(seat, outcome.failure);
            break;
          }
          const { seatResults } = outcome;
          if (!Array.isArray(seatResults) || seatResults.length !== 1) {
            fail(`serial council returned an invalid result cardinality for ${seat.model}.`);
          }
          await yieldTransportEvents();
          if (latchedTransportFailure) {
            if (seat.role === "approver" || !requiredDurableComplete()) throwTerminalTransportFailure(latchedTransportFailure, seat);
            appendActiveAdvisoryFailure(seat, latchedTransportFailure);
            break;
          }
          const normalizedResult = normalizeProviderSeatResult(seat, seatResults[0]);
          const nextResults = [...results, normalizedResult];
          const sensitiveDiagnostics = [];
          const sensitiveSafeResults = nextResults.map((result) => {
            if (result?.ok !== true
              || !serializableStringContainsActiveSecret(result.packet, activePacketSecrets)) return result;
            const failure = packetValidationFailure(
              result,
              "SENSITIVE_PACKET_CONTENT",
              "successful packet contained an active secret"
            );
            sensitiveDiagnostics.push(failure.diagnostic);
            return failure.result;
          });
          const signatureDiagnostics = [];
          const signatureSafeResults = sensitiveSafeResults.map((result, index) => {
            if (result?.ok !== true) return result;
            const trustedSeat = SEATS[index];
            const signatureSecret = trustedSeat
              ? environment[`TELOS_SECRET_${trustedSeat.model.toUpperCase()}`]
              : null;
            const defects = result.signed === true
              && result.model === trustedSeat?.model
              && result.role === trustedSeat?.role
              ? acceptedPacketVerificationDefects(result.packet, trustedSeat, signatureSecret)
              : ["successful result did not bind the trusted signed seat"];
            if (defects.length === 0) return result;
            const failure = packetValidationFailure(
              result,
              "INVALID_PACKET_SIGNATURE",
              "successful packet failed exact packet/signature verification"
            );
            signatureDiagnostics.push(failure.diagnostic);
            return failure.result;
          });
          const provenanceClassification = classifyPacketProvenance(
            signatureSafeResults,
            preflight.prior_response_ids
          );
          const bindingClassification = classifyCandidateBindingResults(provenanceClassification.results, dossier);
          const nextValidatedResults = bindingClassification.results;
          const nextValidationDiagnostics = [
            ...sensitiveDiagnostics,
            ...signatureDiagnostics,
            ...provenanceClassification.diagnostics,
            ...bindingClassification.diagnostics
          ];
          const accepted = nextValidatedResults.at(-1);
          let nextChain;
          let published;
          if (accepted?.ok === true && accepted.signed === true) {
            validateFreshPacketHashes(nextValidatedResults
              .filter((result) => result?.ok === true && result.signed === true)
              .map((result) => ({ model: result.model, raw_sha256: rawSha256(jsonBytes(result.packet)) })));
            nextChain = appendAcceptedPublishedSeatDecision(decisionChain, accepted);
            published = publishPreparedDecision(nextChain, {
              filename: `${accepted.model}.json`,
              packet: accepted.packet,
              signatureSecret: environment[`TELOS_SECRET_${accepted.model.toUpperCase()}`]
            });
          } else {
            const failure = failedSeatProjection(accepted);
            nextChain = appendFailedSeatDecision(decisionChain, accepted);
            published = publishPreparedDecision(nextChain, {
              filename: `${accepted.model}.json`,
              failure
            });
          }
          results = nextValidatedResults;
          validatedResults = nextValidatedResults;
          validationDiagnostics = [...validationDiagnostics, ...nextValidationDiagnostics];
          decisionChain = nextChain;
          adoptPublishedDecision(published);
          if (accepted?.ok === true && accepted.signed === true) durablePacketModels.add(accepted.model);
          await yieldTransportEvents();
          if (latchedTransportFailure) {
            if (!requiredDurableComplete()) throwTerminalTransportFailure(latchedTransportFailure);
            recordTransportDecision(latchedTransportFailure);
            recordAdvisoryTransportFailure(latchedTransportFailure);
            if (!allDurableComplete()) break;
          }
        }
        const packets = validatedResults.filter((result) => result?.ok).map((result) => result.packet);
        const rendered = packets.map((packet) => jsonBytes(packet));
        validateFreshPacketHashes(packets.map((packet, index) => ({
          model: packet.model,
          raw_sha256: rawSha256(rendered[index])
        })));
        const requiredPackets = packets.filter((packet) => packet.role === "approver");
        const requiredGate = validateRecords(dossier, requiredPackets);
        const completeGate = validateRecords(dossier, packets);
        await yieldTransportEvents();
        if (latchedTransportFailure) {
          if (!requiredDurableComplete()) throwTerminalTransportFailure(latchedTransportFailure);
          recordTransportDecision(latchedTransportFailure);
          recordAdvisoryTransportFailure(latchedTransportFailure);
        }
        const projectedGate = projectAdvisoryNonVetoGate(requiredGate, completeGate);
        const gate = {
          ...projectedGate,
          warnings: [...projectedGate.warnings, ...transportWarnings]
        };
        return persistSummary(buildAuthorizationSummary({
          results: validatedResults,
          gate,
          objective,
          preparationSource: preflight.executing_source,
          providerTransport: preflight.provider_transport,
          timestamp,
          ephemeralSigners,
          validationDiagnostics,
          agyReviewInputRef,
          decisionChain
        }));
      } finally {
        closeExpectedly();
        providerHooks?.deregister();
      }
    },
    persistFailure: persistControllerFailure
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === "preflight") {
    console.log(JSON.stringify(runDeterministicPreflight({ sourceReview: options.sourceReview }), null, 2));
    return;
  }
  const preflight = runDeterministicPreflight({ sourceReview: false });
  await runLive(preflight);
}

export { CONSTANTS, runDeterministicPreflight };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }
}
