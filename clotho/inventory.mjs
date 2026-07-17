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
// DOC_WEAVER_EXCLUDE / GLOBAL_EXCLUDE are committed here (this is the closed
// inventory), but no Task 4a code path consumes them yet: the git and code
// weavers walk only PACKAGE_ROOTS. DOC_WEAVER_EXCLUDE is wired into the doc-file
// walk when the doc weaver lands (Task 4b); GLOBAL_EXCLUDE (D8 self-weave
// exclusion) is wired into every inventory walk by the complete-weave driver
// (Task 5). They are intentionally deferred, not decorative.
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
// Each entry is `{ id, path, adapter }`. The set was empty at the final Task-4a
// value; the entry below is the REVIEWED INVENTORY CHANGE that value anticipated
// ("a reviewed inventory change with tests"), authorized by The Eye's
// reviewed-data ruling (2026-07-17, docs/runs/clotho-impl-slice-6/ESCALATION.md):
// a committed, hash-chained obligation ledger whose concern/obligation entries
// genuinely name the flagship symbol and resolve a real Proposal Lifecycle
// clause. The artifact content is Eye-reviewed governance data.
export const LEDGER_SOURCES = Object.freeze([
  Object.freeze({ id: "clotho-obligations", path: "docs/ledgers/clotho-obligation-ledger.jsonl", adapter: "clotho-obligation-ledger-v1" })
]);

// Exact run directories plus their summary files (run-evidence). Only committed
// runs that carry a summary.json participate. clotho-flagship-evidence is a REAL
// executed run (its runner derives executable refs through the flagship symbol)
// added under the same Eye ruling as the ledger source above.
export const RUN_SOURCES = Object.freeze([
  Object.freeze({ id: "plugin-seats", dir: "docs/runs/plugin-seats", summary: "docs/runs/plugin-seats/summary.json" }),
  Object.freeze({ id: "clotho-flagship-evidence", dir: "docs/runs/clotho-flagship-evidence", summary: "docs/runs/clotho-flagship-evidence/summary.json" })
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
// never trusted. Task 4a committed git + code; Task 4b adds test, doc, and ledger
// (D17/AM-17) — every named file exists at this PR.
export const WEAVER_IMPL_FILES = deepFreeze({
  "clotho-git-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/git.mjs"
  ],
  "clotho-code-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/code.mjs",
    "clotho/weavers/util.mjs"
  ],
  "clotho-test-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/test.mjs",
    "clotho/weavers/util.mjs"
  ],
  "clotho-doc-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/doc.mjs",
    "clotho/weavers/util.mjs"
  ],
  "clotho-ledger-weaver": [
    "clotho/registry.mjs",
    "clotho/weavers/ledger.mjs",
    "clotho/weavers/util.mjs"
  ]
});

// The weaver modules whose closures are committed at this PR (entry points for
// the closure derivation), mapped to their repository-relative module path.
export const WEAVER_ENTRY_MODULE = Object.freeze({
  "clotho-git-weaver": "clotho/weavers/git.mjs",
  "clotho-code-weaver": "clotho/weavers/code.mjs",
  "clotho-test-weaver": "clotho/weavers/test.mjs",
  "clotho-doc-weaver": "clotho/weavers/doc.mjs",
  "clotho-ledger-weaver": "clotho/weavers/ledger.mjs"
});

// Permitted external (non-clotho) closure targets — merkle-dag primitives that
// may participate in identity/canonicalization/hashing. None are reached by the
// git or code weaver closures at this PR; listed so the closure resolver treats
// any OTHER merkle-dag target as forbidden.
export const PERMITTED_EXTERNAL_CLOSURE_FILES = Object.freeze([
  "merkle-dag/vendor.mjs"
]);

// ---- orchestrator-file inventory (D17/AM-17/D33, Task 5) ---------------------
// The frozen orchestrator entry points and their committed accepted relative
// module-load closure — the complete-weave driver, the thread ledger, and the
// shared registry/canonicalization machinery their closures reach (the driver
// statically imports the five weaver modules it drives, so those and their
// shared substrate are orchestrator-reachable bytes). Committed in the SAME PR
// that creates weave.mjs, so no inventory names a file that does not yet exist.
// Proven equal to the derived closure by scripts/test-closure.mjs — never
// trusted; the driver re-derives and re-checks it at publication time (D34).

export const ORCHESTRATOR_ENTRY_MODULES = Object.freeze([
  "clotho/thread-ledger.mjs",
  "clotho/weave.mjs"
]);

export const ORCHESTRATOR_FILES = Object.freeze([
  "clotho/inventory.mjs",
  "clotho/registry.mjs",
  "clotho/thread-ledger.mjs",
  "clotho/weave.mjs",
  "clotho/weavers/code.mjs",
  "clotho/weavers/doc.mjs",
  "clotho/weavers/git.mjs",
  "clotho/weavers/ledger.mjs",
  "clotho/weavers/test.mjs",
  "clotho/weavers/util.mjs"
]);

// ---- closed fatal-warning code set (D22/AM-23, Task 5) -----------------------
// A weaver warning carrying one of these codes aborts the weave before close and
// publication (abort/remove/nonzero discipline); it can never coexist with a
// published artifact. Includes the D29 accounting codes, the AM-39 attribution
// code, and the D34 publication-time drift code. Sorted, closed, frozen.

export const FATAL_WARNING_CODES = Object.freeze([
  "attribution-violation",
  "chain-failure",
  "duplicate-heading-address",
  "incomplete-source-consumption",
  "invalid-content-address",
  "invalid-ledger-entry",
  "publication-time-drift",
  "root-escape",
  "source-count-mismatch",
  "symlink-input",
  "unexpected-source-consumption",
  "unsupported-ledger-format"
]);

// ---- deep freeze -------------------------------------------------------------

function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
