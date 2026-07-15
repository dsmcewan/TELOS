// proposal-ledger.mjs — the signed, hash-chained proposal lifecycle ledger (.telos/proposal.jsonl)
// plus the shared lifecycle primitives (provider-scoped lineage keys, content-addressed artifact
// store, review-input manifests, and the closed POLICY_CONTRACT_V1 authorization certificate).
//
// Separate from the task-settlement ledger because proposal events have a different signed schema.
// Reuses the substrate's canonicalization + Ed25519 discipline; the chain is a SINGLE canonical
// line (fork = terminal for automation). All appends are atomic under one lock (no cached head).
import { sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";
import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { canonicalize, sha256hex } from "./vendor.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));

export const PROPOSAL_KEY_ID = "proposal-controller";
export const PROPOSAL_CONTRACT_VERSION = "proposal-lifecycle/1";
export const PROPOSAL_STAGES = new Set(["draft", "negotiation", "candidate", "review", "hold", "disposition", "decision"]);
const PLACEHOLDER_RE = /^$|_self$|^self$|placeholder/i;

// ---------------------------------------------------------------------------
// Event signing — the signed bytes are the canonical form of the WHOLE event minus `sig`,
// so every field (review_input_hash, policy_result_ref, revision_brief_ref, …) is tamper-evident.
// ---------------------------------------------------------------------------
function eventPayload(event) {
  const { sig, ...rest } = event;
  return Buffer.from(canonicalize(rest));
}

export function makeProposalEvent(fields, privatePem) {
  if (!PROPOSAL_STAGES.has(fields.stage)) throw new Error(`makeProposalEvent: invalid stage '${fields.stage}'`);
  if (!Number.isInteger(fields.sequence) || fields.sequence < 1) throw new Error(`makeProposalEvent: sequence must be a positive integer`);
  const record = { record_type: "proposal-event", ...fields, key_id: PROPOSAL_KEY_ID };
  const value = edSign(null, eventPayload(record), createPrivateKey(privatePem)).toString("base64");
  return { ...record, sig: { alg: "Ed25519", value, signed_fields: "canonical-minus-sig" } };
}

export function verifyProposalEvent(event, publicJwk) {
  try {
    if (!event || event.record_type !== "proposal-event" || !event.sig) return false;
    return edVerify(null, eventPayload(event), createPublicKey({ key: publicJwk, format: "jwk" }), Buffer.from(event.sig.value, "base64"));
  } catch { return false; }
}

// Hash of the FULL signed record (what parent_event_hash references).
export function proposalEventHash(event) { return H(event); }

// ---------------------------------------------------------------------------
// STRICT reader — unlike the tolerant settlement reader, a torn/unparseable interior line is an
// ERROR (a truncated proposal ledger must break verification, never be silently skipped).
// ---------------------------------------------------------------------------
export function readProposalEvents(telosDir) {
  const p = path.join(telosDir, "proposal.jsonl");
  if (!existsSync(p)) return { events: [], errors: [] };
  const events = [];
  const errors = [];
  const lines = readFileSync(p, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (t.trim() === "") { if (i !== lines.length - 1) errors.push(`blank line at ${i}`); continue; }
    try { events.push(JSON.parse(t)); } catch { errors.push(`unparseable line at ${i}`); }
  }
  return { events, errors };
}

// ---------------------------------------------------------------------------
// Chain verification — enforces the single canonical chain from disk (contract §Chain linearity).
// ---------------------------------------------------------------------------
export function verifyProposalChain(events, publicJwk, { proposalId } = {}) {
  const errors = [];
  const byStage = new Map();
  if (!Array.isArray(events) || events.length === 0) return { ok: false, headHash: null, head: null, errors: ["empty chain"], byStage };

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e || e.record_type !== "proposal-event") errors.push(`event ${i}: bad record_type`);
    else if (!verifyProposalEvent(e, publicJwk)) errors.push(`event ${i}: bad signature`);
    if (proposalId != null && e && e.proposal_id !== proposalId) errors.push(`event ${i}: proposal_id mismatch`);
  }
  const pid = events[0].proposal_id;
  for (const e of events) if (e && e.proposal_id !== pid) { errors.push("non-uniform proposal_id"); break; }

  const seqs = events.map((e) => e && e.sequence);
  if (new Set(seqs).size !== seqs.length) errors.push("duplicate sequence");
  const seqSet = new Set(seqs);
  for (let s = 1; s <= events.length; s++) if (!seqSet.has(s)) errors.push(`missing sequence ${s}`);

  const hashAt = events.map((e) => proposalEventHash(e));
  const hashToIndex = new Map();
  for (let i = 0; i < events.length; i++) {
    if (hashToIndex.has(hashAt[i])) errors.push(`duplicate event hash at ${i}`);
    else hashToIndex.set(hashAt[i], i);
  }
  const roots = [];
  const childrenByParent = new Map();
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.parent_event_hash == null) { roots.push(i); continue; }
    const pIdx = hashToIndex.get(e.parent_event_hash);
    if (pIdx === undefined) { errors.push(`event ${i}: parent not found`); continue; }
    if (pIdx >= i) errors.push(`event ${i}: parent not at an earlier file position (self/descendant/reorder)`);
    const arr = childrenByParent.get(e.parent_event_hash) || [];
    arr.push(i); childrenByParent.set(e.parent_event_hash, arr);
  }
  if (roots.length !== 1) errors.push(`expected exactly one root, found ${roots.length}`);
  else {
    if (events[roots[0]].sequence !== 1) errors.push("root sequence != 1");
    if (events[roots[0]].parent_event_hash !== null && events[roots[0]].parent_event_hash !== undefined) errors.push("root parent_event_hash != null");
  }
  for (const [ph, kids] of childrenByParent) if (kids.length > 1) errors.push(`fork: parent ${ph} has ${kids.length} children`);

  const isParent = new Set(events.map((e) => e.parent_event_hash).filter((x) => x != null));
  const heads = [];
  for (let i = 0; i < events.length; i++) if (!isParent.has(hashAt[i])) heads.push(i);
  if (heads.length !== 1) errors.push(`expected exactly one head, found ${heads.length}`);

  for (const e of events) { if (!byStage.has(e.stage)) byStage.set(e.stage, []); byStage.get(e.stage).push(e); }
  const ok = errors.length === 0;
  const headIdx = ok ? heads[0] : -1;
  return { ok, headHash: ok ? hashAt[headIdx] : null, head: ok ? events[headIdx] : null, errors, byStage };
}

// ---------------------------------------------------------------------------
// Atomic append — the ONLY write path. Rereads + verifies + derives head under one lock so two
// processes can never both extend the same head (a validly-signed fork). No head is cached.
//   buildEvent(parentHash, sequence) -> signed proposal event
// ---------------------------------------------------------------------------
export function atomicAppendProposalEvent(telosDir, buildEvent, { publicJwk }) {
  mkdirSync(telosDir, { recursive: true });
  const p = path.join(telosDir, "proposal.jsonl");
  const lock = p + ".lock";
  let acquired = false;
  for (let i = 0; i < 200 && !acquired; i++) {
    try { closeSync(openSync(lock, "wx")); acquired = true; } catch { /* held */ }
  }
  if (!acquired) throw new Error("proposal-ledger lock held — concurrent writer? (single-writer invariant)");
  try {
    const { events, errors } = readProposalEvents(telosDir);
    if (errors.length) throw new Error(`proposal ledger unreadable: ${errors.join("; ")}`);
    let parentHash = null;
    let sequence = 1;
    if (events.length) {
      const chain = verifyProposalChain(events, publicJwk);
      if (!chain.ok) throw new Error(`proposal chain invalid, refusing to append: ${chain.errors.join("; ")}`);
      parentHash = chain.headHash;
      sequence = events.length + 1;
    }
    const event = buildEvent(parentHash, sequence);
    const fd = openSync(p, "a");
    try { writeFileSync(fd, JSON.stringify(event) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
    return event;
  } finally { try { unlinkSync(lock); } catch {} }
}

// Newest decision-stage event bound to an EXACT plan hash (the runBuild enforcement lookup).
export function latestDecisionForPlan(events, planHash) {
  let found = null;
  for (const e of events) if (e.stage === "decision" && e.plan_hash === planHash) found = e;
  return found;
}

// Controller-derived proposal identity — a content address of the draft inputs (decision 11).
export function deriveProposalId(draftArtifactRefs) {
  const artifact_refs = [...new Set(draftArtifactRefs || [])].sort();
  return "proposal-" + sha256hex(canonicalize({ contract_version: PROPOSAL_CONTRACT_VERSION, artifact_refs }));
}

// ---------------------------------------------------------------------------
// Provider-scoped lineage.
// ---------------------------------------------------------------------------
export function normalizeProvenance(prov) {
  if (!prov || typeof prov !== "object") return null;
  return {
    provider: typeof prov.provider === "string" ? prov.provider : null,
    response_model: prov.response_model ?? prov.model ?? null,
    response_id: prov.response_id ?? null,
    answered_at: prov.answered_at ?? null
  };
}

export function lineageKey(provider, responseId) {
  if (typeof responseId !== "string" || PLACEHOLDER_RE.test(responseId)) return null;
  if (typeof provider !== "string" || provider === "") return null;
  return provider.toLowerCase() + ":" + responseId;
}

// ---------------------------------------------------------------------------
// Content-addressed artifact store — .telos/artifacts/sha256_<hex>.json ; bytes = canonicalize(value).
// ---------------------------------------------------------------------------
export function artifactRef(value) { return H(value); }

export function writeProposalArtifact(telosDir, value) {
  const dir = path.join(telosDir, "artifacts");
  mkdirSync(dir, { recursive: true });
  const bytes = canonicalize(value);
  const hex = sha256hex(bytes);
  const ref = "sha256:" + hex;
  const rel = path.join("artifacts", "sha256_" + hex + ".json");
  const abs = path.join(telosDir, rel);
  if (existsSync(abs)) {
    if (sha256hex(readFileSync(abs)) !== hex) throw new Error(`artifact collision at ${rel}`);
  } else {
    writeFileSync(abs, bytes);
  }
  return { ref, relPath: rel };
}

export function readProposalArtifact(telosDir, ref) {
  if (typeof ref !== "string" || !ref.startsWith("sha256:")) return null;
  const hex = ref.slice("sha256:".length);
  const abs = path.join(telosDir, "artifacts", "sha256_" + hex + ".json");
  if (!existsSync(abs)) return null;
  const bytes = readFileSync(abs);
  if (sha256hex(bytes) !== hex) return null;         // tamper — fail closed
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}

// Frozen review-input preimage (decision 13): binds the candidate plan, review contract, and the
// supplied evidence manifest. Excludes review_input_hash itself and the manifest's own hash.
export function computeReviewInputHash(manifest) {
  const evidence = [...(manifest.evidence || [])]
    .map((e) => ({ path: e.path, sha256: e.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return H({ plan_hash: manifest.plan_hash, review_contract_ref: manifest.review_contract_ref, evidence });
}

// ---------------------------------------------------------------------------
// POLICY_CONTRACT_V1 — the closed authorization-check registry + finding registry (decision 18).
// ---------------------------------------------------------------------------
export const POLICY_CHECK_KEYS = [
  "written_plan", "proposal_ref_binding", "required_packets", "packet_signatures",
  "provider_lineage", "cold_review_inputs", "required_approvals", "required_edits",
  "concerns", "risk_policy", "obligation_anchors", "protected_paths", "proposal_chain"
];
export const FINDING_CLASSES = ["protocol", "unrecoverable", "verified", "edit", "verification", "hold"];
const CHECK_STATUSES = new Set(["pass", "fail", "n/a"]);
// The ONLY checks whose "n/a" satisfies authorization: packet_signatures is verified in
// validateRecords' required-model HMAC loop, so validateProposalLifecycle legitimately marks
// it "n/a". Every OTHER key must be exactly "pass" — relaxing "n/a" globally would let a
// cert marking cold_review_inputs / concerns / obligation_anchors "n/a" authorize (a mutable
// status keying the decision). A check is SATISFIED iff pass, or n/a on an allowlisted key.
export const NA_ALLOWED = new Set(["packet_signatures"]);
export function checkSatisfied(checks, k) {
  return checks[k] === "pass" || (NA_ALLOWED.has(k) && checks[k] === "n/a");
}
export const POLICY_CONTRACT_V1 = H({ version: 1, checks: [...POLICY_CHECK_KEYS].sort(), finding_classes: [...FINDING_CLASSES].sort() });

// The frozen routing table. Fields come from deterministic policy + verified records, never model text.
export function deriveOutcome(checks, blockers = [], findings = [], revision = { index: 1, maximum: 1 }) {
  const f = findings || [];
  if (f.some((x) => x.class === "protocol" || x.class === "unrecoverable")) return "blocked";
  if (f.some((x) => x.requires_human)) return "human-review-required";
  const reparableWork = f.some((x) => x.reparable || x.class === "edit" || x.class === "verification");
  if (reparableWork) return (revision.index < revision.maximum) ? "revise" : "human-review-required";
  const allSatisfied = POLICY_CHECK_KEYS.every((k) => checkSatisfied(checks, k));
  if (f.length === 0 && allSatisfied && (blockers || []).length === 0) return "authorized";
  return "blocked"; // fail closed: blockers/failed checks without a typed finding
}

// verifyPolicyResult — validates a certificate for ANY of the four outcomes.
export function verifyPolicyResult(artifact, { planHash } = {}) {
  const errors = [];
  if (!artifact || typeof artifact !== "object") return { ok: false, errors: ["no artifact"] };
  if (artifact.policy_contract_ref !== POLICY_CONTRACT_V1) errors.push("policy_contract_ref mismatch");
  const checks = artifact.checks || {};
  const keys = Object.keys(checks);
  const required = new Set(POLICY_CHECK_KEYS);
  for (const k of keys) if (!required.has(k)) errors.push(`unknown check '${k}'`);
  for (const k of POLICY_CHECK_KEYS) {
    if (!(k in checks)) errors.push(`missing check '${k}'`);
    else if (!CHECK_STATUSES.has(checks[k])) errors.push(`bad status for '${k}'`);
  }
  const findings = artifact.findings || [];
  if (!Array.isArray(findings)) errors.push("findings must be an array");
  else for (const fd of findings) {
    if (!FINDING_CLASSES.includes(fd.class)) errors.push(`bad finding class '${fd.class}'`);
    if (typeof fd.reparable !== "boolean" || typeof fd.requires_human !== "boolean") errors.push("finding missing reparable/requires_human");
  }
  const revision = artifact.revision || { index: 1, maximum: 1 };
  if (!Number.isInteger(revision.index) || !Number.isInteger(revision.maximum)) errors.push("bad revision {index,maximum}");
  if (planHash != null && artifact.plan_hash !== planHash) errors.push("plan_hash mismatch");
  if (errors.length === 0) {
    const derived = deriveOutcome(checks, artifact.blockers || [], findings, revision);
    if (artifact.outcome !== derived) errors.push(`outcome '${artifact.outcome}' != derived '${derived}'`);
  }
  return { ok: errors.length === 0, errors };
}

// verifyAuthorizationResult — the stricter gate used by the executor + previously-authorized path.
export function verifyAuthorizationResult(artifact, { planHash } = {}) {
  const base = verifyPolicyResult(artifact, { planHash });
  const errors = [...base.errors];
  if (base.ok) {
    if (artifact.outcome !== "authorized") errors.push(`outcome '${artifact.outcome}' != authorized`);
    if ((artifact.findings || []).length !== 0) errors.push("authorized certificate has findings");
    if ((artifact.blockers || []).length !== 0) errors.push("authorized certificate has blockers");
    for (const k of POLICY_CHECK_KEYS) if (!checkSatisfied(artifact.checks, k)) errors.push(`check '${k}' not satisfied (must be "pass", or "n/a" only for ${[...NA_ALLOWED].join(",")})`);
  }
  return { ok: errors.length === 0, errors };
}
