---
type: reference
topic/architecture: telos
status: living
note: What the TELOS role IS, what it owns, and what it explicitly does not own. Registered meaning is fixed by docs/mythological-vocabulary.md; this file maps the role to its on-disk artifacts for a memoryless reader.
---

# TELOS (role) — identity

**Registered meaning (fixed):** *TELOS governs review, evidence, authorization, and
execution boundaries.* (`docs/mythological-vocabulary.md`)

Disambiguation a fresh model needs immediately: **the role is not the repo.** The
repository is named TELOS; the *role* is the governance function realized by the
gate/council code and the authorization run lineage. Products in the repo
(ai-forge, saas-forge, forge) are governed *beside* the spine (AM-40) — do not
infer role ownership from the repository name.

## Owns

- **The deterministic gate** — `build-gate/gate.mjs` (`REQUIRED_MODELS` trio;
  signed-mode signature + provenance blockers; disk re-verification; protected
  paths).
- **The council** — `build-gate/council.mjs` (`planSeats` per-job roster: required
  approvers claude/agy/codex + advisory grok/gemini; CPU-bounded fan-out;
  `liveSeatCaller` provenance stamping) with per-seat HMAC signing
  (`build-gate/sign.mjs`).
- **The authorization lineage** — `docs/runs/clotho-authorization*/` (authz-001…008,
  all `trust_mode: signed`; five refusals preserved). Machine contract:
  `CONTRACTS/authorization-chain.json`.
- **Evidence discipline** — what counts as evidence and how it is re-verified
  (`build-gate/evidence.mjs`, `check-registry.mjs`, `breakout/verifier.mjs`
  re-verification under the gate).

## Does NOT own

- **Plan maturation** — Daedalus (`docs/institutional-memory/daedalus/`).
- **Implementation** — Argo carries the authorized plan; TELOS only certifies.
- **Human authority** — The Eye. A unanimous signed council is still a model
  outcome; implementation authority is granted by The Eye, not by a pass.
- **Risk measurement** — Lachesis. **Retirement** — Atropos.

## Artifact map (for a fresh model)

| artifact | path |
|---|---|
| gate | `build-gate/gate.mjs` (+ `sign.mjs`) |
| council | `build-gate/council.mjs` |
| gate/trust oracles | `build-gate/scripts/test-gate.mjs`, `test-trust.mjs`, `test-council-orchestrator.mjs` |
| authorization runs | `docs/runs/clotho-authorization…-8/` (records: `authorization-summary.json` + per-seat packets) |
| machine contracts | `CONTRACTS/authorization-chain.json`, `CONTRACTS/authorization-protocol.json` |
| the boundary doc | `docs/convergence-is-not-authorization.md` |
| comprehension gate queries | `comprehension-queries.json` |

Verification, one command each:
```
node docs/institutional-memory/verify-contracts.mjs
cd build-gate && npm test
```
