# Clotho Task 3 — TELOS review record (gate + required-seat review)

Durable evidence for the acceptance of **PR #115** (Clotho Task 3 —
`clotho/thread-ledger.mjs`), kept separate from the confined implementation.

## Heads

| Anchor | Value |
|---|---|
| Reviewed head (gate + required-seat approval) | `8eda6023d685abca9578b5dd953df0d5f924f80e` |
| Merge anchor (squash merge into main) | `f6192176292c1e6ea590094d7b63fbb02431ffab` |
| Plan | v12 `sha256:bdc93901…` · authz-005 · Eye impl-authorization #109 |

v12 requires implementation tasks to **squash merge**, so the reviewed head is
not a parent of the merge commit; this record binds the two explicitly.

## What Task 3 delivers

`createLedger` / `verifyLedger` / `readEdges` — a signed, append-only,
hash-chained canonical-JSONL thread ledger. The weave owns one timestamp, one
Ed25519 keypair, and every envelope/accounting fact (D5); records are
canonical-JSON lines chained by `prev_hash` and signed over the raw record-hash
digest (LF-terminated). Generic ledger integrity **only**, against injected
fixtures (D19 — no committed-inventory dependency; equality with committed
inventories is the Task 5 driver's job). D24 `inspected_source_counts` schema;
D22 descriptor discipline (idempotent abort, every failure path closes the fd,
poison-on-failure); D29 verifier boundary; exclusive `wx` creation; human-only
status transitions. Zero dependencies, ESM, `node:` stdlib + clotho-relative
imports only; nothing in the spine imports from `clotho/`.

## Deterministic gate

`gate.mjs` → `gate-result.json`: **finalStatus `meets`** — all checks pass over
the real on-disk artifacts (ledger + test present and real; `createLedger`/
`verifyLedger`/`readEdges` exported; test exercises `verifyLedger`;
`check`/`test-all` exit 0; zero dependencies; `node:`/clotho-relative imports
only — no spine import; diff confined to `clotho/`).

## Required-seat review — 14-round convergence

`run-slice-3-review.mjs` (signed council; claude/agy/codex required,
grok/gemini advisory). The signed ledger is the most invariant-dense slice so
far, and the loop ran long: every round narrowed to a genuine faithfulness or
frozen-scope defect, each repaired at the source. Highlights of the arc
(`round1-…` … `round13-…` hold the per-round packets):

- **R1–R4** — contract fixes: `forEach` private-`Set` leak, unauthorized
  exports removed, exact-object validation, edge-node-id re-derivation, private
  fixture git allowlist, trust-freeze + exact header/`repository_ref`/`pub_key`
  shape, streaming byte-exact `verifyLedger`.
- **R5–R11** — `close()` idempotency + poison-on-failure, all-or-error writes,
  byte-exact verify (raw-byte LF split, strict UTF-8, prior-line hash),
  canonical-base64 signatures, line-level CR detection, `wovenAt` validation,
  strict own-enumerable schema (prototype-pollution / non-enumerable / symbol),
  integer (not safe-integer) `version` label.
- **R13 → final** — two remaining required-seat findings (codex): a **non-private
  Ed25519 `signKey` was accepted at creation** (`asymmetricKeyType` names the
  algorithm, not the role — a public KeyObject also reports `"ed25519"`); and
  the frozen unit matrix lacked the **property-absent** `implementation_refs` /
  `orchestrator_refs` cases at close-time and independently-signed verify-time.
  Both were fixed, then codex ran an **exhaustive pass past those flags and
  found nothing further** (`approve`, empty edits), so both landed in one
  revision (revision 13, head `8eda6023`) rather than dragging into further
  rounds.

| round | outcome |
|---|---|
| 1–13 | REVISE, converging (see `roundN-review-*.json`) — codex the persistent required dissenter |
| 14 | **PASS** — required seats claude/agy/codex **approve/high, signed**, 0 blockers; grok/gemini advisory approve/high |

## Provenance (round 14, real per-seat)

claude `claude-fable-5` · agy `agy-checkpoint` (local-deterministic) · codex
`gpt-5.6-sol` — all signed under the gate (signing + provenance enforced,
`gate_status` pass). Advisory: grok `grok-4.5`, gemini `gemini-3.1-pro-preview`.

## Status

Task 3 accepted by The Eye (squash-merged, `f619217`); `main` green. Task 4a
(inventory + shared classifier/resolver + git & code weavers) follows.
