# ai-forge composable workstream catalog design

**Status:** design approved 2026-06-30 for spec drafting. Pending user review before implementation planning.

## Goal

Make `ai-forge` patterns cheaper and safer to add by introducing a reusable workstream catalog. New patterns should compose known workstream factories instead of duplicating similar render, test, and breakout-check logic across `patterns/*.mjs`.

The expansion must preserve the current trust spine:

- `pattern.workstreams[]` remains the public contract consumed by `forge.mjs`.
- `merkle-dag`, `build-gate`, signing, provenance, and ledger verification stay unchanged.
- Existing patterns continue to converge with the same IDs, files, and behavior unless an intentional compatibility adapter is needed.

## Context

`docs/ROADMAP.md` marks Phase C.2 complete and lists the remaining open item as composable-workstream-library generalization. Phase C.2 deliberately built `multi-agent`, `eval-harness`, and `serving+guardrails` the proven per-pattern way to gather more examples before extracting a shared layer.

Those patterns now provide enough duplication to justify a small catalog. The goal is not a plugin system or pattern inheritance. It is a local, testable library of factory functions that return the same workstream objects the forge already knows how to build and verify.

## Non-goals

- No dynamic plugin loading.
- No external packages.
- No root CLI.
- No GitHub Actions changes.
- No schema migration for `pattern.mjs`.
- No change to `forge.mjs` trust behavior.
- No live model path changes.
- No broad rewrite of all patterns in the first pass.

## Architecture

Add a new catalog layer under `ai-forge/workstreams/`.

Files:

- `ai-forge/workstreams/catalog.mjs`
- `ai-forge/scripts/test-workstream-catalog.mjs`

The toy pattern lives inline inside `test-workstream-catalog.mjs`. It should not become a committed production catalog pattern.

The catalog exports pure factory functions. Each factory accepts a small options object and returns a normal ai-forge workstream object:

```js
{
  id,
  signer,
  files,
  requirements,
  test,
  render(ctx),
  checks(ctx)
}
```

Factories must be deterministic, keyless, and self-contained. They may share helper functions inside `catalog.mjs`, but those helpers must not become a new runtime framework. The output remains ordinary files and node tests verified by the existing forge.

## Initial catalog factories

The first catalog should extract only the lowest-risk repeated shapes:

- `designWorkstream({ buildWorkstreams })`
  - Thin re-export of the existing generic design workstream.
  - Keeps current design verification behavior.

- `moduleWorkstream({ id, signer, file, requirements, source, selftest, checks })`
  - Generic deterministic single-file module factory.
  - Useful for simple artifacts like schemas, routers, metrics, authz, and guardrails.

- `scorecardWorkstream({ id, signer, file, metricsFile, thresholds })`
  - Captures the eval-harness stored-vs-recomputed scorecard pattern.
  - Must include a tamper-detection selftest.

- `guardrailWorkstream({ id, signer, file, mode, blockedTerms })`
  - Captures input/output guardrail modules.
  - Must test both allowed and blocked cases.

- `auditWorkstream({ id, signer, file })`
  - Captures append-only structured logging to an injected temporary path.
  - Must not write to the forge project root during selftest.

The first pass does not need a factory for every existing workstream. Catalog entries should be added only when two or more existing patterns clearly share the shape or when the test value is high.

## Pattern usage

Existing patterns keep exporting normal `pattern` objects. A pattern may compose workstreams like this:

```js
import { moduleWorkstream, guardrailWorkstream, designWorkstream } from "../workstreams/catalog.mjs";

const buildWorkstreams = [
  moduleWorkstream({ id: "schema", signer: "codex", ... }),
  guardrailWorkstream({ id: "input-guardrail", signer: "grok", mode: "input", ... })
];

export const servingPattern = {
  id: "serving",
  workstreams: [...buildWorkstreams, designWorkstream({ buildWorkstreams })]
};
```

The important boundary is that `forge.mjs` does not know whether a workstream was hand-authored or factory-generated.

## Migration plan

1. Introduce the catalog and tests with a small toy pattern that converges through `forge()`.
2. Refactor the `serving+guardrails` pattern slices for `schema`, `input-guardrail`, `output-guardrail`, and `audit`. Leave `handler`, `ratelimit`, and `authz` hand-authored in the first pass.
3. Keep the pattern's exported ID, workstream IDs, generated files, and gate behavior stable.
4. Add a regression assertion that the refactored pattern still converges and still fails closed when the chosen sub-case is perturbed.
5. Leave broader extraction for follow-up once the first catalog path proves stable.

## Error handling and safety

Factory validation should fail early with useful errors when required options are missing:

- Missing `id`, `signer`, or `file` should throw.
- Duplicate or empty file paths should throw.
- `source` or `selftest` must be strings when used.
- A factory must not accept absolute output file paths.

The generated workstream tests remain the load-bearing safety mechanism. Validation catches authoring mistakes; node tests and the existing ledger gate decide readiness.

## Testing

Required tests:

- `scripts/test-workstream-catalog.mjs`
  - Each factory rejects malformed options.
  - Each factory emits a valid workstream shape.
  - A toy catalog-composed pattern converges through `forge()`.
  - A deliberately broken catalog workstream does not converge.

- Existing pattern tests
  - The first migrated pattern continues to pass its current direct and forge tests.
  - Its fail-closed case still fails closed.

Verification command for the implementation:

```bash
cd ai-forge && npm test
```

Because this touches shared pattern construction, also run:

```bash
cd build-gate && npm test
cd merkle-dag && npm test
```

## Compatibility

The catalog is additive. Existing hand-authored workstreams remain valid. A mixed pattern with both catalog-generated and hand-authored workstreams is explicitly supported.

No consumer outside `ai-forge/patterns/*.mjs` should need to change for the first pass.

## Exit criteria

- A new catalog module exists with focused reusable factories.
- At least one existing pattern uses the catalog without changing its externally observed behavior.
- A toy catalog-composed pattern converges through the real forge path.
- Fail-closed behavior is covered for both the catalog toy pattern and the migrated existing pattern.
- `ai-forge`, `build-gate`, and `merkle-dag` tests pass.

## Implementation decisions

- The toy catalog-composed pattern is inline in `test-workstream-catalog.mjs`.
- `designWorkstream` is a re-export of the existing generic design workstream.
- The first existing-pattern migration covers `serving+guardrails` workstreams `schema`, `input-guardrail`, `output-guardrail`, and `audit` only.
