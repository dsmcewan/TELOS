# Candidate approach (rev 4) — Lachesis (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json`.
**Registered meaning (fixed):** Lachesis *measures dependencies, relevance, risk, and blast radius*. It does
metrics. No extension. Authored AI-centric / machine-first (the first-three-modules standard).

Rev 4 resolves the round-3 objections: (1) presence-based completeness is still a false-completeness rule;
(2) the oracle does not DISCRIMINATE the metric semantics; (3) the snapshot digest was caller-supplied; (4)
ingestion was not real fail-closed schema validation.

## 1. Trust root: the authority-anchored snapshot digest (fixes obj. 3, and obj. 4's identity concern)

Lachesis CANNOT recompute Clotho's content-addresses — `deriveNodeId` (canonicalize + sha256hex) lives in
`clotho/registry.mjs`, and importing it violates the frozen spine boundary while re-implementing it invites
drift (the same reason blastRadius is not re-implemented). So the **trust root is provenance, not
recomputation**: the expected snapshot sha256 is pinned in a committed, authority-anchored manifest
`lachesis/memory/CONTRACTS/snapshot-manifest.json` (anchored by `file:@<40hex>` to the pre-review +
CURRENT-AUTHORITY), NEVER a caller argument. `loadWeave(path)` reads the digest FROM that contract; a caller
cannot substitute it. **If the file's sha256 == the pinned digest, the entire snapshot — nodes, edges, and
their Clotho-derived ids — is byte-exact what Clotho committed, so node identity is transitively verified
without recomputation.** Negative test: any substituted/mutated snapshot → digest mismatch → throw.
NON-CLAIM: Lachesis verifies snapshot PROVENANCE + structure; it does not re-derive content-addresses (the
digest is the trust root).

## 2. Fail-closed schema validation (fixes obj. 4 — defense-in-depth behind the digest)

`lachesis/ingest.mjs#loadWeave(path)` — the ONLY entry to metrics; every check throws (fail-closed):
- snapshot digest == the pinned manifest digest (§1); else throw.
- JSONL: each line parses; else throw.
- record shape by `kind`: nodes vs edges have their complete required-field set with correct types (a closed
  per-kind shape table pinned in `metrics.json`); missing/mistyped field → throw.
- `kind` ∈ the closed node/edge kind set (node kinds; edges = `depends-on|verified-by|introduced-by`); else throw.
- each node `id` is syntactically a `sha256:<64hex>`; else throw.
- each `source_ref` matches an allowed scheme from `docs/institutional-memory/SCHEMA.md`
  (`git:<40hex>` | `file:<path>@<40hex>` | `ledger:<path>#<64hex>`); else throw.
- every edge `from_node`/`to_node` resolves to a node id present in the snapshot (reference integrity); else throw.
- reject duplicate node ids and duplicate edges; else throw.

## 3. Discriminating metric oracle (fixes obj. 2 — a wrong implementation MUST fail)

`lachesis/scripts/test-metrics.mjs` asserts POSITIVE, discriminating fixtures — each pins one semantic so a
wrong implementation fails, not just the happy path:
- **direction:** a fixture where forward vs. REVERSE `depends-on` give different sets (wrong orientation fails).
- **transitivity:** a ≥2-hop chain (a one-hop-only implementation fails).
- **cycle:** a dependency cycle (non-terminating or double-counting handling fails; visited-set passes).
- **normalization:** two nodes where weighted `{3,2,1}` vs. unweighted MAX_RAW differ (unweighted fails).
- **threshold inclusivity:** fixtures at EXACTLY blastRadius ∈ {3,10} and relevance ∈ {0.33,0.66} pinning the
  `≥` boundaries (off-by-one inclusivity fails).
- plus the §2 ingestion negatives (malformed/dup/dangling/bad-digest each throw).
Pinned semantics (frozen in `metrics.json`): `depends-on` = `from` dependent → `to` dependency;
`dependencies` = transitive forward closure (visited-set, fixpoint); `blastRadius(depth)` = reverse-reachable
dependents to `depth` hops (node excluded), visited-set; `relevance` = `raw = 3·(depends-on in) + 2·(verified-by
in) + 1·(introduced-by in)`, `normalized = raw / MAX_RAW` over ALL nodes, `MAX_RAW==0 → 0`;
`riskClass` = `high` if blastRadius `≥ 10` OR relevance `≥ 0.66`; else `medium` if `≥ 3` OR `≥ 0.33`; else
`low`; composition = max of the two class drivers.

## 4. Honest completeness — Lachesis does NOT certify completeness (fixes obj. 1)

Presence of one edge per kind does NOT prove completeness; inferring it is the rejected false-completeness
rule. Lachesis STRUCTURALLY cannot certify a snapshot is complete, so it stops trying: `coverage(nodeId)` ∈
`attested-complete` (ONLY when an authority-anchored completeness attestation for this snapshot+node exists —
a signed/pinned manifest entry, never Lachesis's own inference) | `unverified` (otherwise). **riskClass is
floored: it may return `low` ONLY when coverage == `attested-complete`; otherwise the class is bumped to at
least `medium` and carries `coverage: "unverified"`.** `low` risk therefore requires attested completeness, not
a presence heuristic. The prior presence-based `expected-coverage.json` is REMOVED (it was the false rule).

## 5. Boundary, layout, package

Lachesis reads the committed weave snapshot `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl` as DATA
— never `import`s `clotho/`; its metrics are its own. `lachesis/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`;
`CONTRACTS/{metrics.json, snapshot-manifest.json}`; `DECISIONS/rejected-alternatives.md` (rejected: import
`clotho/query.mjs`; re-implement blastRadius/deriveNodeId — drift; presence-based completeness — false rule;
caller-supplied digest — substitutable); `NON-CLAIMS.json`/`.md` (measures ≠ authorizes/retires/weaves/renders;
risk advisory; relevance a proxy; does NOT certify completeness; does NOT re-derive content-addresses; consumes
a snapshot, not the live ledger); `FAILURE-MODES.md`; `EVIDENCE/`; `comprehension-queries.json`; `README.md`.
`package.json`: `"type":"module"`, zero deps, `npm test` → `test-metrics.mjs`.

## 6. Acceptance sequence (documentation-first)

1. Author `metrics.json` (SPECIFIED-PENDING-IMPLEMENTATION + `becomes_normative_when` = test-metrics.mjs
   passes) + `snapshot-manifest.json` + full memory set; render README (`--check`). 2. Comprehension gate:
   pass→0; negatives ("Lachesis authorizes", "risk enforced", "relevance is ground truth", "certifies
   completeness", "recomputes node-ids", "caller supplies the digest")→nonzero, each proving its misconception.
   3. Argo implements `ingest.mjs` + `measure.mjs` + fixtures + `test-metrics.mjs` until `npm test` exits 0 and
   `metrics.json` flips to NORMATIVE-CURRENT. 4. Minimal enrollment flip (routed to The Eye at authz).
   5. `verify-contracts.mjs` exits 0. Terminal is submit, not authorization.

## 7. Non-goals (cycle 1)

No `import` of `clotho/`; no re-implementation of Clotho's query API or `deriveNodeId`; no content-address
recomputation (digest is the trust root); no completeness certification (attestation-gated); no enforcement
from the risk class (advisory); no Atropos/Narcissus work; no npm dependency; no extension of the registered
meaning.
