# ai-forge — Phase C.2 Design (catalog breadth: three full patterns)

**Goal:** Grow the ai-forge catalog with three new full-depth, standalone AI-architecture
patterns — **multi-agent**, **eval-harness**, and **serving+guardrails** — each an
8-workstream `patterns/<name>.mjs` on the unchanged forge, each forging a self-contained
runnable system whose every workstream ships a genuine keyless executable selftest, plus
the generic Phase B `design` workstream. One combined cycle, one spec, one plan
(structured as three pattern-groups of tasks).

**Architecture:** Three pure-data patterns consumed by the existing `forge.mjs`. Unlike
the TELOS pattern (which wrapped the real spine via `spineRoot`), these are ordinary AI
architectures: each workstream's render writes a self-contained artifact and an inline
keyless, deterministic selftest run as its `nodeTest` (the RAG-pattern model). Spine,
`saas-forge`, the RAG/TELOS patterns, and the Phase A/B forge modules are unchanged.

**Status:** design approved 2026-06-29; spec → (this doc) → `writing-plans` → build. See
[`docs/ROADMAP.md`](../ROADMAP.md). Builds on
[Phase A](2026-06-29-ai-forge-phase-a-design.md),
[Phase B](2026-06-29-ai-forge-phase-b-design.md),
[Phase C](2026-06-29-ai-forge-phase-c-design.md).

---

## Context

Phases A–C made adding a pattern mostly **data** (`patterns/<name>.mjs` of workstreams)
and made the `design` workstream generic. Phase C delivered one pattern (the
self-similar TELOS pattern). Phase C.2 grows breadth with the three remaining catalog
candidates from the roadmap, each built to the same depth and rigor as RAG/TELOS.

This is a deliberately large single cycle (24 workstreams). The size risk was raised and
the combined-cycle scope was chosen explicitly. The plan mitigates by grouping tasks per
pattern so each pattern is an independently testable slice.

**Core principle (unchanged from A–C):** the thing that builds is never the thing that
certifies. Each workstream's render produces an artifact (a claim); the gate independently
re-runs that artifact's node test (Rule 3) against fixed fixtures; a workstream whose
artifact misbehaves cannot settle. The checks are **genuine and executable**, never
shape-only — the same bar RAG's eval and the TELOS selftests met.

## Framing decisions (apply to all three patterns)

- **Standalone, not spine-wrapping.** Each forged artifact is self-contained and runnable
  on its own; no `spineRoot` injection. (TELOS was the special self-similar case.)
- **Keyless + deterministic.** No API keys; no `Date.now`/`Math.random`/network on the
  committed test path. Any "agent thinking", "model prediction", or "clock" is an injected
  deterministic stub (e.g. `callAgent`, `predict`, `now`). Live model calls, if ever
  added, live behind the existing `live.mjs` boundary — out of scope here.
- **Fixture isolation.** Any selftest that writes scratch/state (notably `audit`) builds it
  under `os.tmpdir()`, never the project root or its `.telos/` (which holds the forge's
  live plan+ledger mid-run).
- **Design workstream included.** Each pattern appends the generic
  `makeDesignWorkstream(buildWorkstreams)` → a verified `DESIGN.md` per pattern (coverage,
  data-flow == DAG, realized-on-disk, model==ledger-signer, sections).
- **≥1 fail-closed sub-case per pattern**, proving the gates are not tautologies: perturb a
  workstream's render so its artifact misbehaves and assert the forge does **not** converge.
- **Sanitized evidence** per pattern under `docs/runs/ai-forge-{multiagent,eval,serving}/`
  (no absolute paths, no secrets, no timestamps — the same sanitization A–C enforce).

Each pattern assembles as `workstreams: [...buildWorkstreams, makeDesignWorkstream(buildWorkstreams)]`.

## Pattern 1 — `patterns/multiagent.mjs` (coordinating multi-role agent system)

| id | signer | forged artifact | executable selftest (node test) asserts |
|---|---|---|---|
| `roles` | codex | `agents/roles.mjs` — registry of ≥3 agent roles `{id,capability,lens}` | registry has ≥3 roles, unique ids, every required field present |
| `protocol` | codex | `agents/protocol.mjs` — message schema + `validate(msg)` | well-formed message passes; a missing/wrong-typed field → **rejected** |
| `router` | agy | `agents/router.mjs` — `route(task, roles)` by capability | a fixed task → expected role; an unmatched task → defined fallback (or throw) |
| `blackboard` | codex | `agents/blackboard.mjs` — shared `put/get` store | put→get round-trip; absent key → null/undefined; distinct keys isolated |
| `orchestrator` | claude | `agents/orchestrator.mjs` — `runRound(task, roles, callAgent)` via an injected deterministic stub caller | a stubbed 3-agent round → 3 outputs, **order preserved**, all recorded on the blackboard |
| `aggregator` | claude | `agents/aggregate.mjs` — majority vote + deterministic tie-break | fixed outputs → known aggregate; a tie → deterministic resolution |
| `termination` | grok | `agents/terminate.mjs` — `shouldStop(state, maxRounds)` | a converged state stops early; a runaway scenario halts at `maxRounds` (no infinite loop) |
| `design` | claude | `docs/DESIGN.md` + `docs/design/verify.mjs` | generic Phase B design check vs plan+ledger+build |

**DAG:** roots `roles`, `protocol`; `router ← {roles}`; `blackboard ← {protocol}`;
`orchestrator ← {roles, router, blackboard, protocol}`; `aggregator ← {orchestrator}`;
`termination ← {orchestrator}`; `design ← {all 7}`.

**Fail-closed:** perturb `protocol`'s render so its selftest asserts a *malformed* message is
*valid* → the protocol node test fails → forge does not converge. (Plus the inherited design drift.)

## Pattern 2 — `patterns/eval.mjs` (a harness that scores a target system)

| id | signer | forged artifact | executable selftest (node test) asserts |
|---|---|---|---|
| `dataset` | codex | `eval/dataset.mjs` — fixed cases `[{id,input,expected}]` | ≥4 cases, unique ids, each has input+expected |
| `target` | claude | `eval/target.mjs` — stub system-under-test `predict(input)` | total over the dataset inputs; deterministic across two calls |
| `runner` | codex | `eval/run-target.mjs` — runs target over the dataset | exactly one prediction per case, aligned by id |
| `metrics` | agy | `eval/metrics.mjs` — `{accuracy, precision, recall}` from predictions vs expected | a hand-computed fixture → **exact** known metric values |
| `scorecard` | agy | `eval/scorecard.mjs` — writes `scorecard.json`, re-reads, asserts stored ≈ recomputed (epsilon) | stored==recomputed passes; **tamper a stored metric → fail-closed** (resolves issue #30 item 2) |
| `threshold` | grok | `eval/threshold.mjs` — gate metrics vs thresholds | metrics above threshold → pass; below → blocked |
| `regression` | grok | `eval/regression.mjs` — compare to a baseline scorecard within tolerance | a worse-than-baseline run → flagged; equal/better → clean |
| `design` | claude | `docs/DESIGN.md` + `docs/design/verify.mjs` | generic Phase B design check |

**DAG:** root `dataset`; `target ← {dataset}`; `runner ← {dataset, target}`;
`metrics ← {runner}`; `scorecard ← {metrics}`; `threshold ← {scorecard}`;
`regression ← {scorecard}`; `design ← {all 7}`.

**Fail-closed:** perturb `scorecard` so a tampered stored metric is asserted equal to the
recomputed value → scorecard node test fails → forge does not converge. (Plus design drift.)

**Note (issue #30 item 2):** the `scorecard` workstream's stored≈recomputed assertion is the
first-class form of the cross-check that RAG's eval lacked. This pattern demonstrates it; the
separate RAG fix in #30 remains its own follow-up (out of scope here).

## Pattern 3 — `patterns/serving.mjs` (a serving layer with input/output guardrails)

| id | signer | forged artifact | executable selftest (node test) asserts |
|---|---|---|---|
| `schema` | codex | `serving/schema.mjs` — request/response schema + `validate` | a conforming request passes; a non-conforming one fails |
| `handler` | claude | `serving/handler.mjs` — pure `handle(request) → response` | a valid request → the expected response (deterministic) |
| `input-guardrail` | grok | `serving/guard-in.mjs` — reject oversized / denylisted / malformed input | a blocked input → rejected; a clean input → passes |
| `output-guardrail` | grok | `serving/guard-out.mjs` — redact/deny output tokens | output containing a blocked token → redacted/blocked; clean output → unchanged |
| `ratelimit` | agy | `serving/ratelimit.mjs` — deterministic token-bucket `allow(key, now)` (`now` injected, not `Date.now`) | first N within a window allowed, N+1 blocked, refill after the window |
| `authz` | agy | `serving/authz.mjs` — `authorize(token, action)` over a **keyless fake** token→capabilities map (no real secrets) | an authorized `(token,action)` passes; an unauthorized one is blocked |
| `audit` | codex | `serving/audit.mjs` — append-only structured request log to an injected **tmpdir** path | handling a request appends exactly one structured line with the required fields (fixture-isolated) |
| `design` | claude | `docs/DESIGN.md` + `docs/design/verify.mjs` | generic Phase B design check |

**DAG:** root `schema`; `handler ← {schema}`; `input-guardrail ← {schema}`;
`output-guardrail ← {handler}`; `ratelimit ← {schema}`; `authz ← {schema}`;
`audit ← {handler, authz}`; `design ← {all 7}`.

**Fail-closed:** perturb `input-guardrail` so a denylisted input is accepted → its node test
fails → forge does not converge. (Plus design drift.)

**Note on `authz`:** the forged `authz.mjs` is a deterministic capability-check **stub** over a
hard-coded fake token→caps map — a code artifact, not real authentication. No real secrets,
keys, or credentials anywhere; consistent with the keyless discipline.

## Trust preserved

- Each workstream is dispatched like any other (Rule 1: the render sees only its node's
  spec); the gate independently re-runs each node test (Rule 3). A forged artifact that
  doesn't genuinely work cannot settle.
- Genuine **executable** checks (not shape-only) across all 24 workstreams — the same rigor
  as RAG's and the TELOS pattern's.
- Each pattern's `design` workstream binds its design's model claims to the **signed
  ledger** (Phase B), so even these forged systems' designs can't misattribute authorship.
- No spine / `gate.mjs` / `sign.mjs` / `merkle-dag` / `saas-forge` / RAG-pattern /
  TELOS-pattern / Phase-A-B-module change — only three new `patterns/*.mjs` + their tests +
  CI/docs.

## Testing (keyless, deterministic, zero-dep)

- **Per-pattern e2e:** forge the pattern → converges (8 workstreams `meets`, `gate_status:
  "pass"`, `records.length === 8`); every forged artifact genuinely executes against its
  fixture.
- **Per-pattern fail-closed:** the sub-case named per pattern above + the inherited design
  drift → assert the forge does **not** converge.
- Per-pattern selftest script (`scripts/test-{multiagent,eval,serving}.mjs`) exercising each
  of the 8 component selftests directly, and an e2e script
  (`scripts/test-{multiagent,eval,serving}-forge.mjs`) for converge + fail-closed.
- Added incrementally to the existing `ai-forge` `package.json` `check`/`test` and the CI
  matrix entry (ubuntu, Node 18 & 20).

## Exit criteria

- `ai-forge` `npm test` exit 0, including all three patterns' e2e (each 8 workstreams
  converge) + each pattern's fail-closed sub-cases + inherited design checks.
- `docs/runs/ai-forge-{multiagent,eval,serving}/` evidence: a converged run per pattern
  (8 `meets`, gate pass), sanitized (no absolute paths / secrets / timestamps).
- All existing packages green; spine, saas-forge, RAG and TELOS patterns untouched;
  roadmap Phase C.2 → done.

## Decisions log (brainstorming, 2026-06-29)

- **Scope:** three patterns in one combined cycle (chosen over one-at-a-time and over the
  workstream-library generalization). Size risk flagged and accepted.
- **Depth:** full — 8 workstreams each (7 build + generic design), ~24 total.
- **Structure:** one spec + one plan; the plan groups tasks per pattern so each pattern is
  an independently testable slice (not formally decomposed into separate phases).
- **Framing:** standalone forged artifacts (RAG model), keyless + deterministic, on the
  unchanged forge — not spine-wrapping (that was TELOS's special case).
- **Synergy:** the eval-harness `scorecard` workstream makes the stored≈recomputed
  cross-check (deferred RAG issue #30 item 2) a first-class, gate-verified discipline.

## Non-goals (Phase C.2 — YAGNI)

- **Not** the composable-workstream-library generalization or the `forge-kit` helper hoist
  (#30 item 1) — deliberately deferred again; these three patterns are built the proven
  per-pattern way. (More data points first.)
- **No** live model calls / API keys; no `live.mjs` extension for the new patterns in this
  cycle (the keyless deterministic path is the committed surface).
- **No** spine / saas-forge / RAG-pattern / TELOS-pattern / Phase-A-B-module changes.
- The separate RAG-scorecard fix (#30 item 2 applied to `patterns/rag.mjs`) and the Phase B
  minors (#37) remain their own follow-ups.
