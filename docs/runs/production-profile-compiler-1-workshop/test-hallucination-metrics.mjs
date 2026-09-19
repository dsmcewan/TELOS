#!/usr/bin/env node
// Hallucination-metrics suite — pure derivation over Daedalus v2 run results.
// Metrics are PROXIES: deterministic counts of detectable fabrication events
// (burns), never a claim to measure semantic truthfulness.
import assert from "node:assert/strict";
import {
  HALLUCINATION_TAXONOMY,
  classifyBurnReason,
  deriveHallucinationMetrics,
  aggregateHallucinationMetrics
} from "./hallucination-metrics.mjs";

// A representative v2 result: research burns, challenge burns, referee burns,
// clean calls — everything the derivation must attribute per seat.
const RESULT = {
  state: "converged-for-submission",
  research: {
    artifacts: [{ seat: "claude" }, { seat: "codex" }, { seat: "gemini" }],
    burned: [{ seat: "grok", reason: "invalid-provenance" }]
  },
  rounds: [
    {
      round: 1,
      verdicts: [
        { seat: "grok", burned: true, reason: "malformed-verdict-shape" },
        { seat: "gemini", verdict: "denied", objections: [{ objection_hash: "sha256:a", scope: "plan", claim: "x" }] }
      ],
      burned_verdicts: [{ seat: "grok", reason: "malformed-verdict-shape" }],
      defenses: [{ objection_hash: "sha256:a" }]
    },
    {
      round: 2,
      verdicts: [
        { seat: "grok", verdict: "accepted", objections: [] },
        { seat: "gemini", verdict: "accepted", objections: [] }
      ],
      burned_verdicts: [],
      defenses: []
    }
  ],
  ledger: {
    denied_twice: [],
    burned_referee_verdicts: [
      { round: 2, reason: "unresolvable-loop-evidence-ref" },
      { round: 2, reason: "referee-transport-error" }
    ],
    plan_lineage: ["sha256:p1"]
  }
};

// Case 1: taxonomy is closed and total — every burn reason classifies exactly once
{
  const classes = new Set(Object.values(HALLUCINATION_TAXONOMY).flat());
  const reasons = [
    "invalid-provenance", "shared-provenance", "reused-provenance",
    "malformed-research-shape", "malformed-verdict-shape", "malformed-referee-shape",
    "malformed-objection", "malformed-loop-evidence", "accepted-with-objections",
    "denied-without-objections", "missing-empty-list-attestation",
    "stalemate-without-evidence", "unresolvable-loop-evidence-ref",
    "missing-response-or-provenance",
    "transport-error", "challenger-transport-error", "referee-transport-error"
  ];
  for (const reason of reasons) {
    const kind = classifyBurnReason(reason);
    assert.ok(
      ["fabricated_identity", "fabricated_reference", "contract_noncompliance", "transport_failure"].includes(kind),
      `${reason} must classify (got ${kind})`
    );
    assert.ok(classes.has(reason), `${reason} must appear in the taxonomy`);
  }
  assert.equal(classifyBurnReason("unknown-new-reason"), "unclassified");
  console.log("Case 1 OK: burn taxonomy is closed, total, and fail-visible for new reasons");
}

// Case 2: per-seat attribution and rates
{
  const metrics = deriveHallucinationMetrics(RESULT);
  assert.equal(metrics.kind, "hallucination-metrics");
  assert.equal(metrics.metrics_version, 1);

  const grok = metrics.per_seat.grok;
  // grok: 1 research call (burned) + 2 challenge calls (1 burned) = 3 counted calls
  assert.equal(grok.counted_calls, 3);
  assert.equal(grok.fabrication_events, 2);
  assert.equal(grok.by_class.fabricated_identity, 1);
  assert.equal(grok.by_class.contract_noncompliance, 1);
  assert.equal(grok.fabrication_rate, 2 / 3);

  const gemini = metrics.per_seat.gemini;
  // gemini: 1 research + 2 challenge, all clean (referee is attributed to role R)
  assert.equal(gemini.counted_calls, 3);
  assert.equal(gemini.fabrication_events, 0);
  assert.equal(gemini.fabrication_rate, 0);

  const referee = metrics.per_seat["gemini:referee"];
  // referee: 2 verdicts — 1 fabricated reference, 1 transport (excluded from fabrication)
  assert.equal(referee.counted_calls, 2);
  assert.equal(referee.fabrication_events, 1);
  assert.equal(referee.by_class.fabricated_reference, 1);
  assert.equal(referee.transport_failures, 1);
  assert.equal(referee.fabrication_rate, 1 / 1, "transport failures are excluded from the rate denominator");

  console.log("Case 2 OK: burns attribute per seat with honest rate denominators");
}

// Case 3: transport failures are availability, never hallucination
{
  const metrics = deriveHallucinationMetrics({
    state: "needs-work",
    research: { artifacts: [], burned: [{ seat: "claude", reason: "transport-error" }] },
    rounds: [],
    ledger: { denied_twice: [], burned_referee_verdicts: [], plan_lineage: [] }
  });
  const claude = metrics.per_seat.claude;
  assert.equal(claude.transport_failures, 1);
  assert.equal(claude.fabrication_events, 0);
  assert.equal(claude.fabrication_rate, null, "no fabrication-eligible calls -> null rate, not 0");
  console.log("Case 3 OK: transport failures never count as hallucination");
}

// Case 4: totals reconcile with per-seat sums
{
  const metrics = deriveHallucinationMetrics(RESULT);
  const summedEvents = Object.values(metrics.per_seat).reduce((total, seat) => total + seat.fabrication_events, 0);
  assert.equal(metrics.totals.fabrication_events, summedEvents);
  const summedCalls = Object.values(metrics.per_seat).reduce((total, seat) => total + seat.counted_calls, 0);
  assert.equal(metrics.totals.counted_calls, summedCalls);
  assert.ok(metrics.non_claims.some((line) => /semantic/.test(line)));
  console.log("Case 4 OK: totals reconcile and non-claims travel with the record");
}

// Case 5: aggregation across runs sums events and recomputes rates
{
  const runA = deriveHallucinationMetrics(RESULT);
  const runB = deriveHallucinationMetrics(RESULT);
  const aggregate = aggregateHallucinationMetrics([runA, runB]);
  assert.equal(aggregate.kind, "hallucination-metrics-aggregate");
  assert.equal(aggregate.runs, 2);
  assert.equal(aggregate.per_seat.grok.fabrication_events, 4);
  assert.equal(aggregate.per_seat.grok.counted_calls, 6);
  assert.equal(aggregate.per_seat.grok.fabrication_rate, 4 / 6);
  assert.equal(aggregate.totals.fabrication_events, runA.totals.fabrication_events * 2);
  console.log("Case 5 OK: aggregation sums events and recomputes rates from sums");
}

// Case 6: determinism — same input, byte-identical metrics
{
  const a = JSON.stringify(deriveHallucinationMetrics(RESULT));
  const b = JSON.stringify(deriveHallucinationMetrics(RESULT));
  assert.equal(a, b);
  console.log("Case 6 OK: derivation is pure and deterministic");
}

console.log("test-hallucination-metrics.mjs OK");
