#!/usr/bin/env node
// The inheritance proof: the plugin audits, gates, and verifies ITSELF.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditAuthorityRoot, auditMemoryDir } from "../scripts/audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

// 1. self-audit: zero FAIL findings on the plugin's own AUTHORITY.json + memory/ record set.
// NOTE: deliberately NOT auditRoot(ROOT) — that would sweep tests/fixtures/audit/v-* (the
// deliberate violation trees) and fail by design. This checks exactly the plugin's own record
// set: the AUTHORITY root check plus its own memory/ directory.
const findings = [...(() => {
  const out = [];
  auditAuthorityRoot(ROOT, out);
  return out;
})(), ...auditMemoryDir(path.join(ROOT, "memory"), ROOT)].filter((f) => f.level === "FAIL");
assert.deepEqual(findings, [], "self-audit clean: " + JSON.stringify(findings));

// 2. self-gate: the example answers GRANT; a flipped answer DENIES
const gate = (answers) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "gate.mjs"),
  path.join(ROOT, "memory", "comprehension-queries.json"), answers,
  "--authority", path.join(ROOT, "AUTHORITY.json")], { encoding: "utf8" });
assert.equal(gate(path.join(ROOT, "memory", "answers-example.json")).status, 0, "self-gate GRANTED");
// negative: flip one answer in a temp copy
const a = JSON.parse(readFileSync(path.join(ROOT, "memory", "answers-example.json"), "utf8"));
a.answers[Object.keys(a.answers)[0]] = "WRONG";
const tmp = path.join(HERE, "tmp-neg-answers.json");
writeFileSync(tmp, JSON.stringify(a));
try { assert.equal(gate(tmp).status, 3, "flipped answer DENIED"); } finally { rmSync(tmp); }

// 3. self-verify
const v = spawnSync(process.execPath, [path.join(ROOT, "scripts", "verify.mjs"), path.join(ROOT, "verify-map.json")], { encoding: "utf8" });
assert.equal(v.status, 0, "self-verify green: " + v.stdout);

// 4. no-host-imports: every script imports only node:* or ./ paths
const scan = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { scan(full); continue; }
    if (!e.name.endsWith(".mjs")) continue;
    for (const m of readFileSync(full, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(m[1].startsWith("node:") || m[1].startsWith("."), `${e.name}: non-portable import ${m[1]}`);
    }
  }
};
scan(path.join(ROOT, "scripts"));
console.log("test-dogfood: all assertions passed");
