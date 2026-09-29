---
title: "Multi-Seat Research — strict verification and bounded adaptive research (design)"
author: claude-code
date: 2026-09-24
type: spec
status: candidate (named, not authorized)
source: "Codex plan — Better Researcher: strict verification and bounded adaptive research"
tags:
  - topic/research
  - workflow/build-gate
  - workflow/council
---

# Multi-Seat Research — strict verification and bounded adaptive research (design)

> **Status: candidate design.** This document adapts the Codex plan *Better
> Researcher* to the TELOS multi-model council. It is Daedalus input, not an
> authorization: it routes through CHANGE-PROTOCOL (Daedalus maturation → TELOS
> authorization → The Eye) before any implementation, and `CURRENT-AUTHORITY.json`
> is unaffected by it. Spec → plan → build; this is the spec.

## Problem

The Codex plan describes a research pipeline with anonymous *workers*, *reviewers*,
*gap evaluators* and *writers*, a Python HTTPX transport, a dedicated Google GenAI
adapter, and automatic promotion of a winning configuration. TELOS already has the
pieces that plan reinvents, under stricter rules: model **seats** with real
provenance (`connectors/ai-peer-mcp/`, plugin seat servers, `breakout/seat_router.mjs`),
per-seat HMAC packet signing (`build-gate/sign.mjs`), a CPU-bounded council fan-out
(`build-gate/council.mjs`), verdict-on-facts (`breakout/verifier.mjs`), closed check
registries (`build-gate/check-registry.mjs`, `build-gate/evidence.mjs`), and a signed,
hash-chained ledger discipline (`merkle-dag/proposal-ledger.mjs`).

Goal: the same workflow — evidence → claims → independent audit → bounded adaptive
follow-up → freeze → synthesis → validation — run **by the council seats**, with every
enforcement identity a controller-derived content address, every seat output a
signed, provenance-bound packet, and a deterministic research gate that reconstructs
report eligibility from the ledger and never from a seat's self-report.

## Key insight

A research seat is a council seat with a different packet schema. Extraction,
audit, gap analysis and synthesis are all "one seat, one bounded call, one signed
packet" — exactly what `runSeat` in `council.mjs` already does. The only genuinely
new machinery is (1) the evidence broker (capture + canonical text + quotation
integrity), (2) the research ledger and the pure eligibility function over it, and
(3) the accounting reservation that gates every dispatch. Everything a model *says*
is data; the disk (captures, hashes, ledger) is truth.

Two TELOS rules the source plan did not have, and which change its shape:

- **The originating-seat rule.** No claim is audited by the seat that extracted it.
  The controller enforces this on **packet provenance** (`provenance.model` of the
  real API response), never on a role label.
- **Convergence is not authorization.** "Qualified" is a computed recommendation.
  Activating a research route as a default is a self-improving change and requires
  The Eye (`docs/convergence-is-not-authorization.md`, `docs/mythological-vocabulary.md`).
  The source plan's "automatic promotion" becomes "automatic *qualification*, human
  *activation*".

## 1. Operating defaults (carried over, restated for seats)

| Setting | Default |
|---|---|
| Initial workload | SDK, documentation and repository research |
| Per-report limits | **$5 and 10 minutes** (outer monotonic deadline) |
| Initial validation campaign | **$25 total**, including transport canaries and external evaluation |
| Concurrency | Three seat calls in flight, further clamped by `maxConcurrency` (`min(requested, cores − 2)`) |
| Additional ceilings | 48 seat calls; six million aggregate tokens per report |
| Conclusions | Verified facts and labeled inferences presented separately |
| Optimization | Meet the quality floor, then minimize cost |
| Promotion | Automatic qualification; activation by The Eye, scoped to task class + configuration hash |

All limits apply together. A diminishing-returns trigger records low observed
progress under the current strategy; it never asserts that information is unknowable.

## 2. Seat assignment (from `build-gate/seats.json`, no new seats)

| Stage | Seat | Role in this workflow | Why (durable strength) | Gate standing |
|---|---|---|---|---|
| Extraction (gather → EvidenceNode → ClaimNode) | **claude** (lead), **codex** (second extractor) | Turn broker captures into claims with exact quotation offsets | claude: careful structured reasoning; codex: strict structured output | claude required |
| Audit (independent review) | **codex** (lead reviewer), **gemini** (second reviewer, advisory) | Re-open captures, check premises/quotations/support, emit `AuditResult` | codex: `integrity` preferred role; gemini: "re-derive, don't trust", large context | codex required; gemini advisory (missing key never blocks) |
| Progress assessment + accounting attestation | **agy** | Deterministic: diminishing-returns metrics, reservation reconciliation, capability-token revocation record | Computed, not generated; content-addressed provenance | required |
| Gap evaluation (searchless) | **claude** | Compare rubric vs eligible graph + failed-search history; propose pivots + allowances | planning strength; receives **no** retrieval capability | advisory to the coordinator |
| Bounded follow-up seats | proxy analyst → **claude**; lexicon translator → **codex**; falsifier → **grok** | At most two searches each, all through the broker | grok: contrarian, live-landscape adversary | advisory; findings re-enter audit |
| Synthesis (writer) | **claude** | Renders the frozen eligible graph into the report | writing; sees only the frozen graph | required |
| Deterministic fallback | none (zero model tokens) | Renders facts / inferences / gaps / termination from the eligible graph | cannot hallucinate | always available |

Rules that follow from the table:

- Required seats remain exactly `claude`, `agy`, `codex` (unchanged
  `REQUIRED_SEATS`). `grok` and `gemini` are advisory here as everywhere; an
  advisory packet counts when present, valid and signed, and never blocks when absent.
- **Extractor ≠ auditor per claim.** The controller pairs each ClaimNode with an
  auditor whose packet provenance model differs from the extractor's. A claim whose
  only available auditor is its extractor stays `UNRESOLVED`.
- The grok falsifier's live-search strength is used for **discovery only**
  (`breakout/live.mjs` idiom: council discovers, verifier decides). A URL it
  surfaces becomes evidence only after the broker captures it; provider-native
  search results are never admitted as EvidenceNodes.
- Effort tiers per stage role, not per model, via `effortForRole` (extraction:
  low/medium pilot hypothesis; audit and gap analysis: medium; overridable with
  `TELOS_EFFORT_<ROLE>`).

## 3. Contracts, evidence and execution boundaries

### Immutable, content-addressed records

Versioned, deeply frozen records; constructors and deserializers validate schema,
canonical serialization (`merkle-dag/vendor.mjs` `canonicalize`), hashes and
referenced content. Every identity is `H(...) = "sha256:" + sha256hex(canonicalize(body))`,
derived by the controller — a seat may propose a record, never its id.

- **EvidenceNode** — source URI, capture timestamp, `raw_ref` (hash of original
  bytes), `canonical_ref` (hash of canonical UTF-8 text + extractor version),
  extractor version, quotation with half-open byte offsets **into the canonical
  text only**, research "as of" time. Captured bytes live under `.telos/research/captures/<raw_ref>`
  (git-ignored runtime artifacts).
- **ClaimNode** — assertion, rubric reference, `fact | inference` classification,
  evidence refs, required premises (claim refs), assumptions, extractor packet ref.
- **AuditResult** — claim ref (by content address, so a revised claim is a new
  claim), evidence examined, deterministic check results, verdict, explanation,
  auditor packet ref.
- **ResearchGap** — missing rubric concept, failure diagnosis, 3–5 semantic pivots,
  proposed allowance.
- **ResearchRunSpec / ResearchRunResult** — limits, seat assignments, verified
  findings, remaining gaps, accounting, termination reason (closed set).
- **TreatmentManifest** — exact seat roster, backend routes (from
  `seat-registry.mjs`), model ids, effort tiers, loadout servers, corpus and
  evaluator versions; its hash is the treatment identity.

Graph admission rejects dangling references and premise cycles. Revisions create
new records; existing records are never mutated. Hashes establish integrity;
semantic support is a separately audited judgment.

### Quotation integrity and dual pointers

Two pointers per evidence node: original bytes (`raw_ref`) and the versioned
canonical text (`canonical_ref`). Offsets are half-open byte ranges within the
canonical text identified by its hash; the broker validates UTF-8 boundaries and
exact substring equality at admission and the auditor re-validates from the
capture. Offsets are never applied to raw bytes or to another extractor version.
HTML normalization, charset decoding and code extraction belong to a pinned
canonicalization module; re-extraction creates a new EvidenceNode. Initial formats:
text, Markdown, code, HTML; anything else yields an explicit limitation record.

### Closed research check registry

Mirrors `check-registry.mjs`: a frozen `RESEARCH_CHECK_KINDS` set, each kind with a
params whitelist, `FORBIDDEN_PARAM_KEYS` rejected before any filesystem activity,
and a vetted template per kind. Initial kinds:

`capture-present` · `raw-hash-matches` · `canonical-hash-matches` ·
`quotation-in-canonical` · `offsets-utf8-valid` · `premises-eligible` ·
`extractor-auditor-distinct`

These are the **facts**. A verdict of `SUPPORTED` requires every deterministic check
for the claim to pass **and** the required auditor packet to say supported. A failing
check cannot be argued past by any seat (`verifier.mjs` rule: no rhetoric moves a
passing or failing check).

### Independent review and sanitized projection

Auditor seats run in fresh contexts on a restricted projection of task, claim and
evidence. Excluded from the projection: the extracting seat's identity and private
reasoning, proposed verdicts, search queries, ranking metadata, strategy labels,
fetch ordering, sequence numbers and precise acquisition timing. Preserved:
source content, publication/version dates, meaningful URI parameters, the common
"as of" time. The controller keeps the excluded metadata in the ledger (it needs the
extractor identity for the distinct-seat check). Auditors open captures through
opaque broker handles and may request alternative or fresh captures through their
own bounded capability.

The audit verdict set is frozen: `SUPPORTED | CONTRADICTED | UNRESOLVED | FALSE_PREMISE`.
Inferences require supported premises, explicit assumptions and reviewed reasoning,
and remain labeled inferences after `SUPPORTED`.

### Reactive dependency invalidation (pure function over the ledger)

Premise dependencies form a DAG. Withdrawal of support appends a superseding audit;
the controller then, in one ledger transaction, traverses dependents in topological
order, marks them ineligible with reason `UNSUPPORTED_PREMISE` (an eligibility
state, not a fifth verdict), advances the graph revision and invalidates synthesis
snapshots bound to earlier revisions. Restoring a premise does not restore
descendants. Eligibility is computed by a pure function `eligibleGraph(ledger)`
(the `ledger-gate.mjs` `done()` shape) — publication re-runs it and checks the
revision atomically, so a draft built on withdrawn support cannot be released.

### Enforced capabilities (closed set, token-revoked per stage)

All retrieval, capture access and delegation pass through the broker; a seat call
carries a capability token from the closed set `search | read-capture | fetch-fresh | none`.

| Seat stage | Capabilities |
|---|---|
| Extraction | `search`, `read-capture` (bounded counts) |
| Audit | `read-capture`, `fetch-fresh` (independent evidence access) |
| Gap evaluation | `none` |
| Follow-up seats | `search` (≤ 2), `read-capture` |
| Synthesis | `none` — receives only the frozen eligible graph |

Provider-native search, ambient filesystem tools and recursive spawning stay
disabled in the seat prompts and are structurally absent from the router. Stage
transitions revoke tokens; a late packet bearing a revoked token is recorded and
discarded (it cannot publish into a later generation). Loadout servers for
documentation retrieval (for example Context7 via `withLoadout`) are reached through
the namespaced `name:tool` form and can never shadow a seat route.

## 4. Coordinator, accounting and transport

### Packets and the research gate

Each seat call returns `{ packet, provenance }`; the controller stamps provenance
from the real response, injects the trusted bindings (`run_ref`, `stage`,
`input_hash`, capability token ref) **before** signing, and HMAC-signs with
`TELOS_SECRET_<SEAT>` (`sign.mjs`). Under `trust_mode: "signed"` the research gate
blocks on a missing secret, a bad signature, or honest-null provenance for a
required seat, exactly as `gate.mjs` does. The gate reconstructs run state from the
ledger; a caller-supplied graph is never trusted.

### Shared reservations and deadlines

One durable, authoritative accounting ledger (append-only, hash-chained, signed by
the research controller's Ed25519 key — `TELOS_PROPOSAL_CONTROLLER_SK` when set,
otherwise an ephemeral per-run key, the proposal-lifecycle idiom). Reservations are
atomic across seats and across the validation campaign. Extraction admission is
paired with an audit allowance, and finalization reserves are protected before any
dispatch. Planning, extraction, audit, deduplication, tools, retries and synthesis
are all accounted.

Transport defaults (Node `fetch` with `AbortSignal.timeout`, plus an outer
monotonic deadline from `performance.now()`):

| Boundary | Default |
|---|---|
| Connection establishment / request write | 10 s each |
| Complete generation attempt | 60 s baseline, shortened to remaining stage/run time; raised only by an explicit per-stage allowance for high-effort seats |
| Automatic retries | Disabled |

The existing long-generation path (`AI_PEER_LONG_TIMEOUT=1`, default 30 min) is
**not** used for research seats; the per-call timeout is passed explicitly and
derived from the reservation. No blanket short read timeout is imposed on silent
model reasoning — the outer deadline is the limit.

On timeout or cancellation the controller fences publication, ends local
execution, releases process/socket capacity, and **retains** the monetary and
remote-concurrency exposure as quarantined until trustworthy accounting (usage in
the response body) or proof the request was never sent. Quarantined exposure counts
against the original limits. Transport failures invalidate the affected
diminishing-returns observation window; their time and cost still count; the run
terminates with an operational or accounting reason, never "research exhausted".

### Strict metered admission per seat

Before forwarding a call the router-side broker validates the serialized request
against its reservation: seat, backend route, model id, request digest, and the
combined output-plus-thinking ceiling. Admission requires a known bound; a backend
with unknown bounds is not dispatched (fail closed). Provider facts to pin by test
with a mocked `fetch` (the `test-structured-requests.mjs` idiom): Anthropic
`max_tokens`; OpenAI-compatible `max_completion_tokens`; Gemini `maxOutputTokens`,
which Google documents as covering thinking plus visible output. Initially reserve
against each backend's documented full input ceiling; tighten only after a complete
input-accounting contract exists. Codex-subscription experiments keep separate
accounting and a separate treatment identity.

### Bounded state machine

```
intake → extraction ⇄ audit → progress assessment (agy)
       → [gap evaluation (claude, no retrieval)] → [follow-up seats] → re-audit
       → freeze → synthesis (claude) → report validation (gate) | deterministic fallback
```

- At most three initial extraction cycles; one revision per rejected claim lineage.
- One gap/follow-up phase; no recursive restart.
- Up to three follow-up seats, two broker searches each; every finding re-enters audit.
- The gap evaluator proposes; the coordinator grants only micro-budgets affordable
  after audit and finalization reserves are protected.
- Termination reasons are a closed set: `complete | diminishing-returns | hard-limit |
  operational | accounting | integrity-failure`.

### Diminishing-returns trigger (computed by agy)

Inputs: supported additions, retractions, rubric resolutions, duplicate sources,
rejection outcomes, per-cycle cost. Trigger after two healthy cycles with no new
supported finding or rubric resolution; or saturation above 80% (≥ 10 search
results in the window), rejection ≥ 75% (≥ 8 audited claim clusters), or cost per
finding above the primary-phase allowance divided by essential rubric units, when
essential coverage is not advancing. Deduplicate by proposition (entity, relation,
scope, version/date, polarity); ambiguous duplicates earn no novelty credit;
material corrections and resolved contradictions reset the streak. The trigger
moves to affordable gap analysis; hard limits move directly to finalization.

### Deterministic fallback

A zero-model renderer over `eligibleGraph(ledger)` producing verified facts with
immutable citations, labeled eligible inferences, unanswered rubric items, and
termination/accounting status. It adds no assertions; with no eligible findings it
says none were verified; on graph-integrity failure it emits an integrity-failure
result and no findings.

## 5. External evaluation and routing

Frozen technical-research tasks cover direct lookup, version conflicts, false
premises, missing evidence, misleading quotations and obscured sources. Under
matched runtime conditions, compare: (1) single-seat search-and-summarize,
(2) specialist instructions, (3) structured extraction + independent audit,
(4) the same with the diminishing-returns trigger, (5) gap-directed follow-up,
(6) the full follow-up roster; plus an equal-seat, equal-budget generic control.
Heterogeneous seat assignments are evaluated as separate treatments.

Grading keys are never mounted into any seat's projection. Scoring seats are chosen
by **provenance exclusion**: a scorer's packet provenance model must not appear in
the treatment's run ledger, and the scorer is blind to treatment identity and
budget metadata. Disagreements are retained; unresolved material disputes prevent
qualification.

Qualification (computed, recorded, signed by the controller):

- one-sided 95% lower confidence bound on report acceptance ≥ 90%;
- zero fabricated citations or material false-premise endorsements;
- 95% upper bound on critical errors ≤ 5%;
- quality noninferiority within 2 percentage points of the qualified reference;
- ≥ 10% lower cost per accepted report under paired uncertainty analysis;
- isolation, budget, provenance and task-class gates passed.

Runs are clustered by question; failed attempts count toward cost and performance;
the candidate is frozen (TreatmentManifest hash) before fresh holdout evaluation.
Qualification binds to the exact configuration hash and tested task classes; drift
or an enforcement failure deactivates the route automatically (deactivation is
fail-closed and needs no human). **Activation** of a qualified route is an Eye
decision recorded against the manifest hash. Insufficient evidence yields
`unqualified`, never a promotion.

## 6. Placement and modules

A new zero-dependency package, `research/` (Node ≥ 22.12, ESM, `node:` imports plus
reviewed cross-package relative imports — the existing `build-gate/` → `breakout/`
pattern). Registered in `repository-manifest.json` and the CI package matrix.
Distinct from `saas-forge/research.mjs` (market stack research; not touched).

| File | Responsibility |
|---|---|
| `research/records.mjs` | Frozen record constructors, schema validation, content addresses, graph admission (no dangling refs, no cycles) |
| `research/canonical.mjs` | Pinned canonicalization pipeline (text/Markdown/code/HTML), extractor version, offset + UTF-8 validation |
| `research/broker.mjs` | Capture store under `.telos/research/`, capability tokens, bounded search/read/fetch, sanitized auditor projection |
| `research/check-registry.mjs` | Closed `RESEARCH_CHECK_KINDS` + param whitelists + vetted templates |
| `research/ledger.mjs` | Append-only signed research/accounting ledger (reuses `merkle-dag/proposal-ledger.mjs` primitives) |
| `research/eligibility.mjs` | Pure `eligibleGraph(ledger)`: verdicts + `UNSUPPORTED_PREMISE` propagation + revision |
| `research/accounting.mjs` | Reservations, quarantine, reconciliation, termination reasons |
| `research/seats.mjs` | Stage → seat roster from `build-gate/seats.json`; distinct-seat pairing; effort tiers |
| `research/transport.mjs` | Metered admission (request digest, token ceilings), deadlines, no-retry policy over `breakout/seat_router.mjs` |
| `research/orchestrator.mjs` | The bounded state machine over `runCouncil`-style fan-out |
| `research/gate.mjs` | Research gate: signatures, provenance, ledger reconstruction, publication check |
| `research/render.mjs` | Deterministic fallback renderer |
| `research/eval/` | Frozen tasks, blinded scoring by provenance exclusion, qualification computation |
| `research/scripts/test-*.mjs` | Keyless acceptance tests below |

Reused unchanged: `build-gate/sign.mjs`, `build-gate/seats.json`, `build-gate/model-profiles.mjs`,
`build-gate/seat-registry.mjs`, `breakout/seat_router.mjs`, `breakout/mcp_client.mjs`,
`merkle-dag/vendor.mjs`, `merkle-dag/proposal-ledger.mjs`.

## 7. Implementation sequence and acceptance tests

### Phase 1 — Contracts, fallback, transport boundaries

1. Frozen records + content addresses + graph admission, validated at construction and reload.
2. Deterministic fallback rendering from every valid intermediate ledger state, zero model calls.
3. Metered admission + deadlines + capability tokens + reservations over the seat router.
4. Lifecycle controls: cancellation, quarantined exposure, reconciliation, publication fencing.

### Phase 2 — Research workflow

Seat-assigned extraction/audit with distinct-seat pairing, sanitized projections,
reactive invalidation, diminishing-returns trigger (agy), gap evaluation, bounded
follow-up seats, research gate and report validation.

### Phase 3 — Evaluation and routing

Blinded scoring by provenance exclusion, controlled comparisons, holdout
qualification, manifest-hash-scoped qualification records, automatic deactivation,
Eye-gated activation.

### Required acceptance tests (all keyless, under `research/scripts/`)

- Canonical offsets with multibyte characters, charset conversion, HTML normalization, changed extractor version.
- Hash mismatch, mutated nested record, dangling reference, premise cycle → rejected at admission.
- **Same-seat audit rejected**: extractor and auditor packets with the same provenance model → claim stays `UNRESOLVED`.
- **Unsigned, mis-signed, or honest-null-provenance required packet → gate blocked**; advisory seat absent → not blocked.
- Auditor-projection leakage through queries, ranking, timestamps, identifiers, filenames, extractor identity.
- Retraction propagation through chains and diamonds; concurrent synthesis/publication race → stale revision refused.
- Fabricated quotations, cherry-picking, wrong versions, false premises, unsupported proxy conclusions → never `SUPPORTED`.
- **Discovery-only URLs**: a grok-surfaced source with no broker capture is not admitted as evidence.
- Duplicate paraphrases and meaningful corrections affecting the trigger.
- Connection failure, partial write, silent reasoning, streaming past deadline, ambiguous cancellation → quarantine, correct termination reason.
- Late packet with revoked token, duplicate settlement, unsafe refund, remote concurrency above admission.
- Loadout server attempting to shadow a seat route → registry wins; param smuggling (`cmd`, `script`, …) → rejected pre-filesystem.
- Fallback before any verified claim, after retraction, at budget exhaustion, at deadline.
- Insufficient holdout evidence, failed quality gate, configuration drift → `unqualified` / deactivated; **qualified route without an Eye activation record → not active**.

Offline tests first; then bounded transport canaries and the staged pilot within
**$25 total**. Implementation completion requires a functioning pipeline and
inspectable evidence under `docs/runs/multi-seat-research/`; activation additionally
requires the qualification gates and The Eye.

## Delta from the source plan

| Source plan | This design | Reason |
|---|---|---|
| Anonymous workers / reviewers / writers | Named council seats from `seats.json`; required set unchanged | Provenance-bound identity is the trust floor |
| Reviewer "fresh context" | Fresh context **and** distinct provenance model per claim | Originating-seat rule; a seat never certifies its own claim |
| Python HTTPX + dedicated Google GenAI adapter | Node `fetch` + `AbortSignal.timeout` over the existing seat router and plugin servers; per-backend ceilings pinned by mocked-fetch tests | Zero-dependency ESM packages; backends already exist |
| Provider-native search disabled | Same, plus grok's live search allowed for discovery only | Keeps grok's strength without admitting uncaptured evidence |
| Verdict = reviewer judgment | Verdict = deterministic checks **and** signed auditor packet | Verdict-on-facts (`verifier.mjs`) |
| Broker-maintained state | Pure `eligibleGraph(ledger)` recomputed at publication | Gate reconstructs state; never trusts caller state |
| Automatic promotion | Automatic qualification and deactivation; activation by The Eye | Self-improving changes are non-delegable |
| Generic "check" verbs | Closed `RESEARCH_CHECK_KINDS` registry with param whitelists | Closed sets over open assertions |

## Honest limits

- The research controller, broker and accounting ledger are **one trust principal**
  (same limit as the proposal lifecycle); a holder of every `TELOS_SECRET_*` can
  still forge packets — signing is an integrity floor, not non-repudiation.
- Semantic support is a seat judgment; hashes and checks bound what it can assert
  but do not prove it.
- Gemini's honest-null response id is safe only because gemini stays advisory.
- Live-key runs, human-adjudication UX, cross-process durable resume, and Clotho
  weaving of the research graph are out of scope for this design.

## Non-claims

- Introduces no mythological term; stage names are plain descriptive language.
- Does not modify `gate.mjs`, `sign.mjs`, `council.mjs`, `merkle-dag/`, or any contract.
- Does not authorize implementation; `CURRENT-AUTHORITY.json` governs.
