---
title: "Proposal Lifecycle — implementation reference"
type: reference
tags:
  - topic/proposal-lifecycle
  - workflow/build-gate
---

# Proposal Lifecycle — implementation reference

This document explains how the **proposal-lifecycle** subsystem is implemented and composed — the
audited-judgment governance layer that decides whether an implementation plan is mature enough to
authorize *before* anything irreversible runs. It is the maintainer's map of the shipping code.

- The **protocol** it enforces is `contracts/Proposal Lifecycle.md` (frozen).
- The **design process** that produced it is `docs/design-by-adversarial-review.md` (narrative).
- The **runnable evidence** is `docs/runs/proposal-lifecycle/`.

The subsystem is **opt-in**: a build enables it with `dossier.proposal_lifecycle === true`. With the
flag absent, `buildProject` runs the legacy advisory path byte-identically — none of the code below
executes.

## The governing rule

Every design choice below is an instance of one rule:

> **No mutable label keys an enforcement decision. Every enforcement identity is a controller-derived
> content address. The gate reconstructs all state from the ledger, never trusting caller-supplied
> state. Fail closed.**

"Controller" means the trusted wiring that holds the proposal-controller signing key — never a model.
A model may *recommend* (raise a concern, propose an objection, request a verification); only the
controller *writes* the ledger, and only the deterministic gate *decides*.

## The composed flow

`build-gate/build-orchestrator.mjs` `buildProject` decomposes the idea, senses the project, and — when
`dossier.proposal_lifecycle === true` — delegates to `build-gate/proposal-orchestrator.mjs`
`runProposalLifecycle`. That function is the only place the whole lifecycle runs end to end:

```text
resolve controller key (env TELOS_PROPOSAL_CONTROLLER_SK, else ephemeral) + pin its pubkey
  into authorized_signers  →  makeProposalRecorder  →  recordDraft (derives proposal_id)
  →  OUTER REVISION LOOP (bounded by max_revisions):
       runDaedalusWorkshop (claude/codex negotiate the candidate)           [daedalus.mjs]
       → reconstruct verification requests FROM the ledger                   [8b: durable]
       → mintVerificationNodes (a dedicated verify node + obligation each)   [decision 7]
       → compileAndHashPlan (tasks + minted nodes + obligations + lifecycle) [planner.mjs]
       → writePlan → recordCandidate
       → deriveRevisionDispositions AFTER the candidate is compiled          [decision 5]
       → buildReviewManifest per council seat (binds review to the plan hash)
       → runCouncil(review)                                                  [council.mjs]
       → processReviewPackets  — the SOLE controller-side concern minter     [concerns.mjs]
       → sweepExpiredHolds (idempotent)                                      [concerns.mjs]
       → validateRecords (base gate + validateProposalLifecycle)             [gate.mjs / proposal-gate.mjs]
       → recordDecision (deriveOutcome over the FULL report.blockers)        [proposal-recorder.mjs]
       → branch:
            authorized             → runBuild(requireAuthorizedDecision, lifecycleVerify)
            revise                 → loop again (obligations carried via the ledger)
            blocked / human-review → return (stalemate, budget, unregistered kind, compile error)
```

On `authorized`, execution runs through the unchanged merkle-dag substrate: teams build (Rule 1),
`defaultVerifyNode` re-derives facts (Rule 3), the ledger-gate `done()` settles the merge — and the
verification obligation must discharge before merge is `ready`.

## Module map

| Module | Role |
|---|---|
| `build-gate/proposal-orchestrator.mjs` | `runProposalLifecycle` — the composition above. Also `mintVerificationNodes`, `reconstructVerificationRequests`, `serializeTasks`/`parseTasks`. |
| `build-gate/proposal-recorder.mjs` | Sole writer of `.telos/proposal.jsonl` via atomic single-lock append. `recordDecision` writes the closed `POLICY_CONTRACT_V1` certificate itself. `buildReviewManifest`, `buildRevisionBrief`. |
| `build-gate/daedalus.mjs` | The bounded claude/codex planning workshop + its total state machine (converged / stalemate / continue). Objection identity is controller-recomputed. |
| `build-gate/concerns.mjs` | Typed concerns/holds/controller-only dispositions; `processReviewPackets` (sole minter), `sweepExpiredHolds`, `reconstructProposalState`, the concern-gate reducer, `deriveRevisionDispositions`. |
| `build-gate/check-registry.mjs` | The CLOSED verification check-contract registry: `kind` → a vetted `node -e` check executable, with per-kind param VALUE guards. `resolve`, `checkContractRef`, `isVettedResolvedTest`. |
| `build-gate/proposal-gate.mjs` | `validateProposalLifecycle` — reconstructs ALL proposal state from the ledger. `checkColdReview`, `reconcileObligations` (the decision-7 executable binding + the 8b live-obligation check). |
| `build-gate/risk-policy.mjs` / `standing.mjs` / `evidence.mjs` | Deterministic hold TTLs, pure standing calibration, the closed-whitelist sandboxed evidence verifier. |
| `build-gate/council.mjs` / `teamPrompts.mjs` | The review council; `agyLifecycleCheckpointArgs`; the live `reviewPromptFor` / `daedalusPromptFor` adapters. In lifecycle mode the council does NOT pre-mint concerns. |
| `merkle-dag/obligation.mjs` | Content-addressed obligations, the done()-time discharge sweep, `deriveExecutableRef`, `deriveVerifyNodeId`/`deriveObligationId`. |
| `merkle-dag/proposal-ledger.mjs` | The signed hash-chained ledger + `POLICY_CONTRACT_V1`, `deriveOutcome`, `checkSatisfied`/`NA_ALLOWED`, layered verifiers. |
| `merkle-dag/orchestrate.mjs` | `checkLifecycleAuthorization` + `runBuild`'s `requireAuthorizedDecision` path (execution-time re-verification). |

## The load-bearing mechanisms

### 1. The dedicated verification node (concern → obligation)

When a reviewer's concern carries `required_verification: { requested, check_contract: { kind,
params_json }, required_result }`, the controller does NOT retarget an existing node. At the next
candidate's compile (`mintVerificationNodes`) it:

- resolves `check_contract.kind` through the **closed check-registry** to a concrete `test`
  (`resolve`); an unregistered kind → `human-review-required` (fail closed);
- mints a FRESH node whose `id = "verify-" + <full concern_ref hex>` (no truncation, so two concerns
  never collide), whose `test` IS the registry-resolved check, and whose dependencies are the
  concern's scope node if that resolves to a live node id, else ALL non-verification nodes so it runs
  **last** (never zero-dep, never dangling);
- builds the obligation `{ obligation_id = "obl-"+concern_ref.slice, concern_ref, required_result,
  check_contract_ref = H({kind, params_json}), discharge_node_id }`, which `attachObligations`
  registers into the node's `test.verifies` and binds into the plan hash.

Because the discharge node is brand new and keyed by `concern_ref`, there is nothing to retarget: no
cross-revision node tracking, no lineage, no model-supplied node id. `concern_ref` excludes
`discharge_node_id` entirely (`concerns.mjs requiredVerificationRef`), so a model cannot key the
concern's identity — or the minted node's id — via a node id it names.

### 2. The gate binds the executable to the contract (`reconcileObligations`)

The contract's six anchor checks bind the obligation to a node+test structurally but do NOT check that
the node's executable actually *is* the concern's `check_contract`. `reconcileObligations`
(proposal-gate.mjs) adds that, living ONLY at the gate (which reconstructs concerns from the ledger):

- it recomputes each concern's identity from its body (a verified identity, not a stored ref);
- for each obligation matched to a concern it asserts `check_contract_ref` and `required_result`
  reconcile, then **re-resolves the check-registry and asserts
  `deriveExecutableRef(discharge_node.test) === deriveExecutableRef(registry-resolved test)`** — so a
  `verify-` node whose test was swapped for a passing no-op (self-consistent at the anchor layer)
  FAILS the gate. A `resolve()` throw/empty at gate time is caught as a reconciliation failure;
- (8b) every concern cleared by a terminal `verification-required` disposition must map to a live
  obligation present in the plan — else the concern reads cleared while nothing is enforced.

`deriveExecutableRef(test) = H({cmd, args, cwd})` hashes only the execution-determining subset — it
INCLUDES `cwd` (execution-affecting) and EXCLUDES `verifies` (which `attachObligations` injects into
the node but the bare registry spec lacks). It is a NEW primitive added alongside the load-bearing
`deriveTestRef` (which stays `H(whole test)` for the anchor layer), not a replacement.

### 3. The check-registry is a closed, model-uncontrollable set

Each registered kind resolves to a self-contained `node -e <closed template> -- <params>` executable —
a registry constant, byte-identical at mint and gate, carrying no machine-specific path. `params_json`
is validated per kind: FORBIDDEN keys (no `cmd`/`script`/`cwd`/… override) plus VALUE guards strictly
stronger than an empty-needle floor (placeholder rejection, target allowlist, minimum specificity), so
a model cannot steer the check to something vacuous-but-passing. `isVettedResolvedTest` is the
decidable discriminator the gate/tests use to reject a swapped executable. This residual is honest: the
conversion is only as strong as the registry's weakest kind.

### 4. State is reconstructed, authorization is content-keyed, execution is re-verified

`validateProposalLifecycle` reads and reduces concerns/holds/dispositions from the signed ledger —
never from a caller-supplied array, so a miswired orchestrator cannot weaken the gate by omitting a
record. `recordDecision` receives the FULL `report.blockers` (base + lifecycle), so `deriveOutcome`'s
blocker guard independently prevents `authorized` whenever any blocker exists. Authorization is keyed
by the plan hash **recomputed from disk** (`checkLifecycleAuthorization`), never a caller selector; a
non-allowlisted `"n/a"` check cannot authorize (`NA_ALLOWED = {packet_signatures}`). And at execution,
`runBuild`'s `requireAuthorizedDecision` path re-runs the ledger-reconstructable lifecycle checks via
an injected `lifecycleVerify` — so a hold appended *after* the authorized decision blocks execution;
if `lifecycleVerify` is absent it fails closed with a distinct error, never conflated with a hash
mismatch.

## Configuration & trust boundaries

- `dossier.proposal_lifecycle: true` — opt in. `dossier.max_revisions` (default 3) bounds the loop.
- `TELOS_PROPOSAL_CONTROLLER_SK` (pkcs8 PEM, env only) — the durable proposal-controller signing key.
  Unset → an ephemeral per-run key; starting an ephemeral run over a pre-existing `.telos/proposal.jsonl`
  refuses with a distinct error (the prior chain was signed by a lost key).
- The proposal-controller and build-controller are ONE trust principal (no multi-party separation).
- Protected-path enforcement is at decision time by the base gate against caller-supplied
  `dossier.write_targets`; it is not re-verified at execution and is not derived from plan `node.files`.
- The execution re-verify covers only ledger-reconstructable lifecycle state.

## Failure modes (all fail closed)

| Outcome | Cause |
|---|---|
| `blocked` | a protocol/verified blocker, a cold-review violation, an un-reconciled obligation, a base-gate blocker (e.g. protected-path write). |
| `human-review-required` | workshop stalemate, revision-budget exhaustion, an unregistered check kind, an N+1 compile error, an unresolvable verification request. |
| `DECISION_NOT_AUTHORIZED` / `LIFECYCLE_STATE_DRIFT` / `MISSING_LIFECYCLE_VERIFY` | execution refused because there is no authorized decision, a hold appeared after authorization, or `lifecycleVerify` was not injected. |
| `UNDISCHARGED_OBLIGATION` | a verification node did not settle + Rule-3-verify, so merge is not `ready` even though every other node settled. |

## Out of scope (documented, not implemented)

Live-key end-to-end runs (evidence stays keyless), human-adjudication UX, in-band fork recovery,
controller-key rotation, cross-process durable resume of the autonomous entry point, and multi-party
trust separation.

## Running it

```bash
# flagship: the whole flow through the autonomous entry point (keyless, asserted)
node docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs
# primitive-composition demo
node docs/runs/proposal-lifecycle/run-proposal-lifecycle.mjs
# the suites (obligation/gate/registry/orchestrator/concerns cases prove each mechanism above)
cd merkle-dag && npm test ; cd ../build-gate && npm test
```
