# Fill audit

A keyless, zero-dependency analyzer for a wallet's BUY fills on binary Up/Down
markets (for example Polymarket's short-horizon crypto markets).

It exists because public "how the top bots work" breakdowns quote per-market
statistics from fills and then attribute intent — signals, fair-value models,
hedging logic — that fills cannot reveal. This tool reports only what the fills
support, and adds the numbers those write-ups leave out.

| Write-up gap | What this audit does |
| --- | --- |
| Medians with no sample size | Every summary carries `n_markets` / `n_two_sided`, overall and per timeframe |
| "Below $1" ignores fees | `set_cost_after_fees` folds per-fill fees into each side's cost |
| PnL not decomposed | `pnl.matched` (complete-set, settlement-independent) vs `pnl.unmatched_resolved` (directional) vs `fees_paid` |
| A set above $1 described as a "hedge" | Shown directly as negative `matched_pnl` |
| Passive-fill adverse selection ignored | `adverse_selection.remainder_lost_share`: how often the unmatched remainder was on the losing side |
| Intent read from fills | Never reported; see `non_claims` in the output |

Unresolved markets contribute no directional PnL and are counted in
`n_unresolved_excluded`. Malformed fills throw.

## Run

```bash
node docs/runs/fill-audit/test.mjs
node docs/runs/fill-audit/audit.mjs input.json
```

Input shape:

```json
{
  "fills": [
    { "market": "btc-1h-0900", "timeframe": "1h", "outcome": "up", "side": "buy",
      "price": 0.46, "size": 100, "ts": 1760000000, "fee": 0 }
  ],
  "resolutions": { "btc-1h-0900": "down" }
}
```

`ts` is seconds; `fee` (optional) is the total fee paid on that fill in the
quote currency. Fetching fills is deliberately out of scope: the tool has no
network access and no credentials.
