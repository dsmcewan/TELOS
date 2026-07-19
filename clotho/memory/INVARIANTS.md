---
type: reference
topic: clotho
status: living
note: Human view of clotho/memory/INVARIANTS.json (the machine mirror). Every NORMATIVE invariant cites an executable oracle; a claim without a passing oracle is ADVISORY.
---

# Clotho — invariants

Governed by plan **v15** (`sha256:05a48700…`), authorization **authz-008**. Each
invariant below is `NORMATIVE-CURRENT` and backed by an executable oracle. The
machine mirror is `clotho/memory/INVARIANTS.json`; the contracts are under
`clotho/memory/CONTRACTS/`; the reproduction command is `cd clotho && npm test`.

| id | invariant | authority | oracle |
|---|---|---|---|
| `d33-fail-closed-profile` | The shared D33 scanner is correct over a closed source profile and **fails closed** (`unsupported-module-lexical-profile`) on the exact out-of-profile set **b1–b6**; one optional leading shebang (`#!` at byte 0, first line, LF/CRLF) is admitted and stripped before lexing. | AM-41 / authz-008 | `clotho/scripts/test-util.mjs`, `test-closure.mjs` |
| `d33-deny-based-regex` | Regex-vs-division by previous-significant-token: **division only after a value token**, **regex after every keyword** — not a keyword allow-list. | AM-41 / authz-008 | `clotho/scripts/test-util.mjs` |
| `d21-original-order-containment` | lstat every existing component of the **original uncollapsed** candidate path before any `..`-collapse; reject symlink components; only ENOENT is absence; reject backslash specifiers. | D21 / AM-41 | `clotho/scripts/test-util.mjs` |
| `inventory-id-table-frozen` | `REQUIRED_INVENTORY_IDS` equals the frozen normative table and the ledger coverage validator. | D24/D26/D31 | `test-inventory.mjs` + `verify-contracts.mjs` |
| `d32-loader-safe-exports-frozen` | `LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS` deeply frozen, exactly `{module, node:module} → ["builtinModules","isBuiltin"]`. | D32 | `test-inventory.mjs` + `verify-contracts.mjs` |
| `closure-equality-proven` | Every committed implementation inventory for all five weavers, plus the orchestrator inventory, is **proven equal** to its derived D33 closure and never trusted. | D33 | `test-closure.mjs`, `test-flagship.mjs` |
| `d25-command-inferred-provenance` | Command-inferred `verified-by` records bind to the `package.json` blob; import-derived records bind to the test-file blob. The test-weaver parses command text and executes no command. | D25 | `test-weaver-test.mjs` |
| `d31-independent-contract-files` | The ledger weaver independently consumes and exhausts its counted `contract-files` source and resolves clause edges only through that collision-checked index. | D31 | `test-weaver-ledger.mjs`, `test-weave.mjs` |
| `d35-closed-coverage-schema` | Query coverage is exactly `verified` or `unverified`; it never defaults to verified, and an empty `coverageUnknown` is legal only when a verified manifest proves all consulted producers executed. | D35/AM-37/D11 | `test-query.mjs`, `test-flagship.mjs` |
| `d34-publication-time-drift-abort` | Immediately before publication, the driver re-derives closures and re-checks content addresses; any drift aborts without publishing. | D34/AM-38/D28 | `test-weave.mjs` |
| `d10-am39-producer-attribution` | The driver rejects an edge or warning whose attribution differs from the invoked weaver before any edge reaches the ledger. | D10/AM-39 | `test-weave.mjs` |
| `d8-self-weave-exclusion` | `docs/runs/clotho-self-weave/` is excluded from every input inventory so a weave never consumes its own prior output. | D8 | `test-inventory.mjs`, `test-flagship.mjs`, `docs/runs/clotho-self-weave/run.mjs` |

Tasks 4b–7 are delivered and the machine mirror marks every row above
`NORMATIVE-CURRENT` (`git:983aad5`, Phase 1 closure).

**Residuals (adversarial inputs not present in committed Clotho source) remain deferred:**
`docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md`. The `closure-equality-proven`
oracle is the safety net — any real divergence fails it loudly.
