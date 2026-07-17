---
type: reference
topic/architecture: telos
status: living
note: Human view of docs/institutional-memory/INVARIANTS.json — the cross-cutting properties that must remain true system-wide. Each NORMATIVE invariant cites an executable oracle.
---

# TELOS — cross-cutting invariants

| id | invariant | oracle |
|---|---|---|
| `fail-closed` | Absent/ambiguous evidence blocks rather than approves; the gate certifies from disk + signatures + real provenance, never a self-report. | `build-gate npm test` |
| `content-address-not-mutable-label` | Every enforcement identity is a content-derived address; a mutable label must not stand where an identity belongs. | `merkle-dag npm test`, `clotho test-registry.mjs` |
| `spine-read-only` | Nothing outside `clotho/` imports from it; each package is self-contained; slice diffs are confined. | slice gate `imports-permitted` + `confined` |
| `zero-runtime-dependencies` | `node:` stdlib only; no npm packages, no lockfile. | slice gate `zero-deps`; `npm run check` |
| `eye-authority-non-delegable` | The Eye's authority over consequential action cannot be delegated to a model or inferred from silence; convergence is not authorization. | `docs/convergence-is-not-authorization.md`; `authz-007` NOT_AUTHORIZED |

These are `NORMATIVE-CURRENT`. Component-specific invariants live in each
`<component>/memory/INVARIANTS.md`.
