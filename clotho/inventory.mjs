// inventory.mjs — Clotho's CLOSED inventory of weave inputs (plan v13 (v12 + AM-40) Task 4a).
// Zero dependencies: Node stdlib only. Everything here is a committed, exact,
// hand-reviewed list — the weave does NOT discover new top-level inputs at
// runtime. A future package or evidence source requires an edit here plus tests.
//
// Per D17/AM-17, this PR commits the per-weaver IMPLEMENTATION-file inventories
// only for the weavers that exist at this PR (git and code); the ledger/test/doc
// weaver source inventories are committed with those weavers in Task 4b, and the
// orchestrator-file inventory in Task 5. `repository_ref` is NEVER hardcoded here
// — it is derived per weave via registry.deriveRepositoryRef.

// ---- closed top-level inputs -------------------------------------------------

// The reviewed core TELOS spine packages Clotho weaves — exactly the packages of
// the TELOS build-gate layout documented in CLAUDE.md. Sorted, exact; not a
// runtime scan (D-"do not discover new top-level inputs at runtime"). "Inventory
// every current package root once" is proven COMPLETE, not asserted by hand: the
// closure test / test-inventory enumerate every package.json directory in the
// repository and require each to be either committed here or listed in
// PACKAGE_ROOTS_EXCLUDE — so no package root can be silently omitted.
export const PACKAGE_ROOTS = Object.freeze([
  "breakout",
  "build-gate",
  "clotho",
  "connectors/ai-peer-mcp",
  "merkle-dag"
]);

// Package directories that exist in the repository but are NOT part of the TELOS
// build-gate spine (they are sibling projects sharing the monorepo, absent from
// the CLAUDE.md TELOS layout). Clotho deliberately does not weave them. Listed
// explicitly so the completeness check accounts for every package.json directory
// — inclusion and exclusion are both committed, reviewed decisions.
export const PACKAGE_ROOTS_EXCLUDE = Object.freeze([
  "ai-forge",
  "forge",
  "saas-forge"
]);

// Reviewed documentation and contract roots. The doc-weaver excludes docs/runs/
// (run evidence has a separate owner); every inventory excludes the self-weave
// output directory (D8).
export const DOC_ROOTS = Object.freeze(["contracts", "docs"]);
export const DOC_WEAVER_EXCLUDE = Object.freeze(["docs/runs"]);
export const GLOBAL_EXCLUDE = Object.freeze(["docs/runs/clotho-self-weave"]);

// Exact sorted contract Markdown inventory (D31), repository-relative POSIX.
export const CONTRACT_FILES = Object.freeze([
  "contracts/Agentic Teams Autonomous Builder.md",
  "contracts/Claude-Grok Hierarchical Agentic Workflow.md",
  "contracts/Claude-Led Multi-Model Prototype Workflow.md",
  "contracts/Multi-Model Agentic Build Gate.md",
  "contracts/Proposal Lifecycle.md"
]);

// Configured ledger files plus adapter ids (D31) — a CLOSED top-level source
// inventory, committed exactly at this PR (NOT a deferred per-weaver closure:
// D17/AM-17 defers only per-weaver implementation-file lists and the orchestrator
// list, not closed source inventories, per this plan's inventory.mjs description).
// The EXACT reviewed set at this SHA is empty: Clotho weaves no committed ledger
// artifact — runtime thread-ledgers are git-ignored `.telos/` files, and the
// committed `docs/runs/**/events.jsonl` are the Daedalus subsystem's, not Clotho
// ledger sources. Each entry, when present, is `{ id, path, adapter }`. This is
// the final Task-4a value; if a real Clotho ledger source is later configured it
// is a reviewed inventory change with tests, not a fill-in of a placeholder.
export const LEDGER_SOURCES = Object.freeze([]);

// Exact run directories plus their summary files (run-evidence). Only committed
// runs that carry a summary.json participate.
export const RUN_SOURCES = Object.freeze([
  Object.freeze({ id: "plugin-seats", dir: "docs/runs/plugin-seats", summary: "docs/runs/plugin-seats/summary.json" })
]);

// ---- the five weavers --------------------------------------------------------
// Stable declared (inventory) order. The committed integer version is a
// human-readable label only; the manifest's implementation_refs carry the
// proving content addresses (the driver computes them from WEAVER_IMPL_FILES).

export const WEAVERS = Object.freeze([
  Object.freeze({ id: "clotho-git-weaver", version: 1 }),
  Object.freeze({ id: "clotho-code-weaver", version: 1 }),
  Object.freeze({ id: "clotho-test-weaver", version: 1 }),
  Object.freeze({ id: "clotho-doc-weaver", version: 1 }),
  Object.freeze({ id: "clotho-ledger-weaver", version: 1 })
]);

// The frozen normative per-weaver required inspected_source_counts inventory-id
// table (D24/D26/D31), sorted+unique within each weaver. This is the SAME table
// enforced by thread-ledger's coverage validator; a unit proves equality.
export const REQUIRED_INVENTORY_IDS = deepFreeze({
  "clotho-git-weaver": ["package-files", "package-symbols"],
  "clotho-code-weaver": ["package-modules"],
  "clotho-test-weaver": ["package-manifests", "test-files"],
  "clotho-doc-weaver": ["doc-files"],
  "clotho-ledger-weaver": ["contract-files", "ledger-sources", "run-sources"]
});

// ---- loader-capable builtin safe exports (D32) -------------------------------
// The EXACT frozen mapping: key set is exactly {module, node:module}; each value
// is exactly the sorted pair ["builtinModules","isBuiltin"]. Deeply frozen.
export const LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS = deepFreeze({
  "module": ["builtinModules", "isBuiltin"],
  "node:module": ["builtinModules", "isBuiltin"]
});

// ---- per-weaver implementation-file inventories (D33) ------------------------
// Committed accepted-relative-module-load closures (repository-relative POSIX,
// sorted). Proven equal to the derived closures by scripts/test-closure.mjs —
// never trusted. Only git and code exist at this PR (AM-17).
export const WEAVER_IMPL_FILES = deepFreeze({
  "clotho-git-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/git.mjs"
  ],
  "clotho-code-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/code.mjs",
    "clotho/weavers/util.mjs"
  ]
});

// The weaver modules whose closures are committed at this PR (entry points for
// the closure derivation), mapped to their repository-relative module path.
export const WEAVER_ENTRY_MODULE = Object.freeze({
  "clotho-git-weaver": "clotho/weavers/git.mjs",
  "clotho-code-weaver": "clotho/weavers/code.mjs"
});

// Permitted external (non-clotho) closure targets — merkle-dag primitives that
// may participate in identity/canonicalization/hashing. None are reached by the
// git or code weaver closures at this PR; listed so the closure resolver treats
// any OTHER merkle-dag target as forbidden.
export const PERMITTED_EXTERNAL_CLOSURE_FILES = Object.freeze([
  "merkle-dag/vendor.mjs"
]);

// ---- deep freeze -------------------------------------------------------------

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
