# Argo completion pass — behavior → tests → docs

The Argo pass finished the proposal-lifecycle subsystem: it composed the shipped primitives into the
autonomous entry point (`buildProject`), implemented the missing functions, and reconciled the
documentation surface against the code that actually ships. Ordering was implementation-reality →
verification → docs-derived-from-reality → full-suite evidence.

## Changed behavior → its tests → its docs

| Behavior (what now works) | Code | Tests | Docs |
|---|---|---|---|
| `buildProject` composes the full lifecycle (recorder → Daedalus → outer loop → gate → execution) when `proposal_lifecycle:true` | `proposal-orchestrator.mjs` (`runProposalLifecycle`); `build-orchestrator.mjs` delegation | `test-proposal-orchestrator.mjs` (a) clean→ready, (b)+control, (d) stalemate, (e) cold-review, (g) durable key, (i) protected-path, (eph) ephemeral-over-ledger refusal | `STATUS.md` 2026-07-15 addendum; `CLAUDE.md`; `examples/proposal-lifecycle/` |
| Concern→obligation via a DEDICATED controller-minted verification node keyed by `concern_ref` | `mintVerificationNodes` (orchestrator); `deriveVerifyNodeId`/`deriveObligationId` (obligation.mjs) | `test-obligation.mjs` Case 12; `test-proposal-orchestrator.mjs` (b) | `contracts/Proposal Lifecycle.md` (repo-owned check manifest); review-packet header |
| Gate binds each obligation's EXECUTABLE to its concern's check-contract (rejects a no-op swap) | `deriveExecutableRef` (obligation.mjs); `reconcileObligations` (proposal-gate.mjs) | `test-proposal-gate.mjs` Case 7 (match), Case 8 (no-op swap fails), Case 9 (contract mismatch); `test-obligation.mjs` Case 12 | `docs/proposal-lifecycle-implementation.md` §2 (the executable-binding reconciliation) |
| A `required_verification` on a non-blocking concern is still enforced (forced revise, never silently dropped) | `proposal-orchestrator.mjs` (pending-verification finding) | `test-proposal-orchestrator.mjs` Case (v) | `docs/proposal-lifecycle-implementation.md` (failure modes) |
| Closed verification check registry with per-kind param VALUE guards + decidable genuineness | `check-registry.mjs` | `test-check-registry.mjs` (closed set, value guards, determinism, no-op not vetted) | `CLAUDE.md`; `examples/proposal-lifecycle/README.md` |
| `processReviewPackets` is the SOLE concern minter; council no longer pre-mints in lifecycle mode | `concerns.mjs`; `council.mjs` (suppressed `normalizeLegacyHardStops`) | `test-concerns.mjs` Case 10 (cardinality, holds, untrusted fields, unregistered→human) | `CLAUDE.md` |
| `sweepExpiredHolds` (idempotent) persists expired-unresolved dispositions from the ledger | `concerns.mjs` | `test-concerns.mjs` Case 11 (idempotency) | `CLAUDE.md` |
| Concern identity is invariant to a model-supplied `discharge_node_id` (dropped from `requiredVerificationRef` + schema) | `concerns.mjs`; `schemas.mjs` | `test-concerns.mjs` Case 1 (identity red-team) | — |
| `n/a` satisfies authorization ONLY for the `packet_signatures` allowlist | `proposal-ledger.mjs` (`NA_ALLOWED`, `checkSatisfied`) | `test-proposal-ledger.mjs` Cases 10–11 (unchanged, still green) | — |
| Mandatory execution-time lifecycle-state re-verification (a post-decision hold blocks execution); fail-closed if `lifecycleVerify` absent | `orchestrate.mjs` (`checkLifecycleAuthorization`, `runBuild`) | `test-orchestrate.mjs` Case 16 (MISSING_LIFECYCLE_VERIFY, LIFECYCLE_STATE_DRIFT); `test-proposal-lifecycle.mjs` Cases 1/2/5 (inject real verify) | `CLAUDE.md` |
| Cold review is preventive under keyless (`forceSignedDisjointness`); every review event must carry a recomputing manifest binding | `proposal-gate.mjs` (`checkColdReview`) | `test-proposal-orchestrator.mjs` (e) | — |
| Live review/workshop adapters; agy checkpoint derived from the recomputed plan; objection identity always recomputed | `teamPrompts.mjs` (`reviewPromptFor`, `daedalusPromptFor`); `council.mjs` (`agyLifecycleCheckpointArgs`); `daedalus.mjs` | `test-team-prompts.mjs`, `test-council-orchestrator.mjs`, `test-daedalus.mjs` (all green) | — |
| Doc surface reconciled; historical docs archived | — | link-integrity grep (zero dangling refs to archived paths in live docs) | `README.md`, `CLAUDE.md`, `contracts/*`, `STATUS.md`, `merkle-dag/README.md`, `docs/history/` |

## Verification (all green)

- **Package suites:** `merkle-dag`, `build-gate` (chains `breakout`), `connectors/ai-peer-mcp`, `breakout`.
- **Downstream suites:** `saas-forge`, `ai-forge`, `forge`.
- **New source files** (`check-registry.mjs`, `proposal-orchestrator.mjs`) and their tests are in BOTH
  the build-gate `check` and `test` chains.
- **Documented run commands execute clean:** `run-lifecycle-e2e.mjs` (flagship, buildProject-driven)
  and `run-proposal-lifecycle.mjs` (primitive-composition demo).
- **Flagship acceptance:** `discharged` → decision `authorized`, `merge_status "ready"`; `control`
  (verify check fails) → still `authorized` but `merge_status` NOT `"ready"` (`UNDISCHARGED_OBLIGATION`)
  — the verification obligation is load-bearing at Rule 3.

## Out of scope (documented as limits, not silently omitted)

- **Single trust principal:** the proposal-controller and build-controller are one principal; no
  multi-party separation.
- **Execution re-verify scope:** covers only ledger-reconstructable lifecycle state; base-gate keys
  (protected_paths / approvals / edits / risk_policy / packet-HMAC) are enforced at decision time.
- **Protected paths** are enforced at decision time against caller-supplied `dossier.write_targets`,
  not derived from plan `node.files`.
- **Verification-registry residual:** the concern→obligation conversion is only as strong as the
  registry's weakest kind; param value guards bound but do not eliminate a determined self-raiser's
  weak-but-passing check.
- Live-key end-to-end runs (evidence stays keyless), human-adjudication UX, in-band fork recovery,
  controller-key rotation, and cross-process durable resume of the autonomous entry point.
