// measure.mjs — Lachesis's metrics over a loaded weave (from ingest.loadWeave).
// The graph is over bare-hex node ids; edges carry an edge_kind. Lachesis MEASURES; it
// does not authorize, enforce, retire, weave, or render. The risk CLASS is ADVISORY.
//
// SEMANTICS DECISIONS (cycle 1, reality-driven — FLAGGED for Eye ratification):
//  * relevance = normalized `depends-on` IN-DEGREE (centrality). The fiction-plan's weighted
//    {depends-on 3, verified-by 2, introduced-by 1} MIS-ORIENTED the latter two: in the real
//    weave verified-by is file->test and introduced-by is file->commit (FROM = subject), so
//    crediting the `to` endpoint attributed weight to tests/commits. Dropped them; relevance is
//    pure depends-on centrality, oracled against golden real values.
//  * riskClass is BLAST-DRIVEN + coverage floor. Under the corrected relevance (a normalized
//    depends-on in-degree), relevance is subsumed by blast (blast >= in-degree), so folding it
//    into the class never changes the outcome — it is reported, not risk-bearing.
//
// Pinned metric semantics (the oracle in scripts/test-metrics.mjs discriminates each):
//  depends-on: from = dependent, to = dependency.
//  dependencies(id)      = transitive forward depends-on closure, EXCLUDING id (cycle-safe).
//  blastRadius(id,depth) = reverse depends-on dependents to `depth` hops (id excluded), cycle-safe.
//  relevance(id)         = (depends-on in-degree of id) / (max depends-on in-degree), 0 if max 0.
//  riskClass(id,cov)     = blast>=10 high | >=3 medium | else low; then coverage-floored.

export const RISK_BLAST_DEPTH = Infinity; // full transitive reverse closure — depth-deterministic

function requireKnown(weave, nodeId) {
  if (!weave || !(weave.nodes instanceof Map) || !weave.nodes.has(nodeId)) {
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

function inDegreeDependsOn(weave) {
  const acc = new Map();
  for (const e of weave.edges) if (e.edge_kind === "depends-on") acc.set(e.to, (acc.get(e.to) || 0) + 1);
  return acc;
}

export function relevance(weave, nodeId) {
  requireKnown(weave, nodeId);
  const acc = inDegreeDependsOn(weave);
  let max = 0;
  for (const v of acc.values()) if (v > max) max = v;
  if (max === 0) return 0;
  return (acc.get(nodeId) || 0) / max;
}

export function riskClass(weave, nodeId, coverage = "unverified") {
  const br = blastRadius(weave, nodeId).count;
  let cls = br >= 10 ? "high" : br >= 3 ? "medium" : "low";
  if (cls === "low" && coverage !== "attested-complete") cls = "medium"; // coverage floor
  return { class: cls, blast_radius: br, relevance: relevance(weave, nodeId), coverage };
}

export function assess(weave, nodeId, coverage = "unverified") {
  requireKnown(weave, nodeId);
  return {
    node: nodeId,
    dependencies: dependencies(weave, nodeId).size,
    ...riskClass(weave, nodeId, coverage)
  };
}
