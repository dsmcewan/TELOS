// crypto.mjs — Ed25519 sign/verify + append-only ledger (single-writer). node:crypto only.
import { generateKeyPairSync, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";
import { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import path from "node:path";
import { canonicalize } from "./vendor.mjs";

export function generateKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return { privatePem: privateKey.export({ type: "pkcs8", format: "pem" }), publicJwk: publicKey.export({ format: "jwk" }) };
}

// The exact bytes signed/verified — must agree between signer and verifier.
function payloadBytes(tx) {
  return Buffer.from(canonicalize({
    task_id: tx.task_id, effective_hash: tx.effective_hash,
    artifact_tree_hash: tx.artifact_tree_hash, artifact_files: tx.artifact_files,
    key_id: tx.key_id
  }));
}

export function signTransaction(tx, privatePem) {
  return edSign(null, payloadBytes(tx), createPrivateKey(privatePem)).toString("base64");
}

export function verifyTransaction(record, publicJwk) {
  try {
    return edVerify(null, payloadBytes(record), createPublicKey({ key: publicJwk, format: "jwk" }), Buffer.from(record.sig.value, "base64"));
  } catch { return false; }
}

// Assemble a full, signed ledger record.
export function makeRecord(tx, model, privatePem, signed_at = null) {
  const signed = { task_id: tx.task_id, effective_hash: tx.effective_hash, artifact_tree_hash: tx.artifact_tree_hash, artifact_files: tx.artifact_files, key_id: model };
  return { ...signed, signer: model, signed_at,
    sig: { alg: "Ed25519", value: signTransaction(signed, privatePem), signed_fields: "task_id,effective_hash,artifact_tree_hash,artifact_files,key_id" } };
}

// Single-writer append: best-effort wx lock + write + fsync. Controller is the ONLY writer.
export function appendLedger(ledgerPath, record) {
  const lock = ledgerPath + ".lock";
  let acquired = false;
  for (let i = 0; i < 100 && !acquired; i++) {
    try { closeSync(openSync(lock, "wx")); acquired = true; } catch { /* held — single-writer means this is rare */ }
  }
  if (!acquired) throw new Error("ledger lock held — concurrent writer? (single-writer invariant violated)");
  try {
    const fd = openSync(ledgerPath, "a");
    try { writeFileSync(fd, JSON.stringify(record) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
  } finally { try { unlinkSync(lock); } catch {} }
}

// Tolerant reader: skip blank / torn (unparseable) lines — recovers from a kill mid-append.
export function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return [];
  const out = [];
  for (const line of readFileSync(ledgerPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* torn line — skip */ }
  }
  return out;
}

export function writePublicKey(keysDir, model, publicJwk) {
  mkdirSync(keysDir, { recursive: true });
  writeFileSync(path.join(keysDir, model + ".pub.jwk"), JSON.stringify(publicJwk, null, 2));
}
export function loadPublicKey(keysDir, model) {
  return JSON.parse(readFileSync(path.join(keysDir, model + ".pub.jwk"), "utf8"));
}
