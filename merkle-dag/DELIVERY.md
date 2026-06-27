# DELIVERY — merkle-dag for Codex

**Authored by:** claude-code (boundary: claude-code cannot write to `me/codex/`).

## What this delivers

A fully self-contained TELOS Merkle-DAG package:

- `vendor.mjs` — vendored `canonicalize` (RFC 8785-compatible) + `resolveUnder` (path-escape guard).
- `merkle.mjs` — `computePlan`, `mutateNode`, `writePlan`, `readPlan`, `appendPlanHistory`, `recompute`.
- `artifact.mjs` — `computeDiskTreeHash` (raw-byte SHA-256 tree hash, confined under `baseDir`).
- `crypto.mjs` — `generateKeypair`, `makeRecord`, `appendLedger`, `writePublicKey`, `readLedger`, `verifyTransaction`.
- `ledger-gate.mjs` — `verify(telosDir, {baseDir})` → structured report with `.exit` 0/1/2.
- `orchestrate.mjs` — `readySet` + `runBuild`: reference controller enforcing the 3 protocol rules; bounded parallel pool + critical-path scheduling + in-memory ledger + async/graceful verify; `dispatch`/`verifyNode`/`signerFor` are injected (keyless, testable).
- `planner.mjs` — `compileAndHashPlan`: auto-fragmentation compiler (declared `{writes,reads}` footprints → dependency graph via `computePlan`; write-write advisory by default, `strict` mode rejects).
- `test-harness.mjs` — end-to-end proof (cascade + parallel isolation + disk-drift + cycle guard).
- Seven unit-test suites in `scripts/` (incl. `scripts/test-orchestrate.mjs`, `scripts/test-planner.mjs`).

## Decoupling note (important)

This package **has NO dependency on the unmerged Phase 1/2 ENGINE.patch**. The `resolveUnder` and `canonicalize` helpers from that patch are vendored directly into `vendor.mjs`. No edits to existing `me/codex/` files are required; the package is entirely self-contained.

## How to deploy

Place the whole `merkle-dag/` directory at `me/codex/merkle-dag/` (sibling of `build-gate/` and `breakout/`):

```
me/codex/
  build-gate/
  breakout/
  merkle-dag/    <-- place here
    package.json
    vendor.mjs
    merkle.mjs
    artifact.mjs
    crypto.mjs
    ledger-gate.mjs
    orchestrate.mjs
    planner.mjs
    test-harness.mjs
    scripts/
      test-vendor.mjs
      test-merkle.mjs
      test-artifact.mjs
      test-crypto.mjs
      test-ledger-gate.mjs
      test-orchestrate.mjs
      test-planner.mjs
```

Then verify:

```bash
cd me/codex/merkle-dag
npm test
```

Expected: exit 0, all eight green (seven unit suites + end-to-end harness).

## Trust model (read `README.md` "Honest residuals" before real use)

This package includes the **authorized-signer hardening**: `ledger-gate` trusts only keys pinned in the content-addressed plan, NOT the `.telos/keys/` directory. For a real (non-test) build:

- The plan must pin trusted public keys in `plan.authorized_signers` (committed into `plan_hash`); pass them via `computePlan(defs, { authorizedSigners: { <model>: <jwk> } })`.
- Private keys live OUTSIDE the vault, referenced by `TELOS_ED25519_SK_<MODEL>`.
- `.telos/keys/` is tooling/bootstrap only — ignored for trust decisions.
- The trust anchor is **plan authorship** (residual (a)); `ledger-gate` runs plan-declared test commands (arbitrary code, bounded — see README).

## Requirements

- Node.js >= 18 (uses `node:crypto` Ed25519, `node:assert/strict`, ESM `import.meta.url`).
- No `npm install` needed — zero runtime dependencies.
