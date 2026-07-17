# Daedalus delta-12 — verification (candidate v13)

**Outcome:** `converged-for-submission`, 0 unresolved objections, 1 round.

## What delta-12 did

Integrated the single normative amendment **AM-40** — The Eye's `PACKAGE_ROOTS`
scope ruling — into the converged plan **v12**
(`docs/runs/clotho-daedalus-delta11/matured-plan-v12.md`, `sha256:bdc93901…`),
producing candidate **v13** (`matured-plan-v13.md`).

**Origin.** During Task 4a implementation a genuine frozen-scope ambiguity
surfaced: *"inventory every current package root once"* admits an all-eight
reading (the repo has 8 `package.json` dirs) or a TELOS-spine-five reading. Per
the plan's own rule that known specification defects are proposed explicitly and
routed to The Eye — not designed around at the implementation layer — the
question was escalated. **The Eye ruled:** TELOS spine only (five packages), the
three sibling products (`ai-forge`, `forge`, `saas-forge`) held in an explicit,
mechanically-proven exclusion; the products are deferred for conscious enrollment
later at the system-of-systems umbrella (the Iliad), not absorbed into the Phase 1
self-weave.

## Integration is exactly two points (byte-verified)

v13 differs from v12 at **exactly** two locations, and nowhere else:

1. The **Task 4a inventory clause** — `PACKAGE_ROOTS` fixed to the five spine
   packages; `PACKAGE_ROOTS_EXCLUDE` fixed to the three products; the
   discover-all / union / disjoint completeness unit; the Iliad deferral boundary.
2. The **`clotho/inventory.mjs` file-description row** — the same
   `PACKAGE_ROOTS` / `PACKAGE_ROOTS_EXCLUDE` specifics.

`diff v12 v13` = 3 lines removed, 17 added (20 changed lines), all within those
two locations. Every other frozen decision (D17/AM-17, D24/D26/D31, D32, D33, the
AM-35..AM-39 advisory / non-sandbox posture, zero-dependency, spine-read-only) is
reaffirmed unchanged.

## Convergence provenance

Both Daedalus seats VERIFIED the pre-integrated candidate against AM-40 and BOUND
it byte-identically (neither modified it), with zero open objections:

- author/reviewer round 1 — claude `claude-fable-5` (`msg_011Cd6h5X1FrBLsugdoU…`)
- author/reviewer round 1 — codex `gpt-5.6-sol` (`chatcmpl-E2QphbqkifZYQYY…`)

`final_candidate_ref` = `sha256:f9368b5748de6c2670193558783b60b7f74fd94de9196c9664d42269f3d2bc04`;
the bound artifact equals `matured-plan-v13.md` byte-for-byte.

## Process note

The first live run stalemated (`repeated-candidate-hash`): the round-1 author
punted on reproducing the ~168KB plan and returned it unchanged, so AM-40 was
never woven in and the reviewer correctly objected. The workshop was then
restructured to **verify-and-bind a deterministically pre-integrated candidate**
(the amendment is a narrow, auditable two-point edit) rather than asking a seat to
reproduce the whole plan — the seats' job is to confirm the integration is
faithful, complete, and narrow, and bind it. AM-40 and The Eye's directives ride
in the prompt as the verification spec.

## Status

v13 is converged for submission. Next in the chain: release, TELOS
re-authorization against v13, The Eye's re-confirmation that the implementation
authorization (#109) covers amended Task 4a, then resume the Task 4a required-seat
review against v13.
