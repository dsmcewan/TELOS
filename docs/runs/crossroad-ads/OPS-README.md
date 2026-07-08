# Crossroad Ads-Ops Loop

Bounded, signed, agent-operated advertising from the **certified** campaign
plan. This is the first live client of `forge/operator.mjs`: it turns
`docs/runs/crossroad-phase2/deliverables/ads/campaign-plan.json` (gate-certified
in PR #81) into PAUSED Meta objects and then applies the plan's numeric
kill/scale rules to weekly insights — never exceeding its bounds, never going
live without a human.

## Pieces

| File | Role |
| --- | --- |
| `ads-lib.mjs` | Typed meta-ads client (via the seat-router loadout), plan/credential helpers, and the pure provisioning-order + kill/scale rule evaluation (unit-tested). |
| `provision.mjs` | Creates campaigns → adsets from the plan as **PAUSED** objects (idempotent via `workdir/provision-state.json`); every creation is a signed ledger line. |
| `ops-pass.mjs` | One ops pass: reads insights per adset, evaluates the certified **kill** (ROAS < floor after min spend → pause) and **scale** (ROAS ≥ target → +step%, capped) rules, executes only bounded actions. |
| `drive-ops.mjs` | The loop: provision (once) then an ops pass. Re-run weekly once live. |
| `test-ads-ops.mjs` | Keyless test (stub meta client): budget math, provisioning order, rule evaluation, budget cap, and the signed-ledger / needs-human operator integration. |

## Safety invariants (enforced, not optional)

- **PAUSED-only creation** — enforced by the meta-ads server; going live is a human click in Ads Manager, never an API default.
- **Daily-budget cap** — `META_MAX_DAILY_CENTS` (default 2000 = $20/day), enforced twice: operator bound + server refusal.
- **No delete** — `pause` is the strongest destructive action available.
- **Signed ops ledger** — every decision is an Ed25519-signed line (`workdir/ops-ledger.jsonl`), tamper-evident and verifiable.
- **Needs-human, never faked** — missing credentials, an out-of-bounds budget, or a quota failure records a `needs-human` item (`workdir/INBOX.md`) and halts. The loop does not invent an ad account or metrics.

## Current status: ARMED, awaiting go-live

Running `node docs/runs/crossroad-ads/drive-ops.mjs` today produces a
needs-human go-live checklist (no Meta credentials configured). The loop is
built, tested, and correct; it is blocked only on the human step it must never
perform itself.

## Go-live (the human step)

1. Complete `docs/runs/crossroad-threads/HUMAN-SETUP.md` — Meta Business account,
   ad account, page, pixel + CAPI, and a system-user token.
2. Export `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_PAGE_ID` (optionally
   `META_MAX_DAILY_CENTS`).
3. `node docs/runs/crossroad-ads/provision.mjs` — creates the PAUSED objects.
4. **Review and launch in Ads Manager** (the deliberate human gate).
5. Weekly: `node docs/runs/crossroad-ads/ops-pass.mjs` (or cron `drive-ops.mjs`)
   applies the certified kill/scale rules to the prior week's insights.
