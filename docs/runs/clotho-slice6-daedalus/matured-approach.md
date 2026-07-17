# Slice-6 implementation approach — revised (author round)

Scope: implement Clotho Task 6 EXACTLY per the frozen plan v15 Task 6 clause
(lines 1910–2021). Approach only; amends nothing.

## Deliverables (single-writer slice, per System Evaluation #2)

1. `clotho/scripts/test-flagship.mjs` — the flagship acceptance test:
   - Step 1: spawn a REAL full-repository weave to a unique ignored path below
     `.telos/clotho/`; require exit 0, publication `published` (clean), no fatal
     warning, wall time < 120s; capture edge count/bytes/nonfatal warnings.
   - Step 2: `verifyLedger` → ok:true; header `repository_ref` equals the
     independently derived value; manifest: five weavers `executed`, well-formed
     `implementation_refs`/`orchestrator_refs`, D24-conformant
     `inspected_source_counts` over each weaver's required inventory ids from the
     frozen table incl. the ledger weaver's `contract-files` cardinality equal to
     the committed contract-files inventory length (D31); content-addressed
     `inventories_consumed` entries checked BEFORE any query or expected-set
     match; `implementation_refs` AND `orchestrator_refs` each proven equal to
     the independently derived complete accepted module-load closures (D33/AM-34
     test 23). All subsequent queries use only the `records` and `manifest`
     returned by this successful verification; verification itself establishes
     that every weaver-asserted edge agrees with the manifest.
   - Step 3: target code-symbol `{repository_ref, path: "merkle-dag/obligation.mjs",
     symbol: "deriveExecutableRef", blob_sha}` with the derived repository ref and
     the audited current blob SHA; `why` with all five expected rationale/support
     kinds + `blastRadius` depth 3, both with the verified manifest
     (`coverage: "verified"`, `coverageUnknown: []`, D35); node descriptors built
     solely from the target and verified edge endpoint descriptors; fact set =
     stable union of target + why.chain + blastRadius.edges (inverse-dependency
     `affected` closure plus its `verified-by` evidence, per the frozen
     semantics); one-to-one expectation matching over all eight groups with
     group-semantics validation (definition = target node; consumers = incoming
     `depends-on`; tests = reachable `verified-by`; introduction =
     `introduced-by`; documentation targets `doc-section`; concern =
     `motivated-by`; run-evidence = `evidenced-by`; contract = the audited
     two-hop discharge walk `code-symbol --discharges--> obligation
     --discharges--> contract-clause`); duplicate expectations rejected as
     invalid; every audited consumer and test expectation obtains a distinct
     match; D3 review set = exactly fact-set minus matched facts,
     deterministically sorted, written next to the test's temporary output and
     later published in run evidence (see R2 resolution) — NO relevance, rank, or
     confidence values, no unexpected fact treated as validated or used to hide a
     missing match; ledger-only `why.gaps` empty; then the `currentDocs`
     freshness re-run: independently build currentDocs from current configured
     docs/contracts as Map<docAddressKey, text_sha256|null> (null =
     deleted/ambiguous, per the recorded slice-5 integration contract), repeat
     `why`, require no drift gap. Only this freshness check reads current files;
     the preceding fact reconstruction is strictly ledger-only.
   - Step 4: second weave with `--skip clotho-doc-weaver` to a second unique
     ledger; verify it; manifest: doc weaver `skipped` (never `failed` in any
     published manifest) with zero counts over its required inventory ids and
     implementation refs intact, other four `executed`, ledger `contract-files`
     at the full committed cardinality proving contract consumption belongs
     solely to the ledger weaver (D31); verification + manifest-aware query
     validation establish no edge is asserted by `clotho-doc-weaver`; rerun the
     same ledger-only calls with that manifest, requiring EXACTLY
     `{gap: "coverage-unknown", weaver: "clotho-doc-weaver",
     expected_kind: "documented-in"}` (not a missing-edge claim, not merely a
     smaller result, no fabricated `documented-in` edge); `blastRadius` against
     the same records WITHOUT a manifest → `coverage: "unverified"` + non-empty
     conservative `coverageUnknown`; WITH the verified skip-manifest →
     `coverage: "verified"` reporting `clotho-doc-weaver` when its kinds are
     consulted (D35/AM-37); documentation expectations removed for this negative
     run, and the other seven groups — including the ledger-derived contract
     discharge resolved from the ledger weaver's own counted contract-files
     consumption — still match distinctly; any gap other than the asserted
     `coverage-unknown` fails the test.
   - `finally`-block cleanup of BOTH temporary ledgers that never masks a prior
     assertion (cleanup errors recorded, original assertion rethrown).
2. `clotho/scripts/expected-flagship.json` — the hand-audited expectation
   artifact: entries from exactly the eight groups (`definition`, `consumers`,
   `tests`, `introduction`, `documentation`, `concern`, `run-evidence`,
   `contract`); node expectations `{source_group, subject:"node", kind,
   locator_match}`; edge expectations `{source_group, subject:"edge", edge_kind,
   from_kind, from_locator_match, to_kind, to_locator_match, source_ref}`; exact
   JSON values only (no regex/glob/prefix/short SHA/node id); locator matches
   carry the FULL content-bound schemas including `repository_ref` and the
   audited `blob_sha`/`text_sha256`/`entry_hash`/`summary_sha256` values from the
   reviewed repository state for every repository-scoped kind named (see R1
   resolution); D25-correct test provenance — the artifact contains at least one
   command-inferred `verified-by` expectation naming the `package.json` content
   address AND at least one import-derived expectation naming the test file's
   content address, so the exit criterion "both `verified-by` provenance cases"
   is exercised; commit expectations use the audited full 40-hex introduction
   SHA; file and ledger source refs are exact content addresses from the
   reviewed repository state.
3. `docs/runs/clotho-impl-slice-6/generate-expectations.mjs` — audit-assist
   generator: derives candidate expectations from a verified real weave + git,
   emitting the artifact for HAND-AUDIT; The Eye reviews the exact artifact at PR
   review (recorded in the acceptance note; the generator is evidence tooling,
   not shipped test surface). The hand-audit is substantive: audited values
   (blob SHAs, content addresses, 40-hex introduction SHA, multiplicities) are
   independently confirmed against the reviewed repository state, not merely
   regenerated — the generator output is a draft, never self-certifying.

## Settled points (R1–R3 resolved per the frozen material)

- **R1 — RESOLVED: the artifact stores the audited repository_ref; no runtime
  injection.** The frozen clause is explicit and decides this: "Locator matches
  carry the full content-bound schemas, **including the derived
  `repository_ref`** and the audited `blob_sha`… values from the reviewed
  repository state," and match objects contain "exact JSON values only." A
  runtime-injected repository_ref would make the reviewed artifact differ from
  the matched artifact, breaking D3's "The Eye reviews the exact artifact" and
  the hand-audit guarantee. Step 3's "with the derived repository ref" governs
  how the TEST constructs the target descriptor, and the test independently
  derives repository_ref to ASSERT it equals the value stored in the artifact
  (and the verified header, per Step 2) — it does not rewrite the artifact.
  Consequence accepted: any commit changing the flagship neighborhood or the
  repository state invalidates the artifact until regenerated AND re-audited by
  The Eye. That per-commit review pressure is the designed behavior of a
  hand-audited, content-bound acceptance target (recorded in the artifact
  header), not a defect. Any relief from this cost is a plan change and is out
  of scope for this slice.
- **R2 — RESOLVED per D3/D8:** the review set is written next to the test's
  temporary output during the run (satisfying "written next to the test's
  temporary output") and published in the run evidence via the Task 7
  self-weave evidence surface (D8 lists `review-set` among the published
  artifacts of `docs/runs/clotho-self-weave/`), using the same D34
  re-derivation + D28 atomic discipline. Slice 6 emits the deterministically
  sorted review-set artifact and stages it under
  `docs/runs/clotho-impl-slice-6/review-set.json` as committed slice evidence;
  Task 7 owns the canonical run-evidence publication. Publication into
  `docs/runs/` never occurs into any path consumed by weaver inventories in a
  way that violates D8's self-ingestion exclusion.
- **R3 — RESOLVED: not a defect.** The frozen clause fixes a 120s ceiling per
  Step 1 weave and mandates two weaves; the exit criterion binds "the runtime
  ceiling" as specified. Worst case ~2×120s plus verification/matching is the
  frozen budget; the test asserts the ceiling on each weave individually and
  makes no additional CI-runtime claim. Any tighter budget is a plan concern,
  not an implementation choice.

## Key mechanism decisions

- **Ordering discipline:** verification (including inventories_consumed,
  count, and closure checks) completes before any query or expected-set match,
  in both Step 2 and Step 4, exactly as the clause sequences it.
- **Deterministic review-set sort:** canonical JSON serialization of each fact,
  sorted bytewise — no locale, no timestamp, no score fields; the test asserts
  review set == fact-set minus matched facts by exact set equality.
- **Wiring:** test-all gains `scripts/test-flagship.mjs` at integration (single
  writer); the 120s ceiling is asserted inside the test for each weave.

## Non-goals

No relevance/rank/confidence anywhere (Lachesis's domain, non-claimed); no plan
amendment; advisory posture unchanged; Node >=18, ESM, zero dependencies,
fail-closed throughout.