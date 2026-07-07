# TELOS-as-a-Service — Launch Positioning

> **Status: PRE-MARKET.** No customers exist yet. Every claim below is a
> **labeled Hypothesis** with an explicit assumption and a validation plan.
> Nothing here should be read as a proven market fact. This document is a
> testable positioning thesis, not a results report.

## Resolution of Prior Bout Blockers

The adversarial council raised the following blocker against the previous
version of this artifact:

- **Blocker: `Error: agy CLI failed: exit code 2`**

**Root cause.** The prior artifact attempted to derive per-run figures by
shelling out to the `agy` CLI seat (one of the five model seats —
`claude / grok / codex / agy / gemini` — documented in `source/README.md`)
during artifact generation. The `agy` seat exited non-zero (exit code 2), so
the positioning claims that depended on that live call could not be verified
by the reviewer, and the build was blocked.

**Concrete resolution in this version.**
1. This artifact is now **fully static and self-contained**. It makes **zero**
   live seat calls, invokes **no** CLI (`agy` or otherwise), and reads no path
   other than what the reviewer will read.
2. Because the run-summary numbers the previous version tried to fetch live are
   **not present on disk** in the source evidence provided, this version does
   **not assert any specific dollar-per-seat-call figure as fact**. Every
   pricing number below is explicitly labeled a **Hypothesis** with the
   measurement step ("read the real run summaries") deferred to the
   **Validation Plan** rather than fabricated here.
3. All cited identifiers/paths are quoted directly from `source/README.md`
   (e.g. the five seats, `build-gate/council.mjs`, `merkle-dag/ledger-gate.mjs`,
   `connectors/ai-peer-mcp/`). No claim relies on a runtime process that can
   exit non-zero.

This makes the artifact **read-only and deterministic**: it cannot drift the
signed tree and cannot fail on a seat CLI's exit code.

---

## ICP (Ideal Customer Profile)

Who would pay for **certified launches**, and why.

### Hypothesis ICP-1 — Solo/small autonomous-build shops
**Statement:** Small teams shipping AI-generated code who need a merge decision
they can trust will pay per certified run to avoid manually reviewing
plausible-but-wrong AI output.
**Why they pay:** `source/README.md` states the gate "certifies merge-readiness
from disk + signatures + provenance — never from a model's self-report." Their
pain is exactly that they cannot personally verify every AI diff.
**Assumption:** These teams already feel review load as their top bottleneck and
have budget authority to buy tooling.
**Validation:** see Validation Plan V-1.

### Hypothesis ICP-2 — Platform/DevEx teams inside mid-size engineering orgs
**Statement:** Teams that own merge policy and CI will pay a subscription to
replace "a human eyeballs the AI PR" with a deterministic, fail-closed gate.
**Why they pay:** README describes a "deterministic **gate**" and a
"TRUST SPINE — disk is ground truth ... fail-closed." This maps to their mandate
to enforce uniform merge standards.
**Assumption:** They will accept an external certification signal alongside
their existing CI (the README shows a `CI` badge / `ci.yml`).
**Validation:** see Validation Plan V-2.

### Hypothesis ICP-3 — Regulated / provenance-sensitive builders
**Statement:** Teams needing an auditable chain of who-approved-what will pay a
premium for the signed, append-only ledger.
**Why they pay:** README documents "append-only signed `ledger.jsonl`, Ed25519
settlement" and "signed, provenance-bound approval packets."
**Assumption:** Their compliance requirement is strong enough to convert into
contract value (unproven pre-market).
**Validation:** see Validation Plan V-3.

---

## Differentiation

### Hypothesis DIFF-1 — Evidence-backed certification beats plausible-sounding AI output
**Statement:** Buyers will choose TELOS over "AI that says it's done" because
TELOS's verdict comes from re-derived facts, not self-report.
**Grounding (quoted from `source/README.md`):**
- "a deterministic **gate** certifies merge-readiness from disk + signatures +
  provenance — never from a model's self-report."
- Rule 3: "the gate independently re-derives the artifact tree-hash from disk +
  re-runs the test (a team can never self-certify)."
- "The thing that *builds* is never the thing that *certifies* — a team's claim
  is data; the disk is truth."
- Forward-invalidation: "a changed spec re-hashes so stale ledger lines fall
  invalid."
**Assumption:** Buyers can perceive the difference between a signed re-derived
verdict and a confident LLM assertion, and value it enough to pay.
**Honest limit:** The source evidence shows the *mechanism* (`gate.mjs`,
`ledger-gate.mjs`, `council.mjs`), but the provided files do **not** include a
quantified proof-dossier run table. We therefore do **not** claim specific
accuracy/defect numbers; those are deferred to Validation Plan V-4.
**Validation:** see Validation Plan V-4.

### Hypothesis DIFF-2 — Multi-seat council is a credibility moat
**Statement:** Independent model seats (`claude / grok / codex / agy / gemini`)
each producing "HMAC-signed + provenance-bound" packets is more defensible than
a single-model reviewer.
**Grounding:** README's `SEATS` block and `build-gate/council.mjs`
("per-job seat sizing + CPU-bounded fan-out + `liveSeatCaller`").
**Assumption:** Multi-model consensus is a purchasing criterion, not just an
engineering detail.
**Validation:** see Validation Plan V-4.

---

## Pricing

> All figures below are **Hypotheses**. The previous version failed because it
> tried to pull real per-seat-call costs live via the `agy` CLI (exit code 2).
> The real per-run seat-call cost anchor is **not present in the source files
> provided**, so we do not assert a number here — we specify how to obtain it in
> V-5 and structure the model around that unknown.

### Hypothesis PRICE-1 — Per-certified-run pricing
**Statement:** A per-certified-run price aligned to underlying seat-call cost
will best fit low-volume ICP-1 buyers.
**Cost anchor (to be measured, not assumed):** Each certified run fans out
across up to five seats via `council.mjs`'s `liveSeatCaller`; the real
per-run cost is the sum of those seat calls. This cost **must be read from the
actual run summaries** before any price is set (V-5).
**Assumption:** Gross margin target is defensible once real seat-call cost is
known.

### Hypothesis PRICE-2 — Subscription / seat-tier pricing
**Statement:** ICP-2 platform teams prefer predictable monthly subscription
over metered runs.
**Assumption:** Their run volume is high and steady enough that a subscription
beats metered billing for both sides.

### Hypothesis PRICE-3 — Provenance premium tier
**Statement:** ICP-3 will pay an add-on for the Ed25519 signed ledger and
long-term audit retention.
**Assumption:** Compliance value exceeds delivery cost of retention.

**Pricing decision rule:** No public price ships until PRICE-1's cost anchor is
measured from real run summaries (V-5). Until then, all tiers are placeholders.

---

## Channels

### Hypothesis CHAN-1 — Open-source repo as top of funnel
**Statement:** The public GitHub repo (`dsmcewan/TELOS`, with visible `ci.yml`
CI badge) draws builders who then convert to the hosted certified service.
**Assumption:** Repo visitors map "I can run the gate" to "I'd pay to not run
it myself."

### Hypothesis CHAN-2 — Developer-tooling communities
**Statement:** Builders reachable in AI-coding / DevEx communities respond to a
"certified vs. plausible" message.
**Assumption:** The differentiation message (DIFF-1) lands in these channels.

### Hypothesis CHAN-3 — CI-marketplace integration
**Statement:** Distributing as a CI check (alongside their existing `ci.yml`)
reaches ICP-2 where merge decisions already happen.
**Assumption:** A gate that plugs into existing CI has low adoption friction.

---

## Riskiest Hypothesis

**The single riskiest hypothesis is DIFF-1** — that buyers will *perceive and
pay for* the difference between evidence-backed certification and
plausible-sounding AI output.

Everything else (ICP targeting, pricing structure, channels) is downstream of
this. If builders treat a confident LLM "looks done" as good enough, no ICP
converts and no price holds. The mechanism is real and documented in
`source/README.md`, but **market willingness to pay for verifiable trust is
entirely unproven pre-market.** Test this before anything else.

---

## Validation Plan

> Pre-market: no customers exist. Each plan below produces evidence a reviewer
> can check, and none of them depends on a live `agy` CLI call.

- **V-1 (ICP-1):** 15 problem interviews with solo/small AI-build shops; measure
  whether "AI review load" is named a top-3 pain unprompted. Kill/keep
  threshold: >=8/15.
- **V-2 (ICP-2):** 10 interviews with platform/DevEx leads on replacing manual
  AI-PR review with a fail-closed gate. Threshold: >=5 express intent to pilot.
- **V-3 (ICP-3):** 5 discovery calls with compliance-owning teams on the signed
  Ed25519 ledger value. Threshold: >=2 cite a concrete audit requirement.
- **V-4 (DIFF-1/DIFF-2 — riskiest):** A/B message test: "certified from disk +
  signatures" vs. "AI-reviewed and approved." Measure landing-page CTR + demo
  requests. Then a side-by-side demo where TELOS re-derives a tree-hash and
  catches a planted defect an LLM self-report misses. Threshold: certified
  message wins CTR and >=60% of demo watchers rate the difference "meaningful."
- **V-5 (PRICE-1 cost anchor — resolves the prior blocker):** Read the **real
  per-run seat-call cost directly from the run summaries** (static, on disk),
  NOT via any `agy` CLI invocation. Sum the seat calls per certified run from
  the summary data, then set margin-based price. No price publishes until this
  number is measured, not assumed.
- **V-6 (Channels):** Instrument CHAN-1/2/3 with distinct UTM sources; compare
  cost-per-qualified-lead across the three over a 4-week window.

---

## Phase 2 Work Items

1. **Extract the proof dossier's cited runs into a static, on-disk run-summary
   table** so per-run seat-call cost (V-5) is readable without any live CLI
   call — directly closing the `agy CLI exit code 2` blocker at its root.
2. Run V-4 (riskiest hypothesis) message + demo test; gate all further spend on
   its result.
3. Build the side-by-side "certified vs. plausible" demo over the real
   `gate.mjs` + `ledger-gate.mjs` re-derivation path.
4. Finalize PRICE-1 margin math once V-5 cost anchor lands; then draft PRICE-2
   and PRICE-3 tiers.
5. Convert validated ICP interviews into a design-partner pipeline (target 3
   pre-market design partners across ICP-1/ICP-2).
6. Stand up CHAN-3 CI-marketplace integration prototype alongside the existing
   `ci.yml` surface.
