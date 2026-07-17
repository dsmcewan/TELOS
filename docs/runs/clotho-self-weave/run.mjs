#!/usr/bin/env node
// run.mjs — Clotho self-weave reproduction script (plan v15 Task 7,
// docs/runs/clotho-daedalus-delta14/matured-plan-v15.md lines 2023-2097;
// matured approach docs/runs/clotho-slice7-daedalus/matured-approach.md).
// Zero dependencies: Node stdlib plus this repository's own modules.
//
// The publication run performs, in order and all BEFORE any evidence file is
// written: the package-test battery (clotho first, then every other tracked
// package with a test script, in repository-relative path order), the advisory
// scanner (both directions, incl. the D30/D32 loader-construction checks and
// the D33 shared-grammar proof — advisory trusted-code review signals, never an
// isolation claim), a keyless full weave to a cryptographically unique
// temporary path below .telos/clotho/, temporary-ledger verification (header
// repository_ref per R1, five weavers executed, D33 closure equality for
// implementation_refs and orchestrator_refs, inventories_consumed content
// addresses, D24/D31 counts, AM-39 attribution, manifest/record consistency,
// the D8 self-export exclusion proof), and the complete flagship expected-set,
// review-set, gap, current-doc, and D35 both-direction checks. Publication then
// follows the driver's discipline: D34 re-derivation immediately before
// publication, physical containment immediately before publication, explicit
// stale-snapshot removal, exclusive-link creation (the D28 commit point, never
// rename-over), and `published-cleanup-incomplete` as a distinct nonzero
// outcome that surfaces the leftover temporary path and never disturbs the
// committed snapshot. Fail-closed throughout; partial temporary exports are
// removed in `finally`; a committed publication is never rolled back.
//
//   node docs/runs/clotho-self-weave/run.mjs                       # full run
//   node docs/runs/clotho-self-weave/run.mjs --skip-package-tests  # iteration
//   node docs/runs/clotho-self-weave/run.mjs --allow-dirty         # iteration
//   node docs/runs/clotho-self-weave/run.mjs --verify-committed    # read-only
//
// --skip-package-tests and --allow-dirty exist for in-worktree iteration only:
// the committed final evidence is produced by the default full run from a clean
// checkout. --verify-committed re-verifies the committed evidence files against
// the recorded input head and snapshot from disk without regenerating or
// rewriting any timestamped evidence.
//
// NOTE (shared matching logic): clotho/scripts/test-flagship.mjs executes its
// suite at import time and exports nothing, so its expectation-tuple / fact-set
// / one-to-one matching helpers cannot be imported. They are reimplemented here
// MINIMALLY and byte-compatibly (same tuple shapes, same canonical-JSON exact
// equality, same complement-as-review-set discipline) against the same
// hand-audited clotho/scripts/expected-flagship.json artifact.

import { createHash, randomBytes } from "node:crypto";
import {
  copyFileSync, linkSync, lstatSync, mkdirSync, readFileSync, unlinkSync,
  writeFileSync
} from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyLedger } from "../../../clotho/thread-ledger.mjs";
import {
  canonicalJson, deriveNodeId, deriveRepositoryRef, docAddressKey
} from "../../../clotho/registry.mjs";
import { why, blastRadius } from "../../../clotho/query.mjs";
import {
  deriveAcceptedClosure, gitSpawnOptions, makeGitRunner, physicalContainment,
  splitMarkdownSections, validateWeaveManifest, walkFiles
} from "../../../clotho/weavers/util.mjs";
import {
  CONTRACT_FILES, DOC_ROOTS, DOC_WEAVER_EXCLUDE, FATAL_WARNING_CODES,
  GLOBAL_EXCLUDE, ORCHESTRATOR_ENTRY_MODULES, ORCHESTRATOR_FILES,
  PERMITTED_EXTERNAL_CLOSURE_FILES, REQUIRED_INVENTORY_IDS, WEAVERS,
  WEAVER_ENTRY_MODULE, WEAVER_IMPL_FILES
} from "../../../clotho/inventory.mjs";
import { spawnCommand } from "../../../merkle-dag/vendor.mjs";

// ---- frozen constants --------------------------------------------------------

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..", "..");
const EVIDENCE_DIR_REL = "docs/runs/clotho-self-weave";
const SNAPSHOT_REL = `${EVIDENCE_DIR_REL}/thread-ledger.snapshot.jsonl`;
const SUMMARY_REL = `${EVIDENCE_DIR_REL}/summary.json`;
const MATCH_REPORT_REL = `${EVIDENCE_DIR_REL}/expected-match-report.json`;
const REVIEW_SET_REL = `${EVIDENCE_DIR_REL}/review-set.json`;
const VERIFICATION_REL = `${EVIDENCE_DIR_REL}/verification.json`;
const ARTIFACT_REL = "clotho/scripts/expected-flagship.json";
const WEAVE_CLI_REL = "clotho/weave.mjs";
const ADVISORY_REL = "clotho/scripts/test-advisory.mjs";

const FLAGSHIP = { path: "merkle-dag/obligation.mjs", symbol: "deriveExecutableRef" };
const GROUPS = ["definition", "consumers", "tests", "introduction", "documentation", "concern", "run-evidence", "contract"];
const FIVE_KINDS = ["introduced-by", "motivated-by", "documented-in", "evidenced-by", "discharges"];
const WEAVE_CEILING_MS = 120000; // frozen full-weave acceptance ceiling
const PACKAGE_TEST_TIMEOUT_MS = 1800000;
const HEX40 = /^[0-9a-f]{40}$/;
const FATAL = new Set(FATAL_WARNING_CODES);

// The EXACT D34 provenance statement (never a claim of covering every module
// the process could possibly reach).
const D34_STATEMENT = "These references exactly cover the supported, statically declared dependency model at publication time";

// The exact frozen kind-to-producer mapping (AM-39): every trusted record's
// (asserted_by, edge_kind) pair must be in this table; missing, additional, or
// cross-kind producer relations are attribution violations.
const PRODUCER_KINDS = Object.freeze({
  "clotho-git-weaver": ["introduced-by"],
  "clotho-code-weaver": ["depends-on"],
  "clotho-test-weaver": ["verified-by"],
  "clotho-doc-weaver": ["documented-in"],
  "clotho-ledger-weaver": ["motivated-by", "evidenced-by", "discharges"]
});

// ---- small helpers -----------------------------------------------------------

class FatalError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.code = code;
    this.detail = detail;
  }
}
const fatal = (code, detail) => { throw new FatalError(code, detail); };
const require_ = (cond, code, detail) => { if (!cond) fatal(code, detail); };

const absOf = (rel) => path.join(REPO_ROOT, ...rel.split("/"));
const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");
const exists = (abs) => { try { lstatSync(abs); return true; } catch { return false; } };

function readJson(abs, label) {
  let raw;
  try { raw = readFileSync(abs, "utf8"); } catch (e) { fatal("evidence-missing", `${label}: ${e && e.code || "unreadable"}`); }
  try { return JSON.parse(raw); } catch { fatal("evidence-malformed", `${label}: not valid JSON`); }
}

// Free-shape read-only git (status / ls-files enumeration only — everything the
// weave itself needs goes through the allowlisted makeGitRunner).
function gitRead(args) {
  return execFileSync("git", args, gitSpawnOptions(REPO_ROOT));
}

function makeBlobHasher(git) {
  const memo = new Map();
  return (rel) => {
    if (!memo.has(rel)) {
      const sha = String(git(["hash-object", "--no-filters", "--", rel])).replace(/\r?\n$/, "");
      require_(HEX40.test(sha), "invalid-blob-sha", `bad blob sha for ${rel}`);
      memo.set(rel, sha);
    }
    return memo.get(rel);
  };
}

function refPathOf(sourceRef) {
  if (typeof sourceRef !== "string" || !sourceRef.startsWith("file:")) return null;
  const at = sourceRef.lastIndexOf("@");
  return at > 5 ? sourceRef.slice(5, at) : null;
}

// ---- argument parsing --------------------------------------------------------

function parseArgs(argv) {
  const opts = { skipPackageTests: false, allowDirty: false, verifyCommitted: false };
  for (const a of argv) {
    if (a === "--skip-package-tests") opts.skipPackageTests = true;
    else if (a === "--allow-dirty") opts.allowDirty = true;
    else if (a === "--verify-committed") opts.verifyCommitted = true;
    else fatal("invalid-arguments", `unknown argument ${JSON.stringify(a)}`);
  }
  if (opts.verifyCommitted && (opts.skipPackageTests || opts.allowDirty)) {
    fatal("invalid-arguments", "--verify-committed takes no other flag");
  }
  return opts;
}

// ---- input-state checks ------------------------------------------------------
// Dirty tracked or untracked inputs OUTSIDE the excluded self-export directory
// are rejected (the temporary area .telos/ is git-ignored and never appears in
// porcelain output). --allow-dirty downgrades this to a recorded warning for
// in-worktree iteration only.

function dirtyEntries() {
  const raw = String(gitRead(["status", "--porcelain"]));
  const out = [];
  for (const line of raw.split("\n")) {
    if (line.trim() === "") continue;
    const p = line.slice(3).replace(/^"(.*)"$/, "$1").split(" -> ").pop();
    if (p === EVIDENCE_DIR_REL || p.startsWith(EVIDENCE_DIR_REL + "/")) continue;
    out.push(line);
  }
  return out.sort();
}

// ---- package-test battery ----------------------------------------------------
// Every Git-tracked package.json whose committed JSON has a `test` script:
// clotho first, then the remaining package directories in deterministic
// repository-relative path order. Any failure is fatal. Records carry only
// repository-relative directories and exit statuses (no absolute path, no pid).

function enumerateTestPackages() {
  const tracked = String(gitRead(["ls-files", "-z"])).split("\0").filter(Boolean);
  const dirs = [];
  for (const p of tracked) {
    if (p !== "package.json" && !p.endsWith("/package.json")) continue;
    let pkg;
    try { pkg = JSON.parse(readFileSync(absOf(p), "utf8")); } catch { continue; }
    const test = pkg && typeof pkg === "object" && pkg.scripts && typeof pkg.scripts === "object" ? pkg.scripts.test : undefined;
    if (typeof test !== "string" || test.length === 0) continue;
    dirs.push(p === "package.json" ? "." : p.slice(0, -"/package.json".length));
  }
  dirs.sort();
  const ordered = dirs.includes("clotho") ? ["clotho", ...dirs.filter((d) => d !== "clotho")] : dirs;
  require_(ordered.includes("clotho"), "package-enumeration", "tracked clotho/package.json with a test script is required");
  return ordered;
}

function runPackageTests() {
  const results = [];
  for (const dir of enumerateTestPackages()) {
    const spec = spawnCommand("npm", ["test"]);
    const r = spawnSync(spec.command, spec.args, {
      cwd: dir === "." ? REPO_ROOT : absOf(dir), encoding: "utf8", shell: false,
      stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, timeout: PACKAGE_TEST_TIMEOUT_MS
    });
    const status = r.status === null ? -1 : r.status;
    results.push({ package: dir, command: "npm test", exit_status: status });
    if (r.error || status !== 0) {
      fatal("package-test-failure", `${dir}: npm test exited ${status}${r.error ? ` (${r.error.message})` : ""}; stderr tail: ${String(r.stderr || "").slice(-2000)}`);
    }
  }
  return results;
}

// ---- advisory scanner --------------------------------------------------------
// Runs clotho/scripts/test-advisory.mjs (the two-direction advisory boundary
// suite: outside-in AND closed Clotho-side outbound, including the D30/D32
// loader-construction units against the frozen mapping and the D33
// shared-grammar proof units) and retains its file/package counts. Advisory
// posture: trusted-code review signals only — no isolation or sandbox claim.

const ADVISORY_SCAN_RE = /advisory real-repo scan: outside-in PASS \((\d+) sources, (\d+) unclassified reported\), clotho outbound PASS \((\d+) sources, (\d+) accepted edges, (\d+) tracked sources outside every package root not in scope\)/;
const ADVISORY_OK_RE = /clotho test-advisory OK \((\d+) units\)/;

function runAdvisoryScanner() {
  const r = spawnSync(process.execPath, [ADVISORY_REL], {
    cwd: REPO_ROOT, encoding: "utf8", shell: false,
    stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, timeout: PACKAGE_TEST_TIMEOUT_MS
  });
  const status = r.status === null ? -1 : r.status;
  if (r.error || status !== 0) {
    fatal("advisory-scan-failure", `advisory scanner exited ${status}${r.error ? ` (${r.error.message})` : ""}; stderr tail: ${String(r.stderr || "").slice(-2000)}`);
  }
  const scan = ADVISORY_SCAN_RE.exec(String(r.stdout));
  const ok = ADVISORY_OK_RE.exec(String(r.stdout));
  require_(scan !== null && ok !== null, "advisory-scan-failure", "advisory scanner summary lines not found in output");
  return {
    command: `node ${ADVISORY_REL}`,
    exit_status: status,
    units: Number(ok[1]),
    outside_scanned: Number(scan[1]),
    outside_unclassified: Number(scan[2]),
    clotho_scanned: Number(scan[3]),
    accepted_edges: Number(scan[4]),
    unassigned_sources: Number(scan[5]),
    note: "Two-direction advisory review signals (D23/D27/D30/D32/D33, AM-35..39), including the D30/D32 loader-construction checks against the exact frozen mapping and the D33 shared-grammar proof — recorded as advisory trusted-code review signals, never as isolation or loader-containment proofs."
  };
}

// ---- D33 closure derivation + D34 re-derivation ------------------------------
// The SAME derivation runs twice: once during verification and once immediately
// before publication (D34). Byte-for-byte disagreement between the two is
// publication-time drift and fatal.

function deriveClosureRefs(gitBlob) {
  const allowExternal = new Set(PERMITTED_EXTERNAL_CLOSURE_FILES);
  const implFiles = {};
  const implRefs = {};
  for (const w of WEAVERS) {
    const derived = deriveAcceptedClosure(absOf(WEAVER_ENTRY_MODULE[w.id]), { repoRoot: REPO_ROOT, allowExternal });
    const committed = WEAVER_IMPL_FILES[w.id];
    require_(derived.length === committed.length && derived.every((f, i) => f === committed[i]),
      "closure-inequality", `${w.id}: derived closure != committed inventory (derived ${JSON.stringify(derived)})`);
    implFiles[w.id] = derived;
    implRefs[w.id] = derived.map((f) => `file:${f}@${gitBlob(f)}`);
  }
  const union = new Set();
  for (const entry of ORCHESTRATOR_ENTRY_MODULES) {
    for (const m of deriveAcceptedClosure(absOf(entry), { repoRoot: REPO_ROOT, allowExternal })) union.add(m);
  }
  const orch = [...union].sort();
  require_(orch.length === ORCHESTRATOR_FILES.length && orch.every((f, i) => f === ORCHESTRATOR_FILES[i]),
    "closure-inequality", `orchestrator: derived closure != committed inventory (derived ${JSON.stringify(orch)})`);
  return { implRefs, orchestratorRefs: orch.map((f) => `file:${f}@${gitBlob(f)}`) };
}

// ---- temporary-ledger verification -------------------------------------------

function checkVerifiedLedger(verdict, { repositoryRef, inputHead, gitBlob, closureRefs, requireHeadEquality = true }) {
  require_(verdict.ok === true && verdict.errors.length === 0, "ledger-verification-failure", `ledger failed verification: ${verdict.errors.join("; ")}`);
  require_(verdict.header !== null && verdict.manifest !== null, "ledger-verification-failure", "verified ledger must carry a header and a manifest");
  const h = verdict.header;
  require_(h.repository_ref === repositoryRef, "repository-ref-mismatch", `header repository_ref ${JSON.stringify(h.repository_ref)} != derived ${JSON.stringify(repositoryRef)} (R1)`);
  if (requireHeadEquality) {
    require_(h.repo_head === inputHead, "input-head-mismatch", `header repo_head ${JSON.stringify(h.repo_head)} != recorded input head ${JSON.stringify(inputHead)}`);
  }
  require_(typeof h.pub_key === "string" && h.pub_key.length > 0, "ledger-verification-failure", "header carries no public key");

  // Manifest structure + record consistency (skipped-with-edges contradiction).
  const weaverEdgeIds = new Set(verdict.records.map((r) => r.asserted_by));
  validateWeaveManifest(verdict.manifest, { weaverEdgeIds });

  // Five weavers, all executed, D24 counts over the frozen id table, D31
  // ledger-weaver contract-files cardinality, D33 implementation_refs equality.
  const m = verdict.manifest;
  require_(m.weavers.length === WEAVERS.length, "manifest-incomplete", "manifest must carry the five weavers");
  for (let i = 0; i < WEAVERS.length; i++) {
    const id = WEAVERS[i].id;
    const w = m.weavers[i];
    require_(w.id === id, "manifest-incomplete", `manifest weaver[${i}] id ${JSON.stringify(w.id)} != inventory order id ${id}`);
    require_(w.state === "executed", "manifest-incomplete", `weaver ${id} state ${JSON.stringify(w.state)} (all five must be executed)`);
    const requiredSorted = [...REQUIRED_INVENTORY_IDS[id]].sort();
    const ids = w.inspected_source_counts.map((c) => c.inventory_id);
    require_(ids.length === requiredSorted.length && ids.every((cid, k) => cid === requiredSorted[k]),
      "count-table-mismatch", `weaver ${id} count ids [${ids.join(", ")}] != frozen table [${requiredSorted.join(", ")}] (D24)`);
    for (const c of w.inspected_source_counts) {
      require_(Number.isSafeInteger(c.count) && c.count >= 0, "count-table-mismatch", `weaver ${id} count ${c.inventory_id} is not a nonnegative safe integer`);
    }
    if (id === "clotho-ledger-weaver") {
      const cf = w.inspected_source_counts.find((c) => c.inventory_id === "contract-files");
      require_(cf && cf.count === CONTRACT_FILES.length, "count-table-mismatch",
        `D31: ledger-weaver contract-files count ${cf && cf.count} != committed contract-files cardinality ${CONTRACT_FILES.length}`);
    }
    const refs = closureRefs.implRefs[id];
    require_(w.implementation_refs.length === refs.length && w.implementation_refs.every((r, k) => r === refs[k]),
      "closure-inequality", `manifest implementation_refs for ${id} != independently derived closure refs (D33)`);
  }
  require_(m.orchestrator_refs.length === closureRefs.orchestratorRefs.length &&
    m.orchestrator_refs.every((r, k) => r === closureRefs.orchestratorRefs[k]),
    "closure-inequality", "manifest orchestrator_refs != independently derived closure refs (D33)");

  // inventories_consumed content addresses recomputed from disk ground truth.
  require_(m.inventories_consumed.length > 0, "manifest-incomplete", "inventories_consumed is empty");
  for (const entry of m.inventories_consumed) {
    const rel = refPathOf(entry.source_ref);
    require_(rel !== null, "inventory-address-mismatch", `inventories_consumed entry ${entry.id} is not a file content address`);
    require_(entry.source_ref === `file:${rel}@${gitBlob(rel)}`, "inventory-address-mismatch",
      `inventories_consumed ${entry.id} content address does not match disk ground truth`);
  }
  require_(m.inventories_consumed.some((e) => e.id === "clotho/inventory.mjs"), "manifest-incomplete",
    "the committed inventory itself must be a consumed, content-addressed input");

  // Record-side consistency + AM-39 attribution over the exact frozen mapping.
  const producersSeen = new Set();
  for (const r of verdict.records) {
    require_(r.assertion_status === "deterministic-extraction", "attribution-violation",
      `record ${r.record_hash} carries assertion_status ${JSON.stringify(r.assertion_status)}`);
    const kinds = PRODUCER_KINDS[r.asserted_by];
    require_(Array.isArray(kinds), "attribution-violation", `record ${r.record_hash} asserted by unknown producer ${JSON.stringify(r.asserted_by)} (AM-39)`);
    require_(kinds.includes(r.edge_kind), "attribution-violation",
      `record ${r.record_hash}: ${r.asserted_by} may not assert ${r.edge_kind} (AM-39 cross-kind)`);
    producersSeen.add(r.asserted_by);
  }
  for (const id of Object.keys(PRODUCER_KINDS)) {
    require_(producersSeen.has(id), "attribution-violation", `executed producer ${id} asserted no relation (AM-39 missing producer relation)`);
  }

  // D8 self-export exclusion proof: no trusted record references the self-export
  // directory or the temporary area in ANY field (locators, refs, node ids).
  require_(GLOBAL_EXCLUDE.includes(EVIDENCE_DIR_REL), "self-exclusion-failure", "GLOBAL_EXCLUDE no longer pins the self-export directory (D8)");
  for (const r of verdict.records) {
    const cj = canonicalJson(r);
    require_(!cj.includes(EVIDENCE_DIR_REL) && !cj.includes(".telos/"), "self-exclusion-failure",
      `record ${r.record_hash} references the excluded self-export or temporary area (D8)`);
  }
  return { trustedRecordCount: verdict.records.length };
}

// ---- expected artifact + one-to-one matching ---------------------------------
// Minimal fail-closed reimplementation of the flagship matcher (see NOTE above):
// exact canonical-JSON equality only, bijective assignment, complement as the
// deterministically sorted, unscored review set.

function loadExpectedArtifact(repositoryRef, gitBlob) {
  const raw = readJson(absOf(ARTIFACT_REL), ARTIFACT_REL);
  const header = raw.clotho_expected_flagship;
  require_(header && typeof header === "object" && !Array.isArray(header), "expected-artifact-invalid", "missing clotho_expected_flagship header");
  require_(header.repository_ref === repositoryRef, "expected-artifact-invalid",
    `stored audited repository_ref ${JSON.stringify(header.repository_ref)} != derived ${JSON.stringify(repositoryRef)}`);
  const expectations = raw.expectations;
  require_(Array.isArray(expectations) && expectations.length > 0, "expected-artifact-invalid", "expectations must be a nonempty array");
  const seen = new Set();
  const byGroup = new Map(GROUPS.map((g) => [g, []]));
  for (const e of expectations) {
    const cj = canonicalJson(e);
    require_(!seen.has(cj), "expected-artifact-invalid", `duplicate expectation: ${cj}`);
    seen.add(cj);
    require_(GROUPS.includes(e.source_group), "expected-artifact-invalid", `unknown source_group ${JSON.stringify(e.source_group)}`);
    require_(e.subject === "node" || e.subject === "edge", "expected-artifact-invalid", `unknown subject ${JSON.stringify(e.subject)}`);
    byGroup.get(e.source_group).push(e);
  }
  for (const g of GROUPS) {
    require_(byGroup.get(g).length > 0, "expected-artifact-invalid", `group '${g}' is absent (all eight groups must be present)`);
  }
  const defs = byGroup.get("definition");
  require_(defs.length === 1 && defs[0].subject === "node" && defs[0].kind === "code-symbol", "expected-artifact-invalid", "exactly one code-symbol definition expectation is required");
  const targetLoc = defs[0].locator_match;
  require_(targetLoc.path === FLAGSHIP.path && targetLoc.symbol === FLAGSHIP.symbol, "expected-artifact-invalid",
    "definition must locate the flagship code-symbol merkle-dag/obligation.mjs#deriveExecutableRef");
  require_(targetLoc.blob_sha === gitBlob(FLAGSHIP.path), "expected-artifact-invalid",
    "audited target blob_sha does not equal the current on-disk blob (stale hash => re-audit trigger)");
  return { expectations, byGroup, targetLoc };
}

const edgeTuple = (r) => ({
  subject: "edge", edge_kind: r.edge_kind,
  from_kind: r.from_locator.kind, from_locator: r.from_locator.locator,
  to_kind: r.to_locator.kind, to_locator: r.to_locator.locator,
  source_ref: r.source_ref
});
const expectationTuple = (e) => e.subject === "node"
  ? { subject: "node", kind: e.kind, locator: e.locator_match }
  : { subject: "edge", edge_kind: e.edge_kind, from_kind: e.from_kind, from_locator: e.from_locator_match, to_kind: e.to_kind, to_locator: e.to_locator_match, source_ref: e.source_ref };

function buildFactSet(targetDescriptor, whyResult, brResult) {
  const edgeByHash = new Map();
  for (const r of [...whyResult.chain, ...brResult.edges]) if (!edgeByHash.has(r.record_hash)) edgeByHash.set(r.record_hash, r);
  const tuples = [{ subject: "node", kind: targetDescriptor.kind, locator: targetDescriptor.locator }, ...[...edgeByHash.values()].map(edgeTuple)];
  const byKey = new Map();
  for (const t of tuples) {
    const k = canonicalJson(t);
    require_(!byKey.has(k), "fact-set-duplicate", `duplicate fact tuple ${k}`);
    byKey.set(k, t);
  }
  return byKey;
}

function matchExpectations(expectations, factByKey) {
  const claimed = new Set();
  const matched = [];
  for (const e of expectations) {
    const key = canonicalJson(expectationTuple(e));
    require_(factByKey.has(key), "expected-mismatch", `unmatched expectation (${e.source_group}): ${key}`);
    require_(!claimed.has(key), "expected-mismatch", `one fact cannot satisfy two expectations (${e.source_group})`);
    claimed.add(key);
    matched.push({ expectation: e, matched_fact: factByKey.get(key) });
  }
  const unmatched = [...factByKey.keys()].filter((k) => !claimed.has(k)).sort().map((k) => factByKey.get(k));
  return { claimed, matched, unmatched };
}

// Review-set entries carry ONLY content-bound fact fields — no score, rank,
// confidence, priority, or ordinal of any kind.
function assertReviewSetSchema(unmatched) {
  for (const t of unmatched) {
    const keys = Object.keys(t).sort().join(",");
    require_(t.subject === "node" ? keys === "kind,locator,subject" : keys === "edge_kind,from_kind,from_locator,source_ref,subject,to_kind,to_locator",
      "review-set-schema", "review-set entries must carry only content-bound fields (no relevance, rank, or confidence of any kind)");
  }
}

// ---- currentDocs freshness ---------------------------------------------------
// Map<docAddressKey, text_sha256|null>; null (deleted or ambiguous current
// address) is preserved, never dropped or coerced.

function buildCurrentDocs() {
  const currentDocs = new Map();
  const excluded = (rel, roots) => roots.some((x) => rel === x || rel.startsWith(x + "/"));
  const docFiles = walkFiles(REPO_ROOT, DOC_ROOTS)
    .filter((p) => p.endsWith(".md"))
    .filter((p) => !excluded(p, DOC_WEAVER_EXCLUDE))
    .filter((p) => !excluded(p, GLOBAL_EXCLUDE));
  for (const rel of docFiles) {
    const { sections, duplicatePaths } = splitMarkdownSections(readFileSync(absOf(rel)));
    for (const sec of sections) {
      let key;
      try { key = docAddressKey({ path: rel, heading_path: sec.heading_path }); } catch { continue; }
      if (duplicatePaths.has(JSON.stringify(sec.heading_path))) currentDocs.set(key, null); // ambiguous
      else currentDocs.set(key, sec.text_sha256);
    }
  }
  return currentDocs;
}

// ---- D35 both-direction blast-radius verification ----------------------------
// Independently re-derives the affected/evidence/edge collections from the
// trusted records (inverse depends-on BFS to depth 3, verified-by evidence over
// visited nodes) and verifies BOTH directions for each of the three
// collections. coverage "verified" is recorded only after all six pass.

function verifyBlastRadiusBothDirections(records, targetId, br) {
  const facts = records.filter((r) => r.assertion_status === "deterministic-extraction");
  const inverse = new Map();
  for (const f of facts) {
    if (f.edge_kind !== "depends-on") continue;
    if (!inverse.has(f.to_node)) inverse.set(f.to_node, []);
    inverse.get(f.to_node).push(f);
  }
  const visited = new Set([targetId]);
  let frontier = [targetId];
  const traversed = [];
  for (let level = 0; level < 3 && frontier.length > 0; level++) {
    const next = [];
    for (const n of frontier) {
      for (const e of inverse.get(n) ?? []) {
        traversed.push(e);
        if (!visited.has(e.from_node)) { visited.add(e.from_node); next.push(e.from_node); }
      }
    }
    frontier = next;
  }
  const evidence = facts.filter((f) => f.edge_kind === "verified-by" && visited.has(f.from_node));
  const edgeHashes = new Set([...traversed, ...evidence].map((r) => r.record_hash));
  const evidenceHashes = new Set(evidence.map((r) => r.record_hash));
  const described = new Set();
  for (const f of facts) { described.add(f.from_node); described.add(f.to_node); }
  const affectedIds = new Set([...visited].filter((id) => described.has(id)));

  const brAffected = new Set(br.affected.map((a) => a.node));
  const brEvidence = new Set(br.evidence.map((r) => r.record_hash));
  const brEdges = new Set(br.edges.map((r) => r.record_hash));
  const covers = (derived, recorded) => [...derived].every((x) => recorded.has(x));
  const directions = {
    affected_derived_in_recorded: covers(affectedIds, brAffected),
    affected_recorded_in_derived: covers(brAffected, affectedIds),
    evidence_derived_in_recorded: covers(evidenceHashes, brEvidence),
    evidence_recorded_in_derived: covers(brEvidence, evidenceHashes),
    edges_derived_in_recorded: covers(edgeHashes, brEdges),
    edges_recorded_in_derived: covers(brEdges, edgeHashes)
  };
  const allSix = Object.values(directions).every((v) => v === true);
  require_(allSix, "d35-direction-failure", `blast-radius both-direction verification failed: ${canonicalJson(directions)}`);
  require_(br.coverage === "verified" && br.coverageUnknown.length === 0, "d35-direction-failure",
    "blastRadius under the verified manifest must report coverage 'verified' with empty coverageUnknown");
  return { ...directions, coverage: "verified" };
}

// ---- flagship checks over a verified ledger ----------------------------------

function runFlagshipChecks(verdict, repositoryRef, gitBlob) {
  const art = loadExpectedArtifact(repositoryRef, gitBlob);
  const target = { kind: "code-symbol", locator: { repository_ref: repositoryRef, path: FLAGSHIP.path, symbol: FLAGSHIP.symbol, blob_sha: art.targetLoc.blob_sha } };
  const targetId = deriveNodeId(target);

  const whyR = why(verdict.records, targetId, { expectedKinds: [...FIVE_KINDS], manifest: verdict.manifest });
  require_(whyR.gaps.length === 0, "query-gap", `ledger-only why.gaps must be empty: ${canonicalJson(whyR.gaps)}`);
  const br = blastRadius(verdict.records, targetId, 3, { manifest: verdict.manifest });
  const d35 = verifyBlastRadiusBothDirections(verdict.records, targetId, br);

  const factByKey = buildFactSet(target, whyR, br);
  const match = matchExpectations(art.expectations, factByKey);
  require_(match.claimed.size === art.expectations.length, "expected-mismatch", "every expectation must obtain a distinct match (all eight groups)");
  require_(match.claimed.size + match.unmatched.length === factByKey.size, "review-set-incomplete",
    "review set must be exactly the fact set minus the matched facts");
  assertReviewSetSchema(match.unmatched);

  const whyFresh = why(verdict.records, targetId, { expectedKinds: [...FIVE_KINDS], currentDocs: buildCurrentDocs(), manifest: verdict.manifest });
  require_(whyFresh.gaps.length === 0, "drift-gap", `currentDocs freshness re-run reported gaps: ${canonicalJson(whyFresh.gaps)}`);

  const matchedGroups = {};
  for (const g of GROUPS) matchedGroups[g] = art.byGroup.get(g).length;
  return { art, target, whyR, br, d35, factByKey, match, matchedGroups };
}

// ---- committed-evidence verification (read-only) -----------------------------
// Used both as the in-run post-publication recheck and as --verify-committed:
// re-verifies the committed evidence set from disk bytes against the recorded
// input head and snapshot without regenerating or rewriting anything.

async function verifyCommittedEvidence() {
  const git = makeGitRunner(REPO_ROOT);
  const gitBlob = makeBlobHasher(git);
  const repositoryRef = deriveRepositoryRef(git);

  const summary = readJson(absOf(SUMMARY_REL), SUMMARY_REL);
  const verification = readJson(absOf(VERIFICATION_REL), VERIFICATION_REL);
  const matchReport = readJson(absOf(MATCH_REPORT_REL), MATCH_REPORT_REL);
  const reviewSet = readJson(absOf(REVIEW_SET_REL), REVIEW_SET_REL);
  const head = summary.clotho_self_weave_summary;
  require_(head && typeof head === "object", "evidence-malformed", "summary.json missing clotho_self_weave_summary header");

  // Snapshot bytes, hash equality, and full ledger re-verification.
  let snapBuf;
  try { snapBuf = readFileSync(absOf(SNAPSHOT_REL)); } catch { fatal("evidence-missing", `${SNAPSHOT_REL} is unreadable`); }
  const snapSha = sha256hex(snapBuf);
  require_(snapSha === head.snapshot_sha256, "evidence-inconsistent", "snapshot SHA-256 != summary.snapshot_sha256");
  require_(snapSha === verification.snapshot.sha256, "evidence-inconsistent", "snapshot SHA-256 != verification.snapshot.sha256");
  require_(snapBuf.length === head.ledger_bytes, "evidence-inconsistent", "snapshot byte count != summary.ledger_bytes");
  const verdict = await verifyLedger(absOf(SNAPSHOT_REL));
  const closureRefs = deriveClosureRefs(gitBlob);
  checkVerifiedLedger(verdict, { repositoryRef, inputHead: head.input_repo_head, gitBlob, closureRefs });

  // R1 byte equality across derived value, header, summary, verification.
  require_(head.repository_ref === repositoryRef, "repository-ref-mismatch", "summary repository_ref != derived value (R1)");
  require_(verification.repository_ref.derived === repositoryRef && verification.repository_ref.equal === true,
    "repository-ref-mismatch", "verification.json repository_ref disagrees with the derived value (R1)");
  require_(verdict.header.pub_key === head.public_key, "evidence-inconsistent", "snapshot public key != summary.public_key");
  require_(verdict.header.woven_at === head.woven_at, "evidence-inconsistent", "snapshot woven_at != summary weave timestamp");
  require_(verdict.records.length === verification.trusted_record_count, "evidence-inconsistent", "trusted record count != verification.trusted_record_count");
  require_(head.publication_state === "published" && verification.publication_state === "published",
    "evidence-inconsistent", "committed evidence requires the clean D28 'published' state");
  require_(head.provenance_statement === D34_STATEMENT && verification.closure.provenance_statement === D34_STATEMENT,
    "evidence-inconsistent", "the exact D34 provenance statement is required");

  // Flagship re-verification from the committed snapshot bytes.
  const flagship = runFlagshipChecks(verdict, repositoryRef, gitBlob);
  require_(verdict.records.filter((r) => PRODUCER_KINDS[r.asserted_by]).length === head.edge_count,
    "evidence-inconsistent", "snapshot edge count != summary.edge_count");
  require_(Array.isArray(matchReport.matched) && matchReport.matched.length === flagship.match.matched.length,
    "evidence-inconsistent", "expected-match-report entry count != re-derived match count");
  require_(Array.isArray(matchReport.unmatched_expectations) && matchReport.unmatched_expectations.length === 0,
    "evidence-inconsistent", "expected-match-report must carry zero unmatched expectations");
  require_(canonicalJson(matchReport.matched.map((m) => m.expectation)) === canonicalJson(flagship.match.matched.map((m) => m.expectation)),
    "evidence-inconsistent", "expected-match-report expectations differ from the committed artifact's (D25 provenance must be preserved unchanged)");
  require_(canonicalJson(reviewSet.unmatched) === canonicalJson(flagship.match.unmatched),
    "evidence-inconsistent", "review-set.json differs from the re-derived deterministic complement");
  assertReviewSetSchema(reviewSet.unmatched);
  require_(canonicalJson(summary.gaps) === canonicalJson({ freshness: [], why: [] }), "evidence-inconsistent", "summary gaps must be empty");
  for (const g of GROUPS) {
    require_(summary.matched_groups[g] === flagship.matchedGroups[g], "evidence-inconsistent", `summary matched_groups.${g} disagrees with the re-derived match`);
  }
  return { repository_ref: repositoryRef, snapshot_sha256: snapSha, trusted_record_count: verdict.records.length, edge_count: head.edge_count };
}

// ---- evidence-file publication -----------------------------------------------
// Stale prior evidence is removed explicitly and re-created exclusively (wx) —
// never silently overwritten. Only called after the snapshot's D28 commit point
// and clean cleanup.

function publishEvidenceFile(rel, bytes) {
  const abs = absOf(rel);
  require_(physicalContainment(REPO_ROOT, rel), "containment-failure", `evidence destination ${rel} is not physically contained in the repository`);
  if (exists(abs)) unlinkSync(abs); // explicit stale removal
  writeFileSync(abs, bytes, { flag: "wx" });
}

// ---- the publication run -----------------------------------------------------

async function publicationRun(opts) {
  const temps = [];
  let snapshotCommitted = false;
  const runWarnings = [];
  try {
    const git = makeGitRunner(REPO_ROOT);
    const gitBlob = makeBlobHasher(git);
    const inputHead = String(git(["rev-parse", "HEAD"])).replace(/\r?\n$/, "");
    require_(HEX40.test(inputHead), "invalid-input-head", `bad input head ${JSON.stringify(inputHead)}`);

    // Input-state check: dirty tracked/untracked inputs outside the excluded
    // self-export directory are rejected (--allow-dirty: iteration only).
    const dirtyBefore = dirtyEntries();
    if (dirtyBefore.length > 0) {
      if (!opts.allowDirty) {
        fatal("dirty-input", `dirty tracked/untracked inputs outside the excluded areas:\n${dirtyBefore.join("\n")}`);
      }
      runWarnings.push({ code: "allow-dirty", detail: `${dirtyBefore.length} dirty entr${dirtyBefore.length === 1 ? "y" : "ies"} tolerated for in-worktree iteration; committed evidence requires a clean checkout` });
    }

    // R1: derive the canonical repository reference ONCE from the recorded input
    // repository (re-derived byte-for-byte at verification and publication time).
    const repositoryRef = deriveRepositoryRef(git);

    // Package-test battery (clotho first), then the advisory scanner; both run
    // before the weave and before any evidence is written.
    let packageTests;
    if (opts.skipPackageTests) {
      packageTests = { mode: "skipped", note: "--skip-package-tests (in-worktree iteration only; the committed evidence run executes the full battery)", results: [] };
      runWarnings.push({ code: "skip-package-tests", detail: "package-test battery skipped; not valid for committed evidence" });
    } else {
      packageTests = { mode: "full", results: runPackageTests() };
    }
    const advisory = runAdvisoryScanner();

    // Reject any unexpected tracked mutation caused by tests or scanning.
    const dirtyAfter = dirtyEntries();
    require_(canonicalJson(dirtyAfter) === canonicalJson(dirtyBefore), "unexpected-mutation",
      `package tests / scanning mutated tracked inputs: before=${canonicalJson(dirtyBefore)} after=${canonicalJson(dirtyAfter)}`);

    // Keyless full weave to a cryptographically unique temporary path below
    // .telos/clotho/, under the frozen 120s monotonic ceiling. The deadline is
    // propagated to the child (spawn timeout); expiry terminates it.
    const uid = randomBytes(16).toString("hex");
    const weaveOutRel = `.telos/clotho/self-weave-${uid}.jsonl`;
    const weaveOutAbs = absOf(weaveOutRel);
    temps.push(weaveOutAbs);
    const t0 = performance.now();
    const wr = spawnSync(process.execPath, [WEAVE_CLI_REL, "--out", weaveOutRel], {
      cwd: REPO_ROOT, encoding: "utf8", shell: false,
      stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, timeout: WEAVE_CEILING_MS
    });
    const weaveWallMs = Math.round(performance.now() - t0);
    require_(!wr.error && wr.signal === null, "weave-ceiling", `weave terminated (${wr.signal || (wr.error && wr.error.message)}) — the ${WEAVE_CEILING_MS}ms ceiling or spawn failed`);
    require_(weaveWallMs < WEAVE_CEILING_MS, "weave-ceiling", `weave wall time ${weaveWallMs}ms exceeds the frozen ${WEAVE_CEILING_MS}ms ceiling`);
    require_(wr.status === 0, "weave-failure", `weave exited ${wr.status}; stderr tail: ${String(wr.stderr || "").slice(-2000)}`);
    const lines = String(wr.stdout).trim().split("\n");
    let weaveResult;
    try { weaveResult = JSON.parse(lines[lines.length - 1]); } catch { fatal("weave-failure", "weave CLI produced no parseable result line"); }
    require_(weaveResult.ok === true && weaveResult.publication === "published" && weaveResult.error === null,
      "weave-failure", `weave result not published clean: ${canonicalJson({ ok: weaveResult.ok, publication: weaveResult.publication, error: weaveResult.error })}`);
    require_(weaveResult.fatal_warning_count === 0 && !weaveResult.warnings.some((w) => typeof w.code === "string" && FATAL.has(w.code)),
      "fatal-warning", "a fatal warning may never accompany a published weave");
    require_(weaveResult.out === weaveOutRel, "weave-failure", "weave published to an unexpected destination");
    require_(weaveResult.edge_count > 0 && weaveResult.ledger_bytes > 0, "weave-failure", "a real weave has edges and bytes");

    // Verify the temporary ledger and all manifest/closure/count/attribution/
    // exclusion facts BEFORE any query or evidence construction (D33 first
    // derivation happens here; D34 repeats it immediately before publication).
    const verdict = await verifyLedger(weaveOutAbs);
    const closureRefs = deriveClosureRefs(gitBlob);
    const ledgerFacts = checkVerifiedLedger(verdict, { repositoryRef, inputHead, gitBlob, closureRefs });

    // Flagship expected-set, review-set, gap, current-doc, and D35 checks —
    // complete before publishing any evidence file.
    const flagship = runFlagshipChecks(verdict, repositoryRef, gitBlob);

    // ---- evidence construction (staged + validated before publication) -------
    const ledgerBuf = readFileSync(weaveOutAbs);
    require_(ledgerBuf.length === weaveResult.ledger_bytes, "ledger-verification-failure", "ledger byte count drifted between publication and verification");
    const snapshotSha = sha256hex(ledgerBuf);

    const summary = {
      clotho_self_weave_summary: {
        input_repo_head: inputHead,
        repository_ref: repositoryRef,
        woven_at: verdict.header.woven_at,
        public_key: verdict.header.pub_key,
        snapshot_sha256: snapshotSha,
        weave_wall_ms: weaveWallMs,
        edge_count: weaveResult.edge_count,
        ledger_bytes: weaveResult.ledger_bytes,
        publication_state: "published",
        provenance_statement: D34_STATEMENT
      },
      weavers: verdict.manifest.weavers,
      orchestrator_refs: verdict.manifest.orchestrator_refs,
      inventories_consumed: verdict.manifest.inventories_consumed,
      warnings: weaveResult.warnings,
      run_warnings: runWarnings,
      why_chain: flagship.whyR.chain,
      blast_radius: {
        coverage: "verified",
        coverageUnknown: [],
        truncated: flagship.br.truncated,
        affected: flagship.br.affected,
        evidence: flagship.br.evidence,
        edges: flagship.br.edges
      },
      gaps: { why: [], freshness: [] },
      matched_groups: flagship.matchedGroups,
      expected_count: flagship.art.expectations.length,
      fact_count: flagship.factByKey.size,
      matched_count: flagship.match.claimed.size,
      review_set_count: flagship.match.unmatched.length
    };

    const matchReport = {
      kind: "clotho-self-weave-expected-match-report",
      repository_ref: repositoryRef,
      note: "Every expectation from the hand-audited expected artifact (D25 provenance preserved unchanged) with its globally unique exact-JSON match; zero unmatched expectations across all eight groups.",
      groups: flagship.matchedGroups,
      matched: flagship.match.matched,
      unmatched_expectations: []
    };

    const reviewSet = {
      kind: "clotho-self-weave-review-set",
      note: "Every unmatched flagship-neighborhood fact (fact set minus matched), deterministically sorted; reported for review, never scored or ranked (D3).",
      repository_ref: repositoryRef,
      target: flagship.target.locator,
      fact_count: flagship.factByKey.size,
      matched_count: flagship.match.claimed.size,
      unmatched: flagship.match.unmatched
    };

    const verification = {
      kind: "clotho-self-weave-verification",
      node_version: process.version,
      input_repo_head: inputHead,
      repository_ref: { derived: repositoryRef, ledger_header: verdict.header.repository_ref, rederived_at_publication: repositoryRef, equal: true },
      snapshot: { path: SNAPSHOT_REL, sha256: snapshotSha, ledger_verification: "ok", errors: [] },
      trusted_record_count: ledgerFacts.trustedRecordCount,
      manifest: {
        weavers: verdict.manifest.weavers.map((w) => ({ id: w.id, state: w.state, implementation_refs: w.implementation_refs })),
        orchestrator_refs: verdict.manifest.orchestrator_refs,
        consistency: "consistent"
      },
      closure: { d33_equality: "equal", d34_rederivation: "no-drift", provenance_statement: D34_STATEMENT },
      counts: { d24: "conformant", d31_contract_files: CONTRACT_FILES.length },
      attribution: { am39: "conformant", producers: Object.keys(PRODUCER_KINDS) },
      self_exclusion: { d8_global_exclude_pins_self_export: true, records_referencing_self_export: 0 },
      flagship: {
        expected: flagship.art.expectations.length,
        matched: flagship.match.claimed.size,
        unmatched_expectations: 0,
        review_set: flagship.match.unmatched.length,
        groups: flagship.matchedGroups,
        query_gaps: 0,
        drift_gaps: 0
      },
      d35: flagship.d35,
      advisory,
      package_tests: packageTests,
      publication_state: "published"
    };

    // Serialize + schema-validate every payload in temporary staging files
    // before ANY final evidence file is touched.
    const payloads = [
      [SUMMARY_REL, summary], [MATCH_REPORT_REL, matchReport],
      [REVIEW_SET_REL, reviewSet], [VERIFICATION_REL, verification]
    ].map(([rel, obj]) => [rel, Buffer.from(JSON.stringify(obj, null, 2) + "\n", "utf8")]);
    mkdirSync(absOf(EVIDENCE_DIR_REL), { recursive: true });
    for (const [rel, bytes] of payloads) {
      const stageAbs = absOf(`.telos/clotho/self-weave-stage-${uid}-${rel.split("/").pop()}`);
      temps.push(stageAbs);
      writeFileSync(stageAbs, bytes, { flag: "wx" });
      const reread = JSON.parse(readFileSync(stageAbs, "utf8")); // round-trip validation
      require_(canonicalJson(reread) === canonicalJson(JSON.parse(bytes.toString("utf8"))), "evidence-staging-failure", `staged payload for ${rel} failed round-trip validation`);
    }

    // D34: re-derive the accepted closures, re-check every content address and
    // the repository_ref from publication-time bytes — drift is fatal.
    const rederived = deriveClosureRefs(makeBlobHasher(git));
    require_(canonicalJson(rederived) === canonicalJson(closureRefs), "publication-time-drift",
      "publication-time closure re-derivation disagrees with the verified derivation (D34)");
    require_(deriveRepositoryRef(git) === repositoryRef, "publication-time-drift", "repository_ref drifted at publication time (D34)");

    // ---- snapshot publication (D20/D28 discipline) ---------------------------
    // 1. copy the verified ledger bytes to a unique temporary export (never an
    //    append; the source temporary ledger is never modified);
    const exportRel = `.telos/clotho/self-weave-export-${uid}.jsonl`;
    const exportAbs = absOf(exportRel);
    copyFileSync(weaveOutAbs, exportAbs);
    const exportBuf = readFileSync(exportAbs);
    require_(exportBuf.equals(ledgerBuf), "export-byte-mismatch", "temporary export bytes differ from the verified ledger bytes");
    require_(sha256hex(exportBuf) === snapshotSha, "export-byte-mismatch", "temporary export SHA-256 differs from the staged snapshot SHA-256");
    require_(readFileSync(weaveOutAbs).equals(ledgerBuf), "export-byte-mismatch", "the export modified the source temporary ledger");

    // 2. physical containment immediately before publication;
    require_(physicalContainment(REPO_ROOT, SNAPSHOT_REL) && physicalContainment(REPO_ROOT, exportRel),
      "containment-failure", "snapshot/export destination chain is not physically contained in the repository");

    // 3. a stale prior snapshot is removed explicitly, then the snapshot is
    //    re-created via exclusive hard link — never rename-over;
    const snapshotAbs = absOf(SNAPSHOT_REL);
    if (exists(snapshotAbs)) unlinkSync(snapshotAbs);
    try {
      linkSync(exportAbs, snapshotAbs); // exclusive: EEXIST if a rival appeared
    } catch (e) {
      try { unlinkSync(exportAbs); } catch { /* removed in finally */ }
      fatal("atomic-publish-failure", `exclusive link failed: ${e && e.code || e}`);
    }
    // 4. a successful link is the D28 commit point: the snapshot is published
    //    and is never disturbed or rolled back from here on.
    snapshotCommitted = true;

    // 5. unlink the temporary export; failure = published-cleanup-incomplete
    //    (distinct nonzero; leftover surfaced; snapshot retained).
    try {
      unlinkSync(exportAbs);
    } catch {
      const result = { ok: false, publication: "published-cleanup-incomplete", leftover_temp: exportRel, snapshot: SNAPSHOT_REL, snapshot_sha256: snapshotSha };
      process.stderr.write(`published-cleanup-incomplete: the snapshot is published but the temporary export ${exportRel} could not be removed; manual cleanup required\n`);
      process.stdout.write(canonicalJson(result) + "\n");
      return 3;
    }

    // 6. publish the already-validated payloads (explicit stale removal +
    //    exclusive create). A failure past the snapshot commit point is fatal
    //    but never rolls the snapshot back.
    for (const [rel, bytes] of payloads) publishEvidenceFile(rel, bytes);

    // ---- post-publication recheck from disk bytes ----------------------------
    const recheck = await verifyCommittedEvidence();

    const result = {
      ok: true,
      publication: "published",
      snapshot: SNAPSHOT_REL,
      snapshot_sha256: snapshotSha,
      repository_ref: repositoryRef,
      input_repo_head: inputHead,
      edge_count: weaveResult.edge_count,
      ledger_bytes: weaveResult.ledger_bytes,
      trusted_record_count: recheck.trusted_record_count,
      weave_wall_ms: weaveWallMs,
      expected_matched: flagship.match.claimed.size,
      review_set_count: flagship.match.unmatched.length,
      package_tests: packageTests.mode,
      run_warnings: runWarnings
    };
    process.stdout.write(canonicalJson(result) + "\n");
    return 0;
  } finally {
    // Remove this run's uncommitted temporaries (descriptors are closed — all
    // I/O above is synchronous). The committed snapshot and published evidence
    // are never touched here.
    for (const t of temps) {
      try { unlinkSync(t); } catch { /* best-effort; ENOENT expected for consumed temps */ }
    }
    void snapshotCommitted; // the commit point is never rolled back
  }
}

// ---- entry -------------------------------------------------------------------

let exitCode = 1;
try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.verifyCommitted) {
    const r = await verifyCommittedEvidence();
    process.stdout.write(canonicalJson({ ok: true, mode: "verify-committed", ...r }) + "\n");
    exitCode = 0;
  } else {
    exitCode = await publicationRun(opts);
  }
} catch (e) {
  const code = e instanceof FatalError ? e.code : "run-failure";
  const detail = e instanceof FatalError ? e.detail : String(e && e.stack || e);
  process.stderr.write(canonicalJson({ ok: false, error: { code, detail } }) + "\n");
  exitCode = code === "invalid-arguments" ? 2 : 1;
}
process.exit(exitCode);
