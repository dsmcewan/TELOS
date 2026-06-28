---
title: "TELOS Upgrade — STATUS (final)"
author: claude-code
last-edited-by: codex
last-edited-at: 2026-06-27
type: status
tags:
  - topic/telos-upgrade
  - workflow/build-gate
---

# TELOS Upgrade — STATUS (final)

**Goal:** make TELOS *load-bearing* — trustworthy gate approvals (signed + provenance-bound), a dynamic-workflow council, a `meets` sufficiency floor, real bug fixes, and the proof that TELOS can gate its own upgrade.

**Built via:** brainstorm → spec → plan → subagent-driven execution (fresh implementer + independent reviewer per task) → final whole-branch review (READY WITH FIXES → fix applied). All engine work staged in `engine/working/` (mirrors `me/codex/`), delivered as `ENGINE.patch` — `me/codex/` never hand-edited.

## Outcome: TELOS gated its own upgrade — gate_status PASS

The recursion run (`runs/upgrade-001/`) passes with **0 blockers**: signatures verified, provenance bound to a real model response, `meets` re-verified against real on-disk artifacts.

## Gaps closed (from the 2026-06-27 maturity assessment, 7/10 "promising-scaffold")

| # | Gap | Status |
|---|---|---|
| 1 | Identity unauthenticated; provenance only warns | **CLOSED** — per-model HMAC signing + provenance-as-blocker under `trust_mode:"signed"` |
| 4 | `meets` sufficiency weak | **CLOSED** — no empty stubs, ≥1 *non-empty-needle* `file_contains`, zero-byte targets rejected (incl. the empty-needle bypass the final review caught); checks re-run vs real disk |
| 5 | Two real test bugs | **CLOSED** — #5a `test-gate.mjs` runs from any ancestor CWD; #5b `npm test` runs `stress-tests.mjs` + breakout suite |
| 2 | Live MCP path never run end-to-end | **CLOSED** — real `council_review` capture: claude `claude-sonnet-4-6` (`msg_01EkTnsnjyT2MBa2xLudt1pA`) + grok `grok-4.3`. Connector is fully functional |
| 3 | Never gated a real build | **DONE — PASS** — TELOS gated its own upgrade: signatures valid, `meets` re-verified, provenance bound to a real model response |

## Added per user request (2026-06-27)

**Dynamic agent-sizing in the council** (`council.mjs`): `planSeats(dossier)` derives the roster *from the job* (required approval seats + grok advisory + one `market-lens` seat per market workstream when `market_bound`); `runCouncil` runs seats through a CPU-bounded pool (`min(requested, cores−2)`). This is how TELOS now *determines how many agents per job* — previously a fixed roster.

## Test status (all green)

- `engine/working/build-gate` `npm test`: **exit 0** (gate, sign, trust, council, stress×2, + breakout suite)
- `engine/working/breakout` `npm test`: **exit 0**
- `scripts/test-gate.mjs` from the V4 base dir: **exit 0** (bug #5a)
- Legacy unaffected: `examples/self` dogfood + `examples/market-pass` still pass with **no new blockers or warnings** (report JSON gains additive fields only — `provenance[].response_id`, `headline_checks.{signing,provenance}_enforced` — not literally byte-identical JSON)
- Recursion run: `gate_status: PASS`, **0 blockers**
- Empty-needle/zero-byte `file_contains` bypass: **blocked** (regression-tested in `test-verifier.mjs` + `test-trust.mjs`)

## Per-seat provenance backends (2026-06-27, follow-up) — codex/agy residual CLOSED

The original residual was that `ai-peer-mcp` had no per-model backend for codex/agy,
so the recursion-run packets bound agy/codex to claude's council `response_id` with a
`bound_via` note. Those backends are now wired (delivered in the same `ENGINE.patch`):
- **codex** → a real OpenAI Chat Completions backend (`codex_ask` / `askCodex`;
  `OPENAI_API_KEY`). Its packet binds to the API's own `response_id`; fail-closed
  without the key (the gate honest-blocks, never borrows an id).
- **agy** → a keyless **local-deterministic attestation** (`agyAttestation`:
  `response_id = "agy-" + sha256(checkpoint)`), reproducible and content-addressed —
  agy's honest provenance, since it is a local tool with no server-issued id.
- **council wiring** (`council.mjs` `liveSeatCaller`): each seat now carries its OWN
  provenance — codex→`codex_ask`, agy→`agy_checkpoint` — with precedence
  `structured → prose-scan → null`. No seat borrows another's id.

The historical recursion-run evidence in `runs/upgrade-001/` is left intact (it
records the PASS as it happened, with the honest `bound_via` note); a fresh run via
these backends now yields fully-distinct per-seat provenance (codex requires
`OPENAI_API_KEY` at run time; agy is keyless).

**Live verification (2026-06-27, `runs/live-council/`).** A real council fan-out
(`run-council.mjs`) was run against the live `ai-peer-mcp` server:
- Without `OPENAI_API_KEY`: codex **fail-closed** (`ok:false`, no packet) → gate
  `blocked` ("Missing required codex approval packet"); codex provenance
  `response_id:null`. No fabricated/borrowed id — the trust contract, demonstrated live.
- With `OPENAI_API_KEY` set: every required seat carried its OWN real, distinct
  provenance and the gate **passed** (0 blockers):
  - claude `claude-sonnet-4-6` → `msg_01AxWB82nFaUZXYevod8EHt5`
  - codex `gpt-4o-2024-08-06` → `chatcmpl-DvWjsgq4NStN8sXwnqADpF2TCg3eI` (real OpenAI id)
  - agy local attestation → `agy-adec1f5af09f57316c3c166e2ff1b13f5e463f37` (identical
    across both runs — live proof of content-addressed determinism)
  - grok `grok-4.3` (advisory) → `e634a86d-4e4c-92af-8f7a-8de13ce850a1`
  Recursively, the council (using the new backends) **approved the very change that
  wired them**.
- **Signed-mode run** (same harness, `trust_mode:"signed"` + per-run ephemeral
  `TELOS_SECRET_{CLAUDE,AGY,CODEX}`): all three required seats `signed:true`,
  gate `pass` with `signing_enforced` **and** `provenance_enforced` both true and
  zero blockers — the full trust stack (HMAC signature + authenticated provenance)
  exercised end-to-end with codex live (`chatcmpl-DvWrKsQgNnimMH5FFsSFjuwBQ5rXl`).
  Ephemeral secrets prove sign+verify within the run; for re-verifiable evidence,
  set persistent `TELOS_SECRET_*` outside the vault and re-run.

## Honest residual (documented, not hidden)

- A single owner holding all `TELOS_SECRET_*` can still forge — signing is an integrity floor, not non-repudiation.
- The `meets` re-verify root is dossier-chosen; sufficiency raises the bar without fully closing the circularity.
- codex per-seat provenance is only as live as the run: with no `OPENAI_API_KEY`, codex fail-closes (honest block) rather than producing a packet. agy's attestation authenticates the *checkpoint content*, not a remote identity (it is a local deterministic tool by design).

## Deliverables

| Artifact | Location | Live? |
|---|---|---|
| Spec / Plan | `specs/` , `plans/` | ✅ |
| Engine changes (16 files) | Applied into `build-gate`, `breakout`, and `connectors/ai-peer-mcp`; verification green in Codex working tree | ✅ |
| Apply instructions | `ENGINE-APPLY.md` | ✅ |
| Contract upgrade | `shared/Coordination/{Multi-Model Agentic Build Gate, Claude-Led Multi-Model Prototype Workflow}.md` | ✅ |
| Recursion run (PASS) | `runs/upgrade-001/` (dossier, signed packets, market packet, gate-report, ledger) | ✅ |
| Live-capture evidence | `runs/live-capture/` (real provenance) | ✅ |
| Progress ledger + findings triage | `.sdd-progress.md` | ✅ |

## Codex merge status (2026-06-28)

Codex applied Claude's `ENGINE.patch` into the TELOS working tree and confirmed the Merkle-DAG package is present.

Verification run from the Codex tree:
- `build-gate`: `npm test` exit 0
- `breakout`: `npm test` exit 0
- `connectors/ai-peer-mcp`: `npm test` exit 0
- `merkle-dag`: `npm test` exit 0

## Remaining actions (handoffs, not blockers)

1. ~~**Codex** applies `ENGINE.patch` to make signed-mode live in `me/codex/` (`patch -p1` dry-run is clean; `ENGINE-APPLY.md` has steps). Verify with `npm test` in both packages after merge.~~ **DONE** (2026-06-28) — applied and verified in `build-gate`, `breakout`, `connectors/ai-peer-mcp`, and `merkle-dag`.
2. ~~**Optional, for fully-distinct provenance:** wire a codex (OpenAI) and agy backend so agy/codex packets carry their own model `response_id`.~~ **DONE** (2026-06-27) — codex (OpenAI) + agy (local attestation) backends wired into `ai-peer-mcp` and `council.mjs`; bundled in the same `ENGINE.patch`. To exercise codex's live `response_id`, set `OPENAI_API_KEY` before a run; agy is keyless.

## Agentic Teams — Autonomous Builder (2026-06-28)

TELOS now composes its two halves — the approval council (`build-gate`) and the
execution substrate (`merkle-dag`) — into an **autonomous builder** driven by
**agentic teams**. A build/verify team is a `runBuild` worker behind `dispatch`
(Rule 1: spec-only) whose output is re-derived by `defaultVerifyNode` (Rule 3),
so the teams layer adds **no new trust surface**.

**Added (`build-gate/`, zero new deps):**
- `teams.mjs` — `TEAMS` roster (data); `planTeams(dossier)` (dossier-sized, mirrors
  `planSeats`); `teamForNode` (explicit-`workstream` routing); `authorizedSignersFor`.
- `decompose.mjs` — the Planning team proposes a validated `tasks[]` (data only,
  fail-closed).
- `build-orchestrator.mjs` — `buildProject(...)`: decompose → **council approval
  gate (must pass first)** → `compileAndHashPlan` + `writePlan` → `runBuild` with
  team dispatch + the unchanged Rule-3 verify → signed Ed25519 ledger → `done()`.
- `teamPrompts.mjs` — opt-in live wiring over `ai-peer-mcp` (`approvalPromptFor`,
  `makeLiveCallTeam`, pure prompt/parse helpers).

**Trust preserved:** routing is by node id (Rule 1 strips `workstream`); a failing
node never settles; the controller is the sole ledger writer and a team's signer
key_id must be in `plan.authorized_signers`; teams may only write their node's
declared files under `baseDir`; a fabricated decomposition is re-hashed and must
still pass the gate + Rule-3 verify. Market-bound builds still demand
market-readiness packets (passed through to the gate).

**Tests (all green):** `test-teams.mjs`, `test-decompose.mjs`,
`test-build-orchestrator.mjs` (keyless end-to-end to `merge_status:"ready"`;
approval `revise` blocks before execution; Rule-3 verify load-bearing),
`test-team-prompts.mjs`. `build-gate npm test` exit 0 (now incl. these +
breakout); `merkle-dag npm test` exit 0 (substrate unchanged).

**Evidence:** `runs/agentic-teams/run-teams.mjs` → `run-summary.json` — keyless,
reproducible, real gate + real Ed25519 ledger + real merkle-dag, reaching
`merge_status: "ready"`.

**Docs:** `contracts/Agentic Teams Autonomous Builder.md` (protocol),
`docs/specs/2026-06-28-agentic-teams-design.md` (design).

## Live MCP path wired (2026-06-28)

The agentic-teams autonomous builder now runs over the **live** `ai-peer-mcp`
backends, not just keyless mocks. `build-gate/teamPrompts.mjs` gained the full
live wiring — `makeLiveCallSeat` (approval council via `approvalPromptFor` +
`parseApprovalPacket`, and live decomposition via `decomposePrompt` +
`parseDecomposeTasks`) and `makeLiveCallTeam` (each team's lead emits the node's
files). `parseApprovalPacket` injects identity fields (build_id/use_case/…) from
the dossier and keeps only the model's judgment, so a model can neither fail the
gate's identity checks nor fabricate an approve.

Runnable entry point: `docs/runs/agentic-teams-live/run-teams-live.mjs` (with a
README). With `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `OPENAI_API_KEY` it runs real
approvals + real team builds to `merge_status: "ready"`. Without keys it
**fail-closes honestly**, proven by the committed `run-summary.json`: the live
server spawned, `agy` (keyless, local) produced a real packet, and `claude` /
`codex` fail-closed for missing keys, so the gate honest-blocked at approval
("Missing required claude/codex approval packet") — no plan, no ledger.

New pure helpers are covered (no network) by `test-team-prompts.mjs`; full
`build-gate npm test` exit 0.
