import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { syncLiveGraph } from "./build-live-graph.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.join(HERE, "build-live-graph.mjs");
const LIVE_GRAPH = path.join(HERE, "..", "src", "live-graph.json");
const tempDir = mkdtempSync(path.join(os.tmpdir(), "live-graph-test-"));
process.on("exit", () => rmSync(tempDir, { recursive: true, force: true }));

function runBuilder(...args) {
  return spawnSync(process.execPath, [BUILDER, ...args], {
    encoding: "utf8",
  });
}

test("--check accepts current committed evidence without rewriting it", () => {
  const original = readFileSync(LIVE_GRAPH);
  const result = runBuilder("--check");

  assert.equal(
    result.status,
    0,
    `current evidence must pass --check:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.deepEqual(readFileSync(LIVE_GRAPH), original);
  assert.match(result.stdout, /live-graph\.json current/);
});

test("--check detects drift without rewriting evidence", () => {
  const outputPath = path.join(tempDir, "stale-live-graph.json");
  const deliberatelyStale = Buffer.from('{"deliberately":"stale"}\n');
  writeFileSync(outputPath, deliberatelyStale);

  assert.throws(
    () => syncLiveGraph({ check: true, outputPath }),
    /LIVE GRAPH DRIFT/,
  );
  assert.deepEqual(
    readFileSync(outputPath),
    deliberatelyStale,
    "--check must never rewrite the evidence it is validating",
  );
});

test("--check treats missing evidence as drift without creating it", () => {
  const outputPath = path.join(tempDir, "missing-live-graph.json");

  assert.throws(
    () => syncLiveGraph({ check: true, outputPath }),
    /LIVE GRAPH DRIFT.*missing/,
  );
  assert.equal(existsSync(outputPath), false);
});

test("write mode deterministically replaces stale evidence and then passes --check", () => {
  const outputPath = path.join(tempDir, "written-live-graph.json");
  writeFileSync(outputPath, '{"stale":true}\n');

  const generated = syncLiveGraph({ outputPath });
  assert.deepEqual(readFileSync(outputPath), generated.bytes);
  assert.doesNotThrow(() => syncLiveGraph({ check: true, outputPath }));
});

test("unknown arguments fail closed without rewriting committed evidence", () => {
  const original = readFileSync(LIVE_GRAPH);
  const result = runBuilder("--unknown", "--check");

  assert.equal(
    result.status,
    1,
    `unknown arguments must fail:\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.deepEqual(readFileSync(LIVE_GRAPH), original);
  assert.match(result.stderr, /unknown argument/i);
});
