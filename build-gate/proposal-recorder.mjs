// proposal-recorder.mjs — the sole-writer controller for .telos/proposal.jsonl. Every write goes
// through atomicAppendProposalEvent (reread + verify + derive head under one lock; no cached head),
// so holds/expirations/adjudications/evidence can safely span processes. recordDecision writes the
// closed POLICY_CONTRACT_V1 certificate itself; a bare "authorized" is not constructible.
import { createPublicKey, createPrivateKey } from "node:crypto";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { canonicalize, sha256hex, resolveUnder } from "../merkle-dag/vendor.mjs";
import {
  PROPOSAL_KEY_ID, POLICY_CONTRACT_V1, POLICY_CHECK_KEYS,
  makeProposalEvent, atomicAppendProposalEvent, writeProposalArtifact,
  computeReviewInputHash, deriveProposalId, readProposalEvents, verifyProposalChain, deriveOutcome
} from "../merkle-dag/proposal-ledger.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));

/**
 * @param telosDir   the .telos directory
 * @param signerFor  (keyId) -> pkcs8 PEM ; must resolve PROPOSAL_KEY_ID (durable controller key)
 * @param proposalId optional; if omitted, derived from draftArtifactRefs at recordDraft time
 * @returns recorder | null   (null when the controller key is unavailable)
 */
export function makeProposalRecorder({ telosDir, signerFor, proposalId = null } = {}) {
  const privatePem = signerFor && signerFor(PROPOSAL_KEY_ID);
  if (!privatePem) return null;
  const publicJwk = createPublicKey(createPrivateKey(privatePem)).export({ format: "jwk" });
  let pid = proposalId;

  // On creation, refuse to resume a corrupt/forked chain (fail closed).
  const existing = readProposalEvents(telosDir);
  if (existing.errors.length) throw new Error(`proposal ledger unreadable: ${existing.errors.join("; ")}`);
  if (existing.events.length) {
    const chain = verifyProposalChain(existing.events, publicJwk);
    if (!chain.ok) throw new Error(`proposal chain invalid, refusing to resume: ${chain.errors.join("; ")}`);
    if (!pid) pid = existing.events[0].proposal_id;
  }

  const writeArtifact = (value) => writeProposalArtifact(telosDir, value);

  function record(fields) {
    if (!pid) throw new Error("recorder has no proposal_id (call recordDraft first)");
    return atomicAppendProposalEvent(telosDir, (parentHash, sequence) =>
      makeProposalEvent({
        proposal_id: pid, sequence, stage: fields.stage, plan_hash: fields.plan_hash ?? null,
        parent_event_hash: parentHash, artifact_refs: fields.artifact_refs ?? [],
        actor: fields.actor ?? { seat: "controller", role: "controller" },
        provenance: fields.provenance ?? null, policy_result: fields.policy_result ?? null,
        recorded_at: fields.recorded_at ?? null, ...fields.extra
      }, privatePem), { publicJwk });
  }

  return {
    get proposalId() { return pid; },
    writeArtifact,
    record,

    recordDraft({ inputRefs = [], recordedAt = null } = {}) {
      if (!pid) pid = deriveProposalId(inputRefs);
      return record({ stage: "draft", artifact_refs: inputRefs, recorded_at: recordedAt });
    },
    recordCreationCall({ seat, role = "planning", provenance, recordedAt = null }) {
      return record({ stage: "negotiation", actor: { seat, role }, provenance, recorded_at: recordedAt });
    },
    recordCandidate({ planHash, artifactRefs = [], recordedAt = null }) {
      return record({ stage: "candidate", plan_hash: planHash, artifact_refs: artifactRefs, recorded_at: recordedAt });
    },
    recordReview({ seat, provenance, reviewInputHash, artifactRefs = [], recordedAt = null, concerns = null }) {
      const extra = {};
      if (reviewInputHash) extra.review_input_hash = reviewInputHash;
      if (concerns) extra.concerns = concerns;
      return record({ stage: "review", actor: { seat, role: "approver" }, provenance, artifact_refs: artifactRefs, recorded_at: recordedAt, extra });
    },
    recordHold({ hold, recordedAt = null }) {
      return record({ stage: "hold", plan_hash: hold.plan_hash, recorded_at: recordedAt, extra: { hold } });
    },
    recordDisposition({ disposition, recordedAt = null }) {
      return record({ stage: "disposition", plan_hash: disposition.plan_hash, recorded_at: recordedAt, extra: { disposition } });
    },
    /**
     * Write the POLICY_CONTRACT_V1 certificate FIRST, then the signed decision carrying its ref
     * (and revision_brief_ref for a revise). `decision` must equal deriveOutcome(...) or we throw.
     */
    recordDecision({ planHash, checks, blockers = [], findings = [], revision = { index: 1, maximum: 3 }, revisionBriefRef = null, recordedAt = null }) {
      const outcome = deriveOutcome(checks, blockers, findings, revision);
      const artifact = { policy_contract_ref: POLICY_CONTRACT_V1, plan_hash: planHash, outcome, checks, blockers, findings, revision };
      const { ref: policyRef } = writeArtifact(artifact);
      const extra = { decision: outcome, policy_result_ref: policyRef };
      if (outcome === "revise" && revisionBriefRef) extra.revision_brief_ref = revisionBriefRef;
      return { decision: outcome, event: record({ stage: "decision", plan_hash: planHash, artifact_refs: revisionBriefRef ? [policyRef, revisionBriefRef] : [policyRef], recorded_at: recordedAt, extra }) };
    }
  };
}

// buildReviewManifest — two-step invocation identity (decision 15) to avoid a dependency cycle:
// build manifest -> obtain review_manifest_ref -> derive review_call_ref -> invocation context.
export function buildReviewManifest({ telosDir, planHash, seat, role, workstream = null, reviewContract, evidenceFiles = [], baseDir, materialized = {} }) {
  if (evidenceFiles.length > 0 && !baseDir) {
    throw new Error("review evidence requires a baseDir so its bytes can be verified");
  }
  const evidence = evidenceFiles.map((ef) => {
    const abs = resolveUnder(baseDir, ef.path);
    if (abs === null) throw new Error(`review evidence '${ef.path}' escapes baseDir`);
    let bytes;
    try {
      if (!statSync(abs).isFile()) {
        throw new Error("not a regular file");
      }
      bytes = readFileSync(abs);
    } catch {
      throw new Error(`review evidence '${ef.path}' is missing or not a regular file`);
    }
    return {
      path: ef.path, kind: ef.kind || "source-doc",
      sha256: "sha256:" + createHash("sha256").update(bytes).digest("hex")
    };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const contractRef = writeProposalArtifact(telosDir, { kind: "review-contract", ...reviewContract }).ref;
  const manifest = { plan_hash: planHash, review_contract_ref: contractRef, evidence };
  const review_input_hash = computeReviewInputHash(manifest);
  const { ref: manifestRef } = writeProposalArtifact(telosDir, { kind: "review-manifest", ...manifest });
  const review_call_ref = H({ plan_hash: planHash, seat, role, workstream, review_manifest_ref: manifestRef });
  return {
    manifest, review_input_hash, manifest_ref: manifestRef, contract_ref: contractRef,
    invocation: { seat, role, workstream, review_call_ref, proposal_ref: planHash, review_input_hash, review_manifest_ref: manifestRef, materialized }
  };
}

// buildRevisionBrief — content-addressed so cumulative lineage derives from signed refs, not memory.
export function buildRevisionBrief({ telosDir, sourceReviewEventRefs = [], sourceConcernRefs = [], requiredEditRefs = [], requiredVerificationRefs = [], prose = "" }) {
  const brief = { record_type: "revision-brief", source_review_event_refs: [...sourceReviewEventRefs].sort(), source_concern_refs: [...sourceConcernRefs].sort(), required_edit_refs: [...requiredEditRefs].sort(), required_verification_refs: [...requiredVerificationRefs].sort(), prose };
  const { ref } = writeProposalArtifact(telosDir, brief);
  return { brief, ref };
}
