# TELOS

[![CI](https://github.com/dsmcewan/TELOS/actions/workflows/ci.yml/badge.svg)](https://github.com/dsmcewan/TELOS/actions/workflows/ci.yml)

A multi-model build-gate, and an autonomous builder on top of it. Independent AI
model **seats** (claude / grok / codex / agy / gemini) produce signed,
provenance-bound approval packets; a deterministic **gate** certifies
merge-readiness from disk + signatures + provenance — never from a model's
self-report. The same trust spine then drives software from idea to merged,
verified artifacts.

## Components

**The substrate (engine):**

- **`build-gate/`** — the gate (`gate.mjs`), per-model HMAC signing (`sign.mjs`), the
  dynamic-workflow council orchestrator (`council.mjs`: per-job seat sizing +
  CPU-bounded fan-out + `liveSeatCaller`), strict-mode JSON Schemas for the three
  contracts (`schemas.mjs`), and per-model strength profiles (`model-profiles.mjs`).
- **`breakout/`** — self-challenge with verdict-on-facts (`verifier.mjs`, `live.mjs`)
  and a minimal MCP stdio client (`mcp_client.mjs`).
- **`connectors/ai-peer-mcp/`** — MCP server exposing the model backends
  (`claude_ask` / `grok_ask` / `codex_ask` / `gemini_ask` / `agy_checkpoint`) with
  **real per-seat provenance** and **provider-native structured output** (each
  contract schema is translated to that provider's native form — OpenAI/xAI
  `json_schema` strict, Anthropic forced tool call, Gemini `responseSchema`).
- **`merkle-dag/`** — content-addressed planning + verified delegation + a pure
  `done()` evaluator (`ledger-gate.mjs`): immutable `plan.json`, append-only signed
  `ledger.jsonl`, Ed25519 settlement, forward-invalidation by hash.

**The autonomous layers (composed on the substrate, no new trust surface):**

- **`build-gate/` agentic-teams** — `teams.mjs` (the team roster as data),
  `decompose.mjs` (idea → validated task DAG), `build-orchestrator.mjs`
  (`buildProject` — the full lifecycle), `teamPrompts.mjs` (live wiring over
  `ai-peer-mcp`), `situation.mjs` (project sense), `test-runner.mjs` (runtime
  self-correction).
- **`saas-forge/`** — a 7-team SaaS generator that drives a project to
  market-ready, each team put through an adversarial breakout-on-facts.

## Autonomous builder (agentic-teams)

The council only *approves*; the merkle-dag substrate only *executes* anonymous
worker nodes. The agentic-teams layer composes them so **a build/verify team IS a
`runBuild` worker** — it sees only its node's spec (Rule 1) and its output is
independently re-derived by the gate (Rule 3), so a team's self-report can never
satisfy the gate.

```
idea + telos
  → [planning team] decompose() → tasks[]
  → compileAndHashPlan() → content-addressed plan; writePlan()
  → COUNCIL APPROVAL GATE: runCouncil → validateRecords   (must pass before any execution)
  → runBuild(): each node dispatched to its owning team (team = worker)
  → Rule-3 verify: re-derive the artifact tree-hash + run the node's own test
  → settle: the controller (sole writer) signs the Ed25519 ledger
  → ledger-gate.verify() done() → merge_status: "ready"
```

- **Team placement by strength** (`teams.mjs` + `model-profiles.mjs`): each lead is
  matched to its model's strength (a test asserts every lead's role is in that
  model's `preferred_roles`) — planning/architecture/frontend → claude,
  backend/evals → codex, security/business/breakout → grok, ops → agy,
  **integrity → gemini**. `planTeams(dossier)` sizes the roster from the job.
- **Situational awareness** (`situation.mjs`, pure read-only): greenfield vs
  brownfield, write-target collisions, and the project's real test command —
  reported before building, never used to self-certify.
- **Runtime adaptation** (`test-runner.mjs`): after a team writes its node's files,
  its own node test runs; on failure the team is re-called with the failure detail
  to self-correct (bounded), then the substrate's halt → mutate → re-dispatch gives
  a second, outer adaptation level.

## SaaS Forge (`saas-forge/`)

Point the forge at a project and it drives it to **market-ready** the TELOS way:
research the capabilities a SaaS needs → generate each team's artifacts via the
merkle-dag `dispatch` → put **every team through an adversarial breakout decided on
its built artifact** (facts, not trivia) → settle a signed ledger → market gate,
looping until certified.

| Team | Artifact | Breakout asserts (on disk) |
| --- | --- | --- |
| product-architecture | `docs/ARCHITECTURE.md` | references the researched stack |
| business-positioning | `docs/POSITIONING.md` | ICP + differentiation |
| backend-schema | `db/schema.sql` | tables + RLS `create policy` |
| security-trust | `web/site/csp.txt` | `Content-Security-Policy` / `default-src` |
| accuracy-evals | `evals/scorecard.json` + `run.mjs` | precision clears threshold (the test runs the eval) |
| scale-operations | `docs/OPERATIONS.md` | S3 + CloudFront + SLOs |
| frontend-brand-experience | `web/*` + screenshots | brand token, first-screen proof band |

Market packets are **generated from the breakout records**, never hand-asserted,
and the gate independently re-verifies every team's record on disk.

## Trust model (fail-closed)

- Each required seat's packet is **HMAC-signed** and carries **real provenance**:
  the server-issued response id for remote models (claude/grok/codex/gemini), or a
  content-addressed **local attestation** (`agy-<sha256>`) for the deterministic
  agy seat. No structured provenance ⇒ `response_id: null` ⇒ the gate blocks. No
  seat borrows or fabricates another's id. (grok and gemini ride as **advisory** —
  a missing key for them never blocks the gate.)
- **Structured output is reliability, not trust.** The schema carries only
  *judgment* (the approval schema omits identity); the gate re-validates packet
  shape, injects identity from the dossier, and binds provenance to the real API
  response — so a model can't self-assert its identity or approval.
- Under `trust_mode: "signed"` the gate enforces **both** the signature and the
  provenance as blockers. The gate always re-reads disk ground truth.
- **Secrets live outside the repo** (env / OS registry): `ANTHROPIC_API_KEY`,
  `XAI_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, and the `TELOS_SECRET_*` HMAC
  secrets. Runtime `.telos/` artifacts (plan/ledger) are created ephemerally in the
  build tree.

## Test

Node ≥ 18, zero runtime dependencies. CI runs every package on ubuntu (Node 18 & 20).

```bash
cd build-gate            && npm test   # gate, sign, trust, council, teams, decompose,
                                       #   build-orchestrator, schemas, situation, + breakout
cd breakout              && npm test
cd connectors/ai-peer-mcp && npm test  # provenance, structured requests, smoke
cd merkle-dag            && npm test   # 8 suites + end-to-end harness
cd saas-forge            && npm test   # 7 teams generate + breakout-survive + gate pass
```

## Docs & evidence

- `docs/STATUS.md` — current status.
- `docs/specs/` — design specs (agentic-teams, provider-native outputs, situational
  awareness, the trust upgrade).
- `docs/runs/` — runnable evidence: `live-council/` (distinct per-seat provenance;
  fail-closed without a key; signed-mode pass), `agentic-teams/` +
  `agentic-teams-live/` + `agentic-teams-situational/` + `agentic-teams-market/`
  (idea → `merge_status: "ready"` over the real gate + Ed25519 ledger + merkle-dag).
- `contracts/` — the human-readable protocols the gate enforces (build gate,
  prototype workflow, hierarchical workflow, agentic-teams autonomous builder).

## Provenance / layout note

Extracted from a larger multi-model vault, where the live deployment runs under a
`me/codex/` tree wired into an MCP client. `validateProtectedPaths` derives its
root from the deployment layout; in this standalone repo the engine is primarily a
reference + evidence artifact. Authored by `claude-code`.
