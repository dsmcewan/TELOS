# Daedalus Family Multi-Model Seat Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency `multi-model-seats` lifecycle that makes every Daedalus, Icarus, Grok, Gemini, TELOS, and Eye decision grow an auditable Merkle-DAG and routes every non-pass or dead stage back through Daedalus until an exact-root pass or explicit Eye action.

**Architecture:** A declarative Daedalus-family profile defines seats, stages, pair gates, cold-review gates, retry edges, governed mutations, and Eye-authority actions. Small Node ESM modules implement typed canonical artifacts, separate canonical-JSON and raw-byte hashing, crash-atomic immutable controller-signed journal records, externally signed and prefix-bound Eye authority, exact public request/response framing, prepared invocation recovery, deterministic transitions, disk-only replay, strict lifecycle-round checkpoints, and detached-verifiable handoff bundles; a fenced resumable controller/CLI is the only production write path. Runtime records are plugin-managed disk truth, and TELOS retains its existing authorization boundary.

**Tech Stack:** Node.js 18 or newer, ESM `.mjs`, `node:test`, Node standard-library `crypto`/`fs`/`path`, canonical JSON, SHA-256 content addresses, Ed25519 controller signatures, immutable canonical record files, Superpowers workflow skills.

## Global Constraints

- The approved design is `/home/colchis/Projects/TELOS/docs/superpowers/specs/2026-07-21-daedalus-family-multi-model-seat-lifecycle-design.md`, commit `f7482daf7318cfb7341a739154ebb9b49d77d8c5`, raw file SHA-256 `5c972b176df402d22a65273520d2342541cd213717e80c8460577a7ad6c920c9`.
- TELOS plan-authorization identity is the canonical candidate ref `sha256hex(canonicalize({ kind: "candidate", plan: planText }))`, not the raw file SHA-256. Raw SHA-256 may be recorded only as a transport-integrity checksum. Lifecycle-round identity is stage-discriminated: P1 binds that plan-candidate ref plus the exact UTF-8 bytes of its `plan` string, while C1 binds the governed `dfm.implementation.v1` artifact ref plus its exact no-newline canonical artifact bytes.
- This document is a candidate plan. `authz-008` governs Clotho v15 only and does not authorize this implementation. The Eye must authorize this exact plan root before Task 1 begins.
- Implement in `/home/colchis/plugins/multi-model-seats`; do not edit `/mnt/c/Users/dsmce/.codex/plugins/cache/multi-model-local/multi-model-seats/0.5.2` as source.
- Do not modify upstream Superpowers. Map the lifecycle onto `brainstorming`, `writing-plans`, `executing-plans` or `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, and `finishing-a-development-branch`.
- Keep Node ESM zero-dependency: Node 18 or newer, `.mjs`, double-quoted strings, semicolons, two-space indentation, and `node:` imports only.
- Model consensus is never authorization. Daedalus convergence permits submission; TELOS evaluates evidence; The Eye authorizes or accepts exact roots.
- Grok and Gemini are mandatory for profile gates `P2` and `C2`, but remain advisory in the existing TELOS authorization council. Do not change TELOS's required `claude`/`agy`/`codex` trio.
- Seat 5 / `agy` remains outside this profile. It participates only when the exported root enters the existing TELOS authorization flow.
- Every state-changing pass, non-pass, death, invalidation, mutation, retry, and Eye action publishes one crash-atomic signed decision record and changes the lifecycle root. Decision, operation, and lifecycle-round checkpoint journals each carry signed `journal_index`/`previous_journal_ref` continuity and use exclusive atomic publication; JSONL append is never authority.
- There are no automatic round, retry, elapsed-time, or cost caps. A non-pass or dead stage records the failure and routes to Daedalus recovery. Only a separately signed Eye pause, cancel, amendment, or adjudication may suspend or terminate the run.
- A required seat may not be skipped, spoofed, substituted, or self-approved. Controller-derived request refs bind exact canonical public request bytes; response provider/model must equal the profile/request before provenance is `issued`. Requested identifiers are never persisted as validated response facts.
- A plan mutation reruns `P1` and `P2`; an implementation mutation reruns `C1` and `C2`. Old decisions remain stored but cease to satisfy the descendant root.
- The governed implementation root is the content ref of a canonical `dfm.implementation.v1` artifact. Its embedded `tree_root` is separate disk evidence: code gates, C1 checkpoints, and Eye acceptance bind the artifact ref, while disk truth binds only the embedded tree ref. A checkpoint never hashes `tree_root` bytes as the C1 candidate and never treats the plan text as an implementation candidate.
- Runtime private keys, API keys, OAuth tokens, `.env*`, `*.pem`, and runtime `.telos/` artifacts never enter Git. The controller private key is supplied in memory or generated ephemerally; only its immutable public key may be persisted. Every signature-bearing grant, delegation, Eye authority, controller decision, operation, lifecycle-round checkpoint, detached record, vector, and signer result uses one closed canonical base64url decoder: the value is a nonempty unpadded URL-alphabet string, contains no `=` or whitespace, decodes to the exact schema-required length (64 bytes and therefore 86 characters for every Ed25519 signature), and round-trips with `decoded.toString("base64url") === value` before cryptographic verification. Empty, padded, standard-base64 alphabet, whitespace, wrong-length, non-round-tripping, alternate, or mutated encodings fail before state read, signer/provider/observer execution, lock, temp creation, or write. Key-ID/signature/ref/predecessor checks then run in memory against the authenticated public key before atomic publication.
- One reviewed binary-safe `dfm.credential-value-detector.v1` implementation is the sole credential-value oracle for pre-initialization physical scans, existing-history scans, every immutable candidate tree, production structured/raw persistence, adapter authorization, final-plan verification, and tests. It scans raw bytes without binary/text exclusions, fails on any read/parser/Git/subprocess error, and has no warning/ignore/allowlist mode. Every source commit is published only by its scanner-owned `commit-scanned` transaction: the detector freezes one candidate tree OID, scans that exact tree and all existing reachable history, creates a commit that names only that accepted tree, and compare-and-swaps the branch from the exact observed parent. A separate successful scan followed by `git commit` is forbidden because it cannot bind the scanned index to the committed tree. Its exact external reviewed bytes are copied byte-for-byte into the plugin before Git initialization and remain hash-bound through the signed production registry; no `rg`, `grep -I`, `|| true`, lossy decoder, second regex, ordinary `git commit`, or hook may substitute for it.
- No external canonicalizer, detector, validator, registry-selected JavaScript, or other selected executable is parsed, imported, evaluated, or spawned until a separately retained root-signed `telos.dfm-authorization-bootstrap.v1` packet has authenticated the external Eye root, exact raw grant/trust/registry bodies, root-signed delegation bytes, reviewed commit `P`, and every exact approved helper path/raw ref. The bootstrap packet is a closed two-line raw-signed frame verified with only fixed `node:` primitives: canonical-base64url payload bytes on line one and a canonical 64-byte Ed25519 signature on line two, each followed by exactly LF; the signature covers the domain-separated exact payload bytes. The root and packet are each one bounded no-follow stable read whose raw refs come from the independent Eye authorization packet or operator trust store, never from the supplied paths, CURRENT authority, grant, trust, registry, runtime, or environment. The authenticated payload binds the exact plan/profile/target, reviewed commit, grant/trust/registry realpaths plus raw and canonical refs, and the registry raw body; that authenticated registry in turn names exact normalized realpaths/raw refs for the TELOS canonicalizer, credential detector, adapter validator, identity-fenced runner, registry observer, detached launcher source, detached verifier source, and all four adapters. Only after raw-body, reviewed-commit, exact-path, regular-file, no-link/no-hardlink, containment, and tracked-clean checks succeed is each selected file opened once with `O_NOFOLLOW`, read once into one bounded buffer, hashed over that exact buffer, and—where JavaScript—imported only from that same buffer through an in-memory URL. The external canonicalizer is the first selected helper evaluated; it must reproduce the authenticated packet/grant/trust/registry canonical bytes and refs before detector/validator/launcher/verifier/adapter evaluation or any request to the independently running protected service/observer. No selected pathname is reopened for execution. A forged packet/grant/registry, top-level marker, atomic swap, second-read attempt, alternate filename, same-byte copy, hardlink, symlink, relative/case/Unicode-normalization alias, contained copy, or different reviewed path yields zero marker/provider/signer/service/observer/lock/write activity.
- Deterministic tests require no live Anthropic, OpenAI, xAI, or Google call. Injected provider doubles exist only behind the synthetic-test capability; production-path tests use four temporary self-contained adapter sources bound by an ephemeral Eye-signed registry/grant and exercise the real production router.
- Disk-only replay is the sole source of derived lifecycle state, effective roots, evidence sets, status output, and handoff-bundle contents. In-memory state is disposable and never authoritative.
- A retry/death record never mutates the governed plan or implementation. Only an explicit mutation transition can change those roots, and every such mutation invalidates all downstream gates defined below.
- Every Eye transition references a separately signed Eye/TELOS authority artifact whose unique ID/ref, exact Eye actor tuple, immutable target, pinned trust ref, and `prefix_root` bind the lifecycle root immediately before the node. The implementation grant also signs the production `eye_trust_ref` and exact `provider_transport_registry_ref`. Its exact closed signed object is persisted immutably in the runtime's no-newline canonical framing as `implementation-grant.json`; `lifecycle.json.implementation_grant_ref` binds that grant and thereby transitively binds the content-addressed immutable secret-free registry without changing the fixed lifecycle-config vector. Initialization and every later production open, replay, status, resume, controller restart, checkpoint save, installation route, model invocation, and export must authenticate that stored grant/trust/registry chain against the separately supplied tracked TELOS root and root-signed authorization bootstrap. Every production CLI spelling therefore requires all four nonrepeatable flags: `--telos-eye-root <tracked-public-pem>`, `--expected-telos-eye-root-ref <externally-retained-raw-sha256-ref>`, `--authorization-bootstrap <exact-root-signed-packet>`, and `--expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>`. The public loader accepts those paths plus independent expected identities, never caller bytes or refs derived from supplied paths/runtime/grant/trust/registry/environment, and returns a runtime-bound brand retaining both lstat/realpath-validated external origins and exact authenticated buffers. Root/packet origin or raw-ref mismatch fails before parsing the root/packet or reading runtime state. Only after the packet authenticates exact raw grant/trust/registry bodies, reviewed commit, and helper descriptors may production read immutable config/grant/trust/key, require byte identity to the packet bodies, and resolve selected helpers. Any mismatch fails before selected-code evaluation, journals, projection, provider, observer, signer, lock, or write. Synthetic ephemeral trust/routes are admitted only through the distinct synthetic-test initialization capability and are permanently product-ineligible. The controller signature records a transition but cannot manufacture, rotate, or reuse authority or a route.
- Every required model decision references a closed provenance artifact bound to the profile seat, exact canonical seat-request ref, exact public-context ref, authenticated production route ref, attempt, route-validated or explicitly rejected response provider/model, response identifier/status, observation class, subject root, and lifecycle. The exact model and executable come only from the grant-bound registry route selected by the profile's immutable `route_id`, never provider output or caller flags. Production revalidates executable lstat/realpath/bytes before every no-shell spawn and accepts no transport command/invoker override. This proves a pinned-adapter runtime observation, not a provider-signed or detached-verifiable model receipt; final handoff reports that identity basis honestly. The request and its signed operation start commit a closed, bounded, resolver-derived public-context envelope containing the exact reviewable bytes behind every governed request ref; hashes without those bytes are never treated as review. A literal pass has no findings or dispositions.
- Every production adapter is accepted only by the one reviewed `dfm.closed-adapter-grammar.v1` validator whose exact bytes are signed through the registry and copied byte-for-byte into the plugin. The grammar uses a real syntax parse plus a closed token/dependency pass, rejects comments as declarations, every dynamic/computed import and every relative/absolute/file/data/network-selected source dependency, and permits only an explicit static `node:` allowlist. Each route signs the validator-derived complete self-contained dependency manifest/root as well as entry path/raw ref; validation repeats before any credential is projected and before every spawn.
- Every registry-observer invocation, including each pre-install marketplace/list/remove/add action, is owned by one fresh authenticated identity-fence transaction mediated by an already-running OS-protected native service. Node never spawns a runner pathname—doing so would recreate the same hash-to-exec race. The root-signed registry pins the service's exact self-measured image ref, protected service identity, local IPC endpoint/peer identity, Ed25519 receipt public key, bounds, and one host-specific contract: `linux-sealed-execveat-mounted-profile.v1` or `windows-locked-image-profile.v1`. The service/receipt-key boundary must be protected from the lifecycle user by root/Administrator ownership; absent protection, wrong peer/image/key, WSL-to-Windows interop, UNC/SMB profile, script/shebang observer, macOS/unlisted platform, or missing kernel capability fails `OBSERVER_CONSUMED_IDENTITY_UNATTESTED` before observer execution or any later command. After independently authenticating the bootstrap/grant/trust/registry, the controller sends one bounded canonical length-framed request containing only a fresh 32-byte canonical-base64url nonce and authenticated bootstrap/grant/registry/runner/observer/action refs—never caller path, argv, environment, executable, or profile overrides. The service independently reauthenticates those bodies and derives the exact action.

  On Linux the protected worker component-walks and opens the signed native ELF observer/profile and their parents without following links, matches stable opaque mount/file-handle identities, arms namespace watches, rereads/hashes the observer from the held descriptor, copies those exact bytes into a sealed `memfd`, verifies write/grow/shrink/seal locks, and executes only that descriptor with `execveat(..., AT_EMPTY_PATH)`. It clones the held profile directory with `open_tree`, exposes that retained directory object at the exact signed HOME pathname inside a private mount namespace with `move_mount`, and contains/waits for the whole process tree. On Windows the protected service rejects every reparse point, matches signed volume serial plus 128-bit file IDs, holds the observer without write/delete sharing and the profile without delete sharing through Job-Object process-tree exhaustion, and calls `CreateProcessW` with non-null exact `lpApplicationName`, exact command line/environment, and no search or shell. Parent/object watches and final handle/name checks are defense in depth. Any link, mount/reparse, in-place write, rename, delete, replace, rename-away/replace/restore event, watch/notification overflow, premature handle release, descendant escape, unsupported filesystem, or failed final re-resolution rejects even when pathname metadata is restored.

  The service returns one canonical signed `dfm.identity-fence-receipt.v1` whose unsigned body binds request ref/nonce, bootstrap/grant/registry/runner/observer/action refs, platform contract, runner image ref, source and consumed observer identities/raw refs/execution method, source and consumed profile identities/exposure method, fence-armed/process-tree-empty facts, zero namespace events with no overflow, and exact argv/environment-ref/cwd/status/signal/stdout/stderr bytes/counts/refs. The controller applies the universal canonical signature decoder and accepts only the root-pinned receipt key, exact nonce/request/action and consumed-image/profile equality, supported methods, zero events/overflow, complete process-tree exit, and byte/ref-equal output. Replay, duplicate nonce, signed rejection, or any mismatch yields zero evidence/persistence/later action. Controller-side pathname postchecks remain defense in depth rather than the consumed-identity claim. Each action uses an independent IPC connection, service worker, handles, nonce, receipt, and fence—never a grouped command.
- Persistent artifacts are closed typed envelopes. Raw prompts, raw provider responses, conversations, chain-of-thought, hidden reasoning, credentials, cookies, session tokens, and arbitrary untyped JSON are rejected.
- Atomic immutable plugin-local journal records are the lifecycle source of truth; lock files are advisory optimization only. A signed `invocation-prepared` record commits the exact unsigned decision and complete typed artifact set before materialization, making every crash boundary total and idempotent.
- Handoff is a closed content-addressed bundle containing immutable configuration and its derived `lifecycle_config_ref`, the persisted implementation grant, profile, public trust/delegation, chained journals/checkpoints, every reachable typed artifact, every transitively reachable raw blob/Git object, and a detached verifier. Production detached verification starts from the separately supplied tracked TELOS Eye root and authenticates both the grant and bundled root/delegation chain before trusting any Eye node. Handoff does not mutate `CURRENT-AUTHORITY.json`, grant authorization, merge, release, or enroll a module.
- Checkout, runtime, and handoff directories are physically disjoint realpaths with symlink/containment rejection. Handoff generation is in-memory deterministic, writes once to a fresh external directory, and cannot change the governed checkout.
- After each Daedalus/Icarus review-fix round, only a completed P1/C1 pair gate creates the durable entitlement for one strict plugin-owned lifecycle-round checkpoint, and that boundary selects the pair's exact fully settled Icarus operation. An Icarus-first partial pair creates no boundary or entitlement; either legal seat order creates exactly one only when both required peer operations have settled and the pair transition is replay-verifiable. Once a required boundary is uncovered, every later lifecycle transition—model/recovery/mutation/Eye/disk/retrospective/export—is fenced with `ROUND_CHECKPOINT_REQUIRED`; only read-only inspection and the controller's no-payload save may proceed. A fresh controller alone replays that entitlement at the exact pair-completion prefix, derives the payload, signs, and publishes it before any later transition or precompact/rotation. Mechanics are read-only/non-authoritative and can neither create entitlement nor write/close checkpoints.
- The synthetic end-to-end feature is named `content-addressed-note`; its bundle is explicitly test-only and never eligible for product handoff.

---

## File Structure

| Path | Responsibility |
|---|---|
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs` | JSON-domain validation, canonical JSON bytes, raw-byte SHA-256, credential/private-reasoning rejection, and closed decision validation |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs` | Byte-identical copy of the reviewed production credential detector; binary-safe physical/history/index/tree scanner, scanner-owned immutable-tree commit publisher, and persistence oracle |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-artifacts.mjs` | Closed schemas for findings, dispositions, requirements, plan candidates, implementations, provenance, authority, commands, manifests, and evidence |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-journal.mjs` | Crash-atomic immutable per-record publication, signed index/predecessor chains, CAS fencing, and orphan-temp verification |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-profiles/daedalus-family-v1.json` | Policy data for seats, stages, gate order, re-entry points, and explicit absence of automatic caps |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-profile.mjs` | Load and fail-closed validate the profile; expose stage lookup and profile hash |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-store.mjs` | Canonical artifact/raw/Git-object storage, atomic chained decision publication, and byte/signature/parent verification |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-operations.mjs` | Atomic signed start/prepared/terminal operation chain, committed artifacts, and decision/provenance linkage |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-authority.mjs` | Verify separately signed Eye/TELOS authority artifacts against declared trust roots and exact action/scope/subject |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-engine.mjs` | Pure reducer for pair gates, cold gates, retry lineage, governed mutations, recovery, and safe Eye actions |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-replay.mjs` | Verify disk records and replay every transition to derive the only authoritative state/evidence/export inputs |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-seat-adapter.mjs` | Verify exact request/context frames and convert injected provider results, outages, and malformed provenance into decision inputs without seat substitution |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-adapter-grammar.mjs` | Byte-identical reviewed parser for the closed comment-free static-node-only adapter grammar and dependency manifest/root |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-provider-transport.mjs` | Authenticate grant-bound per-seat route/model/executable identity and perform production no-shell byte-framed invocation with no caller command seam |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-disk-truth.mjs` | Re-hash a checkout and execute declared verification commands without a shell |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs` | Production-only anchored handoff wrapper; no synthetic class selector |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export-internal.mjs` | Capability-gated private deterministic bundle builder/writer shared by disjoint production and synthetic wrappers |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs` | Independently installed/tracked minimal launcher that hashes the trusted verifier and bundled copy before executing verified source bytes |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs` | Self-contained bundle verifier with externally anchored production mode and permanently ineligible synthetic-test mode |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-installation.mjs` | Closed pre-init authenticated per-command marketplace runner plus post-init branded evidence materializer bound only to fresh production replay |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-controller.mjs` | Serialized resumable production operations over the verified store using an external signer |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-synthetic-test.mjs` | Separate test-only synthetic initialization capability; cannot initialize or export production |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-cli.mjs` | init/status/resume/ingest/capture-implementation/prepare-seat-request/invoke/recover/mutate/eye/verify/checkpoint-save/atomic record-installation/export surface; no generic decision or production-retrospective append |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs` | Run the synthetic `content-addressed-note` lifecycle, including one failed cold review and Daedalus recovery |
| `/home/colchis/plugins/multi-model-seats/scripts/checkpoint.mjs` | Existing broad checkpoints plus isolated strict read-only `lifecycle-round` load/precompact argv modes and a non-argv append primitive importable only by the controller |
| `/home/colchis/plugins/multi-model-seats/tests/lifecycle-fixtures.mjs` | Shared deterministic profile/node builders and controller-key helper for lifecycle tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs` | Golden canonical-hash, schema, and secret tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-credential-gate.mjs` | NUL/binary, short-token/header, ignored/untracked, history/index/tree, scanner-error, index-race, CAS, and no-unsafe-commit credential-gate tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs` | Profile topology and governance-boundary tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs` | DAG publication, signature, Git-object identity, missing-parent, duplicate, cycle-by-construction, and root tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs` | Kill-point atomic publication, predecessor/index CAS, signer validation, reorder, and stale-lock fencing tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs` | Operation signature/state-machine, restart reconciliation, tamper, and cross-link tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs` | Eye signature, exact-root/scope/action, trust-root, and forgery tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs` | Gate order, independent reviewers, invalidation, recovery, no-cap, Eye action, and substitution tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs` | Restart, deterministic replay, journal tampering, evidence derivation, and byte-identical regeneration tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs` | Success, outage, malformed provenance, provider spoof, and secret tests with injected doubles |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-adapter-grammar.mjs` | Real-parse grammar, computed/dynamic/import-source, comment-marker, closure-root, and pre-credential rejection tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-provider-transport.mjs` | Route/registry/grant binding, executable identity, model derivation, and perfect-fake-command rejection tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs` | Tree mutation, path, symlink, command-success, and command-failure disk-truth tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs` | Exact-root export and stale/incomplete state rejection tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs` | Production CLI/controller resume, serialization, external signer, and fail-closed command tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs` | Synthetic capability separation and permanent production-ineligibility tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs` | Spawned end-to-end proof and on-disk verification |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs` | Strict stage-discriminated lifecycle-round schema, completed-pair/Icarus ownership, cold-context continuity, and precompact fail-closed tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs` | Full installable-package manifest/source-cache identity and cached full-suite/discoverability tests |
| `/home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs` | Self-contained signed temporary production materializer/retrospective/replay/export/detached call-chain proof with signed temporary adapters |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-fixtures/v1/acyclic-source/` | Fixed minimal vector-target files whose hashed entry set excludes every generated final-vector/bundle path |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-fixtures/v1/vector-signing-public.json` | Public-only controller/Eye fixture key declaration for verifying externally signed fixed vectors |
| `/home/colchis/plugins/multi-model-seats/scripts/generate-lifecycle-final-vectors.mjs` | Deterministically generate or read-only check the fixed acyclic final vector, bundle, and negative corpus |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-final-vectors.mjs` | Own generator write/check idempotence, closure exclusion, and stale-output detection |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-vectors/v1/vector.json` | Task-3-independent config and signed-journal literals |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-vectors/v1/final-vector.json` | Task-11 final implementation/checkpoint/manifest/bundle literals generated after the final verifier |
| `/home/colchis/plugins/multi-model-seats/skills/daedalus-family-lifecycle/SKILL.md` | User-facing Superpowers sequence, stage responsibilities, commands, and fail-return rule |
| `/home/colchis/plugins/multi-model-seats/.codex-plugin/plugin.json` | Version/capability metadata for the new lifecycle skill |
| `/home/colchis/plugins/multi-model-seats/scripts/bootstrap.mjs` | Add lifecycle runtime output to generated-project ignore rules |
| `/home/colchis/plugins/multi-model-seats/hooks/hooks.json` | Route lifecycle sessions through strict checkpoint rehydrate/precompact commands without changing broad mode |

## Execution Preconditions

- [ ] Before issuing this plugin's implementation grant, the TELOS integration owner must provision and review the complete external helper set. The exact tracked clean regular non-symlink, single-link files in reviewed source commit `P` are: canonicalizer `/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs`; credential detector `/home/colchis/Projects/TELOS/integrations/credential-detectors/dfm-credential-value-v1.mjs`; grammar validator `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/validate-closed-adapter-v1.mjs`; four adapters `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/anthropic-daedalus-v1.mjs`, `openai-icarus-v1.mjs`, `xai-grok-v1.mjs`, and `google-gemini-v1.mjs`; detached launcher source `/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-launch-v1.mjs`; and detached verifier source `/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-verify-v1.mjs`. Tasks 1-11 deliberately do not create or modify those external sources; Task 9 copies the launcher and verifier byte-for-byte to their exact plugin target paths after authenticating their source descriptors. The owner must also provision one reviewed platform-specific identity-fenced runner executable and one absolute Codex registry-observer executable plus its external profile directory. Those two executable paths may be platform-specific, but the bootstrap packet and root-signed registry bind their exact normalized byte-for-byte realpaths, raw refs, byte counts, single-link identities, protocol versions, and supported handle-lease backend; neither may come from `PATH` or a caller. The authority-publication commit may not change any tracked helper. The root-signed production registry binds exact canonicalizer, detector, validator, runner, observer, detached-source, plugin-target, profile, action, and four route/dependency descriptors—never a directory prefix, basename, or same-byte substitute.

  Each adapter must satisfy the external validator's exact `dfm.closed-adapter-grammar.v1`: strict UTF-8 Node ESM, no hashbang/comments/template or regular-expression literals, one structurally parsed leading `DFM_ADAPTER_CONTRACT` declaration, no top-level side effect before stdin handling, and only grammar-allowed static literal `node:` imports. The validator first parses with `vm.SourceTextModule` in a no-evaluation subprocess, then performs a complete token/dependency pass; every `import` token must correspond one-for-one to a reported static declaration. It rejects `import()`, computed/concatenated/aliased specifiers, `require`, `module.createRequire`, `eval`/function constructors, `import.meta.resolve`, workers/child processes, relative/absolute/file/data/http(s) specifiers, comments used as marker text, unresolved/duplicate dependencies, and every token outside the closed grammar. The parsed contract—not string search—must name protocol `dfm.seat-invocation-frame.v1` and exact response fields `context_ref`, `route_ref`, and `evidence_status`. Because the only dependencies are a unique sorted fixed allowlist of trusted `node:` built-ins, the complete dependency manifest is exactly `{ manifest_version: "dfm.adapter-dependency-manifest.v1", grammar_version: "dfm.closed-adapter-grammar.v1", entry_raw_ref, entry_byte_count, static_node_imports }`; its canonical ref is the route's `dependency_root`. The plugin's byte-identical validator copy independently re-derives the same body/ref at router construction and immediately before every invocation.

  The credential detector is a self-contained Node ESM module/CLI whose sole exported byte predicate and all CLI modes use the exact production classes/thresholds: token-prefix `sk-` at start or after a non-ASCII-alphanumeric boundary with at least 8 suffix characters, `Bearer`/`Basic` with at least 12 value characters including short `Authorization:` headers, private-key headers, GitHub tokens, `xox[baprs]-` with at least 10 suffix characters, `AIza` with at least 30 suffix characters, AWS access IDs, and Google refresh tokens. The explicit prefix boundary prevents ordinary words such as `disk-selected` from becoming credential matches without weakening a standalone or NUL-prefixed token. It scans one-to-one raw-byte/Latin-1 views so a NUL prefix, invalid UTF-8, or binary extension never hides an ASCII credential. Its closed modes are `self-test`, `scan-file`, `scan-physical`, `scan-precommit`, and `commit-scanned`; every target mode requires nonrepeatable `--expected-self-ref <signed-detector-raw-ref>`, stable-reads/hashes its own regular non-symlink source before the target, and fails unless that ref equals the independently retained registry value. `scan-file --path` performs the same stable no-follow raw-byte scan over one exact regular file. `commit-scanned` additionally accepts exactly one nonempty single-line `--message`, scans those exact UTF-8 message bytes, performs the complete physical/history checks including reachable commit/tag bodies, requires a symbolic local branch or its unborn form, snapshots its exact old HEAD/ref and index identity, materializes one immutable candidate tree with `git write-tree`, enumerates and scans every blob reachable from that exact tree OID, creates a commit only with `git commit-tree <accepted-tree>` and the exact observed parent when present, scans and structurally verifies that new commit body, and publishes only with `git update-ref <branch> <new-commit> <old-head-or-zero>`. The created commit's tree is re-read and must equal the accepted tree before and after compare-and-swap. It never invokes `git commit`, hooks, a shell, or a caller command. Index/ref drift, a CAS failure, or any error fails; a CAS failure may leave only an unreachable safe commit object, never a changed ref. A concurrent index replacement after tree materialization can at most make the command fail or leave the worktree/index dirty: it cannot alter the already scanned tree named by any published commit. Any missing/wrong/repeated self ref, unknown option, oversized input, invalid path, symlink/special file, unstable read, Git error, malformed index/history/tree/commit record, or child error exits nonzero. Its self-test constructs every positive only from fragments and includes negative policy-vocabulary controls. The plugin copy must be byte-identical to this reviewed external source. `lifecycle-core.mjs` never imports the detector by pathname; only the bootstrap-authorized selected-helper loader imports the once-read, exact-ref detector buffer, and production artifact/store/controller paths receive its retained scanner closure through the private `AuthenticatedGenesis` capability.

  Missing, dirty, wrong-ref, nonregular, multiply linked, unreviewed, grammar-incompatible, dependency-root-mismatched, or credential-bearing external bytes stop at `PROVIDER_ADAPTERS_PENDING`; a missing/wrong runner, registry observer, or unsupported consumed-identity backend stops at `REGISTRY_OBSERVER_PENDING`; canonicalizer drift stops at `CANONICALIZER_PENDING`; detector absence or drift stops at `CREDENTIAL_DETECTOR_PENDING`; detached launcher/verifier absence or drift stops at `DETACHED_HELPERS_PENDING`. Descriptor validation requires exact literal equality for every fixed path above and exact root-signed equality for the platform-specific runner/observer/profile paths before any `lstat`, read, import, or execution. No task may generate a substitute external file, weaken either grammar, accept a caller/PATH command, or ask The Eye to sign a nonexistent identity. Live provider authentication is a later Step 9 boundary and is never stored in these files.

- [ ] Compute the candidate plan root and validate the complete active Eye implementation-authorization record supplied for this exact plugin scope.

```bash
: "${EXPECTED_TELOS_EYE_ROOT_RAW_REF:?set from the independently retained Eye authorization packet or operator trust store}"
: "${TELOS_DFM_BOOTSTRAP_PACKET:?set to the external root-signed two-line DFM bootstrap packet}"
: "${EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF:?set from the independently retained Eye authorization packet or operator trust store}"
export EXPECTED_TELOS_EYE_ROOT_RAW_REF
export TELOS_DFM_BOOTSTRAP_PACKET EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF
node --input-type=module -e 'if (!/^sha256:[0-9a-f]{64}$/.test(process.env.EXPECTED_TELOS_EYE_ROOT_RAW_REF ?? "")) process.exit(1)'
node --input-type=module -e 'if (!/^sha256:[0-9a-f]{64}$/.test(process.env.EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF ?? "")) process.exit(1)'
export TELOS_EYE_ROOT_REL="docs/institutional-memory/telos/keys/eye-implementation-v1.public.pem"
export TELOS_EYE_ROOT_PEM="/home/colchis/Projects/TELOS/$TELOS_EYE_ROOT_REL"
export PLAN_PATH="/home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md"
export BOOTSTRAP_VERIFIED_MATERIAL="$(node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, normalize } from "node:path";

const rawRef = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const stableRegularBytes = (path, maxBytes) => {
  assert.equal(isAbsolute(path) && normalize(path) === path && path.normalize("NFC") === path && realpathSync(path) === path, true);
  const before = lstatSync(path);
  assert.equal(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= maxBytes, true);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    assert.deepEqual([opened.dev, opened.ino, opened.mode, opened.nlink, opened.size], [before.dev, before.ino, before.mode, before.nlink, before.size]);
    const bytes = readFileSync(fd);
    assert.equal(bytes.length, opened.size);
    const after = fstatSync(fd);
    const pathAfter = lstatSync(path);
    assert.deepEqual([after.dev, after.ino, after.mode, after.nlink, after.size, pathAfter.dev, pathAfter.ino, pathAfter.mode, pathAfter.nlink, pathAfter.size], [opened.dev, opened.ino, opened.mode, opened.nlink, opened.size, opened.dev, opened.ino, opened.mode, opened.nlink, opened.size]);
    return bytes;
  } finally { closeSync(fd); }
};
const decodeCanonicalBase64url = (value, exactLength = null) => {
  assert.equal(typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value) && !value.includes("=") && !/\s/.test(value), true);
  const bytes = Buffer.from(value, "base64url");
  assert.equal(bytes.toString("base64url"), value);
  if (exactLength !== null) assert.equal(bytes.length, exactLength);
  return bytes;
};
const rootBytes = stableRegularBytes(process.env.TELOS_EYE_ROOT_PEM, 65536);
assert.equal(rawRef(rootBytes), process.env.EXPECTED_TELOS_EYE_ROOT_RAW_REF);
const packetBytes = stableRegularBytes(process.env.TELOS_DFM_BOOTSTRAP_PACKET, 1048576);
assert.equal(rawRef(packetBytes), process.env.EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF);
const match = packetBytes.toString("ascii").match(/^([A-Za-z0-9_-]+)\n([A-Za-z0-9_-]{86})\n$/);
assert.ok(match, "bootstrap packet must be exact payload/signature LF framing");
const payloadBytes = decodeCanonicalBase64url(match[1]);
const signatureBytes = decodeCanonicalBase64url(match[2], 64);
const signedBytes = Buffer.concat([Buffer.from("telos.dfm-authorization-bootstrap.v1\0", "utf8"), payloadBytes]);
assert.equal(verify(null, signedBytes, createPublicKey(rootBytes), signatureBytes), true, "bootstrap signature invalid");
const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes));
assert.deepEqual(Object.keys(payload).sort(), ["authority_record", "bootstrap_version", "eye_trust", "plan", "profile_ref", "reviewed_head", "target", "transport_registry"]);
assert.equal(payload.bootstrap_version, "telos.dfm-authorization-bootstrap.v1");
assert.deepEqual(Object.keys(payload.plan).sort(), ["canonical_ref", "raw_ref", "realpath"]);
for (const name of ["authority_record", "eye_trust", "transport_registry"]) assert.deepEqual(Object.keys(payload[name]).sort(), ["canonical_ref", "raw_ref", "realpath"]);
for (const descriptor of [payload.plan, payload.authority_record, payload.eye_trust, payload.transport_registry]) {
  assert.equal(isAbsolute(descriptor.realpath) && normalize(descriptor.realpath) === descriptor.realpath, true);
  assert.match(descriptor.raw_ref, /^sha256:[0-9a-f]{64}$/);
  assert.match(descriptor.canonical_ref, /^sha256:[0-9a-f]{64}$/);
}
assert.equal(payload.plan.realpath, process.env.PLAN_PATH);
assert.match(payload.profile_ref, /^sha256:[0-9a-f]{64}$/);
assert.match(payload.reviewed_head, /^git:(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
assert.deepEqual(payload.target, { kind: "checkout", path: "/home/colchis/plugins/multi-model-seats", task_range: "1-11" });
process.stdout.write(JSON.stringify({
  payload_base64url: payloadBytes.toString("base64url"),
  root_pem_base64url: rootBytes.toString("base64url")
}));
NODE
)"
export BOOTSTRAP_VERIFIED_MATERIAL
export BOOTSTRAP_PAYLOAD_BASE64URL="$(jq -er '.payload_base64url' <<<"$BOOTSTRAP_VERIFIED_MATERIAL")"
export TELOS_EYE_ROOT_PEM_BASE64URL="$(jq -er '.root_pem_base64url' <<<"$BOOTSTRAP_VERIFIED_MATERIAL")"
export BOOTSTRAP_PAYLOAD_JSON="$(node --input-type=module -e 'const value = process.env.BOOTSTRAP_PAYLOAD_BASE64URL; if (!/^[A-Za-z0-9_-]+$/.test(value ?? "")) process.exit(1); const bytes = Buffer.from(value, "base64url"); if (bytes.toString("base64url") !== value) process.exit(1); process.stdout.write(new TextDecoder("utf-8", { fatal: true }).decode(bytes));')"
export BOOTSTRAP_PAYLOAD_JSON TELOS_EYE_ROOT_PEM_BASE64URL
export AUTHORIZED_PLAN_REF="$(jq -er '.plan.canonical_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export AUTHORIZED_PROFILE_REF="$(jq -er '.profile_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export PLAN_RAW_REF="$(jq -er '.plan.raw_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export AUTHORITY_PATH="$(jq -er '.authority_record.realpath' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export AUTHORITY_RAW_REF="$(jq -er '.authority_record.raw_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export AUTHORITY_CANONICAL_REF="$(jq -er '.authority_record.canonical_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export EYE_TRUST_JSON="$(jq -er '.eye_trust.realpath' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export EYE_TRUST_RAW_REF="$(jq -er '.eye_trust.raw_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export EYE_TRUST_REF="$(jq -er '.eye_trust.canonical_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export TRANSPORT_REGISTRY_JSON="$(jq -er '.transport_registry.realpath' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export TRANSPORT_REGISTRY_RAW_REF="$(jq -er '.transport_registry.raw_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export TRANSPORT_REGISTRY_REF="$(jq -er '.transport_registry.canonical_ref' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export REVIEWED_HEAD="$(jq -er '.reviewed_head' <<<"$BOOTSTRAP_PAYLOAD_JSON")"
export AUTHORITY_RECORD="$(node --input-type=module -e 'import { relative } from "node:path"; const value = relative("/home/colchis/Projects/TELOS", process.env.AUTHORITY_PATH); if (!/^(?!\.\.\/)[A-Za-z0-9._/-]+$/.test(value)) process.exit(1); process.stdout.write(value);')"
export EYE_TRUST_REL="$(node --input-type=module -e 'import { relative } from "node:path"; const value = relative("/home/colchis/Projects/TELOS", process.env.EYE_TRUST_JSON); if (!/^(?!\.\.\/)[A-Za-z0-9._/-]+$/.test(value)) process.exit(1); process.stdout.write(value);')"
export TRANSPORT_REGISTRY_REL="$(node --input-type=module -e 'import { relative } from "node:path"; const value = relative("/home/colchis/Projects/TELOS", process.env.TRANSPORT_REGISTRY_JSON); if (!/^(?!\.\.\/)[A-Za-z0-9._/-]+$/.test(value)) process.exit(1); process.stdout.write(value);')"
export TELOS_EYE_ROOT_RAW_REF="$EXPECTED_TELOS_EYE_ROOT_RAW_REF"
jq -e --arg ref "$AUTHORIZED_PLAN_REF" --arg target "/home/colchis/plugins/multi-model-seats" '
  .system == "TELOS" and
  .active_authorization.status == "AUTHORIZED" and
  .active_authorization.authorizes_plan == $ref and
  .implementation_authority.holder == "The Eye" and
  .implementation_authority.governs == $ref and
  .implementation_authority.next_slice != null and
  .implementation_authority.next_slice.plan_ref == $ref and
  .implementation_authority.next_slice.target_kind == "checkout" and
  .implementation_authority.next_slice.target_path == $target and
  .implementation_authority.next_slice.task_range == "1-11" and
  .implementation_authority.next_slice.status == "GRANTED" and
  (.implementation_authority.next_slice.authority_record | type == "string") and
  (.implementation_authority.next_slice.eye_trust_artifact | type == "string") and
  (.implementation_authority.next_slice.provider_transport_registry_artifact | type == "string")
' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json
export CURRENT_AUTHORITY_RECORD="$(jq -r '.implementation_authority.next_slice.authority_record' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json)"
export CURRENT_EYE_TRUST_REL="$(jq -r '.implementation_authority.next_slice.eye_trust_artifact' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json)"
export CURRENT_TRANSPORT_REGISTRY_REL="$(jq -r '.implementation_authority.next_slice.provider_transport_registry_artifact' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json)"
node --input-type=module -e 'for (const name of ["CURRENT_AUTHORITY_RECORD", "CURRENT_EYE_TRUST_REL", "CURRENT_TRANSPORT_REGISTRY_REL"]) { const value = process.env[name]; if (!/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/.test(value ?? "")) throw new Error(`unsafe authority path: ${name}`); }'
test "$CURRENT_AUTHORITY_RECORD" = "$AUTHORITY_RECORD"
test "$CURRENT_EYE_TRUST_REL" = "$EYE_TRUST_REL"
test "$CURRENT_TRANSPORT_REGISTRY_REL" = "$TRANSPORT_REGISTRY_REL"
node --input-type=module -e 'if (!/^git:(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(process.env.REVIEWED_HEAD ?? "")) process.exit(1)'
export REVIEWED_COMMIT="${REVIEWED_HEAD#git:}"
git -C /home/colchis/Projects/TELOS cat-file -e "$REVIEWED_COMMIT^{commit}"
git -C /home/colchis/Projects/TELOS merge-base --is-ancestor "$REVIEWED_COMMIT" HEAD
test "$(git -C /home/colchis/Projects/TELOS rev-list --count "$REVIEWED_COMMIT..HEAD")" -eq 1
git -C /home/colchis/Projects/TELOS ls-files --error-unmatch CURRENT-AUTHORITY.json "$AUTHORITY_RECORD" "$TELOS_EYE_ROOT_REL" "$EYE_TRUST_REL" "$TRANSPORT_REGISTRY_REL"
git -C /home/colchis/Projects/TELOS diff --quiet HEAD -- CURRENT-AUTHORITY.json "$AUTHORITY_RECORD" "$TELOS_EYE_ROOT_REL" "$EYE_TRUST_REL" "$TRANSPORT_REGISTRY_REL"
git -C /home/colchis/Projects/TELOS diff --quiet "$REVIEWED_COMMIT" HEAD -- docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md "$TELOS_EYE_ROOT_REL"
export AUTHORIZED_HELPER_BINDINGS="$(node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const requiredPublicationPaths = [
  "CURRENT-AUTHORITY.json",
  process.env.AUTHORITY_RECORD,
  process.env.EYE_TRUST_REL,
  process.env.TRANSPORT_REGISTRY_REL
].sort();
assert.equal(new Set(requiredPublicationPaths).size, requiredPublicationPaths.length);
for (const path of requiredPublicationPaths) {
  assert.match(path, /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/);
}
const result = spawnSync("git", ["-C", "/home/colchis/Projects/TELOS", "diff", "--name-only", "-z", process.env.REVIEWED_COMMIT, "HEAD"], { encoding: "buffer" });
assert.equal(result.status, 0);
assert.equal(result.stderr.length, 0);
const changed = result.stdout.subarray(0, result.stdout.length - (result.stdout.at(-1) === 0 ? 1 : 0)).toString("utf8").split("\0").filter(Boolean).sort();
assert.deepEqual(changed, requiredPublicationPaths, "post-review commit may publish only the exact authority state set");
NODE
node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, normalize, relative } from "node:path";
import { spawnSync } from "node:child_process";

function stableRegularBytes(path, maxBytes) {
  assert.equal(isAbsolute(path) && normalize(path) === path && path.normalize("NFC") === path && realpathSync(path) === path, true, `non-exact path: ${path}`);
  const before = lstatSync(path);
  assert.equal(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= maxBytes, true, `invalid regular file: ${path}`);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    assert.deepEqual([opened.dev, opened.ino, opened.mode, opened.nlink, opened.size], [before.dev, before.ino, before.mode, before.nlink, before.size]);
    const bytes = readFileSync(fd);
    assert.equal(bytes.length, opened.size);
    const after = fstatSync(fd);
    const pathAfter = lstatSync(path);
    assert.deepEqual([after.dev, after.ino, after.mode, after.nlink, after.size, pathAfter.dev, pathAfter.ino, pathAfter.mode, pathAfter.nlink, pathAfter.size], [opened.dev, opened.ino, opened.mode, opened.nlink, opened.size, opened.dev, opened.ino, opened.mode, opened.nlink, opened.size]);
    return bytes;
  } finally { closeSync(fd); }
}

function rawRef(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function decodeCanonicalEd25519Signature(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(value)) throw new Error("noncanonical Ed25519 signature");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 64 || bytes.toString("base64url") !== value) throw new Error("noncanonical Ed25519 signature");
  return bytes;
}

const bootstrap = JSON.parse(process.env.BOOTSTRAP_PAYLOAD_JSON);
const authorityBytes = stableRegularBytes(process.env.AUTHORITY_PATH, 1048576);
const trustBytes = stableRegularBytes(process.env.EYE_TRUST_JSON, 1048576);
const registryBytes = stableRegularBytes(process.env.TRANSPORT_REGISTRY_JSON, 1048576);
assert.equal(rawRef(authorityBytes), process.env.AUTHORITY_RAW_REF, "bootstrap-authenticated grant raw ref mismatch");
assert.equal(rawRef(trustBytes), process.env.EYE_TRUST_RAW_REF, "bootstrap-authenticated trust raw ref mismatch");
assert.equal(rawRef(registryBytes), process.env.TRANSPORT_REGISTRY_RAW_REF, "bootstrap-authenticated registry raw ref mismatch");
const raw = new TextDecoder("utf-8", { fatal: true }).decode(authorityBytes);
const record = JSON.parse(raw);
assert.deepEqual(Object.keys(record).sort(), ["action", "authority_version", "eye_trust_ref", "provider_transport_registry_ref", "reviewed_head", "scope", "signature", "status", "subject_ref"]);
assert.deepEqual(Object.keys(record.scope).sort(), ["profile_ref", "target_kind", "target_path", "task_range"]);
assert.deepEqual(Object.keys(record.signature).sort(), ["algorithm", "key_id", "value"]);
const trustRaw = new TextDecoder("utf-8", { fatal: true }).decode(trustBytes);
const trust = JSON.parse(trustRaw);
assert.deepEqual(Object.keys(trust).sort(), ["delegation", "eye_trust_version", "root", "trust_class"]);
assert.equal(trust.eye_trust_version, "dfm.eye-authority-trust.v1");
assert.equal(trust.trust_class, "production");
const registryRaw = new TextDecoder("utf-8", { fatal: true }).decode(registryBytes);
const registry = JSON.parse(registryRaw);
assert.deepEqual(Object.keys(registry).sort(), ["adapter_validator", "artifact_version", "canonicalizer", "credential_detector", "detached_launcher", "detached_verifier", "identity_fence_runner", "profile_ref", "registry_observer", "routes", "target"]);
assert.equal(registry.artifact_version, "dfm.production-transport-registry.v1");
assert.equal(registry.profile_ref, process.env.AUTHORIZED_PROFILE_REF);
assert.deepEqual(Object.keys(registry.target).sort(), ["kind", "path", "task_range"]);
assert.deepEqual(registry.target, { kind: "checkout", path: "/home/colchis/plugins/multi-model-seats", task_range: "1-11" });
const preExecutionRootBytes = Buffer.from(process.env.TELOS_EYE_ROOT_PEM_BASE64URL, "base64url");
assert.equal(preExecutionRootBytes.toString("base64url"), process.env.TELOS_EYE_ROOT_PEM_BASE64URL, "retained Eye root bytes must stay canonical");
assert.equal(rawRef(preExecutionRootBytes), process.env.TELOS_EYE_ROOT_RAW_REF, "Eye root must still equal the independently retained raw ref");
const preExecutionPublicKey = createPublicKey(preExecutionRootBytes);

const fixedPaths = {
  canonicalizer: "/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs",
  credentialDetector: "/home/colchis/Projects/TELOS/integrations/credential-detectors/dfm-credential-value-v1.mjs",
  adapterValidator: "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/validate-closed-adapter-v1.mjs",
  adapterValidatorTarget: "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-adapter-grammar.mjs",
  detachedLauncherSource: "/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-launch-v1.mjs",
  detachedVerifierSource: "/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-verify-v1.mjs",
  detachedLauncherTarget: "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs",
  detachedVerifierTarget: "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs"
};
assert.deepEqual(Object.keys(registry.canonicalizer).sort(), ["canonicalizer_version", "source_raw_ref", "source_realpath"]);
assert.equal(registry.canonicalizer.canonicalizer_version, "telos.canonical-json.v1");
assert.equal(registry.canonicalizer.source_realpath, fixedPaths.canonicalizer);
assert.deepEqual(Object.keys(registry.credential_detector).sort(), ["detector_version", "source_raw_ref", "source_realpath"]);
assert.equal(registry.credential_detector.detector_version, "dfm.credential-value-detector.v1");
assert.equal(registry.credential_detector.source_realpath, fixedPaths.credentialDetector);
assert.deepEqual(Object.keys(registry.adapter_validator).sort(), ["plugin_target_raw_ref", "plugin_target_realpath", "source_raw_ref", "source_realpath", "validator_version"]);
assert.equal(registry.adapter_validator.validator_version, "dfm.closed-adapter-grammar.v1");
assert.equal(registry.adapter_validator.source_realpath, fixedPaths.adapterValidator);
assert.equal(registry.adapter_validator.plugin_target_realpath, fixedPaths.adapterValidatorTarget);
assert.equal(registry.adapter_validator.plugin_target_raw_ref, registry.adapter_validator.source_raw_ref);
for (const [name, sourcePath, targetPath, version] of [
  ["detached_launcher", fixedPaths.detachedLauncherSource, fixedPaths.detachedLauncherTarget, "dfm.detached-launcher.v1"],
  ["detached_verifier", fixedPaths.detachedVerifierSource, fixedPaths.detachedVerifierTarget, "dfm.detached-verifier.v1"]
]) {
  const descriptor = registry[name];
  assert.deepEqual(Object.keys(descriptor).sort(), ["helper_version", "plugin_target_realpath", "source_raw_ref", "source_realpath"]);
  assert.equal(descriptor.helper_version, version);
  assert.equal(descriptor.source_realpath, sourcePath);
  assert.equal(descriptor.plugin_target_realpath, targetPath);
  assert.match(descriptor.source_raw_ref, /^sha256:[0-9a-f]{64}$/);
}
assert.deepEqual(Object.keys(registry.identity_fence_runner).sort(), ["endpoint", "executable_byte_count", "executable_raw_ref", "executable_realpath", "max_request_bytes", "max_result_bytes", "platform_contract", "protocol_version", "receipt_key", "runner_version", "service_identity", "timeout_ms"]);
assert.equal(registry.identity_fence_runner.runner_version, "dfm.identity-fence-runner.v1");
assert.equal(registry.identity_fence_runner.protocol_version, "dfm.identity-fence-ipc.v1");
assert.ok(["linux-sealed-execveat-mounted-profile.v1", "windows-locked-image-profile.v1"].includes(registry.identity_fence_runner.platform_contract));
assert.deepEqual(Object.keys(registry.identity_fence_runner.receipt_key).sort(), ["algorithm", "key_id", "public_key_der_base64"]);
assert.equal(registry.identity_fence_runner.receipt_key.algorithm, "ed25519");
for (const key of ["max_request_bytes", "max_result_bytes", "timeout_ms"]) assert.equal(Number.isSafeInteger(registry.identity_fence_runner[key]) && registry.identity_fence_runner[key] > 0, true);
if (registry.identity_fence_runner.platform_contract.startsWith("linux-")) {
  assert.deepEqual(Object.keys(registry.identity_fence_runner.endpoint).sort(), ["kind", "mode", "owner_gid", "owner_uid", "path"]);
  assert.equal(registry.identity_fence_runner.endpoint.kind, "unix-socket");
  assert.equal(registry.identity_fence_runner.endpoint.owner_uid, 0);
  assert.deepEqual(Object.keys(registry.identity_fence_runner.service_identity).sort(), ["executable_file_identity", "executable_owner_gid", "executable_owner_uid", "kind", "receipt_key_owner_uid", "service_gid", "service_uid", "unit"]);
  assert.equal(registry.identity_fence_runner.service_identity.kind, "systemd-unit");
  assert.equal(registry.identity_fence_runner.service_identity.executable_owner_uid, 0);
  assert.equal(registry.identity_fence_runner.service_identity.receipt_key_owner_uid, 0);
  assert.deepEqual(Object.keys(registry.identity_fence_runner.service_identity.executable_file_identity).sort(), ["dev_major", "dev_minor", "handle_bytes_base64url", "handle_type", "identity_version", "ino", "mount_id"]);
  assert.equal(registry.identity_fence_runner.service_identity.executable_file_identity.identity_version, "linux-file-handle.v1");
} else {
  assert.deepEqual(Object.keys(registry.identity_fence_runner.endpoint).sort(), ["kind", "name", "sddl", "service_sid"]);
  assert.equal(registry.identity_fence_runner.endpoint.kind, "windows-named-pipe");
  assert.deepEqual(Object.keys(registry.identity_fence_runner.service_identity).sort(), ["executable_file_identity", "image_owner_sid", "kind", "receipt_key_owner_sid", "service_name", "service_sid"]);
  assert.equal(registry.identity_fence_runner.service_identity.kind, "windows-service");
  assert.equal(registry.identity_fence_runner.service_identity.service_sid, registry.identity_fence_runner.endpoint.service_sid);
  assert.deepEqual(Object.keys(registry.identity_fence_runner.service_identity.executable_file_identity).sort(), ["file_id_128_hex", "identity_version", "volume_serial_hex"]);
  assert.equal(registry.identity_fence_runner.service_identity.executable_file_identity.identity_version, "windows-file-id.v1");
}
assert.deepEqual(Object.keys(registry.registry_observer).sort(), ["actions", "environment", "executable_byte_count", "executable_file_identity", "executable_kind", "executable_raw_ref", "executable_realpath", "observer_version", "profile_file_identity", "profile_root_realpath", "runner_ref", "unset_environment_keys"]);
assert.equal(registry.registry_observer.observer_version, "dfm.codex-registry-observer.v2");
assert.equal(registry.registry_observer.executable_kind, "self-contained-native");

const expectedAdapterPaths = {
  daedalus: "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/anthropic-daedalus-v1.mjs",
  icarus: "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/openai-icarus-v1.mjs",
  grok: "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/xai-grok-v1.mjs",
  gemini: "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/google-gemini-v1.mjs"
};
assert.equal(Array.isArray(registry.routes) && registry.routes.length === 4, true);
for (const route of registry.routes) assert.equal(route.executable_realpath, expectedAdapterPaths[route.seat]);

const trackedHelperPaths = [fixedPaths.canonicalizer, fixedPaths.credentialDetector, fixedPaths.adapterValidator, fixedPaths.detachedLauncherSource, fixedPaths.detachedVerifierSource, ...Object.values(expectedAdapterPaths)];
for (const sourcePath of trackedHelperPaths) {
  const rel = relative("/home/colchis/Projects/TELOS", sourcePath);
  assert.equal(!rel.startsWith("..") && !isAbsolute(rel), true);
  for (const args of [
    ["-C", "/home/colchis/Projects/TELOS", "ls-files", "--error-unmatch", rel],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", "HEAD", "--", rel],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", process.env.REVIEWED_COMMIT, "HEAD", "--", rel]
  ]) assert.equal(spawnSync("git", args).status, 0, `unreviewed helper path: ${rel}`);
}

const canonicalizerBytes = stableRegularBytes(fixedPaths.canonicalizer, 1048576);
assert.equal(rawRef(canonicalizerBytes), registry.canonicalizer.source_raw_ref);
const canonicalizer = await import(`data:text/javascript;base64,${canonicalizerBytes.toString("base64")}`);
assert.equal(typeof canonicalizer.canonicalize, "function");
assert.equal(typeof canonicalizer.sha256hex, "function");
const { canonicalize } = canonicalizer;
assert.equal(process.env.BOOTSTRAP_PAYLOAD_JSON, canonicalize(bootstrap), "bootstrap payload must be canonical after authentication");
assert.equal(raw, canonicalize(record) + "\n", "Eye authority bytes must be canonical JSON plus one newline");
assert.equal(trustRaw, canonicalize(trust) + "\n", "Eye trust bytes must be canonical JSON plus one newline");
assert.equal(registryRaw, canonicalize(registry) + "\n", "transport registry bytes must be canonical JSON plus one newline");
const canonicalRef = (value) => `sha256:${createHash("sha256").update(Buffer.from(canonicalize(value), "utf8")).digest("hex")}`;
assert.equal(canonicalRef(record), process.env.AUTHORITY_CANONICAL_REF, "grant canonical ref must equal the bootstrap packet");
assert.equal(canonicalRef(trust), process.env.EYE_TRUST_REF, "stable trust bytes must equal the grant-selected canonical ref");
assert.equal(canonicalRef(registry), process.env.TRANSPORT_REGISTRY_REF, "stable registry bytes must equal the grant-selected canonical ref");
const verifyGrantBeforeSelectedCode = (candidate) => {
  try {
    const { signature, ...unsigned } = candidate;
    if (signature?.algorithm !== "ed25519" || signature?.key_id !== "eye-implementation-v1") return false;
    if (candidate.authority_version !== "telos.eye-implementation-authority.v1") return false;
    if (candidate.action !== "grant-implementation" || candidate.status !== "GRANTED") return false;
    if (candidate.subject_ref !== process.env.AUTHORIZED_PLAN_REF) return false;
    if (candidate.scope?.target_kind !== "checkout" || candidate.scope?.target_path !== "/home/colchis/plugins/multi-model-seats") return false;
    if (candidate.scope?.task_range !== "1-11" || candidate.scope?.profile_ref !== process.env.AUTHORIZED_PROFILE_REF || candidate.reviewed_head !== process.env.REVIEWED_HEAD) return false;
    if (candidate.eye_trust_ref !== process.env.EYE_TRUST_REF) return false;
    if (candidate.provider_transport_registry_ref !== process.env.TRANSPORT_REGISTRY_REF) return false;
    return verify(null, Buffer.from(canonicalize(unsigned), "utf8"), preExecutionPublicKey, decodeCanonicalEd25519Signature(signature.value));
  } catch {
    return false;
  }
};
assert.equal(verifyGrantBeforeSelectedCode(record), true, "grant must authenticate before registry-selected code");
const requiredEyeActions = ["accept-implementation", "adjudicate", "amend-policy", "amend-requirement", "authorize-plan", "cancel", "freeze-requirements", "pause", "return-implementation", "return-plan", "return-requirements"];
const verifyTrustBeforeSelectedCode = (candidate) => {
  try {
    if (candidate.eye_trust_version !== "dfm.eye-authority-trust.v1" || candidate.trust_class !== "production") return false;
    if (JSON.stringify(Object.keys(candidate).sort()) !== JSON.stringify(["delegation", "eye_trust_version", "root", "trust_class"])) return false;
    if (JSON.stringify(Object.keys(candidate.root ?? {}).sort()) !== JSON.stringify(["key_id", "public_key_der_base64"])) return false;
    const pinnedDer = preExecutionPublicKey.export({ type: "spki", format: "der" });
    if (!Buffer.from(candidate.root.public_key_der_base64, "base64").equals(pinnedDer)) return false;
    if (candidate.root.key_id !== record.signature.key_id) return false;
    if (candidate.delegation === null) return true;
    const delegation = candidate.delegation;
    if (JSON.stringify(Object.keys(delegation).sort()) !== JSON.stringify(["delegate", "delegation_version", "issued_at", "scope", "signature"])) return false;
    if (delegation.delegation_version !== "telos.eye-delegation.v1") return false;
    if (JSON.stringify(Object.keys(delegation.delegate ?? {}).sort()) !== JSON.stringify(["key_id", "public_key_der_base64"])) return false;
    if (JSON.stringify(Object.keys(delegation.scope ?? {}).sort()) !== JSON.stringify(["actions", "profile_ref", "target"])) return false;
    if (delegation.scope.profile_ref !== process.env.AUTHORIZED_PROFILE_REF) return false;
    if (JSON.stringify(delegation.scope.actions) !== JSON.stringify(requiredEyeActions)) return false;
    if (JSON.stringify(Object.keys(delegation.scope.target ?? {}).sort()) !== JSON.stringify(["kind", "path", "task_range"])) return false;
    if (delegation.scope.target.kind !== "checkout" || delegation.scope.target.path !== "/home/colchis/plugins/multi-model-seats" || delegation.scope.target.task_range !== "1-11") return false;
    if (typeof delegation.issued_at !== "string" || !Number.isFinite(Date.parse(delegation.issued_at))) return false;
    if (JSON.stringify(Object.keys(delegation.signature ?? {}).sort()) !== JSON.stringify(["algorithm", "key_id", "value"])) return false;
    if (delegation.signature.algorithm !== "ed25519" || delegation.signature.key_id !== candidate.root.key_id) return false;
    createPublicKey({ key: Buffer.from(delegation.delegate.public_key_der_base64, "base64"), format: "der", type: "spki" });
    const { signature, ...unsigned } = delegation;
    return verify(null, Buffer.from(canonicalize(unsigned), "utf8"), preExecutionPublicKey, decodeCanonicalEd25519Signature(signature.value));
  } catch {
    return false;
  }
};
assert.equal(verifyTrustBeforeSelectedCode(trust), true, "production trust/delegation must authenticate before registry-selected code");
assert.deepEqual(registry.registry_observer.actions, [
  { action_id: "marketplace-list", argv: ["plugin", "marketplace", "list", "--json"], mutation_class: "read-only" },
  { action_id: "plugin-add", argv: ["plugin", "add", "multi-model-seats@multi-model-local", "--json"], mutation_class: "profile-write" },
  { action_id: "plugin-list", argv: ["plugin", "list", "--json"], mutation_class: "read-only" },
  { action_id: "plugin-remove", argv: ["plugin", "remove", "multi-model-seats@multi-model-local", "--json"], mutation_class: "profile-write" }
]);
assert.deepEqual(Object.keys(registry.registry_observer.environment).sort(), ["HOME", "LANG"]);
assert.equal(registry.registry_observer.environment.LANG, "C.UTF-8");
assert.deepEqual(registry.registry_observer.unset_environment_keys, ["CODEX_HOME", "CODEX_SQLITE_HOME"]);
for (const key of ["HOME", "LANG"]) assert.equal(typeof registry.registry_observer.environment[key] === "string" && registry.registry_observer.environment[key].length > 0, true);
for (const path of [registry.canonicalizer.source_realpath, registry.credential_detector.source_realpath, registry.adapter_validator.source_realpath, registry.detached_launcher.source_realpath, registry.detached_verifier.source_realpath, registry.identity_fence_runner.executable_realpath, registry.registry_observer.executable_realpath, registry.registry_observer.profile_root_realpath, registry.registry_observer.environment.HOME]) {
  assert.equal(isAbsolute(path) && normalize(path) === path, true);
}
assert.equal(realpathSync(registry.canonicalizer.source_realpath), registry.canonicalizer.source_realpath);
assert.equal(realpathSync(registry.credential_detector.source_realpath), registry.credential_detector.source_realpath);
assert.equal(realpathSync(registry.adapter_validator.source_realpath), registry.adapter_validator.source_realpath);
assert.equal(realpathSync(registry.detached_launcher.source_realpath), registry.detached_launcher.source_realpath);
assert.equal(realpathSync(registry.detached_verifier.source_realpath), registry.detached_verifier.source_realpath);
assert.equal(realpathSync(registry.identity_fence_runner.executable_realpath), registry.identity_fence_runner.executable_realpath);
assert.equal(realpathSync(registry.registry_observer.executable_realpath), registry.registry_observer.executable_realpath);
assert.equal(realpathSync(registry.registry_observer.profile_root_realpath), registry.registry_observer.profile_root_realpath);
assert.equal(registry.registry_observer.environment.HOME, registry.registry_observer.profile_root_realpath);
assert.notEqual(dirname(registry.registry_observer.profile_root_realpath), registry.registry_observer.profile_root_realpath, "filesystem root cannot be a registry profile");
const observerProfileStat = lstatSync(registry.registry_observer.profile_root_realpath);
assert.equal(observerProfileStat.isDirectory() && !observerProfileStat.isSymbolicLink(), true);
if (registry.identity_fence_runner.platform_contract.startsWith("linux-")) {
  assert.deepEqual(Object.keys(registry.registry_observer.executable_file_identity).sort(), ["dev_major", "dev_minor", "handle_bytes_base64url", "handle_type", "identity_version", "ino", "mount_id"]);
  assert.deepEqual(Object.keys(registry.registry_observer.profile_file_identity).sort(), ["dev_major", "dev_minor", "handle_bytes_base64url", "handle_type", "identity_version", "ino", "mount_id"]);
  assert.equal(registry.registry_observer.executable_file_identity.identity_version, "linux-file-handle.v1");
  assert.equal(registry.registry_observer.profile_file_identity.identity_version, "linux-file-handle.v1");
} else {
  assert.deepEqual(Object.keys(registry.registry_observer.executable_file_identity).sort(), ["file_id_128_hex", "identity_version", "volume_serial_hex"]);
  assert.deepEqual(Object.keys(registry.registry_observer.profile_file_identity).sort(), ["file_id_128_hex", "identity_version", "volume_serial_hex"]);
  assert.equal(registry.registry_observer.executable_file_identity.identity_version, "windows-file-id.v1");
  assert.equal(registry.registry_observer.profile_file_identity.identity_version, "windows-file-id.v1");
}
const runnerBytes = stableRegularBytes(registry.identity_fence_runner.executable_realpath, 536870912);
const observerBytes = stableRegularBytes(registry.registry_observer.executable_realpath, 536870912);
assert.equal(runnerBytes.length, registry.identity_fence_runner.executable_byte_count);
assert.equal(observerBytes.length, registry.registry_observer.executable_byte_count);
assert.equal(rawRef(runnerBytes), registry.identity_fence_runner.executable_raw_ref);
assert.equal(rawRef(observerBytes), registry.registry_observer.executable_raw_ref);
assert.equal(canonicalRef(registry.identity_fence_runner), registry.registry_observer.runner_ref);
for (const forbiddenRoot of [registry.target.path, "/home/colchis/Projects/TELOS"]) {
  const relativeObserver = relative(forbiddenRoot, registry.registry_observer.executable_realpath);
  assert.equal(relativeObserver === "" || (!relativeObserver.startsWith("..") && !isAbsolute(relativeObserver)), false, "registry observer must be external to governed source/TELOS");
  const relativeProfile = relative(forbiddenRoot, registry.registry_observer.profile_root_realpath);
  assert.equal(relativeProfile === "" || (!relativeProfile.startsWith("..") && !isAbsolute(relativeProfile)), false, "registry profile root must not be inside governed source/TELOS");
}
for (const [kind, sourcePath, requiredPath] of [
  ["CANONICALIZER_PENDING", registry.canonicalizer.source_realpath, "merkle-dag/vendor.mjs"],
  ["CREDENTIAL_DETECTOR_PENDING", registry.credential_detector.source_realpath, "integrations/credential-detectors/dfm-credential-value-v1.mjs"],
  ["PROVIDER_ADAPTERS_PENDING", registry.adapter_validator.source_realpath, "integrations/provider-adapters/daedalus-family-v1/validate-closed-adapter-v1.mjs"],
  ["DETACHED_HELPERS_PENDING", registry.detached_launcher.source_realpath, "integrations/detached-verification/daedalus-family-v1/lifecycle-detached-launch-v1.mjs"],
  ["DETACHED_HELPERS_PENDING", registry.detached_verifier.source_realpath, "integrations/detached-verification/daedalus-family-v1/lifecycle-detached-verify-v1.mjs"]
]) {
  const rel = relative("/home/colchis/Projects/TELOS", sourcePath);
  assert.equal(rel, requiredPath, kind);
  for (const args of [
    ["-C", "/home/colchis/Projects/TELOS", "ls-files", "--error-unmatch", rel],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", "HEAD", "--", rel],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", process.env.REVIEWED_COMMIT, "HEAD", "--", rel]
  ]) assert.equal(spawnSync("git", args).status, 0, kind);
}
const credentialDetectorBytes = stableRegularBytes(registry.credential_detector.source_realpath, 1048576);
const adapterValidatorBytes = stableRegularBytes(registry.adapter_validator.source_realpath, 1048576);
const detachedLauncherBytes = stableRegularBytes(registry.detached_launcher.source_realpath, 1048576);
const detachedVerifierBytes = stableRegularBytes(registry.detached_verifier.source_realpath, 1048576);
assert.equal(rawRef(credentialDetectorBytes), registry.credential_detector.source_raw_ref);
assert.equal(rawRef(adapterValidatorBytes), registry.adapter_validator.source_raw_ref);
assert.equal(rawRef(detachedLauncherBytes), registry.detached_launcher.source_raw_ref);
assert.equal(rawRef(detachedVerifierBytes), registry.detached_verifier.source_raw_ref);
const credentialDetector = await import(`data:text/javascript;base64,${credentialDetectorBytes.toString("base64")}`);
const adapterValidator = await import(`data:text/javascript;base64,${adapterValidatorBytes.toString("base64")}`);
assert.equal(credentialDetector.DETECTOR_VERSION, registry.credential_detector.detector_version);
assert.equal(adapterValidator.VALIDATOR_VERSION, registry.adapter_validator.validator_version);
assert.equal(typeof credentialDetector.scanCredentialBytes, "function");
assert.equal(typeof credentialDetector.runCredentialGate, "function");
assert.equal(typeof adapterValidator.validateClosedAdapterBytes, "function");
assert.equal(credentialDetector.scanCredentialBytes(Buffer.from(canonicalize(registry.registry_observer), "utf8")).length, 0, "REGISTRY_OBSERVER_PENDING");
const planBytes = stableRegularBytes(process.env.PLAN_PATH, 1048576);
assert.equal(rawRef(planBytes), process.env.PLAN_RAW_REF, "authorized plan raw transport ref mismatch");
const plan = new TextDecoder("utf-8", { fatal: true }).decode(planBytes);
assert.equal(canonicalRef({ kind: "candidate", plan }), process.env.AUTHORIZED_PLAN_REF, "authorized plan candidate ref mismatch");
const marker = "Create `records/lifecycle-profiles/daedalus-family-v1.json`:";
const profileMatch = plan.slice(plan.lastIndexOf(marker) + marker.length).match(/^\s*```json\n([\s\S]*?)\n```/);
assert.ok(profileMatch);
const profile = JSON.parse(profileMatch[1]);
assert.equal(canonicalRef(profile), process.env.AUTHORIZED_PROFILE_REF, "authorized profile ref mismatch");
const envAllow = {
  anthropic: new Set(["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"]),
  openai: new Set(["OPENAI_API_KEY"]),
  xai: new Set(["XAI_API_KEY"]),
  google: new Set(["GEMINI_API_KEY", "GOOGLE_API_KEY"])
};
const expectedSeats = ["daedalus", "icarus", "grok", "gemini"];
const adapterRoot = "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1";
const expectedAdapterNames = {
  daedalus: "anthropic-daedalus-v1.mjs",
  icarus: "openai-icarus-v1.mjs",
  grok: "xai-grok-v1.mjs",
  gemini: "google-gemini-v1.mjs"
};
assert.equal(Array.isArray(registry.routes), true);
assert.equal(registry.routes.length, expectedSeats.length);
assert.deepEqual(registry.routes.map((route) => route.route_id), [...registry.routes.map((route) => route.route_id)].sort());
assert.deepEqual(registry.routes.map((route) => route.seat).sort(), [...expectedSeats].sort());
for (const route of registry.routes) {
  assert.deepEqual(Object.keys(route).sort(), ["dependency_manifest", "dependency_root", "environment_keys", "executable_raw_ref", "executable_realpath", "model", "observation_class", "protocol_version", "provider", "route_id", "seat"]);
  assert.ok(expectedSeats.includes(route.seat));
  assert.equal(route.provider, profile.seats[route.seat].provider);
  assert.equal(route.route_id, profile.seats[route.seat].route_id);
  assert.equal(route.executable_realpath, `${adapterRoot}/${expectedAdapterNames[route.seat]}`);
  assert.equal(typeof route.model === "string" && route.model.length > 0, true);
  assert.equal(isAbsolute(route.executable_realpath) && normalize(route.executable_realpath) === route.executable_realpath, true);
  assert.match(route.executable_raw_ref, /^sha256:[0-9a-f]{64}$/);
  assert.equal(route.protocol_version, "dfm.seat-invocation-frame.v1");
  assert.equal(route.observation_class, "pinned-adapter-runtime-observation");
  assert.deepEqual(Object.keys(route.dependency_manifest).sort(), ["entry_byte_count", "entry_raw_ref", "grammar_version", "manifest_version", "static_node_imports"]);
  assert.equal(route.dependency_manifest.manifest_version, "dfm.adapter-dependency-manifest.v1");
  assert.equal(route.dependency_manifest.grammar_version, registry.adapter_validator.validator_version);
  assert.equal(route.dependency_manifest.entry_raw_ref, route.executable_raw_ref);
  assert.deepEqual(route.dependency_manifest.static_node_imports, [...new Set(route.dependency_manifest.static_node_imports)].sort());
  assert.equal(`sha256:${createHash("sha256").update(Buffer.from(canonicalize(route.dependency_manifest), "utf8")).digest("hex")}`, route.dependency_root);
  assert.equal(Array.isArray(route.environment_keys) && route.environment_keys.length > 0, true);
  assert.deepEqual(route.environment_keys, [...new Set(route.environment_keys)].sort());
  assert.equal(route.environment_keys.every((key) => envAllow[route.provider]?.has(key)), true);
  let stat;
  try { stat = lstatSync(route.executable_realpath); } catch { throw new Error(`PROVIDER_ADAPTERS_PENDING: ${route.route_id}`); }
  assert.equal(stat.isFile() && !stat.isSymbolicLink(), true, `PROVIDER_ADAPTERS_PENDING: ${route.route_id}`);
  assert.equal(realpathSync(route.executable_realpath), route.executable_realpath, `PROVIDER_ADAPTERS_PENDING: ${route.route_id}`);
  const adapterBytes = stableRegularBytes(route.executable_realpath, 1048576);
  assert.equal(`sha256:${createHash("sha256").update(adapterBytes).digest("hex")}`, route.executable_raw_ref, `PROVIDER_ADAPTERS_PENDING: ${route.route_id}`);
  assert.equal(route.dependency_manifest.entry_byte_count, adapterBytes.length);
  assert.equal(credentialDetector.scanCredentialBytes(adapterBytes).length, 0, `PROVIDER_ADAPTERS_PENDING: ${route.route_id}`);
  const derivedDependency = adapterValidator.validateClosedAdapterBytes({ bytes: adapterBytes, environmentKeys: route.environment_keys });
  assert.deepEqual(derivedDependency, route.dependency_manifest, `PROVIDER_ADAPTERS_PENDING: ${route.route_id}`);
  const rel = relative("/home/colchis/Projects/TELOS", route.executable_realpath);
  assert.equal(rel.startsWith("integrations/provider-adapters/daedalus-family-v1/") && !rel.includes(".."), true);
  for (const args of [
    ["-C", "/home/colchis/Projects/TELOS", "ls-files", "--error-unmatch", rel],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", "HEAD", "--", rel],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", process.env.REVIEWED_COMMIT, "HEAD", "--", rel]
  ]) assert.equal(spawnSync("git", args).status, 0, `PROVIDER_ADAPTERS_PENDING: ${route.route_id}`);
}
const observerProfileAfter = lstatSync(registry.registry_observer.profile_root_realpath);
assert.deepEqual(
  [observerProfileAfter.dev, observerProfileAfter.ino, observerProfileAfter.mode, realpathSync(registry.registry_observer.profile_root_realpath)],
  [observerProfileStat.dev, observerProfileStat.ino, observerProfileStat.mode, registry.registry_observer.profile_root_realpath],
  "registry profile root identity drift"
);
for (const mutate of [
  (value) => { value.subject_ref = "sha256:" + "0".repeat(64); },
  (value) => { value.scope.target_path = "/tmp/wrong-scope"; },
  (value) => { value.scope.target_kind = "runtime"; },
  (value) => { value.scope.task_range = "1-10"; },
  (value) => { value.eye_trust_ref = "sha256:" + "1".repeat(64); },
  (value) => { value.provider_transport_registry_ref = "sha256:" + "2".repeat(64); },
  (value) => { value.signature.key_id = "untrusted-eye-key"; },
  (value) => { value.signature.value = (value.signature.value.startsWith("A") ? "B" : "A") + value.signature.value.slice(1); }
]) {
  const changed = structuredClone(record);
  mutate(changed);
  assert.equal(verifyGrantBeforeSelectedCode(changed), false, "mutated Eye authority must fail");
}
for (const mutate of [
  (value) => { value.root.public_key_der_base64 = Buffer.alloc(44).toString("base64"); },
  (value) => { value.trust_class = "synthetic-test"; },
  (value) => { if (value.delegation) value.delegation.scope.target.path = "/tmp/wrong-scope"; else value.root.key_id = "wrong-root"; },
  (value) => { if (value.delegation) value.delegation.signature.value = (value.delegation.signature.value.startsWith("A") ? "B" : "A") + value.delegation.signature.value.slice(1); else value.root.key_id = "wrong-root"; }
]) {
  const changed = structuredClone(trust);
  mutate(changed);
  assert.equal(verifyTrustBeforeSelectedCode(changed), false, "mutated production trust must fail");
}
const base64urlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const noncanonicalTailAlias = (value) => {
  const index = base64urlAlphabet.indexOf(value.at(-1));
  assert.equal(index >= 0 && index % 16 === 0, true);
  return value.slice(0, -1) + base64urlAlphabet[index + 1];
};
const invalidSignatureEncodings = (value) => ["", `${value}=`, `${value}==`, `${value.slice(0, 8)}\n${value.slice(8)}`, `${value.slice(0, 8)}+${value.slice(9)}`, `${value}A`, value.slice(0, -1), noncanonicalTailAlias(value)];
for (const badValue of invalidSignatureEncodings(record.signature.value)) {
  const changed = structuredClone(record);
  changed.signature.value = badValue;
  assert.equal(verifyGrantBeforeSelectedCode(changed), false, "noncanonical grant signature must fail");
}
if (trust.delegation) {
  for (const badValue of invalidSignatureEncodings(trust.delegation.signature.value)) {
    const changed = structuredClone(trust);
    changed.delegation.signature.value = badValue;
    assert.equal(verifyTrustBeforeSelectedCode(changed), false, "noncanonical delegation signature must fail");
  }
}
process.stdout.write(JSON.stringify({
  credential_detector_path: registry.credential_detector.source_realpath,
  credential_detector_raw_ref: registry.credential_detector.source_raw_ref,
  detached_launcher_raw_ref: registry.detached_launcher.source_raw_ref,
  detached_verifier_raw_ref: registry.detached_verifier.source_raw_ref
}));
NODE
)"
export AUTHORIZED_HELPER_BINDINGS
export CREDENTIAL_DETECTOR_PATH="$(jq -er '.credential_detector_path' <<<"$AUTHORIZED_HELPER_BINDINGS")"
export CREDENTIAL_DETECTOR_RAW_REF="$(jq -er '.credential_detector_raw_ref' <<<"$AUTHORIZED_HELPER_BINDINGS")"
export DETACHED_LAUNCHER_RAW_REF="$(jq -er '.detached_launcher_raw_ref' <<<"$AUTHORIZED_HELPER_BINDINGS")"
export DETACHED_VERIFIER_RAW_REF="$(jq -er '.detached_verifier_raw_ref' <<<"$AUTHORIZED_HELPER_BINDINGS")"
readonly CREDENTIAL_DETECTOR_PATH CREDENTIAL_DETECTOR_RAW_REF DETACHED_LAUNCHER_RAW_REF DETACHED_VERIFIER_RAW_REF
run_credential_gate() {
  node --input-type=module --eval '
    import assert from "node:assert/strict";
    import { createHash } from "node:crypto";
    import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
    import { isAbsolute, normalize } from "node:path";
    const [helperPath, expectedRef, ...argv] = process.argv.slice(1);
    assert.ok([
      "/home/colchis/Projects/TELOS/integrations/credential-detectors/dfm-credential-value-v1.mjs",
      "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs"
    ].includes(helperPath));
    assert.match(expectedRef ?? "", /^sha256:[0-9a-f]{64}$/);
    assert.equal(isAbsolute(helperPath) && normalize(helperPath) === helperPath && helperPath.normalize("NFC") === helperPath && realpathSync(helperPath) === helperPath, true);
    const before = lstatSync(helperPath);
    assert.equal(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= 1048576, true);
    const fd = openSync(helperPath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let bytes;
    try {
      const opened = fstatSync(fd);
      assert.deepEqual([opened.dev, opened.ino, opened.mode, opened.nlink, opened.size], [before.dev, before.ino, before.mode, before.nlink, before.size]);
      bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const pathAfter = lstatSync(helperPath);
      assert.deepEqual([after.dev, after.ino, after.mode, after.nlink, after.size, pathAfter.dev, pathAfter.ino, pathAfter.mode, pathAfter.nlink, pathAfter.size], [opened.dev, opened.ino, opened.mode, opened.nlink, opened.size, opened.dev, opened.ino, opened.mode, opened.nlink, opened.size]);
    } finally { closeSync(fd); }
    assert.equal(`sha256:${createHash("sha256").update(bytes).digest("hex")}`, expectedRef);
    const helper = await import(`data:text/javascript;base64,${bytes.toString("base64")}`);
    assert.equal(typeof helper.runCredentialGate, "function");
    const status = await helper.runCredentialGate(argv);
    assert.equal(Number.isSafeInteger(status) && status >= 0 && status <= 255, true);
    process.exitCode = status;
  ' -- "$@"
}
readonly -f run_credential_gate
sha256sum /home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md
```

Expected: the CURRENT-authority check and stable-file verifier exit 0. Independently retained raw refs authenticate both the bounded no-follow Eye-root read and the root-signed two-line bootstrap packet before CURRENT authority, grant, trust, registry, plan, Git, or selected-code claims are trusted. The packet signature covers exact raw canonical payload bytes and authenticates the plan/profile/target, raw and canonical grant/trust/registry descriptors, and reviewed commit. Authorization uses an explicit two-commit protocol: reviewed source commit `P` contains the final plan, unchanged tracked Eye root, fixed canonicalizer, detector, validator, four adapter sources, and detached launcher/verifier sources; the grant signs `reviewed_head = git:P`; exactly one descendant authority-publication commit changes exactly `CURRENT-AUTHORITY.json`, the named authority record, named production trust artifact, and named transport registry—no plan, root, helper, implementation, or other path. Before any selected code, the verifier hashes exact bootstrap-authenticated grant/trust/registry bytes, validates their closed raw structure, requires every fixed literal realpath plus every exact root-signed platform path, and proves all tracked helpers clean at `P` and HEAD. It then stable-opens the exact canonicalizer once, hashes that buffer to the authenticated descriptor, imports only that buffer, and uses it to re-prove canonical packet/grant/trust/registry/plan/profile bodies/refs plus canonical grant/delegation signatures. Only then may it stable-open/hash/import the exact detector and validator buffers or validate other selected helpers/routes. Every fixed source/target and signed platform path rejects basenames, prefixes, same-byte alternate filenames, hardlinks, symlinks, relative aliases, case/Unicode-normalization aliases, contained copies, and different reviewed paths; each source buffer is read once and never reopened for import. The registry also binds the OS-protected identity-fence service image/IPC peer/receipt key/backend, exact native observer and profile file identities, four closed actions, detached source and target paths/refs, and exact secret-free four-seat routes/dependencies. Negative harnesses cover forged packet/grant/registry, top-level markers, atomic swaps, second-read attempts, exact-path replacement, and every canonical signature alias; rejection leaves zero marker/provider/signer/observer/service/lock/write activity. The raw plan checksum is transport integrity only. The currently recorded Clotho authority intentionally fails this check; implementation must not begin until the independent root/bootstrap identities, complete tracked helper set, protected identity-fence service and native observer/profile identities, exact lifecycle grant/trust/registry, and supported consumed-identity backend exist.

- [ ] Re-prove the TELOS records and confirm plugin-source baseline tests.

```bash
node /home/colchis/Projects/TELOS/docs/institutional-memory/verify-contracts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
```

Expected: `301/301 contracts match system reality`; plugin test summary reports 4 passing tests and 0 failures.

- [ ] Establish a git-backed plugin source without capturing unknown or secret files.

After the source top-level allowlist passes and before `git init`, execute the independently reviewed detector from the authenticated registry against every physical byte under the six package roots. This and every later `run_credential_gate` line is valid only in the same shell authorization session that created the exact readonly function and readonly bindings above; a new shell, missing function, changed binding, or redefinition requires the complete root/bootstrap/grant/trust/registry/reviewed-commit precondition again. The function's byte-pinned standard-library loader stable-opens the exact allowed detector path once, hashes that buffer against the authenticated ref, imports only that buffer, and calls its closed exported `runCredentialGate(argv)`; it never invokes `node <helper-path>` or reopens the selected pathname:

```bash
SOURCE=/home/colchis/plugins/multi-model-seats
type run_credential_gate >/dev/null
test "$CREDENTIAL_DETECTOR_PATH" = "$(realpath "$CREDENTIAL_DETECTOR_PATH")"
test -f "$CREDENTIAL_DETECTOR_PATH" && test ! -L "$CREDENTIAL_DETECTOR_PATH"
run_credential_gate "$CREDENTIAL_DETECTOR_PATH" "$CREDENTIAL_DETECTOR_RAW_REF" self-test
if git -C "$SOURCE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  test "$(find -P "$SOURCE" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)" = "$(printf '%s\n' .git .codex-plugin hooks records scripts skills tests | sort)"
  run_credential_gate "$CREDENTIAL_DETECTOR_PATH" "$CREDENTIAL_DETECTOR_RAW_REF" scan-precommit --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source "$SOURCE" --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests
else
  test "$(find -P "$SOURCE" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)" = "$(printf '%s\n' .codex-plugin hooks records scripts skills tests | sort)"
  test ! -e "$SOURCE/.git"
  run_credential_gate "$CREDENTIAL_DETECTOR_PATH" "$CREDENTIAL_DETECTOR_RAW_REF" scan-physical --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source "$SOURCE" --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests
fi
```

Only after that read-only scan succeeds, use `apply_patch` as the first authorized source mutation to create `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs` with byte-for-byte identical content; verify identity against the registry raw ref and external source, run its self-test, and rescan the now-complete physical tree. Do not hand-copy or regenerate the detector. Its `scan-physical` walker uses bounded stable `lstat`/`open(O_NOFOLLOW)`/`fstat` reads, rejects links/specials/races/oversize and undecodable path names, and scans every raw byte including ignored/untracked/binary files. Its read-only `scan-precommit` mode repeats that physical scan, parses NUL-delimited index entries, accepts only regular blob modes, obtains every staged blob by OID with `git cat-file` without text conversion, and scans every blob plus commit/tag body reachable from every existing local ref. Its state-changing `commit-scanned` mode owns the only permitted source-commit transaction: after the same physical and history checks it scans the exact message, freezes a `git write-tree` OID, scans the complete exact immutable tree closure by OID, uses only that OID with `git commit-tree`, scans and verifies the resulting commit body names that tree/observed parent, and CAS-publishes the symbolic branch from the exact observed parent with `git update-ref`. It snapshots/rechecks HEAD, branch, index, tree, and refs; an index race cannot change the accepted tree, and branch drift cannot pass CAS. Any scanner/Git/parse/read/subprocess error is fatal; there is no catch-to-success path and no separate scan-then-commit window.

```bash
SOURCE=/home/colchis/plugins/multi-model-seats
ALLOWLIST=".codex-plugin hooks records scripts skills tests"
type run_credential_gate >/dev/null
test "$CREDENTIAL_DETECTOR_PATH" = "$(realpath "$CREDENTIAL_DETECTOR_PATH")"
test -f "$CREDENTIAL_DETECTOR_PATH" && test ! -L "$CREDENTIAL_DETECTOR_PATH"
run_credential_gate "$CREDENTIAL_DETECTOR_PATH" "$CREDENTIAL_DETECTOR_RAW_REF" self-test
test -f "$SOURCE/scripts/lifecycle-credential-gate.mjs" && test ! -L "$SOURCE/scripts/lifecycle-credential-gate.mjs"
cmp -s "$CREDENTIAL_DETECTOR_PATH" "$SOURCE/scripts/lifecycle-credential-gate.mjs"
test "sha256:$(sha256sum "$SOURCE/scripts/lifecycle-credential-gate.mjs" | cut -d' ' -f1)" = "$CREDENTIAL_DETECTOR_RAW_REF"
run_credential_gate "$SOURCE/scripts/lifecycle-credential-gate.mjs" "$CREDENTIAL_DETECTOR_RAW_REF" self-test
run_credential_gate "$SOURCE/scripts/lifecycle-credential-gate.mjs" "$CREDENTIAL_DETECTOR_RAW_REF" scan-physical --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source "$SOURCE" --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests
if git -C "$SOURCE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  test "$(realpath "$SOURCE")" = "$SOURCE"
  test "$(git -C "$SOURCE" rev-parse --show-toplevel)" = "$SOURCE"
  EXPECTED_SOURCE_TOP_LEVEL="$(printf '%s\n' .git .codex-plugin hooks records scripts skills tests | sort)"
  ACTUAL_SOURCE_TOP_LEVEL="$(find -P "$SOURCE" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)"
  test "$ACTUAL_SOURCE_TOP_LEVEL" = "$EXPECTED_SOURCE_TOP_LEVEL"
  test -d "$SOURCE/.git" && test ! -L "$SOURCE/.git"
else
  EXPECTED_TOP_LEVEL="$(printf '%s\n' .codex-plugin hooks records scripts skills tests | sort)"
  ACTUAL_TOP_LEVEL="$(find -P "$SOURCE" -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)"
  test "$ACTUAL_TOP_LEVEL" = "$EXPECTED_TOP_LEVEL"
  for entry in $ALLOWLIST; do test -d "$SOURCE/$entry" && test ! -L "$SOURCE/$entry"; done
  find "$SOURCE"/.codex-plugin "$SOURCE"/hooks "$SOURCE"/records "$SOURCE"/scripts "$SOURCE"/skills "$SOURCE"/tests -type l -print -quit | (! read -r _)
  find "$SOURCE"/.codex-plugin "$SOURCE"/hooks "$SOURCE"/records "$SOURCE"/scripts "$SOURCE"/skills "$SOURCE"/tests -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name 'id_rsa*' -o -name 'id_ed25519*' -o -iname '*private*reason*' -o -iname '*chain*of*thought*' \) -print -quit | (! read -r _)
  git -C "$SOURCE" init -b codex/daedalus-family-lifecycle
fi
git -C "$SOURCE" add -- .codex-plugin hooks records scripts skills tests
if ! git -C "$SOURCE" diff --cached --quiet; then
  run_credential_gate "$SOURCE/scripts/lifecycle-credential-gate.mjs" "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source "$SOURCE" --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "chore: baseline audited multi-model-seats source"
fi
test "$(git -C "$SOURCE" rev-parse --show-toplevel)" = "$SOURCE"
for entry in $ALLOWLIST; do test -d "$SOURCE/$entry" && test ! -L "$SOURCE/$entry"; done
find "$SOURCE"/.codex-plugin "$SOURCE"/hooks "$SOURCE"/records "$SOURCE"/scripts "$SOURCE"/skills "$SOURCE"/tests \( -type l -o \( ! -type d ! -type f \) \) -print -quit | (! read -r _)
PHYSICAL_PACKAGE_FILES="$(cd "$SOURCE" && find -P .codex-plugin hooks records scripts skills tests -type f -printf '%p\n' | sed 's#^\./##' | LC_ALL=C sort)"
TRACKED_PACKAGE_FILES="$(git -C "$SOURCE" ls-files -- .codex-plugin hooks records scripts skills tests | LC_ALL=C sort)"
test "$PHYSICAL_PACKAGE_FILES" = "$TRACKED_PACKAGE_FILES"
test -z "$(git -C "$SOURCE" status --porcelain --untracked-files=all --ignored=matching -- .codex-plugin hooks records scripts skills tests)"
run_credential_gate "$SOURCE/scripts/lifecycle-credential-gate.mjs" "$CREDENTIAL_DETECTOR_RAW_REF" scan-precommit --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source "$SOURCE" --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests
git -C "$SOURCE" status --short --branch
```

Expected: only the exact clean checkout `/home/colchis/plugins/multi-model-seats` is accepted. A versioned source top level is exactly `.git` plus the six package roots; an unversioned source is exactly the six roots before initialization and exactly `.git` plus those roots afterward. Within the six roots, the complete sorted physical regular-file inventory must equal `git ls-files` byte-for-byte, every expected directory/type must match, and no symlink or other file type is allowed. The one exact scanner sees physical ignored/untracked/binary bytes, staged blobs, every blob in the frozen candidate tree, and existing reachable-history blobs without `-I` or decoding. Tests assemble NUL-prefixed values, binary-extension values, `xox*`, `AIza`, minimum accepted 8-character `sk-` suffixes, and 12-character Bearer/Basic values behind short `Authorization:` headers; each fails before `git init` for unversioned input and before any ref update for versioned input. Scanner exceptions and malformed Git output also fail. Rejected scans create no Git history; the unversioned failure leaves `.git` absent, while an existing-repository rejection leaves HEAD and every ref byte-identical and never publishes an unscanned tree. A forced index replacement immediately after `write-tree` either aborts or can publish only the already accepted safe tree; an injected credential-bearing replacement tree is never reachable from the branch. A forced concurrent branch update loses the exact `update-ref` CAS and cannot be overwritten. Negative policy-vocabulary fixtures remain allowed. Nested/alternate checkouts, extra roots, missing tracked files, type drift, symlinks, and different realpaths stop before mutation; there is no alternate-worktree fallback.

Known current operator boundary (verified read-only while writing this plan): the source is unversioned and has the unexpected top-level regular file `/home/colchis/plugins/multi-model-seats/Linux - Shortcut.lnk`, so the exact allowlist above correctly stops before `git init`. Do not delete, ignore, stage, or silently absorb it. After explicit operator approval, move that one file recoverably to a named location outside `/home/colchis/plugins/multi-model-seats`, re-list the top level, and rerun this entire precondition. Until then report `SOURCE_BASELINE_PENDING` and do not begin Task 1.

- [ ] Before Task 11 fixed-vector write mode only, provision an external deterministic test-fixture signer outside the plugin checkout. Set `VECTOR_FIXTURE_SIGNER_COMMAND` to its absolute regular non-symlink executable path. Its closed protocol accepts one canonical public request line identifying role `controller` or `eye`, key ID, and base64 signing bytes; it returns one canonical line with the matching public key and deterministic Ed25519 signature. A separate `--describe-public` mode emits only the closed controller/Eye public-key declaration. Private seed/key bytes never appear on stdout/stderr, in environment projections, command evidence, the plugin tree, the plan, or vector outputs. If this boundary is unavailable, all implementation/tests through Task 11 may proceed, but final-vector generation and the packaging commit stop at `VECTOR_GENERATION_PENDING`; no ephemeral key may silently replace it.

```bash
test -n "$VECTOR_FIXTURE_SIGNER_COMMAND"
test "${VECTOR_FIXTURE_SIGNER_COMMAND#/}" != "$VECTOR_FIXTURE_SIGNER_COMMAND"
test -f "$VECTOR_FIXTURE_SIGNER_COMMAND" && test -x "$VECTOR_FIXTURE_SIGNER_COMMAND" && test ! -L "$VECTOR_FIXTURE_SIGNER_COMMAND"
case "$(realpath "$VECTOR_FIXTURE_SIGNER_COMMAND")" in /home/colchis/plugins/multi-model-seats/*) false;; esac
```

Expected: the deterministic signer is an explicit external test-only boundary. Its public declaration may be tracked; no signing material may be tracked or copied. Production trust rejects these fixture key IDs/classes.

### Task 1: Canonical Hashing, Closed Typed Artifacts, and Baseline Audit

**Files:**
- Retain unchanged: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-artifacts.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/audit-baseline.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-credential-gate.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs`

**Interfaces:**
- Consumes: the byte-identical reviewed credential detector's `scanCredentialBytes`, Node `createHash`, `Buffer`, JSON-domain values, and files selected for baseline staging.
- Produces: `canonicalJson(value): string`, `canonicalBytes(value): Buffer`, `sha256Ref(value): string` for canonical JSON values only, `sha256BytesRef(bytes): string` for raw bytes only, `decodeCanonicalBase64url(value, { exactLength, field }): Buffer`, `decodeCanonicalEd25519Signature(value, field): Buffer`, scanner-bound `assertPersistable(authenticatedScanner, value): void`, media-aware `scanPublicRawBytes(authenticatedScanner, { bytes, mediaType }): void`, `validateTypedArtifact(authenticatedScanner, value): string[]`, `assertTypedArtifact(authenticatedScanner, value): void`, `validateFinding(authenticatedScanner, value): string[]`, `validateDisposition(authenticatedScanner, value): string[]`, `validateInstallationProofResolved(authenticatedScanner, { proof, resolveArtifact, resolveRawBytes, resolveGitObject, expectedImplementation, expectedImplementationRef, expectedImplementationGrant, expectedImplementationGrantRef }): void`, scanner-bound `validateUnsignedDecisionNode(authenticatedScanner, node): string[]`, `validateDecisionNode(authenticatedScanner, node): string[]`, `decisionRef(authenticatedScanner, node): string`, and the fail-closed baseline CLI. Production code obtains `authenticatedScanner` only as the retained closure inside `AuthenticatedGenesis`; every production store and resolver captures that closure privately and never accepts one from an API/CLI caller. Tests may bind a visibly named, permanently synthetic wrapper whose results cannot enter production.

- [ ] **Step 1: Write the failing core tests**

Create `tests/test-lifecycle-core.mjs` with these exact assertions:

```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, createPublicKey, verify } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, normalize, relative } from "node:path";
import test from "node:test";
import {
  assertPersistable as assertPersistableWithScanner,
  assertSecretFree as assertSecretFreeWithScanner,
  canonicalBytes,
  canonicalJson,
  decodeCanonicalBase64url,
  decodeCanonicalEd25519Signature,
  decisionRef as decisionRefWithScanner,
  redactSecrets as redactSecretsWithScanner,
  scanPublicRawBytes as scanPublicRawBytesWithScanner,
  sha256BytesRef,
  sha256Ref,
  validateDecisionNode as validateDecisionNodeWithScanner
} from "../scripts/lifecycle-core.mjs";

const credentialFixture = (parts) => parts.join("");
const syntheticCredentialScannerForTest = (bytes) => Buffer.from(bytes).includes(Buffer.from(credentialFixture(["s", "k-", "abcdefghijk"]), "utf8")) ? [{ test_only: true }] : [];
const assertPersistable = (value) => assertPersistableWithScanner(syntheticCredentialScannerForTest, value);
const assertSecretFree = (value) => assertSecretFreeWithScanner(syntheticCredentialScannerForTest, value);
const decisionRef = (value) => decisionRefWithScanner(syntheticCredentialScannerForTest, value);
const redactSecrets = (value) => redactSecretsWithScanner(syntheticCredentialScannerForTest, value);
const scanPublicRawBytes = (value) => scanPublicRawBytesWithScanner(syntheticCredentialScannerForTest, value);
const validateDecisionNode = (value) => validateDecisionNodeWithScanner(syntheticCredentialScannerForTest, value);
const hashRef = (hex) => `sha256:${hex.repeat(64)}`;
const requiredFlag = (name) => {
  const matches = process.argv.reduce((indices, value, index) => value === name ? [...indices, index] : indices, []);
  assert.equal(matches.length, 1, `expected exactly one ${name}`);
  const [index] = matches;
  assert.notEqual(index, -1, `missing required ${name}`);
  assert.ok(process.argv[index + 1] && !process.argv[index + 1].startsWith("--"), `missing value for ${name}`);
  return process.argv[index + 1];
};

const signedNode = {
  node_version: "dfm.decision.v1",
  node_type: "decision",
  journal_index: 1,
  previous_journal_ref: null,
  lifecycle_id: "life-test-1",
  stage: "p1-plan-pair",
  transition: { kind: "decision", mutation_kind: null, target_stage: null },
  artifact_hash: `sha256:${"a".repeat(64)}`,
  parent_hashes: [],
  input_refs: [`sha256:${"b".repeat(64)}`],
  output_refs: [],
  actor: { seat: "icarus", provider: "openai", model: "test-model" },
  provenance_ref: `sha256:${"c".repeat(64)}`,
  operation_prepared_ref: `sha256:${"f".repeat(64)}`,
  decision: { verdict: "pass", findings: [], dispositions: [] },
  evidence_refs: [`sha256:${"d".repeat(64)}`],
  authority_ref: null,
  policy_ref: `sha256:${"e".repeat(64)}`,
  recorded_at: "2026-07-21T12:00:00.000Z",
  controller_signature: Buffer.alloc(64, 7).toString("base64url")
};

test("canonical JSON hashing covers every JSON type and never aliases raw strings", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(sha256Ref({ b: 2, a: 1 }), "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777");
  assert.notEqual(sha256Ref("null"), sha256Ref(null));
  assert.notEqual(sha256Ref("1"), sha256Ref(1));
  assert.equal(sha256BytesRef(Buffer.from("null", "utf8")), sha256Ref(null));
  assert.equal(Buffer.compare(canonicalBytes({ b: 2, a: 1 }), Buffer.from('{"a":1,"b":2}', "utf8")), 0);
  assert.equal(sha256BytesRef(Buffer.from([0xff, 0x00, 0x80])), "sha256:ef192b7af54e943f206ab27075ec1805384c972c9959fc5820f1fa7d5268fcef");
});

test("non-JSON values fail closed", () => {
  assert.throws(() => canonicalJson({ value: undefined }), /unsupported JSON value/);
  assert.throws(() => canonicalJson({ value: Number.NaN }), /finite number/);
});

test("base64url decoding is canonical and Ed25519 signatures are exactly 64 bytes", () => {
  const canonical = Buffer.alloc(64, 7).toString("base64url");
  assert.equal(canonical.length, 86);
  assert.deepEqual(decodeCanonicalEd25519Signature(canonical, "test signature"), Buffer.alloc(64, 7));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = alphabet.indexOf(canonical.at(-1));
  const tailAlias = canonical.slice(0, -1) + alphabet[last + 1];
  for (const invalid of ["", `${canonical}=`, `${canonical}==`, `${canonical.slice(0, 8)}\n${canonical.slice(8)}`, `${canonical.slice(0, 8)}+${canonical.slice(9)}`, canonical.slice(0, -1), `${canonical}A`, tailAlias]) {
    assert.throws(() => decodeCanonicalEd25519Signature(invalid, "test signature"), /canonical base64url|64 bytes/);
  }
  assert.deepEqual(decodeCanonicalBase64url("AA", { exactLength: 1, field: "one byte" }), Buffer.from([0]));
});

test("decision records have a closed valid shape", () => {
  assert.deepEqual(validateDecisionNode(signedNode), []);
  assert.match(decisionRef(signedNode), /^sha256:[0-9a-f]{64}$/);
  assert.match(validateDecisionNode({ ...signedNode, surprise: true })[0], /unknown field: surprise/);
});

test("genesis continuity and producer operation linkage are relationally closed", () => {
  assert.match(validateDecisionNode({ ...signedNode, previous_journal_ref: hashRef("9") }).join(";"), /genesis previous_journal_ref must be null/);
  assert.match(validateDecisionNode({ ...signedNode, operation_prepared_ref: null }).join(";"), /model seat requires operation_prepared_ref/);
  for (const seat of ["daedalus", "icarus", "grok", "gemini"]) {
    assert.deepEqual(validateDecisionNode({ ...signedNode, actor: { seat, provider: "provider", model: "model" }, operation_prepared_ref: hashRef("8") }), []);
  }
  for (const actor of [
    { seat: "eye", provider: "human", model: "eye-record-v1" },
    { seat: "telos-controller", provider: "local", model: "deterministic-v1" }
  ]) {
    assert.deepEqual(validateDecisionNode({ ...signedNode, actor, operation_prepared_ref: null }), []);
    assert.match(validateDecisionNode({ ...signedNode, actor, operation_prepared_ref: hashRef("8") }).join(";"), /non-model producer requires null operation_prepared_ref/);
  }
});

test("secrets are redacted and rejected at persistence boundaries", () => {
  const unsafe = {
    authorization: credentialFixture(["Bear", "er ", "abcdefghijkl", "mnopqrstuvwxyz"]),
    nested: { api_key: credentialFixture(["s", "k-", "abcdefghijk"]) }
  };
  assert.deepEqual(redactSecrets(unsafe), { authorization: "<redacted>", nested: { api_key: "<redacted>" } });
  assert.throws(() => assertSecretFree(unsafe), /possible secret/);
  assert.doesNotThrow(() => assertSecretFree(redactSecrets(unsafe)));
});

test("private reasoning and representative credential classes fail closed", () => {
  for (const unsafe of [
    { chain_of_thought: "hidden" },
    { private_reasoning: "hidden" },
    { oauth_refresh_token: credentialFixture(["1", "//", "abcdefghijkl", "mnopqrstuvwxyz"]) },
    { aws_secret_access_key: "abcdefghijklmnopqrstuvwxyz1234567890ABCD" },
    { session_cookie: "session=abcdefghijklmnopqrstuvwxyz" },
    { pem: credentialFixture(["-----BEGIN PRI", "VATE KEY-----", "\nAAAA\n", "-----END PRI", "VATE KEY-----"]) },
    { authorization: credentialFixture(["Bas", "ic ", "YWxhZGRpbjpv", "cGVuc2VzYW1l"]) }
  ]) assert.throws(() => assertPersistable(unsafe), /forbidden persistent field|possible credential/);
});

test("raw source scanning distinguishes policy vocabulary from credential values", () => {
  const policySource = readFileSync(new URL("../scripts/lifecycle-core.mjs", import.meta.url));
  assert.doesNotThrow(() => scanPublicRawBytes({ bytes: policySource, mediaType: "text/javascript" }));
  const assembledValue = Buffer.from(credentialFixture(["s", "k-", "abcdefghijk"]), "utf8");
  assert.throws(() => scanPublicRawBytes({ bytes: assembledValue, mediaType: "text/plain" }), /possible credential/);
});

test("the complete authorized plan is the cross-implementation candidate golden", async () => {
  const planPath = "/home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md";
  const authorityPath = requiredFlag("--authorized-plan-grant");
  const rootPath = requiredFlag("--telos-eye-root");
  const expectedRootRef = requiredFlag("--expected-telos-eye-root-ref");
  const bootstrapPath = requiredFlag("--authorization-bootstrap");
  const expectedBootstrapRef = requiredFlag("--expected-authorization-bootstrap-ref");
  assert.equal(process.argv.length, 12, "golden accepts only the five required flag/value pairs");
  assert.match(expectedRootRef, /^sha256:[0-9a-f]{64}$/);
  assert.match(expectedBootstrapRef, /^sha256:[0-9a-f]{64}$/);

  const stableBytes = (path, maxBytes) => {
    assert.equal(isAbsolute(path) && normalize(path) === path && path.normalize("NFC") === path && realpathSync(path) === path, true);
    const before = lstatSync(path);
    assert.equal(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= maxBytes, true);
    const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(fd);
      assert.deepEqual([opened.dev, opened.ino, opened.mode, opened.nlink, opened.size], [before.dev, before.ino, before.mode, before.nlink, before.size]);
      const bytes = readFileSync(fd);
      const after = fstatSync(fd);
      const pathAfter = lstatSync(path);
      assert.equal(bytes.length, opened.size);
      assert.deepEqual([after.dev, after.ino, after.mode, after.nlink, after.size, pathAfter.dev, pathAfter.ino, pathAfter.mode, pathAfter.nlink, pathAfter.size], [opened.dev, opened.ino, opened.mode, opened.nlink, opened.size, opened.dev, opened.ino, opened.mode, opened.nlink, opened.size]);
      return bytes;
    } finally { closeSync(fd); }
  };
  const rawRef = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  const rootBytes = stableBytes(rootPath, 65536);
  const bootstrapBytes = stableBytes(bootstrapPath, 1048576);
  assert.equal(rawRef(rootBytes), expectedRootRef);
  assert.equal(rawRef(bootstrapBytes), expectedBootstrapRef);
  const packet = bootstrapBytes.toString("ascii").match(/^([A-Za-z0-9_-]+)\n([A-Za-z0-9_-]{86})\n$/);
  assert.ok(packet, "bootstrap packet must use the exact two-line frame");
  const payloadBytes = decodeCanonicalBase64url(packet[1], { field: "bootstrap payload" });
  const packetSignature = decodeCanonicalEd25519Signature(packet[2], "bootstrap signature");
  const publicKey = createPublicKey(rootBytes);
  assert.equal(verify(null, Buffer.concat([Buffer.from("telos.dfm-authorization-bootstrap.v1\0"), payloadBytes]), publicKey, packetSignature), true);
  const payloadRaw = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
  const payload = JSON.parse(payloadRaw);
  assert.deepEqual(Object.keys(payload).sort(), ["authority_record", "bootstrap_version", "eye_trust", "plan", "profile_ref", "reviewed_head", "target", "transport_registry"]);
  assert.equal(payload.bootstrap_version, "telos.dfm-authorization-bootstrap.v1");
  assert.equal(payload.plan.realpath, planPath);
  assert.equal(payload.authority_record.realpath, authorityPath);
  assert.deepEqual(payload.target, { kind: "checkout", path: "/home/colchis/plugins/multi-model-seats", task_range: "1-11" });
  assert.match(payload.reviewed_head, /^git:(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
  for (const descriptor of [payload.plan, payload.authority_record, payload.eye_trust, payload.transport_registry]) {
    assert.deepEqual(Object.keys(descriptor).sort(), ["canonical_ref", "raw_ref", "realpath"]);
    assert.equal(isAbsolute(descriptor.realpath) && normalize(descriptor.realpath) === descriptor.realpath && descriptor.realpath.normalize("NFC") === descriptor.realpath, true);
    assert.match(descriptor.raw_ref, /^sha256:[0-9a-f]{64}$/);
    assert.match(descriptor.canonical_ref, /^sha256:[0-9a-f]{64}$/);
  }

  const authorityBytes = stableBytes(payload.authority_record.realpath, 1048576);
  const trustBytes = stableBytes(payload.eye_trust.realpath, 1048576);
  const registryBytes = stableBytes(payload.transport_registry.realpath, 1048576);
  assert.equal(rawRef(authorityBytes), payload.authority_record.raw_ref);
  assert.equal(rawRef(trustBytes), payload.eye_trust.raw_ref);
  assert.equal(rawRef(registryBytes), payload.transport_registry.raw_ref);
  const authorityRaw = new TextDecoder("utf-8", { fatal: true }).decode(authorityBytes);
  const authority = JSON.parse(authorityRaw);
  const trustRaw = new TextDecoder("utf-8", { fatal: true }).decode(trustBytes);
  const trust = JSON.parse(trustRaw);
  const registryRaw = new TextDecoder("utf-8", { fatal: true }).decode(registryBytes);
  const registry = JSON.parse(registryRaw);
  assert.deepEqual(Object.keys(registry).sort(), ["adapter_validator", "artifact_version", "canonicalizer", "credential_detector", "detached_launcher", "detached_verifier", "identity_fence_runner", "profile_ref", "registry_observer", "routes", "target"]);
  assert.deepEqual(Object.keys(registry.canonicalizer).sort(), ["canonicalizer_version", "source_raw_ref", "source_realpath"]);
  assert.equal(registry.canonicalizer.canonicalizer_version, "telos.canonical-json.v1");
  assert.equal(registry.canonicalizer.source_realpath, "/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs");
  assert.match(registry.canonicalizer.source_raw_ref, /^sha256:[0-9a-f]{64}$/);
  const reviewedCommit = payload.reviewed_head.slice(4);
  for (const args of [
    ["-C", "/home/colchis/Projects/TELOS", "cat-file", "-e", `${reviewedCommit}^{commit}`],
    ["-C", "/home/colchis/Projects/TELOS", "merge-base", "--is-ancestor", reviewedCommit, "HEAD"],
    ["-C", "/home/colchis/Projects/TELOS", "ls-files", "--error-unmatch", relative("/home/colchis/Projects/TELOS", registry.canonicalizer.source_realpath)],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", "HEAD", "--", relative("/home/colchis/Projects/TELOS", registry.canonicalizer.source_realpath)],
    ["-C", "/home/colchis/Projects/TELOS", "diff", "--quiet", reviewedCommit, "HEAD", "--", relative("/home/colchis/Projects/TELOS", registry.canonicalizer.source_realpath)]
  ]) assert.equal(spawnSync("git", args).status, 0, `reviewed canonicalizer check failed: ${args.join(" ")}`);
  const canonicalizerBytes = stableBytes(registry.canonicalizer.source_realpath, 1048576);
  assert.equal(rawRef(canonicalizerBytes), registry.canonicalizer.source_raw_ref);
  const vendor = await import(`data:text/javascript;base64,${canonicalizerBytes.toString("base64")}`);
  const canonicalRef = (value) => rawRef(Buffer.from(vendor.canonicalize(value), "utf8"));
  assert.equal(payloadRaw, vendor.canonicalize(payload));
  assert.equal(authorityRaw, vendor.canonicalize(authority) + "\n");
  assert.equal(trustRaw, vendor.canonicalize(trust) + "\n");
  assert.equal(registryRaw, vendor.canonicalize(registry) + "\n");
  assert.equal(canonicalRef(authority), payload.authority_record.canonical_ref);
  assert.equal(canonicalRef(trust), payload.eye_trust.canonical_ref);
  assert.equal(canonicalRef(registry), payload.transport_registry.canonical_ref);
  assert.deepEqual(Object.keys(authority).sort(), ["action", "authority_version", "eye_trust_ref", "provider_transport_registry_ref", "reviewed_head", "scope", "signature", "status", "subject_ref"]);
  const { signature, ...unsignedAuthority } = authority;
  assert.deepEqual(Object.keys(signature).sort(), ["algorithm", "key_id", "value"]);
  assert.equal(signature.algorithm, "ed25519");
  assert.equal(signature.key_id, "eye-implementation-v1");
  assert.equal(authority.authority_version, "telos.eye-implementation-authority.v1");
  assert.equal(authority.action, "grant-implementation");
  assert.equal(authority.status, "GRANTED");
  assert.equal(authority.eye_trust_ref, payload.eye_trust.canonical_ref);
  assert.equal(authority.provider_transport_registry_ref, payload.transport_registry.canonical_ref);
  assert.equal(authority.reviewed_head, payload.reviewed_head);
  assert.deepEqual(Object.keys(authority.scope).sort(), ["profile_ref", "target_kind", "target_path", "task_range"]);
  const planBytes = stableBytes(planPath, 1048576);
  assert.equal(rawRef(planBytes), payload.plan.raw_ref);
  const plan = new TextDecoder("utf-8", { fatal: true }).decode(planBytes);
  const candidate = { kind: "candidate", plan };
  const profileMarker = "Create `records/lifecycle-profiles/daedalus-family-v1.json`:";
  const profileMarkerIndex = plan.lastIndexOf(profileMarker);
  assert.notEqual(profileMarkerIndex, -1);
  const profileMatch = plan.slice(profileMarkerIndex + profileMarker.length).match(/^\s*```json\n([\s\S]*?)\n```/);
  assert.ok(profileMatch, "authorized plan must contain the exact profile declaration");
  assert.equal(authority.scope.profile_ref, payload.profile_ref);
  assert.equal(authority.scope.profile_ref, canonicalRef(JSON.parse(profileMatch[1])));
  assert.equal(authority.scope.target_kind, "checkout");
  assert.equal(authority.scope.target_path, "/home/colchis/plugins/multi-model-seats");
  assert.equal(authority.scope.task_range, "1-11");
  assert.equal(verify(null, Buffer.from(vendor.canonicalize(unsignedAuthority), "utf8"), publicKey, decodeCanonicalEd25519Signature(signature.value, "grant signature")), true);
  assert.deepEqual(Object.keys(registry.credential_detector).sort(), ["detector_version", "source_raw_ref", "source_realpath"]);
  assert.equal(registry.credential_detector.detector_version, "dfm.credential-value-detector.v1");
  assert.equal(registry.credential_detector.source_realpath, "/home/colchis/Projects/TELOS/integrations/credential-detectors/dfm-credential-value-v1.mjs");
  const detectorBytes = stableBytes(registry.credential_detector.source_realpath, 1048576);
  assert.equal(rawRef(detectorBytes), registry.credential_detector.source_raw_ref);
  const detector = await import(`data:text/javascript;base64,${detectorBytes.toString("base64")}`);
  assert.equal(typeof detector.scanCredentialBytes, "function");
  const declaredRef = authority.subject_ref;
  assert.doesNotThrow(() => assertPersistableWithScanner(detector.scanCredentialBytes, candidate));
  assert.equal(sha256Ref(candidate), declaredRef);
  assert.equal(canonicalRef(candidate), declaredRef);
  const mutated = { kind: "candidate", plan: plan.slice(0, -1) + (plan.endsWith("\n") ? " " : "\n") };
  assert.notEqual(sha256Ref(mutated), declaredRef);
});
```

`credentialFixture` is test-local and unexported. It has no allowlist, bypass flag, schema exception, or production call path: each joined runtime value must still be rejected by unchanged `assertPersistable`. Run that production detector against the complete revised plan and require zero matches before authorization. The golden accepts only explicit `--authorized-plan-grant`, `--telos-eye-root`, independently retained `--expected-telos-eye-root-ref`, `--authorization-bootstrap`, and independently retained `--expected-authorization-bootstrap-ref` arguments. It stable-opens the root and bootstrap exactly once, authenticates the exact packet payload with fixed Node primitives, stable-opens the packet-named raw grant/trust/registry exactly once, and validates the reviewed commit plus the registry's exact canonicalizer realpath/ref before opening that helper. It imports the canonicalizer only from that one authenticated buffer, then re-proves exact canonical packet/grant/trust/registry/plan/profile bodies and refs, the grant signature, closed scope, status, and candidate subject; it never reads `AUTHORITY_PATH`, `PATH`, a basename, a second helper pathname, or another ambient declaration. Missing/repeated arguments, a coherent forged grant/root/packet under a different retained ref, changed scope/subject/reviewed commit, marker-bearing helper, same-byte alternate filename, hardlink, symlink, path replacement, or canonical-signature alias must fail before helper side effects or test-selected persistence. The expected candidate, root, and bootstrap refs remain external to avoid self-reference.

Create `tests/test-lifecycle-credential-gate.mjs` before any Task 1 source commit. First require the plugin detector bytes/ref to equal the authenticated external detector exactly, require its only CLI entry to be the side-effect-free exported `runCredentialGate(argv)`, and run the built-in self-test only through the exact same-buffer loader above. Direct `node <detector-path>` execution is forbidden and tested absent from every plan command. Every target invocation supplies the independently retained signed detector raw ref through `--expected-self-ref`; missing, repeated, malformed, wrong, or one-byte-self-modified cases fail before reading the target repository/file. Loader negatives replace the exact path after its one read, install a marker-bearing substitute, and try a same-byte alternate filename, hardlink, symlink, relative/case/Unicode alias, directory, FIFO, and second-read seam; it must either reject or execute only the original authenticated buffer, with zero substitute marker or target mutation. In isolated temporary unversioned and existing Git repositories, construct all credential values only from fragments and cover every exact minimum threshold/class, including a NUL byte immediately before the value, invalid UTF-8 and binary extensions, Slack `xox*`, Google `AIza`, a boundary-valid 8-character `sk-` suffix, and 12-character Basic/Bearer values following a short `Authorization:` header. Put each independently in tracked, staged, unstaged, ignored, untracked, candidate-tree-only, prior reachable commit-message, and new `--message` bytes. `scan-physical`, `scan-precommit`, and `commit-scanned` must reject before `git init`/ref publication as applicable. A scanner throw, forced read error, malformed NUL index/tree/commit output, `git cat-file`/`write-tree`/`commit-tree`/`update-ref` error, symlink/special file, and oversize file all fail. Assert a rejected unversioned scan leaves no `.git`; for an existing repository snapshot HEAD, every ref, the index file, worktree bytes, and commit count and require the ref/commit snapshot to remain identical after rejection. Add deterministic race seams available only to this test process: replace the index with a credential-bearing index immediately after the candidate tree is materialized, race the symbolic branch, and replace the index again between commit-object creation and CAS. Require either a nonzero result with the original branch unchanged or a published commit whose `^{tree}` is exactly the previously reported accepted safe tree; the credential-bearing tree must never be reachable from any branch/ref, and CAS must never overwrite the racer. Verify an unreachable object from a failed CAS, if one exists, contains only the accepted safe tree. Add policy regex/source vocabulary negatives—including `disk-selected`, one character below every threshold, and embedded non-boundary `sk-` text—that pass. Finally stage a clean corpus, invoke only `commit-scanned --message <fixed-message>` through the same-buffer loader, and prove the emitted accepted tree OID is exactly the new commit's tree and that every blob plus the new commit body was scanned. Assert no child argv contains `git commit`, no hook marker runs, and the production detector has no `--ignore`, warning-only, text-only, extension, error-suppression, arbitrary-command, arbitrary-ref, or caller-tree option.

- [ ] **Step 2: Run the test and confirm the module is missing**

Run:

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-credential-gate.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
```

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-core.mjs`.

- [ ] **Step 3: Implement the core module**

Create `scripts/lifecycle-core.mjs` with:

```js
import { createHash } from "node:crypto";

const HASH_REF = /^sha256:[0-9a-f]{64}$/;
const MODEL_SEATS = new Set(["daedalus", "icarus", "grok", "gemini"]);
const NON_MODEL_PRODUCERS = new Set(["eye", "telos-controller"]);
const SECRET_KEY = /(^|_)(api_?key|access_?key|token|secret|authorization|private_?key|password|cookie|session|oauth|credential)($|_)/i;
const PRIVATE_REASONING_KEY = /(^|_)(chain_?of_?thought|private_?reasoning|hidden_?reasoning|scratchpad|internal_?monologue)($|_)/i;
const UNSIGNED_FIELDS = [
  "node_version", "node_type", "journal_index", "previous_journal_ref", "lifecycle_id", "stage", "transition", "artifact_hash", "parent_hashes",
  "input_refs", "output_refs", "actor", "provenance_ref", "decision",
  "operation_prepared_ref", "evidence_refs", "authority_ref", "policy_ref", "recorded_at"
];

function canonicalPart(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("number must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalPart).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalPart(value[key])}`).join(",")}}`;
  }
  throw new TypeError("unsupported JSON value");
}

export function canonicalJson(value) {
  return canonicalPart(value);
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value), "utf8");
}

export function sha256BytesRef(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw new TypeError("raw hash input must be bytes");
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function sha256Ref(value) {
  return sha256BytesRef(canonicalBytes(value));
}

export function decodeCanonicalBase64url(value, { exactLength = null, field = "value" } = {}) {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value) || value.includes("=") || /\s/.test(value)) {
    throw new Error(`${field} must be canonical base64url`);
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value) throw new Error(`${field} must be canonical base64url`);
  if (exactLength !== null && bytes.length !== exactLength) throw new Error(`${field} must decode to exactly ${exactLength} bytes`);
  return bytes;
}

export function decodeCanonicalEd25519Signature(value, field = "signature") {
  if (typeof value !== "string" || value.length !== 86) throw new Error(`${field} must be a canonical 64-byte Ed25519 signature`);
  return decodeCanonicalBase64url(value, { exactLength: 64, field });
}

function requireCredentialScanner(scanCredentialBytes) {
  if (typeof scanCredentialBytes !== "function") throw new TypeError("authenticated credential scanner is required");
  return scanCredentialBytes;
}

export function scanPublicRawBytes(scanCredentialBytes, { bytes, mediaType }) {
  requireCredentialScanner(scanCredentialBytes);
  if (!Buffer.isBuffer(bytes) || typeof mediaType !== "string") throw new TypeError("raw scan requires bytes and media type");
  const textMedia = new Set(["text/javascript", "application/javascript", "application/json", "text/markdown", "text/plain"]);
  if (!textMedia.has(mediaType) && mediaType !== "application/octet-stream") throw new Error("unsupported public raw media type");
  if (textMedia.has(mediaType)) new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (scanCredentialBytes(bytes).length !== 0) throw new Error("possible credential in public raw bytes");
}

const containsCredentialValue = (scanCredentialBytes, value) => requireCredentialScanner(scanCredentialBytes)(Buffer.from(value, "utf8")).length !== 0;

export function redactSecrets(scanCredentialBytes, value, key = "") {
  if (SECRET_KEY.test(key)) return "<redacted>";
  if (typeof value === "string") return containsCredentialValue(scanCredentialBytes, value) ? "<redacted>" : value;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(scanCredentialBytes, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactSecrets(scanCredentialBytes, item, name)]));
  }
  return value;
}

export function assertSecretFree(scanCredentialBytes, value) {
  if (canonicalJson(redactSecrets(scanCredentialBytes, value)) !== canonicalJson(value)) throw new Error("possible secret in persistent lifecycle value");
}

export function assertPersistable(scanCredentialBytes, value) {
  requireCredentialScanner(scanCredentialBytes);
  const visit = (item, key = "") => {
    if (PRIVATE_REASONING_KEY.test(key)) throw new Error(`forbidden persistent field: ${key}`);
    if (SECRET_KEY.test(key) || (typeof item === "string" && containsCredentialValue(scanCredentialBytes, item))) throw new Error(`possible credential in persistent field: ${key || "<value>"}`);
    if (Array.isArray(item)) return item.forEach((child) => visit(child, key));
    if (item && typeof item === "object") return Object.entries(item).forEach(([name, child]) => visit(child, name));
  };
  canonicalJson(value);
  visit(value);
}

function cleanString(value) {
  return typeof value === "string" && value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

function hashArray(value) {
  return Array.isArray(value) && value.every((item) => HASH_REF.test(item)) && new Set(value).size === value.length;
}

function validFinding(value) {
  return value && Object.keys(value).sort().join(",") === "code,evidence_refs,message" &&
    cleanString(value.code) && cleanString(value.message) && hashArray(value.evidence_refs);
}

function validDisposition(value) {
  return value && Object.keys(value).sort().join(",") === "action,code,subject_ref,target_stage" &&
    cleanString(value.code) && cleanString(value.action) &&
    (value.subject_ref === null || HASH_REF.test(value.subject_ref)) &&
    (value.target_stage === null || cleanString(value.target_stage));
}

export function validateUnsignedDecisionNode(scanCredentialBytes, node) {
  const problems = [];
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["node must be an object"];
  for (const key of Object.keys(node)) if (!UNSIGNED_FIELDS.includes(key)) problems.push(`unknown field: ${key}`);
  for (const key of UNSIGNED_FIELDS) if (!(key in node)) problems.push(`missing field: ${key}`);
  if (node.node_version !== "dfm.decision.v1") problems.push("node_version must be dfm.decision.v1");
  if (node.node_type !== "decision") problems.push("node_type must be decision");
  if (!Number.isSafeInteger(node.journal_index) || node.journal_index < 1) problems.push("journal_index must be a positive safe integer");
  if (!(node.previous_journal_ref === null || HASH_REF.test(node.previous_journal_ref ?? ""))) problems.push("previous_journal_ref must be null or a SHA-256 ref");
  if (node.journal_index === 1 && node.previous_journal_ref !== null) problems.push("genesis previous_journal_ref must be null");
  if (!cleanString(node.lifecycle_id)) problems.push("lifecycle_id must be a clean non-empty string");
  if (!cleanString(node.stage)) problems.push("stage must be a clean non-empty string");
  if (!node.transition || !["decision", "retry", "mutation", "eye-action"].includes(node.transition.kind) || ![null, "plan", "implementation", "requirement", "policy"].includes(node.transition.mutation_kind) || !(node.transition.target_stage === null || cleanString(node.transition.target_stage)) || Object.keys(node.transition).sort().join(",") !== "kind,mutation_kind,target_stage") problems.push("transition must have the closed kind/mutation_kind/target_stage shape");
  if (!HASH_REF.test(node.artifact_hash ?? "")) problems.push("artifact_hash must be a SHA-256 ref");
  for (const key of ["parent_hashes", "input_refs", "output_refs", "evidence_refs"]) if (!hashArray(node[key])) problems.push(`${key} must contain unique SHA-256 refs`);
  if (!node.actor || !cleanString(node.actor.seat) || !cleanString(node.actor.provider) || !cleanString(node.actor.model) || Object.keys(node.actor).sort().join(",") !== "model,provider,seat") problems.push("actor must contain only clean seat, provider, and model strings");
  if (!(node.provenance_ref === null || HASH_REF.test(node.provenance_ref ?? ""))) problems.push("provenance_ref must be null or a SHA-256 ref");
  if (!(node.operation_prepared_ref === null || HASH_REF.test(node.operation_prepared_ref ?? ""))) problems.push("operation_prepared_ref must be null or a SHA-256 ref");
  if (MODEL_SEATS.has(node.actor?.seat) && !HASH_REF.test(node.operation_prepared_ref ?? "")) problems.push("model seat requires operation_prepared_ref");
  if (NON_MODEL_PRODUCERS.has(node.actor?.seat) && node.operation_prepared_ref !== null) problems.push("non-model producer requires null operation_prepared_ref");
  if (!(node.authority_ref === null || HASH_REF.test(node.authority_ref ?? ""))) problems.push("authority_ref must be null or a SHA-256 ref");
  if (!node.decision || !["pass", "non-pass", "eye-pause", "eye-cancel", "eye-amend", "eye-adjudicate"].includes(node.decision.verdict) || !Array.isArray(node.decision.findings) || !node.decision.findings.every(validFinding) || !Array.isArray(node.decision.dispositions) || !node.decision.dispositions.every(validDisposition) || Object.keys(node.decision).sort().join(",") !== "dispositions,findings,verdict") problems.push("decision must have closed finding and disposition objects");
  if (node.decision?.verdict === "pass" && (node.decision.findings.length !== 0 || node.decision.dispositions.length !== 0)) problems.push("pass requires empty findings and dispositions");
  if (!HASH_REF.test(node.policy_ref ?? "")) problems.push("policy_ref must be a SHA-256 ref");
  if (!cleanString(node.recorded_at) || Number.isNaN(Date.parse(node.recorded_at))) problems.push("recorded_at must be an ISO date-time string");
  try { assertPersistable(scanCredentialBytes, node); } catch (error) { problems.push(error.message); }
  return problems;
}

export function validateDecisionNode(scanCredentialBytes, node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["node must be an object"];
  const { controller_signature: signature, ...unsigned } = node;
  const problems = validateUnsignedDecisionNode(scanCredentialBytes, unsigned);
  try { decodeCanonicalEd25519Signature(signature, "controller_signature"); }
  catch (error) { problems.push(error.message); }
  for (const key of Object.keys(node)) if (![...UNSIGNED_FIELDS, "controller_signature"].includes(key) && !problems.includes(`unknown field: ${key}`)) problems.push(`unknown field: ${key}`);
  return problems;
}

export function decisionRef(scanCredentialBytes, node) {
  const problems = validateDecisionNode(scanCredentialBytes, node);
  if (problems.length) throw new Error(`invalid decision node: ${problems.join("; ")}`);
  return sha256Ref(node);
}
```

`lifecycle-core.mjs` has no static or dynamic filesystem import of the detector and no module-global setter. Its scanner-dependent pure functions require an explicit scanner closure. Production callers never accept that closure from an API/CLI caller: the bootstrap-authorized selected-helper loader creates it only from the once-read, registry-ref-matched detector buffer, retains it inside the private `AuthenticatedGenesis`/controller capability, and supplies it at each validation call. A raw caller-selected function can exercise pure functions but can never construct a production store/controller, persistence capability, replay brand, or eligible bundle. Unit-only calls use the visibly named synthetic closure above and remain product-ineligible; the authorized golden separately opens the exact registry detector only after root/bootstrap/raw-body/reviewed-path/canonicalizer/grant validation and passes that same-buffer export. `scanPublicRawBytes` is deliberately media-aware and distinct from structured `assertPersistable`. For UTF-8 source media (`text/javascript`, `application/javascript`, `application/json`, `text/markdown`, and `text/plain`) it requires strict decoding and rejects only high-confidence credential/private-key *values* using the production value detector; JavaScript policy identifiers and rejection vocabulary such as secret-field names or private-reasoning labels are allowed as source text. For structured lifecycle JSON, callers additionally parse canonical bytes, apply the closed schema, and run `assertPersistable`, so forbidden object keys remain rejected. Binary public evidence is allowed only for an explicitly schema-permitted media type and is scanned for the same ASCII high-confidence value signatures without lossy decoding. No raw provider response is passed to this API or persisted. Tests scan the complete final plugin source inventory and all four grant-bound adapter sources successfully, then assemble actual credential/private-key bytes only at runtime and require rejection; there is no bypass flag or media type that permits a detected value.

- [ ] **Step 3A: Define and test the closed artifact registry**

Create `tests/test-lifecycle-artifacts.mjs`. Define a visibly named `syntheticCredentialScannerForArtifactTest`, bind no production capability to it, and pass it explicitly to every scanner-bound validator. Build one valid value for every exact artifact version below, require `validateTypedArtifact(syntheticCredentialScannerForArtifactTest, value)` to return an empty array, and require `artifactKind(value)` to return the map key. For every fixture, inject `surprise: true` at the top level and into each nested object/array element in turn and assert an `unknown field at <json-pointer>` error. For a fixed implementation fixture, assert `sha256Ref(implementation) !== implementation.tree_root`, changing only `tree_root` changes the artifact ref, and no self-reference is needed. Also reject raw strings/prompts/responses/conversations and credential/private-reasoning fields, and prove a missing or non-function scanner fails before schema acceptance. Separate production-factory/store tests prove that no scanner option, positional argument, setter, or replacement method is accepted, so caller-selected pure-test scanners cannot reach production persistence.

Add core table tests proving literal pass with any finding or disposition fails for model, local-controller, and Eye-produced ordinary decisions; non-pass remains allowed. At this layer test only single-node structure: a non-positive/non-safe `journal_index`, a malformed predecessor ref, `journal_index === 1` with non-null predecessor, any of the four closed model seats with null `operation_prepared_ref`, and Eye/local-controller with a non-null prepared ref fail. The valid table is exactly model seat plus non-null prepared ref, Eye plus null, and local controller plus null. Duplicate/skipped indices and non-genesis predecessor continuity are chain properties and belong exclusively to Task 3's verified-journal tests.

Create `scripts/lifecycle-artifacts.mjs` and export `artifactKind(value)`, `validateTypedArtifact(authenticatedScanner, value): string[]`, `assertTypedArtifact(authenticatedScanner, value): void`, `validateFinding(authenticatedScanner, value): string[]`, and `validateDisposition(authenticatedScanner, value): string[]`. Each scanner-bound function first calls `assertPersistable(authenticatedScanner, value)` and passes that same closure to every nested finding/disposition/artifact validation; there is no default, module-global setter, scannerless overload, or caller-selectable production scanner. The registry is closed to these exact envelopes and recursively rejects unknown fields:

| artifact_version | Exact fields after artifact_version |
|---|---|
| dfm.requirement.v1 | lifecycle_id, requirement_text |
| canonical TELOS candidate | exact keys kind (literal candidate), plan; its artifact ref is `sha256Ref({ kind: "candidate", plan })` |
| dfm.implementation.v1 | lifecycle_id, plan_root, tree_root, commit_ref |
| dfm.policy.v1 | lifecycle_id, profile_ref, rule_refs |
| dfm.seat-request.v1 | lifecycle_id, stage, seat, provider, model, route_ref, subject_ref, input_refs, output_refs, instruction, public_context_refs, round_checkpoint_ref, context_ref |
| dfm.seat-public-context.v1 | lifecycle_id, stage, seat, subject_ref, root_refs, entries |
| dfm.production-transport-registry.v1 | profile_ref, target, canonicalizer, credential_detector, adapter_validator, detached_launcher, detached_verifier, identity_fence_runner, registry_observer, routes |
| dfm.evidence.v1 | lifecycle_id, evidence_kind, subject_ref, summary, refs |
| dfm.raw-evidence.v1 | lifecycle_id, raw_ref, byte_count, media_type, subject_ref |
| dfm.provenance.v1 | lifecycle_id, seat, attempt_ref, request_ref, context_ref, route_ref, observation_class, subject_ref, status, validated_provider, validated_model, reported_provider, reported_model, response_id, source, issued_at |
| dfm.eye-authority.v1 | authority_id, issuer, action, scope, target, prefix_root, subject_ref, policy_ref, requirement_root, issued_at, signature |
| dfm.command-evidence.v1 | lifecycle_id, command, args, cwd_ref, status, signal, stdout_ref, stderr_ref |
| dfm.plugin-registry-observation.v1 | lifecycle_id, records |
| dfm.tree-manifest.v1 | lifecycle_id, files |
| dfm.package-manifest.v1 | package_id, version, entries |
| dfm.identity-fence-receipt.v1 | request_ref, request_nonce, bootstrap_ref, implementation_grant_ref, transport_registry_ref, runner_ref, observer_ref, action_ref, platform_contract, runner_image_ref, source_observer_identity, consumed_observer_identity, observer_execution_method, source_profile_identity, consumed_profile_identity, profile_exposure_method, fence_armed, process_tree_empty, namespace_event_count, namespace_overflow, argv, environment_ref, cwd_ref, status, signal, stdout_base64url, stdout_byte_count, stdout_ref, stderr_base64url, stderr_byte_count, stderr_ref, signature |
| dfm.installation-test-evidence.v1 | lifecycle_id, source_manifest_ref, installed_manifest_ref, installed_cache_binding, identity_fence_receipt_ref, registry_observer_ref, implementation_grant_evidence_ref, telos_eye_root_evidence_ref, registry_command_evidence_ref, registry_projection_ref, driver_command_evidence_ref, driver_result |
| dfm.installation-proof.v1 | lifecycle_id, plugin_id, plugin_version, source_commit_ref, source_manifest_ref, installed_manifest_ref, test_evidence_refs |
| dfm.icarus-finding-disposition.v1 | lifecycle_id, pair_stage, candidate_ref, subject_ref, finding_id, source_decision_ref, source_finding_index, attempt_ref, request_ref, disposition |

Nested shapes are also closed:

- `finding = { code, message, evidence_refs }`; `disposition = { code, action, target_stage, subject_ref }`.
- `issuer = { id: "eye", key_id }`; `signature = { algorithm: "ed25519", key_id, value }`. Every validator that admits a signature-bearing grant, delegation, Eye authority, decision, operation, checkpoint, identity-fence receipt, detached record, vector, or signer result calls `decodeCanonicalEd25519Signature(value, <field>)` before verification or persistence; no artifact-specific tolerant decoder or direct `Buffer.from(value, "base64url")` is permitted. The shared negative table includes empty, padded, whitespace, standard-base64 alphabet, short, long, non-round-tripping tail-bit alias, and otherwise-valid one-byte mutation forms for every envelope kind.
- `scope = { lifecycle_id, profile_ref, stage_id }`; `target` is exactly `{ kind: "checkout", path: <normalized absolute realpath>, task_range: "1-11" }` everywhere.
- A tree-manifest file is exactly `{ path, bytes, content_ref }`. A package-manifest entry is exactly `{ path, file_type: "regular", byte_count, content_ref }`; entries are unique path-sorted and symlinks are forbidden. A `refs`, `rule_refs`, finding `evidence_refs`, or installation `test_evidence_refs` array is unique sorted.
- An installation-test result is exactly `{ driver_result_version: "dfm.installation-driver-result.v1", authenticated_bindings: { authorized_plan_grant_ref, authorized_candidate_ref, telos_eye_root_ref, identity_fence_runner_ref, registry_observer_ref, identity_fence_receipt_ref }, ordinary_test_paths, ordinary_test_count, self_check_path: "tests/test-lifecycle-install.mjs", self_check_count: 1, auxiliary_counts: { skill_discovery: 1, hook_load: 1, cli_help: 1, demo: 1 }, total_child_process_count }`. Each authenticated binding is a SHA-256 ref: the canonical grant artifact ref, its candidate subject ref, the raw-byte ref of the canonical supplied Eye-root file, the canonical refs of the exact grant-bound runner and observer descriptors, and the canonical ref of the exact accepted signed `plugin-list` fence receipt. The enclosing evidence's `installed_cache_binding` is exactly `{ plugin_id: "multi-model-seats@multi-model-local", plugin_version: "0.6.0", installed_realpath: <normalized absolute realpath>, installed_path_ref: <raw SHA-256 of UTF-8 realpath plus one newline> }`; all runner/observer/receipt refs must equal both the driver bindings and `sha256Ref` of the authenticated descriptors/receipt. `dfm.plugin-registry-observation.v1.records` is the unique path-sorted closed semantic projection of the receipt-bound stdout; each record is exactly `{ plugin_id, plugin_version, enabled, installed_realpath }`. These public proof keys intentionally avoid every `SECRET_KEY` segment; there is no validator allowlist or schema bypass. `ordinary_test_paths` is a unique lexicographically sorted array of normalized relative paths; every count is a non-negative safe integer; and all nested keys are closed.
- Raw evidence metadata is exactly `{ artifact_version: "dfm.raw-evidence.v1", lifecycle_id, raw_ref, byte_count, media_type, subject_ref }`; `raw_ref` and `subject_ref` are SHA-256 refs, `byte_count` is a non-negative safe integer equal to the stored raw-byte length, and `media_type` is a clean lowercase IANA media type. Unknown metadata keys fail closed.
- `dfm.seat-request.v1` is canonical public input, at most 16 KiB total; `instruction` is a secret-free public instruction of at most 8192 UTF-8 bytes, context/input/output refs are unique sorted, and lifecycle/stage/seat/provider/model/route/subject/checkpoint must match controller replay/profile plus the authenticated transport registry. `route_ref` is the canonical ref of the exact closed registry route chosen by the seat's immutable `route_id`; provider/model are copied from that route. `round_checkpoint_ref` is null at P1/C1 and the controller-derived current covering checkpoint at P2/C2. `context_ref` is exactly the ref of the independently resolver-derived `dfm.seat-public-context.v1` body committed in the same signed operation start. It is never called a raw prompt.
- A production transport registry is secret-free canonical policy whose target/profile exactly equal authenticated lifecycle genesis. Its closed `canonicalizer` is `{ canonicalizer_version: "telos.canonical-json.v1", source_realpath: "/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs", source_raw_ref }`; its `credential_detector` has the exact fixed reviewed source path/ref above; its closed `adapter_validator` is `{ validator_version: "dfm.closed-adapter-grammar.v1", source_realpath: "/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/validate-closed-adapter-v1.mjs", source_raw_ref, plugin_target_realpath: "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-adapter-grammar.mjs", plugin_target_raw_ref }` with `plugin_target_raw_ref === source_raw_ref`; and its `detached_launcher`/`detached_verifier` are `{ helper_version, source_realpath, source_raw_ref, plugin_target_realpath }` at the exact fixed source and plugin target paths. Every source is a reviewed-commit regular non-symlink single-link file and its descriptor rejects a basename, relative/case/Unicode alias, alternate filename, same-byte copy, hardlink, symlink, or containing directory substitute.

  The closed `identity_fence_runner` is `{ runner_version: "dfm.identity-fence-runner.v1", protocol_version: "dfm.identity-fence-ipc.v1", platform_contract, executable_realpath, executable_raw_ref, executable_byte_count, service_identity, endpoint, receipt_key, max_request_bytes, max_result_bytes, timeout_ms }`. `platform_contract` is exactly `linux-sealed-execveat-mounted-profile.v1` or `windows-locked-image-profile.v1`; `service_identity`, endpoint, executable identity, root/Administrator ownership, and canonical Ed25519 receipt key are host-specific closed objects authenticated by the bootstrap-bound registry. The closed `registry_observer` is `{ observer_version: "dfm.codex-registry-observer.v2", executable_kind: "self-contained-native", executable_realpath, executable_raw_ref, executable_byte_count, executable_file_identity, profile_root_realpath, profile_file_identity, environment, unset_environment_keys, actions, runner_ref }`, where `runner_ref === sha256Ref(identity_fence_runner)` and `actions` is exactly the four fixed `marketplace-list`, `plugin-add`, `plugin-list`, and `plugin-remove` argv/mutation-class records. Environment is the exact signed `HOME`/`LANG` map with no `PATH`; HOME equals the external profile root. Production never spawns either descriptor pathname from Node. It connects only to the authenticated protected service, sends one canonical nonce/ref request per action, and accepts only a canonical signed `dfm.identity-fence-receipt.v1` proving the exact consumed image/profile identities and output. Any identity/path/profile/environment addition, transient rename/restore, namespace-watch overflow, late child, wrong peer/key, unsupported backend, WSL/UNC/SMB crossover, or receipt drift fails before parsing stdout, driver, evidence, signer, lock, or persistence. Controller-side path restats are defense in depth only.

  The registry has exactly four unique route-ID-sorted routes. Each route is closed `{ route_id, seat, provider, model, executable_realpath, executable_raw_ref, dependency_manifest, dependency_root, environment_keys, protocol_version: "dfm.seat-invocation-frame.v1", observation_class: "pinned-adapter-runtime-observation" }`; seat/provider/route ID must equal the profile mapping, model is a nonempty exact immutable string, executable path is normalized absolute and outside runtime/handoff, and executable raw ref is SHA-256. `dependency_manifest` has the exact validator-derived closed shape above, binds `entry_raw_ref === executable_raw_ref`, and `dependency_root === sha256Ref(dependency_manifest)`. `environment_keys` is a nonempty unique lexicographically sorted subset of the exact provider allowlist: Anthropic `ANTHROPIC_API_KEY`/`CLAUDE_CODE_OAUTH_TOKEN`, OpenAI `OPENAI_API_KEY`, xAI `XAI_API_KEY`, and Google `GEMINI_API_KEY`/`GOOGLE_API_KEY`. Cross-provider, duplicate, unsorted, unknown, lowercase, `PATH`, `HOME`, `NODE_OPTIONS`, loader/debug/proxy/shell variables, or any other name fails registry validation. Values are read from the ambient process only after the entry bytes, copied validator bytes, parsed grammar, dependency body/root, and path identity have all been reverified immediately before the final spawn; they must be present nonempty strings, are copied into the child's exact environment, and are never hashed, persisted, logged, or returned. Route ref is `sha256Ref(route)`. The grant signs `provider_transport_registry_ref === sha256Ref(registry)`, transitively binding detector, validator, observer, and routes. Synthetic routes use a disjoint non-persistable test capability and cannot validate as this production artifact.
- A seat public-context envelope is canonical, at most 8 MiB and 512 entries, and contains only closed fields. `root_refs` is the unique sorted exact union of the request's subject, input, output, public-context, policy, and non-null checkpoint refs. Each entry is exactly `{ ref, content_kind, media_type, bytes_base64 }`, sorted by ref, with `content_kind` one of `typed-artifact`, `decision-record`, `operation-record`, `lifecycle-round-checkpoint`, or `raw-public-bytes`. The bytes decode canonically within a 1 MiB per-entry limit; recomputing the appropriate canonical-object or raw-byte SHA-256 must equal `ref`. Starting only from `root_refs`, the verified replay/store/checkpoint resolvers expand the complete public transitive closure, including implementation tree manifests and every manifest-named source byte, and require exact one-to-one closure coverage: no unresolved, omitted, ambient, duplicate, extra, caller-selected, or cross-runtime entry is accepted. Every decoded object is closed-schema validated, every raw body is manifest-bound and credential/private-reasoning scanned before framing, and cycles or byte-budget overflow fail before provider/signer/lock/write. This envelope is a typed artifact for hashing/storage but is not recursively expanded through its own `context_ref`.
- Provenance `status` is `issued`, `rejected`, or `failed`. Issued requires non-null validated/reported provider/model equality plus trimmed response ID and exact route observation class. Rejected requires null validated fields, non-null reported fields and response ID from a complete but invalid/mismatched response. Failed requires all provider/model/report fields and response ID null. `attempt_ref`, `request_ref`, `context_ref`, `route_ref`, and `subject_ref` are SHA-256 refs; context/route refs must equal the signed request and authenticated registry route, while a complete response must echo the context ref. A failed transport derives bindings only from signed request/registry. `validated_*` means validated against the pinned adapter route observed by the controller, not a provider-signed remote model receipt; detached output must preserve `observation_class` and may not upgrade that claim.
- `summary` is a bounded public result summary of at most 4096 UTF-8 bytes. Prompts, raw responses, messages, conversations, transcripts, tool traces, scratchpads, and private reasoning are not artifact kinds and are never fields in an allowed envelope.
- `commit_ref` is null, `git:sha1:<40 lowercase hex>`, or `git:sha256:<64 lowercase hex>` only; arbitrary-length hex labels fail. Command status is an integer or null; signal is a clean string or null. Paths are normalized relative paths without `..`.
- Package manifests bind the complete installable regular-file set, package ID, and exact semantic version. Generic artifact validation checks only the installation proof's closed local shape, canonical Git commit ref, and the exact singleton `test_evidence_refs: [installationTestEvidenceRef]`; it cannot authenticate referenced bodies. Export `validateInstallationProofResolved(authenticatedScanner, { proof, resolveArtifact, resolveRawBytes, resolveGitObject, expectedImplementation, expectedImplementationRef, expectedImplementationGrant, expectedImplementationGrantRef }): void`. It first requires `assertPersistable(authenticatedScanner, value)` for the proof, expected implementation, expected implementation grant, and every artifact returned by `resolveArtifact`; it additionally applies scanner-bound typed validation to the proof, expected implementation, and each resolved typed artifact, while the closed grant validator receives the same retained scanner for the grant. The exact same closure is used throughout one resolution. The artifact/raw/Git resolvers are closed over the verified runtime store or authenticated detached bundle; the expected implementation body/ref come only from the retrospective decision's replay-derived accepted/effective implementation, and the expected grant body/ref come only from authenticated production replay or the detached bundle's authenticated immutable genesis. The validator requires `expectedImplementation` to be exact canonical same-lifecycle `dfm.implementation.v1`, `sha256Ref(expectedImplementation) === expectedImplementationRef`, a non-null canonical `expectedImplementation.commit_ref`, and `proof.source_commit_ref === expectedImplementation.commit_ref`. It resolves `expectedImplementation.tree_root` to the exact same-lifecycle `dfm.tree-manifest.v1`, resolves every manifest-named raw body, and requires the source package manifest to equal the exact regular-file projection of that implementation tree—same complete path set, byte counts, content refs, and bytes under the six governed package roots, with no extra or omitted implementation/source entry. It resolves both package-manifest refs to canonical `dfm.package-manifest.v1` bodies, recomputes each ref, requires byte/canonical body identity, and resolves the singleton evidence ref to canonical `dfm.installation-test-evidence.v1`. That evidence must have the proof's exact `lifecycle_id`, `source_manifest_ref`, and `installed_manifest_ref`; no generic `dfm.evidence.v1` or ambient result is accepted. The resolved `.codex-plugin/plugin.json` entry must be strict single-value UTF-8 JSON whose authenticated source bytes declare exact `name: "multi-model-seats"` and `version: "0.6.0"`; derive the sole allowed registry ID `multi-model-seats@multi-model-local` from that name plus the fixed marketplace. Require `proof.plugin_id`, both manifests' `package_id`, `evidence.installed_cache_binding.plugin_id`, and the selected registry record's `plugin_id` all to equal that exact derived ID, and require `proof.plugin_version`, both manifests' `version`, the descriptor version, installed-cache binding version, and registry-record version all to equal exact `0.6.0`.
- `resolveGitObject(oid)` returns only the immutable canonical Git object bytes captured by the controller snapshot or carried by the authenticated bundle. Resolved proof validation hashes the full `<type> <size>\0<body>` bytes with the algorithm named by the `git:sha1:`/`git:sha256:` OID, parses the expected implementation commit, walks its root tree recursively without link/submodule/special modes, and requires the resulting regular-file path/blob-byte map to equal both the implementation tree manifest and its resolved raw bodies exactly. Every referenced commit/tree/blob needed by that recorded closure must resolve and verify; no ambient checkout or caller Git command may repair a missing object. Thus the proof's commit, implementation tree, source package, installed package, and bundled Git tree are one byte-identical source identity rather than merely the same package version.
- Resolved installation-test validation derives `ordinary_test_paths` as every path in the authenticated installed manifest matching `tests/test-*.mjs` except exactly `tests/test-lifecycle-install.mjs`, sorted uniquely; requires the self-check path to be that manifest entry; and requires exact path equality, `ordinary_test_count === ordinary_test_paths.length`, `self_check_count === 1`, the four auxiliary counts to equal one, and `total_child_process_count === ordinary_test_count + 5`. It resolves `implementation_grant_evidence_ref` and `telos_eye_root_evidence_ref` to same-lifecycle raw-evidence envelopes and their stored bytes. Parse the grant bytes once and require exact `canonicalize(parsedGrant) + "\n"` framing. The result's `authenticated_bindings.authorized_plan_grant_ref` is exactly `sha256Ref(parsedGrant)`, while the grant raw-evidence envelope's distinct `raw_ref` is exactly `sha256BytesRef(Buffer.from(canonicalize(parsedGrant) + "\n", "utf8"))`; neither ref may be substituted for the other. Require deep object equality between `parsedGrant` and `expectedImplementationGrant`, exact canonical byte equality after translating the runtime's no-newline storage framing to the declared one-newline evidence framing, and `authenticated_bindings.authorized_plan_grant_ref === expectedImplementationGrantRef`. Every production caller must additionally require `expectedImplementationGrantRef === replay.implementation_grant_ref`; detached verification obtains the same expected body/ref from authenticated bundled genesis. The grant envelope names `authenticated_bindings.authorized_candidate_ref` as subject, carries that candidate as the envelope subject, and verifies with the stored Eye-root bytes over the closed profile/target/task/trust scope. A second independently valid same-scope grant is rejected because its body/ref is not the runtime's exact immutable grant. The authenticated installed manifest's `records/lifecycle-profiles/daedalus-family-v1.json` bytes independently recompute the required grant profile ref. The Eye-root envelope uses `application/octet-stream`; its raw ref and `authenticated_bindings.telos_eye_root_ref` match exactly, and its envelope subject is that raw ref. Replay/export/detached validation additionally requires the signed grant's `eye_trust_ref` to equal the verified lifecycle config. Thus detached verification reauthenticates the exact runtime declaration rather than trusting result prose.
- Pure scanner-bound `validateInstallationProofResolved` resolves the exact production transport registry through `expectedImplementationGrant.provider_transport_registry_ref`, recomputes that ref, validates the closed runner/observer/action descriptors, and requires the evidence/result runner and observer refs to equal `sha256Ref(registry.identity_fence_runner)` and `sha256Ref(registry.registry_observer)`. It resolves `identity_fence_receipt_ref` to the exact canonical signed `dfm.identity-fence-receipt.v1`, scanner-validates that resolved artifact with the same retained closure, applies the universal strict signature decoder, verifies with only the registry-pinned receipt key, and requires the exact one-use nonce/request plus `plugin-list` action, bootstrap/grant/registry/runner/observer refs, supported platform contract/execution/exposure methods, descriptor-equal source and consumed observer/profile identities, `fence_armed: true`, `process_tree_empty: true`, zero namespace events, no overflow, and exact argv/environment/cwd/status/signal/output bindings. Receipt replay, a duplicate nonce, a signed rejection, transient rename/restore, source/consumed mismatch, or a valid receipt for any other action/registry/runtime fails.

  It then resolves `registry_command_evidence_ref` to same-lifecycle `dfm.command-evidence.v1`; this evidence is deterministically derived from that accepted receipt, not a separate spawn. Require `cwd_ref === source_manifest_ref`, status `0`, null signal, `command === registry.registry_observer.executable_realpath`, args exactly equal to the observer's signed `plugin-list` argv, and byte/ref/count equality to the receipt's bounded stdout/stderr. Bare `codex`, basename equality, PATH resolution, caller commands, another service receipt, or an otherwise byte-perfect result under another runner/observer/action ref is invalid. Raw stdout is preserved byte-for-byte, is at most 1 MiB UTF-8 without BOM, contains exactly one RFC 8259 JSON value with only permitted surrounding whitespace and at most one final newline, and has zero-byte stderr. Deterministically project it into one closed canonical `dfm.plugin-registry-observation.v1`, require its ref to equal `registry_projection_ref`, require exactly one enabled `multi-model-seats@multi-model-local` record at version `0.6.0`, and bind the installed path/ref and subsequent driver cwd to that record. This pure validator performs no `lstat`, `realpath`, IPC, spawn, source/cache read, or ambient lookup; replay/export/detached revalidate the signed consumed-identity receipt after historical service/source/cache paths are gone without claiming remote marketplace attestation.
- It then resolves `driver_command_evidence_ref` to same-lifecycle `dfm.command-evidence.v1`, requires `cwd_ref === installed_manifest_ref`, status `0`, null signal, and the exact no-shell `process.execPath` invocation of `<installed_cache_binding.installed_realpath>/tests/test-lifecycle-install.mjs` with the two expected manifest refs, exact `--expected-identity-fence-runner-ref`, `--expected-registry-observer-ref`, `--expected-identity-fence-receipt-ref`, and explicit bootstrap/grant/Eye-root arguments. Its stdout/stderr refs must resolve to same-lifecycle raw-evidence envelopes whose subjects equal `installed_manifest_ref`; `resolveRawBytes` must yield exactly `canonicalize(driver_result) + "\n"` as UTF-8 `application/json` stdout and zero-byte `application/octet-stream` stderr, with matching raw refs and byte counts. The six `authenticated_bindings` refs in the result must equal the reauthenticated canonical grant, candidate subject, supplied Eye-root bytes, signed runner descriptor, signed observer descriptor, and accepted receipt. Replay, export, and detached verification repeat this pure captured-evidence validation without requiring the historical cache, source, or service to exist; resolver substitution, caller registry metadata, captured receipt/raw/projection/path/ref drift, a copied driver result, or an ambient matching manifest is never a substitute for the exact chain. The proof is valid handoff evidence only when directly reachable from the production retrospective decision.
- An Icarus finding disposition is operation-bound evidence, not a decision `dispositions` shortcut. `pair_stage` is exactly `p1-plan-pair` or `c1-code-pair`; `candidate_ref` is stage-discriminated and equals the canonical TELOS plan candidate at P1 or the governed `dfm.implementation.v1` artifact ref at C1, never the implementation's embedded tree ref. `subject_ref` is the exact pre-transition governed root; `source_decision_ref` plus the non-negative safe `source_finding_index` resolve the exact finding whose stable `finding_id` is being closed; `attempt_ref`/`request_ref` equal the issued Icarus operation. The nested `disposition` is the closed `{ code, action, target_stage, subject_ref }` shape and its subject equals the envelope subject. It is valid only when directly named by that exact issued Icarus decision's `evidence_refs`; ambient, cross-attempt, cross-request, cross-stage, plan/implementation-confused, tree-substituted, or copied dispositions do not close findings. A literal pass decision still has `findings: []` and `dispositions: []`.
- Eye `prefix_root` is a SHA-256 ref authenticated by the Eye signature and later required to equal the lifecycle root immediately before its node. Authority IDs are clean globally unique values; authority refs may appear in at most one Eye decision.
- The governed implementation root is always `sha256Ref(implementationArtifact)`, where `implementationArtifact.artifact_version === "dfm.implementation.v1"`. Its `tree_root` is a separate ref to the exact `dfm.tree-manifest.v1` artifact. Validation requires `plan_root` and `tree_root` to be SHA-256 refs but never requires either to equal the implementation artifact's own ref.

The plan-candidate discriminant is `kind`; all other artifacts use `artifact_version`. The candidate has no wrapper fields so its stored ref is byte-for-byte the TELOS canonical candidate ref; requirement/lifecycle linkage lives in the decision input refs and state. Every artifact/finding/disposition/resolved-proof validator first calls `assertPersistable(authenticatedScanner, value)` and threads that exact closure through nested validation; validation never redacts and accepts. `redactSecrets` is allowed only for an ephemeral diagnostic returned to the caller, never as a way to make an otherwise forbidden artifact persistable.

Resolver tests for `validateInstallationProofResolved(syntheticCredentialScannerForArtifactTest, ...)` cover missing/non-function scanners, unresolved refs/raw bytes/Git objects, wrong artifact kind, wrong package ID/version, proof-only or manifest-only ID/version relabeling, descriptor-name/version drift, registry/cache/proof/manifest label disagreement, differing manifest body/file bytes, stale or recomputed-wrong refs, `source_commit_ref` from a stale or different commit, a same-version package whose source differs from the accepted implementation, implementation-tree/source/Git path or byte drift, wrong Git object type/OID/header/tree mode, source/cache wrong-body or wrong-ref substitution, resolver substitution, same-shaped ambient-manifest/result substitution, cross-lifecycle evidence, wrong command/args/cwd/status/signal, missing/extra/duplicate test paths, count drift, missing/swapped/forged grant/root input evidence or authenticated-binding refs, canonical-ref/raw-ref conflation, wrong grant scope/signature/root, a second valid same-scope grant whose bytes/ref differ from the stored implementation grant, noncanonical stdout, nonempty stderr, and detached replay. Production integration tests separately reject every scanner override key/argument before resolver or persistence activity. Source and installed manifests are required to have identical canonical bodies and therefore the same ref; merely exchanging those two equal ref strings is explicitly not a negative test. Every real substitution case changes a resolved body, canonical ref, accepted implementation/commit/tree binding, authenticated package identity/version, observation binding, command binding, or byte stream and must fail unless the exact refs resolve through the supplied verified store to the replay-selected implementation, its captured Git/tree/raw closure, byte-identical manifests, and the one independently reauthenticated same-lifecycle installation-test evidence object bound to the exact replayed implementation grant.

- [ ] **Step 3B: Add the fail-closed baseline audit**

Create `tests/test-audit-baseline.mjs` with temporary roots proving:

1. the explicit directories `.codex-plugin`, `hooks`, `records`, `scripts`, `skills`, and `tests` pass when their files are public source;
2. an unknown top-level file, symlink, `.env`, `.env.local`, `*.pem`, OpenSSH key, API key, OAuth token, cloud access key, cookie/session value, authorization header, or private-reasoning filename makes the CLI exit nonzero before emitting `BASELINE_AUDIT_OK`;
3. `--files` rejects an absolute path, a path outside the root, a NUL/control path, or a staged path outside the allowlist;
4. no audit output echoes the detected credential value.

Implement `scripts/audit-baseline.mjs --root <absolute-root> --allow "<space-separated-roots>"` and `--files <paths...>` with `lstatSync`/`readFileSync`; reject symlinks and scan bytes without following them. It is read-only, emits one redacted error per rejected path, and emits exactly `BASELINE_AUDIT_OK` only after every selected file passes.

- [ ] **Step 4: Run the focused and baseline tests**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
```

Expected: all core/artifact/audit tests pass; 4 baseline tests pass; 0 failures.

- [ ] **Step 5: Commit**

```bash
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-credential-gate.mjs scripts/lifecycle-core.mjs scripts/lifecycle-artifacts.mjs scripts/audit-baseline.mjs tests/test-lifecycle-credential-gate.mjs tests/test-lifecycle-core.mjs tests/test-lifecycle-artifacts.mjs tests/test-audit-baseline.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: add canonical typed lifecycle records"
```

### Task 2: Daedalus-Family Policy Profile

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-profiles/daedalus-family-v1.json`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-profile.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs`

**Interfaces:**
- Consumes: `sha256Ref(value)` from Task 1.
- Produces: `DEFAULT_PROFILE_PATH: string`, `validateProfile(profile): string[]`, `loadProfile(path?): object`, `stageById(profile, stageId): object`, `profileRef(profile): string`.

- [ ] **Step 1: Write the failing profile test**

Create `tests/test-lifecycle-profile.mjs` that asserts:

```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { loadProfile, profileRef, stageById, validateProfile } from "../scripts/lifecycle-profile.mjs";

test("the profile fixes the four seats and exact gate order", () => {
  const profile = loadProfile();
  assert.deepEqual(Object.keys(profile.seats), ["daedalus", "icarus", "grok", "gemini", "eye", "telos-controller"]);
  assert.equal(stageById(profile, "p2-plan-adversarial").requires.join(","), "grok,gemini");
  assert.equal(stageById(profile, "c2-code-adversarial").requires.join(","), "grok,gemini");
  assert.equal(stageById(profile, "p2-plan-adversarial").prerequisite, "p1-plan-pair");
  assert.equal(stageById(profile, "c2-code-adversarial").prerequisite, "c1-code-pair");
  assert.match(profileRef(profile), /^sha256:[0-9a-f]{64}$/);
});

test("every failing stage returns to Daedalus with no automatic caps", () => {
  const profile = loadProfile();
  assert.deepEqual(profile.automatic_limits, { rounds: null, retries: null, elapsed_ms: null, cost: null });
  for (const stage of profile.stages.filter((item) => item.id !== "closed" && item.id !== "daedalus-recovery")) {
    assert.equal(stage.on_non_pass, "daedalus-recovery", stage.id);
    assert.ok(stage.reentry_stage, stage.id);
  }
});

test("Grok and Gemini lifecycle requirements do not rewrite TELOS authorization seats", () => {
  const profile = loadProfile();
  assert.deepEqual(profile.telos_handoff.council_required_seats, ["claude", "agy", "codex"]);
  assert.deepEqual(profile.telos_handoff.council_advisory_seats, ["grok", "gemini"]);
  assert.equal(profile.telos_handoff.profile_gate_results_are_authority, false);
});

test("unknown fields and seat substitution policy fail closed", () => {
  const profile = loadProfile();
  assert.match(validateProfile({ ...profile, surprise: true })[0], /unknown profile field/);
  assert.match(validateProfile({ ...profile, allow_seat_substitution: true }).join(";"), /allow_seat_substitution must be false/);
});

test("model and route identity come only from the authenticated registry", () => {
  const profile = loadProfile();
  assert.deepEqual(Object.values(profile.seats).slice(0, 4).map(({ route_id, model_source }) => [route_id, model_source]), [
    ["anthropic-daedalus-v1", "authenticated-transport-registry"],
    ["openai-icarus-v1", "authenticated-transport-registry"],
    ["xai-grok-v1", "authenticated-transport-registry"],
    ["google-gemini-v1", "authenticated-transport-registry"]
  ]);
  assert.match(validateProfile({ ...profile, seats: { ...profile.seats, icarus: { ...profile.seats.icarus, model: "caller-model" } } }).join(";"), /unknown seat field/);
  assert.match(validateProfile({ ...profile, seats: { ...profile.seats, icarus: { ...profile.seats.icarus, route_id: "xai-grok-v1" } } }).join(";"), /route_id/);
});

test("transition sentinels and nulls are stage-specific", () => {
  const profile = loadProfile();
  const recovery = profile.stages.find((stage) => stage.id === "daedalus-recovery");
  const closed = profile.stages.find((stage) => stage.id === "closed");
  const p1 = profile.stages.find((stage) => stage.id === "p1-plan-pair");
  assert.deepEqual(validateProfile({ ...profile, stages: profile.stages.map((stage) => stage.id === p1.id ? { ...stage, on_pass: "$reentry" } : stage) }).some((problem) => problem.includes("$reentry is allowed only")), true);
  assert.equal(recovery.on_non_pass, "daedalus-recovery");
  assert.deepEqual(validateProfile({ ...profile, stages: profile.stages.map((stage) => stage.id === recovery.id ? { ...stage, on_pass: "p1-plan-pair" } : stage) }).some((problem) => problem.includes("recovery on_pass must be $reentry")), true);
  assert.deepEqual(validateProfile({ ...profile, stages: profile.stages.map((stage) => stage.id === p1.id ? { ...stage, on_non_pass: null } : stage) }).some((problem) => problem.includes("null transition is allowed only for closed")), true);
  assert.deepEqual(validateProfile({ ...profile, stages: profile.stages.map((stage) => stage.id === closed.id ? { ...stage, reentry_stage: "closed" } : stage) }).some((problem) => problem.includes("closed transitions must be null")), true);
  assert.deepEqual(validateProfile({ ...profile, stages: profile.stages.map((stage) => stage.id === p1.id ? { ...stage, on_pass: "missing-stage" } : stage) }).some((problem) => problem.includes("unknown transition target missing-stage")), true);
});
```

- [ ] **Step 2: Run the test and confirm the profile module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-profile.mjs`.

- [ ] **Step 3: Add the exact profile data**

Create `records/lifecycle-profiles/daedalus-family-v1.json`:

```json
{
  "profile_version": "dfm.profile.v1",
  "id": "daedalus-family-v1",
  "initial_stage": "requirements-freeze",
  "recovery_stage": "daedalus-recovery",
  "terminal_stage": "closed",
  "allow_seat_substitution": false,
  "automatic_limits": { "rounds": null, "retries": null, "elapsed_ms": null, "cost": null },
  "seats": {
    "daedalus": { "provider": "anthropic", "role": "plan-author-architecture-review-recovery", "route_id": "anthropic-daedalus-v1", "model_source": "authenticated-transport-registry" },
    "icarus": { "provider": "openai", "role": "feasibility-review-code-author-remediation", "route_id": "openai-icarus-v1", "model_source": "authenticated-transport-registry" },
    "grok": { "provider": "xai", "role": "cold-adversarial-review", "route_id": "xai-grok-v1", "model_source": "authenticated-transport-registry" },
    "gemini": { "provider": "google", "role": "cold-independent-verification", "route_id": "google-gemini-v1", "model_source": "authenticated-transport-registry" },
    "eye": { "provider": "human", "role": "exact-root-authority", "route_id": null, "model_source": null },
    "telos-controller": { "provider": "local", "role": "deterministic-controller", "route_id": null, "model_source": null }
  },
  "stages": [
    { "id": "requirements-freeze", "artifact_kind": "requirements", "requires": ["eye"], "prerequisite": null, "produces_artifact": false, "on_pass": "plan-draft", "on_non_pass": "daedalus-recovery", "reentry_stage": "requirements-freeze" },
    { "id": "plan-draft", "artifact_kind": "plan", "requires": ["daedalus"], "prerequisite": "requirements-freeze", "produces_artifact": true, "on_pass": "p1-plan-pair", "on_non_pass": "daedalus-recovery", "reentry_stage": "plan-draft" },
    { "id": "p1-plan-pair", "artifact_kind": "plan", "requires": ["daedalus", "icarus"], "prerequisite": "plan-draft", "produces_artifact": false, "on_pass": "p2-plan-adversarial", "on_non_pass": "daedalus-recovery", "reentry_stage": "p1-plan-pair" },
    { "id": "p2-plan-adversarial", "artifact_kind": "plan", "requires": ["grok", "gemini"], "prerequisite": "p1-plan-pair", "produces_artifact": false, "on_pass": "eye-plan-authorization", "on_non_pass": "daedalus-recovery", "reentry_stage": "p1-plan-pair" },
    { "id": "eye-plan-authorization", "artifact_kind": "plan", "requires": ["eye"], "prerequisite": "p2-plan-adversarial", "produces_artifact": false, "on_pass": "code-draft", "on_non_pass": "daedalus-recovery", "reentry_stage": "p1-plan-pair" },
    { "id": "code-draft", "artifact_kind": "implementation", "requires": ["icarus"], "prerequisite": "eye-plan-authorization", "produces_artifact": true, "on_pass": "c1-code-pair", "on_non_pass": "daedalus-recovery", "reentry_stage": "code-draft" },
    { "id": "c1-code-pair", "artifact_kind": "implementation", "requires": ["icarus", "daedalus"], "prerequisite": "code-draft", "produces_artifact": false, "on_pass": "c2-code-adversarial", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "c2-code-adversarial", "artifact_kind": "implementation", "requires": ["grok", "gemini"], "prerequisite": "c1-code-pair", "produces_artifact": false, "on_pass": "disk-truth", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "disk-truth", "artifact_kind": "implementation", "requires": ["telos-controller"], "prerequisite": "c2-code-adversarial", "produces_artifact": false, "on_pass": "eye-implementation-acceptance", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "eye-implementation-acceptance", "artifact_kind": "implementation", "requires": ["eye"], "prerequisite": "disk-truth", "produces_artifact": false, "on_pass": "iliad-retrospective", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "iliad-retrospective", "artifact_kind": "implementation", "requires": ["telos-controller"], "prerequisite": "eye-implementation-acceptance", "produces_artifact": false, "on_pass": "closed", "on_non_pass": "daedalus-recovery", "reentry_stage": "iliad-retrospective" },
    { "id": "daedalus-recovery", "artifact_kind": "recovery", "requires": ["daedalus"], "prerequisite": null, "produces_artifact": true, "on_pass": "$reentry", "on_non_pass": "daedalus-recovery", "reentry_stage": "daedalus-recovery" },
    { "id": "closed", "artifact_kind": "implementation", "requires": [], "prerequisite": "iliad-retrospective", "produces_artifact": false, "on_pass": null, "on_non_pass": null, "reentry_stage": null }
  ],
  "telos_handoff": {
    "council_required_seats": ["claude", "agy", "codex"],
    "council_advisory_seats": ["grok", "gemini"],
    "profile_gate_results_are_authority": false
  }
}
```

- [ ] **Step 4: Implement the profile loader and closed validator**

Create `scripts/lifecycle-profile.mjs`. It must resolve the default path relative to `import.meta.url`, parse JSON, reject unknown top-level/stage/seat/handoff fields, require unique stage IDs and known seat/transition references, require the exact null `automatic_limits`, require `allow_seat_substitution === false`, and require every nonterminal stage to route non-pass to `daedalus-recovery`. Every one of the four model seats must have a unique clean `route_id` and literal `model_source: "authenticated-transport-registry"`; Eye/local seats require both fields null. Provider, seat, and route mappings above are exact. No seat-level `model`, caller-selected model, default, or provider-response selection is accepted. Export the five interfaces listed above and compute `profileRef` with `sha256Ref(profile)`.

The stage validator must also assert this exact ordered path:

```js
const REQUIRED_PATH = [
  "requirements-freeze", "plan-draft", "p1-plan-pair", "p2-plan-adversarial",
  "eye-plan-authorization", "code-draft", "c1-code-pair", "c2-code-adversarial",
  "disk-truth", "eye-implementation-acceptance", "iliad-retrospective", "closed"
];
```

`loadProfile()` must throw `invalid lifecycle profile: <joined problems>` when validation returns any problem; it must not repair or default malformed profile data. Transition validation is exact: `on_pass: "$reentry"` is allowed only on `daedalus-recovery` and is required there; `on_pass`, `on_non_pass`, and `reentry_stage` may be null only on `closed` and all three must be null there; every other transition or prerequisite must name a defined stage; every nonterminal `on_non_pass` is `daedalus-recovery`. This validation runs before `stageById` can return any stage.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
git -C /home/colchis/plugins/multi-model-seats add records/lifecycle-profiles/daedalus-family-v1.json scripts/lifecycle-profile.mjs tests/test-lifecycle-profile.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: define Daedalus family lifecycle profile"
```

Expected: all profile and core tests pass with zero failures; commit succeeds.

### Task 3: Signed Crash-Atomic Merkle-DAG Store

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-journal.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-store.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-operations.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-authority.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/lifecycle-fixtures.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-vectors/v1/vector.json`

**Interfaces:**
- Consumes: canonical JSON/byte hash helpers and the typed artifact registry from Task 1, validated profiles from Task 2, and the immutable persisted controller/Eye public trust.
- Produces: `verifyJournal({ journalDir, kind, publicKey }): VerifiedJournalChain`, `nextJournalCoordinates(priorVerifiedChain): { journal_index, previous_journal_ref }`, `validateNextJournalRecord({ priorVerifiedChain, record, publicKey }): void`, `publishJournalRecord({ journalDir, unsignedRecord, signer, publicKey }): Promise<{ ref, record }>`, the store/authority interfaces, `appendOperation`, `operationRef`, `verifyOperation`, `deriveOperationTerminal`, and `verifyOperationsLog`.

`VerifiedJournalChain` is a deep-frozen module-branded capability that callers cannot construct from plain data. Its closed projection contains `kind`, one `lifecycle_id`, `record_count`, `last_index`, `last_ref`, and ordered verified `{ ref, record }` entries. `nextJournalCoordinates` and `validateNextJournalRecord` accept only a current branded chain returned by this module. Immediately before deriving coordinates and again before exclusive publication, `publishJournalRecord` freshly rereads and verifies the complete disk chain; it rejects stale/caller-created projections. Duplicate or skipped indices, null/wrong predecessors, filename/order swaps, and cross-lifecycle records are chain failures here, never single-node Task 1 properties.

`signer` is the external interface `{ sign(bytes: Buffer): Promise<Buffer>, keyId: string }`. The store never accepts, serializes, logs, or writes a private key. Tests may wrap an ephemeral Ed25519 private key behind this interface.

- [ ] **Step 1: Add reusable test fixtures**

Create `tests/lifecycle-fixtures.mjs` exporting:

```js
import { generateKeyPairSync } from "node:crypto";
import { sha256Ref } from "../scripts/lifecycle-core.mjs";

const testRequirement = {
  artifact_version: "dfm.requirement.v1",
  lifecycle_id: "life-test-1",
  requirement_text: "requirements-v1"
};
const testPolicy = {
  artifact_version: "dfm.policy.v1",
  lifecycle_id: "life-test-1",
  profile_ref: `sha256:${"f".repeat(64)}`,
  rule_refs: []
};

export function controllerKeys() {
  return generateKeyPairSync("ed25519");
}

export function unsignedDecision(overrides = {}) {
  return {
    node_version: "dfm.decision.v1",
    node_type: "decision",
    journal_index: 1,
    previous_journal_ref: null,
    lifecycle_id: "life-test-1",
    stage: "requirements-freeze",
    transition: { kind: "decision", mutation_kind: null, target_stage: null },
    artifact_hash: sha256Ref(testRequirement),
    parent_hashes: [],
    input_refs: [sha256Ref(testRequirement)],
    output_refs: [],
    actor: { seat: "eye", provider: "human", model: "eye-record-v1" },
    provenance_ref: null,
    operation_prepared_ref: null,
    decision: { verdict: "pass", findings: [], dispositions: [] },
    evidence_refs: [],
    authority_ref: sha256Ref({ authority: "fixture-ref-only" }),
    policy_ref: sha256Ref(testPolicy),
    recorded_at: "2026-07-21T12:00:00.000Z",
    ...overrides
  };
}
```

- [ ] **Step 2: Write failing store and authority tests**

Create `tests/test-lifecycle-store.mjs` with these `node:test` cases:

1. persist typed request, requirement, policy, provenance, and evidence envelopes; publish a genesis node and child through an external signer; then assert two immutable canonical decision files with exact signed index/predecessor continuity, valid signatures, one DAG leaf, and a SHA-256 lifecycle root;
2. publish two independent cold-review children with the same base parents; assert two sorted leaves and a changed root after each publication;
3. reject absent, later, duplicate, or cyclic parent lineage;
4. modify one stored verdict byte and reject it as a non-canonical record, decision-ref mismatch, or invalid controller signature;
5. modify whitespace or key order in an artifact while preserving its parsed value and reject `artifact bytes are not canonical`;
6. write a binary source blob containing `ff 00 80` through the raw-byte evidence helper and prove its raw-byte ref equals the Task 1 golden vector without UTF-8 decoding; require the returned closed `dfm.raw-evidence.v1` envelope to bind exact byte count, media type, lifecycle, and subject, and reject unknown metadata or a mismatched byte count;
7. put/read a typed requirement whose `requirement_text` is the literal string `"null"`; assert byte-identical round trip, ref equality with the exact bytes written, and inequality with a requirement whose field value is null (which schema validation also rejects);
8. reject any node whose artifact/input/output/provenance/evidence/authority/policy ref is missing;
9. reject a second provenance with the same normalized attempt ref or trimmed response ID; reject response identifiers that differ only by surrounding whitespace;
10. reject actor/provenance seat, provider, model, lifecycle, subject-root, request-root, or status mismatch; specifically reject a `pass` backed by `status: "failed"`;
11. reject a profile provider spoof even when the controller signature is valid;
12. recursively scan the store and assert no private key, credential, prompt, raw response, conversation, transcript, or private-reasoning field was written;
13. kill a child process before/after temp creation, write, file fsync, exclusive link publication, directory fsync, and cleanup for decisions, typed artifacts, and raw blobs; on restart accept only complete old or complete new content, ignore/diagnose orphan temps, and never accept torn finals;
14. swap sibling decision files, swap two otherwise valid sequential records, alter filename/index/predecessor, or publish two candidates for one index; verification fails. Two writers racing the same index produce one winner and one `JOURNAL_CAS_CONFLICT`, never two records;
15. external signer framing and every persisted signature envelope are passed through the shared strict decoder. For decision, operation, and checkpoint phases table wrong key/key ID, empty, padded, whitespace, standard-base64 alphabet, short/long, non-round-tripping tail-bit alias, altered canonical bytes, and invalid signature; reject before target temp creation while preserving the valid prefix.
16. persist and close the canonical implementation grant, require its ref in lifecycle config, then reopen the storage layer in a fresh process with an independently loaded path-origin-branded production trust anchor. Missing/wrong roots, a byte-identical root copied under the runtime, a symlink, directory/FIFO/nonregular root, a replaced path after load, and a coherently attacker-substituted config/grant/trust/controller-key/artifact/journal tree all fail in `openLifecycleStore`/`verifyLifecycleStore` before any journal or projected-state read. Replay, controller/CLI, and export reopen assertions belong to Tasks 5, 8, and 9 respectively and are not imported by this Task 3 suite.
17. publish and reread fixed SHA-1 and SHA-256 canonical Git object bytes through `putGitObject`; require the object header type/declared length, algorithm, OID, immutable path, and bytes to agree. Wrong algorithm/OID/type/length, malformed tree bytes, a differing existing object, a symlink, and torn publication fail. A closed resolver over the verified store returns only byte-identical objects by canonical `git:sha1:`/`git:sha256:` OID and never shells out or consults an ambient repository.

Create `tests/test-lifecycle-journal.mjs` with reusable decision/operation/checkpoint fixtures and subprocess fault injection at every publication syscall. Run the same continuity suite over all three journal kinds: duplicate/skipped index, null/wrong predecessor after genesis, non-null genesis predecessor, swapped files, stale branded chain, plain-object imitation, and cross-lifecycle append all fail before signer/temp creation. Require exclusive final names `<20-digit-index>.json`, canonical `{ ref, record }` bytes, signed `journal_index`/`previous_journal_ref`, in-memory signature/ref/predecessor validation before temp creation, atomic `linkSync(temp, final)` (or a proven equivalent non-overwriting primitive), final-directory fsync, and CAS conflict behavior independent of advisory locks. A race for one coordinate has exactly one winner; the loser cannot silently rebase.

Create `tests/test-lifecycle-operations.mjs` and prove:

1. `invocation-started` containing the exact canonical closed request body/ref, followed by exactly one `invocation-prepared` and exactly one `invocation-finished` or `invocation-died`, verifies;
2. every immutable operation file is exact `canonicalBytes({ ref, record })`; changing bytes, filename, ref, signature, journal index/predecessor, order, or controller key fails;
3. deleting a start creates an orphan prepared/terminal and fails; start-only is exactly `prepare_missing`; start+prepared with absent/partial materialization is exactly `decision_missing`; start+prepared+decision without terminal is exactly `terminal_missing`; deleting or altering any other record fails, never silently succeeds;
4. duplicate refs, duplicate starts for one attempt, two terminals for one start, terminal-before-start, orphan finish/died, and reuse of an attempt by another seat/process fail;
5. terminal lifecycle/stage/transition/seat/provider/model/attempt/request/subject/input/output fields must equal its start. `started_ref` must equal the signed start ref; tampering with start request body/ref, request intent fields, stage, transition, singleton authoring output, or pre-transition subject fails signature/ref/closed-request verification;
6. `decision_ref` must resolve to exactly one lifecycle decision and `provenance_ref` to that node's closed provenance artifact; node stage/transition/input/output, actor, and provenance lifecycle/seat/provider/model/attempt/request/subject must equal the signed operation intent;
7. table-test `deriveOperationTerminal`: failed provenance plus non-pass `PROVIDER_DIED` returns `invocation-died`; issued provenance plus pass, provider refusal, or any valid non-pass without `PROVIDER_DIED` returns `invocation-finished`. Reject failed provenance without `PROVIDER_DIED`, failed provenance containing `PROVIDER_REFUSED`, issued provenance containing `PROVIDER_DIED`, issued provenance paired with died, failed provenance paired with finished, pass with failed provenance, and any terminal state unequal to the derived value;
8. use the same issued-pass, issued-refusal, issued-valid-non-pass, rejected-model/provider response, and failed-`PROVIDER_DIED` fixtures in normal and recovery completion and require byte-identical prepared artifacts/unsigned decision, exactly one provenance/decision, and identical terminal selection;
9. fault/kill immediately after start, then delete the caller request file and discard all caller/process memory. A fresh process must reload exact request bytes only from signed start, publish deterministic death preparation, materialize one byte-identical request plus one provenance/decision/terminal, and make zero provider calls. Repeat faults after prepared publication, every prepared artifact/raw write, decision publication, and before/after terminal; every prefix converges exactly;
10. operation records never change lifecycle heads/root, satisfy a stage, supply provenance without a lifecycle decision, or carry an authority ref. Swap start/prepared/terminal files or decision/prepared cross-links and fail;
11. reproduce an issued response crash after provenance/evidence materialization but before decision publication and prove recovery reuses the prepared provenance/artifact bytes rather than creating a duplicate attempt/response/provenance;
12. replace the start request body while preserving its ref, replace the ref while preserving its body, or drift any request lifecycle/stage/seat/provider/model/subject/input/output field. Verification and recovery fail before provider/signer/temp/materialization activity with complete runtime-byte equality.
13. require `round_checkpoint_ref` to be exactly null or one well-formed SHA-256 ref and byte-identical across a start/prepared/terminal operation chain. Task 3 assigns no stage, reviewer, coverage, or caller-selection semantics to that reserved field; Task 11 adds those rules after the checkpoint schema exists.
14. prove the generic prepared-artifact commitment can carry any Task-1-valid typed artifact, including a fixture `dfm.icarus-finding-disposition.v1`, only when its canonical body/ref is directly committed and referenced. Task 3 does not decide whether such an artifact closes a finding; Task 11 owns source/index/attempt/request/candidate/subject/checkpoint semantics and ambient-copy rejection.

Create `tests/test-lifecycle-authority.mjs`. Generate independent controller and Eye Ed25519 keys and prove:

- a controller-signed Eye node is rejected without `authority_ref`;
- a trusted Eye signature with exact immutable lifecycle/profile/target scope passes static verification; controller signing, unknown key ID, altered signed byte, altered signature, untracked trust key, wrong lifecycle/profile/target, unknown action, and unsigned artifacts fail;
- a correctly Eye-signed artifact with a semantically wrong but well-formed subject, requirement root, policy root, action/stage pair, or implementation/tree-root choice passes static verification. Mark these fixtures `STATIC_ONLY`; Task 5 must reject each against prefix state;
- every Eye node without `authority_ref`, and every non-Eye node with one, fails static store verification.
- trust bytes must be canonical regular non-symlink bytes whose ref equals immutable `lifecycle.json.eye_trust_ref`; the external root itself is accepted only through the path-and-runtime-aware public loader, never through a public bytes parser. Caller-supplied substitute trust, altered target kind/path/range, wrong Eye actor tuple, reused authority ID/ref, and wrong `prefix_root` fail. Mutate-away/mutate-back cannot reuse an earlier authority.
- production initialization and static store open start from an external tracked TELOS root. Exact-root trust and correctly root-signed delegation pass; a self-selected root/delegate, unauthorized rotation, wrong delegation action/profile/target/task-range, grant/trust-ref mismatch, external-root mismatch, or ephemeral trust marked production fails before runtime creation. Ephemeral keys pass only with `trust_class: "synthetic-test"`; Tasks 8 and 9 prove that they can never satisfy production controller/export.
- close and reopen only the Task 3 store in fresh processes; each open must independently call `loadProductionTrustAnchor({ externalRootPath, expectedExternalRootRef, authorizationBootstrapPath, expectedAuthorizationBootstrapRef, runtimeDir })` with both raw SHA-256 refs retained outside the runtime and repeat root/packet/raw-grant/trust/registry/reviewed-path verification. The loader stable-opens root and packet once, requires both independent refs before parsing, authenticates the packet with fixed Node primitives, and later consumers require runtime grant/trust/registry byte identity to its authenticated bodies. Unset/unknown/derived expected refs, forged root/packet, byte-identical copies under another path, hardlink/symlink/nonregular/missing inputs, runtime aliases, path replacement, altered grant/trust/registry/reviewed-helper binding, and coherent root-plus-runtime substitution under attacker refs all fail against the legitimate retained refs before selected code or journal read. Future replay/controller/status/resume/export behavior is not a Task 3 dependency.

Each test creates a temporary directory with `mkdtempSync`, removes it with `t.after`, and wraps keys from `controllerKeys()` behind the signer interface. No test passes a private key into `createLifecycleStore`.

- [ ] **Step 3: Run the store test and confirm the module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-store.mjs`.

- [ ] **Step 4: Implement the controller-only store**

Implement `scripts/lifecycle-store.mjs` with these exact persistence rules:

```js
const FILES = {
  lifecycle: "lifecycle.json",
  implementationGrant: "implementation-grant.json",
  decisions: "decisions",
  operations: "operations",
  roundCheckpoints: "checkpoints/lifecycle-round",
  journalPending: ".journal-pending",
  publicKey: "controller-public-key.json",
  authorityTrust: "eye-authority-trust.json",
  artifacts: "artifacts",
  raw: "raw",
  gitObjects: "git-objects"
};
```

The four immutable production genesis files have exact closed schemas; the synthetic-test set has three because its grant is forbidden. `lifecycle.json` is:

```js
{
  lifecycle_config_version: "dfm.lifecycle-config.v1",
  lifecycle_id: "life-...",
  profile_ref: "sha256:...",
  initial_requirement_root: "sha256:...",
  initial_policy_ref: "sha256:...",
  controller_public_key_ref: "sha256:...",
  eye_trust_ref: "sha256:...",
  implementation_grant_ref: "sha256:..." | null,
  target: { kind: "checkout", path: "/normalized/absolute/realpath", task_range: "1-11" }
}
```

`controller-public-key.json` is exactly `{ controller_public_key_version: "dfm.controller-public-key.v1", key_type: "ed25519", key_id, public_key_der_base64 }`. For production, `implementation_grant_ref` is non-null and `implementation-grant.json` is exactly `{ authority_version: "telos.eye-implementation-authority.v1", action: "grant-implementation", subject_ref, scope: { profile_ref, target_kind: "checkout", target_path, task_range: "1-11" }, status: "GRANTED", eye_trust_ref, provider_transport_registry_ref, reviewed_head, signature: { algorithm: "ed25519", key_id, value } }`. Its canonical ref must equal the config; its subject/profile/target/trust fields must equal the plan/config/trust values; and its registry ref must resolve to exact canonical `dfm.production-transport-registry.v1` bytes in content-addressed storage with matching profile/target, detector descriptor, adapter-validator descriptor, registry-observer descriptor, and four dependency-bound profile routes. The registry is immutable through the signed grant ref rather than a new lifecycle-config field, preserving the fixed Task 3 config vector. For the distinct synthetic-test initializer only, `implementation_grant_ref` is null and `implementation-grant.json` must be absent; its private capability supplies a disjoint synthetic route registry that cannot validate as production. `eye-authority-trust.json` is exactly `{ eye_trust_version: "dfm.eye-authority-trust.v1", trust_class: "production" | "synthetic-test", root: { key_id, public_key_der_base64 }, delegation }`, where `delegation` is null or exactly `{ delegation_version: "telos.eye-delegation.v1", delegate: { key_id, public_key_der_base64 }, scope: { profile_ref, target: { kind: "checkout", path, task_range: "1-11" }, actions: ["accept-implementation", "adjudicate", "amend-policy", "amend-requirement", "authorize-plan", "cancel", "freeze-requirements", "pause", "return-implementation", "return-plan", "return-requirements"] }, issued_at, signature: { algorithm: "ed25519", key_id, value } }`; `actions` is exactly sorted as shown. All nested objects reject unknown keys.

All production genesis files are exact TELOS-canonical UTF-8 bytes: no BOM, leading/trailing whitespace, indentation, or trailing newline. Initialization accepts the external TELOS authority record only in its required canonical-plus-one-newline framing, parses it once after signature/closed-shape verification, and persists the byte-identical signed object in this runtime no-newline framing; field values, signature, and `sha256Ref(grant)` cannot change. Synthetic genesis has the same no-newline rule but intentionally omits the grant file. Canonicalization sorts object keys recursively and preserves array order. `lifecycle_config_ref = sha256Ref(lifecycleConfig)` is derived and never embedded in the config. The store recomputes it and includes it in replay and the handoff manifest/logical config entry.

Check in a Task-3-independent `vector.json` with two explicitly disjoint namespaces. `config_hash_vector` contains only the literal config below using `life-test-1`, refs made of 64 repetitions of `1` through `6`, and target `/opt/telos/plugin`; its exact canonical ref is `sha256:d7ad208bbacd63e2a2bdbf1ba2453db971dcbc312ee0afb7434ae72a7bfa7c57`. The repeated-`6` implementation-grant ref is an intentionally opaque hash-domain placeholder: this namespace has no grant body, is never passed to production initialization/open/replay, and makes no claim that a grant hashes to it. Separate `production_genesis_and_journal_vector` data contains a real fixed public key, precomputed signed grant, matching trust/registry/config bodies with the grant's *actual* canonical ref, and signed decision/operation journal records—never private keys—plus literal expected grant/config/record/lifecycle refs. Production tests recompute every relationship only within that second namespace and must reject any attempt to pair its grant with `config_hash_vector`. The file contains no export manifest, detached verifier, bundle root, final checkpoint schema, or implementation fixture owned by a later task. Task 3 one-byte negatives alter the applicable namespace's config/grant body or ref, normalized target, journal predecessor, and signature. Task 11 creates the final implementation/checkpoint/manifest/detached-bundle vector only after the final verifier and export formats are complete.

The config vector's literal canonical bytes are exactly the UTF-8 bytes of this single line, with no trailing newline:

```json
{"controller_public_key_ref":"sha256:4444444444444444444444444444444444444444444444444444444444444444","eye_trust_ref":"sha256:5555555555555555555555555555555555555555555555555555555555555555","implementation_grant_ref":"sha256:6666666666666666666666666666666666666666666666666666666666666666","initial_policy_ref":"sha256:3333333333333333333333333333333333333333333333333333333333333333","initial_requirement_root":"sha256:2222222222222222222222222222222222222222222222222222222222222222","lifecycle_config_version":"dfm.lifecycle-config.v1","lifecycle_id":"life-test-1","profile_ref":"sha256:1111111111111111111111111111111111111111111111111111111111111111","target":{"kind":"checkout","path":"/opt/telos/plugin","task_range":"1-11"}}
```

- Implement `lifecycle-journal.mjs` once for decisions, operations, and checkpoints. Final records are immutable canonical files named only by zero-padded signed `journal_index`; each signed record contains exact `journal_index` and `previous_journal_ref` (`null` only at index 1). Publication freshly obtains a branded `VerifiedJournalChain`, derives the one next coordinate, validates the unsigned record, obtains the external signature, rejects noncanonical base64url/padding or decoded length other than 64, checks exact key ID/Ed25519 signature/full signed ref/state-machine/predecessor in memory, freshly reverifies disk, and only then writes a same-filesystem temp with `wx`, fsyncs it, exclusively hard-links it to the final index path, fsyncs the journal directory, and removes/fsyncs the temp directory. No byte for the target record is published before its cryptographic validation; earlier valid append-only bytes are never rolled back. `EEXIST` is a CAS conflict; never overwrite or silently retry with a new predecessor.
- Orphan temp files are never journal members. Verification reports them separately and proves every final filename/index/ref/signature/predecessor byte. Advisory PID locks may reduce contention but grant no authority; the exclusive final index publication is the serialization/fencing CAS. A second writer or resumer must reverify after `JOURNAL_CAS_CONFLICT` and stop if another pending/settled attempt now exists.
- `signDecision` is a test helper using the same in-memory validation. The storage-only `store.publishDecision` assigns the already-reserved next decision journal index/predecessor committed by `invocation-prepared`, signs exact canonical bytes, validates signature/key/ref/predecessor/state in memory, and calls the common atomic publisher. There is no direct append or JSONL authority.
- Production initialization receives a module-created verified genesis context, not caller assertions. Before creating `dir`, it canonical-validates the exact controller public-key/grant/trust/config/transport-registry bodies; recomputes `controller_public_key_ref`, `implementation_grant_ref`, `eye_trust_ref`, `provider_transport_registry_ref`, and `lifecycle_config_ref`; verifies the implementation grant signature and exact plan/profile/target/task-range/trust/registry-ref scope against a separately trusted `ProductionTrustAnchor`; stable-reads the signed detector and grammar-validator sources, requires their already-created plugin copies to be byte-identical, parses every adapter with that exact validator, verifies each dependency manifest/root, stable-reads every registry route executable, verifies path/identity/model/environment/raw-ref plus the one media-aware credential scan, and stable-validates the external registry-observer descriptor without executing it; and verifies that production trust contains that exact root or a closed root-signed delegation with the same profile/target/action scope. A self-selected key/route/validator/detector/observer, unauthorized rotation, wrong delegation scope/target/profile, root/registry mismatch, or `synthetic-test` trust/route for production fails before any runtime byte. Only then may `createLifecycleStore` create `dir`, exclusively persist the four genesis schemas above, content-addressedly persist/reread the exact registry, both reviewed validator source bodies, and each verified adapter raw body under its signed raw ref, and perform first replay. Detector/validator/adapter raw refs and route dependency manifests/roots are therefore closed handoff dependencies even though no runtime credential value or registry-observer executable body is stored. The observer descriptor/ref is persisted through the registry; its potentially large external executable is live-revalidated only when observation is required. None may be replaced/defaulted.
- `loadProductionTrustAnchor({ externalRootPath, expectedExternalRootRef, authorizationBootstrapPath, expectedAuthorizationBootstrapRef, runtimeDir })` is the only public production-authorization loader and rejects every other key. All three paths are closed normalized absolute paths; both expected values are well-formed raw SHA-256 refs retained independently of supplied paths, runtime, config, grant, trust, registry, or environment. Before parsing either input or reading runtime state, it bounded-stable-opens the exact single-link root and packet once with no link following, requires their independent refs, rejects equality/containment/runtime aliases, parses the packet's exact two-line frame with only fixed Node primitives, applies the universal strict signature decoder, verifies its domain-separated signature with the retained root buffer, and validates the closed raw descriptor/reviewed-target structure. No selected helper or external canonicalizer runs here. The returned deep-frozen module brand retains exact root/packet buffers, refs, origins, file identities, and authenticated payload. Consumers use only those retained buffers, require origin defense-in-depth identities unchanged, stable-open packet-named raw grant/trust/registry once, require exact raw refs and runtime-body equality, validate reviewed commit/exact helper descriptors, then stable-open/import the exact canonicalizer buffer first and re-prove canonical packet/grant/trust/registry bodies/refs/signatures. There is no caller-bytes, compile-time, runtime-derived, environment-selected, grant-selected, path-derived, filename, or same-byte fallback. Every fresh production process supplies all four explicit path/ref flags; only after this authorization anchor succeeds may store/replay/controller/checkpoint/installation/export read genesis and selected helpers. Missing/wrong/unknown/derived refs, same-byte copies or alternate filenames, hardlinks/symlinks, directories/FIFOs, path replacement, registry/helper substitution, and coherent attacker root/packet/runtime trees fail before projection, provider, observer, signer, lock, or persistence.
- `createLifecycleStore` is reachable in production only from a module-private `AuthenticatedGenesis` and captures its retained authenticated scanner; no public store method accepts or replaces a scanner. `putArtifact(value)` calls `assertTypedArtifact(authenticatedScanner, value)`, derives exact canonical bytes/ref, then uses crash-atomic immutable content publication: same-filesystem temp `wx`, complete write, file fsync, exclusive hard-link to the content-addressed final name, directory fsync, and temp cleanup/fsync. An existing final is accepted only after exact byte/ref validation; torn finals are corruption and are never overwritten. Fault injection at every syscall leaves either old state or one complete new value plus ignorable orphan temp.
- `putRawEvidence(bytes, metadata)` accepts only closed metadata `{ lifecycle_id, media_type, subject_ref }`, publishes raw bytes under `raw/<hex>.bin` through the same crash-atomic content primitive, constructs/persists the closed envelope through `putArtifact`, and returns `{ artifact_ref, artifact }`. The envelope's `raw_ref = sha256BytesRef(bytes)` and `byte_count = bytes.length`. Caller-supplied raw refs/counts, unknown metadata, media drift, or differing existing bytes fail.
- `putGitObject({ oid, objectBytes })` is a controller-only immutable primitive for snapshot capture. `oid` is canonical `git:sha1:<40 lowercase hex>` or `git:sha256:<64 lowercase hex>` and `objectBytes` are the complete uncompressed canonical `<type> <decimal-size>\0<body>` bytes. It parses one allowed Git `commit`/`tree`/`blob`/`tag` header, requires exact declared length, hashes the complete bytes with the OID's algorithm, and publishes under `git-objects/<algorithm>/<hex>.object` through the same crash-atomic non-overwriting primitive. `readGitObject(oid)` repeats all checks and returns a fresh byte copy; verified runtime and detached-bundle resolvers close over this interface and never use ambient `git cat-file` during proof replay. Unknown types, mixed algorithms, aliases, symlinks, malformed tree entries, differing existing bytes, and torn finals fail closed.
- `readArtifact(ref)` reads raw bytes, parses once, runs `assertTypedArtifact(authenticatedScanner, parsed)` with that same privately captured closure, recomputes `canonicalBytes(parsed)`, requires byte equality before hashing, and requires both `sha256BytesRef(rawBytes)` and `sha256Ref(parsed)` to equal `ref`. Whitespace and key-order drift therefore fail even if JSON.parse would yield the same value.
- `readEntries` projects `verifyJournal(decisions)` records as decisions: require every final file to equal `canonicalBytes({ ref, record })`, exact filename/index/predecessor continuity, no gaps/duplicates/swaps, and valid signature/ref before DAG checks.
- `store.publishDecision` is a storage primitive, not routing authority. It verifies the complete store and prepared-operation commitment; requires the decision's exact journal index/predecessor and `operation_prepared_ref`; resolves all direct/transitive refs; validates signature in memory; atomically publishes; then re-verifies. Model decisions must equal the prepared unsigned bytes and artifact set. Eye/local decisions require null prepared ref and dedicated controller capabilities.
- `verify()` recomputes all artifact/raw/decision/root refs, validates the decision journal and DAG, and binds every model decision to exactly one prepared operation and provenance. Issued provenance validates response provider/model against request/profile/node; rejected provenance records reported mismatch without pretending validation; failed provenance has no response facts. Attempt/response IDs are unique, literal pass requires issued provenance plus empty findings/dispositions, and failed/rejected require non-pass.
- Every Eye node requires non-null unique authority and exact actor `{ seat: "eye", provider: "human", model: "eye-record-v1" }`; every non-Eye node requires null. Static verification loads trust only from canonical persisted bytes, checks `eye_trust_ref`, signature/static scope/fixed target, globally unique authority ID/ref, and well-formed `prefix_root`. Prefix equality remains Task 5 semantics.
- `verifyLifecycleStore({ dir, profile, productionTrustAnchor })` accepts no caller trust/target/route. For a production store it requires the branded independent anchor, authenticates exact canonical immutable config/grant/trust/public-key schemas, recomputes all refs including `implementation_grant_ref` and `lifecycle_config_ref`, re-verifies grant signature/scope/trust/registry binding and the root/delegation chain, resolves the exact registry body/ref, detector/validator raw bodies, every dependency manifest/root, every adapter raw body, and all operation route refs, then verifies atomic decision chains, content refs, signatures, provenance/request/context/route/prepared bindings, parent order, and DAG root. It never repairs or substitutes state. Synthetic stores are accepted only by the separate synthetic-test verifier capability and are rejected by this production interface.
- `deriveLifecycleRoot(entries)` returns `sha256Ref({ root_version: "dfm.root.v1", leaves: sortedLeaves })`; the empty root is the same envelope with an empty leaf array. Parents must already exist, making append-time cycles impossible.

Implement `scripts/lifecycle-operations.mjs` over the common immutable operation journal. The closed signed record is:

```js
{
  operation_version: "dfm.operation.v1",
  journal_index: 1,
  previous_journal_ref: null,
  lifecycle_id: "life-...",
  state: "invocation-started" | "invocation-prepared" | "invocation-finished" | "invocation-died",
  stage: "p2-plan-adversarial",
  transition: { kind: "decision", mutation_kind: null, target_stage: null },
  seat: "grok",
  provider: "xai",
  model: "exact-model-id",
  route_ref: "sha256:...",
  attempt_ref: "sha256:...",
  request_ref: "sha256:...",
  request_artifact: null | { /* exact closed dfm.seat-request.v1 */ },
  context_ref: "sha256:...",
  context_artifact: null | { /* exact closed dfm.seat-public-context.v1 */ },
  subject_ref: "sha256:...",
  round_checkpoint_ref: null | "sha256:...",
  input_refs: ["sha256:..."],
  output_refs: [],
  decision_journal_index: 7,
  decision_previous_journal_ref: "sha256:..." | null,
  started_ref: null | "sha256:...",
  prepared_ref: null | "sha256:...",
  prepared_commitment_ref: null | "sha256:...",
  prepared_decision_ref: null | "sha256:...",
  prepared_decision: null | { /* exact closed unsigned dfm.decision.v1 */ },
  prepared_artifacts: [],
  decision_ref: null | "sha256:...",
  provenance_ref: null | "sha256:...",
  recorded_at: "2026-07-21T12:00:00.000Z",
  controller_key_id: "controller-key-id",
  controller_signature: "base64url"
}
```

Rules:

- Reject every unknown/missing/nested field and run `assertPersistable`. Journal, stage, transition, input/output, request/context/route, model, `round_checkpoint_ref`, and decision-reservation fields are exact. Start alone has non-null `request_artifact` and `context_artifact`: the exact canonical closed `dfm.seat-request.v1` and `dfm.seat-public-context.v1` bodies. Require `sha256Ref(request_artifact) === request_ref`, `sha256Ref(context_artifact) === context_ref`, `request_artifact.context_ref === context_ref`, `request_artifact.route_ref === route_ref`, and exact equality of their lifecycle/stage/seat/subject plus the request provider/model/input/output/checkpoint fields to the signed operation intent and grant-bound registry route. At Task 3, `round_checkpoint_ref` is only a reserved null-or-SHA-256 field repeated byte-identically through the operation; no checkpoint schema, stage mapping, coverage rule, or caller-selection rule is imported. Task 11 later restricts it to null at P1/C1 and the controller-derived current checkpoint at P2/C2. All other body/linkage fields are null/empty, and start reserves the next verified decision journal index/predecessor. Prepared and terminal set both body fields to null, repeat `request_ref`/`context_ref`/`route_ref`/intent including the checkpoint, and resolve bodies/route only through their verified `started_ref` and authenticated registry. Prepared contains exact `prepared_decision` plus unique sorted `prepared_artifacts: [{ ref, artifact }]`; terminal names the full signed `prepared_ref`, decision, and provenance and carries no bodies.
- Prepared artifacts are the complete provider-result typed set not already committed before invocation: exactly provenance and every public provider-evidence artifact referenced by the decision. The request/context pair is not duplicated there; the materialization set is the exact request and context bodies from signed start plus `prepared_artifacts`. Every ref/body is canonical, closed, secret-free, matches its ref, and no body is unreferenced. Use this exact non-circular commitment: construct `prepared_decision_base` with `operation_prepared_ref: null`; compute `prepared_commitment_ref = sha256Ref({ commitment_version: "dfm.prepared-commitment.v1", request: started.request_artifact, context: started.context_artifact, decision: prepared_decision_base, artifacts: prepared_artifacts })`; set `prepared_decision.operation_prepared_ref = prepared_commitment_ref`; put that value in prepared; sign the enclosing operation and derive its full `prepared_ref`. Verification reloads signed start, resets the decision field to null, and recomputes the same request+context+decision+artifacts commitment.
- All operation records use the common sign-validate-atomic-publish protocol and `decodeCanonicalEd25519Signature` before cryptographic verification. Any noncanonical/invalid signature, key, ref, or predecessor publishes no target byte and preserves the prefix. Invalid start leaves no attempt; invalid prepared leaves `prepare_missing`; invalid decision leaves `decision_missing`; invalid terminal leaves `terminal_missing`.
- The operation journal's exclusive next-index publish is the cross-process CAS. Only after winning does the controller discard caller request/context memory, reload/reverify the signed start, derive `canonicalBytes(start.request_artifact)` and `canonicalBytes(start.context_artifact)`, construct the exact closed transport frame from those bytes, and invoke the provider with that frame. Caller files/bytes and ambient filesystem state are never used after start publication. A loser never invokes. Lock files cannot override this fact.
- `verifyOperationsLog` requires the decision to equal the prepared unsigned bytes plus verified controller signature, `node.operation_prepared_ref === prepared.prepared_commitment_ref`, terminal `prepared_ref` to name the full signed prepared operation, the start request/context and every prepared ref/body to equal materialized storage, and all request/context/provenance/actor/intent bindings to match. One attempt owns exactly one signed request body, one signed public-context body, both materialized typed artifacts, a prepared record, provenance, decision, and terminal.
- `deriveOperationTerminal` is the only total terminal rule. Failed provenance plus non-pass `PROVIDER_DIED` derives died. Issued pass (necessarily empty) or issued valid non-pass/refusal/truncation derives finished. Rejected complete response mismatch/malformed non-pass also derives finished. All inconsistent status/verdict/code/terminal combinations reject.
- Return closed `{ operation_refs, attempts, pending }`. Pending kinds are `prepare_missing` (start only), `decision_missing` (prepared exists, decision absent or artifacts partial), and `terminal_missing` (exact decision exists). The attempt projection includes committed prepared bytes/artifacts and reservation. No other orphan/ambiguity is recoverable.
- Recovery is idempotent and never calls a provider: `prepare_missing` reloads/validates the exact request and context bodies/refs/intent from signed start, constructs deterministic failed provenance and death decision from those committed bytes, and publishes the request/context-bound prepared record. All recovery-generated `issued_at`/`recorded_at` values equal signed `start.recorded_at`; recovery never reads a clock. `decision_missing` atomically materializes the start request/context plus every prepared artifact with byte-equality acceptance, validates/signs/publishes the exact reserved decision; `terminal_missing` derives/publishes only terminal. External files and caller memory are irrelevant. Repeated fresh processes converge on identical refs/bytes or lose CAS and replay the winner.
- Every model-seat lifecycle decision must be linked by exactly one settled or terminal-missing attempt. Eye/local-controller decisions have no operation. Operations never enter `deriveLifecycleRoot`, lifecycle heads, stage completion, evidence/authority sets, or provider consensus.

Table every invalid signer form at each record phase. For each row assert target-record absence, byte-identical prior prefix, and the exact pending projection above. For the disk-decision row, content-addressed manifest/command/raw evidence may already exist after pure result validation; without the signed decision those ambient refs are excluded from replay evidence/export, cannot set `disk_truth_tree_root`, and cannot advance state. One retry must derive or byte-identically reuse the same refs before publishing exactly one decision.

Implement `scripts/lifecycle-authority.mjs` so `eyeAuthoritySigningBytes` removes only the closed `signature` object and canonicalizes the remainder. The interfaces remain exactly `verifyEyeAuthorityStatic({ artifact, node, lifecycleConfig, persistedTrust })` and `verifyEyeAuthorityAtPrefix({ artifact, node, prefixState, prefixRoot, usedAuthorityIds, usedAuthorityRefs, lifecycleConfig })`. Static verification resolves canonical persisted trust only through the authenticated root/delegation, requires key-ID equality, passes both delegation and Eye artifact signature values through `decodeCanonicalEd25519Signature`, verifies Ed25519, then checks the fixed Eye actor/action, immutable lifecycle/profile, and exact target `{ kind: "checkout", path: realpath, task_range: "1-11" }`. Prefix verification runs only afterward and checks immediate prefix root plus semantic/ref/ID uniqueness. No authority path has a local/tolerant decoder.

| Node/stage | authority.action | Exact subject |
|---|---|---|
| requirements-freeze | freeze-requirements | requirement_root |
| requirements-freeze non-pass | return-requirements | requirement_root |
| eye-plan-authorization | authorize-plan | current plan root |
| eye-plan-authorization non-pass | return-plan | current plan root |
| eye-implementation-acceptance | accept-implementation | current `dfm.implementation.v1` artifact ref |
| eye-implementation-acceptance non-pass | return-implementation | current `dfm.implementation.v1` artifact ref |
| eye-pause | pause | current lifecycle root |
| eye-cancel | cancel | current lifecycle root |
| eye-amend with mutation_kind requirement | amend-requirement | new requirement root |
| eye-amend with mutation_kind policy | amend-policy | new policy root |
| eye-adjudicate | adjudicate | paused lifecycle root |

For every row, `node.parent_hashes` is the exact sorted current decision-head set, actor is fixed Eye, provenance is null, and `artifact_hash` is the pre-transition state's current artifact. After application, `stage_base_hashes = heads = [entry.ref]` and `stage_entries = []`: the controller-signed decision entry remains the only DAG leaf. The authority artifact ref appears only in the decision's `authority_ref` field and replay's `authority_refs` projection; it is never a DAG parent, base, entry, or head. Normal gates and their `return-*` forms have `input_refs: [authority.subject_ref]`, `output_refs: []`, and `transition: { kind: "decision", mutation_kind: null, target_stage: null }`. Pause/cancel/adjudicate have `input_refs: [node.artifact_hash]`, no outputs, and the exact Eye-action target semantics from Task 4. Requirement/policy amendments have input `[current requirement_root]` or `[current policy_ref]`, singleton output `[new authority.subject_ref]`, and matching mutation kind; no caller-selected extra ref is legal. The authority artifact's `scope`, `target`, `prefix_root`, `requirement_root`, and `policy_ref` are always checked even when the subject is a plan, implementation, or lifecycle root. Normal Eye gates use `node.transition.kind === "decision"`; pause/cancel/amend/adjudicate alone use `"eye-action"`. Mutating away and back never permits reuse of an earlier authority ID or ref.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
git -C /home/colchis/plugins/multi-model-seats add records/lifecycle-test-vectors/v1 scripts/lifecycle-journal.mjs scripts/lifecycle-store.mjs scripts/lifecycle-operations.mjs scripts/lifecycle-authority.mjs tests/lifecycle-fixtures.mjs tests/test-lifecycle-journal.mjs tests/test-lifecycle-store.mjs tests/test-lifecycle-operations.mjs tests/test-lifecycle-authority.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: add crash-atomic signed lifecycle journals"
```

Expected: all core and store tests pass; the repository contains no private-key file.

### Task 4: Deterministic Lifecycle Engine and Pass-or-Return Rule

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-engine.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs`

**Interfaces:**
- Consumes: validated profile, already verified `{ ref, node }` entries, and a read-only `Map<ref, typedArtifact>` containing only that entry's directly referenced artifacts plus the transitive refs required by their closed schemas. Ambient store artifacts are never placed in the reducer map.
- Produces: `createLifecycleState({ lifecycleId, profile, requirementRoot, policyRef }): LifecycleState`, `applyDecision(state, entry, profile, artifacts): LifecycleState`, `currentStage(state, profile): Stage`, `isClosed(state): boolean`. The reducer performs no I/O and trusts neither authority nor provenance by itself; Task 5 replay verifies those artifacts before calling it.

`LifecycleState` has this closed JSON shape:

```js
{
  state_version: "dfm.state.v1",
  lifecycle_id: "life-...",
  profile_ref: "sha256:...",
  initial_requirement_root: "sha256:...",
  requirement_root: "sha256:...",
  initial_policy_ref: "sha256:...",
  policy_ref: "sha256:...",
  status: "active",
  paused_stage_id: null,
  stage_id: "requirements-freeze",
  artifact_hash: "sha256:...",
  stage_base_hashes: [],
  stage_entries: [],
  heads: [],
  completed_stages: [],
  return_stage: null,
  failed_stage: null,
  effective_plan_root: null,
  effective_implementation_root: null,
  effective_implementation_tree_root: null,
  authorized_plan_root: null,
  accepted_implementation_root: null,
  disk_truth_tree_root: null,
  authority_refs: []
}
```

- [ ] **Step 1: Write failing transition tests**

Create `tests/test-lifecycle-engine.mjs` using `loadProfile()`, `profileRef()`, `unsignedDecision()`, `signDecision()`, and a credential-scanner-bound `decisionRef()` test wrapper to build entries without disk I/O. Include these exact negative and positive cases:

- `P2` entry while state is at `P1` throws `decision stage p2-plan-adversarial does not match active stage p1-plan-pair`.
- A single Daedalus `P1` pass does not advance; the independent Icarus pass against the same `stage_base_hashes` advances to `P2`.
- Icarus cannot supply Grok's `P2` decision; it throws `seat icarus is not required at p2-plan-adversarial`.
- Table-test every producing path (model adapter, disk verifier, retrospective, and Eye action): a literal `pass` with any finding or disposition is invalid before state change. The reducer independently requires both arrays empty even after upstream schema/replay validation.
- `plan-draft` rejects zero or multiple outputs and promotes exactly one stored canonical `{ kind: "candidate", plan }` ref only after Daedalus passes, setting the next stage's `artifact_hash` to that ref. `code-draft` rejects zero or multiple outputs, wrong kind/lifecycle, an unresolved tree ref, or `plan_root !== authorized_plan_root`, and promotes exactly one stored `dfm.implementation.v1` ref plus its embedded tree ref only after Icarus passes, setting the next stage's `artifact_hash` to the implementation ref. Every other ordinary stage rejects any output ref.
- At both producing stages, assert the entry's `artifact_hash` remains the pre-transition `state.artifact_hash`, never the output ref. A non-pass may name the already validated singleton output but does not promote it; Task 6/8 integration tests cover matching provenance and operation subjects.
- A Grok `non-pass` at `P2` moves to `daedalus-recovery`, retains every stage entry as heads, and sets `return_stage` to `p1-plan-pair`.
- A Daedalus recovery `non-pass` is a self-loop, not a retry. It requires the exact current recovery parents, publishes the decision, remains at `daedalus-recovery`, preserves `failed_stage`, `return_stage`, every governed/authority/completion root, status, and artifact, promotes no output, and sets `stage_base_hashes = heads = [newDecisionRef]` with `stage_entries = []`. Table issued refusal, malformed/rejected response, and failed `PROVIDER_DIED` through normal completion, every crash prefix, and fresh restart; then run more than 25 recovery failures followed by one literal pass. Wrong seat/provider/model always fails.
- A Daedalus `retry` recovery has zero outputs, grows the DAG, keeps the exact artifact root, and re-enters the failed stage's profile-declared `reentry_stage`. It cannot clear or manufacture an authority root.
- A Daedalus plan `mutation` has exactly one typed plan-candidate output, changes both `effective_plan_root` and the re-entered P1 `artifact_hash`, clears implementation state and `authorized_plan_root`, and re-enters `P1`; old `P1`/`P2`/Eye passes cannot satisfy the descendant plan.
- A `C2` non-pass followed by recovery re-enters `C1` while preserving `authorized_plan_root` and invalidating implementation-stage completions.
- An explicit implementation mutation at `C1`, `C2`, disk truth, Eye acceptance, or retrospective sets `effective_implementation_root` and the re-entered C1 `artifact_hash` to the new `dfm.implementation.v1` artifact ref and `effective_implementation_tree_root` to its embedded `tree_root`; it preserves the exact authorized plan root, clears `accepted_implementation_root`/`disk_truth_tree_root`, and re-enters `C1`.
- Attempting `code-draft` before fresh `P1`/`P2`/Eye authorization after a plan mutation fails as `stale plan authorization`; attempting retrospective/closure after implementation mutation fails as `stale implementation acceptance`.
- A disk-truth entry requires `input_refs === [effective_implementation_root]`, `output_refs === []`, and `evidence_refs === uniqueSort([manifest_ref, ...command_evidence_refs])`. Exactly one evidence ref resolves to a same-lifecycle `dfm.tree-manifest.v1`; every other direct evidence ref resolves to a same-lifecycle `dfm.command-evidence.v1` whose `cwd_ref` equals that manifest ref and whose stdout/stderr refs resolve to implementation-bound raw-evidence envelopes. Missing, extra, duplicate, wrong-kind/lifecycle/subject/cwd, ambient-only, stale-pass, or altered refs reject before state change.
- A disk-truth pass requires the named manifest ref to equal `effective_implementation_tree_root` and every named command to have status 0/null signal, then and only then sets `disk_truth_tree_root`. A tree mismatch or command failure must be non-pass with the same complete evidence refs and exact required finding code, routes to Daedalus, and never sets `disk_truth_tree_root`.
- The three normal Eye gates use ordinary `transition.kind: "decision"` and the exact authority matrix: requirements-freeze + `freeze-requirements` pass enters plan-draft; `return-requirements` non-pass enters recovery with return `requirements-freeze`; eye-plan-authorization + `authorize-plan` pass stores `authorized_plan_root` and enters code-draft; `return-plan` non-pass returns through recovery to P1; eye-implementation-acceptance + `accept-implementation` pass stores the accepted artifact ref and enters retrospective; `return-implementation` non-pass returns through recovery to C1.
- Exceptional `eye-pause`, `eye-cancel`, `eye-amend`, and `eye-adjudicate` alone use `transition.kind: "eye-action"`, require seat Eye and a preverified authority ref, and parent the exact current heads. Active pause records `paused_stage_id`; cancel works from active or paused; adjudication works only from paused and resumes the saved stage. Requirement amendment enters plan-draft and clears every downstream gate-conferring plan/implementation root and completion. Policy amendment enters requirements-freeze and clears every gate-conferring root and completion. Both preserve the append-only historical `authority_refs` projection and add the new amendment ref; historical refs remain evidence only and cannot satisfy any cleared gate. None may select an arbitrary stage.

Use this row-complete exceptional Eye matrix. In every row actor is fixed Eye, provenance is null, `parent_hashes = sort(preState.heads)`, `stage_base_hashes = heads = [entry.ref]`, `stage_entries = []`, and `authority_refs = uniqueSort([...preState.authority_refs, authorityRef])`; the authority artifact ref itself is never a head. `unchanged roots` means exact byte equality for `initial_requirement_root`, `requirement_root`, `initial_policy_ref`, `policy_ref`, `effective_plan_root`, `authorized_plan_root`, `effective_implementation_root`, `effective_implementation_tree_root`, `accepted_implementation_root`, and `disk_truth_tree_root`.

| Action | Allowed source | Exact transition / action / verdict | Exact input / output | Result stage / status / paused field | Root, artifact, completion, and recovery assignments |
|---|---|---|---|---|---|
| pause | any nonclosed `status: active` stage `S` | `{ kind: "eye-action", mutation_kind: null, target_stage: null }` / `pause` / `eye-pause` | `[preState.artifact_hash]` / `[]` | `S` / `paused` / `S` | unchanged roots; `artifact_hash`, `completed_stages`, `failed_stage`, and `return_stage` unchanged |
| cancel | any nonclosed `status: active` or `paused` stage `S` | `{ kind: "eye-action", mutation_kind: null, target_stage: null }` / `cancel` / `eye-cancel` | `[preState.artifact_hash]` / `[]` | `S` / `cancelled` / `null` | unchanged roots; `artifact_hash`, `completed_stages`, `failed_stage`, and `return_stage` unchanged |
| amend requirement | any nonclosed `active` or `paused` stage | `{ kind: "eye-action", mutation_kind: "requirement", target_stage: "plan-draft" }` / `amend-requirement` / `eye-amend` | `[preState.requirement_root]` / `[newRequirementRef]` | `plan-draft` / `active` / `null` | immutable initial roots unchanged; `requirement_root = artifact_hash = newRequirementRef`; `policy_ref` unchanged; all plan/authorization/implementation/tree/acceptance/disk roots null; `completed_stages = ["requirements-freeze"]`; `failed_stage = return_stage = null` |
| amend policy | any nonclosed `active` or `paused` stage | `{ kind: "eye-action", mutation_kind: "policy", target_stage: "requirements-freeze" }` / `amend-policy` / `eye-amend` | `[preState.policy_ref]` / `[newPolicyRef]` | `requirements-freeze` / `active` / `null` | immutable initial roots unchanged; `requirement_root` unchanged; `policy_ref = newPolicyRef`; `artifact_hash = requirement_root`; all plan/authorization/implementation/tree/acceptance/disk roots null; `completed_stages = []`; `failed_stage = return_stage = null` |
| adjudicate | only `status: paused`, saved stage `S` | `{ kind: "eye-action", mutation_kind: null, target_stage: S }` / `adjudicate` / `eye-adjudicate` | `[preState.artifact_hash]` / `[]` | `S` / `active` / `null` | unchanged roots; `artifact_hash`, `completed_stages`, `failed_stage`, and `return_stage` unchanged |

Reject pause from paused/cancelled/closed, adjudicate from active/cancelled/closed or with any target other than saved `S`, either amendment from cancelled/closed, any row with changed parents/I/O/verdict/mutation/target, and every root/completion assignment not shown. For both amendment rows, seed multiple prior authority refs and assert the result retains every exact historical ref plus the new amendment ref while the listed gate-conferring roots/completions are null or reset; deleting history or reusing any historical ref as current authority fails.
- Applying 25 consecutive non-pass/recovery pairs remains valid and active; no counter or elapsed field terminates the run.
- `closed` is reached only after the ordered path, `accepted_implementation_root === effective_implementation_root`, and separately `disk_truth_tree_root === effective_implementation_tree_root`; the implementation artifact ref is never compared to its embedded tree ref.
- A table-driven test asserts exact `stage_base_hashes`, `stage_entries`, and `heads` after genesis, a partial P1 pass, completed P1, partial P2, completed P2, non-pass, retry recovery, plan-mutation recovery, partial C2, completed C2, implementation mutation, and closure. Grok and Gemini at P2/C2 each parent the same base from the preceding completed stage and never parent each other.

- [ ] **Step 2: Run the test and confirm the engine is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-engine.mjs`.

- [ ] **Step 3: Implement the pure reducer**

Implement `scripts/lifecycle-engine.mjs` with these transition rules:

1. Clone with `structuredClone`; require every state key exactly; require lifecycle/profile/policy identity equality; and never mutate caller state. `initial_requirement_root` and `initial_policy_ref` never change, while effective `requirement_root` and `policy_ref` change only through signed Eye amendments.
2. `createLifecycleState` sets `stage_id = requirements-freeze`, `artifact_hash = requirementRoot`, and all three lineage arrays to `[]`. No entry is implied or synthesized.
3. An ordinary entry must match active stage, lifecycle, pre-transition `state.artifact_hash`, policy, and `parent_hashes === sort(stage_base_hashes)`; its transition is `{ kind: "decision", mutation_kind: null, target_stage: null }`. One required seat may decide once for the exact stage/artifact/base tuple. Literal `pass` requires `findings: []` and `dispositions: []` for every actor; a pass carrying either is rejected rather than normalized. The output artifact is never substituted into `artifact_hash` or provenance subject.
4. On the first partial required-seat pass, keep `stage_base_hashes` unchanged, append the ref to sorted `stage_entries`, and set `heads = stage_entries`. Subsequent independent reviewers still parent `stage_base_hashes`, never the partial-pass head.
5. For ordinary `plan-draft`, require `output_refs` to be a singleton resolving to exact canonical `{ kind: "candidate", plan }`. Candidate lifecycle binding is its membership in this lifecycle's verified artifact store plus the decision's lifecycle/output edge; the canonical candidate deliberately has no wrapper field. For ordinary `code-draft`, require a singleton resolving to closed `dfm.implementation.v1` with `lifecycle_id === state.lifecycle_id`, `plan_root === authorized_plan_root`, and `tree_root` resolving to a closed `dfm.tree-manifest.v1` with the same lifecycle. Every other ordinary stage requires `output_refs: []`, regardless of verdict. When every required seat passes, append the stage to `completed_stages`, promote the validated singleton only at those two authoring stages by assigning it to the next state's `artifact_hash`, advance to `on_pass`, set `stage_base_hashes = sort(stage_entries)`, `stage_entries = []`, and `heads = stage_base_hashes`. At non-producing stages `artifact_hash` is unchanged; a non-pass never promotes its validated output. Thus P2 reviewers parent both completed P1 decision refs and C2 reviewers parent both completed C1 refs.
6. A non-pass first appends the failed ref to sorted `stage_entries`, then sets `heads = stage_entries`, `failed_stage = old stage`, `return_stage = activeStage.reentry_stage`, `stage_id = daedalus-recovery`, `stage_base_hashes = heads`, and `stage_entries = []`. It never changes the governed artifact or terminal status.
7. Recovery requires Daedalus with the exact profile provider/model and parents equal to the current recovery base. A valid non-pass—whether issued refusal, rejected malformed result, or failed `PROVIDER_DIED`—publishes as a recovery self-loop regardless of its dedicated requested retry/mutation transition: it remains in recovery, preserves `failed_stage`, `return_stage`, all requirement/policy/plan/implementation/tree/disk/authority/completion roots and status, promotes no output, and sets `stage_base_hashes = heads = [newRef]`, `stage_entries = []`. There is no failure cap. Only a literal pass with empty findings/dispositions applies `transition.kind === "retry"` or `"mutation"`. Retry requires zero outputs, leaves governed roots unchanged, and returns to the saved profile-declared `return_stage`, never an arbitrary target; therefore P2 re-enters P1 and C2 re-enters C1. The recovery ref becomes the sole base/head and approvals from that return stage onward are cleared.
8. `transition.kind === "mutation"` requires exactly one typed output different from the current root and `mutation_kind` matching the current artifact domain. A plan mutation sets both `effective_plan_root` and the re-entered P1 `artifact_hash` to `output_ref` and clears all implementation/tree/disk/acceptance roots. An implementation mutation resolves its one output as a closed `dfm.implementation.v1`, requires `artifact.plan_root === authorized_plan_root`, sets both `effective_implementation_root` and the re-entered C1 `artifact_hash` to `output_ref` plus `effective_implementation_tree_root = artifact.tree_root`, preserves plan authorization, and clears `disk_truth_tree_root`/`accepted_implementation_root`. Retrospective recovery cannot bypass that.
9. Passing plan draft sets both `effective_plan_root` and the next state's `artifact_hash` to its verified candidate output ref; passing code draft sets the next state's `artifact_hash` to its verified implementation output ref and stores that ref plus its embedded tree ref in the two distinct implementation state fields. The producing decision's own `artifact_hash` remains the prior requirement/authorized-plan subject during application; only successful promotion changes state for the next stage. At `disk-truth`, require exact `input_refs: [effective_implementation_root]` and `output_refs: []`; classify only the node's direct `evidence_refs`, requiring exactly one manifest and treating every other ref as command evidence. Resolve the manifest, every command evidence, and each command's stdout/stderr raw-evidence refs from the supplied verified artifact map; require exact lifecycle, manifest hash/ref, `cwd_ref`, and implementation subject bindings. Ignore every artifact not reachable through those decision refs. Re-derive pass/non-pass from manifest equality and command statuses; require exact empty findings on pass, or the exact ordered mismatch-then-command-failure findings with their manifest/command singleton evidence refs and no additions on non-pass. Set `disk_truth_tree_root = manifest_ref` only on pass. A valid non-pass retains the complete direct evidence refs but leaves `disk_truth_tree_root` unchanged before the general non-pass recovery transition.
10. Normal Eye gates use `transition.kind === "decision"`, null mutation/target, exact current decision parents, fixed Eye actor, null provenance, one unique authority ref, pre-transition subject, and deterministic input/output sets. The decision entry ref—not the authority artifact ref—becomes the sole next base/head. The only valid pairs are: requirements-freeze `freeze-requirements` pass -> plan-draft, or `return-requirements` non-pass -> recovery returning requirements-freeze; eye-plan-authorization `authorize-plan` pass stores the exact current plan and enters code-draft, or `return-plan` non-pass -> recovery returning P1; eye-implementation-acceptance `accept-implementation` pass stores the exact implementation artifact ref and enters retrospective, or `return-implementation` non-pass -> recovery returning C1. No normal Eye gate uses `eye-action`.
11. Exceptional Eye action requires `transition.kind === "eye-action"`, a non-null preverified authority ref, parents equal to current `heads`, and the matching authority action. It makes the controller-signed Eye-action decision entry ref—not the authority artifact ref—the sole base/head and clears partial stage entries, so no pre-action partial approval survives. Active pause stores the current stage in `paused_stage_id`; cancel alone sets cancelled from active or paused. Adjudicate works only from paused and resumes `paused_stage_id`; `target_stage` must equal that saved stage. It cannot skip or mark gates complete.
12. Eye requirement amendment requires one same-lifecycle `dfm.requirement.v1` output, updates both `requirement_root` and the re-entered plan-draft `artifact_hash` to its ref, clears the gate-conferring `effective_plan_root`, `authorized_plan_root`, implementation/tree/acceptance/disk roots and downstream completions, and enters plan draft. Eye policy amendment requires one same-lifecycle `dfm.policy.v1` output, updates `policy_ref`, sets the re-entered requirements-freeze `artifact_hash = requirement_root`, clears every gate-conferring plan/authorization/implementation/tree/acceptance/disk root and all completions, and enters requirements freeze. Neither amendment erases audit history: `authority_refs` is always `uniqueSort([...preState.authority_refs, authorityRef])`; prior refs cannot confer a cleared gate and may never be reused. Other Eye amendments are rejected; plan and implementation changes use governed Daedalus mutation transitions.
13. Closure requires the completed ordered path, a literal retrospective pass, `authorized_plan_root === effective_plan_root`, `accepted_implementation_root === effective_implementation_root`, and independently `disk_truth_tree_root === effective_implementation_tree_root`. The implementation artifact ref and tree ref must both be non-null and must not be required to equal each other. Only then set closed.

Use this exact lineage table as an implementation oracle:

| Event | stage_base_hashes | stage_entries | heads |
|---|---|---|---|
| create | [] | [] | [] |
| first required-seat pass R1 from base B | B | [R1] | [R1] |
| second required-seat pass R2 from same B and advance | sort([R1,R2]) in next stage | [] | sort([R1,R2]) |
| non-pass F after prior stage entry R | sort([R,F]) in recovery | [] | sort([R,F]) |
| recovery non-pass Dn from current recovery base | [Dn] in recovery | [] | [Dn] |
| retry recovery D | [D] in saved profile reentry stage | [] | [D] |
| mutation recovery M | [M] in required P1 or C1 | [] | [M] |
| Eye action E without stage advance | [E] | [] | [E] |

- [ ] **Step 4: Run engine, store, profile, and core tests**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
```

Expected: every lifecycle test passes with 0 failures.

- [ ] **Step 5: Commit**

```bash
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-engine.mjs tests/test-lifecycle-engine.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: enforce pass-or-return lifecycle transitions"
```

### Task 5: Disk-Only Replay as the Sole Derived State

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-replay.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs`

**Interfaces:**
- Consumes: `verifyLifecycleStore`, `verifyOperationsLog`, canonical lifecycle/grant/operation bytes, typed artifacts, validated profile, the immutable lifecycle config and its pinned Eye trust/target, an independent path-origin- and runtime-bound production trust anchor or synthetic-test verifier capability, and `applyDecision`.
- Produces: `replayLifecycleStore({ dir, profile, productionTrustAnchor }): ReplayResult`, separate `replaySyntheticLifecycleStore({ dir, profile, syntheticVerifierCapability }): ReplayResult`, and pure `validateOperationIntentAtState({ state, profile, operation, readArtifact }): void`. Production replay accepts no caller trust, target, state, root, evidence, completion, export fields, or runtime-derived anchor.

`ReplayResult` is a closed frozen value:

```js
{
  replay_version: "dfm.replay.v1",
  lifecycle_id: "life-...",
  lifecycle_config_ref: "sha256:...",
  implementation_grant_ref: "sha256:..." | null,
  profile_ref: "sha256:...",
  state: LifecycleState,
  decision_refs: ["sha256:..."],
  heads: ["sha256:..."],
  lifecycle_root: "sha256:...",
  evidence_refs: ["sha256:..."],
  provenance_refs: ["sha256:..."],
  authority_refs: ["sha256:..."],
  operation_refs: ["sha256:..."],
  operation_attempts: [{ attempt_ref: "sha256:...", state: "settled" | "prepare_missing" | "decision_missing" | "terminal_missing", started_ref: "sha256:...", prepared_ref: null | "sha256:...", stage: "stage-id", transition: { kind: "decision" | "retry" | "mutation", mutation_kind: null | "plan" | "implementation", target_stage: null }, seat: "seat-id", provider: "provider-id", model: "model-id", route_ref: "sha256:...", request_ref: "sha256:...", context_ref: "sha256:...", subject_ref: "sha256:...", round_checkpoint_ref: null | "sha256:...", input_refs: ["sha256:..."], output_refs: ["sha256:..."], decision_ref: null | "sha256:..." }],
  pending_operations: [{ kind: "prepare_missing" | "decision_missing" | "terminal_missing", started_ref: "sha256:...", prepared_ref: null | "sha256:...", attempt_ref: "sha256:...", decision_ref: null | "sha256:..." }],
  effective_plan_root: "sha256:..." | null,
  effective_implementation_root: "sha256:..." | null,
  effective_implementation_tree_root: "sha256:..." | null,
  authorized_plan_root: "sha256:..." | null,
  accepted_implementation_root: "sha256:..." | null,
  disk_truth_tree_root: "sha256:..." | null,
  requirement_root: "sha256:...",
  policy_ref: "sha256:...",
  status: "active" | "paused" | "cancelled" | "closed",
  next_stage: "stage-id" | null
}
```

- [ ] **Step 1: Write replay and restart tests**

Create `tests/test-lifecycle-replay.mjs` with deterministic store fixtures and these cases:

1. initialize a lifecycle, append through partial P1, discard every in-memory object, reopen with no signer, replay from disk, and require exact state/base/entries/heads equality;
2. resume after a simulated process restart, append the remaining Icarus pass, reopen again, and require advancement to P2;
3. replay a full closed run twice and require `canonicalBytes(result)` to be byte-identical;
4. independently derive the union of every on-disk node `evidence_refs` and require exact sorted equality with `ReplayResult.evidence_refs`; caller-supplied extra evidence is impossible because the API has no such parameter;
5. swap any two immutable journal files or their contents, insert an otherwise signed stage-incompatible record, delete genesis/middle/final records, duplicate a signed index, truncate a record, change canonical whitespace, or point `lifecycle.json` at a stale profile/requirement/policy/Eye-trust/target; each replay fails closed;
6. delete a required P2/C2 reviewer decision or Eye authority artifact and assert replay is incomplete or invalid, never closed;
7. first prove static store verification accepts separately trusted Eye-signed `STATIC_ONLY` fixtures whose subject, current requirement/policy, action/stage pairing, paused root, plan root, implementation artifact ref, or implementation tree ref is semantically wrong but well formed; replay must reject every fixture against the current prefix before `applyDecision`. Forged signatures, caller-substituted trust, wrong exact Eye actor, wrong immutable lifecycle/profile/target kind/path/task range, reused authority ID/ref, and `prefix_root` unequal to the immediately preceding lifecycle root fail. Mutate-away/mutate-back does not permit reuse;
8. create retry/death lineage without output and prove the artifact root is unchanged; create explicit plan/implementation mutations and prove exact downstream invalidation;
9. mutate an implementation after retrospective failure and prove replay returns to C1 and cannot reach retrospective/closed using stale C1/C2/disk/Eye decisions;
10. use an implementation artifact whose ref deliberately differs from its embedded tree ref; prove replay preserves both, disk truth compares only to the tree ref, Eye acceptance compares only to the artifact ref, and closure never requires the two refs to equal;
11. replay an exact disk pass and require its singleton implementation input, empty outputs, one named manifest, all and only named command-evidence refs, recursively bound raw-evidence envelopes, and `disk_truth_tree_root === manifest_ref`. Re-sign fixtures with missing/wrong-kind/wrong-lifecycle/stale/ambient-only manifest, omitted/extra/altered evidence ref, wrong command lifecycle/cwd/status/stdout/stderr ref, or a pass over mismatching tree/failed command; every replay rejects even when a suitable unreferenced artifact exists in the store;
12. replay a disk non-pass for tree mismatch and for command failure; require the same complete direct evidence set in replay/handoff evidence, the exact failure finding, Daedalus recovery, and no `disk_truth_tree_root` assignment;
13. tamper, swap, duplicate, or delete operation records; create orphan finish, duplicate attempts, terminal/start/prepared binding drift, or decision/provenance/prepared mismatch; disk replay must fail or return exactly `prepare_missing`, `decision_missing`, or `terminal_missing`, never silently derive settled status;
14. exercise all three recovery prefixes across fresh processes. For start-only, delete the external request/context files and caller state; replay still projects `prepare_missing` from the signed request/context bodies and recovery yields one byte-identical request/context/provenance/death decision/terminal with no provider call. Prepared/partial state completes committed bodies; decision/no-terminal adds only terminal. Tampering with start request/context body/ref/intent, prepared commitment, reservation, or body fails before settlement;
15. verify no private key or provider credential is needed for read-only replay.
16. table-test `validateOperationIntentAtState` for required singleton candidate/implementation outputs, forbidden review-stage outputs, Daedalus retry zero-output, dedicated mutation singleton output, exact active stage/required seat/pre-transition subject, same-lifecycle implementation/tree, and current authorized plan binding. The exact independently implemented codes are `OUTPUT_ARTIFACT_REQUIRED`, `OUTPUT_ARTIFACT_FORBIDDEN`, `OUTPUT_ARTIFACT_CARDINALITY`, `OUTPUT_ARTIFACT_UNKNOWN`, `OUTPUT_ARTIFACT_KIND_MISMATCH`, `OUTPUT_ARTIFACT_LIFECYCLE_MISMATCH`, `OUTPUT_ARTIFACT_TREE_INVALID`, `OUTPUT_ARTIFACT_STALE_PLAN`, and `RECOVERY_REQUIRES_DEDICATED_PATH`; Task 8 reuses this Task 5 interface without redefining it.
17. assert replay exposes the recomputed `lifecycle_config_ref` and rejects one-byte config/grant/key/trust/schema/canonical-byte drift. Table the full Eye matrix: three normal gate passes and three `return-*` non-passes require `transition.kind: "decision"`; pause/cancel/amend/adjudicate require `"eye-action"`; every authority uses exact decision parents, fixed actor/null provenance, unique authority, pre-transition subject, and deterministic I/O. After each, only the decision entry is the leaf/head while the authority ref appears only in `authority_refs`. Using an authority artifact as a parent/base/head is rejected. Test paused-only adjudication and both amendment invalidation targets.
18. close the store, discard every in-memory value, and run production replay in a fresh process with `loadProductionTrustAnchor({ externalRootPath, expectedExternalRootRef, authorizationBootstrapPath, expectedAuthorizationBootstrapRef, runtimeDir })`, where both raw refs are retained independently before runtime selection. Missing/wrong/unknown/path-derived/runtime-derived refs, wrong root/packet, byte-identical copies/alternate filenames/hardlinks/symlinks, a brand for another runtime, post-load replacement, altered grant/trust/config/registry/helper descriptor, and a coherent attacker-signed root-plus-packet-plus-runtime substitution checked against the legitimate retained refs fail before selected code, the first decision/operation read, or state projection. This is the replay-layer assertion intentionally moved out of Task 3.

- [ ] **Step 2: Run the test and confirm the replay module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-replay.mjs`.

- [ ] **Step 3: Implement deterministic replay**

Implement `scripts/lifecycle-replay.mjs` in this exact order:

`validateOperationIntentAtState` is the one shared pure route/output validator used by replay and controller preflight. It requires operation lifecycle/stage/required seat/pre-transition subject to equal the supplied state/profile; ordinary decision intent is forbidden at `daedalus-recovery`; plan/code drafts require the exact stored singleton and bindings defined in Task 4; every other ordinary stage requires no output; Daedalus retry requires none; and Daedalus mutation requires one stored artifact of the declared mutation kind, including same-lifecycle/current-plan implementation bindings. It performs only reads and throws exactly `OUTPUT_ARTIFACT_REQUIRED`, `OUTPUT_ARTIFACT_FORBIDDEN`, `OUTPUT_ARTIFACT_CARDINALITY`, `OUTPUT_ARTIFACT_UNKNOWN`, `OUTPUT_ARTIFACT_KIND_MISMATCH`, `OUTPUT_ARTIFACT_LIFECYCLE_MISMATCH`, `OUTPUT_ARTIFACT_TREE_INVALID`, `OUTPUT_ARTIFACT_STALE_PLAN`, or `RECOVERY_REQUIRES_DEDICATED_PATH` as applicable. Task 8 imports these already-defined semantics and codes.

1. for production, first revalidate the supplied path-origin brand against this exact runtime, including root lstat/realpath/file identity and byte equality; only then read `lifecycle.json`, `implementation-grant.json`, pinned Eye-trust bytes, and controller public-key bytes. Require exact canonical UTF-8 regular non-symlink files with no BOM/whitespace/trailing newline, the four closed schemas, matching content refs, recomputed non-null `implementation_grant_ref` and `lifecycle_config_ref`, the supplied profile ref, authenticated production grant/root/delegation, and the persisted exact target `{ kind: "checkout", path: realpath, task_range: "1-11" }`. Production replay must receive a separately created anchor for this runtime and reverify origin, grant signature, scope, and trust binding on every call before journal reads; accept no caller bytes, brand for another runtime, or runtime replacement. The separate synthetic replay instead requires null `implementation_grant_ref`, absent `implementation-grant.json`, synthetic trust, and its module-branded verifier capability; it cannot enter this production branch;
2. call `verifyLifecycleStore`, then `verifyOperationsLog` over the same verified decision/provenance view. Verify every start's canonical request/context bodies/refs, exact closed public transitive closure, and intent even when those typed artifacts are not yet materialized; prepared/settled attempts additionally require materialized request/context bytes to equal start. Do not trust cached results;
3. create state only from the lifecycle manifest's initial requirement/policy values;
4. iterate the verified decision chain by signed journal index. For each entry build a read-only artifact map from only its `artifact_hash`, request/context/input/output/provenance/evidence/authority/policy refs and the transitive refs mandated by those closed artifacts; never add an unreferenced store artifact. For each model entry, find its one signed start/prepared attempt, recompute the non-circular prepared commitment, require exact materialized bodies and decision reservation, call `validateOperationIntentAtState` against the current prefix state, then bind node stage/transition/input/output, context, and provenance to that signed intent/profile/current pre-transition subject. Recompute the public-context closure from the exact historical prefix and require byte identity with the signed start; literal pass again requires empty findings/dispositions. For disk truth, the sole named manifest and command evidence—not any ambient manifest—are the only candidates the reducer can resolve. For each Eye entry compute the prefix lifecycle root from only earlier entries, call `verifyEyeAuthorityStatic({ artifact, node, lifecycleConfig, persistedTrust })`, then call `verifyEyeAuthorityAtPrefix({ artifact, node, prefixState: state, prefixRoot, usedAuthorityIds, usedAuthorityRefs, lifecycleConfig })`; only after both succeed call `applyDecision(state, entry, profile, artifacts)`;
5. after every transition require reducer heads to equal the DAG leaves derived from the prefix just replayed;
6. derive decision/provenance/authority/evidence sets exclusively from visited disk entries, unique-sort them, and compare final heads/root to full-store verification;
7. for any `prepare_missing`, `decision_missing`, or `terminal_missing` attempt, supply the verified signed-start request/context bodies to `validateOperationIntentAtState`, recompute their refs/intent/closure, and reject drift before exposing settlement. Project attempts/pending directly from `verifyOperationsLog`, project lifecycle fields from final state/static verification, deep-freeze, and return. Operation records and embedded start bodies do not enter lifecycle root, heads, completed stages, evidence, or authority arrays.

Replay performs no writes, provider calls, clock reads, random generation, Git commands, environment lookups, or export construction. Any mismatch includes the physical record/ref and fails; it never skips, repairs, reorders, defaults, or substitutes a seat.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-replay.mjs tests/test-lifecycle-replay.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: replay lifecycle state from disk"
```

Expected: every replay/store/operation/engine/authority test passes with zero failures.

### Task 6: Provider Seat Adapter Boundary

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-adapter-grammar.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-seat-adapter.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-provider-transport.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-adapter-grammar.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-provider-transport.mjs`

**Interfaces:**
- Consumes: closed typed-artifact helpers, the byte-identical reviewed `dfm.closed-adapter-grammar.v1` validator, profile seat/route records, canonical bytes of one closed `dfm.seat-request.v1`, canonical bytes of its exact closed `dfm.seat-public-context.v1`, the exact closed route including its validator-derived dependency manifest/root, and an injected `invoke(frameBytes): Promise<Buffer>` transport. Task 6 also defines the separate production transport loader/invoker that can create this callback only from the Eye-grant-bound registry.
- Produces: `invokeLifecycleSeat(options): Promise<{ decision, artifacts, findingResolutions }>` where the adapter re-derives `request_ref` and `context_ref` from exact validated bytes, `decision` is unsigned, `artifacts` contains only validated provenance/provider-evidence envelopes, and `findingResolutions` is a deep-frozen ephemeral copy of generically valid bounded claims. The request/context bodies are already committed by signed start and are not duplicated in adapter output. Raw transport output is never returned or persisted. Task 6 validates context closure/framing but neither imports replay/checkpoint code nor attempts to authenticate a lifecycle-round brand; the controller supplies resolver-authenticated context bytes.

The accepted successful `SeatResponse` shape is closed; its verdict is `pass` or `non-pass`. A provider refusal uses the same keys with verdict `refuse` and is mapped to a lifecycle non-pass:

```js
{
  provider: "openai",
  model: "recorded-per-call",
  response_id: "provider-issued-id",
  context_ref: "sha256:...",
  route_ref: "sha256:...",
  verdict: "pass",
  findings: [],
  dispositions: [],
  finding_resolutions: [],
  evidence_status: "complete",
  evidence: []
}
```

Transport framing is exact: stdin is `canonicalize({ frame_version: "dfm.seat-invocation-frame.v1", request: <exact request object>, public_context: <exact context object> }) + "\n"`, bounded to 9 MiB. Stdout is exactly one canonical JSON object followed by one `\n`, at most 1 MiB total; stderr must be empty and exit status zero. The provider response accepts only the eleven keys shown above and must echo the exact `context_ref` and `route_ref`; it never echoes or selects artifact bodies. `evidence_status` is `complete` or `truncated`; evidence has at most 32 unique closed summaries, each at most 4096 UTF-8 bytes. `finding_resolutions` has at most 32 unique items, each exactly `{ finding_id, source_decision_ref, source_finding_index, disposition: { code, action, target_stage, subject_ref } }`; it must be empty except for Icarus at P1/C1. No request ref, provider, model, stage, subject, checkpoint, context, route, or output choice is accepted independently from the signed request/context pair and authenticated route.

- [ ] **Step 1: Write failing adapter tests**

Create `tests/test-lifecycle-seat-adapter.mjs` with these cases:

1. canonical request/context bytes and an authenticated synthetic Icarus route reloaded from a signed-start fixture produce actor `{ seat: "icarus", provider: "openai", model: "gpt-test" }`, the same internally derived request/context/route refs, hashed provenance/evidence with explicit synthetic observation class, and literal pass with empty findings/dispositions; adapter artifacts do not duplicate either body, while the captured transport frame contains the exact reviewable candidate/checkpoint bytes;
2. a thrown `invoke` error produces verdict `non-pass`, finding code `PROVIDER_DIED`, and `status: "failed", response_id: null` provenance instead of throwing;
3. a missing/blank response ID produces failed provenance and non-pass findings `PROVIDER_DIED` plus `INVALID_PROVENANCE`, so terminal derivation is unambiguous;
4. a complete result claiming provider `xai`, another model, context, or route for the Icarus/OpenAI request produces rejected provenance plus `PROVIDER_MISMATCH`, `MODEL_MISMATCH`, or `ROUTE_MISMATCH`, never changes the actor seat/model/route, and derives `invocation-finished`;
5. a provider refusal produces issued provenance plus `PROVIDER_REFUSED` non-pass and therefore derives `invocation-finished`;
6. a public evidence summary containing a credential is rejected and replaced by a typed `CREDENTIAL_REJECTED` non-pass finding; the credential and a redacted surrogate are both absent from all returned artifacts;
7. a complete response with chain-of-thought/private-reasoning or any unknown field is not repaired by projection: it produces rejected provenance plus `MALFORMED_RESPONSE`; the raw/forbidden field is discarded and absent from every artifact/journal/error;
8. every issued pass/non-pass/refusal and rejected complete mismatch derives finished; every failed provenance includes `PROVIDER_DIED` and derives died; inconsistent provenance/finding pairs are rejected;
9. controller-supplied `artifactHash`, `inputRefs`, `outputRefs`, and transition are reproduced exactly in the unsigned decision and cannot be supplied or changed by provider output. With one candidate output, assert decision/provenance subject equals the pre-transition requirement ref and is unequal to the candidate ref; with code draft, assert the subject is the authorized plan ref and is unequal to the implementation ref.
10. request or context bytes with noncanonical JSON, trailing bytes, unknown keys, wrong lifecycle/stage/seat/provider/model/route/subject/input/output/checkpoint/context linkage, omitted/extra/duplicate/unresolved closure entries, ref/body mismatch, invalid base64, credential/private-reasoning bytes, more than the declared bounds, or an instruction longer than 8192 bytes reject before transport/signer/journal/temp/lock activity. There is no independent caller `request_ref`, `context_ref`, `route_ref`, or model to disagree with them;
11. exact framing tests cover missing/extra newline, multiple JSON values, noncanonical frame/response bytes, wrong echoed context/route ref, stderr, nonzero exit, response larger than 1 MiB, 33 evidence items, overlong summaries, and `evidence_status: "truncated"`. A fully parseable valid-identity/context/route truncated response discards all partial evidence, emits issued provenance plus only `TRUNCATED_EVIDENCE`, and finishes non-pass. An incomplete/oversize/unparseable frame discards all partial evidence, emits failed provenance plus `PROVIDER_DIED` and `TRUNCATED_EVIDENCE`, and dies;
12. a response claiming `pass` with any finding or disposition becomes the deterministic non-pass `PASS_HAS_OBJECTIONS`; it can never publish literal pass.
13. bounded Icarus P1/C1 `finding_resolutions` are closed-shape checked, copied to the deep-frozen ephemeral `findingResolutions` result, and do not yet become artifacts, evidence refs, decision dispositions, or persistent bytes. Duplicate claims and any claim from a non-Icarus/non-pair request are malformed. The independent Task 6 suite imports no Task 11 symbol and passes before checkpoint code exists; Task 11 owns the replay-context authentication and operation-bound disposition materialization tests.
14. `test-lifecycle-adapter-grammar.mjs` authenticates the plugin validator as byte-identical to the signed external `adapter_validator.source_raw_ref`, accepts one valid adapter and exact unique sorted dependency manifest/root, then rejects invalid syntax; comments or strings containing `DFM_ADAPTER_CONTRACT` without the required parsed declaration; computed, aliased, concatenated, relative, absolute, `file:`, `data:`, HTTP(S), export-from, or dynamic imports; `require`/`createRequire`; `eval`/`Function`; worker/child-process escape; duplicate, missing, reordered, or unresolved imports; wrong environment access; and a one-byte entry/manifest/root change. Each malicious fixture sets a credential-read sentinel and an execution-marker path and proves both remain untouched: grammar validation fails before credential projection, adapter evaluation, or spawn.

- [ ] **Step 2: Run the test and confirm the adapter is missing**

Run:

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-adapter-grammar.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
```

Expected: non-zero exits with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-adapter-grammar.mjs` and `scripts/lifecycle-seat-adapter.mjs`.

- [ ] **Step 3: Implement the injected adapter**

`invokeLifecycleSeat` must accept exactly `{ lifecycleId, profile, seat, route, requestBytes, contextBytes, transition, artifactHash, parentHashes, policyRef, attemptRef, invoke, recordedAt }`. There is no `roundContext`, replay brand, resolver, caller route ref/model, or future-task type in this interface; unknown options fail closed. The adapter must parse and validate each body/route once, require canonical byte equality, derive `requestRef = sha256BytesRef(requestBytes)`, `contextRef = sha256BytesRef(contextBytes)`, and `routeRef = sha256Ref(route)`, require request context/route refs and seat/provider/model to equal those derived values, and:

- reject an unknown seat before calling the provider;
- call only the injected byte transport with the exact request/context frame and never read provider API keys or ambient candidate files;
- require request lifecycle/stage/seat/provider/model/route/subject/input/output/checkpoint fields and context lifecycle/stage/seat/subject/root closure to equal the replay/profile/controller intent and exact route before any invocation;
- validate exact frame/response framing, closed keys, echoed context/route refs, and reported provider/model against the request/route/profile;
- convert outages, malformed responses, provider mismatches, truncated evidence, and invalid provenance to non-pass findings rather than exceptions;
- require a unique SHA-256 `attemptRef` supplied by the controller; provider/model come only from the validated request;
- create provenance bound to lifecycle, seat, attempt, internally derived request/context/route refs, route observation class, subject, source, and timestamp. A complete matching response is `issued`; a complete response with reported provider/model/context/route mismatch is `rejected` with null validated fields and exact reported fields where allowed by the closed schema; transport/incomplete/unparseable failure is `failed` with all response/provider/model fields null and `PROVIDER_DIED`, while retaining only signed request/route bindings;
- create only closed bounded public evidence summaries and use their refs in the decision; credential-bearing evidence becomes `CREDENTIAL_REJECTED` and is not redacted into storage;
- for Icarus P1/C1 only, closed-shape check and deep-freeze bounded `finding_resolutions` as ephemeral output without resolving or persisting them. The base decision/artifact set contains no disposition produced from those claims. Task 11 consumes a replay-branded current-round context in the controller before any side effect and alone converts these claims into operation-bound `dfm.icarus-finding-disposition.v1` evidence; the provider can never set lifecycle, stage, candidate, subject, attempt, request, or checkpoint linkage;
- parse only within the byte bound, validate the exact closed response before constructing artifacts, and never repair unknown fields by projection. A complete identifiable but closed-schema-invalid response is rejected with `MALFORMED_RESPONSE`; raw chain-of-thought/private-reasoning and all original response bytes are discarded and never hashed, logged, returned, or persisted;
- set actor seat/provider/model from the validated request/profile, never from provider output;
- require controller-supplied `transition` to be one of the exact closed ordinary decision, Daedalus retry, or Daedalus mutation shapes; copy it, `artifactHash`, `inputRefs`, and `outputRefs` exactly into the unsigned decision, and never accept any of them from provider output. The public ordinary controller path always supplies `transition.kind = "decision"`; only the dedicated recovery/mutation paths can supply the other two;
- return a Task-1-valid unsigned decision node with `authority_ref = null`, `operation_prepared_ref` left for the prepared-commitment builder, and `recorded_at = recordedAt` supplied by the controller. Provenance/request `subject_ref` and node `artifact_hash` all equal the pre-transition `artifactHash`; neither ever equals an authoring-stage output merely because that output may be promoted after a pass. Literal pass is emitted only for a complete issued response with empty findings/dispositions and complete evidence.

Use the Task 1 closed finding shape. Allowed adapter codes are `PROVIDER_DIED`, `PROVIDER_REFUSED`, `MALFORMED_RESPONSE`, `INVALID_PROVENANCE`, `PROVIDER_MISMATCH`, `MODEL_MISMATCH`, `ROUTE_MISMATCH`, `TRUNCATED_EVIDENCE`, `PASS_HAS_OBJECTIONS`, and `CREDENTIAL_REJECTED`.

Before implementing the transport, create `scripts/lifecycle-adapter-grammar.mjs` only by `apply_patch` as a byte-identical copy of the reviewed exact external file `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/validate-closed-adapter-v1.mjs`; the authenticated registry descriptor must name that literal normalized source realpath/raw ref plus exact plugin target realpath/raw ref, with both refs equal because the copy is byte-identical. Require `cmp` equality, both exact signed raw-ref bindings, and validator self-tests before importing the plugin copy; do not regenerate, transliterate, simplify, or accept a basename/same-byte alternate path. The shared selected-helper loader is unreachable until the independently retained Eye root/bootstrap packet has authenticated raw grant/trust/registry bodies, reviewed commit, and every exact descriptor. It performs one bounded no-follow single-link stable read of each exact external/plugin helper, hashes that exact buffer, and imports only that same buffer through an in-memory URL; it never hashes and then reopens a pathname. A relative, case/Unicode-normalization, hardlink, symlink, directory-prefix, contained-copy, or alternate-filename identity is invalid even when its bytes match. Its only public validation entry accepts raw adapter bytes, applies the exact real parse/token/dependency algorithm stated in the precondition, and returns the closed dependency manifest/root or throws before any adapter evaluation or credential read.

Implement `lifecycle-provider-transport.mjs` with two production-only interfaces: `createProductionTransportRouter({ authenticatedGenesis, profile }): ProductionTransportRouter` and `invokeProductionTransport({ router, seat, frameBytes }): Promise<Buffer>`. `authenticatedGenesis` is the exact nonserializable module brand returned only after Task 3 verifies the retained bootstrap/root, root-signed grant, exact registry body/ref/profile/target, and exact canonicalizer/detector/validator/route descriptors; a plain/copy/synthetic brand fails. Before resolving a route, router construction uses only the already-authenticated one-buffer validator/detector capabilities and requires the plugin copies to equal those exact buffers/refs. Route realpaths must equal exactly: Daedalus `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/anthropic-daedalus-v1.mjs`; Icarus `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/openai-icarus-v1.mjs`; Grok `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/xai-grok-v1.mjs`; Gemini `/home/colchis/Projects/TELOS/integrations/provider-adapters/daedalus-family-v1/google-gemini-v1.mjs`. Router construction stable-opens each exact normalized single-link source once, reads at most 1 MiB, requires the registry raw ref, feeds that same buffer to the validator, and retains that same buffer for invocation. It never reopens a route pathname. A regular-expression/string-marker approximation is forbidden: invalid syntax; computed/dynamic/concatenated/aliased or non-`node:` imports; relative/file/data/network resolution; comment/string marker spoofing; an unreported/reordered dependency; or any manifest/root mismatch fails before reading an environment value, evaluating adapter bytes, or spawning a child.

Immediately before every invocation, the router reauthenticates its retained route/validator/detector buffer refs and dependency result plus a defense-in-depth source identity watch; any pathname change invalidates the route rather than selecting new bytes. It then spawns `process.execPath` with `shell: false`, a fixed tiny module bootstrap in `--eval`, no adapter source in argv, exact frame stdin on fd 0, and only the already-read verified adapter bytes on dedicated inherited pipe fd 3. The fixed bootstrap reads fd 3 to a bounded buffer and imports only the corresponding already-validated in-memory `data:` module; it never reopens or resolves a route dependency. Child environment is exactly the present values of the route's validated `environment_keys`, with no unrelated inherited variable, and there are no caller args/path/model/provider. This eliminates hash-to-exec replacement, dependency substitution, and native-Windows command-line-size failure. The registry's exact model/provider/route are copied into request/provenance; response echo is validation, never selection. The route's adapter is responsible for its live provider session. Because ordinary provider APIs do not supply detached cryptographic model receipts, `observation_class` remains `pinned-adapter-runtime-observation` in every proof/report.

Create `tests/test-lifecycle-provider-transport.mjs` covering bootstrap/grant/registry/profile/target/ref mismatch; external/plugin validator byte/ref drift; missing/duplicate/wrong seat/provider/route/model; dependency manifest/root drift; unknown/duplicate/unsorted/cross-provider/forbidden environment names and absent values; plain/copied/synthetic brands; relative/runtime-contained/same-byte alternate-filename/hardlink/symlink/case-or-Unicode-alias/directory/FIFO/oversize/actual-credential-bearing adapter source; complete clean source containing policy vocabulary; hash/identity/path replacement before and during invocation; unknown API/CLI `seatInvoker`, `transportCommand`, `--transport-command`, provider, or model override; stderr/nonzero/oversize framing; and exact four-seat routing. A forged but structurally valid bootstrap/grant/registry selects canonicalizer, detector, validator, or adapter modules with top-level marker writes; retained root/packet/raw-ref/reviewed-path rejection occurs before any selected module is parsed and every marker remains absent. A deterministic swap hook replaces an authenticated helper pathname immediately after its single read: the loader either fails its stable-read checks or imports the original exact hashed buffer, never replacement marker bytes. Repeat the grammar bypass corpus through the router and prove every case fails with zero credential projection, marker, or spawn. The adapter asserts its child environment contains exactly the selected route keys and no unrelated sentinel. A valid source padded beyond native Windows's argv limit still succeeds through fd 3. A caller-selected same-byte or perfect-response executable is rejected because neither exact realpath/ref identity nor the authenticated buffer can be substituted. Tests assert the pinned-adapter observation claim, never a provider-signed receipt. Live credentials/network are not required.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-adapter-grammar.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-provider-transport.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-adapter-grammar.mjs scripts/lifecycle-seat-adapter.mjs scripts/lifecycle-provider-transport.mjs tests/test-lifecycle-adapter-grammar.mjs tests/test-lifecycle-seat-adapter.mjs tests/test-lifecycle-provider-transport.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: normalize lifecycle seat outcomes"
```

Expected: all adapter and engine tests pass; no provider credential is required.

### Task 7: Independent Disk Truth

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-disk-truth.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs`

**Interfaces:**
- Consumes: a target checkout path and an ordered non-empty unique list of closed command records `{ command: string, args: string[] }`; duplicate canonical command/args pairs are rejected. Raw file/stdout/stderr bytes are never routed through JSON hashing.
- Produces: `hashTree(root, { exclude? }): object`, `runVerificationCommands(root, commands): object[]`, `deriveDiskTruth({ root, commands, exclude?, expectedTreeRoot, lifecycleId, implementationRef }): DiskTruthResult`, and pure `validateDiskTruthResult({ result, commands, lifecycleId, implementationRef, expectedTreeRoot }): void`. Derivation performs no store writes.

- [ ] **Step 1: Write failing disk-truth tests**

Create `tests/test-lifecycle-disk-truth.mjs` with temporary-checkout cases that:

1. write `src/index.mjs` and `tests/test.mjs`, derive a sorted manifest/root, and assert the same bytes produce the same root regardless of file creation order;
2. change one source byte and assert the tree root changes;
3. write `Buffer.from([0xff, 0x00, 0x80])` and assert its manifest `content_ref` is the Task 1 raw-byte golden ref without UTF-8 replacement;
4. assert `.git/`, `.multi-model-seats/lifecycle/`, `.env`, `.env.*`, and `*.pem` are excluded by the closed default policy and never appear in the manifest;
5. create a symbolic link and assert `hashTree` throws `symbolic links are not accepted as disk truth`;
6. run `{ command: process.execPath, args: ["--check", "src/index.mjs"] }`; for each stream assert `commandEvidence.stdout_ref === sha256Ref(stdoutRawEvidenceEnvelope)` and `commandEvidence.stderr_ref === sha256Ref(stderrRawEvidenceEnvelope)`, while each envelope's `raw_ref === sha256BytesRef(actualStreamBytes)`. Also assert exact byte count, `application/octet-stream` media type, lifecycle ID, and implementation subject ref;
7. run a script that emits non-UTF-8 bytes and prove the command's stdout ref equals the raw-evidence envelope ref, does not equal the raw-byte ref, and the resolved envelope's `raw_ref` equals the Task 1 raw-byte hash with no UTF-8 decoding;
8. run a script that exits 3 and assert `deriveDiskTruth` returns `verdict: "non-pass"`, finding code `VERIFICATION_COMMAND_FAILED`, and no tree-root match claim;
9. load a `dfm.implementation.v1` whose artifact ref differs from its `tree_root`; pass only `implementation.tree_root` as `expectedTreeRoot`, and assert a mismatch returns `TREE_ROOT_MISMATCH`. Passing the implementation artifact ref as `expectedTreeRoot` must fail.
10. require `manifest_ref === tree_root === sha256Ref(manifest)`; every command evidence has the same lifecycle, `cwd_ref === manifest_ref`, implementation-bound raw-evidence refs, and a ref in unique sorted `command_evidence_refs`; require `evidence_refs === sort([manifest_ref, ...command_evidence_refs])` with no extras or omissions, and require unique `raw_evidence_writes` to resolve the exact deduplicated set of stdout/stderr envelope refs;
11. table-test `validateDiskTruthResult` against missing/extra/duplicate/altered refs, omitted/added/reordered command evidence or command/args unequal to the closed requested `commands`, wrong manifest or command-evidence kind/lifecycle/subject/cwd, an ambient manifest not named by `manifest_ref`, stdout/stderr envelope drift, stale expected tree with a pass verdict, and a non-pass missing its exact mismatch/failure finding. Validation is read-only and never persists an artifact;
12. re-hash the checkout after all commands and reject if the closing manifest/ref differs from the opening manifest/ref, so command execution cannot be attributed to a snapshot that changed during verification.

- [ ] **Step 2: Run the test and confirm the disk-truth module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-disk-truth.mjs`.

- [ ] **Step 3: Implement checkout re-derivation**

Implement with `lstatSync`, `readdirSync`, `readFileSync`, `relative`, and `spawnSync`; do not invoke a shell. Normalize relative paths to `/`, sort before hashing, reject paths escaping the root, reject symlinks, hash each file with `sha256BytesRef(rawBuffer)`, and build the closed typed manifest:

```js
{
  artifact_version: "dfm.tree-manifest.v1",
  lifecycle_id: "life-...",
  files: [{ path: "src/index.mjs", bytes: 42, content_ref: "sha256:..." }]
}
```

The tree root is `sha256Ref(manifest)`. Run each closed command with raw buffers, then derive the tree again and require the closing manifest bytes/ref to equal the opening snapshot. Construct ephemeral raw-evidence write intents `{ bytes: Buffer, metadata: { lifecycle_id, media_type: "application/octet-stream", subject_ref: implementationRef }, artifact, artifact_ref }`; each `artifact.raw_ref` hashes the raw buffer and `artifact_ref = sha256Ref(artifact)`. These intents exist only in memory for the controller and are never JSON/stringified, logged, or returned by the CLI. `dfm.command-evidence.v1.stdout_ref`/`stderr_ref` point to those predicted envelope refs, `lifecycle_id` matches, and `cwd_ref = manifest_ref`. If output contains credentials, reject.

`deriveDiskTruth` returns exact `{ verdict, tree_root, manifest_ref, manifest, command_evidence_refs, command_evidence, evidence_refs, raw_evidence_writes, findings }`. Require `manifest_ref === tree_root === sha256Ref(manifest)`, `command_evidence.length === commands.length` in the same order with exact command/args equality, `command_evidence_refs === uniqueSort(command_evidence.map(sha256Ref))`, and `evidence_refs === uniqueSort([manifest_ref, ...command_evidence_refs])`. `raw_evidence_writes` is unique by `artifact_ref` and its refs equal the deduplicated union of all command stdout/stderr refs—no missing or ambient write. Only `tree_root === expectedTreeRoot` and every command exiting zero with null signal permit pass, with exact `findings: []`. Otherwise findings are exact and replayable from refs: first one `TREE_ROOT_MISMATCH` with `evidence_refs: [manifest_ref]` when needed, then one `VERIFICATION_COMMAND_FAILED` for each failed/signalled command ordered by ascending command-evidence ref, with that ref as its singleton evidence. No other finding is allowed; the result is non-pass with the same complete direct evidence set. `validateDiskTruthResult` receives the original closed `commands` and re-derives every relation without I/O or ambient artifact lookup. Neither function compares the governed implementation artifact ref to a tree ref or persists anything.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-disk-truth.mjs tests/test-lifecycle-disk-truth.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: re-derive lifecycle disk truth"
```

Expected: all disk-truth/core tests pass; no shell or live provider is used.

### Task 8: Resumable Serialized Production Controller and CLI

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-controller.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-cli.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-synthetic-test.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs`

**Interfaces:**
- Consumes: the store/replay/profile/adapter/provider-transport/disk-truth modules, external `signer`, and Task 7's real `deriveDiskTruth` imported and closed over directly. The exact target, externally signed implementation grant, canonical Eye trust/delegation, and production transport registry are accepted only through authenticated initialization/genesis and thereafter loaded from immutable lifecycle storage. The external tracked TELOS Eye root is different: every fresh production process must pass its absolute external path, independently retained raw ref, and exact runtime path to the public loader and create a new origin-bound brand before any runtime-state read.
- Produces: `createLifecycleController({ dir, profile, signer, productionTrustAnchor, clock }): Controller`, plus CLI commands `init`, `status`, `resume`, `ingest-artifact`, read-only `prepare-seat-request`, `invoke-seat`, `recover`, `mutate`, `eye-action`, `verify-disk`, and production-only `export`. Production retrospective publication is absent at Tasks 8-10: `recordRetrospective` is not a controller method, `record-retrospective` is an unknown CLI command, and no private retrospective route/capability exists until Task 11's atomic installation method. Every production controller construction requires the independently created anchor and rejects `seatInvoker`, `diskTruthDeriver`, provider/model/transport overrides, and unknown keys. `lifecycle-synthetic-test.mjs` alone exposes `createSyntheticTestController(...)` with branded injected seat/disk doubles, a specifically named `recordSyntheticRetrospectiveForTest`, and a synthetic verifier capability; Task 9 extends that same test-only surface with a distinct synthetic exporter. None is accepted by production replay/controller/export. There is no generic CLI decision-ingest command; production CLI never supplies the test seam.

Controller methods have three disjoint production invariants:

1. `initializeProduction` requires an existing regular non-symlink checkout and a nonexistent runtime child under an existing regular non-symlink parent. Before lock or any runtime read/write it resolves both, rejects equality/containment/aliases in every direction, verifies the external grant and production Eye trust/root/delegation binding through `productionTrustAnchor`, and constructs the exact config/grant/key/trust bytes and refs. Only then may it acquire an exclusive sibling init lock, create the runtime leaf, write immutable canonical configuration/requirement/policy artifacts with exclusive creates and fsync, and perform first production replay. It appends no decision.
2. `ingestArtifact` acquires the operation lock, replays before, writes one canonical typed artifact, replays after, and requires lifecycle state/root/decision count to remain byte-identical. Artifact availability is not a decision.
3. Model transitions first perform read-only replay and exact canonical request/context/route/output preflight. Invalid input returns before provider/signer invocation, lock creation, artifact/journal mutation, or any runtime byte change. A valid request and its resolver-derived complete public context are embedded as exact bodies/refs in the signed start that contends for journal CAS. Only the winner reloads those bytes from the verified start and invokes the provider with the closed frame. It then publishes one request/context-bound prepared commitment, materializes committed public artifacts, publishes exactly one reserved decision, derives/publishes one terminal, and replays. Fresh-process settlement handles all pending states without provider reinvocation or caller request/context state.

Read-only `status`/`handoffPreflight` only replay. On every production CLI process start, before reading or statting runtime state, `lifecycle-authority.mjs` parses the four closed root/bootstrap path/ref flags and calls `loadProductionTrustAnchor({ externalRootPath: telosEyeRootFlag, expectedExternalRootRef: expectedTelosEyeRootRefFlag, authorizationBootstrapPath: authorizationBootstrapFlag, expectedAuthorizationBootstrapRef: expectedAuthorizationBootstrapRefFlag, runtimeDir: dirFlag })`. The loader rejects missing/unknown/malformed/path-derived refs, mismatched bytes, same-byte alternate paths/links, runtime-contained copies, aliases, or runtime/config/grant/trust-selected substitutes and returns a fresh origin- and runtime-bound `ProductionTrustAnchor`; callers never read root/packet bytes themselves. There is no implicit pin or fallback. Status, resume, and every reopened command pass that anchor into controller construction/replay. Task 9's production builder receives an anchor created for that exact runtime/root/packet identity; synthetic demo uses only the separate test projection.

- [ ] **Step 1: Write controller/CLI failure-first tests**

Create `tests/test-lifecycle-controller.mjs` using temporary directories and an external signer double that exposes only `sign(bytes)`. Production cases create four temporary self-contained adapter executables, bind their exact paths/hashes/environment-key sets/models through an ephemeral Eye-signed production registry/grant, and invoke them only through the real Task 6 production router; injected provider doubles are confined to the separately branded synthetic-test controller. Cover:

1. production `init` accepts only an existing non-symlink checkout plus a nonexistent sibling runtime child with an existing non-symlink parent. It rejects pre-existing empty/non-empty runtime, missing/replaced parent, equality/ancestry/alias with checkout, concurrent initialization, self-selected Eye key, unauthorized rotation, wrong delegation scope/target/profile, grant/trust-ref mismatch, and external-root mismatch before runtime creation. It then writes exact canonical lifecycle/implementation-grant/public-key/Eye-trust/typed requirement/policy files under an exclusive init lock, appends zero decisions, and succeeds only after replay reports requirements-freeze;
2. `ingestArtifact` replays before/after, returns the canonical artifact ref, invokes no lifecycle signer, appends zero decisions, and leaves state, heads, lifecycle root, and decision count unchanged; malformed/non-canonical artifacts fail before write;
3. ingest a canonical plan candidate, call read-only `prepareSeatRequest`, require its one canonical context envelope to contain the exact candidate bytes and all route-required governed input bytes, then invoke Daedalus at `plan-draft` with its exact `outputArtifactRef`. Prove replay promotes that ref to `effective_plan_root` while operation/node/provenance/context subject remains the pre-transition requirement root. Later call no-argument `captureImplementationSnapshot()` over a fixed clean Git checkout; prepare/invoke Icarus at `code-draft` with the returned implementation ref, require the frame to contain the exact implementation, manifest, and every source body, and prove replay promotes the implementation/tree refs while all four subject bindings remain the pre-transition authorized plan root;
4. restart after partial P1, invoke Icarus with `outputArtifactRef: null`, restart again, and require P2 with exact replayed bases/heads;
5. table-test ordinary invocation with missing output at `plan-draft`/`code-draft`, output at a non-producing stage, wrong kind, wrong lifecycle, unresolved ref, implementation with stale `plan_root`, null/stale/wrong Git commit, unresolved/wrong-lifecycle tree, missing/altered/ambient raw source bytes or captured Git objects, commit/tree/blob OID or byte drift, array/second output, repeated CLI output flag, and unknown output argument. Table `captureImplementationSnapshot` against dirty/racing/untracked/ignored/missing/type-drift/symlinked checkouts, commit changes, file changes between reads, caller checkout/manifest/raw/commit fields, direct generic implementation ingestion, and a stale prior capture after governed edits. Each fails before model transition; preflight failures leave replay and collaborator counts unchanged, while a capture fault may leave only unreachable content-addressed bytes and never a decision/state change;
6. launch two `invoke-seat` commands concurrently for Grok/Gemini: one holds the operation lock, the other exits with `lifecycle write already in progress`; after the first finishes, the second succeeds and both decisions parent the same P2 base;
7. every successful ordinary transition increases lifecycle decision count by exactly one. `prepare_missing` recovery commits one deterministic death decision; `decision_missing` completes the already prepared exact decision; `terminal_missing` adds zero decisions because it cross-links the persisted match. In all cases a settled attempt links exactly one lifecycle decision;
8. inject process kill immediately after signed start, delete the external request file and all caller state, and resume fresh. Recovery must reload the exact request and public context only from start, make zero provider calls, and converge on one byte-identical materialized request/context/provenance/death decision/terminal. Repeat after prepared publication, every prepared typed/raw write, decision publication, and before/after terminal. Issued pass/refusal/non-pass, rejected provider/model/context mismatch, issued truncation, and failed `PROVIDER_DIED` retain the same total mapping;
9. public `invokeSeat` at `daedalus-recovery` rejects with `RECOVERY_REQUIRES_DEDICATED_PATH`. `recover --retry` accepts only an instruction, internally derives the exact retry request/context, keeps the artifact, and has zero outputs. Dedicated plan `mutate` validates/ingests its typed candidate before deriving context; implementation `mutate` accepts only an artifact whose full tree/raw/commit closure came from the current controller snapshot. Both pass the ref only through the internal mutation attempt. Caller request/context fields, raw bytes, unresolved implementation content, stale snapshot refs, and instruction/context tamper fail before provider/signer/decision; restart uses only the signed start bodies;
10. `eye-action` rejects a controller signature without trusted signed authority and rejects prefix action/scope/target/root mismatch. Table all eleven authority actions: the three gate passes and three `return-*` non-passes publish `transition.kind: "decision"` with exact deterministic I/O; pause/cancel/amend/adjudicate publish `"eye-action"`. For every exceptional row assert exact allowed source status/stage, transition/action/verdict, parents/I/O, result stage/status/paused field, all ten root assignments, artifact, completed stages, failed/return stage, and decision-entry head specified by Task 4. The authority artifact remains only in `authority_refs`, and attempting to parent or head the DAG with it fails;
11. exact production `verifyDisk` happy path imports and runs the real Task 7 deriver over a temporary governed checkout and actual no-shell deterministic commands: compare the checkout only to the current implementation artifact's embedded tree ref; persist and reread every predicted raw-evidence envelope, the one manifest, and all command evidence; append exactly one disk decision with `artifact_hash === implementationRef`, `input_refs === [implementationRef]`, `output_refs === []`, and `evidence_refs === uniqueSort([manifestRef, ...commandEvidenceRefs])`. Require every command `cwd_ref === manifestRef`, nested raw envelope subject equals implementation ref, pass sets `disk_truth_tree_root = manifestRef`, and replay/export evidence contains every direct ref;
12. run tree-mismatch and command-failure non-pass cases. Persist the same complete evidence set, require exact finding codes, append one non-pass, route to Daedalus, and prove `disk_truth_tree_root` remains unset;
13. through only the branded synthetic-test controller, inject disk-derivation results with missing/wrong-kind/wrong-lifecycle/stale/ambient-only manifest, wrong command kind/lifecycle/cwd/subject/status/stdout/stderr ref, altered/duplicate/extra/omitted evidence refs, or pass over mismatch/failure. `verifyDisk` must return `DISK_TRUTH_EVIDENCE_INVALID` before artifact persistence, signer call, decision append, or collaborator-visible output. Separately pass `diskTruthDeriver`/lookalike override keys to production controller/API/CLI and require unknown-option rejection before runtime reads. The signed production call-chain fixture uses the real temporary checkout hash/commands. Snapshot replay, complete runtime bytes including lock absence, artifact inventory, and signer/invoker counts before/after and require exact identity; a suitable pre-existing ambient manifest never repairs the result;
14. call controller `appendDecision` directly with Daedalus, Icarus, Grok, Gemini, Eye, or a disk-truth actor. It must reject before artifact resolution/write, signer call, lock acquisition, decision append, or operation append. Snapshot replay state, the complete runtime directory tree and exact bytes (including absence of lock files), signer/invoker call counts, and artifact filenames/bytes before/after and require identity;
15. production `recordRetrospective`, `record-retrospective`, evidence/proof-selection options, and direct retrospective lookalikes passed to `appendDecision` are absent/unknown and reject with the same exact no-change assertion; at Tasks 8-10 the direct local-controller retrospective tuple returns `PRODUCTION_RETROSPECTIVE_NOT_YET_GOVERNED`, while the absent method and CLI command remain ordinary unknown surface errors. No signed production history can close retrospectively before Task 11. Eye uses `applyEyeAction`, disk truth uses `verifyDisk`, and all four model seats—including Daedalus recovery/mutation—use the shared capability-gated internal `invokeSeat` transaction with signed request-bearing start/prepared/terminal records. Separately prove only the synthetic-test controller's branded `recordSyntheticRetrospectiveForTest` can close a permanently ineligible synthetic run;
16. corrupt/swap/delete/duplicate lifecycle or operation records, orphan a terminal, duplicate an attempt, or drift start/prepared/terminal bindings; status/resume must fail through replay or expose only `prepare_missing`, `decision_missing`, or `terminal_missing` before any provider call;
17. inspect runtime files and injected inputs for private keys, credentials, raw prompts/responses, or private reasoning;
18. spawn status and resume in separate Node processes, supplying the tracked root independently to each, to prove process-local memory is unnecessary;
19. race two controllers and two stale-lock resumers at one next index. Exactly one journal CAS winner invokes the provider and publishes the chain; losers replay, never unlink a newer lock, and never publish a second attempt;
20. return wrong-key, wrong-key-ID, noncanonical base64url, wrong-length, and invalid signature bytes from the signer for every record phase. Each target record is absent and the prior immutable prefix is byte-identical. Assert exact projections: invalid start leaves no attempt; invalid prepared leaves `prepare_missing`; invalid decision leaves start/prepared/committed artifacts and `decision_missing`; invalid terminal leaves the decision and `terminal_missing`. Do not assert transaction-wide rollback;
21. drive noncanonical request/context/frame bytes, incomplete/extra context closure, model/request mismatch, provider/model/context response mismatch, every truncation framing case, and pass-with-objections through both API and CLI; all preflight failures preserve the complete runtime tree and collaborator counts byte-for-byte;
22. use a post-start test hook to mutate the caller Buffer and delete its source file before provider invocation. The provider must receive a distinct Buffer byte-equal to the canonical closed frame reconstructed from `verifiedStart.request_artifact` and `verifiedStart.context_artifact`; caller mutation cannot change transport bytes, request/context refs, prepared commitment, or recovery output.
23. after Task 11 integration, P1/C1 read-only preflight first requires full coverage of every earlier completed-pair boundary and derives a replay-branded current-round context without consuming it. After acquiring the operation lock, fresh anchored replay and checkpoint verification must equal that context; only then does the replay-owned consumer mark it used immediately before signed start/CAS. Interleaving drift removes only the caller's advisory lock and causes zero persistent writes and zero signer/provider calls. The unchanged Task 6 adapter never inspects the brand; its ephemeral resolution claims are materialized only by the returned replay-owned finalizer after the start CAS winner invokes the provider. An Icarus-first or Daedalus-first partial pair yields no boundary; settling the other peer yields exactly one boundary selecting that pair's Icarus operation and completion decision. A fresh process calls `saveLifecycleRoundCheckpoint()` with no payload/ref/role and re-derives that sole disk entitlement; only after the append does terminal `verifyLifecycleRoundCoverage` succeed. P2/C2 initial and resume require that terminal result, derive the exact covering checkpoint into `round_checkpoint_ref`, and require Grok/Gemini to use the same ref. Missing/duplicate/stale/cross-pair checkpoints, forged/stale/interleaved/cross-runtime context, swapped reviewer refs, or export bijection drift fail with complete zero-change assertions.
24. close/reopen production runtimes through every API/CLI path. Each fresh process requires all four root/bootstrap path/ref flags, calls the public authorization loader, and reauthenticates exact stored grant/trust/registry bytes plus helper descriptors. Missing/duplicate/derived refs, forged root/packet, same-byte copies/alternate filenames/hardlinks/symlinks/aliases, wrong-runtime brands, post-load replacement, or coherent attacker root/packet/runtime substitution fails against retained legitimate refs before selected code, output, provider/observer/signer/lock/write. Task 9 owns export.

At the Task 8 commit, implement and run cases 1-22 and 24 only. Case 23 is an explicit Task 11 modification to this same test file after lifecycle-round checkpoint/context semantics exist; Task 8 must neither skip a present failing assertion nor fabricate a future brand.

Create `tests/test-lifecycle-synthetic-test.mjs` proving the only grant-free path requires a nonserializable module-branded synthetic capability, persists `trust_class: "synthetic-test"`, and returns only a synthetic verifier capability. Plain objects, production constructors, and production replay reject it. After Task 9, a synthetic runtime can run the named demo only through `exportSyntheticHandoffBundleForTest`; passing its capability or runtime to `exportHandoffBundle`, requesting production initialization/replay/export, or passing any `bundleClass` override fails before output creation. Conversely, production init/export never accepts the synthetic capability or ephemeral trust.

- [ ] **Step 2: Run the test and confirm the production modules are missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-controller.mjs`.

- [ ] **Step 3: Implement controller serialization and restart semantics**

`createLifecycleController` exposes:

```js
{
  initializeProduction({ lifecycleId, requirement, policy, controllerPublicKey, eyeTrust, transportRegistry, target, implementationGrant }),
  status(),
  resume({ settlePendingAttemptRef }),
  ingestArtifact({ artifact }),
  captureImplementationSnapshot(),
  prepareSeatRequest({ seat, instruction, outputArtifactRef = null }),
  invokeSeat({ requestBytes, attemptRef, outputArtifactRef = null, recordedAt }),
  appendDecision({ unsignedDecision }),
  recover({ mode: "retry", instruction, attemptRef, recordedAt }),
  mutate({ kind: "plan" | "implementation", artifact, instruction, attemptRef, recordedAt }),
  applyEyeAction({ authorityArtifact, recordedAt }),
  verifyDisk({ checkout, commands, recordedAt }),
  handoffPreflight()
}
```

Rules:

- `initializeProduction` first authenticates the external root's path/raw-ref identity through the controller's branded independent anchor, then the exact canonical external grant and production Eye trust/delegation; canonical-validates the caller-supplied tracked public `transportRegistry` once and requires `sha256Ref(transportRegistry) === implementationGrant.provider_transport_registry_ref` plus exact profile/target/detector/validator/observer/four-route/dependency/environment closure; normalizes target to an existing non-symlink checkout realpath; resolves the existing non-symlink parent of the prospective nonexistent runtime leaf; and rejects equality/containment/aliases in all directions. These checks complete before lock or runtime mutation. It then uses `<dir>.init.lock` with `openSync(..., "wx")`, creates the runtime leaf, each immutable genesis file, and the registry plus detector/validator/adapter raw artifacts at their content-addressed paths with exclusive creation, fsyncs files/directories, performs first anchored replay, and removes only its own init lock in `finally`. Reopen never accepts another registry path/body: external-root origin/raw-ref validation completes first; only then does it read config/grant/trust/key and resolve only the grant-bound stored registry and complete detector/validator/adapter/dependency closure before journals/projection/provider/signer/write. A pre-existing runtime or partial initialization fails closed for explicit operator recovery; it is never overwritten.
- `createSyntheticTestController` lives in the separate test-support module and closes over a module-private capability. It calls a distinct internal initializer that accepts only synthetic trust, marks it `trust_class: "synthetic-test"`, persists no production-grant claim, and returns a synthetic verifier capability. Production controller construction, `initializeProduction`, production replay, status/resume CLI, and production export reject that capability and trust class. There is no flag, cast, copied object, or later Eye action that upgrades a synthetic runtime.
- `ingestArtifact` uses `operation.lock`, replay-before, `putArtifact`, replay-after, and an exact before/after comparison of state, heads, lifecycle root, and decision refs. It writes no operation or decision record and needs no signer.
- `captureImplementationSnapshot()` accepts no checkout, tree, commit, manifest, raw bytes, lifecycle, or plan argument. Under the tokenized lock it freshly replays, requires the implementation-authoring/revision route, and uses only the immutable target checkout plus current authorized plan from replay. It requires a clean exact Git worktree, derives the canonical current commit object itself, enumerates the complete tracked regular non-symlink file inventory, reads every file into memory, builds the exact same-lifecycle `dfm.tree-manifest.v1` and `dfm.implementation.v1`, and walks the recorded commit's complete commit/tree/blob/tag object closure with explicit object format/OID verification. The root commit-tree regular-file map must equal the tree manifest's complete path/content map; symlink, submodule, special mode, omitted/extra path, or blob/body drift fails. It then rereads Git status/commit/inventory/file identities, file bytes, and object bytes before publication. It persists every manifest-named body through content-addressed raw storage, every verified Git object through `putGitObject`, plus the tree and implementation artifacts; rereads all stored bodies/objects; repeats checkout/commit stability; and returns only `{ tree_ref, implementation_ref, commit_ref }`. A failed/stale/racing capture may leave only unreachable byte-identical content-addressed blobs/objects, never a decision or state change. A code-draft or implementation mutation ref is eligible only if its entire tree/raw/Git closure is already present and byte-exact from this controller-only path; arbitrary caller raw bytes, null commit refs, ambient matching blobs/objects, and direct implementation ingestion cannot satisfy that route.
- Production controller construction receives the exact `authenticatedGenesis` brand from anchored store open and immediately constructs one `createProductionTransportRouter({ authenticatedGenesis, profile })`; copied/plain/synthetic genesis and any route/profile mismatch fail before exposing the controller. `prepareSeatRequest` is read-only and accepts only the exact keys shown. From that authenticated router/registry plus one fresh replay and the verified typed-artifact/decision/operation/checkpoint/raw resolvers, it derives the sole legal route, model, subject, input/output/public-context/checkpoint roots and their complete public transitive closure; constructs the canonical bounded `dfm.seat-public-context.v1`; then constructs the canonical `dfm.seat-request.v1` containing that route/context ref. It returns only deep-frozen `{ request_ref, request_bytes, context_ref, context_bytes }`, persists nothing, and cannot omit review content. The caller supplies only the bounded secret-free instruction, seat, and stage-legal singleton output ref. A second fresh derivation immediately before signed start must be byte-identical, including registry route/model/ref, so any intervening artifact/checkpoint/prefix/route change invalidates the prepared request before signer/provider/write.
- `status` and `handoffPreflight` return only disk ReplayResult projections, including operation attempts/pending. `resume` selects a pending item only from replay; it never scans journal directories separately. Ordinary transitions publish exactly one lifecycle decision; operation records never satisfy a gate.
- `invokeSeat` accepts the exact closed option keys shown above. Parse `requestBytes` once as exact canonical `dfm.seat-request.v1`, derive its ref internally, independently rederive the exact public context bytes/ref through the same replay-owned closure algorithm, and reject noncanonical/oversize/secret-bearing bytes or lifecycle/stage/seat/provider/model/subject/input/output/checkpoint/context drift before provider/signer/lock/write. The request's `output_refs` must equal `outputArtifactRef === null ? [] : [outputArtifactRef]`. Unknown `requestRef`, caller `contextBytes`/`contextRef`, `requestedModel`, `ephemeralRequest`, `outputRefs`, `outputArtifact`, second-output, or route/transition keys fail with complete zero-change. Preserve exact `OUTPUT_ARTIFACT_REQUIRED`, `OUTPUT_ARTIFACT_FORBIDDEN`, `OUTPUT_ARTIFACT_CARDINALITY`, `OUTPUT_ARTIFACT_UNKNOWN`, `OUTPUT_ARTIFACT_KIND_MISMATCH`, `OUTPUT_ARTIFACT_LIFECYCLE_MISMATCH`, `OUTPUT_ARTIFACT_TREE_INVALID`, and `OUTPUT_ARTIFACT_STALE_PLAN` errors.
- After read-only preflight and a second replay, rederive the request's exact public context and exact authenticated registry route, require request `route_ref`/seat/provider/model and route body/ref to agree, construct start with the exact parsed request and derived context bodies/refs/route ref, validate all body/ref/intent equality, and publish by exclusive journal CAS. Immediately discard caller and preflight bytes, reload/verify the winning signed start from disk, derive canonical request/context bytes from its bodies, resolve the same route again through the controller's branded production router, and call `invokeLifecycleSeat({ ..., route, requestBytes, contextBytes, invoke: (frameBytes) => invokeProductionTransport({ router, seat: verifiedStart.seat, frameBytes }) })`. This closed call chain is the only production provider route for ordinary invocation and dedicated retry/mutation attempts; there is no injected invoker in production. `resume` uses the same authenticated genesis/router to verify every pending start's route/model binding but, by recovery rule, makes zero transport calls. Route drift at controller construction, preflight, under-lock recheck, verified-start reload, or resume fails before a new start/provider/signer/write. For every stage, signed start/prepared/terminal subject, request/context/provenance subject, lifecycle node artifact hash, and replay-before governed root agree; authoring output is never an operation subject.
- At the Task 8 commit, require `adapterResult.findingResolutions` to be empty before prepared construction; a nonempty ephemeral claim fails explicitly and is never ignored, persisted, or allowed to affect a decision. Task 11 replaces only that guard with the replay-owned consume/finalize integration below. Thus Task 6 and Task 8 pass independently without importing a future checkpoint brand.
- After Task 11 adds strict checkpointing, P1/C1 controller preflight obtains a branded verified prefix, requires that prefix to cover every earlier completed-pair boundary, and derives the resolver-backed `IcarusRoundContext` without consuming it. Under the tokenized lock, immediately before start/CAS and before signer/provider activity, the controller freshly replays, freshly verifies the checkpoint prefix, and passes those objects plus the preflight context to the replay-owned consumer. That function verifies its private brand and byte-identical runtime/config/root/decision/operation/candidate/prefix/current-route snapshot, consumes it once, and returns a closure over freshly verified resolution targets; interleaving drift fails with no persistent change and no signer/provider call. The start CAS winner invokes the context-independent Task 6 adapter normally, then gives its ephemeral resolution claims to that closure for operation-bound materialization; the adapter never receives or inspects a replay brand. The current Icarus operation uses null `round_checkpoint_ref`; if its required peer has not settled, no boundary exists. The deterministic completion of both required peers creates exactly one boundary selecting that pair's Icarus operation and pair-completion decision. A later fresh-process `saveLifecycleRoundCheckpoint()` replays and covers that sole newly uncovered boundary. P2/C2 initial and resume require terminal full coverage. Cold review starts only when the exact current completed-pair boundary has one covering checkpoint; the controller, never caller/provider/request, writes that ref to `round_checkpoint_ref`, and both Grok and Gemini repeat the same ref through start/prepared/terminal.
- After Task 11 integration, every controller/CLI route begins with anchored replay plus `verifyLifecycleRoundPrefix` before route-specific resolution, signer/provider/child spawn, lock, temp, artifact, operation, decision, checkpoint, or output creation. If `next_uncovered_boundary` is non-null, artifact ingestion, implementation snapshot capture, ordinary/recovery/mutation model calls, Eye action, disk truth, retrospective/installation, and both export routes return exactly `ROUND_CHECKPOINT_REQUIRED`; `resume` may only read and report the already-settled pair-completion state and cannot settle or publish a later transition. Only read-only status/load/preflight and no-argument `saveLifecycleRoundCheckpoint` remain eligible. Save repeats the same check under lock and may append only that exact boundary. Tests create an uncovered boundary, then table every state-changing API and exact CLI spelling—including `ingestArtifact`, `captureImplementationSnapshot`, recovery, mutation, Eye, disk, installation, export, and resume—requiring the same code, zero collaborator calls, and byte-identical runtime/output paths until a fresh-process save succeeds.
- Controller `appendDecision` is an exposed-but-fail-closed wrapper, not a generic routing API. At Tasks 8-10 it has no internal retrospective capability and rejects every local-controller retrospective tuple with `PRODUCTION_RETROSPECTIVE_NOT_YET_GOVERNED` before ref resolution, signer, lock, or write. Task 11 may add an unexported `RETROSPECTIVE_ROUTE` symbol only inside the atomic installation module/controller closure; no public method, generic append input, or serialized value can obtain it.
- Classify and reject disallowed actor/stage/transition tuples before checking route capability or resolving/writing artifacts, calling a signer/invoker, acquiring any lock, or publishing to either journal. Any model seat returns `MODEL_DECISION_REQUIRES_INVOKE_SEAT`; Eye returns `EYE_ACTION_REQUIRES_AUTHORITY_PATH`; local disk truth returns `DISK_TRUTH_REQUIRES_VERIFY_DISK`. At the Task 8-10 commits a direct local-controller retrospective lookalike returns `PRODUCTION_RETROSPECTIVE_NOT_YET_GOVERNED`; Task 11 changes that one public-wrapper result to `PRODUCTION_RETROSPECTIVE_REQUIRES_INSTALLATION_ROUTE`, while only the unexported atomic installation capability can proceed. Every rejection leaves the complete runtime tree and injected collaborator counts byte-for-byte unchanged.
- `invokeSeat`, `applyEyeAction`, and `verifyDisk` never call the public wrapper or any retrospective closure. After their own model-operation, authority, or disk-verification checks respectively, each may call only the Task 3 storage primitive inside its dedicated locked transaction. Before Task 11 there is no production retrospective caller at all; the synthetic-test module's disjoint capability cannot enter this controller.
- Implement one capability-gated internal `invokeSeat` transaction taking the controller-selected transition and validated output refs. The public `invokeSeat` wrapper can select only the ordinary decision transition and rejects active `daedalus-recovery` with `RECOVERY_REQUIRES_DEDICATED_PATH`. `recover` alone holds the retry-route capability, accepts only a bounded secret-free instruction, derives the retry request/context internally after fresh replay, and selects Daedalus retry with zero outputs. `mutate` alone holds the mutation-route capability, accepts a bounded instruction, validates and ingests its canonical plan artifact or requires its implementation artifact/tree/raw closure to equal a prior current-checkout `captureImplementationSnapshot`, derives request/context only after that ref is resolvable, then selects the matching Daedalus mutation transition with exactly that stored ref; it never routes the artifact through ordinary `outputArtifactRef`. All model decisions therefore still enter through one `invokeSeat` transaction with signed operation start/terminal records and the pre-transition operation subject, while caller input cannot forge recovery modes or construct resolver-dependent context.
- Before publishing an Eye transition, `applyEyeAction` loads only the pinned persisted trust/target, enforces the exact Eye actor, unique authority ID/ref, and `prefix_root === replayBefore.lifecycle_root`, then runs both exact node-aware authority interfaces. It derives the node from the closed matrix rather than caller fields: `freeze-requirements`/`authorize-plan`/`accept-implementation` passes and `return-requirements`/`return-plan`/`return-implementation` non-passes use ordinary decision transitions; pause/cancel/amend/adjudicate use exceptional Eye-action transitions. Replay-after repeats the check from disk; caller trust/target/transition/subject substitution and semantically wrong signed authority never publish.
- Use `operation.lock` only as a diagnostic optimization. Record a random ownership token plus PID, and unlink only after rereading the identical token. No timeout, stealing, absent-PID cleanup, or stale-lock removal grants authority; a resumer with a dead recorded PID still contends through journal CAS and cannot unlink a replacement lock. Signed index/predecessor publication is the only serialization fence.
- Every production decision route—including Eye, disk truth, retrospective, recovery, and model invocation—uses that one tokenized critical section and replays before publication; none may publish while replay exposes a pending model attempt. The journals remain authoritative: bypassing or losing the advisory lock cannot create two records at one signed index, and any cross-journal reservation drift fails closed as corruption. Race tests interleave every supported route at start/prepared/decision boundaries and prove one total recoverable transaction; CAS losers replay/resume the committed prefix, never call a provider twice, and never silently rebase a prepared decision.
- Use Task 3 journal primitives; never hand-build or tolerantly parse records. Normal order is: publish/fsync request/context-bearing start by CAS; reload its exact canonical bodies and invoke once with their frame; construct provenance/evidence and exact unsigned decision; compute and publish/fsync the request/context-bound prepared commitment; materialize the start request/context and prepared bodies idempotently; validate signer output and publish the exact reserved decision; derive/publish terminal; replay. No final journal byte appears before signature/ref/state/predecessor validation in memory.
- Recovery never calls a provider. `prepare_missing` validates/reloads signed start request/context bytes and builds the deterministic failed-provenance `PROVIDER_DIED` commitment from those bodies. `decision_missing` completes the exact start request/context plus prepared materialization and publishes the reserved decision. `terminal_missing` publishes only the total terminal. Missing caller files/memory cannot affect bytes or refs; CAS losers replay the winner and repeated processes converge byte-for-byte.
- Operation start/prepared/terminal records repeat lifecycle/stage/transition/seat/provider/model/attempt/request/context/pre-transition-subject/input/output and controller-derived `round_checkpoint_ref` bindings; prepared commits exact bodies/reservation and terminal names exact prepared/decision/provenance refs. At the Task 8, 9, and 10 commits the controller writes null for every operation because strict checkpoint semantics do not exist yet. Task 11 changes only the controller derivation so P1/C1 remain null and P2/C2 receive the exact verified covering ref. Operation records create no authority, never substitute for a lifecycle decision, never enter the lifecycle root, and never mutate governed artifacts.
- `verifyDisk` holds `operation.lock`, replays, resolves `replay.effective_implementation_root` as same-lifecycle `dfm.implementation.v1`, and passes `artifact.tree_root` only as `expectedTreeRoot` plus the artifact ref only as `implementationRef`. The deriver returns all evidence in memory and performs no write. Run `validateDiskTruthResult` with the exact original closed `commands` before calling the signer or store; invalid results throw `DISK_TRUTH_EVIDENCE_INVALID` and leave no lock/artifact/journal residue.
- After pure validation, persist each raw write through `putRawEvidence` and require its returned envelope/ref to equal the predicted bytes/metadata/artifact/ref; persist and reread the exact manifest and command evidence; reject any ref drift before decision signing. This persistence order is explicit: a bad decision signature may leave these content-addressed ambient evidence bytes. Without a published decision their refs are excluded from replay evidence and export, cannot set `disk_truth_tree_root`, and cannot advance state; retry deterministically derives or reuses byte-identical refs. Construct the sole disk decision with actor `{ seat: "telos-controller", provider: "local", model: "lifecycle-disk-truth-v1" }`, current disk stage/base/policy, `artifact_hash: implementationRef`, `input_refs: [implementationRef]`, `output_refs: []`, `evidence_refs: result.evidence_refs`, null provenance/authority, and exactly the result verdict/findings. Both pass and non-pass carry the same complete evidence set. Call only the Task 3 storage primitive, then replay; pass must set `disk_truth_tree_root = result.manifest_ref`, while non-pass must route to Daedalus without setting it. No artifact-directory scan or newest/matching-manifest lookup is permitted.
- The production signer is injected. The CLI adapter is `--signer-command <absolute-executable>` plus repeated `--signer-arg`; spawn with `shell: false`, send base64 canonical bytes on stdin, accept exactly one canonical base64url signature line on stdout, and reject stderr/extra output/nonzero exit. Verify key ID, decoded length, signature, signed ref, state machine, and predecessor in memory before any temp/final publication. The executable owns key access; the plugin never receives key material.
- Provider transports use only the grant-bound Task 6 router, fixed tiny bootstrap, dedicated verified-source fd, no shell, exact route environment-key projection, and exact Task 6 byte framing: one canonical request-plus-public-context frame on stdin, exactly one bounded canonical response line echoing context/route refs on stdout, empty stderr, zero exit. No caller absolute command exists. Selected credential values remain only in the child environment, unrelated ambient variables are absent, providers never need ambient checkout/runtime reads, and raw provider output is parsed/projected then discarded.
- CLI JSON output is a closed public projection of replay state/refs/codes. Errors contain codes and paths/refs only, never artifact bodies, provider text, signer bytes, or environment values.

- [ ] **Step 4: Implement exact CLI commands and skill-safe syntax**

Use `parseArgs` from `node:util`; reject unknown flags and positional arguments. Commands are:

```bash
node "<plugin-root>/scripts/lifecycle-cli.mjs" init --dir <nonexistent-runtime-child> --lifecycle-id <id> --requirement <typed-json> --policy <typed-json> --eye-trust <canonical-json> --transport-registry <tracked-canonical-json> --implementation-grant <signed-canonical-json> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --target-path <existing-governed-checkout> --task-range 1-11 --controller-public-key <canonical-json>
node "<plugin-root>/scripts/lifecycle-cli.mjs" status --dir <runtime-dir> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>
node "<plugin-root>/scripts/lifecycle-cli.mjs" resume --dir <runtime-dir> --settle-pending-attempt <sha256-ref> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" ingest-artifact --dir <runtime-dir> --artifact <typed-json> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>
node "<plugin-root>/scripts/lifecycle-cli.mjs" capture-implementation-snapshot --dir <runtime-dir> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>
node "<plugin-root>/scripts/lifecycle-cli.mjs" prepare-seat-request --dir <runtime-dir> --seat <profile-seat> --instruction <secret-free-utf8-file> [--output-artifact-ref <sha256-ref>] --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> > <canonical-seat-request-json>
node "<plugin-root>/scripts/lifecycle-cli.mjs" invoke-seat --dir <runtime-dir> --request <canonical-seat-request-json> --attempt-ref <sha256-ref> [--output-artifact-ref <sha256-ref>] --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" recover --dir <runtime-dir> --retry --instruction <secret-free-utf8-file> --attempt-ref <sha256-ref> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" mutate --dir <runtime-dir> --kind plan|implementation --artifact <typed-json> --instruction <secret-free-utf8-file> --attempt-ref <sha256-ref> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" eye-action --dir <runtime-dir> --authority <signed-typed-json> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" verify-disk --dir <runtime-dir> --checkout <absolute-path> --commands <typed-json> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" export --dir <existing-production-runtime> --checkout <existing-governed-checkout> --out <nonexistent-child> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>
```

JSON-file arguments name files, not inline JSON, and every input is a regular non-symlink. Framing is per flag and never tolerant: tracked authorization-publication inputs `--implementation-grant`, `--eye-trust`, and `--transport-registry` are exactly `canonicalize(parsed) + "\n"`; initialization parses each once, verifies that byte equality, and normalizes only by removing its sole publication LF before persisting the exact immutable no-newline runtime body. The deliberately line-framed request file is also exact canonical-plus-one-LF as defined below. Requirement, policy, generic typed artifact, authority-action artifact, commands, and controller-public-key files use their declared Task 1 no-newline canonical framing. Tests table zero/two LF, CRLF, BOM, leading/trailing whitespace, multiple values, and one-byte body drift for all three authorization inputs and require failure before runtime creation. `--instruction` names a regular non-symlink bounded UTF-8 file, is read once, secret/private-reasoning scanned, and is never persisted separately. `prepare-seat-request` is the only CLI constructor: it authenticates/replays, derives the full context and exact route/model internally, writes exactly `canonicalize(request) + "\n"` to stdout and no other stdout/stderr, and leaves context bytes internal for independent rederivation at `invoke-seat`. Shell redirection may create the caller-owned request file; the command never writes runtime state. `--request` requires exactly one UTF-8 canonical JSON object followed by exactly one LF byte: parse once, require byte equality to `canonicalize(parsed) + "\n"`, strip only that framing LF, and hash/embed the resulting no-newline canonical body. Zero/two newlines, CRLF, BOM, whitespace, trailing bytes, or multiple JSON values fail before runtime/provider/signer/lock/write. API `requestBytes` remain no-newline canonical body bytes. Round-trip tests pipe `prepare-seat-request` directly to `invoke-seat` and table every newline negative. `--request-ref`, caller context/route, independent `--model`, `--provider`, `--transport-command`, inline/raw prompt, and separate stage flags do not exist. `capture-implementation-snapshot` takes no checkout/content arguments and prints only its closed ref result after controller-owned capture. Eye trust, transport registry, and grant are initialization-only: `--transport-registry` must name the tracked canonical publication body whose raw/canonical refs are authenticated by the packet and signed grant; no reopened command accepts it. The four root/bootstrap path/ref flags are mandatory and nonrepeatable for initialization and every reopened production command. Both expected refs are independently retained authorization values and may never be computed from supplied paths, runtime, or each other. Authenticate both path/raw-ref identities and packet signature before root/packet parsing or runtime reads; then require stored grant/trust/registry byte identity before selected code, journals, or output. Reject either external path inside runtime or selected from runtime bytes. `--commands` uses Task 7 validation. `--output-artifact-ref` is one non-repeatable already-ingested/captured ref, mandatory only for authoring stages and required to equal request `output_refs`; review stages forbid it. Governed recovery/mutation accepts instruction plus `mutate --artifact` only and internally derives its request/context/route after validation. The quoted CLI `export` spelling exists in Task 9 but must return `PRODUCTION_EXPORT_NOT_YET_GOVERNED` before any runtime/output read until Task 11 atomically enables production with strict checkpoint coverage and installation proof. After activation it creates a fresh anchor from the explicitly supplied root/packet paths/refs and requires an existing production runtime/checkout plus nonexistent disjoint output. There is no production CLI flag or API field for selecting `synthetic-test`.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-controller.mjs scripts/lifecycle-cli.mjs scripts/lifecycle-synthetic-test.mjs tests/test-lifecycle-controller.mjs tests/test-lifecycle-synthetic-test.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: add resumable serialized lifecycle controller"
```

Expected: all controller/replay/adapter/disk tests pass; no provider or private key is required.

### Task 9: Closed Detached-Verifiable Handoff Bundle

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export-internal.mjs`
- Create only by byte-identical authenticated copy from `/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-launch-v1.mjs`: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs`
- Create only by byte-identical authenticated copy from `/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-verify-v1.mjs`: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-synthetic-test.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs`

**Interfaces:**
- Task 9 reserves the future production API name `exportHandoffBundle({ runtimeDir, profile, checkoutDir, outDir, productionTrustAnchor })`, but its implementation is an unconditional fail-closed stub: after rejecting unknown option keys it throws `PRODUCTION_EXPORT_NOT_YET_GOVERNED` before path resolution, runtime/checkout read, replay, manifest construction, or output creation. No Task 9 code can emit `bundle_class: "production"` or claim product eligibility. The separate test-support API is `exportSyntheticHandoffBundleForTest({ runtimeDir, profile, checkoutDir, outDir, syntheticVerifierCapability })`; it accepts only the synthetic initializer's private brand, emits literal `bundle_class: "synthetic-test"` and `product_handoff_eligible: false`, and has no path to a production manifest. `lifecycle-export-internal.mjs` exposes only a capability-gated private deterministic builder to that synthetic wrapper in Task 9; caller-created objects fail and no production factory is reachable. The launcher and verifier targets are not authored in this task: after the root/bootstrap/registry precondition has authenticated both exact fixed TELOS source realpaths/raw refs and both exact plugin target realpaths, Task 9 copies each already-read source buffer once with exclusive creation, verifies target bytes/identity against the same buffer, and thereafter permits execution only through the fixed standard-library authorization loader described below. The reviewed detached verifier source already contains its final closed production verifier; it cannot be edited after the authenticated copy. Its production parser requires a nonrepeatable `--expected-installation-proof-ref <independently-retained-ref>` in addition to the closed launcher/root/bundle arguments. In Task 9, where no governed production installation proof can exist, omitting that flag returns `PRODUCTION_VERIFIER_NOT_YET_GOVERNED` before reading a bundle. Task 11 replaces only the exporter stub and supplies the independently retained proof ref after strict checkpoint and installation-proof enforcement succeeds; it does not patch or recopy either detached helper.

- [ ] **Step 1: Write failing export tests**

Create `tests/test-lifecycle-export.mjs` in Task 9 with these assertions only:

- every call to `exportHandoffBundle` and the CLI `export` command fails with `PRODUCTION_EXPORT_NOT_YET_GOVERNED` before reading runtime/checkout paths or creating output, even when given an otherwise valid branded production anchor; unknown/class-conversion fields fail no later;
- detached verification begins only in a fixed, test-byte-pinned Node standard-library authorization loader, never as `node <launcher-path>`. That loader accepts the exact closed outer argv `--authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <independently-retained-ref> --launcher /home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs --expected-launcher-ref <independently-retained-registry-bound-ref>` followed by the launcher's closed argv `--verifier /home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs --expected-verifier-ref <independently-retained-registry-bound-ref> --bundled-verifier <bundle-verifier-copy> --mode production --bundle <absolute-bundle-dir> --expected-installation-proof-ref <independently-retained-proof-ref> --telos-eye-root <absolute-external-regular-pem> --expected-telos-eye-root-ref <externally-recorded-raw-sha256-ref>`. Using only fixed `node:` primitives, it authenticates the independently retained root and bootstrap packet, exact raw grant/trust/registry, reviewed commit, and exact launcher target descriptor; then it stable-opens the exact normalized single-link launcher target once, hashes that buffer, and imports only that buffer through an in-memory URL. It cannot accept caller code, a launcher basename, another path, or a ref derived from the supplied file/bundle. The launcher similarly stable-opens the exact verifier target and exact bundled copy once, hashes both before any bundle manifest/entry read, executes only its in-memory verified installed source, and never executes/imports the bundle copy. At Task 9 the required installation-proof ref does not exist, so omitting it fails with `PRODUCTION_VERIFIER_NOT_YET_GOVERNED` before reading a manifest or entry; tests may use only a deliberately malformed non-production invocation and never invent a placeholder proof ref. Missing/malformed flags and missing/wrong-ref/bundle-contained/symlink/nonregular/hardlink/alternate-filename/alias/replaced launcher, installed verifier, bundled verifier, bootstrap, or root inputs fail even earlier with zero marker/output. There is no literal production manifest, production bundle root, installation proof, or `product_handoff_eligible: true` fixture at this commit;
- synthetic export requires the unforgeable synthetic verifier capability, rejects plain/copied/production capabilities and class overrides, performs private double construction, writes once to a fresh disjoint output, and always emits literal `bundle_class: "synthetic-test"` plus `product_handoff_eligible: false`;
- the synthetic manifest/closure contains the immutable synthetic config/profile/controller public key/Eye trust, every current signed decision/operation and generic checkpoint record, every reachable typed/raw/Git object, and the synthetic detached verifier; it excludes ambient bytes and production grant/eligibility claims;
- the synthetic detached verifier runs in a fresh process from only the bundle plus external synthetic root, verifies canonical bytes/refs/journal/DAG/Git closure, rejects any one-byte/add/delete mutation, and has no promotion option.

Task 11 modifies this same test file and adds these production-activation assertions; none is present or expected to pass in the Task 9 commit:

- an active, paused, cancelled, corrupted, stale, incomplete, synthetic, grant-missing, or unanchored store passed to `exportHandoffBundle` throws before output creation; a closed production store alone may reach handoff;
- a replay with no exact matching authorized/current plan, accepted/current implementation artifact ref, embedded/current disk tree ref, or required authority ref throws the specific missing or mismatch field;
- the production API rejects caller fields named `state`, `verification`, `trust`, `target`, `entries`, `evidenceRefs`, `bundle`, `bundleClass`, `syntheticVerifierCapability`, or any root bytes; a missing/plain/forged/stale `productionTrustAnchor` fails. Private builders/writers are not exported or reachable with caller-created contexts;
- a valid canonical production manifest has only `bundle_version`, `bundle_class`, `lifecycle_id`, `lifecycle_config_ref`, `profile_ref`, `lifecycle_root`, `target`, `eye_trust_ref`, `authority_claim`, `provider_observation_claim`, and unique path-sorted `entries`; `bundle_class` is the literal `production`, each entry is exactly `{ path, kind, byte_count, content_ref, logical_ref }`, the logical lifecycle-config entry repeats `lifecycle_config_ref`, and the bundle root is `sha256Ref(manifest)`;
- the typed-artifact entry at the replay-derived authorized plan ref is exactly `{ kind: "candidate", plan }` and hashes to both `authorized_plan_root` and `effective_plan_root`;
- the typed-artifact entry at `accepted_implementation_root === replay.effective_implementation_root` is closed `dfm.implementation.v1`; its `tree_root === effective_implementation_tree_root === disk_truth_tree_root`, and no test/verifier equates the artifact ref with that distinct tree ref;
- final production manifest reachability equals the complete closure of immutable lifecycle config/profile/controller public key/implementation grant/Eye trust, the grant-bound registry plus exact detector/validator/adapter raw bodies and dependency manifests/roots, every signed decision/operation/lifecycle-round checkpoint, every directly or transitively reachable typed artifact/raw blob including installation-authorization inputs, every Git object, and the final detached verifier source; the external registry-observer executable body is represented only by its signed descriptor and captured command evidence rather than bundled as trusted executable content; no reachable governed byte may be absent and no ambient/unreachable artifact may be included;
- that union includes every disk decision's explicitly named manifest and command-evidence refs, including non-pass attempts, and excludes unreferenced ambient manifests. Command evidence remains transitively bound to its raw envelopes without silently replacing the direct decision evidence set;
- private in-memory construction runs twice from the same resolved context and is byte-identical before any write. Export creates one fresh directory and writes every final path once; it never performs two `wx` writes to prove determinism. Reordered, inserted, deleted, stale, or incomplete journals cannot produce a bundle;
- before reading runtime or checkout, require each to be an existing regular non-symlink directory, require `outDir` not to exist, resolve its existing regular non-symlink parent, construct the prospective child, and reject equality/containment in every direction plus symlink/junction aliases. Replay target must equal checkout. Tests cover pre-existing empty output, missing parent, runtime/checkout/output equality or ancestry, aliasing, parent replacement between validation and creation, and init overlap; all reject before runtime/checkout reads, replay, signer/provider calls, or checkout mutation. Rehash checkout before and after and require byte identity;
- a fresh detached process with no runtime checkout, no replay object, and no plugin imports verifies canonical manifest/entry bytes, every content ref, journal chain/signature/state link, typed-artifact/raw closure, pinned Eye trust/signatures/prefix semantics, lifecycle root/state, and every Git object/OID/commit/tree link. Mutating/omitting/adding any byte, ref, trust key, root, authority claim, checkpoint, or Git object fails;
- synthetic tests use only `exportSyntheticHandoffBundleForTest`; plain/copied capabilities, production anchors, production runtimes, any class override, and any attempt to feed its output into production export fail. After Task 11 activation, production requires an independently anchored closed lifecycle whose target is a clean recorded Git checkout with a complete tracked-file tree manifest, full reachable commit/tree/blob/tag object closure, mandatory round-checkpoint coverage, and the exact installation proof;
- close and reopen a production runtime, then replace its config, implementation grant, Eye trust, controller key, journals, artifacts, and embedded attacker root with a coherently self-consistent forged set. Fresh production export must reject it against the independently supplied anchor before manifest construction or output creation. Missing/wrong anchors and one-byte stored grant/root/scope/signature drift fail identically;
- spawn production CLI `export` fresh and require all four explicit root/bootstrap path/ref flags before runtime state. Missing/duplicate/derived refs, inside-runtime inputs, wrong bytes, alternate filenames/links/aliases, or runtime-selected substitutes fail before manifest/output;
- spawn the finished detached verifier only through the fixed standard-library authorization loader and exact outer/launcher argv defined in Task 9, with exact target paths `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs` and `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs`, independently retained bootstrap/launcher/verifier/root refs, independently retained resolved installation-proof ref, and exact bundled path `<bundle>/lifecycle-detached-verify.mjs`. The launcher/verifier refs are retained from the authenticated registry and exact clean committed plugin context before bundle selection, while the proof ref is retained from the successful under-lock installation transition and fresh anchored replay; none may be derived or recomputed from a supplied path or bundle. Before opening `bundle-manifest.json` or any entry, the outer loader executes only the once-read launcher buffer; the launcher opens the installed verifier and exact bundled-copy path once without following links, requires stable regular single-link identities outside/inside the bundle respectively, hashes both byte streams, and requires both to equal the external verifier ref. It never executes/imports the bundle copy; it supplies the already-read verified installed source over dedicated inherited fd 3 to a fixed tiny `--eval` bootstrap, so source bytes never enter argv and path replacement/Windows argv limits cannot select different code. The verified source then validates the root and bundle path metadata, requires the root outside the bundle in both containment directions, parses exact canonical Ed25519 public-key bytes privately, and requires their raw-byte ref to equal the independently supplied root ref before manifest/entry reads. Missing or wrong bootstrap/launcher/verifier/root/proof ref or bytes, malicious same-byte alternate filename, hardlink/symlink/alias/contained copy, transient replacement, a bundled verifier that would print success, bundle-contained root, directory/FIFO/nonregular path, duplicate/unknown flag, or positional argument fails with zero helper marker, bundle read, or stdout;
- `authority_claim` equals `{ model_consensus_is_authority: false, eye_authority_required: true, mutates_telos_authority: false }`; `provider_observation_claim` equals `{ identity_basis: "pinned-adapter-runtime-observation", provider_signed_receipts: false, registry_ref: <authenticated-grant-bound-registry-ref> }`. The registry artifact/body is reachable through the grant closure, all four decision provenance records repeat that observation class, and no report upgrades this to remote provider attestation. Every persisted manifest/result/profile/artifact key is table-tested against `SECRET_KEY`, so a schema key cannot make its own valid value unpersistable;

- [ ] **Step 2: Run the test and confirm the export module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-export.mjs`.

- [ ] **Step 3: Implement the closed synthetic handoff foundation and production stubs**

At the Task 9 commit, `exportHandoffBundle` validates only its closed option-key set and then unconditionally throws `PRODUCTION_EXPORT_NOT_YET_GOVERNED`; it does not resolve paths, validate an anchor, call replay, construct a manifest, or expose an internal production factory. The synthetic wrapper validates its unforgeable synthetic capability, resolves the three paths and closed synthetic replay, walks refs from verified config/journals and every generic checkpoint actually present, recursively resolves every typed/raw dependency, and walks the recorded Git commit through every reachable commit/tree/blob/tag object. Git entry metadata includes exact object type and canonical `git:sha1:` or `git:sha256:` OID; verification recomputes the Git object header hash, not merely the raw-byte SHA-256. Construct nothing from ambient caller lists or previous bundles. The synthetic wrapper never accepts a production anchor and never includes a production eligibility claim.

Task 11 replaces the production stub only after its checkpoint and installation-proof code exists. The activated `exportHandoffBundle` first resolves the three paths exactly as above and validates the path-origin- and runtime-bound production anchor before reading either source tree. It creates a private resolved-context capability, calls anchored production replay internally, reauthenticates the exact stored grant/root/delegation, requires replay target equality, closed state, exact plan authorization, `accepted_implementation_root === effective_implementation_root`, `disk_truth_tree_root === effective_implementation_tree_root`, strict completed-pair-boundary/checkpoint bijection, stage-discriminated P1/C1 candidate identities, and the exact resolved installation proof. Only then may the private factory emit literal `bundle_class: "production"`, build twice in memory, and write once. Task 11 production export recursively closes every typed/raw/Git dependency and includes the exact installation authorization inputs. No prior commit can reach this factory.

The private builder constructs the sorted manifest and every entry buffer twice and requires byte identity. Export then revalidates the output parent identity, creates only the nonexistent leaf exclusively, writes each path once, fsyncs files/directories, rereads, and byte-verifies it. Parent replacement, output pre-creation, or checkout drift fails without fallback. It rehashes checkout unchanged after write. Task 9 launches only synthetic detached mode with the separately supplied synthetic root; after Task 11 activation, production export launches production detached mode with the separately supplied tracked TELOS Eye root.

The fixed outer authorization loader is the exact 11,078-byte standard-library module literal quoted in Task 11, raw ref `sha256:f4519ec0f9e809cdaa8c38eb804823af732ea7137b5919d6e57b6861a2f56409`; `test-lifecycle-export.mjs` owns a byte-identical constant, asserts that literal ref, and executes that exact constant rather than constructing or reading loader code. It has no filesystem import and implements only root/bootstrap/raw-body/reviewed-path authentication, strict parsing, one stable launcher read, same-buffer import, and bounded exit forwarding. `lifecycle-detached-launch.mjs` is the exact authenticated external-source copy installed/tracked outside the bundle. It has no top-level execution and exports only closed `runDetachedLauncher(argv): Promise<number>`. Once loaded from the verified buffer, that entry accepts only the exact forwarded invocation, reads/hashes stable single-link verifier files with no link following, verifies installed and bundled bytes against the independently retained ref, and spawns a child Node process with `shell: false`, bounded stdout/stderr, exact forwarded verifier args, a fixed tiny `--eval` bootstrap, and already-read installed verifier bytes on dedicated inherited pipe fd 3. The bootstrap reads bounded fd 3 bytes and imports only the corresponding in-memory `data:` module; verifier source never enters argv and the bundled copy is never evaluated. This rejects source identity drift and remains valid for a near-1-MiB verifier on native Windows. Tests inspect argv, run an over-Windows-limit padded valid verifier, and replace every exact helper with marker-bearing and same-byte alternate-name/link/alias/race variants; every rejection has zero marker/output/bundle read. `lifecycle-detached-verify.mjs` is the exact authenticated external-source copy included in and authenticated by the bundle, but is executed only from the launcher's verified installed buffer. Its closed production parser accepts exactly the forwarded mode/bundle/root arguments, independently retained installation-proof ref, and verified bundled-copy/ref bindings. It validates the external root path/type/origin and independently expected raw ref before any bundle-entry read; its private root-bytes parser is not exported. At Task 9 omission of the unavailable proof ref returns `PRODUCTION_VERIFIER_NOT_YET_GOVERNED` before opening the manifest. Its explicit synthetic-test mode verifies only a literal synthetic bundle against the separately supplied synthetic-test Eye root, rejects extras/omissions/noncanonical bytes, recomputes config/manifest/bundle/content/Git refs, and applies the universal strict signature decoder to every decision, operation, checkpoint, Eye authority, detached envelope, and vector signature before cryptographic verification. It verifies journal/DAG/replay/closure and always returns `product_handoff_eligible: false`; it rejects production manifests and has no promotion option. The same immutable verifier source handles Task 11 production only when the required independently retained proof ref is supplied and the bundle contains its byte-identical resolved proof plus exact completed-pair-boundary/checkpoint coverage and stage-discriminated P1/C1 identity. The detached module never accepts a serialized plugin `ReplayResult`; it builds its own module-private verified view. Production mode reauthenticates the persisted implementation grant and bundled production trust against the separately supplied root, validates the exact proof ref and full final closure with the honest provider observation claim, and only then emits one canonical success line with literal production eligibility. No plugin checkout, runtime directory, caller replay object, network, provider, or private key is available in either mode.

The bundle does not import from TELOS, edit `CURRENT-AUTHORITY.json`, grant authority, or claim enrollment, merge, release, or acceptance. A `synthetic-test` root is never renamed or promoted to production.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-export.mjs scripts/lifecycle-export-internal.mjs scripts/lifecycle-detached-launch.mjs scripts/lifecycle-detached-verify.mjs scripts/lifecycle-synthetic-test.mjs tests/test-lifecycle-export.mjs tests/test-lifecycle-synthetic-test.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: build isolated synthetic handoff foundation"
```

Expected: synthetic export/detached verification passes; every production API/CLI/verifier attempt remains fail-closed with no production-labeled bytes or eligibility claim until Task 11.

### Task 10: Synthetic End-to-End Proof Through the Isolated Test Controller

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`

**Interfaces:**
- Consumes: the Task 8 isolated synthetic-test controller, injected deterministic seats, external signer wrappers, synthetic-test Eye key, synthetic replay, and Task 9 test-only synthetic export API/detached verifier mode. It must not call production initialization, production replay, `exportHandoffBundle`, or compose store/engine/export state directly.
- Produces: CLI `node scripts/lifecycle-demo.mjs --checkout <existing-empty-checkout> --runtime <nonexistent-child> --handoff <nonexistent-child>` and exported `runDemo({ checkoutDir, runtimeDir, handoffDir }): Promise<object>`. Only the checkout is pre-created; runtime and handoff are distinct nonexistent sibling children under an existing non-symlink parent.

- [ ] **Step 1: Write the failing spawned proof test**

Create `tests/test-lifecycle-demo.mjs`. It must create one existing empty checkout plus two nonexistent sibling paths under one existing non-symlink parent, spawn the CLI, require exit 0 and `DAEDALUS_FAMILY_DEMO_OK`, read the closed public summary from stdout rather than writing it into checkout/runtime/handoff, and assert:

```js
assert.equal(summary.feature, "content-addressed-note");
assert.equal(summary.status, "closed");
assert.equal(summary.failure_routes_to_daedalus, 1);
assert.equal(summary.reentered_gate, "p1-plan-pair");
assert.ok(summary.decision_count >= 18);
assert.match(summary.lifecycle_root, /^sha256:[0-9a-f]{64}$/);
assert.match(summary.authorized_plan_root, /^sha256:[0-9a-f]{64}$/);
assert.match(summary.accepted_implementation_root, /^sha256:[0-9a-f]{64}$/);
assert.match(summary.implementation_tree_root, /^sha256:[0-9a-f]{64}$/);
assert.equal(summary.disk_truth_tree_root, summary.implementation_tree_root);
assert.notEqual(summary.accepted_implementation_root, summary.implementation_tree_root);
assert.match(summary.bundle_root, /^sha256:[0-9a-f]{64}$/);
assert.equal(summary.bundle_class, "synthetic-test");
assert.equal(summary.product_handoff_eligible, false);
assert.equal(summary.private_key_persisted, false);
```

It must also run the immutable-journal verifier, then launch synthetic detached verification through the fixed stdlib same-buffer loader with exact source launcher/verifier paths and refs retained before bundle selection, bundled copy, written bundle, and external synthetic Eye trust; assert both roots, literal synthetic class, and permanent ineligibility. Synthetic mode has no production bootstrap claim, but still rejects any alternate filename/link/alias/replacement before helper evaluation.

- [ ] **Step 2: Run the test and confirm the demo is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-demo.mjs`.

- [ ] **Step 3: Implement the proof run**

`runDemo` must refuse non-empty or non-disjoint checkout/runtime/handoff directories before any write, generate ephemeral Ed25519 controller/Eye keypairs, load the committed profile, and execute this exact scenario with injected deterministic provider doubles:

1. Persist a typed requirement/policy and a separately Eye-signed `freeze-requirements` artifact; record requirements freeze through the controller.
2. Materialize exact canonical candidate `{ kind: "candidate", plan: planV1 }` from the deterministic Daedalus-authoring fixture, persist it through `ingestArtifact`, call `prepareSeatRequest` for Daedalus with that singleton output, then invoke `plan-draft` with the returned exact `requestBytes` and matching stored `outputArtifactRef`. Assert internally derived request/context refs, exact candidate bytes in the captured provider frame, singleton decision output, and pre-transition request/context/operation/node/provenance subject; replay alone promotes the candidate after pass. Every later ordinary model call also uses a freshly prepared request.
3. Daedalus and Icarus pass `P1` independently.
4. Grok returns `non-pass` at `P2` with finding `PLAN_TEST_ORACLE_MISSING`; the decision is atomically published.
5. Daedalus explicitly mutates the plan to canonical candidate v2 through the dedicated `mutate` path with its bounded instruction; that path validates/ingests the artifact and derives its exact request/context internally, never using ordinary `invoke-seat --output-artifact-ref` or caller context. The mutation clears old plan approval and re-enters `P1`. This is not recorded as a retry.
6. Daedalus/Icarus pass `P1`; Grok/Gemini independently pass `P2`; a separately Eye-signed `authorize-plan` artifact authorizes the exact v2 candidate root.
7. Write source/tests, initialize the deterministic checkout Git repository if needed, commit the complete clean inventory with fixed identity/timestamps, and call no-argument `captureImplementationSnapshot()`. Let its returned refs be T1/I1 and require its commit ref to equal Git HEAD; direct generic tree/implementation/raw ingestion is forbidden. Call `prepareSeatRequest` for Icarus with singleton I1, require the frame to contain exact implementation, T1, and every manifest-named source byte, then invoke `code-draft` with the returned request and matching `outputArtifactRef`. Assert the decision output is I1, deliberately distinct from T1, while request/context/operation/node/provenance subject remains the authorized plan root. Replay promotes I1/T1 only after pass; freshly prepared Icarus/Daedalus C1 and Grok/Gemini C2 calls use empty outputs.
8. `verifyDisk` re-derives manifest ref T1 and compares it only to `I1.tree_root`; its command evidence uses `cwd_ref: T1` and implementation-bound raw envelopes. Persist/reread the exact evidence objects, then assert the disk decision has singleton implementation input, empty outputs, and direct evidence exactly `uniqueSort([T1, ...commandEvidenceRefs])`. The decision remains governed by I1's artifact ref and replay sets the disk root only from its named T1 evidence. A separately Eye-signed `accept-implementation` artifact accepts I1's artifact ref, not T1. Call only the branded synthetic controller's `recordSyntheticRetrospectiveForTest({ evidenceRefs, recordedAt })`; require its unforgeable synthetic capability and exact synthetic trust/runtime brand, prove the production controller/API/CLI rejects the method/capability before any read or write, and only then let this permanently product-ineligible synthetic run close when accepted/current artifact refs match and disk/embedded tree refs separately match.
9. Terminate controller process context, call synthetic replay from a fresh import, hash checkout, and call only `exportSyntheticHandoffBundleForTest(...)`. Private double-build agrees before one write. Launch explicit synthetic-test mode only through the fixed stdlib loader, giving exact launcher/verifier paths and independently retained pre-bundle refs, bundled copy, bundle, and external synthetic Eye root; require full closure/exclusion and literal `product_handoff_eligible: false`. Direct launcher-path or bundled-verifier execution, production export/class, missing brand, or helper path/ref substitution fails before output/bundle reads. Zero lifecycle-round checkpoints is allowed only before Task 11 and remains product-ineligible.

Use controller-supplied ISO timestamps derived from an incrementing fixed base solely for repeatable ordering; timestamps remain non-authoritative. All runtime writes go through the isolated synthetic-test controller and exact request/context framing. The demo must pass the explicit stored candidate ref and controller-captured implementation ref at authoring stages and never select an output by scans, newest files, provider text, or ambient Git. Private keys stay in signer closures. This proof is synthetic test coverage only; it cannot initialize or export production, does not satisfy the Task 11 production lifecycle, and does not authorize product handoff.

- [ ] **Step 4: Run the entire lifecycle suite and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-adapter-grammar.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-demo.mjs tests/test-lifecycle-demo.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "test: prove Daedalus family lifecycle end to end"
```

Expected: every lifecycle test passes; the demo reports one non-pass return through Daedalus and ends only after the exact ordered passes and Eye records.

### Task 11: Skill Commands, Plugin Metadata, Bootstrap Hygiene, and Installation Proof

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/skills/daedalus-family-lifecycle/SKILL.md`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/checkpoint.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-replay.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-controller.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-artifacts.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-installation.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export-internal.mjs`
- Retain byte-identical and unchanged: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs`
- Retain byte-identical and unchanged: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-cli.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-synthetic-test.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/skills/context-checkpoint/SKILL.md`
- Modify: `/home/colchis/plugins/multi-model-seats/hooks/hooks.json`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-fixtures/v1/acyclic-source/`
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-fixtures/v1/vector-signing-public.json`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/generate-lifecycle-final-vectors.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-final-vectors.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-vectors/v1/final-vector.json`
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-vectors/v1/final-detached-bundle/`
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-test-vectors/v1/final-negative-bundles/`
- Modify: `/home/colchis/plugins/multi-model-seats/.codex-plugin/plugin.json`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/bootstrap.mjs`

**Interfaces:**
- Consumes: lifecycle CLI, existing provider-seat/Superpowers skills, plugin-owned checkpoint/hook surfaces, the verified source package, independently retained TELOS root/bootstrap identities, the bootstrap-authenticated grant/trust/registry, and its exact OS-protected `identity_fence_runner` plus native registry-observer/profile descriptors. Production never executes either descriptor pathname from Node and never trusts pre/post pathname identity as the consumed image claim.
- Produces: discoverable `multi-model-seats:daedalus-family-lifecycle`, isolated strict read-only `lifecycle-round` load/precompact argv modes at runtime path `checkpoints/lifecycle-round`, one non-argv checkpoint append primitive imported only by the controller, replay-brand-only boundary/context interfaces, controller method `saveLifecycleRoundCheckpoint(): Promise<{ checkpoint_ref }>`, and closed `lifecycle-installation.mjs operator-marketplace-list|operator-remove|operator-add` transactions. Each operator transaction authenticates root/bootstrap/grant/registry, opens one fresh authenticated local IPC connection to the already-running protected service, sends one nonce/ref-only request for exactly one registry action, applies the universal strict signature decoder to the returned `dfm.identity-fence-receipt.v1`, and accepts output only after source/consumed observer/profile identity equality, armed-fence/no-event/no-overflow/process-tree-empty, and exact action/output checks. The task also produces plugin version `0.6.0`, byte-exact source/cache preflight, a post-init controller-only installation materializer whose `plugin-list` observation is bound to that receipt, a gated real-backend production call-chain test plus permanently product-ineligible synthetic contract tests, deterministic final-vector generation, and—only after a supported protected backend and installation proof—production handoff for the exact checkout.

- [ ] **Step 1: Write the failing packaging test**

Create `tests/test-lifecycle-skill.mjs` that asserts:

- `.codex-plugin/plugin.json` version is exactly `0.6.0` and its description mentions `Merkle-DAG lifecycle`;
- the new skill frontmatter name is `daedalus-family-lifecycle`;
- the skill contains all seven actual Superpowers names from Global Constraints;
- the skill contains `P1`, `P2`, `C1`, `C2`, `every non-pass returns to Daedalus`, `model consensus is not authority`, and `The Eye`;
- the skill documents the production `init/status/resume/ingest-artifact/capture-implementation-snapshot/prepare-seat-request/invoke-seat/recover/mutate/eye-action/verify-disk/save-lifecycle-round-checkpoint/record-installation/export` commands, requires the four external root/bootstrap path/ref flags on every one, forbids deriving either retained ref from a supplied path/runtime/bundle or the other input, documents the exact external signer boundary, requires separately signed Eye authority, and states that no final production `record-retrospective`/proof-selection command exists;
- it documents candidate `ingest-artifact` for plan draft, controller-owned clean-Git `capture-implementation-snapshot` for code draft, then the exact `prepare-seat-request`/singleton `invoke-seat --output-artifact-ref` contract. It forbids direct generic implementation ingestion and output flags at review stages, and keeps governed recovery changes on dedicated `mutate --artifact --instruction` with internally derived context;
- it documents that `verify-disk` itself re-derives and persists the named manifest/command evidence, produces a decision with singleton implementation input and no outputs, and never selects ambient evidence;
- it names required Claude/Daedalus plus GPT/Icarus at P1/C1, required Grok plus Gemini at P2/C2, and the unchanged TELOS council required trio Claude/Agy/Codex with Grok/Gemini advisory;
- every line invoking a plugin script uses `node "<plugin-root>/scripts/<name>.mjs"` with a quoted resolved path;
- `bootstrap.mjs` generates `.multi-model-seats/lifecycle/` in `.gitignore`;
- every ordinary model call first uses `prepare-seat-request --seat ... --instruction ...` and then `invoke-seat --request <canonical-seat-request-json>`; recovery/mutation use `--instruction` and never accept caller request/context. The skill contains no `--request-ref`, caller context flag, independent `--model`, raw prompt, or same-directory handoff syntax;
- the skill states that only completion of both required peers in a P1/C1 pair creates checkpoint entitlement, that the boundary selects the pair's exact settled Icarus operation in either legal order, and that only the controller derives/signs/publishes the six-field minimal lifecycle-round checkpoint from fresh replay; a partial pair creates no boundary, open findings set `next_action: daedalus-revise`, an all-closed completed pair sets `grok-gemini-cold-review`, mechanics/messages are excluded, and every non-pass/death returns to Daedalus without caps.
- the skill quotes the read-only production strict-checkpoint commands with only runtime, expected lifecycle ID, and all four external root/bootstrap path/ref flags; unknown or state-writing flags are forbidden.
- the skill quotes the exact fixed-stdlib-loader detached production invocation with independently retained bootstrap/launcher/verifier/root refs, the independently retained installation-proof ref, and exact launcher/verifier paths; it states that bootstrap/helper/root/proof checks run before any bundle-manifest/entry read or output and that the bundled verifier is never executed.
- the unchanged production credential detector reports zero matches over the complete revised authoritative plan. Every credential-shaped negative fixture is assembled only by the test-local fragment helper and the joined runtime value is still rejected. The complete-plan candidate golden reads its expected ref from the externally signed authorization record, matches both plugin and TELOS canonical hash implementations, and fails after one-byte mutation; no candidate ref is embedded self-referentially in the plan.
- installation/preflight tests resolve runner, observer, action, and profile descriptors only through the bootstrap-authenticated registry. Every operator/observation invocation uses one independent service transaction and receipt; Node never spawns a runner/observer path. Tests verify the root/Administrator-owned service image, IPC peer, receipt key, exact platform contract, nonce/request/action binding, source and consumed observer/profile identities, supported execution/exposure method, armed fence, zero events/no overflow, complete process-tree exit, and exact argv/environment/cwd/status/stdout/stderr refs/bytes. The three operator actions use three connections/workers/nonces/receipts/fences; replacement or transient rename/restore between/during calls, file-watch overflow, late child, receipt replay, wrong peer/key, unsupported platform/interop, or middle-action failure prevents the later add marker. A `codex` PATH shim, caller executable/profile/action override, same-byte alternate filename/hardlink/alias, wrong descriptor/ref/identity, or contained profile/observer fails before later installer/driver/provider/signer/persistence. Synthetic receipt services are accepted only by explicitly synthetic tests and can never satisfy production eligibility.

Create `tests/test-lifecycle-checkpoint.mjs` to prove strict `lifecycle-round` is isolated and existing broad checkpoint behavior remains byte-compatible. Apart from unavoidable signed journal envelope/version fields, the payload is exactly:

```js
{
  candidate: { kind: "plan" | "implementation", raw_sha256: "64-lowercase-hex", canonical_ref: "sha256:..." },
  boundary: {
    authority_ref: null | "sha256:...",
    predecessor_checkpoint_ref: null | "sha256:...",
    round_boundary_ref: "sha256:..."
  },
  round_id: "round-...",
  findings: [{
    id: "icarus-<64-lowercase-hex>",
    status: "open" | "closed",
    evidence_refs: ["sha256:..."],
    disposition: null | { code: "...", action: "...", target_stage: null | "stage-id", subject_ref: "sha256:..." }
  }],
  current: { stage: "stage-id", owner: "daedalus" | "icarus" },
  next_action: "daedalus-revise" | "grok-gemini-cold-review"
}
```

Task 11 extends `lifecycle-replay.mjs` without changing the closed serializable `ReplayResult` projection from Task 5: each successful production or synthetic replay result object is registered in a module-private `WeakMap` whose value contains the full already-verified decision bodies, operation bodies, pair-base/prefix snapshots, artifact resolver, and immutable byte/ref identities needed for checkpoint derivation. The map is populated only inside the corresponding replay function after complete disk verification. Every new checkpoint function first requires the exact object identity and correct production/synthetic brand in that map and reads completion/base/Icarus facts only from its private value; a plain object, structured clone, JSON round-trip, copied frozen projection, or result from another replay module/runtime has no authority even if every public field matches. The public projection is never expanded with hidden-looking caller-serializable proof fields.

The signed envelope is exactly `{ checkpoint_record_version: "dfm.lifecycle-round-record.v1", lifecycle_id, journal_index, previous_journal_ref, payload, controller_key_id, controller_signature }`; envelope metadata is not copied into payload. Its signature uses the shared strict decoder before verification/publication. `boundary` has exactly the three keys shown. `boundary.predecessor_checkpoint_ref` must equal the full prior signed checkpoint ref and the envelope's `previous_journal_ref`, or both null only at genesis. `round_boundary_ref` must equal the one controller-derived required boundary being covered.

All nested objects are closed and bounded. Candidate identity is total and stage-discriminated. At P1, `candidate.kind === "plan"`, `raw_sha256` is the lowercase SHA-256 hex of the exact UTF-8 bytes of the resolved canonical TELOS candidate's `plan` string, and `canonical_ref === sha256Ref({ kind: "candidate", plan })`. At C1, `candidate.kind === "implementation"`, `raw_sha256` is the lowercase SHA-256 hex of exact `canonicalBytes(implementationArtifact)` with no trailing newline, and `canonical_ref === sha256Ref(implementationArtifact)` for the replay-resolved governed `dfm.implementation.v1`; its embedded `tree_root` remains distinct evidence and is never substituted as the candidate. In both cases `payload.candidate.canonical_ref === resolvedRequiredBoundary.body.candidate_ref ===` the exact governed candidate selected by replay at that completed pair. Save/load/export/detached verification independently resolve the body and recompute all three equalities and the raw hash; wrong discriminant, plan normalization/newline/encoding drift, implementation canonical-byte/newline drift, implementation/tree substitution, and any implementation or tree binding mutation fail.

`authority_ref` is derived—not caller supplied—as the latest replay-verified Eye authority applicable at the exact pair-completion prefix, or null only when the profile permits no authority yet. A required boundary exists only for a completed P1/C1 pair gate: both required peer operations must be settled against the same frozen pair base and the reducer must expose the deterministic pair-completion transition. The boundary body is exactly `{ round_boundary_version: "dfm.round-boundary.v1", lifecycle_id, pair_stage, candidate_ref, subject_ref, pair_completion_decision_ref, icarus_attempt_ref, icarus_decision_ref }`; `pair_completion_decision_ref` is the exact decision that settled the second required peer, while the Icarus fields select the unique issued Icarus operation/decision from that completed pair regardless of invocation order. `round_boundary_ref = sha256Ref(body)`. `deriveRequiredRoundBoundaries(replay)` derives unique append-only ordered bodies/refs from every verified historical completed pair, including pairs later invalidated by a mutation that occurred only after its checkpoint; an Icarus-first or Daedalus-first one-seat partial pair yields none, and settling the other peer changes the count by exactly one. A non-pass that exits before both peers settle cannot mint a boundary. The controller globally fences every state-changing route while `verifyLifecycleRoundPrefix` exposes an uncovered boundary, so no mutation/recovery/Eye/disk/retrospective/model decision can occur between pair completion and save. An old boundary/checkpoint remains valid evidence for its historical prefix, but only the latest completed pair whose stage-discriminated candidate equals the replay's current governed candidate may authorize the descendant P2/C2 gate. `round_id` is exactly `"round-" + sha256hex(canonicalize({ candidate, boundary, stage: current.stage }))`, making it stable and unique for that predecessor/candidate/stage.

The settled Icarus operation is the sole source of `findings` entitlement; the controller alone derives their checkpoint projection from verified decisions at the exact prefix. Each ID is exactly `"icarus-" + sha256hex(canonicalize({ candidate_ref, source_decision_ref, finding_index, finding }))`; IDs are stable, globally unique within the lifecycle, and arrays are sorted by ID. Evidence refs are unique sorted, resolve through replay, and exactly match the source finding. Open findings require `disposition: null`. Closed findings require exactly one directly referenced `dfm.icarus-finding-disposition.v1` from the exact issued Icarus P1/C1 operation decision. Its lifecycle/pair/candidate/subject/source-decision/source-index/finding-ID/attempt/request fields must all equal the verified source and operation, and its nested closed disposition supplies the payload projection. Ambient, copied, cross-operation, or decision-level dispositions never close a finding. Literal Icarus pass remains `findings: []`, `dispositions: []`. No message, mechanic note, prompt, transcript, summary prose, hidden reasoning, lifecycle root, duplicate plan/implementation root, head list, timestamp, generic status, or consolidator identity may enter payload.

`current` and `next_action` are derived only from the historical replay prefix ending at `pair_completion_decision_ref`, which the transition fence guarantees is also the save prefix. The total reachable table is order-independent:

| Completed pair result | Exact replay stage after pair completion | owner | next_action |
|---|---|---|---|
| either peer is non-pass, or any carried Icarus finding remains open | `daedalus-recovery` | `daedalus` | `daedalus-revise` |
| both peers are literal pass and every carried Icarus finding is closed (including the empty set) for P1 | `p2-plan-adversarial` | `icarus` | `grok-gemini-cold-review` |
| both peers are literal pass and every carried Icarus finding is closed (including the empty set) for C1 | `c2-code-adversarial` | `icarus` | `grok-gemini-cold-review` |

No partial pair, intermediate Daedalus revision, Eye-wait stage, later recovery, or later mutation is a saveable prefix, so `icarus-review` and `await-eye` are intentionally not payload values. Tests run both legal seat orders for every row and require byte-identical `current`, `next_action`, candidate identity, and `round_id`; any other verdict/finding/stage/owner/action combination is invalid.

`verifyLifecycleRoundPrefix({ replay, checkpointChain, resolveArtifact })` first requires the exact replay object in the private `WeakMap` and requires `resolveArtifact` to be the resolver identity stored with that replay; neither public fields nor a caller-equivalent resolver suffice. It then verifies a valid existing checkpoint prefix against the ordered required-boundary list from the private view: checkpoint `i` must cover required boundary `i`, all refs/bodies resolve through the verified store, and no gap/extra/duplicate/positionally stale/cross-lifecycle/pair/candidate entry is allowed. It returns a deep-frozen module-branded `VerifiedRoundPrefix` containing verified entries plus exactly one `next_uncovered_boundary` or null. It succeeds before the first save when the chain is empty and the first boundary is uncovered. Only this prefix verifier is used to authorize append of that sole next boundary.

`verifyLifecycleRoundCoverage({ replay, checkpointChain, resolveArtifact })` is the terminal full-bijection verifier: it first obtains a verified prefix, then requires `next_uncovered_boundary === null` and equal historical boundary/checkpoint counts. It never deletes or reclassifies an already valid historical checkpoint after mutation. P2/C2 invocation/resume, both production and synthetic-test export after Task 11 integration, and detached verification additionally require the checkpoint selected for the current gate to cover the latest completed-pair boundary for the replay's exact current governed candidate; an older historically valid checkpoint is ineligible for that descendant. Every P2/C2 operation has a non-null controller-derived `round_checkpoint_ref` naming that exact current covering checkpoint; Grok and Gemini for one gate use the same ref.

`deriveIcarusRoundContext({ replay, verifiedPrefix, resolveArtifact })` accepts only a replay object and resolver registered together in the private map plus the matching branded prefix, and requires `next_uncovered_boundary === null` at the pre-invocation snapshot, so all earlier completed-pair boundaries are covered. It resolves the current stage-discriminated governed candidate, exact finding sources, and prior operation-bound dispositions only through that private verified view. `checkpoint_prefix_ref` is exactly `sha256Ref({ round_prefix_version: "dfm.round-prefix.v1", lifecycle_id, required_boundary_refs, checkpoint_refs })`, with both ref arrays in verified journal order and equal length. The function returns a deep-frozen module-branded `IcarusRoundContext` with lifecycle, pair stage, candidate kind/ref/raw identity, subject ref, replay/config/decision/operation snapshot refs, that prefix ref, and source decision/index/finding tuples. It contains no not-yet-created boundary: only later completion of the whole current pair can create one. Plain/caller-created/openly mutated objects cannot pass its private brand.

`consumeIcarusRoundContext({ replay, verifiedPrefix, context })` is exported by `lifecycle-replay.mjs`, closes over the same module-private context/prefix brands and a one-use `WeakSet`, and is the only brand consumer. Read-only controller preflight derives but does not consume `context`. After the controller acquires its tokenized operation lock, and before any signer or provider call or start/CAS publication, it performs a fresh anchored replay and fresh checkpoint-prefix verification and passes those under-lock objects plus the preflight context to `consumeIcarusRoundContext`. The consumer requires the context's branded snapshot to be byte-identical to the fresh replay's lifecycle/config/root/decision/operation/candidate/prefix/current-route inputs, rejects a context from another runtime, an earlier or interleaved prefix, or an already consumed call, and only then atomically marks it consumed and returns a nonserializable `{ finalizeAdapterResult(adapterResult) }` closure over the freshly resolved finding targets. Any interleaving drift releases only the caller's own advisory lock and adds no persistent byte, signer call, or provider call. Immediately after successful consumption the controller constructs/signs/publishes the request-bearing start through journal CAS; only the CAS winner invokes the context-independent Task 6 adapter/provider and gives the adapter's deep-frozen ephemeral `findingResolutions` plus base decision/artifacts to the returned finalizer. The finalizer alone validates each source/index/finding/candidate/subject/attempt/request binding and materializes canonical `dfm.icarus-finding-disposition.v1` artifacts/direct evidence. The adapter never imports Task 11, receives a replay brand, or decides brand validity. The public Task 6 suite therefore passes before Task 11; Task 11 integration owns every genuine/forged/stale/interleaved/cross-runtime context case.

Tests cover unknown fields and every removed legacy field (`phase`, plan/implementation/lifecycle roots, decision heads, ref arrays, generic status, consolidator, timestamp), missing/unknown next action, wrong candidate kind, altered P1 plan raw/canonical pair, altered C1 implementation raw/canonical pair, implementation newline/tree/artifact substitution, authority/predecessor/round-boundary drift, duplicate/unstable/unsorted finding IDs, open-with-disposition, closed-without-operation-bound-disposition, source/index/attempt/request/candidate/subject drift, evidence/status drift, stage/owner drift, and mechanic-message injection. A plain/copied/frozen/structured-cloned/JSON-round-tripped `ReplayResult`, a resolver from another replay, and a production-vs-synthetic brand swap all fail before boundary derivation, artifact reads, signer/lock/write, or output; only the exact fresh replay object registered with its private verified material passes. P1 and C1 save, fresh-process load, export, and detached verification each repeat the candidate/ref/body equality checks. After valid coverage, perform a governed plan mutation and separately governed implementation mutations that change only the implementation body or its embedded `tree_root`: the old boundary/checkpoint remains valid immutable historical-prefix evidence but is ineligible for the mutated descendant/current gate, so cold review/export/detached verification fail. The required rerun appends a new stage-correct candidate boundary after the fully covered historical prefix, and only its new checkpoint restores current-gate coverage. Separately, adding/removing a newline from stored plan text or canonical implementation bytes is byte tamper, not a governed mutation, and fails canonical/raw verification without creating a new candidate. First run the independent Task 6 adapter suite without importing replay/checkpoint symbols. For both legal pair orders, settle only the first peer—including Icarus first—and prove required-boundary count and cold eligibility remain unchanged; settle the second peer and prove exactly one boundary selects the pair's exact Icarus operation and completion decision. Before a current Icarus call, earlier required boundaries and checkpoints are fully covered; read-only preflight derives a genuine context, then fresh under-lock replay consumes it once and its finalizer materializes operation-bound claims. Inject a valid interleaving decision/operation/checkpoint change between preflight and lock and require stale/plain/mutated/already-consumed/cross-runtime values to leave the post-interleaving prefix byte-identical after the caller's lock is removed, with zero added signer/provider calls. Complete the genuine pair, kill the invoking process immediately, and leave exactly one new uncovered completed-pair boundary on disk. A fresh anchored process calls `controller.saveLifecycleRoundCheckpoint()` with no arguments: prefix verification finds that sole boundary, the first save succeeds, and full coverage then succeeds. A duplicate save, zero/multiple uncovered boundaries, a caller-supplied payload/ref/role/lifecycle/candidate, direct generic append, or a mechanic/hook attempt fails before signer/lock/persistent write. Spawn `node scripts/checkpoint.mjs lifecycle-round-save ...` and require an unknown-mode failure with zero runtime byte change; only the controller may import the append primitive. Spawn strict load and precompact in separate fresh processes; missing, wrong, byte-identical runtime-contained, symlink/nonregular, runtime-selected, or substituted root input and every unknown/write-capable flag fail before runtime-state output. Cold load returns exactly a deep-frozen copy of the six payload fields. Swapped/gapped/forged records, missing/duplicate/extra/positionally stale coverage, a current gate selecting an older historical checkpoint, different Grok/Gemini refs, and concurrent savers fail through journal CAS. P2/C2 initial and resume plus both export wrappers reject missing/current-candidate-ineligible checkpoints after integration. Session hooks select strict read-only load/precompact only for an explicit lifecycle runtime; broad non-lifecycle mode remains unchanged.

Create `tests/test-lifecycle-install.mjs` with two explicit closed top-level sets. The versioned source checkout is exactly `.git` plus `.codex-plugin`, `hooks`, `records`, `scripts`, `skills`, and `tests`; `.git` is the sole allowed SCM metadata entry and is excluded from the package manifest. The discovered installed-cache root is exactly the six package roots and explicitly forbids `.git`. No other top-level entry is permitted. For the source, enumerate the complete physical regular-file inventory beneath the six roots with no link following, require every root to be a real directory, reject every symlink/special/type-drift entry, and require the sorted paths to equal `git ls-files` over those roots byte-for-byte. Also require `git status --porcelain --untracked-files=all --ignored=matching -- <six-roots>` to be empty so ignored nested files are not invisible. For the installed cache, enumerate the complete physical regular-file inventory the same way and require it to equal the authenticated installed package-manifest entries exactly. Build the closed `dfm.package-manifest.v1` entries `{ path, file_type: "regular", byte_count, content_ref }` from those complete inventories. Require source and discovered installed-cache manifests to match exactly—body, ref, file set, type, bytes, package ID, and version—not one sample hash. Cache discovery comes from `codex plugin list --json`/installed metadata, never a hard-coded version path. Tests inject an ignored nested file, an ignored credential-shaped file assembled from fragments, an untracked file, a missing tracked file, a symlink, a type drift, `.git` in the cache, and an extra source/cache root; every case fails before trust or child spawn.

Exercise `validateInstallationProofResolved(authenticatedScanner, { proof, resolveArtifact, resolveRawBytes, resolveGitObject, expectedImplementation, expectedImplementationRef, expectedImplementationGrant, expectedImplementationGrantRef })` against the verified implementation tree/raw/Git closure, source/cache manifest refs, exact installation-test evidence singleton, and authenticated immutable runtime grant. Production replay/export/detached callers obtain `authenticatedScanner` only from their private retained `AuthenticatedGenesis` or authenticated bundled-genesis capability; tests pass only the visibly synthetic scanner and remain product-ineligible. Resolver closure tests reject missing/non-function scanners, unresolved typed/raw/Git refs, wrong kind, ID/version/body/file/ref, stale or different implementation/commit/tree/source identity, same-version different source, relabel-only proof/manifest/descriptor drift, resolver substitution, ambient matching-manifest/result substitution, cross-lifecycle evidence, wrong command/result/authentication/count/path bindings, canonical-grant/raw-evidence ref conflation, a second valid same-scope grant, and detached drift; production entry-point tests reject every scanner override key/argument before resolution or persistence. When applying the retrospective node, replay first requires `node.artifact_hash === replay.accepted_implementation_root === replay.effective_implementation_root`, resolves that exact artifact as `expectedImplementation`, and passes that common ref as `expectedImplementationRef`; the node's direct evidence must be exactly the validated proof ref. Replay/export/detached verification all repeat the same resolved check with those retrospective-selected implementation body/ref values plus the exact authenticated genesis grant body and `replay.implementation_grant_ref`; none may select them from the proof, caller, newest artifact, manifest labels, or ambient Git. Generic schema validation alone never claims source/cache identity or a successful installation run.

Every install-test mode requires explicit `--authorized-plan-grant <canonical-signed-file>` plus all four root/bootstrap path/ref flags, calls the same fixed-primitive root/packet/raw-body authenticator as the core golden, resolves the exact production registry through those authenticated buffers, and derives grant/candidate/root/bootstrap/runner/observer refs only after both retained-ref equalities. Missing/duplicate flags, coherent forged root/packet/grant under other refs, signature/scope/subject/registry/helper mismatch, or any ref derived from a supplied path fails before manifest trust, IPC, or child spawn. `--source-only <root>` then requires `realpath(root) === /home/colchis/plugins/multi-model-seats`, exact Git toplevel equality, and the physical inventory rules above; it performs manifest/schema validation only and starts neither service action nor child.

`scripts/lifecycle-installation.mjs` has a separate pre-runtime operator parser with exactly three positional actions: `operator-marketplace-list`, `operator-remove`, and `operator-add`. Each action accepts only one `--source /home/colchis/plugins/multi-model-seats`, one `--authorized-plan-grant <canonical-signed-file>`, and the four root/bootstrap path/ref flags; duplicate, unknown, runtime, lifecycle, cache, metadata, executable, runner, endpoint, profile, environment, argv, command, plugin, marketplace, or version inputs fail before IPC. The registry's fixed action table maps those modes exactly to `marketplace-list`, `plugin-remove`, and `plugin-add`; caller argv is impossible. Every action is a new process and complete transaction: authenticate root/bootstrap/raw grant/trust/registry/reviewed source, validate the root-pinned runner/observer/action/profile descriptors, connect to the exact protected local endpoint and authenticated peer, send one bounded canonical nonce/ref-only request, and accept only one strict-canonical signed receipt from the pinned key. The receipt must prove the correct platform backend, independently measured service image, source/consumed observer and profile identity equality, exact derived argv/environment/cwd, armed fence, zero namespace events/no overflow, complete process-tree exit, and bounded output refs/bytes. Node never spawns or passes an executable/profile path to the service. Operator mode persists no lifecycle object/evidence/proof. Failure in one process prevents the operator from starting any later action; there is no grouped/bracketing mode, shared connection/worker/fence, or second action in one receipt.

The default preflight accepts no installed-metadata body/path and no runner/executable/endpoint/receipt/command/environment/profile override. After exact source cleanliness and authorization, it resolves the exact runner/observer plus `plugin-list` action only from the registry and performs one independent protected-service transaction as above. Controller-side stable path checks remain defense in depth; the accepted identity claim comes exclusively from the verified signed receipt's consumed image/profile fields. The canonical command projection is derived from receipt argv/cwd/status/signal/output and binds `identity_fence_runner_ref`, `registry_observer_ref`, `action_ref`, and `identity_fence_receipt_ref`. Only its strict single-value stdout projection may select the installed root; descriptor/receipt containment checks reject observer/profile equality or location inside source/TELOS/runtime/handoff/selected cache.

It then authenticates both manifests and launches exactly one manifest-named installed driver as `process.execPath <installed-root>/tests/test-lifecycle-install.mjs --installed-driver --source-root <source-root> --installed-root <installed-root> --expected-source-manifest-ref <source-ref> --expected-installed-manifest-ref <installed-ref> --expected-identity-fence-runner-ref <runner-ref> --expected-registry-observer-ref <observer-ref> --expected-identity-fence-receipt-ref <receipt-ref> --authorized-plan-grant <same-file> --telos-eye-root <same-root> --expected-telos-eye-root-ref <same-independent-root-ref> --authorization-bootstrap <same-packet> --expected-authorization-bootstrap-ref <same-independent-packet-ref>`, with installed-root cwd and `shell: false`. The installed driver reauthenticates root/packet/raw grant/registry, exact descriptors/receipt signature/bindings, and both manifests before spawning anything. It derives ordinary tests exactly once, supplies the same five authorization inputs to the installed core golden, and invokes its own authenticated manifest entry once as `--self-check` with manifest, runner, observer, receipt, grant, root, and bootstrap bindings. Self-check accepts only those closed flags, reauthenticates them, requires `import.meta.url` to be the manifest-named self file, recomputes itself/manifest, emits one `LIFECYCLE_INSTALL_SELF_CHECK_OK`, and cannot recurse or spawn.

After that single child self-check, the authenticated installed driver runs skill discovery, hook loading, CLI help, and the three-disjoint-directory demo once each. Its only stdout is `canonicalize(driver_result) + "\n"`; the closed Task 1 result records grant/candidate/Eye-root/runner/observer/receipt refs, exact test paths/counts, auxiliary counts `{ skill_discovery: 1, hook_load: 1, cli_help: 1, demo: 1 }`, and `total_child_process_count === ordinary_test_count + 5`; stderr is empty. Duplicates, omissions, unexpected paths, receipt/ref drift, or count drift fail. Tests invoke self-check with a spawn recorder and recursion sentinel and require zero descendants, then run the driver and assert every ordinary test once plus one bounded self-check. Step 8 remains preflight-only and creates no lifecycle evidence/proof.

The owning install test drives the three operator actions as separate child processes against an authenticated test fence service whose descriptor is explicitly `synthetic-test` and therefore product-ineligible. It records one request/receipt per process and proves independent connection/worker/nonce/fence ownership. Negatives replace or rename/restore observer/profile between calls and during blocked execution, overflow the namespace watch, leave a late child, replay/swap receipts, alter consumed identity, use wrong service peer/image/key/backend, profile alias/containment, same-byte filename/link substitution, grouped actions, caller overrides, or a PATH shim. Each fails at the affected transaction, never starts later add, leaves its marker absent, and creates no lifecycle evidence. Separately, a gated Linux and Windows integration matrix must exercise the real protected contracts; synthetic service success can never set `product_handoff_eligible: true` or generate the production final vector.

Create `scripts/lifecycle-installation.mjs` and extend the production controller with `recordInstallationAndRetrospective({ sourceRoot, authorizedPlanGrantPath, recordedAt }): Promise<{ proof_ref, retrospective_decision_ref }>`. This is the first and only production retrospective route. It creates an unexported `RETROSPECTIVE_ROUTE` capability inside the installation/controller closure; no generic/public `recordRetrospective` method is added. The method accepts no Eye-root path/bytes/ref, installed-metadata path/body, lifecycle ID, source commit ref, evidence refs/proof ref, manifests, command result, executable/observer/environment override, or prepared transcript from the caller. One tokenized critical section owns the entire live observation, proof materialization, and retrospective decision publication; no intermediate proof ref is returned or accepted by another call. Its order is total. First, perform fresh anchored replay/genesis verification, require stage `iliad-retrospective`, require `replay.accepted_implementation_root === replay.effective_implementation_root`, resolve only that exact accepted implementation plus its tree/raw/Git closure through the verified store, and derive lifecycle/profile/target/trust/stored-grant/root origin/bytes/ref only from replay plus the controller's fresh `ProductionTrustAnchor`; re-lstat/re-read/re-hash that anchor. Second, stable-read and canonical-authenticate `authorizedPlanGrantPath`, require exact deep body/ref equality with the stored grant, reject any second valid same-scope grant, require `sourceRoot === replay.target`, require grant profile/target/task/trust/registry equality, derive the checkout's canonical current Git object ref, require it to equal that accepted implementation's `commit_ref`, and prove a clean stable source inventory whose six-root bytes equal the accepted implementation tree and captured Git root-tree map. Forged/stale/alternate grants, caller root evidence, source/commit/worktree/implementation-tree/Git-object drift, or any mismatch fail here with zero child processes and zero persistence.

Third, and only then, resolve the exact closed `identity_fence_runner`, `registry_observer`, and `plugin-list` action through the stored bootstrap-authenticated registry; require their canonical refs to equal replay/genesis bindings and reject containment/alias/profile violations before IPC. Open one fresh authenticated connection to the root/Administrator-owned endpoint, verify its peer/service identity, create one fresh 32-byte canonical-base64url nonce, and send only the bounded canonical request ref/body containing authenticated bootstrap/grant/registry/runner/observer/action refs. Node supplies no executable/profile path, argv, environment, or command. The protected service independently reauthenticates those bodies and executes the action under the registered host contract. Accept only one closed canonical signed `dfm.identity-fence-receipt.v1`; apply the shared strict signature decoder and verify with the registry-pinned receipt key, then require exact nonce/request/action refs, service image/platform contract, descriptor-equal source and consumed observer/profile identities/raw refs, supported execution/exposure methods, `fence_armed: true`, zero namespace events, no overflow, `process_tree_empty: true`, and exact argv/environment/cwd/status/signal/stdout/stderr bytes/counts/refs. A transient rename/restore, watch overflow, late child, replayed/duplicate receipt, signed rejection, wrong key/peer/image/backend, or any mismatch fails before stdout parse, driver, or persistence. Defense-in-depth pathname restats cannot replace receipt proof.

Parse only the accepted receipt stdout, derive the canonical semantic projection, require exactly one enabled `multi-model-seats@multi-model-local` version `0.6.0`, and derive the installed cache only from that record. Fourth, record stable source/cache identities and exact `installed_cache_binding`, rerun full source/cache inventory, and spawn the one manifest-authenticated installed driver with exact runner/observer/receipt plus root/bootstrap/grant bindings. From these inputs deterministically persist both manifests, cache binding, grant/root raw evidence, the signed identity-fence receipt, receipt-derived command raw/projection/evidence objects, one installation-test evidence, and one installation proof with fresh `replay.lifecycle_id`. Driver bindings use exact parsed grant, anchor root, runner, observer, and receipt refs; grant raw evidence hashes canonical-plus-LF publication bytes and root evidence equals retained anchor bytes/ref/origin. Reread all captured bytes and run `validateInstallationProofResolved(authenticatedScanner, ...)` using only the controller's retained `AuthenticatedGenesis` scanner; fresh anchored replay must preserve state/root/decision count, source/cache identity, and all authorization/receipt bindings. Without releasing the lock or exposing/accepting a proof ref, construct/sign/publish through the private capability the sole retrospective node with the accepted/effective implementation ref and direct evidence `[proofRef]`, replay closed state, then return both refs. A signer failure may leave only unreachable content-addressed evidence; retry reruns the live service transaction with a new nonce/receipt. Later replay/export/detached use captured bytes and verify the receipt without requiring the service. Caller retrospective/proof/evidence/root/bootstrap/runner/observer/receipt/command/environment/profile overrides fail before IPC or persistence. Only the isolated synthetic-test controller retains a separate permanently ineligible retrospective path.

Create `tests/lifecycle-production-fixture.mjs` with two explicit modes and no silent fallback. `--synthetic-contract` is deterministic and permanently product-ineligible: it may create a temporary test fence service, observer/profile, adapter doubles, root/bootstrap/registry, source/cache/runtime/handoff trees, and fixed keys/timestamps solely to exercise request/receipt validation, proof materialization, replay, and negative cases. Its registry/service/trust class is `synthetic-test`; production constructors/export/detached mode reject it and it can never generate the tracked production vector. `--native-production` is the owning product-eligibility integration. It accepts only the four external root/bootstrap path/ref flags and no helper/service/profile/adapter override, resolves the exact fixed canonicalizer/detector/validator/detached/four-adapter paths plus protected runner/observer/profile from the authenticated registry, requires `linux-sealed-execveat-mounted-profile.v1` or `windows-locked-image-profile.v1`, and uses the already-running protected service. It never creates or substitutes those identities. If the protected backend or required deterministic provider test tenancy is unavailable, it exits `NATIVE_PRODUCTION_MATRIX_PENDING`; that explicitly blocks production-vector write mode and any product-handoff claim while leaving lower-level synthetic conformance tests reportable.

Native mode creates only disjoint governed source/cache/runtime/handoff data, copies the six package roots, commits with fixed metadata, and drives the real controller/router plus exact fixed adapters and fresh Eye records to `iliad-retrospective`. The one `plugin-list` action is executed by the protected service and persisted with its signed receipt; no Node observer/runner spawn, PATH lookup, helper copy, or injection seam exists. It asserts descriptor and receipt refs, source/consumed observer/profile identities, action/output bytes, cache projection, proof, retrospective decision, fresh anchored replay, production export, and detached verification. Linux and native Windows jobs each test their contract; WSL-to-Windows, UNC/SMB, script/shebang observers, missing ownership/capability, and synthetic receipts are product-ineligible. Private key/provider credentials remain only in external signer/adapter boundaries and are never persisted or reported.

The native positive calls only `controller.recordInstallationAndRetrospective(...)`, verifies the returned proof/decision linkage, independently retains the returned proof ref, discards every in-memory object, creates a fresh root/bootstrap authorization brand, replays, requires the retained ref to equal the retrospective decision's freshly resolved singleton proof ref, exports, removes source/cache, and verifies through the fixed detached loader using retained bootstrap/launcher/verifier/root refs plus that independently retained installation-proof ref; success from captured bytes alone emits literal `product_handoff_eligible: true`. Synthetic mode must produce false. Negative tables cover every ambient/caller proof route plus forged/replayed/duplicate/wrong-action receipts; noncanonical receipt signature variants; wrong service peer/image/key/backend; source/consumed observer or profile mismatch; transient rename/restore; watch overflow; late child; WSL/UNC/SMB; same-byte alternate filename/hardlink/symlink/alias; PATH shim; malformed output; descriptor/ref/proof/grant/tree/manifest drift; and copied artifacts. Pre-service rejection has zero service/driver/provider/signer/persistence; post-receipt rejection has exactly one recorded service action and no driver/provider/signer/persistence. Resolver/export/detached rejection changes no decision/checkpoint/output. Only successful native matrix mode owns the product integration claim; the optional live operator run does not substitute for it.

Task 11 adds these four production CLI spellings. The save command has no payload, boundary, checkpoint, lifecycle, candidate, stage, seat, or role flag; load/precompact accept only the six shown flag/value pairs (`--runtime`, `--expected-lifecycle-id`, and the four root/bootstrap path/ref flags) and are read-only:

```bash
node "<plugin-root>/scripts/lifecycle-cli.mjs" save-lifecycle-round-checkpoint --dir <existing-production-runtime> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" record-installation --dir <existing-production-runtime> --source <exact-governed-source> --authorized-plan-grant <canonical-signed-file> --recorded-at <iso-date-time> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/checkpoint.mjs" lifecycle-round-load --runtime <existing-production-runtime> --expected-lifecycle-id <id> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>
node "<plugin-root>/scripts/checkpoint.mjs" lifecycle-round-precompact --runtime <existing-production-runtime> --expected-lifecycle-id <id> --telos-eye-root <tracked-public-pem> --expected-telos-eye-root-ref <externally-retained-raw-sha256-ref> --authorization-bootstrap <exact-root-signed-packet> --expected-authorization-bootstrap-ref <externally-retained-raw-sha256-ref>
```

The completed production bundle is verified in a separate fresh process with the exact fixed authorization-loader source byte-asserted by `test-lifecycle-export.mjs`. Root/bootstrap/launcher/verifier refs are retained from authorization and the exact clean committed plugin source before bundle selection, and `INSTALLATION_PROOF_REF` is retained from the successful under-lock transition plus fresh anchored replay; none is recomputed from a supplied path or bundle:

```bash
DFM_DETACHED_AUTHORIZATION_LOADER_SOURCE='import assert from "node:assert/strict";
import { createHash, createPublicKey, verify } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, normalize, relative } from "node:path";
const REF = /^sha256:[0-9a-f]{64}$/;
const rawRef = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const exactKeys = (value, keys, label) => assert.deepEqual(Object.keys(value ?? {}).sort(), [...keys].sort(), label);
const canonical = (value) => {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") { assert.equal(Number.isFinite(value), true); return JSON.stringify(value); }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  assert.equal(value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype, true);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
};
const canonicalRef = (value) => rawRef(Buffer.from(canonical(value), "utf8"));
const decodeCanonicalBase64url = (value, length = null) => {
  assert.equal(typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value) && !value.includes("=") && !/\s/.test(value), true);
  const bytes = Buffer.from(value, "base64url");
  assert.equal(bytes.toString("base64url"), value);
  if (length !== null) assert.equal(bytes.length, length);
  return bytes;
};
const stableBytes = (path, maxBytes) => {
  assert.equal(isAbsolute(path) && normalize(path) === path && path.normalize("NFC") === path && realpathSync(path) === path, true);
  const before = lstatSync(path);
  assert.equal(before.isFile() && !before.isSymbolicLink() && before.nlink === 1 && before.size <= maxBytes, true);
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(fd);
    assert.deepEqual([opened.dev, opened.ino, opened.mode, opened.nlink, opened.size], [before.dev, before.ino, before.mode, before.nlink, before.size]);
    const bytes = readFileSync(fd);
    assert.equal(bytes.length, opened.size);
    const after = fstatSync(fd);
    const pathAfter = lstatSync(path);
    assert.deepEqual([after.dev, after.ino, after.mode, after.nlink, after.size, pathAfter.dev, pathAfter.ino, pathAfter.mode, pathAfter.nlink, pathAfter.size], [opened.dev, opened.ino, opened.mode, opened.nlink, opened.size, opened.dev, opened.ino, opened.mode, opened.nlink, opened.size]);
    return bytes;
  } finally { closeSync(fd); }
};
const argv = process.argv.slice(1);
assert.equal(argv.length, 24);
const [bootstrapFlag, bootstrapPath, bootstrapRefFlag, bootstrapRef, launcherFlag, launcherPath, launcherRefFlag, launcherRef, verifierFlag, verifierPath, verifierRefFlag, verifierRef, bundledVerifierFlag, bundledVerifierPath, modeFlag, mode, bundleFlag, bundlePath, proofFlag, proofRef, rootFlag, rootPath, rootRefFlag, rootRef] = argv;
assert.deepEqual([bootstrapFlag, bootstrapRefFlag, launcherFlag, launcherRefFlag, verifierFlag, verifierRefFlag, bundledVerifierFlag, modeFlag, bundleFlag, proofFlag, rootFlag, rootRefFlag], ["--authorization-bootstrap", "--expected-authorization-bootstrap-ref", "--launcher", "--expected-launcher-ref", "--verifier", "--expected-verifier-ref", "--bundled-verifier", "--mode", "--bundle", "--expected-installation-proof-ref", "--telos-eye-root", "--expected-telos-eye-root-ref"]);
assert.equal(mode, "production");
for (const ref of [bootstrapRef, launcherRef, verifierRef, proofRef, rootRef]) assert.match(ref, REF);
assert.equal(launcherPath, "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs");
assert.equal(verifierPath, "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs");
assert.equal(isAbsolute(bundlePath) && normalize(bundlePath) === bundlePath && bundlePath.normalize("NFC") === bundlePath, true);
assert.equal(bundledVerifierPath, `${bundlePath}/lifecycle-detached-verify.mjs`);
assert.equal(isAbsolute(rootPath) && normalize(rootPath) === rootPath && rootPath.normalize("NFC") === rootPath, true);
const bundleContains = (candidate) => { const rel = relative(bundlePath, candidate); return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel)); };
assert.equal(bundleContains(rootPath) || bundleContains(bootstrapPath) || bundleContains(launcherPath) || bundleContains(verifierPath), false);
const rootBytes = stableBytes(rootPath, 65536);
assert.equal(rawRef(rootBytes), rootRef);
const rootKey = createPublicKey(rootBytes);
const packetBytes = stableBytes(bootstrapPath, 1048576);
assert.equal(rawRef(packetBytes), bootstrapRef);
const packet = packetBytes.toString("ascii").match(/^([A-Za-z0-9_-]+)\n([A-Za-z0-9_-]{86})\n$/);
assert.ok(packet);
const payloadBytes = decodeCanonicalBase64url(packet[1]);
const packetSignature = decodeCanonicalBase64url(packet[2], 64);
assert.equal(verify(null, Buffer.concat([Buffer.from("telos.dfm-authorization-bootstrap.v1\0", "utf8"), payloadBytes]), rootKey, packetSignature), true);
const payloadRaw = new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes);
const payload = JSON.parse(payloadRaw);
assert.equal(payloadRaw, canonical(payload));
exactKeys(payload, ["authority_record", "bootstrap_version", "eye_trust", "plan", "profile_ref", "reviewed_head", "target", "transport_registry"], "bootstrap payload keys");
assert.equal(payload.bootstrap_version, "telos.dfm-authorization-bootstrap.v1");
assert.match(payload.profile_ref, REF);
assert.match(payload.reviewed_head, /^git:(?:[0-9a-f]{40}|[0-9a-f]{64})$/);
assert.deepEqual(payload.target, { kind: "checkout", path: "/home/colchis/plugins/multi-model-seats", task_range: "1-11" });
for (const name of ["authority_record", "eye_trust", "plan", "transport_registry"]) {
  exactKeys(payload[name], ["canonical_ref", "raw_ref", "realpath"], `${name} descriptor keys`);
  assert.match(payload[name].raw_ref, REF);
  assert.match(payload[name].canonical_ref, REF);
}
const readCanonicalDescriptor = (descriptor) => {
  const bytes = stableBytes(descriptor.realpath, 1048576);
  assert.equal(rawRef(bytes), descriptor.raw_ref);
  const raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value = JSON.parse(raw);
  assert.equal(raw, `${canonical(value)}\n`);
  assert.equal(canonicalRef(value), descriptor.canonical_ref);
  return value;
};
const authority = readCanonicalDescriptor(payload.authority_record);
const trust = readCanonicalDescriptor(payload.eye_trust);
const registry = readCanonicalDescriptor(payload.transport_registry);
exactKeys(authority, ["action", "authority_version", "eye_trust_ref", "provider_transport_registry_ref", "reviewed_head", "scope", "signature", "status", "subject_ref"], "authority keys");
assert.equal(authority.action, "grant-implementation");
assert.equal(authority.authority_version, "telos.eye-implementation-authority.v1");
assert.equal(authority.status, "GRANTED");
assert.equal(authority.reviewed_head, payload.reviewed_head);
assert.equal(authority.eye_trust_ref, payload.eye_trust.canonical_ref);
assert.equal(authority.provider_transport_registry_ref, payload.transport_registry.canonical_ref);
assert.equal(authority.subject_ref, payload.plan.canonical_ref);
assert.deepEqual(authority.scope, { profile_ref: payload.profile_ref, target_kind: "checkout", target_path: "/home/colchis/plugins/multi-model-seats", task_range: "1-11" });
exactKeys(authority.signature, ["algorithm", "key_id", "value"], "authority signature keys");
assert.equal(authority.signature.algorithm, "ed25519");
const { signature: authoritySignature, ...unsignedAuthority } = authority;
assert.equal(verify(null, Buffer.from(canonical(unsignedAuthority), "utf8"), rootKey, decodeCanonicalBase64url(authoritySignature.value, 64)), true);
exactKeys(trust, ["delegation", "eye_trust_version", "root", "trust_class"], "trust keys");
assert.equal(trust.eye_trust_version, "dfm.eye-authority-trust.v1");
assert.equal(trust.trust_class, "production");
exactKeys(trust.root, ["key_id", "public_key_der_base64"], "trust root keys");
const trustRootDer = Buffer.from(trust.root.public_key_der_base64, "base64");
assert.equal(trustRootDer.toString("base64"), trust.root.public_key_der_base64);
assert.deepEqual(trustRootDer, rootKey.export({ type: "spki", format: "der" }));
assert.equal(trust.root.key_id, authoritySignature.key_id);
if (trust.delegation !== null) {
  exactKeys(trust.delegation, ["delegate", "delegation_version", "issued_at", "scope", "signature"], "delegation keys");
  const { signature: delegationSignature, ...unsignedDelegation } = trust.delegation;
  exactKeys(delegationSignature, ["algorithm", "key_id", "value"], "delegation signature keys");
  assert.equal(delegationSignature.algorithm, "ed25519");
  assert.equal(delegationSignature.key_id, trust.root.key_id);
  assert.equal(verify(null, Buffer.from(canonical(unsignedDelegation), "utf8"), rootKey, decodeCanonicalBase64url(delegationSignature.value, 64)), true);
}
exactKeys(registry, ["adapter_validator", "artifact_version", "canonicalizer", "credential_detector", "detached_launcher", "detached_verifier", "identity_fence_runner", "profile_ref", "registry_observer", "routes", "target"], "registry keys");
assert.equal(registry.artifact_version, "dfm.production-transport-registry.v1");
assert.equal(registry.profile_ref, payload.profile_ref);
assert.deepEqual(registry.target, payload.target);
exactKeys(registry.detached_launcher, ["helper_version", "plugin_target_realpath", "source_raw_ref", "source_realpath"], "launcher descriptor keys");
assert.equal(registry.detached_launcher.helper_version, "dfm.detached-launcher.v1");
assert.equal(registry.detached_launcher.source_realpath, "/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-launch-v1.mjs");
assert.equal(registry.detached_launcher.plugin_target_realpath, launcherPath);
assert.equal(registry.detached_launcher.source_raw_ref, launcherRef);
exactKeys(registry.detached_verifier, ["helper_version", "plugin_target_realpath", "source_raw_ref", "source_realpath"], "verifier descriptor keys");
assert.equal(registry.detached_verifier.helper_version, "dfm.detached-verifier.v1");
assert.equal(registry.detached_verifier.source_realpath, "/home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-verify-v1.mjs");
assert.equal(registry.detached_verifier.plugin_target_realpath, verifierPath);
assert.equal(registry.detached_verifier.source_raw_ref, verifierRef);
const launcherBytes = stableBytes(launcherPath, 1048576);
assert.equal(rawRef(launcherBytes), launcherRef);
const launcher = await import(`data:text/javascript;base64,${launcherBytes.toString("base64")}`);
assert.equal(typeof launcher.runDetachedLauncher, "function");
const status = await launcher.runDetachedLauncher(argv.slice(8));
assert.equal(Number.isSafeInteger(status) && status >= 0 && status <= 255, true);
process.exitCode = status;
'
readonly DFM_DETACHED_AUTHORIZATION_LOADER_SOURCE
test "sha256:$(printf '%s' "$DFM_DETACHED_AUTHORIZATION_LOADER_SOURCE" | sha256sum | cut -d' ' -f1)" = "sha256:f4519ec0f9e809cdaa8c38eb804823af732ea7137b5919d6e57b6861a2f56409"
: "${BUNDLE_DIR:?set to the independently retained normalized absolute production bundle directory returned by export}"
readonly BUNDLE_DIR
readonly BUNDLED_VERIFIER_PATH="$BUNDLE_DIR/lifecycle-detached-verify.mjs"
node --input-type=module --eval "$DFM_DETACHED_AUTHORIZATION_LOADER_SOURCE" -- --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF" --launcher "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs" --expected-launcher-ref "$DETACHED_LAUNCHER_RAW_REF" --verifier "/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs" --expected-verifier-ref "$DETACHED_VERIFIER_RAW_REF" --bundled-verifier "$BUNDLED_VERIFIER_PATH" --mode production --bundle "$BUNDLE_DIR" --expected-installation-proof-ref "$INSTALLATION_PROOF_REF" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF"
```

`save-lifecycle-round-checkpoint` returns only the derived checkpoint ref. Atomic `record-installation` returns only `{ proof_ref, retrospective_decision_ref }` after the internally constructed retrospective decision is durable. The final production parser has no `record-retrospective` command or evidence/proof selection flag.

From Task 8 onward, production `recordRetrospective` is absent and `record-retrospective` is always an unknown command; Task 11 does not revive either. Only `recordInstallationAndRetrospective` may use the newly introduced private retrospective capability, and only while holding the same lock that performed live observation and derived the proof. Fresh-process replay derives closure only from that retrospective decision's direct singleton evidence and repeats pure resolved validation. Missing, ambient-only, generic-evidence, copied cross-lifecycle, stale, or second refs are invalid but never caller-selectable. The isolated synthetic controller retains a separate test-only retrospective path without installation proof; it can close only a permanently ineligible synthetic runtime and can never satisfy production replay/export.

During this Task 11 failure-first step, modify `tests/test-lifecycle-export.mjs`: retain all Task 9 synthetic/stub-separation coverage, replace the assertions that the production stub must remain disabled with the deferred production-activation assertions listed in Task 9, and require the still-disabled stub/verifier to fail those new tests. No production assertion is silently skipped.

- [ ] **Step 2: Run the packaging test and confirm it fails**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs --source-only /home/colchis/plugins/multi-model-seats --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
```

Expected: failures for missing skill/version, missing strict checkpoint behavior, and the still-disabled production export/verifier. The newly created uncommitted Task 11 test files make source-only installation validation fail earlier with explicit `SOURCE_INVENTORY_NOT_CLEAN` because their paths are not yet in `git ls-files`; this is the intended fail-closed TDD result, not an “incomplete manifest” claim. Exact clean source-inventory success is tested only from the committed snapshot in Step 7A.

- [ ] **Step 3: Add the lifecycle skill**

Create `skills/daedalus-family-lifecycle/SKILL.md` with frontmatter name/description and this enforced workflow:

1. Require an approved brainstorm and exact requirement root.
2. Use `superpowers:writing-plans` for Daedalus authorship, canonicalize and `ingest-artifact` the exact candidate, call `prepare-seat-request` for Daedalus with that singleton output and redirect its sole canonical line to the caller request file, then record `plan-draft` through `invoke-seat --request <request-file> --output-artifact-ref <candidate-ref>`. Every Icarus feasibility/P1 call likewise uses `prepare-seat-request` with empty output refs so its signed public context contains exact candidate and governed-prefix bytes.
3. Request blind Grok/Gemini plan reviews through their seat skills; record `P2` only when both independently pass the same descendant root.
4. Stop for The Eye's exact-root plan authorization.
5. Use `superpowers:executing-plans` or `superpowers:subagent-driven-development`; after implementation, publish the clean exact governed checkout only through the scanner-owned `commit-scanned` transaction and call no-argument `capture-implementation-snapshot`. Use only its returned implementation ref, call `prepare-seat-request` with that singleton output, then record `code-draft` through `invoke-seat --request <request-file> --output-artifact-ref <implementation-ref>`. Direct generic implementation/tree/raw ingestion is ineligible. Every Daedalus architecture/C1 call uses `prepare-seat-request` with empty outputs and receives the full captured implementation/manifest/source context.
6. Use `superpowers:requesting-code-review` and `superpowers:receiving-code-review` for cold Grok/Gemini code review; record `C2` only when both independently pass the same descendant root.
7. Use `superpowers:verification-before-completion`, then call `verify-disk`; document that it re-derives/persists the exact manifest and command evidence, binds them through the disk decision's direct evidence refs, uses the implementation ref as its sole input, and uses no output or ambient artifact selection. Use `superpowers:finishing-a-development-branch` only after disk truth and The Eye acceptance.
8. State exactly: `every non-pass returns to Daedalus`; forbid automatic caps and seat substitution; state that model consensus is not authority.
9. After each Daedalus/Icarus plan or code review-fix round, state that only completion of both required P1/C1 peers creates entitlement, that its boundary selects the pair's exact Icarus operation in either legal order, and that only the fresh controller derives, signs, and publishes the exact minimal `lifecycle-round` payload: stage-discriminated candidate raw/canonical identity, exact authority/predecessor/round-boundary triple, round ID, stable findings with status/evidence/operation-bound disposition, current stage/owner, and next action. A partial pair cannot save or start cold review. Open findings must resume at Daedalus; only an all-closed completed pair with bijective checkpoint coverage may name Grok/Gemini cold review, and both cold seats bind that same checkpoint. Mechanics may cold-load the frozen projection but notes/messages never enter it. Missing/stale payload fails precompact and cold review does not begin.
10. Document every quoted production CLI command from Task 8 plus Task 11's no-payload `save-lifecycle-round-checkpoint`, read-only `lifecycle-round-load`/`lifecycle-round-precompact`, atomic post-init `record-installation`, and fixed-stdlib-loader detached invocation; every production line includes all four external root/bootstrap path/ref values. State that production `record-retrospective` never exists. Include `capture-implementation-snapshot`, `prepare-seat-request`, ordinary `--request`, stage-dependent nonrepeatable `--output-artifact-ref`, recovery/mutation `--instruction`, then the quoted demo command with separate checkout/runtime/handoff directories. Explain exact framing/output rules, replay-derived context, checkpoint entitlement, and the one under-lock installation route. State that installation uses one signed consumed-identity service receipt per action, Node never spawns runner/observer paths, synthetic receipts are product-ineligible, bootstrap/launcher/verifier/root validation precedes bundle reads, and every Eye command needs separate signed prefix authority.
11. Map seats explicitly: Claude is Daedalus and GPT is Icarus for P1/C1; Grok and Gemini are both required and independent for P2/C2; the exported TELOS council remains required Claude/Agy/Codex and advisory Grok/Gemini.

- [ ] **Step 4: Update metadata and generated-project hygiene**

Change plugin version from `0.5.2` to `0.6.0`, add `Merkle-DAG lifecycle` to the description/long description, and add `Run the Daedalus family lifecycle for this feature.` to `interface.defaultPrompt`.

Add this exact line to the generated `GITIGNORE` string in `scripts/bootstrap.mjs`:

```gitignore
.multi-model-seats/lifecycle/
```

- [ ] **Step 5: Implement strict lifecycle-round checkpointing**

Add explicit read-only `lifecycle-round-load` and `lifecycle-round-precompact` argv modes to `scripts/checkpoint.mjs`; the journal directory is exactly `<runtime>/checkpoints/lifecycle-round` and existing-mode schema/output remains unchanged. There is deliberately no `lifecycle-round-save` argv mode, help entry, or standalone writer. Keep the atomic lifecycle-round append function as a named module import used only by `lifecycle-controller.mjs`; it accepts the controller-derived verified prefix/payload and has no payload parser or authority of its own. A spawned `node scripts/checkpoint.mjs lifecycle-round-save ...` must fail as unknown mode before reading or changing the runtime. Add `deriveRequiredRoundBoundaries`, `verifyLifecycleRoundPrefix`, terminal `verifyLifecycleRoundCoverage`, `deriveIcarusRoundContext`, and the replay-owned one-use `consumeIcarusRoundContext` to `scripts/lifecycle-replay.mjs`; wire under-lock context consumption/finalization through the controller while keeping the Task 6 adapter context-independent, and wire full coverage through controller, both export wrappers, and detached verification. Before each Icarus P1/C1 invocation, require terminal coverage of all earlier completed-pair boundaries and derive the branded context read-only. After locking, freshly replay and verify the prefix, consume the context immediately before start/CAS, invoke the normal adapter only after the CAS win, and finalize any resolution claims through the replay-owned closure. The Icarus operation alone creates no boundary when its peer is still absent; completing the pair creates exactly one durable boundary without a checkpoint.

Extend the production controller with exact no-argument `saveLifecycleRoundCheckpoint(): Promise<{ checkpoint_ref }>` and route the quoted lifecycle CLI command only to that method. A fresh anchored replay plus the verified checkpoint journal is the complete entitlement: there must be exactly one uncovered required boundary, it must be the tail boundary derived from exactly one completed P1/C1 peer pair and select that pair's unique fully settled Icarus operation/decision plus its exact completion decision, all source/disposition bindings must validate, and replay must expose no pending operation. A legal Icarus-first partial pair, a Daedalus-first partial pair, zero boundaries, or multiple uncovered boundaries fails. No process-local capability from the invoking process is required or accepted; kill the process immediately after the pair-completing terminal, start a fresh lifecycle CLI process, and the signed disk prefix must still authorize exactly one save. Role strings, environment variables, hook input, mechanics, caller payloads, caller refs, and arbitrary boundary objects confer no authority and are rejected as unknown input.

Before lock, signer, or temp activity, save performs read-only anchored replay/prefix verification and derives the one exact six-field payload from that sole completed-pair boundary; it deliberately does not demand full bijection before appending the missing checkpoint. After acquiring its tokenized lock it freshly replays and verifies both journals again, requiring byte identity of lifecycle/config/root/decision/operation/checkpoint-prefix/completed-pair/boundary/payload inputs before atomic publication. It signs and calls the import-only append primitive through Task 3's checkpoint journal CAS, then verifies full coverage. A concurrent winner leaves the loser with no uncovered boundary; the loser returns a duplicate/no-entitlement error and never rebases. Load verifies the complete signed prefix, duplicated predecessor boundary, required `round_boundary_ref`, stage-discriminated P1/C1 candidate identity, pair completion, authority, finding semantics, current owner/stage, and next-action table cold, then returns only the frozen six-field payload. Precompact performs the same prefix verification and succeeds only for its exact current snapshot; any transition to cold review additionally requires terminal full coverage. P2/C2 controller initial/resume and both export wrappers require full coverage, derive the exact checkpoint ref, and require both cold seats to bind it. Caller input cannot select a checkpoint.

Update the Task 10 synthetic demo and its test during this task: after each completed P1/C1 peer pair, discard the pair-completing controller instance, construct a fresh synthetic-test controller from the existing test harness capability, and call its no-argument `saveLifecycleRoundCheckpoint()` to re-derive and append the sole boundary before any Grok/Gemini call. Exercise one Daedalus-first and one Icarus-first pair; the first operation alone creates no boundary in either order and pair completion creates exactly one. Require full coverage before each cold gate and before `exportSyntheticHandoffBundleForTest`; zero checkpoints remain valid only at Task 10's pre-Task-11 commit, not in the final `0.6.0` suite. The production kill-and-fresh-CLI test separately proves cross-process durability with the explicit external root.

Update `skills/context-checkpoint/SKILL.md` and `hooks/hooks.json` so an explicit lifecycle session uses strict load at session start and strict precompact before rotation. Production invocations pass only runtime path, expected lifecycle ID, and the four separately configured root/bootstrap path/ref flags; they authenticate both origins/refs and exact packet bodies before runtime state and never derive one input from another or the runtime. Hooks are read-only with respect to decisions/checkpoints and fail closed on missing/wrong inputs or stale/invalid state. Mechanic notes/messages remain outside payload. Existing non-lifecycle hooks remain unchanged.

After checkpoint coverage and resolved installation-proof validation pass, replace Task 9's exporter stub and activate the already-final immutable detached verifier by supplying its required independently retained installation-proof ref; do not edit or recopy either detached helper. Enable the private production export factory only behind fresh root/bootstrap-anchored replay, full boundary/checkpoint bijection, exact candidate identity, exact same-runtime proof including a native protected-service receipt, closed state, and exact checkout/Git closure. The unchanged verifier admits detached production mode only with the same checks from bundle bytes plus the fixed authorization-loader invocation; bootstrap/launcher/verifier/root argv closure, refs, path/type/link/containment checks occur before a bundle entry. Literal production eligibility is unreachable for synthetic receipts or before every gate.

Implement `scripts/generate-lifecycle-final-vectors.mjs` with exactly two modes. `--write --plugin-root <exact-root> --signer-command <absolute-external-command>` owns the public declaration plus complete three-target corpus. It invokes the signer's `--describe-public` itself with `shell: false`, empty stdin, a fixed minimal environment, bounded output, and timeout; validates one canonical closed declaration; and keeps it in memory. Every signer response and every grant/delegation/Eye/decision/operation/checkpoint/receipt/detached/vector signature is passed through the one strict `decodeCanonicalEd25519Signature` path before verification or publication. The generator repeats deterministic signing, builds all outputs in a sibling temporary directory, validates every ref/closure/negative, then atomically publishes the complete set. Empty/padded/whitespace/standard-alphabet/wrong-length/tail-alias/mutated signature output, public-key drift, private material, extra output, nonzero exit, signer under plugin root, unknown flags, or residue leaves all targets untouched. `--check` is signer-free and source-read-only, reconstructs and byte-compares the corpus, and fails stale output. Tests table the universal malformed-signature corpus across every envelope kind and assert the generator contains no tolerant decoder or key generation for committed literals.

Only after every Task 11 checkpoint, replay/controller integration, protected-service installation, export, detached verifier, successful native-production fixture on the target platform, and fixed acyclic-fixture source edit is complete may write mode generate the public declaration and three targets. Tracked literals use the separate acyclic vector lifecycle and embed exact current launcher/verifier refs, the independently retained installation-proof ref, both checkpoint identities, the identity-fence runner/observer/receipt refs, fixture manifest/bundle root, and distinct implementation/tree roots; generated paths remain excluded from their own closure. Negatives cover plan/implementation framing, grant, every signature envelope, checkpoint linkage, receipt nonce/action/service/source-consumed identities/events/overflow/process-tree/output, acyclic manifest, launcher/verifier/bootstrap/root/proof ref/path, same-byte alternate filename/hardlink/symlink/alias/replacement, and bundle root. Verify through the fixed authorization loader using retained bootstrap/launcher/verifier/root refs plus the independently retained installation-proof ref, and require it to equal the vector retrospective decision's resolved singleton proof ref before bundle selection. Any source edit invalidates generation and requires the native prerequisite plus regeneration/check. Task 3's independent vector remains unchanged.

Run the only authoritative write command before Step 6:

```bash
node /home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs --native-production --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/scripts/generate-lifecycle-final-vectors.mjs --write --plugin-root /home/colchis/plugins/multi-model-seats --signer-command "$VECTOR_FIXTURE_SIGNER_COMMAND"
node /home/colchis/plugins/multi-model-seats/scripts/generate-lifecycle-final-vectors.mjs --check --plugin-root /home/colchis/plugins/multi-model-seats
```

Expected: the generator's bounded in-memory signer-description validation publishes a public-only declaration plus all three generated targets only after the entire set is canonical and mutually consistent; check mode is byte-identical and source-read-only. Malformed signer output leaves all four targets untouched, and the baseline credential/private-key detector reports zero matches.

- [ ] **Step 6: Run the pre-commit source battery**

```bash
[[ "$(declare -p DETACHED_LAUNCHER_RAW_REF)" == "declare -rx "* ]]
[[ "$(declare -p DETACHED_VERIFIER_RAW_REF)" == "declare -rx "* ]]
cmp -s /home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-launch-v1.mjs /home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-launch.mjs
cmp -s /home/colchis/Projects/TELOS/integrations/detached-verification/daedalus-family-v1/lifecycle-detached-verify-v1.mjs /home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-adapter-grammar.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-provider-transport.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs
node /home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs --synthetic-contract
node /home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs --native-production --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-final-vectors.mjs
node /home/colchis/plugins/multi-model-seats/scripts/generate-lifecycle-final-vectors.mjs --check --plugin-root /home/colchis/plugins/multi-model-seats
```

Expected: every non-inventory source and synthetic-contract test passes, and the gated native Linux/Windows production contract succeeds before vector write/commit. `NATIVE_PRODUCTION_MATRIX_PENDING` is a hard product-vector blocker, not a skip. The strict clean physical-inventory test is deferred until the exact generated-vector/source snapshot is committed.

- [ ] **Step 7: Commit the packaging change**

```bash
git -C /home/colchis/plugins/multi-model-seats add .codex-plugin/plugin.json hooks/hooks.json records/lifecycle-test-fixtures/v1/acyclic-source records/lifecycle-test-fixtures/v1/vector-signing-public.json records/lifecycle-test-vectors/v1/final-vector.json records/lifecycle-test-vectors/v1/final-detached-bundle records/lifecycle-test-vectors/v1/final-negative-bundles scripts/bootstrap.mjs scripts/checkpoint.mjs scripts/generate-lifecycle-final-vectors.mjs scripts/lifecycle-adapter-grammar.mjs scripts/lifecycle-artifacts.mjs scripts/lifecycle-cli.mjs scripts/lifecycle-controller.mjs scripts/lifecycle-credential-gate.mjs scripts/lifecycle-demo.mjs scripts/lifecycle-detached-launch.mjs scripts/lifecycle-detached-verify.mjs scripts/lifecycle-export-internal.mjs scripts/lifecycle-export.mjs scripts/lifecycle-installation.mjs scripts/lifecycle-replay.mjs scripts/lifecycle-synthetic-test.mjs skills/context-checkpoint/SKILL.md skills/daedalus-family-lifecycle/SKILL.md tests/lifecycle-production-fixture.mjs tests/test-lifecycle-adapter-grammar.mjs tests/test-lifecycle-artifacts.mjs tests/test-lifecycle-checkpoint.mjs tests/test-lifecycle-controller.mjs tests/test-lifecycle-credential-gate.mjs tests/test-lifecycle-demo.mjs tests/test-lifecycle-export.mjs tests/test-lifecycle-final-vectors.mjs tests/test-lifecycle-install.mjs tests/test-lifecycle-replay.mjs tests/test-lifecycle-skill.mjs tests/test-lifecycle-synthetic-test.mjs
run_credential_gate /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs "$CREDENTIAL_DETECTOR_RAW_REF" commit-scanned --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --source /home/colchis/plugins/multi-model-seats --package-root .codex-plugin --package-root hooks --package-root records --package-root scripts --package-root skills --package-root tests --message "feat: publish Daedalus family lifecycle skill"
git -C /home/colchis/plugins/multi-model-seats status --short --branch
```

Expected: clean plugin source worktree.

- [ ] **Step 7A: Re-run the complete verification from the clean exact commit**

```bash
test -z "$(git -C /home/colchis/plugins/multi-model-seats status --porcelain --untracked-files=all -- .codex-plugin hooks records scripts skills tests)"
[[ "$(declare -p DETACHED_LAUNCHER_RAW_REF)" == "declare -rx "* ]]
[[ "$(declare -p DETACHED_VERIFIER_RAW_REF)" == "declare -rx "* ]]
test "$DETACHED_LAUNCHER_RAW_REF" = "sha256:$(git -C /home/colchis/plugins/multi-model-seats cat-file blob HEAD:scripts/lifecycle-detached-launch.mjs | sha256sum | cut -d' ' -f1)"
test "$DETACHED_VERIFIER_RAW_REF" = "sha256:$(git -C /home/colchis/plugins/multi-model-seats cat-file blob HEAD:scripts/lifecycle-detached-verify.mjs | sha256sum | cut -d' ' -f1)"
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-provider-transport.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-synthetic-test.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs
node /home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs --synthetic-contract
node /home/colchis/plugins/multi-model-seats/tests/lifecycle-production-fixture.mjs --native-production --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-final-vectors.mjs
node /home/colchis/plugins/multi-model-seats/scripts/generate-lifecycle-final-vectors.mjs --check --plugin-root /home/colchis/plugins/multi-model-seats
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs --source-only /home/colchis/plugins/multi-model-seats --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
test -z "$(git -C /home/colchis/plugins/multi-model-seats status --porcelain --untracked-files=all --ignored=matching -- .codex-plugin hooks records scripts skills tests)"
```

Expected: every test, including synthetic conformance, the gated protected-backend native production materializer/replay/export/detached fixture, clean physical inventory, and final vectors, passes from committed bytes. Native mode may use an independently provisioned deterministic provider test tenancy but no live user workload; unavailable native prerequisites are a hard `NATIVE_PRODUCTION_MATRIX_PENDING` blocker. Any source fix requires regeneration and the complete loop.

Retain both `DETACHED_LAUNCHER_RAW_REF` and `DETACHED_VERIFIER_RAW_REF` as external handoff inputs through Step 9. Do not recompute them from a supplied path/bundle or accept a bundle-selected plugin root.

- [ ] **Step 8: Refresh through the normal plugin path and verify complete source/cache identity**

First select the intended Codex profile already bound by the root-signed registry observer. Desktop Windows may use the UNC marketplace source, while native Kali uses `/home/colchis/plugins`, but the protected execution/profile contract itself rejects WSL-to-Windows interop and UNC/SMB profile exposure; use the registry's matching native Windows or native Linux service. Do not use a bare command, PATH, caller executable/profile/action, or caller metadata. Re-run the complete root/bootstrap registry verifier, then use only the closed actions below. Each fresh process independently authenticates root/bootstrap/raw bodies/service peer and obtains one signed consumed-identity receipt for its exact action.

```bash
set -euo pipefail
test -f /home/colchis/plugins/.agents/plugins/marketplace.json
node /home/colchis/plugins/multi-model-seats/scripts/lifecycle-installation.mjs operator-marketplace-list --source /home/colchis/plugins/multi-model-seats --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/scripts/lifecycle-installation.mjs operator-remove --source /home/colchis/plugins/multi-model-seats --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
node /home/colchis/plugins/multi-model-seats/scripts/lifecycle-installation.mjs operator-add --source /home/colchis/plugins/multi-model-seats --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
```

Expected: each process authenticates the protected service and verifies one receipt proving exact consumed observer/profile identities, action, fence, clean process-tree exit, and output; `multi-model-seats@multi-model-local` is installed/enabled at `0.6.0`. Any receipt/service/identity/event/overflow/action failure stops before the following line or cache copy.

Have the preflight independently execute the grant-bound observer's exact signed `plugin list --json` argv and environment, discover the installed root only from its machine-readable projection, then verify the complete package without treating installation as provider authentication. No metadata file crosses this API:

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs --source /home/colchis/plugins/multi-model-seats --authorized-plan-grant "$AUTHORITY_PATH" --telos-eye-root "$TELOS_EYE_ROOT_PEM" --expected-telos-eye-root-ref "$TELOS_EYE_ROOT_RAW_REF" --authorization-bootstrap "$TELOS_DFM_BOOTSTRAP_PACKET" --expected-authorization-bootstrap-ref "$EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF"
```

Expected: source/cache manifests are identical; preflight used one protected `plugin-list` transaction, and its runner/observer/receipt refs plus consumed image/profile/output bindings appear in the driver result. Every installed test/self-check/auxiliary runs exactly once. Retain installed root/manifest/source commit and runner/observer/receipt identity as Step-8 execution identity. Any inventory, receipt, consumed identity, event/overflow, recursion, PATH, or count drift fails. No lifecycle proof exists yet; provider authentication remains separate.

- [ ] **Step 9: Run the governed production lifecycle over the exact installable plugin**

Only after Step 8, use the exact clean source plus disjoint nonexistent runtime/handoff siblings. Resolve every Step 9 script under the retained authenticated installed cache. The grant/bootstrap registry binds exact canonicalizer/detector/validator/four adapters/detached helpers/protected runner/observer/profile. Every production command independently authenticates all four root/bootstrap path/ref flags before runtime or selected code. Drive each model step through prepare/invoke framing, capture clean implementation snapshots, complete Daedalus/Icarus pairs/checkpoints, then cold Grok/Gemini, disk, and Eye gates exactly as specified.

At `iliad-retrospective`, call only atomic `record-installation`; pass no registry/cache/runner/observer/profile/receipt/proof selection. Under one lock it resolves exact descriptors, performs one protected-service `plugin-list` transaction, verifies its strict signed consumed-identity receipt, selects the enabled `0.6.0` cache from receipt stdout, reruns source/cache identity, persists receipt-bound evidence/proof, and publishes the sole retrospective decision. Independently retain the returned installation-proof ref before discarding process state. Fresh replay must show the exact proof link and runner/observer/receipt bindings and require that retained ref to equal the retrospective decision's resolved singleton proof ref. Then call `loadProductionTrustAnchor({ externalRootPath: TELOS_EYE_ROOT_PEM, expectedExternalRootRef: TELOS_EYE_ROOT_RAW_REF, authorizationBootstrapPath: TELOS_DFM_BOOTSTRAP_PACKET, expectedAuthorizationBootstrapRef: EXPECTED_TELOS_DFM_BOOTSTRAP_RAW_REF, runtimeDir })`, export, and verify through the fixed detached authorization loader with retained bootstrap/launcher/verifier/root refs plus that independently retained installation-proof ref.

Any governed source mutation after Step 8 triggers a mandatory revalidation/reinstallation loop before the next model, Eye, disk, installation, or export transition. The previously authenticated installed-cache controller—not any changed source file—captures the new clean committed target and records that mutation; save any newly created completed-pair boundary, then stop all lifecycle writes. Regenerate the public declaration/final vector/bundles/negatives whenever the verifier, launcher, generator, fixed acyclic fixture, or another generator-owned input changed; run generator check in every case. Rerun the complete Step 6 worktree battery, publish the exact source only through `commit-scanned`, rerun all of Step 7A from that clean commit, derive and retain the new committed verifier ref, then repeat Step 8 normal remove/add installation and full source/cache identity verification. Replace `STEP8_INSTALLED_PLUGIN_ROOT`/manifest identity only with that newly authenticated cache and execute all subsequent lifecycle commands from it. Resume the existing runtime only when the new installed controller's fresh anchored replay proves its immutable plan grant, profile, trust, transport registry, and runtime schema remain compatible and accepts the exact new controller-captured implementation/commit; a plan/profile/trust/adapter/registry change or incompatible runtime schema requires a new Eye grant and new lifecycle rather than migration by assertion. No `record-installation`, disk acceptance, final bundle, or reported verifier/cache/source ref may come from the pre-mutation Step 8 install. Repeat this loop after every later source change; the last loop must finish immediately before the final disk/Eye/install/export sequence.

If the independently retained bootstrap, supported protected identity-fence backend, native observer/profile identity, live authenticated Claude/OpenAI/xAI/Google seats, required Icarus checkpoint, or fresh Eye signature is unavailable, stop with `PRODUCTION_LIFECYCLE_PENDING`. Report the last verified root/bootstrap/lifecycle root and missing boundary. Never replace service/provider seats with synthetic fixtures, reuse demo authority, label synthetic output production, or claim product handoff.

## Final Verification and Handoff

- [ ] Run the unchanged production credential detector over this complete plan and require zero matches. Run the full-candidate golden against the externally signed authorization declaration with both plugin `sha256Ref` and TELOS `sha256hex(canonicalize(...))`; a one-byte plan mutation must fail. Re-run the fixed config/journal/checkpoint/manifest/bundle vectors, including the literal config ref `sha256:d7ad208bbacd63e2a2bdbf1ba2453db971dcbc312ee0afb7434ae72a7bfa7c57` and all one-byte negatives.

```bash
type run_credential_gate >/dev/null
cmp -s "$CREDENTIAL_DETECTOR_PATH" /home/colchis/plugins/multi-model-seats/scripts/lifecycle-credential-gate.mjs
run_credential_gate "$CREDENTIAL_DETECTOR_PATH" "$CREDENTIAL_DETECTOR_RAW_REF" scan-file --expected-self-ref "$CREDENTIAL_DETECTOR_RAW_REF" --path /home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md
```

Expected: detector identity and byte equality checks pass and the complete plan produces zero matches. Any scanner read/hash/error or detected value is a hard stop, never a warning.

- [ ] Re-run TELOS contract verification; this plugin plan must not have changed TELOS authority records.

```bash
node /home/colchis/Projects/TELOS/docs/institutional-memory/verify-contracts.mjs
git -C /home/colchis/Projects/TELOS status --short --branch
```

Expected: `301/301 contracts match system reality`; no implementation artifact has silently modified `CURRENT-AUTHORITY.json`.

- [ ] Record the clean plugin commit, complete source/cache manifest root, profile ref, lifecycle root, latest Icarus checkpoint refs, authorized plan root, accepted `dfm.implementation.v1` artifact ref, its distinct embedded tree root, verified disk tree root, production bundle root, detached-verifier result, test totals, installation version, and provider-authentication gaps.

- [ ] Submit only the exact clean plugin commit and detached-verified `production` handoff bundle to The Eye. A `synthetic-test` bundle is evidence of test coverage only. If the production lifecycle or fresh Eye acceptance is pending, report that boundary and stop. Do not call the work accepted, enrolled, merged, released, handed off, or implementation-complete until the corresponding Eye/TELOS records exist.
