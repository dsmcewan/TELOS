#!/usr/bin/env node
// Hallucination metrics — deterministic derivation over Daedalus v2 run results.
// Governing document (HELD, The Eye 2026-07-20; does not move):
//   docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md
//
// HONESTY CONTRACT: these are PROXIES. Without ground truth, semantic
// hallucination is unmeasurable; what the controller CAN measure exactly is
// detectable fabrication — every burn is a seat-attributed event where model
// output failed a deterministic check it was told about in advance:
//   fabricated_identity     — invented, placeholder, shared, or reused
//                             provenance (a response pretending to be what it
//                             is not, or two calls pretending to be one)
//   fabricated_reference    — citing things that do not resolve (ledger refs,
//                             objection evidence shapes)
//   contract_noncompliance  — closed-shape violations: unattested silence,
//                             denials without objections, malformed verdicts
//   transport_failure       — availability, NEVER hallucination; excluded from
//                             fabrication rates entirely
// A rate's denominator is fabrication-eligible calls (counted calls minus
// transport failures); a seat with no eligible calls reports null, not zero.
// Everything here is pure: same input, byte-identical output — safe to hash.

export const HALLUCINATION_TAXONOMY = Object.freeze({
  fabricated_identity: Object.freeze([
    "invalid-provenance",
    "shared-provenance",
    "reused-provenance",
    "missing-response-or-provenance"
  ]),
  fabricated_reference: Object.freeze([
    "unresolvable-loop-evidence-ref",
    "malformed-objection",
    "malformed-loop-evidence"
  ]),
  contract_noncompliance: Object.freeze([
    "malformed-research-shape",
    "malformed-verdict-shape",
    "malformed-referee-shape",
    "accepted-with-objections",
    "denied-without-objections",
    "missing-empty-list-attestation",
    "stalemate-without-evidence"
  ]),
  transport_failure: Object.freeze([
    "transport-error",
    "challenger-transport-error",
    "referee-transport-error"
  ])
});

const REASON_TO_CLASS = new Map();
for (const [kind, reasons] of Object.entries(HALLUCINATION_TAXONOMY)) {
  for (const reason of reasons) REASON_TO_CLASS.set(reason, kind);
}

export function classifyBurnReason(reason) {
  return REASON_TO_CLASS.get(reason) ?? "unclassified";
}

const FABRICATION_CLASSES = ["fabricated_identity", "fabricated_reference", "contract_noncompliance"];

function newSeatEntry() {
  return {
    counted_calls: 0,
    fabrication_events: 0,
    transport_failures: 0,
    unclassified_burns: 0,
    by_class: {
      fabricated_identity: 0,
      fabricated_reference: 0,
      contract_noncompliance: 0
    },
    by_reason: {},
    fabrication_rate: null
  };
}

function recordBurn(entry, reason) {
  entry.by_reason[reason] = (entry.by_reason[reason] ?? 0) + 1;
  const kind = classifyBurnReason(reason);
  if (kind === "transport_failure") {
    entry.transport_failures += 1;
    return;
  }
  if (kind === "unclassified") {
    // Fail-visible: a new burn reason must be added to the taxonomy, not
    // silently absorbed into a class.
    entry.unclassified_burns += 1;
    return;
  }
  entry.by_class[kind] += 1;
  entry.fabrication_events += 1;
}

function finalizeRates(perSeat) {
  for (const entry of Object.values(perSeat)) {
    const eligible = entry.counted_calls - entry.transport_failures;
    entry.fabrication_rate = eligible > 0 ? entry.fabrication_events / eligible : null;
  }
}

const NON_CLAIMS = Object.freeze([
  "These metrics count detectable fabrication events (burns), not semantic hallucination — a fluent wrong answer that satisfies every closed shape is invisible here.",
  "Rates compare a seat against its own contract compliance, not seats against each other: seats hold different roles with different shape difficulty.",
  "A zero rate proves only that no fabrication was detected by the deterministic checks in force during the run.",
  "Transport failures are availability events and are excluded from fabrication rates."
]);

// Derive per-seat metrics from a runDaedalusV2 result object.
// Seat keys: research/challenge burns attribute to their seat; referee verdicts
// attribute to "gemini:referee" (role R is a distinct call surface from Seat 4).
export function deriveHallucinationMetrics(result) {
  const perSeat = {};
  const seat = (name) => (perSeat[name] ??= newSeatEntry());

  // Stage 0 — one counted call per seat that produced an artifact or a burn.
  for (const artifact of result.research?.artifacts ?? []) {
    seat(artifact.seat).counted_calls += 1;
  }
  for (const burn of result.research?.burned ?? []) {
    const entry = seat(burn.seat);
    entry.counted_calls += 1;
    recordBurn(entry, burn.reason);
  }

  // Stage 2 — every verdict slot is a counted call; burns carry their reason.
  for (const round of result.rounds ?? []) {
    for (const verdict of round.verdicts ?? []) {
      const entry = seat(verdict.seat);
      entry.counted_calls += 1;
      if (verdict.burned) recordBurn(entry, verdict.reason);
    }
  }

  // Role R — burned referee verdicts are recorded in the ledger; clean referee
  // calls are the watched rounds that produced no burn entry. The v2 result does
  // not carry a per-round referee log, so counted calls = burns + clean calls is
  // reconstructed conservatively from burns plus stalemate/continue evidence:
  // every burn is one call; a referee-stalemate terminal is one call; remaining
  // watched rounds with neither are unobservable here and NOT counted.
  const refereeEntry = () => seat("gemini:referee");
  for (const burn of result.ledger?.burned_referee_verdicts ?? []) {
    const entry = refereeEntry();
    entry.counted_calls += 1;
    recordBurn(entry, burn.reason);
  }
  if (result.reason === "referee-stalemate") {
    refereeEntry().counted_calls += 1;
  }

  finalizeRates(perSeat);

  const totals = {
    counted_calls: 0,
    fabrication_events: 0,
    transport_failures: 0,
    unclassified_burns: 0
  };
  for (const entry of Object.values(perSeat)) {
    totals.counted_calls += entry.counted_calls;
    totals.fabrication_events += entry.fabrication_events;
    totals.transport_failures += entry.transport_failures;
    totals.unclassified_burns += entry.unclassified_burns;
  }

  return {
    kind: "hallucination-metrics",
    metrics_version: 1,
    run_state: result.state ?? null,
    per_seat: perSeat,
    totals,
    taxonomy: HALLUCINATION_TAXONOMY,
    non_claims: NON_CLAIMS
  };
}

// Aggregate metrics records across runs: sum events and calls, recompute rates
// from the sums (never average the per-run rates — denominators differ).
export function aggregateHallucinationMetrics(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("aggregate requires at least one metrics record");
  }
  const perSeat = {};
  const seat = (name) => (perSeat[name] ??= newSeatEntry());
  for (const record of records) {
    if (record?.kind !== "hallucination-metrics" || record.metrics_version !== 1) {
      throw new Error("aggregate accepts only hallucination-metrics v1 records");
    }
    for (const [name, entry] of Object.entries(record.per_seat)) {
      const target = seat(name);
      target.counted_calls += entry.counted_calls;
      target.fabrication_events += entry.fabrication_events;
      target.transport_failures += entry.transport_failures;
      target.unclassified_burns += entry.unclassified_burns;
      for (const kind of FABRICATION_CLASSES) {
        target.by_class[kind] += entry.by_class[kind];
      }
      for (const [reason, count] of Object.entries(entry.by_reason)) {
        target.by_reason[reason] = (target.by_reason[reason] ?? 0) + count;
      }
    }
  }
  finalizeRates(perSeat);
  const totals = {
    counted_calls: 0,
    fabrication_events: 0,
    transport_failures: 0,
    unclassified_burns: 0
  };
  for (const entry of Object.values(perSeat)) {
    totals.counted_calls += entry.counted_calls;
    totals.fabrication_events += entry.fabrication_events;
    totals.transport_failures += entry.transport_failures;
    totals.unclassified_burns += entry.unclassified_burns;
  }
  return {
    kind: "hallucination-metrics-aggregate",
    metrics_version: 1,
    runs: records.length,
    per_seat: perSeat,
    totals,
    taxonomy: HALLUCINATION_TAXONOMY,
    non_claims: NON_CLAIMS
  };
}
