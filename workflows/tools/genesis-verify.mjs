#!/usr/bin/env node
// genesis-verify.mjs — E1: the fail-closed gate that verifies the Eye's signature over
// the canonical genesis payload BEFORE any provisioning, ruleset change, or ceremonial
// merge. A one-time ceremony verifier — NOT part of the running merge-controller closure
// (so it does not affect TRUSTED_CONTROLLER_DIGEST, which the signed payload itself pins).
//
// Checks (all must pass; any failure => exit 3, no ceremony step proceeds):
//  1. workflows/GENESIS.json parses and carries eye_authority_pubkey_pem + eye_signature_b64.
//  2. The canonical file digest equals GENESIS.signed_payload_canonical_sha256 AND equals
//     sha256(canonicalize(GENESIS.signed_payload)) — the bytes signed are exactly the
//     recorded payload, not a swapped file.
//  3. The Eye Ed25519 signature verifies over those exact canonical bytes against the
//     provided public key.
// The Eye PRIVATE key is never requested, read, generated, stored, or handled here.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { verifyEd25519 } from "./merge-controller.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../..");
const { canonicalize, sha256hex } = await import(pathToFileURL(path.join(ROOT, "merkle-dag/vendor.mjs")).href);
const sha = (b) => "sha256:" + sha256hex(b);
const fail = (m) => { console.error("genesis-verify FAIL: " + m); process.exit(3); };

const genesis = JSON.parse(readFileSync(path.join(ROOT, "workflows/GENESIS.json"), "utf8"));
if (!genesis.eye_authority_pubkey_pem) fail("eye_authority_pubkey_pem absent (Eye must provide the PUBLIC key)");
if (!genesis.eye_signature_b64) fail("eye_signature_b64 absent (Eye must provide the signature)");

const canonicalFile = readFileSync(path.join(ROOT, genesis.signed_payload_canonical_file));
if (sha(canonicalFile) !== genesis.signed_payload_canonical_sha256) fail("canonical file digest != signed_payload_canonical_sha256");

const recomputed = canonicalize(genesis.signed_payload);
if (sha(Buffer.from(recomputed)) !== genesis.signed_payload_canonical_sha256) fail("canonicalize(signed_payload) != recorded digest (payload/file drift)");
if (Buffer.compare(Buffer.from(recomputed), canonicalFile) !== 0) fail("canonicalize(signed_payload) bytes != the signed canonical file");

if (verifyEd25519(canonicalFile, genesis.eye_signature_b64, genesis.eye_authority_pubkey_pem) !== true) {
  fail("Eye Ed25519 signature does NOT verify over the canonical payload");
}
console.log("genesis-verify OK: Eye signature verifies over " + genesis.signed_payload_canonical_sha256);
