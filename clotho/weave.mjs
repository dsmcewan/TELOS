#!/usr/bin/env node
// weave.mjs — Clotho's complete-weave driver (plan v15 Task 5). Zero dependencies:
// Node stdlib only. Guarded orchestration: importing this module has no side
// effects; the CLI runs only when this file is the invoked entry point (the Node
// shebang is legal here per the AM-41 carve-out — one leading shebang line is
// in-profile).
//
// The driver owns everything the weavers must not: argument validation, physical
// containment (D21), the one timestamp/repo-head/repository_ref capture, the
// committed-inventory closure validation (D33) and publication-time re-derivation
// + hash recheck (D34/AM-38), driver-owned counted sources with the D26/D29
// completeness gate, the D10/AM-39 producer==attribution append gate, the
// D19/AM-20 inventory-equality proof at close, and D20/D28 atomic no-replace
// publication via exclusive linkSync with the frozen commit point. Fail-closed
// throughout: any weaver failure, fatal warning (D22), accounting, attribution,
// coverage, drift, containment, verification, or publication failure aborts the
// ledger handle, removes the temporary file, never publishes, and exits nonzero.
// No partial advisory artifact ever exists.

import { linkSync as fsLinkSync, unlinkSync as fsUnlinkSync, lstatSync, statSync, mkdirSync, realpathSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { canonicalJson, deriveRepositoryRef } from "./registry.mjs";
import { createLedger, verifyLedger } from "./thread-ledger.mjs";
import {
  makeCountedSource, physicalContainment, deriveAcceptedClosure, walkFiles,
  seedSourceDescriptors, makeGitRunner, isCanonicalRepoRelPosix
} from "./weavers/util.mjs";
import { weave as gitWeave } from "./weavers/git.mjs";
import { weave as codeWeave } from "./weavers/code.mjs";
import { weave as testWeave } from "./weavers/test.mjs";
import { weave as docWeave } from "./weavers/doc.mjs";
import { weave as ledgerWeave } from "./weavers/ledger.mjs";
import {
  PACKAGE_ROOTS, DOC_ROOTS, DOC_WEAVER_EXCLUDE, GLOBAL_EXCLUDE, CONTRACT_FILES,
  LEDGER_SOURCES, RUN_SOURCES, WEAVERS, REQUIRED_INVENTORY_IDS, WEAVER_IMPL_FILES,
  WEAVER_ENTRY_MODULE, ORCHESTRATOR_FILES, ORCHESTRATOR_ENTRY_MODULES,
  PERMITTED_EXTERNAL_CLOSURE_FILES, FATAL_WARNING_CODES
} from "./inventory.mjs";

const HEX40 = /^[0-9a-f]{40}$/;

// The five real weaver implementations, keyed by inventory id (stable order is
// WEAVERS from inventory.mjs). Tests may inject fixture implementations per id.
const REAL_WEAVER_IMPLS = Object.freeze({
  "clotho-git-weaver": gitWeave,
  "clotho-code-weaver": codeWeave,
  "clotho-test-weaver": testWeave,
  "clotho-doc-weaver": docWeave,
  "clotho-ledger-weaver": ledgerWeave
});

// Stable driver error codes (machine-visible; every failure reports exactly one).
export const DRIVER_ERROR_CODES = Object.freeze([
  "append-failure",
  "attribution-violation",
  "close-failure",
  "containment-violation",
  "count-shaped-field",
  "coverage-divergence",
  "destination-exists",
  "driver-failure",
  "fatal-warning",
  "incomplete-source-consumption",
  "inventory-closure-mismatch",
  "invalid-arguments",
  "invalid-weaver-result",
  "ledger-open-failure",
  "publication-failure",
  "publication-time-drift",
  "source-count-mismatch",
  "unexpected-source-consumption",
  "verification-failure",
  "weaver-failure"
]);

// The three machine-visible D28 publication states.
export const PUBLICATION_STATES = Object.freeze([
  "not-published", "published", "published-cleanup-incomplete"
]);

// ---- small helpers -----------------------------------------------------------

class DriverError extends Error {
  constructor(code, detail, weaver = null) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
    this.weaver = weaver;
  }
}

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

// Field names that carry counts/totals: a weaver result may never contain one
// (D26 — counts are driver-owned; weaver-returned counts are a contract
// violation and abort the weave).
const COUNT_SHAPED = /count|total|cardinal|observed|inspected/i;

function absOf(repoRoot, rel) {
  return path.join(repoRoot, ...rel.split("/"));
}

function gitBlobSha(git, rel) {
  const raw = git(["hash-object", "--no-filters", "--", rel]);
  const sha = typeof raw === "string" ? raw.replace(/\r?\n$/, "") : "";
  if (!HEX40.test(sha)) throw new DriverError("invalid-arguments", `bad blob sha for ${rel}: ${JSON.stringify(sha)}`);
  return sha;
}

function fileRef(rel, sha) {
  return `file:${rel}@${sha}`;
}

const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Canonical edge sort: (edge_kind, from_node, to_node, source_ref, asserted_by,
// assertion_status) — the frozen result ordering.
function edgeSortKeyCmp(a, b) {
  return cmpStr(a.edge_kind, b.edge_kind) || cmpStr(a.from_node, b.from_node) ||
    cmpStr(a.to_node, b.to_node) || cmpStr(a.source_ref, b.source_ref) ||
    cmpStr(a.asserted_by, b.asserted_by) || cmpStr(a.assertion_status, b.assertion_status);
}

// Canonical warning sort: (weaver, code, path, detail) with absent fields as ""
// (legacy {weaver, message} warnings sort by message last).
function warningSortKeyCmp(a, b) {
  const f = (w, k) => (typeof w[k] === "string" ? w[k] : "");
  return cmpStr(f(a, "weaver"), f(b, "weaver")) || cmpStr(f(a, "code"), f(b, "code")) ||
    cmpStr(f(a, "path"), f(b, "path")) || cmpStr(f(a, "detail"), f(b, "detail")) ||
    cmpStr(f(a, "message"), f(b, "message"));
}

// ---- argument validation (--skip / --out) ------------------------------------

const OUT_ALLOWED_PREFIXES = Object.freeze([".telos/clotho/", "docs/runs/clotho-self-weave/"]);

export function validateSkip(skipList, weaverIds) {
  const seen = new Set();
  for (const id of skipList) {
    if (!weaverIds.includes(id)) throw new DriverError("invalid-arguments", `--skip: unknown weaver id ${JSON.stringify(id)}`);
    if (seen.has(id)) throw new DriverError("invalid-arguments", `--skip: duplicate weaver id ${JSON.stringify(id)}`);
    seen.add(id);
  }
  return seen;
}

export function validateOut(outRel) {
  if (!isCanonicalRepoRelPosix(outRel)) {
    throw new DriverError("invalid-arguments", `--out: not a canonical repository-relative POSIX path: ${JSON.stringify(outRel)}`);
  }
  if (!OUT_ALLOWED_PREFIXES.some((p) => outRel.startsWith(p))) {
    throw new DriverError("invalid-arguments", `--out: must be below ${OUT_ALLOWED_PREFIXES.join(" or ")}, got ${JSON.stringify(outRel)}`);
  }
  return outRel;
}

// ---- committed-inventory closure validation (D33) + D34 re-derivation --------
// ONE function serves both the initial validation and the publication-time
// re-derivation — same shared classifier/resolver (deriveAcceptedClosure), same
// exact set-and-order comparison; only the stable failure code differs.

function deriveUnionClosure(repoRoot, entryRels, allowExternal) {
  const union = new Set();
  for (const rel of entryRels) {
    for (const member of deriveAcceptedClosure(absOf(repoRoot, rel), { repoRoot, allowExternal })) union.add(member);
  }
  return [...union].sort();
}

function checkClosureEquality(repoRoot, inv, code) {
  const allowExternal = new Set(inv.permittedExternal);
  for (const w of inv.weavers) {
    const committed = inv.implFiles[w.id];
    if (!Array.isArray(committed) || committed.length === 0) {
      throw new DriverError(code, `no committed implementation-file inventory for ${w.id}`);
    }
    let derived;
    try { derived = deriveAcceptedClosure(absOf(repoRoot, inv.entryModule[w.id]), { repoRoot, allowExternal }); }
    catch (e) { throw new DriverError(code, `${w.id} closure derivation failed: ${e.message}`); }
    if (committed.length !== derived.length || committed.some((f, i) => f !== derived[i])) {
      throw new DriverError(code, `${w.id} committed inventory != derived closure (committed ${JSON.stringify(committed)}, derived ${JSON.stringify(derived)})`);
    }
  }
  let orchDerived;
  try { orchDerived = deriveUnionClosure(repoRoot, inv.orchestratorEntries, allowExternal); }
  catch (e) { throw new DriverError(code, `orchestrator closure derivation failed: ${e.message}`); }
  const committedOrch = inv.orchestratorFiles;
  if (committedOrch.length !== orchDerived.length || committedOrch.some((f, i) => f !== orchDerived[i])) {
    throw new DriverError(code, `orchestrator committed inventory != derived closure (committed ${JSON.stringify(committedOrch)}, derived ${JSON.stringify(orchDerived)})`);
  }
}

// Re-check every content address in the computed refs against freshly hashed
// on-disk bytes, and the repository_ref against a fresh derivation (D34).
function recheckHashes(git, refsByFile, repositoryRef, code) {
  for (const [rel, sha] of refsByFile) {
    let fresh;
    try { fresh = gitBlobSha(git, rel); } catch (e) { throw new DriverError(code, `re-hash of ${rel} failed: ${e.detail || e.message}`); }
    if (fresh !== sha) throw new DriverError(code, `content address of ${rel} drifted (recorded ${sha}, fresh ${fresh})`);
  }
  let freshRef;
  try { freshRef = deriveRepositoryRef(git); } catch (e) { throw new DriverError(code, `repository_ref re-derivation failed: ${e.message}`); }
  if (freshRef !== repositoryRef) throw new DriverError(code, `repository_ref drifted (recorded ${repositoryRef}, fresh ${freshRef})`);
}

// ---- weaver result checks (D26/D29 accounting + D10/AM-39 attribution) -------

function checkWeaverResultShape(id, result) {
  if (!isPlainObject(result)) throw new DriverError("invalid-weaver-result", "weaver result must be a plain {edges, warnings} object", id);
  for (const k of Object.keys(result)) {
    if (k === "edges" || k === "warnings") continue;
    if (COUNT_SHAPED.test(k)) throw new DriverError("count-shaped-field", `weaver result carries count-shaped field ${JSON.stringify(k)}`, id);
    throw new DriverError("invalid-weaver-result", `weaver result carries unexpected field ${JSON.stringify(k)}`, id);
  }
  if (!Array.isArray(result.edges) || !Array.isArray(result.warnings)) {
    throw new DriverError("invalid-weaver-result", "weaver result edges/warnings must be arrays", id);
  }
}

function checkAccounting(id, accountings) {
  for (const acc of accountings) {
    const a = acc();
    if (!a.exhausted || a.observed_count < a.expected_cardinality) {
      throw new DriverError("incomplete-source-consumption",
        `${id} did not fully consume ${a.inventory_id} (observed ${a.observed_count} of ${a.expected_cardinality}, exhausted ${a.exhausted})`, id);
    }
    if (a.observed_count !== a.expected_cardinality) {
      throw new DriverError("source-count-mismatch",
        `${id} observed ${a.observed_count} for ${a.inventory_id}, expected ${a.expected_cardinality}`, id);
    }
  }
}

function checkAttribution(id, result) {
  for (const edge of result.edges) {
    if (!isPlainObject(edge)) throw new DriverError("attribution-violation", `${id} returned a non-object edge`, id);
    if (edge.asserted_by !== id) {
      throw new DriverError("attribution-violation", `${id} returned an edge asserted_by ${JSON.stringify(edge.asserted_by)}`, id);
    }
    if (edge.assertion_status !== "deterministic-extraction") {
      throw new DriverError("attribution-violation", `${id} returned an edge with assertion_status ${JSON.stringify(edge.assertion_status)}`, id);
    }
  }
  for (const w of result.warnings) {
    if (!isPlainObject(w) || w.weaver !== id) {
      throw new DriverError("attribution-violation", `${id} returned a warning attributed to ${JSON.stringify(isPlainObject(w) ? w.weaver : w)}`, id);
    }
  }
}

function checkFatalWarnings(id, result, fatalCodes) {
  for (const w of result.warnings) {
    if (typeof w.code === "string" && fatalCodes.has(w.code)) {
      throw new DriverError("fatal-warning", `${id} raised fatal warning ${w.code}`, id);
    }
  }
}

// ---- coverage construction + D19/AM-20 close-time equality -------------------

function buildCoverage(inv, states, countsById, implRefsById, orchestratorRefs, inventoriesConsumed) {
  return {
    weavers: inv.weavers.map((w) => ({
      id: w.id,
      version: w.version,
      implementation_refs: [...implRefsById[w.id]],
      state: states[w.id],
      inspected_source_counts: [...inv.requiredIds[w.id]].sort().map((invId) => ({
        inventory_id: invId, count: countsById[w.id][invId]
      }))
    })),
    orchestrator_refs: [...orchestratorRefs],
    inventories_consumed: inventoriesConsumed.map((e) => ({ id: e.id, source_ref: e.source_ref }))
  };
}

// Validate the exact coverage object that will be handed to close() against the
// COMMITTED inventories and the driver-observed cardinalities. The coverage is
// re-checked as data (never trusted to be what the driver just built), so a
// divergent object — however produced — refuses closure.
function checkCoverageEquality(coverage, inv, states, expectedCounts, implRefsById, orchestratorRefs, inventoriesConsumed) {
  const div = (d) => { throw new DriverError("coverage-divergence", d); };
  if (!isPlainObject(coverage) || !Array.isArray(coverage.weavers)) div("coverage must carry a weavers array");
  if (coverage.weavers.length !== inv.weavers.length) div(`coverage carries ${coverage.weavers.length} weavers, committed inventory has ${inv.weavers.length}`);
  for (let i = 0; i < inv.weavers.length; i++) {
    const committed = inv.weavers[i];
    const w = coverage.weavers[i];
    if (!isPlainObject(w)) div(`coverage weaver[${i}] is not an object`);
    if (w.id !== committed.id) div(`coverage weaver[${i}] id ${JSON.stringify(w.id)} != committed inventory order id ${committed.id}`);
    if (w.version !== committed.version) div(`coverage weaver[${w.id}] version ${JSON.stringify(w.version)} != committed ${committed.version}`);
    if (w.state !== states[committed.id]) div(`coverage weaver[${w.id}] state ${JSON.stringify(w.state)} != driver-recorded ${states[committed.id]}`);
    const refs = implRefsById[committed.id];
    if (!Array.isArray(w.implementation_refs) || w.implementation_refs.length !== refs.length ||
        w.implementation_refs.some((r, k) => r !== refs[k])) {
      div(`coverage weaver[${w.id}] implementation_refs != refs computed from the committed inventory`);
    }
    const requiredSorted = [...inv.requiredIds[committed.id]].sort();
    const counts = w.inspected_source_counts;
    if (!Array.isArray(counts)) div(`coverage weaver[${w.id}] inspected_source_counts is not an array`);
    const ids = counts.map((c) => (isPlainObject(c) ? c.inventory_id : undefined));
    if (ids.length !== requiredSorted.length || ids.some((cid, k) => cid !== requiredSorted[k])) {
      div(`coverage weaver[${w.id}] inspected_source_counts ids [${ids.join(", ")}] != required [${requiredSorted.join(", ")}]`);
    }
    for (const c of counts) {
      const expected = expectedCounts[committed.id][c.inventory_id];
      if (c.count !== expected) {
        throw new DriverError("source-count-mismatch",
          `coverage weaver[${w.id}] records ${c.inventory_id}=${c.count}, driver observed cardinality ${expected}`, committed.id);
      }
    }
  }
  if (!Array.isArray(coverage.orchestrator_refs) || coverage.orchestrator_refs.length !== orchestratorRefs.length ||
      coverage.orchestrator_refs.some((r, k) => r !== orchestratorRefs[k])) {
    div("coverage orchestrator_refs != refs computed from the committed orchestrator inventory");
  }
  if (!Array.isArray(coverage.inventories_consumed) || coverage.inventories_consumed.length !== inventoriesConsumed.length ||
      coverage.inventories_consumed.some((e, k) => !isPlainObject(e) || e.id !== inventoriesConsumed[k].id || e.source_ref !== inventoriesConsumed[k].source_ref)) {
    div("coverage inventories_consumed != content-addressed inventory actually read");
  }
}

// ---- default real-repository source lists ------------------------------------
// GLOBAL_EXCLUDE (D8 self-weave exclusion) is applied to every walk/list.

function excluded(rel) {
  return GLOBAL_EXCLUDE.some((x) => rel === x || rel.startsWith(x + "/"));
}

const CMD_MJS_TOKEN = /(?<![^\s"'=([:])([^\s"'()]+\.mjs)\b/g;

function defaultSourceLists(repoRoot, git) {
  const seeds = seedSourceDescriptors(repoRoot, PACKAGE_ROOTS, git);
  const files = seeds.files.filter((f) => !excluded(f.path));
  const symbols = seeds.symbols.filter((s) => !excluded(s.path));
  const blobOf = new Map(files.map((f) => [f.path, f.blob_sha]));

  const manifests = files.filter((f) => f.path.split("/").pop() === "package.json");
  const testPaths = new Set();
  for (const root of PACKAGE_ROOTS) {
    const prefix = `${root}/scripts/test-`;
    for (const f of files) if (f.path.startsWith(prefix) && f.path.endsWith(".mjs") && !f.path.slice(prefix.length).includes("/")) testPaths.add(f.path);
  }
  // Literal .mjs paths referenced by each package check/test command (text only;
  // nothing is executed) that resolve to a seeded file inside that package root.
  for (const pm of manifests) {
    let pkg = null;
    try { pkg = JSON.parse(readFileSync(absOf(repoRoot, pm.path), "utf8")); } catch { pkg = null; }
    const scripts = pkg && typeof pkg === "object" ? pkg.scripts : null;
    const cmds = scripts && typeof scripts === "object" ? [scripts.check, scripts.test].filter((c) => typeof c === "string") : [];
    const pkgRoot = pm.path.includes("/") ? pm.path.slice(0, pm.path.lastIndexOf("/")) : "";
    for (const cmd of cmds) {
      const re = new RegExp(CMD_MJS_TOKEN.source, "g");
      let m;
      while ((m = re.exec(cmd)) !== null) {
        const ref = m[1];
        if (ref.startsWith("/") || ref.includes("\\") || ref.split("/").some((s) => s === "." || s === "..")) continue;
        const target = pkgRoot ? `${pkgRoot}/${ref}` : ref;
        if (blobOf.has(target)) testPaths.add(target);
      }
    }
  }
  const testFiles = [...testPaths].sort().map((p) => ({ path: p, blob_sha: blobOf.get(p) }));

  const docFiles = walkFiles(repoRoot, DOC_ROOTS)
    .filter((p) => p.endsWith(".md"))
    .filter((p) => !DOC_WEAVER_EXCLUDE.some((x) => p === x || p.startsWith(x + "/")))
    .filter((p) => !excluded(p))
    .map((p) => ({ path: p, blob_sha: gitBlobSha(git, p) }));

  return {
    seeds: { files, symbols, warnings: seeds.warnings },
    lists: {
      "package-symbols": symbols,
      "package-files": files,
      "package-modules": files.filter((f) => f.path.endsWith(".mjs")),
      "package-manifests": manifests,
      "test-files": testFiles,
      "doc-files": docFiles,
      "contract-files": CONTRACT_FILES.filter((p) => !excluded(p)).map((p) => ({ path: p, blob_sha: gitBlobSha(git, p) })),
      "ledger-sources": LEDGER_SOURCES.filter((e) => !excluded(e.path)).map((e) => ({ id: e.id, path: e.path, adapter: e.adapter, blob_sha: gitBlobSha(git, e.path) })),
      "run-sources": RUN_SOURCES.filter((e) => !excluded(e.summary)).map((e) => ({ id: e.id, dir: e.dir, summary: e.summary, blob_sha: gitBlobSha(git, e.summary) }))
    }
  };
}

// ---- the driver --------------------------------------------------------------

export async function runWeave(options = {}) {
  const result = {
    ok: false,
    publication: "not-published",
    out: null,
    edge_count: 0,
    ledger_bytes: 0,
    weavers: [],
    warnings: [],
    fatal_warning_count: 0,
    leftover_temp: null,
    error: null
  };

  const repoRoot = options.repoRoot
    ? path.resolve(options.repoRoot)
    : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

  // Committed inventories (tests may inject fixture inventories; the REAL run
  // uses exactly the frozen inventory.mjs values).
  const inv = {
    weavers: options.inventories?.weavers ?? WEAVERS,
    requiredIds: options.inventories?.requiredIds ?? REQUIRED_INVENTORY_IDS,
    implFiles: options.inventories?.implFiles ?? WEAVER_IMPL_FILES,
    entryModule: options.inventories?.entryModule ?? WEAVER_ENTRY_MODULE,
    orchestratorFiles: options.inventories?.orchestratorFiles ?? ORCHESTRATOR_FILES,
    orchestratorEntries: options.inventories?.orchestratorEntries ?? ORCHESTRATOR_ENTRY_MODULES,
    permittedExternal: options.inventories?.permittedExternal ?? PERMITTED_EXTERNAL_CLOSURE_FILES,
    inventoryPath: options.inventories?.inventoryPath ?? "clotho/inventory.mjs"
  };
  const weaverIds = inv.weavers.map((w) => w.id);
  const weaverImpls = { ...REAL_WEAVER_IMPLS, ...(options.weaverImpls || {}) };
  const fatalCodes = new Set(options.fatalWarningCodes ?? FATAL_WARNING_CODES);
  const linkSyncOp = options.fsOps?.linkSync ?? fsLinkSync;
  const unlinkSyncOp = options.fsOps?.unlinkSync ?? fsUnlinkSync;

  let ledger = null;
  let tmpAbs = null;
  let tmpCreated = false;
  let published = false;

  const removeTemp = () => {
    if (tmpAbs === null || !tmpCreated) return; // only a temp THIS run created
    try { unlinkSyncOp(tmpAbs); } catch { /* removal is best-effort after abort */ }
  };
  const abortRun = (err) => {
    // Uniform abort discipline (D22): idempotent ledger abort (descriptor
    // closed), temporary file removed, destination never published/disturbed.
    if (ledger) { try { ledger.abort(); } catch { /* abort is best-effort idempotent */ } }
    if (!published) removeTemp();
    const code = err instanceof DriverError ? err.code : "driver-failure";
    result.error = { code, detail: err instanceof DriverError ? err.detail : String(err && err.message || err) };
    if (err instanceof DriverError && err.weaver) result.error.weaver = err.weaver;
    result.ok = false;
    return result;
  };

  try {
    // ---- 1. argument validation ---------------------------------------------
    const skip = validateSkip(options.skip ?? [], weaverIds);
    const outRel = validateOut(options.out ?? ".telos/clotho/weave.jsonl");
    const tmpRel = outRel + ".tmp";

    // ---- 2. physical containment BEFORE any write (D21) ---------------------
    if (!physicalContainment(repoRoot, outRel) || !physicalContainment(repoRoot, tmpRel)) {
      throw new DriverError("containment-violation", `destination chain for ${outRel} is not physically contained in the repository`);
    }
    const destAbs = absOf(repoRoot, outRel);
    tmpAbs = absOf(repoRoot, tmpRel);
    let destExists = false;
    try { lstatSync(destAbs); destExists = true; } catch { destExists = false; }
    if (destExists) throw new DriverError("destination-exists", `destination already exists: ${outRel}`);

    // ---- 3. one timestamp + repo head + repository_ref ----------------------
    const git = options.git ?? makeGitRunner(repoRoot);
    const wovenAt = new Date(options.wovenAt ?? Date.now()).toISOString();
    const repoHead = options.repoHead ?? String(git(["rev-parse", "HEAD"])).replace(/\r?\n$/, "");
    const repositoryRef = deriveRepositoryRef(git); // shallow / multi-root is fatal

    // ---- 4. initial committed-inventory closure validation (D33) ------------
    checkClosureEquality(repoRoot, inv, "inventory-closure-mismatch");

    // ---- 5. mechanism content addresses from the COMMITTED lists ------------
    const refsByFile = new Map();
    const shaOf = (rel) => {
      if (!refsByFile.has(rel)) refsByFile.set(rel, gitBlobSha(git, rel));
      return refsByFile.get(rel);
    };
    const implRefsById = {};
    for (const w of inv.weavers) implRefsById[w.id] = inv.implFiles[w.id].map((f) => fileRef(f, shaOf(f)));
    const orchestratorRefs = inv.orchestratorFiles.map((f) => fileRef(f, shaOf(f)));
    const inventoriesConsumed = [{ id: inv.inventoryPath, source_ref: fileRef(inv.inventoryPath, shaOf(inv.inventoryPath)) }];

    // ---- 6. seeds + driver-owned source lists -------------------------------
    let seeds, lists;
    if (options.sourceLists) {
      seeds = { files: options.files ?? [], symbols: options.symbols ?? [], warnings: [] };
      lists = options.sourceLists;
    } else {
      const built = defaultSourceLists(repoRoot, git);
      seeds = built.seeds;
      lists = built.lists;
    }
    for (const w of seeds.warnings) result.warnings.push({ weaver: "driver", path: w.path, message: w.message });

    // ---- 7. open the exclusive sibling temporary ledger ---------------------
    mkdirSync(path.dirname(destAbs), { recursive: true });
    let tmpPreExisting = false;
    try { lstatSync(tmpAbs); tmpPreExisting = true; } catch { tmpPreExisting = false; }
    try {
      ledger = createLedger(tmpAbs, {
        signKey: options.signKey, wovenAt, repoHead, repositoryRef, git,
        ...(options.openFile ? { openFile: options.openFile } : {})
      });
      tmpCreated = true;
    } catch (e) {
      // wx may have created the file before a later header-write failure; a file
      // that exists NOW but not before is this run's to remove. A pre-existing
      // stale temp is NOT ours to delete.
      if (!tmpPreExisting) { try { lstatSync(tmpAbs); tmpCreated = true; } catch { tmpCreated = false; } }
      throw new DriverError("ledger-open-failure", String(e && e.message || e));
    }

    // ---- 8. run non-skipped weavers over driver-owned counted sources -------
    const states = {};
    const countsById = {};
    const expectedCounts = {};
    const constructedForSkipped = [];
    const stagedEdges = [];
    const stagedWarnings = [];

    for (const w of inv.weavers) {
      const id = w.id;
      const requiredSorted = [...inv.requiredIds[id]].sort();
      countsById[id] = {};
      expectedCounts[id] = {};
      if (skip.has(id)) {
        states[id] = "skipped";
        for (const invId of requiredSorted) { countsById[id][invId] = 0; expectedCounts[id][invId] = 0; }
        // A skipped weaver's iterators are NEVER constructed. Constructing one —
        // even at zero count — is a driver contradiction detected below.
        if (options.constructIteratorsForSkipped) {
          for (const invId of requiredSorted) constructedForSkipped.push({ weaver: id, inventory_id: invId, handle: makeCountedSource(invId, lists[invId] ?? []) });
        }
        continue;
      }
      states[id] = "executed";
      const sources = {};
      const accountings = [];
      for (const invId of requiredSorted) {
        const list = lists[invId];
        if (!Array.isArray(list)) throw new DriverError("invalid-arguments", `no configured source list for inventory id ${invId}`, id);
        const counted = makeCountedSource(invId, list);
        sources[invId] = counted.source;
        accountings.push(counted.accounting);
        expectedCounts[id][invId] = list.length;
      }
      const ctx = {
        repoRoot, repositoryRef, git,
        symbols: seeds.symbols, files: seeds.files,
        sources
      };
      let weaverResult;
      try {
        weaverResult = await weaverImpls[id](ctx);
      } catch (e) {
        throw new DriverError("weaver-failure", String(e && e.message || e), id);
      }
      // Normative edge-append ordering (D26/D29/D31 + D10/AM-39): shape,
      // accounting, attribution, and fatal-warning checks ALL pass before any of
      // this weaver's edges are staged for appendEdge.
      checkWeaverResultShape(id, weaverResult);
      checkAccounting(id, accountings);
      checkAttribution(id, weaverResult);
      checkFatalWarnings(id, weaverResult, fatalCodes);
      for (const acc of accountings) { const a = acc(); countsById[id][a.inventory_id] = a.observed_count; }
      for (const edge of weaverResult.edges) stagedEdges.push(edge);
      for (const warning of weaverResult.warnings) stagedWarnings.push(warning);
    }

    // Driver-contradiction check: no iterator may exist for a skipped weaver.
    if (constructedForSkipped.length > 0) {
      const c = constructedForSkipped[0];
      throw new DriverError("unexpected-source-consumption",
        `iterator ${c.inventory_id} was constructed for skipped weaver ${c.weaver}`, c.weaver);
    }

    // ---- 9. aggregate, canonical-sort, dedupe, append -----------------------
    const dedup = new Map();
    for (const edge of stagedEdges) dedup.set(canonicalJson(edge), edge);
    const orderedEdges = [...dedup.values()].sort(edgeSortKeyCmp);
    stagedWarnings.sort(warningSortKeyCmp);
    for (const warning of stagedWarnings) result.warnings.push(warning);
    result.warnings.sort(warningSortKeyCmp);
    result.fatal_warning_count = result.warnings.filter((w) => typeof w.code === "string" && fatalCodes.has(w.code)).length;

    for (const edge of orderedEdges) {
      try { ledger.appendEdge(edge); }
      catch (e) { throw new DriverError("append-failure", String(e && e.message || e)); }
    }
    result.edge_count = orderedEdges.length;

    // ---- 10. coverage + D19/AM-20 close-time inventory equality -------------
    let coverage = buildCoverage(inv, states, countsById, implRefsById, orchestratorRefs, inventoriesConsumed);
    if (typeof options.mutateCoverage === "function") coverage = options.mutateCoverage(coverage) ?? coverage;
    checkCoverageEquality(coverage, inv, states, expectedCounts, implRefsById, orchestratorRefs, inventoriesConsumed);

    // ---- 11. publication-time re-derivation + hash recheck (D34/AM-38) ------
    if (typeof options.beforeRederivation === "function") options.beforeRederivation({ repoRoot, tmpAbs, destAbs });
    checkClosureEquality(repoRoot, inv, "publication-time-drift");
    recheckHashes(git, refsByFile, repositoryRef, "publication-time-drift");

    // ---- 12. close (signed trailer) + verify --------------------------------
    try { ledger.close(coverage); }
    catch (e) { throw new DriverError("close-failure", String(e && e.message || e)); }
    const verdict = await verifyLedger(tmpAbs);
    if (!verdict.ok) throw new DriverError("verification-failure", `temporary ledger failed verification: ${verdict.errors.join("; ")}`);
    result.ledger_bytes = statSync(tmpAbs).size;

    // ---- 13. atomic no-replace publication (D20/D28) ------------------------
    if (typeof options.beforePublication === "function") options.beforePublication({ repoRoot, tmpAbs, destAbs });
    if (!physicalContainment(repoRoot, outRel) || !physicalContainment(repoRoot, tmpRel)) {
      throw new DriverError("containment-violation", `destination chain for ${outRel} mutated before publication`);
    }
    try {
      linkSyncOp(tmpAbs, destAbs); // exclusive: EEXIST if the destination exists
    } catch (e) {
      if (e && e.code === "EEXIST") throw new DriverError("destination-exists", `destination appeared before publication: ${outRel} (pre-existing file preserved)`);
      throw new DriverError("publication-failure", String(e && e.message || e));
    }
    // Successful linkSync is the frozen publication commit point (D28): from here
    // the destination is published and MUST NOT be disturbed or removed.
    published = true;
    result.out = outRel;
    result.weavers = inv.weavers.map((w) => ({ id: w.id, state: states[w.id] }));
    try {
      unlinkSyncOp(tmpAbs);
      result.publication = "published";
      result.ok = true;
    } catch {
      result.publication = "published-cleanup-incomplete";
      result.leftover_temp = tmpRel;
      result.warnings.push({ weaver: "driver", code: "published-cleanup-incomplete", path: tmpRel, detail: `temporary file ${tmpRel} could not be removed after publication` });
      result.ok = false; // distinct nonzero cleanup status; the destination stands
    }
    return result;
  } catch (e) {
    return abortRun(e);
  }
}

// Exit-status mapping: 0 published clean; 3 published with incomplete cleanup
// (distinct from both success and non-publication failure); 1 not published.
export function exitCodeForResult(result) {
  if (result.publication === "published") return 0;
  if (result.publication === "published-cleanup-incomplete") return 3;
  return 1;
}

// ---- CLI (runs ONLY when this module is the invoked entry point) -------------

export function parseArgs(argv) {
  const opts = { skip: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--skip") {
      if (i + 1 >= argv.length) throw new DriverError("invalid-arguments", "--skip requires a weaver id");
      opts.skip.push(argv[++i]);
    } else if (a === "--out") {
      if (i + 1 >= argv.length) throw new DriverError("invalid-arguments", "--out requires a path");
      if (opts.out !== undefined) throw new DriverError("invalid-arguments", "--out given more than once");
      opts.out = argv[++i];
    } else {
      throw new DriverError("invalid-arguments", `unknown argument ${JSON.stringify(a)}`);
    }
  }
  return opts;
}

function invokedAsEntryPoint() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
}

if (invokedAsEntryPoint()) {
  let cliResult;
  try {
    const opts = parseArgs(process.argv.slice(2));
    cliResult = await runWeave(opts);
  } catch (e) {
    cliResult = {
      ok: false, publication: "not-published", out: null, edge_count: 0,
      ledger_bytes: 0, weavers: [], warnings: [], fatal_warning_count: 0,
      leftover_temp: null,
      error: { code: e instanceof DriverError ? e.code : "invalid-arguments", detail: String(e && e.message || e) }
    };
  }
  process.stdout.write(canonicalJson(cliResult) + "\n");
  process.exit(exitCodeForResult(cliResult));
}
