#!/usr/bin/env node
// test-registry.mjs — Task 2. Real coverage of clotho/registry.mjs: closed
// registries (incl. the forEach mutation-boundary), canonical identity, per-kind
// locator/source/status/endpoint validation, explicit edge id-vs-locator checks,
// and the deriveRepositoryRef shallow/full-clone contract proven against BOTH
// injected git and a real-git fixture driven through a PRIVATE, fixture-only,
// no-shell git allowlist (D18). Plain node:assert/strict; runs in a fresh Node
// process via test-all.mjs.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  NODE_KINDS, EDGE_KINDS, ASSERTION_STATUS,
  canonicalJson, deriveNodeId, validateLocator, validateSourceRef,
  validateAssertionStatus, validateEdgeInput, docAddressKey, deriveRepositoryRef
} from "../registry.mjs";

const HEX40A = "0123456789abcdef0123456789abcdef01234567";
const HEX40B = "fedcba9876543210fedcba9876543210fedcba98";
const HEX64A = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const HEX64B = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const REPO = "git-root:" + HEX40A;
const isShallow = (e) => e && e.code === "CLOTHO_SHALLOW_REPOSITORY";

// ---- 1. closed-set membership + counts --------------------------------------
{
  assert.equal(NODE_KINDS.size, 11);
  assert.equal(EDGE_KINDS.size, 8);
  assert.equal(ASSERTION_STATUS.size, 5);
  for (const k of ["contract-clause", "code-symbol", "repository-file", "test", "commit",
    "concern", "obligation", "check-contract", "run-evidence", "doc-section", "decision"]) {
    assert.ok(NODE_KINDS.has(k), `NODE_KINDS has ${k}`);
  }
  for (const k of ["depends-on", "introduced-by", "motivated-by", "verified-by",
    "documented-in", "evidenced-by", "discharges", "supersedes"]) {
    assert.ok(EDGE_KINDS.has(k), `EDGE_KINDS has ${k}`);
  }
  for (const s of ["deterministic-extraction", "human-authorized", "model-proposal", "rejected", "superseded"]) {
    assert.ok(ASSERTION_STATUS.has(s), `ASSERTION_STATUS has ${s}`);
  }
  assert.ok(!NODE_KINDS.has("unknown-kind"));
  assert.ok(!EDGE_KINDS.has("references"));
  assert.ok(!ASSERTION_STATUS.has("approved"));
  assert.equal([...NODE_KINDS].length, 11);
  assert.equal([...NODE_KINDS.keys()].length, 11);
  assert.equal([...NODE_KINDS.values()].length, 11);
  assert.equal([...NODE_KINDS.entries()].length, 11);
  let counted = 0;
  NODE_KINDS.forEach(() => { counted++; });
  assert.equal(counted, 11);
}

// ---- 2. read-only facades: mutators throw, forEach can't reach the backing set
for (const [name, set] of [["NODE_KINDS", NODE_KINDS], ["EDGE_KINDS", EDGE_KINDS], ["ASSERTION_STATUS", ASSERTION_STATUS]]) {
  assert.throws(() => set.add("x"), /read-only/, `${name}.add throws`);
  assert.throws(() => set.delete("code-symbol"), /read-only/, `${name}.delete throws`);
  assert.throws(() => set.clear(), /read-only/, `${name}.clear throws`);
  // forEach's third argument is the read-only facade, NOT the private Set:
  // a callback cannot mutate the backing registry through it.
  let third;
  set.forEach((v, v2, s) => { third = s; assert.equal(v, v2); });
  assert.equal(third, set, `${name}.forEach third arg is the facade`);
  assert.throws(() => third.add("x"), /read-only/, `${name}.forEach arg is not mutable`);
}

// ---- 3. canonicalJson -------------------------------------------------------
{
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
  const v = { kind: "x", locator: { path: "a/b", n: [1, 2, 3] } };
  assert.equal(canonicalJson(v), canonicalJson(v));
  assert.throws(() => canonicalJson(undefined), /undefined/);
  assert.throws(() => canonicalJson(NaN), /non-finite/);
  assert.throws(() => canonicalJson(Infinity), /non-finite/);
  assert.throws(() => canonicalJson(10n), /bigint/);
  assert.throws(() => canonicalJson(() => 1), /function/);
  assert.throws(() => canonicalJson(Symbol("s")), /symbol/);
  const sparse = [1]; sparse[2] = 3;
  assert.throws(() => canonicalJson(sparse), /sparse/);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), /cycle/);
  assert.throws(() => canonicalJson(Object.create({ inherited: 1 })), /non-plain/);
}

// ---- 4. locators: valid instances for every kind ----------------------------
const LOCATORS = {
  "code-symbol": { repository_ref: REPO, path: "clotho/registry.mjs", symbol: "deriveNodeId", blob_sha: HEX40A },
  "repository-file": { repository_ref: REPO, path: "clotho/registry.mjs", blob_sha: HEX40A },
  "test": { repository_ref: REPO, path: "clotho/scripts/test-registry.mjs", blob_sha: HEX40A },
  "commit": { sha: HEX40B },
  "doc-section": { repository_ref: REPO, path: "docs/x.md", heading_path: ["Title", "Section"], text_sha256: HEX64A },
  "contract-clause": { repository_ref: REPO, path: "contracts/x.md", heading_path: ["A"], text_sha256: HEX64A },
  "decision": { repository_ref: REPO, path: "docs/decisions.md", heading_path: ["D1"], text_sha256: HEX64A },
  "concern": { repository_ref: REPO, ledger_path: "docs/runs/x/ledger.jsonl", entry_hash: HEX64A },
  "obligation": { repository_ref: REPO, ledger_path: "docs/runs/x/ledger.jsonl", entry_hash: HEX64B },
  "check-contract": { repository_ref: REPO, path: "contracts/check.md", contract_id: "gate-1", blob_sha: HEX40A },
  "run-evidence": { repository_ref: REPO, path: "docs/runs/clotho-self-weave", summary_sha256: HEX64A }
};
for (const [kind, loc] of Object.entries(LOCATORS)) {
  validateLocator(kind, loc, { repositoryRef: REPO });
}
assert.throws(() => validateLocator("commit", { sha: HEX40B, repository_ref: REPO }), /unexpected field|expected keys/);
assert.throws(() => validateLocator("mystery", {}), /unknown kind/);

// ---- 5. locator rejections: per repository-scoped kind ----------------------
// Every repository-scoped kind must reject a missing repository_ref and a
// missing/short/uppercase content hash (D13 content-binding).
const CONTENT_FIELD = {
  "code-symbol": ["blob_sha", "40-hex"],
  "repository-file": ["blob_sha", "40-hex"],
  "test": ["blob_sha", "40-hex"],
  "doc-section": ["text_sha256", "64-hex"],
  "contract-clause": ["text_sha256", "64-hex"],
  "decision": ["text_sha256", "64-hex"],
  "concern": ["entry_hash", "64-hex"],
  "obligation": ["entry_hash", "64-hex"],
  "check-contract": ["blob_sha", "40-hex"],
  "run-evidence": ["summary_sha256", "64-hex"]
};
for (const [kind, base] of Object.entries(LOCATORS)) {
  if (kind === "commit") continue;
  const [field, label] = CONTENT_FIELD[kind];
  // missing repository_ref
  const noRepo = { ...base }; delete noRepo.repository_ref;
  assert.throws(() => validateLocator(kind, noRepo, { repositoryRef: REPO }), /missing field 'repository_ref'|expected keys/, `${kind} missing repository_ref`);
  // missing content hash
  const noHash = { ...base }; delete noHash[field];
  assert.throws(() => validateLocator(kind, noHash, { repositoryRef: REPO }), new RegExp(`missing field '${field}'|expected keys`), `${kind} missing ${field}`);
  // short + uppercase content hash
  assert.throws(() => validateLocator(kind, { ...base, [field]: "abc" }, { repositoryRef: REPO }), new RegExp(label), `${kind} short ${field}`);
  assert.throws(() => validateLocator(kind, { ...base, [field]: base[field].toUpperCase() }, { repositoryRef: REPO }), new RegExp(label), `${kind} uppercase ${field}`);
}
{
  // extra / caller-owned field
  assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: "a", blob_sha: HEX40A, woven_at: "x" }, { repositoryRef: REPO }), /unexpected field/);
  // inherited enumerable field is not counted as own -> missing 'blob_sha'
  const proto = { blob_sha: HEX40A };
  const inherited = Object.assign(Object.create(proto), { repository_ref: REPO, path: "a" });
  assert.throws(() => validateLocator("repository-file", inherited, { repositoryRef: REPO }), /plain object|missing|expected/);
  // wrong repository_ref
  assert.throws(() => validateLocator("repository-file", { repository_ref: "git-root:" + HEX40B, path: "a", blob_sha: HEX40A }, { repositoryRef: REPO }), /does not match/);
  // path rejections
  for (const bad of ["../etc", "/abs", "a/", "a\\b", "a/./b", "a//b", ""]) {
    assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: bad, blob_sha: HEX40A }, { repositoryRef: REPO }), /canonical POSIX/, `path ${JSON.stringify(bad)} rejected`);
  }
  // non-identifier symbol
  assert.throws(() => validateLocator("code-symbol", { repository_ref: REPO, path: "a", symbol: "9bad", blob_sha: HEX40A }, { repositoryRef: REPO }), /identifier/);
  // un-normalized / empty heading
  assert.throws(() => validateLocator("doc-section", { repository_ref: REPO, path: "d.md", heading_path: ["  spaced  "], text_sha256: HEX64A }, { repositoryRef: REPO }), /normalized/);
  assert.throws(() => validateLocator("doc-section", { repository_ref: REPO, path: "d.md", heading_path: [], text_sha256: HEX64A }, { repositoryRef: REPO }), /nonempty array/);
  // run-evidence outside docs/runs/
  assert.throws(() => validateLocator("run-evidence", { repository_ref: REPO, path: "elsewhere/x", summary_sha256: HEX64A }, { repositoryRef: REPO }), /docs\/runs/);
}

// ---- 5b. requireExactKeys is truly exact: pollution / non-enumerable / symbol
{
  const base = { repository_ref: REPO, path: "a", blob_sha: HEX40A };
  // inherited enumerable field via Object.prototype pollution is rejected
  Object.defineProperty(Object.prototype, "__evil__", { value: 1, enumerable: true, configurable: true });
  try {
    assert.throws(() => validateLocator("repository-file", { ...base }, { repositoryRef: REPO }), /inherited enumerable/);
  } finally {
    delete Object.prototype.__evil__;
  }
  // a non-enumerable required field cannot pass, and therefore cannot mint a
  // colliding node id (canonicalJson would omit it — D13 content binding).
  const hidden = { repository_ref: REPO, path: "a" };
  Object.defineProperty(hidden, "blob_sha", { value: HEX40A, enumerable: false });
  assert.throws(() => validateLocator("repository-file", hidden, { repositoryRef: REPO }), /own-enumerable/);
  assert.throws(() => deriveNodeId({ kind: "repository-file", locator: hidden }), /own-enumerable/);
  // symbol-keyed field rejected
  assert.throws(() => validateLocator("repository-file", { ...base, [Symbol("x")]: 1 }, { repositoryRef: REPO }), /symbol/);
  // NUL byte in a path is rejected (constructed at runtime; no literal NUL in source)
  const nulPath = "a" + String.fromCharCode(0) + "b";
  assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: nulPath, blob_sha: HEX40A }, { repositoryRef: REPO }), /canonical POSIX/);
}

// ---- 6. deriveNodeId: stability, content-bound distinctness, exact outer schema
{
  const a = deriveNodeId({ kind: "code-symbol", locator: LOCATORS["code-symbol"] });
  const a2 = deriveNodeId({ kind: "code-symbol", locator: { ...LOCATORS["code-symbol"] } });
  assert.equal(a, a2, "same descriptor -> same id");
  assert.match(a, /^[0-9a-f]{64}$/);
  const b = deriveNodeId({ kind: "code-symbol", locator: { ...LOCATORS["code-symbol"], blob_sha: HEX40B } });
  assert.notEqual(a, b, "distinct blob_sha -> distinct node id");
  assert.throws(() => deriveNodeId({ kind: "code-symbol", locator: { path: "a" } }), /unexpected field|missing|expected/);
  // exact outer schema: extra field on the descriptor is rejected
  assert.throws(() => deriveNodeId({ kind: "commit", locator: LOCATORS["commit"], extra: 1 }), /unexpected field/);
}

// ---- 7. source refs ---------------------------------------------------------
{
  validateSourceRef("git:" + HEX40A);
  validateSourceRef("file:clotho/registry.mjs@" + HEX40A);
  validateSourceRef("ledger:docs/runs/x/l.jsonl#" + HEX64A);
  assert.throws(() => validateSourceRef("http:" + HEX40A), /unknown scheme/);
  assert.throws(() => validateSourceRef("git:" + HEX40A.toUpperCase()), /40-hex/);
  assert.throws(() => validateSourceRef("file:clotho/x.mjs"), /missing '@/);
  assert.throws(() => validateSourceRef("ledger:docs/runs/x/l.jsonl"), /missing '#/);
  assert.throws(() => validateSourceRef("file:/abs@" + HEX40A), /canonical POSIX/);
  assert.throws(() => validateSourceRef("ledger:docs/runs/x/l.jsonl#" + HEX40A), /64-hex/);
  assert.throws(() => validateSourceRef(""), /nonempty/);
}

// ---- 8. status/assertor coupling --------------------------------------------
{
  validateAssertionStatus("clotho-git-weaver", "deterministic-extraction");
  validateAssertionStatus("human", "human-authorized");
  validateAssertionStatus("model:claude-fable-5", "model-proposal");
  assert.throws(() => validateAssertionStatus("clotho-git-weaver", "human-authorized"), /requires deterministic-extraction/);
  assert.throws(() => validateAssertionStatus("human", "deterministic-extraction"), /requires human-authorized/);
  assert.throws(() => validateAssertionStatus("model:x", "deterministic-extraction"), /requires model-proposal/);
  assert.throws(() => validateAssertionStatus("someone-else", "deterministic-extraction"), /unrecognized assertor/);
  // degenerate 'model:' with no seat is rejected
  assert.throws(() => validateAssertionStatus("model:", "model-proposal"), /unrecognized assertor/);
  assert.throws(() => validateAssertionStatus("human", "approved"), /unknown status/);
  assert.throws(() => validateAssertionStatus(" human", "human-authorized"), /trimmed/);
  assert.throws(() => validateAssertionStatus("a".repeat(129), "deterministic-extraction"), /128/);
  assert.throws(() => validateAssertionStatus("bad id", "human-authorized"), /stable identifier/);
  // table-driven: every assertor category x every status in the closed set
  const couplings = [
    { by: "clotho-git-weaver", ok: "deterministic-extraction" },
    { by: "human", ok: "human-authorized" },
    { by: "model:codex", ok: "model-proposal" }
  ];
  const allStatuses = ["deterministic-extraction", "human-authorized", "model-proposal", "rejected", "superseded"];
  for (const { by, ok } of couplings) {
    for (const st of allStatuses) {
      if (st === ok) validateAssertionStatus(by, st);
      else assert.throws(() => validateAssertionStatus(by, st), /requires/, `${by} x ${st} must be rejected`);
    }
  }
}

// ---- 9. edges: explicit id + locator, endpoint matrix -----------------------
const cs = { kind: "code-symbol", locator: LOCATORS["code-symbol"] };
const rf = { kind: "repository-file", locator: LOCATORS["repository-file"] };
const tst = { kind: "test", locator: LOCATORS["test"] };
const commit = { kind: "commit", locator: LOCATORS["commit"] };
const docSec = { kind: "doc-section", locator: LOCATORS["doc-section"] };
const clause = { kind: "contract-clause", locator: LOCATORS["contract-clause"] };
const concern = { kind: "concern", locator: LOCATORS["concern"] };
const obligation = { kind: "obligation", locator: LOCATORS["obligation"] };
const runEv = { kind: "run-evidence", locator: LOCATORS["run-evidence"] };

function edge(edge_kind, fromLoc, toLoc, asserted_by, assertion_status, source_ref, overrides = {}) {
  return {
    edge_kind,
    from_node: overrides.from_node ?? deriveNodeId(fromLoc),
    to_node: overrides.to_node ?? deriveNodeId(toLoc),
    from_locator: fromLoc,
    to_locator: toLoc,
    source_ref, asserted_by, assertion_status
  };
}
const W = "clotho-code-weaver";
const DET = "deterministic-extraction";
const SR = "git:" + HEX40A;

validateEdgeInput(edge("introduced-by", cs, commit, "clotho-git-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("introduced-by", rf, commit, "clotho-git-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("depends-on", cs, cs, W, DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("depends-on", cs, rf, W, DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("depends-on", rf, cs, W, DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("depends-on", rf, rf, W, DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("verified-by", cs, tst, "clotho-test-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("verified-by", rf, tst, "clotho-test-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("documented-in", cs, docSec, "clotho-doc-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("documented-in", cs, clause, "clotho-doc-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("documented-in", rf, docSec, "clotho-doc-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("documented-in", rf, clause, "clotho-doc-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("motivated-by", cs, concern, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("evidenced-by", cs, runEv, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("discharges", cs, obligation, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("discharges", obligation, clause, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });

// explicit id-vs-locator: a mismatched stated node id is rejected (not replaced)
assert.throws(() => validateEdgeInput(edge("depends-on", cs, cs, W, DET, SR, { from_node: HEX64B }), { repositoryRef: REPO }), /from_node .* does not match derived/);
assert.throws(() => validateEdgeInput(edge("depends-on", cs, cs, W, DET, SR, { to_node: HEX64B }), { repositoryRef: REPO }), /to_node .* does not match derived/);
// non-64-hex stated id
assert.throws(() => validateEdgeInput(edge("depends-on", cs, cs, W, DET, SR, { from_node: "abc" }), { repositoryRef: REPO }), /64-hex/);

// forbidden endpoints
assert.throws(() => validateEdgeInput(edge("depends-on", cs, tst, W, DET, SR), { repositoryRef: REPO }), /valid depends-on endpoint/);
assert.throws(() => validateEdgeInput(edge("discharges", obligation, cs, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO }), /valid discharges endpoint/);
assert.throws(() => validateEdgeInput(edge("introduced-by", cs, cs, "clotho-git-weaver", DET, SR), { repositoryRef: REPO }), /valid introduced-by endpoint/);
assert.throws(() => validateEdgeInput(edge("motivated-by", rf, concern, W, DET, SR), { repositoryRef: REPO }), /valid motivated-by endpoint/);
// unknown edge kind + extra caller-owned field
assert.throws(() => validateEdgeInput(edge("references", cs, cs, W, DET, SR), { repositoryRef: REPO }), /unknown edge_kind/);
assert.throws(() => validateEdgeInput({ ...edge("depends-on", cs, cs, W, DET, SR), woven_at: "t" }, { repositoryRef: REPO }), /unexpected field/);
// coupling enforced inside edge validation
assert.throws(() => validateEdgeInput(edge("depends-on", cs, cs, W, "human-authorized", SR), { repositoryRef: REPO }), /requires deterministic-extraction/);

// ---- 10. supersedes provenance ----------------------------------------------
{
  const oldRf = { kind: "repository-file", locator: { repository_ref: REPO, path: "old/name.mjs", blob_sha: HEX40A } };
  const newRf = { kind: "repository-file", locator: { repository_ref: REPO, path: "new/name.mjs", blob_sha: HEX40B } };
  validateEdgeInput(edge("supersedes", oldRf, newRf, "human", "human-authorized", SR), { repositoryRef: REPO });
  const csV1 = { kind: "code-symbol", locator: { ...LOCATORS["code-symbol"], blob_sha: HEX40A } };
  const csV2 = { kind: "code-symbol", locator: { ...LOCATORS["code-symbol"], blob_sha: HEX40B } };
  validateEdgeInput(edge("supersedes", csV1, csV2, "model:codex", "model-proposal", SR), { repositoryRef: REPO });
  assert.throws(() => validateEdgeInput(edge("supersedes", oldRf, cs, "human", "human-authorized", SR), { repositoryRef: REPO }), /share a kind/);
  assert.throws(() => validateEdgeInput(edge("supersedes", csV1, csV2, "clotho-code-weaver", DET, SR), { repositoryRef: REPO }), /'model:<seat>'/);
}

// ---- 11. docAddressKey ------------------------------------------------------
{
  const k = docAddressKey({ path: "docs/x.md", heading_path: ["Title", "Section"] });
  assert.equal(k, canonicalJson({ path: "docs/x.md", heading_path: ["Title", "Section"] }));
  assert.equal(docAddressKey({ heading_path: ["A"], path: "d.md" }), docAddressKey({ path: "d.md", heading_path: ["A"] }));
  assert.throws(() => docAddressKey({ path: "/abs", heading_path: ["A"] }), /canonical POSIX/);
  // exact outer schema: extra field rejected
  assert.throws(() => docAddressKey({ path: "d.md", heading_path: ["A"], extra: 1 }), /unexpected field/);
}

// ---- 12. deriveRepositoryRef: injected units --------------------------------
{
  const root = HEX40B;
  const happy = (args) => {
    if (args.join(" ") === "rev-parse --is-shallow-repository") return "false\n";
    if (args.join(" ") === "rev-list --max-parents=0 HEAD") return root + "\n";
    throw new Error("unexpected git args: " + args.join(" "));
  };
  assert.equal(deriveRepositoryRef(happy), "git-root:" + root);
  // also accepts no terminal newline
  assert.equal(deriveRepositoryRef((a) => a[0] === "rev-parse" ? "false" : root), "git-root:" + root);

  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? "true\n" : ""), isShallow, "shallow rejected");
  // malformed is-shallow output is DISTINCT from shallowness
  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? "yes\n" : ""), (e) => !isShallow(e) && /malformed is-shallow/.test(e.message));
  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? "false " : ""), /malformed is-shallow/, "trailing space is malformed, not trimmed");
  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? "false" : `${HEX40A}\n${HEX40B}\n`), /exactly one root/);
  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? "false" : "not-a-sha\n"), /malformed root/);
  // non-string runner outputs are malformed, never coerced
  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? false : ""), /non-string is-shallow/);
  assert.throws(() => deriveRepositoryRef((a) => a[0] === "rev-parse" ? "false" : {}), /non-string rev-list/);
  assert.throws(() => deriveRepositoryRef("not a function"), /must be a function/);
}

// ---- 13. deriveRepositoryRef: REAL git via a PRIVATE fixture-only allowlist --
// The wrapper the weavers use lands at Task 4a. For this fixture only, a private
// no-shell git runner permits exactly the command shapes needed to init an
// origin, build commits, and clone (shallow + full); every other shape throws.
{
  const permitted = (args) => {
    const c = args[0];
    if (c === "init") return args.length === 3 && args[1] === "-q";
    if (c === "config") return args.length === 3;
    if (c === "add") return args.length === 2;
    if (c === "commit") return args.length === 4 && args[1] === "-q" && args[2] === "-m";
    if (c === "rev-list") return args.length === 3 && args[1] === "--max-parents=0" && args[2] === "HEAD";
    if (c === "rev-parse") return args.length === 2 && args[1] === "--is-shallow-repository";
    if (c === "clone") {
      if (args[1] !== "-q") return false;
      if (args.length === 4) return true;                                   // clone -q <url> <dest>
      return args.length === 6 && args[2] === "--depth" && args[3] === "1"; // clone -q --depth 1 <url> <dest>
    }
    return false;
  };
  const fixtureGit = (cwd) => (args) => {
    if (!Array.isArray(args) || !permitted(args)) {
      throw new Error("fixture git: command not allowlisted: " + JSON.stringify(args));
    }
    return execFileSync("git", args, { cwd, shell: false, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  };

  // the allowlist itself is enforced
  assert.throws(() => fixtureGit(tmpdir())(["status"]), /not allowlisted/);
  assert.throws(() => fixtureGit(tmpdir())(["rev-parse", "HEAD"]), /not allowlisted/);

  const work = mkdtempSync(path.join(tmpdir(), "clotho-reg-git-"));
  try {
    const origin = path.join(work, "origin");
    const top = fixtureGit(work);
    top(["init", "-q", origin]);
    const gorigin = fixtureGit(origin);
    gorigin(["config", "user.email", "fixture@example.com"]);
    gorigin(["config", "user.name", "Fixture"]);
    gorigin(["config", "commit.gpgsign", "false"]);
    writeFileSync(path.join(origin, "a.txt"), "one\n");
    gorigin(["add", "a.txt"]);
    gorigin(["commit", "-q", "-m", "first"]);
    writeFileSync(path.join(origin, "b.txt"), "two\n");
    gorigin(["add", "b.txt"]);
    gorigin(["commit", "-q", "-m", "second"]);
    const originRoot = gorigin(["rev-list", "--max-parents=0", "HEAD"]).trim();
    assert.match(originRoot, /^[0-9a-f]{40}$/);

    const originUrl = pathToFileURL(origin).href;

    const shallowDir = path.join(work, "shallow");
    top(["clone", "-q", "--depth", "1", originUrl, shallowDir]);
    assert.throws(() => deriveRepositoryRef(fixtureGit(shallowDir)), isShallow, "shallow file:// --depth 1 clone rejected");

    const fullDir = path.join(work, "full");
    top(["clone", "-q", originUrl, fullDir]);
    assert.equal(deriveRepositoryRef(fixtureGit(fullDir)), "git-root:" + originRoot, "full clone resolves origin root");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log("test-registry: all assertions passed");
