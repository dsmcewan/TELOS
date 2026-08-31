#!/usr/bin/env node
// branch-publisher-io.mjs — E1: the I/O orchestration for the branch publisher.
//
// Runs in the PUBLISHER JOB (fresh runner, sole credential holder). Loads the digest-
// bound patch-dossier artifact produced by the credentialless agents' job, recomputes
// its digest, verifies the publisher-bound pre-publication attestation, and — ONLY on
// an `accept` verdict from the tested pure core (branch-publisher.mjs) — performs the
// CREATE-ONLY push. Adds no decision logic of its own; the pure core decides.
//
// FAIL-CLOSED: any unresolved input, digest mismatch, stale/foreign attestation, or
// out-of-namespace ref makes the pure core refuse; no push occurs. HONEST LIMIT: the
// live push (create-only, force-with-lease against expected-empty) + server-side
// protected-ref fetch are wired at genesis; the offline suite covers the pure core.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { evaluatePublish, verifyAttestation } from "./branch-publisher.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { canonicalize, sha256hex } = await import(
  pathToFileURL(path.join(ROOT, "merkle-dag/vendor.mjs")).href
);
const die = (msg, code = 3) => { console.error(msg); process.exit(code); };
const env = process.env;

const dossierPath = process.argv[2] || die("usage: branch-publisher-io.mjs <patch-dossier.json>");
let dossier;
try { dossier = JSON.parse(readFileSync(dossierPath, "utf8")); } catch (e) { die(`dossier unreadable: ${e.message}`); }

const recomputedDigest = "sha256:" + sha256hex(canonicalize(dossier));
const declaredDigest = env.DOSSIER_DIGEST; // recorded when the artifact was uploaded

const attestationVerdict = verifyAttestation(
  env.PUBLISHER_ATTESTATION ? JSON.parse(env.PUBLISHER_ATTESTATION) : null,
  { canonicalBytesOf: (p) => Buffer.from(canonicalize(p)), publicKeyPem: env.EYE_AUTHORITY_PUBKEY,
    runId: env.HESTIA_RUN_ID, now: undefined /* genesis-wired clock */, seenNonces: undefined }
);

// mintedRef, defaultBranch, protectedRefs, refExists — fetched server-side at genesis.
const verdict = evaluatePublish({
  dossier, recomputedDigest, declaredDigest, attestationVerdict,
  mintedRef: env.MINTED_REF, defaultBranch: env.DEFAULT_BRANCH,
  protectedRefs: undefined, refExists: undefined,
});
if (!verdict.ok) die(`publish REFUSED: ${verdict.reason} ${verdict.detail || ""}`);
console.log(`publish accepted — create-only push to ${verdict.ref} (live push wired at genesis)`);
// execFileSync("git", ["push", "--force-with-lease=refs/heads/" + verdict.ref + ":", ...])  // create-only
