#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { canonicalize, sha256hex, resolveUnder, maxConcurrency } from "../vendor.mjs";

// canonicalize: key-order independent, ARRAY ORDER PRESERVED
assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }), "keys sorted");
assert.notEqual(canonicalize({ a: [1, 2] }), canonicalize({ a: [2, 1] }), "array order preserved (must pre-sort)");

// sha256hex: known vector + stable
assert.equal(sha256hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
assert.equal(sha256hex(Buffer.from("abc")), sha256hex("abc"), "buffer == string bytes");

// resolveUnder: confines, rejects escapes
const base = path.resolve("/tmp/telos-base");
assert.equal(resolveUnder(base, "x/y.txt"), path.join(base, "x", "y.txt"));
assert.equal(resolveUnder(base, "../escape"), null, "parent escape rejected");
assert.equal(resolveUnder(base, "/abs/escape"), null, "absolute escape rejected");
assert.equal(resolveUnder(base, ""), null, "empty rejected");

// maxConcurrency: clamps hint to [1, max(1, cpus-2)]
const upper = Math.max(1, os.cpus().length - 2);
assert.equal(maxConcurrency(1), 1, "maxConcurrency(1) === 1");
assert.equal(maxConcurrency(undefined), upper, "maxConcurrency(undefined) === upper bound");
assert.equal(maxConcurrency(0), upper, "maxConcurrency(0) === upper bound");
assert.equal(maxConcurrency(10_000), upper, "maxConcurrency(10_000) clamps to upper bound");

console.log("test-vendor.mjs OK");
