#!/usr/bin/env node
// test-controller-closure.mjs — proves the committed TRUSTED_CONTROLLER_DIGEST in
// custody-manifest.json and GENESIS.json EQUALS the digest recomputed from the actual
// closure files on disk, and that every closure file exists. This is the drift guard:
// any byte change to a controller-closure file that is not reflected in the committed
// digest (or vice versa) fails here — so the provisioned trust value can never silently
// diverge from the code it is supposed to pin.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeControllerClosureDigest, CONTROLLER_CLOSURE_FILES } from "../controller-closure.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, "..");
const ROOT = path.resolve(TOOLS, "../..");

const { digest, entries } = computeControllerClosureDigest(TOOLS);

const custody = JSON.parse(readFileSync(path.join(TOOLS, "custody-manifest.json"), "utf8"));
const genesis = JSON.parse(readFileSync(path.join(ROOT, "workflows/GENESIS.json"), "utf8"));

assert.equal(custody.trusted_controller_digest, digest,
  `custody-manifest TRUSTED_CONTROLLER_DIGEST (${custody.trusted_controller_digest}) != recomputed (${digest})`);
assert.equal(genesis.provisioning.TRUSTED_CONTROLLER_DIGEST, digest,
  `GENESIS TRUSTED_CONTROLLER_DIGEST (${genesis.provisioning.TRUSTED_CONTROLLER_DIGEST}) != recomputed (${digest})`);

// The custody manifest's controller_closure_files must name exactly the closure set
// (workflows/tools/-prefixed), one-to-one with CONTROLLER_CLOSURE_FILES.
const want = CONTROLLER_CLOSURE_FILES.map((f) => `workflows/tools/${f}`).sort();
const got = [...custody.controller_closure_files].sort();
assert.deepEqual(got, want, "custody controller_closure_files != CONTROLLER_CLOSURE_FILES");

// Every entry resolves and its per-file digest is non-empty.
assert.equal(entries.length, CONTROLLER_CLOSURE_FILES.length, "closure entry count");
for (const e of entries) assert.ok(e.sha256.startsWith("sha256:"), `entry ${e.path} digest`);

console.log(`test-controller-closure: digest ${digest.slice(0, 24)}… self-consistent across ${entries.length} closure files`);
