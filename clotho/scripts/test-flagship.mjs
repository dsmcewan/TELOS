#!/usr/bin/env node
// test-flagship.mjs — Task 6: flagship acceptance and skipped-source coverage
// failure (plan v15, docs/runs/clotho-daedalus-delta14/matured-plan-v15.md
// lines 1910-2021; matured approach docs/runs/clotho-slice6-daedalus/).
//
// Two REAL full-repository weaves (spawned CLI, each under the frozen 120s
// ceiling): (A) the flagship run — verifyLedger, header repository_ref equality,
// five-weaver executed manifest with D24-conformant counts, the D31 ledger
// contract-files cardinality, content-addressed inventories_consumed, and the
// D33/AM-34 closure equality for implementation_refs AND orchestrator_refs, all
// BEFORE any query; then `why` (all five expected kinds, ledger-only gaps
// empty), `blastRadius` depth 3 (coverage "verified", coverageUnknown []),
// one-to-one matching of the hand-audited eight-group expected set, the D3
// review set (fact-set minus matched, deterministically sorted, unscored,
// written next to the temporary output), and the currentDocs freshness re-run.
// (B) the `--skip clotho-doc-weaver` run — skipped-manifest semantics, no
// doc-weaver edge, EXACTLY the {coverage-unknown, clotho-doc-weaver,
// documented-in} gap (never missing-edge, never fabricated), D35 coverage in
// both directions, and the other seven groups (incl. the ledger-derived
// contract discharge) still matching with documentation expectations removed.
// Discriminating by construction: mutation checks prove a wrong expected
// blob_sha, a duplicated expectation, and a fabricated documented-in edge each
// fail. Temporary ledgers are cleaned in `finally` without masking a prior
// assertion. Plain node:assert/strict; zero dependencies.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyLedger } from "../thread-ledger.mjs";
import { canonicalJson, deriveNodeId, deriveRepositoryRef, validateLocator, validateSourceRef, docAddressKey } from "../registry.mjs";
import { why, blastRadius, threadsOf } from "../query.mjs";
import { deriveAcceptedClosure, makeGitRunner, splitMarkdownSections, walkFiles } from "../weavers/util.mjs";
import {
  WEAVERS, REQUIRED_INVENTORY_IDS, WEAVER_IMPL_FILES, WEAVER_ENTRY_MODULE,
  ORCHESTRATOR_FILES, ORCHESTRATOR_ENTRY_MODULES, PERMITTED_EXTERNAL_CLOSURE_FILES,
  CONTRACT_FILES, DOC_ROOTS, DOC_WEAVER_EXCLUDE, GLOBAL_EXCLUDE, FATAL_WARNING_CODES
} from "../inventory.mjs";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "..", "..");
const WEAVE_CLI = path.join(repoRoot, "clotho", "weave.mjs");
const ARTIFACT_PATH = path.join(scriptsDir, "expected-flagship.json");

// The frozen flagship target and the eight source groups (Task 6).
const FLAGSHIP = { path: "merkle-dag/obligation.mjs", symbol: "deriveExecutableRef" };
const GROUPS = ["definition", "consumers", "tests", "introduction", "documentation", "concern", "run-evidence", "contract"];
const GROUP_EDGE_KIND = {
  consumers: "depends-on", tests: "verified-by", introduction: "introduced-by",
  documentation: "documented-in", concern: "motivated-by", "run-evidence": "evidenced-by", contract: "discharges"
};
// All five expected rationale/support kinds of the flagship `why` call.
const FIVE_KINDS = ["introduced-by", "motivated-by", "documented-in", "evidenced-by", "discharges"];
const WEAVE_CEILING_MS = 120000; // the frozen per-weave runtime ceiling
const REPO_REF = /^git-root:[0-9a-f]{40}$/;
const HEX40 = /^[0-9a-f]{40}$/;
const FATAL = new Set(FATAL_WARNING_CODES);
const uid = `${process.pid}-${Date.now()}`;

const absOf = (rel) => path.join(repoRoot, ...rel.split("/"));

// ---- small structural helpers ------------------------------------------------

function requireKeys(obj, expected, label) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) throw new TypeError(`${label}: expected a plain object`);
  for (const k of Object.keys(obj)) if (!expected.includes(k)) throw new TypeError(`${label}: unexpected field '${k}'`);
  for (const k of expected) if (!Object.prototype.hasOwnProperty.call(obj, k)) throw new TypeError(`${label}: missing field '${k}'`);
}

const deepClone = (v) => JSON.parse(JSON.stringify(v));

// ---- expectation artifact validation (fail-closed, duplicate-rejecting) ------
// Match objects contain exact JSON values only: matching below is canonical-JSON
// equality — no regex, glob, prefix, short SHA, or node id can match anything.
// Every locator match must carry the FULL content-bound registry schema
// (validateLocator rejects missing/extra fields, short hashes, and node-id-like
// extras) with the stored audited repository_ref on every repository-scoped kind.

function validateExpectedArtifact(raw) {
  requireKeys(raw, ["clotho_expected_flagship", "expectations"], "expected-flagship");
  const header = raw.clotho_expected_flagship;
  if (header === null || typeof header !== "object" || Array.isArray(header)) throw new TypeError("expected-flagship: header must be an object");
  const storedRef = header.repository_ref;
  if (typeof storedRef !== "string" || !REPO_REF.test(storedRef)) throw new TypeError("expected-flagship: header.repository_ref must be 'git-root:<40-hex>'");
  const expectations = raw.expectations;
  if (!Array.isArray(expectations) || expectations.length === 0) throw new TypeError("expected-flagship: expectations must be a nonempty array");

  // Duplicate expectations are invalid.
  const seen = new Set();
  for (const e of expectations) {
    const cj = canonicalJson(e);
    if (seen.has(cj)) throw new Error(`expected-flagship: duplicate expectation: ${cj}`);
    seen.add(cj);
  }

  const byGroup = new Map(GROUPS.map((g) => [g, []]));
  for (const e of expectations) {
    if (e === null || typeof e !== "object") throw new TypeError("expected-flagship: entry must be an object");
    if (!GROUPS.includes(e.source_group)) throw new Error(`expected-flagship: unknown source_group ${JSON.stringify(e.source_group)}`);
    if (e.subject === "node") {
      requireKeys(e, ["source_group", "subject", "kind", "locator_match"], "node expectation");
      if (e.source_group !== "definition") throw new Error(`expected-flagship: node expectation in group '${e.source_group}' (only definition is a node group)`);
      validateLocator(e.kind, e.locator_match, { repositoryRef: storedRef });
    } else if (e.subject === "edge") {
      requireKeys(e, ["source_group", "subject", "edge_kind", "from_kind", "from_locator_match", "to_kind", "to_locator_match", "source_ref"], "edge expectation");
      if (e.source_group === "definition") throw new Error("expected-flagship: definition must be a node expectation");
      validateLocator(e.from_kind, e.from_locator_match, { repositoryRef: storedRef });
      validateLocator(e.to_kind, e.to_locator_match, { repositoryRef: storedRef });
      validateSourceRef(e.source_ref);
      if (e.edge_kind !== GROUP_EDGE_KIND[e.source_group]) {
        throw new Error(`expected-flagship: group '${e.source_group}' requires edge_kind ${GROUP_EDGE_KIND[e.source_group]}, got ${JSON.stringify(e.edge_kind)}`);
      }
    } else {
      throw new Error(`expected-flagship: unknown subject ${JSON.stringify(e.subject)}`);
    }
    byGroup.get(e.source_group).push(e);
  }
  for (const g of GROUPS) {
    if (byGroup.get(g).length === 0) throw new Error(`expected-flagship: group '${g}' is absent (all eight groups must be present)`);
  }

  // definition: exactly the flagship target node.
  const defs = byGroup.get("definition");
  if (defs.length !== 1) throw new Error("expected-flagship: exactly one definition expectation is required");
  const targetLoc = defs[0].locator_match;
  if (defs[0].kind !== "code-symbol" || targetLoc.path !== FLAGSHIP.path || targetLoc.symbol !== FLAGSHIP.symbol) {
    throw new Error("expected-flagship: definition must locate the flagship code-symbol merkle-dag/obligation.mjs#deriveExecutableRef");
  }
  const targetKey = canonicalJson(targetLoc);
  const isTargetSide = (kind, loc) => kind === "code-symbol" && canonicalJson(loc) === targetKey;

  // consumers: incoming depends-on edges at the target.
  for (const e of byGroup.get("consumers")) {
    if (!isTargetSide(e.to_kind, e.to_locator_match)) throw new Error("expected-flagship: consumer expectation must point at the definition target");
    if (e.from_kind !== "code-symbol" && e.from_kind !== "repository-file") throw new Error("expected-flagship: consumer endpoint must be code-symbol or repository-file");
  }

  // tests: reachable verified-by edges with D25-correct provenance — each entry
  // is exactly one of: import-derived (source_ref = the TEST FILE's own content
  // address) or command-inferred (source_ref = the package.json content
  // address); at least one of EACH case must be present.
  let importDerived = 0;
  let commandInferred = 0;
  for (const e of byGroup.get("tests")) {
    if (e.to_kind !== "test") throw new Error("expected-flagship: test expectation must target a test node");
    if (e.from_kind !== "code-symbol" && e.from_kind !== "repository-file") throw new Error("expected-flagship: test evidence endpoint must be code-symbol or repository-file");
    const to = e.to_locator_match;
    const isImport = e.source_ref === `file:${to.path}@${to.blob_sha}`;
    const at = e.source_ref.lastIndexOf("@");
    const refPath = e.source_ref.startsWith("file:") && at > 5 ? e.source_ref.slice(5, at) : "";
    const isCommand = refPath.split("/").pop() === "package.json";
    if (isImport === isCommand) throw new Error(`expected-flagship: test expectation must be exactly one of import-derived or command-inferred (D25): ${e.source_ref}`);
    if (isImport) importDerived++; else commandInferred++;
  }
  if (importDerived === 0 || commandInferred === 0) throw new Error("expected-flagship: both D25 verified-by provenance cases are required (import-derived AND command-inferred)");

  // introduction: the target's introduced-by with the audited full 40-hex SHA.
  for (const e of byGroup.get("introduction")) {
    if (!isTargetSide(e.from_kind, e.from_locator_match)) throw new Error("expected-flagship: introduction must originate at the target");
    if (e.to_kind !== "commit" || !HEX40.test(e.to_locator_match.sha)) throw new Error("expected-flagship: introduction must target a full 40-hex commit");
    if (e.source_ref !== `git:${e.to_locator_match.sha}`) throw new Error("expected-flagship: introduction source_ref must be git:<the audited introduction sha>");
  }

  // documentation: the target's documented-in, targeting doc-section.
  for (const e of byGroup.get("documentation")) {
    if (!isTargetSide(e.from_kind, e.from_locator_match)) throw new Error("expected-flagship: documentation must originate at the target");
    if (e.to_kind !== "doc-section") throw new Error("expected-flagship: documentation must target a doc-section");
  }

  // concern: the target's motivated-by, ledger-addressed.
  for (const e of byGroup.get("concern")) {
    if (!isTargetSide(e.from_kind, e.from_locator_match)) throw new Error("expected-flagship: concern must originate at the target");
    if (e.to_kind !== "concern") throw new Error("expected-flagship: concern must target a concern node");
    const to = e.to_locator_match;
    if (e.source_ref !== `ledger:${to.ledger_path}#${to.entry_hash}`) throw new Error("expected-flagship: concern source_ref must be the exact ledger content address");
  }

  // run-evidence: the target's evidenced-by.
  for (const e of byGroup.get("run-evidence")) {
    if (!isTargetSide(e.from_kind, e.from_locator_match)) throw new Error("expected-flagship: run-evidence must originate at the target");
    if (e.to_kind !== "run-evidence") throw new Error("expected-flagship: run-evidence must target a run-evidence node");
    if (!e.source_ref.startsWith("file:")) throw new Error("expected-flagship: run-evidence source_ref must be a file content address");
  }

  // contract: the audited spec v2.3 two-hop discharge walk ending at a
  // contract-clause: code-symbol --discharges--> obligation --discharges-->
  // contract-clause, with ledger source refs.
  const hop1To = [];
  const hop2 = [];
  for (const e of byGroup.get("contract")) {
    if (!e.source_ref.startsWith("ledger:")) throw new Error("expected-flagship: contract source_ref must be a ledger content address");
    if (isTargetSide(e.from_kind, e.from_locator_match) && e.to_kind === "obligation") hop1To.push(canonicalJson(e.to_locator_match));
    else if (e.from_kind === "obligation" && e.to_kind === "contract-clause") hop2.push(e);
    else throw new Error("expected-flagship: contract expectation is neither hop of the two-hop discharge walk");
  }
  if (hop1To.length === 0 || hop2.length === 0) throw new Error("expected-flagship: the contract group must contain both hops of the discharge walk");
  for (const e of hop2) {
    if (!hop1To.includes(canonicalJson(e.from_locator_match))) throw new Error("expected-flagship: a clause discharge must chain from an expected obligation (walk continuity)");
  }

  return { storedRef, targetLoc, expectations, byGroup };
}

// ---- fact tuples + one-to-one matching ---------------------------------------

const edgeTuple = (r) => ({
  subject: "edge", edge_kind: r.edge_kind,
  from_kind: r.from_locator.kind, from_locator: r.from_locator.locator,
  to_kind: r.to_locator.kind, to_locator: r.to_locator.locator,
  source_ref: r.source_ref
});
const expectationTuple = (e) => e.subject === "node"
  ? { subject: "node", kind: e.kind, locator: e.locator_match }
  : { subject: "edge", edge_kind: e.edge_kind, from_kind: e.from_kind, from_locator: e.from_locator_match, to_kind: e.to_kind, to_locator: e.to_locator_match, source_ref: e.source_ref };

// The fact set: the stable union of the target node (its descriptor built solely
// from the derived repository_ref plus the audited blob), why.chain, and
// blastRadius.edges — endpoint descriptors come only from the verified records.
function buildFactSet(targetDescriptor, whyResult, brResult) {
  const edgeByHash = new Map();
  for (const r of [...whyResult.chain, ...brResult.edges]) if (!edgeByHash.has(r.record_hash)) edgeByHash.set(r.record_hash, r);
  const tuples = [{ subject: "node", kind: targetDescriptor.kind, locator: targetDescriptor.locator }, ...[...edgeByHash.values()].map(edgeTuple)];
  const byKey = new Map();
  for (const t of tuples) {
    const k = canonicalJson(t);
    if (byKey.has(k)) throw new Error(`flagship fact set: duplicate fact tuple ${k}`);
    byKey.set(k, t);
  }
  return byKey;
}

// One-to-one matching: every (non-excluded) expectation must match exactly one
// fact, one fact can satisfy only one expectation, and every unexpected fact is
// returned as the review set — never silently validated, never used to hide a
// missing match, never scored.
function matchExpectations(expectations, factByKey, excludeGroups = new Set()) {
  const claimed = new Set();
  let considered = 0;
  for (const e of expectations) {
    if (excludeGroups.has(e.source_group)) continue;
    considered++;
    const key = canonicalJson(expectationTuple(e));
    if (!factByKey.has(key)) throw new Error(`flagship: unmatched expectation (${e.source_group}): ${key}`);
    if (claimed.has(key)) throw new Error(`flagship: one returned fact cannot satisfy two expectations (${e.source_group})`);
    claimed.add(key);
  }
  const unmatched = [...factByKey.keys()].filter((k) => !claimed.has(k)).sort().map((k) => factByKey.get(k));
  return { claimed, considered, unmatched };
}

// ---- weave spawning (Step 1 / Step 4) ----------------------------------------

function spawnWeave(outRel, extraArgs) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [WEAVE_CLI, ...extraArgs, "--out", outRel], {
    cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 600000
  });
  const wallMs = Date.now() - t0;
  assert.ok(!r.error, `weave spawn failed: ${r.error && r.error.message}`);
  assert.equal(r.status, 0, `weave exited ${r.status}; stderr: ${(r.stderr || "").slice(0, 2000)}`);
  const lines = String(r.stdout).trim().split("\n");
  const res = JSON.parse(lines[lines.length - 1]);
  assert.equal(res.ok, true, "weave result must be ok");
  assert.equal(res.publication, "published", "publication state must be 'published' (clean)");
  assert.equal(res.error, null, "weave must report no error");
  assert.equal(res.out, outRel, "weave must publish to the requested destination");
  assert.equal(res.fatal_warning_count, 0, "no fatal warning may accompany a published weave");
  assert.ok(!res.warnings.some((w) => typeof w.code === "string" && FATAL.has(w.code)), "no warning may carry a fatal code");
  assert.ok(res.edge_count > 0 && res.ledger_bytes > 0, "a real weave has edges and bytes");
  assert.ok(wallMs < WEAVE_CEILING_MS, `weave wall time ${wallMs}ms must be below the ${WEAVE_CEILING_MS}ms ceiling`);
  return { res, wallMs };
}

// ---- manifest checks (Step 2 / Step 4, all BEFORE any query) -----------------

function checkExecutedManifest(v, gitBlob, { skipDoc = false } = {}) {
  const allowExternal = new Set(PERMITTED_EXTERNAL_CLOSURE_FILES);
  assert.equal(v.manifest.weavers.length, WEAVERS.length, "manifest carries the five weavers");
  for (let i = 0; i < WEAVERS.length; i++) {
    const id = WEAVERS[i].id;
    const w = v.manifest.weavers[i];
    assert.equal(w.id, id, "manifest weaver order matches the committed inventory order");
    const expectSkipped = skipDoc && id === "clotho-doc-weaver";
    assert.equal(w.state, expectSkipped ? "skipped" : "executed", `weaver ${id} state`);
    assert.ok(w.state === "executed" || w.state === "skipped", "'failed' never appears in a published manifest");
    // D24: exactly the frozen required inventory ids, sorted, safe-integer counts.
    const requiredSorted = [...REQUIRED_INVENTORY_IDS[id]].sort();
    assert.deepEqual(w.inspected_source_counts.map((c) => c.inventory_id), requiredSorted, `weaver ${id} count ids follow the frozen table`);
    for (const c of w.inspected_source_counts) {
      assert.ok(Number.isSafeInteger(c.count) && c.count >= 0, `weaver ${id} count ${c.inventory_id} is a nonnegative safe integer`);
      if (expectSkipped) assert.equal(c.count, 0, "a skipped weaver carries zero counts over its required inventory ids");
    }
    if (id === "clotho-ledger-weaver") {
      const cf = w.inspected_source_counts.find((c) => c.inventory_id === "contract-files");
      assert.equal(cf.count, CONTRACT_FILES.length, "D31: ledger-weaver contract-files count equals the committed contract-files inventory cardinality");
    }
    // D33/AM-34: implementation_refs equal the independently derived accepted
    // module-load closure of the weaver's entry module — and that closure equals
    // the committed inventory (test 23 closure-equality reproduction).
    const derived = deriveAcceptedClosure(absOf(WEAVER_ENTRY_MODULE[id]), { repoRoot, allowExternal });
    assert.deepEqual(derived, [...WEAVER_IMPL_FILES[id]], `committed implementation inventory for ${id} equals the derived closure`);
    assert.deepEqual(w.implementation_refs, derived.map((f) => `file:${f}@${gitBlob(f)}`), `manifest implementation_refs for ${id} equal the independently derived closure refs`);
  }
  // Orchestrator closure equality (D33/AM-34).
  const union = new Set();
  for (const entry of ORCHESTRATOR_ENTRY_MODULES) for (const m of deriveAcceptedClosure(absOf(entry), { repoRoot, allowExternal })) union.add(m);
  const orch = [...union].sort();
  assert.deepEqual(orch, [...ORCHESTRATOR_FILES], "committed orchestrator inventory equals the derived closure");
  assert.deepEqual(v.manifest.orchestrator_refs, orch.map((f) => `file:${f}@${gitBlob(f)}`), "manifest orchestrator_refs equal the independently derived closure refs");
  // Content-addressed inventories_consumed (checked before any query).
  assert.ok(Array.isArray(v.manifest.inventories_consumed) && v.manifest.inventories_consumed.length > 0, "inventories_consumed is nonempty");
  for (const entry of v.manifest.inventories_consumed) {
    requireKeys(entry, ["id", "source_ref"], "inventories_consumed entry");
    assert.ok(entry.source_ref.startsWith("file:"), "inventories_consumed entries are content-addressed");
    validateSourceRef(entry.source_ref);
  }
  const invEntry = v.manifest.inventories_consumed.find((e) => e.id === "clotho/inventory.mjs");
  assert.ok(invEntry, "the committed inventory itself is a consumed, content-addressed input");
  assert.equal(invEntry.source_ref, `file:clotho/inventory.mjs@${gitBlob("clotho/inventory.mjs")}`, "inventory content address matches disk ground truth");
}

// ---- currentDocs (freshness re-run; the ONLY step that reads current files) --

function buildCurrentDocs() {
  const currentDocs = new Map();
  const excluded = (rel, roots) => roots.some((x) => rel === x || rel.startsWith(x + "/"));
  const docFiles = walkFiles(repoRoot, DOC_ROOTS)
    .filter((p) => p.endsWith(".md"))
    .filter((p) => !excluded(p, DOC_WEAVER_EXCLUDE))
    .filter((p) => !excluded(p, GLOBAL_EXCLUDE));
  for (const rel of docFiles) {
    const { sections, duplicatePaths } = splitMarkdownSections(readFileSync(absOf(rel)));
    for (const sec of sections) {
      let key;
      // A current heading that cannot form a canonical address is not an
      // addressable section; a woven target pointing at it correctly reads as
      // missing (drift), so skipping here stays fail-closed.
      try { key = docAddressKey({ path: rel, heading_path: sec.heading_path }); } catch { continue; }
      if (duplicatePaths.has(JSON.stringify(sec.heading_path))) currentDocs.set(key, null); // ambiguous current address
      else currentDocs.set(key, sec.text_sha256);
    }
  }
  return currentDocs;
}

// ---- main --------------------------------------------------------------------

const temps = [];
let bodySucceeded = false;
try {
  const git = makeGitRunner(repoRoot);
  const gitBlob = (rel) => {
    const sha = String(git(["hash-object", "--no-filters", "--", rel])).replace(/\r?\n$/, "");
    assert.ok(HEX40.test(sha), `bad blob sha for ${rel}`);
    return sha;
  };
  const derivedRef = deriveRepositoryRef(git);

  // The hand-audited artifact — validated fail-closed before anything runs.
  const rawArtifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
  const art = validateExpectedArtifact(rawArtifact);
  // R1 (matured approach): the artifact STORES the audited repository_ref; the
  // test independently derives it and asserts equality — it never rewrites it.
  assert.equal(art.storedRef, derivedRef, "stored audited repository_ref equals the independently derived value");
  const auditedBlob = art.targetLoc.blob_sha;
  assert.equal(auditedBlob, gitBlob(FLAGSHIP.path), "audited target blob_sha equals the current on-disk blob (stale hash => re-audit trigger)");

  // ---- Step 1: full real-repository weave (spawned) --------------------------
  const outA = `.telos/clotho/flagship-${uid}-a.jsonl`;
  const outAAbs = absOf(outA);
  temps.push(outAAbs);
  const runA = spawnWeave(outA, []);
  console.log(`test-flagship: weave A published — ${runA.res.edge_count} edges, ${runA.res.ledger_bytes} bytes, ${runA.wallMs}ms, ${runA.res.warnings.length} nonfatal warning(s)`);
  for (const w of runA.res.warnings) console.log(`test-flagship:   nonfatal: ${canonicalJson(w)}`);

  // ---- Step 2: verification + manifest/closure checks BEFORE any query -------
  const vA = await verifyLedger(outAAbs);
  assert.equal(vA.ok, true, `weave A verification failed: ${vA.errors.join("; ")}`);
  assert.deepEqual(vA.errors, [], "weave A verifies with no errors");
  assert.ok(vA.manifest !== null, "weave A yields a verified manifest");
  assert.equal(vA.header.repository_ref, derivedRef, "verified header repository_ref equals the independently derived value");
  checkExecutedManifest(vA, gitBlob);
  // From here on, queries use ONLY vA.records and vA.manifest; verification has
  // already established every weaver-asserted edge agrees with the manifest.

  // ---- Step 3: flagship queries, eight-group matching, review set ------------
  const target = { kind: "code-symbol", locator: { repository_ref: derivedRef, path: FLAGSHIP.path, symbol: FLAGSHIP.symbol, blob_sha: auditedBlob } };
  const targetId = deriveNodeId(target);

  const whyA = why(vA.records, targetId, { expectedKinds: [...FIVE_KINDS], manifest: vA.manifest });
  assert.deepEqual(whyA.gaps, [], "ledger-only why.gaps must be empty across all five expected kinds");
  const brA = blastRadius(vA.records, targetId, 3, { manifest: vA.manifest });
  assert.equal(brA.coverage, "verified", "blastRadius under the verified manifest reports coverage 'verified' (D35)");
  assert.deepEqual(brA.coverageUnknown, [], "blastRadius coverageUnknown is [] under full execution (D35)");

  const factsA = buildFactSet(target, whyA, brA);
  const matchA = matchExpectations(art.expectations, factsA);
  assert.equal(matchA.claimed.size, art.expectations.length, "every expectation obtains a distinct match (all eight groups)");
  assert.equal(matchA.claimed.size + matchA.unmatched.length, factsA.size, "review set is exactly the fact set minus the matched facts");

  // D3 review set: deterministically sorted, unscored, written next to the
  // test's temporary output (publication into run evidence happens separately).
  for (const t of matchA.unmatched) {
    const keys = Object.keys(t).sort();
    assert.ok(t.subject === "node" ? keys.join(",") === "kind,locator,subject" : keys.join(",") === "edge_kind,from_kind,from_locator,source_ref,subject,to_kind,to_locator",
      "review-set entries carry only content-bound fields — no relevance, rank, or confidence of any kind");
  }
  const reviewSet = {
    kind: "clotho-flagship-review-set",
    note: "Unexpected facts in the flagship neighborhood (fact-set minus matched), deterministically sorted; reported for review, never scored (D3 — relevance is Lachesis's domain, non-claimed).",
    repository_ref: derivedRef,
    target: target.locator,
    fact_count: factsA.size,
    matched_count: matchA.claimed.size,
    unmatched: matchA.unmatched
  };
  const reviewTmp = absOf(`.telos/clotho/flagship-${uid}-review-set.json`);
  temps.push(reviewTmp);
  writeFileSync(reviewTmp, JSON.stringify(reviewSet, null, 2) + "\n");
  assert.equal(JSON.parse(readFileSync(reviewTmp, "utf8")).unmatched.length, matchA.unmatched.length, "review-set artifact round-trips");
  console.log(`test-flagship: fact set ${factsA.size}, matched ${matchA.claimed.size}, review set ${matchA.unmatched.length} (written next to the temporary output)`);
  for (const g of GROUPS) console.log(`test-flagship:   group ${g}: ${art.byGroup.get(g).length} expectation(s) matched`);

  // currentDocs freshness re-run (this check alone reads current files; the
  // preceding fact reconstruction is strictly ledger-only).
  const whyFresh = why(vA.records, targetId, { expectedKinds: [...FIVE_KINDS], currentDocs: buildCurrentDocs(), manifest: vA.manifest });
  assert.deepEqual(whyFresh.gaps, [], "currentDocs freshness re-run reports no drift gap");

  // ---- Step 4: the --skip clotho-doc-weaver run ------------------------------
  const outB = `.telos/clotho/flagship-${uid}-b.jsonl`;
  const outBAbs = absOf(outB);
  temps.push(outBAbs);
  const runB = spawnWeave(outB, ["--skip", "clotho-doc-weaver"]);
  console.log(`test-flagship: weave B (doc-weaver skipped) published — ${runB.res.edge_count} edges, ${runB.res.ledger_bytes} bytes, ${runB.wallMs}ms`);

  const vB = await verifyLedger(outBAbs);
  assert.equal(vB.ok, true, `weave B verification failed: ${vB.errors.join("; ")}`);
  assert.ok(vB.manifest !== null, "weave B yields a verified manifest");
  assert.equal(vB.header.repository_ref, derivedRef, "weave B header repository_ref equals the derived value");
  checkExecutedManifest(vB, gitBlob, { skipDoc: true });
  assert.ok(vB.records.every((r) => r.asserted_by !== "clotho-doc-weaver"), "no edge is asserted by the skipped clotho-doc-weaver");
  assert.ok(vB.records.every((r) => r.edge_kind !== "documented-in"), "no documented-in edge is fabricated under the skip");

  const whyB = why(vB.records, targetId, { expectedKinds: [...FIVE_KINDS], manifest: vB.manifest });
  assert.deepEqual(whyB.gaps, [{ gap: "coverage-unknown", weaver: "clotho-doc-weaver", expected_kind: "documented-in" }],
    "EXACTLY the coverage-unknown gap for the skipped doc weaver — never a missing-edge claim, and no other gap");

  const brBNoManifest = blastRadius(vB.records, targetId, 3);
  assert.equal(brBNoManifest.coverage, "unverified", "blastRadius without a manifest reports coverage 'unverified' (D35)");
  assert.deepEqual(brBNoManifest.coverageUnknown, ["clotho-code-weaver", "clotho-test-weaver"],
    "a missing manifest conservatively reports EVERY consulted producer unknown (non-empty)");
  const brB = blastRadius(vB.records, targetId, 3, { manifest: vB.manifest });
  assert.equal(brB.coverage, "verified", "blastRadius with the verified skip-manifest reports 'verified'");
  assert.deepEqual(brB.coverageUnknown, [], "blastRadius consults code/test weavers only, both executed");
  const thB = threadsOf(vB.records, targetId, { manifest: vB.manifest });
  assert.equal(thB.coverage, "verified", "threadsOf with the verified skip-manifest reports 'verified'");
  assert.deepEqual(thB.coverageUnknown, ["clotho-doc-weaver"], "the skipped doc weaver is NAMED when its kinds are consulted (D35/AM-37)");

  // Documentation expectations removed; the other seven groups — including the
  // ledger-derived contract discharge resolved from the ledger weaver's own
  // counted contract-files consumption (D31) — still match distinctly.
  const factsB = buildFactSet(target, whyB, brB);
  const matchB = matchExpectations(art.expectations, factsB, new Set(["documentation"]));
  assert.equal(matchB.considered, art.expectations.length - art.byGroup.get("documentation").length, "exactly the documentation expectations are removed for the negative run");
  assert.equal(matchB.claimed.size, matchB.considered, "the other seven groups still match distinctly under the doc skip");

  // ---- Mutation checks: the oracle is discriminating -------------------------
  const flipHex = (s) => s.slice(0, -1) + (s.endsWith("0") ? "1" : "0");
  const mutate = (fn) => { const c = deepClone(rawArtifact); fn(c); return c; };
  const validateAndMatch = (raw) => { const a = validateExpectedArtifact(raw); matchExpectations(a.expectations, factsA); };

  const mutWrongDefBlob = mutate((c) => {
    const d = c.expectations.find((e) => e.source_group === "definition");
    d.locator_match.blob_sha = flipHex(d.locator_match.blob_sha);
  });
  // A wrong definition blob_sha fails closed at the earliest tripwire: every
  // consumer/test/... expectation cross-references the target locator, so group
  // validation itself may reject before content-bound matching would.
  assert.throws(() => validateAndMatch(mutWrongDefBlob), /unmatched expectation|must point at the definition target/, "a wrong expected blob_sha (definition) must fail");

  const mutWrongConsumerBlob = mutate((c) => {
    const d = c.expectations.find((e) => e.source_group === "consumers");
    d.from_locator_match.blob_sha = flipHex(d.from_locator_match.blob_sha);
  });
  assert.throws(() => validateAndMatch(mutWrongConsumerBlob), /unmatched expectation/, "a wrong expected blob_sha (consumer) must fail");

  const mutDuplicate = mutate((c) => {
    c.expectations.push(deepClone(c.expectations.find((e) => e.source_group === "consumers")));
  });
  assert.throws(() => validateAndMatch(mutDuplicate), /duplicate expectation/, "a duplicated expectation must be rejected as invalid");

  const mutFabricatedDoc = mutate((c) => {
    c.expectations.push({
      source_group: "documentation", subject: "edge", edge_kind: "documented-in",
      from_kind: "code-symbol", from_locator_match: deepClone(art.targetLoc),
      to_kind: "doc-section",
      to_locator_match: { repository_ref: art.storedRef, path: "docs/STATUS.md", heading_path: ["Fabricated section"], text_sha256: "0".repeat(64) },
      source_ref: `file:docs/STATUS.md@${"0".repeat(40)}`
    });
  });
  assert.throws(() => validateAndMatch(mutFabricatedDoc), /unmatched expectation/, "a fabricated documented-in edge must fail");
  console.log("test-flagship: mutation checks failed as required (wrong blob_sha x2, duplicate, fabricated documented-in)");

  console.log(`test-flagship: wall times — weave A ${runA.wallMs}ms, weave B ${runB.wallMs}ms (ceiling ${WEAVE_CEILING_MS}ms each)`);
  bodySucceeded = true;
} finally {
  // Temporary-ledger cleanup that never masks a prior assertion: on a body
  // failure the original error propagates and cleanup problems are only logged;
  // after a green body a cleanup failure fails the test in its own right.
  const cleanupErrors = [];
  for (const t of temps) {
    try { unlinkSync(t); } catch (e) { if (!e || e.code !== "ENOENT") cleanupErrors.push(`${t}: ${e && e.message}`); }
  }
  if (cleanupErrors.length > 0) {
    if (bodySucceeded) throw new Error(`test-flagship: temporary cleanup failed: ${cleanupErrors.join("; ")}`);
    console.error(`test-flagship: cleanup errors (not masking the original failure): ${cleanupErrors.join("; ")}`);
  }
}

console.log("test-flagship: all assertions passed");
