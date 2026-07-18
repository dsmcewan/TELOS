# Candidate approach — Lachesis (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json` (awaiting workshop).
**Registered meaning (fixed, the boundary):** Lachesis *measures dependencies, relevance, risk, and blast
radius* (`docs/mythological-vocabulary.md#Lachesis`). No extension.

This is the APPROACH the Daedalus workshop matures to `submit`; code is authored by Argo after TELOS
authorization. Implementation mechanics are specified here up front (the reviewer will require them).

## 1. What Lachesis is, and its boundary

A new **zero-dependency Node ESM** package `lachesis/` that CONSUMES Clotho's query surface to MEASURE, and
produces an ADVISORY risk assessment as input to TELOS/The Eye. It does NOT authorize (TELOS), retire
(Atropos), weave/produce edges (Clotho), or render (Narcissus). It imports Clotho; it does not modify it.

## 2. Concrete deliverables (the mechanics)

- **`lachesis/measure.mjs`** — pure functions over a Clotho weave (an array of thread-ledger records) and a
  target `nodeId`, importing `clotho/query.mjs` (`blastRadius`, `threadsOf`, `why`, `reportGaps`) — never
  re-implementing them:
  - `measureBlastRadius(records, nodeId, depth)` — dependents reachable via `depends-on` (delegates to
    Clotho `blastRadius`), returned as an exact count + the node set.
  - `measureDependencies(records, nodeId)` — the node's direct + transitive `depends-on` closure (via
    `threadsOf`), as an exact set.
  - `measureRelevance(records, nodeId)` — a DETERMINISTIC relevance metric (documented formula:
    in-degree of `depends-on`/`verified-by`/`introduced-by` edges, normalized), no model judgment.
  - `deriveRiskClass(measurements)` — a DOCUMENTED deterministic threshold mapping to a class
    (`low`/`medium`/`high`), so it is testable — but the CLASS is ADVISORY input, not an enforced gate.
- **`lachesis/scripts/test-measure.mjs`** — the executable ORACLE: deterministic assertions over a fixed
  fixture weave committed under `lachesis/fixtures/` (known blast radii, dependency sets, relevance,
  risk classes). Run by `npm test` in the package (mirrors clotho's `npm test`).
- **`lachesis/memory/`** — the institutional-memory record set (mirroring `clotho/memory/`): `IDENTITY.md`,
  `INVARIANTS.json`/`.md`, `CONTRACTS/measurement.json` (the exact measurement contract, NORMATIVE with the
  test-measure oracle), `NON-CLAIMS.json`/`.md` (measures ≠ authorizes/retires/weaves/renders; risk class is
  advisory; relevance is a proxy, not ground truth), `comprehension-queries.json`, and a RENDERED `README.md`
  (via a local `render.mjs`, `--write`/`--check` byte-identical — matching the rendered-projection discipline).
- **`lachesis/package.json`** — `"type":"module"`, `npm test` runs the oracle; zero dependencies, no lockfile.

## 3. Normativity (mixed, honest)

- The **measurement contract** (`measure.mjs` behavior) is **NORMATIVE-CURRENT** — deterministic, with the
  `test-measure.mjs` oracle. `verify-contracts.mjs` (or the package's own test, referenced by the record)
  is the passing verification.
- The **risk class** is **ADVISORY** — a documented threshold mapping, but a judgment fed to TELOS/The Eye,
  never a new enforcement gate.

## 4. Enrollment flip (the shared-registry change — routed to The Eye at authorization)

Enrolling Lachesis:
- moves `lachesis` from `enrollment.json#future_modules_registered_unimplemented` to the enrolled set;
- adds a `lachesis` entry to `repository-manifest.json` (its role, code paths, memory_dir, comprehension_queries);
- flips the `verify-contracts.mjs` cross-check for lachesis from `future-lachesis-unimplemented: no memory dir`
  to an implemented-module check (the memory dir now exists). This is the ONE shared-verifier change, inherent
  to enrolling any future module; the workshop scopes the exact minimal edit and it is a routed decision for
  The Eye at the authorization gate — not resolved unilaterally, and kept as small as the registry requires.

## 5. Acceptance sequence

1. Author `measure.mjs` + fixtures + `test-measure.mjs`; `npm test` in `lachesis/` exits 0.
2. Author the `lachesis/memory/` record set; render README (`--check` byte-identical).
3. Comprehension fixtures (existing gate, unmodified): pass->0; negatives (e.g. "Lachesis authorizes",
   "risk class is enforced", "relevance is ground truth")->nonzero, each proving the targeted misconception.
4. Apply the minimal enrollment flip (enrollment.json + manifest + the one verify-contracts expectation).
5. `verify-contracts.mjs` exits 0 (now including lachesis as implemented).
6. Record commands/exits/digests. Terminal is **submit, not authorization**; TELOS authz + The Eye's
   acceptance follow.

## 6. Non-goals (cycle 1)

- No enforcement/gate wired from the risk class (advisory only).
- No Atropos/Narcissus work; no change to Clotho query code (consume only); no npm dependency.
- No extension of the registered meaning.
