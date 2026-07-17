---
type: reference
topic: clotho
status: living
---

# Clotho — identity

**Registered role (verbatim, `docs/mythological-vocabulary.md`):** Clotho *"creates and
maintains knowledge-graph threads across artifacts and repositories."*

**Purpose.** Clotho is TELOS's provenance-aware knowledge-graph weaver: it threads
content-addressed edges (`introduced-by`, `depends-on`, `verified-by`,
`documented-in`, `evidenced-by`, `supersedes`, …) across code, tests, docs,
contracts, and ledgers, so the system's causal history is machine-recoverable rather
than reconstructed from filenames and prose.

**Trust domain.** **Advisory / non-sandboxed** (AM-35). Clotho produces review signal
and provenance, not isolation or containment — see `NON-CLAIMS.md`.

**Owning authority.** Governed by **TELOS** (review/evidence/authorization/execution
boundaries) under the non-delegable authority of **The Eye**. Implementation is
carried by **Argo**; plans are matured by **Daedalus**.

**Relationships.**
- Clotho **weaves the TELOS spine** — the five package roots `breakout`, `build-gate`,
  `clotho`, `connectors/ai-peer-mcp`, `merkle-dag` (AM-40). It does **not** weave the
  sibling products `ai-forge`, `forge`, `saas-forge`.
- Its weave **feeds The Iliad** (the system-of-systems umbrella), which uses it for
  cross-plan and cross-system coherence — and where the deferred products are later
  consciously enrolled.
- **Atropos** retires obsolete relationships/artifacts (the `supersedes` edge +
  `must_not_govern_new_work` metadata); **Lachesis** measures risk/blast-radius over
  the weave.

**Reuse.** Identity/lineage primitives from `clotho/registry.mjs` (`deriveNodeId`,
closed node/edge kinds, `source_ref` schemes) and `merkle-dag/vendor.mjs`
(`canonicalize`, `sha256hex`). Zero runtime dependencies; ESM; `node:` stdlib only;
the spine is read-only (nothing outside `clotho/` imports from it).
