// test-crypto.mjs — 7-case test suite for crypto.mjs
import assert from "node:assert/strict";
import { mkdtempSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  generateKeypair, makeRecord, verifyTransaction,
  appendLedger, readLedger, writePublicKey, loadPublicKey
} from "../crypto.mjs";

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "telos-crypto-"));

const TX = {
  task_id: "T-001",
  effective_hash: "sha256:aabbcc",
  artifact_tree_hash: "sha256:ddeeff",
  artifact_files: [{ path: "plan.md", filehash: "sha256:112233", status: "present" }]
};

// --- Case 1: Roundtrip ---
const { privatePem, publicJwk } = generateKeypair();
const record1 = makeRecord(TX, "claude", privatePem);
assert.equal(verifyTransaction(record1, publicJwk), true, "Case 1: roundtrip verify");

// --- Case 2: Tamper field ---
const record2 = { ...record1, effective_hash: "sha256:TAMPERED" };
assert.equal(verifyTransaction(record2, publicJwk), false, "Case 2: tamper effective_hash → false");

const record2b = { ...record1, artifact_tree_hash: "sha256:TAMPERED" };
assert.equal(verifyTransaction(record2b, publicJwk), false, "Case 2b: tamper artifact_tree_hash → false");

const record2c = { ...record1, task_id: "T-TAMPERED" };
assert.equal(verifyTransaction(record2c, publicJwk), false, "Case 2c: tamper task_id → false");

const record2d = { ...record1, artifact_files: [] };
assert.equal(verifyTransaction(record2d, publicJwk), false, "Case 2d: tamper artifact_files → false");

const record2e = { ...record1, key_id: "tampered" };
assert.equal(verifyTransaction(record2e, publicJwk), false, "Case 2e: tamper key_id → false");

// --- Case 3: Wrong key ---
const { publicJwk: wrongJwk } = generateKeypair();
assert.equal(verifyTransaction(record1, wrongJwk), false, "Case 3: wrong key → false");

// --- Case 4: Corrupt sig (no throw) ---
const corruptSig = record1.sig.value.slice(0, -4) + "XXXX";
const record4 = { ...record1, sig: { ...record1.sig, value: corruptSig } };
let result4;
assert.doesNotThrow(() => { result4 = verifyTransaction(record4, publicJwk); }, "Case 4: corrupt sig does not throw");
assert.equal(result4, false, "Case 4: corrupt sig → false");

// --- Case 5: Ledger roundtrip + torn-line tolerance ---
const ledgerPath = path.join(tmpDir, "ledger.jsonl");
const TX2 = { ...TX, task_id: "T-002" };
const rec5a = makeRecord(TX, "claude", privatePem);
const rec5b = makeRecord(TX2, "claude", privatePem);
appendLedger(ledgerPath, rec5a);
appendLedger(ledgerPath, rec5b);

// Confirm 2 good records
const reads1 = readLedger(ledgerPath);
assert.equal(reads1.length, 2, "Case 5: 2 records after two appends");
assert.equal(reads1[0].task_id, "T-001", "Case 5: first record task_id");
assert.equal(reads1[1].task_id, "T-002", "Case 5: second record task_id");

// Append a blank line then a partial torn line WITHOUT trailing newline
appendFileSync(ledgerPath, '\n{"task_id":"x"');

// readLedger must still return exactly the 2 good records
const reads2 = readLedger(ledgerPath);
assert.equal(reads2.length, 2, "Case 5: torn line skipped — still exactly 2 records");

// --- Case 6: Keyring roundtrip ---
const keysDir = path.join(tmpDir, "keys");
writePublicKey(keysDir, "claude", publicJwk);
const loaded = loadPublicKey(keysDir, "claude");
assert.deepEqual(loaded, publicJwk, "Case 6: keyring roundtrip deep-equals");

// --- Case 7: verifyTransaction with loaded key works ---
assert.equal(verifyTransaction(record1, loaded), true, "Case 7: verify with loaded key → true");

console.log("test-crypto.mjs OK");
