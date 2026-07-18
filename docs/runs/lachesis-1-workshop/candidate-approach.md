# Candidate approach (rev 5) — Lachesis (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json`.
**Registered meaning (fixed):** Lachesis *measures dependencies, relevance, risk, and blast radius*. It does
metrics. No extension. Authored AI-centric / machine-first (the first-three-modules standard).

Rev 5 resolves the round-4 objections: (1) the manifest itself was not independently pinned; (2) the closed
sets were wrong (dropped `sha256:`; narrowed the edge kinds); (3) `riskClass` used an unpinned blast depth;
(4) the attestation mechanism + its oracle negatives were underspecified.

## 1. Trust root: a CURRENT-AUTHORITY → manifest → snapshot chain, each link verified (fixes obj. 3)

Lachesis CANNOT recompute Clotho's content-addresses — `deriveNodeId` (canonicalize + sha256hex) lives in
`clotho/registry.mjs`; importing it breaks the spine boundary, re-implementing it drifts. So the **trust root
is provenance, chained to the authenticated root**, not recomputation, and NOT a caller argument:
1. `CURRENT-AUTHORITY.json` (the authenticated root of trust) pins the exact content-digest of
   `lachesis/memory/CONTRACTS/snapshot-manifest.json`.
2. `loadWeave()` recomputes the manifest's digest and checks it == the CURRENT-AUTHORITY pin; mismatch → throw.
   (This is the fix: mutating BOTH snapshot and manifest now fails, because the manifest's digest no longer
   matches the independent CURRENT-AUTHORITY pin — the root a caller cannot substitute.)
3. The verified manifest pins the snapshot's sha256; `loadWeave()` checks the snapshot file == that digest;
   mismatch → throw.
**A byte-exact snapshot digest transitively verifies every node/edge id inside — Clotho committed those bytes —
so node identity is verified without recomputation.** Negatives: mutated snapshot, mutated manifest (both),
and manifest-digest ≠ CURRENT-AUTHORITY each throw. NON-CLAIM: Lachesis verifies PROVENANCE + structure; it
does not re-derive content-addresses (the chained digest is the trust root).

## 2. Fail-closed schema validation (fixes obj. 4 — defense-in-depth behind the digest)

`lachesis/ingest.mjs#loadWeave(path)` — the ONLY entry to metrics; every check throws (fail-closed):
- snapshot digest == the pinned manifest digest (§1); else throw.
- JSONL: each line parses; else throw.
- record shape by `kind`: nodes vs edges have their complete required-field set with correct types (a closed
  per-kind shape table pinned in `metrics.json`); missing/mistyped field → throw.
- `kind` ∈ the COMPLETE closed Clotho sets (pinned in `metrics.json`, authority-anchored to
  `clotho/registry.mjs@<40hex>`, with a change_rule to re-sync if Clotho's change) — NODE_KINDS =
  {contract-clause, code-symbol, repository-file, test, commit, concern, obligation, check-contract,
  run-evidence, doc-section, decision}; EDGE_KINDS = {depends-on, introduced-by, motivated-by, verified-by,
  documented-in, evidenced-by, discharges, supersedes}. The loader ACCEPTS every known kind and ignores the
  metric-irrelevant ones; the metrics USE only the subset {depends-on, verified-by, introduced-by}; a
  genuinely-unknown kind → throw.
- each node `id` is syntactically a `sha256:<64hex>`; else throw.
- each `source_ref` matches an allowed scheme (the complete closed set — SCHEMA.md):
  `sha256:<64hex>` | `file:<path>@<40hex>` | `ledger:<path>#<64hex>` | `git:<40hex>`; else throw.
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
- **per-branch ingestion negatives** (one fixture EACH, so every rejection branch is proven): unknown node
  kind, unknown edge kind, invalid node-id syntax, disallowed source_ref scheme, each missing required field,
  each mistyped field, duplicate node, duplicate edge, dangling edge, unparseable line, snapshot-digest
  mismatch, manifest-digest ≠ CURRENT-AUTHORITY → each throws.
Pinned semantics (frozen in `metrics.json`): `depends-on` = `from` dependent → `to` dependency;
`dependencies` = transitive forward closure (visited-set, fixpoint); `blastRadius(depth)` = reverse-reachable
dependents to `depth` hops (node excluded), visited-set; `relevance` = `raw = 3·(depends-on in) + 2·(verified-by
in) + 1·(introduced-by in)`, `normalized = raw / MAX_RAW` over ALL nodes, `MAX_RAW==0 → 0`;
**`riskClass` uses `blastRadius` at a PINNED depth `RISK_BLAST_DEPTH` = the full transitive reverse closure
(unbounded, visited-set cycle-safe) — the true blast radius, so the class is depth-deterministic** = `high` if
that blastRadius `≥ 10` OR relevance `≥ 0.66`; else `medium` if `≥ 3` OR `≥ 0.33`; else `low`; composition =
max of the two class drivers, then coverage-floored (§4). A fixture pins the depth-dependence (a dependent
beyond a fixed small depth still counts).

## 4. Honest completeness — Lachesis does NOT certify completeness (fixes obj. 1)

Presence of one edge per kind does NOT prove completeness; inferring it is the rejected false-completeness
rule. Lachesis STRUCTURALLY cannot certify a snapshot is complete, so it stops trying — completeness is
ATTESTATION-GATED with a closed, verifiable schema:
- **Attestation schema (closed, frozen in `metrics.json`):** `{ snapshot_digest: <sha256:64hex>, node_id:
  <sha256:64hex>, coverage: "complete", attested_by: <authority anchor> }`; the attestation record's own
  content-digest is pinned in `CURRENT-AUTHORITY.json` (same trust anchor as §1). Any extra/missing field or
  wrong type → treated as absent (unverified).
- **Verification (all must hold, else `unverified`):** the attestation's digest matches the CURRENT-AUTHORITY
  pin; `snapshot_digest` == the loaded snapshot's verified digest (§1); `node_id` == the target node;
  `attested_by` resolves to an authority anchor pinned in CURRENT-AUTHORITY; `coverage` == "complete".
- `coverage(nodeId)` ∈ `attested-complete` (all checks pass) | `unverified` (otherwise). **riskClass is
  floored: `low` ONLY when coverage == `attested-complete`; otherwise bumped to at least `medium` with
  `coverage: "unverified"`.**
- **Oracle:** POSITIVE (valid attestation → `attested-complete`, an otherwise-low node stays `low`) + NEGATIVES
  each proving the floor: absent attestation, unauthorized `attested_by` (not in CURRENT-AUTHORITY),
  stale-snapshot (`snapshot_digest` mismatch), wrong-node (`node_id` mismatch), malformed schema → each →
  `unverified` and an otherwise-`low` node is floored to `medium`.
The prior presence-based `expected-coverage.json` is REMOVED (it was the false rule).

## 5. Boundary, layout, package

Lachesis reads the committed weave snapshot `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl` as DATA
— never `import`s `clotho/`; its metrics are its own. `lachesis/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`;
`CONTRACTS/{metrics.json, snapshot-manifest.json}` (manifest digest pinned in CURRENT-AUTHORITY);
`DECISIONS/rejected-alternatives.md` (rejected: import `clotho/query.mjs`; re-implement blastRadius/deriveNodeId
— drift; presence-based completeness — false rule; caller-supplied digest — substitutable; unpinned working-tree
manifest — mutate-both bypass; narrowed edge-kind set — must accept the complete closed set; unpinned
risk-blast depth — non-deterministic class); `NON-CLAIMS.json`/`.md` (measures ≠ authorizes/retires/weaves/renders;
risk advisory; relevance a proxy; does NOT certify completeness; does NOT re-derive content-addresses; consumes
a snapshot, not the live ledger); `FAILURE-MODES.md`; `EVIDENCE/`; `comprehension-queries.json`; `README.md`.
`package.json`: `"type":"module"`, zero deps, `npm test` → `test-metrics.mjs`.

## 6. Acceptance sequence (documentation-first)

1. Author `metrics.json` (SPECIFIED-PENDING-IMPLEMENTATION + `becomes_normative_when` = test-metrics.mjs
   passes) + `snapshot-manifest.json` + full memory set; render README (`--check`). 2. Comprehension gate:
   pass→0; negatives ("Lachesis authorizes", "risk enforced", "relevance is ground truth", "certifies
   completeness", "recomputes node-ids", "caller supplies the digest", "the manifest is self-authenticating",
   "the loader accepts only three edge kinds")→nonzero, each proving its misconception.
   3. Argo implements `ingest.mjs` + `measure.mjs` + fixtures + `test-metrics.mjs` until `npm test` exits 0 and
   `metrics.json` flips to NORMATIVE-CURRENT. 4. Minimal enrollment flip (routed to The Eye at authz).
   5. `verify-contracts.mjs` exits 0. Terminal is submit, not authorization.

## 7. Non-goals (cycle 1)

No `import` of `clotho/`; no re-implementation of Clotho's query API or `deriveNodeId`; no content-address
recomputation (digest is the trust root); no completeness certification (attestation-gated); no enforcement
from the risk class (advisory); no Atropos/Narcissus work; no npm dependency; no extension of the registered
meaning.
