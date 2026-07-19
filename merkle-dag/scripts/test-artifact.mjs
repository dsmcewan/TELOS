// test-artifact.mjs — 5-case test suite for artifact.mjs
import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { computeDiskTreeHash, hasEscape } from "../artifact.mjs";

const base = mkdtempSync(path.join(os.tmpdir(), "telos-artifact-"));

// --- Case 1: Order independence ---
// Write two files; call with reversed order; tree_hash must match.
writeFileSync(path.join(base, "a.txt"), "alpha");
writeFileSync(path.join(base, "b.txt"), "beta");

const fwd = computeDiskTreeHash(["b.txt", "a.txt"], base);
const rev = computeDiskTreeHash(["a.txt", "b.txt"], base);
assert.equal(fwd.tree_hash, rev.tree_hash, "Case 1: order independence");

// --- Case 2: Present file ---
const r2 = computeDiskTreeHash(["a.txt"], base);
const entry = r2.files.find((f) => f.path === "a.txt");
assert.equal(entry.status, "present", "Case 2: status present");
assert.ok(entry.filehash && entry.filehash.startsWith("sha256:"), "Case 2: filehash set");

// --- Case 3: Missing file ---
const r3a = computeDiskTreeHash(["a.txt", "ghost.txt"], base);
const r3b = computeDiskTreeHash(["a.txt", "ghost.txt"], base);
const ghost = r3a.files.find((f) => f.path === "ghost.txt");
assert.equal(ghost.status, "missing", "Case 3: status missing");
assert.equal(ghost.filehash, null, "Case 3: filehash null");
// Deterministic across two calls
assert.equal(r3a.tree_hash, r3b.tree_hash, "Case 3: deterministic tree_hash");
// Differs from all-present hash (which has a.txt only)
assert.notEqual(r2.tree_hash, r3a.tree_hash, "Case 3: tree_hash differs from all-present");

// --- Case 4: Escape ---
const r4 = computeDiskTreeHash(["../outside.txt"], base);
const esc = r4.files.find((f) => f.path === "../outside.txt");
assert.equal(esc.status, "escape", "Case 4: status escape");
assert.equal(esc.filehash, null, "Case 4: filehash null for escape");
assert.equal(hasEscape(r4), true, "Case 4: hasEscape true");

// --- Case 5: Raw-byte sensitivity ---
writeFileSync(path.join(base, "c.txt"), Buffer.from([0x41, 0x42, 0x43]));
const r5a = computeDiskTreeHash(["c.txt"], base);
writeFileSync(path.join(base, "c.txt"), Buffer.from([0x41, 0x42, 0x44])); // flip last byte
const r5b = computeDiskTreeHash(["c.txt"], base);
assert.notEqual(r5a.tree_hash, r5b.tree_hash, "Case 5: byte flip changes tree_hash");

// --- Case 6: Physical escape through a symlink/junction is never read or hashed ---
{
  const outside = mkdtempSync(path.join(os.tmpdir(), "telos-artifact-outside-"));
  writeFileSync(path.join(outside, "secret.txt"), "outside secret");
  symlinkSync(outside, path.join(base, "escape-link"), process.platform === "win32" ? "junction" : "dir");
  const r6 = computeDiskTreeHash(["escape-link/secret.txt"], base);
  assert.deepEqual(r6.files[0], { path: "escape-link/secret.txt", filehash: null, status: "escape" }, "Case 6: symlink/junction artifact escape rejected");
  assert.equal(hasEscape(r6), true, "Case 6: physical escape is a hard path escape");
}

console.log("test-artifact.mjs OK");
