# Clotho Phase 1 — Plan Amendments, Round 9 (normative deltas to plan v9)

Input to the ninth Daedalus delta workshop. Source: **the codex required
seat's second dissent** in TELOS authorization `authz-002`
(`docs/runs/clotho-authorization-2/`, preserved at commit `016d0e5`) against
released plan v9 (`sha256:47f6348…`, reviewed head `0598237`, merge anchor
`73baad0c`), both hard stops accepted by The Eye. A **surgical two-amendment
delta** — no unrelated architecture changes. AM-32 is a genuine D29
contradiction, not missing detail; AM-33 closes a security boundary left to
implementation-time interpretation. Requirements are fixed; a different
mechanism is acceptable only when it proves equal or stronger invariants
explicitly.

## AM-32 — Contract files are a ledger-weaver-owned counted inventory

### Defect

The ledger weaver must resolve a trusted obligation's exact
`{path, heading_path, text_sha256}` reference against current contract
bytes. Its required inventories contain only `ledger-sources` and
`run-sources`. Under D29 (an executed weaver must construct and exhaust
every required counted iterator before any of its edges may be appended),
plan v9 permits **no valid execution path**:

- reading contract files directly would be unaccounted I/O;
- consuming doc-weaver inputs would attribute reads to the wrong weaver;
- depending on doc-weaver output fails when doc-weaver is skipped;
- omitting the read drops a required contract-clause relationship.

### Normative rule

Add `contract-files` to the ledger weaver's required inventory ids. The
exact frozen row becomes:

| Weaver | Required inventory IDs |
|---|---|
| `clotho-ledger-weaver` | `contract-files`, `ledger-sources`, `run-sources` |

`contract-files` is an exact, deterministic, sorted inventory of
repository-relative contract Markdown paths committed in `inventory.mjs`.
Its count definition:

> Number of configured contract Markdown files whose exact bytes were
> opened, read, split with the canonical Markdown section splitter,
> assigned normalized heading paths and exact section hashes, and
> incorporated into a collision-checked current-contract index without
> fatal error.

Required semantics:

1. The driver constructs a dedicated counted iterator for `contract-files`
   whenever the ledger weaver executes.
2. The ledger weaver consumes and exhausts that iterator itself through
   `ctx.sources["contract-files"]`.
3. The ledger weaver builds its current-contract index from that iterator.
   It receives no map produced by doc-weaver and performs no uncounted
   fallback reads.
4. Contract files are consumed even when: doc-weaver is skipped; no
   obligation ultimately produces a clause edge; all obligation references
   are stale or absent.
5. Overlap between doc-files and contract-files is intentional: each weaver
   independently reads, counts, and proves the bytes needed for its own
   output.
6. Duplicate `{path, heading_path}` addresses use the existing fatal
   duplicate-heading-path behavior. Ambiguous sections are never silently
   selected.
7. Exact clause resolution still requires equality of
   `{path, heading_path, text_sha256}`.
8. A stale, partial, missing, or nonunique reference emits no
   `obligation -> contract-clause` edge.
9. When ledger-weaver is skipped, none of its three iterators is
   constructed or consumed and all three published counts are zero.
10. When doc-weaver is skipped but ledger-weaver executes, contract-file
    consumption belongs solely to ledger-weaver; doc-weaver remains skipped
    with zero counts.
11. The D29 accounting check occurs before any ledger-weaver edge reaches
    `appendEdge`.

### Required tests (at minimum)

1. Ledger executed, doc skipped: exact clause edge resolves from
   independently consumed contract-files.
2. Ledger executed, doc skipped: manifest reports doc counts as zero and
   the full contract-files count under ledger-weaver.
3. Ledger skipped: no contract iterator constructed and all three required
   counts are zero.
4. Contract iterator constructed for a skipped ledger-weaver: fatal driver
   contradiction.
5. Ledger under-consumes contract-files: fatal
   `incomplete-source-consumption`, no edge append, no close, no
   publication.
6. Contract expected-cardinality mismatch: fatal accounting failure.
7. Missing contract-files manifest entry: close and verification fail.
8. Extra or duplicate contract-files entry: close and verification fail.
9. Duplicate contract heading path: fatal; no ambiguous clause edge.
10. Stale hash: warning and no clause edge, while full source consumption
    is still recorded.
11. Doc and ledger weavers reading the same contract file produce
    independent counts without shared mutable state.
12. Flagship reproduction proves the contract-clause edge and the
    ledger-weaver contract-files cardinality.
13. Flagship execution with doc-weaver skipped still resolves the
    obligation's contract-clause edge, while documentation coverage is
    reported unknown.

### Acceptance

No published ledger may contain a ledger-weaver clause edge unless all
configured contract files were independently and completely consumed under
the ledger-weaver's own D29 accounting record. No contract byte used for
clause resolution may be read outside a counted `contract-files` source.

## AM-33 — Exact loader-capable built-in safe-export mapping

### Defect

D30 and spec v2.6 say the allowlist is frozen but use "e.g." before listing
`builtinModules` and `isBuiltin` — delegating a security-sensitive closed
set to the implementer.

### Normative mapping (spec v2.7)

One exhaustive mapping named `LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS`, exact
value:

```
{ "module": ["builtinModules", "isBuiltin"],
  "node:module": ["builtinModules", "isBuiltin"] }
```

Rules:

1. The key set is exactly `module` and `node:module`.
2. Each value is exactly the sorted pair `["builtinModules", "isBuiltin"]`.
3. The outer mapping and inner collections are deeply frozen.
4. Only static named imports of these source export names are permitted.
5. A permitted source export may use a local alias, but permission is
   decided from the imported export name, never the local binding name.
6. Every other export from either specifier is forbidden.
7. Namespace imports, default imports, CommonJS `require`,
   `module.require`, dynamic imports, and re-exports from either specifier
   are forbidden — including re-export of otherwise safe names.
8. Property acquisition from any module namespace is forbidden.
9. `process.getBuiltinModule("module")` and
   `process.getBuiltinModule("node:module")` are forbidden.
10. Computed, concatenated, aliased, or otherwise ambiguous acquisition
    fails closed.
11. The outbound scanner imports the canonical mapping from
    `inventory.mjs`; it must not maintain a second hand-written
    implementation allowlist.
12. Expanding this mapping requires a future specification amendment and
    authorization. It is not an implementation choice.

### Required tests (at minimum)

1. `inventory.mjs` mapping deep-equals the normative mapping.
2. Exact key equality: no missing or additional specifier.
3. Exact value equality: no missing or additional export.
4. Outer mapping and inner arrays are frozen.
5. `builtinModules` accepted from both specifiers.
6. `isBuiltin` accepted from both specifiers.
7. Safe named export with a local alias accepted.
8. `createRequire` rejected from both specifiers.
9. At least two additional non-allowlisted named exports rejected, proving
   the rule is allowlist-based rather than a one-name denylist.
10. Namespace and default imports rejected.
11. CommonJS `require` and `module.require` forms rejected.
12. Static and dynamic re-export forms rejected.
13. Immediate invocation and property-acquisition forms rejected.
14. Both `process.getBuiltinModule` spellings rejected.
15. Comments and string lookalikes do not trigger.
16. Mutation attempts against the mapping fail or leave it unchanged.
17. A fixture that adds one export to `inventory.mjs` fails exact-equality
    validation.

### Acceptance

There is no implementation-time choice about safe exports from
loader-capable built-ins. The sole accepted set is the exact normative
mapping above.

## Expected v10 integration points

Add **D31** (ledger clause resolution owns an independent counted
contract-files inventory) and **D32** (loader-capable built-in access is
governed by the exact normative mapping). Preserve D29 unchanged except for
references showing `contract-files` in the ledger-weaver required set.
Preserve D30's prohibition; replace its illustrative allowlist language
with a reference to D32's exact mapping. Update: the frozen per-weaver
inventory table; the `ctx.sources` interface and Task 4b ledger-weaver
steps; `inventory.mjs` requirements; Task 5 driver accounting;
close/verifier/tamper requirements; skipped-weaver and flagship tests.
Preserve all previously settled locator, blast-radius, provenance,
publication, containment, and abort contracts.
