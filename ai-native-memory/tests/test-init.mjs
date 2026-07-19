#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contentAddress, renderRecordList } from "../scripts/lib/record.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INIT = path.join(HERE, "..", "scripts", "init.mjs");
const roots = [];

function makeRoot(prefix = "anm init ") {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function runInit(root, component) {
  const args = [INIT, root];
  if (component !== undefined) args.push(component);
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

function runInitConcurrent(root, component) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [INIT, root, component]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(path.join(root, ...relativePath.split("/")), "utf8"));
}

function componentFiles(component) {
  return [
    `${component}/memory/README.md`,
    `${component}/memory/IDENTITY.md`,
    `${component}/memory/INVARIANTS.json`,
    `${component}/memory/INVARIANTS.md`,
    `${component}/memory/NON-CLAIMS.json`,
    `${component}/memory/NON-CLAIMS.md`,
    `${component}/memory/CONTRACTS/component.json`,
    `${component}/memory/comprehension-queries.json`,
    `${component}/memory/DECISIONS/rejected-alternatives.md`,
    `${component}/memory/FAILURE-MODES.md`,
    `${component}/memory/EVIDENCE/README.md`
  ];
}

function assertComponent(root, component) {
  for (const file of componentFiles(component)) {
    assert.ok(existsSync(path.join(root, ...file.split("/"))), `scaffolded: ${file}`);
  }

  const recordsByFile = new Map();
  for (const file of [
    `${component}/memory/INVARIANTS.json`,
    `${component}/memory/NON-CLAIMS.json`,
    `${component}/memory/CONTRACTS/component.json`
  ]) {
    const value = readJson(root, file);
    const records = Array.isArray(value) ? value : [value];
    recordsByFile.set(file, records);
    for (const record of records) {
      assert.equal(record.status, "SPECIFIED-PENDING-IMPLEMENTATION");
      assert.equal(record.becomes_normative_when, "");
      assert.equal(record.id, contentAddress(record));
    }
  }

  assert.equal(
    readFileSync(path.join(root, ...`${component}/memory/INVARIANTS.md`.split("/")), "utf8"),
    renderRecordList("Invariants", recordsByFile.get(`${component}/memory/INVARIANTS.json`))
  );
  assert.equal(
    readFileSync(path.join(root, ...`${component}/memory/NON-CLAIMS.md`.split("/")), "utf8"),
    renderRecordList("Non-claims", recordsByFile.get(`${component}/memory/NON-CLAIMS.json`))
  );
}

function treeFiles(root, current = root) {
  const files = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...treeFiles(root, full));
    else files.push(path.relative(root, full));
  }
  return files.sort();
}

try {
  const invalidComponents = [
    "",
    ".",
    "/absolute",
    "C:\\absolute",
    "\\\\server\\share",
    "C:drive-relative",
    "../escape",
    "widget/../escape",
    "widget//nested",
    "widget/./nested",
    "widget/",
    "widget\\nested"
  ];
  for (const component of invalidComponents) {
    const root = makeRoot("anm invalid ");
    const result = runInit(root, component);
    assert.notEqual(result.status, 0, `reject component ${JSON.stringify(component)}`);
    assert.equal(readdirSync(root).length, 0, `no mutation for ${JSON.stringify(component)}`);
  }

  const symlinkRoot = makeRoot("anm symlink ");
  const outside = makeRoot("anm outside ");
  symlinkSync(outside, path.join(symlinkRoot, "linked"), "dir");
  const symlinkResult = runInit(symlinkRoot, "linked/widget");
  assert.notEqual(symlinkResult.status, 0, symlinkResult.stdout + symlinkResult.stderr);
  assert.equal(existsSync(path.join(symlinkRoot, "MEMORY-MANIFEST.json")), false);
  assert.deepEqual(readdirSync(outside), [], "symlink escape wrote nothing outside");

  const lifecycleRoot = makeRoot();
  const base = runInit(lifecycleRoot);
  assert.equal(base.status, 0, base.stderr);
  for (const file of [
    "AI-START-HERE.md",
    "CURRENT-AUTHORITY.json",
    "MEMORY-MANIFEST.json",
    "LOAD-ORDER.json"
  ]) {
    assert.ok(existsSync(path.join(lifecycleRoot, file)), `base scaffolded: ${file}`);
  }
  assert.deepEqual(readJson(lifecycleRoot, "MEMORY-MANIFEST.json").components, []);

  const widget = runInit(lifecycleRoot, "widget");
  assert.equal(widget.status, 0, widget.stderr);
  assert.match(widget.stdout, /^update: MEMORY-MANIFEST\.json$/m);
  assert.deepEqual(readJson(lifecycleRoot, "MEMORY-MANIFEST.json").components, ["widget"]);
  assertComponent(lifecycleRoot, "widget");

  const gadget = runInit(lifecycleRoot, "gadget");
  assert.equal(gadget.status, 0, gadget.stderr);
  assert.deepEqual(readJson(lifecycleRoot, "MEMORY-MANIFEST.json").components, ["gadget", "widget"]);
  assertComponent(lifecycleRoot, "gadget");

  const beforeSameComponent = new Map(treeFiles(lifecycleRoot).map((file) => [
    file,
    readFileSync(path.join(lifecycleRoot, file))
  ]));
  const sameWidget = runInit(lifecycleRoot, "widget");
  assert.equal(sameWidget.status, 0, sameWidget.stderr);
  assert.match(sameWidget.stdout, /^skip: MEMORY-MANIFEST\.json$/m);
  for (const [file, contents] of beforeSameComponent) {
    assert.deepEqual(readFileSync(path.join(lifecycleRoot, file)), contents, `no overwrite: ${file}`);
  }

  const nestedRoot = makeRoot();
  const nested = runInit(nestedRoot, "packages/widget");
  assert.equal(nested.status, 0, nested.stderr);
  assert.deepEqual(readJson(nestedRoot, "MEMORY-MANIFEST.json").components, ["packages/widget"]);
  assertComponent(nestedRoot, "packages/widget");

  for (const manifest of [
    "{\n",
    JSON.stringify({ version: 2, components: [] }),
    JSON.stringify({ version: 1, components: "widget" }),
    JSON.stringify({ version: 1, components: ["../escape"] })
  ]) {
    const root = makeRoot("anm invalid manifest ");
    assert.equal(runInit(root).status, 0);
    writeFileSync(path.join(root, "MEMORY-MANIFEST.json"), manifest);
    const result = runInit(root, "widget");
    assert.notEqual(result.status, 0, result.stdout + result.stderr);
    assert.equal(existsSync(path.join(root, "widget")), false, "invalid manifest blocks component");
    assert.equal(readFileSync(path.join(root, "MEMORY-MANIFEST.json"), "utf8"), manifest);
  }

  const unreadableManifestRoot = makeRoot("anm unreadable manifest ");
  assert.equal(runInit(unreadableManifestRoot).status, 0);
  rmSync(path.join(unreadableManifestRoot, "MEMORY-MANIFEST.json"));
  mkdirSync(path.join(unreadableManifestRoot, "MEMORY-MANIFEST.json"));
  const unreadableManifest = runInit(unreadableManifestRoot, "widget");
  assert.notEqual(unreadableManifest.status, 0, unreadableManifest.stdout + unreadableManifest.stderr);
  assert.equal(existsSync(path.join(unreadableManifestRoot, "widget")), false);

  const authoredRoot = makeRoot("anm authored ");
  const authored = "# authored start file\n";
  writeFileSync(path.join(authoredRoot, "AI-START-HERE.md"), authored);
  const authoredResult = runInit(authoredRoot, "widget");
  assert.equal(authoredResult.status, 0, authoredResult.stderr);
  assert.equal(readFileSync(path.join(authoredRoot, "AI-START-HERE.md"), "utf8"), authored);

  const concurrentRoot = makeRoot("anm concurrent ");
  const [alpha, beta] = await Promise.all([
    runInitConcurrent(concurrentRoot, "alpha"),
    runInitConcurrent(concurrentRoot, "beta")
  ]);
  assert.equal(alpha.status, 0, alpha.stdout + alpha.stderr);
  assert.equal(beta.status, 0, beta.stdout + beta.stderr);
  assert.deepEqual(readJson(concurrentRoot, "MEMORY-MANIFEST.json").components, ["alpha", "beta"]);
  assertComponent(concurrentRoot, "alpha");
  assertComponent(concurrentRoot, "beta");
  assert.equal(
    treeFiles(concurrentRoot).some((file) =>
      file.includes("MEMORY-MANIFEST.lock") || file.includes("MEMORY-MANIFEST.json.tmp-")
    ),
    false,
    "no lock or temporary manifest residue"
  );
} finally {
  for (const root of roots.reverse()) rmSync(root, { recursive: true, force: true });
}

console.log("test-init: all assertions passed");
