#!/usr/bin/env node
// End-to-end parity: forge/operator.mjs signs; demo/verify.js must accept.
// Byte-level drift in the canonicalization port makes these tests fail.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { webcrypto } from "node:crypto";

import { createOperator } from "../../forge/operator.mjs";
import {
  canonical,
  entryBytes,
  base64ToBytes,
  sha256Hex,
  verifyDecision,
  verifyDigest
} from "../verify.js";

const subtle = webcrypto.subtle; // Node 18 has no global crypto — inject.

// ── canonical unit behavior ─────────────────────────────────────────────────
assert.equal(canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
assert.equal(canonical(null), "null");
assert.equal(canonical("x"), '"x"');

// entryBytes strips exactly `sig`
{
  const bytes = entryBytes({ z: 1, sig: { alg: "Ed25519", value: "AAA" } });
  assert.equal(new TextDecoder().decode(bytes), '{"z":1}');
}

// base64 round-trip
assert.deepEqual([...base64ToBytes("AQID")], [1, 2, 3]);

// ── end-to-end parity with the real signer ──────────────────────────────────
const workdir = mkdtempSync(path.join(os.tmpdir(), "telos-demo-test-"));
try {
  const op = createOperator({
    workdir,
    signerName: "demo-parity-test",
    rulebook: [{
      id: "overspend",
      when: () => true,
      act: () => ({
        action: "update_budget",
        args: { campaign_id: "fixture-campaign", daily_budget_cents: 2501 }
      })
    }],
    bounds: {
      update_budget: (args) => args.daily_budget_cents <= 2000
        ? true
        : `daily_budget_cents ${args.daily_budget_cents} over cap 2000`
    },
    actions: { update_budget: async () => ({ ok: true }) }
  });

  const result = await op.runPass({ source: "fixture" });
  assert.equal(result.decisions.length, 1);
  const record = result.decisions[0];
  assert.equal(record.sig?.alg, "Ed25519");

  // The ported verifier must accept what the real signer produced.
  const good = await verifyDecision(record, op.publicJwk, subtle);
  assert.deepEqual(good, { ok: true, reason: "ok" }, "port must verify real signature");

  // Tampering any top-level signed field must fail with invalid-signature.
  for (const field of Object.keys(record).filter((k) => k !== "sig")) {
    const tampered = { ...record, [field]: `${JSON.stringify(record[field])}-tampered` };
    const bad = await verifyDecision(tampered, op.publicJwk, subtle);
    assert.equal(bad.ok, false, `tampered '${field}' must fail`);
    assert.equal(bad.reason, "invalid-signature");
  }

  // Digest binding: pin, verify, tamper, fail.
  const inboxRecord = JSON.parse(readFileSync(op.inboxPath, "utf8").trim());
  const digest = {
    alg: "SHA-256",
    value: await sha256Hex(new TextEncoder().encode(canonical(inboxRecord)), subtle)
  };
  assert.deepEqual(await verifyDigest(inboxRecord, digest, subtle), { ok: true, reason: "ok" });
  const mutated = { ...inboxRecord, question: inboxRecord.question + " [tampered]" };
  assert.deepEqual(
    await verifyDigest(mutated, digest, subtle),
    { ok: false, reason: "digest-mismatch" }
  );

  // Failure-shape contract for the page's fail-closed messaging.
  // NOTE: pass null, not undefined — undefined would trigger the default
  // parameter (globalThis.crypto?.subtle), which exists on Node 20.
  assert.deepEqual(
    await verifyDecision(record, op.publicJwk, null),
    { ok: false, reason: "webcrypto-unavailable" }
  );
  assert.deepEqual(
    await verifyDecision({ ...record, sig: { ...record.sig, alg: "RSA" } }, op.publicJwk, subtle),
    { ok: false, reason: "unsupported-alg" }
  );
  assert.deepEqual(
    await verifyDecision({ ...record, sig: undefined }, op.publicJwk, subtle),
    { ok: false, reason: "missing-signature" }
  );
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

process.stdout.write("verify.test.mjs: all assertions passed\n");
