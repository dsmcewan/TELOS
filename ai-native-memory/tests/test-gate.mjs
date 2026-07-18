#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "gate");
const GATE = path.join(HERE, "..", "scripts", "gate.mjs");
const run = (answers, extra = []) => spawnSync(process.execPath,
  [GATE, path.join(FX, "queries.json"), path.join(FX, answers), "--authority", path.join(FX, "AUTHORITY.json"), ...extra],
  { encoding: "utf8" });

// pass -> 0, artifact GRANTED
const out = path.join(FX, "artifact.json");
const p = run("answers-pass.json", ["--out", out]);
assert.equal(p.status, 0, p.stdout + p.stderr);
const art = JSON.parse(readFileSync(out, "utf8"));
assert.equal(art.result, "COMPREHENSION_PASSED");
assert.equal(art.implementation_authority, "GRANTED");
rmSync(out);
// wrong answer -> 3
assert.equal(run("answers-wrong.json").status, 3);
// missing superseded exclusion -> 3
assert.equal(run("answers-missing-exclusion.json").status, 3);
// drifted authority -> 1 (mutate the doc so the hash no longer matches)
const doc = path.join(FX, "authority-doc.md");
const orig = readFileSync(doc, "utf8");
writeFileSync(doc, orig + "tamper\n");
try { assert.equal(run("answers-pass.json").status, 1); }
finally { writeFileSync(doc, orig); }
console.log("test-gate: all assertions passed");
