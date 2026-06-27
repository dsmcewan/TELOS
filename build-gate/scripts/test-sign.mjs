#!/usr/bin/env node
import assert from "node:assert/strict";
import { canonicalize, signPacket, verifyPacket, secretFor } from "../sign.mjs";

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

console.log("test-sign.mjs OK");
