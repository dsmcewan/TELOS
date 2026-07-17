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
| `closure-equality-proven` | Each committed weaver inventory is **proven equal** to its derived D33 closure, never trusted (git → `{registry,git}`; code → `{registry,code,util}`). | D33 | `test-closure.mjs §1, §12` |

**Residuals (adversarial inputs not present in committed Clotho source) are deferred:**
`docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md`. The `closure-equality-proven`
oracle is the safety net — any real divergence fails it loudly.
