#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { canonicalize, sha256hex, resolveUnder, maxConcurrency, spawnCommand } from "../vendor.mjs";

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

// spawnCommand: real executables (node) and all of POSIX pass through unchanged;
// only win32 batch shims (npm) are routed through cmd.exe.
assert.deepEqual(spawnCommand("node", ["-e", "0"]), { command: "node", args: ["-e", "0"] }, "node passes through unchanged");
assert.deepEqual(spawnCommand("no-such-cmd-xyz", ["a"]), { command: "no-such-cmd-xyz", args: ["a"] }, "an unresolved command passes through (fail-closed at spawn)");
if (process.platform === "win32") {
  const npm = spawnCommand("npm", ["test"]);
  assert.match(npm.command.toLowerCase(), /cmd\.exe$/, "win32 npm routes through cmd.exe");
  assert.deepEqual(npm.args.slice(0, 4), ["/d", "/s", "/c", "npm"], "cmd.exe /c wrapper carries the shim + its args");
}

// Integration: npm must actually run through spawnCommand on THIS platform (win32
// .cmd shim via cmd.exe, POSIX shebang script directly). Mirrors how ledger-gate
// spawns a node's test command with spawnSync.
{
  const spec = spawnCommand("npm", ["--version"]);
  const r = spawnSync(spec.command, spec.args, { encoding: "utf8" });
  assert.equal(r.status, 0, `npm --version must run via spawnCommand; got status=${r.status} err=${r.error?.code || "-"}`);
  assert.match((r.stdout || "").trim(), /\d+\.\d+\.\d+/, "npm printed a version");
}

console.log("test-vendor.mjs OK");
