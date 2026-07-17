---
type: reference
topic/architecture: telos
status: living
note: What the Daedalus role IS, what it owns, and what it explicitly does not own. Registered meaning is fixed by docs/mythological-vocabulary.md; this file maps the role to its on-disk artifacts for a memoryless reader.
---

# Daedalus — identity

**Registered meaning (fixed):** *Daedalus collaboratively matures implementation
plans.* (`docs/mythological-vocabulary.md`)

Daedalus is a **role module**: a registered role realized by code + a protocol + a
run lineage, not a top-level package. This memory dir is its succession interface.

## Owns

- **The maturation protocol** — `build-gate/daedalus.mjs`:
  - *serial workshop* (`runDaedalusWorkshop` + `deriveWorkshopState`): alternating
    claude/codex author→reviewer rounds; retained only for genuinely small deltas;
  - *parallel authorship* (`runParallelDaedalus` + `deriveParallelState`): codex owns
    the constraint design, claude owns the implementation design, one integration
    candidate must descend from both — the forward methodology
    (`docs/daedalus-methodology.md`, HELD by The Eye 2026-07-15).
- **The objection ledger discipline** — controller-computed objection identity;
  absence is never a disposition.
- **The plan-version lineage** — every matured plan under
  `docs/runs/clotho-daedalus*/matured-plan-v*.md`; the authority-anchored tail
  (v11→v15) is the machine contract `CONTRACTS/plan-version-chain.json`.

## Does NOT own

- **Authorization** — TELOS (council gate; `authz-N` records). See
  `NON-CLAIMS.json#daedalus-does-not-authorize`.
- **Implementation** — Argo carries the authorized plan through implementation,
  verification, documentation.
- **Rulings** — The Eye. An Eye ruling entering a delta is a fixed input.
- **Retirement/supersession bookkeeping** — Atropos (expressed via
  `CURRENT-AUTHORITY.json#superseded` + `must_not_govern_new_work`).

## Artifact map (for a fresh model)

| artifact | path |
|---|---|
| protocol code | `build-gate/daedalus.mjs` |
| protocol oracle | `build-gate/scripts/test-daedalus.mjs` |
| fail-closed selection oracle | `build-gate/scripts/test-proposal-orchestrator.mjs` |
| methodology (design contract) | `docs/daedalus-methodology.md` |
| run lineage | `docs/runs/clotho-daedalus/` + `clotho-daedalus-delta…delta14/` (index: `EVIDENCE/delta-chain.json`) |
| machine contracts | `CONTRACTS/workshop-protocol.json`, `CONTRACTS/plan-version-chain.json` |
| comprehension gate queries | `comprehension-queries.json` |

Verification, one command each:
```
node docs/institutional-memory/verify-contracts.mjs
cd build-gate && npm test
```
