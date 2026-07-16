# Clotho Task 2 — TELOS review record (gate + required-seat review)

Durable evidence for the acceptance of **PR #113** (Clotho Task 2 —
`clotho/registry.mjs`), kept separate from the confined implementation.

## Heads

| Anchor | Value |
|---|---|
| Reviewed head (gate + required-seat approval) | `952087094e86fc92162a750bd74742b35ff73c8c` |
| Merge anchor (squash merge into main) | `ed0e05c034317331e874ac511c4182580c192620` |
| Plan | v12 `sha256:bdc93901…` · authz-005 · Eye impl-authorization #109 |

v12 requires implementation tasks to **squash merge**, so the reviewed head is
not a parent of the merge commit; this record binds the two explicitly.

## Deterministic gate

`gate.mjs` → `gate-result.json`: **finalStatus `meets`** — all checks pass over
the real on-disk artifacts (registry + test present and real, `check`/`test-all`
exit 0 incl. the real-git fixture, zero dependencies, stdlib-only imports,
scaffold replaced, diff confined to `clotho/`).

## Required-seat review — 3-round convergence

`run-slice-2-review.mjs` (signed council; claude/agy/codex required,
grok/gemini advisory). The loop converged over three rounds, each narrowing to
genuine defects, every one repaired at the source:

| round | outcome | files |
|---|---|---|
| 1 | REVISE (claude, codex) — forEach mutation hole, unauthorized `WEAVER_IDS`/`ShallowRepositoryError` exports, outer-schema gaps, bundle under-scoped | `round1-review-*.json` |
| 2 | REVISE (codex only) — `requireExactKeys` not truly exact (non-enumerable / prototype-pollution → node-id collision), `String()` coercion in `deriveRepositoryRef`, missing endpoint/status coverage | `round2-review-*.json` |
| 3 | **PASS** — required seats claude/agy/codex **approve/high, signed**, 0 blockers | `review-summary.json`, `review-{claude,agy,codex,grok}.json` |

Advisory note: gemini's seat failed round 3 with a 429 (prepay credits depleted;
since restored). Advisory-only — it did not affect the unanimous required-seat
result, and the exact head did not move after approval, so no re-run was
warranted.

## Provenance (round 3, real per-seat)

claude `claude-fable-5` · agy `agy-checkpoint` · codex `gpt-5.6-sol` — all
signed under the gate (signing + provenance enforced, gate_status pass).

## Status

Task 2 accepted by The Eye (squash-merged, `ed0e05c`); `main` green. Task 3
(signed thread ledger) follows.
