// Export is a real affordance (functional-blade contract): it serializes the exact verifiable surface the
// app renders — the current station, the full machine context, the compounded live-graph citation, and every
// evidence-ledger pin — to a downloadable JSON file. Every value comes from the same modules the UI reads;
// nothing is fabricated at export time.
import type { FlagshipContext } from "./machine";
import { STATIONS, EVIDENCE } from "./stations";
import { CLOTHO, ATROPOS, SNAPSHOT, NODES_BY_BLAST } from "./livegraph";

export function buildExportPayload(context: FlagshipContext) {
  const station = STATIONS[context.stationIndex];
  return {
    exported_at: new Date().toISOString(),
    station: { id: station.id, index: station.index, title: station.title, evidence_id: station.evidenceId },
    context,
    live_graph: {
      snapshot: SNAPSHOT,
      clotho: CLOTHO,
      atropos: ATROPOS,
      top_by_blast_radius: NODES_BY_BLAST.map((n) => ({
        id: n.id, label: n.label, blast_radius: n.blast_radius, risk_class: n.risk_class,
      })),
    },
    evidence_ledger: EVIDENCE.map((e) => ({ id: e.id, source_path: e.source_path, blob_sha: e.blob_sha })),
  };
}

export function downloadEvidence(context: FlagshipContext): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([JSON.stringify(buildExportPayload(context), null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "narcissus-evidence.json";
  a.click();
  URL.revokeObjectURL(url);
}
