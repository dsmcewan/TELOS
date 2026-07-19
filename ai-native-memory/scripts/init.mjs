#!/usr/bin/env node
// init.mjs — scaffolds a machine-first record set. Authored files are never overwritten.
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { contentAddress, renderRecordList } from "./lib/record.mjs";

const [, , rootArg, componentArg] = process.argv;
const MANIFEST = "MEMORY-MANIFEST.json";
const MANIFEST_LOCK = ".MEMORY-MANIFEST.lock";
const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 10;
const address = (record) => ({ ...record, id: contentAddress(record) });
const sleep = (milliseconds) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

function validateComponent(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("component path must be nonempty when provided");
  }
  if (value.includes("\0")
    || value.includes("\\")
    || path.posix.isAbsolute(value)
    || path.win32.isAbsolute(value)
    || /^[A-Za-z]:/.test(value)) {
    throw new Error(`component path must be portable and repository-relative: ${value}`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")
    || segments.join("/") !== value
    || path.posix.normalize(value) !== value) {
    throw new Error(`component path must use canonical forward-slash segments: ${value}`);
  }
  return { portable: value, segments };
}

function isWithin(base, target) {
  const relative = path.relative(base, target);
  return relative === "" || (
    relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function main() {
  if (!rootArg) throw new Error("usage: init.mjs <repo-root> [component-dir]");
  const component = validateComponent(componentArg);
  const root = path.resolve(rootArg);
  mkdirSync(root, { recursive: true });
  const realRoot = realpathSync(root);

  function targetFor(portableRelative) {
    const segments = portableRelative.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      throw new Error(`internal scaffold path is not canonical: ${portableRelative}`);
    }
    const target = path.resolve(root, ...segments);
    if (!isWithin(root, target)) {
      throw new Error(`scaffold path escapes repository root: ${portableRelative}`);
    }
    return { target, segments };
  }

  function assertExistingAncestors(portableRelative) {
    const { target, segments } = targetFor(portableRelative);
    let cursor = root;
    for (const segment of segments) {
      cursor = path.join(cursor, segment);
      if (!existsSync(cursor)) continue;
      const real = realpathSync(cursor);
      if (!isWithin(realRoot, real)) {
        throw new Error(`scaffold path escapes repository root through symlink: ${portableRelative}`);
      }
    }
    return target;
  }

  function put(portableRelative, content) {
    const { target, segments } = targetFor(portableRelative);
    assertExistingAncestors(portableRelative);
    const parentSegments = segments.slice(0, -1);
    mkdirSync(path.dirname(target), { recursive: true });
    if (parentSegments.length > 0) {
      assertExistingAncestors(parentSegments.join("/"));
    }
    try {
      writeFileSync(target, content, { flag: "wx" });
      console.log(`write: ${portableRelative}`);
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      console.log(`skip: ${portableRelative}`);
    }
  }

  function acquireManifestLock() {
    const lock = assertExistingAncestors(MANIFEST_LOCK);
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (true) {
      try {
        writeFileSync(lock, `${process.pid}\n`, { flag: "wx" });
        return lock;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (Date.now() >= deadline) {
          throw new Error(`timed out waiting for ${MANIFEST_LOCK}`);
        }
        sleep(LOCK_RETRY_MS);
      }
    }
  }

  function removeIfPresent(file) {
    try {
      unlinkSync(file);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  function parseManifest(file) {
    if (!existsSync(file)) return { exists: false, raw: null, components: [] };
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${MANIFEST} must be a regular generated file`);
    }
    let raw;
    let manifest;
    try {
      raw = readFileSync(file, "utf8");
      manifest = JSON.parse(raw);
    } catch (error) {
      throw new Error(`cannot read valid ${MANIFEST}: ${error.message}`);
    }
    if (!manifest
      || typeof manifest !== "object"
      || Array.isArray(manifest)
      || manifest.version !== 1
      || !Array.isArray(manifest.components)) {
      throw new Error(`${MANIFEST} must use supported version 1 with a components array`);
    }
    const components = manifest.components.map((entry) => {
      if (typeof entry !== "string") {
        throw new Error(`${MANIFEST} components must be portable strings`);
      }
      return validateComponent(entry).portable;
    });
    return { exists: true, raw, components };
  }

  function reconcileManifest() {
    const manifestFile = assertExistingAncestors(MANIFEST);
    const lock = acquireManifestLock();
    let temporary = null;
    try {
      const current = parseManifest(manifestFile);
      const components = [...new Set([
        ...current.components,
        ...(component ? [component.portable] : [])
      ])].sort();
      const content = JSON.stringify({ version: 1, components }, null, 2) + "\n";
      if (current.raw === content) {
        console.log(`skip: ${MANIFEST}`);
        return;
      }

      const temporaryRelative = `.MEMORY-MANIFEST.json.tmp-${process.pid}-${randomUUID()}`;
      temporary = assertExistingAncestors(temporaryRelative);
      writeFileSync(temporary, content, { flag: "wx" });
      renameSync(temporary, manifestFile);
      temporary = null;
      console.log(`${current.exists ? "update" : "write"}: ${MANIFEST}`);
    } finally {
      if (temporary) removeIfPresent(temporary);
      removeIfPresent(lock);
    }
  }

  const rootEntries = [
    ["AI-START-HERE.md", `# AI START HERE

You are inheriting an institution, not just source code. Do not begin from a confident guess.

Read in this order (see LOAD-ORDER.json):
1. This file.
2. CURRENT-AUTHORITY.json — the active governing authority. If active is null, a human must bind it before any record can claim NORMATIVE status.
3. Each component's memory/IDENTITY.md, then its CONTRACTS/.

Rules: machine records are the source of truth; human docs are rendered projections. A claim is NORMATIVE only with a passing oracle. No implementation authority until the comprehension gate GRANTS it.
`],
    ["CURRENT-AUTHORITY.json", JSON.stringify({
      note: "A human binds active to {ref,path,sha256}. Superseded entries never govern new work.",
      active: null,
      superseded: []
    }, null, 2) + "\n"],
    ["LOAD-ORDER.json", JSON.stringify({
      note: "Minimal reading order for a fresh model. Load slim: stop when the task's component is loaded.",
      order: ["AI-START-HERE.md", "CURRENT-AUTHORITY.json", "<component>/memory/IDENTITY.md", "<component>/memory/INVARIANTS.json", "<component>/memory/CONTRACTS/", "<component>/memory/NON-CLAIMS.json"],
      token_budget: {
        guidance: "Load the start file, current authority, and only the component records needed for the task; stop before unrelated components."
      }
    }, null, 2) + "\n"]
  ];

  let componentEntries = [];
  if (component) {
    const name = component.segments.at(-1);
    const memory = `${component.portable}/memory`;
    const invariants = [
      address({
        kind: "invariant",
        statement: "REPLACE: a load-bearing always-true property.",
        oracle: "",
        normativity: "NORMATIVE",
        status: "SPECIFIED-PENDING-IMPLEMENTATION",
        becomes_normative_when: ""
      })
    ];
    const nonClaims = [
      address({
        kind: "non-claim",
        statement: "REPLACE: something this component deliberately does NOT do or prove.",
        oracle: "",
        status: "SPECIFIED-PENDING-IMPLEMENTATION",
        becomes_normative_when: ""
      })
    ];
    const contract = address({
      kind: "contract",
      title: `${name} — frozen semantics`,
      status: "SPECIFIED-PENDING-IMPLEMENTATION",
      normativity: "NORMATIVE",
      becomes_normative_when: "",
      lifecycle: "docs-first",
      decided_by: "human",
      oracle: { test: "" }
    });

    componentEntries = [
      [`${memory}/README.md`, `# ${name} — memory

- \`IDENTITY.md\`
- \`INVARIANTS.json\` → \`INVARIANTS.md\`
- \`NON-CLAIMS.json\` → \`NON-CLAIMS.md\`
- \`CONTRACTS/component.json\`
- \`comprehension-queries.json\`
- \`DECISIONS/rejected-alternatives.md\`
- \`FAILURE-MODES.md\`
- \`EVIDENCE/README.md\`
`],
      [`${memory}/IDENTITY.md`, `# ${name} — identity\n\nWhat this component IS and is NOT, in two paragraphs. State the boundary.\n`],
      [`${memory}/INVARIANTS.json`, JSON.stringify(invariants, null, 2) + "\n"],
      [`${memory}/INVARIANTS.md`, renderRecordList("Invariants", invariants)],
      [`${memory}/NON-CLAIMS.json`, JSON.stringify(nonClaims, null, 2) + "\n"],
      [`${memory}/NON-CLAIMS.md`, renderRecordList("Non-claims", nonClaims)],
      [`${memory}/CONTRACTS/component.json`, JSON.stringify(contract, null, 2) + "\n"],
      [`${memory}/comprehension-queries.json`, JSON.stringify({
        component: name,
        governing_authority: { ref: "BIND-TO-AUTHORITY-REF" },
        required_invariants: [],
        required_non_claims: [],
        queries: []
      }, null, 2) + "\n"],
      [`${memory}/DECISIONS/rejected-alternatives.md`, `# ${name} — rejected alternatives\n\nPreserve every rejected path so a successor does not rediscover it as novel.\n`],
      [`${memory}/FAILURE-MODES.md`, `# ${name} — failure modes\n\nHow it fails, and that it fails closed.\n`],
      [`${memory}/EVIDENCE/README.md`, `# ${name} — evidence\n\nPointers to oracle runs and golden data.\n`]
    ];
  }

  for (const [relative] of [...rootEntries, [MANIFEST, ""], ...componentEntries]) {
    assertExistingAncestors(relative);
  }
  reconcileManifest();
  for (const [relative, content] of rootEntries) put(relative, content);
  for (const [relative, content] of componentEntries) put(relative, content);
}

try {
  main();
} catch (error) {
  console.error(`INIT_ERROR: ${error.message}`);
  process.exitCode = 1;
}
