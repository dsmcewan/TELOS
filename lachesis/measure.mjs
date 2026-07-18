// measure.mjs — Lachesis's metrics over a loaded weave (from ingest.loadWeave).
// The graph is over bare-hex node ids; edges carry an edge_kind. Lachesis MEASURES; it
// does not authorize, enforce, retire, weave, or render. The risk CLASS is ADVISORY.
//
// SEMANTICS (cycle 1 — ruled by the GPT seat, delegated by The Eye 2026-07-18):
//  * relevance = 3:2:1 salience with CORRECTED real orientation — depends-on credits its TO
//    endpoint (dependency), verified-by/introduced-by credit their FROM endpoint (the verified/
//    introduced subject; the fiction-plan credited the TO endpoint = test/commit). Normalized by
//    max; direct edges only. RELEVANCE IS REPORTED BUT DOES NOT FEED riskClass: verification/
//    provenance links measure weave salience, not impact, and snapshot-relative normalization is
//    no defensible absolute risk threshold.
//  * riskClass is BLAST-DRIVEN + coverage floor.
//
// Pinned metric semantics (the oracle in scripts/test-metrics.mjs discriminates each):
//  depends-on: from = dependent, to = dependency.
//  dependencies(id)      = transitive forward depends-on closure, EXCLUDING id (cycle-safe).
//  blastRadius(id,depth) = reverse depends-on dependents to `depth` hops (id excluded), cycle-safe.
//  relevance(id)         = raw(id)/max raw, raw = 3*D(to) + 2*V(from) + 1*I(from) (see below), 0 if max 0.
//  riskClass(id,cov)     = blast>=10 high | >=3 medium | else low; then coverage-floored.

export const RISK_BLAST_DEPTH = Infinity; // full transitive reverse closure — depth-deterministic

function requireKnown(weave, nodeId) {
  // duck-typed: loadWeave returns a frozen { has, size } node view; tests may pass a Map. Both expose has().
  if (!weave || !weave.nodes || typeof weave.nodes.has !== "function" || !weave.nodes.has(nodeId)) {
    throw new Error(`measure: unknown node id (not present in weave): ${String(nodeId).slice(0, 12)}…`);
  }
}
function validDepth(depth) {
  return depth === Infinity || (Number.isInteger(depth) && depth >= 0);
}

function forwardDepends(weave) {
  const out = new Map();
  for (const e of weave.edges) {
    if (e.edge_kind !== "depends-on") continue;
    if (!out.has(e.from)) out.set(e.from, new Set());
    out.get(e.from).add(e.to);
  }
  return out;
}
function reverseDepends(weave) {
  const rev = new Map();
  for (const e of weave.edges) {
    if (e.edge_kind !== "depends-on") continue;
    if (!rev.has(e.to)) rev.set(e.to, new Set());
    rev.get(e.to).add(e.from);
  }
  return rev;
}
function closureExcludingStart(adj, start) {
  const seen = new Set();
  const stack = [...(adj.get(start) || [])];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of (adj.get(n) || [])) if (!seen.has(m)) stack.push(m);
  }
  seen.delete(start);
  return seen;
}
function reverseToDepth(rev, start, depth) {
  const seen = new Set();
  let frontier = new Set(rev.get(start) || []);
  let hops = 1;
  while (frontier.size && hops <= depth) {
    const next = new Set();
    for (const n of frontier) {
      if (seen.has(n)) continue;
      seen.add(n);
      for (const m of (rev.get(n) || [])) if (!seen.has(m)) next.add(m);
    }
    frontier = next;
    hops++;
  }
  seen.delete(start);
  return seen;
}

export function dependencies(weave, nodeId) {
  requireKnown(weave, nodeId);
  return closureExcludingStart(forwardDepends(weave), nodeId);
}

export function blastRadius(weave, nodeId, depth = RISK_BLAST_DEPTH) {
  requireKnown(weave, nodeId);
  if (!validDepth(depth)) throw new Error(`blastRadius: depth must be a non-negative integer or Infinity (got ${depth})`);
  const set = reverseToDepth(reverseDepends(weave), nodeId, depth);
  return { count: set.size, nodes: set };
}

// relevance salience (codex ruling, cycle 1): raw(v) = 3*D(v) + 2*V(v) + 1*I(v), where
//   D(v) = # depends-on edges with to == v   (dependency centrality — credit the TO endpoint)
//   V(v) = # verified-by edges with from == v (verified subject   — credit the FROM endpoint)
//   I(v) = # introduced-by edges with from == v (introduced subject — credit the FROM endpoint)
// direct edges only (no transitive closure); all other edge kinds weight 0. Ingest guarantees
// (kind,from,to)-distinct edges, so edge counts are distinct counts.
function rawSalience(weave) {
  const raw = new Map();
  const add = (k, w) => raw.set(k, (raw.get(k) || 0) + w);
  for (const e of weave.edges) {
    if (e.edge_kind === "depends-on") add(e.to, 3);
    else if (e.edge_kind === "verified-by") add(e.from, 2);
    else if (e.edge_kind === "introduced-by") add(e.from, 1);
  }
  return raw;
}

export function relevance(weave, nodeId) {
  requireKnown(weave, nodeId);
  const raw = rawSalience(weave);
  let M = 0;
  for (const v of raw.values()) if (v > M) M = v;
  if (M === 0) return 0;
  return (raw.get(nodeId) || 0) / M;
}

export function riskClass(weave, nodeId, coverage = "unverified") {
  const br = blastRadius(weave, nodeId).count;
  let cls = br >= 10 ? "high" : br >= 3 ? "medium" : "low";
  if (cls === "low" && coverage !== "attested-complete") cls = "medium"; // coverage floor
  return { class: cls, blast_radius: br, relevance: relevance(weave, nodeId), coverage };
}

// NON-CLAIM: measure operates on the weave STRUCTURE loadWeave returns (frozen, digest-stamped).
// It does not cryptographically prove provenance of a weave-shaped object — callers must pass a
// loadWeave() result. The snapshot_digest is echoed so a measurement is bound to the checked bytes.
export function assess(weave, nodeId, coverage = "unverified") {
  requireKnown(weave, nodeId);
  return {
    node: nodeId,
    snapshot_digest: weave.snapshot_digest ?? null,
    dependencies: dependencies(weave, nodeId).size,
    ...riskClass(weave, nodeId, coverage)
  };
}
