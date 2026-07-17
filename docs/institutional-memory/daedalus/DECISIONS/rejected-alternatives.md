---
type: reference
topic/architecture: telos
status: living
note: Considered-and-rejected designs, including defects that were FOUND AND FIXED — preserved so a later model does not rediscover them as novel improvements. Several entries are verbatim from build-gate/daedalus.mjs comments recording the pre-fix behavior.
---

# Daedalus — rejected alternatives

- **Trusting a model-asserted `objection_hash`.** REJECTED (workshop rounds 7/8): a
  seat could forge an objection or its reference. Identity is always
  controller-recomputed; dispositions match against the recomputed key only.
- **Absence as an implicit disposition.** REJECTED: a candidate that simply stops
  mentioning an objection would "resolve" it. Only explicit validated
  resolution/supersession/withdrawal records change status; silence keeps it open.
- **Superset descent check.** REJECTED AS A FOUND DEFECT: the integration-parentage
  check originally accepted any superset of the two source refs, and the candidate
  ref committed to nothing — making descent vacuous. Now `descends_from` is written
  INSIDE the content-addressed candidate body and must be *precisely* the two source
  refs.
- **Non-affirmative verification verdicts.** REJECTED AS A FOUND DEFECT: anything
  other than the literal string `"violated"` (including undefined or an arbitrary
  token) previously fell through to convergence. Now the verdict set is closed
  (`preserved` | `violated`) and only an affirmative `preserved` can converge.
- **Unvalidated integrator provenance.** REJECTED AS A FOUND DEFECT: the integrator's
  provenance was stored but never validated, so a null/placeholder integrator could
  carry a candidate to convergence. Now it must be a real seat call with a real,
  distinct key.
- **Field-completeness as sufficient obligation coverage.** REJECTED: a matrix can
  have five non-blank fields per row yet silently omit or fabricate an obligation.
  Coverage is a strict bijection over the constraints-declared obligation id set.
- **A third surgical patch on a twice-failed subsystem.** REJECTED by methodology
  rule 3: two repair-induced findings in one subsystem trigger redesign from
  invariants, not another patch (the loader lineage is the precedent).
- **Silent downgrade from parallel to serial authorship.** REJECTED: a parallel
  request without an adapter blocks (`PARALLEL_AUTHORSHIP_UNAVAILABLE`) rather than
  quietly running the weaker loop.
