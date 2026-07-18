# Candidate approach — Iliad-quest workflow contract (institutional-memory record)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-iliad-workflow-contract.json` (approved; The Eye
ruled **option (b)**). **Authority basis:** The Eye directive in
`RETROSPECTIVES/agentic-orchestration-reference-1.json` (2026-07-18, merge git:6d16c8f).

This is the APPROACH under review, not the final record. The Daedalus workshop matures it (claude author /
codex reviewer) to `submit`; the record is authored afterward in implementation.

## 1. What is being recorded

The canonical workflow, framed as The Iliad quest — *the journey a new system undertakes to become an
enrolled part of The Iliad*:

```
Iliad(pre-review + entry-ritual gate)  ->  Daedalus  ->  TELOS  ->  Argo
   ->  [reference/documentation module]  ->  Clotho  ->  Iliad(retrospective -> enrolled)
```

A questing system ENTERS via the Iliad pre-review + the comprehension gate, undergoes the trials (Daedalus
matures the plan → TELOS authorizes → Argo implements → the documentation/reference module → Clotho weaves),
and COMPLETES via the retrospective to become enrolled. The Iliad is the encompassing quest, not a bookend.

## 2. Normativity — mixed, and honest (SCHEMA: NORMATIVE requires a passing oracle)

- **Order/presence rules that ALREADY have oracles** → `NORMATIVE-CURRENT`, anchored to the existing iliad
  invariants (`iliad-pre-review-before-implementation`, `iliad-post-review-required`) — pointed at, never
  re-implemented. The record links to those oracles; it does not add new enforcement for them.
- **The new stage** ("a documentation/reference module precedes the Clotho weave in every implementation
  cycle") has **no oracle** → per THE EYE'S OPTION (b), it is recorded as **ADVISORY** until it proves
  itself over cycles. It carries a note that it becomes a `SPECIFIED-PENDING-IMPLEMENTATION`/`NORMATIVE`
  candidate ONLY after a future Eye decision that commissions its oracle. It is NOT labelled NORMATIVE on
  prose alone, and this cycle changes **no** shared enforcement infra.

## 3. Deliverable shape

- A workflow contract record in the iliad module — candidate path
  `docs/institutional-memory/iliad/CONTRACTS/workflow.json` (kind `contract`): the ordered stages, each
  stage's owning role module (Daedalus/TELOS/Argo/the doc-reference/Clotho) pinned by a content-addressed
  reference to that module's record, and the per-stage normativity (NORMATIVE-CURRENT where an oracle exists,
  ADVISORY for the new stage).
- Its human projection (rendered, not hand-maintained) if the iliad module uses a rendered README pattern;
  otherwise a note in the module README index.
- A comprehension-query addition (or fixtures) testing: the stage order; that The Iliad is the quest (not a
  bookend); that enrollment is earned by traversal (proximity in the repo is not membership — cf. the
  AM-40-deferred ai-forge/forge/saas-forge, present but NOT enrolled); that the new stage is ADVISORY, not
  enforced. Reuse the existing `comprehension-gate.mjs` unchanged.

## 4. Verification

- Structural check that each stage's `owning_module` reference resolves to a real record (content-addressed).
- `verify-contracts.mjs` run **UNCHANGED** to prove no disturbance (option b: no oracle added this cycle).
- Terminal is **submit, not authorization** — The Eye's acceptance (merge) follows the workshop.

## 5. Non-goals (this cycle)

- No change to `verify-contracts.mjs` or `comprehension-gate.mjs` (option b).
- No record flipped NORMATIVE without an existing passing oracle.
- No new mythological term or component boundary (The Iliad, Daedalus, TELOS, Argo, Clotho are all
  registered; the workflow contract only records their ordering).
- No change to a frozen Clotho plan or any authz.
- No enrollment of any deferred product (that is each product's own future quest, The Eye's call).
