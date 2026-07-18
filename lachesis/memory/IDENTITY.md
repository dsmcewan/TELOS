# Lachesis — identity

**Lachesis MEASURES dependencies, relevance, risk, and blast radius** over a committed Clotho weave
snapshot, consumed as DATA. Exact registered meaning (`docs/mythological-vocabulary.md#Lachesis`); no extension.

Lachesis is a zero-dependency Node ESM package. It **measures**; it does NOT authorize (TELOS), enforce,
retire (Atropos), weave (Clotho), or render (Narcissus). Measurement is NORMATIVE (a tested oracle over a
pinned snapshot); the **risk CLASS is ADVISORY** — an input to TELOS/The Eye, never an enforced gate.

## What it computes (see `CONTRACTS/metrics.json` for the frozen semantics)
- `dependencies(id)` — transitive forward `depends-on` closure (excluding the node; cycle-safe).
- `blastRadius(id, depth)` — reverse `depends-on` dependents to `depth` hops (excluding the node; cycle-safe).
- `relevance(id)` — normalized `3·D(to) + 2·V(from) + 1·I(from)` salience (`depends-on` credits the
  dependency; `verified-by`/`introduced-by` credit the subject). Reported; does NOT feed risk.
- `riskClass(id, coverage)` — blast-driven (`≥10` high, `≥3` medium, else low) + coverage floor
  (`low` only when coverage is `attested-complete`). ADVISORY.

## Boundary
Lachesis NEVER imports `clotho/` (the frozen spine boundary). It reads the serialized weave snapshot as data;
the only sanctioned cross-package import is `merkle-dag/vendor.mjs` (`canonicalize`/`sha256hex`), enforced by
`scripts/test-boundary.mjs`. Its metrics are its own — it does not call or re-implement Clotho's query API or
`deriveNodeId`.

## Trust posture (cycle 1)
The snapshot's raw-byte digest is checked against a manifest, and ingestion is fail-closed (canonical-JSON,
closed kind sets, locator↔id bijection, structure). See `NON-CLAIMS.md` for exactly what this does and does
NOT establish — notably: NOT a content-address re-derivation, NOT a durable authenticated trust root, NOT
cryptographic chain/signature verification.

Authority: `file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json` +
`authz-lachesis-1` (TELOS council, `file:docs/runs/lachesis-authorization-1/authorization-summary.json`).
