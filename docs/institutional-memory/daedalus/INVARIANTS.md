---
type: reference
topic/architecture: telos
status: living
note: Human view of INVARIANTS.json — the Daedalus role's load-bearing properties. Each NORMATIVE invariant cites an executable oracle. Machine records are the source of truth; this file is rendered from them.
---

# Daedalus — invariants

| id | invariant | oracle |
|---|---|---|
| `daedalus-submission-not-authorization` | A converged workshop permits **submission only** — never authorization. Two real refusals of converged output (authz-004, authz-007) are the preserved precedent. | `test-daedalus.mjs`; verify-contracts terminal probes |
| `daedalus-controller-computed-objection-identity` | Objection identity is always controller-recomputed; a model-asserted `objection_hash` is discarded. | `test-daedalus.mjs` |
| `daedalus-absence-not-disposition` | Only an explicit resolved/superseded/withdrawn record retires an objection — silence keeps it open and blocks convergence; only the originating seat may retire its own. | `test-daedalus.mjs` |
| `daedalus-provenance-pairwise-distinct` | Every converging seat call carries a real, pairwise-distinct provenance key; in parallel mode all five calls must be distinct. | `test-daedalus.mjs` |
| `daedalus-exact-obligation-coverage` | Parallel convergence requires a strict bijection between the constraints-declared obligation ids and the matrix rows. | `test-daedalus.mjs` |
| `daedalus-conflict-routes-to-eye` | A `violated` verdict or non-empty conflict list routes to The Eye (`needs-eye`) — never blended; a missing verdict is not tacit approval. | `test-daedalus.mjs`; verify-contracts conflict probe |
| `daedalus-no-silent-serial-downgrade` | `authorship: "parallel"` with no adapter **blocks** (`PARALLEL_AUTHORSHIP_UNAVAILABLE`) instead of downgrading to serial. | `test-proposal-orchestrator.mjs` |

All are `NORMATIVE-CURRENT`. The machine contracts these enforce:
`CONTRACTS/workshop-protocol.json` (protocol constants + state machine) and
`CONTRACTS/plan-version-chain.json` (the authority-anchored maturation lineage).
