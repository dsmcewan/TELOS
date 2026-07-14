// standing.mjs — pure reviewer calibration (Required Point 13). Recomputed from the signed proposal
// ledger every time (never a stored mutable score). Outputs are INFLUENCE-ONLY (hold TTL, second
// reviewer, escalation bias); standing can never satisfy an approval or bypass a deterministic check.
// A new concrete model version starts conservative — it never inherits a predecessor's reputation.
import { canonicalize } from "../merkle-dag/vendor.mjs";

export const STANDING_CONFIG = {
  minSamples: 5,               // per backoff level
  minModelVersionSamples: 1,   // a model version with zero ledger records is conservative, full stop
  ttlMultiplierBounds: [0.5, 1.5]
};

// The contract's example backoff order (most specific -> least), then a conservative default.
export const DEFAULT_BACKOFF = [
  ["seat", "modelVersion", "role", "workstream", "riskClass"],
  ["seat", "role", "workstream", "riskClass"],
  ["seat", "role", "riskClass"],
  ["seat", "role"]
];

export function segmentKey(segment, dims) {
  const restricted = {};
  for (const d of dims) restricted[d] = segment[d] ?? null;
  return canonicalize(restricted);
}

export function conservativeStanding() {
  return {
    tier: "conservative", backoff_level: "default", sample_count: 0,
    ttl_multiplier: 1.0,                 // never SHORTENS review from a cold start
    second_reviewer_recommended: true,
    escalation_bias: "raise"
  };
}

// Project verified proposal-ledger events -> flat calibration records (join concerns to their
// dispositions by concern_ref). The caller reads + verifies the ledger; this module does NO I/O.
export function standingRecordsFromEvents(events, dispositions = null) {
  const concerns = [];
  const disp = dispositions ? [...dispositions] : [];
  for (const e of events || []) {
    if (e.stage === "review" && Array.isArray(e.concerns)) for (const c of e.concerns) concerns.push({ ...c, _raised_at: e.recorded_at ?? null });
    if (!dispositions && e.stage === "disposition" && e.disposition) disp.push({ ...e.disposition, _decided_at: e.recorded_at ?? null });
  }
  const dispByConcern = new Map();
  for (const d of disp) { const prev = dispByConcern.get(d.concern_ref); if (!prev) dispByConcern.set(d.concern_ref, d); }
  return concerns.map((c) => {
    const d = dispByConcern.get(c.concern_ref) || null;
    return {
      seat: c.raised_by && c.raised_by.seat,
      modelVersion: (c.raised_by && c.raised_by.provenance && (c.raised_by.provenance.response_model || c.raised_by.provenance.model)) || null,
      role: (c.raised_by && c.raised_by.role) || null,
      workstream: c.workstream ?? null,
      riskClass: c.risk_class ?? null,
      severity: c.severity ?? null,
      disposition: d ? d.disposition : "unresolved",
      raised_at: c._raised_at, decided_at: d ? d._decided_at : null
    };
  });
}

const SEVERITY_RANK = { low: 0, medium: 1, high: 2, critical: 3 };

function measures(bucket, config) {
  const n = bucket.length;
  const verified = bucket.filter((r) => r.disposition === "verified").length;
  const dismissed = bucket.filter((r) => r.disposition === "dismissed").length;
  const expired = bucket.filter((r) => r.disposition === "expired-unresolved").length;
  const verified_rate = verified / n;
  const dismissed_rate = dismissed / n;
  const unresolved_hold_rate = expired / n;
  // Severity calibration: mean severity rank of DISMISSED concerns (overcall score) — high = a seat
  // that flags critical things that turn out unfounded. Bias TTL down for well-calibrated seats.
  const dismissedSev = bucket.filter((r) => r.disposition === "dismissed").map((r) => SEVERITY_RANK[r.severity] ?? 1);
  const severity_calibration = dismissedSev.length ? dismissedSev.reduce((a, b) => a + b, 0) / dismissedSev.length : 0;
  const [lo, hi] = config.ttlMultiplierBounds;
  // Well-calibrated (high verified_rate, low overcall) -> shorter holds; poorly-calibrated -> longer.
  let mult = 1 + (dismissed_rate - verified_rate) * 0.5 + (severity_calibration / 3) * 0.25;
  mult = Math.max(lo, Math.min(mult, hi));
  return {
    concerns_raised: n, verified_rate, dismissed_rate, unresolved_hold_rate, severity_calibration,
    ttl_multiplier: mult,
    second_reviewer_recommended: verified_rate < 0.5 || unresolved_hold_rate > 0.2,
    escalation_bias: verified_rate >= 0.5 ? "neutral" : "raise"
  };
}

/**
 * Derive standing for a segment. NEW-MODEL FIREWALL first: a concrete model version with fewer than
 * minModelVersionSamples ledger records is conservative before any backoff (so it never inherits a
 * predecessor even though coarser backoff levels aggregate across versions). Then walk the backoff
 * order, returning the first level with >= minSamples.
 * @param segment { seat, modelVersion, role, workstream, riskClass }
 */
export function deriveStanding({ events, dispositions = null, records = null, segment, config = STANDING_CONFIG, backoff = DEFAULT_BACKOFF }) {
  const all = records || standingRecordsFromEvents(events || [], dispositions);
  const versionRecords = all.filter((r) => r.seat === segment.seat && r.modelVersion === segment.modelVersion);
  if (versionRecords.length < config.minModelVersionSamples) return conservativeStanding();

  for (let level = 0; level < backoff.length; level++) {
    const dims = backoff[level];
    const key = segmentKey(segment, dims);
    const bucket = all.filter((r) => segmentKey(r, dims) === key);
    if (bucket.length >= config.minSamples) {
      return { tier: "measured", backoff_level: level, sample_count: bucket.length, ...measures(bucket, config) };
    }
  }
  return conservativeStanding();
}
