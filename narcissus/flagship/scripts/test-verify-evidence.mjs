import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VERIFIER = path.join(HERE, "verify-evidence.mjs");

function createFixture(entries) {
  const root = mkdtempSync(path.join(os.tmpdir(), "verify-evidence-"));
  const scripts = path.join(root, "narcissus", "flagship", "scripts");
  const src = path.join(root, "narcissus", "flagship", "src");
  mkdirSync(scripts, { recursive: true });
  mkdirSync(src, { recursive: true });
  copyFileSync(VERIFIER, path.join(scripts, "verify-evidence.mjs"));
  writeFileSync(
    path.join(src, "evidence-ledger.json"),
    `${JSON.stringify({ entries }, null, 2)}\n`,
  );
  execFileSync("git", ["init", "-q"], { cwd: root });
  return root;
}

function runVerifier(root) {
  return spawnSync(
    process.execPath,
    [path.join(root, "narcissus", "flagship", "scripts", "verify-evidence.mjs")],
    { cwd: root, encoding: "utf8" },
  );
}

test("verifies a valid path against its current Git index blob", (t) => {
  const root = createFixture([]);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const recordPath = "docs/record.json";
  mkdirSync(path.join(root, "docs"), { recursive: true });
  writeFileSync(path.join(root, recordPath), '{"status":"NORMATIVE"}\n');
  execFileSync("git", ["add", "--", recordPath], { cwd: root });
  const blobSha = execFileSync("git", ["hash-object", "--", recordPath], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(root, "narcissus", "flagship", "src", "evidence-ledger.json"),
    `${JSON.stringify(
      {
        entries: [
          {
            id: "valid-record",
            source_path: recordPath,
            blob_sha: blobSha,
            quote: "NORMATIVE",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const result = runVerifier(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 entries pinned \+ present/);
});

test("rejects a malicious source_path without invoking a shell", (t) => {
  const root = createFixture([]);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const marker = path.join(root, "shell-injection-marker");
  const payload =
    `$(node -e 'require("fs").writeFileSync(${JSON.stringify(marker)},"owned")')`;
  writeFileSync(
    path.join(root, "narcissus", "flagship", "src", "evidence-ledger.json"),
    `${JSON.stringify(
      {
        entries: [
          {
            id: "malicious-record",
            source_path: payload,
            blob_sha: "0".repeat(40),
            quote: "must remain data",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const result = runVerifier(root);
  assert.equal(result.status, 1, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.equal(
    existsSync(marker),
    false,
    `source_path executed as shell input; marker content: ${
      existsSync(marker) ? readFileSync(marker, "utf8") : "<absent>"
    }`,
  );
});

test("rejects a fabricated quote even when the source blob pin is current", (t) => {
  const root = createFixture([]);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const recordPath = "docs/record.md";
  mkdirSync(path.join(root, "docs"), { recursive: true });
  writeFileSync(path.join(root, recordPath), "The recorded claim is narrow and testable.\n");
  execFileSync("git", ["add", "--", recordPath], { cwd: root });
  const blobSha = execFileSync("git", ["hash-object", "--", recordPath], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(root, "narcissus", "flagship", "src", "evidence-ledger.json"),
    `${JSON.stringify(
      {
        entries: [
          {
            id: "fabricated-quote",
            source_path: recordPath,
            blob_sha: blobSha,
            quote: "The record proves an expansive claim it never actually made.",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const result = runVerifier(root);
  assert.equal(result.status, 1, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stderr, /QUOTE DRIFT/);
});

test("rejects an entry that omits required evidence fields", (t) => {
  const root = createFixture([]);
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const recordPath = "docs/record.json";
  mkdirSync(path.join(root, "docs"), { recursive: true });
  writeFileSync(path.join(root, recordPath), '{"status":"NORMATIVE"}\n');
  execFileSync("git", ["add", "--", recordPath], { cwd: root });
  const blobSha = execFileSync("git", ["hash-object", "--", recordPath], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(root, "narcissus", "flagship", "src", "evidence-ledger.json"),
    `${JSON.stringify({ entries: [{ source_path: recordPath, blob_sha: blobSha }] }, null, 2)}\n`,
  );

  const result = runVerifier(root);
  assert.equal(result.status, 1, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.match(result.stderr, /INVALID ENTRY 0/);
});
