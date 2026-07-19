---
type: reference
topic: clotho
status: living
rendered: true
note: RENDERED PROJECTION of the machine records in clotho/memory/ — do NOT edit directly. The source of truth is IDENTITY.md, INVARIANTS.json, NON-CLAIMS.json, CONTRACTS/, DECISIONS/, and EVIDENCE/. Change those, then re-render this.
---

# Clotho — component README (rendered)

**What it is.** Clotho is TELOS's provenance-aware knowledge-graph weaver — it *"creates
and maintains knowledge-graph threads across artifacts and repositories."* It threads
content-addressed edges across code, tests, docs, contracts, and ledgers so causal
history is machine-recoverable. Advisory / non-sandboxed; zero runtime dependencies;
ESM `node:` stdlib; the spine is read-only.

**What it does (Phase 1 complete, plan v15 / authz-008).** Provides the closed
inventory and registry, signed thread ledger, shared D33 classifier/resolver and
counted-source substrate, all five git/code/test/doc/ledger weavers, the pure query
surface, and the complete-weave driver. The driver enforces consumption and
attribution before append, re-derives mechanism provenance before publication, and
publishes a verified ledger atomically without replacement. The flagship and
self-weave reproduction close Tasks 6 and 7.

**How to run.** `cd clotho && npm test` (syntax check plus 14 ordered test programs).
Contract-vs-code:
`node docs/institutional-memory/verify-contracts.mjs`.

**What it does NOT claim.** Not a JavaScript sandbox; **not a complete ECMAScript
parser** (a dependency-free lexical scanner over a closed profile that *refuses*
out-of-profile input); does **not** prove loader analysis or containment; does not
execute package commands; does not default query coverage to verified; and does not
promote the eight-group flagship into a total-coverage claim. See `NON-CLAIMS.md`.

**Load-bearing invariants** (`INVARIANTS.md`, each with an oracle): `d33-fail-closed-profile`,
`d33-deny-based-regex`, `d21-original-order-containment`, `inventory-id-table-frozen`,
`d32-loader-safe-exports-frozen`, `closure-equality-proven`,
`d25-command-inferred-provenance`, `d31-independent-contract-files`,
`d35-closed-coverage-schema`, `d34-publication-time-drift-abort`,
`d10-am39-producer-attribution`, and `d8-self-weave-exclusion`.

**Decisions** (`DECISIONS/`): AM-40 (PACKAGE_ROOTS = TELOS spine), AM-41 (enforced source
profile + leading-shebang carve-out), and the **rejected alternatives** (full ES parser;
override-codex-by-majority) — recorded so they are not rediscovered as novel.

**What changed.** Task 4a was accepted at `git:f12e5d2` with a deferred adversarial
backlog. Task 4b was accepted at `git:af64b88`; Task 5 delivered the query/driver
surface at `git:321473a`; Task 6 delivered the reviewed flagship at `git:ea6a15d`;
Task 7 closed Phase 1 at `git:983aad5`. No v15 slice remains pending.

**Before you modify anything:** read root `AI-START-HERE.md`, answer
`clotho/memory/comprehension-queries.json`, and pass
`docs/institutional-memory/comprehension-gate.mjs`. You have no implementation authority
until it exits 0.

**Completed design substrate (Tasks 4b–7).** The decisions in
`DECISIONS/task-4b-decisions.md`, `task-5-decisions.md`, and
`task-6-7-decisions.md`; the coverage/provenance/discharge contracts; and the
`d25-*`, `d31-*`, `d35-*`, `d34-*`, `d10-*`, and `d8-*` machine invariants are all
`NORMATIVE-CURRENT` with their named executable oracles. The per-task comprehension
queries remain durable records of the traps implementers had to understand; they are
not evidence that those tasks remain pending.
