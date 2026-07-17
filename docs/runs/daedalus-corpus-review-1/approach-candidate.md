# Daedalus corpus-review v1 — implementation approach (for Daedalus review)

Scope: the first corpus-level Daedalus review over the published Clotho weave —
the consumer named by docs/daedalus-methodology.md#corpus-level (HELD by The Eye
2026-07-15), now in scope because Clotho Phase 1 is complete. Plus one recorded
maintenance item. This is an ADVISORY report harness; it enforces nothing.

## Deliverables (single-writer cycle)

1. `docs/runs/daedalus-corpus-review-1/run-review.mjs` — keyless, deterministic:
   - INPUT: the committed snapshot `docs/runs/clotho-self-weave/
     thread-ledger.snapshot.jsonl` via `verifyLedger` (fail-closed on !ok), plus
     the verified manifest — every query runs coverage-aware (D35).
   - LINEAGE QUERIES over the graph, per the methodology's four detection targets:
     a. **claim-to-proof gaps** — for every spine mechanism module's code-symbols
        reached in the graph: `reportGaps` with expectedKinds
        [introduced-by, discharges] — symbols carrying obligations without clause
        discharges, or lacking introduction lineage, are listed;
     b. **repair-induced-defect signals** — for each of the repo's high-churn
        mechanisms (weavers/util.mjs, thread-ledger.mjs, weave.mjs, query.mjs,
        gate/daedalus in build-gate): `blastRadius` depth 2 profiles (affected
        count, evidence count, truncation) — the widening measure the
        harvest-1 studies used, now computed from evidence;
     c. **verification coverage** — `verified-by` in-degree per artifact module:
        modules whose symbols carry zero verified-by edges are the untested tail;
     d. **documentation coverage** — `documented-in` presence per mechanism
        module; missing-doc modules listed.
   - OUTPUT: `corpus-review-report.json` (deterministic, sorted, UNSCORED — no
     relevance/rank; Lachesis's domain is not claimed) + a rendered
     `corpus-review-report.md` summarizing counts and naming the top findings
     with their node descriptors. Exit nonzero only on verification failure or
     internal error — findings are ADVISORY, never a gate.
2. Maintenance (adopted from the slice-7 retrospective):
   - the parameterized workshop harness
     `docs/institutional-memory/iliad/tools/run-daedalus-workshop.mjs`
     (built at cycle start; THIS workshop is its first user);
   - flagship-matcher dedup: export the matcher from `clotho/scripts/
     test-flagship.mjs` is NOT touched this cycle (its import-time execution
     makes refactor risky mid-cycle); instead RECORD the dedup as requiring a
     dedicated clotho maintenance slice — the report notes the duplication.

## Honest boundaries (review these)

- ADVISORY throughout: the report detects and names; methodology ENFORCEMENT
  rules (e.g., "two repair-induced findings trigger redesign") become candidates
  only after this first report shows what the corpus supports.
- The corpus v1 is the WEAVE (code/test/doc/ledger/git facts), not the full
  Daedalus negotiation lineage — delta artifacts/events are docs/runs evidence
  not woven as first-class edges; a future cycle may add a lineage adapter as a
  reviewed LEDGER_SOURCES change (Eye path exists; not assumed here).
- No new component boundary: this is Daedalus tooling + evidence, not Lachesis
  (deferred; needs The Eye per CHANGE-PROTOCOL).

## Risks / open points

- R1: blastRadius depth-2 over ~4000 records × ~6 mechanisms — runtime bound?
  (queries are pure/in-memory; expect seconds. Confirm acceptable without an
  index, per accepted-risk #4 'no Phase 1 index'.)
- R2: module→symbol enumeration — derive from the graph's own code-symbol
  locator paths (no re-scanning source), so the report's universe is exactly
  what the weave proved.
- R3: report determinism — snapshot is committed; queries pure; sorting total.
  The only environment input is the snapshot path. Confirm nothing else leaks.
