#!/usr/bin/env node
// test-registry.mjs — Task 2. Real coverage of clotho/registry.mjs: closed
// registries, canonical identity, locator/source/status/endpoint validation, and
// the deriveRepositoryRef shallow/full-clone contract proven against BOTH
// injected git and a real-git fixture (D18). Plain node:assert/strict, no
// framework; runs in a fresh Node process via test-all.mjs.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  NODE_KINDS, EDGE_KINDS, ASSERTION_STATUS, WEAVER_IDS,
  canonicalJson, deriveNodeId, validateLocator, validateSourceRef,
  validateAssertionStatus, validateEdgeInput, docAddressKey,
  deriveRepositoryRef, ShallowRepositoryError
} from "../registry.mjs";

const HEX40A = "0123456789abcdef0123456789abcdef01234567";
const HEX40B = "fedcba9876543210fedcba9876543210fedcba98";
const HEX64A = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const HEX64B = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const REPO = "git-root:" + HEX40A;

// ---- 1. closed-set membership + counts --------------------------------------
{
  assert.equal(NODE_KINDS.size, 11);
  assert.equal(EDGE_KINDS.size, 8);
  assert.equal(ASSERTION_STATUS.size, 5);
  assert.equal(WEAVER_IDS.size, 5);
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

// ---- 2. read-only facades: every mutator throws -----------------------------
for (const [name, set] of [["NODE_KINDS", NODE_KINDS], ["EDGE_KINDS", EDGE_KINDS], ["ASSERTION_STATUS", ASSERTION_STATUS]]) {
  assert.throws(() => set.add("x"), /read-only/, `${name}.add throws`);
  assert.throws(() => set.delete("code-symbol"), /read-only/, `${name}.delete throws`);
  assert.throws(() => set.clear(), /read-only/, `${name}.clear throws`);
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
assert.throws(() => validateLocator("commit", { sha: HEX40B, repository_ref: REPO }), /expected keys|got/);
assert.throws(() => validateLocator("mystery", {}), /unknown kind/);

// ---- 5. locator rejections --------------------------------------------------
{
  assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: "a" }, { repositoryRef: REPO }), /missing|expected keys/);
  assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: "a", blob_sha: HEX40A, woven_at: "x" }, { repositoryRef: REPO }), /expected keys|got/);
  const proto = { blob_sha: HEX40A };
  const inherited = Object.assign(Object.create(proto), { repository_ref: REPO, path: "a" });
  assert.throws(() => validateLocator("repository-file", inherited, { repositoryRef: REPO }), /plain object|missing|expected/);
  assert.throws(() => validateLocator("repository-file", { repository_ref: "git-root:" + HEX40B, path: "a", blob_sha: HEX40A }, { repositoryRef: REPO }), /does not match/);
  assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: "a", blob_sha: "abc" }, { repositoryRef: REPO }), /40-hex/);
  assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: "a", blob_sha: HEX40A.toUpperCase() }, { repositoryRef: REPO }), /40-hex/);
  for (const bad of ["../etc", "/abs", "a/", "a\\b", "a/./b", "a//b", ""]) {
    assert.throws(() => validateLocator("repository-file", { repository_ref: REPO, path: bad, blob_sha: HEX40A }, { repositoryRef: REPO }), /canonical POSIX/, `path ${JSON.stringify(bad)} rejected`);
  }
  assert.throws(() => validateLocator("code-symbol", { repository_ref: REPO, path: "a", symbol: "9bad", blob_sha: HEX40A }, { repositoryRef: REPO }), /identifier/);
  assert.throws(() => validateLocator("doc-section", { repository_ref: REPO, path: "d.md", heading_path: ["  spaced  "], text_sha256: HEX64A }, { repositoryRef: REPO }), /normalized/);
  assert.throws(() => validateLocator("doc-section", { repository_ref: REPO, path: "d.md", heading_path: [], text_sha256: HEX64A }, { repositoryRef: REPO }), /nonempty array/);
  assert.throws(() => validateLocator("run-evidence", { repository_ref: REPO, path: "elsewhere/x", summary_sha256: HEX64A }, { repositoryRef: REPO }), /docs\/runs/);
  assert.throws(() => validateLocator("concern", { repository_ref: REPO, ledger_path: "docs/runs/x/l.jsonl", entry_hash: HEX40A }, { repositoryRef: REPO }), /64-hex/);
}

// ---- 6. deriveNodeId: stability + content-bound distinctness -----------------
{
  const a = deriveNodeId({ kind: "code-symbol", locator: LOCATORS["code-symbol"] });
  const a2 = deriveNodeId({ kind: "code-symbol", locator: { ...LOCATORS["code-symbol"] } });
  assert.equal(a, a2, "same descriptor -> same id");
  assert.match(a, /^[0-9a-f]{64}$/);
  const b = deriveNodeId({ kind: "code-symbol", locator: { ...LOCATORS["code-symbol"], blob_sha: HEX40B } });
  assert.notEqual(a, b, "distinct blob_sha -> distinct node id");
  assert.throws(() => deriveNodeId({ kind: "code-symbol", locator: { path: "a" } }), /expected keys|missing/);
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
  assert.throws(() => validateAssertionStatus("human", "approved"), /unknown status/);
  assert.throws(() => validateAssertionStatus(" human", "human-authorized"), /trimmed/);
  assert.throws(() => validateAssertionStatus("a".repeat(129), "deterministic-extraction"), /128/);
  assert.throws(() => validateAssertionStatus("bad id", "human-authorized"), /stable identifier/);
}

// ---- 9. edge endpoints ------------------------------------------------------
const cs = { kind: "code-symbol", locator: LOCATORS["code-symbol"] };
const rf = { kind: "repository-file", locator: LOCATORS["repository-file"] };
const tst = { kind: "test", locator: LOCATORS["test"] };
const commit = { kind: "commit", locator: LOCATORS["commit"] };
const docSec = { kind: "doc-section", locator: LOCATORS["doc-section"] };
const clause = { kind: "contract-clause", locator: LOCATORS["contract-clause"] };
const concern = { kind: "concern", locator: LOCATORS["concern"] };
const obligation = { kind: "obligation", locator: LOCATORS["obligation"] };
const runEv = { kind: "run-evidence", locator: LOCATORS["run-evidence"] };

function edge(edge_kind, from, to, asserted_by, assertion_status, source_ref) {
  return { edge_kind, from_node: from, to_node: to, asserted_by, assertion_status, source_ref };
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
validateEdgeInput(edge("documented-in", cs, docSec, "clotho-doc-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("documented-in", rf, clause, "clotho-doc-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("motivated-by", cs, concern, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("evidenced-by", cs, runEv, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("discharges", cs, obligation, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });
validateEdgeInput(edge("discharges", obligation, clause, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO });

assert.throws(() => validateEdgeInput(edge("depends-on", cs, tst, W, DET, SR), { repositoryRef: REPO }), /valid depends-on endpoint/);
assert.throws(() => validateEdgeInput(edge("discharges", obligation, cs, "clotho-ledger-weaver", DET, SR), { repositoryRef: REPO }), /valid discharges endpoint/);
assert.throws(() => validateEdgeInput(edge("introduced-by", cs, cs, "clotho-git-weaver", DET, SR), { repositoryRef: REPO }), /valid introduced-by endpoint/);
assert.throws(() => validateEdgeInput(edge("motivated-by", rf, concern, W, DET, SR), { repositoryRef: REPO }), /valid motivated-by endpoint/);
assert.throws(() => validateEdgeInput(edge("references", cs, cs, W, DET, SR), { repositoryRef: REPO }), /unknown edge_kind/);
assert.throws(() => validateEdgeInput({ ...edge("depends-on", cs, cs, W, DET, SR), woven_at: "t" }, { repositoryRef: REPO }), /expected keys|got/);
assert.throws(() => validateEdgeInput(edge("depends-on", cs, cs, W, "human-authorized", SR), { repositoryRef: REPO }), /requires deterministic-extraction/);

// ---- 10. supersedes provenance ---------------------------------------------
{
  const oldRf = { kind: "repository-file", locator: { repository_ref: REPO, path: "old/name.mjs", blob_sha: HEX40A } };
  const newRf = { kind: "repository-file", locator: { repository_ref: REPO, path: "new/name.mjs", blob_sha: HEX40B } };
  validateEdgeInput(edge("supersedes", oldRf, newRf, "human", "human-authorized", SR), { repositoryRef: REPO });
  const csV1 = { kind: "code-symbol", locator: { ...LOCATORS["code-symbol"], blob_sha: HEX40A } };
  const csV2 = { kind: "code-symbol", locator: { ...LOCATORS["code-symbol"], blob_sha: HEX40B } };
  validateEdgeInput(edge("supersedes", csV1, csV2, "model:codex", "model-proposal", SR), { repositoryRef: REPO });
  assert.throws(() => validateEdgeInput(edge("supersedes", oldRf, cs, "human", "human-authorized", SR), { repositoryRef: REPO }), /share a kind/);
  assert.throws(() => validateEdgeInput(edge("supersedes", csV1, csV2, "clotho-code-weaver", DET, SR), { repositoryRef: REPO }), /begin with 'model:'/);
}

// ---- 11. docAddressKey ------------------------------------------------------
{
  const k = docAddressKey({ path: "docs/x.md", heading_path: ["Title", "Section"] });
  assert.equal(k, canonicalJson({ path: "docs/x.md", heading_path: ["Title", "Section"] }));
  assert.equal(docAddressKey({ heading_path: ["A"], path: "d.md" }), docAddressKey({ path: "d.md", heading_path: ["A"] }));
  assert.throws(() => docAddressKey({ path: "/abs", heading_path: ["A"] }), /canonical POSIX/);
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

  const shallow = (args) => args[0] === "rev-parse" ? "true\n" : "";
  assert.throws(() => deriveRepositoryRef(shallow), ShallowRepositoryError);

  const malformedShallow = (args) => args[0] === "rev-parse" ? "yes\n" : "";
  assert.throws(() => deriveRepositoryRef(malformedShallow), ShallowRepositoryError);

  const multiRoot = (args) => args[0] === "rev-parse" ? "false" : `${HEX40A}\n${HEX40B}\n`;
  assert.throws(() => deriveRepositoryRef(multiRoot), /exactly one root/);

  const malformedRoot = (args) => args[0] === "rev-parse" ? "false" : "not-a-sha\n";
  assert.throws(() => deriveRepositoryRef(malformedRoot), /malformed root/);

  assert.throws(() => deriveRepositoryRef("not a function"), /must be a function/);
}

// ---- 13. deriveRepositoryRef: REAL-git shallow/full-clone fixture (D18) ------
{
  const work = mkdtempSync(path.join(tmpdir(), "clotho-reg-git-"));
  try {
    const origin = path.join(work, "origin");
    const runIn = (dir) => (args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    execFileSync("git", ["init", "-q", origin], { stdio: "ignore" });
    const git = runIn(origin);
    git(["config", "user.email", "fixture@example.com"]);
    git(["config", "user.name", "Fixture"]);
    git(["config", "commit.gpgsign", "false"]);
    writeFileSync(path.join(origin, "a.txt"), "one\n");
    git(["add", "a.txt"]);
    git(["commit", "-q", "-m", "first"]);
    writeFileSync(path.join(origin, "b.txt"), "two\n");
    git(["add", "b.txt"]);
    git(["commit", "-q", "-m", "second"]);
    const originRoot = git(["rev-list", "--max-parents=0", "HEAD"]).trim();
    assert.match(originRoot, /^[0-9a-f]{40}$/);

    const originUrl = pathToFileURL(origin).href;

    const shallowDir = path.join(work, "shallow");
    execFileSync("git", ["clone", "-q", "--depth", "1", originUrl, shallowDir], { stdio: "ignore" });
    assert.throws(() => deriveRepositoryRef(runIn(shallowDir)), ShallowRepositoryError, "shallow clone rejected");

    const fullDir = path.join(work, "full");
    execFileSync("git", ["clone", "-q", originUrl, fullDir], { stdio: "ignore" });
    assert.equal(deriveRepositoryRef(runIn(fullDir)), "git-root:" + originRoot, "full clone resolves origin root");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

console.log("test-registry: all assertions passed");
