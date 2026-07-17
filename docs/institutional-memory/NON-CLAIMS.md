---
type: reference
topic/architecture: telos
status: living
note: System-level anti-claims. Models commonly promote adjacent concepts into capabilities that sound architecturally plausible; these prevent that.
---

# TELOS — system-level non-claims

- **No autonomous Argo runner exists.** *Argo* names an implementation role (carries an
  authorized plan through implementation, verification, and documentation), not a
  deployed service.
- **TELOS authorization does not execute code.** Authorization certifies merge-readiness
  from disk + signatures + provenance; it is separate from execution.
- **A model approval is not human authority.** The Eye's authority is non-delegable and
  cannot be inferred from council consensus. Convergence is not authorization.
- **Clotho Phase 1 does not measure risk.** Dependency/relevance/risk/blast-radius belong
  to *Lachesis*.
- **Clotho Phase 1 does not retire artifacts.** Retirement/supersession of obsolete
  relationships belongs to *Atropos* (expressed here via `supersedes` edges +
  `must_not_govern_new_work`).
- **Clotho is advisory / non-sandboxed** — it does not prove loader containment or provide
  a JavaScript sandbox (see `clotho/memory/NON-CLAIMS.md`).
- **A successful scaffold or a green gate is not a correctness proof** beyond exactly what
  the tests and the gate check.
