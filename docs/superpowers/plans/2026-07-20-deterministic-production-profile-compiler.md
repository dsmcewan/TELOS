# Deterministic Production Profile Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic, controller-owned compiler that turns production facts into fixed, content-addressed obligations before planning, proves those obligations through closed executable checks, and blocks authorization or settlement when profile evidence is missing, stale, weakened, or contradicted.

**Architecture:** A zero-dependency compiler under `build-gate/production-profile/` validates a closed controller dossier, scans bounded repository facts, evaluates a pinned JSON policy, and emits content-addressed production-policy source records. `merkle-dag` gains backward-compatible version-2 obligations and production lifecycle hashing; `build-gate` records the input before model calls, mints fixed verification nodes after workshop, re-resolves checks in the proposal gate, and re-runs classification before settlement. Deterministic bank-style and TELOS self-hosting runs prove the negative path without external network or real personal data.

**Tech Stack:** Node.js `>=18`, ESM `.mjs`, `node:` standard library only, canonical JSON, SHA-256 content addresses, Ed25519 process-evidence signatures, loopback HTTP fixtures, existing TELOS Merkle-DAG and proposal lifecycle.

## Global Constraints

- Governing design: `docs/superpowers/specs/2026-07-20-deterministic-production-profile-compiler-design.md` at `git:1c12c6b36de31b62de7d6a0f1ce02db3f13ded69`, raw file SHA-256 `1a0d7b96fb4d4a35313355846a205bfd7c0f6c9fa093c957ba186f5b1bac0ba6`.
- Quest entry: `docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-20-production-profile-compiler-1.json` and `docs/runs/production-profile-compiler-1/reader-validation-artifact.json`, committed at `git:6bb0d5f`.
- Current `authz-008` does **not** authorize this plan. No production-code task begins until Daedalus matures this candidate, TELOS authorizes the exact matured hash, The Eye directs Argo execution, and the Argo entry ritual passes.
- The production dossier, signal resolutions, policy choice, implementation acceptance, and enrollment remain controller/The Eye jurisdiction. Models cannot author or lower the effective profile, select a waiver, remove an obligation, substitute a check, or declare required evidence not applicable.
- Activation is exact: production enforcement is required when `proposal_lifecycle === true`, `market_bound === true`, or either `production_profile` or `production_evidence` is present. Activated builds require `proposal_lifecycle === true` and a complete profile before any model call.
- Preserve byte identity for existing obligation-free plans and legacy concern obligations. Legacy hash preimages remain unchanged; production behavior is additive behind explicit version and lifecycle fields.
- Use only `node:` and repository-relative imports. Add no runtime or development dependency, no lockfile, no package download, no general YAML/HCL/Terraform parser, and no remote policy loader.
- Node.js 18 and Node.js 20 are the binding portability matrix. Local Node 24 results are supplementary only and never substitute for both CI matrix legs.
- Determinism excludes wall-clock time, locale, traversal order, JSON key order, host path separators, absolute host paths, random identifiers, ambient defaults, and unpinned environment values from semantic output.
- All semantic arrays that represent sets are deduplicated and sorted. All semantic object keys are closed and canonicalized before hashing.
- Compiler CLI exits are exact: `0` success, `2` deterministic blocker, `1` cannot-run. Registered production checks exit `0` proved, `1` assertion failed, `2` cannot run safely. No failure replaces a previously valid output artifact.
- Repository observations are monotonic: they may union sets, raise ordered floors, turn capabilities on, or require classification; they may never lower a controller declaration or suppress a triggered obligation.
- Text matches are signals, not facts. Every accepted signal resolution is controller-authored, bound to the exact current signal reference, and invalid when stale or fabricated.
- Policy version 1 is one local canonical JSON document with only `all`, `any`, `not`, `eq`, `contains`, `intersects`, `gte`, and `lte`. Unknown operators, paths, templates, versions, duplicate IDs, or check kinds fail loading.
- The initial catalog is exactly the 31 stable obligation IDs and eleven production domains frozen in the design. No obligation ships without a non-trigger fixture, a one-fact trigger fixture, passing evidence, failing evidence, and stale-identity mutation.
- The closed production check registry contains exactly eight version-1 kinds. Callers cannot provide commands, interpreters, scripts, arguments, working directories, environments, shell fragments, external URLs, expected outcomes, or implementation references.
- Runtime checks use literal loopback only (`127.0.0.1` or `[::1]`), deny redirects and proxy environment variables, use synthetic data, and enforce fixed request/body/time limits. No compiler, scanner, test, demo, or reproducible self-hosting run contacts an external provider.
- Every production verification node declares `test.env_contract: "telos-scrubbed-v1"`. The generic
  Merkle and advisory runners pass only `SystemRoot`, `WINDIR`, `HOME`, `USERPROFILE`, `TMP`, `TEMP`,
  `TMPDIR`, `LANG`, `LC_ALL`, and `TZ` when that contract is selected. They resolve the descriptor's
  exact bare `node` command to the controller runtime's absolute `process.execPath` only at the spawn
  boundary; that host path never enters a hash, artifact, report, or diagnostic. `PATH`, `PATHEXT`,
  `ComSpec`, and every other ambient value are absent, so parent command lookup cannot select the
  interpreter. A missing contract retains legacy inherited-environment and command-selection behavior
  byte-for-byte; an unknown contract or any scrubbed command other than exact `node` blocks before
  spawn. No production check receives a credential or unlisted ambient variable.
- Structural checks inspect bounded canonical JSON and prove only the asserted artifact relationship. Unsupported infrastructure formats block.
- Process checks verify closed, content-addressed, fresh evidence records against controller-owned public Ed25519 keys. No private key, credential, token, account identifier, real customer data, or personal-data sample is committed or echoed.
- Physical containment is checked after realpath/symlink resolution. Changed-during-read files, unreadable required files, scan-limit excess, path escape, race, malformed JSON, and unsafe runtime endpoints are cannot-run failures; no partial facts are accepted.
- Production input, compiled profile, policy, registry, and process keyring are controller-owned and cannot appear in model write targets. Evidence outputs cannot certify themselves without the registry check.
- Signed process-record paths are written only by the controller's external-evidence frontier after
  ordinary artifacts settle. Model tasks may produce drill/load/eval measurement sources, but they
  cannot write the signed record that attests to those sources.
- Production verification node IDs are controller-reserved as `verify-production-<lowercase-obligation-id>`. Workshop output cannot mint, shadow, edit, or reserve them.
- Every production obligation reconciles to exactly one compiler source; every legacy obligation reconciles to exactly one reconstructed concern. Missing, extra, duplicate, orphan, cross-bound, or unknown sources block.
- A production check contract includes its registry-derived implementation reference. The proposal gate and settlement path re-resolve the current check and executable; a no-op or stale implementation cannot discharge an obligation.
- The full production input, compiled profile, semantic repo facts, policy, registry, evidence configuration, production source set, obligations, checks, and lifecycle metadata are hash-bound into the plan.
- Post-build reclassification runs immediately before settlement. Any changed profile, source set, obligation set, registry contract, or evidence identity returns `BLOCKED_PROFILE_DRIFT`; stale work cannot settle.
- Runtime, structural, and process evidence labels remain explicit in code, reports, docs, and public claims. No check is described as proving a stronger tier.
- The synthetic bank demonstration uses only the invalid marker `000-00-0000`, a loopback fake provider, and redacted audit output. It never uses a bank, customer, live provider, or real personal data.
- TELOS is the first non-synthetic host. Its exact controller-approved dossier enters a separately authorized production proposal and uses the same compiler, policy, registry, proposal reconstruction, post-build scan, obligation discharge, and settlement path as fresh hosts.
- No repository-name branch, TELOS waiver, reduced policy, fixture-only registry, pre-recorded pass, direct ledger insertion, or alternate settlement path may make self-hosting pass.
- Every TELOS self-publication attempt uses an immutable attempt directory and append-only
  Ed25519-signed attempt ledger. Controller/process key loss or exposure is retired by The Eye through
  a distinct attempt-governance key before a fresh exact plan, approval, and TELOS authorization; no
  singleton artifact is overwritten and no Argo slice event substitutes for publication supersession.
- An unsafe recovery state creates an exclusive signed forensic-hold record outside the suspected
  attempt ledger. Every mutating self-publication mode, including recovery and supersession, blocks on
  that durable hold before opening a key until a separate The Eye/TELOS change-protocol disposition.
- A root README dogfood claim, production-profile release tag, or institutional enrollment is prohibited until the reproducible TELOS self-hosting run and its negative controls are green.
- New behavior is developed test-first. Each task begins with a discriminating failing test, records the expected failure, adds the smallest implementation, runs focused and regression tests, and commits only its named files.
- New scripts use double quotes, semicolons, two-space indentation, explicit `node:` imports, small pure functions, and `#!/usr/bin/env node` on executable entry points.
- Preserve unrelated user work. Never use destructive Git cleanup. Every verification run must leave the tracked checkout clean.
- Green evidence proves only the bounded predicates in the design. Preserve every explicit non-claim; do not claim legal compliance, certification, universal security, operational effectiveness, or completeness of repository discovery.

---

## File Structure

### Compiler and built-in policy

- Create `build-gate/production-profile/canonical.mjs`
  - Owns the production-profile package's code-unit comparator and canonical SHA-256 helper by wrapping
    the existing `merkle-dag/vendor.mjs` canonicalization contract; Tasks 1–3 import these helpers rather
    than redefining them.
- Create `build-gate/production-profile/profile-schema.mjs`
  - Owns closed production-input validation, canonical set normalization, cross-field checks, secret-shaped-value rejection, activation evaluation, and finding construction.
- Create `build-gate/production-profile/json.mjs`
  - Owns the zero-dependency recursive JSON parser used at trust boundaries, including duplicate-key rejection, fatal UTF-8 decoding, prototype-key rejection, and canonical serialization.
- Create `build-gate/production-profile/artifact-io.mjs`
  - Owns bounded stable JSON reads, physical containment, content-addressed controller artifacts, and atomic current-view replacement.
- Create `build-gate/production-profile/repo-facts.mjs`
  - Owns bounded deterministic traversal, structured detectors, text signals, signal-reference derivation, controller resolution validation, and monotonic fact reconciliation.
- Create `build-gate/production-profile/policy-loader.mjs`
  - Owns closed policy-schema validation, JSON-Pointer resolution, condition evaluation, rule projections, and policy/rule references.
- Create `build-gate/production-profile/policy.v1.json`
  - Owns the 31 stable obligations, eleven domains, trigger expressions, evidence tiers, projections, and registered check templates.
- Create `build-gate/production-profile/source-record.mjs`
  - Owns production-policy source records, source references, obligation-set references, and source-to-obligation conversion.
- Create `build-gate/production-profile/finding-routing.mjs`
  - Owns the immutable compiler-finding to policy-finding mapping; host review risk policy cannot alter it.
- Create `build-gate/production-profile/compiler.mjs`
  - Composes schema, scanner, policy, registry, evidence configuration, references, findings, and canonical compiled artifacts without performing writes.
- Create `build-gate/production-profile/check-registry.mjs`
  - Owns the version-2 production registry, closed per-kind parameter schemas, safety caps, implementation-source closures, and registry reference without mutating legacy version-1 checks.
- Create `build-gate/production-profile/check-runner.mjs`
  - Resolves and runs registered production checks with exact `0`/`1`/`2` status preservation and canonical bounded detail.
- Create `build-gate/production-profile/checks/bounded-json.mjs` and `checks/loopback-client.mjs`
  - Provide registry-owned, hash-bound shared parsing, containment, HTTP, redaction, and limit primitives.
- Create one registry entry module for each closed check kind:
  - `build-gate/production-profile/checks/loopback-http-v1.mjs`
  - `build-gate/production-profile/checks/auth-boundary-v1.mjs`
  - `build-gate/production-profile/checks/tenant-isolation-v1.mjs`
  - `build-gate/production-profile/checks/rate-limit-v1.mjs`
  - `build-gate/production-profile/checks/webhook-v1.mjs`
  - `build-gate/production-profile/checks/ai-egress-v1.mjs`
  - `build-gate/production-profile/checks/json-assertions-v1.mjs`
  - `build-gate/production-profile/checks/record-v1.mjs`
  - Each entry owns one local `implementation_ref` source closure; callers cannot select an implementation or expected outcome.
- Create `build-gate/production-profile/cli.mjs`
  - Owns exact `compile` and `verify` argument contracts, atomic output replacement, canonical reports, stderr summaries, and exit codes.
- Create `build-gate/production-profile/README.md`
  - Documents controller jurisdiction, host adapter contract, CLI, evidence tiers, failure codes, and bounded claims.

### Merkle-DAG compatibility and lifecycle identity

- Modify `merkle-dag/vendor.mjs`
  - Adds a generic, closed child-environment contract resolver shared by asynchronous Rule-3,
    synchronous ledger-gate, advisory test execution, and command normalization; it contains no
    production kind or node-ID branch.
- Create `merkle-dag/execution-identity.mjs`
  - Derives the exact executed-build reference from a recomputed plan, authorized signed ordinary-node
    ledger records, and current disk artifacts without importing `build-gate`.
- Create `merkle-dag/scripts/test-execution-identity.mjs`
  - Proves plan intent alone is insufficient and every current ordinary artifact/ledger identity is
    bound.
- Modify `merkle-dag/obligation.mjs`
  - Adds explicit version-2 production-policy obligations and conditionally binds `env_contract` into
    executable identity while preserving every legacy concern and executable hash preimage.
- Modify `merkle-dag/merkle.mjs`
  - Retains and hashes the closed production lifecycle object without changing lifecycle-free plan bytes.
- Modify `merkle-dag/planner.mjs`
  - Retains the existing generic compiler interface, preserves the optional execution-determining
    `test.env_contract`, and documents the legacy/version-2 obligation union.
- Modify `merkle-dag/proposal-ledger.mjs`
  - Adds policy certificate version 2 without changing the frozen version-1 keys, contract reference, or allowed `n/a` set.
- Modify `merkle-dag/orchestrate.mjs`
  - Selects the required certificate version from the recomputed plan before dispatch, applies the
    generic test environment contract, and requires a final production-profile verifier before ready
    status.
- Modify `merkle-dag/ledger-gate.mjs` without adding production-specific runtime branches
  - The pure gate applies the same generic environment contract and continues to discharge obligations
    by exact node, test, and obligation references; integration tests prove version-2 behavior remains
    source-agnostic while structured detail preserves assertion-failed versus cannot-run.
- Modify `merkle-dag/package.json`
  - Registers every new or changed Merkle test in `check` and `test` without adding dependencies.
- Modify `merkle-dag/scripts/test-vendor.mjs`, `test-obligation.mjs`, `test-merkle.mjs`,
  `test-planner.mjs`, `test-proposal-ledger.mjs`, `test-orchestrate.mjs`, and
  `test-ledger-gate.mjs`
  - Prove legacy byte identity, version-2 identity, lifecycle hashing, additive certificates,
    environment isolation, plan-aware authorization, exact discharge, and fail-closed unknowns.

### Production checks, proposal lifecycle, and activated consumers

- Modify `build-gate/check-registry.mjs`
  - Preserves the frozen legacy review registry and exposes only an explicit bridge to the separate production registry where integration needs common dispatch.
- Modify `build-gate/build-orchestrator.mjs` and `build-gate/gate.mjs`
  - Evaluate activation and prepare controller-owned production state before autonomous decomposition or any other model-backed entry point.
- Modify `build-gate/proposal-recorder.mjs`
  - Stores canonical production input and compiled artifacts before workshop, records their content addresses durably, rejects proposal/key mismatch, and resumes without duplicating the draft.
- Modify `build-gate/proposal-orchestrator.mjs`
  - Consumes prepared production state, supplies fixed read-only obligation context, rejects reserved IDs, and mints production verification nodes after workshop.
- Modify `build-gate/proposal-gate.mjs`
  - Reconstructs input from disk, recompiles, reconciles exact source/obligation/check/lifecycle sets, and issues policy certificate version 2.
- Create `build-gate/production-profile/finding-routing.mjs`
  - Maps the closed compiler finding codes to existing policy finding classes independently of mutable review risk policy.
- Test `build-gate/schemas.mjs`, `evidence.mjs`, `concerns.mjs`, and `risk-policy.mjs` without placing production contracts in them
  - Proves the model-response schema surface, best-effort review evidence, concern dispositions, and mutable review risk policy cannot satisfy or weaken controller-owned production contracts. Exact orphan rejection lives in `proposal-gate.mjs`.
- Modify `ai-forge/forge.mjs`, `ai-forge/scripts/test-forge.mjs`, `saas-forge/forge.mjs`, and `saas-forge/scripts/test-forge.mjs`
  - Route every genuine in-tree `market_bound: true` build through the proposal lifecycle and prove no direct legacy validation path can bypass production activation.
- Modify `build-gate/package.json` and `build-gate/test-runner.mjs`
  - Registers syntax and test entry points without adding dependencies and applies the same generic
    test environment contract to advisory execution.
- Create `build-gate/scripts/test-production-profile.mjs`
  - Covers schema, activation, references, scanner reconciliation, determinism, and portability.
- Create `build-gate/scripts/test-production-profile-cli.mjs`
  - Covers exact CLI syntax, stdout/stderr, atomic replacement, and `0`/`1`/`2` exits.
- Create `build-gate/scripts/test-production-policy.mjs`
  - Covers policy schema, all 31 trigger transitions, projections, source records, and obligation-set identity.
- Create `build-gate/scripts/test-production-checks.mjs`
  - Covers all eight passing/failing/cannot-run paths, containment, limits, registry drift, and executable substitution.
- Create `build-gate/scripts/test-production-lifecycle.mjs`
  - Covers prepared-state handoff, disk-only child-process restart, fixed node minting, version-2 certificate authorization, and post-build drift.
- Create `build-gate/scripts/test-production-import-policy.mjs`
  - Parses the exact authorized plan's complete `Create:`/`Modify:` executable inventory, unions the
    production-profile and proof-harness directory walks, and lexically audits that closed set plus
    its relative import closure for the zero-dependency policy. Mutation tests cover comments, strings,
    templates, escapes, dynamic imports, and `require()` calls.
- Create `build-gate/scripts/test-production-fresh-host.mjs`
  - Copies only the candidate `build-gate`/`merkle-dag` runtime into a temporary generic host, proves a
    minimal compile, and proves missing triggered evidence blocks without reading any TELOS authority or
    institutional-memory file.
- Modify `build-gate/scripts/test-proposal-orchestrator.mjs`, `test-proposal-gate.mjs`, `test-proposal-lifecycle.mjs`, `test-schemas.mjs`, `test-check-registry.mjs`, `test-evidence.mjs`, `test-concerns.mjs`, and `test-risk-policy.mjs`
  - Covers pre-model activation, durable restart, fixed node minting, exact reconciliation, certificate versioning, finding routing, and post-build drift.

### Fixtures, public evidence, and self-application

- Preserve `build-gate/examples/self/` byte-for-byte
  - The historical packet-only fixture remains valid prior evidence and is explicitly insufficient for the new production self-hosting assertion.
- Create `build-gate/examples/production-profile-self/README.md`, `dossier.json`, `runtime-adapter.json`, and `production-controls.json`
  - Provides the separately authorized TELOS self-profile and machine-readable host adapter/control artifacts.
- Create `docs/runs/production-profile-demo/run.mjs`, `fixtures/`, `README.md`, and one immutable
  manifest-closed `publication/` directory
  - Proves unsafe synthetic AI egress blocks, corrected behavior passes, and profile escalation invalidates authorization from exact committed fixtures.
- Create `docs/runs/production-profile-self/run.mjs`, `publication-attempts.jsonl`, `fixtures/`,
  `README.md`, and immutable `attempts/attempt-NNN/` plan, public-keyring, approval, authorization,
  review-packet, ledger, process-record, manifest, and summary artifacts
  - Publishes signed public evidence once per immutable attempt, preserves every superseded attempt,
    then provides a deterministic `--verify-committed` path that re-derives and verifies the uniquely
    published attempt offline without regenerating signatures or retaining a private key.
- Create `docs/production-profile.md`
  - Explains the host dossier, evidence adapters, obligation catalog, operational limits, and extension seam.
- Modify `README.md`
  - Adds the production-reality problem statement, two deterministic commands, self-hosting evidence, and explicit non-certification language.
- Modify `.github/workflows/ci.yml`
  - Runs package, demo, self-hosting, import-audit, and clean-checkout verification on the binding Node 18/20 matrix.

### Institutional lifecycle completion

- Create before implementation: `docs/runs/production-profile-compiler-1-workshop/`
  - Stores candidate/matured plan, signed workshop events, actual seat provenance, result, and verifier for the exact Daedalus run.
- Create before implementation: `docs/runs/production-profile-compiler-authorization-1/`
  - Stores required/advisory authorization packets, exact matured-plan hash, gate summary, and refusal/pass result.
- Create before implementation: `docs/runs/production-profile-compiler-argo-1/reader-answers.json`, `reader-validation-artifact.json`, and `STEP-LEDGER.json`
  - Stores the Argo entry comprehension result and append-only authorized-slice evidence; it is separate from the already committed Iliad quest-entry artifacts under `docs/runs/production-profile-compiler-1/`.
- Create `docs/institutional-memory/telos/CONTRACTS/production-profile.json`
  - Records the implemented authorization and settlement contract with executable oracle references.
- Modify `docs/institutional-memory/telos/INVARIANTS.json`, `comprehension-queries.json`, and the matching reader fixtures
  - Adds controller jurisdiction, exact profile binding, post-build drift, and no-self-bypass comprehension.
- Modify `docs/institutional-memory/verify-contracts.mjs`
  - Rebuilds production-profile contract values from live code and verifies the self-hosting evidence path.
- Modify `docs/institutional-memory/iliad/CONTRACTS/enrollment.json`
  - Enrolls the delivered production-profile build-gate spine extension against the existing `telos` institutional-memory directory only after evidence, Clotho weave, and retrospective exist; no new package root or mythological component is created.
- Create `docs/institutional-memory/iliad/RETROSPECTIVES/production-profile-compiler-1.json`
  - Records actual stage provenance, defects, verification, and at least one feed-forward optimization with an exact landing path.
- Create `docs/institutional-memory/iliad/MODEL-REVIEWS/2026-07-20-production-profile-compiler-1.json`
  - Records the post-implementation Iliad review with actual seat provenance, exact reviewed commit, findings, dispositions, and submission status.
- Create `docs/runs/production-profile-compiler-1/acceptance.json`
  - Records the final whole-branch acceptance matrix from committed bytes, including Node 18/20 CI links and explicit non-claims.
- Create one loadout per authorized slice:
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-01.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-02.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-03.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-04.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-05.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-06.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-07.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-08.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-09.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-10.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-11.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-12.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-13.json`
  - `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-14.json`
  - Each record binds the exact authorized plan and slice, actual environment/capabilities, required external capability packets, and stop conditions; it is committed with the slice it governs.

---

## Execution Preconditions

1. Fetch `origin`, require no unexpected divergence, read `CURRENT-AUTHORITY.json`, and run `node docs/institutional-memory/verify-contracts.mjs`.
2. Require the committed quest-entry artifact to report `COMPREHENSION_PASSED`, `19` passed, `0` failed, active-plan hash verified, and all superseded authorizations excluded.
3. Run the Daedalus workshop over this candidate plan. Preserve every round, controller-computed objection identity, and actual per-seat provenance. Convergence means submission, never authorization.
4. Obtain a TELOS authorization whose `authorizes_plan` exactly equals the matured plan hash. Required-seat dissent, missing signature/provenance, unavailable seat, stale plan, or certificate mismatch blocks.
5. Update `CURRENT-AUTHORITY.json` only through the reviewed change protocol if The Eye adopts the new plan; do not infer authority from this filename, branch, design approval, or model consensus.
6. Produce a per-slice loadout record before each authorized Argo slice. Slice IDs are exactly
   `production-profile-01` through `production-profile-14`, so the existing loadout oracle's
   `TASK-LOADOUTS/task-${task}.json` derivation resolves the paths listed above. Missing external
   capabilities become gate-enforced capability packets; unavailable Node 18/20 CI or live council
   seats cannot be silently skipped.
7. Pass the Argo comprehension gate against the then-current authority. Its legacy `implementation_authority: "GRANTED"` label remains an entry precondition; The Eye still holds implementation authority.
8. Confirm the worktree contains no unrelated staged changes. Every task below commits only its named files and leaves the tree clean before the next review gate.
9. Before Task 1, make three explicit governance commits from clean tracked states:

   ```bash
   git add docs/superpowers/plans/2026-07-20-deterministic-production-profile-compiler.md \
     docs/runs/production-profile-compiler-1-workshop
   git diff --cached --check
   git commit -m "docs(daedalus): mature production profile compiler plan"
   git add docs/runs/production-profile-compiler-authorization-1
   git diff --cached --check
   git commit -m "docs(telos): authorize production profile compiler plan"
   git add docs/runs/production-profile-compiler-argo-1/reader-answers.json \
     docs/runs/production-profile-compiler-argo-1/reader-validation-artifact.json \
     docs/runs/production-profile-compiler-argo-1/STEP-LEDGER.json
   git diff --cached --check
   git commit -m "docs(argo): enter production profile compiler implementation"
   ```

   The first commit must contain the exact matured plan bytes as well as the workshop evidence; the
   authorization run starts only from that clean commit and binds that committed raw file SHA-256.
   The initial ledger is exactly
   `{ "kind": "evidence", "id": "production-profile-step-ledger", "plan_ref":
   "<authorized matured-plan ref>", "events": [] }`, serialized as canonical JSON plus one final LF.
   The authorization commit must exist before the
   Argo entry run, and each record must name the commit it evaluated. If The Eye directs an active
   authority change, update `CURRENT-AUTHORITY.json` only in its own reviewed change-protocol commit;
   these commands do not silently grant that change.
10. In every task, Step 1 instantiates this exact loadout envelope, replacing `NN`, subject,
    capabilities, reuse/review/verification arrays, and stop conditions with that slice's reviewed
    values:

    ```json
    {
      "kind": "evidence",
      "component": "loadout",
      "id": "task-loadout-production-profile-NN",
      "task": "production-profile-NN",
      "subject": "<closed slice subject>",
      "normativity": "ADVISORY",
      "status": "NORMATIVE-CURRENT",
      "note": "ADVISORY per-task loadout review; it cannot grant implementation authority.",
      "entry_ritual": "docs/runs/production-profile-compiler-argo-1/reader-validation-artifact.json",
      "authorized_plan_ref": "sha256:<exact matured plan>",
      "environment": {
        "binding_node_versions": ["18", "20"],
        "local_node_supplementary": true
      },
      "capability_packets": [],
      "loadout": {
        "reuse": [],
        "review": [],
        "verification": []
      },
      "optimization_opportunities": ["<at least one reviewed opportunity>"],
      "stop_conditions": ["<at least one exact fail-closed condition>"]
    }
    ```

    Validate the exact file before any red test, code edit, publication, or external seat call:

    ```bash
    node --input-type=module - \
      docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-NN.json \
      production-profile-NN \
      docs/superpowers/plans/2026-07-20-deterministic-production-profile-compiler.md <<'NODE'
    import { createHash } from "node:crypto";
    import fs from "node:fs";

    const [file, id, planPath] = process.argv.slice(2);
    const exactKeys = (value, keys) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
    const text = value =>
      typeof value === "string" &&
      value === value.trim() &&
      value.length > 0 &&
      !value.includes("<") &&
      !value.includes(">");
    const list = (value, { nonempty = false, path = false } = {}) => {
      if (!Array.isArray(value) || (nonempty && value.length === 0) || !value.every(text)) return false;
      if (new Set(value).size !== value.length ||
          JSON.stringify(value) !== JSON.stringify([...value].sort())) return false;
      return !path || value.every(item =>
        !item.startsWith("/") &&
        !item.includes("\\") &&
        item.split("/").every(part => part !== "" && part !== "." && part !== "..") &&
        fs.statSync(item, { throwIfNoEntry: false })?.isFile());
    };

    let x;
    try {
      x = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      process.exit(2);
    }
    const planRef = `sha256:${createHash("sha256").update(fs.readFileSync(planPath)).digest("hex")}`;
    const ok =
      exactKeys(x, [
        "kind", "component", "id", "task", "subject", "normativity", "status", "note",
        "entry_ritual", "authorized_plan_ref", "environment", "capability_packets", "loadout",
        "optimization_opportunities", "stop_conditions"
      ]) &&
      x.kind === "evidence" &&
      x.component === "loadout" &&
      x.id === `task-loadout-${id}` &&
      x.task === id &&
      text(x.subject) &&
      x.normativity === "ADVISORY" &&
      x.status === "NORMATIVE-CURRENT" &&
      x.note === "ADVISORY per-task loadout review; it cannot grant implementation authority." &&
      x.entry_ritual === "docs/runs/production-profile-compiler-argo-1/reader-validation-artifact.json" &&
      x.authorized_plan_ref === planRef &&
      exactKeys(x.environment, ["binding_node_versions", "local_node_supplementary"]) &&
      JSON.stringify(x.environment.binding_node_versions) === JSON.stringify(["18", "20"]) &&
      x.environment.local_node_supplementary === true &&
      list(x.capability_packets, { path: true }) &&
      exactKeys(x.loadout, ["reuse", "review", "verification"]) &&
      list(x.loadout.reuse) &&
      list(x.loadout.review) &&
      list(x.loadout.verification) &&
      list(x.optimization_opportunities, { nonempty: true }) &&
      list(x.stop_conditions, { nonempty: true });
    if (!ok) process.exit(2);
    NODE
    node docs/institutional-memory/verify-contracts.mjs
    git add docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-NN.json
    git diff --cached --check
    git commit -m "docs(loadout): record production profile task NN"
    ```

    When `CURRENT-AUTHORITY.json#implementation_authority.specified_pending_slices` names the slice, the
    unchanged global oracle independently derives and verifies the same path. A loadout is immutable
    after the governed slice starts; its later appearance in a slice staging list normally stages no
    change.
11. Every failed, superseded, or accepted slice attempt appends an immutable event; no event is edited
    in place. After every Task `NN` final slice commit and green verification, The Eye either accepts the
    slice or stops execution. On acceptance, append this event to
    `docs/runs/production-profile-compiler-argo-1/STEP-LEDGER.json`:

    ```json
    {
      "sequence": "<next positive integer>",
      "event": "SLICE_ACCEPTED",
      "task": "production-profile-NN",
      "loadout_ref": "sha256:<canonical loadout>",
      "slice_commit": "git:<full 40-hex commit>",
      "slice_tree": "git:<full 40-hex tree>",
      "verification": [
        { "command": "<exact command>", "exit": 0, "node": "18|20|supplementary" }
      ],
      "accepted_by": "The Eye",
      "supersedes": []
    }
    ```

    A failed event uses `event: "SLICE_FAILED"`, `slice_commit: null`, `slice_tree: null`,
    `accepted_by: null`, empty `supersedes`, and at least one non-zero verification result. A
    supersession event uses `event: "SLICE_SUPERSEDED"`, null commit/tree, `accepted_by: "The Eye"`,
    at least one non-zero disposition command, and names one or more earlier same-task
    accepted/failed event sequence numbers in `supersedes`; it does not erase them. Only
    non-superseded accepted events advance the strict task prefix. Validate the exact closed ledger,
    event, and verification key sets; equality to the committed authorized plan; exact canonical
    loadout refs; full Git object/tree resolution; one-event append against the complete `HEAD` event
    array; exact active accepted-task order; and all event-specific rules before the distinct closure
    commit:

    ```bash
    node --input-type=module - \
      docs/runs/production-profile-compiler-argo-1/STEP-LEDGER.json \
      docs/superpowers/plans/2026-07-20-deterministic-production-profile-compiler.md <<'NODE'
    import { execFileSync } from "node:child_process";
    import { createHash } from "node:crypto";
    import fs from "node:fs";
    import { canonicalize, sha256hex } from "./merkle-dag/vendor.mjs";

    const [ledgerPath, planPath] = process.argv.slice(2);
    const exactKeys = (value, keys) =>
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
    const fail = () => process.exit(2);
    const currentBytes = fs.readFileSync(ledgerPath, "utf8");
    let x;
    try {
      x = JSON.parse(currentBytes);
    } catch {
      fail();
    }
    const planRef = `sha256:${createHash("sha256").update(fs.readFileSync(planPath)).digest("hex")}`;
    if (!exactKeys(x, ["kind", "id", "plan_ref", "events"]) ||
        x.kind !== "evidence" ||
        x.id !== "production-profile-step-ledger" ||
        x.plan_ref !== planRef ||
        !Array.isArray(x.events) ||
        currentBytes !== `${canonicalize(x)}\n`) fail();

    let previous = null;
    try {
      const previousBytes =
        execFileSync("git", ["show", `HEAD:${ledgerPath}`], { encoding: "utf8" });
      previous = JSON.parse(previousBytes);
      if (previousBytes !== `${canonicalize(previous)}\n`) fail();
    } catch {
      if (x.events.length !== 0) fail();
    }
    if (previous !== null) {
      if (!exactKeys(previous, ["kind", "id", "plan_ref", "events"]) ||
          previous.kind !== x.kind ||
          previous.id !== x.id ||
          previous.plan_ref !== x.plan_ref ||
          !Array.isArray(previous.events) ||
          x.events.length !== previous.events.length + 1 ||
          canonicalize(x.events.slice(0, previous.events.length)) !== canonicalize(previous.events)) fail();
    }

    const eventKeys = [
      "sequence", "event", "task", "loadout_ref", "slice_commit", "slice_tree",
      "verification", "accepted_by", "supersedes"
    ];
    const verificationKeys = ["command", "exit", "node"];
    const kinds = new Set(["SLICE_ACCEPTED", "SLICE_FAILED", "SLICE_SUPERSEDED"]);
    const commits = new Set();
    const superseded = new Set();
    for (let index = 0; index < x.events.length; index++) {
      const e = x.events[index];
      if (!exactKeys(e, eventKeys) ||
          e.sequence !== index + 1 ||
          !kinds.has(e.event) ||
          !/^production-profile-(0[1-9]|1[0-4])$/.test(e.task) ||
          !Array.isArray(e.verification) ||
          e.verification.length === 0 ||
          !e.verification.every(v =>
            exactKeys(v, verificationKeys) &&
            typeof v.command === "string" &&
            v.command === v.command.trim() &&
            v.command.length > 0 &&
            Number.isSafeInteger(v.exit) &&
            v.exit >= 0 &&
            v.exit <= 255 &&
            new Set(["18", "20", "supplementary"]).has(v.node)) ||
          !Array.isArray(e.supersedes) ||
          new Set(e.supersedes).size !== e.supersedes.length ||
          JSON.stringify(e.supersedes) !== JSON.stringify([...e.supersedes].sort((a, b) => a - b)) ||
          e.supersedes.some(n => !Number.isSafeInteger(n) || n < 1 || n >= e.sequence)) fail();

      const suffix = e.task.slice(-2);
      const loadoutPath =
        `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-${suffix}.json`;
      let loadout;
      try {
        loadout = JSON.parse(fs.readFileSync(loadoutPath, "utf8"));
      } catch {
        fail();
      }
      if (e.loadout_ref !== `sha256:${sha256hex(canonicalize(loadout))}`) fail();

      if (e.event === "SLICE_ACCEPTED") {
        if (e.accepted_by !== "The Eye" ||
            e.supersedes.length !== 0 ||
            e.verification.some(v => v.exit !== 0) ||
            !/^git:[0-9a-f]{40}$/.test(e.slice_commit) ||
            !/^git:[0-9a-f]{40}$/.test(e.slice_tree) ||
            commits.has(e.slice_commit)) fail();
        commits.add(e.slice_commit);
        const commit = e.slice_commit.slice(4);
        try {
          execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`]);
          const tree = execFileSync("git", ["show", "-s", "--format=%T", commit], { encoding: "utf8" }).trim();
          if (`git:${tree}` !== e.slice_tree) fail();
        } catch {
          fail();
        }
      } else if (e.event === "SLICE_FAILED") {
        if (e.accepted_by !== null ||
            e.slice_commit !== null ||
            e.slice_tree !== null ||
            e.supersedes.length !== 0 ||
            !e.verification.some(v => v.exit !== 0)) fail();
      } else {
        if (e.accepted_by !== "The Eye" ||
            e.slice_commit !== null ||
            e.slice_tree !== null ||
            e.supersedes.length === 0 ||
            !e.verification.some(v => v.exit !== 0) ||
            e.supersedes.some(n =>
              superseded.has(n) ||
              x.events[n - 1].event === "SLICE_SUPERSEDED" ||
              x.events[n - 1].task !== e.task)) fail();
        for (const n of e.supersedes) superseded.add(n);
      }
    }
    const activeAccepted = x.events.filter(e =>
      e.event === "SLICE_ACCEPTED" && !superseded.has(e.sequence));
    for (let index = 0; index < activeAccepted.length; index++) {
      if (activeAccepted[index].task !==
          `production-profile-${String(index + 1).padStart(2, "0")}`) fail();
    }
    NODE
    git add docs/runs/production-profile-compiler-argo-1/STEP-LEDGER.json
    git diff --cached --check
    git commit -m "docs(argo): accept production profile task NN"
    ```

    Never rewrite failed/superseded entries, and never begin the next task with an uncommitted ledger
    append or any other dirty tracked file.

---

## Task Dependency Map

1. Task 1 freezes production input, activation, findings, canonical references, and CLI behavior.
2. Task 2 adds deterministic repository facts and monotonic reconciliation on Task 1's profile types.
3. Task 3 adds the pinned policy, all 31 rules, source records, and pure compiler over Tasks 1–2.
4. Task 4 adds backward-compatible Merkle obligation/lifecycle identity consumed by later proposal tasks.
5. Task 5 adds additive policy certificate version 2 and plan-aware authorization dispatch.
6. Task 6 adds registry versioning plus structural/process checks.
7. Task 7 adds the six runtime check kinds over the same registry contract.
8. Task 8 records production artifacts and blocks before model calls.
9. Task 9 mints fixed nodes, reconstructs from disk, and reconciles the version-2 certificate.
10. Task 10 re-runs the profile at settlement and blocks drift.
11. Task 11 proves catalog completeness and the synthetic bank scenario.
12. Task 12 proves TELOS first-host self-application with no privileged path.
13. Task 13 publishes docs, CI, institutional contracts, weave evidence, retrospective, and enrollment.
14. Task 14 runs the whole-branch acceptance battery from committed bytes.

---

### Task 1: Freeze production input, activation, artifact, finding, and CLI contracts

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-01.json`
- Create: `build-gate/production-profile/canonical.mjs`
- Create: `build-gate/production-profile/json.mjs`
- Create: `build-gate/production-profile/profile-schema.mjs`
- Create: `build-gate/production-profile/artifact-io.mjs`
- Create: `build-gate/production-profile/cli.mjs`
- Create: `build-gate/scripts/test-production-profile.mjs`
- Create: `build-gate/scripts/test-production-profile-cli.mjs`
- Modify: `build-gate/package.json`

**Interfaces:**
- Produces: `codeUnitCompare(a, b)` and `hashCanonical(value) -> "sha256:<hex>"` from
  `production-profile/canonical.mjs`; the module imports only `canonicalize` and `sha256hex` from
  `../../merkle-dag/vendor.mjs`.
- Produces: `parseClosedJson(bytes, { maxBytes, label }) -> value`; its recursive-descent parser rejects
  duplicate object keys before materialization instead of relying on `JSON.parse` last-key-wins behavior.
- Produces: `activationFor(dossier) -> { active, reasons }`, where `reasons` is the sorted subset of `["market-bound","production-evidence-present","production-profile-present","proposal-lifecycle"]`.
- Produces: `validateAndProjectProductionInput(dossier) -> { ok, input, findings }`; `input` contains only `build_context`, `production_profile`, and `production_evidence`.
- Produces: `canonicalProductionInput(dossier) -> { canonical, input, production_input_ref }`; throws only for programmer misuse, never for controller validation findings.
- Produces: `makeFinding(code, severity, path, detail) -> closed finding`.
- Produces: `readStableJson(repoRoot, relPath, { maxBytes }) -> parsed value` and `writeCanonicalJsonAtomic(repoRoot, relPath, value) -> { path, bytes_sha256 }`.
- Produces: `parseCliArgs(argv) -> { command, dossier?, inputArtifact?, compiledArtifact?, repo, out? }` and `runCli({ argv, compileFn, verifyFn, stdout, stderr }) -> Promise<0|1|2>`.
- Consumes later: `compileFn` and `verifyFn` from Task 3. This task tests command parsing and status/output behavior with injected deterministic functions; it does not invent a temporary compiler.

- [ ] **Step 1: Create the authorized slice loadout**

Write the Argo `TASK-LOADOUT` record for this slice before editing code. It must name Node 18/20 as binding, local Node as supplementary, list no external capability packet, bind the matured authorized plan hash, and state that controller schema choices are frozen by this task rather than delegated to a model.

- [ ] **Step 2: Write the failing activation and profile tests**

In `test-production-profile.mjs`, assert all of the following before implementation:

```js
assert.deepEqual(activationFor({}), { active: false, reasons: [] });
assert.equal(activationFor({ proposal_lifecycle: true }).active, true);
assert.equal(activationFor({ market_bound: true }).active, true);
assert.equal(activationFor({ production_profile: {} }).active, true);
assert.equal(activationFor({ production_evidence: {} }).active, true);
```

Add a complete minimal valid dossier and negative table covering:

- every missing, unknown, wrong-type, out-of-range, and additional field;
- every closed enum and identifier pattern;
- sorting and duplicate rejection for every set-like array;
- exclusive `"none"` semantics;
- all AI, payment, tenancy, retention, recovery, integration, and provider cross-field rules;
- AI/integration data classes outside the top-level declaration;
- unsafe evidence paths, external/non-literal-loopback URLs, malformed health paths, and duplicate evidence paths;
- secret-shaped keys and values, including `token`, `secret`, `password`, credential material, account IDs, and personal-data samples; the synthetic marker belongs only in Task 11 runtime fixtures, never in the controller dossier;
- exact `PROFILE_REQUIRED`, `PROPOSAL_LIFECYCLE_REQUIRED`, `PROFILE_SCHEMA`, and `PROFILE_CONTRADICTION` finding shape and severity.

Assert reordered object keys and reordered set arrays produce the exact same canonical input and `production_input_ref`.

- [ ] **Step 3: Run the focused test and record the red result**

Run:

```bash
node build-gate/scripts/test-production-profile.mjs
```

Expected: failure because `production-profile/profile-schema.mjs` and `artifact-io.mjs` do not exist.

- [ ] **Step 4: Implement the closed controller schema**

Create the shared helper first:

```js
import { canonicalize, sha256hex } from "../../merkle-dag/vendor.mjs";

export function codeUnitCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function hashCanonical(value) {
  return `sha256:${sha256hex(canonicalize(value))}`;
}
```

`profile-schema.mjs`, `repo-facts.mjs`, `policy-loader.mjs`, `source-record.mjs`, and `compiler.mjs`
must import these exports; no Task 1–3 module owns a shadow comparator or hash helper. Then use literal
closed-key tables and pure validation. The public shape must be:

```js
export const FINDING_CODES = Object.freeze([
  "PROFILE_REQUIRED",
  "PROPOSAL_LIFECYCLE_REQUIRED",
  "PROFILE_SCHEMA",
  "PROFILE_CONTRADICTION",
  "PROFILE_ESCALATED",
  "CLASSIFICATION_REQUIRED",
  "STALE_SIGNAL_RESOLUTION",
  "REPO_SCAN_LIMIT",
  "REPO_SCAN_UNSAFE_PATH",
  "POLICY_INVALID",
  "POLICY_VERSION",
  "CHECK_KIND_UNREGISTERED",
  "CHECK_CONTRACT_STALE",
  "EVIDENCE_ADAPTER_REQUIRED",
  "EVIDENCE_FORMAT_UNSUPPORTED",
  "PRODUCTION_SOURCE_MISMATCH",
  "PRODUCTION_OBLIGATION_MISMATCH",
  "PRODUCTION_LIFECYCLE_MISMATCH",
  "BLOCKED_PROFILE_DRIFT",
  "CANNOT_RUN"
]);

export function activationFor(dossier = {}) {
  const reasons = [];
  if (dossier.market_bound === true) reasons.push("market-bound");
  if (Object.hasOwn(dossier, "production_evidence")) reasons.push("production-evidence-present");
  if (Object.hasOwn(dossier, "production_profile")) reasons.push("production-profile-present");
  if (dossier.proposal_lifecycle === true) reasons.push("proposal-lifecycle");
  reasons.sort(codeUnitCompare);
  return { active: reasons.length > 0, reasons };
}
```

Validation must reject non-NFC controller strings rather than silently changing controller-authored meaning. Canonicalization normalizes path separators to POSIX only after validating safe repository-relative paths. It never inserts host-derived defaults.

- [ ] **Step 5: Implement stable JSON I/O and atomic replacement**

`artifact-io.mjs` must:

- resolve the repository root once with `realpathSync`;
- reject absolute, empty, dot-segment, NUL, backslash-semantic, and physically escaping paths;
- open required files, compare `fstat` identity/size/mtime before and after the bounded read, and return cannot-run detail if changed;
- decode JSON bytes as fatal UTF-8 through `parseClosedJson`, reject duplicate keys before object materialization, and reject prototype-polluting keys recursively;
- write a sibling temporary file with mode `0o600`, fsync, rename atomically, and remove only its own temporary file on failure;
- never replace a valid existing output after validation, compilation, serialization, or fsync failure.

`json.mjs` must tokenize the complete JSON grammar, reject trailing content, duplicate keys at every
depth, `__proto__`/`prototype`/`constructor` keys, unpaired surrogates, non-safe integers, `NaN`, and
infinities, then materialize null-prototype objects. It must not evaluate source or use a regex-only
duplicate-key heuristic.

- [ ] **Step 6: Write the failing CLI tests**

In `test-production-profile-cli.mjs`, test:

- only `compile --dossier --repo --out` and `verify --input-artifact --compiled-artifact --repo`;
- no positional aliases, duplicate flags, unknown flags, omitted values, or implicit dossier;
- both success paths return `0`, canonical JSON to stdout, and one concise stderr line; only `compile`
  writes one atomic output artifact, while `verify` is read-only and replaces neither input;
- deterministic blockers return `2`;
- cannot-run takes precedence and returns `1`;
- a failed invocation leaves a sentinel output byte-for-byte unchanged;
- absolute `--repo` is accepted only at the process boundary; semantic reports contain repository-relative POSIX paths;
- injected functions are called exactly once and receive no ambient environment or clock.

- [ ] **Step 7: Run the CLI test and record the red result**

Run:

```bash
node build-gate/scripts/test-production-profile-cli.mjs
```

Expected: failure because `parseCliArgs` and `runCli` are not implemented.

- [ ] **Step 8: Implement the CLI shell without weakening dependency order**

Implement argument parsing and an injectable dispatcher. The executable main path dynamically invokes the Task 3 compiler exports only after arguments and repository paths validate:

```js
export async function runCli({
  argv,
  compileFn,
  verifyFn,
  stdout = process.stdout,
  stderr = process.stderr
}) {
  // Parse closed flags, invoke exactly one injected operation, print canonical
  // report, atomically replace only a successful compile output, preserve
  // cannot-run precedence, and return 0, 1, or 2.
}
```

Do not use `process.cwd()` as an implicit dossier or output. The CLI may use `process.exitCode` only in its executable guard; library callers receive the numeric status.

- [ ] **Step 9: Register and run focused green tests**

Add both scripts to `build-gate/package.json` `check`/`test` in the existing deterministic order.
`build-gate/test-runner.mjs` is an advisory runtime executor, not a test registry, and is unchanged in
this task.

Run:

```bash
node build-gate/scripts/test-production-profile.mjs
node build-gate/scripts/test-production-profile-cli.mjs
node build-gate/scripts/test-schemas.mjs
node build-gate/scripts/test-gate.mjs
```

Expected: all assertions pass; legacy model-response and dossier tests remain unchanged.

- [ ] **Step 10: Commit the slice**

```bash
git add build-gate/production-profile/canonical.mjs \
  build-gate/production-profile/profile-schema.mjs \
  build-gate/production-profile/json.mjs \
  build-gate/production-profile/artifact-io.mjs \
  build-gate/production-profile/cli.mjs \
  build-gate/scripts/test-production-profile.mjs \
  build-gate/scripts/test-production-profile-cli.mjs \
  build-gate/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-01.json
git commit -m "feat(production-profile): freeze controller input and CLI contracts"
```

---

### Task 2: Add deterministic repository facts and monotonic reconciliation

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-02.json`
- Create: `build-gate/production-profile/repo-facts.mjs`
- Modify: `build-gate/scripts/test-production-profile.mjs`
- Modify: `build-gate/package.json`

**Interfaces:**
- Consumes: canonical path, finding, profile, and stable-read helpers from Task 1.
- Produces: `scanRepository({ repoRoot, policy, productionInput, declaredOutputs = [] }) -> { ok, repo_facts, findings }`.
- Produces: `reconcileProfile({ declaredProfile, repoFacts, signalResolutions }) -> { ok, effectiveProfile, resolvedSignals, findings }`.
- Produces semantic records exactly as `{ facts_version: 1, facts: [...], signals: [...] }`.
- Produces `repoFactsRef(repoFacts) -> "sha256:<hex>"`; unrelated bytes cannot alter this reference.

- [ ] **Step 1: Create the authorized slice loadout**

Record scanner limits, registered file classes, local filesystem capability, no-network status, and the exact authorized plan hash. Any required detector or format not frozen below is a planning defect and blocks this slice.

- [ ] **Step 2: Add failing scanner fixtures and assertions**

Create temporary repositories in `test-production-profile.mjs` and assert:

- deterministic results across directory creation order, JSON key order, and CRLF/LF text;
- semantic fact identity is unchanged by unrelated comments or whitespace;
- exact registered dependency/config keys create confirmed facts;
- bounded imports, provider hosts, tool declarations, retrieval declarations, public AI routes, training jobs, and sensitive-domain surfaces create signals only;
- unresolved current signals yield `CLASSIFICATION_REQUIRED`;
- exact current `confirmed` and `false-positive` resolutions pass and are hash-bound;
- stale, duplicate, fabricated, or missing signal resolutions yield `STALE_SIGNAL_RESOLUTION`;
- observations union data classes/capabilities and raise ordered fields but never lower them;
- non-ordered contradictions block with `PROFILE_CONTRADICTION`;
- symlink escape, changed-during-read, unreadable required files, per-file limit, aggregate limit, malformed registered JSON, and invalid UTF-8 yield cannot-run;
- `.git/`, `.telos/`, `node_modules/`, dependency caches, binary/NUL files, and unregistered extensions are skipped;
- host ignore files cannot suppress a registered detector;
- declared outputs and policy-registered files are scanned even when untracked;
- no absolute host path, traversal timestamp, locale result, or scan-order artifact enters semantic output.

- [ ] **Step 3: Run the scanner tests and record the red result**

Run:

```bash
node build-gate/scripts/test-production-profile.mjs
```

Expected: failure because `scanRepository`, `reconcileProfile`, and `repoFactsRef` are absent.

- [ ] **Step 4: Implement the frozen scanner contract**

Freeze these rules in code and tests:

```js
export const SCAN_LIMITS = Object.freeze({
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024
});

export const REGISTERED_SOURCE_EXTENSIONS = Object.freeze([
  ".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"
]);

export const SKIPPED_DIRECTORIES = Object.freeze([
  ".git", ".next", ".npm", ".pnpm-store", ".telos",
  ".yarn", "coverage", "dist", "node_modules"
]);
```

Structured JSON is read only from exact registered manifests and detector-owned paths: `package.json`,
`package-lock.json`, `npm-shrinkwrap.json`, the runtime adapter, production control artifacts, process
keyring/records, and policy-declared JSON targets. `yarn.lock`, `pnpm-lock.yaml`, `bun.lock`, and
`.github/workflows/*.yml|*.yaml` contribute only normalized path/kind presence observations; they are not
parsed for semantics and their raw content hashes do not enter `repo_facts_ref` or the compiled artifact.
When a structural obligation needs exact lock/workflow bytes, its normalized control lists the
path/hash and the registered check verifies current bytes. Source extensions are scanned only for
bounded text signals. No general YAML, HCL, Terraform, workflow-language, or arbitrary JSON inference
is allowed.

`policy.v1.json` owns a closed detector table. Each detector has exactly
`{ detector_id, input_kind, exact_names, emits }`; `input_kind` is one of
`package-dependency`, `registered-json-pointer`, `registered-file-presence`, or `source-signal`.
`emits` is one closed confirmed fact or classification signal template. Every exact name/mapping has a
positive and near-miss fixture. Unknown dependencies remain unclassified; they do not silently acquire
AI, payment, identity, persistence, or telemetry semantics.

Freeze the initial dependency names:

```text
provider SDK confirmed facts (package -> provider ID):
  @anthropic-ai/sdk -> anthropic
  @aws-sdk/client-bedrock-runtime -> aws-bedrock
  @azure/openai -> azure-openai
  @google/generative-ai -> google
  @google/genai -> google
  cohere-ai -> cohere
  openai -> openai

AI classification signals:
  @langchain/core, ai, langchain, llamaindex

payment classification signals:
  @paypal/paypal-server-sdk, braintree, square, stripe

identity classification signals:
  @auth/core, jose, jsonwebtoken, next-auth, passport

persistence classification signals:
  @prisma/client, better-sqlite3, mongodb, mongoose, mysql2, pg, sequelize

telemetry classification signals:
  @opentelemetry/api, @sentry/node, pino, winston
```

`package-dependency` reads exact own keys from `dependencies` and `optionalDependencies`. A matching
name under `devDependencies` or `peerDependencies` emits a section-bound classification signal instead
of a confirmed production fact. Other package fields are not dependency evidence.

Provider SDK facts emit the exact mapped provider ID, `ai.enabled: true`, provider `external: true`, and
`ai.external_egress: true`; they do not invent purpose, region, retention, or training-use fields. If
the controller inventory omits that provider, compilation requires a controller correction. The other
dependency groups do not guess non-ordered profile values: they emit classification signals whose
controller resolution is required. Text detectors use exact literals for the same package imports plus
`api.openai.com`, `api.anthropic.com`,
`generativelanguage.googleapis.com`, tool/function-call declarations, vector/retrieval declarations,
public chat routes, and training/fine-tuning declarations. This list is intentionally bounded and is not
a complete dependency, data, or provider inventory.

Import `codeUnitCompare` and `hashCanonical` from Task 1's
`production-profile/canonical.mjs`; `repoFactsRef()` uses that shared hash helper. Do not use or define
`localeCompare`. Normalize CRLF/CR to LF before registered text matching. Fatal UTF-8 decode
failure on a required/registered text file is cannot-run; NUL-bearing unregistered source is classified
as binary and skipped. Semantic paths always use `/`.

- [ ] **Step 5: Implement defensive traversal and changed-during-read detection**

Traverse entries in code-unit order, `lstat` every entry, resolve symlinks physically, and reject any
registered path outside `realRepoRoot`. For each required read, compare device, inode where available,
size, and high-resolution mtime before and after reading. Accept no partial fact set after any
cannot-run condition.

Do not recurse through directory symlinks/junctions. A policy/evidence-declared file symlink is readable
only when its final real path is a regular file inside the root; track real paths and fail if two
semantic paths alias the same required physical file. This closes cycles and duplicate-evidence
ambiguity without making an internal symlink an escape by definition.

The final scan contract must accept `declaredOutputs`; it unions those safe paths with policy/evidence
paths before traversal so a newly generated, untracked structural artifact cannot evade drift
classification.

General repository-fact traversal always skips `.telos/`. Explicit evidence readers may still read the
exact controller-declared process keyring or proposal artifact below `.telos/`; those bytes contribute
only to `evidence_config_ref`/reconstruction and never become repository facts. Declared structural
outputs below ordinary host paths are included in final scanning even when untracked.

- [ ] **Step 6: Implement field-specific monotonic joins**

Use explicit rank maps for:

```text
exposure: local-only < internal < external
tenancy: single-tenant < multi-tenant
persistence: none < ephemeral < durable
users: single-operator < workforce < customers < public
```

Use set union for classes/capabilities and false-to-true joins for booleans. Emit one canonical
`PROFILE_ESCALATED` advisory per changed field, sorted by JSON Pointer. Reject confirmed inventories that
cannot be monotonically represented, such as an observed provider excluded from the declared inventory,
until the controller updates the dossier.

- [ ] **Step 7: Run focused and portability regressions**

Run:

```bash
node build-gate/scripts/test-production-profile.mjs
node build-gate/scripts/test-production-profile-cli.mjs
node --check build-gate/production-profile/repo-facts.mjs
```

Expected: scanner, schema, and CLI contract tests pass with no network access and no generated files left
in the repository.

- [ ] **Step 8: Commit the slice**

```bash
git add build-gate/production-profile/repo-facts.mjs \
  build-gate/scripts/test-production-profile.mjs \
  build-gate/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-02.json
git commit -m "feat(production-profile): add deterministic repository facts"
```

---

### Task 3: Add the pinned policy, 31 source records, and pure compiler

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-03.json`
- Create: `build-gate/production-profile/policy-loader.mjs`
- Create: `build-gate/production-profile/policy.v1.json`
- Create: `build-gate/production-profile/source-record.mjs`
- Create: `build-gate/production-profile/compiler.mjs`
- Create: `build-gate/scripts/test-production-policy.mjs`
- Modify: `build-gate/production-profile/cli.mjs`
- Modify: `build-gate/scripts/test-production-profile.mjs`
- Modify: `build-gate/scripts/test-production-profile-cli.mjs`
- Modify: `build-gate/package.json`

**Interfaces:**
- Consumes: validated input, shared `codeUnitCompare`/`hashCanonical`, and artifact I/O from Task 1,
  repo facts from Task 2, and the production registry metadata interface that Task 6 will implement.
  Tests inject a closed fake registry until Task 6 replaces it.
- Produces: `loadPolicy(rawBytes) -> { policy, policy_ref, rules }`.
- Produces: `evaluateCondition(condition, compiledProfile) -> boolean`.
- Produces: `makeProductionSource({ rule, profileProjection, evidenceProjection, checkContract }) -> source`.
- Produces: `compileProductionProfile({ productionInput, repoRoot, registry, policyBytes, declaredOutputs }) -> result`.
- Produces: `verifyProductionProfile({ productionInput, expectedArtifact, repoRoot, registry, policyBytes, declaredOutputs }) -> result`.
- Successful compiler artifact is exactly the design's closed `compiler_contract`, seven references, compiled profile, repo facts, production sources, and findings.

- [ ] **Step 1: Create the authorized slice loadout**

Record that policy authorship, trigger semantics, evidence tier, expected result, and catalog membership
are controller jurisdiction. Bind the exact approved design and authorized plan hashes. No model may
select an obligation or mark it inapplicable.

- [ ] **Step 2: Write the policy loader and evaluator red tests**

In `test-production-policy.mjs`, assert rejection of:

- unknown policy/rule keys, policy version, domain, tier, kind, JSON Pointer, condition operator, template
  sentinel, partial interpolation, required result, duplicate ID, malformed stable ID, or duplicate
  projection;
- executable conditions, host environment expansion, commands, expected outcomes in evidence, and
  caller-supplied implementation references;
- a rule whose profile/evidence projection omits a value used by its condition or check parameters.

Test every closed operator (`all`, `any`, `not`, `eq`, `contains`, `intersects`, `gte`, `lte`) with true,
false, malformed, and wrong-type cases. Unknown pointers and type-invalid comparisons must fail policy
loading or compilation, never evaluate false silently.

- [ ] **Step 3: Freeze and test the exact catalog**

Assert exact equality to this ordered ID set:

```js
const EXPECTED_IDS = [
  "AI-CLAIM-001", "AI-DECISION-001", "AI-EGRESS-001", "AI-LINEAGE-001",
  "AI-OPS-001", "AI-OUTPUT-001", "AI-PROVIDER-001", "AI-RAG-001",
  "AI-TENANT-001", "AI-TOOL-001", "AUTHN-001", "AUTHN-002",
  "AUTHZ-001", "AUTHZ-002", "DATA-001", "DATA-002", "DELIVERY-001",
  "DELIVERY-002", "OBS-001", "OBS-002", "PAY-001", "PAY-002",
  "PRIV-001", "PRIV-002", "PRIV-003", "RECOVERY-001", "RECOVERY-002",
  "SCALE-001", "SCALE-002", "SUPPLY-001", "SUPPLY-002"
];
```

For each of the 31 rules, add five table-driven fixtures:

1. nearest valid non-trigger profile;
2. one-fact trigger profile;
3. passing evidence projection and registered check contract;
4. violating or missing evidence;
5. one-byte relevant policy/profile/registry mutation that changes the expected local identity.

Also assert all eleven domains are represented and every tier/kind exactly matches the design catalog.
For paired triggered rules, prove an unrelated profile-field mutation leaves the other rule's
profile projection, source, and check identity unchanged while `profile_ref` changes; prove an
unrelated rule-body mutation leaves the first rule/source unchanged while `policy_ref` changes. Task 9
extends those same cases to local verification-node versus global `plan_hash` identity.

- [ ] **Step 4: Run the policy tests and record the red result**

Run:

```bash
node build-gate/scripts/test-production-policy.mjs
```

Expected: failure because the policy, loader, source records, and compiler do not exist.

- [ ] **Step 5: Implement closed policy loading and condition evaluation**

Parse the checked-in raw JSON, validate the complete closed shape, canonicalize it, and derive:

```text
policy_ref = H(canonical policy)
rule_ref = H(canonical individual rule)
```

Conditions are interpreted recursively from data and cannot call code. Template expansion replaces only
whole values equal to `$profile`, `$evidence`, or `$obligation_id`; it rejects strings containing those
sentinels as substrings. Use JSON Pointer escaping rules and closed known profile/evidence roots.

Expected status codes, response assertions, denial semantics, freshness windows, and operation scenarios
live in `policy.v1.json`. The runtime manifest and controller dossier cannot choose them.

- [ ] **Step 6: Implement production source and reference derivation**

Import `hashCanonical` and `codeUnitCompare` from Task 1's `canonical.mjs`; do not add a local `H` or
locale-sensitive sort. The source constructor must derive exactly:

```js
const identity = {
  record_type: "production-policy-obligation",
  source_version: 1,
  obligation_id,
  domain,
  rule_ref,
  profile_projection_ref,
  evidence_projection_ref,
  check_contract_ref,
  required_result: "pass"
};
return { ...identity, source_ref: hashCanonical(identity) };
```

Sort sources by `source_ref`, reject duplicate IDs/refs, and derive
`obligation_set_ref = H(sorted source_ref values)`.

- [ ] **Step 7: Implement the pure compiler**

The compiler sequence is exact:

1. validate/project canonical controller input;
2. scan registered repository facts;
3. reconcile monotonically and stop on unresolved signals/contradictions;
4. load the pinned policy;
5. obtain current registry metadata and `registry_ref`;
6. canonicalize evidence configuration, validate/hash the runtime manifest when configured, and derive
   the public process keyring reference;
7. evaluate every rule;
8. materialize current check contracts through registry-owned resolution;
9. emit sorted sources and findings;
10. derive `production_input_ref`, `profile_ref`, `repo_facts_ref`, `policy_ref`, `registry_ref`,
    `evidence_config_ref`, and `obligation_set_ref`.

`compiled_profile` is the flattened closed object `{ build_context, exposure, users, identity, ...,
ai }`; it does not retain a nested `production_profile` wrapper. Policy pointers such as `/ai/enabled`
therefore resolve exactly as specified by the design.

Derive references exactly:

```text
production_input_ref = H(canonical production input)
profile_ref = H({ compiler_contract: "telos-production-profile-v1", compiled_profile })
repo_facts_ref = H({ facts_version: 1, facts: sorted facts, signals: sorted resolved signals })
policy_ref = H(canonical policy)
registry_ref = registry.productionRegistryRef()
runtime_manifest_ref = H(canonical validated runtime manifest) or null
process_keyring_ref = H(canonical public keyring) or null
evidence_config_ref = H({
  production_evidence: canonical evidence,
  runtime_manifest_ref,
  process_keyring_ref
})
obligation_set_ref = H(sorted source_ref values)
```

The runtime manifest path alone is not identity. When `runtime.kind !== "none"`, stable-read the
manifest and require the registry's closed runtime-manifest validator before deriving its ref. A
one-byte semantic operation, route, method, fixture binding, or request-binding change alters
`runtime_manifest_ref` and `evidence_config_ref`. When runtime is `none`, the ref is exactly `null`.
Until Task 7 supplies the real validator, Task 3 tests inject it and the default executable returns
cannot-run for configured runtime evidence.

The compiler result also returns the exact sidecar preimage:

```js
{
  production_evidence: canonicalEvidence,
  runtime_manifest_ref,
  process_keyring_ref
}
```

`evidence_config_ref` is the content address of this sidecar. The successful compiled-profile artifact
retains the design's closed top-level shape and stores only `evidence_config_ref`; proposal preparation
writes the sidecar separately to the content-addressed artifact store. Reconstruction reads and
hash-verifies it, so expected subrefs remain available without adding fields to the compiled artifact.

No write occurs in `compiler.mjs`. No timestamp, random ID, hostname other than the declared literal
loopback adapter, absolute path, ambient environment, or current working directory enters the artifact.

- [ ] **Step 8: Wire the real CLI and test atomic compile/verify**

Replace the injected-test-only executable wiring with imports of `compileProductionProfile` and
`verifyProductionProfile`, while retaining injectable `runCli` for unit tests. The executable resolves
its production registry through one fixed repository-relative dynamic import. Until Task 6 lands that
registry, the default executable path returns `CANNOT_RUN`/exit `1`; Task 3 success tests inject the
closed registry fixture and cannot be represented as an end-to-end host pass. `compile` writes only a
successful canonical artifact; `verify` reads both content-addressed inputs and reports exact drift
without replacing either.

Add CLI fixtures proving:

- success `0`;
- invalid/incomplete profile and unresolved signal `2`;
- malformed policy, unstable read, or registry failure `1`;
- `PROFILE_ESCALATED` may accompany `0`;
- cannot-run takes precedence over blocker;
- expected output is unchanged after every non-zero path.

- [ ] **Step 9: Run focused green tests**

Run:

```bash
node build-gate/scripts/test-production-profile.mjs
node build-gate/scripts/test-production-policy.mjs
node build-gate/scripts/test-production-profile-cli.mjs
node --check build-gate/production-profile/compiler.mjs
```

Expected: all tests pass against the injected closed registry; the compiler output is byte-identical
across repeated runs. The default executable's temporary `CANNOT_RUN` result is asserted explicitly and
is removed by Task 6, which adds the first real end-to-end CLI success.

- [ ] **Step 10: Commit the slice**

```bash
git add build-gate/production-profile/policy-loader.mjs \
  build-gate/production-profile/policy.v1.json \
  build-gate/production-profile/source-record.mjs \
  build-gate/production-profile/compiler.mjs \
  build-gate/production-profile/cli.mjs \
  build-gate/scripts/test-production-profile.mjs \
  build-gate/scripts/test-production-policy.mjs \
  build-gate/scripts/test-production-profile-cli.mjs \
  build-gate/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-03.json
git commit -m "feat(production-profile): compile pinned production obligations"
```

---

### Task 4: Add backward-compatible version-2 obligations and lifecycle identity

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-04.json`
- Modify: `merkle-dag/obligation.mjs`
- Modify: `merkle-dag/merkle.mjs`
- Modify: `merkle-dag/planner.mjs`
- Modify: `merkle-dag/scripts/test-obligation.mjs`
- Modify: `merkle-dag/scripts/test-merkle.mjs`
- Modify: `merkle-dag/scripts/test-planner.mjs`
- Modify: `merkle-dag/package.json`

**Interfaces:**
- Preserves: absent `obligation_version` means legacy version 1 with the exact existing four-field preimage.
- Produces: `deriveObligationRef(obligation)` with explicit legacy/version-2 dispatch.
- Produces: `attachObligations(taskDefs, obligationDefs)` accepting the closed union of legacy concern and version-2 production-policy obligations.
- Produces: normalized lifecycle containing the existing four fields plus optional closed `production_profile`.
- Preserves: `merkle-dag` imports no `build-gate` module.

- [ ] **Step 1: Create the authorized slice loadout**

Bind the legacy compatibility goldens, import direction, Node matrix, and authorized plan. State that any
legacy byte drift or `merkle-dag -> build-gate` import is an unrecoverable slice failure.

- [ ] **Step 2: Add golden legacy and red version-2 tests**

Before changing code, pin these current values:

```text
legacy obligation_ref:
sha256:d3cb7a1d89730c4b0bf4c6c34f61b40b1b35e6fd0a941117d1cf40036d7927a5

legacy minimal obligation-free plan_hash:
sha256:c326393f472b36ae545c9a1a74dde26b39a75e643c74a475519a1a5ea6492bc2
```

The exact legacy obligation preimage is:

```json
{
  "obligation_id": "verify-auth-001",
  "concern_ref": "sha256:concernA",
  "required_result": "pass",
  "check_contract_ref": "sha256:cc1"
}
```

The exact obligation-free plan input is:

```js
computePlan([{
  id: "a",
  files: ["a.txt"],
  requirements: "r",
  test: { cmd: "node", args: ["-e", "0"] },
  dependencies: []
}], { authorizedSigners: {} });
```

Add this fixed version-2 preimage:

```json
{
  "obligation_version": 2,
  "obligation_id": "AI-EGRESS-001",
  "source_kind": "production-policy",
  "source_ref": "sha256:source",
  "required_result": "pass",
  "check_contract_ref": "sha256:contract"
}
```

Its expected obligation reference is:

```text
sha256:76f04ed8133ac6f0f6700de1090095d550c206e2a1d00e976b1f5f1fb2ac291b
```

Assert:

- omitted version selects legacy behavior; explicit version `1` is rejected so legacy records continue
  to omit the field and no second V1 encoding exists;
- version 2 requires exactly `source_kind: "production-policy"` and non-empty `source_ref`;
- version 2 rejects `concern_ref`, unknown fields, unknown versions, unknown source kinds, missing discharge
  node/test, duplicate IDs/refs, and unsorted `verifies`;
- changing source, required result, or check contract changes the version-2 reference;
- version-2 refs are registered into the exact final test declaration;
- a version-2 obligation with no production lifecycle blocks;
- a partial/extra production lifecycle object blocks;
- a complete production lifecycle with zero production obligations is structurally valid so the gate can
  later prove that the compiler expected an empty set;
- changing any production lifecycle reference changes `plan_hash`;
- `production_profile.obligation_set_ref` equals `H(sorted version-2 source_ref values)`;
- a production lifecycle with no version-2 obligations uses `H([])` as its exact empty-set reference;
- lifecycle-free and legacy-only fixtures remain byte-identical.

- [ ] **Step 3: Run the Merkle red tests**

Run:

```bash
node merkle-dag/scripts/test-obligation.mjs
node merkle-dag/scripts/test-merkle.mjs
node merkle-dag/scripts/test-planner.mjs
```

Expected: the new version-2 and lifecycle assertions fail while the newly pinned legacy goldens pass.

- [ ] **Step 4: Implement exact obligation version dispatch**

Use separate constructors; never spread unknown input fields:

```js
function legacyIdentity(ob) {
  return {
    obligation_id: ob.obligation_id,
    concern_ref: ob.concern_ref,
    required_result: ob.required_result,
    check_contract_ref: ob.check_contract_ref
  };
}

function productionIdentity(ob) {
  return {
    obligation_version: 2,
    obligation_id: ob.obligation_id,
    source_kind: ob.source_kind,
    source_ref: ob.source_ref,
    required_result: ob.required_result,
    check_contract_ref: ob.check_contract_ref
  };
}
```

For legacy input, preserve the old `H({ obligation_id, concern_ref, required_result,
check_contract_ref })` call byte-for-byte. Production output contains `obligation_version`,
`source_kind`, and `source_ref` and never fabricates a concern.

- [ ] **Step 5: Retain and close-validate production lifecycle metadata**

`normalizeLifecycle()` must preserve the existing normalized shape when `production_profile` is absent.
When present, accept exactly:

```js
{
  compiler_contract: "telos-production-profile-v1",
  production_input_ref,
  profile_ref,
  repo_facts_ref,
  policy_ref,
  registry_ref,
  evidence_config_ref,
  obligation_set_ref,
  compiled_artifact_ref
}
```

Require all nine keys, no extras, and SHA-256 references for every `_ref`. Reject version-2 obligations
without this object. Recompute and compare `obligation_set_ref` from the sorted version-2 source refs;
reject mismatches, mixed duplicate sources, and a noncanonical empty-set reference. Never add
`production_profile: null` to a legacy lifecycle because that would change old bytes.

- [ ] **Step 6: Keep planner boundaries generic**

Update planner documentation/types and tests for the closed obligation union. Do not add policy loading,
registry resolution, source reconciliation, or any `build-gate` import to `merkle-dag`.

- [ ] **Step 7: Run focused and complete Merkle regressions**

Run:

```bash
node merkle-dag/scripts/test-obligation.mjs
node merkle-dag/scripts/test-merkle.mjs
node merkle-dag/scripts/test-planner.mjs
npm --prefix merkle-dag test
```

Expected: all Merkle tests pass and both legacy goldens retain the exact values above.

- [ ] **Step 8: Commit the slice**

```bash
git add merkle-dag/obligation.mjs merkle-dag/merkle.mjs merkle-dag/planner.mjs \
  merkle-dag/scripts/test-obligation.mjs merkle-dag/scripts/test-merkle.mjs \
  merkle-dag/scripts/test-planner.mjs merkle-dag/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-04.json
git commit -m "feat(merkle-dag): bind production policy obligations"
```

---

### Task 5: Add policy certificate version 2 and plan-aware authorization

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-05.json`
- Modify: `merkle-dag/vendor.mjs`
- Modify: `merkle-dag/proposal-ledger.mjs`
- Modify: `merkle-dag/orchestrate.mjs`
- Modify: `merkle-dag/scripts/test-vendor.mjs`
- Modify: `merkle-dag/scripts/test-proposal-ledger.mjs`
- Modify: `merkle-dag/scripts/test-orchestrate.mjs`
- Modify: `merkle-dag/package.json`

**Interfaces:**
- Preserves: frozen version-1 check keys, finding classes, allowed `n/a` set, contract reference, outcome derivation, and verifier behavior.
- Produces: `policyContractForPlan(plan) -> { version, ref, checkKeys }`.
- Produces: substrate-owned `codeUnitCompare` and `hashCanonical` exports from
  `merkle-dag/vendor.mjs`; `merkle-dag` does not import the build-gate wrapper.
- Produces: version-aware `deriveOutcome`, `verifyPolicyResult`, and `verifyAuthorizationResult` through an explicit contract dispatcher.
- Requires: a production lifecycle or any version-2 obligation selects policy certificate version 2.
- Requires: `production_profile` is exactly `"pass"` for production authorization and can never be `"n/a"`.
- Changes: a worker `respec` against a production plan returns
  `PRODUCTION_RESPEC_REAUTHORIZATION_REQUIRED` without writing the mutated plan or dispatching another
  node; only a separately reconstructed plan with a fresh exact V2 authorization may resume. Legacy
  respec behavior remains byte-compatible.

- [ ] **Step 1: Create the authorized slice loadout**

Record the frozen version-1 contract bytes and the approved additive version-2 preimage. A changed
version-1 hash stops this slice even if all behavior tests otherwise pass.

- [ ] **Step 2: Add certificate compatibility and red dispatch tests**

Pin the current 13 version-1 keys and the exact existing value:

```text
POLICY_CONTRACT_V1 =
sha256:122085ce2069a69ce9f4ef1fff2f9275aae225a7d58a9a68d7065beca15ecffd
```

Add the exact version-2 reference:

```text
sha256:3d8d5b9a346180ed8a4b68f7dd875905f1ee963af527370549d8db69affb5cf6
```

Assert:

- substrate comparator ordering and canonical-hash goldens match the existing canonicalize/SHA-256
  preimage without changing any prior export;
- every existing V1 fixture and byte/hash golden remains unchanged;
- V2 keys equal sorted V1 keys plus only `"production_profile"`;
- V2 uses the same six finding classes and same `NA_ALLOWED = {"packet_signatures"}`;
- V2 rejects missing, unknown, malformed, `fail`, or `n/a` production status;
- V1 rejects the extra production key;
- a V1 certificate cannot authorize a plan with production lifecycle or a version-2 obligation;
- a V2 certificate cannot authorize a legacy plan merely because a caller asks for V2;
- certificate plan hash must match the independently recomputed plan;
- production plan authorization succeeds only with an exact V2 pass certificate and live lifecycle
  verifier;
- after one production worker returns a `respec`, no second dispatch, verifier, signer, ledger append,
  or plan write occurs, and the returned proposed mutation cannot execute under the old certificate;
- the same respec fixture retains current mutate-and-continue behavior for a legacy plan.

- [ ] **Step 3: Run the red certificate tests**

Run:

```bash
node merkle-dag/scripts/test-proposal-ledger.mjs
node merkle-dag/scripts/test-orchestrate.mjs
```

Expected: V2 exports and plan-aware dispatch assertions fail.

- [ ] **Step 4: Implement additive contract descriptors**

Add `codeUnitCompare` and `hashCanonical` to `merkle-dag/vendor.mjs` using the same exact implementation
specified for Task 1's build-gate wrapper, then import those substrate-owned helpers into
`proposal-ledger.mjs`. This deliberate one-line wrapper duplication preserves package direction:
`merkle-dag` never imports `build-gate`. Freeze separate descriptors:

```js
export const POLICY_CHECK_KEYS_V1 = Object.freeze([
  "written_plan",
  "proposal_ref_binding",
  "required_packets",
  "packet_signatures",
  "provider_lineage",
  "cold_review_inputs",
  "required_approvals",
  "required_edits",
  "concerns",
  "risk_policy",
  "obligation_anchors",
  "protected_paths",
  "proposal_chain"
]);
export const POLICY_CHECK_KEYS_V2 = Object.freeze([
  ...POLICY_CHECK_KEYS_V1,
  "production_profile"
].sort(codeUnitCompare));
export const POLICY_CONTRACT_V2 = hashCanonical({
  version: 2,
  checks: POLICY_CHECK_KEYS_V2,
  finding_classes: [...FINDING_CLASSES_V1].sort(codeUnitCompare)
});
```

Keep compatibility aliases only where current imports require them:
`POLICY_CHECK_KEYS === POLICY_CHECK_KEYS_V1` and `FINDING_CLASSES === FINDING_CLASSES_V1`.
Do not edit the V1 derivation preimage, ordering, status set, or allowed-`n/a` semantics.

- [ ] **Step 5: Make verification contract-explicit**

Select a descriptor from the artifact's exact `policy_contract_ref`, then independently require that it
matches the recomputed plan's required version. Unknown refs fail. Outcome derivation receives the
descriptor and iterates only its closed keys.

`checkLifecycleAuthorization()` must recompute the plan before selecting the expected contract; a caller
cannot pass a certificate version selector.

In `runBuild()`, inspect the recomputed live plan before applying a worker respec. When it has production
lifecycle metadata or any version-2 obligation, preserve the respec only as bounded diagnostic data and
return `{ error: "PRODUCTION_RESPEC_REAUTHORIZATION_REQUIRED", proposed_respec_ref, trace }`. Do not call
`mutateNode`, `writePlan`, `appendPlanHistory`, another dispatch/verify/signer, or any later frontier.
The controller must route the proposed change back through proposal reconstruction and obtain a new V2
decision whose plan hash exactly matches the revised plan before invoking `runBuild()` again.

- [ ] **Step 6: Run focused and whole Merkle tests**

Run:

```bash
node merkle-dag/scripts/test-vendor.mjs
node merkle-dag/scripts/test-proposal-ledger.mjs
node merkle-dag/scripts/test-orchestrate.mjs
npm --prefix merkle-dag test
```

Expected: V1 goldens and V2 production authorization tests all pass.

- [ ] **Step 7: Commit the slice**

```bash
git add merkle-dag/vendor.mjs merkle-dag/proposal-ledger.mjs merkle-dag/orchestrate.mjs \
  merkle-dag/scripts/test-vendor.mjs \
  merkle-dag/scripts/test-proposal-ledger.mjs merkle-dag/scripts/test-orchestrate.mjs \
  merkle-dag/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-05.json
git commit -m "feat(merkle-dag): add production policy certificate v2"
```

---

### Task 6: Add the production registry plus structural and process checks

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-06.json`
- Create: `build-gate/production-profile/check-registry.mjs`
- Create: `build-gate/production-profile/check-runner.mjs`
- Create: `merkle-dag/execution-identity.mjs`
- Create: `merkle-dag/scripts/test-execution-identity.mjs`
- Create: `build-gate/production-profile/checks/bounded-json.mjs`
- Create: `build-gate/production-profile/checks/json-assertions-v1.mjs`
- Create: `build-gate/production-profile/checks/record-v1.mjs`
- Modify: `build-gate/check-registry.mjs`
- Modify: `build-gate/production-profile/compiler.mjs`
- Create: `build-gate/scripts/test-production-checks.mjs`
- Modify: `build-gate/scripts/test-production-profile-cli.mjs`
- Modify: `build-gate/scripts/test-check-registry.mjs`
- Modify: `build-gate/scripts/test-evidence.mjs`
- Modify: `build-gate/package.json`
- Modify: `build-gate/test-runner.mjs`
- Modify: `merkle-dag/vendor.mjs`
- Modify: `merkle-dag/obligation.mjs`
- Modify: `merkle-dag/planner.mjs`
- Modify: `merkle-dag/orchestrate.mjs`
- Modify: `merkle-dag/ledger-gate.mjs`
- Modify: `merkle-dag/scripts/test-vendor.mjs`
- Modify: `merkle-dag/scripts/test-obligation.mjs`
- Modify: `merkle-dag/scripts/test-planner.mjs`
- Modify: `merkle-dag/scripts/test-orchestrate.mjs`
- Modify: `merkle-dag/scripts/test-ledger-gate.mjs`
- Modify: `merkle-dag/package.json`

**Interfaces:**
- Preserves: legacy `checkContractRef({ kind, params_json })`, the two V1 review kinds, their resolved tests, and their exact hashes.
- Produces: `productionCheckKinds()`, `productionRegistryEntries()`, `productionRegistryRef()`, `resolveProductionCheck(kind, params_json)`, and `runResolvedProductionCheck(resolved, context)`.
- Produces contract V2 identity:

```text
H({
  check_contract_version: 2,
  kind,
  params_json,
  implementation_ref
})
```

- Produces: `implementation_ref` from each entry module's exact source bytes plus its explicit sorted transitive shared-helper closure and canonical parameter schema.
- Produces: check result `{ status: 0|1|2, outcome: "proved"|"assertion-failed"|"cannot-run", detail }`.
- Produces: generic `envForTest(test, baseEnv)` resolution for inherited legacy execution or the exact
  `telos-scrubbed-v1` allowlist.
- Produces: `commandForTest(test, nodeExecPath = process.execPath) -> { ok, command }`; a scrubbed
  descriptor must name exact bare `node`, which resolves to an absolute controller runtime path only
  for spawn and is never serialized. Any other scrubbed command or invalid runtime path fails closed.
- Changes: `spawnCommand(cmd, args, environment = process.env)` receives the already resolved absolute
  command and selected child environment. Its two-argument legacy PATH/PATHEXT/ComSpec behavior is
  unchanged.
- Produces: `deriveExecutingBuildRef({ plan, ledger, baseDir }) -> { executing_build_ref, manifest }`,
  requiring every ordinary node's current signed artifact settlement and re-hashing its current disk
  artifact tree beneath the explicit physical `baseDir`; ambient `cwd` and ledger-declared tree hashes
  are never trusted as disk evidence.
- Changes: `deriveExecutableRef(test)` conditionally includes `env_contract` only when present; the
  legacy `{ cmd, args, cwd }` preimage and all current V1 references remain byte-identical.

- [ ] **Step 1: Create the authorized slice loadout**

Record filesystem, Ed25519, and child-process capabilities; no external network; no package install; the
fixed source closure for each implemented kind; and the authorized plan hash.

- [ ] **Step 2: Pin the legacy registry and write red production-registry tests**

In `test-check-registry.mjs`, pin exact current V1 contract and executable references for
`assert-file-contains` and `assert-path-absent`. Assert no production kind changes those values.

Use these exact legacy fixtures and goldens:

| Kind | Exact `params_json` | `check_contract_ref` | `executable_ref` |
|---|---|---|---|
| `assert-file-contains` | `{"target":"src/app.mjs","needle":"nontrivial-marker"}` | `sha256:b3561e4692fab5ebd02b6316fe3e0cf86de7c217d33331653e186ec0c63b846e` | `sha256:5fc58a72f2912fc71f7979e161fa38058db51c8d79f7a92df87374789c4556b9` |
| `assert-path-absent` | `{"target":"forbidden.tmp"}` | `sha256:509238f333f332b1d3d62944eb128ddd2a77b3226980dc379d8956efd758679a` | `sha256:f3ea49e65c282865781d7d3e727451f46bbdde57f25d504e415e5f96f68b8e0f` |

In `test-production-checks.mjs`, assert:

- the registry eventually contains exactly eight design kinds, while this task's implementation status
  contains metadata for all eight and marks only structural/process kinds runnable until Task 7;
- unknown kind/version, unknown/duplicate/recursive parameter, forbidden key, caller implementation ref,
  command, script, interpreter, args, cwd, env, shell, external URL, or unsafe path blocks resolution;
- parameter JSON is canonical and recursively closed;
- changing any entry source, shared helper, check runner, registry dispatcher, parameter-artifact
  loader, source selector, exit-status mapper, redactor, parameter schema, safety cap, or result
  semantics changes `implementation_ref` and `registry_ref`;
- changing unrelated repository source does not change either;
- replacing the bound wrapper with a no-op or altering `1`/`2` translation leaves no stale contract
  usable at the proposal gate;
- a symlink/realpath escape, oversize JSON, duplicate control, malformed JSON, prototype key, changed
  during read, or unsupported format returns status `2`;
- a valid structural/process predicate returns `0`; a completed but false assertion returns `1`;
- process keyring/record unknown fields, alternate signature preimages, wrong signer selection, stale
  record refs, and plan-only executing-build refs return `2`; mutating one ordinary artifact or signed
  ledger transaction changes `executing_build_ref` and invalidates the old record;
- process-check `params_json` contains neither `source_ref` nor `check_contract_ref`; adding either is
  rejected, while the independently supplied controller source still must equal the signed record's
  exact source ref;
- the fixed process-check CLI rejects a missing/malformed/noncanonical/stale frontier artifact,
  a plan/build/ref mismatch, duplicate/wrong-obligation evidence entry, raw-byte drift, and any attempt
  to inject frontier state through arguments or environment; a valid canonical artifact reaches the
  pure runner with the exact selected `evidenceFile`/derived `evidenceFrontierRef`;
- executing-build derivation rejects an absent/relative/escaping `baseDir`, a ledger tree hash that
  differs from current disk, and any attempt to substitute ambient `cwd`;
- best-effort review `evidence.mjs` cannot satisfy a production source or suppress a mandatory write.

In `test-production-profile-cli.mjs`, replace Task 3's default-registry cannot-run expectation with a
real compile and verify through the checked-in production registry. The exact same fixture must pass via
the CLI and direct compiler API and produce byte-identical artifacts.

In the Merkle tests, pin all existing no-`env_contract` executable goldens, then prove:

- every resolved production test declares exactly `env_contract: "telos-scrubbed-v1"` and changing or
  deleting it changes executable, discharge-test, node-spec, and plan identity; planner compilation
  retains the field unchanged;
- `envForTest()` returns the caller's complete base environment only when the field is absent, returns
  exactly the ten-key allowlist intersection for `telos-scrubbed-v1`, and rejects every unknown or
  non-string contract;
- `commandForTest()` maps exact scrubbed `cmd: "node"` to an injected absolute `nodeExecPath`, rejects
  another scrubbed command, relative/empty/NUL runtime paths, and never exposes the resolved path in
  semantic output; `spawnCommand()` receives that returned command and environment;
- a fake `node` earlier in parent `PATH`, plus parent-only PATH, PATHEXT, and ComSpec canaries, cannot
  influence scrubbed command selection, while two-argument legacy calls retain current Windows/POSIX
  behavior;
- with `TELOS_ENV_CANARY=must-not-cross` in the parent, an actual child run through
  `defaultVerifyNode()`, `ledger-gate.verify()`, and `build-gate/runNodeTest()` cannot observe the
  canary when the scrubbed contract is selected;
- the same canary remains observable for a legacy descriptor with no contract, preserving current
  behavior; and an unknown contract creates no child marker, proving rejection occurs before spawn.

- [ ] **Step 3: Run the registry tests and record the red result**

Run:

```bash
node build-gate/scripts/test-check-registry.mjs
node build-gate/scripts/test-production-checks.mjs
node build-gate/scripts/test-evidence.mjs
node merkle-dag/scripts/test-vendor.mjs
node merkle-dag/scripts/test-obligation.mjs
node merkle-dag/scripts/test-planner.mjs
node merkle-dag/scripts/test-execution-identity.mjs
node merkle-dag/scripts/test-orchestrate.mjs
node merkle-dag/scripts/test-ledger-gate.mjs
```

Expected: production registry, environment-contract, and executing-build assertions fail; every pinned
legacy assertion passes.

- [ ] **Step 4: Implement registry metadata and implementation-source closure**

Each entry is a closed object:

```js
{
  kind,
  contract_version: 2,
  tier,
  parameter_schema,
  entry_source_files: [
    "build-gate/production-profile/checks/<entry>.mjs",
    "build-gate/production-profile/checks/<explicit-helper>.mjs"
  ],
  limits,
  run
}
```

The registry also owns one literal shared execution closure used by every entry:

```js
const EXECUTION_SOURCE_FILES = [
  "build-gate/production-profile/check-runner.mjs",
  "build-gate/production-profile/check-registry.mjs",
  "merkle-dag/execution-identity.mjs",
  "merkle-dag/merkle.mjs",
  "merkle-dag/obligation.mjs",
  "merkle-dag/artifact.mjs",
  "merkle-dag/crypto.mjs",
  "merkle-dag/vendor.mjs",
  "build-gate/production-profile/artifact-io.mjs",
  "build-gate/production-profile/json.mjs"
];
```

Include every additional repository-relative module transitively imported by one of those files in the
literal closure. The implementation closure for a kind is the sorted union of
`EXECUTION_SOURCE_FILES`, that entry's `entry_source_files`, and every transitive helper. Thus the
actual CLI wrapper, contract/parameter artifact loader, dispatcher, source selector, status mapper,
redactor, entry, and helper bytes are all check-contract-bound.

Derive:

```text
parameter_schema_ref = H({ parameter_schema, limits, result_semantics })
source_closure_ref = H(sorted [{ path, sha256_of_exact_bytes }])
implementation_ref = H({
  kind, contract_version, parameter_schema_ref, source_closure_ref
})
registry_ref = H(sorted [{
  kind, contract_version, parameter_schema_ref, implementation_ref
}])
```

`result_semantics` is a closed registry-owned object containing the exact `0`/`1`/`2` mapping and
`env_contract: "telos-scrubbed-v1"`. Therefore changing the execution environment contract changes
`parameter_schema_ref`, `registry_ref`, every affected production check contract, and the plan.
Changing a source byte changes `source_closure_ref` and follows the same invalidation path. The
unavailable Task 6 runtime entries use a registry-source closure plus their exact availability value;
Task 7 replaces that closure with each real entry/helper closure.

The source file list is literal and module-local; no dynamic import crawl, package traversal, or caller
source list is accepted. Paths are canonical POSIX paths relative to the physical repository root, and
hashes cover exact bytes under the repository-wide LF contract. Reject duplicate paths and imports
outside `node:` or the registered source closure.

During this slice only, the six runtime entries have the closed state
`{ availability: "cannot-run-until-runtime-slice" }`, whose implementation identity is derived from the
registry bytes. Resolution still produces the same fixed, scrubbed check-runner descriptor and bound
contract; executing that descriptor returns status `2` without attempting a runtime request. This lets
the policy validate its closed kind set without pretending runtime proof exists. Any profile that
triggers one of those kinds blocks. Task 7 replaces all six states with real entry modules and tests
that no such state remains. The branch cannot reach demo/self acceptance while any entry is
unavailable.

- [ ] **Step 5: Freeze structural check parameters and behavior**

`production-json-assertions-v1` accepts exactly:

```js
{
  obligation_id,
  artifact_paths,
  control_selector: { pointer, equals },
  assertions: [
    { pointer, operator: "eq" | "contains" | "intersects" | "gte" | "lte", expected }
  ]
}
```

Every configured artifact has this closed normalized envelope:

```js
{
  production_controls_version: 1,
  controls: [{
    obligation_id,
    source_artifacts: [{ path, sha256 }],
    value
  }]
}
```

Controls are unique and sorted by `obligation_id`; `source_artifacts` are non-empty, unique, sorted by
safe path, and bind current exact bytes. A control file cannot list itself as a source. The entry has an
immutable predicate table keyed by the eight structural obligation IDs below; caller assertions can add
policy-owned expected values but cannot replace those intrinsic relationships. Unknown IDs and unknown
keys return status `2`.

Freeze each `value` shape:

```text
DATA-002:
  { forward: { migration_ref, schema_source_paths },
    rollback: { migration_ref, schema_source_paths } }
  Both refs are SHA-256 values and differ; both sorted non-empty path sets resolve in source_artifacts.

DELIVERY-001:
  { test_stage_enabled, build_stage_enabled, environment_classes, artifact_digest_ref }
  Both booleans are true; environment_classes is exactly ["non-production","production"];
  artifact_digest_ref is SHA-256.

DELIVERY-002:
  { deployed_artifact_digest_ref,
    rollback: { artifact_ref, artifact_digest_ref },
    feature_disable: { control_ref, artifact_digest_ref } }
  All refs are SHA-256; both nested artifact_digest_ref values equal the deployed digest.

RECOVERY-001:
  { backup_cadence_minutes, protected_copy_region, encryption_key_ref,
    database_source_paths, schema_source_paths }
  Cadence is a positive safe integer no greater than the projected RPO where one is declared;
  region uses the profile identifier rule; key ref is SHA-256; source path sets are sorted,
  non-empty in aggregate, and resolve in source_artifacts.

PRIV-003:
  { processors: [{ kind, id, purposes, processing_regions,
                   data_classification, transfer_mechanism_ref }] }
  kind is "integration" or "provider"; all arrays are non-empty sorted sets; transfer ref is
  SHA-256; the normalized list exactly equals the relevant projected provider/integration inventory.

SUPPLY-001:
  { lockfile: { path, sha256 }, integrity_verification_enabled,
    secret_scan_evidence_ref, approved_source_ref }
  The lockfile tuple occurs in source_artifacts, integrity is true, and both evidence refs are SHA-256.

AI-PROVIDER-001:
  { providers: [{ id, purposes, external, processing_regions,
                  input_retention, training_use }] }
  The sorted closed list exactly equals the projected controller provider inventory.

AI-CLAIM-001:
  { claims: [{ id, source_path, source_sha256, claim_ref,
               evidence_source_ref, evidence_check_contract_ref }] }
  Each source tuple occurs in source_artifacts; IDs are unique; all refs are SHA-256; every evidence
  source/check pair resolves to a different current compiled obligation and registry check; the
  AI-CLAIM control cannot cite itself. The check covers every entry in this configured normalized
  inventory and makes no claim that repository discovery found every public statement.
```

The policy supplies selector/assertion operators and expected values; evidence supplies only bounded
artifact paths through the compiled evidence projection. Require exactly one matching
`production_controls_version: 1` control across configured artifacts. Validate each declared source
path and SHA-256 against current repository bytes. Version 1 reads JSON only and makes no claim that an
external platform applied it.

Freeze the structural control predicates:

| Obligation | Required machine fields |
|---|---|
| `DATA-002` | forward and rollback migration refs; each names an exact schema source path/hash; refs differ |
| `DELIVERY-001` | test/build stages enabled; production/non-production environments distinct; artifact digest immutable |
| `DELIVERY-002` | rollback artifact ref and feature-disable control ref both bind the deployed artifact digest |
| `RECOVERY-001` | backup cadence minutes, protected-copy region, encryption key ref, exact database/schema source hashes |
| `PRIV-003` | every projected provider/subprocessor has exact purpose, regions, data classes, and non-empty transfer-mechanism ref |
| `SUPPLY-001` | exact lockfile hash, integrity verification enabled, secret-scan evidence ref, approved-source ref |
| `AI-PROVIDER-001` | exact equality with projected provider IDs/purposes/regions/retention/training/external fields |
| `AI-CLAIM-001` | every public AI claim has a non-empty executable evidence ref resolving to a current source/check |

Paths and hashes come from the evidence artifact; operators and required relationships come only from
the policy rule.

- [ ] **Step 6: Freeze process check parameters and behavior**

`production-record-v1` accepts exactly:

```js
{
  obligation_id,
  record_paths,
  keyring_path,
  process_keyring_ref,
  max_age_ms,
  required_outcome: "pass"
}
```

`source_ref` is deliberately absent from `params_json`: the V2 check contract hashes parameters, while
the production source hashes `check_contract_ref`, so including `source_ref` in parameters would require
a hash fixed point. The runner instead receives the immutable controller-supplied `productionSource`
through its reconstructed execution context and requires each signed record's `source_ref` to equal
`productionSource.source_ref`. The signed record retains `source_ref`, preserving source binding without
circular identity.

The process keyring is exactly:

```js
{
  production_evidence_keyring_version: 1,
  keys: [{
    key_id,
    public_jwk: { kty: "OKP", crv: "Ed25519", x }
  }]
}
```

Keys are unique and sorted by `key_id`; `x` is unpadded base64url; `d`, private-key operations, unknown
JWK fields, duplicate material under another ID, and non-Ed25519 keys are forbidden.

Each process record is exactly:

```js
{
  production_evidence_record_version: 1,
  obligation_id,
  source_ref,
  check_contract_ref,
  plan_hash,
  executing_build_ref,
  completed_at_ms,
  outcome: "pass" | "fail",
  source_artifacts: [{ path, sha256 }],
  result,
  signature: {
    algorithm: "Ed25519",
    key_id,
    value
  }
}
```

`source_artifacts` uses the same safe, sorted, exact-byte tuple contract as structural controls.
`completed_at_ms` is a non-negative safe integer and signature `value` is unpadded base64url. Sign and
verify the UTF-8 bytes of canonical JSON for the complete record with the `signature` field omitted;
there is no alternate signed preimage. Derive `record_ref = H(canonical complete signed record)` for
manifest/history identity; `record_ref` is not a self-referential field in the record.

`merkle-dag/execution-identity.mjs` derives executed reality only after the ordinary frontier is
settled and receives an explicit physical `baseDir`. Let
`verificationNodeIds` be the exact set of every `discharge_node_id` in the recomputed plan's
obligations; do not use an ID prefix. For each other plan node, select its latest ledger transaction,
require matching `effective_hash`, an authorized valid signature, re-derive the current
`artifact_tree_hash` beneath `baseDir`, and require equality to the signed transaction before deriving:

```text
ledger_record_ref = H(canonical complete signed ledger transaction)
executing_build_manifest = {
  executing_build_version: 1,
  plan_hash,
  proposal_id,
  ordinary_nodes: sorted [{
    task_id,
    effective_hash,
    artifact_tree_hash,
    ledger_record_ref
  }]
}
executing_build_ref = H(executing_build_manifest)
```

A missing, stale, invalid, or disk-drifted ordinary settlement is cannot-run. Process
evidence is requested/signed only after the controller supplies this derived ref; changing any executed
artifact or signed ledger transaction invalidates the record.

The registry entry has an immutable per-obligation `result` schema:

```text
SCALE-002:
  { scenario_id: "declared-peak-burst-v1", exercised_requests_per_minute,
    exercised_burst_multiplier, p95_latency_ms, error_rate }

OBS-002:
  { scenario_id: "incident-route-v1", incident_owner_ref,
    alert_delivered, route_exercised }

RECOVERY-002:
  { scenario_id: "restore-drill-v1", measured_rpo_minutes,
    measured_rto_minutes, restored_sources: [{ path, sha256 }] }

PRIV-002:
  { scenario_id: "derived-deletion-v1", covered_derived_classes,
    uncovered_derived_classes }

AI-OUTPUT-001:
  { scenario_id: "ai-output-eval-v1", fixture_set_ref,
    groundedness_accuracy_score, unsafe_fallback_pass, limitations_ref }

AI-DECISION-001:
  { scenario_id: "consequential-review-v1",
    domains: [{ domain, human_review_fixture_ref, reason_fixture_ref,
                appeal_fixture_ref, protected_class_fixture_ref,
                human_review_pass, reason_pass, appeal_pass, protected_class_pass }] }
```

All counts/times are non-negative safe integers; `error_rate` and score are finite numbers in `[0,1]`;
sets are closed, unique, and sorted; every `*_ref` is SHA-256. Unknown result keys, scenario IDs, or
obligation/result combinations return status `2`.

The compiler derives `process_keyring_ref` from the validated public keyring and includes it in every
process source/check projection; the runner re-derives exact current equality before signer selection.
It materializes the check contract before the source and never patches a source ref back into
`params_json`.
The policy owns `max_age_ms` and `required_outcome`. The check runner supplies the independently
recomputed `plan_hash`, `check_contract_ref`, `executing_build_ref`, and `nowMs` as controller runtime
context; none can be overridden by `params_json`.

Require `production_evidence_record_version: 1`, exact source/check/plan/build binding, source artifact
hashes, one recognized public Ed25519 JWK signer, valid signature, and
`0 <= nowMs - completed_at_ms <= max_age_ms`. Conflicting current records for the same tuple return
status `2`; an exact signed fail record returns `1`; missing/expired/unreadable/unverifiable evidence
returns `2`. Private JWK fields are forbidden.

Freeze process contracts:

| Obligation | `max_age_ms` | Signed result predicates |
|---|---:|---|
| `SCALE-002` | `2592000000` | exercised declared peak/burst; p95 <= `1000` ms; error rate <= `0.01`; outcome pass |
| `OBS-002` | `7776000000` | non-empty incident owner ref; alert delivered; route exercised; outcome pass |
| `RECOVERY-002` | `15552000000` | measured RPO/RTO <= projected declared minutes; restored source hashes match; outcome pass |
| `PRIV-002` | `15552000000` | deletion exercise covers every projected derived class and source hash; no uncovered class; outcome pass |
| `AI-OUTPUT-001` | `2592000000` | exact eval fixture-set ref; groundedness/accuracy score >= `0.80`; unsafe-fallback suite pass; limitations ref present |
| `AI-DECISION-001` | `7776000000` | every projected consequential domain has human-review, reason, appeal, and protected-class fixture refs; outcome pass |

These thresholds are baseline engineering evidence contracts, not service guarantees or fairness/legal
certification.

- [ ] **Step 7: Implement exact status-preserving runner**

The library boundary receives explicit `{ repoRoot, planHash, checkContractRef, executingBuildRef,
nowMs, productionSource, productionSources, evidenceFile, evidenceFrontierRef }`. The source arguments
are immutable controller records, not host evidence. `evidenceFile` is null for runtime/structural
checks and the exact verified raw-file descriptor for a process check.

The executable guard recomputes `.telos/plan.json`, reads and hash-verifies the exact
`compiled_artifact_ref` named by its production lifecycle, selects the one source bound to the requested
contract/params, and supplies the complete sorted source set for intrinsic cross-reference checks. For
`production-record-v1`, it also stable-reads canonical
`.telos/production-evidence-frontier.json`, verifies the closed artifact and its
`evidenceFrontierRef`, requires its plan/executing-build refs to equal the independently recomputed
values, and selects exactly one evidence-file entry by the source's `obligation_id`. A caller cannot
provide a source, evidence file, or frontier ref through CLI flags.

The executable boundary may source `nowMs` only from the controller's invocation, never from policy or
host evidence. Its normal CLI guard derives `planHash` from the recomputed plan and
`executingBuildRef` from the current verified ordinary-node ledger/artifact manifest using the explicit
repository `baseDir` above, then passes
`Date.now()` once into the pure runner as the check-boundary clock. Tests and committed historical
verification call the same pure runner with an explicit fixed `nowMs`, independently verified source
records, exact committed execution manifest, and independently reconstructed committed frontier
artifact. Redact payloads and cap detail at 2 KiB.

The resolved node test remains fixed:

```js
{
  cmd: "node",
  args: [
    "build-gate/production-profile/check-runner.mjs",
    "run",
    "--contract-ref", checkContractRef,
    "--params-ref", paramsArtifactRef
  ],
  cwd: ".",
  env_contract: "telos-scrubbed-v1"
}
```

`paramsArtifactRef = H({ kind, params_json })`. The proposal controller writes that exact canonical
object to the content-addressed artifact store before node minting; the gate re-derives the same ref from
policy projections. Both refs are controller-minted and test-hash-bound. No raw parameters, command,
clock, or expected result is caller-selected.

Implement `envForTest(test, baseEnv = process.env)` in `merkle-dag/vendor.mjs` as a closed result:
`{ ok: true, env }` for either absent or `telos-scrubbed-v1`, and
`{ ok: false, error: "UNKNOWN_ENV_CONTRACT" }` otherwise. For an absent field, return `baseEnv`
unchanged. For `telos-scrubbed-v1`, copy only present values for `SystemRoot`, `WINDIR`, `HOME`,
`USERPROFILE`, `TMP`, `TEMP`, `TMPDIR`, `LANG`, `LC_ALL`, and `TZ`; do not inject defaults.

Implement `commandForTest(test, nodeExecPath = process.execPath)` beside it. An absent contract returns
the descriptor command unchanged. `telos-scrubbed-v1` accepts only exact `cmd: "node"` and returns the
injected absolute, non-NUL `nodeExecPath`; every other command/path returns
`{ ok: false, error: "UNPINNED_SCRUBBED_COMMAND" }`. Use both closed results before constructing or
spawning a child in `orchestrate.mjs`, `ledger-gate.mjs`, and `build-gate/test-runner.mjs`, then pass
the returned absolute command and explicit environment to `spawnCommand()`. The resolved host path is
spawn-only state: do not serialize, hash, log, or include it in result detail. Unknown contracts and
unpinned scrubbed commands are generic cannot-run failures and never fall back to inheritance or
ambient command lookup.

Extend `deriveExecutableRef()` with a conditional preimage:

```js
const executable = { cmd: test.cmd, args: test.args || [], cwd: test.cwd || "." };
return H(test.env_contract === undefined
  ? executable
  : { ...executable, env_contract: test.env_contract });
```

This binds the environment choice for production while preserving every legacy executable reference.
No executor may inspect a production kind, obligation ID, or `verify-production-*` node prefix.

- [ ] **Step 8: Bridge without mutating V1**

Keep `build-gate/check-registry.mjs` V1 functions byte-compatible. If common dispatch is needed, add a
new named export that delegates only when `check_contract_version === 2`; never add production entries
to `checkKinds()` or change V1 `resolve()`.

- [ ] **Step 9: Run focused and package regressions**

Run:

```bash
node build-gate/scripts/test-check-registry.mjs
node build-gate/scripts/test-production-checks.mjs
node build-gate/scripts/test-evidence.mjs
node build-gate/scripts/test-production-policy.mjs
node build-gate/scripts/test-production-profile-cli.mjs
node merkle-dag/scripts/test-vendor.mjs
node merkle-dag/scripts/test-obligation.mjs
node merkle-dag/scripts/test-planner.mjs
node merkle-dag/scripts/test-execution-identity.mjs
node merkle-dag/scripts/test-orchestrate.mjs
node merkle-dag/scripts/test-ledger-gate.mjs
npm --prefix merkle-dag test
```

Expected: all tests pass; compiler tests now use the real registry metadata rather than a fake;
production children cannot observe the canary; legacy child-environment and hash behavior is unchanged.

- [ ] **Step 10: Commit the slice**

```bash
git add build-gate/production-profile/check-registry.mjs \
  build-gate/production-profile/check-runner.mjs \
  merkle-dag/execution-identity.mjs \
  build-gate/production-profile/checks/bounded-json.mjs \
  build-gate/production-profile/checks/json-assertions-v1.mjs \
  build-gate/production-profile/checks/record-v1.mjs \
  build-gate/production-profile/compiler.mjs \
  build-gate/check-registry.mjs \
  build-gate/scripts/test-production-checks.mjs \
  build-gate/scripts/test-production-profile-cli.mjs \
  build-gate/scripts/test-check-registry.mjs \
  build-gate/scripts/test-evidence.mjs \
  build-gate/package.json build-gate/test-runner.mjs \
  merkle-dag/vendor.mjs merkle-dag/obligation.mjs \
  merkle-dag/planner.mjs merkle-dag/orchestrate.mjs merkle-dag/ledger-gate.mjs \
  merkle-dag/execution-identity.mjs merkle-dag/scripts/test-execution-identity.mjs \
  merkle-dag/scripts/test-vendor.mjs merkle-dag/scripts/test-obligation.mjs \
  merkle-dag/scripts/test-planner.mjs merkle-dag/scripts/test-orchestrate.mjs \
  merkle-dag/scripts/test-ledger-gate.mjs \
  merkle-dag/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-06.json
git commit -m "feat(production-profile): add bound structural and process checks"
```

---

### Task 7: Add six bounded loopback runtime check kinds

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-07.json`
- Create: `build-gate/production-profile/checks/loopback-client.mjs`
- Create: `build-gate/production-profile/checks/loopback-http-v1.mjs`
- Create: `build-gate/production-profile/checks/auth-boundary-v1.mjs`
- Create: `build-gate/production-profile/checks/tenant-isolation-v1.mjs`
- Create: `build-gate/production-profile/checks/rate-limit-v1.mjs`
- Create: `build-gate/production-profile/checks/webhook-v1.mjs`
- Create: `build-gate/production-profile/checks/ai-egress-v1.mjs`
- Modify: `build-gate/production-profile/check-registry.mjs`
- Modify: `build-gate/production-profile/check-runner.mjs`
- Modify: `build-gate/production-profile/policy.v1.json`
- Modify: `build-gate/scripts/test-production-checks.mjs`
- Modify: `build-gate/scripts/test-production-policy.mjs`
- Modify: `build-gate/package.json`

**Interfaces:**
- Consumes: literal loopback base URL and a hash-bound `runtime_adapter_version: 1` manifest.
- Produces: six runtime entries completing the exact eight-kind registry.
- Produces: `loadRuntimeManifest(bytes) -> { manifest, runtime_manifest_ref }` over the closed canonical
  operation mapping; this is the validator injected into the compiler in Task 3.
- Uses: `node:http` and `node:https` only to reject HTTPS/external configurations; does not use global `fetch`, DNS lookup, proxy behavior, or external sockets.
- Preserves: policy owns scenarios and expected outcomes; the host manifest maps semantic operations to routes and synthetic fixture fields only.

- [ ] **Step 1: Create the authorized slice loadout**

Record the loopback-only network capability, fixed test port strategy, synthetic-data restriction, no
live provider permission, exact request/body/time caps, and authorized plan hash. Port collision is
cannot-run; selecting a random fallback is forbidden.

- [ ] **Step 2: Add the red runtime matrix**

For each runtime kind, test at least:

- one passing fixture;
- one completed assertion failure (`status: 1`);
- one cannot-run safety/configuration failure (`status: 2`);
- stale implementation identity;
- a no-op implementation mutation;
- an external hostname, redirect, proxy environment, oversized body, request-limit excess, timeout, and
  unavailable required operation.

Use a fixed controller-declared loopback port, normally `43119`. Bind an alternate fixed port only in
parallel unit fixtures whose port is explicit in the dossier; never discover an ephemeral port and place
it into semantic artifacts.

- [ ] **Step 3: Freeze the runtime manifest and operation boundary**

The manifest is closed:

```js
{
  runtime_adapter_version: 1,
  operations: [{
    name,
    method,
    path,
    fixture_refs,
    request_bindings
  }]
}
```

Allow only the design's fourteen operation names:
`authenticate`, `authorize`, `tenant-read`, `tenant-write`, `payment-apply`, `webhook-receive`,
`data-mutate`, `delete-source`, `integration-send`, `ai-invoke`, `egress-observer`, `audit-read`,
`provider-failure`, and `kill-switch`.

Reject expected status, expected body, denial semantics, shell commands, scripts, arbitrary headers,
external URLs, query strings, fragments, dot segments, duplicate operation names, or undeclared fixture
fields in the manifest.

Canonicalize operations in code-unit order by unique `name`, normalize only validated method/path and
sorted fixture/request-binding sets, and derive:

```text
runtime_manifest_ref = H(canonical validated manifest)
```

The compiler includes that ref in `evidence_config_ref`; the proposal gate and final settlement
stable-read and re-derive it. Every runtime rule's evidence projection and `params_json` include the
same `runtime_manifest_ref`, so a manifest change also rewrites the affected source, check contract, and
verification node—not only global authorization. Add one-byte method, path, fixture-ref,
request-binding, and operation-set mutations that invalidate both local and global identities even when
`manifest_path` is unchanged.

- [ ] **Step 4: Run the runtime tests and record the red result**

Run:

```bash
node build-gate/scripts/test-production-checks.mjs
```

Expected: the six missing runtime kinds and eight-kind closed-set assertion fail.

- [ ] **Step 5: Implement the loopback client**

Validate the URL with `URL`, require protocol `http:`, hostname literally `127.0.0.1` or `[::1]`,
explicit port `1..65535`, and no username/password/query/fragment. Reject all redirect statuses. Set
`agent: false`, fixed socket/request/body limits, fixed timeout, `Connection: close`, and a scrubbed
header set. Never consult proxy variables or resolve a hostname.

The helper returns bounded metadata and redacted selected JSON fields; it never returns or logs request
bodies, credentials, the synthetic marker, or full response bodies.

- [ ] **Step 6: Implement exact check-specific scenarios**

Freeze behavior as follows:

- `production-loopback-http-v1`: executes only the policy-named operation sequence and asserts
  policy-owned selected statuses, headers, JSON pointers, state transitions, and redaction.
- `production-auth-boundary-v1`: missing, malformed, expired, wrong-scope, and authenticated-but-
  unauthorized fixtures receive `401`, `401`, `401`, `403`, and `403`; the valid least-privilege
  fixture receives `200`.
- `production-tenant-isolation-v1`: seeds two synthetic tenants, proves same-tenant access, then requires
  same-tenant access at `200`, cross-tenant reads/writes at `403`, and both objects unchanged.
- `production-rate-limit-v1`: sends the bounded threshold derived from the profile/policy, requires
  requests through the limit to receive the rule's success status, and the first over-limit request to
  receive `429`.
- `production-webhook-v1`: bad signature, stale timestamp, and replay deny; one valid synthetic event
  receives `202` and applies exactly once; bad signature and stale timestamp receive `401`, and replay
  receives `409`.
- `production-ai-egress-v1`: submits the invalid marker `000-00-0000` as explicitly synthetic
  highly-sensitive data, requires `403` for a disallowed provider before transport, confirms the fake
  provider received zero payloads, and confirms a `200` audit read contains only the redacted class and
  disposition.

Each kind has a closed parameter schema in the registry. Scenario IDs, request counts, statuses, pointer
assertions, and fixture classes are expanded from pinned policy templates, not host evidence.

Freeze generic loopback scenarios in `policy.v1.json`:

| Obligation | Operation sequence | Required result |
|---|---|---|
| `PAY-001` | `payment-apply`, same event twice | both `200`; one settlement ID; application count `1` |
| `DATA-001` | valid `data-mutate`, invalid atomic mutation | `200` then `409`; invalid mutation leaves state unchanged |
| `OBS-001` | triggering operation, `audit-read` | `200`; required event exists; configured sensitive pointers absent |
| `PRIV-001` | expired `delete-source`; active-hold delete; hold release and delete | `204`, `423`, `204`; source absent only after allowed deletion |
| `SUPPLY-002` | declared `integration-send`; excessive-class send | `202`, `403`; provider sees only the declared class |
| `AI-RAG-001` | benign and indirect-instruction `ai-invoke` | both `200`; provenance retained; protected action/disclosure counts `0` |
| `AI-TOOL-001` | dry-run, unconfirmed write, confirmed scoped write | `200`, `403`, `202`; only confirmed target changes |
| `AI-LINEAGE-001` | `ai-invoke`, `audit-read` | both `200`; redacted event binds all policy-required lineage fields |
| `AI-OPS-001` | `provider-failure`, `audit-read`, `kill-switch`, `ai-invoke` | safe fallback `200`; signal recorded; kill switch `204`; later invoke `503` |

Unknown statuses or response fields are not inferred. Changing one of these expected outcomes changes
the rule/check contract and requires plan reauthorization.

- [ ] **Step 7: Prove the generic host-adapter seam exercises real code**

Add an injected application handler seam to runtime tests. The loopback adapter maps operations to that
handler; it must not contain fixture-only pass logic. Include a negative fake handler that returns the
right shape without calling the candidate semantic operation and require the adapter's operation trace
binding to fail. Task 12 implements TELOS's concrete adapter against this already-proven host contract.

- [ ] **Step 8: Run focused and catalog regressions**

Run:

```bash
node build-gate/scripts/test-production-checks.mjs
node build-gate/scripts/test-production-policy.mjs
node build-gate/scripts/test-production-profile.mjs
```

Expected: exactly eight registered kinds, all pass/fail/cannot-run branches green, no external socket,
stable implementation references across repeated runs, and zero
`cannot-run-until-runtime-slice` registry entries remain.

- [ ] **Step 9: Commit the slice**

```bash
git add build-gate/production-profile/checks/loopback-client.mjs \
  build-gate/production-profile/checks/loopback-http-v1.mjs \
  build-gate/production-profile/checks/auth-boundary-v1.mjs \
  build-gate/production-profile/checks/tenant-isolation-v1.mjs \
  build-gate/production-profile/checks/rate-limit-v1.mjs \
  build-gate/production-profile/checks/webhook-v1.mjs \
  build-gate/production-profile/checks/ai-egress-v1.mjs \
  build-gate/production-profile/check-registry.mjs \
  build-gate/production-profile/check-runner.mjs \
  build-gate/production-profile/policy.v1.json \
  build-gate/scripts/test-production-checks.mjs \
  build-gate/scripts/test-production-policy.mjs \
  build-gate/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-07.json
git commit -m "feat(production-profile): add bounded runtime verification"
```

---

### Task 8: Record production input before model calls and migrate every activated consumer

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-08.json`
- Modify: `build-gate/build-orchestrator.mjs`
- Modify: `build-gate/gate.mjs`
- Modify: `build-gate/proposal-recorder.mjs`
- Modify: `build-gate/proposal-orchestrator.mjs`
- Modify: `build-gate/scripts/test-build-orchestrator.mjs`
- Modify: `build-gate/scripts/test-gate.mjs`
- Modify: `build-gate/scripts/test-proposal-lifecycle.mjs`
- Modify: `build-gate/scripts/test-proposal-orchestrator.mjs`
- Modify: `build-gate/scripts/test-breakout-coverage.mjs`
- Modify: `build-gate/scripts/test-trust.mjs`
- Modify: `build-gate/scripts/test-council-orchestrator.mjs`
- Modify: `build-gate/examples/agentic-teams-market/dossier.json`
- Modify: `build-gate/examples/convergence-demo/dossier.json`
- Modify: `build-gate/examples/market-pass/dossier.json`
- Modify: `build-gate/examples/proposal-lifecycle/dossier.json`
- Modify: `build-gate/examples/proposal-lifecycle/README.md`
- Modify: `ai-forge/forge.mjs`
- Modify: `ai-forge/scripts/test-forge.mjs`
- Modify: `ai-forge/package.json`
- Modify: `saas-forge/forge.mjs`
- Modify: `saas-forge/scripts/test-forge.mjs`
- Modify: `saas-forge/package.json`
- Create: `build-gate/scripts/test-production-lifecycle.mjs`
- Modify: `build-gate/package.json`

**Interfaces:**
- Produces: `prepareProductionProposal({ dossier, telos, taskSeed, baseDir, telosDir, signerFor, nowMs }) -> { ok, active, prepared?, blocked? }`.
- `prepared` is controller-owned and closed: `{ proposal_id, recorder, build_intent_ref,
  production_input_ref, evidence_config_ref, compiled_artifact_ref, compiled, production_summary }`.
- Changes: `buildProject()` calls preparation before `detectConventions()`, `decompose()`, council calls, workshop calls, or team calls whenever activation is true.
- Changes: `runProposalLifecycle()` requires prepared state for an activated dossier and never trusts a fresh mutable dossier during reconstruction.
- Preserves: all-false legacy builds take the old path with `production_profile_evaluated: false` and unchanged plan bytes.
- Enforces: every genuine `market_bound: true` build uses proposal lifecycle; a market-readiness evidence helper has no authority result.

- [ ] **Step 1: Create the authorized slice loadout**

Record proposal-controller key availability, process-restart test capability, every activated in-tree
consumer found by the inventory command below, and the exact authorized plan. Missing durable key
capability blocks an activated build before a model call.

- [ ] **Step 2: Add zero-model-call activation red tests**

In `test-production-lifecycle.mjs` and `test-build-orchestrator.mjs`, wrap every external callback with a
counter. For each activation trigger, assert an absent/incomplete/invalid profile returns the exact
blocker and all counters remain zero:

```js
const calls = { seat: 0, workshop: 0, parallel: 0, team: 0 };
// invalid activated build
assert.equal(result.ok, false);
assert.equal(result.phase, "production-profile");
assert.deepEqual(calls, { seat: 0, workshop: 0, parallel: 0, team: 0 });
```

Cover:

- `proposal_lifecycle: true`;
- `market_bound: true` without lifecycle -> `PROPOSAL_LIFECYCLE_REQUIRED`;
- either production field present;
- activated but missing profile -> `PROFILE_REQUIRED`;
- scanner blocker and scanner cannot-run;
- absent durable proposal-controller key;
- model write targets intersecting the runtime manifest, process keyring, policy/registry modules,
  canonical input, compiled profile, or `.telos/` controller state;
- valid production input is content-addressed and the signed root event exists before deliberately
  throwing `decompose()`;
- all-false legacy autonomous decomposition still calls the planning seat and reports
  `production_profile_evaluated: false`.

- [ ] **Step 3: Add durable recorder/restart red tests**

Assert:

- a production root draft derives identity from the exact `production_input_ref` and
  `build_intent_ref`;
- the same profile with a different build ID, objective, telos, write target, or controller task seed
  derives a different `build_intent_ref` and proposal ID and cannot resume the first chain;
- reopening with the same external controller key and same requested proposal ID succeeds;
- reopening with a different key, proposal ID, production-input ref, build-intent ref, or tampered
  artifact fails;
- resume does not append a duplicate root draft;
- a fresh child Node process, given only repository path, `.telos/` state, and the same test key via its
  private test environment, reconstructs the exact intent/input/profile/proposal references;
- no mutable caller dossier is supplied to the child;
- no private key appears in proposal artifacts, plan, logs, or reports.

The test must use `spawnSync(process.execPath, [...])`; constructing a second recorder in the same
process is supplementary, not the restart proof.

- [ ] **Step 4: Run lifecycle tests and record the red result**

Run:

```bash
node build-gate/scripts/test-production-lifecycle.mjs
node build-gate/scripts/test-build-orchestrator.mjs
node build-gate/scripts/test-proposal-lifecycle.mjs
```

Expected: preparation-before-decomposition and child-process restart assertions fail.

- [ ] **Step 5: Implement production proposal preparation**

At the first line of `buildProject()` after basic argument presence:

```js
const activation = activationFor(dossier);
const production = activation.active
  ? await prepareProductionProposal({ dossier, telos, taskSeed: tasks, baseDir, telosDir, signerFor, nowMs })
  : { ok: true, active: false, prepared: null };
if (!production.ok) return production.blocked;
```

Preparation order is exact:

1. require proposal lifecycle;
2. require externally supplied/persisted proposal-controller private key;
3. validate and canonicalize production input and the closed build intent;
4. write both content-addressed artifacts;
5. create/reopen the recorder and append the root draft with both typed refs if absent;
6. scan and compile;
7. write the evidence-config sidecar, compiled artifact, and atomic
   `.telos/production-profile.json` current view;
8. append controller-owned compiled references;
9. return a frozen summary containing only stable IDs, domains, tiers, source refs, and check refs.

No `detectConventions`, `decompose`, `callSeat`, workshop, council, team, or provider call occurs before
step 8 succeeds.

Before returning prepared state, reject protected controller paths in `dossier.write_targets` or any
provided task writes with `PROFILE_CONTRADICTION`. Policy-declared structural artifacts and unsigned
measurement sources may be legitimate plan outputs. The runtime manifest, process public-keyring,
signed process-record paths, policy/registry/compiler modules, input/compiled artifacts, and all
`.telos/` state are never model writes. Only the controller's post-ordinary evidence frontier may write
signed process records. When tasks are model-decomposed, repeat the same intersection check immediately
after decomposition and before situation sensing, workshop, council, or execution.

- [ ] **Step 6: Make recorder identity and resume explicit**

The controller build-intent artifact is exactly:

```js
{
  build_intent_version: 1,
  build_id,
  idea_id,
  use_case,
  objective,
  telos,
  trust_mode,
  required_docs,
  write_targets,
  affected_directories,
  protected_paths,
  required_market_workstreams,
  user_facing_frontend,
  block_on_collision,
  max_revisions,
  task_seed
}
```

Use explicit `null` for absent nullable scalar fields, sorted/deduplicated string sets, booleans for
flags, and either `null` or a closed canonical task-seed array sorted by task ID. Reject duplicate task
IDs, functions, non-data values, unknown task fields, and any controller field consumed by planning but
absent from this versioned projection. Derive `build_intent_ref = H(canonical build intent)`.

Each task-seed item is exactly `{ id, writes, reads, requirements, test, baseDependencies, workstream }`;
path/dependency sets are sorted and `test` is the closed generic
`{ cmd, args, cwd?, env_contract? }`. Omitted optional fields canonicalize to the documented defaults
before hashing.

For production proposals, the root draft's `artifact_refs` is exactly the sorted
`[build_intent_ref, production_input_ref]`; its signed extra fields are both refs. The stored artifacts
are the exact canonical projections, so their proposal-artifact addresses equal those references. This
additive identity does not alter legacy task-draft identity. A later controller negotiation event
records the model-produced task-draft artifact after decomposition.

On reopen:

- verify the chain against the externally supplied key;
- require a uniform proposal ID;
- require a single sequence-1 draft;
- require both exact root refs and reconstruct both artifacts;
- compare any supplied proposal ID instead of silently adopting a different one;
- identify the latest completed lifecycle stage and resume without duplicating earlier controller
  records.

The host stores the private controller key outside artifacts and source control. Production mode never
generates an ephemeral replacement over durable state.

- [ ] **Step 7: Make direct gate activation fail closed**

`validateRecords()` must report production activation status. For an activated dossier it requires a
prepared/reconstructed production gate result; a direct caller cannot obtain a build-authorizing pass
from market packets alone.

Extract any still-useful pure breakout checks as `validateMarketReadinessEvidence(...)`. Its result is
explicitly `{ assessment_status, blockers, warnings }`, never `gate_status: "pass"`, `authorized`, or a
policy certificate. It receives no `market_bound: true` build dossier.

- [ ] **Step 8: Inventory and migrate every activated in-tree consumer**

Run:

```bash
rg -n '"proposal_lifecycle"\s*:\s*true|proposal_lifecycle\s*:\s*true|"market_bound"\s*:\s*true|market_bound\s*:\s*true' \
  --glob '!docs/**' .
```

Classify every match in the task evidence:

- true build entry -> route through `buildProject()` with an explicit production profile/evidence;
- proposal-lifecycle fixture -> add a complete minimal controller profile/evidence;
- team/council unit input that only tests roster selection -> keep it as pure planning input and assert it
  has no authorization claim;
- breakout/readiness unit -> use the non-authorizing readiness helper;
- docs example -> update to show the required lifecycle/profile.

`ai-forge` and `saas-forge` are true market-bound builds. Replace their direct
`computePlan/runBuild/validateRecords` authorization sequence with `buildProject()` over their generated
task definitions and injected generators. Carry breakout packets as review evidence, not a substitute
for production obligations. Require caller/controller `dossierMeta.production_profile` and
`production_evidence`; keyless synthetic demos may use a checked-in synthetic profile and an ephemeral
key only in a fresh temporary test repository, explicitly labeled non-production and never over a
persisted ledger.

- [ ] **Step 9: Prove no direct market authorization remains**

Add tests that:

- monkey-patch/count direct legacy gate calls in both forges and observe none;
- invalid production input stops both forges before generator/model/team invocation;
- missing profile cannot be repaired by green breakout packets;
- valid synthetic profiles produce V2 proposal state;
- lower-level readiness reports cannot be passed to `runBuild()` as authorization;
- the repository inventory has no unclassified activated literal.

- [ ] **Step 10: Run migrated package regressions**

Run:

```bash
npm --prefix build-gate test
node ai-forge/scripts/test-forge.mjs
node saas-forge/scripts/test-forge.mjs
```

Expected: all build-gate tests pass, including the modified proposal-lifecycle,
proposal-orchestrator, and council-orchestrator scripts; both forge tests pass; activated invalid cases
perform zero model/generator calls. `build-gate/test-runner.mjs` remains unchanged here because it is a
runtime executor, not a test registry.

- [ ] **Step 11: Commit the slice**

```bash
git add build-gate/build-orchestrator.mjs build-gate/gate.mjs \
  build-gate/proposal-recorder.mjs build-gate/proposal-orchestrator.mjs \
  build-gate/scripts/test-build-orchestrator.mjs build-gate/scripts/test-gate.mjs \
  build-gate/scripts/test-proposal-lifecycle.mjs build-gate/scripts/test-proposal-orchestrator.mjs \
  build-gate/scripts/test-production-lifecycle.mjs build-gate/scripts/test-breakout-coverage.mjs \
  build-gate/scripts/test-trust.mjs build-gate/scripts/test-council-orchestrator.mjs \
  build-gate/examples/agentic-teams-market/dossier.json \
  build-gate/examples/convergence-demo/dossier.json \
  build-gate/examples/market-pass/dossier.json \
  build-gate/examples/proposal-lifecycle/dossier.json \
  build-gate/examples/proposal-lifecycle/README.md \
  build-gate/package.json \
  ai-forge/forge.mjs ai-forge/scripts/test-forge.mjs ai-forge/package.json \
  saas-forge/forge.mjs saas-forge/scripts/test-forge.mjs saas-forge/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-08.json
git commit -m "feat(build-gate): enforce production preflight before model calls"
```

---

### Task 9: Mint fixed production nodes and reconcile the proposal from disk

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-09.json`
- Modify: `build-gate/proposal-orchestrator.mjs`
- Modify: `build-gate/proposal-gate.mjs`
- Modify: `build-gate/proposal-recorder.mjs`
- Create: `build-gate/production-profile/finding-routing.mjs`
- Modify: `build-gate/scripts/test-proposal-orchestrator.mjs`
- Modify: `build-gate/scripts/test-proposal-gate.mjs`
- Modify: `build-gate/scripts/test-proposal-lifecycle.mjs`
- Modify: `build-gate/scripts/test-production-lifecycle.mjs`
- Modify: `build-gate/scripts/test-concerns.mjs`
- Modify: `build-gate/scripts/test-risk-policy.mjs`
- Modify: `build-gate/scripts/test-schemas.mjs`
- Modify: `build-gate/package.json`

**Interfaces:**
- Produces: `mintProductionVerificationNodes({ sources, registry, ordinaryTasks }) -> { nodes, obligationDefs, errors }`.
- Produces: `reconstructAndValidateProductionProfile({ telosDir, baseDir, plan, nowMs }) -> { ok, checks, blockers, findings, compiled? }`.
- Produces: exact source reconciliation for both source classes; no map overwrite can hide duplicates.
- Changes: `recordDecision({ plan, ... })` selects the certificate contract from the recomputed plan.
- Preserves: production policy sources are not concerns and cannot receive review dispositions.

- [ ] **Step 1: Create the authorized slice loadout**

Record the fixed production summary, registry, proposal disk state, no external model dependency for
reconstruction, and authorized plan. Bind actual review-seat capabilities separately; a missing required
seat remains a proposal blocker.

- [ ] **Step 2: Add red fixed-node and workshop-boundary tests**

Assert:

- the workshop receives a deep-frozen summary containing all production obligation IDs, domains, tiers,
  source refs, check refs, and required evidence paths;
- no private key, raw synthetic body, secret, mutable input object, or host absolute path enters that
  context;
- model output containing any ID beginning `verify-production-` fails before plan compilation;
- model output cannot remove, edit, shadow, or reserve a production source/check;
- node IDs are exactly `verify-production-<lowercase-obligation-id>`;
- node writes are empty; reads equal policy-derived safe evidence paths; requirements include exact ID,
  domain, source ref, and tier;
- production nodes depend on every exact controller-captured `ordinaryTasks` ID plus named evidence
  producers; an ordinary model task named `verify-migration` remains in that set;
- review and production verification nodes are minted independently and both remain when semantically
  overlapping;
- a profile change outside one obligation's projection leaves that node's local spec/effective identity
  unchanged, while the lifecycle `profile_ref` changes global `plan_hash`; an unrelated rule change has
  the same local/global split through `policy_ref`.

- [ ] **Step 3: Add red disk-only gate reconciliation tests**

In a fresh child process with no dossier object, assert the gate:

- reads the signed root `build_intent_ref`/`production_input_ref` and plan lifecycle refs;
- reconstructs the canonical build intent and verifies the proposal ID derived from both root refs;
- reconstructs the canonical production input and compiled artifact from content-addressed disk state;
- reads and hash-verifies the `evidence_config_ref` sidecar, runtime manifest, and process keyring;
- re-scans the current repository and loads current policy/registry/keyring;
- recomputes every reference and exact set;
- returns `production_profile: "pass"` only on exact equality.

Add one negative fixture for each of:

- missing, extra, duplicate, or changed source;
- missing, extra, duplicate, orphan, cross-bound, or changed obligation;
- legacy obligation without exactly one reconstructed concern;
- production obligation disguised as a concern or vice versa;
- wrong discharge node/test/executable;
- stale implementation/check/policy/registry/evidence/input/profile/facts/artifact/lifecycle ref;
- empty proposal ledger, wrong proposal ID, corrupt chain, and stale controller key;
- missing, changed, or cross-proposal build-intent artifact;
- no-op check substitution;
- a caller-supplied dossier that differs from the disk artifact.

- [ ] **Step 4: Run gate/orchestrator red tests**

Run:

```bash
node build-gate/scripts/test-proposal-orchestrator.mjs
node build-gate/scripts/test-proposal-gate.mjs
node build-gate/scripts/test-production-lifecycle.mjs
```

Expected: fixed production node and exact disk reconstruction assertions fail.

- [ ] **Step 5: Implement controller-minted production nodes**

Resolve every current source through the production registry. Build tests from controller-owned
contract/parameter artifact refs. Reject any ordinary/workshop task with a reserved prefix before
combining arrays.

Dependencies are the sorted set of:

1. every ID in the exact `ordinaryTasks` array captured before any review or production verification
   nodes are appended;
2. any exact task whose declared writes include a required evidence path.

Do not classify tasks by ID prefix and do not infer evidence production from prose. Only the exact
`verify-production-*` IDs minted by this function are reserved; an ordinary task can otherwise use a
`verify-*` name without escaping dependency closure. Attach version-2 obligations through Task 4 so
`test.verifies`, `discharge_test_ref`, local node hashes, and global plan hash are all bound.

- [ ] **Step 6: Bind the complete lifecycle before candidate recording**

Compile with:

```js
lifecycle.production_profile = {
  compiler_contract,
  production_input_ref,
  profile_ref,
  repo_facts_ref,
  policy_ref,
  registry_ref,
  evidence_config_ref,
  obligation_set_ref,
  compiled_artifact_ref
};
```

Record the candidate only after combined graph, obligations, lifecycle, and plan hash exist. Store the
compiled-artifact and evidence-config refs in candidate artifact refs. Never reconstruct from the
in-memory `prepared` object once the plan is written.

- [ ] **Step 7: Implement exact source-class reconciliation**

Use sorted arrays and explicit duplicate detection before constructing lookup maps.

- Legacy obligation: exactly one reconstructed concern with equal `concern_ref`, required result, V1
  check contract, discharge node, and executable.
- Production obligation: exactly one compiler source with equal `source_ref`, ID, required result, V2
  check contract, registry implementation, node identity, and executable.

Exact set equality includes source refs, obligation refs, node IDs, contract refs, executable refs, and
`test.verifies`. Any mismatch yields a typed protocol finding and `production_profile: "fail"`.

- [ ] **Step 8: Keep production contracts outside mutable review surfaces**

`schemas.mjs` continues to validate model response packets only. Add tests proving a packet cannot emit
production dossier, source, implementation, status, or waiver fields.

`finding-routing.mjs` owns the exact compiler-code mapping frozen in the design. It returns closed
`{ code, class, reparable, requires_human, ref }` records. Host `dossier.risk_policy` cannot change this
mapping.

Freeze these groups:

```text
hold / false / true:
  PROFILE_REQUIRED, PROPOSAL_LIFECYCLE_REQUIRED, PROFILE_SCHEMA,
  PROFILE_CONTRADICTION, CLASSIFICATION_REQUIRED, STALE_SIGNAL_RESOLUTION,
  EVIDENCE_ADAPTER_REQUIRED, EVIDENCE_FORMAT_UNSUPPORTED

verification / true / false:
  BLOCKED_PROFILE_DRIFT

protocol / false / false:
  POLICY_INVALID, POLICY_VERSION, CHECK_KIND_UNREGISTERED, CHECK_CONTRACT_STALE,
  PRODUCTION_SOURCE_MISMATCH, PRODUCTION_OBLIGATION_MISMATCH,
  PRODUCTION_LIFECYCLE_MISMATCH

unrecoverable / false / false:
  REPO_SCAN_LIMIT, REPO_SCAN_UNSAFE_PATH, CANNOT_RUN
```

`PROFILE_ESCALATED` is advisory and never enters a certificate finding array.

`proposal-gate.mjs` rejects unmatched legacy obligations instead of continuing. `concerns.mjs` remains
the review-concern reducer, and tests prove production sources never pass through `makeConcern`, holds,
waivers, or dispositions.

- [ ] **Step 9: Issue the V2 certificate from recomputed plan state**

`recordDecision()` receives the recomputed plan or its closed required contract descriptor, not a caller
boolean. For production:

- include the full V1 checks plus `production_profile`;
- require pass, never `n/a`;
- use `POLICY_CONTRACT_V2`;
- include every blocker/finding from disk reconstruction;
- refuse an `authorized` outcome if any current mismatch exists.

Update off-plan `naChecks()` to choose V1 only for off-plan legacy decisions. An activated proposal that
cannot yet produce a plan emits a non-authorizing typed blocker record and never a V2 certificate with
`n/a`.

- [ ] **Step 10: Run focused and package regressions**

Run:

```bash
node build-gate/scripts/test-proposal-orchestrator.mjs
node build-gate/scripts/test-proposal-gate.mjs
node build-gate/scripts/test-proposal-lifecycle.mjs
node build-gate/scripts/test-production-lifecycle.mjs
node build-gate/scripts/test-concerns.mjs
node build-gate/scripts/test-risk-policy.mjs
node build-gate/scripts/test-schemas.mjs
npm --prefix merkle-dag test
```

Expected: exact reconciliation, V2 authorization, and all legacy proposal tests pass.

- [ ] **Step 11: Commit the slice**

```bash
git add build-gate/proposal-orchestrator.mjs build-gate/proposal-gate.mjs \
  build-gate/proposal-recorder.mjs \
  build-gate/production-profile/finding-routing.mjs \
  build-gate/scripts/test-proposal-orchestrator.mjs \
  build-gate/scripts/test-proposal-gate.mjs \
  build-gate/scripts/test-proposal-lifecycle.mjs \
  build-gate/scripts/test-production-lifecycle.mjs \
  build-gate/scripts/test-concerns.mjs build-gate/scripts/test-risk-policy.mjs \
  build-gate/scripts/test-schemas.mjs build-gate/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-09.json
git commit -m "feat(build-gate): reconcile fixed production obligations"
```

---

### Task 10: Reclassify after the build and block settlement drift

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-10.json`
- Modify: `build-gate/proposal-orchestrator.mjs`
- Modify: `build-gate/production-profile/compiler.mjs`
- Modify: `build-gate/production-profile/artifact-io.mjs`
- Modify: `build-gate/scripts/test-production-lifecycle.mjs`
- Modify: `merkle-dag/orchestrate.mjs`
- Modify: `merkle-dag/ledger-gate.mjs`
- Modify: `merkle-dag/scripts/test-orchestrate.mjs`
- Modify: `merkle-dag/scripts/test-ledger-gate.mjs`
- Modify: `merkle-dag/package.json`
- Modify: `build-gate/package.json`

**Interfaces:**
- Produces: `verifyFinalProductionProfile({ telosDir, baseDir, plan, nowMs }) -> settlement`.
- Settlement is closed: `{ settlement_contract, plan_hash, status, finding_code, expected_refs, actual_refs, detail }`.
- Changes: `runBuild()` requires an injected `finalProfileVerify` whenever the recomputed plan contains production lifecycle metadata.
- Changes: generic `runBuild()` accepts `beforeVerificationFrontier`; the production orchestrator
  requires a controller implementation that validates or writes signed process records after ordinary
  settlement and before any obligation-discharge node runs.
- Produces: the closed frontier result
  `{ frontier_contract, status, finding_code, evidence_files, detail }`; preparation status is distinct
  from the signed evidence outcome later evaluated by `production-record-v1`.
- Changes: final profile verification runs after the task frontier drains and before the final ledger-gate ready verdict.
- Preserves: authorization certificate is immutable pre-build evidence and is never rewritten by settlement.

Freeze `settlement_contract` as `"telos-production-settlement-v1"` and `status` as exactly
`"pass" | "blocked" | "cannot-run"`. Both reference objects always have this closed shape:

```js
{
  compiler_contract,
  proposal_id,
  build_intent_ref,
  production_input_ref,
  profile_ref,
  repo_facts_ref,
  policy_ref,
  registry_ref,
  runtime_manifest_ref,
  evidence_config_ref,
  obligation_set_ref,
  compiled_artifact_ref,
  production_source_refs,
  production_obligation_refs,
  verification_node_refs,
  executable_refs,
  evidence_frontier_ref
}
```

`evidence_frontier_ref` is null before a prepared process frontier exists and is the exact derived
frontier artifact ref thereafter. Other scalar values that cannot be derived are `null`; arrays are
unique and code-unit sorted. A pass requires exact object equality, `finding_code: null`, and
`detail: null`. A semantic mismatch uses
`status: "blocked"` and only `finding_code: "BLOCKED_PROFILE_DRIFT"`. Unsafe/unavailable evaluation
uses `status: "cannot-run"` and one of
`REPO_SCAN_LIMIT`, `REPO_SCAN_UNSAFE_PATH`, `POLICY_INVALID`, `POLICY_VERSION`,
`CHECK_KIND_UNREGISTERED`, `CHECK_CONTRACT_STALE`, or `CANNOT_RUN`.
Its detail is exactly `{ code, message }`, with a redacted message capped at 2 KiB. Derive
`settlement_ref = H(canonical settlement)` externally; it is not a field in its own preimage.

Freeze the callback result exactly:

```js
{
  frontier_contract: "telos-production-evidence-frontier-v1",
  status: "prepared" | "blocked" | "cannot-run",
  finding_code: null
    | "EVIDENCE_ADAPTER_REQUIRED"
    | "EVIDENCE_FORMAT_UNSUPPORTED"
    | "PRODUCTION_LIFECYCLE_MISMATCH"
    | "CANNOT_RUN",
  evidence_files: [{
    obligation_id: "<current process obligation ID>",
    path: "<configured safe repository-relative record path>",
    bytes_sha256: "sha256:<SHA-256 of exact stable-read file bytes>"
  }],
  detail: null | { code, message }
}
```

After validating a `prepared` callback result, the controller creates this exact durable transport:

```js
{
  production_evidence_frontier_artifact_version: 1,
  plan_hash,
  executing_build_ref,
  frontier_result: {
    frontier_contract: "telos-production-evidence-frontier-v1",
    status: "prepared",
    finding_code: null,
    evidence_files: [/* exact validated entries above */],
    detail: null
  }
}
```

Write canonical bytes atomically to `.telos/production-evidence-frontier.json` and derive
`evidence_frontier_ref = H(canonical artifact)` externally; the ref is not a self field. The path is
inside the same fixed `.telos` root already used by the check runner's plan guard, so the resolved node
descriptor and CLI arguments remain unchanged. Before dispatch and on every later `verify()` replay,
stable-read and re-hash the artifact, independently recompute its plan/executing-build refs, and reject
unknown keys, a stale ref, a changed file, or any evidence entry that does not exactly match current
configured process-record paths. The artifact remains present until the final generic verification and
`done()` complete.

`evidence_files` is an availability manifest, not a semantic-record claim. Entries have a closed key
set, are unique and code-unit sorted by `obligation_id`, use the exact configured `record_paths`
selection, and bind the exact stable-read raw bytes before parsing. `prepared` requires
`finding_code: null`, `detail: null`, and exactly one entry for every triggered process obligation.
The controller transports this manifest only through the durable artifact above, never through
`params_json`, environment variables, or a CLI flag. `production-record-v1` stable-reads the selected
record path, first requires the exact raw-byte hash, and only then parses and verifies the record.

This lets the frontier prove that a declared file exists without certifying its contents. For a valid
canonical signed record, `bytes_sha256` equals its derived `record_ref`; a valid signed fail therefore
returns frontier `prepared` and the check returns exit `1`. Malformed, noncanonical, expired, unsigned,
or otherwise unverifiable bytes still have an availability hash, reach the bound check, and return
exit `2`. A changed-during-read file or a file the callback cannot make available is not `prepared`.

`blocked` requires empty `evidence_files` and one of the first three non-null codes: no configured
adapter/signer, unsupported configured format, unauthorized write, or deterministic source/plan/path
mismatch. `cannot-run` requires empty `evidence_files`, `finding_code: "CANNOT_RUN"`, and redacted bounded detail
for signer/I/O/controller failure. Unknown keys/statuses, illegal code/status combinations, partial ref
sets, or a thrown callback map to cannot-run; none is treated as prepared.

- [ ] **Step 1: Create the authorized slice loadout**

Record final scanner access, fixed clock boundary, expected output inventory, local external
process-signing capability, no-model/no-network status, and authorized plan. This slice cannot proceed
if the controller cannot distinguish assertion failure from cannot-run.

- [ ] **Step 2: Add red drift and missing-callback tests**

Create lifecycle fixtures where implementation:

- adds a confirmed AI dependency;
- adds an external provider config;
- adds a public route;
- adds payment/database capability;
- changes runtime adapter/evidence config;
- changes policy or registry source;
- deletes/duplicates a source or verification node;
- creates an untracked declared structural output;
- introduces an unresolved text signal;
- leaves repository state unchanged.

Assert every change returns `BLOCKED_PROFILE_DRIFT`, no `ready`, and exact expected/actual refs. Assert:

- exact closed pass, blocked, and cannot-run settlement objects reject unknown statuses, missing/extra
  keys, illegal finding-code/status pairs, unsorted ref arrays, or non-null pass detail;
- omitted final verifier on a production plan fails `MISSING_FINAL_PROFILE_VERIFY`;
- a throwing verifier fails closed;
- a legacy plan still works without the callback;
- final verification cannot edit or replace the V2 authorization certificate;
- final verification runs after all dispatches but before `ledger-gate.verify`;
- the process-evidence frontier runs exactly once after every ordinary node settles and before any
  discharge node; it receives the exact `executing_build_ref`, can write only configured process-record
  paths, and, when no durable artifact exists, a missing/throwing/failed callback blocks without
  dispatching a verification node; after a crash, an exact durable prepared artifact is reused without
  a second callback, while a stale, malformed, or mismatched artifact blocks;
- if a production worker proposes a respec, the Task 5 reauthorization error occurs before any
  frontier/external signer/final verifier call, no mutated plan is written, and no additional node is
  dispatched;
- a frontier `prepared` result containing a valid signed fail record permits the bound verification
  node to run and preserves its exit `1`; a stable raw-file descriptor for malformed/unverifiable
  evidence reaches the same node and preserves exit `2`;
- a prepared result creates exact canonical `.telos/production-evidence-frontier.json`; deleting,
  mutating, replacing, or raw-file-drifting it before discharge or final `ledger-gate.verify()` returns
  exit `2`, while a clean child-process restart reuses the exact artifact and makes zero frontier/
  signer calls;
- every invalid frontier result shape and each closed blocked/cannot-run mapping stops before the first
  discharge node;
- a fresh reauthorized revision with the changed profile can later pass.

- [ ] **Step 3: Add generic exit-detail red tests**

In `test-ledger-gate.mjs`, use arbitrary node tests that exit `1` and `2`. Assert both block and the
structured node result preserves `test_exit_status: 1` versus `2`. Do not key behavior on a production
kind or node prefix.

- [ ] **Step 4: Run the red settlement tests**

Run:

```bash
node build-gate/scripts/test-production-lifecycle.mjs
node merkle-dag/scripts/test-orchestrate.mjs
node merkle-dag/scripts/test-ledger-gate.mjs
```

Expected: callback requirement, drift result, and generic exit-detail assertions fail.

- [ ] **Step 5: Implement final disk-only reclassification**

Read the signed root build-intent/input refs plus `compiled_artifact_ref` from reconstructed plan and
proposal state. Ignore caller dossier state. Re-run scanner/compiler against final repository bytes,
including declared outputs. Compare exact:

- compiler contract;
- proposal/build-intent identity;
- production input, profile, repo facts, policy, registry, evidence config, and obligation set refs;
- complete production source records;
- expected version-2 obligation/check/node/executable identities.

Any fully derived difference yields `status: "blocked"` and
`finding_code: "BLOCKED_PROFILE_DRIFT"`. Scanner, policy, registry, artifact, or source reconstruction
that cannot run safely uses the exact `"cannot-run"` mapping above and cannot be converted to reparable
drift.

- [ ] **Step 6: Integrate the mandatory final verifier**

Extend `runBuild()` with:

```js
beforeVerificationFrontier = null,
finalProfileVerify = null
```

Treat the exact set of `plan.obligations[].discharge_node_id` as the verification frontier; do not use
prefixes. Once every other node is settled and before dispatching the first discharge node:

1. re-run lifecycle authorization against the exact recomputed live plan and stop if its hash differs
   from the V2-authorized plan;
2. derive the current executing-build manifest/ref from the recomputed plan, signed ledger, and disk
   using explicit `baseDir`;
3. stable-read `.telos/production-evidence-frontier.json` if it already exists. Reuse it without
   invoking the callback only when its canonical bytes, ref, plan hash, executing-build ref, complete
   evidence-file set, and current raw file hashes all verify exactly; any stale/invalid existing
   artifact blocks and is never overwritten;
4. when no artifact exists, invoke
   `beforeVerificationFrontier({ telosDir, baseDir, plan, executingBuildRef, nowMs })` exactly once;
   allow that callback to write only configured process-record paths and reject any other checkout or
   `.telos/` mutation;
5. validate the exact closed callback result and stop with its typed blocked/cannot-run mapping unless
   it returns `status: "prepared"`; then atomically write the controller-owned canonical frontier
   artifact and re-read it;
6. bind each exact artifact `evidence_files` entry to its corresponding discharge invocation as
   immutable controller execution context, recompute/re-read state, re-check exact V2 authorization,
   then permit discharge-node execution. Neither generic callers nor node descriptors can replace that
   context;
7. retain the artifact through final generic `verify()`/`done()` and include its exact ref in production
   settlement.

The build-gate production wrapper always supplies this callback. It verifies already-present signed
records or obtains fresh records through an explicitly injected external signer; no model callback,
ambient credential, or Merkle module owns that signer. A legacy plan and a direct generic
`merkle-dag` caller retain current behavior when the callback is absent.

After the complete frontier drains, recompute the plan. If production lifecycle exists:

1. re-run lifecycle authorization and require its exact authorized plan hash to equal `livePlan.plan_hash`;
2. require `finalProfileVerify`;
3. invoke it with `{ telosDir, baseDir, plan: livePlan, nowMs }`;
4. atomically write `.telos/production-settlement.json`;
5. return a blocked report immediately unless `status === "pass"`;
6. only then call generic `verify()`.

The settlement file is a current controller result, not an authorization certificate and not an input
to its own pass decision.

- [ ] **Step 7: Preserve generic ledger-gate semantics and detail**

Do not import `build-gate`, inspect source kinds, or special-case `verify-production-*`. Add
`test_exit_status` and a bounded output tail to the generic node report. Every non-zero exit remains
failed; signal/timeout/spawn error remains cannot-run detail.

- [ ] **Step 8: Run focused and complete regressions**

Run:

```bash
node build-gate/scripts/test-production-lifecycle.mjs
node merkle-dag/scripts/test-orchestrate.mjs
node merkle-dag/scripts/test-ledger-gate.mjs
npm --prefix merkle-dag test
```

Expected: unchanged final state passes; every drift/cannot-run fixture blocks; legacy plans remain green.

- [ ] **Step 9: Commit the slice**

```bash
git add build-gate/proposal-orchestrator.mjs \
  build-gate/production-profile/compiler.mjs \
  build-gate/production-profile/artifact-io.mjs \
  build-gate/scripts/test-production-lifecycle.mjs \
  build-gate/package.json \
  merkle-dag/orchestrate.mjs merkle-dag/ledger-gate.mjs \
  merkle-dag/scripts/test-orchestrate.mjs \
  merkle-dag/scripts/test-ledger-gate.mjs merkle-dag/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-10.json
git commit -m "feat(production-profile): block post-build profile drift"
```

---

### Task 11: Prove catalog completeness and publish the synthetic bank demonstration

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-11.json`
- Modify: `build-gate/scripts/test-production-policy.mjs`
- Modify: `build-gate/scripts/test-production-checks.mjs`
- Create: `docs/runs/production-profile-demo/run.mjs`
- Create: `docs/runs/production-profile-demo/publication/run-summary.json`
- Create: `docs/runs/production-profile-demo/publication/manifest.json`
- Create: `docs/runs/production-profile-demo/README.md`
- Create: `docs/runs/production-profile-demo/fixtures/dossier-ai-egress.json`
- Create: `docs/runs/production-profile-demo/fixtures/dossier-escalated.json`
- Create: `docs/runs/production-profile-demo/fixtures/runtime-adapter.json`
- Create: `docs/runs/production-profile-demo/fixtures/production-controls.json`
- Create: `docs/runs/production-profile-demo/fixtures/fake-application.mjs`
- Create: `docs/runs/production-profile-demo/fixtures/fake-provider.mjs`
- Create: `docs/runs/production-profile-demo/publication/public-keyring.json`
- Create: `docs/runs/production-profile-demo/publication/plan-before.snapshot.json`
- Create: `docs/runs/production-profile-demo/publication/plan-after.snapshot.json`
- Create: `docs/runs/production-profile-demo/publication/proposal-ledger.snapshot.jsonl`
- Create: `docs/runs/production-profile-demo/publication/proposal-artifacts.snapshot.json`
- Modify: `build-gate/package.json`

**Interfaces:**
- Produces: `node docs/runs/production-profile-demo/run.mjs --verify-committed`.
- Produces: one-time publication mode
  `node docs/runs/production-profile-demo/run.mjs --publish --controller-private-key <absolute-external-path>`;
  it exits `0` only after one crash-safe publication-directory rename, `2` on a deterministic blocker,
  and `1` on cannot-run.
  Unknown/duplicate flags, a relative/in-repository/symlink key, or a non-Ed25519 PKCS#8 key blocks
  before output; no key bytes enter committed output.
- Proves: unsafe egress blocks, corrected egress discharges, and profile escalation invalidates authorization through the actual compiler/Merkle/proposal/ledger path.
- Preserves: synthetic evidence is not represented as bank, customer, provider, compliance, or production evidence.

- [ ] **Step 1: Create the authorized slice loadout**

Record fixed loopback ports, synthetic data, no external network, the future external publication-key
capability/stop condition (not a nonexistent path), actual Node matrix, and authorized plan. The
invalid marker is the only SSN-shaped value permitted and must be labeled synthetic at every
occurrence.

- [ ] **Step 2: Complete the 31-rule transition matrix**

Extend `test-production-policy.mjs` so its table is mechanically complete:

```js
assert.deepEqual(
  [...fixtureMatrix.keys()].sort(codeUnitCompare),
  policy.obligations.map((r) => r.obligation_id).sort(codeUnitCompare)
);
for (const id of EXPECTED_IDS) {
  assert.deepEqual(Object.keys(fixtureMatrix.get(id)).sort(), [
    "failing_evidence",
    "identity_mutation",
    "non_trigger",
    "passing_evidence",
    "single_fact_trigger"
  ]);
}
```

For each triggered fixture, compile and verify that exactly the intended source, tier, kind, operation
requirements, check contract, node ID, and local identity appear. A test that only counts 31 entries is
insufficient.

- [ ] **Step 3: Write the bank-demo red acceptance test**

The committed verifier must assert this exact sequence:

1. AI profile compilation includes `AI-PROVIDER-001`, `AI-EGRESS-001`, `AI-LINEAGE-001`, and `OBS-001`.
2. Unsafe application attempts to pass `000-00-0000` to a disallowed provider.
3. `production-ai-egress-v1` exits `1`; fake provider transport count is zero only in the corrected
   implementation, and the unsafe obligation remains undischarged.
4. Corrected application blocks before transport, records only a redacted marker classification, and
   discharges all four named obligations.
5. Escalating the dossier to multi-tenant plus subscription adds at least `AUTHZ-002`, `PAY-001`, and
   `PAY-002`, changes profile/obligation/plan hashes, and makes the prior V2 authorization unusable.
6. No tenant/payment fixture exists in the first build, so the escalated plan remains blocked.
7. Fault injection before/after each candidate-file fsync, pending-directory fsync, final directory
   rename, and parent-directory fsync leaves either ignored `publication.pending` or one complete
   manifest-verified `publication`; no partial set is trusted.

- [ ] **Step 4: Run the red demo**

Run:

```bash
node docs/runs/production-profile-demo/run.mjs --verify-committed
```

Expected: failure because the committed snapshots and verifier do not exist.

- [ ] **Step 5: Implement a real loopback adapter over candidate semantics**

`fake-application.mjs` exposes the hash-bound operation manifest but delegates each operation to an
exported candidate handler. The unsafe and corrected handlers differ only at the AI egress boundary.
`fake-provider.mjs` is a literal-loopback transport recorder with no external forwarding.

The adapter must produce an operation trace containing candidate module/function identity and input
class, not payload. A fixture that returns expected statuses without calling the handler fails trace
binding.

- [ ] **Step 6: Implement publication and committed verification modes**

Publication:

- requires a completely clean tracked checkout at a commit that already contains `run.mjs`, every
  semantic fixture, both candidate handlers, and the test changes;
- loads an external ephemeral controller private key from an explicit path;
- runs the actual production proposal, Merkle planner, gate, verification nodes, final profile verifier,
  and `done()` path in a temporary clone/workspace;
- writes only public JWK, signed snapshots, canonical plan/artifact snapshots, summary, and a closed
  exact-path/hash manifest beneath absent `publication.pending`;
- fsyncs every file/directory, verifies the pending manifest, atomically renames that single directory
  to absent `publication` on the same filesystem, and fsyncs the parent;
- deletes temporary `.telos/`, key path under the temporary workspace, and runtime state;
- verifies no private JWK fields or PEM markers exist before publication.

Readers ignore `publication.pending`; a complete final `publication` directory plus its valid manifest
is the sole demo commit marker. On restart, pending-only is verified and promoted or discarded;
complete final is idempotently verified; simultaneous pending/final, a final manifest mismatch, or an
unsupported rename/fsync primitive is cannot-run and never repaired in place.

`--verify-committed`:

- is read-only;
- exits `2` and writes exactly `PUBLICATION_NOT_FOUND` to stderr when the required public output set
  is absent; any I/O/runtime inability exits `1`;
- ignores pending-only state and requires the complete final manifest with no extra/missing path;
- verifies public signatures and hashes from committed bytes;
- re-runs compiler, registry, unsafe/corrected runtime checks, source/obligation reconciliation, and
  profile escalation;
- compares semantic summary and snapshot identities;
- does not regenerate keys/signatures or trust `run-summary.json` as a pass input.

The committed summary contains exact profile/source/obligation/check IDs and before/after plan hashes
from publication, plus a relationship assertion that the hashes differ. Re-verification proves those
committed plan bytes; a fresh live run may use a fresh key and must prove the same semantic relations
rather than reproduce key-bound plan hashes.

- [ ] **Step 7: Redact and enforce explicit non-claims**

Fail if any output contains:

- a real-looking SSN other than exact invalid `000-00-0000`;
- raw marker payload in audit output;
- credential/token/private key;
- external provider host;
- a claim of bank use, regulatory compliance, certification, complete security, or production
  effectiveness.

`README.md` and `run-summary.json` state that the demo proves a bounded synthetic egress control and
dynamic invalidation only.

- [ ] **Step 8: Commit the complete proof harness before publication**

Add a dedicated `production-profile-demo:verify` package script without adding it to the default package
test until evidence exists. Verify syntax and all pre-publication implementation tests, then commit only
the harness, semantic fixtures, and test changes:

```bash
node --check docs/runs/production-profile-demo/run.mjs
node build-gate/scripts/test-production-policy.mjs
node build-gate/scripts/test-production-checks.mjs
npm --prefix build-gate test
set +e
prepublish_output="$(node docs/runs/production-profile-demo/run.mjs --verify-committed 2>&1)"
prepublish_status=$?
set -e
test "$prepublish_status" -eq 2
test "$prepublish_output" = "PUBLICATION_NOT_FOUND"
git add build-gate/scripts/test-production-policy.mjs \
  build-gate/scripts/test-production-checks.mjs build-gate/package.json \
  docs/runs/production-profile-demo/run.mjs \
  docs/runs/production-profile-demo/README.md \
  docs/runs/production-profile-demo/fixtures/dossier-ai-egress.json \
  docs/runs/production-profile-demo/fixtures/dossier-escalated.json \
  docs/runs/production-profile-demo/fixtures/runtime-adapter.json \
  docs/runs/production-profile-demo/fixtures/production-controls.json \
  docs/runs/production-profile-demo/fixtures/fake-application.mjs \
  docs/runs/production-profile-demo/fixtures/fake-provider.mjs \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-11.json
git diff --cached --check
git commit -m "test(production-profile): add committed bank-style proof harness"
git status --short
```

Expected: tests pass; the exact verifier invocation proves exit `2`/`PUBLICATION_NOT_FOUND` before the
harness commit; it creates no output; and the tracked checkout is clean after the harness commit.
Record that exact full commit in publication metadata.

- [ ] **Step 9: Publish once from the clean harness commit and verify candidate evidence**

Create an ephemeral key outside the repository, require `git status --porcelain` to be empty, run
publication, securely remove the key file, and require the only resulting paths to be this exact
generated-output allowlist:

```bash
test -z "$(git status --porcelain)"
cleanup_demo_key() { rm -f -- "$DEMO_CONTROLLER_PRIVATE_KEY"; }
trap cleanup_demo_key EXIT HUP INT TERM
set +e
node docs/runs/production-profile-demo/run.mjs --publish \
  --controller-private-key "$DEMO_CONTROLLER_PRIVATE_KEY"
demo_publish_status=$?
set -e
cleanup_demo_key
unset DEMO_CONTROLLER_PRIVATE_KEY
trap - EXIT HUP INT TERM
test "$demo_publish_status" -eq 0
```

```text
docs/runs/production-profile-demo/publication/run-summary.json
docs/runs/production-profile-demo/publication/manifest.json
docs/runs/production-profile-demo/publication/public-keyring.json
docs/runs/production-profile-demo/publication/plan-before.snapshot.json
docs/runs/production-profile-demo/publication/plan-after.snapshot.json
docs/runs/production-profile-demo/publication/proposal-ledger.snapshot.jsonl
docs/runs/production-profile-demo/publication/proposal-artifacts.snapshot.json
```

Then run:

```bash
node docs/runs/production-profile-demo/run.mjs --verify-committed
node build-gate/scripts/test-production-policy.mjs
node build-gate/scripts/test-production-checks.mjs
git diff --check
```

Expected: verification passes against the candidate public evidence, all 31 matrix rows pass, no
harness/static fixture is modified, no `publication.pending` remains, and no private material is
present.

- [ ] **Step 10: Commit only generated public evidence**

```bash
git add docs/runs/production-profile-demo/publication/run-summary.json \
  docs/runs/production-profile-demo/publication/manifest.json \
  docs/runs/production-profile-demo/publication/public-keyring.json \
  docs/runs/production-profile-demo/publication/plan-before.snapshot.json \
  docs/runs/production-profile-demo/publication/plan-after.snapshot.json \
  docs/runs/production-profile-demo/publication/proposal-ledger.snapshot.jsonl \
  docs/runs/production-profile-demo/publication/proposal-artifacts.snapshot.json
git diff --cached --check
git commit -m "test(production-profile): publish bank-style fail-closed proof"
node docs/runs/production-profile-demo/run.mjs --verify-committed
git status --short
```

Expected: publication is generated by committed verifier/harness bytes, the evidence commit contains
only the exact public outputs, committed verification passes, and the tracked checkout is clean before
the mandatory Argo ledger closure.

---

### Task 12: Run TELOS through the same production process and publish self-hosting evidence

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-12.json`
- Preserve byte-for-byte: `build-gate/examples/self/`
- Create: `build-gate/examples/production-profile-self/README.md`
- Create: `build-gate/examples/production-profile-self/dossier.json`
- Create: `build-gate/examples/production-profile-self/runtime-adapter.json`
- Create: `build-gate/examples/production-profile-self/production-controls.json`
- Create: `docs/runs/production-profile-self/run.mjs`
- Create: `docs/runs/production-profile-self/README.md`
- Create: `docs/runs/production-profile-self/publication-attempts.jsonl`
- Create on forensic branch: `docs/runs/production-profile-self/forensic-holds/attempt-NNN.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/preparation/controller-keyring.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/preparation/process-keyring.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/preparation/attempt-governance-keyring.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/preparation/plan.snapshot.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/governance/controller-approval.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/governance/self-authorization.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/governance/review-packets.snapshot.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/publication/verified-summary.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/publication/evidence-manifest.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/publication/proposal-ledger.snapshot.jsonl`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/publication/settlement-ledger.snapshot.jsonl`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/publication/proposal-artifacts.snapshot.json`
- Create: `docs/runs/production-profile-self/attempts/attempt-NNN/publication/process-records/`
- Create: `docs/runs/production-profile-self/fixtures/runtime-server.mjs`
- Create: `docs/runs/production-profile-self/fixtures/telos-adapter.mjs`
- Create: `docs/runs/production-profile-self/fixtures/production-controls.json`
- Create: `docs/runs/production-profile-self/fixtures/negative-controls.json`
- Modify: `build-gate/package.json`

**Interfaces:**
- Produces: `node docs/runs/production-profile-self/run.mjs --verify-committed`.
- Produces: read-only `--print-current-attempt-id`, which derives the sole legal `attempt-NNN` from the
  signed ledger and prints only that ID.
- Produces: `--prepare-plan`, `--record-authorization`, `--publish`,
  `--recover-publication`, `--record-forensic-hold`, and `--supersede-attempt` modes over an exact
  immutable `attempt-NNN` identifier.
- Requires three distinct external Ed25519 PKCS#8 private-key paths: controller, process evidence, and
  The Eye's attempt-governance signer. Their public JWKs are attempt-scoped and no private bytes enter
  the repository.
- Exits exactly `0` on completed mode success, `2` on a deterministic validation/authorization/
  evidence blocker, and `1` when the requested mode cannot run safely. Unknown, duplicate, missing, or
  mode-inapplicable flags fail with exit `2` before any private-key file is opened.
- Proves: TELOS is a real host of the candidate, not a repository-name branch or packet-only fixture.
- Preserves: existing `build-gate/examples/self/` bytes and claims.

In this task's file inventory, `attempt-NNN` is schema notation for the exact three-digit ID returned by
`--print-current-attempt-id`, not a glob or caller placeholder. With no ledger it returns
`attempt-001`; with one nonterminal attempt it returns that ID; after `SUPERSEDED` it returns the next
contiguous ID; after `PUBLISHED` it returns that published ID for verification/staging while every
mutating mode rejects a new attempt. Malformed, forked, noncontiguous, or multiply active history exits
`2`. Every mutating mode independently re-derives the ID and rejects a supplied mismatch before
opening a key or writing a path.

- [ ] **Step 1: Create the authorized self-hosting slice loadout**

The Argo slice is authorized by the matured implementation plan; the self-hosting run it builds is a
later distinct acceptance proposal. At this pre-code point, record only facts that already exist plus
future capability/stop requirements:

- exact accepted Task 11 parent commit and authorized implementation-plan ref;
- the proposed controller-dossier path, explicitly marked unapproved and without an invented content
  ref;
- required future controller approval, self-plan, keyring, review-packet, and self-authorization
  artifacts, each as an unresolved stop condition rather than a value;
- actual required/advisory seat capabilities and provenance requirements;
- Node 18/20 capability;
- capability to create three distinct external ephemeral controller, process-signing, and
  attempt-governance keys later; no nonexistent key path is recorded;
- no live provider or real personal-data permission.

The loadout validator rejects a claimed dossier/authorization/key ref at this stage. Harness and
candidate-dossier implementation may proceed under the Argo slice; preparation waits for the external
keys, and publication waits until the dedicated later authorization binds the exact committed dossier
and self plan.

- [ ] **Step 2: Author the proposed TELOS dossier under controller jurisdiction**

The dossier must declare at least:

- `proposal_lifecycle: true`;
- `market_bound: true`;
- durable persistence for content-addressed governance and ledgers;
- AI enabled and role `agentic`;
- every current external provider/connector and processing purpose;
- external egress wherever a connector crosses local trust;
- `can_write: true` and `can_execute: true`;
- data classes covering repository/operator material eligible for model context.

The Eye must later choose exposure, identity, tenancy, authorization, retention/deletion, residency,
availability/recovery, traffic, transaction authority, provider retention/training, RAG source class,
consequential domains, and user populations. At this step the builder may write the proposed tracked
dossier and adapters but cannot create `controller-approval.json`, represent those values as approved,
or choose convenient minima.

- [ ] **Step 3: Write red self-hosting and anti-bypass tests**

Before the run exists, assert publication/verification must prove:

- a clean TELOS checkout compiles from the tracked dossier;
- proposal orchestration, workshop boundary, Merkle planning, disk-only proposal gate, V2 certificate,
  final scanner, verification-node settlement, and `done()` all execute;
- a fresh child process restarts before authorization verification;
- every applicable check uses the same production registry;
- no external model/provider call occurs during deterministic replay;
- old `build-gate/examples/self/` alone cannot satisfy the self-hosting assertion;
- repository name does not affect activation, policy, checks, or verdict;
- deleting one production obligation blocks;
- substituting a no-op implementation blocks;
- lowering confirmed AI egress/write/execute facts blocks;
- adding one newly confirmed provider fact blocks;
- duplicate/unknown mode flags, relative/in-repository key paths, non-Ed25519 keys, key-material reuse
  across roles, a caller-selected/reused/skipped/noncontiguous attempt ID, illegal attempt-state
  transitions, a rewritten attempt-ledger prefix, and overwrite of any existing attempt artifact block
  before publication;
- for each PREPARED/AUTHORIZED/PUBLISHED phase, fault injection after every pending-file fsync,
  pending-directory fsync, directory rename, ledger temporary-file fsync, ledger rename,
  parent-directory fsync, and lock cleanup yields only the closed recovery states; no unmarked
  directory is trusted and no marker can validate absent/mismatched bytes;
- recovery exit `1` writes and signs the exact forensic hold; a fresh process then blocks every listed
  mutating mode, including `--recover-publication`/`--supersede-attempt`, before key access, while
  deletion, mutation, duplicate hold, or forged clearance remains dirty/tamper-blocking;
- `.telos/` and temporary workspaces are removed and tracked checkout remains clean.

- [ ] **Step 4: Run the red committed verifier**

Run:

```bash
node docs/runs/production-profile-self/run.mjs --verify-committed
```

Expected: failure because no self-hosting evidence is published.

- [ ] **Step 5: Implement the TELOS host adapter and candidate-plan preparation**

`telos-adapter.mjs` maps the generic operation manifest to actual candidate modules and injected fake
provider/process boundaries. It must:

- call real production-profile schema/compiler/registry/proposal functions;
- expose runtime scenarios through literal loopback;
- use synthetic tenants, tokens, data, payment events, and AI marker;
- record candidate operation identity and redacted outcomes;
- never branch on repository name or evidence directory;
- never insert a ledger line or pass result directly.

Include a fixture-only adapter negative control and require it to fail because it does not traverse the
candidate semantic handler.

Preparation is exactly:

```bash
ATTEMPT_ID="$(node docs/runs/production-profile-self/run.mjs --print-current-attempt-id)"
case "$ATTEMPT_ID" in attempt-[0-9][0-9][0-9]) ;; *) exit 2 ;; esac
ATTEMPT_DIR="docs/runs/production-profile-self/attempts/$ATTEMPT_ID"
node docs/runs/production-profile-self/run.mjs --prepare-plan \
  --attempt-id "$ATTEMPT_ID" \
  --controller-private-key "$CONTROLLER_PRIVATE_KEY" \
  --process-private-key "$PROCESS_PRIVATE_KEY" \
  --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
```

All three paths must be absolute, physically outside the repository after realpath resolution, regular
non-symlink files containing distinct Ed25519 PKCS#8 private keys, and owner-only on POSIX. Preparation
runs from a clean tracked checkout, derives the three public JWK keyrings, compiles the exact tracked
dossier, and runs the proposal/workshop/planner preparation path without issuing authorization or
settlement. It writes the four files beneath absent
`attempts/<derived-attempt-id>.pending/preparation/`, fsyncs and verifies the complete directory,
renames the single pending attempt directory to its absent derived ID, and only then installs the signed `PREPARED`
ledger line through the Step 6 commit-marker protocol. Existing destinations are never overwritten;
an unmarked attempt directory is ignored.

The plan snapshot binds the exact harness commit, attempt ID, dossier ref, build-intent ref,
compiler/policy/registry refs, all three keyring refs, fixed source/obligation/check sets, and
self-hosting task graph. Preparation cannot emit a pass, certificate, ledger settlement, controller
approval, or self authorization.

- [ ] **Step 6: Implement one-time publication and deterministic committed verification**

`publication-attempts.jsonl` is the controller-independent attempt/supersession ledger. Each line is
canonical JSON with this exact closed record:

```js
{
  publication_attempt_record_version: 1,
  sequence: 1,
  attempt_id: "attempt-NNN",
  state: "PREPARED" | "AUTHORIZED" | "SUPERSEDED" | "PUBLISHED",
  previous_event_ref: null | "sha256:<complete prior signed line>",
  plan_ref: "sha256:<attempt plan snapshot>",
  controller_keyring_ref: "sha256:<attempt controller public keyring>",
  process_keyring_ref: "sha256:<attempt process public keyring>",
  attempt_governance_keyring_ref: "sha256:<attempt governance public keyring>",
  controller_approval_ref: null | "sha256:<attempt approval>",
  self_authorization_ref: null | "sha256:<attempt authorization>",
  review_packets_ref: null | "sha256:<attempt review packet snapshot>",
  evidence_manifest_ref: null | "sha256:<published attempt evidence manifest>",
  reason_code: null
    | "CONTROLLER_KEY_LOST"
    | "CONTROLLER_KEY_EXPOSED"
    | "PROCESS_KEY_LOST"
    | "PROCESS_KEY_EXPOSED"
    | "PUBLICATION_BLOCKED"
    | "PUBLICATION_CANNOT_RUN",
  recorded_at_ms: 0,
  signature: {
    algorithm: "Ed25519",
    key_id: "<attempt-governance key ID>",
    value: "<unpadded base64url>"
  }
}
```

The Eye signs canonical bytes with `signature` omitted using the attempt's distinct external governance
private key. Derive each `event_ref` from the complete signed record; it is not a self field.
`recorded_at_ms` is a non-negative safe integer injected once at this governance boundary and is not a
compiler semantic input. The verifier requires a byte-exact committed prefix, contiguous sequence,
complete hash chain, exact attempt-scoped public-key/signature verification, and these transitions:

- `PREPARED` is the first event for the next contiguous `attempt-NNN`; approval/authorization/review/
  evidence refs and reason are null.
- `AUTHORIZED` follows that attempt's `PREPARED`; all three governance refs are exact and non-null,
  evidence/reason are null.
- `SUPERSEDED` terminally follows `PREPARED` or `AUTHORIZED`, preserves every already populated ref,
  has exactly one closed non-null reason, and has no evidence manifest.
- `PUBLISHED` terminally follows `AUTHORIZED`, has the exact evidence manifest ref and null reason.
- No attempt artifact can be replaced after creation, no terminal attempt can receive another event,
  and a later attempt is legal only after the prior attempt is `SUPERSEDED`. A successful
  `PUBLISHED` attempt is unique.

Every multi-file `PREPARED`, `AUTHORIZED`, and `PUBLISHED` transition uses the same crash-safe
two-phase commit-marker protocol; the plan does not claim that a filesystem can rename multiple paths
atomically:

1. Acquire absent `attempts/attempt-NNN.transition.lock` with exclusive create and refuse a second
   writer.
2. Write/fsync/verify exactly one absent candidate directory beneath the derived attempt:
   `attempt-NNN.pending/preparation` for `PREPARED`, `attempt-NNN/governance.pending` for
   `AUTHORIZED`, or `attempt-NNN/publication.pending` for `PUBLISHED`. No final artifact path changes
   while the candidate is built.
3. Atomically rename the one complete candidate directory on the same filesystem:
   `attempt-NNN.pending` to absent `attempt-NNN`, `governance.pending` to absent `governance`, or
   `publication.pending` to absent `publication`; then fsync the parent. The immutable candidate is
   visible but not trusted yet.
4. Re-read `publication-attempts.jsonl` and require byte equality with the prefix validated before
   Step 1. Construct the complete next canonical ledger with the corresponding signed state line,
   write/fsync an exclusive sibling temporary file, atomically rename that one file over the old
   ledger (or into its initially absent path), and fsync its parent.
5. The signed, hash-chained state line is the sole commit marker for that directory. Readers ignore an
   unmarked attempt, governance, or publication directory and every `.pending` path. Remove/fsync the
   lock only after the marker is durable.

Unsupported same-filesystem rename/fsync semantics are cannot-run, never a weaker transition. Crash
recovery has a closed state table for each phase: pending-only may be verified and promoted or
discarded as uncommitted; final-directory-without-marker may only be verified and committed;
marker-plus-matching-directory is complete/idempotent; marker-without-directory, a prefix mismatch, or
any byte mismatch is tamper/cannot-run and is never repaired in place. Fault-injection tests exercise
every boundary for all three phases.

`--record-authorization --attempt-id "$ATTEMPT_ID"
--attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"` verifies the newly created approval,
authorization, and review snapshot in `governance.pending`, promotes the directory, and installs
`AUTHORIZED` as its commit marker. Reinvoking `--prepare-plan` or `--record-authorization` recovers only
its own closed phase state and never rewrites a marked directory.
`--recover-publication --attempt-id "$ATTEMPT_ID"
--attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"` is the only recovery writer. It
implements the state table above, never rewrites a final publication file, and can append the marker
only after full public-key/hash/authorization/manifest verification. It exits `0` only for an
idempotently complete or newly marked publication, exits `2` after safely discarding an incomplete
pending-only candidate and releasing its stale lock, and exits `1` for tamper/unsafe state while
preserving it for investigation. Supersession is allowed after recovery exit `2`, never as a way to
paper over recovery exit `1` or an unmarked complete directory.

Recovery exit `1` must be made durable before the process exits. The controller invokes
`--record-forensic-hold --attempt-id "$ATTEMPT_ID"
--attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"`. That mode independently re-reads
the repository, writes with exclusive create plus fsync, and signs this exact canonical record at
`docs/runs/production-profile-self/forensic-holds/attempt-NNN.json`:

```js
{
  production_publication_forensic_hold_version: 1,
  attempt_id: "attempt-NNN",
  status: "FORENSIC_HOLD",
  last_trusted_ledger_sha256: "sha256:<exact committed HEAD ledger bytes>",
  observed_ledger_sha256: null | "sha256:<exact current ledger bytes>",
  attempt_governance_keyring_ref: "sha256:<last trusted attempt keyring>",
  observed_paths: [{
    path: "<safe repository-relative attempt/pending/lock path>",
    kind: "file" | "directory",
    sha256: "sha256:<exact file bytes or canonical bounded tree manifest>"
  }],
  finding_code:
    "LEDGER_PREFIX_MISMATCH"
    | "PUBLICATION_BYTES_MISMATCH"
    | "MARKER_WITHOUT_DIRECTORY"
    | "LOCK_STATE_UNSAFE"
    | "RECOVERY_STATE_UNSAFE",
  prohibited_modes: [
    "prepare-plan",
    "publish",
    "record-authorization",
    "recover-publication",
    "supersede-attempt"
  ],
  recorded_at_ms: 0,
  signature: {
    algorithm: "Ed25519",
    key_id: "<attempt-governance key ID>",
    value: "<unpadded base64url>"
  }
}
```

Arrays are unique and code-unit sorted; `recorded_at_ms` is a non-negative safe integer; the signature
covers canonical bytes with `signature` omitted. The writer derives the closed finding code from
observations, never a caller flag, and includes no external key path or content. A pre-existing
byte-identical valid hold is idempotent; any conflicting, malformed, extra, or unsigned hold is
cannot-run.

At process start, `--prepare-plan`, `--record-authorization`, `--publish`,
`--recover-publication`, and `--supersede-attempt` scan the closed forensic-hold directory and reject a
matching valid hold with `FORENSIC_HOLD` exit `2` before opening any key; malformed/unregistered hold
files block globally. `--print-current-attempt-id` also exits `2` while a hold is active.
`--verify-committed` reports the hold and cannot report a published pass. The hold is never deleted or
silently cleared. Only a separate The Eye/TELOS change-protocol disposition may reference its exact
hash, preserve it, install a terminal attempt disposition, and authorize governance-key destruction or
future work.

`--supersede-attempt --attempt-id "$ATTEMPT_ID"
--attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY" --reason-code <closed-code>` uses no
controller or process private key, appends only the signed terminal event, and therefore remains
available when either execution key is lost or exposed. Loss or exposure of the independent attempt
governance key is a hard stop requiring a separate TELOS authority/change-protocol decision; it cannot
be bypassed with an unsigned record or a replacement key under the old attempt.

Publication runs from a clean checkout at the separately authorized candidate commit:

1. verify controller approval and self authorization;
2. copy the repository to a temporary host workspace;
3. load the three distinct external controller/process/attempt-governance private keys;
4. compile the exact dossier and record input before any model boundary;
5. consume fresh quest review packets bound to the exact candidate commit, controller dossier ref, and
   self-hosting plan hash;
6. run the proposal/workshop/gate path and issue V2 authorization;
7. terminate the process;
8. restart from committed/runtime disk state with no dossier argument;
9. settle every ordinary node, derive the exact executed-build manifest, and invoke the controller
   process-evidence frontier with the external signer;
10. run every applicable verification node and final profile scan;
11. settle verification records through the ordinary controller ledger and `done()` path;
12. run all four negative controls in isolated copies;
13. write canonical public snapshots, the process-record manifest, and `verified-summary.json` only
    beneath `publication.pending`;
14. prove no private key/credential/raw synthetic payload exists;
15. execute the two-phase directory-plus-ledger commit-marker protocol above;
16. re-run the complete verifier against the marked immutable `publication` directory;
17. remove temporary `.telos/`, workspaces, internal key copies, pending files, and lock.

The process records are signed during publication. Commit public JWKs and signed records only.
`evidence-manifest.json` enumerates every process-record path and content hash explicitly. Record files
use
`docs/runs/production-profile-self/attempts/attempt-NNN/publication/process-records/<lowercase-obligation-id>.json`
with the exact ledger-derived ID. No directory-presence or glob claim can satisfy the manifest, and an
extra unenumerated current record fails verification.

`--verify-committed` is read-only and:

- validates the append-only attempt chain, every attempt-governance signature, legal transition, exact
  write-once artifact refs, preservation of superseded attempts, and exactly one `PUBLISHED` attempt;
- reconstructs the exact production-evidence frontier artifact from
  `proposal-artifacts.snapshot.json`, verifies its recorded ref against the settlement and manifest,
  installs it only inside the temporary replay host's `.telos/`, and proves both the scrubbed child
  check and final generic `verify()` consume those bytes without a callback or repository write;
- verifies the controller approval, required-seat packet provenance/signatures, proposal chain, process
  records, settlement ledger, and all content-addressed artifacts;
- verifies the build-intent artifact and same-profile/different-build proposal isolation;
- checks the plan against current compiler/policy/registry bytes;
- reconstructs the profile from the committed input artifact;
- reruns safe loopback/structural checks against a temporary clean host;
- validates final profile settlement and all negative-control finding codes;
- compares exact summary identities;
- rejects any stale source/check/implementation/policy/plan hash;
- leaves `git status --porcelain` identical before and after.

It verifies that evidence was fresh at the signed authorization/publication evaluation time. A live new
production authorization still evaluates process freshness against its current injected controller
clock; the committed replay does not claim perpetual operational freshness.

- [ ] **Step 7: Preserve the historical fixture and commit the complete self harness**

Before and after creation, record:

```bash
git hash-object build-gate/examples/self/dossier.json
git ls-files -s build-gate/examples/self
```

Assert all paths and blob IDs are unchanged. The new production fixture lives only at
`build-gate/examples/production-profile-self/`.

Add a dedicated `production-profile-self:verify` package script without adding it to the default package
test before evidence exists. Run syntax, package, and red-verifier checks, then commit every executable
harness/static fixture byte and the proposed dossier before any approval or authorization:

```bash
node --check docs/runs/production-profile-self/run.mjs
npm --prefix build-gate test
npm --prefix merkle-dag test
set +e
self_prep_output="$(node docs/runs/production-profile-self/run.mjs --verify-committed 2>&1)"
self_prep_status=$?
set -e
test "$self_prep_status" -eq 2
test "$self_prep_output" = "SELF_PLAN_NOT_FOUND"
```

Expected: package tests pass and the committed verifier proves exact exit
`2`/`SELF_PLAN_NOT_FOUND`; it creates no output because the plan, authorization, and publication do
not yet exist.

```bash
git add build-gate/examples/production-profile-self/README.md \
  build-gate/examples/production-profile-self/dossier.json \
  build-gate/examples/production-profile-self/runtime-adapter.json \
  build-gate/examples/production-profile-self/production-controls.json \
  docs/runs/production-profile-self/run.mjs \
  docs/runs/production-profile-self/README.md \
  docs/runs/production-profile-self/fixtures/runtime-server.mjs \
  docs/runs/production-profile-self/fixtures/telos-adapter.mjs \
  docs/runs/production-profile-self/fixtures/production-controls.json \
  docs/runs/production-profile-self/fixtures/negative-controls.json \
  build-gate/package.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-12.json
git diff --cached --check
git commit -m "test(production-profile): add committed TELOS self-hosting harness"
git status --short
```

Expected: tracked checkout clean; the commit contains no approval, authorization, signed record, or
claim that the candidate passed.

- [ ] **Step 8: Prepare and commit the exact self-hosting plan**

From the clean harness commit, create three distinct Ed25519 PKCS#8 private keys outside the repository
in The Eye's protected owner-only temporary location, export their absolute paths as
`CONTROLLER_PRIVATE_KEY`, `PROCESS_PRIVATE_KEY`, and `ATTEMPT_GOVERNANCE_PRIVATE_KEY`, and retain them
only through this attempt's terminal event. Run the exact preparation command frozen in Step 5:

```bash
test -z "$(git status --porcelain)"
ATTEMPT_ID="$(node docs/runs/production-profile-self/run.mjs --print-current-attempt-id)"
case "$ATTEMPT_ID" in attempt-[0-9][0-9][0-9]) ;; *) exit 2 ;; esac
ATTEMPT_DIR="docs/runs/production-profile-self/attempts/$ATTEMPT_ID"
node docs/runs/production-profile-self/run.mjs --prepare-plan \
  --attempt-id "$ATTEMPT_ID" \
  --controller-private-key "$CONTROLLER_PRIVATE_KEY" \
  --process-private-key "$PROCESS_PRIVATE_KEY" \
  --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
```

Require the only dirty paths to be the three public keyrings, plan snapshot, and attempt ledger; verify
their refs against the tracked dossier and harness commit, then commit:

```bash
git add "$ATTEMPT_DIR/preparation/controller-keyring.json" \
  "$ATTEMPT_DIR/preparation/process-keyring.json" \
  "$ATTEMPT_DIR/preparation/attempt-governance-keyring.json" \
  "$ATTEMPT_DIR/preparation/plan.snapshot.json" \
  docs/runs/production-profile-self/publication-attempts.jsonl
git diff --cached --check
git commit -m "docs(production-profile): freeze TELOS self-hosting plan"
git status --short
```

No model/provider call, approval packet, authorization result, or settlement occurs during this step.
The `PREPARED` attempt record is signed only by the distinct attempt-governance key. Every path below
`attempts/attempt-NNN/` is write-once: later steps add absent files but never replace one.

If the controller or process key is lost/exposed before publication, do not edit the attempt directory
or the Argo slice ledger. While the independent governance key remains trustworthy, run exactly:

```bash
node docs/runs/production-profile-self/run.mjs --supersede-attempt \
  --attempt-id "$ATTEMPT_ID" \
  --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY" \
  --reason-code PROCESS_KEY_LOST
git add docs/runs/production-profile-self/publication-attempts.jsonl
git diff --cached --check
git commit -m "docs(telos): supersede TELOS self-publication $ATTEMPT_ID"
```

Use the one truthful closed reason code for the actual event. Securely remove all remaining keys, stop
the slice, re-run `--print-current-attempt-id` to derive the next contiguous ID, and use the same
parameterized steps with three new distinct keys and fresh controller approval plus TELOS authorization.
The old plan, all three public keyrings, and any old approval/authorization/review records remain under
the superseded `$ATTEMPT_DIR` and are verified by the signed supersession event. Never substitute a key
under an old ref or overwrite an attempt path. If the
attempt-governance key is the lost/exposed key, stop for a separate TELOS change-protocol decision as
specified in Step 6; no local fallback can supersede the attempt.

- [ ] **Step 9: Obtain and commit controller approval plus separate self authorization**

The Eye reviews the committed dossier, attempt plan snapshot, all three keyrings, evidence bindings,
and non-claims. Only The Eye may create the attempt-scoped `controller-approval.json`; it binds the
exact harness and prepared-attempt commits, attempt ID, dossier ref, plan hash, and all keyring refs.
Then run the normal TELOS authorization council against those committed bytes.
Required-seat dissent, missing provenance/signature, stale ref, or unavailable required capability
blocks publication.

Write all three candidate records beneath absent `governance.pending`:
`self-authorization.json` contains the exact authorization ID/status, plan/dossier/harness refs,
required-seat packet refs, controller approval ref, and gate result;
`review-packets.snapshot.json` contains actual provider/model/response provenance and public
signatures. The exact command verifies/promotes that directory and installs the signed `AUTHORIZED`
commit marker, after which commit only those three governance records and the append-only attempt
ledger:

```bash
ATTEMPT_ID="$(node docs/runs/production-profile-self/run.mjs --print-current-attempt-id)"
ATTEMPT_DIR="docs/runs/production-profile-self/attempts/$ATTEMPT_ID"
node docs/runs/production-profile-self/run.mjs --record-authorization \
  --attempt-id "$ATTEMPT_ID" \
  --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
git add "$ATTEMPT_DIR/governance/controller-approval.json" \
  "$ATTEMPT_DIR/governance/self-authorization.json" \
  "$ATTEMPT_DIR/governance/review-packets.snapshot.json" \
  docs/runs/production-profile-self/publication-attempts.jsonl
git diff --cached --check
git commit -m "docs(telos): authorize TELOS production self-hosting run"
git status --short
```

Expected: the checkout is clean and the authorization binds already committed harness, dossier,
keyring, and plan bytes. The authorization itself is not execution evidence.

- [ ] **Step 10: Publish from the clean authorized commit**

Require `git status --porcelain` empty and verify the current commit contains the exact authorization
refs. Publication uses this exact closed CLI:

```bash
GOVERNANCE_DISPOSABLE=0
cleanup_self_keys() {
  rm -f -- "$CONTROLLER_PRIVATE_KEY" "$PROCESS_PRIVATE_KEY"
  if [ "$GOVERNANCE_DISPOSABLE" -eq 1 ]; then
    rm -f -- "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
  fi
}
trap cleanup_self_keys EXIT
trap 'exit 1' HUP INT TERM
ATTEMPT_ID="$(node docs/runs/production-profile-self/run.mjs --print-current-attempt-id)"
ATTEMPT_DIR="docs/runs/production-profile-self/attempts/$ATTEMPT_ID"
set +e
node docs/runs/production-profile-self/run.mjs --publish \
  --attempt-id "$ATTEMPT_ID" \
  --controller-private-key "$CONTROLLER_PRIVATE_KEY" \
  --process-private-key "$PROCESS_PRIVATE_KEY" \
  --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
publish_status=$?
set -e
if [ "$publish_status" -ne 0 ]; then
  set +e
  node docs/runs/production-profile-self/run.mjs --recover-publication \
    --attempt-id "$ATTEMPT_ID" \
    --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
  recovery_status=$?
  set -e
  if [ "$recovery_status" -eq 0 ]; then
    publish_status=0
  elif [ "$recovery_status" -eq 2 ]; then
    if [ "$publish_status" -eq 2 ]; then
      reason=PUBLICATION_BLOCKED
    else
      reason=PUBLICATION_CANNOT_RUN
    fi
    node docs/runs/production-profile-self/run.mjs --supersede-attempt \
      --attempt-id "$ATTEMPT_ID" \
      --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY" \
      --reason-code "$reason"
    git add docs/runs/production-profile-self/publication-attempts.jsonl
    git diff --cached --check
    git commit -m "docs(telos): supersede failed TELOS self-publication $ATTEMPT_ID"
    GOVERNANCE_DISPOSABLE=1
    cleanup_self_keys
    unset CONTROLLER_PRIVATE_KEY PROCESS_PRIVATE_KEY ATTEMPT_GOVERNANCE_PRIVATE_KEY
    trap - EXIT HUP INT TERM
    exit "$publish_status"
  else
    HOLD_PATH="docs/runs/production-profile-self/forensic-holds/$ATTEMPT_ID.json"
    node docs/runs/production-profile-self/run.mjs --record-forensic-hold \
      --attempt-id "$ATTEMPT_ID" \
      --attempt-governance-private-key "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
    git add "$HOLD_PATH"
    git diff --cached --check
    git commit -m "docs(telos): record forensic hold for $ATTEMPT_ID"
    cleanup_self_keys
    unset CONTROLLER_PRIVATE_KEY PROCESS_PRIVATE_KEY
    chmod 600 "$ATTEMPT_GOVERNANCE_PRIVATE_KEY"
    trap - EXIT HUP INT TERM
    echo "FORENSIC_HOLD: attempt-governance key retained outside repository for The Eye disposition" >&2
    exit 1
  fi
fi
GOVERNANCE_DISPOSABLE=1
cleanup_self_keys
unset CONTROLLER_PRIVATE_KEY PROCESS_PRIVATE_KEY ATTEMPT_GOVERNANCE_PRIVATE_KEY
trap - EXIT HUP INT TERM
```

`--publish` exits `0` only after the immutable directory and signed `PUBLISHED` commit marker are both
durable and re-verified. On controlled exit `1`/`2` it leaves no trusted marker; any pending/unmarked
candidate is ignored and preserved or removed only under the closed recovery protocol. The wrapper
first runs recovery: exit `0` resumes the successful evidence path, exit `2` appends an independent
signed `SUPERSEDED` event and stops, and exit `1` writes/commits the signed forensic hold before a hard
stop with no supersession. Every
normal success/supersession branch removes all external private keys. On forensic exit `1`, it removes
the controller/process keys immediately but retains the distinct governance key, owner-only and
outside the repository, solely so The Eye can authenticate a later terminal forensic disposition
through a separate TELOS change-protocol action. That retained key cannot be passed to `--publish`,
`--prepare-plan`, `--record-authorization`, `--recover-publication`, or `--supersede-attempt`; the
durable hold enforces this after restart. After the signed terminal disposition is committed, the key
is securely removed. The abort/`EXIT`/signal default before a hold can be recorded preserves the same
recovery capability: execution keys are deleted,
but `GOVERNANCE_DISPOSABLE` remains false until a durable `PUBLISHED` or `SUPERSEDED` marker exists, so
an interruption cannot erase the only authenticated recovery capability. If a controller/process key is already lost or known exposed, skip
`--publish`, run the direct Step 8 supersession command with the truthful key reason, remove remaining
keys, commit only the supersession line, and stop. Require that no tracked harness, dossier, plan,
approval, authorization, review packet, or public keyring byte changed.

The only generated paths are:

```text
docs/runs/production-profile-self/publication-attempts.jsonl
$ATTEMPT_DIR/publication/verified-summary.json
$ATTEMPT_DIR/publication/evidence-manifest.json
$ATTEMPT_DIR/publication/proposal-ledger.snapshot.jsonl
$ATTEMPT_DIR/publication/settlement-ledger.snapshot.jsonl
$ATTEMPT_DIR/publication/proposal-artifacts.snapshot.json
$ATTEMPT_DIR/publication/process-records/<exact IDs enumerated by plan.snapshot.json>
```

`evidence-manifest.json` must list every generated process-record path/hash explicitly and bind the
exact frontier artifact/ref embedded in `proposal-artifacts.snapshot.json`. The dirty path allowlist is
derived from that committed attempt plan plus the five fixed outputs and one append-only attempt-ledger
line—not from directory presence or a glob.

- [ ] **Step 11: Re-verify candidate public evidence before commit**

Run:

```bash
node docs/runs/production-profile-self/run.mjs --verify-committed
node docs/runs/production-profile-demo/run.mjs --verify-committed
npm --prefix build-gate test
npm --prefix merkle-dag test
git diff --check
git status --short
```

Expected: all self/demo/package checks pass; exactly the Step 10 generated outputs are dirty; no
`.telos/`, active forensic hold, `publication.pending`, publication lock/temp ledger, PEM marker,
private JWK field, external key, or unenumerated process record remains. The attempt-ledger diff is exactly one appended
`PUBLISHED` line and its committed prefix is unchanged.

- [ ] **Step 12: Commit only generated public execution evidence**

```bash
ATTEMPT_ID="$(node docs/runs/production-profile-self/run.mjs --print-current-attempt-id)"
ATTEMPT_DIR="docs/runs/production-profile-self/attempts/$ATTEMPT_ID"
git add docs/runs/production-profile-self/publication-attempts.jsonl \
  "$ATTEMPT_DIR/publication/verified-summary.json" \
  "$ATTEMPT_DIR/publication/evidence-manifest.json" \
  "$ATTEMPT_DIR/publication/proposal-ledger.snapshot.jsonl" \
  "$ATTEMPT_DIR/publication/settlement-ledger.snapshot.jsonl" \
  "$ATTEMPT_DIR/publication/proposal-artifacts.snapshot.json" \
  "$ATTEMPT_DIR/publication/process-records"
git diff --cached --check
git commit -m "test(production-profile): publish TELOS self-hosting proof"
```

The staged set must equal the exact generated-output allowlist; any other path blocks. Do not add or
modify `build-gate/examples/self/`.

- [ ] **Step 13: Verify the committed proof and clean checkout**

Run:

```bash
node docs/runs/production-profile-self/run.mjs --verify-committed
node docs/runs/production-profile-demo/run.mjs --verify-committed
npm --prefix build-gate test
npm --prefix merkle-dag test
git diff --check
git status --short
```

Expected: all pass and the tracked checkout is clean before the mandatory Argo ledger closure. The
root README still cannot claim dogfood until Task 13 documents this committed result.

---

### Task 13: Publish reference docs, CI, institutional contracts, weave, review, and enrollment

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-13.json`
- Create: `build-gate/production-profile/README.md`
- Create: `docs/production-profile.md`
- Modify: `build-gate/README.md`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`
- Create: `build-gate/scripts/test-production-import-policy.mjs`
- Create: `build-gate/scripts/test-production-fresh-host.mjs`
- Modify: `build-gate/package.json`
- Create: `docs/institutional-memory/telos/CONTRACTS/production-profile.json`
- Modify: `docs/institutional-memory/telos/INVARIANTS.json`
- Modify: `docs/institutional-memory/telos/INVARIANTS.md`
- Modify: `docs/institutional-memory/telos/NON-CLAIMS.json`
- Modify: `docs/institutional-memory/telos/NON-CLAIMS.md`
- Modify: `docs/institutional-memory/telos/comprehension-queries.json`
- Modify: `docs/institutional-memory/examples/reader-telos-correct.json`
- Modify: `docs/institutional-memory/examples/reader-telos-hallucinating.json`
- Create: `docs/institutional-memory/test-production-profile-contract.mjs`
- Modify: `docs/institutional-memory/verify-contracts.mjs`
- Create: `docs/institutional-memory/iliad/MODEL-REVIEWS/2026-07-20-production-profile-compiler-1.json`
- Create: `docs/institutional-memory/iliad/RETROSPECTIVES/production-profile-compiler-1.json`
- Modify: `docs/institutional-memory/iliad/CONTRACTS/enrollment.json`
- Modify publication outputs: `docs/runs/clotho-self-weave/expected-match-report.json`
- Modify publication outputs: `docs/runs/clotho-self-weave/review-set.json`
- Modify publication outputs: `docs/runs/clotho-self-weave/summary.json`
- Modify publication outputs: `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl`
- Modify publication outputs: `docs/runs/clotho-self-weave/verification.json`

**Interfaces:**
- Documents the exact host contract, 31 obligations, eight checks, evidence tiers, failure codes, scalability, portability, and non-claims.
- CI runs package, bank-demo, self-hosting, import audit, portability, institutional verification, and clean-checkout checks on Node 18/20.
- Institutional verification re-derives contract values from code and committed evidence.
- Enrolls this as a build-gate spine extension maintained under existing `docs/institutional-memory/telos/`; creates no new mythological role, package root, or repository-manifest component.

- [ ] **Step 1: Create the authorized documentation/lifecycle loadout**

Record reference-documentation, Clotho full-history, live Iliad review-seat, CI, and repository-write
capabilities. Missing required post-review provenance or full-history weave capability blocks
enrollment.

- [ ] **Step 2: Write reference documentation from executable contracts**

Document:

- why production systems controls are required before model planning;
- exact activation and controller jurisdiction;
- complete profile/evidence schema and CLI;
- scanner limits and signal-resolution workflow;
- exact 31-ID catalog and eight-kind registry;
- runtime, structural, and process proof boundaries;
- V2 source/obligation/certificate/lifecycle identities;
- durable restart and final drift behavior;
- two-minute bank demo and TELOS `--verify-committed` commands;
- fresh-host setup with no TELOS authority files;
- scalability bounds and future policy-pack seam;
- explicit non-claims from the design.

Root README may say TELOS is dogfooded only after Task 12 committed verification passes. It must not say
certified, compliant, secure in all cases, or operationally proven.

- [ ] **Step 3: Add the binding CI matrix**

First create and register two zero-dependency executable proofs:

- `test-production-import-policy.mjs` tokenizes JavaScript source rather than stripping comments with a
  regex. It recognizes static imports/exports, literal dynamic imports, and `require()` calls; rejects
  nonliteral dynamic loading in the audited scope; decodes escapes before classifying a specifier; walks
  relative imports transitively; rejects symlink/realpath escape; and accepts only `node:` or
  repository-relative targets. Its seed inventory is mechanically derived from every exact `.mjs`,
  `.js`, and `.cjs` path in a `Create:` or `Modify:` row of the committed matured plan, unioned with
  recursive executable-file walks below `build-gate/production-profile/`,
  `docs/runs/production-profile-demo/`, and `docs/runs/production-profile-self/`. It fails if a
  plan-named path is absent, duplicated, outside the repository, or omitted from the audit report.
  This explicitly includes `merkle-dag/scripts/test-execution-identity.mjs`,
  `docs/institutional-memory/test-production-profile-contract.mjs`, and the import-policy script
  itself; there is no hand-maintained subset. Mutation fixtures cover imports hidden in
  comments/strings/templates, escaped `../`, dynamic expressions, `.js`/`.cjs`, and a relative module
  whose transitive import is forbidden.
- `test-production-fresh-host.mjs` creates a temporary repository with a neutral name, copies only the
  candidate `build-gate` and `merkle-dag` runtime, writes a minimal dossier and host-owned adapters,
  proves deterministic compile/verify, then removes an activated adapter and requires the exact typed
  blocker. It asserts the temporary root has no `CURRENT-AUTHORITY.json`, `docs/institutional-memory/`,
  TELOS dossier, or source-repository fallback path.

Add both to `build-gate/package.json` `check`/`test`. In `.github/workflows/ci.yml`, keep package tests
on both Node 18 and 20 and add a `production-profile-proof` matrix job whose every matrix leg runs:

```bash
node build-gate/scripts/test-production-import-policy.mjs
node build-gate/scripts/test-production-fresh-host.mjs
node docs/runs/production-profile-demo/run.mjs --verify-committed
node docs/runs/production-profile-self/run.mjs --verify-committed
node .github/scripts/check-portable-paths.mjs
node docs/institutional-memory/verify-contracts.mjs
node docs/institutional-memory/test-comprehension-gate.mjs
node docs/runs/clotho-self-weave/run.mjs --verify-committed
git diff --check
test -z "$(git status --porcelain)"
```

Use matrix `node-version: [18, 20]`, include the new job in `required-ci`, and use full fetch history
only where self/weave verification requires it. No CI secret is needed because verification consumes
public committed evidence; publication is not a CI action. A Node-20-only portability or institutional
job may remain as redundant coverage but cannot satisfy the binding matrix claim.

- [ ] **Step 4: Write expected institutional records and failing oracle assertions first**

`production-profile.json` records exact source paths, contract refs, activation, controller authority,
V2 identities, final-drift block, self-hosting proof, and non-claims.

Add invariants for:

- model cannot lower applicability;
- exact production source/obligation reconciliation;
- pre-model durable input;
- V2 certificate required;
- post-build drift blocks;
- no TELOS self-exemption.

Add the comprehension questions, but do not update either reader fixture yet. Create
`test-production-profile-contract.mjs` first; it spawns the global verifier and requires a closed list of
new named checks for exact IDs/kinds, V1/V2 goldens, import policy, demo/self replay, enrollment
prerequisites, and no new package/component. It fails when a named check is absent even if the old
global verifier exits zero. Do not implement those new branches in `verify-contracts.mjs` yet.

- [ ] **Step 5: Run institutional red tests before updating expected records**

Run:

```bash
node docs/institutional-memory/test-production-profile-contract.mjs
node docs/institutional-memory/verify-contracts.mjs
node docs/institutional-memory/test-comprehension-gate.mjs
```

Expected: the dedicated contract test fails because the named production oracle checks are absent, and
the comprehension regression fails because both reader fixtures lack the new answers. The old global
verifier may still exit zero at this red point; that cannot be mistaken for green because the dedicated
meta-oracle must fail.

- [ ] **Step 6: Implement the oracle, update both fixtures, and run green tests**

Now update `verify-contracts.mjs` and both reader fixtures. The oracle must re-derive values from live
modules and committed snapshots rather than match truthy strings or prose, and must prove:

- exact 31 IDs and eight kinds;
- V1/V2 contract goldens;
- production files exist and use only allowed imports;
- demo/self committed verification succeeds, including exact attempt-ledger signatures/transitions,
  immutable superseded refs, no active forensic hold, and one uniquely published self attempt;
- existing enrollment entries remain valid, and the oracle has a closed branch that will require this
  candidate's evidence/pre-review/post-review/retrospective paths once its entry is appended;
- no package root/new component was added for this spine extension.

Run:

```bash
node build-gate/scripts/test-production-import-policy.mjs
node build-gate/scripts/test-production-fresh-host.mjs
node docs/institutional-memory/test-production-profile-contract.mjs
node docs/institutional-memory/verify-contracts.mjs
node docs/institutional-memory/test-comprehension-gate.mjs
```

Expected: all contracts and comprehension fixtures pass.

- [ ] **Step 7: Commit reference documentation and TELOS contract records**

Do not create the post-review, retrospective, or enrollment entry yet.

```bash
git add build-gate/production-profile/README.md build-gate/README.md \
  docs/production-profile.md README.md .github/workflows/ci.yml \
  build-gate/scripts/test-production-import-policy.mjs \
  build-gate/scripts/test-production-fresh-host.mjs build-gate/package.json \
  docs/institutional-memory/telos/CONTRACTS/production-profile.json \
  docs/institutional-memory/telos/INVARIANTS.json \
  docs/institutional-memory/telos/INVARIANTS.md \
  docs/institutional-memory/telos/NON-CLAIMS.json \
  docs/institutional-memory/telos/NON-CLAIMS.md \
  docs/institutional-memory/telos/comprehension-queries.json \
  docs/institutional-memory/examples/reader-telos-correct.json \
  docs/institutional-memory/examples/reader-telos-hallucinating.json \
  docs/institutional-memory/test-production-profile-contract.mjs \
  docs/institutional-memory/verify-contracts.mjs \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-13.json
git commit -m "docs(production-profile): publish reference contracts"
```

- [ ] **Step 8: Publish and commit the pre-review Clotho weave**

From that clean documentation commit, with full Git history and no dirty bypass:

```bash
node docs/runs/clotho-self-weave/run.mjs
node docs/runs/clotho-self-weave/run.mjs --verify-committed
git add docs/runs/clotho-self-weave/expected-match-report.json \
  docs/runs/clotho-self-weave/review-set.json \
  docs/runs/clotho-self-weave/summary.json \
  docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl \
  docs/runs/clotho-self-weave/verification.json
git commit -m "docs(clotho): weave production profile implementation"
```

Record this exact weave commit/ref in the later Iliad post-review. This satisfies the required ordering:
reference documentation, then Clotho, then post-review.

- [ ] **Step 9: Conduct the post-implementation Iliad review**

Call every required/advisory seat available under the loadout against the exact implementation commit,
design, matured authorized plan, demo, self-hosting evidence, committed Clotho weave, and test outputs.
Record actual provider/model/response IDs; never substitute configured aliases. Preserve dissent and
unavailable advisory seats honestly.

The review record includes:

- exact reviewed commit/tree;
- spec acceptance matrix;
- findings with controller-computed identities;
- dispositions and residual risk;
- explicit recommendation for submission, never self-authorization.

Any unresolved Critical/Important finding returns to the authorized revision path before enrollment.

- [ ] **Step 10: Write retrospective and enrollment**

The retrospective records actual stage provenance, defects found, why they escaped, test evidence, and
at least one feed-forward optimization with an exact landing file.

Append one delivered enrollment:

- name `deterministic-production-profile-compiler`;
- kind `build-gate trust-spine extension`;
- evidence path derived from the unique signed `PUBLISHED` entry in
  `docs/runs/production-profile-self/publication-attempts.jsonl`, resolving to that immutable
  attempt's exact
  `docs/runs/production-profile-self/attempts/attempt-NNN/publication/verified-summary.json`;
- memory directory only `docs/institutional-memory/telos/`;
- pre-review, post-review, and retrospective paths;
- `post_protocol: true`;
- maintained by build-gate tests, production proof CI, institutional oracle, and Clotho.

Do not add a package root, top-level component, new mythology term, or remove any deferred product.

- [ ] **Step 11: Verify and commit post-review, retrospective, and enrollment**

```bash
node docs/institutional-memory/verify-contracts.mjs
node docs/institutional-memory/test-comprehension-gate.mjs
git add \
  docs/institutional-memory/iliad/MODEL-REVIEWS/2026-07-20-production-profile-compiler-1.json \
  docs/institutional-memory/iliad/RETROSPECTIVES/production-profile-compiler-1.json \
  docs/institutional-memory/iliad/CONTRACTS/enrollment.json
git commit -m "docs(iliad): enroll production profile delivery"
```

- [ ] **Step 12: Refresh Clotho so committed verification covers lifecycle records**

The pre-review weave already established lifecycle ordering. Re-publish from the clean enrollment commit
so CI's committed self-weave also covers the post-review, retrospective, and enrollment bytes:

```bash
node docs/runs/clotho-self-weave/run.mjs
node docs/runs/clotho-self-weave/run.mjs --verify-committed
git add docs/runs/clotho-self-weave/expected-match-report.json \
  docs/runs/clotho-self-weave/review-set.json \
  docs/runs/clotho-self-weave/summary.json \
  docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl \
  docs/runs/clotho-self-weave/verification.json
git commit -m "docs(clotho): refresh enrolled production profile weave"
```

- [ ] **Step 13: Re-run documentation and institutional verification**

Run:

```bash
node docs/institutional-memory/verify-contracts.mjs
node docs/runs/clotho-self-weave/run.mjs --verify-committed
node docs/runs/production-profile-self/run.mjs --verify-committed
node docs/runs/production-profile-demo/run.mjs --verify-committed
git diff --check
git status --short
```

Expected: all pass and the worktree is clean.

---

### Task 14: Run final whole-branch acceptance from committed bytes

**Files:**
- Create: `docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-14.json`
- Create: `docs/runs/production-profile-compiler-1/acceptance.json`
- Modify only if a verified defect is found: files owned by the task that introduced the defect

**Interfaces:**
- Produces a machine-readable acceptance matrix over every design section and `PPC-A01` through `PPC-A21`.
- Requires independent whole-branch review and binding Node 18/20 CI.
- Does not authorize merge; it records evidence for The Eye's final integration decision.

- [ ] **Step 1: Create the final verification loadout**

Record clean checkout, full Git history, Node 18 and 20 runners, actual review seats, GitHub CI access,
and no external provider requirement for deterministic tests. If either binding Node version or required
review capability is unavailable, record the block and do not claim acceptance.

- [ ] **Step 2: Run syntax, import, dependency, and portability audits**

Run:

```bash
npm --prefix build-gate run check
npm --prefix merkle-dag run check
node build-gate/scripts/test-production-import-policy.mjs
node .github/scripts/check-portable-paths.mjs
```

The named import-policy script owns the zero-dependency audit over the complete plan-derived
`Create:`/`Modify:` executable set, the three recursive production/proof directories, and every
transitively reached repository-relative module. It rejects any static/dynamic import or `require()`
target that is not `node:` or repository-relative, and rejects JSON import assertions,
`import.meta.dirname`, `fs.glob`, global `fetch`, shell execution, and `localeCompare`. Its report must
prove exact seed-set equality with the matured plan-derived inventory, so a new executable cannot be
silently omitted. Its own mutation corpus must pass; a prose/manual grep is not acceptance evidence.

Verify no dependency or lockfile was added to `build-gate`/`merkle-dag`.

- [ ] **Step 3: Run every package and production proof locally**

Run:

```bash
npm --prefix merkle-dag test
npm --prefix build-gate test
npm --prefix ai-forge test
npm --prefix saas-forge test
node build-gate/scripts/test-production-import-policy.mjs
node build-gate/scripts/test-production-fresh-host.mjs
node docs/runs/production-profile-demo/run.mjs --verify-committed
node docs/runs/production-profile-self/run.mjs --verify-committed
node docs/institutional-memory/test-production-profile-contract.mjs
node docs/institutional-memory/verify-contracts.mjs
node docs/institutional-memory/test-comprehension-gate.mjs
node docs/runs/clotho-self-weave/run.mjs --verify-committed
```

If the local shell exposes a Windows `npm` shim under WSL, direct `node` invocations are useful
diagnostics but do not replace package scripts. Use a native Node/npm environment or CI for binding
results.

- [ ] **Step 4: Run adversarial acceptance cases**

Re-run explicit negative fixtures for:

- every profile/schema/cross-field branch;
- unresolved/stale scanner signals, unsafe path, limit, race, malformed input;
- all 31 trigger transitions;
- all eight pass/fail/cannot-run check kinds;
- stale implementation/policy/registry/evidence/input/profile refs;
- duplicate/missing/extra/cross-bound source or obligation;
- V1/V2 downgrade and `n/a` attempts;
- pre-model call bypass;
- child-process restart mismatch;
- post-build fact drift;
- unsafe bank egress and profile escalation;
- four TELOS self-bypass controls;
- fresh host with no `CURRENT-AUTHORITY.json`, institutional-memory records, TELOS docs, or repository
  name, using only the candidate `build-gate`/`merkle-dag` runtime, dossier, and host evidence adapters.

Run `node build-gate/scripts/test-production-fresh-host.mjs` as the owning fresh-host oracle. It must
scaffold its own `.telos/` state and must not read TELOS authority files.

- [ ] **Step 5: Review the complete branch adversarially**

Use an independent whole-branch reviewer against:

- approved design and matured authorized plan;
- full diff from the plan baseline;
- canonical Iliad pre-review, Daedalus workshop, TELOS authorization, Argo entry/step ledger,
  reference-documentation commit, both Clotho weave commits, Iliad post-review, retrospective, and
  enrollment records;
- package/demo/self/CI evidence;
- every public claim and non-claim;
- legacy byte-identity goldens;
- activated-consumer inventory;
- no privileged self path;
- tracked-clean behavior.

Classify findings Critical/Important/Minor with exact file:line references. Fix any Critical/Important and
rerun the owning task plus the complete battery. Minor findings require an explicit fix-before-merge or
accepted-with-reason ruling.

A finding that changes code, contracts, policy, registry, dossier, or evidence cannot be patched as an
isolated Task 14 commit. Return to the earliest affected authorized slice, append the revision to the
Argo step ledger, and regenerate every downstream hash-bound artifact: demo/self authorization and
publication where affected, reference docs, both Clotho stages, Iliad post-review, retrospective,
enrollment, and CI. Preserve superseded records rather than rewriting them. Documentation-only changes
still refresh any weave/review/acceptance identity that covered the old bytes.

- [ ] **Step 6: Verify binding Node 18/20 CI**

Push the reviewed commit through the repository's protected PR workflow. Require every `required-ci`
dependency, including the new production-profile proof, to pass on both Node 18 and 20. Record exact run
URLs, commit SHA, job names, and conclusions. Infrastructure-only failure is not a pass; rerun or wait
for a binding result.

- [ ] **Step 7: Write the acceptance artifact**

`acceptance.json` contains:

- exact design, matured plan, authorization, implementation commit, and tree refs;
- `PPC-A01` through `PPC-A21`, each with status and exact evidence refs;
- local Node version marked supplementary;
- Node 18/20 CI run URLs and job conclusions;
- package/demo/self/institutional/weave results;
- independent review findings/dispositions;
- import/dependency/portability/clean-checkout results;
- exact legacy/V2 goldens;
- explicit non-claims;
- final `READY_FOR_EYE_INTEGRATION` or blocking status.

The artifact may summarize existing evidence; it cannot turn a failed test or missing capability into
pass.

Use this minimum owning-evidence map; each row still records exact command, artifact, and commit refs:

| Criterion | Minimum owning evidence |
|---|---|
| `PPC-A01` | Task 8 zero-model-call activation matrix |
| `PPC-A02` | repeated compiler golden plus binding Node 18/20 CI |
| `PPC-A03` | Task 3/11 exact 31-rule, eleven-domain fixture matrix |
| `PPC-A04` | Task 4 version-2 source golden and Task 9 reconciliation |
| `PPC-A05` | Task 4/6 legacy obligation, plan, contract, and executable goldens |
| `PPC-A06` | Task 9 duplicate/missing/extra/cross-bound exact-set negatives |
| `PPC-A07` | Task 4 lifecycle hash tests and Task 9 reconstructed plan |
| `PPC-A08` | local projection mutation tests plus global authorization invalidation |
| `PPC-A09` | registry implementation/env binding, proposal boundary, and no-op negatives |
| `PPC-A10` | Task 10 post-build reclassification drift cases |
| `PPC-A11` | per-tier result labels, reports, reference docs, and non-claims |
| `PPC-A12` | missing adapter and unsupported structural/process format blockers |
| `PPC-A13` | Task 11 unsafe/corrected/escalated synthetic bank sequence |
| `PPC-A14` | zero-dependency import audit over every new script/module |
| `PPC-A15` | complete package/demo/institutional battery and clean-checkout assertion |
| `PPC-A16` | fresh-host fixture with no TELOS authority or institutional files |
| `PPC-A17` | Task 13 root README problem/demo/evidence/non-certification sections |
| `PPC-A18` | commit-anchored Iliad, Daedalus, authorization, Argo, docs, weave, and retrospective records |
| `PPC-A19` | Task 12 exact approved dossier, V2 proposal restart, checks, settlement, and `done()` |
| `PPC-A20` | Task 12 four no-self-bypass negative controls |
| `PPC-A21` | read-only committed self verification, signed immutable attempt/supersession/forensic-hold discipline, no-live-data audit, clean tree, and publication ordering |

- [ ] **Step 8: Verify the acceptance artifact and clean tree**

Run:

```bash
node -e 'const fs=require("node:fs"); const p="docs/runs/production-profile-compiler-1/acceptance.json"; const x=JSON.parse(fs.readFileSync(p,"utf8")); if(x.status!=="READY_FOR_EYE_INTEGRATION") process.exit(2)'
git diff --check
git status --short
```

Expected before commit: only `acceptance.json` is untracked because Step 1 already committed the Task 14
loadout. After commit: clean tree.

- [ ] **Step 9: Commit final acceptance evidence**

```bash
git add docs/runs/production-profile-compiler-1/acceptance.json \
  docs/institutional-memory/loadout/TASK-LOADOUTS/task-production-profile-14.json
git commit -m "docs(production-profile): record final acceptance evidence"
```

- [ ] **Step 10: Require protected CI on the final evidence commit**

The acceptance artifact binds the reviewed implementation commit and the first binding CI run. After
committing the documentation-only acceptance record, require protected `required CI` to pass again on
that final branch commit. Record the final commit/run URL in the handoff; do not rewrite the artifact and
create an evidence/CI commit loop.

- [ ] **Step 11: Hand off to The Eye**

Report the exact final commit, CI runs, reviewer verdict, and residual non-claims. Do not merge, tag,
publish a release, or alter `CURRENT-AUTHORITY.json` unless The Eye explicitly directs that separate
integration action.
