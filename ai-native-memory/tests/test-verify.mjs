#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "verify");
const V = path.join(HERE, "..", "scripts", "verify.mjs");
const run = (map) => spawnSync(process.execPath, [V, path.join(FX, map)], { encoding: "utf8" });
assert.equal(run("verify-map.json").status, 0, "all-green map exits 0");
assert.equal(run("verify-map-fail.json").status, 2, "failing oracle exits 2");
assert.equal(run("verify-map-missing.json").status, 2, "missing contract exits 2");
console.log("test-verify: all assertions passed");
