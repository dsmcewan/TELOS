// test-standing.mjs — pure standing derivation: determinism, backoff, new-model firewall, limits.
import assert from "node:assert/strict";
import { STANDING_CONFIG, DEFAULT_BACKOFF, conservativeStanding, deriveStanding } from "../standing.mjs";

// Build N calibration records for a seat/modelVersion with a given verified/dismissed split.
function records({ seat, modelVersion, role = "advisory", workstream = "security-trust", riskClass = "authorization", n, verified = 0, dismissed = 0 }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const disposition = i < verified ? "verified" : i < verified + dismissed ? "dismissed" : "unresolved";
    out.push({ seat, modelVersion, role, workstream, riskClass, severity: "high", disposition, raised_at: null, decided_at: null });
  }
  return out;
}

// Case 1: sparse -> conservative; rich at a backoff level -> measured.
{
  // Below minSamples at every backoff level (even though the model version has records) -> conservative.
  const reallySparse = deriveStanding({ records: records({ seat: "grok", modelVersion: "grok-4.3", n: 2 }), segment: { seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "security-trust", riskClass: "authorization" } });
  assert.equal(reallySparse.tier, "conservative", "below minSamples at every level -> conservative");
  const rich = deriveStanding({ records: records({ seat: "grok", modelVersion: "grok-4.3", n: 8, verified: 6, dismissed: 1 }), segment: { seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "security-trust", riskClass: "authorization" } });
  assert.equal(rich.tier, "measured", "8 records -> measured at level 0");
  assert.equal(rich.backoff_level, 0);
  console.log("Case 1 OK: sparse -> conservative, rich -> measured");
}

// Case 2: determinism + no I/O — same records in yield the same output.
{
  const recs = records({ seat: "grok", modelVersion: "grok-4.3", n: 8, verified: 5, dismissed: 2 });
  const seg = { seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "security-trust", riskClass: "authorization" };
  assert.deepEqual(deriveStanding({ records: recs, segment: seg }), deriveStanding({ records: [...recs], segment: seg }), "deterministic");
  console.log("Case 2 OK: determinism");
}

// Case 3: hierarchical backoff — thin at level 0 but rich at a coarser level.
{
  // 6 records for the seat/role/riskClass but spread across DIFFERENT workstreams (thin per-workstream)
  const spread = [];
  for (let i = 0; i < 6; i++) spread.push({ seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "ws-" + i, riskClass: "authorization", severity: "high", disposition: "verified" });
  const st = deriveStanding({ records: spread, segment: { seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "ws-unique", riskClass: "authorization" } });
  assert.equal(st.tier, "measured", "backs off to a coarser level");
  assert.ok(st.backoff_level >= 2, "matched a coarser level (role+riskClass): " + st.backoff_level);
  console.log("Case 3 OK: hierarchical backoff");
}

// Case 4: NEW-MODEL FIREWALL — a version with zero records is conservative despite predecessor abundance.
{
  const predecessor = records({ seat: "grok", modelVersion: "grok-4.2", n: 20, verified: 18, dismissed: 1 });
  const st = deriveStanding({ records: predecessor, segment: { seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "security-trust", riskClass: "authorization" } });
  assert.equal(st.tier, "conservative", "new model version does not inherit predecessor standing");
  console.log("Case 4 OK: new-model firewall");
}

// Case 5: standing has NO approval-shaped field, and a strong standing only bounds TTL.
{
  const st = deriveStanding({ records: records({ seat: "grok", modelVersion: "grok-4.3", n: 10, verified: 10 }), segment: { seat: "grok", modelVersion: "grok-4.3", role: "advisory", workstream: "security-trust", riskClass: "authorization" } });
  for (const k of ["approve", "authorized", "decision", "waive", "gate"]) assert.ok(!(k in st), `standing must not expose '${k}'`);
  const [lo, hi] = STANDING_CONFIG.ttlMultiplierBounds;
  assert.ok(st.ttl_multiplier >= lo && st.ttl_multiplier <= hi, "ttl_multiplier clamped");
  assert.equal(conservativeStanding().ttl_multiplier, 1.0, "conservative never shortens");
  console.log("Case 5 OK: influence-only, no approval field");
}

console.log("test-standing.mjs OK");
