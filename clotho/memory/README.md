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

**What it does (as of Task 4a, plan v15 / authz-008).** Provides the closed inventory
(`inventory.mjs`), the shared substrate (`weavers/util.mjs`: the D33 classifier/resolver
under the enforced source profile, counted iterators, containment, the no-shell git
wrapper), and the git + code weavers. Earlier slices provide the closed registry
(`registry.mjs`) and the signed thread ledger (`thread-ledger.mjs`).

**How to run.** `cd clotho && npm test` (7 suites, all green). Contract-vs-code:
`node docs/institutional-memory/verify-contracts.mjs`.

**What it does NOT claim.** Not a JavaScript sandbox; **not a complete ECMAScript
parser** (a dependency-free lexical scanner over a closed profile that *refuses*
out-of-profile input); does **not** prove loader analysis or containment; does not yet
provide the orchestrator/test/doc/ledger weavers (Tasks 4b/5). See `NON-CLAIMS.md`.

**Load-bearing invariants** (`INVARIANTS.md`, each with an oracle): `d33-fail-closed-profile`,
`d33-deny-based-regex`, `d21-original-order-containment`, `inventory-id-table-frozen`,
`d32-loader-safe-exports-frozen`, `closure-equality-proven`.

**Decisions** (`DECISIONS/`): AM-40 (PACKAGE_ROOTS = TELOS spine), AM-41 (enforced source
profile + leading-shebang carve-out), and the **rejected alternatives** (full ES parser;
override-codex-by-majority) — recorded so they are not rediscovered as novel.

**What changed.** Task 4a accepted (`git:f12e5d2`, PR #117) under v15 with a deferred
minor-fix backlog (`docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md`). Next: Task 4b.

**Before you modify anything:** read root `AI-START-HERE.md`, answer
`clotho/memory/comprehension-queries.json`, and pass
`docs/institutional-memory/comprehension-gate.mjs`. You have no implementation authority
until it exits 0.

**Design substrate for pending tasks (4b–7).** The frozen v15 scope for the not-yet-built
tasks is captured machine-first — `status: SPECIFIED-PENDING-IMPLEMENTATION` (authority
v15/authz-008, oracle pending): decisions (`DECISIONS/task-4b-decisions.md`,
`task-5-decisions.md`, `task-6-7-decisions.md`), contracts (`CONTRACTS/coverage-schema.json`,
`verified-by-provenance.json`, `discharges-matrix.json`), invariants (the `d25-*`, `d31-*`,
`d35-*`, `d34-*`, `d10-*`, `d8-*` entries in `INVARIANTS.json`), and per-task comprehension
queries (`comprehension-queries.{4b,5,6,7}.json`). To implement one of these tasks: load its
records, pass its comprehension gate, then write code until each `becomes_normative_when`
oracle passes — at which point the record flips to `NORMATIVE-CURRENT`. This is
documentation-first: the contract is the intent; the code proves conformance.
