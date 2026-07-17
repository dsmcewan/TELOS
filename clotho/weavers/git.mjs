// weavers/git.mjs — Clotho's git weaver (plan v13 (v12 + AM-40) Task 4a). Zero dependencies:
// Node stdlib only; imports only clotho/registry.mjs (its accepted relative
// module-load closure is exactly {registry.mjs, git.mjs}).
//
// Consumes its two driver-owned counted sources (package-symbols, package-files)
// and emits `introduced-by` edges from each seeded symbol/file to the commit that
// first introduced it, discovered via exact path-scoped `git log`. Deterministic;
// counted-source only; owns no time/keypair/counts (D5 lives in the ledger).

import { deriveNodeId, validateEdgeInput } from "../registry.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const WEAVER_ID = "clotho-git-weaver";

// The weaver validates its OWN inputs before splicing them into git argv, so its
// contract does not depend on which runner the driver injects (a test mock may
// bypass the wrapper's allowlist). These duplicate the canonical predicates in
// registry/util deliberately: git.mjs's accepted closure is exactly
// {registry.mjs, git.mjs}, so it must not import util.mjs.
function requireIdentifier(symbol, path) {
  if (typeof symbol !== "string" || !IDENT.test(symbol)) throw new Error(`git-weaver: symbol is not an identifier: ${JSON.stringify(symbol)} (${path})`);
}
function requireRepoRelPosix(p) {
  if (typeof p !== "string" || p.length === 0 || p.includes("\0") || p.includes("\\") || p.startsWith("/") || p.startsWith("-") ||
      !p.split("/").every((seg) => seg.length > 0 && seg !== "." && seg !== "..")) {
    throw new Error(`git-weaver: not a canonical repository-relative path: ${JSON.stringify(p)}`);
  }
}

// Parse `git log --format=%H` output. Accepts LF or CRLF line terminators (a
// full-SHA line carrying a platform CRLF terminator is NOT malformed), but a BARE
// carriage return (a CR not paired with a following LF) is malformed. EVERY line
// must be a full 40-hex SHA — a blank or non-SHA line is fatal, never silently
// skipped. Returns the ordered SHAs (earliest first, --reverse).
function parseShaLines(out) {
  if (typeof out !== "string") throw new Error("git-weaver: non-string git output");
  // ONLY genuinely empty output ("") is "no introducing commit" (warn/no-edge).
  if (out === "") return [];
  // A bare CR (not part of a CRLF) is malformed output, never a line terminator.
  if (/\r(?!\n)/.test(out)) throw new Error("git-weaver: bare carriage return in git output");
  const normalized = out.replace(/\r\n/g, "\n"); // CRLF terminators -> LF
  const text = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  const lines = text.split("\n"); // "\n"/"\r\n" -> text "" -> [""] -> blank line is fatal
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
    requireRepoRelPosix(path); requireIdentifier(symbol, path); // fail closed before argv splice
    const out = git(["log", `-S${symbol}`, "--format=%H", "--reverse", "--", path]);
    const shas = parseShaLines(out);
    if (shas.length === 0) { warnings.push({ weaver: WEAVER_ID, message: `no introducing commit for symbol ${symbol} in ${path}` }); continue; }
    pushEdge({ kind: "code-symbol", locator: { repository_ref: repositoryRef, path, symbol, blob_sha } }, shas[0]);
  }

  // package-files -> repository-file introduced-by commit
  for (const file of sources["package-files"]) {
    const { path, blob_sha } = file;
    requireRepoRelPosix(path); // fail closed before argv splice
    const out = git(["log", "--format=%H", "--reverse", "--", path]);
    const shas = parseShaLines(out);
    if (shas.length === 0) { warnings.push({ weaver: WEAVER_ID, message: `no introducing commit for file ${path}` }); continue; }
    pushEdge({ kind: "repository-file", locator: { repository_ref: repositoryRef, path, blob_sha } }, shas[0]);
  }

  return { edges, warnings };
}
