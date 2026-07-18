# Candidate approach (rev 2) — Lachesis (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json`.
**Registered meaning (fixed, the boundary):** Lachesis *measures dependencies, relevance, risk, and blast
radius* (`docs/mythological-vocabulary.md#Lachesis`). Lachesis **does metrics.** No extension.

Rev 2 resolves all four round-1 reviewer objections (Clotho import boundary; unspecified metric semantics;
unused gap uncertainty; incomplete memory layout). This is the APPROACH the workshop matures; Argo authors
code after TELOS authorization.

## 1. Boundary: Lachesis is a metrics engine over the weave DATA — it never imports Clotho (fixes obj. 1)

The spine rule is frozen: **nothing outside `clotho/` imports from it.** So Lachesis consumes a **serialized
data boundary** — it reads the committed weave snapshot `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl`
(JSONL of thread-ledger records: typed nodes + edges) as **data**, and computes its OWN metrics over it.
Computing metrics over the weave is Lachesis's PURPOSE (measuring), not a re-implementation of Clotho's query
API — Lachesis defines its own metrics; it does not call `clotho/query.mjs`. The record format it parses is a
documented data contract, not Clotho code.

## 2. Pinned metric definitions (NORMATIVE — the oracle tests a FIXED algorithm) (fixes obj. 2)

`lachesis/measure.mjs` (pure functions over parsed weave records + a target `nodeId`), each definition PINNED
in `lachesis/memory/CONTRACTS/metrics.json` so the oracle cannot bless a co-written algorithm:
- **edge orientation:** a `depends-on` edge is `from = dependent`, `to = dependency` (stated explicitly).
- **dependencies(nodeId):** the transitive set reached by following `depends-on` FROM the node; a **visited
  set** dedups (cycle-safe); termination = fixpoint over the visited set.
- **blastRadius(nodeId, depth):** the set of **dependents** reachable via REVERSE `depends-on` up to `depth`
  hops (depth = edge hops; depth 0 = the node itself excluded from the count); visited-set cycle handling;
  returned as an exact count + node set.
- **relevance(nodeId):** a pinned formula — weighted in-degree = (w1·depends-on-in) + (w2·verified-by-in) +
  (w3·introduced-by-in), with the exact weights frozen in the contract; normalized by the max in-degree in
  the snapshot (normalization defined exactly, div-by-zero → 0).
- **riskClass(measurements):** pinned thresholds (frozen in the contract) mapping (blastRadius, relevance,
  coverage) → `low | medium | high`. ADVISORY — a class fed to TELOS/The Eye, never an enforced gate.

## 3. Coverage/gaps feed uncertainty — no false "measured low" over an incomplete weave (fixes obj. 3)

`measureCoverage(records, nodeId)` — Lachesis's OWN check that the node's expected edge kinds are present
(per a pinned expected-kinds set). If coverage is incomplete, the assessment carries an explicit
`coverage: "incomplete"` and the risk class is **uncertainty-bumped** (cannot report `low` under incomplete
coverage — it reports the higher of the computed class and `medium`, with `coverage_incomplete: true`). The
advisory posture does not cure omitted uncertainty; the metric surfaces it.

## 4. Complete institutional-memory layout (fixes obj. 4)

`lachesis/memory/` mirrors the FROZEN per-component layout: `IDENTITY.md`, `INVARIANTS.json`/`.md`,
`CONTRACTS/metrics.json` (NORMATIVE, oracle = the test below), `DECISIONS/` (incl. `rejected-alternatives.md`
— e.g. "import clotho/query.mjs" rejected for the boundary; "reimplement Clotho's blastRadius" rejected for
drift), `NON-CLAIMS.json`/`.md`, `FAILURE-MODES.md`, `EVIDENCE/`, `comprehension-queries.json`, rendered
`README.md`.

## 5. Oracle + package

- `lachesis/scripts/test-metrics.mjs` — deterministic assertions over a small committed fixture weave
  (`lachesis/fixtures/weave.jsonl`) with hand-verified dependency sets, blast radii, relevance scores,
  coverage, and risk classes (incl. a cycle case and an incomplete-coverage case). `npm test` runs it.
- `lachesis/package.json` — `"type":"module"`, zero dependencies, no lockfile.

## 6. Acceptance sequence

1. `npm test` in `lachesis/` exits 0 (the metrics oracle). 2. Author the full `lachesis/memory/` set; render
README (`--check` byte-identical). 3. Comprehension fixtures (existing gate): pass->0; negatives ("Lachesis
authorizes", "risk class is enforced", "relevance is ground truth", "gaps don't affect risk")->nonzero, each
proving its targeted misconception. 4. Minimal enrollment flip (enrollment.json + manifest + the one
verify-contracts expectation) — routed to The Eye at authorization. 5. `verify-contracts.mjs` exits 0.
Terminal is **submit, not authorization**; TELOS authz + Eye acceptance follow.

## 7. Non-goals (cycle 1)

- No `import` of `clotho/` (data boundary only); no re-implementation of Clotho's query API (Lachesis's
  metrics are its own). No enforcement wired from the risk class (advisory). No Atropos/Narcissus work; no
  npm dependency; no extension of the registered meaning.
