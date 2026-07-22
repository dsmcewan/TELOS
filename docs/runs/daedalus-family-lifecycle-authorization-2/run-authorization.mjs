#!/usr/bin/env node
// TELOS signed authorization council for the Daedalus-family multi-model-seat
// lifecycle implementation plan. Required approvers remain claude/agy/codex;
// grok/gemini remain advisory at the TELOS authorization boundary.

import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (relative) => import(pathToFileURL(path.join(ROOT, relative)).href);

const AUTHORIZATION_ID = "authz-010";
const BUILD_ID = "daedalus-family-lifecycle-authz-010";
const USE_CASE = "multi-model-seats-daedalus-family-lifecycle";
const PLAN_PATH = "docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md";
const SPEC_PATH = "docs/superpowers/specs/2026-07-21-daedalus-family-multi-model-seat-lifecycle-design.md";
const EXPECTED_PLAN_REF = "sha256:88e15cc7b72f19c64c6131fb5bf805f3368723139d0a514232e406b3a056de8b";
const REVIEWED_HEAD = "c3fd3afe22fc7c284ce29c10c5885610686f7d69";
const EXTENDS = "authz-008";
const EXPECTED_DESIGN_SHA256 = "5c972b176df402d22a65273520d2342541cd213717e80c8460577a7ad6c920c9";
const AUTHORITY_CRITICAL_FILES = [
  PLAN_PATH,
  SPEC_PATH,
  "CURRENT-AUTHORITY.json",
  "build-gate/council.mjs",
  "build-gate/gate.mjs",
  "build-gate/sign.mjs",
  "breakout/mcp_client.mjs",
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

  for (const file of AUTHORITY_CRITICAL_FILES) {
    runGit(["ls-files", "--error-unmatch", "--", file]);
    if (runGit(["diff", "--quiet", "--", file], [0, 1]).status === 1) {
      throw new Error(`AUTHORIZATION PREFLIGHT FAILED: working-tree drift in authority-critical file ${file}.`);
    }
    if (runGit(["diff", "--cached", "--quiet", "--", file], [0, 1]).status === 1) {
      throw new Error(`AUTHORIZATION PREFLIGHT FAILED: index drift in authority-critical file ${file}.`);
    }
  }
}

// This must complete before importing any MCP-facing code or constructing a client.
assertAuthorizationPreflight();

await imp("connectors/ai-peer-mcp/server.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } = await imp("build-gate/council.mjs");
const { validateRecords } = await imp("build-gate/gate.mjs");
const { spawnMcpClient } = await imp("breakout/mcp_client.mjs");

const planText = readFileSync(path.join(ROOT, PLAN_PATH), "utf8");
const planFileSha256 = `sha256:${createHash("sha256").update(planText, "utf8").digest("hex")}`;
const planRef = `sha256:${sha256hex(canonicalize({ kind: "candidate", plan: planText }))}`;
if (planRef !== EXPECTED_PLAN_REF) {
  console.error(`PLAN DRIFT: ${PLAN_PATH} recomputes to ${planRef}, expected ${EXPECTED_PLAN_REF}. Refusing to authorize.`);
  process.exit(1);
}

const outputFiles = ["authorization-summary.json", "claude.json", "agy.json", "codex.json", "grok.json", "gemini.json"];
const existingOutput = outputFiles.find((file) => existsSync(path.join(HERE, file)));
if (existingOutput) {
  console.error(`IMMUTABLE RUN: ${existingOutput} already exists; create a new authorization attempt directory.`);
  process.exit(1);
}

const EPHEMERAL_SIGNERS = [];
for (const seat of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${seat}`]) {
    process.env[`TELOS_SECRET_${seat}`] = randomBytes(24).toString("hex");
    EPHEMERAL_SIGNERS.push(seat.toLowerCase());
  }
}

const TIMESTAMP = new Date().toISOString();
const OBJECTIVE = [
  `Certify and submit the exact Daedalus-family multi-model-seat lifecycle plan at canonical candidate ref ${planRef} to The Eye. Council approval remains authorization only: it certifies and submits this exact plan to The Eye, grants no implementation authority, and cannot start Task 1.`,
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
  required_docs: [PLAN_PATH, SPEC_PATH],
  write_targets: WRITE_TARGETS,
  protected_paths: [],
  trust_mode: "signed"
};

const meta = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  proposal_ref: planRef,
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
  if (parsed && parsed.phase_gate_status) return { ...agyApprovalPacket(parsed, meta), role };
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};
  return {
    build_id: BUILD_ID,
    use_case: USE_CASE,
    model,
    role,
    docs_reviewed: meta.docs_reviewed,
    proposal_ref: planRef,
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

const serverPath = path.join(ROOT, "connectors/ai-peer-mcp/server.mjs");
const { client, close } = spawnMcpClient({ command: process.execPath, serverPath });
const killer = setTimeout(() => {
  console.error("AUTHZ_TIMEOUT");
  process.exit(2);
}, 1_800_000);

let exitCode = 1;
try {
  const callSeat = (seatArg) =>
    liveSeatCaller({ client, promptFor, parsePacket: (text) => parsePacket(text, seatArg.model, seatArg.role) })(seatArg);
  const results = await runCouncil({ seats, callSeat, dossier });

  mkdirSync(HERE, { recursive: true });
  const summary = {
    authorization_id: AUTHORIZATION_ID,
    build_id: BUILD_ID,
    use_case: USE_CASE,
    objective: OBJECTIVE,
    plan_ref: planRef,
    plan_file_sha256: planFileSha256,
    reviewed_head: REVIEWED_HEAD,
    extends: EXTENDS,
    timestamp: TIMESTAMP,
    trust_mode: "signed",
    ephemeral_signers: EPHEMERAL_SIGNERS,
    seats: []
  };
  const packetsForGate = [];

  for (const result of results) {
    if (result.ok) {
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
      summary.seats.push({ model: result.model, role: result.role, ok: false, reason: result.reason });
    }
  }

  const gate = validateRecords(dossier, packetsForGate);
  summary.gate = {
    gate_status: gate.gate_status,
    signing_enforced: gate.headline_checks?.signing_enforced,
    provenance_enforced: gate.headline_checks?.provenance_enforced,
    blockers: gate.blockers,
    warnings: gate.warnings,
    provenance: gate.provenance
  };

  const requiredSeats = seats.filter((seat) => seat.role === "approver").map((seat) => seat.model);
  const approvals = summary.seats.filter((seat) => requiredSeats.includes(seat.model) && seat.ok && seat.decision === "approve");
  summary.authorized = gate.gate_status === "pass" && approvals.length === requiredSeats.length;
  summary.authorization = summary.authorized
    ? {
        status: "AUTHORIZED",
        plan_ref: planRef,
        note: `${AUTHORIZATION_ID} signed council and TELOS gate certify and submit the exact Daedalus-family lifecycle plan to The Eye; this does not grant implementation authority or start Task 1; extends ${EXTENDS}.`
      }
    : { status: "NOT_AUTHORIZED", plan_ref: planRef, note: "Fail-closed: see gate blockers and seat decisions." };

  writeFileSync(path.join(HERE, "authorization-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({
    authorization_id: AUTHORIZATION_ID,
    plan_ref: planRef,
    authorized: summary.authorized,
    gate_status: gate.gate_status,
    blockers: gate.blockers.length,
    seats: summary.seats.map((seat) => ({ model: seat.model, role: seat.role, ok: seat.ok, decision: seat.decision ?? null }))
  }, null, 2));
  exitCode = summary.authorized ? 0 : 3;
} catch (error) {
  console.error(`AUTHZ_ERROR: ${error?.message || String(error)}`);
  exitCode = 1;
} finally {
  clearTimeout(killer);
  close();
}

process.exitCode = exitCode;
