#!/usr/bin/env node
// test-branch-publisher.mjs — adversarial regressions for the branch-publisher core.
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import {
  evaluatePublish, validateDossierSchema, verifyAttestation, REFUSAL,
} from "../branch-publisher.mjs";

// Deterministic canonical bytes for the attestation payload (stable key order).
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
const canonicalBytesOf = (p) => Buffer.from(canon(p));

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pubPem = publicKey.export({ type: "spki", format: "pem" });

function goodDossier() {
  return {
    changed_paths: ["build-gate/gate.mjs"],
    commit_message: "fix: x",
    patch: "diff --git a/build-gate/gate.mjs b/build-gate/gate.mjs\n...",
    run_id: "run-42",
    target_branch: "hestia/fix-run-42-1",
  };
}
function signedAttestation(over) {
  const payload = { hestia_run_binding: "run-42", issued_at: 1000, ttl_seconds: 300, nonce: "n1", ...over };
  const sig = edSign(null, canonicalBytesOf(payload), privateKey).toString("base64");
  return { payload, signature_b64: sig };
}
const attOk = (extra) => verifyAttestation(signedAttestation(extra), {
  canonicalBytesOf, publicKeyPem: pubPem, runId: "run-42", now: 1100, seenNonces: new Set(),
});

function baseInput(over) {
  return {
    dossier: goodDossier(),
    recomputedDigest: "sha256:d", declaredDigest: "sha256:d",
    attestationVerdict: attOk(),
    mintedRef: "hestia/fix-run-42-1",
    defaultBranch: "main", protectedRefs: new Set(["main", "release"]), refExists: false,
    ...over,
  };
}

let passed = 0;
const expect = (input, wantOk, wantReason, label) => {
  const v = evaluatePublish(input);
  assert.equal(v.ok, wantOk, `${label}: ok expected ${wantOk} got ${v.ok} (${v.reason || ""} ${v.detail || ""})`);
  if (!wantOk) assert.equal(v.reason, wantReason, `${label}: reason expected ${wantReason} got ${v.reason}`);
  passed++;
};

// happy path
expect(baseInput(), true, null, "eligible publish baseline");

// schema
{ const d = goodDossier(); delete d.patch; expect(baseInput({ dossier: d }), false, REFUSAL.DOSSIER_SCHEMA_INVALID, "missing patch"); }
{ const d = { ...goodDossier(), extra: 1 }; expect(baseInput({ dossier: d }), false, REFUSAL.DOSSIER_SCHEMA_INVALID, "extra field"); }
assert.equal(validateDossierSchema({}), false, "empty dossier invalid");

// digest
expect(baseInput({ recomputedDigest: "sha256:x" }), false, REFUSAL.DOSSIER_DIGEST_MISMATCH, "digest mismatch");

// attestation
expect(baseInput({ attestationVerdict: { ok: false, reason: REFUSAL.ATTESTATION_MISSING } }), false, REFUSAL.ATTESTATION_MISSING, "no attestation");
{ // stale by TTL
  const v = verifyAttestation(signedAttestation(), { canonicalBytesOf, publicKeyPem: pubPem, runId: "run-42", now: 2000, seenNonces: new Set() });
  assert.equal(v.reason, REFUSAL.ATTESTATION_STALE, "TTL expiry -> stale"); passed++; }
{ // reused nonce
  const v = verifyAttestation(signedAttestation(), { canonicalBytesOf, publicKeyPem: pubPem, runId: "run-42", now: 1100, seenNonces: new Set(["n1"]) });
  assert.equal(v.reason, REFUSAL.ATTESTATION_STALE, "reused nonce -> stale"); passed++; }
{ // foreign run binding
  const v = verifyAttestation(signedAttestation({ hestia_run_binding: "run-OTHER" }), { canonicalBytesOf, publicKeyPem: pubPem, runId: "run-42", now: 1100, seenNonces: new Set() });
  assert.equal(v.reason, REFUSAL.ATTESTATION_INVALID, "foreign run binding -> invalid"); passed++; }
{ // tampered signature
  const att = signedAttestation(); att.payload.ttl_seconds = 99999; // payload changed after signing
  const v = verifyAttestation(att, { canonicalBytesOf, publicKeyPem: pubPem, runId: "run-42", now: 1100, seenNonces: new Set() });
  assert.equal(v.reason, REFUSAL.ATTESTATION_INVALID, "payload tamper -> invalid sig"); passed++; }

// execution-surface rejection
{ const d = { ...goodDossier(), changed_paths: [".github/workflows/ci.yml"] };
  expect(baseInput({ dossier: d }), false, REFUSAL.EXECUTION_SURFACE_REJECTED, "workflow file in patch"); }
{ const d = { ...goodDossier(), changed_paths: ["build-gate/gate.mjs", ".github/actions/x/action.yml"] };
  expect(baseInput({ dossier: d }), false, REFUSAL.EXECUTION_SURFACE_REJECTED, "composite action in patch"); }

// ref discipline
{ const d = { ...goodDossier(), target_branch: "main" };
  expect(baseInput({ dossier: d, mintedRef: "hestia/fix-run-42-1" }), false, REFUSAL.REF_NOT_MINTED, "agent target != minted ref"); }
expect(baseInput({ mintedRef: "feature/x" }), false, REFUSAL.REF_NOT_MINTED, "minted ref outside reserved namespace");
expect(baseInput({ mintedRef: "main", dossier: { ...goodDossier(), target_branch: "main" } }), false, REFUSAL.REF_NOT_MINTED, "minted default-branch ref rejected at namespace gate");
expect(baseInput({ refExists: true }), false, REFUSAL.REF_EXISTS, "create-only: ref already exists");

console.log(`test-branch-publisher: all ${passed} assertions passed`);
