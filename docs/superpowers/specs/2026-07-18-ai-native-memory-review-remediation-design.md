# ai-native-memory — final-review remediation design

**Status:** approved for implementation

**Date:** 2026-07-18
**Governing sources:** `2026-07-18-ai-native-memory-plugin-design.md` and the
`Global Constraints` in `2026-07-18-ai-native-memory-plugin.md`

## Purpose

This addendum closes the final whole-branch review findings without weakening the
standard to fit the implementation. The requirements source and the plan's Global
Constraints remain authoritative. Where a later task in the plan contradicts a
Global Constraint, the Global Constraint wins.

The repaired branch must satisfy both forms of acceptance:

1. the plugin's normal test suite is green; and
2. the public commands themselves demonstrate the inheritance claim, including a
   clean `memory-audit` over the plugin root and a `memory-verify` that executes the
   oracle actually declared by each contract.

## Decisions

### Exit codes

All commands use the binding global taxonomy:

- `0` — clean or GRANTED;
- `1` — cannot run because input or authority evidence is unreadable, malformed, or
  drifted;
- `2` — findings present or comprehension DENIED.

Exit `3` is removed from the gate, tests, commands, agents, examples, and dogfood
records. The design specification's short `/memory-gate <component> <answers>` form
remains conceptual; the command document continues to show the exact CLI arguments.

### Audit scope and negative fixtures

Production discovery continues to inspect every conventionally named `memory/`
directory, skipping only filesystem/runtime internals such as `.git` and
`node_modules`. The implementation will not add a broad `tests/fixtures` exclusion,
because that would let a host hide real memory records under a conventional path.

Negative fixture sources will instead live under a non-discoverable directory name.
The test harness will stage one fixture at a time into a temporary `comp/memory/`
tree before invoking the real `auditRoot` entry point. Consequently:

- fixtures still prove that every check can fail through production discovery;
- `memory-audit` over the plugin root sees only production memory and exits clean;
- no ignore marker or configuration can be abused to suppress findings.

### Closed taxonomy and record identity

One shared validator will cover contracts, invariants, and non-claims. It will reject:

- record kinds outside the documented eight-value set;
- statuses outside the documented status set;
- missing required common fields;
- IDs that are not
  `sha256(canonicalize(record without id))`;
- `NORMATIVE-CURRENT` invariant or contract records without a non-placeholder oracle
  path that resolves to a regular file beneath the audited repository;
- pending records without a real, non-placeholder `becomes_normative_when`;
- superseded records without both a successor and
  `must_not_govern_new_work: true`;
- decision records without documented human provenance.

Non-claims are records, not exemptions from honest lifecycle state. A newly
scaffolded placeholder non-claim is pending until its statement is replaced and
ratified. Dogfood non-claims will carry content-addressed IDs and truthful,
non-placeholder status/evidence.

Audit proves structural readiness and that named oracle files exist. It does not
silently claim that merely finding a file proves its assertions. Executing contract
oracles and proving their exit status is the responsibility of `memory-verify`.
The skills and command prose will state this division consistently.

### Query freshness

Every comprehension query is load-bearing and therefore must carry:

```json
{
  "derived_from": {
    "file": "<path relative to the memory directory>",
    "pointer": "<dot path>"
  }
}
```

Missing, malformed, unreadable, unresolved, or mismatched derivation is a FAIL.
There is no warning-only path for a query whose expected answer cannot be
mechanically regenerated.

### Three representations

`INVARIANTS.md` and `NON-CLAIMS.md` use a deterministic renderer shared by init,
audit, and dogfood. Audit regenerates the expected bytes from the JSON records and
fails when the rendered file is absent or differs. This makes JSON the source of
truth and prevents hand-maintained prose from drifting.

The renderer remains deliberately small: a stable heading followed by one stable
entry per record containing its ID, status, and statement. Explanatory prose that
does not duplicate machine facts remains in the component's identity, decisions,
failure modes, and evidence documents.

### Staleness

Staleness remains declaration-driven and supports three evidence forms:

- `authority.source_path` must resolve beneath the repository root;
- optional `as_of` commit anchors must resolve in the current Git repository, and
  produce a WARN containing their commit distance from HEAD when that distance is
  nonzero;
- optional snapshots declare `{source_path, sha256}` and FAIL when the source is
  missing, the hash is malformed, or current bytes do not match the pinned hash.

Root authority hash verification remains mandatory when a current authority file is
present. Path resolution rejects traversal outside the audited repository.

### Verification

`verify-map.json` remains an array of `{contract, oracle, cwd?}` entries, but it is no
longer an independent source of oracle truth.

For every entry, `verify.mjs` will:

1. resolve and parse the contract;
2. require the contract to be `NORMATIVE-CURRENT`;
3. require the map's oracle to exactly equal the contract's `oracle.test`;
4. require both paths to remain beneath the verify-map repository root;
5. execute that declared oracle and require exit `0`.

An empty map is a finding. Duplicate contract entries are findings. The verifier
discovers `memory/CONTRACTS/*.json` beneath the map root and fails when any
`NORMATIVE-CURRENT` contract is absent from the map.

The plugin contract will name a dedicated, terminating contract oracle rather than
`tests/run.mjs`. That oracle will exercise the contract's mechanics without invoking
the dogfood test that invoked it. The full test runner remains the outer CI entry
point, eliminating recursion without substituting an unrelated oracle.

### Initial scaffold

`memory-init` remains idempotent and never overwrites user files. On first run it
creates:

- `AI-START-HERE.md`;
- `CURRENT-AUTHORITY.json`;
- `MEMORY-MANIFEST.json`;
- `LOAD-ORDER.json`, including token-budget guidance.

For a component it creates the complete specified memory set, including a
deterministically rendered `README.md`, `INVARIANTS.json/.md`,
`NON-CLAIMS.json/.md`, contracts, decisions, failure modes, evidence, and
comprehension queries.

All example records begin `SPECIFIED-PENDING-IMPLEMENTATION`. Oracle references and
`becomes_normative_when` begin empty, so placeholders cannot accidentally pass
truthiness checks. IDs are valid content addresses for the generated record content.
The generated record set is intentionally not certified until a human replaces the
example statements, binds current authority, names executable evidence, and
regenerates IDs and rendered projections.

### Portability and language

Runtime dependencies remain empty. All static, side-effect, and string-literal
dynamic imports in `scripts/` must be either `node:*` or relative plugin paths. The
dogfood scanner will cover all three import forms.

Plugin files use host-agnostic language. Reserved source-project vocabulary is
removed even from rejected-alternative prose. The monorepo dogfood authority may
continue pointing to the in-repository governing specification; marketplace
packaging remains deferred and will rebind or vendor that authority later.

## Testing strategy

Every production behavior follows red-green-refactor:

1. add a focused regression test or violating fixture;
2. run it and confirm it fails for the reviewed defect;
3. make the smallest production change;
4. rerun the focused test;
5. rerun the complete plugin suite before moving to the next subsystem.

Required regression coverage includes:

- unknown kind and status;
- semantic or stale content-addressed ID;
- placeholder and missing oracle file;
- placeholder pending transition;
- malformed, missing, and unresolved query derivation;
- rendered Markdown drift;
- unresolved `as_of` and stale-but-resolving `as_of`;
- missing and hash-drifted snapshots;
- empty, duplicate, missing-contract, oracle-mismatch, and uncovered-contract verify
  maps;
- gate denial at exit `2`;
- complete fresh-host scaffold and idempotent rerun;
- side-effect and dynamic non-portable imports;
- public whole-root self-audit.

Final verification is:

```text
cd ai-native-memory
npm run check
npm test
node scripts/audit.mjs .
node scripts/verify.mjs verify-map.json
```

followed by the host classification and institutional-memory checks:

```text
cd clotho
npm run check
node scripts/test-inventory.mjs
cd ..
node docs/institutional-memory/verify-contracts.mjs
```

The branch is complete only when all commands produce their specified clean output,
the import and reserved-vocabulary scans are empty, and `git diff --check` passes.

## Non-goals

- No marketplace publication.
- No runtime dependency or external schema library.
- No general-purpose Markdown rendering system.
- No configurable audit ignore mechanism.
- No execution of arbitrary invariant oracles during structural audit.
- No unrelated restructuring of the host repository.
