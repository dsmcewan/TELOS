// Typed access to the live compounded graph: Clotho's live weave, MEASURED by Lachesis, VERIFIED by
// Atropos (narcissus/flagship/scripts/build-live-graph.mjs -> src/live-graph.json). Deterministic layout so
// the WebGL render is reproducible under ?e2e=1.
import data from "./live-graph.json";

export type LiveNode = {
  id: string; label: string; kind: string;
  dependencies: number; blast_radius: number; relevance: number;
  risk_class: "low" | "medium" | "high";
};
export type LiveEdge = { from: string; to: string };

export const NODES = (data.measured_by_lachesis.top_by_blast_radius as LiveNode[]);
export const EDGES = (data.subgraph_edges as LiveEdge[]);
export const CLOTHO = (data.clotho as { total_nodes: number; total_edges: number; depends_on_edges: number });
export const ATROPOS = (data.verified_by_atropos as {
  verdict: string; retired_plan_versions: string[]; active_plan_version: string; deferred: string;
});
export const SNAPSHOT = (data.generated_from_snapshot as string);
export const MAX_BLAST = Math.max(...NODES.map((n) => n.blast_radius));
export const NODES_BY_BLAST = [...NODES].sort((a, b) => b.blast_radius - a.blast_radius);

export function nodeById(id: string): LiveNode | undefined {
  return NODES.find((n) => n.id === id);
}
export function riskColor(risk: string): string {
  return risk === "high" ? "#ef4444" : risk === "medium" ? "#f59e0b" : "#3b82f6";
}

// in-scene labels: only the most important nodes are labelled in the 3D scene (culled by importance),
// so the hub + top tier read clearly without muddying the field.
export const LABELED_IDS = NODES_BY_BLAST.slice(0, 5).map((n) => n.id);

// deterministic CONCENTRIC-RING layout: the hub (max blast) at the tension point (center); the next tier on
// an inner ring; the rest on an outer ring — with z-parallax so the weave reads as woven depth, not flat.
export const LAYOUT: Record<string, [number, number, number]> = (() => {
  const pos: Record<string, [number, number, number]> = {};
  const total = NODES_BY_BLAST.length;
  NODES_BY_BLAST.forEach((n, i) => {
    if (i === 0) { pos[n.id] = [0, 0, 0.4]; return; } // hub, pulled slightly forward — dominates
    const ring = i <= 7 ? 1 : 2;
    const posInRing = ring === 1 ? i - 1 : i - 8;
    const ringCount = ring === 1 ? 7 : Math.max(1, total - 8);
    const r = ring === 1 ? 3.6 : 6.1;
    const a = (posInRing / ringCount) * Math.PI * 2 + ring * 0.7;
    const z = Math.sin(a * 2 + ring) * 1.35 - ring * 0.6; // woven depth / parallax
    pos[n.id] = [Math.cos(a) * r, Math.sin(a) * r * 0.62, z];
  });
  return pos;
})();
