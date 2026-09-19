# Design: Daedalus Deterministic Sparse Review Compiler

**Date:** 2026-07-20

**Status:** Approved architecture boundary. The Eye approved preserving the five-call Daedalus
topology while moving review-obligation inventory, mechanical coverage, and matrix materialization
into deterministic controller code. This document authorizes only workshop-tooling implementation and
verification on the current feature branch. It does not authorize the production-profile plan, product
implementation, Argo execution, enrollment, merge, deployment, or changes to `CURRENT-AUTHORITY.json`.

**Target:** The governed workshop at
`docs/runs/production-profile-compiler-1-workshop/`

## Problem

The current workshop concatenates the complete design, pre-review, methodology, comprehension result,
controller ruling, and candidate plan into one frozen frame. It then sends that frame to both authors,
the integrator, and both verifiers. Integration additionally receives both author responses, while
verification additionally receives the integrated full plan and complete obligation matrix.

That topology preserves independent provenance but duplicates hundreds of kilobytes of context across
five calls and asks models to regenerate evidence the controller can derive. The failure mode is visible
in attempt 011: most reported conflicts are closed-set, path-inventory, task-coverage, or negative-test
requirements that deterministic code should have rejected before a provider call.

Prompt caching does not repair the authority problem. It is an optional transport optimization over an
exact shared prefix; it cannot prove coverage, prevent a model from omitting an obligation, or make a
model-authored matrix authoritative.

## Decision

Keep exactly five distinct provider-real calls:

1. constraints review;
2. implementation review;
3. integration;
4. constraints verification; and
5. implementation verification.

Replace full-document model authorship with a deterministic sparse-review contract:

```text
frozen inputs
  -> controller-owned review registry
  -> deterministic full-input preflight
  -> role-specific content-addressed review capsules
  -> sparse author findings
  -> sparse integration replacements and evidence locators
  -> controller-applied candidate
  -> controller-materialized obligation matrix
  -> deterministic full-candidate recheck
  -> delta capsules
  -> sparse verifier verdicts
```

The generic enrolled Daedalus implementation is not silently changed by this workshop-local proof. A
later separately governed change may generalize the mechanism after this run demonstrates it.

## Authority and trust boundaries

- The controller owns the closed review-obligation registry, stable IDs, source bindings, mechanical
  predicates, and matrix materialization.
- Models may report semantic findings and propose exact candidate replacements.
- Models may not add, remove, rename, waive, mark inapplicable, or satisfy a review obligation.
- A model-discovered requirement absent from the registry is returned as an
  `unregistered_obligation` finding and routes to The Eye.
- The controller validates every source locator against exact frozen bytes and SHA-256 before use.
- A capsule is a projection, not a substitute authority record. The complete frozen inputs remain
  content-addressed workshop evidence.
- No producer summary, model verdict, cache hit, status string, or token count is proof of plan
  correctness.

## Controller-owned review registry

The registry is local canonical JSON with a closed versioned shape:

```js
{
  review_registry_version: 1,
  contract: "production-profile-compiler-review/1",
  obligations: [{
    obligation_id: "PPC-W01",
    invariant: "non-empty text",
    negative_test: "non-empty text",
    exit_criterion: "non-empty text",
    source_bindings: [{
      input: "design" | "preReview" | "methodology" |
        "comprehension" | "ruling" | "candidate",
      literal: "exact unique source text"
    }],
    mechanical_checks: [{
      check_id: "stable unique identifier",
      kind: "contains-all" | "excludes-all" | "exact-count",
      input: "candidate",
      scope: { start_literal, end_literal },
      values: ["literal"],
      expected_count: 1
    }]
  }]
}
```

Unknown/missing keys, versions, inputs, check kinds, duplicate IDs, unsorted obligations/checks,
non-unique source literals, stale bindings, empty text, invalid scopes, or unsupported predicates block
before any model call.

The initial registry migrates the complete `PPC-W01` through `PPC-W29` contract from the preserved
attempt-011 constraints artifact. Migration is not trust by prose: the registry records the source
artifact reference, the controller re-verifies that artifact through the signed attempt chain, and the
checked-in registry becomes the new exact controller input for subsequent attempts.

## Deterministic preflight

Preflight evaluates every mechanical predicate over complete frozen bytes before dispatch. It emits:

```js
{
  review_preflight_version: 1,
  registry_ref,
  input_refs,
  checks: [{
    obligation_id,
    check_id,
    status: "pass" | "fail",
    evidence_refs: [{ input, start, end, bytes_sha256 }],
    detail
  }],
  status: "pass" | "blocked"
}
```

Any missing source, failed check, stale scope, ambiguous literal, or malformed registry returns
`blocked` and makes the provider-call count exactly zero. The preflight report is content-addressed and
included in the signed draft event.

The first catalog must encode the mechanical defects exposed by attempt 011:

- complete workshop authority-anchor coverage;
- Node 18/20 portability across distinct absolute roots and path separators;
- complete Task 6 and Task 7 registry/check coverage;
- explicit structural-evidence-cannot-substitute-for-runtime negative coverage;
- immutable attempt publication, signed transitions, and forensic-hold coverage for the demo and
  self-publication paths;
- complete executable source-closure inventory, including `merkle-dag/artifact.mjs` and
  `merkle-dag/crypto.mjs`; and
- no assertion that source closure is complete when the owning inventory check fails.

## Review capsules

Each capsule has a closed shape and is derived only by the controller:

```js
{
  review_capsule_version: 1,
  role: "constraints" | "implementation" | "integration" |
    "verify-constraints" | "verify-implementation",
  registry_ref,
  input_refs,
  preflight_ref,
  obligations: [{
    obligation_id,
    invariant,
    negative_test,
    exit_criterion,
    evidence_refs
  }],
  passages: [{
    input,
    start,
    end,
    bytes_sha256,
    text
  }],
  dependency_refs
}
```

Passages are deduplicated and ordered by input name, start, and end using code-unit ordering. Every
passage hash is recomputed before dispatch. No absolute host path enters a capsule or hash.

The constraints and implementation capsules contain the same closed obligation IDs but different
role-relevant passages. The integration capsule contains both sparse finding sets and only the candidate
passages implicated by those findings plus their deterministic dependency closure. Verification
capsules contain the original role findings, applied replacements, materialized matrix rows for affected
obligations, and affected passages. They do not repeat unaffected full inputs.

## Sparse model contracts

Author responses are exactly:

```js
{
  findings: [{
    finding_id,
    obligation_id,
    disposition: "satisfied" | "violated" | "unregistered_obligation",
    evidence_quotes: [{ input, quote }],
    detail,
    proposed_replacement: null | { old, new, reason }
  }]
}
```

There is exactly one finding per registered obligation. `satisfied` requires at least one valid evidence
quote. `violated` requires a non-empty detail and may include one exact replacement. An
`unregistered_obligation` uses `obligation_id: null`, cannot be integrated automatically, and routes to
The Eye.

Integration returns exactly:

```js
{
  decision: "preserve" | "revise" | "needs-eye",
  maturation_summary,
  replacements: [{ old, new, reason, obligation_ids }],
  mappings: [{
    obligation_id,
    mechanism_quote,
    task_quote
  }]
}
```

The controller requires a strict mapping bijection over the registry IDs, resolves every quote uniquely
against the integrated candidate, and materializes each matrix row by joining:

```text
registry invariant
  + candidate mechanism quote
  + candidate task quote
  + registry negative test
  + registry exit criterion
```

The model never emits the final matrix.

Verifier responses remain small:

```js
{
  verdict: "preserved" | "violated",
  conflicts: [{
    obligation_id,
    evidence_quotes,
    detail
  }]
}
```

Only literal `preserved` with an empty conflict list converges. Existing distinct-provenance,
dual-descent, exact-coverage, and conflict-to-The-Eye rules remain binding.

## Transport behavior

- Claude Code continues to use `--output-format json` and `--json-schema`.
- Codex CLI continues to use `--output-schema`, `--output-last-message`, and JSON events.
- Claude Code uses bare scripted mode so unrelated repository hooks, skills, plugins, memory, and
  project instructions are not added to this explicitly frozen workshop.
- Both adapters record prompt bytes, response bytes, model usage when exposed, elapsed milliseconds,
  and provider response identity.
- A controller byte budget is checked before spawn. Budget failure is a deterministic local block, not a
  provider error.
- The previous default `$3` abort threshold is removed from subscription-backed Claude Code execution.
  API-backed connectors may retain explicit caller-supplied monetary limits.
- Prompt caching and session continuation are optional and never acceptance requirements.
- Tests and smoke runs make no live provider call. A live rerun requires separate available
  authentication and explicit execution direction.

## Failure and preservation rules

- Historical attempts are immutable. Attempts 009–011 are not rewritten, deleted, or selected as a new
  result.
- A failed preflight creates a new immutable blocked attempt with zero provider provenance entries.
- A malformed or oversized model response blocks that attempt.
- Failed, ambiguous, overlapping, or stale replacements never change candidate bytes.
- A failed matrix materialization never emits an integration candidate.
- Deterministic recheck runs over the complete integrated candidate, not only the delta.
- Any semantic verifier conflict routes to `needs-eye`.
- No workshop result authorizes implementation or Argo.

## Acceptance

The workshop-local implementation is acceptable when:

1. registry mutation tests reject every open-shape, stale-binding, duplicate, unsorted, or unknown-kind
   case;
2. preflight catches all seven attempt-011 mechanical conflicts with zero seat calls;
3. correcting each fixture independently clears only its owning mechanical failure;
4. the controller, not a model fixture, creates the exact 29-row matrix;
5. full-frame text is absent from integration and verification prompts;
6. each capsule passage is hash-bound to frozen or integrated bytes;
7. all five provider provenance requirements remain enforced in a converging smoke fixture;
8. provider byte budgets fail before spawn;
9. prior workshop and generic Daedalus tests remain green;
10. institutional verification remains green; and
11. no live provider call, Argo slice, authority change, commit, merge, or deployment occurs as a side
    effect of verification.

