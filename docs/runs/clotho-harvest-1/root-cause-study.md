# Clotho Plan v11 — Harvest Root-Cause Study

**Question (The Eye, 2026-07-15):** are the confirmed defects one causal family,
and is the recall explosion a separate cause? Method: causally code the
confirmed findings, the adversarially-refuted findings, and a stratified sample
of the unverified pool; test two clustering hypotheses.

**Corpus:** harvest over plan v11 (`sha256:f5d9cd52…`) + spec v2.8, four finder
seats (claude/codex/grok/gemini) at high effort, 4 rounds, seeded with the four
accepted authz-004 hard stops. 389 findings harvested; adversarial cross-seat
verification reached 50 before the batch ended.

## Data actually coded

| Group | N | Source of disposition |
|---|---:|---|
| Confirmed real (harvest) | 3 | adversarial verifier, refuted=false |
| Refuted (harvest) | 47 | adversarial verifier, refuted=true |
| Authz-004 hard stops (seeds) | 4 | The Eye, accepted |
| **Unverified sample** | **0 of 39 attempted** | **verification 400'd — Anthropic credit exhausted mid-study** |

**Honest limitation:** the 30–50 stratified sample was selected deterministically
(content-addressed ordering, reproducible, across all four rounds) and dispatched,
but every call failed `invalid_request_error: credit balance too low` on the
Anthropic-verified strata. The sample's fresh dispositions are therefore
**not available**; the two hypotheses are tested on the 50 already-verified
findings + 7 confirmed. The unverified pool's base rate is characterized only by
the 50-item verified subset (below), not by a fresh independent draw. This gap is
a funding-exhaustion artifact, not a methodological choice, and should be closed
by re-running the sample when credit is restored.

## Hypothesis 1 — confirmed defects cluster under missing runtime-enforcement / missing negative-test

**Result: confirmed. 7/7 (100%).**

| Finding | Missing layer |
|---|---|
| authz-004 #1 (loader-evasion scanner gaps) | runtime-enforcement |
| authz-004 #2 (query API treats absent manifest as empty coverage) | runtime-enforcement |
| authz-004 #3 (no publication-time closure re-derivation) | runtime-enforcement |
| authz-004 #4 (no edge→producer attribution binding) | runtime-enforcement |
| h-15 (no trailer-tamper fixtures: dup/missing/extra/out-of-order weaver) | negative-test |
| h-20 (no Setext / thematic-break / fenced-`#` splitter fixtures) | negative-test |
| h-80 (no test for conflicting sequential human status transitions) | negative-test |

Every confirmed defect is a **claim-to-proof gap**: the normative claim exists;
the missing element is either the mechanism that would *enforce* it at runtime (4)
or the negative test that would make its violation *observable* (3). Not one
confirmed defect is a missing or contradictory rule — the plan's normative text
is coherent. The harvest found the shallower (test) edge of the same family the
council found at the deeper (enforcement) edge.

## Hypothesis 2 — refuted findings cluster under duplicate / already-covered / impossible / non-goal

**Result: confirmed. 47/47 (100%).**

| Disposition | N |
|---|---:|
| duplicate | 28 |
| already-covered (cites an existing decision/requirement/test) | 18 |
| impossible-premise | 1 |
| non-goal / stylistic | 0 |

No refuted finding was a real defect the verifier merely disliked; every one
collapsed onto an existing register entry, an existing plan mechanism, or a
premise that cannot occur. The verified base rate of *real* findings among
adversarially-judged harvest output is **3/50 = 6%**.

## The two causal stories, evidenced

**1. Confirmed defects = undischarged proof obligations.** One family. The
plan-generation process writes coherent rules but does not force every rule
through to an executable adversarial witness. The corrective is not "add seven
fixes" but a Daedalus protocol rule:

> **No normative sentence enters the candidate without a mapped enforcement site
> and a test that makes its failure observable.** Every normative guarantee ships
> a row: `claim → enforcing mechanism → bypass analysis → observable failure
> state → negative test → acceptance evidence`. A row missing any field is
> unfinished.

**2. Recall explosion = search-objective pathology, not product decay.** Fresh
findings per round were 62 → 79 → 71 → 177 — accelerating, never drying. A
1,920-line artifact decomposes indefinitely; "find something new" rewards ever
narrower reinterpretations; finders bear no materiality cost; nothing collapses
two phrasings of one concern. The 94% refutation rate (47/50) and the 62% of
refutations that were literal duplicates (28/47) are the fingerprint of
novelty-seeking without a materiality constraint — a property of the *method*,
not of plan v11.

## Disposition

- **The real payload is 7 findings** (4 runtime-enforcement + 3 negative-test),
  one root cause. Fold the 3 harvest survivors into the authz-004 repair delta
  at near-zero marginal cost.
- **Do not widen review further.** The evidence says wider yields duplicates and
  already-covered noise, not a hidden severe class. The judgment council remains
  the higher-precision instrument.
- **Adopt the proof-obligation matrix in Daedalus** so this family is closed at
  generation time, not discovered downstream council-by-council.
- **Re-run the stratified sample when Anthropic credit is restored** to close the
  documented gap and confirm the 6% base rate on an independent draw.
