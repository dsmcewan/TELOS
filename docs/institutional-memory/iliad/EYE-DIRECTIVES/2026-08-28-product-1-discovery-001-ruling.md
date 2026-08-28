# Eye ruling — DISCOVERY-001: S3 SUSPENDED; bounded Daedalus amendment required (two-phase pivot)

**Recorded:** 2026-08-28. **Status:** RECORDED EYE RULING. Governs the product-1
quest.

## Ruling

**Option 3 is the required governance path, with Option 1 as the required
substance of the amendment.** DISCOVERY-001 establishes the authorized plan's
bootstrap transition is internally unsatisfiable as written (active-plan pivot at
the bootstrap head vs no-woven-input rule vs pre-existing verify-contracts
green). Option 2 is REJECTED: it would allow a woven-input authority change
before the discriminating freshness verifier exists, violating the plan's own
security reasoning.

**S3 IMPLEMENTATION GRANT SUSPENDED.** No further Argo implementation, slice
review, merge, CURRENT-AUTHORITY mutation, or implementation-authority update
may occur under plan_ref
`sha256:bb2ea18f2a53885cb60b45d8a54c8d25e47a5b9e93c7c091a5948903b1bcf7a6`.

**Immutable lineage:** the S2 authorization (runs 3/4/5), the S3 grant artifact,
the stopped bootstrap slice branch (`quest/product-1-slice-bootstrap` at the
DISCOVERY-001 evidence commit 73543b1), the dry-run evidence, and DISCOVERY-001
itself are preserved unchanged — never rewritten or deleted.

## Required amendment substance (two-phase pivot)

**PHASE A — GOVERNANCE BOOTSTRAP:** (1) land the successor-plan and governance
records creatable without touching woven inputs; (2) stage AM-43 in its
authorized non-woven location; (3) record the AM-42 regularization/deviation
linkage; (4) register the product-1 plan+authorization as a QUEST-CLASS chain
entry (Lachesis/Atropos precedent); (5) mark the transition explicitly
ACTIVATION-DEFERRED; (6) do NOT change CURRENT-AUTHORITY.active_plan or
active_authorization; (7) do NOT edit any woven input; (8) the existing
verify-contracts battery remains fully green; (9) define a CLOSED,
CONTENT-ADDRESSED WHITELIST of the exact pre-activation slices permitted to
proceed — no unlisted slice is merge-eligible, and no release, settlement, or
production-readiness claim before activation.

**PHASE B — ATOMIC ACTIVATION** (in the excluded-dirs implementation slice,
after the current-head discriminating freshness verifier has landed), atomically:
(1) canonicalize AM-43 into its woven institutional-memory location; (2) update
every woven comprehension/query artifact whose governing_authority must match
the active plan; (3) same-PR re-weave against the current checkout using the
newly landed discriminating verifier; (4) update
CURRENT-AUTHORITY.active_plan/active_authorization to the newly authorized
amended plan; (5) record supersession + activation of the deferred quest
authorization; (6) re-derive and verify the complete authority, comprehension,
weave, and contract state from disk; (7) fail closed on any partial update,
stale input, mismatched plan_ref, incomplete woven closure, or failed
verification.

**The amended plan must state explicitly:** v15/authz-008 remains the active
repository authority until Phase B completes; the activation-deferred quest
authorization permits ONLY the enumerated pre-activation slices needed to reach
Phase B; it grants NO release/production authority and NO authority over
unrelated work; per-slice Eye acceptance remains mandatory; any Phase B failure
leaves the old active authority intact and the quest blocked; the six resolved
Eye rulings remain unchanged and must not be re-asked.

**Reconciliation obligation:** every contradictory plan passage — the four-step
bootstrap transaction including the pivot; "no later slice merge-eligible before
that pivot"; the slice-order description; the existing activation-alongside-
re-weave reference; all affected acceptance criteria and verifier expectations.

**Process:** bounded amendment (no unrelated scope). Daedalus reviews the
amendment and its authority/slice-order consequences, freezes a new complete
plan + plan_ref; TELOS authorizes that exact amended plan; the Eye issues a NEW
S3 grant before Argo resumes. Amendment on a separate branch; after
authorization, a FRESH or rebased bootstrap slice under the new authority — the
old one is not silently continued.
