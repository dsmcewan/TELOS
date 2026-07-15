# Proposal Lifecycle — Review Packet (revision 3)

**Date:** 2026-07-14 (status updated 2026-07-15)
**Status:** FROZEN + IMPLEMENTED. The contract froze at `c3767b2`; the implementation shipped
(all primitives + the autonomous entry-point composition completed by the Argo pass) and every
package suite is green. The canonical contract is `contracts/Proposal Lifecycle.md`; the discharge
mechanism is the dedicated controller-minted verification node (`build-gate/check-registry.mjs` +
`proposal-orchestrator.mjs`), superseding any cross-revision node-lineage discharge target described
in earlier drafts below. The text below is retained as the review history.
**Branch:** `contracts/proposal-lifecycle` (round 1: `24a6ad5`; round-1 fixes: `8e06e78`)

## Round-2 finding and resolution

**Blocking: discharge reuse was keyed to the mutable human-readable
`obligation_id`.** Retargeting an obligation (same `obligation_id`, different
`concern_ref` / `required_result` / check contract) left `test.verifies`, the
test declaration, and the node's `effective_hash` byte-identical, so a stale
settlement could be reused despite the contract's promise.

Resolved: obligations now carry a controller-derived **`obligation_ref`** —
`hash(canonicalize({obligation_id, concern_ref, required_result,
check_contract_ref}))`, with `discharge_test_ref` deliberately excluded to
avoid circularity. `test.verifies` registers `obligation_ref`, not the label,
making invalidation a mechanical chain: changed semantics → changed
`obligation_ref` → changed `test.verifies` → changed test declaration → changed
`spec_hash`/`effective_hash` → stale settlement. The check-manifest alternative
must bind the manifest entry hash into the node's canonical test declaration.
Gate checks now recompute `obligation_ref` (checks 4–5 of 6). Required test
added: retargeting an obligation while retaining `obligation_id` changes
`obligation_ref` and invalidates the prior discharge. Invariant updated: the
human-readable `obligation_id` has no enforcement authority.

## Files under review

1. `contracts/Proposal Lifecycle.md` — new contract (full text in section A below).
2. `contracts/Agentic Teams Autonomous Builder.md` — amended (diff vs `main` in section B below).

## Round-1 findings and resolutions

### Blocking

1. **Verification obligations lacked a machine-readable coverage anchor.**
   Resolved: the discharge node's canonical test declaration must carry
   `verifies: [obligation_id, ...]` (or a repository-owned check manifest
   mapping `obligation_id → discharge_node_id → discharge_test_ref`). The field
   is covered by `discharge_test_ref`, `spec_hash`, and `plan_hash`. Gate check
   4 is now a mechanical membership check, and a new required test proves a
   matching test hash **without** the registration fails review. New invariant:
   *obligation coverage is a field the gate reads, not an inference.*

2. **Daedalus could converge by silently dropping an objection; one state
   transition was uncovered.** Resolved: convergence now requires every prior
   objection to be explicitly resolved, superseded, or withdrawn by its
   originating seat through a provenance-bound workshop record — *absence is
   not a disposition* (new invariant). The state machine is now total and
   candidate-hash-driven: unresolved + changed candidate hash → continue until
   the hard cap; unresolved + repeated candidate hash → stalemate; cap →
   stalemate. The controller never semantically judges whether a mutation
   "addressed" an objection. Two required tests added.

3. **Plan-mutation invalidation overclaimed what the Merkle structure
   guarantees.** Resolved by choosing **Merkle-reusable discharge**, matching
   the existing ledger semantics (`effective_hash` binds spec + ancestors only;
   verified against `merkle-dag/merkle.mjs`): a discharge stays valid only
   while the obligation definition, `discharge_test_ref`, and the discharge
   node's `effective_hash` are unchanged; an unrelated node mutation forces
   fresh review/authorization of the new `plan_hash` but does not invalidate an
   untouched node's discharge. New invariant: *authorization is exact-plan;
   discharge is node-lineage.* Required tests split accordingly.

### Smaller

4. **Packet staleness** — the "uncommitted in the working tree" status line is
   corrected (round-1 text was committed as `24a6ad5`; this packet reflects the
   revision-2 working tree).
5. **Sibling contract wording** — "council approval gate" corrected to
   "proposal authorization gate," with council approval named as a necessary
   input, never sufficient by itself.
6. **Fork recovery underspecified** — resolved by declaring it honestly: no
   in-band recovery event is defined in this version; a fork is terminal for
   automation, and recovery is manual human ledger reconstruction outside
   normal authorization, with the forked file preserved as audit evidence.

## Where each round-0 frozen amendment landed (unchanged from revision 1)

| # | Amendment | Location in the contract |
|---|---|---|
| 1 | `hard_stops` deprecation, normalization to `hold-request` with preserved attribution (`normalized_from_legacy: true`), unnormalized → protocol failure, both legacy gate paths named | "Legacy `hard_stops` deprecation" under **Review packets**; invariant; 4 required tests |
| 2 | Pre-build judgment is the normal case + Rule-3 bridge + `verification-required` | "Pre-build judgment is the normal case" under **Concerns**; **Verification obligations — the bridge to Rule 3**; disposition subsection |
| — | Obligation anchor: obligation schema, `discharge_test_ref` controller-computed, machine-readable `verifies` registration, 6 proposal-gate checks, `done(plan, ledger)` requirement, `blocked: undischarged verification obligation` | "Obligation anchor" under **Verification obligations**; implementation point 11; required tests incl. the vacuous and unregistered cases |
| 3 | Provider-scoped lineage keys, `${provider.toLowerCase()}:${responseId}`, missing provider fails closed | **Cold-review enforcement**; authorization conditions 5–6; 2 required tests |
| 4 | `runBuild()` re-verifies written plan hash before dispatch | "Execution-time re-verification" under **Authorization decision**; invariant; implementation point 12; required test |
| 5 | Ledger linearity + fork rules; fork terminal for automation, manual human recovery | "Chain linearity and forks" under **Proposal lifecycle ledger**; authorization condition 14; 6 fork tests |
| 6 | Fable identity: `claude` seat, Fable 5 as runtime-configured concrete model, no `fable` registry route | **Roles** table and surrounding text |
| 7 | `review_input_hash` honesty bound (controller observation, bounded by controller/transport integrity) | **Cold-review enforcement**, closing paragraphs |
| 8 | Sibling contract amendment: corrected ordering, phase list `situation \| decompose \| plan \| approval \| build`, explicit nonconformance note for `build-orchestrator.mjs`, proposal-authorization-gate wording | Section B below; implementation point 14; Scope note in the new contract |
| — | Daedalus naming (the Fable–Codex planning workshop; TELOS governs, Daedalus plans) | **Roles** intro, **The Daedalus workshop**, convergence/stalemate states, implementation point 4, frontmatter tag `workshop/daedalus` |

## Review checklist (frozen invariants)

- [ ] The gate reads the plan from disk; the orchestrator never supplies both sides of a hash comparison.
- [ ] `proposal_ref` must equal the independently recomputed written plan hash; `build_id` no longer satisfies it.
- [ ] Workshop convergence permits submission only; repeated candidate hashes with unresolved objections are stalemate.
- [ ] An absent objection is not a resolved objection; only provenance-bound resolution, supersession, or withdrawal disposes of it.
- [ ] Cold review is verified from provider-scoped lineage and input manifests, with the honesty bound stated.
- [ ] `hard_stops` carries no direct blocking force; normalization preserves attribution; both legacy paths covered.
- [ ] Obligation coverage is machine-readable and content-addressed: `test.verifies` registers `obligation_ref` (semantic hash; `obligation_id` has no enforcement authority); `done()` fails on undischarged obligations.
- [ ] Authorization is exact-plan; discharge is node-lineage (`obligation_ref` + `discharge_test_ref` + node `effective_hash`).
- [ ] Holds have policy-derived TTLs; expiry → `expired-unresolved`, never implicit approval.
- [ ] Unknown risk defaults high; model downgrades require signed human ratification.
- [ ] Evidence execution is closed-whitelist and sandboxed; arbitrary model-authored scripts never run as gate evidence.
- [ ] Dispositions come only from deterministic output or signed human action; no seat disposes of its own concern.
- [ ] `runBuild()` re-verifies the written plan hash before dispatch.
- [ ] The proposal ledger is a single canonical chain; forks are terminal for automation, recovered only by manual human reconstruction.
- [ ] Standing is recomputed from disk, backs off conservatively, and never satisfies approvals; new model versions start conservative.
- [ ] The controller is the sole proposal-ledger writer; only deterministic authorization permits execution.
- [ ] Closing language intact: *evidence certifies; audited judgment interrupts and escalates; deterministic policy decides* — and *model judgment is an interrupt, not a certificate.*

---

# A. Full text — `contracts/Proposal Lifecycle.md`

````markdown
---
title: "Proposal Lifecycle — Audited Judgment and Verified Authorization"
type: contract
tags:
  - topic/proposal-lifecycle
  - workflow/build-gate
  - workshop/daedalus
  - trust/provenance
  - trust/audited-judgment
---

# Proposal Lifecycle — Audited Judgment and Verified Authorization

This contract defines how TELOS turns an idea into an implementation proposal,
subjects that proposal to a bounded multi-model planning workshop, obtains cold
independent review, records judgment and evidence, and authorizes execution of one
exact content-addressed plan.

It introduces no new source of truth.

Every decision that changes executable state reduces to TELOS's existing trust
primitives:

- content hashes,
- signatures,
- provenance,
- deterministic policy,
- independently re-verifiable evidence,
- and disk as ground truth.

The core distinction is:

> **The artifact is not "the models agreed." It is "a proposal survived
> adversarial review and produced a verified implementation contract."**

Models may author, criticize, negotiate, approve, object, and recommend. Their
judgment is valuable and may be load-bearing for workflow interruption. It may
never certify its own correctness or independently place a build into a ready
state.

The authority rule is:

> **Evidence certifies. Audited judgment interrupts and escalates.
> Deterministic policy decides what happens next.**

## Scope

This contract governs the lifecycle before `runBuild()` executes a plan:

```text
idea + telos
  → draft
  → Daedalus planning workshop
  → content-addressed candidate plan
  → cold independent review
  → concern resolution / holds
  → deterministic authorization decision
  → execution under the existing merkle-dag and ledger contracts
```

The existing build invariants remain unchanged:

- teams are workers,
- model output is data,
- the controller is the sole ledger writer,
- disk is ground truth,
- node tests and artifact hashes are independently re-derived,
- and a model can never self-certify its own work.

This contract also amends the ordering in
`contracts/Agentic Teams Autonomous Builder.md` (see **Required implementation
points**): candidate compilation and writing must precede council review, and the
council must review the exact written plan hash.

## Authority classes

TELOS recognizes three classes of model output.

### 1. Unaudited judgment

Judgment used internally within a phase but not recorded as a signed,
provenance-bound lifecycle artifact.

Examples:

- brainstorming,
- intermediate reasoning,
- possible implementation approaches,
- uncommitted critique,
- discarded workshop drafts.

Unaudited judgment may influence another model's next response. It may not:

- advance the proposal state,
- create a gate blocker,
- satisfy an approval requirement,
- dispose of a concern,
- alter risk class,
- or authorize execution.

### 2. Audited judgment

Judgment that is:

- bound to an exact input artifact hash,
- bound to an exact plan hash where one exists,
- signed or HMAC-authenticated according to its record type,
- stamped with real per-call provenance,
- content-addressed on disk,
- and written into the proposal lifecycle by the sole-writer controller.

Audited judgment may:

- raise a consideration,
- request revision,
- create a temporary hold,
- route a proposal for additional review,
- recommend approval,
- or request human adjudication.

Audited judgment is accountable but not automatically correct.

### 3. Re-verifiable evidence

A claim accompanied by evidence that a trusted deterministic verifier can
independently reproduce from disk.

Re-verifiable evidence may:

- establish a blocker,
- dismiss a factual concern,
- satisfy a deterministic policy condition,
- or contribute to authorization.

No model's assertion that evidence is valid is sufficient. The trusted verifier
must reproduce the result.

## Roles

The planning workshop is named **Daedalus**: the architect and master craftsman
who designs the labyrinth before anyone enters it. TELOS governs; Daedalus plans.
The name marks the boundary — Daedalus may design, negotiate, and refine, but it
holds no authorization authority over what it designed.

Daedalus consists of two complementary seats:

| Seat | Concrete model | Workshop responsibility |
|---|---|---|
| `claude` | Fable 5 by current runtime configuration | architecture, intent preservation, system boundaries, maintainability |
| `codex` | runtime-configured Codex model | implementation feasibility, dependencies, tests, file footprints, execution detail |

The architecture participant is the existing `claude` seat. Fable 5 is the
currently selected concrete model recorded in provenance, not a separate seat or
registry route. The contract does not require Fable 5 specifically; it requires a
configured model for the `claude` planning seat that satisfies the workshop
contract. Model ids stay env/per-call, as elsewhere in TELOS. Every call records
the concrete provider model in provenance.

The workshop seats are collaborators during proposal creation. They are not the
authority that authorizes their proposal.

Additional seats participate in independent review according to the existing
council and team configuration.

A provider may appear in both creation and review only through a distinct call
with distinct provenance and a cold review input. Provider-family separation is
not required; call-lineage separation is.

## Proposal lifecycle

The proposal lifecycle is represented by append-only signed events.

```text
draft
  ↓
negotiation
  ├── negotiation-round-1
  ├── negotiation-round-2
  └── ...
  ↓
candidate
  ↓
review
  ├── approved-with-considerations
  ├── held
  ├── revise
  └── rejected
  ↓
decision
  ├── authorized
  ├── blocked
  ├── human-review-required
  └── expired-unresolved
```

A proposal may return from review to negotiation.

Every revision produces a new candidate plan hash. Approval packets for an older
hash become stale automatically and cannot authorize the revised plan.

## Proposal lifecycle ledger

Proposal events live in:

```text
.telos/proposal.jsonl
```

This ledger is separate from the task-settlement ledger because proposal events
and task settlements have different signed schemas.

It reuses the existing ledger principles:

- canonical serialization,
- Ed25519 signatures,
- append-only storage,
- fsync before acknowledgment,
- controller-only writes,
- and verification from disk.

Each proposal event contains at minimum:

```json
{
  "record_type": "proposal-event",
  "proposal_id": "proposal-...",
  "sequence": 7,
  "stage": "draft | negotiation | candidate | review | hold | disposition | decision",
  "plan_hash": "sha256:...",
  "parent_event_hash": "sha256:...",
  "artifact_refs": [],
  "actor": {
    "seat": "codex",
    "role": "implementation-reviewer"
  },
  "provenance": {
    "provider": "openai",
    "response_model": "...",
    "response_id": "...",
    "answered_at": "..."
  },
  "policy_result": null,
  "recorded_at": "...",
  "key_id": "proposal-controller",
  "sig": {
    "alg": "Ed25519",
    "value": "...",
    "signed_fields": "..."
  }
}
```

`parent_event_hash` forms a hash chain. Deletion, insertion, mutation, or
reordering of lifecycle events must be detectable.

### Chain linearity and forks

The proposal ledger is a **single canonical chain**. Verification must enforce:

- sequence numbers are unique and contiguous under the configured policy;
- each non-root event references exactly one existing predecessor;
- no two events may claim the same `parent_event_hash`;
- multiple heads are invalid;
- an event cannot reference a descendant or itself;
- all event hashes and signatures must recompute from disk.

Two validly signed events claiming the same parent constitute a **fork** and
invalidate authorization. Sole-writer discipline should prevent forks;
verification from disk must not assume the writer behaved.

No in-band recovery event is defined in this version. Fork recovery is manual
ledger reconstruction outside normal authorization: a human selects the
canonical chain, preserves the forked file as audit evidence, and re-establishes
a single verified chain. Authorization remains impossible until ledger
verification passes again from disk. A future revision may define a signed
recovery record; until then, a fork is terminal for automation.

Large reasoning artifacts, workshop responses, and evidence bodies are stored as
content-addressed files. The ledger stores their hashes and paths rather than
embedding unbounded model output directly.

Provider and timestamp fields supplied by a connector are reproducibility
telemetry. They are not equivalent to provider-authenticated response ids.
Including them in signed event bytes makes them tamper-evident as controller
observations; it does not make them independently authenticated facts.

## Draft stage

A draft begins from:

- the dossier,
- the telos statement,
- required documents,
- project conventions,
- write constraints,
- protected paths,
- and deterministic risk-policy inputs.

The controller writes a `draft` event containing hashes of all inputs.

No model-authored summary may replace the original input artifacts.

## The Daedalus workshop

Daedalus is a bounded alternating exchange between the `claude` and `codex`
planning seats.

A round consists of:

1. one seat receiving the current candidate artifact,
2. producing a proposed revision or objections,
3. the other seat reviewing that exact revision,
4. the controller writing both outputs and provenance to disk,
5. and the controller mechanically computing the next state.

Each round emits a content-addressed artifact:

```json
{
  "round": 3,
  "input_plan_artifact_hash": "sha256:...",
  "output_plan_artifact_hash": "sha256:...",
  "author": {
    "seat": "claude",
    "provenance_ref": "sha256:..."
  },
  "reviewer": {
    "seat": "codex",
    "provenance_ref": "sha256:..."
  },
  "objections": [
    {
      "objection_hash": "sha256:...",
      "scope": "task:auth-service",
      "claim": "...",
      "evidence_refs": []
    }
  ],
  "resolutions": [
    {
      "objection_hash": "sha256:...",
      "resulting_artifact_refs": []
    }
  ]
}
```

### Objection hashing

An objection hash is computed by the controller from the canonical form of:

```json
{
  "scope": "...",
  "claim": "...",
  "evidence_refs": []
}
```

The model does not select or self-assert the hash.

Hashes detect exact repeated objections. They do not prove semantic uniqueness;
a paraphrased objection may produce a new hash. The hard round cap remains the
ultimate cost and liveness fuse.

### Workshop state calculation

The controller derives one of three states:

#### Continue

Continue when:

- one or more unresolved objections exist,
- the candidate artifact hash changed in the current round,
- and the maximum round count has not been reached.

The controller never semantically decides whether a mutation "addressed" an
objection. A changed candidate buys another round; the hard round cap bounds
meaningless mutation.

#### Converged for submission

Daedalus is mechanically marked `converged-for-submission` only when:

- both required workshop responses exist,
- each carries distinct valid call provenance,
- both responses bind to the same output artifact hash,
- both unresolved-objection sets are empty,
- and the controller can account for every prior objection as explicitly
  resolved, superseded, or withdrawn by its originating seat through a
  provenance-bound workshop record.

**Absence is not a disposition.** An objection absent from a later response
remains unresolved unless a resolution, supersession, or withdrawal record
exists. A seat cannot enable convergence by silently dropping an objection.

This state means only:

> Daedalus has produced a candidate mature enough for independent review.

It does not authorize implementation.

#### Stalemate

Daedalus enters `stalemate` when:

- unresolved objections exist and the candidate artifact hash repeats a hash
  from any prior round,
- or the hard round cap is reached with unresolved objections.

Every reachable state is covered deterministically:

```text
unresolved objections + changed candidate artifact hash
→ continue, until the hard cap

unresolved objections + repeated candidate artifact hash
→ stalemate

hard cap reached with unresolved objections
→ stalemate

no unresolved objections + all priors resolved / superseded / withdrawn
→ converged-for-submission
```

A stalemate never grants convergence.

Its terminal result is `needs-work` or human escalation.

## Candidate plan compilation

After Daedalus convergence, TELOS compiles the candidate through
`compileAndHashPlan()`.

**Compilation occurs before council review.**

The controller writes the candidate to disk using the existing immutable plan
layout, including:

```text
.telos/plans/<plan_hash>.json
.telos/plan.json
```

The review gate must:

1. read `.telos/plan.json` from disk,
2. recompute its hashes from its contents,
3. verify that the recomputed plan hash matches the immutable candidate file,
4. and use that recomputed hash as the authority for all review comparisons.

The orchestrator must never supply both values being compared.

The load-bearing invariant is:

> **No review packet may authorize execution unless its `proposal_ref` equals
> the plan hash independently recomputed from the written plan on disk.**

A packet bound to:

- the dossier build id,
- a previous plan hash,
- a caller-supplied alias,
- or a missing proposal reference

cannot authorize execution.

## Review packets

Independent reviewers receive:

- the exact candidate plan,
- the proposal contract,
- required source documents,
- and the minimum project evidence required for their review role.

They do not receive:

- prior endorsements,
- workshop votes,
- other reviewers' conclusions,
- model-generated consensus summaries,
- or the negotiation transcript,

unless a specific review contract explicitly requires one of those artifacts.

Review packets include:

```json
{
  "proposal_ref": "sha256:<exact plan hash>",
  "decision": "approve | revise | reject",
  "confidence": "low | medium | high",
  "required_edits": [],
  "concerns": [],
  "considerations": [],
  "rationale_artifact_ref": "sha256:...",
  "provenance": {}
}
```

Identity, proposal reference, and lifecycle metadata are injected by trusted
wiring rather than authored by the model.

### Legacy `hard_stops` deprecation

`hard_stops` is deprecated in proposal-lifecycle review packets. For
compatibility, the trusted controller converts each legacy `hard_stops` string
into a typed `hold-request` concern before gate evaluation. A legacy hard stop
may create a policy-governed hold, but it does not become a verified blocker
without independently re-verifiable evidence.

If an unnormalized `hard_stops` field reaches the proposal gate, the packet fails
schema or protocol validation. The gate may fail closed because the packet
violates the contract, but it must not treat the string itself as verified
evidence.

```text
bare hard-stop string
→ hold-request after normalization

bare hard-stop bypassing normalization
→ malformed packet / protocol failure

verified evidence attached to concern
→ blocker
```

Normalization must preserve attribution:

```json
{
  "judgment_class": "hold-request",
  "claim": "...",
  "raised_by": {
    "seat": "grok",
    "provenance": {}
  },
  "normalized_from_legacy": true
}
```

The controller created the typed envelope, but the originating seat remains
responsible for the judgment. That keeps calibration honest.

Both legacy blocking paths in the build gate — the generic required-seat
`hard_stops` path and the Grok-specific `hard_stops` path — must be removed or
normalized for proposal-lifecycle evaluation. Leaving either one would preserve
an undocumented veto channel.

## Cold-review enforcement

Cold review is a gate invariant, not a prompting convention.

The proposal records a `creation_lineage` containing every model call that
contributed to the candidate plan.

The review stage records a `review_lineage` containing every model call that
contributed to a review packet.

Lineage identities are **provider-scoped**. The gate verifies:

```text
creation (provider, response_id) pairs
∩
review (provider, response_id) pairs
=
∅
```

The normalized lineage key is:

```javascript
`${provider.toLowerCase()}:${responseId}`
```

Response ids are only unique per provider; raw id-string comparison across
providers is neither sound nor necessary. A missing provider in signed
proposal-lifecycle mode fails closed or is treated as unverifiable lineage.

A reused `(provider, response_id)` pair blocks.

Each review record also carries:

```text
review_input_hash =
  hash(candidate plan + review contract + supplied evidence manifest)
```

The gate verifies the review input manifest from disk.

Distinct response ids establish separate calls. The review-input hash establishes
what those calls were permitted to see.

`review_input_hash` is a trusted-controller observation of the inputs supplied
through the recorded review wiring. It detects omissions, additions, and
contamination in the recorded input manifest. It cannot prove that a compromised
connector, provider, process, or out-of-band channel did not expose additional
information to the reviewer. Cold-review assurance is therefore bounded by the
integrity of the controller and transport boundary. This matches the existing
provenance posture: tamper-evident and auditable does not mean omniscient.

A provider may review a plan it helped create only through a new call that
satisfies both checks.

## Concerns and considerations

A review may raise concerns.

### Pre-build judgment is the normal case

During pre-build proposal review, most implementation concerns cannot yet be
reproduced against executable artifacts. Audited judgment and policy-governed
holds are therefore the **primary** plan-stage controls, not exceptional
fallbacks.

Plan-stage evidence is generally limited to facts already present on disk: plan
structure, declared dependencies, protected paths, schemas, provenance,
signatures, existing brownfield code, and other repository state.

A concern is represented as:

```json
{
  "concern_id": "security-017",
  "plan_hash": "sha256:...",
  "scope": "task:auth-service",
  "claim": "The proposed authorization boundary may permit cross-tenant reads.",
  "severity": "low | medium | high | critical",
  "judgment_class": "consideration | hold-request | evidence-claim",
  "evidence": null,
  "reasoning_artifact_ref": "sha256:...",
  "raised_by": {
    "seat": "grok",
    "provenance_ref": "sha256:..."
  }
}
```

The model may propose severity. Deterministic policy computes the effective risk
treatment.

### Consideration

An audited concern without sufficient blocking authority is recorded as a
consideration.

It remains visible to:

- implementation teams,
- humans,
- later reviews,
- and standing calculations.

It does not block automatically.

### Judgment hold

Audited judgment may create a temporary hold without re-verifiable evidence.

A hold fails safe: its cost is liveness rather than integrity.

The controller derives:

- whether a hold is permitted,
- its TTL,
- its escalation path,
- and whether human adjudication is mandatory

from deterministic policy.

The model may request a hold. It may not choose its duration or expiry behavior.

### Verified blocker

A concern becomes a verified blocker only when a trusted evidence verifier
independently reproduces its claim.

Seat rank does not confer blocking force.

An advisory seat's concern may become blocking when evidence verifies. A required
seat's unsupported concern may create a hold but is not converted into verified
fact merely because the seat is required.

## Verification obligations — the bridge to Rule 3

A reviewer may resolve a plan-stage concern by requiring the candidate plan to
contain a specific declared test or deterministic verification obligation. That
requirement becomes a `required_edit`, forces a new plan hash, and is reviewed as
part of the revised candidate.

The concern is not dismissed merely because a test was added. It becomes a
**verification obligation** pinned into the plan, and the concern's disposition
becomes `verification-required`. Authorization may permit implementation
according to risk policy, but merge readiness remains impossible until the
existing Rule-3 verifier executes the declared test and reproduces the required
result.

```text
plan-stage judgment
→ required_edit: add test
→ revised and rehashed plan
→ verification-required
→ hashed obligation bound to a specific node and test
→ authorized implementation
→ Rule 3 executes test
→ settled discharge
→ merge eligibility
```

### Obligation anchor

The linkage is mechanical. The gate is never asked to infer whether a test
"really exercises" a concern; the obligation names its discharge point exactly.

Each verification obligation is part of the hashed plan and contains at least:

```json
{
  "obligation_id": "verify-auth-boundary-001",
  "obligation_ref": "sha256:...",
  "concern_ref": "sha256:...",
  "discharge_node_id": "auth-boundary-test",
  "discharge_test_ref": "sha256:...",
  "check_contract_ref": "sha256:...",
  "required_result": "pass"
}
```

`obligation_id` is a human-readable label with no enforcement authority. The
obligation's enforcement identity is `obligation_ref`, a controller-derived
content address of the obligation's **semantics**:

```text
obligation_ref =
  hash(canonicalize({
    obligation_id,
    concern_ref,
    required_result,
    check_contract_ref
  }))
```

`discharge_test_ref` is deliberately excluded from `obligation_ref` to avoid a
circular dependency, because the test declaration itself registers
`obligation_ref`.

`discharge_test_ref` is computed by the controller from the canonical test
declaration or a repository-owned check manifest — not supplied as a trustworthy
assertion by the model.

Registration is machine-readable. The discharge node's test declaration must
register the obligation's content-addressed identity explicitly:

```json
{
  "test": {
    "cmd": "node",
    "args": ["--test", "tests/auth-boundary.test.mjs"],
    "verifies": ["sha256:<obligation_ref>"]
  }
}
```

`verifies` lists the `obligation_ref`s the test discharges. It is part of the
canonical test declaration, so it is covered by `discharge_test_ref`, the node's
`spec_hash`, and the plan hash. That makes invalidation a mechanical chain
rather than a promise:

```text
changed obligation semantics
→ changed obligation_ref
→ changed test.verifies
→ changed test declaration
→ changed node spec_hash / effective_hash
→ old settlement becomes stale
```

Retargeting an obligation — changing its `concern_ref`, `required_result`, or
check contract while retaining the human-readable `obligation_id` — therefore
invalidates the prior discharge with no additional check.

A repository may equivalently use a repository-owned check manifest mapping:

```text
obligation_ref → discharge_node_id → discharge_test_ref
```

but the manifest entry hash must likewise be bound into the node's canonical
test declaration; otherwise the manifest path recreates the same gap.

Either way, the coverage anchor is a field the gate reads mechanically — never
an inference about what a test "really exercises."

The proposal gate must verify:

1. The named node exists in the candidate plan.
2. The referenced test/check exists.
3. The test reference matches the named node's actual hashed test declaration.
4. The obligation's recomputed `obligation_ref` appears in the named node's
   `verifies` registration (or the bound check-manifest entry). A test
   declaration whose hash matches `discharge_test_ref` but which does not
   register the obligation's `obligation_ref` fails review.
5. The recorded `obligation_ref` matches the controller's recomputation from
   the obligation's canonical semantics.
6. The obligation, node, test, and concern reference are all covered by the
   candidate `plan_hash`.

Then `done(plan, ledger)` must require:

```text
every verification obligation
  → maps to a current plan node
  → that node has a valid settlement
  → settlement matches the node's current effective_hash
  → settlement followed successful Rule-3 verification
```

Otherwise:

```json
{
  "merge_status": "blocked",
  "reason": "undischarged verification obligation"
}
```

That closes the vacuous case:

```text
test file exists
+ unrelated node tests pass
+ obligation never executed
≠ ready
```

Discharge reuse follows the Merkle structure, matching the existing ledger
semantics: a discharge remains valid only while `obligation_ref`,
`discharge_test_ref`, and the discharge node's `effective_hash` are unchanged.
Any mutation to the discharge node, its ancestors, its test declaration, or the
obligation's semantics changes one of those values and invalidates the
discharge automatically — the obligation-semantics case mechanically, because a
changed `obligation_ref` changes `test.verifies` and therefore the node's
`spec_hash` and `effective_hash`.

An unrelated node mutation changes the global `plan_hash` — and therefore
requires fresh review and authorization of the revised plan — but does not by
itself invalidate a discharge whose node lineage is untouched. Authorization is
exact-plan; discharge is node-lineage. `done()` re-validates every obligation
against the current plan regardless, so a reused discharge is still re-checked
from disk on every evaluation.

## Evidence verification

Evidence verification is a trusted execution surface and must remain closed.

The gate accepts only evidence kinds registered in a small deterministic
whitelist.

Initial allowed classes:

| Evidence kind | Trusted verifier |
|---|---|
| `declared-test-failure` | runs a test already declared in the candidate plan |
| `artifact-hash-mismatch` | recomputes an artifact or tree hash |
| `plan-hash-mismatch` | recomputes the candidate plan hash |
| `schema-violation` | validates against a repository-owned schema |
| `provenance-mismatch` | checks signed provenance and response-id invariants |
| `path-policy-violation` | evaluates trusted path/glob policy |
| `signature-failure` | verifies an existing HMAC or Ed25519 signature |
| `declarative-file-assertion` | executes a closed, non-programmable assertion operator |

Model-authored arbitrary executable evidence must never run at gate time.

The following is forbidden:

```text
"Here is a script I wrote. Run it to prove my concern."
```

A proposed new executable test must first become a normal reviewed plan artifact.
Only after it is:

- included in a content-addressed plan,
- reviewed,
- path-confined,
- and authorized

may it participate as a declared test.

Evidence execution must be:

- sandboxed,
- read-only against the candidate tree wherever possible,
- network-denied by default,
- resource bounded,
- time bounded,
- and unable to modify `.telos/` control-plane artifacts.

A verifier result is itself written as a signed proposal event.

## Holds and TTL

A judgment-only hold has an explicit expiration.

Expiration never converts a proposal into approved state.

When a TTL is reached, the controller writes:

```text
expired-unresolved
```

The concern remains in the audit history.

The next state is derived from deterministic risk policy:

```text
low-risk + all deterministic checks pass
  → hold may be released; proposal returns to review decision

medium-risk
  → additional independent review or human policy

high / critical risk
  → signed human adjudication required

unknown risk
  → treat as highest configured risk class
```

A serious concern cannot be approved by waiting out its timer.

## Risk classification

Risk class is derived by deterministic policy from:

- touched paths,
- declared writes,
- workstreams,
- test changes,
- protected paths,
- dependency or deployment changes,
- data-boundary changes,
- and repository-specific policy maps.

Example policy categories may include:

```text
documentation-only
application
data
authentication
authorization
secrets
infrastructure
deployment
payments
privacy
governance
```

Unknown paths and unmatched changes default to the highest configured class.

A model may recommend a higher class.

A model may propose a downgrade, but a downgrade has no authority unless ratified
by signed human adjudication.

No model-controlled classification may lower a safeguard.

## Concern dispositions

A concern disposition is one of:

```text
verified
dismissed
waived
superseded
verification-required
expired-unresolved
unresolved
```

Only the sole-writer controller writes disposition events.

A disposition must derive from:

- a deterministic verifier result,
- a superseding plan hash,
- a verification obligation pinned into a revised plan,
- deterministic expiration policy,
- or signed human adjudication.

A model may recommend a disposition. It may not write one.

A seat may never dispose of a concern raised against work that seat created,
modified, or reviewed in the same lineage.

### Verified

The trusted verifier reproduced the concern.

The concern becomes a blocker until a new plan resolves it and that resolution
survives review.

### Dismissed

A trusted verifier contradicted the factual claim or proved the cited condition
absent.

### Waived

A human with explicit authority accepts the risk through a signed adjudication.

A model cannot waive risk.

### Superseded

A later plan hash makes the concern's target obsolete.

Supersession does not imply the concern was wrong.

### Verification-required

The concern was converted into a verification obligation pinned into a revised
plan (see **Verification obligations**). The concern is neither dismissed nor
verified; it awaits Rule-3 discharge. Merge readiness is impossible while any
obligation remains undischarged.

### Expired-unresolved

The hold TTL elapsed without evidence or adjudication.

Policy — not timeout alone — determines whether review may resume.

## Standing and calibration

Audited judgments and their eventual dispositions allow TELOS to measure reviewer
calibration over time.

Standing is never stored as a mutable score.

It is recomputed from the signed proposal ledger and disposition records whenever
used.

Possible derived measures include:

- concerns raised,
- verified-concern rate,
- dismissed-concern rate,
- unresolved-hold rate,
- severity calibration,
- time to resolution,
- and false-hold cost.

Standing is segmented by:

```text
seat
role
workstream
risk class
concrete model version
```

Because exact segments will initially be sparse, standing uses hierarchical
backoff.

Example backoff order:

```text
seat + model version + role + workstream + risk class
seat + role + workstream + risk class
seat + role + risk class
seat + role
conservative default
```

Every level requires a configured minimum sample count.

A new concrete model version begins at the conservative default. It does not
automatically inherit the reputation of a predecessor model.

Standing may influence:

- hold TTL,
- whether a second reviewer is automatically convened,
- human-escalation thresholds,
- reviewer selection,
- and advisory versus hold authority.

Standing may never:

- satisfy an approval,
- waive a verified blocker,
- bypass a deterministic test,
- suppress required provenance,
- or directly authorize execution.

## Authorization decision

The controller may write `authorized` only when all of the following hold:

1. The candidate plan exists on disk.
2. Its hash is independently recomputed from the written plan.
3. The immutable candidate artifact matches that recomputed hash.
4. Every required review packet binds `proposal_ref` to that exact hash.
5. Required packet shape, HMAC, provenance, and provider-scoped response-id
   uniqueness pass.
6. Creation and review lineages are disjoint under provider-scoped keys.
7. Review-input hashes verify against the supplied cold-review manifests.
8. Required model judgments are approving.
9. No required edits remain.
10. No verified blocker remains active.
11. No risk-policy-required hold or human adjudication remains unresolved.
12. Every verification obligation passes the obligation-anchor checks.
13. Protected-path, schema, signature, and other deterministic gate checks pass.
14. The proposal ledger signature, hash chain, and linearity verify from disk.

Model approval is necessary where the council contract requires it, but it is
never sufficient by itself.

The controller writes one of:

```text
authorized
revise
blocked
human-review-required
```

Only `authorized` permits `runBuild()` to begin.

### Execution-time re-verification

`runBuild()` must begin by reading the active written plan from disk, recomputing
its plan hash, and verifying that it equals the hash carried by the authorization
decision.

No prior authorization check is sufficient if the written plan has changed
between decision and execution.

```text
authorized(plan_hash=A)
       ↓
runBuild starts
       ↓
read plan.json from disk
       ↓
recompute plan_hash
       ↓
A matches → execute
A differs → block before dispatch
```

This closes the time-of-check/time-of-use gap between decision and execution.

## Revision and stale authorization

Any change to:

- tasks,
- requirements,
- files,
- tests,
- dependencies,
- authorized signers,
- verification obligations,
- or other plan-hashed fields

produces a new plan hash.

The new proposal records the old hash as its predecessor.

All packets, reviews, evidence decisions, and authorizations bound to the old
hash become stale for execution purposes.

Historical records remain valid as audit evidence. They simply cannot authorize
the new plan.

Forward invalidation is automatic:

```text
changed plan
  → changed plan hash
  → old proposal_ref mismatch
  → stale review cannot authorize
```

## The authority ladder

After these rules, there is only one coherent channel:

```text
Unaudited judgment
→ internal working material

Audited consideration
→ durable signal

Audited unsupported concern
→ policy-governed hold

Concern converted into declared verification obligation
→ may permit implementation, but cannot permit merge without Rule-3 success

Re-verifiable evidence
→ verified blocker or verified resolution

Required approval
→ necessary input

Exact-plan authorization + deterministic checks
→ execution permitted
```

## Invariants that must not weaken

- **The gate reads the plan from disk.** The orchestrator cannot provide both
  sides of a plan-hash comparison.
- **Review binds to the exact executable plan.** `proposal_ref` must equal the
  independently recomputed written plan hash.
- **Workshop convergence is not authorization.** It permits submission only.
- **Repeated unresolved objections are stalemate, not agreement.**
- **An absent objection is not a resolved objection.** Only a provenance-bound
  resolution, supersession, or withdrawal record disposes of a workshop
  objection.
- **Obligation coverage is a field the gate reads, not an inference.** The
  discharge test must register the obligation's content-addressed
  `obligation_ref` in its canonical declaration (or a check-manifest entry
  hash bound into that declaration). The human-readable `obligation_id` has no
  enforcement authority.
- **Cold review is verified from provider-scoped lineage and input manifests.**
- **A model may raise a hold but may not set its own TTL or release condition.**
- **A model may not dispose of its own concern or grade its own work.**
- **`hard_stops` carries no direct blocking force.** A legacy hard stop is
  normalized into a hold-request concern with preserved attribution, or the
  packet fails protocol validation.
- **Unknown risk defaults high.** No model-controlled classification may lower
  safeguards.
- **Evidence execution is closed and sandboxed.** Arbitrary model-authored code
  is never executed as gate evidence.
- **Every verification obligation names its discharge node and test.** `done()`
  fails while any obligation lacks a settled, Rule-3-verified discharge.
- **Disposition comes from deterministic output or signed human action.**
- **`runBuild()` re-verifies the written plan hash before dispatch.**
- **The proposal ledger is a single canonical chain.** A fork invalidates
  authorization and is terminal for automation; recovery is manual human ledger
  reconstruction outside normal authorization.
- **Authorization is exact-plan; discharge is node-lineage.** Every new plan
  hash requires fresh authorization; a discharge is reusable only while the
  obligation definition, discharge test reference, and discharge node effective
  hash are unchanged.
- **Standing is recomputed from disk.** It is not a mutable authority score.
- **A new model version starts conservative.**
- **Audit does not equal correctness.** It supplies attribution, reproducibility,
  and calibration.
- **Models may interrupt more easily than they may authorize.**
- **The controller is the sole proposal-ledger writer.**
- **Only deterministic authorization permits execution.**

## Required implementation points

1. Reorder `buildProject()` so candidate compilation and writing occur before
   council review.
2. Enforce `packet.proposal_ref === recomputedWrittenPlanHash`.
3. Preserve decomposition and workshop provenance as creation lineage.
4. Add the bounded claude/codex Daedalus negotiation workshop with
   content-addressed round artifacts.
5. Add cold-review lineage (provider-scoped keys) and input-manifest checks.
6. Add typed concerns, holds, and evidence claims; normalize legacy `hard_stops`
   in **both** existing blocking paths (the generic required-seat path and the
   Grok-specific path in `build-gate/gate.mjs`).
7. Add a signed hash-chained `.telos/proposal.jsonl` ledger with linearity and
   fork verification.
8. Add controller-only disposition records, including `verification-required`.
9. Add deterministic risk-class policy with unknown-high behavior.
10. Add the sandboxed closed-whitelist evidence verifier.
11. Add verification obligations to the plan schema, the obligation-anchor checks
    to the proposal gate, and the undischarged-obligation check to
    `merkle-dag/ledger-gate.mjs` `done()`.
12. Add execution-time plan re-verification at the start of `runBuild()`.
13. Add pure standing derivation with hierarchical backoff and conservative
    model-version defaults.
14. Amend `contracts/Agentic Teams Autonomous Builder.md`: correct its lifecycle
    ordering and phase list (`situation | decompose | plan | approval | build`),
    and identify `build-gate/build-orchestrator.mjs` as nonconforming until the
    reorder lands.

## Required tests

The implementation is incomplete until tests prove:

- council review cannot occur without a written candidate plan,
- the gate reads and recomputes the plan hash from disk,
- an orchestrator-supplied false hash cannot satisfy the equality,
- `proposal_ref === build_id` no longer satisfies plan authorization,
- mutation creates a new hash and invalidates stale reviews,
- discarded or overlapping creation/review provenance blocks cold review,
- lineage disjointness is provider-scoped: colliding response-id strings from
  distinct providers do not collide as lineage keys,
- a missing provider in signed proposal-lifecycle mode fails closed,
- a review given the workshop transcript fails its input-manifest contract,
- a repeated nonempty objection set produces stalemate,
- an empty final objection set permits submission but not execution,
- an advisory judgment may create a policy-bound hold,
- hold expiry creates `expired-unresolved`, never implicit approval,
- unknown touched paths receive the highest risk class,
- a model-proposed risk downgrade has no effect without human signature,
- a seat cannot dispose of a concern against its own work,
- a bare `hard_stops` string cannot directly create a verified blocker,
- a legacy hard stop is normalized into a hold with policy-derived TTL and
  preserved seat attribution (`normalized_from_legacy: true`),
- an unnormalized hard stop causes protocol failure, not evidence-backed
  disposition,
- a hard stop cannot bypass concern disposition, expiry, risk classification, or
  evidence verification,
- an arbitrary model-authored evidence script is rejected without execution,
- every allowed evidence kind runs only its registered trusted verifier,
- verified evidence can elevate an advisory concern to a blocker,
- unsupported concerns remain considerations or temporary holds,
- a plan containing an undischarged verification obligation cannot reach
  `merge_status: "ready"` even when every node settles,
- an obligation naming a missing node, missing test, or mismatched test
  reference fails the proposal gate,
- a test declaration whose hash matches `discharge_test_ref` but which does not
  register the obligation's `obligation_ref` in `verifies` (or the bound check
  manifest) fails review,
- changing `concern_ref`, `required_result`, or the obligation's check contract
  while retaining the human-readable `obligation_id` changes `obligation_ref`
  and invalidates the prior discharge,
- mutating the discharge node, an ancestor, its test declaration, or the
  obligation's semantics invalidates a prior discharge,
- an unrelated node mutation forces re-authorization of the new plan hash but
  does not invalidate an untouched node's discharge,
- an objection silently dropped from a later round (no resolution,
  supersession, or withdrawal record) blocks convergence,
- unresolved objections with a changed candidate hash continue the workshop;
  with a repeated candidate hash they produce stalemate,
- `runBuild()` blocks before dispatch when the written plan hash differs from
  the authorized hash,
- proposal ledger mutation, deletion, or reordering breaks verification,
- duplicate sequence numbers, two children of one parent, multiple heads,
  missing parents, self-parents, and cycles each break verification,
- standing is recomputed from ledger records,
- sparse standing backs off conservatively,
- a new model version does not inherit predecessor authority,
- and execution begins only after the exact written plan is authorized and
  re-verified at execution start.

## Final rule

TELOS does not attempt to eliminate judgment.

It places judgment inside an accountable system where:

- authorship is attributable,
- review is independent,
- objections are preserved,
- evidence is independently checked,
- risk is governed by policy,
- and no model's confidence can substitute for verification.

> **Model judgment is an interrupt, not a certificate.**
````

---

# B. Diff vs main — `contracts/Agentic Teams Autonomous Builder.md`

```diff
diff --git a/contracts/Agentic Teams Autonomous Builder.md b/contracts/Agentic Teams Autonomous Builder.md
index 4fdc0c6..9ebd738 100644
--- a/contracts/Agentic Teams Autonomous Builder.md	
+++ b/contracts/Agentic Teams Autonomous Builder.md	
@@ -62,12 +62,19 @@ So the team count is a function of the job, not a fixed roster.
 
 ## The lifecycle (fail-closed sequencing)
 
+*Amended by `contracts/Proposal Lifecycle.md`: candidate compilation and writing
+precede council review, and the council reviews the exact written plan hash.*
+
 ```
 idea + telos
-  → [planning] decompose() → tasks[] {id,writes,reads,requirements,test,workstream}
+  → [planning] decompose() / Daedalus negotiation → tasks[] {id,writes,reads,requirements,test,workstream}
   → compileAndHashPlan() → content-addressed plan (+ authorized_signers); writePlan()
-  → COUNCIL APPROVAL GATE: runCouncil → validateRecords      [MUST pass before execution]
-  → runBuild(): each ready node dispatched to its OWNING TEAM (team = worker)
+        the immutable candidate is on disk BEFORE any review
+  → COUNCIL REVIEW of the exact candidate plan hash (recomputed from the written
+        plan on disk): runCouncil → validateRecords
+  → proposal authorization gate                              [MUST pass before execution]
+  → runBuild(): re-verifies the written plan hash, then each ready node is
+        dispatched to its OWNING TEAM (team = worker)
         Rule 1 — the team sees only the node spec; it writes the node's files
   → Rule 3 defaultVerifyNode re-derives the artifact hash + runs node.test
   → [breakout] reverifyRecord on declarative checks for "meets"-class nodes
@@ -77,8 +84,23 @@ idea + telos
 ```
 
 The orchestrator (`build-gate/build-orchestrator.mjs`, `buildProject`) STOPS at the
-first failing phase and **never advances to execution unless the council approval
-gate passed**. The phases it reports: `situation | decompose | approval | plan | build`.
+first failing phase and **never advances to execution unless the proposal
+authorization gate passed** (council approval is a necessary input to that gate,
+never sufficient by itself). The target phase order is:
+
+```text
+situation | decompose | plan | approval | build
+```
+
+**Nonconformance note.** Earlier revisions of this contract were internally
+contradictory: the lifecycle above declared compile-before-approval while the
+phase list read `situation | decompose | approval | plan | build`. The code in
+`build-gate/build-orchestrator.mjs` currently implements the latter (council
+review before `compileAndHashPlan()`), which means the council does not yet
+review the exact plan hash it authorizes. That implementation is **temporarily
+nonconforming** with this contract and with `contracts/Proposal Lifecycle.md`;
+the reorder is a required implementation point of the proposal-lifecycle
+contract, not an optional cleanup.
 
 ## Situational awareness
 
```
