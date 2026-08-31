#!/usr/bin/env node
// branch-publisher.mjs — E1: the deterministic branch publisher.
//
// THE SOLE HOLDER OF THE WRITE CREDENTIAL. Fix agents produce VALIDATED PATCH/COMMIT
// DATA (never pushes); this publisher — controller-class code inside the protected
// closure — runs in a SEPARATE JOB ON A FRESH RUNNER where no agent byte has ever
// executed, connected to the agents' job only by a SCHEMA- AND DIGEST-BOUND ARTIFACT
// HANDOFF. It schema-validates the patch dossier, re-verifies its digest, verifies a
// PUBLISHER-BOUND PRE-PUBLICATION ATTESTATION, mints its OWN branch name in a reserved
// namespace, and pushes CREATE-ONLY. Its API surface contains NO merge operation.
//
// This file exposes a PURE DECISION CORE (`evaluatePublish`) — no I/O, exhaustively
// unit-tested — plus schema/digest/attestation validators. The credential is loaded
// and the push performed only AFTER the pure core returns accept.
//
// Zero dependencies; node:crypto (Ed25519) + the caller-supplied digest fn only.

import { verify as edVerify } from "node:crypto";

export const REFUSAL = Object.freeze({
  DOSSIER_SCHEMA_INVALID: "dossier-schema-invalid",
  DOSSIER_DIGEST_MISMATCH: "dossier-digest-mismatch",
  ATTESTATION_MISSING: "publisher-attestation-missing",
  ATTESTATION_STALE: "publisher-attestation-stale",
  ATTESTATION_INVALID: "publisher-attestation-invalid",
  EXECUTION_SURFACE_REJECTED: "execution-surface-rejected",
  REF_NOT_MINTED: "ref-not-controller-minted",
  REF_PROTECTED: "ref-protected",
  REF_DEFAULT_BRANCH: "ref-default-branch",
  REF_EXISTS: "ref-exists",
});

const ok = (v) => ({ ok: true, ...v });
const no = (reason, detail) => ({ ok: false, reason, detail: detail || "" });

// Execution-trigger surfaces an agent patch may NEVER touch: any change here would
// hand agent bytes an Actions token (and reachable secrets) the moment the branch
// lands, BEFORE any controller evaluation. `.github/**` covers workflows, composite
// actions, and Actions config. CI config flows only through the human/Eye path.
const EXECUTION_SURFACE_GLOBS = [".github/**"];

function simpleGlob(glob, p) {
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") { if (glob[i + 1] === "*") { re += "[^\\0]*"; i++; if (glob[i + 1] === "/") i++; } else re += "[^/]*"; }
    else if ("\\^$.|?+()[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp(re + "$").test(p);
}

const RESERVED_NS = /^hestia\/fix-[A-Za-z0-9._-]+-\d+$/;

// Validate the patch dossier shape produced by the agents' job. Closed schema; any
// extra/missing/mistyped field fails closed.
export function validateDossierSchema(d) {
  if (!d || typeof d !== "object") return false;
  const keys = Object.keys(d).sort();
  const want = ["changed_paths", "commit_message", "patch", "run_id", "target_branch"].sort();
  if (keys.length !== want.length || !keys.every((k, i) => k === want[i])) return false;
  if (typeof d.patch !== "string" || d.patch.length === 0) return false;
  if (typeof d.commit_message !== "string" || d.commit_message.length === 0) return false;
  if (typeof d.run_id !== "string" || d.run_id.length === 0) return false;
  if (typeof d.target_branch !== "string") return false;
  if (!Array.isArray(d.changed_paths) || d.changed_paths.length === 0) return false;
  if (!d.changed_paths.every((p) => typeof p === "string" && p.length > 0)) return false;
  return true;
}

// Verify the publisher-bound pre-publication attestation (Ed25519 over its canonical
// bytes) against EYE_AUTHORITY_PUBKEY, plus TTL, run binding, and unused nonce.
// `now` and `seenNonces` are injected so this is pure and testable.
export function verifyAttestation(att, { canonicalBytesOf, publicKeyPem, runId, now, seenNonces }) {
  try {
    if (!att || typeof att !== "object") return { ok: false, reason: REFUSAL.ATTESTATION_MISSING };
    const { payload, signature_b64 } = att;
    if (!payload || !signature_b64) return { ok: false, reason: REFUSAL.ATTESTATION_MISSING };
    const sig = Buffer.from(String(signature_b64), "base64");
    const bytes = canonicalBytesOf(payload);
    if (edVerify(null, Buffer.from(bytes), publicKeyPem, sig) !== true) return { ok: false, reason: REFUSAL.ATTESTATION_INVALID };
    if (payload.hestia_run_binding !== runId) return { ok: false, reason: REFUSAL.ATTESTATION_INVALID, detail: "run binding" };
    if (typeof payload.issued_at !== "number" || typeof payload.ttl_seconds !== "number") return { ok: false, reason: REFUSAL.ATTESTATION_INVALID, detail: "ttl fields" };
    if (now > payload.issued_at + payload.ttl_seconds) return { ok: false, reason: REFUSAL.ATTESTATION_STALE };
    if (!payload.nonce || (seenNonces && seenNonces.has(payload.nonce))) return { ok: false, reason: REFUSAL.ATTESTATION_STALE, detail: "nonce reused/absent" };
    return { ok: true, nonce: payload.nonce };
  } catch { return { ok: false, reason: REFUSAL.ATTESTATION_INVALID }; }
}

// PURE DECISION CORE: given the validated dossier, the recomputed digest, the
// attestation verdict, the controller-minted ref, and the server-fetched ref facts,
// decide accept/refuse. No I/O; the push happens only on ok.
//
// input: {
//   dossier, recomputedDigest, declaredDigest, attestationVerdict,
//   mintedRef, defaultBranch, protectedRefs:Set, refExists:bool
// }
export function evaluatePublish(input) {
  const { dossier, recomputedDigest, declaredDigest, attestationVerdict,
          mintedRef, defaultBranch, protectedRefs, refExists } = input;
  // Digest + schema BEFORE any credential is loaded.
  if (!validateDossierSchema(dossier)) return no(REFUSAL.DOSSIER_SCHEMA_INVALID);
  if (recomputedDigest !== declaredDigest) return no(REFUSAL.DOSSIER_DIGEST_MISMATCH);
  // Attestation BEFORE push.
  if (!attestationVerdict || !attestationVerdict.ok) return no(attestationVerdict ? attestationVerdict.reason : REFUSAL.ATTESTATION_MISSING, attestationVerdict && attestationVerdict.detail);
  // Execution-surface rejection — no exception path through Hestia.
  for (const p of dossier.changed_paths) {
    if (EXECUTION_SURFACE_GLOBS.some((g) => simpleGlob(g, p))) return no(REFUSAL.EXECUTION_SURFACE_REJECTED, p);
  }
  // The push target is CONTROLLER-MINTED, never agent-chosen.
  if (dossier.target_branch && dossier.target_branch !== mintedRef) return no(REFUSAL.REF_NOT_MINTED, "agent-supplied target != minted ref");
  if (!RESERVED_NS.test(mintedRef)) return no(REFUSAL.REF_NOT_MINTED, "minted ref outside reserved namespace");
  if (mintedRef === defaultBranch) return no(REFUSAL.REF_DEFAULT_BRANCH);
  if (protectedRefs && protectedRefs.has && protectedRefs.has(mintedRef)) return no(REFUSAL.REF_PROTECTED);
  // Create-only: the ref must not already exist.
  if (refExists) return no(REFUSAL.REF_EXISTS);
  return ok({ ref: mintedRef });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("branch-publisher: invoke via the publisher job with a digest-bound patch dossier + attestation; direct invocation is a fail-closed no-op.");
  process.exit(2);
}
