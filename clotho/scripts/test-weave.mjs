#!/usr/bin/env node
// test-weave.mjs — Task 5. Real coverage of clotho/weave.mjs, the complete-weave
// driver: the abort contract (weaver throw, fatal warning, append/close failure —
// no temp file, no destination, stable codes); --skip/--out validation and the
// skipped-manifest shape; D19/AM-20 coverage-divergence refusals (wrong id order,
// missing/extra refs, wrong count ids, missing/extra/duplicate contract-files);
// D33/AM-34 tampered-inventory closure failure + exact helper content addresses
// in a successful manifest; D34/AM-38 publication-time drift (new closure edge
// AND byte/hash drift); D10/AM-39 attribution violations rejected BEFORE any
// appendEdge; the NINE D26/D29/D31 consumption-completeness behaviors incl. the
// independently signed skipped-nonzero manifest failing verification and the
// doc-skipped/ledger-executed clause resolution; count-shaped-field abort; the
// D20 publication race (EEXIST preserves the destination byte-identically); the
// D28 injected unlink failure (published-cleanup-incomplete, leftover temp
// named, destination undisturbed); and D21 symlink escapes (allowed root,
// nested parent, and a chain mutated between validation and publication). Plain
// node:assert/strict; hermetic fixture repositories; injected no-shell git.

import assert from "node:assert/strict";
import {
  mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, appendFileSync,
  lstatSync, symlinkSync, renameSync, readdirSync, openSync, writeSync, closeSync
} from "node:fs";
import { tmpdir } from "node:os";
import { createHash, generateKeyPairSync, sign as edSign } from "node:crypto";
import path from "node:path";

import { runWeave, exitCodeForResult, parseArgs, validateOut, validateSkip, PUBLICATION_STATES } from "../weave.mjs";
import { verifyLedger } from "../thread-ledger.mjs";
import { canonicalJson, deriveNodeId } from "../registry.mjs";
import { REQUIRED_INVENTORY_IDS, WEAVERS } from "../inventory.mjs";
import { splitMarkdownSections } from "../weavers/util.mjs";
import { weave as docWeave } from "../weavers/doc.mjs";
import { weave as ledgerWeave } from "../weavers/ledger.mjs";

// ---- fixture constants -------------------------------------------------------

const ROOT_COMMIT = "a".repeat(40);
const HEAD = "b".repeat(40);
const REPO = `git-root:${ROOT_COMMIT}`;
const B = (two) => two.repeat(20); // "11" -> 40-hex
const OUT = ".telos/clotho/weave.jsonl";
const WOVEN_AT = 1700000000000;
const IDS = WEAVERS.map((w) => w.id);
const [GIT_ID, CODE_ID, TEST_ID, DOC_ID, LEDGER_ID] = IDS;

const sha256hex = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const gitBlob = (bytes) => {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "utf8");
  return createHash("sha1").update(`blob ${buf.length}\u0000`).update(buf).digest("hex");
};
const exists = (p) => { try { lstatSync(p); return true; } catch { return false; } };

// ---- fixture repository ------------------------------------------------------
// Mechanism fixture: five weaver entry modules (git reaches a helper ONLY via an
// accepted require-style form; code ONLY via a re-export) and two orchestrator
// entries (the weave stub reaches its helper ONLY via a literal dynamic import),
// so tampering/omission per accepted form is provable. Plus real contract /
// ledger / run-summary source bytes for the real-ledger-weaver integration unit.

const MECHANISM_FILES = {
  "clotho/weavers/git.mjs": 'export const r = require("./git-helper.cjs");\n',
  "clotho/weavers/git-helper.cjs": "module.exports = 1;\n",
  "clotho/weavers/code.mjs": 'export * from "./code-helper.mjs";\n',
  "clotho/weavers/code-helper.mjs": "export const c = 1;\n",
  "clotho/weavers/test.mjs": "export const t = 1;\n",
  "clotho/weavers/doc.mjs": "export const d = 1;\n",
  "clotho/weavers/ledger.mjs": "export const l = 1;\n",
  "clotho/weave.mjs": 'export const p = import("./orch-helper.mjs");\n',
  "clotho/orch-helper.mjs": "export const o = 1;\n",
  "clotho/thread-ledger.mjs": "export const tl = 1;\n",
  "clotho/inventory.mjs": "export const inv = 1;\n"
};

const FIX_IMPL_FILES = {
  [GIT_ID]: ["clotho/weavers/git-helper.cjs", "clotho/weavers/git.mjs"],
  [CODE_ID]: ["clotho/weavers/code-helper.mjs", "clotho/weavers/code.mjs"],
  [TEST_ID]: ["clotho/weavers/test.mjs"],
  [DOC_ID]: ["clotho/weavers/doc.mjs"],
  [LEDGER_ID]: ["clotho/weavers/ledger.mjs"]
};
const FIX_ENTRY_MODULE = {
  [GIT_ID]: "clotho/weavers/git.mjs",
  [CODE_ID]: "clotho/weavers/code.mjs",
  [TEST_ID]: "clotho/weavers/test.mjs",
  [DOC_ID]: "clotho/weavers/doc.mjs",
  [LEDGER_ID]: "clotho/weavers/ledger.mjs"
};
const FIX_ORCH_ENTRIES = ["clotho/thread-ledger.mjs", "clotho/weave.mjs"];
const FIX_ORCH_FILES = ["clotho/orch-helper.mjs", "clotho/thread-ledger.mjs", "clotho/weave.mjs"];

// canonical-JSONL obligation-ledger entries (clotho-obligation-ledger-v1)
const eh = (content) => sha256hex(canonicalJson(content));
function ledgerEntry(prev, { entryKind, evidenceText, dischargeEvidence = null, contractClauseRef = null }) {
  const content = { entryKind, evidenceText, dischargeEvidence, contractClauseRef };
  const entryHash = eh(content);
  return { json: JSON.stringify({ entryKind, entryHash, evidenceText, dischargeEvidence, contractClauseRef, prev_hash: prev }), entryHash };
}

const CONTRACT_MD = "# Clause One\nThe alpha obligation clause bytes.\n";

function mkFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "clotho-weave-"));
  for (const [rel, content] of Object.entries(MECHANISM_FILES)) {
    const abs = path.join(root, ...rel.split("/"));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  mkdirSync(path.join(root, "contracts"), { recursive: true });
  writeFileSync(path.join(root, "contracts", "C.md"), CONTRACT_MD);
  const clause = splitMarkdownSections(CONTRACT_MD).sections[0];
  const validRef = { path: "contracts/C.md", heading_path: clause.heading_path, text_sha256: clause.text_sha256 };
  const ob = ledgerEntry("", { entryKind: "obligation", evidenceText: "discharge alpha", dischargeEvidence: "proof", contractClauseRef: validRef });
  writeFileSync(path.join(root, "led.jsonl"), ob.json + "\n");
  mkdirSync(path.join(root, "docs", "runs", "demo"), { recursive: true });
  writeFileSync(path.join(root, "docs", "runs", "demo", "summary.json"), JSON.stringify({ objective: "verifies alpha end to end" }));
  return { root, clause, obligationHash: ob.entryHash };
}

const mkGit = (root) => (args) => {
  if (args[0] === "rev-parse" && args[1] === "HEAD") return HEAD + "\n";
  if (args[0] === "rev-parse" && args[1] === "--is-shallow-repository") return "false\n";
  if (args[0] === "rev-list") return ROOT_COMMIT + "\n";
  if (args[0] === "hash-object") return gitBlob(readFileSync(path.join(root, ...args[3].split("/")))) + "\n";
  throw new Error(`fixture git: unsupported ${JSON.stringify(args)}`);
};

const SYMBOLS = [{ path: "clotho/x.mjs", symbol: "alpha", blob_sha: B("11") }];
const FILES = [{ path: "clotho/x.mjs", blob_sha: B("11") }];
const mkLists = () => ({
  "package-symbols": [...SYMBOLS],
  "package-files": [...FILES],
  "package-modules": [{ path: "clotho/x.mjs", blob_sha: B("11") }],
  "package-manifests": [{ path: "clotho/package.json", blob_sha: B("12") }],
  "test-files": [{ path: "clotho/scripts/test-x.mjs", blob_sha: B("13") }],
  "doc-files": [{ path: "docs/d.md", blob_sha: B("14") }],
  "contract-files": [{ path: "contracts/C.md", blob_sha: B("15") }],
  "ledger-sources": [{ path: "led.jsonl", adapter: "clotho-obligation-ledger-v1", blob_sha: B("16") }],
  "run-sources": [{ id: "demo", dir: "docs/runs/demo", summary: "docs/runs/demo/summary.json", blob_sha: B("17") }]
});

const mkInventories = () => ({
  weavers: WEAVERS,
  requiredIds: REQUIRED_INVENTORY_IDS,
  implFiles: FIX_IMPL_FILES,
  entryModule: FIX_ENTRY_MODULE,
  orchestratorFiles: FIX_ORCH_FILES,
  orchestratorEntries: FIX_ORCH_ENTRIES,
  permittedExternal: [],
  inventoryPath: "clotho/inventory.mjs"
});

// A structurally valid edge asserted by `id` (repository-file -> commit).
function edgeFor(id, two) {
  const from = { kind: "repository-file", locator: { repository_ref: REPO, path: "clotho/x.mjs", blob_sha: B("11") } };
  const to = { kind: "commit", locator: { sha: B(two) } };
  return {
    edge_kind: "introduced-by", from_node: deriveNodeId(from), to_node: deriveNodeId(to),
    from_locator: from, to_locator: to, source_ref: `git:${B(two)}`,
    asserted_by: id, assertion_status: "deterministic-extraction"
  };
}

// Well-behaved fixture weaver: consumes EVERY handed source fully, returns one
// valid edge and no warnings. Per-test overrides replace individual behaviors.
const EDGE_SHA = { [GIT_ID]: "21", [CODE_ID]: "22", [TEST_ID]: "23", [DOC_ID]: "24", [LEDGER_ID]: "25" };
function consumeAll(ctx, id) {
  for (const invId of REQUIRED_INVENTORY_IDS[id]) { for (const s of ctx.sources[invId]) void s; }
}
const goodWeaver = (id) => (ctx) => { consumeAll(ctx, id); return { edges: [edgeFor(id, EDGE_SHA[id])], warnings: [] }; };
const mkImpls = (overrides = {}) => {
  const impls = {};
  for (const id of IDS) impls[id] = overrides[id] ?? goodWeaver(id);
  return impls;
};

// One call = one fresh fixture + one runWeave. Returns { fx, res, dest, tmp }.
async function drive(overrides = {}, { fixture } = {}) {
  const fx = fixture ?? mkFixture();
  const opts = {
    repoRoot: fx.root,
    out: OUT,
    git: mkGit(fx.root),
    inventories: mkInventories(),
    sourceLists: mkLists(),
    symbols: SYMBOLS,
    files: FILES,
    weaverImpls: mkImpls(overrides.weaverImpls),
    wovenAt: WOVEN_AT,
    ...overrides.options
  };
  const res = await runWeave(opts);
  return { fx, res, dest: path.join(fx.root, ".telos", "clotho", "weave.jsonl"), tmp: path.join(fx.root, ".telos", "clotho", "weave.jsonl.tmp") };
}
const cleanup = (fx) => rmSync(fx.root, { recursive: true, force: true });

// Uniform abort assertions: stable code, no temp file, no destination, nonzero.
function assertAborted(res, dest, tmp, code, label) {
  assert.equal(res.ok, false, `${label}: not ok`);
  assert.equal(res.publication, "not-published", `${label}: not published`);
  assert.ok(res.error && res.error.code === code, `${label}: stable code ${code}, got ${JSON.stringify(res.error)}`);
  assert.equal(exists(tmp), false, `${label}: no temporary file remains`);
  assert.equal(exists(dest), false, `${label}: no destination published`);
  assert.ok(exitCodeForResult(res) !== 0 && exitCodeForResult(res) !== 3, `${label}: distinct nonzero failure status`);
}

// Recording openFile: real exclusive-create fd, records each written line, and
// optionally injects a failure. Used to PROVE which lines reached the ledger.
function recordingOpenFile(lines, failWhen = null) {
  return (p) => {
    const fd = openSync(p, "wx");
    return {
      write(line) {
        if (failWhen && failWhen(line, lines.length)) throw new Error("injected write failure");
        writeSync(fd, Buffer.from(line + "\n", "utf8"));
        lines.push(line);
      },
      close() { closeSync(fd); }
    };
  };
}

// ---- 1. guarded orchestration + argument validation --------------------------
{
  // importing weave.mjs ran no CLI (the import at the top of this file already
  // proves it: runWeave is a function and nothing was woven as a side effect).
  assert.equal(typeof runWeave, "function");
  assert.deepEqual(PUBLICATION_STATES, ["not-published", "published", "published-cleanup-incomplete"]);
  // exit-status mapping: three machine-distinguishable states
  assert.equal(exitCodeForResult({ publication: "published" }), 0);
  assert.equal(exitCodeForResult({ publication: "published-cleanup-incomplete" }), 3);
  assert.equal(exitCodeForResult({ publication: "not-published" }), 1);
  // argv parsing
  assert.deepEqual(parseArgs(["--skip", GIT_ID, "--skip", DOC_ID, "--out", OUT]), { skip: [GIT_ID, DOC_ID], out: OUT });
  assert.throws(() => parseArgs(["--frobnicate"]), /invalid-arguments/);
  assert.throws(() => parseArgs(["--skip"]), /invalid-arguments/);
  assert.throws(() => parseArgs(["--out", "a", "--out", "b"]), /invalid-arguments/);
  // --skip: unknown and duplicate ids are rejected
  assert.throws(() => validateSkip(["no-such-weaver"], IDS), /unknown weaver id/);
  assert.throws(() => validateSkip([GIT_ID, GIT_ID], IDS), /duplicate weaver id/);
  // --out: only validated repo-relative paths below the two allowed roots
  assert.equal(validateOut(".telos/clotho/w.jsonl"), ".telos/clotho/w.jsonl");
  assert.equal(validateOut("docs/runs/clotho-self-weave/w.jsonl"), "docs/runs/clotho-self-weave/w.jsonl");
  assert.throws(() => validateOut("docs/evil.jsonl"), /--out/);
  assert.throws(() => validateOut("../escape.jsonl"), /--out/);
  assert.throws(() => validateOut(".telos/clotho/../../evil.jsonl"), /--out/);
  assert.throws(() => validateOut("C:\\abs\\evil.jsonl"), /--out/);
}

// ---- 2. complete consumption -> executed, published (behavior 4) -------------
// Also: exact helper content addresses in implementation_refs/orchestrator_refs
// (AM-34 second half), canonical edge order + dedupe, stable JSON output.
{
  const { fx, res, dest, tmp } = await drive({
    weaverImpls: {
      // git returns its edge TWICE (exact duplicate) — dedupe keeps one
      [GIT_ID]: (ctx) => { consumeAll(ctx, GIT_ID); return { edges: [edgeFor(GIT_ID, "21"), edgeFor(GIT_ID, "21")], warnings: [] }; }
    }
  });
  try {
    assert.equal(res.ok, true, `happy path ok: ${JSON.stringify(res.error)}`);
    assert.equal(res.publication, "published");
    assert.equal(exitCodeForResult(res), 0);
    assert.equal(res.out, OUT);
    assert.equal(res.edge_count, 5, "five distinct edges after dedupe");
    assert.equal(exists(dest), true, "destination published");
    assert.equal(exists(tmp), false, "temporary name unlinked after the commit point");
    assert.ok(res.ledger_bytes > 0 && res.ledger_bytes === lstatSync(dest).size, "ledger_bytes matches the published artifact");
    assert.deepEqual(res.weavers, IDS.map((id) => ({ id, state: "executed" })), "per-weaver manifest states in output");
    assert.equal(res.fatal_warning_count, 0);
    assert.equal(typeof canonicalJson(res), "string", "driver output is stable canonical JSON");

    const v = await verifyLedger(dest);
    assert.equal(v.ok, true, `published ledger verifies: ${v.errors.join("; ")}`);
    assert.equal(v.records.length, 5);
    // canonical edge order: (edge_kind, from_node, to_node, source_ref, ...)
    for (let i = 1; i < v.records.length; i++) {
      const key = (e) => [e.edge_kind, e.from_node, e.to_node, e.source_ref, e.asserted_by, e.assertion_status].join("|");
      assert.ok(key(v.records[i - 1]) < key(v.records[i]), "edges appended in canonical sorted order");
    }
    // manifest: executed states, counts == configured cardinalities
    for (const w of v.manifest.weavers) {
      assert.equal(w.state, "executed");
      for (const c of w.inspected_source_counts) assert.equal(c.count, 1, `${w.id}/${c.inventory_id} count equals cardinality`);
    }
    // AM-34: the manifest carries the EXACT content addresses of every reachable
    // helper byte — including helpers reached only via require-style / re-export
    // / literal dynamic import forms.
    const refOf = (rel) => `file:${rel}@${gitBlob(MECHANISM_FILES[rel])}`;
    const implOf = (id) => v.manifest.weavers.find((w) => w.id === id).implementation_refs;
    assert.deepEqual(implOf(GIT_ID), FIX_IMPL_FILES[GIT_ID].map(refOf), "git implementation_refs cover the require-style helper bytes");
    assert.deepEqual(implOf(CODE_ID), FIX_IMPL_FILES[CODE_ID].map(refOf), "code implementation_refs cover the re-export helper bytes");
    assert.deepEqual(v.manifest.orchestrator_refs, FIX_ORCH_FILES.map(refOf), "orchestrator_refs cover the dynamic-import helper bytes");
    assert.deepEqual(v.manifest.inventories_consumed,
      [{ id: "clotho/inventory.mjs", source_ref: refOf("clotho/inventory.mjs") }],
      "inventories_consumed content-addresses the inventory actually read");
  } finally { cleanup(fx); }
}

// ---- 3. --skip manifest (behavior 5) -----------------------------------------
{
  const { fx, res, dest } = await drive({ options: { skip: [DOC_ID] } });
  try {
    assert.equal(res.ok, true, `skip run ok: ${JSON.stringify(res.error)}`);
    const v = await verifyLedger(dest);
    assert.equal(v.ok, true);
    for (const w of v.manifest.weavers) {
      if (w.id === DOC_ID) {
        assert.equal(w.state, "skipped", "the only non-executed state is skipped");
        for (const c of w.inspected_source_counts) assert.equal(c.count, 0, "skipped weaver carries zero counts");
        assert.ok(w.implementation_refs.length > 0, "skipped weaver keeps its implementation refs");
      } else {
        assert.equal(w.state, "executed");
      }
    }
    assert.deepEqual(res.weavers.find((w) => w.id === DOC_ID), { id: DOC_ID, state: "skipped" });
  } finally { cleanup(fx); }
}
{
  // skipped LEDGER weaver: all three required ids zero (incl. contract-files) —
  // no contract-files iterator is ever constructed (behavior 5, D31 clause).
  const { fx, res, dest } = await drive({ options: { skip: [LEDGER_ID] } });
  try {
    assert.equal(res.ok, true);
    const v = await verifyLedger(dest);
    const lw = v.manifest.weavers.find((w) => w.id === LEDGER_ID);
    assert.equal(lw.state, "skipped");
    assert.deepEqual(lw.inspected_source_counts,
      [{ inventory_id: "contract-files", count: 0 }, { inventory_id: "ledger-sources", count: 0 }, { inventory_id: "run-sources", count: 0 }],
      "skipped ledger weaver: zero over ALL THREE required ids");
  } finally { cleanup(fx); }
}

// ---- 4. invalid arguments + existing destination -----------------------------
{
  let d = await drive({ options: { skip: ["no-such-weaver"] } });
  try { assertAborted(d.res, d.dest, d.tmp, "invalid-arguments", "unknown --skip id"); } finally { cleanup(d.fx); }
  d = await drive({ options: { skip: [GIT_ID, GIT_ID] } });
  try { assertAborted(d.res, d.dest, d.tmp, "invalid-arguments", "duplicate --skip id"); } finally { cleanup(d.fx); }
  d = await drive({ options: { out: "docs/evil.jsonl" } });
  try {
    assert.equal(d.res.error.code, "invalid-arguments", "--out outside the allowed roots");
    assert.equal(exists(path.join(d.fx.root, "docs", "evil.jsonl")), false);
  } finally { cleanup(d.fx); }
  // an existing destination is rejected and PRESERVED
  const fx = mkFixture();
  try {
    mkdirSync(path.join(fx.root, ".telos", "clotho"), { recursive: true });
    writeFileSync(path.join(fx.root, ".telos", "clotho", "weave.jsonl"), "PRE-EXISTING\n");
    const { res, tmp } = await drive({}, { fixture: fx });
    assert.equal(res.error.code, "destination-exists");
    assert.equal(res.publication, "not-published");
    assert.equal(exists(tmp), false);
    assert.equal(readFileSync(path.join(fx.root, ".telos", "clotho", "weave.jsonl"), "utf8"), "PRE-EXISTING\n", "pre-existing destination untouched");
  } finally { cleanup(fx); }
}

// ---- 5. abort contract: weaver throw / real fatal warnings (D22) -------------
{
  const boom = (ctx) => { void ctx; throw new Error("fixture weaver exploded"); };
  const d = await drive({ weaverImpls: { [CODE_ID]: boom } });
  try {
    assertAborted(d.res, d.dest, d.tmp, "weaver-failure", "throwing weaver");
    assert.equal(d.res.error.weaver, CODE_ID, "the weaver id is reported");
  } finally { cleanup(d.fx); }
}
{
  const fx = mkFixture();
  writeFileSync(path.join(fx.root, "docs", "d.md"), "# Same\nalpha one\n# Same\nalpha two\n");
  const d = await drive({ weaverImpls: { [DOC_ID]: docWeave } }, { fixture: fx });
  try {
    assertAborted(d.res, d.dest, d.tmp, "fatal-warning", "real doc duplicate-heading-path aborts before close and publication");
    assert.equal(d.res.error.weaver, DOC_ID);
  } finally { cleanup(d.fx); }
}
{
  const ledgerFailures = [
    {
      label: "malformed JSON",
      expectedCode: "invalid-ledger-entry",
      write(fx) { writeFileSync(path.join(fx.root, "led.jsonl"), "{not-json}\n"); }
    },
    {
      label: "malformed schema",
      expectedCode: "invalid-ledger-entry",
      write(fx) {
        writeFileSync(path.join(fx.root, "led.jsonl"), JSON.stringify({
          entryKind: "concern", evidenceText: "alpha", prev_hash: ""
        }) + "\n");
      }
    },
    {
      label: "unknown entry kind",
      expectedCode: "invalid-ledger-entry",
      write(fx) {
        const bad = ledgerEntry("", { entryKind: "decision", evidenceText: "alpha" });
        writeFileSync(path.join(fx.root, "led.jsonl"), bad.json + "\n");
      }
    },
    {
      label: "non-string discharge evidence",
      expectedCode: "invalid-ledger-entry",
      write(fx) {
        const bad = ledgerEntry("", {
          entryKind: "obligation", evidenceText: "alpha", dischargeEvidence: 7
        });
        writeFileSync(path.join(fx.root, "led.jsonl"), bad.json + "\n");
      }
    },
    {
      label: "non-object contract clause ref",
      expectedCode: "invalid-ledger-entry",
      write(fx) {
        const bad = ledgerEntry("", {
          entryKind: "obligation", evidenceText: "alpha", contractClauseRef: []
        });
        writeFileSync(path.join(fx.root, "led.jsonl"), bad.json + "\n");
      }
    },
    {
      label: "content hash mismatch",
      expectedCode: "invalid-content-address",
      write(fx) {
        writeFileSync(path.join(fx.root, "led.jsonl"), JSON.stringify({
          entryKind: "concern",
          entryHash: "0".repeat(64),
          evidenceText: "alpha",
          dischargeEvidence: null,
          contractClauseRef: null,
          prev_hash: ""
        }) + "\n");
      }
    },
    {
      label: "chain failure",
      expectedCode: "chain-failure",
      write(fx) {
        const bad = ledgerEntry("f".repeat(64), { entryKind: "concern", evidenceText: "alpha" });
        writeFileSync(path.join(fx.root, "led.jsonl"), bad.json + "\n");
      }
    },
    {
      label: "duplicate contract heading path",
      expectedCode: "duplicate-heading-path",
      write(fx) {
        writeFileSync(path.join(fx.root, "contracts", "C.md"), "# Same\nalpha one\n# Same\nalpha two\n");
      }
    }
  ];
  for (const tc of ledgerFailures) {
    const fx = mkFixture();
    tc.write(fx);
    const d = await drive({ weaverImpls: { [LEDGER_ID]: ledgerWeave } }, { fixture: fx });
    try {
      assertAborted(d.res, d.dest, d.tmp, "fatal-warning", `real ledger ${tc.label}`);
      assert.equal(d.res.error.weaver, LEDGER_ID, `${tc.label}: real ledger weaver identified`);
      assert.match(d.res.error.detail, new RegExp(tc.expectedCode), `${tc.label}: driver reports the typed fatal code`);
    } finally { cleanup(d.fx); }
  }
}

// ---- 6. append and close failures clean up (descriptor, temp, destination) ---
{
  const lines = [];
  // header is line 0; the first EDGE write (line 1) fails
  const d = await drive({ options: { openFile: recordingOpenFile(lines, (line, n) => n >= 1) } });
  try {
    assertAborted(d.res, d.dest, d.tmp, "append-failure", "append failure");
    assert.equal(lines.length, 1, "only the header reached the ledger");
  } finally { cleanup(d.fx); }
}
{
  const lines = [];
  const d = await drive({ options: { openFile: recordingOpenFile(lines, (line) => line.includes("clotho_weave_trailer")) } });
  try {
    assertAborted(d.res, d.dest, d.tmp, "close-failure", "close failure");
    assert.equal(lines.filter((l) => l.includes("clotho_weave_trailer")).length, 0, "no trailer written");
  } finally { cleanup(d.fx); }
}

// ---- 7. D19/AM-20 coverage-divergence refusals -------------------------------
{
  const cases = [
    ["wrong id order", "coverage-divergence", (c) => { const t = c.weavers[0]; c.weavers[0] = c.weavers[1]; c.weavers[1] = t; return c; }],
    ["a ref missing from a committed list", "coverage-divergence", (c) => { c.weavers[0].implementation_refs = c.weavers[0].implementation_refs.slice(1); return c; }],
    ["an extra ref", "coverage-divergence", (c) => { c.weavers[0].implementation_refs = [...c.weavers[0].implementation_refs, `file:clotho/x.mjs@${B("31")}`]; return c; }],
    ["wrong inspected_source_counts id", "coverage-divergence", (c) => { c.weavers[0].inspected_source_counts[0].inventory_id = "package-fakes"; return c; }],
    ["missing contract-files entry (ledger)", "coverage-divergence", (c) => {
      const lw = c.weavers.find((w) => w.id === LEDGER_ID);
      lw.inspected_source_counts = lw.inspected_source_counts.filter((e) => e.inventory_id !== "contract-files");
      return c;
    }],
    ["duplicate contract-files entry (ledger)", "coverage-divergence", (c) => {
      const lw = c.weavers.find((w) => w.id === LEDGER_ID);
      lw.inspected_source_counts = [{ inventory_id: "contract-files", count: 1 }, ...lw.inspected_source_counts];
      return c;
    }],
    ["extra counts entry (ledger)", "coverage-divergence", (c) => {
      const lw = c.weavers.find((w) => w.id === LEDGER_ID);
      lw.inspected_source_counts = [...lw.inspected_source_counts, { inventory_id: "zz-extra", count: 0 }];
      return c;
    }],
    ["orchestrator ref missing", "coverage-divergence", (c) => { c.orchestrator_refs = c.orchestrator_refs.slice(1); return c; }],
    ["inventories_consumed tampered", "coverage-divergence", (c) => { c.inventories_consumed = []; return c; }],
    // behavior 3: a recorded/assembled count differing from the configured
    // cardinality refuses closure with source-count-mismatch — proven for a
    // plain weaver AND for contract-files (D31).
    ["git count != cardinality", "source-count-mismatch", (c) => { c.weavers[0].inspected_source_counts[0].count = 99; return c; }],
    ["contract-files count != cardinality", "source-count-mismatch", (c) => {
      const lw = c.weavers.find((w) => w.id === LEDGER_ID);
      lw.inspected_source_counts.find((e) => e.inventory_id === "contract-files").count = 2;
      return c;
    }]
  ];
  for (const [label, code, mutate] of cases) {
    const d = await drive({ options: { mutateCoverage: mutate } });
    try { assertAborted(d.res, d.dest, d.tmp, code, `coverage divergence: ${label}`); }
    finally { cleanup(d.fx); }
  }
}

// ---- 8. D33/AM-34 tampered-inventory closure failure -------------------------
// An inventory copy omitting a helper reached ONLY through an accepted
// require-style form / a re-export / a literal dynamic import fails closure
// equality — nothing is closed or published.
{
  const tampered = [
    ["require-style helper omitted", (inv) => { inv.implFiles = { ...inv.implFiles, [GIT_ID]: ["clotho/weavers/git.mjs"] }; }],
    ["re-export helper omitted", (inv) => { inv.implFiles = { ...inv.implFiles, [CODE_ID]: ["clotho/weavers/code.mjs"] }; }],
    ["dynamic-import orchestrator helper omitted", (inv) => { inv.orchestratorFiles = ["clotho/thread-ledger.mjs", "clotho/weave.mjs"]; }],
    ["extra orchestrator file", (inv) => { inv.orchestratorFiles = [...inv.orchestratorFiles, "clotho/weavers/test.mjs"].sort(); }]
  ];
  for (const [label, tamper] of tampered) {
    const inv = mkInventories();
    tamper(inv);
    const d = await drive({ options: { inventories: inv } });
    try { assertAborted(d.res, d.dest, d.tmp, "inventory-closure-mismatch", `tampered inventory: ${label}`); }
    finally { cleanup(d.fx); }
  }
}

// ---- 9. D34/AM-38 publication-time drift -------------------------------------
{
  // (a) an on-disk source gains a NEW closure edge after the initial validation
  // but before publication -> pre-publication re-derivation fails with the
  // stable drift code; nothing closed, nothing published, temp removed.
  const d = await drive({
    options: {
      beforeRederivation: ({ repoRoot }) => {
        writeFileSync(path.join(repoRoot, "clotho", "weavers", "doc-extra.mjs"), "export const x = 1;\n");
        appendFileSync(path.join(repoRoot, "clotho", "weavers", "doc.mjs"), 'export * from "./doc-extra.mjs";\n');
      }
    }
  });
  try { assertAborted(d.res, d.dest, d.tmp, "publication-time-drift", "new closure edge drifts"); }
  finally { cleanup(d.fx); }
}
{
  // (b) an on-disk byte change that leaves the closure IDENTICAL but invalidates
  // a computed implementation_refs hash -> the pre-publication hash recheck aborts.
  const d = await drive({
    options: {
      beforeRederivation: ({ repoRoot }) => {
        writeFileSync(path.join(repoRoot, "clotho", "weavers", "test.mjs"), "export const t = 2;\n");
      }
    }
  });
  try { assertAborted(d.res, d.dest, d.tmp, "publication-time-drift", "hash recheck drifts"); }
  finally { cleanup(d.fx); }
}
{
  // (c) an orchestrator byte change is likewise caught by the hash recheck.
  const d = await drive({
    options: {
      beforeRederivation: ({ repoRoot }) => {
        writeFileSync(path.join(repoRoot, "clotho", "thread-ledger.mjs"), "export const tl = 2;\n");
      }
    }
  });
  try { assertAborted(d.res, d.dest, d.tmp, "publication-time-drift", "orchestrator hash recheck drifts"); }
  finally { cleanup(d.fx); }
}

// ---- 10. D10/AM-39 attribution violations ------------------------------------
// Each violation is rejected with the stable attribution code BEFORE any of that
// result's edges reach appendEdge (proven: only the header line was written).
{
  const violations = [
    ["edge asserted by a DIFFERENT weaver id", () => ({ edges: [edgeFor(DOC_ID, "31")], warnings: [] })],
    ["edge asserted by human", () => {
      const e = edgeFor(GIT_ID, "32");
      return { edges: [{ ...e, asserted_by: "human" }], warnings: [] };
    }],
    ["edge asserted by model:<seat>", () => {
      const e = edgeFor(GIT_ID, "33");
      return { edges: [{ ...e, asserted_by: "model:claude" }], warnings: [] };
    }],
    ["edge with a non-deterministic assertion_status", () => {
      const e = edgeFor(GIT_ID, "34");
      return { edges: [{ ...e, assertion_status: "human-authorized" }], warnings: [] };
    }],
    ["warning.weaver mismatched", () => ({ edges: [], warnings: [{ weaver: CODE_ID, message: "mislabelled" }] })]
  ];
  for (const [label, make] of violations) {
    const lines = [];
    const d = await drive({
      weaverImpls: { [GIT_ID]: (ctx) => { consumeAll(ctx, GIT_ID); return make(); } },
      options: { openFile: recordingOpenFile(lines) }
    });
    try {
      assertAborted(d.res, d.dest, d.tmp, "attribution-violation", `attribution: ${label}`);
      assert.equal(d.res.error.weaver, GIT_ID, "the invoked weaver is reported");
      assert.equal(lines.length, 1, `attribution: ${label} — no edge reached appendEdge (header only)`);
    } finally { cleanup(d.fx); }
  }
}

// ---- 11. consumption-completeness behaviors 1, 2, 8 (D26/D29/D31) ------------
{
  // behavior 1: under-consumption — a weaver ignores one handed source.
  const lines = [];
  const d = await drive({
    weaverImpls: {
      [GIT_ID]: (ctx) => {
        for (const s of ctx.sources["package-symbols"]) void s; // ignores package-files
        return { edges: [edgeFor(GIT_ID, "21")], warnings: [] };
      }
    },
    options: { openFile: recordingOpenFile(lines) }
  });
  try {
    assertAborted(d.res, d.dest, d.tmp, "incomplete-source-consumption", "under-consumption");
    assert.equal(lines.length, 1, "behavior 8: the incomplete weaver's edges never reach appendEdge");
  } finally { cleanup(d.fx); }
}
{
  // behavior 1 (ledger variant): the ledger weaver under-consumes contract-files
  // -> no edge append, no close, no publication.
  const lines = [];
  const d = await drive({
    weaverImpls: {
      [LEDGER_ID]: (ctx) => {
        for (const s of ctx.sources["ledger-sources"]) void s;
        for (const s of ctx.sources["run-sources"]) void s; // contract-files untouched
        return { edges: [edgeFor(LEDGER_ID, "25")], warnings: [] };
      }
    },
    options: { openFile: recordingOpenFile(lines) }
  });
  try {
    assertAborted(d.res, d.dest, d.tmp, "incomplete-source-consumption", "ledger under-consumes contract-files");
    assert.equal(lines.length, 1, "no edge appended for the incomplete ledger weaver");
  } finally { cleanup(d.fx); }
}
{
  // behavior 2: early return — part of an iterator consumed, then return.
  const lists = mkLists();
  lists["package-files"] = [{ path: "clotho/x.mjs", blob_sha: B("11") }, { path: "clotho/y.mjs", blob_sha: B("18") }];
  const d = await drive({
    weaverImpls: {
      [GIT_ID]: (ctx) => {
        for (const s of ctx.sources["package-symbols"]) void s;
        for (const s of ctx.sources["package-files"]) { void s; break; } // early return mid-iterator
        return { edges: [], warnings: [] };
      }
    },
    options: { sourceLists: lists }
  });
  try { assertAborted(d.res, d.dest, d.tmp, "incomplete-source-consumption", "early return"); }
  finally { cleanup(d.fx); }
}

// ---- 12. behavior 6: skipped iterator construction is a driver contradiction --
{
  const d = await drive({ options: { skip: [GIT_ID], constructIteratorsForSkipped: true } });
  try {
    assertAborted(d.res, d.dest, d.tmp, "unexpected-source-consumption", "iterator constructed for a skipped weaver (zero count)");
    assert.equal(d.res.error.weaver, GIT_ID);
  } finally { cleanup(d.fx); }
}
{
  // ledger variant: a contract-files iterator constructed for a skipped ledger
  // weaver is the same contradiction.
  const d = await drive({ options: { skip: [LEDGER_ID], constructIteratorsForSkipped: true } });
  try {
    assertAborted(d.res, d.dest, d.tmp, "unexpected-source-consumption", "contract-files iterator constructed for a skipped ledger weaver");
    assert.equal(d.res.error.weaver, LEDGER_ID);
  } finally { cleanup(d.fx); }
}

// ---- 13. behavior 7: independently signed skipped-nonzero manifest fails -----
{
  const root = mkdtempSync(path.join(tmpdir(), "clotho-weave-sig-"));
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pubB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const woven_at = new Date(WOVEN_AT).toISOString();
    const header = canonicalJson({ clotho_weave_header: { pub_key: pubB64, woven_at, repo_head: HEAD, repository_ref: REPO, weave_version: 1 } });
    const coverage = {
      weavers: WEAVERS.map((w) => ({
        id: w.id, version: w.version,
        implementation_refs: [`file:clotho/weavers/x.mjs@${B("41")}`],
        state: w.id === DOC_ID ? "skipped" : "executed",
        inspected_source_counts: [...REQUIRED_INVENTORY_IDS[w.id]].sort().map((invId) => ({
          inventory_id: invId,
          count: w.id === DOC_ID ? 3 : 0 // skipped weaver asserting NONZERO counts
        }))
      })),
      orchestrator_refs: [`file:clotho/weave.mjs@${B("42")}`],
      inventories_consumed: []
    };
    const payload = { clotho_weave_trailer: coverage, woven_at };
    const prev_hash = sha256hex(header);
    const record_hash = sha256hex(canonicalJson({ ...payload, prev_hash }));
    const signature = edSign(null, Buffer.from(record_hash, "hex"), privateKey).toString("base64");
    const trailer = canonicalJson({ ...payload, prev_hash, record_hash, signature });
    const file = path.join(root, "skipped-nonzero.jsonl");
    writeFileSync(file, header + "\n" + trailer + "\n");
    const v = await verifyLedger(file);
    assert.equal(v.ok, false, "an independently signed skipped-nonzero manifest fails verification");
    assert.equal(v.manifest, null, "no manifest trust is conferred");
    assert.ok(v.errors.some((e) => /zero counts/.test(e)), `zero-counts invariant named: ${v.errors.join("; ")}`);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 14. behavior 9: doc-skipped, ledger-executed clause resolution (D31) ----
// The REAL ledger weaver runs under the driver with the doc weaver skipped: the
// exact clause edge resolves from INDEPENDENTLY consumed contract-files, and the
// manifest reports doc counts zero with the FULL contract-files count under the
// ledger weaver.
{
  const fx = mkFixture();
  const { weave: realLedgerWeave } = await import("../weavers/ledger.mjs");
  const { res, dest } = await drive({
    weaverImpls: { [LEDGER_ID]: realLedgerWeave },
    options: { skip: [DOC_ID] }
  }, { fixture: fx });
  try {
    assert.equal(res.ok, true, `doc-skipped real-ledger run ok: ${JSON.stringify(res.error)}`);
    const v = await verifyLedger(dest);
    assert.equal(v.ok, true);
    const clauseEdges = v.records.filter((e) => e.edge_kind === "discharges" && e.to_locator && e.to_locator.kind === "contract-clause");
    assert.equal(clauseEdges.length, 1, "exactly one obligation -> contract-clause edge");
    assert.deepEqual(clauseEdges[0].to_locator.locator.heading_path, fx.clause.heading_path);
    assert.equal(clauseEdges[0].to_locator.locator.text_sha256, fx.clause.text_sha256, "the EXACT clause bytes are addressed");
    assert.equal(clauseEdges[0].from_locator.locator.entry_hash, fx.obligationHash);
    const docW = v.manifest.weavers.find((w) => w.id === DOC_ID);
    assert.equal(docW.state, "skipped");
    for (const c of docW.inspected_source_counts) assert.equal(c.count, 0, "doc-weaver counts are zero");
    const ledW = v.manifest.weavers.find((w) => w.id === LEDGER_ID);
    assert.equal(ledW.state, "executed");
    assert.equal(ledW.inspected_source_counts.find((c) => c.inventory_id === "contract-files").count, 1,
      "the FULL contract-files count is reported under the ledger weaver");
  } finally { cleanup(fx); }
}

// ---- 15. count-shaped weaver result fields abort -----------------------------
{
  const d = await drive({
    weaverImpls: { [TEST_ID]: (ctx) => { consumeAll(ctx, TEST_ID); return { edges: [], warnings: [], count: 2 }; } }
  });
  try {
    assertAborted(d.res, d.dest, d.tmp, "count-shaped-field", "count-shaped field in a weaver result");
    assert.equal(d.res.error.weaver, TEST_ID);
  } finally { cleanup(d.fx); }
}
{
  const d = await drive({
    weaverImpls: { [TEST_ID]: (ctx) => { consumeAll(ctx, TEST_ID); return { edges: [], warnings: [], inspected_source_counts: [] }; } }
  });
  try { assertAborted(d.res, d.dest, d.tmp, "count-shaped-field", "inspected_source_counts in a weaver result"); }
  finally { cleanup(d.fx); }
}
{
  // any OTHER extra field is likewise a contract violation (fail closed).
  const d = await drive({
    weaverImpls: { [TEST_ID]: (ctx) => { consumeAll(ctx, TEST_ID); return { edges: [], warnings: [], extra: true }; } }
  });
  try { assertAborted(d.res, d.dest, d.tmp, "invalid-weaver-result", "unexpected non-count field in a weaver result"); }
  finally { cleanup(d.fx); }
}

// ---- 16. D20 publication race: EEXIST preserves the destination --------------
{
  const SENTINEL = "PRE-EXISTING DESTINATION BYTES\n";
  const d = await drive({
    options: {
      beforePublication: ({ destAbs }) => { writeFileSync(destAbs, SENTINEL); }
    }
  });
  try {
    assert.equal(d.res.ok, false);
    assert.equal(d.res.publication, "not-published");
    assert.equal(d.res.error.code, "destination-exists", "linkSync EEXIST is failure, never replacement");
    assert.equal(exists(d.tmp), false, "temporary file removed");
    assert.equal(readFileSync(d.dest, "utf8"), SENTINEL, "pre-existing destination preserved BYTE-IDENTICALLY");
  } finally { cleanup(d.fx); }
}

// ---- 17. D28 injected unlink failure: published-cleanup-incomplete -----------
{
  const d = await drive({
    options: { fsOps: { unlinkSync: () => { throw new Error("injected unlink failure"); } } }
  });
  try {
    assert.equal(d.res.publication, "published-cleanup-incomplete", "the distinct third publication state");
    assert.equal(d.res.ok, false, "cleanup-incomplete is not clean success");
    assert.equal(exitCodeForResult(d.res), 3, "distinct nonzero cleanup status (not 0, not 1)");
    assert.equal(exists(d.dest), true, "the destination IS published (linkSync was the commit point)");
    assert.equal(exists(d.tmp), true, "the leftover temporary file remains (never force-removed)");
    assert.equal(readFileSync(d.dest, "utf8"), readFileSync(d.tmp, "utf8"), "destination byte-identical, never disturbed");
    assert.equal(d.res.leftover_temp, OUT + ".tmp", "the leftover temporary path is named");
    assert.ok(d.res.warnings.some((w) => w.code === "published-cleanup-incomplete" && w.path === OUT + ".tmp"),
      "a stable warning names the leftover temporary path");
    const v = await verifyLedger(d.dest);
    assert.equal(v.ok, true, "the published destination verifies");
  } finally { cleanup(d.fx); }
}

// ---- 18. D21 symlink escapes (junctions must RUN, never skip) ----------------
{
  // (a) the allowed root (.telos) replaced by a symlink out of the repository
  const fx = mkFixture();
  const outside = mkdtempSync(path.join(tmpdir(), "clotho-weave-outside-"));
  try {
    symlinkSync(outside, path.join(fx.root, ".telos"), "junction");
    const { res } = await drive({}, { fixture: fx });
    assert.equal(res.error.code, "containment-violation", "symlinked allowed root fails with the stable containment error");
    assert.equal(res.publication, "not-published");
    assert.deepEqual(readdirSync(outside), [], "nothing written outside the repository's real path");
  } finally { cleanup(fx); rmSync(outside, { recursive: true, force: true }); }
}
{
  // (b) a NESTED parent component (.telos/clotho) replaced by a symlink
  const fx = mkFixture();
  const outside = mkdtempSync(path.join(tmpdir(), "clotho-weave-outside2-"));
  try {
    mkdirSync(path.join(fx.root, ".telos"), { recursive: true });
    symlinkSync(outside, path.join(fx.root, ".telos", "clotho"), "junction");
    const { res } = await drive({}, { fixture: fx });
    assert.equal(res.error.code, "containment-violation", "symlinked nested parent fails with the stable containment error");
    assert.deepEqual(readdirSync(outside), [], "nothing written outside the repository's real path");
  } finally { cleanup(fx); rmSync(outside, { recursive: true, force: true }); }
}
{
  // (c) a chain mutated BETWEEN validation and publication also fails closed:
  // the containment check is repeated immediately before publication.
  const fx = mkFixture();
  const outside = mkdtempSync(path.join(tmpdir(), "clotho-weave-outside3-"));
  try {
    const { res, dest } = await drive({
      options: {
        beforePublication: ({ repoRoot }) => {
          renameSync(path.join(repoRoot, ".telos", "clotho"), path.join(repoRoot, ".telos", "clotho-moved"));
          symlinkSync(outside, path.join(repoRoot, ".telos", "clotho"), "junction");
        }
      }
    }, { fixture: fx });
    assert.equal(res.error.code, "containment-violation", "pre-publication containment recheck fails closed");
    assert.equal(res.publication, "not-published");
    assert.deepEqual(readdirSync(outside), [], "nothing written outside the repository's real path");
    assert.equal(exists(dest), false, "no destination published through the mutated chain");
  } finally { cleanup(fx); rmSync(outside, { recursive: true, force: true }); }
}

console.log("test-weave: all assertions passed");
