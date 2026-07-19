#!/usr/bin/env node
// The inheritance proof: the plugin audits, gates, and verifies ITSELF.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  importSpecifiers,
  packageBoundaryProblems
} from "../scripts/lib/record.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

// 1. the package and every script satisfy the zero-dependency/import boundary.
assert.deepEqual(packageBoundaryProblems(ROOT), []);

// 2. self-audit: the public whole-root audit is clean.
const audit = spawnSync(process.execPath, [path.join(ROOT, "scripts", "audit.mjs"), ROOT], { encoding: "utf8" });
assert.equal(audit.status, 0, `whole-root self-audit:\n${audit.stdout}\n${audit.stderr}`);

// 3. self-gate: the example answers GRANT; a flipped answer DENIES
const gate = (answers) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "gate.mjs"),
  path.join(ROOT, "memory", "comprehension-queries.json"), answers,
  "--authority", path.join(ROOT, "CURRENT-AUTHORITY.json")], { encoding: "utf8" });
assert.equal(gate(path.join(ROOT, "memory", "answers-example.json")).status, 0, "self-gate GRANTED");
// negative: flip one answer in a temp copy
const a = JSON.parse(readFileSync(path.join(ROOT, "memory", "answers-example.json"), "utf8"));
a.answers[Object.keys(a.answers)[0]] = "WRONG";
const tmp = path.join(HERE, "tmp-neg-answers.json");
writeFileSync(tmp, JSON.stringify(a));
try { assert.equal(gate(tmp).status, 2, "flipped answer DENIED"); } finally { rmSync(tmp); }

// 4. self-verify
const v = spawnSync(process.execPath, [path.join(ROOT, "scripts", "verify.mjs"), path.join(ROOT, "verify-map.json")], { encoding: "utf8" });
assert.equal(v.status, 0, `self-verify green:\n${v.stdout}\n${v.stderr}`);

// 5. no-host-imports: every script imports only node:* or ./ paths
const scan = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { scan(full); continue; }
    if (!e.name.endsWith(".mjs")) continue;
    const source = readFileSync(full, "utf8");
    for (const specifier of importSpecifiers(source)) {
      assert.ok(
        specifier.startsWith("node:") || specifier.startsWith("."),
        `${e.name}: non-portable import ${specifier}`
      );
    }
  }
};
scan(path.join(ROOT, "scripts"));
console.log("test-dogfood: all assertions passed");
