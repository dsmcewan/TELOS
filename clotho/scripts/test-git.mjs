#!/usr/bin/env node
// test-git.mjs — Task 4a. Real coverage of clotho/weavers/git.mjs: exact
// path-scoped git calls, symbol- and file-level introduced-by edges, earliest
// (--reverse) selection, malformed-output failure, no-result warnings, locator
// shapes (repository_ref + blob_sha), counted-source exhaustion, and byte-equal
// {edges,warnings} over two runs. Plain node:assert/strict; fresh process.

import assert from "node:assert/strict";

import { weave } from "../weavers/git.mjs";
import { makeCountedSource } from "../weavers/util.mjs";
import { canonicalJson, deriveNodeId } from "../registry.mjs";

const HEX40 = (c) => c.repeat(40);
const REPO = "git-root:" + HEX40("a");
const SHA1 = HEX40("1");
const SHA2 = HEX40("2");
const BLOB = HEX40("b");

// A mock git that records the exact args of every call and returns canned output
// keyed by a "log -S<sym> -- <path>" / "log -- <path>" signature.
function mockGit(responses) {
  const calls = [];
  const git = (args) => {
    calls.push(args.slice());
    const key = args.join(" ");
    if (!(key in responses)) throw new Error("mockGit: unexpected call " + key);
    return responses[key];
  };
  return { git, calls };
}

function ctxOf(git, symbols, files) {
  const sym = makeCountedSource("package-symbols", symbols);
  const fil = makeCountedSource("package-files", files);
  return {
    ctx: { repositoryRef: REPO, git, sources: { "package-symbols": sym.source, "package-files": fil.source } },
    acct: { sym: sym.accounting, fil: fil.accounting }
  };
}

// ---- 1. exact calls + symbol/file edges + earliest selection ----------------
{
  const symbols = [{ path: "clotho/registry.mjs", symbol: "deriveNodeId", blob_sha: BLOB }];
  const files = [{ path: "clotho/registry.mjs", blob_sha: BLOB }];
  const { git, calls } = mockGit({
    [`log -SderiveNodeId --format=%H --reverse -- clotho/registry.mjs`]: `${SHA1}\n${SHA2}\n`,
    [`log --format=%H --reverse -- clotho/registry.mjs`]: `${SHA1}\n`
  });
  const { ctx, acct } = ctxOf(git, symbols, files);
  const { edges, warnings } = weave(ctx);

  // exact path-scoped args, in order
  assert.deepEqual(calls, [
    ["log", "-SderiveNodeId", "--format=%H", "--reverse", "--", "clotho/registry.mjs"],
    ["log", "--format=%H", "--reverse", "--", "clotho/registry.mjs"]
  ]);
  assert.equal(warnings.length, 0);
  assert.equal(edges.length, 2);

  const symEdge = edges[0];
  assert.equal(symEdge.edge_kind, "introduced-by");
  assert.equal(symEdge.from_locator.kind, "code-symbol");
  assert.equal(symEdge.from_locator.locator.repository_ref, REPO);
  assert.equal(symEdge.from_locator.locator.blob_sha, BLOB);
  assert.equal(symEdge.from_locator.locator.symbol, "deriveNodeId");
  assert.equal(symEdge.to_locator.kind, "commit");
  assert.equal(symEdge.to_locator.locator.sha, SHA1);        // earliest (--reverse first line)
  assert.equal(symEdge.source_ref, "git:" + SHA1);
  assert.equal(symEdge.asserted_by, "clotho-git-weaver");
  assert.equal(symEdge.assertion_status, "deterministic-extraction");
  assert.equal(symEdge.from_node, deriveNodeId(symEdge.from_locator));
  assert.equal(symEdge.to_node, deriveNodeId(symEdge.to_locator));

  const fileEdge = edges[1];
  assert.equal(fileEdge.from_locator.kind, "repository-file");
  assert.equal(fileEdge.from_locator.locator.repository_ref, REPO);
  assert.equal(fileEdge.from_locator.locator.blob_sha, BLOB);
  assert.equal(fileEdge.to_locator.locator.sha, SHA1);

  // counted sources fully consumed exactly once
  assert.deepEqual(acct.sym(), { inventory_id: "package-symbols", expected_cardinality: 1, observed_count: 1, exhausted: true });
  assert.deepEqual(acct.fil(), { inventory_id: "package-files", expected_cardinality: 1, observed_count: 1, exhausted: true });
}

// ---- 2. no-result warns and emits no edge -----------------------------------
{
  const symbols = [{ path: "clotho/x.mjs", symbol: "gone", blob_sha: BLOB }];
  const files = [];
  const { git } = mockGit({ [`log -Sgone --format=%H --reverse -- clotho/x.mjs`]: `` });
  const { ctx } = ctxOf(git, symbols, files);
  const { edges, warnings } = weave(ctx);
  assert.equal(edges.length, 0);
  assert.equal(warnings.length, 1);
  // structured, producer-attributed warning (D10/AM-39): weaver id + message
  assert.equal(warnings[0].weaver, "clotho-git-weaver");
  assert.match(warnings[0].message, /no introducing commit for symbol gone/);
}

// ---- 2b. -S<symbol> with a regex metacharacter is ONE verbatim argv token ----
{
  // `$` is a regex metacharacter AND a legal JS identifier char, so it is a
  // seedable symbol; it must be passed as a single "-S<symbol>" token, verbatim,
  // never re-interpreted (execFileSync, no shell — no metacharacter expansion).
  const symbols = [{ path: "clotho/x.mjs", symbol: "a$b", blob_sha: BLOB }];
  const { git, calls } = mockGit({ [`log -Sa$b --format=%H --reverse -- clotho/x.mjs`]: `${SHA1}\n` });
  const { ctx } = ctxOf(git, symbols, []);
  const { edges } = weave(ctx);
  assert.equal(edges.length, 1);
  assert.deepEqual(calls[0], ["log", "-Sa$b", "--format=%H", "--reverse", "--", "clotho/x.mjs"]);
  assert.equal(calls[0][1], "-Sa$b");
}

// ---- 3. malformed git output is fatal ---------------------------------------
{
  const symbols = [{ path: "clotho/x.mjs", symbol: "s", blob_sha: BLOB }];
  const { git } = mockGit({ [`log -Ss --format=%H --reverse -- clotho/x.mjs`]: `not-a-sha\n` });
  const { ctx } = ctxOf(git, symbols, []);
  assert.throws(() => weave(ctx), /malformed git output/);
}

// ---- 4. byte-equal {edges,warnings} over two runs ---------------------------
{
  const mk = () => {
    const symbols = [{ path: "clotho/registry.mjs", symbol: "deriveNodeId", blob_sha: BLOB }];
    const files = [{ path: "clotho/inventory.mjs", blob_sha: BLOB }];
    const { git } = mockGit({
      [`log -SderiveNodeId --format=%H --reverse -- clotho/registry.mjs`]: `${SHA1}\n`,
      [`log --format=%H --reverse -- clotho/inventory.mjs`]: `${SHA2}\n`
    });
    const { ctx } = ctxOf(git, symbols, files);
    return weave(ctx);
  };
  assert.equal(canonicalJson(mk()), canonicalJson(mk()));
}

console.log("test-git: all assertions passed");
