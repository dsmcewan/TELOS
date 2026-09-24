---
title: "TELOS — repository code trace"
type: reference
tags:
  - topic/architecture
  - workflow/build-gate
---

# TELOS — repository code trace

A maintainer's trace of how the code actually fits together: which module calls which, where
disk is read, where signatures are checked, and where the closed sets live. Every claim below was
read from source on the commit this document was added in; `file:line` references point at that
revision. `repository-manifest.json` remains the machine map and wins on classification; this
document is the *call-path* companion to it.

Verified on the tracing commit (Node 22.22.2):

| Check | Result |
|---|---|
| `cd build-gate && npm test` (runs `breakout` too) | green |
| `cd merkle-dag && npm test` | green |
| `node docs/runs/fail-closed-demo/run.mjs` | `BLOCKED` / `HALTED` / `VERIFIED`, `ok:true` |
| `node docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs` | failed on the tracing commit (F1); `ACCEPTANCE OK` after the fix in this PR, keyless and with operator secrets |
| `node docs/runs/proposal-lifecycle/run-proposal-lifecycle.mjs` | `ACCEPTANCE OK` |
| `node docs/runs/agentic-teams-situational/run-teams-situational.mjs` | blocked at approval on the tracing commit (F1b); `merge_status=ready` after the fix in this PR, keyless and with operator secrets |
| `node docs/institutional-memory/verify-contracts.mjs` | 313/313 contracts match |
| `node docs/runs/clotho-self-weave/run.mjs --verify-committed` | `ok:true`, 4559 trusted records (needs full history) |

## 1. Package topology

Eleven zero-dependency ESM packages, one React/TypeScript product, and a package-less `workflows/`
directory. Cross-package `import` edges, derived by scanning every `.mjs`/`.js` file for relative
import specifiers (the same scan `clotho` does with a string-aware lexer; the regex scan used here
over-counts fixture paths inside test string literals, see §8):

```
                         ┌───────────────────────────────┐
                         │          merkle-dag/          │  vendor · crypto · merkle · artifact
                         │  (no imports from any package)│  planner · orchestrate · ledger-gate
                         └──────────────┬────────────────┘  obligation · proposal-ledger
                                        │
             ┌──────────────────────────┼───────────────────────────┐
             ▼                          ▼                           ▼
   ┌──────────────────┐       ┌──────────────────┐        ┌──────────────────┐
   │    breakout/     │◄──────│   build-gate/    │        │ lachesis/ atropos│
   │ verifier · seat_ │       │ gate · sign ·    │        │ (vendor.mjs only)│
   │ router · mcp_cli │       │ council · …      │        └────────┬─────────┘
   └────────┬─────────┘       └────────┬─────────┘                 │
            │                          │                           ▼
            │   ┌──────────────────────┘             narcissus/flagship/scripts/
            ▼   ▼                                    build-live-graph.mjs
   ┌──────────────────┐   ┌──────────────────┐
   │      forge/      │◄──│ saas-forge/      │   forge/ imports breakout + merkle-dag,
   │ operator·ratchet │◄──│ ai-forge/        │   never build-gate. saas-/ai-forge import
   │ manifest·driver  │   │ (gate+sign+council)│ build-gate/{gate,sign,council,seat-registry}
   └────────┬─────────┘   └──────────────────┘
            ▼
         demo/  (forge/operator.mjs only)

   connectors/ai-peer-mcp/   — imported by NO package at runtime; reached only over MCP stdio
   clotho/                   — imports nothing from the spine; consumed as DATA by lachesis
   ai-native-memory/         — fully standalone plugin
```

Direction of trust: `merkle-dag` is the leaf every enforcement module depends on. `build-gate`
imports `breakout/verifier.mjs` (`gate.mjs:6`) and fourteen `merkle-dag` modules; `breakout` imports
nothing from `build-gate`. The products (`forge`, `saas-forge`, `ai-forge`) sit *above* the gate and
call `validateRecords` — the gate never imports a product.

Most-imported modules by static fan-in (excluding test fixtures): `merkle-dag/vendor.mjs` (30),
`merkle-dag/crypto.mjs` (28), `merkle-dag/merkle.mjs` (24), `build-gate/teams.mjs` (13),
`merkle-dag/proposal-ledger.mjs` (13), `build-gate/gate.mjs` (12), `breakout/verifier.mjs` (11).

`docs/runs/**/*.mjs` (agentic-teams, crossroad-*, proposal-lifecycle, telos-self-audit, …) are
runnable evidence scripts that import the packages directly; they are consumers, never dependencies.

## 2. Trust spine — a gate decision, end to end

### 2.1 Entry points

| Symbol | Where | Role |
|---|---|---|
| `main()` | `build-gate/gate.mjs:36` | CLI. Exit 0 pass, 3 advisory-unsigned, 1 blocked, 2 usage/error (`:61-63`) |
| `validateGate(dossierPath, packetDir, opts)` | `gate.mjs:93` | Reads dossier + `*.json` packets (+ optional `--capabilities`, `--market-readiness` dirs) from disk, then calls `validateRecords` |
| `validateRecords(dossier, packets, source, capPackets, marketPackets, proposal)` | `gate.mjs:107` | The pure decision function. Everything below is inside it |
| `DEFAULT_PROTECTED_PATHS` | `gate.mjs:23` | Write-target denylist |

### 2.2 Order of checks inside `validateRecords`

1. **Dossier shape** (`:111`, `validateDossierShape :556`).
2. **trust_mode** (`:118-125`). `advisory = dossier.trust_mode === "advisory"`; `signed = !advisory`.
   Absent, `"signed"`, and *any unrecognised value* all enforce HMAC + provenance. This is the
   fail-closed default landed in commit `c8f4ebf`. Advisory mode prepends a loud warning and can
   never produce `pass`.
3. **Per-packet shape, `build_id`, `use_case`** (`:130-137`). Duplicate packets for one model only
   warn; the first in `readdir` order wins (`:139-140`).
4. **Required seats** `REQUIRED_MODELS = ["claude","agy","codex"]` (`:12`): present, `decision ===
   "approve"`, no `required_edits`, no `hard_stops` (`:147-168`).
5. **HMAC** (signed mode, `:178-194`): `secretFor(model)` → `verifyPacket`. Only verified packets
   count as evidence from here on (`:195`).
6. **Provenance** (`:205-238`): must exist, `response_id` must not match
   `/^$|_self$|^self$|placeholder/i`, and the `provider:response_id` key must be unique across
   seats. Each blocks in signed mode.
7. **`required_docs`** must be reviewed by a trusted packet (`:240-249`).
8. **Protected paths** (`:251`), **LEXI** (`:252`), **Grok** advisory resolution (`:253`),
   **capability** packets (`:254`), **market-readiness** packets (`:255`) — the latter calls
   `validateBreakoutRecord`, which calls `reverifyRecord` from `breakout/verifier.mjs` (`:447`).
9. **Proposal lifecycle** (`:256-266`): only when `dossier.proposal_lifecycle === true` **and**
   `source.telosDir` is set. See §3 and finding F1.
10. **Status** (`:287-290`): `blocked` if any blocker, else `advisory-unsigned` or `pass`.
    `certified` is true only for `pass`. `safe_next_action` ∈ {`begin-build`,
    `advisory-only-NOT-certified-do-not-merge`, `resolve-blockers-before-build`} (`:297-300`).

### 2.3 Signing (`build-gate/sign.mjs`, 69 lines)

- Key: `process.env["TELOS_SECRET_" + model.toUpperCase()]` (`:50`). One static secret per seat,
  no key id, no rotation.
- Canonical form (`:10-28`): drop top-level `signature`, recursively sort object keys (arrays keep
  order), `JSON.stringify`.
- `signPacket` (`:30`): HMAC-SHA256 hex, stored as
  `signature: { alg, value, signed_fields: "canonical-minus-signature" }`.
- `verifyPacket` (`:35-46`) rejects, in order: not an object → missing signature → unsupported alg
  → no secret → length mismatch → `timingSafeEqual` mismatch.
- `signMarketPacket` (`:59`): re-attributes `model` to the signer, keeps the lens as
  `reviewed_by_lens`, sets `provenance.response_id = "market-" + sha256(canonical)`.
- Stated residual (`:3-6`): one owner holds every secret and can forge everything; the threat model
  is honest-but-careless, not adversarial-insider.

### 2.4 Council (`build-gate/council.mjs`, 252 lines)

- `planSeats` (`:42-54`): claude, agy, codex as approvers; grok and gemini advisory; plus one
  `claude` market-lens seat per workstream when `market_bound`.
- `runCouncil` (`:92`): worker pool of `min(requested, cores-2)` (`maxConcurrency :31`). Each seat
  runs through `runSeat` (`:60`) → injected `callSeat` → stamps
  `provenance = out.provenance || out.packet.provenance` (`:67`) → signs with `secretFor(model)` if a
  secret exists, else returns `{ ok:true, signed:false }` (`:79-81`). **The council never writes
  packets to disk**; callers (build-orchestrator, forges) do.
- `liveSeatCaller` (`:128`): `client.callTool(tool, { prompt, system, model, include_provenance:
  true, response_schema, schema_name })`. Provenance is taken only from the server envelope; if
  absent the result is `{ model, source:"ai-peer-mcp", response_id:null }` and the gate blocks.
- Routing (`build-gate/seat-registry.mjs:85-91`): `claude_ask` and `agy_checkpoint` → the in-repo
  `connectors/ai-peer-mcp/server.mjs`; `grok_ask`, `gemini_ask`, `codex_ask`, `agy_ask` → external
  plugin servers at `~/claude-plugins/<x>-plugin/servers/mcp-server.mjs` (ndjson). The router
  (`breakout/seat_router.mjs:24`) fails closed on an unrouted tool (`:65`).
- `agy` is **local and deterministic**: `agyAttestation` (`connectors/ai-peer-mcp/lib.mjs:112`)
  gives `provider:"local"`, `response_id:"agy-"+sha256(stableStringify(checkpoint))[0:40]`. It is a
  governance attestation, not a remote model, and not an authentication factor on its own.

### 2.5 Model backends (`connectors/ai-peer-mcp/server.mjs`)

| Seat | Auth env | Endpoint | Structured output | Provenance fields |
|---|---|---|---|---|
| claude `:454` | `ANTHROPIC_AUTH_TOKEN` (OAuth beta) else `ANTHROPIC_API_KEY` | `api.anthropic.com/v1/messages` | forced single tool, `input_schema` = schema | `json.model`, `json.id` |
| grok `:539` | `XAI_API_KEY` | `${XAI_BASE_URL}/chat/completions` | `response_format` json_schema strict | `model`, `id` |
| codex `:587` | `OPENAI_API_KEY` | `${OPENAI_BASE_URL}/chat/completions` | same | `model`, `id` |
| gemini `:653` | `GEMINI_API_KEY` | `…/models/{m}:generateContent` | `responseMimeType` + `responseSchema` | `modelVersion`, `responseId` |
| agy `:373` | none | none | — | local attestation (above) |

Tools served: `claude_ask`, `grok_ask`, `codex_ask`, `gemini_ask`, `agy_checkpoint`,
`council_review` (`:241-357`). Envelope: `{ text, provenance:{ provider, model, response_id, source,
answered_at } }` (`:391-396`). A system prompt impersonating "Claude Code" is refused (`:446-452`).

### 2.6 Verdict-on-facts (`breakout/verifier.mjs`, 285 lines)

- `reverifyRecord(record, baseDir)` (`:189`) rebuilds only `file_exists` / `file_contains` specs via
  `safeCheckFromSpec` (`:144`); `command` specs are skipped and not counted as re-verifiable.
- Path confinement `resolveUnder` (`:86`): lstat every component, reject symlinks, realpath must stay
  under the base realpath; anything else fails closed.
- `runVerifiedBreakout` (`:41-63`): `converged = allPass && checks.length > 0`. The prose council
  result is `discovery` only (`breakout/live.mjs:25,34`); it never feeds the verdict.
- At the gate the record's self-reported `converged`/`finalStatus` are checked (`gate.mjs:428`) but
  the gate's own re-run decides (`:447-453`). Signed mode additionally requires at least one
  `file_contains` check and rejects zero-byte evidence files.

### 2.7 What the tests pin

`build-gate/scripts/test-trust.mjs`: signed trio passes; tampered signature, missing provenance,
placeholder id, missing secret, shared `response_id` each block; absent `trust_mode` is fail-closed
(regression #6); advisory gives `advisory-unsigned` + `certified:false` (#6b); existence-only or
zero-byte evidence blocks; unsigned market/capability packets block; docs and LEXI count only from
verified packets. `test-gate.mjs` covers `examples/signed-pass` certifying with secrets set and
failing closed when one is removed (`:681-713`), breakout "meets" rules, path normalisation, LEXI,
protected paths.

## 3. Build orchestrator and the proposal lifecycle

### 3.1 `buildProject` (`build-gate/build-orchestrator.mjs:143`)

```
buildProject({ dossier, telos, tasks, callSeat, callTeam, callWorkshopSeat, callParallelSeat,
               keyring, signerFor, baseDir, telosDir, marketPackets, source,
               maxRepairRounds=8, adaptAttempts=2, concurrency, nowMs=0, maxRevisions })
```

| Step | Line | Blocks with |
|---|---|---|
| `planTeams`, `detectConventions` | `:144-148` | — |
| `tasks` or `decompose(...)` | `:151-156` | `{ phase:"decompose", ok:false }` |
| `senseProject` (collision sensing) | `:162-165` | `{ phase:"situation" }` when `dossier.block_on_collision === true` |
| **branch**: `dossier.proposal_lifecycle === true` → `return runProposalLifecycle({...})` | `:170-176` | see §3.2 |
| `compileAndHashPlan` → `writePlan` | `:181-186` | `{ phase:"plan" }` |
| `runCouncil` → `validateRecords` | `:195-201` | `{ phase:"approval", blocked: report.blockers }` |
| `runBuild({ authorizedPlanHash: planHash })` | `:210-219` | — |
| return `{ phase:"build", ok: report.merge_status === "ready", ... }` | `:221-231` | — |

`makeTeamDispatch` (`:52-105`) confines writes to the node's declared `files` via `resolveUnder`,
pre-flights the node's own test, and after `maxAttempts` failures returns a `respec` (requirements
plus failure text) instead of retrying forever.

### 3.2 `runProposalLifecycle` (`build-gate/proposal-orchestrator.mjs:145`)

1. **Authorship**: `authorship === "parallel"` without `callParallelSeat` →
   `PARALLEL_AUTHORSHIP_UNAVAILABLE` (`:156-159`).
2. **Controller key**: `TELOS_PROPOSAL_CONTROLLER_SK` (pkcs8 PEM, `:162`). Unset + existing
   `proposal.jsonl` → `EPHEMERAL_KEY_OVER_EXISTING_LEDGER` (`:171-174`); unset + fresh dir → ephemeral
   `generateKeypair()` (`:175`). The controller pubkey is pinned into `authorizedSigners` (`:181`).
3. **Execution-time verifier** `makeExecutionLifecycleVerifier(baseDir)` (`:184`, defined
   `:102-112`) wraps `validateProposalLifecycle` with `forceSignedDisjointness: true`.
4. **Recorder** `makeProposalRecorder` (`:187`) → `recordDraft` derives `proposal_id` (`:189-192`).
5. **Risk**: `riskClassFor` calls `evaluateRiskClass({ paths: [] })` (`:196`), which always yields the
   top class `governance` (`risk-policy.mjs:130-131`). `standingFor = () => null` (`:198`).
6. **Revision loop** `index = 1..(maxRevisions ?? dossier.max_revisions ?? 3)` (`:200-204`):
   - a. Daedalus workshop (`daedalus.mjs`, `DAEDALUS_MAX_ROUNDS = 6` at `:15`); stalemate →
     `WORKSHOP_STALEMATE` / `WORKSHOP_CONFLICT` finding → `human-review-required` (`:216-221`).
   - b. `reconstructVerificationRequests` from ledger events → `mintVerificationNodes`
     (`:228-230`); failure → `UNRESOLVABLE_VERIFICATION` (`:231-234`).
   - c. Compile tasks + verify nodes + obligations + lifecycle metadata; `COMPILE_ERROR` →
     human-review (`:237-248`); `writePlan`, `recordCandidate` (`:249-251`).
   - d. `deriveRevisionDispositions` (`:255-258`).
   - e. Review manifest per seat → `runCouncil` (`:262-268`).
   - f/g. `processReviewPackets` (the **sole** controller-side concern minter, `concerns.mjs`) →
     `sweepExpiredHolds`; unregistered kind → `UNREGISTERED_KIND` (`:271-279`).
   - h. `validateRecords(dossier, packets, { telosDir, baseDir, nowMs })` (`:283-284`); unminted
     request → `PENDING_VERIFICATION` (reparable, `:296-299`).
   - i. `recordDecision` with every blocker (`:303-306`).
   - j. `authorized` → `runBuild({ requireAuthorizedDecision: true, lifecycleVerify })`
     (`:310-315`); `blocked` / `human-review-required` → `{ phase:"approval", ok:false }`
     (`:319-320`); `revise` → next iteration.
7. After the loop: `BUDGET_EXHAUSTED` → human-review (`:326-327`).

**Outcome derivation** `deriveOutcome` (`merkle-dag/proposal-ledger.mjs:248-257`): `blocked` if any
finding is `protocol`/`unrecoverable`; else `human-review-required` if any `requires_human`; else
`revise` while `index < max` for reparable/edit/verification findings; else `authorized` **only**
with zero findings, every policy check satisfied, zero blockers; else `blocked`.

**Execution-time refusals** (`merkle-dag/orchestrate.mjs:19-56`): `PLAN_INVALID`, `PLAN_TAMPERED`,
`NO_AUTHORIZED_DECISION`, `CHAIN_INVALID`, `DECISION_NOT_AUTHORIZED`, `MISSING_POLICY_RESULT`,
`CORRUPT_POLICY_RESULT`, `WRONG_PLAN_POLICY_RESULT`, `NON_AUTHORIZING_POLICY_RESULT`,
`MISSING_LIFECYCLE_VERIFY`, `LIFECYCLE_REVERIFY_THREW`, `LIFECYCLE_STATE_DRIFT`; in-loop
`MUTATE_FAILED` (`:266`). `UNDISCHARGED_OBLIGATION` comes from `merkle-dag/ledger-gate.mjs:83`.

### 3.3 The closed sets (names only, verbatim)

| Set | Where | Members |
|---|---|---|
| `NA_ALLOWED` | `proposal-ledger.mjs:241` | `packet_signatures` |
| `POLICY_CHECK_KEYS` | `proposal-ledger.mjs:229-233` | written_plan, proposal_ref_binding, required_packets, packet_signatures, provider_lineage, cold_review_inputs, required_approvals, required_edits, concerns, risk_policy, obligation_anchors, protected_paths, proposal_chain |
| `FINDING_CLASSES` | `proposal-ledger.mjs:234` | protocol, unrecoverable, verified, edit, verification, hold |
| `PROPOSAL_STAGES` | `proposal-ledger.mjs:17` | draft, negotiation, candidate, review, hold, disposition, decision |
| `EVIDENCE_KINDS` | `evidence.mjs:106-115` | declared-test-failure, artifact-hash-mismatch, plan-hash-mismatch, schema-violation, provenance-mismatch, path-policy-violation, signature-failure, declarative-file-assertion |
| review-manifest evidence kinds | `proposal-gate.mjs:18` | candidate-plan, review-contract, source-doc, evidence |
| check registry | `check-registry.mjs:65-90` | `assert-file-contains` (target, needle), `assert-path-absent` (target); `FORBIDDEN_PARAM_KEYS` `:23-25`; `MIN_NEEDLE_LEN = 4` |
| `JUDGMENT_CLASSES` | `concerns.mjs:9` | consideration, hold-request, evidence-claim |
| `SEVERITIES` | `concerns.mjs:10` | low, medium, high, critical |
| `DISPOSITIONS` | `concerns.mjs:11` | verified, dismissed, waived, superseded, verification-required, expired-unresolved, unresolved (never writable, `:117`) |
| `DISPOSITION_DERIVATIONS` | `concerns.mjs:20-27` | verifier-result, human-adjudication, superseding-plan, verification-obligation, expiration-policy |
| hold escalation | `concerns.mjs:101-113` | none, second-review, human-adjudication; TTL clamped to [60 s, 7 d] |
| risk classes | `risk-policy.mjs:10-11` | documentation-only, application, data, authentication, authorization, secrets, infrastructure, deployment, payments, privacy, governance |

### 3.4 Content addressing and signatures (`merkle-dag/`)

- **Hash**: SHA-256, `"sha256:"` prefix (`vendor.mjs:29-31`). **Canonicalization**: recursive key
  sort, arrays keep order, so callers pre-sort arrays (`vendor.mjs:11-26`).
- **Plan hashes** (`merkle.mjs`): `spec_hash = H{files sorted, requirements, test}` (`:57-59`);
  `effective_hash = H{spec_hash, sorted parent effective hashes}` (`:62-65`);
  `plan_hash = H{pairs, signers[, obligations, lifecycle]}` (`:132-137`). Signers are inside the hash.
- **Artifacts**: canonical bytes at `.telos/artifacts/sha256_<hex>.json`, re-hashed on read
  (`proposal-ledger.mjs:191-215`). `proposal_id = "proposal-" + sha256{contract_version, sorted refs}`
  (`:162-165`). Disk tree hash covers raw bytes (`artifact.mjs`).
- **Proposal ledger**: Ed25519 over canonical(event minus `sig`), `key_id: "proposal-controller"`
  (`proposal-ledger.mjs:24-35`); hash-chained by `parent_event_hash`, single root and head, appended
  atomically under a `.lock` (`:68-152`).
- **Settlement ledger**: Ed25519 over canonical `{ task_id, effective_hash, artifact_tree_hash,
  artifact_files, key_id }` (`crypto.mjs:13-36`). Not chained; last entry per task wins.
- **`ledger-gate.mjs` exports `verify(telosDir, { baseDir })` (`:13`)** — there is no symbol named
  `done`; `CLAUDE.md`'s "pure `done()`" refers to this function. It recomputes the plan
  (`PLAN_INVALID`/`PLAN_TAMPERED`), then per node `MISSING_LEDGER`, `STALE_LINEAGE`,
  `UNKNOWN_SIGNER`, `BAD_SIGNATURE`, `PATH_ESCAPE`, `ARTIFACT_MISMATCH`, `TEST_FAILED` (re-runs the
  test, 60 s timeout, `:35-73`), then the obligation sweep (`:78-98`). It does **not** check proposal
  authorization; that is `checkLifecycleAuthorization` in `orchestrate.mjs:19`.

### 3.5 Where "controller-derived, never caller-supplied" is enforced

Controller-derived: `proposal_id` (`proposal-recorder.mjs:58`); `concern_ref` recomputed in
`processReviewPackets`, ignoring any model-supplied ref (`concerns.mjs:212-217`) and recomputed again
at the gate (`proposal-gate.mjs:212-216`); objection hash (`daedalus.mjs:39,139,150`); verify-node id,
obligation id/ref, discharge test ref all from `concern_ref` (`obligation.mjs:15-20,49-54,114`);
executable from the registry, never the packet (`check-registry.mjs:109-121`); `proposal_ref` and
`review_input_hash` stamped by the council wiring (`council.mjs:62-70`); authorization keyed to the
plan hash recomputed from disk (`orchestrate.mjs:20-33`).

Still caller-supplied (documented or not): `dossier.write_targets` (documented),
`nowMs` (drives hold expiry at decision *and* execution time), `dossier.contract_ref` (defaults to the
literal `"sha256:contract"`, `proposal-orchestrator.mjs:240`), in-memory council `packets`, and
`ctx.baselineTestRefs` / `ctx.authorizedTestRefs` / `ctx.isolationRunner` in `evidence.mjs`.

### 3.6 Sandboxed verifier (`build-gate/evidence.mjs`)

Only `declared-test-failure` spawns anything (`:107`), and it runs the node's `test` from the
**recomputed plan on disk**, never from the claim (`:148-156`). The test must be `baseline` or
`previously-authorized` (`:96-101`). Runner is `bwrap` only (`--unshare-all`, ro-binds of
`/usr /bin /lib /lib64`, scratch copy of `baseDir` with `.telos` excluded, env limited to
`PATH/TMPDIR/TEMP/TMP`, a `--version` canary first) (`:50-87`). `ctx.isolationRunner` can override
the runner (`:155`).

## 4. Products and role packages above the spine

| Package | Entry | Spine imports | Declared limit |
|---|---|---|---|
| `forge/` | no CLI; `createOperator` (`operator.mjs:122`), `driveUntil` (`driver.mjs:24`), `runBouts` (`ratchet.mjs:289`), `validateManifest` (`manifest.mjs:41`) | `merkle-dag/crypto` (Ed25519 ops ledger), `breakout/{verifier,breakout}`, `merkle-dag/vendor`; **never `build-gate`** | `operator.mjs:20-22`: a writer of both ledger and sidecar keys defeats detection |
| `saas-forge/` | `forge()` (`forge.mjs:127`), `runForgeLive` (`live.mjs:361`) | `build-gate/{gate,sign,council,model-profiles,seat-registry}`, `breakout/{mcp_client,seat_router,breakout,fight_memory}`, `merkle-dag/{crypto,merkle,orchestrate}`, `forge/*` | keyless path uses explicit `trust_mode:"advisory"` (`forge.mjs:67-98`, commit `613a738`) |
| `ai-forge/` | `forge()` (`forge.mjs:114`), `runForgeLive` (`live.mjs:213`); patterns rag/eval/multiagent/serving/telos | same shape as saas-forge minus research | `patterns/telos.mjs` emits generated files that import the real spine by absolute `file://` URL (`${spineRoot}`, `:8-10`) — invisible to static import scanners |
| `clotho/` | `weave.mjs` CLI (`runWeave :396`) | **none**; consumed as data | `memory/NON-CLAIMS.md`: advisory, not sandboxed; not a JS parser; test weaver executes nothing |
| `lachesis/` | `loadWeave` (`ingest.mjs:64`), `assess` (`measure.mjs:129`) | `merkle-dag/vendor` only | no node-id re-derivation; digest check is manifest-relative; verifies no signatures |
| `atropos/` | `verify` (`verify.mjs:74`) over `CURRENT-AUTHORITY#superseded` | `merkle-dag/vendor` only | retires nothing; verdict advisory; read-only oracle is a static scan |
| `ai-native-memory/` | Claude Code plugin; `scripts/{gate,audit,verify,init}.mjs` | **none** | audit is structural; hash pinning does not authenticate authorship |
| `narcissus/flagship/` | Vite app; `scripts/build-live-graph.mjs` imports `lachesis/{ingest,measure}` + `atropos/verify` (`:9-11`) | via lachesis/atropos only | not the Narcissus role module; Iliad enrollment deferred |
| `demo/` | `generate-artifacts.mjs` → `forge/operator.mjs` | `forge/operator` | manual, not in CI; `verify.js` is a browser port with parity test |

`PACKAGE_ROOTS` (`clotho/inventory.mjs:21`, contract `clotho/memory/CONTRACTS/package-roots.json`)
is exactly: atropos, breakout, build-gate, clotho, connectors/ai-peer-mcp, lachesis, merkle-dag.
Excluded by contract (`:36`): ai-forge, ai-native-memory, demo, forge, narcissus/flagship, saas-forge.

## 5. Institutional-memory oracles and CI

- `docs/institutional-memory/comprehension-gate.mjs`: recomputes `active_plan.sha256` from disk
  first, then grades answers deterministically; exit 0 pass / 3 fail / 1 cannot-run.
- `docs/institutional-memory/verify-contracts.mjs` (exit 2 on drift): plan hashes vs disk; Clotho
  contracts vs `inventory.mjs`; NORMATIVE records need an oracle; memory-dir registration; Lachesis
  golden vs live snapshot; Daedalus protocol vs `build-gate/daedalus.mjs`; TELOS authz chain and seats
  vs the council; Argo slices and the entry ritual run both ways; loadout/seat-registry/env surface;
  Iliad enrollment; future modules registered-verbatim and unbuilt.
- `docs/institutional-memory/iliad/workflow/check-workflow.mjs`: exact 7-stage table
  (iliad-pre-review → daedalus → telos → argo → reference-doc → clotho → iliad-retrospective), every
  `file:…@sha` / `git:sha` pin resolving.

`.github/workflows/ci.yml` (push to `main`, every PR; `contents: read`):

| Job | Runs |
|---|---|
| `test` (node 22 × 24) | `npm test` in the 12 zero-dependency packages; clotho with full history |
| `fail-closed-proof` | `node docs/runs/fail-closed-demo/run.mjs`, then both `docs/runs/proposal-lifecycle/` evidence scripts and the three keyless `docs/runs/agentic-teams*` scripts (added in this PR) |
| `repository-portability` | `.github/scripts/check-portable-paths.mjs` (Windows-safe paths, case collisions) |
| `workflow-scripts` | `workflows/tests/test-hestia.mjs` (`workflows/` is deliberately package-less) |
| `institutional-memory` | `verify-contracts.mjs`, `clotho-self-weave/run.mjs --verify-committed`, `check-workflow.mjs` |
| `narcissus-flagship` | `npm ci`, audit, lint+unit, coverage floor, `verify:evidence`, `verify:coverage`, `check:live-graph`, build, Playwright e2e, clean-tree check |
| `required-ci` | aggregates all of the above; `pages.yml` deploys only on its success at the same `head_sha` |

`claude.yml` answers `@claude` mentions and `code-review.yml` reviews PRs; both authenticate with the
single repo secret `CLAUDE_CODE_OAUTH_TOKEN`. `code-review.yml` checks out the plugin marketplace at
a pinned commit and renames it `telos-pinned-plugins` (commit `8f84ddd`) because the upstream name is
reserved.

## 6. What governs new work (`CURRENT-AUTHORITY.json`)

- Active plan: Clotho **v15**, `docs/runs/clotho-daedalus-delta14/matured-plan-v15.md`,
  `sha256:05a487…`, anchored `git:bb265b9`, PR 121.
- Active authorization: **authz-008**, AUTHORIZED, extends authz-006, supersedes authz-007; required
  seats claude/agy/codex; "unanimous approve/high, signed; gate pass".
- Implementation authority: **The Eye**; accepted slices 4a, 4b, 5, 6, 7; `next_slice: null` — Phase
  1 complete, new work enters via the Iliad lifecycle.
- Amendments in force: AM-40, AM-41, AM-42. Superseded: v11 (authz-004), v12 (authz-005), v13
  (authz-006), v14 (authz-007), all `must_not_govern_new_work: true`.
- Manifest: role modules daedalus/telos/argo/iliad (active); product narcissus/flagship
  (implemented, enrollment deferred); future modules hermes/medusa/narcissus (registered, unbuilt);
  capability module loadout (`build-gate/seat-registry.mjs` + `breakout/seat_router.mjs`).

## 7. Findings from the trace

Ordered by how much they matter to the trust claim. Each was confirmed by reading the cited lines or
by running the cited command on the tracing commit. F1 and F1b are fixed in the same PR as this document;
the rest are left for separate, scoped changes.

**F1 — `run-lifecycle-e2e.mjs` no longer passed keyless (fixed in this PR).** On the tracing
commit, `node docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs` exited 1 with `ACCEPTANCE FAILED`;
both variants ended `decision: "blocked"` on `trust_mode 'signed' but no secret to verify … packet`.
Cause: the dossier at `:33` set no `trust_mode` and no seat secrets, and since commit `c8f4ebf` the
gate requires HMAC by default. The committed summary still recorded `acceptance_ok: true` (last
touched 2026-07-15), and neither lifecycle evidence script was in any CI job, although the README
said the primitive demo "doubles as executable evidence in CI". The unit test had been updated
(`scripts/test-proposal-orchestrator.mjs:52` uses `trust_mode:"advisory"`); the evidence script had
not. Fix applied here, chosen to keep the evidence on the *certified* path rather than downgrade it
to advisory: the script mints ephemeral per-run `TELOS_SECRET_<SEAT>` values when none are set
(never overriding operator secrets, nothing written to disk), sets `trust_mode: "signed"`
explicitly, records which secrets were ephemeral in the summary, and adds an `unsigned` variant
that withholds `TELOS_SECRET_CODEX` and must be `blocked` at the approval phase. Both lifecycle
scripts now run in the `fail-closed-proof` CI job. `docs/runs/` is outside the env-surface
contract's scan scope (`verify-contracts.mjs:679`, package roots only), so the new env writes do
not touch that contract.

**F1a — a signature failure does not short-circuit `deriveOutcome`.** The `unsigned` variant's
ledger shows `["revise", "blocked"]`: in iteration 1 the missing-secret blocker coexists with the
reviewer's reparable hold-request finding, and `deriveOutcome` (`proposal-ledger.mjs:248-257`)
checks finding classes before it checks the blocker count, so the outcome is `revise` and a
revision cycle is spent before iteration 2 (no findings left) lands on `blocked`. Never
authorizes, so fail-closed holds, but a base-gate blocker of the protocol kind (unsigned packet,
missing provenance) arguably belongs in the `blocked` short-circuit.

**F1b — `docs/runs/agentic-teams-situational/run-teams-situational.mjs` was a second instance of
F1 (fixed in this PR).** Its inline dossier (`:20-26`) set no `trust_mode`, its mock seats returned
unsigned packets, and no secrets existed, so keyless it ended `phase: "approval", ok: false` while
the committed `run-summary.json` still said `phase: "build", ok: true` (last touched 2026-06-28).
Fix applied here, same shape as F1: the script mints ephemeral per-run `TELOS_SECRET_<SEAT>` values
when none are set, declares `trust_mode: "signed"`, and records the seat-secret provenance in its
summary; keyless and operator-secret runs both end `merge_status=ready self_corrected=true`, and
the regenerated summary is byte-identical across runs. The sibling scripts
`agentic-teams/run-teams.mjs` and `agentic-teams-market/run-teams-market.mjs` pass keyless because
they load `build-gate/examples/*/dossier.json`, which were switched to `trust_mode: "advisory"` in
`c8f4ebf`. All three now run in the `fail-closed-proof` CI job. `agentic-teams-live` and
`agentic-teams-plugin-seats` need real seats and were not run.

**F2 — CLI path skips proposal-lifecycle enforcement while reporting it enforced.** `validateGate`
(`gate.mjs:93-104`) never sets `source.telosDir`; `validateRecords` only runs
`validateProposalLifecycle` when it is set (`:260`). A `proposal_lifecycle: true` dossier validated
through the CLI therefore gets no ledger reconstruction and no blocker, yet
`headline_checks.proposal_lifecycle_enforced` is `proposalMode` (`:281`). Only
`build-orchestrator.mjs:197` supplies `telosDir`.

**F3 — Authorization is checked once, before dispatch; a `respec` re-plans without a new
decision.** `orchestrate.mjs:200` calls `checkLifecycleAuthorization` at build start. A worker halt
with `respec` mutates the node and rewrites `plan.json` (`:264-268`), yielding a new `plan_hash`.
`ledger-gate.verify` (`:13`) checks lineage, signatures, disk and tests but not authorization, so a
`ready` result can be for a plan hash that has no authorized decision. Whether a real team dispatch
can reach that path under lifecycle mode should be settled by a test before anything is changed.

**F4 — Provenance is not bound to the seat.** The gate checks presence, non-placeholder and
cross-seat uniqueness of `provider:response_id` (`gate.mjs:205-238`) but never that
`provenance.provider` or `response_model` is consistent with `packet.model`. The comment at
`:198-204` states the gate cannot prove an id genuine; the HMAC secret is the identity floor. A
provider/model consistency check would be cheap and disk-only.

**F5 — No replay protection in packets.** `signPacket` covers packet content only
(`sign.mjs:10-33`); there is no nonce and no dossier hash. A signed packet is valid for any dossier
sharing `build_id` and `use_case`. In lifecycle mode `proposal_ref === planHash` (`proposal-gate.mjs:44-53`) closes this; legacy mode has no equivalent.

**F6 — Council does not fail closed on a missing secret.** `runSeat` returns `{ ok:true,
signed:false }` (`council.mjs:79-81`); the gate is the only place that blocks. Fine as long as every
caller runs the gate, which the orchestrator does.

**F7 — Dead or stale code.** `build-orchestrator.mjs:192-197` still branches on
`proposal_lifecycle === true` after `:170` has already returned for that case. `gate.mjs:819-830`
(`normalizeVaultPath`, `stripTrailingSlash`) is unused. `proposal-orchestrator.mjs:18-19,31` import
`existsSync`, `path`, `buildRevisionBrief` and never use them. `proposal-orchestrator.mjs:326-327`
(`BUDGET_EXHAUSTED`) is reachable only when `maxRevisions <= 0` because `deriveOutcome` returns
`revise` only while `index < max`. `DEFAULT_PROTECTED_PATHS` is re-declared in `council.mjs:172`
instead of imported from `gate.mjs:23`. `VALID_DECISIONS` includes `advisory-note` (`gate.mjs:30`)
but `APPROVAL_PACKET_SCHEMA` (`schemas.mjs:19`) does not. Comments at `gate.mjs:176,204,455` still
say "legacy/unsigned mode" for what is now explicit advisory mode.

**F8 — Exported-but-uncalled lifecycle primitives.** `verifyEvidence`, `deriveStanding`,
`applyAdjudication`, `assertDispositionAllowed`, `normalizeLegacyHardStops`, `isVettedResolvedTest`
are used only by tests. `docs/proposal-lifecycle-implementation.md` says the gate uses
`isVettedResolvedTest`; it uses `deriveExecutableRef`. The doc's outcome table lists a verified
blocker as `blocked`; code tags it `class:"verified"` (reparable) so `deriveOutcome` yields `revise`.

**F9 — Every proposal is risk class `governance`.** `riskClassFor` passes `paths: []`
(`proposal-orchestrator.mjs:196`), which `evaluateRiskClass` maps to the highest class
(`risk-policy.mjs:130-131`). Consequently every bare hold-request carries a 24 h TTL and, with no
waiver path wired (`standingFor = () => null`, `:198`), ends in `human-review-required`.

**F10 — Advisory-mode asymmetry at execution time.** Decision-time
`validateProposalLifecycle` runs with `forceSignedDisjointness: false`; the execution-time verifier
forces it (`proposal-orchestrator.mjs:110`). In advisory mode, unverifiable review lineage can be
authorized and then fail with `LIFECYCLE_STATE_DRIFT`.

**F11 — Unregistered mythological name in project vocabulary.** `workflows/hestia.js` (and the CI
job "workflow scripts (hestia ship gate)") uses *Hestia*, which is absent from the registered set in
`docs/mythological-vocabulary.md:22-38` and from `repository-manifest.json`. `CLAUDE.md` says
unregistered names must not be introduced without human approval; either register it or rename.

**F12 — Static import scans over-count.** `clotho/scripts/x.mjs`, `dep.mjs`, `helper.mjs`,
`clotho/clotho/inner.mjs`, `clotho/pkg-a/one.mjs` do not exist; they are string-literal fixture paths
that tests write into temp repos. A regex scan (like the one in §1) sees them as high fan-in edges;
Clotho's lexer does not. `ai-forge/patterns/telos.mjs` is the inverse case: real runtime imports of
the spine hidden inside template strings.

**F13 — Deterministic `agy` is not an authentication factor.** `agyAttestation` is reproducible by
anyone from the checkpoint (`connectors/ai-peer-mcp/lib.mjs:112-128`); the HMAC secret is the only
thing that makes the `agy` packet trustworthy. The README already says agy is "a deterministic local
governance attestation, not a remote model"; this is a restatement for readers of the gate code.

**F14 — `connectors/meta-ads-mcp/server.mjs` is outside every oracle.** The Meta Marketing API
stdio server (168 lines, reached via the seat router as `meta:<tool>`) has no `package.json`, no
tests, no CI job, and is absent from `repository-manifest.json` and from Clotho's `PACKAGE_ROOTS`
(`clotho/inventory.mjs:21`) and its exclusion list (`:36`). Its safety invariants (PAUSED-by-default,
`META_MAX_DAILY_CENTS` cap, no delete tool) are asserted in comments only. Open issue #177 already
names the bypassable spend cap; the enrollment gap is the wider point.

## 8. Reading order for a new maintainer

1. `README.md` trust model, then `CURRENT-AUTHORITY.json`, then `repository-manifest.json`.
2. `build-gate/sign.mjs` (69 lines) → `build-gate/gate.mjs:107-300` → `breakout/verifier.mjs:189`.
3. `build-gate/council.mjs:42-92` → `build-gate/seat-registry.mjs:85` →
   `connectors/ai-peer-mcp/server.mjs:241-357`.
4. `merkle-dag/merkle.mjs:57-137` → `merkle-dag/orchestrate.mjs:19-56` → `merkle-dag/ledger-gate.mjs`.
5. `build-gate/build-orchestrator.mjs:143` → `build-gate/proposal-orchestrator.mjs:145` →
   `merkle-dag/proposal-ledger.mjs:229-257`.
6. Run `node docs/runs/fail-closed-demo/run.mjs`, then `cd build-gate && npm test`.

## 9. GitHub lineage (what shipped, what is open, how CI behaves)

Read from the GitHub API on 2026-09-23. Tags: `v0.1.0`, `v0.2.0`.

### 9.1 How the current `main` got here

| Date | PR | Change | Why it matters to the trace |
|---|---|---|---|
| 2026-07-15 | #84 | proposal lifecycle composed into `buildProject` | origin of §3 and of the e2e script in F1 |
| 2026-07-19/20 | #133, #135 | governance/evidence hardening; evidence-backed README + fail-closed proof | `docs/runs/fail-closed-demo/run.mjs` becomes the public proof |
| 2026-07-26 | #136, #137 | `check-node.mjs`, `generatorDispatch`, `factBreakout` extracted into `forge/` | why saas-forge/ai-forge import `forge/*` (§4) |
| 2026-07-30 | #138, #139 | Claude Code GitHub workflow; in-browser demo page | `claude.yml` and `demo/` |
| 2026-08-13 | #145 | Hestia maintenance workflow definition | F11 (unregistered name) |
| 2026-08-27 | #155–#161 | security sweep closing issues #148–#154: workstream-id confinement, operator ledger fail-closed, bwrap-only sandbox (replaced `unshare` fallback), clotho roots race, AM-42 authority reconciliation, hestia residue gate, Node/Action pins | §3.6 sandbox whitelist; `forge/operator.mjs` fail-closed; `CURRENT-AUTHORITY.json` chain |
| 2026-08-27 | #162–#164 | flagship fixes, docs reconciliation, ESLint + coverage floor | `narcissus/flagship` CI job |
| 2026-09-20 | #186 | **signed-by-default gate** (commit `c8f4ebf`) + Pages gated on CI (#181) + pinned plugin marketplace (#182) | §2.2 step 2; root cause of F1; saas-forge switched to explicit advisory (`613a738`) |
| 2026-09-20 | #191 | rename pinned marketplace (`claude-code-plugins` is reserved) | `code-review.yml` §5 |
| 2026-09-20 | #188 | check-workflow oracle wired into CI; stale argo pin fixed | `institutional-memory` CI job |

`main` CI: the last 12 `CI` runs on `main` (#157 through #188 merges) all concluded `success`.

### 9.2 Open pull requests (12)

- **#192** `WIP: per-node verify stage (incomplete — do not merge)`, opened 2026-09-23, `mergeable_state: dirty`.
  Adds `VERDICT_SCHEMA` (`schemas.mjs`), `verifyTeamForNode` (`teams.mjs`), `promptForVerify` /
  `parseVerdict` / `makeLiveCallVerify` (`teamPrompts.mjs`), and a verify stage inside
  `makeTeamDispatch` that re-runs the verdict's declarative checks through `reverifyRecord`. Its own
  description says `runVerify` is referenced but not defined and `buildProject` is not wired. Two
  things to watch when it resumes: `parseVerdict` is deliberately fail-soft (an unparseable verdict
  is `ok: true`), which is the opposite default from the rest of the gate; and the stage runs
  *inside* the team dispatch, before `defaultVerifyNode`, so it is advisory-blocking only and does
  not change F3.
- **#146** `Add a concise TELOS engineering review path`, opened 2026-08-25, no activity since.
- **#193** this trace (draft).
- **Dependabot (9):** GitHub Actions bumps #165 (`deploy-pages` 5.0.1), #166 (`checkout` 7.0.1),
  #167 (`upload-pages-artifact` 5.0.0), #168 (`setup-node` 7.0.0), #185 (`claude-code-action`
  1.0.228); flagship npm bumps #169 (`@xstate/react` 6.1.0), #170 (`@playwright/test` 1.62.1),
  #171 (`react-dom`), #172 (`react`), #173 (`@vitejs/plugin-react` 6.1.0). All opened 2026-08-27
  or 2026-09-03; none merged. #185 matters because the pinned `claude-code-action@70fec18`
  (1.0.207) is the one whose review runs are failing (§9.4).

### 9.3 Open issues (14) mapped to the trace

| Issue | Title (abridged) | Where it lands in this document |
|---|---|---|
| #190 | DECISIONS/ records have no oracle | §5 `verify-contracts.mjs` covers contracts, not decisions |
| #189 | Iliad weave-coherence claim has zero consumers | §4 lachesis/atropos are the only weave readers |
| #187 | saas-forge: replace `--advisory` fallback with real signing | §4 saas-forge row; same fallout as F1 |
| #184 | v0.2.0 review corrections (7) | governance; not code-traced here |
| #183 | flagship fonts ship without OFL texts | `narcissus/flagship` |
| #180 | flagship failure and mobile paths | `narcissus/flagship` |
| #179 | no reproducible release contract | tags exist, no release oracle |
| #178, #175 | ai-native-memory auditor / gate re-derivation | §4 ai-native-memory non-claims |
| #177 | meta-ads-mcp ungoverned runtime, bypassable spend cap | **F14** |
| #176 | clotho `--verify-committed` conflates snapshot with freshness | §5 institutional-memory job |
| #174 | hestia: bind merged artifact to PR head SHA | `workflows/hestia.js`; see also F11 |
| #63, #30 | ai-forge hygiene / shared helper extraction | partially done by #136/#137 |

Closed on 2026-08-27 and 2026-09-20 by the PRs in §9.1: #148–#154, #181, #182.

### 9.4 The `Claude Code Review` workflow is unreliable

Of the last 40 `code-review.yml` runs, 29 failed and 11 succeeded. Every failure has the same
signature: marketplace and plugin install succeed, then the Claude Code SDK run ends in under two
seconds with `is_error: true`, one turn, zero cost, empty `modelUsage`. Failures cluster when
several PRs trigger at once (six dependabot PRs at 2026-08-27 18:44 and 18:54, five at 2026-09-20
00:47 and 02:33/02:36), with one or two runs in each burst succeeding. That pattern fits a
per-account concurrency or rate limit on the `CLAUDE_CODE_OAUTH_TOKEN` subscription auth better
than an expired token. Either way the check is not a signal about the diff; on this PR it failed
twice on a docs-only change. Practical consequences: `review` is not part of `required-ci`, so it
does not block merges, but it also means the automated review has not actually reviewed most PRs
since 2026-08-27. Candidates: bump to the action version in #185 (its two review runs passed),
serialize the workflow with a `concurrency` group, or add `show_full_output: true` once to capture
the SDK error text.

## 10. Build orchestrator lineage

`build-gate/build-orchestrator.mjs` has had seven commits since it was created; its three exports
(`makeTeamDispatch`, `makeTeamKeyring`, `buildProject`) have been stable since the first one.

| Date | Commit | Landed via | What changed in the orchestrator |
|---|---|---|---|
| 2026-06-28 | `17bffa6` | #11 (merged in the #83 daedalus/implementation batch) | Created: council + merkle-dag composed into one autonomous builder; single-shot `callTeam`; 160 lines |
| 2026-06-28 | `7378804` | #13 (same batch) | `makeTeamDispatch` gains the inner repair loop (`maxAttempts`, `priorFailure`, `respec` hand-up); `senseProject`/`detectConventions` and `runNodeTest` wired in; `situation` phase added |
| 2026-07-01 | `be5796d` | #64 (same batch) | Fail-closed hole closed: a team may only write files its node spec declared (`declared` set, `resolveUnder`) |
| 2026-07-14 | `947e3ed` | M4 (same batch) | Council runs *after* `compileAndHashPlan`; packets bound to `plan_hash` via `councilContext.proposal_ref`; `gateSource.telosDir` supplied only in lifecycle mode; `authorizedPlanHash` passed to `runBuild` (TOCTOU strengthening) |
| 2026-07-15 | `0901c66` | #84, merged by `557f444` | `buildProject` gains `callWorkshopSeat`, `nowMs`, `maxRevisions` and the early `return runProposalLifecycle(...)` branch (§3.1 step 4) — the point after which the ternaries at `:192-197` became dead (F7) |
| 2026-07-16 | `2e530b2` | #99 | `callParallelSeat` threaded through to the lifecycle |
| 2026-07-19 | `0cfb280` | #133 | Path re-resolved immediately before `writeFileSync` (second `resolveUnder`) — the review-remediation sweep |
| 2026-09-19 | `c8f4ebf` | #186 | No change to the orchestrator itself; its two unit tests switched to `trust_mode: "advisory"` and the example dossiers followed. The evidence scripts did not (F1, F1b) |
| 2026-09-23 | #192 (open, WIP) | — | Adds a verify stage inside `makeTeamDispatch` (`readArtifactFiles`, `runVerify` not yet defined, `requireVerify` opt-in); fail-soft `parseVerdict` (§9.2) |

Dependency churn since creation: `teams.mjs` 2 commits, `decompose.mjs` 2, `situation.mjs` 1,
`test-runner.mjs` 2, `teamPrompts.mjs` 8, `council.mjs` 5, `proposal-orchestrator.mjs` 4,
`merkle-dag/orchestrate.mjs` 5. The orchestrator's own logic has not changed since 2026-07-19; every
later behavioural change reached it through `gate.mjs` (signed-by-default) or the lifecycle module.

Consumers of `buildProject` and their keyless status on this commit:

| Consumer | Keyless today | Why |
|---|---|---|
| `build-gate/scripts/test-build-orchestrator.mjs`, `test-runtime-adaptation.mjs`, `test-proposal-orchestrator.mjs` | pass | switched to `trust_mode: "advisory"` in `c8f4ebf` |
| `docs/runs/agentic-teams/run-teams.mjs`, `agentic-teams-market/run-teams-market.mjs` | pass | fixture dossiers in `build-gate/examples/` are advisory; now in CI (this PR) |
| `docs/runs/agentic-teams-situational/run-teams-situational.mjs` | pass on the signed path | fixed in this PR (F1b): ephemeral seat secrets, explicit `trust_mode: "signed"` |
| `docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs` | pass on the signed path | fixed in this PR (F1) |
| `docs/runs/agentic-teams-live/`, `agentic-teams-plugin-seats/` | not runnable here | need live seats via MCP |
