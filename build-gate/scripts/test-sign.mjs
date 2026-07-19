#!/usr/bin/env node
import assert from "node:assert/strict";
import { canonicalize, signPacket, verifyPacket, secretFor, signMarketPacket } from "../sign.mjs";

const base = { model: "claude", decision: "approve", build_id: "b1", nested: { b: 2, a: 1 } };

// canonical form is key-order independent
const reordered = { nested: { a: 1, b: 2 }, build_id: "b1", decision: "approve", model: "claude" };
assert.equal(canonicalize(base), canonicalize(reordered), "canonicalize must be key-order independent");

// sign + verify roundtrip
const signed = signPacket(base, "s3cr3t");
assert.equal(signed.signature.alg, "HMAC-SHA256");
assert.match(signed.signature.value, /^[0-9a-f]{64}$/);
assert.deepEqual(verifyPacket(signed, "s3cr3t"), { ok: true, reason: "ok" });

// tamper detection
const tampered = { ...signed, decision: "reject" };
assert.equal(verifyPacket(tampered, "s3cr3t").ok, false, "mutated field must fail verify");

// Every own enumerable JSON key is signed, including "__proto__". Building the
// fixture through JSON.parse guarantees this is an own data property rather
// than object-literal prototype syntax.
{
  const packet = JSON.parse('{"model":"claude","decision":"approve","build_id":"b-proto","__proto__":{"reviewed":true}}');
  const protoSigned = signPacket(packet, "s3cr3t");
  assert.match(canonicalize(packet), /"__proto__"/, "canonical form retains own __proto__ key");
  const protoTampered = JSON.parse(JSON.stringify(protoSigned));
  protoTampered.__proto__.reviewed = false;
  assert.equal(verifyPacket(protoTampered, "s3cr3t").ok, false, "post-sign __proto__ tamper must fail verify");
}

// wrong secret
assert.equal(verifyPacket(signed, "wrong").ok, false, "wrong secret must fail verify");

// missing signature / missing secret
assert.equal(verifyPacket(base, "s3cr3t").ok, false, "no signature must fail");
assert.equal(verifyPacket(signed, "").ok, false, "empty secret must fail");

// canonicalize excludes the signature field (so verify is stable)
assert.equal(canonicalize(signed), canonicalize(base), "signature field must be excluded from canonical form");

// secretFor reads env
process.env.TELOS_SECRET_CLAUDE = "abc";
assert.equal(secretFor("claude"), "abc");
delete process.env.TELOS_SECRET_CLAUDE;
assert.equal(secretFor("claude"), null);

// signMarketPacket: content-addressed attestation + re-attribution to the signer +
// HMAC signature under the signer's secret; lens preserved; unsigned without a secret.
process.env.TELOS_SECRET_CODEX = "cx";
{
  const packet = { model: "grok", build_id: "b1", workstreams_reviewed: ["security-trust"] };
  const record = { workstream: "security-trust", converged: true, checks: [{ type: "file_exists", path: "x" }] };
  const out = signMarketPacket(packet, record, "codex");
  assert.equal(out.model, "codex", "market packet re-attributed to the signer");
  assert.equal(out.reviewed_by_lens, "grok", "the reviewing lens is preserved");
  assert.equal(out.provenance.model, "codex", "provenance attributed to the signer");
  assert.match(out.provenance.response_id, /^market-[0-9a-f]{64}$/, "content-addressed market attestation");
  assert.equal(verifyPacket(out, "cx").ok, true, "signed under the signer's secret");
  // deterministic: same record -> same attestation id
  assert.equal(signMarketPacket(packet, record, "codex").provenance.response_id, out.provenance.response_id, "attestation is content-addressed (stable)");
}
{
  const out = signMarketPacket({ model: "grok" }, { workstream: "x" }, "model-without-secret");
  assert.equal(out.signature, undefined, "no secret => unsigned packet (fail-closed at the gate)");
  assert.equal(out.model, "model-without-secret", "still re-attributed");
  assert.match(out.provenance.response_id, /^market-[0-9a-f]{64}$/, "still attested");
}
delete process.env.TELOS_SECRET_CODEX;

console.log("test-sign.mjs OK");
