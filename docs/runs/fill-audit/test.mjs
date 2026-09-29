#!/usr/bin/env node

import assert from "node:assert/strict";

import { audit } from "./audit.mjs";

const fill = (market, outcome, price, size, ts, extra = {}) =>
  ({ market, timeframe: "1h", outcome, side: "buy", price, size, ts, ...extra });

// The write-up's own example: Up at $0.46 then Down at $0.51 is a $0.97 set.
// The matched part earns 3c/share whichever side settles.
{
  const report = audit({ fills: [fill("m1", "up", 0.46, 100, 0), fill("m1", "down", 0.51, 100, 180)] });
  const m = report.markets[0];
  assert.equal(m.two_sided, true);
  assert.equal(m.entry_gap_s, 180);
  assert.equal(m.balance, 1);
  assert.ok(Math.abs(m.set_vwap - 0.97) < 1e-9);
  assert.ok(Math.abs(m.matched_pnl - 3) < 1e-9);
  assert.equal(m.unmatched_qty, 0);
  assert.equal(report.overall.pnl.n_unresolved_excluded, 1);
}

// Fees are part of cost: a $0.97 set with 4c/share of fees is a loss, not an edge.
{
  const report = audit({
    fills: [fill("m1", "up", 0.46, 100, 0, { fee: 2 }), fill("m1", "down", 0.51, 100, 60, { fee: 2 })]
  });
  const m = report.markets[0];
  assert.ok(Math.abs(m.set_cost_after_fees - 1.01) < 1e-9);
  assert.ok(m.matched_pnl < 0);
}

// A set bought above $1 (the ~$1.08 "dynamic hedge") loses on the matched part;
// any profit must come from the unmatched directional remainder.
{
  const report = audit({
    fills: [fill("m1", "up", 0.60, 100, 0), fill("m1", "down", 0.48, 45, 26)],
    resolutions: { m1: "up" }
  });
  const m = report.markets[0];
  assert.ok(Math.abs(m.matched_pnl - 45 * (1 - 1.08)) < 1e-9);
  assert.equal(m.unmatched_side, "up");
  assert.equal(m.unmatched_qty, 55);
  assert.ok(Math.abs(m.unmatched_pnl - 55 * 0.4) < 1e-9);
  assert.equal(m.unmatched_side_lost, false);
}

// Adverse selection: passive bids fill on the falling side, so the unmatched
// remainder is reported by whether it lost, with the sample count beside it.
{
  const report = audit({
    fills: [
      fill("a", "up", 0.45, 100, 0), fill("a", "down", 0.50, 60, 90),
      fill("b", "down", 0.44, 100, 0), fill("b", "up", 0.52, 70, 120),
      fill("c", "up", 0.40, 50, 0)
    ],
    resolutions: { a: "down", b: "up", c: "up" }
  });
  assert.equal(report.overall.adverse_selection.n_resolved_with_remainder, 3);
  assert.ok(Math.abs(report.overall.adverse_selection.remainder_lost_share - 2 / 3) < 1e-4);
  assert.equal(report.overall.n_two_sided, 2);
}

// Unresolved markets never contribute realized directional PnL.
{
  const report = audit({ fills: [fill("m1", "up", 0.5, 10, 0)] });
  assert.equal(report.markets[0].unmatched_pnl, null);
  assert.equal(report.overall.pnl.unmatched_resolved, 0);
  assert.equal(report.overall.adverse_selection.remainder_lost_share, null);
}

// Summaries are split by timeframe and always carry their sample sizes.
{
  const report = audit({
    fills: [
      { ...fill("x", "up", 0.5, 1, 0), timeframe: "5m" },
      { ...fill("y", "up", 0.5, 1, 0), timeframe: "4h" }, { ...fill("y", "down", 0.45, 1, 600), timeframe: "4h" }
    ]
  });
  assert.deepEqual(Object.keys(report.by_timeframe), ["4h", "5m"]);
  assert.equal(report.by_timeframe["5m"].n_markets, 1);
  assert.equal(report.by_timeframe["4h"].two_sided_share, 1);
}

// Fail-closed on malformed input.
const rejects = (input, pattern) => assert.throws(() => audit(input), pattern);
rejects({ fills: [] }, /non-empty array/);
rejects({ fills: [fill("m", "yes", 0.5, 1, 0)] }, /outcome/);
rejects({ fills: [fill("m", "up", 1.2, 1, 0)] }, /price/);
rejects({ fills: [fill("m", "up", 0.5, 0, 0)] }, /size/);
rejects({ fills: [fill("m", "up", 0.5, 1, 0, { side: "sell" })] }, /side/);
rejects({ fills: [fill("m", "up", 0.5, 1, 0, { fee: -1 })] }, /fee/);
rejects({ fills: [{ ...fill("m", "up", 0.5, 1, 0), timeframe: "5m" }, fill("m", "down", 0.5, 1, 0)] }, /conflicting timeframes/);

// No intent claims are ever emitted.
{
  const report = audit({ fills: [fill("m1", "up", 0.5, 1, 0)] });
  assert.ok(report.non_claims.length >= 4);
  assert.ok(!JSON.stringify(report.markets).match(/signal|model|strategy/i));
}

console.log("fill-audit: all checks passed");
