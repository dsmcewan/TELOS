---
type: contract
topic/architecture: telos
status: living
note: Which kind of change requires which governance path. A future model must not silently reinterpret scope; it must route the change here.
---

# TELOS — change protocol

| change | required path |
|---|---|
| Code change under a frozen, authorized plan (no scope change) | Implementation on a bounded slice → deterministic gate (`meets`) → required-seat review → **The Eye's acceptance** → merge. |
| A genuine scope/spec **ambiguity or defect** in a frozen plan | **Do not design around it.** Propose it explicitly and escalate to **The Eye** → Eye ruling → **Daedalus** delta matures it into a new plan version → **TELOS** re-authorization (`authz-N`) → **The Eye** re-confirms implementation authority → implementation resumes against the new version. |
| An **amendment** to a decision the Eye already ruled | Eye ruling → Daedalus delta → new plan version → TELOS authz → Eye implementation authority (same as above; e.g. AM-40, AM-41). |
| Retiring an obsolete relationship/artifact/plan | Mark `SUPERSEDED` with `superseded_by` + `must_not_govern_new_work: true` (Atropos); record the `supersedes` edge; update `CURRENT-AUTHORITY.json`. |
| Introducing a **mythological term** or a new component boundary | **Human approval only** — register in `docs/mythological-vocabulary.md`. Unregistered ≠ available. |
| Adding an npm dependency, build tooling, or committing a runtime/secret artifact | **Not permitted** (zero-dependency; secrets are env/registry only). |

**Precedent (institutional memory):** the PACKAGE_ROOTS scope ambiguity and the D33
lexer-bar question were both **escalated to The Eye rather than designed around** — that
is the required behavior, and it is why AM-40/AM-41 exist. See
`clotho/memory/DECISIONS/` and `docs/convergence-is-not-authorization.md`.
