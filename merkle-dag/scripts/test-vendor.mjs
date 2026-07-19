#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { canonicalize, sha256hex, resolveUnder, maxConcurrency, spawnCommand } from "../vendor.mjs";

// canonicalize: key-order independent, ARRAY ORDER PRESERVED
assert.equal(canonicalize({ b: 1, a: 2 }), canonicalize({ a: 2, b: 1 }), "keys sorted");
assert.notEqual(canonicalize({ a: [1, 2] }), canonicalize({ a: [2, 1] }), "array order preserved (must pre-sort)");
assert.equal(
  canonicalize(JSON.parse('{"__proto__":{"reviewed":true},"a":1}')),
  '{"__proto__":{"reviewed":true},"a":1}',
  "canonicalize preserves an own enumerable __proto__ JSON key"
);

// sha256hex: known vector + stable
assert.equal(sha256hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
assert.equal(sha256hex(Buffer.from("abc")), sha256hex("abc"), "buffer == string bytes");

// resolveUnder: confines, rejects escapes
const base = mkdtempSync(path.join(os.tmpdir(), "telos-base-"));
mkdirSync(path.join(base, "x"), { recursive: true });
assert.equal(resolveUnder(base, "x/y.txt"), path.join(base, "x", "y.txt"));
assert.equal(resolveUnder(base, "../escape"), null, "parent escape rejected");
assert.equal(resolveUnder(base, "/abs/escape"), null, "absolute escape rejected");
assert.equal(resolveUnder(base, ""), null, "empty rejected");

// Physical containment: a missing final file is allowed beneath safe existing
// parents, while an existing symlink/junction component is rejected before it
// can redirect a read, write, or cwd outside baseDir. The symlink/.. case proves
// original components are inspected before normalization can erase them.
{
  const outside = mkdtempSync(path.join(os.tmpdir(), "telos-outside-"));
  writeFileSync(path.join(outside, "secret.txt"), "outside");
  const link = path.join(base, "escape-link");
  symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  assert.equal(resolveUnder(base, "x/missing.txt"), path.join(base, "x", "missing.txt"), "missing final file under safe parents is allowed");
  assert.equal(resolveUnder(base, "escape-link/secret.txt"), null, "symlink/junction escape rejected");
  assert.equal(resolveUnder(base, "escape-link/../x/missing.txt"), null, "symlink component rejected before .. normalization");
}

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
