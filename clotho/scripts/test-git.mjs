#!/usr/bin/env node
// test-git.mjs — Task 4a. Real coverage of clotho/weavers/git.mjs: exact
// path-scoped git calls, symbol- and file-level introduced-by edges, earliest
// (--reverse) selection, malformed-output failure, no-result warnings, locator
// shapes (repository_ref + blob_sha), counted-source exhaustion, and byte-equal
// {edges,warnings} over two runs. Plain node:assert/strict; fresh process.

import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { weave } from "../weavers/git.mjs";
import { makeCountedSource, classifyModuleLoads, makeGitRunner } from "../weavers/util.mjs";
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

// ---- 5. empty vs blank/malformed git output --------------------------------
{
  const files = [{ path: "clotho/registry.mjs", blob_sha: BLOB }];
  const run = (out) => {
    const { git } = mockGit({ [`log --format=%H --reverse -- clotho/registry.mjs`]: out });
    return weave(ctxOf(git, [], files).ctx);
  };
  // Genuinely EMPTY output -> no introducing commit: warn, no edge (no throw).
  const empty = run("");
  assert.equal(empty.edges.length, 0);
  assert.equal(empty.warnings.length, 1);
  assert.equal(empty.warnings[0].weaver, "clotho-git-weaver");
  // A lone blank line ("\n") is NOT empty — it is a non-SHA line: fatal.
  assert.throws(() => run("\n"), /malformed git output/);
  // An INTERNAL blank line among SHAs is fatal.
  assert.throws(() => run(`${SHA1}\n\n${SHA2}\n`), /malformed git output/);
  // A single SHA with a valid trailing newline parses to one edge.
  const ok = run(`${SHA1}\n`);
  assert.equal(ok.edges.length, 1);
  assert.equal(ok.warnings.length, 0);
  // A SHA with NO trailing newline also parses (the trailing LF is optional).
  assert.equal(run(SHA1).edges.length, 1);
}

// ---- 6. CRLF line terminators are accepted; bare CR is fatal ----------------
{
  const files = [{ path: "clotho/registry.mjs", blob_sha: BLOB }];
  const run = (out) => {
    const { git } = mockGit({ [`log --format=%H --reverse -- clotho/registry.mjs`]: out });
    return weave(ctxOf(git, [], files).ctx);
  };
  // Single SHA with a CRLF terminator parses (platform line ending, not malformed).
  assert.equal(run(`${SHA1}\r\n`).edges.length, 1);
  // Multi-line CRLF: parses; the weaver takes the earliest (first) SHA.
  const multi = run(`${SHA1}\r\n${SHA2}\r\n`);
  assert.equal(multi.edges.length, 1);
  assert.equal(multi.edges[0].to_locator.locator.sha, SHA1);
  // A bare CR (not part of a CRLF) is malformed output: fatal.
  assert.throws(() => run(`${SHA1}\r`), /bare carriage return/);
  assert.throws(() => run(`${SHA1}\rgarbage`), /bare carriage return/);
  // A CRLF-delimited blank line is still fatal (blank, non-SHA).
  assert.throws(() => run("\r\n"), /malformed git output/);
}

// ---- 7. an EXECUTED weaver exhausts BOTH counted sources, one empty ----------
{
  // package-symbols empty-but-present, package-files nonempty: after weave() both
  // accountings read exhausted:true (D29 — every handed iterable run to completion).
  const files = [{ path: "clotho/registry.mjs", blob_sha: BLOB }];
  const { git } = mockGit({ [`log --format=%H --reverse -- clotho/registry.mjs`]: `${SHA1}\n` });
  const { ctx, acct } = ctxOf(git, [], files);
  weave(ctx);
  assert.equal(acct.sym().exhausted, true, "empty symbol source is still exhausted");
  assert.equal(acct.sym().observed_count, 0);
  assert.equal(acct.fil().exhausted, true, "file source exhausted");
  assert.equal(acct.fil().observed_count, 1);
}

// ---- 8. git.mjs closure intent: it imports ONLY ../registry.mjs --------------
{
  // Redundant documentation of the committed {registry, git} closure: the git
  // weaver must pull in no other clotho module (e.g. never drive-by import util).
  const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "weavers", "git.mjs"), "utf8");
  const rel = classifyModuleLoads(src).filter((s) => s.literal && s.specifier && (s.specifier.startsWith("./") || s.specifier.startsWith("../")));
  assert.deepEqual([...new Set(rel.map((s) => s.specifier))].sort(), ["../registry.mjs"]);
}

// ---- makeGitRunner validates BEFORE spawning ---------------------------------
// A disallowed arg shape throws the VALIDATION error and never reaches
// execFileSync — proven by pointing the runner at a nonexistent repoRoot: if it
// spawned first it would raise a spawn/ENOENT error, but validation fails first,
// so the thrown message is the "disallowed …" validation error. A refactor that
// moved validation after the spawn would surface a different error and fail here.
{
  const git = makeGitRunner("/clotho-nonexistent-repo-root-xyz");
  assert.throws(() => git(["log", "--oneline"]), /disallowed log shape/, "reordered/short log shape rejected before spawn");
  assert.throws(() => git(["status"]), /disallowed subcommand/, "unknown subcommand rejected before spawn");
  assert.throws(() => git(["hash-object", "--no-filters", "--", "/etc/passwd"]), /disallowed hash-object shape/, "absolute path rejected before spawn");
  assert.throws(() => git(["log", "-Sx", "--reverse", "--format=%H", "--", "clotho/x.mjs"]), /disallowed log shape/, "reordered flags rejected before spawn");
}

// ---- git.mjs validates its OWN inputs before splicing into argv --------------
// The weaver's contract must not depend on which runner the driver injects: a
// non-identifier symbol or a non-canonical path fails closed WITHOUT calling git
// (a spy runner throws if reached).
{
  const spy = () => { throw new Error("git must not be called for invalid input"); };
  {
    const { ctx } = ctxOf(spy, [{ path: "clotho/x.mjs", symbol: "x --all", blob_sha: HEX40("b") }], []);
    assert.throws(() => weave(ctx), /symbol is not an identifier/, "non-identifier symbol fails closed before spawn");
  }
  for (const bad of ["-Sinjected", "../escape.mjs", "clotho\\x.mjs"]) {
    const { ctx } = ctxOf(spy, [{ path: bad, symbol: "sym", blob_sha: HEX40("b") }], []);
    assert.throws(() => weave(ctx), /canonical repository-relative path/, `bad symbol path ${JSON.stringify(bad)} fails closed before spawn`);
  }
  {
    const { ctx } = ctxOf(spy, [], [{ path: "../escape.mjs", blob_sha: HEX40("c") }]);
    assert.throws(() => weave(ctx), /canonical repository-relative path/, "bad file path fails closed before spawn");
  }
}

console.log("test-git: all assertions passed");
