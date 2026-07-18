# Candidate approach (rev 3) — Lachesis (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json`.
**Registered meaning (fixed):** Lachesis *measures dependencies, relevance, risk, and blast radius*. It does
metrics. No extension.

Rev 3 resolves the round-2 objections (code-first ordering; unpinned numbers; weak completeness; ingestion
not fail-closed). The plan is deliberately comprehensive — the specifics ARE the contract.

## 1. Documentation-first ordering (fixes obj. 1 — the frozen protocol)

Sequence is DOCUMENTATION-FIRST, not code-first:
1. Author `lachesis/memory/CONTRACTS/metrics.json` as **`SPECIFIED-PENDING-IMPLEMENTATION`** — the metric
   semantics FROZEN below, authority-anchored, with **`becomes_normative_when`** = `lachesis/scripts/test-metrics.mjs`
   passes (the oracle that will exist post-implementation).
2. Author the rest of `lachesis/memory/` + pass the comprehension gate (reader validates the frozen contract
   BEFORE code).
3. Argo then implements `lachesis/measure.mjs` + the oracle until the contract flips to `NORMATIVE-CURRENT`
   with a passing test. Code never precedes the frozen, comprehended contract.

## 2. The pinned metric semantics (fixes obj. 2 — actual numbers, frozen in metrics.json)

- **Edge orientation:** a `depends-on` edge is `from = dependent`, `to = dependency`.
- **dependencies(nodeId):** transitive set via forward `depends-on`; visited-set dedup (cycle-safe); fixpoint
  termination.
- **blastRadius(nodeId, depth):** dependents via REVERSE `depends-on`, BFS to exactly `depth` hops (depth is
  edge hops; the node itself excluded); visited-set cycle handling; exact count + node set.
- **relevance(nodeId):** `raw = 3·(depends-on in-degree) + 2·(verified-by in-degree) + 1·(introduced-by in-degree)`;
  **normalized = raw / MAX_RAW**, where `MAX_RAW` = the maximum `raw` over ALL nodes in the snapshot
  (weighted, not unweighted); `MAX_RAW == 0 → relevance = 0`. Weights `{3,2,1}` and the edge set are frozen.
- **riskClass(blastRadius, relevance, coverage):** frozen thresholds — `high` if `blastRadius ≥ 10` OR
  `relevance ≥ 0.66`; else `medium` if `blastRadius ≥ 3` OR `relevance ≥ 0.33`; else `low`. Composition = the
  max of the blast-driven and relevance-driven classes. Then coverage-qualified (§3). ADVISORY.

## 3. Completeness model — honest, not a false "measured low" (fixes obj. 3)

Lachesis CANNOT certify a weave is complete, and says so. It reads a **pinned expected-edge inventory**
(`lachesis/memory/CONTRACTS/expected-coverage.json`, authority-anchored to Clotho's coverage-schema
`clotho/memory/CONTRACTS/coverage-schema.json` by `file:@<sha>`): the edge kinds the target node's type is
expected to participate in. `coverage(nodeId)` = `complete` (every expected kind present AND ≥1 edge of each)
| `incomplete` (an expected kind absent) | `unknown` (node type not in the inventory). **Risk is
coverage-qualified: it may return `low` ONLY when coverage == `complete`; otherwise the class is bumped to at
least `medium` and the assessment carries `coverage_incomplete: true`.** This surfaces omitted uncertainty
rather than curing it by fiat, and never claims completeness Lachesis cannot prove.

## 4. Fail-closed ingestion (fixes obj. 4 — the production input path is validated)

`lachesis/ingest.mjs#loadWeave(path, expectedSha)` — the ONLY entry to metric computation, fail-closed:
- verify the snapshot file's sha256 == a pinned `expectedSha` (identity); mismatch → throw.
- parse JSONL line-by-line; any unparseable line → throw.
- each record's `kind` ∈ the closed node/edge kind set (from the pinned coverage-schema); unknown → throw.
- every edge's `from_node`/`to_node` resolves to a node in the snapshot (reference integrity); dangling → throw.
- reject duplicate node ids and duplicate edges → throw.
- (thread-ledger hash-chain integrity: if the snapshot carries the ledger chain, verify it; else record the
  limitation in NON-CLAIMS — "consumes a snapshot, does not re-derive the ledger").
The metric oracle covers this path (a malformed/duplicate/dangling fixture MUST throw), not just the happy path.

## 5. Boundary + package

Lachesis reads the committed weave snapshot `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl` as
DATA — it never `import`s `clotho/`. Its metrics are its own (measuring the weave is its purpose, not
re-implementing Clotho's query API). `lachesis/package.json`: `"type":"module"`, zero deps, `npm test` runs
`test-metrics.mjs`.

## 6. Institutional-memory layout (frozen, complete)

`lachesis/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`; `CONTRACTS/{metrics.json, expected-coverage.json}`;
`DECISIONS/` incl. `rejected-alternatives.md` (rejected: `import clotho/query.mjs` — boundary; reimplement
Clotho's blastRadius — drift; "each kind present = complete" — false completeness); `NON-CLAIMS.json`/`.md`
(measures ≠ authorizes/retires/weaves/renders; risk class advisory; relevance a proxy; cannot certify weave
completeness; consumes a snapshot, not the live ledger); `FAILURE-MODES.md`; `EVIDENCE/`;
`comprehension-queries.json`; rendered `README.md`.

## 7. Acceptance sequence (documentation-first)

1. Author metrics.json (SPECIFIED-PENDING + becomes_normative_when) + expected-coverage.json + the full memory
   set; render README (`--check`). 2. Comprehension gate: pass->0; negatives ("Lachesis authorizes", "risk
   enforced", "relevance is ground truth", "gaps ignored", "certifies completeness")->nonzero. 3. Argo
   implements measure.mjs + ingest.mjs + fixtures + test-metrics.mjs until `npm test` exits 0 and metrics.json
   flips to NORMATIVE-CURRENT. 4. Minimal enrollment flip (routed to The Eye at authz). 5. verify-contracts.mjs
   exits 0. Terminal is submit, not authorization.

## 8. Non-goals (cycle 1)

No `import` of `clotho/`; no re-implementation of Clotho's query API; no enforcement from the risk class
(advisory); no Atropos/Narcissus work; no npm dependency; no extension of the registered meaning; no claim of
weave completeness.
