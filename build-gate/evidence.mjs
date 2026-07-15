// evidence.mjs — the closed-whitelist, sandboxed evidence verifier (Required Point 10).
// A model may PROPOSE a concern + evidence; it can never decide its own evidence is valid.
// Dispatch is closed three ways: (1) EVIDENCE_KINDS is frozen; (2) each kind has a strict param
// whitelist (cmd/script/code/command keys are rejected BEFORE any filesystem/process activity);
// (3) the only spawning kind runs a test read from the PLAN on disk, never from the claim.
import { readFileSync, existsSync, cpSync, rmSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { canonicalize, sha256hex, resolveUnder, spawnCommand } from "../merkle-dag/vendor.mjs";
import { computeDiskTreeHash, hasEscape } from "../merkle-dag/artifact.mjs";
import { readLedger, verifyTransaction } from "../merkle-dag/crypto.mjs";
import { readPlan, recompute } from "../merkle-dag/merkle.mjs";
import { verifyPacket, secretFor } from "./sign.mjs";
import { SCHEMAS, validateAgainstSchema } from "./schemas.mjs";
import { loadRiskPolicy, classifyPath, normalizeRelPath } from "./risk-policy.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));
const PLACEHOLDER_RE = /^$|_self$|^self$|placeholder/i;
// Params that would smuggle model-authored execution — rejected for EVERY kind, pre-FS.
const FORBIDDEN_PARAM_KEYS = new Set(["cmd", "command", "script", "code", "args", "shell", "exec", "run"]);

export function deriveClaimId(claim) {
  return H({ kind: claim.kind, params: claim.params || {}, concern_ref: claim.concern_ref, plan_hash: claim.plan_hash });
}

// Whitelist child env: only the minimum to run node. Strips API keys, TELOS_SECRET_*/TELOS_ED25519_*,
// NODE_OPTIONS (a --require injection vector), and everything else.
export function scrubbedEnv(base = process.env) {
  const allow = ["PATH", "TMPDIR", "TEMP", "TMP"];
  if (process.platform === "win32") allow.push("SystemRoot", "ComSpec", "PATHEXT", "WINDIR");
  const out = {};
  for (const k of allow) if (base[k] != null) out[k] = base[k];
  return out;
}

// Default isolation runner: preventive filesystem + network namespace via bwrap/unshare. Copies the
// candidate tree to a scratch workspace with .telos ABSENT, mounts host read-only-or-unreachable,
// and denies network. Returns { available:false } when no namespace tool is usable (fail closed).
export function defaultIsolationRunner({ baseDir, cmd, args, timeoutMs }) {
  const bwrap = probe("bwrap", ["--version"]);
  const unshare = !bwrap && probe("unshare", ["--version"]);
  if (!bwrap && !unshare) return { available: false, reason: "no filesystem/network namespace tool (bwrap/unshare)" };

  let scratch;
  try {
    scratch = mkdtempSync(path.join(os.tmpdir(), "telos-evi-ws-"));
    cpSync(baseDir, scratch, { recursive: true, dereference: false, filter: (src) => path.basename(src) !== ".telos" });
  } catch (e) {
    if (scratch) try { rmSync(scratch, { recursive: true, force: true }); } catch {}
    return { available: false, reason: `workspace copy failed: ${e.message}` };
  }
  try {
    const env = scrubbedEnv();
    const spec = spawnCommand(cmd, args);
    let full;
    if (bwrap) {
      full = { command: "bwrap", args: ["--unshare-all", "--die-with-parent", "--ro-bind", "/usr", "/usr", "--ro-bind", "/bin", "/bin", "--ro-bind", "/lib", "/lib", "--ro-bind-try", "/lib64", "/lib64", "--bind", scratch, "/workspace", "--chdir", "/workspace", "--", spec.command, ...spec.args] };
    } else {
      full = { command: "unshare", args: ["-Urmn", "--", spec.command, ...spec.args] };
    }
    const res = spawnSync(full.command, full.args, { cwd: scratch, env, encoding: "utf8", timeout: timeoutMs, killSignal: "SIGTERM" });
    return { available: true, status: res.status, timedOut: !!(res.error && /ETIMEDOUT|timed?out/i.test(res.error.message || "")), error: res.error ? res.error.message : null, outputTail: ((res.stdout || "") + (res.stderr || "")).slice(-800), network_isolation: bwrap ? "bwrap" : "netns" };
  } finally { try { rmSync(scratch, { recursive: true, force: true }); } catch {} }
}

function probe(cmd, args) {
  try { const r = spawnSync(cmd, args, { timeout: 3000 }); return !r.error && r.status === 0; } catch { return false; }
}

// Test provenance eligibility for pre-authorization execution (decision 12): a test introduced by
// the CURRENT candidate is obligation-only. Only a test present in an earlier AUTHORIZED plan or the
// repo-owned baseline may execute at the proposal gate.
export function testProvenance(node, { baselineTestRefs = new Set(), authorizedTestRefs = new Set() } = {}) {
  const ref = H(node.test);
  if (authorizedTestRefs.has(ref)) return "previously-authorized";
  if (baselineTestRefs.has(ref)) return "baseline";
  return "introduced-by-candidate";
}

// ---------------------------------------------------------------------------
// The closed evidence-kind registry. Each kind: { params:[allowed keys], spawns:bool, verify(claim, ctx) }.
// ---------------------------------------------------------------------------
export const EVIDENCE_KINDS = Object.freeze({
  "declared-test-failure": Object.freeze({ params: ["node_id"], spawns: true, verify: verifyDeclaredTestFailure }),
  "artifact-hash-mismatch": Object.freeze({ params: ["node_id", "files", "expected_tree_hash"], spawns: false, verify: verifyArtifactHashMismatch }),
  "plan-hash-mismatch": Object.freeze({ params: ["expected_plan_hash"], spawns: false, verify: verifyPlanHashMismatch }),
  "schema-violation": Object.freeze({ params: ["schema_name", "target_path"], spawns: false, verify: verifySchemaViolation }),
  "provenance-mismatch": Object.freeze({ params: ["packet_path", "seat"], spawns: false, verify: verifyProvenanceMismatch }),
  "path-policy-violation": Object.freeze({ params: ["targets", "node_id"], spawns: false, verify: verifyPathPolicyViolation }),
  "signature-failure": Object.freeze({ params: ["sig_kind", "target_path", "task_id", "seat", "key_id"], spawns: false, verify: verifySignatureFailure }),
  "declarative-file-assertion": Object.freeze({ params: ["assertion", "expected"], spawns: false, verify: verifyDeclarativeFileAssertion })
});

/**
 * Verify an evidence claim. NOTHING is executed on rejection.
 * @param claim { kind, concern_ref, plan_hash?, params, raised_by? }
 * @param ctx { baseDir, telosDir, dossier, policy?, packets?, isolationRunner?, timeoutMs?, requireNetworkIsolation?, writeProposalEvent?, baselineTestRefs?, authorizedTestRefs? }
 * @returns { accepted:true, kind, reproduced, facts, sandbox? } | { accepted:false, rejected }
 */
export async function verifyEvidence(claim, ctx = {}) {
  if (!claim || typeof claim !== "object") return { accepted: false, rejected: "no claim" };
  const kind = EVIDENCE_KINDS[claim.kind];
  if (!kind) return { accepted: false, rejected: `unregistered evidence kind '${claim.kind}'` };
  const params = claim.params || {};
  const allowed = new Set(kind.params);
  for (const k of Object.keys(params)) {
    if (FORBIDDEN_PARAM_KEYS.has(k)) return { accepted: false, rejected: `forbidden param '${k}' (no model-authored execution)` };
    if (!allowed.has(k)) return { accepted: false, rejected: `unregistered claim parameter '${k}' for kind '${claim.kind}'` };
  }
  let result;
  try { result = await kind.verify(claim, ctx); }
  catch (e) { return { accepted: false, rejected: `verifier error: ${e.message}` }; }
  if (result.rejected) return { accepted: false, rejected: result.rejected };
  const out = { accepted: true, kind: claim.kind, reproduced: !!result.reproduced, facts: result.facts || [], sandbox: result.sandbox };
  if (typeof ctx.writeProposalEvent === "function") {
    const body = { stage: "disposition", event_kind: "evidence-verification", claim_id: deriveClaimId(claim), concern_ref: claim.concern_ref, plan_hash: claim.plan_hash ?? null, evidence_kind: claim.kind, reproduced: out.reproduced, facts: out.facts, sandbox: out.sandbox || null };
    try { out.event = await ctx.writeProposalEvent(body); } catch { /* recording is best-effort; verification stands */ }
  }
  return out;
}

// --- verifiers -------------------------------------------------------------

async function verifyDeclaredTestFailure(claim, ctx) {
  const rc = recompute(readPlan(ctx.telosDir));
  if (rc.errors) return { rejected: "plan invalid" };
  const node = rc.plan.nodes.find((n) => n.id === claim.params.node_id);
  if (!node) return { rejected: `node '${claim.params.node_id}' not in plan` };
  if (!node.test || !node.test.cmd) return { rejected: "node has no test" };
  const prov = testProvenance(node, ctx);
  if (prov === "introduced-by-candidate") return { rejected: "test introduced by current candidate; obligation-only" };
  const runner = ctx.isolationRunner || defaultIsolationRunner;
  const r = runner({ baseDir: ctx.baseDir, cmd: node.test.cmd, args: node.test.args || [], timeoutMs: ctx.timeoutMs || 60000 });
  if (!r.available) return { rejected: `filesystem/network isolation unavailable → not executed (${r.reason})` };
  const reproduced = r.status !== 0;   // "reproduced" the failure = the declared test failed
  return { reproduced, facts: [{ id: node.id, ok: reproduced, detail: `exit ${r.status}${r.timedOut ? " (timeout)" : ""}` }], sandbox: { network_isolation: r.network_isolation, timed_out: !!r.timedOut } };
}

function verifyArtifactHashMismatch(claim, ctx) {
  const p = claim.params;
  let files, expected;
  if (p.node_id) {
    const rc = recompute(readPlan(ctx.telosDir));
    if (rc.errors) return { rejected: "plan invalid" };
    const node = rc.plan.nodes.find((n) => n.id === p.node_id);
    if (!node) return { rejected: `node '${p.node_id}' not in plan` };
    files = node.files;
    const ledger = readLedger(path.join(ctx.telosDir, "ledger.jsonl"));
    const entry = [...ledger].reverse().find((r) => r.task_id === p.node_id);
    if (!entry) return { rejected: "no signed ledger entry to compare against" };
    expected = entry.artifact_tree_hash;
  } else { files = p.files; expected = p.expected_tree_hash; }
  if (!Array.isArray(files) || typeof expected !== "string") return { rejected: "need node_id or (files + expected_tree_hash)" };
  const disk = computeDiskTreeHash(files, ctx.baseDir);
  if (hasEscape(disk)) return { rejected: "files escape baseDir" };
  const reproduced = disk.tree_hash !== expected;
  return { reproduced, facts: [{ id: "artifact-hash", ok: reproduced, detail: `disk ${disk.tree_hash} vs expected ${expected}` }] };
}

function verifyPlanHashMismatch(claim, ctx) {
  const stored = readPlan(ctx.telosDir);
  const rc = recompute(stored);
  if (rc.errors) return { reproduced: true, facts: [{ id: "plan", ok: true, detail: "plan does not recompute (invalid)" }] };
  const expected = claim.params.expected_plan_hash || stored.plan_hash;
  const reproduced = rc.plan.plan_hash !== expected;
  return { reproduced, facts: [{ id: "plan-hash", ok: reproduced, detail: `recomputed ${rc.plan.plan_hash} vs ${expected}` }] };
}

function verifySchemaViolation(claim, ctx) {
  const { schema_name, target_path } = claim.params;
  const reg = SCHEMAS[schema_name];
  if (!reg) return { rejected: `unknown schema '${schema_name}' (closed registry)` };
  const abs = resolveUnder(ctx.baseDir, target_path);
  if (abs === null || !existsSync(abs)) return { rejected: `target '${target_path}' missing or escapes` };
  let value; try { value = JSON.parse(readFileSync(abs, "utf8")); } catch { return { reproduced: true, facts: [{ id: "schema", ok: true, detail: "target is not valid JSON" }] }; }
  const v = validateAgainstSchema(reg.schema, value);
  return { reproduced: !v.ok, facts: [{ id: "schema", ok: !v.ok, detail: v.ok ? "valid" : JSON.stringify(v.violations.slice(0, 3)) }] };
}

function verifyProvenanceMismatch(claim, ctx) {
  const abs = resolveUnder(ctx.baseDir, claim.params.packet_path);
  if (abs === null || !existsSync(abs)) return { rejected: "packet_path missing or escapes" };
  let packet; try { packet = JSON.parse(readFileSync(abs, "utf8")); } catch { return { reproduced: true, facts: [{ id: "provenance", ok: true, detail: "packet unparseable" }] }; }
  const id = packet && packet.provenance && packet.provenance.response_id;
  const bad = typeof id !== "string" || PLACEHOLDER_RE.test(id);
  return { reproduced: bad, facts: [{ id: "provenance", ok: bad, detail: bad ? `missing/placeholder response_id` : `response_id present` }] };
}

function verifyPathPolicyViolation(claim, ctx) {
  const policy = ctx.policy || loadRiskPolicy(ctx.dossier || {});
  let targets = claim.params.targets;
  if (!targets && claim.params.node_id) {
    const rc = recompute(readPlan(ctx.telosDir));
    if (rc.errors) return { rejected: "plan invalid" };
    const node = rc.plan.nodes.find((n) => n.id === claim.params.node_id);
    if (!node) return { rejected: `node '${claim.params.node_id}' not in plan` };
    targets = node.files;
  }
  if (!Array.isArray(targets)) return { rejected: "need targets or node_id" };
  const hits = [];
  for (const t of targets) {
    const m = classifyPath(t, policy);
    if (m && (m.class === "secrets" || m.class === "governance")) hits.push({ path: normalizeRelPath(t), class: m.class });
  }
  const reproduced = hits.length > 0;
  return { reproduced, facts: [{ id: "path-policy", ok: reproduced, detail: JSON.stringify(hits) }] };
}

function verifySignatureFailure(claim, ctx) {
  const p = claim.params;
  if (p.sig_kind === "hmac") {
    const abs = resolveUnder(ctx.baseDir, p.target_path);
    if (abs === null || !existsSync(abs)) return { rejected: "target_path missing or escapes" };
    let packet; try { packet = JSON.parse(readFileSync(abs, "utf8")); } catch { return { reproduced: true, facts: [{ id: "hmac", ok: true, detail: "packet unparseable" }] }; }
    const secret = (ctx.secretFor || secretFor)(p.seat || packet.model);
    if (!secret) return { rejected: `no HMAC secret for '${p.seat || packet.model}'` };
    const valid = verifyPacket(packet, secret).ok;   // verifyPacket returns { ok, reason }
    return { reproduced: !valid, facts: [{ id: "hmac", ok: !valid, detail: valid ? "valid" : "invalid" }] };
  }
  if (p.sig_kind === "ed25519") {
    const stored = readPlan(ctx.telosDir);
    const ledger = readLedger(path.join(ctx.telosDir, "ledger.jsonl"));
    const entry = [...ledger].reverse().find((r) => r.task_id === p.task_id);
    if (!entry) return { rejected: `no ledger entry for task '${p.task_id}'` };
    const pub = (stored.authorized_signers || {})[p.key_id || entry.key_id];
    if (!pub) return { rejected: `key_id '${p.key_id || entry.key_id}' not an authorized signer` };
    const valid = verifyTransaction(entry, pub);
    return { reproduced: !valid, facts: [{ id: "ed25519", ok: !valid, detail: valid ? "valid" : "invalid" }] };
  }
  return { rejected: `unknown sig_kind '${p.sig_kind}'` };
}

function verifyDeclarativeFileAssertion(claim, ctx) {
  // Import lazily to keep the cross-package edge explicit and avoid load-time coupling.
  const a = claim.params.assertion;
  if (!a || (a.type !== "file_exists" && a.type !== "file_contains")) return { rejected: "assertion must be file_exists|file_contains (command specs are structurally impossible)" };
  const abs = resolveUnder(ctx.baseDir, a.path);
  if (abs === null) return { reproduced: claim.params.expected === false, facts: [{ id: "assert", ok: claim.params.expected === false, detail: "path escapes" }] };
  let result;
  if (a.type === "file_exists") result = existsSync(abs);
  else {
    if (typeof a.needle !== "string" || a.needle.trim() === "") return { rejected: "empty needle can never satisfy" };
    result = existsSync(abs) && readFileSync(abs, "utf8").includes(a.needle);
  }
  const reproduced = result === claim.params.expected;
  return { reproduced, facts: [{ id: "assert", ok: reproduced, detail: `result=${result} expected=${claim.params.expected}` }] };
}
