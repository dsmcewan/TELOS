# Candidate approach (rev 6) — Lachesis (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-lachesis-1.json`.
**Registered meaning (fixed):** Lachesis *measures dependencies, relevance, risk, and blast radius*. It does
metrics. No extension. Authored AI-centric / machine-first (the first-three-modules standard).

Rev 6 resolves the round-5 objections (all specification-completeness; architecture stable): §1 provenance
overclaim; attestation data-source + isolated digest-check negative undefined; SPECIFIED-PENDING missing the
authority triple; digest operation under-specified; a placeholder authority anchor.

**Digest operations (frozen, used everywhere below):** JSON records (manifest, attestation) are digested as
`sha256:` + `sha256hex(canonicalize(record))` using the sanctioned shared primitives
`canonicalize`/`sha256hex` from `merkle-dag/vendor.mjs` (per SCHEMA.md reuse; zero-dep, not the clotho spine).
The snapshot FILE is digested as `sha256:` + raw-byte sha256 of its UTF-8 bytes (`node:crypto`). Node/edge id
syntax is CHECKED as `sha256:<64hex>` but NEVER recomputed (see §1 non-claim).

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
**What the chained digest proves (restricted, honest):** that the snapshot bytes are the EXACT authorized,
integrity-checked input selected by the authenticated root — authorized selection + byte integrity. It does
NOT prove node/edge ids were correctly derived, nor that Clotho authored the bytes. Lachesis measures over the
authorized bytes AS-IS. NON-CLAIM (consistent): Lachesis verifies snapshot provenance-of-selection + structure;
it does not re-derive content-addresses or attest authorship. Negatives: mutated snapshot, mutated manifest
(both), and manifest-digest ≠ CURRENT-AUTHORITY each throw.

## 2. Fail-closed schema validation (fixes obj. 4 — defense-in-depth behind the digest)

`lachesis/ingest.mjs#loadWeave(path)` — the ONLY entry to metrics; every check throws (fail-closed):
- snapshot digest == the pinned manifest digest (§1); else throw.
- JSONL: each line parses; else throw.
- record shape by `kind`: nodes vs edges have their complete required-field set with correct types (a closed
  per-kind shape table pinned in `metrics.json`); missing/mistyped field → throw.
- `kind` ∈ the COMPLETE closed Clotho sets (pinned in `metrics.json`, authority-anchored to
  `file:clotho/registry.mjs@ed0e05c034317331e874ac511c4182580c192620`, with a change_rule to re-sync if
  Clotho's change) — NODE_KINDS =
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
- **Data source (deterministic, frozen):** attestations live in ONE file
  `lachesis/memory/CONTRACTS/coverage-attestations.json` — a JSON array of records; that file's content-digest
  (`sha256:`+`sha256hex(canonicalize(...))`) is pinned under a NAMED key
  `CURRENT-AUTHORITY.json#lachesis_coverage_attestations_digest`. `attested_by` must equal a value in the
  named authority list `CURRENT-AUTHORITY.json#lachesis_attestation_authorities`. Per-node selection = the
  record whose `node_id` == the target; **two records for one `node_id` → throw** (no ambiguity); multiple
  DISTINCT-node records are permitted.
- **Attestation schema (closed, frozen in `metrics.json`):** `{ snapshot_digest: <sha256:64hex>, node_id:
  <sha256:64hex>, coverage: "complete", attested_by: <string> }`; extra/missing field or wrong type → absent
  (unverified).
- **Verification (ALL must hold, else `unverified`):** the attestations FILE digest == the named
  CURRENT-AUTHORITY pin; the selected record's `snapshot_digest` == the loaded snapshot's verified digest (§1);
  `node_id` == the target; `attested_by` ∈ the named authority list; `coverage` == "complete".
- `coverage(nodeId)` ∈ `attested-complete` (all pass) | `unverified` (otherwise). **riskClass is floored: `low`
  ONLY when `attested-complete`; otherwise bumped to at least `medium` with `coverage: "unverified"`.**
- **Oracle:** POSITIVE (valid attestation → an otherwise-low node stays `low`) + NEGATIVES each isolating ONE
  branch so an implementation that skips that check fails: **(digest) a semantically valid record (right node,
  right snapshot, authorized) but the FILE digest ≠ the CURRENT-AUTHORITY pin → unverified**; absent record;
  unauthorized `attested_by`; stale-snapshot (`snapshot_digest` mismatch); wrong-node; malformed schema;
  duplicate `node_id` (→ throw) — and each `unverified` floors an otherwise-`low` node to `medium`.
The prior presence-based `expected-coverage.json` is REMOVED (it was the false rule).

## 5. Boundary, layout, package

Lachesis reads the committed weave snapshot `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl` as DATA
— never `import`s `clotho/`; its metrics are its own. `lachesis/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`;
`CONTRACTS/{metrics.json, snapshot-manifest.json, coverage-attestations.json}` (manifest + attestations
digests pinned under named CURRENT-AUTHORITY keys); `DECISIONS/decision-lachesis-cycle-1.json` (the AFFIRMATIVE
decision record carrying the authority triple, §6) + `DECISIONS/rejected-alternatives.md` (rejected: import
`clotho/query.mjs`; re-implement blastRadius/deriveNodeId
— drift; presence-based completeness — false rule; caller-supplied digest — substitutable; unpinned working-tree
manifest — mutate-both bypass; narrowed edge-kind set — must accept the complete closed set; unpinned
risk-blast depth — non-deterministic class); `NON-CLAIMS.json`/`.md` (measures ≠ authorizes/retires/weaves/renders;
risk advisory; relevance a proxy; does NOT certify completeness; does NOT re-derive content-addresses; consumes
a snapshot, not the live ledger); `FAILURE-MODES.md`; `EVIDENCE/`; `comprehension-queries.json`; `README.md`.
`package.json`: `"type":"module"`, zero deps, `npm test` → `test-metrics.mjs`.

## 6. Acceptance sequence (documentation-first)

0. **Authority triple (minted at the preceding TELOS gate, referenced here):** the SPECIFIED-PENDING contract
   requires the frozen triple — the plan `sha256:` (= the content-address of THIS matured approach), the
   `authz-N` minted by the TELOS council for this Lachesis quest, and the decision id of
   `DECISIONS/decision-lachesis-cycle-1.json` (the affirmative record authored from the council's ruling).
   The contract is authored in Argo (post-authorization), so the triple already exists.
1. Author `metrics.json` (SPECIFIED-PENDING-IMPLEMENTATION + the complete authority triple +
   `becomes_normative_when` = test-metrics.mjs passes) + `snapshot-manifest.json` + `coverage-attestations.json`
   + the affirmative decision record + full memory set; render README (`--check`). 2. Comprehension gate:
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
