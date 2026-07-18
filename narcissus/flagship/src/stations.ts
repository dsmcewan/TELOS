// The six stations of the honest development story. Each cites a real institutional-memory record
// through the Evidence Ledger (fail-closed allowlist). Order is the arc: distrust -> quest -> reiteration
// -> council -> ground truth -> can't-be-lost.
import ledger from "./evidence-ledger.json";

export type Evidence = { id: string; source_path: string; blob_sha: string; quote: string };
export const EVIDENCE = (ledger.entries as Evidence[]);
export function evidenceById(id: string): Evidence | undefined {
  return EVIDENCE.find((e) => e.id === id);
}

export type Station = {
  id: string;
  index: number;
  kicker: string;
  title: string;
  body: string;
  evidenceId: string; // -> Evidence Ledger
};

export const STATIONS: Station[] = [
  {
    id: "distrust", index: 0, kicker: "01 — Builder ≠ Certifier",
    title: "The system that distrusts itself",
    body: "TELOS is a build-gate where no seat's self-report is trusted. Independent AI seats produce signed packets; a deterministic gate certifies merge-readiness from disk, signatures, and provenance — never from what a model claims. The system was built to be its own harshest critic.",
    evidenceId: "quest-premise",
  },
  {
    id: "quest", index: 1, kicker: "02 — The Iliad",
    title: "Enrollment is earned, not granted",
    body: "A new module doesn't join by existing on disk. It runs the Iliad quest — pre-review, the Daedalus workshop, the TELOS council, implementation, retrospective. Presence is not enrollment. Every thread you see was earned by traversal.",
    evidenceId: "start-here",
  },
  {
    id: "loom", index: 2, kicker: "03 — Daedalus",
    title: "Reiteration is the governance",
    body: "In the workshop, an adversary refuses to wave the plan through. It stalemates, round after round, until the plan is genuinely comprehensive. The reiteration is not friction — it is what provides governance and validation. The loom is woven under tension.",
    evidenceId: "reiteration-lesson",
  },
  {
    id: "council", index: 3, kicker: "04 — TELOS",
    title: "A signed council applies tension",
    body: "Five independent seats review the matured plan and sign. The gate certifies from packets, signatures, and real provenance. Authorization is not a rubber stamp — it is the point at which a plan has earned the right to be tested by reality.",
    evidenceId: "council-authorized",
  },
  {
    id: "ground-truth", index: 4, kicker: "05 — The Correction",
    title: "The plan that passed every gate — and was wrong",
    body: "A plan survived ten adversarial rounds and a signed council, and was still wrong about its own input. Nothing in the apparatus caught it. Reading the actual file caught it, in the first minute of implementation. Correctness lives at the point of contact with ground truth — nowhere earlier.",
    evidenceId: "ground-truth-block",
  },
  {
    id: "cant-be-lost", index: 5, kicker: "06 — Institutional Memory",
    title: "An architecture that can't be lost",
    body: "Every stalemate, correction, and honest limit is recorded — machine-first, content-addressed. A shortcut hides what wasn't done; a bounded scope records it. Across model generations the design, decisions, and knowledge survive. That record is the part that can't be lost.",
    evidenceId: "honest-limits",
  },
];

export const STATION_COUNT = STATIONS.length;
