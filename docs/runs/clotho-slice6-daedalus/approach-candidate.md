# Slice-6 implementation approach — candidate (for Daedalus review)

Scope: implement Clotho Task 6 EXACTLY per the frozen plan v15 Task 6 clause
(lines 1910–2021). Approach only; amends nothing.

## Deliverables (single-writer slice, per System Evaluation #2)

1. `clotho/scripts/test-flagship.mjs` — the flagship acceptance test:
   - Step 1: spawn a REAL full-repository weave to a unique ignored path below
     `.telos/clotho/`; require exit 0, publication `published` (clean), no fatal
     warning, wall time < 120s; capture edge count/bytes/nonfatal warnings.
   - Step 2: `verifyLedger` → ok:true; header `repository_ref` equals the
     independently derived value; manifest: five weavers `executed`, well-formed
     `implementation_refs`/`orchestrator_refs`, D24-conformant counts incl. the
     ledger weaver's `contract-files` cardinality (D31); `implementation_refs` and
     `orchestrator_refs` proven equal to independently derived closures (D33/AM-34).
   - Step 3: target code-symbol `{repository_ref, path: "merkle-dag/obligation.mjs",
     symbol: "deriveExecutableRef", blob_sha}`; `why` with all five expected kinds +
     `blastRadius` depth 3 with the verified manifest (`coverage: "verified"`,
     `coverageUnknown: []`); fact set = stable union of target + why.chain +
     blastRadius.edges; one-to-one expectation matching over all eight groups;
     D3 review set = fact-set minus matched, deterministically sorted, written next
     to the temporary output and published in run evidence — NO relevance scores;
     ledger-only `why.gaps` empty; then the `currentDocs` freshness re-run (Map
     shape per the recorded slice-5 integration contract) requiring no drift gap.
   - Step 4: second weave with `--skip clotho-doc-weaver`; manifest: doc weaver
     `skipped` zero counts, other four `executed`, ledger `contract-files` at full
     cardinality (D31); no edge asserted by the doc weaver; ledger-only calls yield
     EXACTLY `{gap: "coverage-unknown", weaver: "clotho-doc-weaver",
     expected_kind: "documented-in"}` (never missing-edge, never fabricated);
     `blastRadius` without manifest → `"unverified"` + conservative non-empty
     `coverageUnknown`; with the skip-manifest → `"verified"` naming the doc weaver
     when consulted; the other seven groups (incl. ledger-derived contract
     discharge) still match with documentation expectations removed.
   - `finally`-block temp-ledger cleanup that never masks a prior assertion.
2. `clotho/scripts/expected-flagship.json` — the hand-audited expectation artifact:
   entries from exactly the eight groups; node expectations
   `{source_group, subject:"node", kind, locator_match}`; edge expectations with
   the full seven-field shape; exact JSON values only (no regex/glob/prefix/short
   SHA/node id); D25-correct test provenance (command-inferred → package.json
   content address; import-derived → test file's content address); commit
   expectations use full 40-hex SHAs.
3. `docs/runs/clotho-impl-slice-6/generate-expectations.mjs` — audit-assist
   generator: derives candidate expectations from a verified real weave + git,
   emitting the artifact for HAND-AUDIT; The Eye reviews the exact artifact at PR
   review (recorded in the acceptance note; the generator is evidence tooling, not
   shipped test surface).

## Key mechanism decisions (review these)

- **repository_ref is runtime-injected, audited content hashes are stored** (per
  step 3's split: "with the derived repository ref and the audited current blob
  SHA"): the artifact stores every audited `blob_sha`/`text_sha256`/`entry_hash`/
  `summary_sha256` but NOT repository_ref; the test derives repository_ref once and
  injects it into every locator_match before matching. Rationale: repository_ref
  changes every commit; storing it would invalidate the artifact on any push,
  which cannot be the clause's intent for an `npm test` member.
- **Staleness = re-audit trigger:** expectations pin current content addresses of
  the flagship neighborhood; a commit changing those files legitimately fails the
  flagship test until the artifact is regenerated AND re-audited (The Eye) — that
  is the designed review pressure, not a defect. Recorded in the artifact header.
- **Wiring:** test-all gains `scripts/test-flagship.mjs` at integration (single
  writer); the 120s ceiling is asserted inside the test.

## Risks / open points for review

- R1: is the repository_ref runtime-injection reading of the clause correct, or
  must the artifact literally store the audited repository_ref (accepting
  per-commit regeneration)?
- R2: review-set publication — "written next to the test's temporary output and
  later published in the run evidence": propose write to the temp dir during the
  run, then copy into docs/runs/clotho-impl-slice-6/review-set.json as committed
  evidence. Confirm this satisfies "published".
- R3: two full weaves per test run (~2× wall) under the 120s ceiling each — any
  CI-runtime concern?

## Non-goals

No relevance/rank/confidence anywhere (Lachesis's domain, non-claimed); no plan
amendment; advisory posture unchanged; zero dependencies.
