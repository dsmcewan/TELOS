#!/usr/bin/env node
// TELOS signed authorization council for the Daedalus-family multi-model-seat
// lifecycle implementation plan. Required approvers remain claude/agy/codex;
// grok/gemini remain advisory at the TELOS authorization boundary.

import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (relative) => import(pathToFileURL(path.join(ROOT, relative)).href);

const AUTHORIZATION_ID = "authz-012";
const BUILD_ID = "daedalus-family-lifecycle-authz-012";
const USE_CASE = "multi-model-seats-daedalus-family-lifecycle";
const PLAN_PATH = "docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md";
const SPEC_PATH = "docs/superpowers/specs/2026-07-21-daedalus-family-multi-model-seat-lifecycle-design.md";
const EXPECTED_PLAN_REF = "sha256:88e15cc7b72f19c64c6131fb5bf805f3368723139d0a514232e406b3a056de8b";
const REVIEWED_HEAD = "12f6bfc70390863e218249e2b6424947ff2933e2";
const PLAN_REVIEWED_HEAD = "c3fd3afe22fc7c284ce29c10c5885610686f7d69";
const EXTENDS = "authz-008";
const RETRY_OF = "authz-011";
const PRIOR_AUTHORIZATION_ID = "authz-011";
const PRIOR_BUILD_ID = "daedalus-family-lifecycle-authz-011";
const PRIOR_RETRY_REF = "sha256:bbdca869177ecf56c39a9d4bae84cc9d3fd7a820aa200527cc36f0d29621367a";
const PRIOR_RETRY_OF = "authz-010";
const PRIOR_PREDECESSOR_ATTEMPT_REF = "sha256:c49747274771ec76a9071d295cf28c982396bc6395ea400aa131d76e71df027c";
const PRIOR_COMMIT_PARENT = "643308f1abdf0f82095c874797111b8cd6caa55a";
const PRIOR_COMMIT_REF = "git:12f6bfc70390863e218249e2b6424947ff2933e2";
const PRIOR_TREE_REF = "git:2cada61b75d20a99b77f1a95edf41032a0591011";
const PRIOR_ATTEMPT_DIRECTORY_TREE_REF = "git:9fdee07fb7b2969bb05f840dd7a4d44a5451f66a";
const PRIOR_SUMMARY_RAW_SHA256 = "sha256:c87588d1c7d70f1e5bd83220502092c87038eb9f3af9b0e5a38690bfc8c0504c";
const PRIOR_ATTEMPT_REF = "sha256:ddf45293740e8dc8ceb7d4c4c5b91a50666dad598fbe33ee2299aca1b4104fe2";
const PRIOR_DISK_TREE_REF = "sha256:509c0f9c667689b822d88e137431ad5a9800d0af6bedac1a5e6126d1792e0d3d";
const EXPECTED_PRIOR_FAILURE_SET_REF = "sha256:54288488d612807e4cb20292af96fa88c0f4b917949916a0d01f6415d67a1ffc";
const EXPECTED_RETRY_REF = "sha256:d69ac2d5bd3bb34947c6734d3fee5c7ea47003c4e4bcad65dbc51af88b3add05";
const EXPECTED_DESIGN_SHA256 = "5c972b176df402d22a65273520d2342541cd213717e80c8460577a7ad6c920c9";
const AUTHORIZATION_TIMEOUT_MS = 1_800_000;
const PRIOR_ATTEMPT_RELATIVE_DIR = "docs/runs/daedalus-family-lifecycle-authorization-3";
const PRIOR_ATTEMPT_DIR = path.join(ROOT, PRIOR_ATTEMPT_RELATIVE_DIR);
const PRIOR_ATTEMPT_FILES = [
  { path: "agy.json", raw_sha256: "sha256:88f32c4d8d4428766af75ac1aecb2b0b2cf135878df5556021f0d0f06fbcf774" },
  { path: "authorization-summary.json", raw_sha256: PRIOR_SUMMARY_RAW_SHA256 },
  { path: "gemini.json", raw_sha256: "sha256:9b041c1c240cae871e05c9487d71e2765f6898251320e507296f8c40ef5a16f4" },
  { path: "retry-node.json", raw_sha256: "sha256:7718a6afc1bad5f68f26d6c6dcb504a52f1be9bea3cea5ec9db1019311775ec0" },
  { path: "run-authorization.mjs", raw_sha256: "sha256:2d02862186e2b312586f837f21af6ceb60fecab36c1ad4061089e717b7d7962e" }
];
const PRIOR_ATTEMPT_FILE_NAMES = PRIOR_ATTEMPT_FILES.map((entry) => entry.path);
const PRIOR_FAILURE_SET = {
  record_version: "telos.authorization-seat-failure-set.v1",
  terminal_failure: false,
  failures: [
    {
      kind: "provider-death",
      seat: "claude",
      role: "approver",
      expected_provider: "anthropic",
      reason_code: "SOCKET_HANG_UP",
      observed_reason: "socket hang up"
    },
    {
      kind: "provider-death",
      seat: "codex",
      role: "approver",
      expected_provider: "openai",
      reason_code: "SOCKET_HANG_UP",
      observed_reason: "socket hang up"
    },
    {
      kind: "provider-death",
      seat: "grok",
      role: "advisory",
      expected_provider: "xai",
      reason_code: "SOCKET_HANG_UP",
      observed_reason: "socket hang up"
    }
  ]
};
const TRANSPORT_POLICY = {
  council_max_concurrency: 1,
  per_seat_automatic_retries: 0
};
const AUTHORITY_CRITICAL_FILES = [
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
  "connectors/ai-peer-mcp/lib.mjs"
];

function gitInvocation(args) {
  if (process.platform !== "win32") return { command: "git", args: ["-C", ROOT, ...args] };

  // Git for Windows does not reliably traverse a WSL UNC worktree. Invoke the
  // distribution's Git directly when this runner was launched by Windows Node.
  const uncMatch = ROOT.match(/^\\\\(?:wsl\.localhost|wsl\$)\\([^\\]+)(\\.*)$/i);
  if (uncMatch) {
    const [, distro, uncPath] = uncMatch;
    const linuxRoot = uncPath.replace(/\\/g, "/") || "/";
    return { command: "wsl.exe", args: ["-d", distro, "--exec", "git", "-C", linuxRoot, ...args] };
  }

  return { command: "git.exe", args: ["-C", ROOT, ...args] };
}

function runGit(args, allowedStatuses = [0]) {
  const invocation = gitInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: cannot run Git (${result.error.message}).`);
  }
  if (!allowedStatuses.includes(result.status)) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join(" ").trim();
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: git ${args.join(" ")} exited ${result.status}.${detail ? ` ${detail}` : ""}`);
  }
  return result;
}

function assertTrackedClean(file) {
  runGit(["ls-files", "--error-unmatch", "--", file]);
  if (runGit(["diff", "--quiet", "--", file], [0, 1]).status === 1) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: working-tree drift in authority-critical file ${file}.`);
  }
  if (runGit(["diff", "--cached", "--quiet", "--", file], [0, 1]).status === 1) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: index drift in authority-critical file ${file}.`);
  }
}

function assertAuthorizationPreflight() {
  const head = runGit(["rev-parse", "--verify", "HEAD"]).stdout.trim();
  if (head !== REVIEWED_HEAD) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: Git HEAD ${head || "<missing>"} does not equal reviewed head ${REVIEWED_HEAD}.`);
  }

  let authority;
  try {
    authority = JSON.parse(readFileSync(path.join(ROOT, "CURRENT-AUTHORITY.json"), "utf8"));
  } catch (error) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: cannot read CURRENT-AUTHORITY.json (${error?.message || String(error)}).`);
  }
  const activeAuthorization = authority?.active_authorization?.id;
  if (activeAuthorization !== EXTENDS) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: CURRENT-AUTHORITY.json active authorization ${activeAuthorization || "<missing>"} does not equal required predecessor ${EXTENDS}.`);
  }

  let designSha256;
  try {
    designSha256 = createHash("sha256").update(readFileSync(path.join(ROOT, SPEC_PATH))).digest("hex");
  } catch (error) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: cannot hash ${SPEC_PATH} (${error?.message || String(error)}).`);
  }
  if (designSha256 !== EXPECTED_DESIGN_SHA256) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: raw SHA-256 for ${SPEC_PATH} is ${designSha256}, expected ${EXPECTED_DESIGN_SHA256}.`);
  }

  for (const file of AUTHORITY_CRITICAL_FILES) assertTrackedClean(file);

  const priorCommit = PRIOR_COMMIT_REF.replace(/^git:/, "");
  const resolvedCommit = runGit(["rev-parse", "--verify", `${priorCommit}^{commit}`]).stdout.trim();
  if (resolvedCommit !== priorCommit) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior commit ${PRIOR_COMMIT_REF} resolves to ${resolvedCommit || "<missing>"}.`);
  }
  const lineage = runGit(["rev-list", "--parents", "-n", "1", priorCommit]).stdout.trim().split(/\s+/);
  if (lineage.length !== 2 || lineage[0] !== priorCommit || lineage[1] !== PRIOR_COMMIT_PARENT) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior commit ${PRIOR_COMMIT_REF} must have sole parent git:${PRIOR_COMMIT_PARENT}; got ${lineage.join(" ") || "<missing>"}.`);
  }
  const priorTree = runGit(["rev-parse", "--verify", `${priorCommit}^{tree}`]).stdout.trim();
  if (`git:${priorTree}` !== PRIOR_TREE_REF) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior commit tree git:${priorTree || "<missing>"} does not equal ${PRIOR_TREE_REF}.`);
  }
  const priorAttemptDirectoryTree = runGit(["rev-parse", "--verify", `${priorCommit}:${PRIOR_ATTEMPT_RELATIVE_DIR}`]).stdout.trim();
  if (`git:${priorAttemptDirectoryTree}` !== PRIOR_ATTEMPT_DIRECTORY_TREE_REF) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior attempt directory tree git:${priorAttemptDirectoryTree || "<missing>"} does not equal ${PRIOR_ATTEMPT_DIRECTORY_TREE_REF}.`);
  }

  let priorEntries;
  try {
    priorEntries = readdirSync(PRIOR_ATTEMPT_DIR, { withFileTypes: true });
  } catch (error) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: cannot inventory ${PRIOR_ATTEMPT_RELATIVE_DIR} (${error?.message || String(error)}).`);
  }
  const invalidEntry = priorEntries.find((entry) => !entry.isFile());
  if (invalidEntry) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior attempt contains non-file entry ${invalidEntry.name}.`);
  }
  const actualPriorFiles = priorEntries.map((entry) => entry.name).sort();
  const expectedPriorFiles = [...PRIOR_ATTEMPT_FILE_NAMES].sort();
  if (JSON.stringify(actualPriorFiles) !== JSON.stringify(expectedPriorFiles)) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior attempt inventory is [${actualPriorFiles.join(", ")}], expected [${expectedPriorFiles.join(", ")}].`);
  }
  for (const expected of PRIOR_ATTEMPT_FILES) {
    let actualRawSha256;
    try {
      actualRawSha256 = `sha256:${createHash("sha256").update(readFileSync(path.join(PRIOR_ATTEMPT_DIR, expected.path))).digest("hex")}`;
    } catch (error) {
      throw new Error(`AUTHORIZATION PREFLIGHT FAILED: cannot hash prior attempt file ${expected.path} (${error?.message || String(error)}).`);
    }
    if (actualRawSha256 !== expected.raw_sha256) {
      throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior attempt file ${expected.path} hashes to ${actualRawSha256}, expected ${expected.raw_sha256}.`);
    }
    assertTrackedClean(`${PRIOR_ATTEMPT_RELATIVE_DIR}/${expected.path}`);
  }
}

// This must complete before importing any MCP-facing code or constructing a client.
assertAuthorizationPreflight();

// These two deterministic Merkle helpers are safe to load after their own
// tracked-file drift checks and before any MCP-facing module is imported.
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const { computeDiskTreeHash } = await imp("merkle-dag/artifact.mjs");

const planText = readFileSync(path.join(ROOT, PLAN_PATH), "utf8");
const planFileSha256 = `sha256:${createHash("sha256").update(planText, "utf8").digest("hex")}`;
const planRef = `sha256:${sha256hex(canonicalize({ kind: "candidate", plan: planText }))}`;
if (planRef !== EXPECTED_PLAN_REF) {
  console.error(`PLAN DRIFT: ${PLAN_PATH} recomputes to ${planRef}, expected ${EXPECTED_PLAN_REF}. Refusing to authorize.`);
  process.exit(1);
}

let priorSummary;
try {
  priorSummary = JSON.parse(readFileSync(path.join(PRIOR_ATTEMPT_DIR, "authorization-summary.json"), "utf8"));
} catch (error) {
  throw new Error(`AUTHORIZATION PREFLIGHT FAILED: cannot parse prior authorization summary (${error?.message || String(error)}).`);
}

const expectedPriorSummarySemantics = {
  authorization_id: PRIOR_AUTHORIZATION_ID,
  build_id: PRIOR_BUILD_ID,
  plan_ref: EXPECTED_PLAN_REF,
  retry_ref: PRIOR_RETRY_REF,
  retry_of: PRIOR_RETRY_OF,
  prior_attempt_ref: PRIOR_PREDECESSOR_ATTEMPT_REF,
  authorized: false,
  authorization: {
    status: "NOT_AUTHORIZED",
    plan_ref: EXPECTED_PLAN_REF
  },
  terminal_failure: null,
  seats: [
    { model: "claude", role: "approver", ok: false, state: "failed", reason: "socket hang up" },
    { model: "agy", role: "approver", ok: true, decision: "approve" },
    { model: "codex", role: "approver", ok: false, state: "failed", reason: "socket hang up" },
    { model: "grok", role: "advisory", ok: false, state: "failed", reason: "socket hang up" },
    { model: "gemini", role: "advisory", ok: true, decision: "approve" }
  ],
  gate: {
    gate_status: "blocked",
    blockers: [
      "Missing required claude approval packet.",
      "Missing required codex approval packet."
    ],
    warnings: ["No Grok advisory packet present."]
  }
};
const actualPriorSummarySemantics = {
  authorization_id: priorSummary?.authorization_id,
  build_id: priorSummary?.build_id,
  plan_ref: priorSummary?.plan_ref,
  retry_ref: priorSummary?.retry_ref,
  retry_of: priorSummary?.retry_of,
  prior_attempt_ref: priorSummary?.prior_attempt_ref,
  authorized: priorSummary?.authorized,
  authorization: {
    status: priorSummary?.authorization?.status,
    plan_ref: priorSummary?.authorization?.plan_ref
  },
  terminal_failure: priorSummary?.terminal_failure ?? null,
  seats: Array.isArray(priorSummary?.seats)
    ? priorSummary.seats.map((seat) => ({
        model: seat?.model,
        role: seat?.role,
        ok: seat?.ok,
        ...(seat?.ok
          ? { decision: seat?.decision }
          : { state: seat?.state, reason: seat?.reason })
      }))
    : null,
  gate: {
    gate_status: priorSummary?.gate?.gate_status,
    blockers: priorSummary?.gate?.blockers,
    warnings: priorSummary?.gate?.warnings
  }
};
if (canonicalize(actualPriorSummarySemantics) !== canonicalize(expectedPriorSummarySemantics)) {
  throw new Error("AUTHORIZATION PREFLIGHT FAILED: prior authorization summary semantics do not match the exact authz-011 NOT_AUTHORIZED three-seat socket-hang-up failure state.");
}
const priorCanonicalSummaryRef = `sha256:${sha256hex(canonicalize(priorSummary))}`;
if (priorCanonicalSummaryRef !== PRIOR_ATTEMPT_REF) {
  throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior canonical summary ref ${priorCanonicalSummaryRef} does not equal ${PRIOR_ATTEMPT_REF}.`);
}

const priorDiskTree = computeDiskTreeHash(PRIOR_ATTEMPT_FILE_NAMES, PRIOR_ATTEMPT_DIR);
const priorHashes = new Map(PRIOR_ATTEMPT_FILES.map((entry) => [entry.path, entry.raw_sha256]));
for (const entry of priorDiskTree.files) {
  if (entry.status !== "present" || entry.filehash !== priorHashes.get(entry.path)) {
    throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior disk-tree entry ${entry.path} is ${entry.status}/${entry.filehash}, expected present/${priorHashes.get(entry.path)}.`);
  }
}
if (priorDiskTree.tree_hash !== PRIOR_DISK_TREE_REF) {
  throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior disk tree ${priorDiskTree.tree_hash} does not equal ${PRIOR_DISK_TREE_REF}.`);
}

const priorFailureSetRef = `sha256:${sha256hex(canonicalize(PRIOR_FAILURE_SET))}`;
if (priorFailureSetRef !== EXPECTED_PRIOR_FAILURE_SET_REF) {
  throw new Error(`AUTHORIZATION PREFLIGHT FAILED: prior failure set ref ${priorFailureSetRef} does not equal ${EXPECTED_PRIOR_FAILURE_SET_REF}.`);
}

const retryNode = {
  schema_version: "telos.authorization-retry.v1",
  node_type: "authorization-retry",
  candidate_ref: planRef,
  authority_predecessor: EXTENDS,
  retry_of: RETRY_OF,
  prior_attempt_ref: PRIOR_ATTEMPT_REF,
  prior_summary_raw_sha256: PRIOR_SUMMARY_RAW_SHA256,
  prior_disk_tree_ref: PRIOR_DISK_TREE_REF,
  prior_attempt_commit: PRIOR_COMMIT_REF,
  prior_attempt_tree: PRIOR_TREE_REF,
  failure: PRIOR_FAILURE_SET,
  transport_policy: TRANSPORT_POLICY,
  route: "daedalus-recovery",
  mutation: false
};
const retryRef = `sha256:${sha256hex(canonicalize(retryNode))}`;
if (retryRef !== EXPECTED_RETRY_REF) {
  throw new Error(`AUTHORIZATION PREFLIGHT FAILED: retry ref ${retryRef} does not equal ${EXPECTED_RETRY_REF}.`);
}

const retryBindings = {
  retry_ref: retryRef,
  retry_of: RETRY_OF,
  prior_attempt_ref: PRIOR_ATTEMPT_REF,
  prior_retry_ref: PRIOR_RETRY_REF,
  prior_summary_raw_sha256: PRIOR_SUMMARY_RAW_SHA256,
  prior_disk_tree_ref: PRIOR_DISK_TREE_REF,
  prior_attempt_commit: PRIOR_COMMIT_REF,
  prior_attempt_tree: PRIOR_TREE_REF,
  prior_attempt_directory_tree: PRIOR_ATTEMPT_DIRECTORY_TREE_REF,
  prior_failure_set_ref: priorFailureSetRef,
  transport_policy: TRANSPORT_POLICY
};

// No provider-facing module is loaded until every retry-lineage check above
// has passed and the immutable retry identity has been derived.
await imp("connectors/ai-peer-mcp/server.mjs");
const { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } = await imp("build-gate/council.mjs");
const { validateRecords } = await imp("build-gate/gate.mjs");
const { spawnMcpClient } = await imp("breakout/mcp_client.mjs");

const outputFiles = ["retry-node.json", "authorization-summary.json", "claude.json", "agy.json", "codex.json", "grok.json", "gemini.json"];
const existingOutput = outputFiles.find((file) => existsSync(path.join(HERE, file)));
if (existingOutput) {
  console.error(`IMMUTABLE RUN: ${existingOutput} already exists; create a new authorization attempt directory.`);
  process.exit(1);
}
mkdirSync(HERE, { recursive: true });
writeFileSync(path.join(HERE, "retry-node.json"), `${JSON.stringify(retryNode, null, 2)}\n`, { flag: "wx" });

const EPHEMERAL_SIGNERS = [];
for (const seat of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${seat}`]) {
    process.env[`TELOS_SECRET_${seat}`] = randomBytes(24).toString("hex");
    EPHEMERAL_SIGNERS.push(seat.toLowerCase());
  }
}

const TIMESTAMP = new Date().toISOString();
const OBJECTIVE = [
  `Conduct a fresh signed five-seat council retry for the unchanged Daedalus-family multi-model-seat lifecycle plan at canonical candidate ref ${planRef}. This attempt is ${AUTHORIZATION_ID}, retry_of ${RETRY_OF}, prior_attempt_ref ${PRIOR_ATTEMPT_REF}, retry_ref ${retryRef}, and authority_predecessor ${EXTENDS}.`,
  `Daedalus routed the prior versioned seat-failure set ${priorFailureSetRef} through daedalus-recovery with mutation false: claude approver, codex approver, and grok advisory each failed with SOCKET_HANG_UP / socket hang up; the prior attempt was not a terminal failure.`,
  `The retry is bound to prior commit ${PRIOR_COMMIT_REF} with sole parent git:${PRIOR_COMMIT_PARENT}, full repository tree ${PRIOR_TREE_REF}, attempt-directory tree ${PRIOR_ATTEMPT_DIRECTORY_TREE_REF}, prior retry ${PRIOR_RETRY_REF}, canonical prior summary ${PRIOR_ATTEMPT_REF}, raw prior summary ${PRIOR_SUMMARY_RAW_SHA256}, and prior disk tree ${PRIOR_DISK_TREE_REF}; the plan remains the candidate reviewed at git:${PLAN_REVIEWED_HEAD}.`,
  `Transport policy is council_max_concurrency ${TRANSPORT_POLICY.council_max_concurrency} and per_seat_automatic_retries ${TRANSPORT_POLICY.per_seat_automatic_retries}: invoke all five fresh seats exactly once, serially, with no in-process retry.`,
  "Call claude, agy, codex, grok, and gemini afresh. Prior packets are immutable historical evidence only and must never be loaded, copied, or reused as this attempt's decisions.",
  "Council approval remains authorization only: it certifies and submits this exact unchanged plan to The Eye, grants no implementation authority, cannot start Task 1, and does not modify CURRENT-AUTHORITY.json.",
  "The implementation target is the source plugin at /home/colchis/plugins/multi-model-seats; the installed Codex cache is not source.",
  "The plan passed Icarus R2/R3 close-out and requires strict per-round checkpoint/precompact semantics: after every Daedalus/Icarus review-fix round, Icarus alone consolidates validated findings and dispositions into the plugin-owned lifecycle-round checkpoint before precompact/rotation; mechanics remain read-only and non-authoritative.",
  "The plan must preserve TELOS authority boundaries: model consensus is not authorization; The Eye authorizes exact roots; Grok and Gemini are mandatory only inside profile gates P2/C2 and remain advisory in the existing TELOS authorization council; the TELOS required authorization trio remains claude/agy/codex.",
  "The plan requires a signed append-only Merkle-DAG decision record for every pass, non-pass, provider death, mutation, retry, invalidation, and Eye action; required-seat substitution is forbidden; private reasoning and credentials are not persisted.",
  "There are no automatic lifecycle round/retry/time/cost caps. That rule does not remove explicit Eye pause/cancel/amend/adjudicate authority and does not modify existing TELOS council policy.",
  "Approve only if the plan is internally consistent, implementation-ready, test-driven, zero-dependency Node ESM, fail-closed, and sufficient to re-derive canonical artifacts, signatures, provenance, gate order, disk truth, and the exact TELOS export from disk. Approval certifies and submits only this exact plan to The Eye; a separate Eye decision is required for implementation authority and before Task 1 may start. Return revise for any concrete defect that must be corrected before submission."
].join(" ");

const WRITE_TARGETS = ["/home/colchis/plugins/multi-model-seats/"];
const dossier = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  objective: OBJECTIVE,
  proposal_ref: planRef,
  ...retryBindings,
  required_docs: [PLAN_PATH, SPEC_PATH],
  write_targets: WRITE_TARGETS,
  protected_paths: [],
  trust_mode: "signed"
};

const meta = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  proposal_ref: planRef,
  ...retryBindings,
  timestamp: TIMESTAMP,
  docs_reviewed: [PLAN_PATH, SPEC_PATH]
};

const PACKET_SCHEMA = {
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

function parsePacket(text, model, role) {
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* fail closed below */ }
  if (parsed && parsed.phase_gate_status) return { ...agyApprovalPacket(parsed, meta), role, ...retryBindings };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};
  return {
    build_id: BUILD_ID,
    use_case: USE_CASE,
    model,
    role,
    docs_reviewed: meta.docs_reviewed,
    proposal_ref: planRef,
    ...retryBindings,
    decision: ["approve", "revise", "reject"].includes(parsed.decision) ? parsed.decision : "revise",
    required_edits: Array.isArray(parsed.required_edits) ? parsed.required_edits : [],
    hard_stops: Array.isArray(parsed.hard_stops) ? parsed.hard_stops : [],
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
    timestamp: TIMESTAMP,
    rationale: typeof parsed.rationale === "string" ? parsed.rationale : "unparsable seat response (fail-closed to revise)"
  };
}

function stripAdditionalProperties(schema) {
  const clone = JSON.parse(JSON.stringify(schema));
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    delete node.additionalProperties;
    for (const value of Object.values(node)) walk(value);
  };
  walk(clone);
  return clone;
}

const FIELD_SEMANTICS =
  "Field semantics (STRICT): decision 'approve' means this council certifies and submits the exact plan to The Eye. It never grants implementation authority and never starts Task 1; only a separate Eye decision can do that. " +
  `This is a no-mutation recovery retry bound to retry_ref ${retryRef}, retry_of ${RETRY_OF}, prior_attempt_ref ${PRIOR_ATTEMPT_REF}, prior_failure_set_ref ${priorFailureSetRef}, and transport_policy {council_max_concurrency:${TRANSPORT_POLICY.council_max_concurrency},per_seat_automatic_retries:${TRANSPORT_POLICY.per_seat_automatic_retries}}; evaluate it afresh and never reuse a prior packet. ` +
  "hard_stops lists only conditions that block authorization now. required_edits lists only concrete changes demanded before approval. " +
  "An unconditional approval requires both arrays to be empty. Put strengths and non-blocking commentary only in rationale.";

function promptFor(model, _role, dsr) {
  if (model === "agy") {
    return { tool: "agy_checkpoint", args: agyCheckpointArgs(dsr, "/home/colchis/plugins/multi-model-seats/") };
  }
  return {
    tool: `${model}_ask`,
    args: {
      prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== DESIGN (${SPEC_PATH}) ===\n\n${readFileSync(path.join(ROOT, SPEC_PATH), "utf8")}\n\n=== PLAN UNDER AUTHORIZATION (${PLAN_PATH}, ${planRef}) ===\n\n${planText}`,
      system: `You are the ${model} seat on the TELOS authorization council. Independently judge the exact plan on its merits. Approve only what you would stake your seat's provenance on. ${FIELD_SEMANTICS}`,
      model,
      max_tokens: 30000,
      include_provenance: true,
      response_schema: model === "gemini" ? stripAdditionalProperties(PACKET_SCHEMA) : PACKET_SCHEMA,
      schema_name: "telos_approval_packet"
    }
  };
}

const seats = [
  { model: "claude", role: "approver" },
  { model: "agy", role: "approver" },
  { model: "codex", role: "approver" },
  { model: "grok", role: "advisory" },
  { model: "gemini", role: "advisory" }
];

function boundedText(value, limit = 240) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, limit);
}

function makeTerminalFailure(kind, { message, code = null, signal = null } = {}) {
  const definitions = {
    timeout: { reason_code: "AUTHZ_TIMEOUT", timeout_ms: AUTHORIZATION_TIMEOUT_MS },
    "mcp-child-error": { reason_code: "MCP_CHILD_ERROR", timeout_ms: null },
    "mcp-child-exit": { reason_code: "MCP_CHILD_EXIT", timeout_ms: null }
  };
  const definition = definitions[kind];
  if (!definition) throw new Error(`unsupported terminal failure kind ${kind}`);
  return Object.freeze({
    record_version: "telos.authorization-terminal-failure.v1",
    kind,
    reason_code: definition.reason_code,
    message: boundedText(message),
    timeout_ms: definition.timeout_ms,
    child_exit_code: Number.isInteger(code) && code >= 0 && code <= 255 ? code : null,
    child_signal: typeof signal === "string" && signal ? boundedText(signal, 64) : null
  });
}

function terminalError(terminalFailure) {
  const error = new Error(`${terminalFailure.reason_code}: ${terminalFailure.message}`);
  error.terminal_failure = terminalFailure;
  return error;
}

function baseSummary() {
  return {
    authorization_id: AUTHORIZATION_ID,
    build_id: BUILD_ID,
    use_case: USE_CASE,
    objective: OBJECTIVE,
    plan_ref: planRef,
    plan_file_sha256: planFileSha256,
    ...retryBindings,
    reviewed_head: REVIEWED_HEAD,
    plan_reviewed_head: PLAN_REVIEWED_HEAD,
    prior_commit_parent: `git:${PRIOR_COMMIT_PARENT}`,
    extends: EXTENDS,
    timestamp: TIMESTAMP,
    trust_mode: "signed",
    ephemeral_signers: EPHEMERAL_SIGNERS,
    seats: []
  };
}

function finalizeSummary({ results = [], terminalFailure = null } = {}) {
  const summary = baseSummary();
  const packetsForGate = [];

  if (terminalFailure) {
    summary.terminal_failure = terminalFailure;
    summary.seats = seats.map((seat) => ({
      model: seat.model,
      role: seat.role,
      ok: false,
      state: "incomplete",
      reason_code: terminalFailure.reason_code
    }));
  } else {
    for (let index = 0; index < seats.length; index += 1) {
      const seat = seats[index];
      const result = results[index];
      if (result?.ok) {
        writeFileSync(path.join(HERE, `${result.model}.json`), `${JSON.stringify(result.packet, null, 2)}\n`, { flag: "wx" });
        packetsForGate.push(result.packet);
        summary.seats.push({
          model: result.model,
          role: result.role,
          ok: true,
          signed: !!result.signed,
          decision: result.packet.decision,
          confidence: result.packet.confidence,
          provenance: result.packet.provenance
        });
      } else {
        summary.seats.push({
          model: result?.model ?? seat.model,
          role: result?.role ?? seat.role,
          ok: false,
          state: result ? "failed" : "incomplete",
          reason: boundedText(result?.reason || "seat result missing")
        });
      }
    }
  }

  const gate = validateRecords(dossier, packetsForGate);
  const terminalBlocker = terminalFailure
    ? `Terminal authorization failure ${terminalFailure.reason_code}: ${terminalFailure.message}`
    : null;
  const blockers = terminalBlocker ? [...gate.blockers, terminalBlocker] : gate.blockers;
  summary.gate = {
    gate_status: terminalFailure ? "blocked" : gate.gate_status,
    signing_enforced: gate.headline_checks?.signing_enforced,
    provenance_enforced: gate.headline_checks?.provenance_enforced,
    blockers,
    warnings: gate.warnings,
    provenance: gate.provenance
  };

  const requiredSeats = seats.filter((seat) => seat.role === "approver").map((seat) => seat.model);
  const approvals = summary.seats.filter((seat) => requiredSeats.includes(seat.model) && seat.ok && seat.decision === "approve");
  summary.authorized = !terminalFailure && gate.gate_status === "pass" && approvals.length === requiredSeats.length;
  summary.authorization = summary.authorized
    ? {
        status: "AUTHORIZED",
        plan_ref: planRef,
        note: `${AUTHORIZATION_ID} signed council and TELOS gate authorize only certification and submission of the exact unchanged Daedalus-family lifecycle plan to The Eye; this does not grant implementation authority, start Task 1, or modify CURRENT-AUTHORITY.json; retry_of ${RETRY_OF}; extends ${EXTENDS}.`
      }
    : {
        status: "NOT_AUTHORIZED",
        plan_ref: planRef,
        note: terminalFailure
          ? `Fail-closed terminal attempt: ${terminalFailure.reason_code}; no implementation authority, Task 1, or CURRENT-AUTHORITY.json mutation.`
          : "Fail-closed: see gate blockers and seat decisions."
      };

  writeFileSync(path.join(HERE, "authorization-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
  return summary;
}

function printSummary(summary) {
  console.log(JSON.stringify({
    authorization_id: AUTHORIZATION_ID,
    plan_ref: planRef,
    retry_ref: retryRef,
    retry_of: RETRY_OF,
    prior_attempt_ref: PRIOR_ATTEMPT_REF,
    authorized: summary.authorized,
    gate_status: summary.gate.gate_status,
    blockers: summary.gate.blockers.length,
    terminal_failure: summary.terminal_failure?.reason_code ?? null,
    seats: summary.seats.map((seat) => ({ model: seat.model, role: seat.role, ok: seat.ok, decision: seat.decision ?? null }))
  }, null, 2));
}

const serverPath = path.join(ROOT, "connectors/ai-peer-mcp/server.mjs");
const { client, child, close } = spawnMcpClient({ command: process.execPath, serverPath });
let expectedChildClose = false;
let cleanupTerminalWatch = () => {};
const terminalFailurePromise = new Promise((_, reject) => {
  let settled = false;
  let timer = null;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    child.off("error", onError);
    child.off("exit", onExit);
  };
  const rejectTerminal = (failure) => {
    if (settled || expectedChildClose) return;
    settled = true;
    cleanup();
    reject(terminalError(failure));
  };
  const onError = (error) => rejectTerminal(makeTerminalFailure("mcp-child-error", {
    message: error?.message || "MCP child emitted an error"
  }));
  const onExit = (code, signal) => rejectTerminal(makeTerminalFailure("mcp-child-exit", {
    message: `MCP child exited unexpectedly (code ${Number.isInteger(code) ? code : "null"}, signal ${signal || "null"})`,
    code,
    signal
  }));

  child.once("error", onError);
  child.once("exit", onExit);
  timer = setTimeout(() => rejectTerminal(makeTerminalFailure("timeout", {
    message: `Council did not settle within ${AUTHORIZATION_TIMEOUT_MS}ms`
  })), AUTHORIZATION_TIMEOUT_MS);
  cleanupTerminalWatch = cleanup;
});

function closeChildExpectedly() {
  if (expectedChildClose) return;
  expectedChildClose = true;
  cleanupTerminalWatch();
  const ignoreExpectedError = () => {};
  const clearExpectedErrorHandler = () => child.off("error", ignoreExpectedError);
  child.once("error", ignoreExpectedError);
  child.once("close", clearExpectedErrorHandler);
  try { close(); } catch (error) {
    child.off("error", ignoreExpectedError);
    child.off("close", clearExpectedErrorHandler);
    console.error(`AUTHZ_CLOSE_ERROR: ${boundedText(error?.message || error)}`);
  }
}

let exitCode = 1;
try {
  const callSeat = (seatArg) =>
    liveSeatCaller({ client, promptFor, parsePacket: (text) => parsePacket(text, seatArg.model, seatArg.role) })(seatArg);
  const results = await Promise.race([
    runCouncil({ seats, callSeat, dossier, maxConcurrency: TRANSPORT_POLICY.council_max_concurrency }),
    terminalFailurePromise
  ]);
  const summary = finalizeSummary({ results });
  printSummary(summary);
  exitCode = summary.authorized ? 0 : 3;
} catch (error) {
  if (error?.terminal_failure) {
    closeChildExpectedly();
    try {
      const summary = finalizeSummary({ terminalFailure: error.terminal_failure });
      printSummary(summary);
      exitCode = 3;
    } catch (summaryError) {
      console.error(`AUTHZ_ERROR: ${summaryError?.message || String(summaryError)}`);
      exitCode = 1;
    }
  } else {
    console.error(`AUTHZ_ERROR: ${error?.message || String(error)}`);
    exitCode = 1;
  }
} finally {
  closeChildExpectedly();
}

process.exitCode = exitCode;
