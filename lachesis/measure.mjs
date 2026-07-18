// measure.mjs — Lachesis's metrics over a loaded weave (from ingest.loadWeave).
// The graph is over bare-hex node ids; edges carry an edge_kind. Lachesis MEASURES;
// it does not authorize, enforce, retire, weave, or render. The risk CLASS is
// ADVISORY. Pinned semantics (frozen — the oracle in scripts/test-metrics.mjs
// discriminates each):
//   depends-on: from = dependent, to = dependency.
//   dependencies(id)      = transitive forward depends-on closure, EXCLUDING id (cycle-safe).
//   blastRadius(id,depth) = reverse depends-on dependents to `depth` hops (id excluded), cycle-safe.
//   relevance(id)         = raw / MAX_RAW, raw = 3*in(depends-on)+2*in(verified-by)+1*in(introduced-by).
//   riskClass             = at RISK_BLAST_DEPTH (full reverse closure); coverage-floored.

export const RELEVANCE_WEIGHTS = { "depends-on": 3, "verified-by": 2, "introduced-by": 1 };
export const RISK_BLAST_DEPTH = Infinity; // full transitive reverse closure — depth-deterministic

// --- adjacency (built once per weave) ---
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

// transitive closure from `start` over `adj`, EXCLUDING start (even if a cycle returns to it)
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

// BFS reverse dependents to exactly `depth` hops (start excluded), cycle-safe
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
  return closureExcludingStart(forwardDepends(weave), nodeId);
}

export function blastRadius(weave, nodeId, depth = RISK_BLAST_DEPTH) {
  const set = reverseToDepth(reverseDepends(weave), nodeId, depth);
  return { count: set.size, nodes: set };
}

// weighted raw in-degree over the metric edge kinds
function rawRelevance(weave, nodeId) {
  let raw = 0;
  for (const e of weave.edges) {
    const w = RELEVANCE_WEIGHTS[e.edge_kind];
    if (w && e.to === nodeId) raw += w;
  }
  return raw;
}
function maxRaw(weave) {
  const acc = new Map();
  for (const e of weave.edges) {
    const w = RELEVANCE_WEIGHTS[e.edge_kind];
    if (!w) continue;
    acc.set(e.to, (acc.get(e.to) || 0) + w);
  }
  let max = 0;
  for (const v of acc.values()) if (v > max) max = v;
  return max;
}

export function relevance(weave, nodeId) {
  const max = maxRaw(weave);
  if (max === 0) return 0;
  return rawRelevance(weave, nodeId) / max;
}

// coverage: attestation-gated. `coverage` is "attested-complete" only when a verified
// attestation exists (§4); otherwise "unverified". Verification of attestations is the
// caller's (resolveCoverage) — measure stays pure over the passed coverage token.
export function riskClass(weave, nodeId, coverage = "unverified") {
  const br = blastRadius(weave, nodeId).count;
  const rel = relevance(weave, nodeId);
  const byBlast = br >= 10 ? "high" : br >= 3 ? "medium" : "low";
  const byRel = rel >= 0.66 ? "high" : rel >= 0.33 ? "medium" : "low";
  const order = { low: 0, medium: 1, high: 2 };
  let cls = order[byBlast] >= order[byRel] ? byBlast : byRel;
  // coverage floor: `low` requires attested completeness; else at least medium
  if (cls === "low" && coverage !== "attested-complete") cls = "medium";
  return { class: cls, blast_radius: br, relevance: rel, coverage };
}

// Full advisory assessment for a node.
export function assess(weave, nodeId, coverage = "unverified") {
  const deps = dependencies(weave, nodeId);
  return {
    node: nodeId,
    dependencies: deps.size,
    ...riskClass(weave, nodeId, coverage)
  };
}
