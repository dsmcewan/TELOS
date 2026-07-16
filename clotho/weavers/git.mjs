// weavers/git.mjs — Clotho's git weaver (plan v12 Task 4a). Zero dependencies:
// Node stdlib only; imports only clotho/registry.mjs (its accepted relative
// module-load closure is exactly {registry.mjs, git.mjs}).
//
// Consumes its two driver-owned counted sources (package-symbols, package-files)
// and emits `introduced-by` edges from each seeded symbol/file to the commit that
// first introduced it, discovered via exact path-scoped `git log`. Deterministic;
// counted-source only; owns no time/keypair/counts (D5 lives in the ledger).

import { deriveNodeId, validateEdgeInput } from "../registry.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const WEAVER_ID = "clotho-git-weaver";

// Parse `git log --format=%H` output: strip a single trailing LF, split on LF.
// EVERY line must be a full 40-hex SHA (malformed output is fatal, never
// silently skipped). Returns the ordered SHAs (earliest first, --reverse).
function parseShaLines(out) {
  if (typeof out !== "string") throw new Error("git-weaver: non-string git output");
  const text = out.endsWith("\n") ? out.slice(0, -1) : out;
  if (text === "") return [];
  const lines = text.split("\n");
  for (const ln of lines) {
    if (!HEX40.test(ln)) throw new Error(`git-weaver: malformed git output line ${JSON.stringify(ln)}`);
  }
  return lines;
}

export function weave(ctx) {
  const { repositoryRef, sources } = ctx;
  const git = ctx.git;
  const edges = [];
  const warnings = [];

  const pushEdge = (fromLocator, sha) => {
    const toLocator = { kind: "commit", locator: { sha } };
    const edge = {
      edge_kind: "introduced-by",
      from_node: deriveNodeId(fromLocator),
      to_node: deriveNodeId(toLocator),
      from_locator: fromLocator,
      to_locator: toLocator,
      source_ref: `git:${sha}`,
      asserted_by: WEAVER_ID,
      assertion_status: "deterministic-extraction"
    };
    validateEdgeInput(edge, { repositoryRef });
    edges.push(edge);
  };

  // package-symbols -> code-symbol introduced-by commit
  for (const sym of sources["package-symbols"]) {
    const { path, symbol, blob_sha } = sym;
    const out = git(["log", `-S${symbol}`, "--format=%H", "--reverse", "--", path]);
    const shas = parseShaLines(out);
    if (shas.length === 0) { warnings.push({ weaver: WEAVER_ID, message: `no introducing commit for symbol ${symbol} in ${path}` }); continue; }
    pushEdge({ kind: "code-symbol", locator: { repository_ref: repositoryRef, path, symbol, blob_sha } }, shas[0]);
  }

  // package-files -> repository-file introduced-by commit
  for (const file of sources["package-files"]) {
    const { path, blob_sha } = file;
    const out = git(["log", "--format=%H", "--reverse", "--", path]);
    const shas = parseShaLines(out);
    if (shas.length === 0) { warnings.push({ weaver: WEAVER_ID, message: `no introducing commit for file ${path}` }); continue; }
    pushEdge({ kind: "repository-file", locator: { repository_ref: repositoryRef, path, blob_sha } }, shas[0]);
  }

  return { edges, warnings };
}
