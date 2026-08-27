# FROZEN SPEC — Production-Readiness Master Checklist (governing essence)

The Eye supplied a full production-readiness master checklist (26 sections + a
delivery sequence) as the governing standard. Un-reviewable frozen material.

## Target and definition
Enterprise-deployable SELF-HOSTED product; SaaS delta separate. Production-ready =
a qualified operator who did not build TELOS can deploy from SIGNED ARTIFACTS,
connect a real repo, run governed reviews, verify every authority record, survive
crashes/outages, rotate keys, upgrade, restore from backup, diagnose incidents,
and roll back — from published docs, without founder memory. A local single-user
CLI may declare identity/tenancy/clustered-runtime out of scope, but that
decision must itself be explicit, tested, and documented.

## Priorities
P0 blocks any credible production deployment; P1 before broad GA; P2 scale/
regulated; Conditional per product/hosting model. Hard go-live gate + automatic
no-go conditions defined.

## Minimum Viable Production Set (this quest targets Phase 0 + Phase 1a of it)
Canonical coherently-named versioned product; signed installable artifact;
one documented single-node topology; strict config + a doctor command; durable
crash-consistent state w/ migrations (Phase 1b); authenticated authority +
least-privilege identity (Phase 1b); key custody/rotation/backup (Phase 1b); one
exact-SHA source-control integration; one supported sandbox platform; structured
logs/audit/metrics/health/dashboards/alerts (Phase 1b+); tested backup/restore/
upgrade/rollback (Phase 1b); SBOM/signatures/checksums/provenance; load/soak/
outage/crash qualification (Phase 1b+); an independent security review; a
clean-room deployment by a non-author; named service/security/release ownership.

## Delivery sequence
Phase 0 freeze product contract (canonical form, topology, flagship demo-vs-
production, package renaming/versioning, product-boundary + state-model ADRs) →
Phase 1 installable single-node candidate → Phase 2 operable beta → Phase 3
security/reliability RC → Phase 4 GA → Phase 5 enterprise/SaaS.

## Specific mandates honored this round
- "v4-build-gate" naming must go.
- Any Node-version doc claim reconciled to the required >=22.12.0.
- Mythological names translated to plain-English product roles in operator
  surfaces (glossary), and the product SKU named PYLAE Gate.
- The checklist itself becomes a COMMITTED tracked register (owners, status,
  N/A-with-signed-ADR), not a chat artifact.
- No operation may fail open when evidence/identity/provenance/isolation/storage
  is unavailable; no production authority may depend on a mutable name/branch/
  label/model assertion; green CI alone is not proof of operability.

## Scope for THIS quest (Eye ruling)
Blockers + governance + Phase 0 (freeze contract, ADRs, tracked register) +
Phase 1a (naming/versioning, telos/pylae CLI init/doctor/version/verify, signed
release pipeline). Phase 1b+ scheduled in the register with target rounds.
