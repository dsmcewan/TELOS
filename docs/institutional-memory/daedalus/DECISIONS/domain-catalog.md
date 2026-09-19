---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Closes Daedalus v2 Surface B's domain-id catalog and Surface C's must_not_weaken enum. Machine anchor — docs/runs/item-8-domain-catalog-ruling-packet.md (adversarially reviewed and reverified 2026-07-22).
---

# Decision: item 8 — domain-id catalog (Surface B) and must_not_weaken enum (Surface C)

**What.** Surface B: the eleven `production[].domain` ids are minted now, directly from the
Production Profile Compiler (PPC) design doc's own already-named eleven domains, plus seven
`governance-runtime:*` suffixes taken from the seven governance-runtime bullets already listed in
the v2 design doc. § Relation to Production Profile Compiler gains one sentence stating that once
PPC compiles and exports its own registry, that registry supersedes this list via a one-time,
hash-cited migration — not a standing parallel source of truth. Surface C: `must_not_weaken` is
closed to fourteen tokens — one per numbered invariant 0-11 (`GOVERNANCE_FIRST`, `FRICTION`,
`SEAT5_NEUTRAL`, `HASH_IS_LAW`, `HASH_ACTION_AND_WHY`, `HASHES_ARE_RECURSIVE_DATA`,
`ORDER_IS_COMPILED`, `DENY_REENTERS_THE_JOIN`, `PROVENANCE_OR_BURN`, `RULE_3`,
`CONVERGENCE_NOT_AUTHORIZATION`, `CLOSED_CAPS`), plus `SIGNATURES` and `EYE_GATES` for the two
protected mechanisms the Invariants section references but does not itself number. The doc's
existing three-item list at line 545 is deleted in favor of this fourteen-token closed set,
resolving its inconsistency with the four-item list at line 625-627.

**Why.** Surface B: the committed git record contains zero evidence PPC's authorization is close
to converging — only four docs commits exist for PPC on this branch (design, dogfood-request,
quest-entry, implementation plan), with no committed authorization attempt, pass, or fail recorded
for PPC at all, and the uncommitted workshop evidence that does exist shows eleven attempts still
unresolved in a `conflict` / `needs-eye` state. With no committed proof of proximity, "wait for the
real catalog" is unbounded on the evidence on disk, and Stage 1 rule 2 would be unenforceable for
that unknown duration — the exact defect the content-address rule exists to prevent. Surface C: the
four-token alternative is not merely incomplete but internally inconsistent within the same
document (three items at line 545 vs four at line 625-627), and it structurally exempts eight of
twelve load-bearing invariants — Seat 5 neutrality, hash-is-law, hash-recursion, compiled order,
provenance-or-burn, closed caps — from Stage 1's reject check, exactly the mechanisms a cost- or
latency-motivated "optimization" is most likely to target. The closed-set discipline this project
already applies elsewhere (`NA_ALLOWED`, `EVIDENCE_KINDS`, `check-registry.mjs`) resolves ties
toward complete enumeration, not the convenient sample.

**Authority chain:** docs/runs/item-8-domain-catalog-ruling-packet.md (adversarially reviewed,
revised, and passed bounded review 2026-07-22) -> Eye ruling: adopt, 2026-07-22.
