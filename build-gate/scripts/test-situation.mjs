#!/usr/bin/env node
// test-situation.mjs — PROJECT SENSE: collisions, conventions, protected-on-disk,
// greenfield vs brownfield, and purity (the sense never writes anything).
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { senseProject, collectWriteTargets, detectConventions, detectProtectedOnDisk } from "../situation.mjs";

function tmp() { return mkdtempSync(path.join(os.tmpdir(), "telos-sense-")); }

// --- collectWriteTargets: union dossier.write_targets + task writes, deduped/sorted ---
{
  const got = collectWriteTargets({ dossier: { write_targets: ["b.txt", "a.txt"] }, tasks: [{ writes: ["a.txt", "c.txt"] }] });
  assert.deepEqual(got, ["a.txt", "b.txt", "c.txt"], "deduped + sorted union");
}

// --- collisions: a write target already on disk is detected; absent is not ---
{
  const baseDir = tmp();
  mkdirSync(path.join(baseDir, "out"), { recursive: true });
  writeFileSync(path.join(baseDir, "out", "app.txt"), "existing");
  const rep = senseProject({ baseDir, dossier: { write_targets: ["out/app.txt"] }, tasks: [{ writes: ["out/new.txt"] }] });
  assert.equal(rep.mode, "brownfield", "existing write target => brownfield");
  assert.equal(rep.collisions.length, 1, "one collision");
  assert.equal(rep.collisions[0].path, "out/app.txt");
  assert.ok(rep.collisions[0].filehash.startsWith("sha256:"), "collision carries the real filehash");
  assert.ok(!rep.collisions.some((c) => c.path === "out/new.txt"), "absent target is not a collision");
  assert.ok(rep.advisories.some((a) => /out\/app\.txt already exists/.test(a)), "advisory names the collision");
}

// --- greenfield: empty baseDir, no targets present ---
{
  const baseDir = tmp();
  const rep = senseProject({ baseDir, dossier: { write_targets: ["out/a.txt"] }, tasks: [] });
  assert.equal(rep.mode, "greenfield", "nothing present => greenfield");
  assert.deepEqual(rep.collisions, [], "no collisions");
}

// --- conventions: read package.json type + scripts.test; malformed/absent => nulls, no throw ---
{
  const baseDir = tmp();
  writeFileSync(path.join(baseDir, "package.json"), JSON.stringify({ type: "module", scripts: { test: "vitest run" } }));
  const c = detectConventions({ baseDir });
  assert.equal(c.hasPackageJson, true);
  assert.equal(c.type, "module");
  assert.equal(c.testCmd, "vitest run");
  // a package.json makes the project brownfield even with no collisions
  assert.equal(senseProject({ baseDir, dossier: {}, tasks: [] }).mode, "brownfield", "package.json => brownfield");

  const bad = tmp();
  writeFileSync(path.join(bad, "package.json"), "{ not json");
  const cb = detectConventions({ baseDir: bad });
  assert.equal(cb.hasPackageJson, true, "malformed still counts as present");
  assert.equal(cb.testCmd, null, "malformed json => null testCmd, no throw");

  const none = tmp();
  assert.deepEqual(detectConventions({ baseDir: none }), { hasPackageJson: false, type: null, testCmd: null, scripts: {} }, "absent => all null");
}

// --- protected-on-disk: a protected prefix present under baseDir is reported ---
{
  const baseDir = tmp();
  mkdirSync(path.join(baseDir, "me", "claude-code"), { recursive: true });
  const present = detectProtectedOnDisk({ baseDir, dossier: {} });
  assert.ok(present.includes("me/claude-code/"), "default protected prefix present on disk detected");
  const rep = senseProject({ baseDir, dossier: {}, tasks: [] });
  assert.ok(rep.protectedOnDisk.includes("me/claude-code/"));
  assert.ok(rep.advisories.some((a) => /protected path present on disk: me\/claude-code\//.test(a)), "advisory names it");

  // dossier-declared protected path is also honored
  const b2 = tmp();
  mkdirSync(path.join(b2, "secrets"), { recursive: true });
  assert.ok(detectProtectedOnDisk({ baseDir: b2, dossier: { protected_paths: ["secrets/"] } }).includes("secrets/"), "dossier protected path detected");
}

// --- PURITY: senseProject creates nothing on disk ---
{
  const baseDir = tmp();
  writeFileSync(path.join(baseDir, "package.json"), "{}");
  const before = readdirSync(baseDir).sort();
  senseProject({ baseDir, dossier: { write_targets: ["a.txt", "b.txt"] }, tasks: [{ writes: ["c.txt"] }] });
  const after = readdirSync(baseDir).sort();
  assert.deepEqual(after, before, "senseProject is pure — no files created");
}

console.log("test-situation.mjs OK");
