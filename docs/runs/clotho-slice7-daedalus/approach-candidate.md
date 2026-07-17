# Slice-7 implementation approach — candidate (for Daedalus review)

Scope: implement Clotho Task 7 EXACTLY per the frozen clause (v15 lines 2023–2097).
Approach only; amends nothing. This is Phase 1's closure slice.

## Deliverables — TWO parallel disjoint-writer agents + single-writer integration

- **agent-D (documentation/housekeeping; FIRST in effect):** update `docs/STATUS.md`
  and `docs/ROADMAP.md` to current (Clotho Phase 1 slices 0–7, the lifecycle, the
  suite mantra), move completed design/plan artifacts to `docs/history/` per the
  existing convention (docs/history/ already holds sdd-progress.md). Writes ONLY:
  docs/STATUS.md, docs/ROADMAP.md, docs/history/* (moves).
- **agent-R (reproduction):** author `docs/runs/clotho-self-weave/run.mjs` — keyless
  full weave to a unique temp below `.telos/clotho/`; verify (header repository_ref,
  five weavers executed, mechanism-bound refs equal to derived closures per D33
  re-derived per D34, inventories_consumed, D24/D31 counts, no manifest/record
  contradiction); complete the flagship expected-set/review-set/gap/current-doc
  checks BEFORE publishing any evidence; publish `thread-ledger.snapshot.jsonl`
  (containment immediately before publication; stale prior snapshot removed
  explicitly + exclusive link — no rename-over; D28 commit point;
  published-cleanup-incomplete is nonzero for committed evidence); write
  `summary.json` (repo head, repository_ref, timestamp, public key, snapshot
  SHA-256, wall time, edge count, bytes, per-weaver manifest entries + refs +
  counts, orchestrator refs, inventories_consumed, publication state =
  `published` clean, warnings, full why chain, blastRadius affected/evidence/edges
  with `coverage: "verified"`, empty gaps, all eight groups; the EXACT D34
  provenance statement verbatim); `expected-match-report.json` (each expectation +
  its unique match, zero unmatched); `review-set.json` (unscored, sorted);
  `verification.json` (snapshot status, trusted count, manifest states/refs,
  consistency, closure results incl. D34 re-derivation, advisory counts both
  directions incl. D30/D32 + shared-grammar proof — as review signals; every
  package test command + exit status + Node version; NO absolute paths or pids).
  Exit nonzero on every clause-listed failure class; finally-cleanup of partial
  temps; a committed publication never rolled back. Writes ONLY under
  docs/runs/clotho-self-weave/.

- **Integration (single writer, AFTER both merge — ordering preserves 'housekeeping
  before final evidence'):** EXECUTE run.mjs to generate + commit the evidence;
  flip `d8-self-weave-exclusion` → NORMATIVE (oracle: run.mjs + the flagship suite;
  GLOBAL_EXCLUDE already pins the exclusion in test-inventory); run
  `cd clotho && npm test` then EVERY other tracked package's test command; re-run
  the advisory scanner post-moves and retain counts; record the final-diff review.

## Key readings (review these)

- **Final-diff rule scope:** "only clotho/, .gitignore, status/roadmap, history
  moves, and self-weave evidence may change" governs the TASK-7 SLICE's own diff
  (its commits), not the whole PR #126 branch (whose broader content is
  Eye-accepted work under other tasks/rulings); recorded honestly in the
  acceptance note either way. No spine source changes in slice-7 commits.
- **d8 flip evidence:** self-export dir excluded from all input inventories
  (GLOBAL_EXCLUDE pins docs/runs/clotho-self-weave) so repeated runs cannot
  consume old snapshots; the run + flagship checks are the becomes_normative_when
  oracle.
- **Renderer deferral:** the clotho/memory README renderer remains an
  OPEN-QUESTIONS candidate — NOT mandated by the frozen clause; deferred to a
  post-Phase-1 lifecycle run (recorded in the retrospective), keeping slice-7's
  diff exactly within the clause's allowed set.

## Risks / open points for review

- R1: summary.json carries timestamp/wall-time (run metadata) while "evidence
  verifies from committed bytes" — confirm the verifiable core is the snapshot +
  hashes (deterministic) and run metadata is legitimately run-specific.
- R2: "every other tracked package's existing test command" — 8 packages
  (build-gate's suite includes breakout; forge packages included) — confirm the
  battery set = every tracked package.json with a test script, run at integration
  and recorded in verification.json.
- R3: STATUS/ROADMAP rewrite depth — confirm updating in place + history moves
  for COMPLETED design/plan artifacts only (superseded plans stay where
  CURRENT-AUTHORITY's verifier re-hashes them — do NOT move
  docs/runs/clotho-daedalus-*/matured-plan-v*.md).

## Non-goals

No renderer; no spine source changes in slice-7 commits; no new claims — advisory
posture and every non-claim unchanged; zero dependencies.
