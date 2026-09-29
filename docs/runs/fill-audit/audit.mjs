#!/usr/bin/env node
// Fill audit for binary Up/Down markets: computes what a wallet's BUY fills
// actually show, and nothing they cannot show.
//
// It reproduces the per-market statistics quoted in public "bot breakdown"
// write-ups (two-sided share, first-entry gap, side balance, complete-set cost)
// and adds what those write-ups omit: sample counts, fees folded into cost,
// PnL decomposed into the matched (complete-set) and unmatched (directional)
// components, and an adverse-selection read on the unmatched remainder.
//
// Fail-closed: a malformed fill throws; an unresolved market contributes no
// realized PnL and is counted as unresolved, never assumed to have won.
// Strategy intent (signals, models, cancelled orders) is not observable from
// fills and is never reported — see NON_CLAIMS.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUTCOMES = new Set(["up", "down"]);
const NON_CLAIMS = Object.freeze([
  "No strategy intent is inferred: fills do not reveal signals, fair-value models, or inputs.",
  "Cancelled and unfilled orders are invisible, so passive-vs-aggressive behavior is only known where fills carry a liquidity flag.",
  "Unmatched PnL uses the side's average cost; it is exact at settlement, not a mark-to-market before it.",
  "Wallet selection is outside this audit: auditing only wallets already known to be profitable is survivorship-biased."
]);

function fail(message) {
  throw new Error(`fill-audit: ${message}`);
}

export function validateFill(fill, index) {
  const at = `fill[${index}]`;
  if (fill === null || typeof fill !== "object") fail(`${at} is not an object`);
  if (typeof fill.market !== "string" || fill.market.length === 0) fail(`${at}.market must be a non-empty string`);
  if (!OUTCOMES.has(fill.outcome)) fail(`${at}.outcome must be "up" or "down"`);
  if (fill.side !== undefined && fill.side !== "buy") fail(`${at}.side must be "buy" (sell fills are out of scope)`);
  if (!Number.isFinite(fill.price) || fill.price <= 0 || fill.price >= 1) fail(`${at}.price must be in (0, 1)`);
  if (!Number.isFinite(fill.size) || fill.size <= 0) fail(`${at}.size must be > 0`);
  if (!Number.isFinite(fill.ts)) fail(`${at}.ts must be a finite number (seconds)`);
  if (fill.fee !== undefined && (!Number.isFinite(fill.fee) || fill.fee < 0)) fail(`${at}.fee must be >= 0`);
  return fill;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value, digits = 4) {
  return value === null ? null : Number(value.toFixed(digits));
}

function sideStats(fills) {
  if (fills.length === 0) return null;
  let qty = 0, notional = 0, fees = 0, first = Infinity;
  for (const f of fills) {
    qty += f.size;
    notional += f.price * f.size;
    fees += f.fee ?? 0;
    first = Math.min(first, f.ts);
  }
  // Fees are folded into the average cost: a complete set is only "below $1"
  // if it is below $1 after what was actually paid to acquire it.
  return { qty, vwap: notional / qty, cost_per_share: (notional + fees) / qty, fees, first_ts: first };
}

export function auditMarket(market, fills, resolution) {
  const up = sideStats(fills.filter((f) => f.outcome === "up"));
  const down = sideStats(fills.filter((f) => f.outcome === "down"));
  const timeframe = fills[0].timeframe ?? "unknown";
  const twoSided = up !== null && down !== null;
  const resolved = OUTCOMES.has(resolution);
  const out = { market, timeframe, two_sided: twoSided, resolved, fills: fills.length };

  if (!twoSided) {
    const only = up ?? down;
    const side = up ? "up" : "down";
    out.unmatched_side = side;
    out.unmatched_qty = only.qty;
    out.matched_qty = 0;
    out.matched_pnl = 0;
    out.fees = only.fees;
    out.unmatched_pnl = resolved ? only.qty * ((resolution === side ? 1 : 0) - only.cost_per_share) : null;
    out.unmatched_side_lost = resolved ? resolution !== side : null;
    return out;
  }

  const matched = Math.min(up.qty, down.qty);
  const setCost = up.cost_per_share + down.cost_per_share;
  out.entry_gap_s = Math.abs(up.first_ts - down.first_ts);
  out.balance = Math.min(up.qty, down.qty) / Math.max(up.qty, down.qty);
  out.set_vwap = up.vwap + down.vwap;
  out.set_cost_after_fees = setCost;
  out.matched_qty = matched;
  // A matched pair pays exactly $1 whichever side settles, so this component
  // is known without the resolution.
  out.matched_pnl = matched * (1 - setCost);
  out.fees = up.fees + down.fees;

  const excess = up.qty - down.qty;
  if (excess === 0) {
    out.unmatched_side = null;
    out.unmatched_qty = 0;
    out.unmatched_pnl = 0;
    out.unmatched_side_lost = null;
    return out;
  }
  const side = excess > 0 ? "up" : "down";
  const stats = excess > 0 ? up : down;
  out.unmatched_side = side;
  out.unmatched_qty = Math.abs(excess);
  out.unmatched_pnl = resolved ? out.unmatched_qty * ((resolution === side ? 1 : 0) - stats.cost_per_share) : null;
  out.unmatched_side_lost = resolved ? resolution !== side : null;
  return out;
}

function summarize(markets) {
  const two = markets.filter((m) => m.two_sided);
  const resolved = markets.filter((m) => m.resolved);
  const withRemainder = resolved.filter((m) => m.unmatched_side_lost !== null);
  const sum = (rows, key) => rows.reduce((acc, m) => acc + (m[key] ?? 0), 0);
  return {
    n_markets: markets.length,
    n_two_sided: two.length,
    two_sided_share: round(two.length / markets.length),
    median_entry_gap_s: round(median(two.map((m) => m.entry_gap_s)), 1),
    median_balance: round(median(two.map((m) => m.balance))),
    median_set_vwap: round(median(two.map((m) => m.set_vwap))),
    median_set_cost_after_fees: round(median(two.map((m) => m.set_cost_after_fees))),
    pnl: {
      matched: round(sum(markets, "matched_pnl"), 2),
      unmatched_resolved: round(sum(resolved, "unmatched_pnl"), 2),
      fees_paid: round(sum(markets, "fees"), 2),
      n_unresolved_excluded: markets.length - resolved.length
    },
    adverse_selection: {
      n_resolved_with_remainder: withRemainder.length,
      remainder_lost_share: withRemainder.length === 0
        ? null
        : round(withRemainder.filter((m) => m.unmatched_side_lost).length / withRemainder.length)
    }
  };
}

export function audit({ fills, resolutions = {} }) {
  if (!Array.isArray(fills) || fills.length === 0) fail("fills must be a non-empty array");
  fills.forEach(validateFill);
  const byMarket = new Map();
  for (const f of fills) {
    if (!byMarket.has(f.market)) byMarket.set(f.market, []);
    byMarket.get(f.market).push(f);
  }
  for (const [market, group] of byMarket) {
    const frames = new Set(group.map((f) => f.timeframe ?? "unknown"));
    if (frames.size > 1) fail(`market ${market} has fills with conflicting timeframes`);
  }
  const markets = [...byMarket].map(([market, group]) => auditMarket(market, group, resolutions[market]));
  const timeframes = [...new Set(markets.map((m) => m.timeframe))].sort();
  return {
    overall: summarize(markets),
    by_timeframe: Object.fromEntries(timeframes.map((t) => [t, summarize(markets.filter((m) => m.timeframe === t))])),
    markets,
    non_claims: NON_CLAIMS
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node audit.mjs <input.json>   # { fills: [...], resolutions: { market: \"up\"|\"down\" } }");
    process.exit(2);
  }
  const report = audit(JSON.parse(readFileSync(file, "utf8")));
  console.log(JSON.stringify({ overall: report.overall, by_timeframe: report.by_timeframe, non_claims: report.non_claims }, null, 2));
}
