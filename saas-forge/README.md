# TELOS SaaS Forge

Point the forge at a project and it drives that project to **market-ready** the
TELOS way — research the capabilities a SaaS needs, generate each team's
artifacts, put **every team through an adversarial breakout on facts**, settle a
signed ledger, and gate — looping until certified.

This is the **generator layer wired into `merkle-dag`'s `dispatch`** plus a
**breakout per SaaS team**. The engine already plans, isolates (Rule 1), verifies
by test (Rule 3), settles a signed ledger, and forward-invalidates by hash. The
forge supplies the generator and the per-team adversarial loop.

## The loop (`forge.mjs`)

```
research ─▶ plan ─▶ generate (dispatch) ─▶ verify ─▶ breakout per team ─▶ signed ledger ─▶ market gate
   ▲                                                                                          │
   └───────────────────────────────── repeat until gate = pass ────────────────────────────────┘
```

## The teams (`workstreams.mjs`)

One entry per market workstream; each owns what it writes, its node test, its
breakout checks, and its generator:

| Team | Artifact | Breakout asserts (on disk) |
| --- | --- | --- |
| product-architecture | `docs/ARCHITECTURE.md` | references the researched stack |
| business-positioning | `docs/POSITIONING.md` | ICP + differentiation present |
| backend-schema | `db/schema.sql` | tables + RLS `create policy` |
| security-trust | `web/site/csp.txt` | `Content-Security-Policy` / `default-src` |
| accuracy-evals | `evals/scorecard.json` + `evals/run.mjs` | precision clears threshold (the test *runs* the eval) |
| scale-operations | `docs/OPERATIONS.md` | S3 + CloudFront + SLOs |
| frontend-brand-experience | `web/*` + screenshots | brand token `#69e7ff`, first-screen proof band |

## Breakout on facts, not trivia (`breakouts.mjs`)

Every team runs the real `breakout/` engine (`runBreakout`: challenge → revise →
loop until it survives). The challenger is **fact-grounded** — it re-verifies the
team's checks against the *built artifact* and raises a blocker for each one that
doesn't hold. A team converges only when its product evidence actually survives —
the "cat is drawn", not "the capital of Kuwait". The **market packets are
generated from those breakout records**, never hand-asserted, and the gate
independently re-verifies. Live, the same loop is driven by `makeCouncilBreakout`
(grok challenges, the builder team revises, a reviewer accepts) — still anchored
to these checks.

## Run it

```bash
npm test   # keyless e2e: 7 teams generate + breakout-survive + gate pass; plus fail-closed
```

A real run reports `converged: true | gate: pass`, with a `PASS` breakout for
each of the 7 teams (each with N fact-checks over its own artifact).

## Going live (the injected boundaries)

- **Context7 research:** pass `docsFor: makeContext7DocsFor({ resolve, queryDocs })`.
- **Model-seat generation:** replace `makeDemoGenerators` with a producer that
  calls `ai-peer-mcp` seats per team; artifacts become model-authored, then
  test-verified, breakout-survived, and signed.
- **Live breakout:** swap `factBreakout` for `makeCouncilBreakout` (grok adversary
  + builder team + reviewer), still anchored to the on-disk checks.
- **Real project root:** point `projectRoot` at the actual convergence-demo tree.

## Honest scope

- All **7 teams** run end-to-end with a real per-team breakout, green keyless test
  + a fail-closed test (break one team's artifact → that team's breakout does not
  converge → the forge does not converge).
- The generators + the fact-challenger are deterministic stand-ins for live
  `ai-peer-mcp` seat generation and the grok-driven `makeCouncilBreakout`. The
  injected boundaries (`docsFor`, `makeGenerators`, `repairFor`) are where live
  calls plug in.
- The gate re-verifies the UI team's breakout today (its `lexi_class_ui_status`
  is `meets`); the forge enforces every team's breakout. Extending the gate to
  re-verify every team's breakout record is a clean follow-up in `build-gate`.
