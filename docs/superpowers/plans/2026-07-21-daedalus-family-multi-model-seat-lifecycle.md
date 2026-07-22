# Daedalus Family Multi-Model Seat Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency `multi-model-seats` lifecycle that makes every Daedalus, Icarus, Grok, Gemini, TELOS, and Eye decision grow an auditable Merkle-DAG and routes every non-pass or dead stage back through Daedalus until an exact-root pass or explicit Eye action.

**Architecture:** A declarative Daedalus-family profile defines seats, stages, pair gates, cold-review gates, retry edges, governed mutations, and Eye-authority actions. Small Node ESM modules implement typed canonical artifacts, separate canonical-JSON and raw-byte hashing, crash-atomic immutable controller-signed journal records, externally signed and prefix-bound Eye authority, exact public request/response framing, prepared invocation recovery, deterministic transitions, disk-only replay, strict lifecycle-round checkpoints, and detached-verifiable handoff bundles; a fenced resumable controller/CLI is the only production write path. Runtime records are plugin-managed disk truth, and TELOS retains its existing authorization boundary.

**Tech Stack:** Node.js 18 or newer, ESM `.mjs`, `node:test`, Node standard-library `crypto`/`fs`/`path`, canonical JSON, SHA-256 content addresses, Ed25519 controller signatures, immutable canonical record files, Superpowers workflow skills.

## Global Constraints

- The approved design is `/home/colchis/Projects/TELOS/docs/superpowers/specs/2026-07-21-daedalus-family-multi-model-seat-lifecycle-design.md`, commit `f7482daf7318cfb7341a739154ebb9b49d77d8c5`, raw file SHA-256 `5c972b176df402d22a65273520d2342541cd213717e80c8460577a7ad6c920c9`.
- TELOS authorization identity is the canonical candidate ref `sha256hex(canonicalize({ kind: "candidate", plan: planText }))`, not the raw file SHA-256. Raw SHA-256 may be recorded only as a transport-integrity checksum.
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
- The governed implementation root is the content ref of a canonical `dfm.implementation.v1` artifact. Its embedded `tree_root` is separate disk evidence: code gates and Eye acceptance bind the artifact ref, while disk truth binds only the embedded tree ref.
- Runtime private keys, API keys, OAuth tokens, `.env*`, `*.pem`, and runtime `.telos/` artifacts never enter Git. The controller private key is supplied in memory or generated ephemerally; only its immutable public key may be persisted. Every signer result is decoded canonically, length/key-ID/signature/ref/predecessor checked in memory against that public key, and only then atomically published.
- Deterministic tests use injected provider doubles. No live Anthropic, OpenAI, xAI, or Google call is required by the test suite.
- Disk-only replay is the sole source of derived lifecycle state, effective roots, evidence sets, status output, and handoff-bundle contents. In-memory state is disposable and never authoritative.
- A retry/death record never mutates the governed plan or implementation. Only an explicit mutation transition can change those roots, and every such mutation invalidates all downstream gates defined below.
- Every Eye transition references a separately signed Eye/TELOS authority artifact whose unique ID/ref, exact Eye actor tuple, immutable target, pinned trust ref, and `prefix_root` bind the lifecycle root immediately before the node. The controller signature records the transition but cannot manufacture or reuse authority.
- Every required model decision references a closed provenance artifact bound to the profile seat, exact canonical seat-request ref, attempt, validated or explicitly rejected response provider/model, response identifier/status, subject root, and lifecycle. A literal pass has no findings or dispositions.
- Persistent artifacts are closed typed envelopes. Raw prompts, raw provider responses, conversations, chain-of-thought, hidden reasoning, credentials, cookies, session tokens, and arbitrary untyped JSON are rejected.
- Atomic immutable plugin-local journal records are the lifecycle source of truth; lock files are advisory optimization only. A signed `invocation-prepared` record commits the exact unsigned decision and complete typed artifact set before materialization, making every crash boundary total and idempotent.
- Handoff is a closed content-addressed bundle containing immutable configuration, profile, public trust, chained journals/checkpoints, every reachable typed artifact, every transitively reachable raw blob/Git object, and a detached verifier. It does not mutate `CURRENT-AUTHORITY.json`, grant authorization, merge, release, or enroll a module.
- Checkout, runtime, and handoff directories are physically disjoint realpaths with symlink/containment rejection. Handoff generation is in-memory deterministic, writes once to a fresh external directory, and cannot change the governed checkout.
- After each Daedalus/Icarus review-fix round, Icarus alone consolidates validated findings/dispositions into the strict plugin-owned lifecycle-round checkpoint before precompact/rotation. Mechanics are read-only/non-authoritative and can neither write nor close checkpoints.
- The synthetic end-to-end feature is named `content-addressed-note`; its bundle is explicitly test-only and never eligible for product handoff.

---

## File Structure

| Path | Responsibility |
|---|---|
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs` | JSON-domain validation, canonical JSON bytes, raw-byte SHA-256, credential/private-reasoning rejection, and closed decision validation |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-artifacts.mjs` | Closed schemas for findings, dispositions, requirements, plan candidates, implementations, provenance, authority, commands, manifests, and evidence |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-journal.mjs` | Crash-atomic immutable per-record publication, signed index/predecessor chains, CAS fencing, and orphan-temp verification |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-profiles/daedalus-family-v1.json` | Policy data for seats, stages, gate order, re-entry points, and explicit absence of automatic caps |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-profile.mjs` | Load and fail-closed validate the profile; expose stage lookup and profile hash |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-store.mjs` | Canonical artifact/raw storage, atomic chained decision publication, and byte/signature/parent verification |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-operations.mjs` | Atomic signed start/prepared/terminal operation chain, committed artifacts, and decision/provenance linkage |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-authority.mjs` | Verify separately signed Eye/TELOS authority artifacts against declared trust roots and exact action/scope/subject |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-engine.mjs` | Pure reducer for pair gates, cold gates, retry lineage, governed mutations, recovery, and safe Eye actions |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-replay.mjs` | Verify disk records and replay every transition to derive the only authoritative state/evidence/export inputs |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-seat-adapter.mjs` | Convert injected provider results, outages, and malformed provenance into decision inputs without seat substitution |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-disk-truth.mjs` | Re-hash a checkout and execute declared verification commands without a shell |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs` | Build/write a disjoint content-addressed handoff bundle and detached-verify it from bundle plus pinned external trust |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-controller.mjs` | Serialized resumable production operations over the verified store using an external signer |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-cli.mjs` | init/status/resume/ingest/invoke/recover/mutate/eye/verify/record-retrospective/export command surface; no generic decision append |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs` | Run the synthetic `content-addressed-note` lifecycle, including one failed cold review and Daedalus recovery |
| `/home/colchis/plugins/multi-model-seats/scripts/checkpoint.mjs` | Existing broad checkpoints plus isolated strict `lifecycle-round` save/load/precompact modes and atomic checkpoint chain |
| `/home/colchis/plugins/multi-model-seats/tests/lifecycle-fixtures.mjs` | Shared deterministic profile/node builders and controller-key helper for lifecycle tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs` | Golden canonical-hash, schema, and secret tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs` | Profile topology and governance-boundary tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs` | DAG publication, signature, missing-parent, duplicate, cycle-by-construction, and root tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs` | Kill-point atomic publication, predecessor/index CAS, signer validation, reorder, and stale-lock fencing tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs` | Operation signature/state-machine, restart reconciliation, tamper, and cross-link tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs` | Eye signature, exact-root/scope/action, trust-root, and forgery tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs` | Gate order, independent reviewers, invalidation, recovery, no-cap, Eye action, and substitution tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs` | Restart, deterministic replay, journal tampering, evidence derivation, and byte-identical regeneration tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs` | Success, outage, malformed provenance, provider spoof, and secret tests with injected doubles |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs` | Tree mutation, path, symlink, command-success, and command-failure disk-truth tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs` | Exact-root export and stale/incomplete state rejection tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs` | Production CLI/controller resume, serialization, external signer, and fail-closed command tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs` | Spawned end-to-end proof and on-disk verification |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs` | Strict lifecycle-round schema, Icarus ownership, cold-context continuity, and precompact fail-closed tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs` | Full installable-package manifest/source-cache identity and cached full-suite/discoverability tests |
| `/home/colchis/plugins/multi-model-seats/skills/daedalus-family-lifecycle/SKILL.md` | User-facing Superpowers sequence, stage responsibilities, commands, and fail-return rule |
| `/home/colchis/plugins/multi-model-seats/.codex-plugin/plugin.json` | Version/capability metadata for the new lifecycle skill |
| `/home/colchis/plugins/multi-model-seats/scripts/bootstrap.mjs` | Add lifecycle runtime output to generated-project ignore rules |
| `/home/colchis/plugins/multi-model-seats/hooks/hooks.json` | Route lifecycle sessions through strict checkpoint rehydrate/precompact commands without changing broad mode |

## Execution Preconditions

- [ ] Compute the candidate plan root and validate the complete active Eye implementation-authorization record supplied for this exact plugin scope.

```bash
export AUTHORIZED_PLAN_REF="$(node --input-type=module -e 'import { readFileSync } from "node:fs"; import { canonicalize, sha256hex } from "/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs"; const plan = readFileSync("/home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md", "utf8"); process.stdout.write("sha256:" + sha256hex(canonicalize({ kind: "candidate", plan })));')"
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
  (.implementation_authority.next_slice.authority_record | type == "string")
' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json
AUTHORITY_RECORD="$(jq -r '.implementation_authority.next_slice.authority_record' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json)"
export AUTHORITY_PATH="/home/colchis/Projects/TELOS/$AUTHORITY_RECORD"
export EYE_TRUST_REL="docs/institutional-memory/telos/keys/eye-implementation-v1.public.pem"
export EYE_TRUST_PEM="/home/colchis/Projects/TELOS/$EYE_TRUST_REL"
export REVIEWED_HEAD="git:$(git -C /home/colchis/Projects/TELOS rev-parse HEAD)"
git -C /home/colchis/Projects/TELOS ls-files --error-unmatch "$EYE_TRUST_REL"
git -C /home/colchis/Projects/TELOS diff --quiet HEAD -- "$EYE_TRUST_REL"
jq -e --arg ref "$AUTHORIZED_PLAN_REF" --arg target "/home/colchis/plugins/multi-model-seats" '
  .authority_version == "telos.eye-implementation-authority.v1" and
  .action == "grant-implementation" and
  .subject_ref == $ref and
  .scope.target_kind == "checkout" and
  .scope.target_path == $target and
  .scope.task_range == "1-11" and
  .status == "GRANTED" and
  .reviewed_head == env.REVIEWED_HEAD and
  .signature.algorithm == "ed25519" and
  .signature.key_id == "eye-implementation-v1" and
  (.signature.value | type == "string")
' "$AUTHORITY_PATH"
node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { canonicalize } from "/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs";

const raw = readFileSync(process.env.AUTHORITY_PATH, "utf8");
const record = JSON.parse(raw);
assert.equal(raw, canonicalize(record) + "\n", "Eye authority bytes must be canonical JSON plus one newline");
const trustStat = lstatSync(process.env.EYE_TRUST_PEM);
assert.equal(trustStat.isFile() && !trustStat.isSymbolicLink(), true, "pinned Eye public key must be a regular non-symlink");
const publicKey = createPublicKey(readFileSync(process.env.EYE_TRUST_PEM));
const verifyRecord = (candidate) => {
  try {
    const { signature, ...unsigned } = candidate;
    if (signature?.algorithm !== "ed25519" || signature?.key_id !== "eye-implementation-v1") return false;
    if (candidate.authority_version !== "telos.eye-implementation-authority.v1") return false;
    if (candidate.action !== "grant-implementation" || candidate.status !== "GRANTED") return false;
    if (candidate.subject_ref !== process.env.AUTHORIZED_PLAN_REF) return false;
    if (candidate.scope?.target_kind !== "checkout" || candidate.scope?.target_path !== "/home/colchis/plugins/multi-model-seats") return false;
    if (candidate.scope?.task_range !== "1-11" || candidate.reviewed_head !== process.env.REVIEWED_HEAD) return false;
    return verify(null, Buffer.from(canonicalize(unsigned), "utf8"), publicKey, Buffer.from(signature.value, "base64url"));
  } catch {
    return false;
  }
};
assert.equal(verifyRecord(record), true, "Eye implementation authority signature invalid");
for (const mutate of [
  (value) => { value.subject_ref = "sha256:" + "0".repeat(64); },
  (value) => { value.scope.target_path = "/tmp/wrong-scope"; },
  (value) => { value.scope.target_kind = "runtime"; },
  (value) => { value.scope.task_range = "1-10"; },
  (value) => { value.signature.key_id = "untrusted-eye-key"; },
  (value) => { value.signature.value = (value.signature.value.startsWith("A") ? "B" : "A") + value.signature.value.slice(1); }
]) {
  const changed = structuredClone(record);
  mutate(changed);
  assert.equal(verifyRecord(changed), false, "mutated Eye authority must fail");
}
NODE
sha256sum /home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md
```

Expected: both jq checks and the Ed25519 verifier exit 0. The grant is canonical on disk, signed by the fixed tracked `eye-implementation-v1` public key at the exact reviewed HEAD, and bound to the plan root, plugin target, and Tasks 1-11. In-memory negative controls for changed root, scope, task range, key ID, and signature all fail. The raw plan checksum is transport integrity only. The currently recorded Clotho authority intentionally fails this check; implementation must not begin until The Eye publishes the exact lifecycle grant and pinned public key.

- [ ] Re-prove the TELOS records and confirm plugin-source baseline tests.

```bash
node /home/colchis/Projects/TELOS/docs/institutional-memory/verify-contracts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
```

Expected: `301/301 contracts match system reality`; plugin test summary reports 4 passing tests and 0 failures.

- [ ] Establish a git-backed plugin source without capturing unknown or secret files.

```bash
SOURCE=/home/colchis/plugins/multi-model-seats
ALLOWLIST=".codex-plugin hooks records scripts skills tests"
if git -C "$SOURCE" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  test -z "$(git -C "$SOURCE" status --porcelain)" || {
    BASE_COMMIT="$(git -C "$SOURCE" rev-parse HEAD)"
    git -C "$SOURCE" worktree add -b codex/daedalus-family-lifecycle "$SOURCE-worktrees/daedalus-family-lifecycle" "$BASE_COMMIT"
    printf 'Continue in isolated worktree at base %s\n' "$BASE_COMMIT"
    exit 2
  }
else
  find "$SOURCE"/.codex-plugin "$SOURCE"/hooks "$SOURCE"/records "$SOURCE"/scripts "$SOURCE"/skills "$SOURCE"/tests -type l -print -quit | (! read -r _)
  find "$SOURCE"/.codex-plugin "$SOURCE"/hooks "$SOURCE"/records "$SOURCE"/scripts "$SOURCE"/skills "$SOURCE"/tests -type f \( -name '.env' -o -name '.env.*' -o -name '*.pem' -o -name 'id_rsa*' -o -name 'id_ed25519*' -o -iname '*private*reason*' -o -iname '*chain*of*thought*' \) -print -quit | (! read -r _)
  test -z "$(rg -l --hidden --pcre2 '(-----BEGIN (OPENSSH |[A-Z ]*)PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\b1//[0-9A-Za-z_-]{20,}|\b(sk-|gh[pousr]_)[A-Za-z0-9_-]{16,}|\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{20,})' "$SOURCE"/.codex-plugin "$SOURCE"/hooks "$SOURCE"/records "$SOURCE"/scripts "$SOURCE"/skills "$SOURCE"/tests || true)"
  git -C "$SOURCE" init -b codex/daedalus-family-lifecycle
  git -C "$SOURCE" add -- .codex-plugin hooks records scripts skills tests
  test -z "$(git -C "$SOURCE" diff --cached --name-only | grep -Ev '^(\.codex-plugin|hooks|records|scripts|skills|tests)/')"
  test -z "$(git -C "$SOURCE" grep --cached -Il --perl-regexp '(-----BEGIN (OPENSSH |[A-Z ]*)PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\b1//[0-9A-Za-z_-]{20,}|\b(sk-|gh[pousr]_)[A-Za-z0-9_-]{16,}|\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{20,})' || true)"
  git -C "$SOURCE" commit -m "chore: baseline audited multi-model-seats source"
fi
git -C "$SOURCE" status --short --branch
```

Expected: a clean existing checkout is preserved. A dirty existing checkout is never staged and produces an isolated worktree at the declared BASE_COMMIT; after intentional exit 2, continue only inside that worktree after running superpowers:using-git-worktrees. In an unversioned source, symlinks, forbidden filenames, and high-confidence credentials inside the allowlist fail before Git initialization; unknown top-level files are explicitly excluded and the staged-name assertion proves they cannot enter the baseline. Task 1 then installs the reusable stricter audit and tests unknown/secret fixtures against the same allowlist rule.

### Task 1: Canonical Hashing, Closed Typed Artifacts, and Baseline Audit

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-artifacts.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/audit-baseline.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs`

**Interfaces:**
- Consumes: Node `createHash`, `Buffer`, JSON-domain values, and files selected for baseline staging.
- Produces: `canonicalJson(value): string`, `canonicalBytes(value): Buffer`, `sha256Ref(value): string` for canonical JSON values only, `sha256BytesRef(bytes): string` for raw bytes only, `assertPersistable(value): void`, `validateTypedArtifact(value): string[]`, `validateUnsignedDecisionNode(node): string[]`, `validateDecisionNode(node): string[]`, `decisionRef(node): string`, and the fail-closed baseline CLI.

- [ ] **Step 1: Write the failing core tests**

Create `tests/test-lifecycle-core.mjs` with these exact assertions:

```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPersistable,
  assertSecretFree,
  canonicalBytes,
  canonicalJson,
  decisionRef,
  redactSecrets,
  sha256BytesRef,
  sha256Ref,
  validateDecisionNode
} from "../scripts/lifecycle-core.mjs";

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
  controller_signature: "dGVzdC1zaWduYXR1cmU"
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

test("decision records have a closed valid shape", () => {
  assert.deepEqual(validateDecisionNode(signedNode), []);
  assert.match(decisionRef(signedNode), /^sha256:[0-9a-f]{64}$/);
  assert.match(validateDecisionNode({ ...signedNode, surprise: true })[0], /unknown field: surprise/);
});

test("secrets are redacted and rejected at persistence boundaries", () => {
  const unsafe = { authorization: "Bearer abcdefghijklmnopqrstuvwxyz", nested: { api_key: "sk-abcdefghijk" } };
  assert.deepEqual(redactSecrets(unsafe), { authorization: "<redacted>", nested: { api_key: "<redacted>" } });
  assert.throws(() => assertSecretFree(unsafe), /possible secret/);
  assert.doesNotThrow(() => assertSecretFree(redactSecrets(unsafe)));
});

test("private reasoning and representative credential classes fail closed", () => {
  for (const unsafe of [
    { chain_of_thought: "hidden" },
    { private_reasoning: "hidden" },
    { oauth_refresh_token: "1//abcdefghijklmnopqrstuvwxyz" },
    { aws_secret_access_key: "abcdefghijklmnopqrstuvwxyz1234567890ABCD" },
    { session_cookie: "session=abcdefghijklmnopqrstuvwxyz" },
    { pem: "-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----" },
    { authorization: "Basic YWxhZGRpbjpvcGVuc2VzYW1l" }
  ]) assert.throws(() => assertPersistable(unsafe), /forbidden persistent field|possible credential/);
});

test("TELOS candidate envelope matches the repository canonical vector", async () => {
  const candidate = { kind: "candidate", plan: "line one\nline two\n" };
  const vendor = await import("/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs");
  assert.equal(sha256Ref(candidate), "sha256:" + vendor.sha256hex(vendor.canonicalize(candidate)));
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-core.mjs`.

- [ ] **Step 3: Implement the core module**

Create `scripts/lifecycle-core.mjs` with:

```js
import { createHash } from "node:crypto";

const HASH_REF = /^sha256:[0-9a-f]{64}$/;
const SECRET_KEY = /(^|_)(api_?key|access_?key|token|secret|authorization|private_?key|password|cookie|session|oauth|credential)($|_)/i;
const PRIVATE_REASONING_KEY = /(^|_)(chain_?of_?thought|private_?reasoning|hidden_?reasoning|scratchpad|internal_?monologue)($|_)/i;
const SECRET_VALUE = /(\bsk-[A-Za-z0-9_-]{8,}|\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}|-----BEGIN (OPENSSH |[A-Z ]*)PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\bAIza[0-9A-Za-z_-]{30,}|\bAKIA[0-9A-Z]{16}\b|\b1\/\/[0-9A-Za-z_-]{20,})/i;
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

export function redactSecrets(value, key = "") {
  if (SECRET_KEY.test(key)) return "<redacted>";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "<redacted>" : value;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactSecrets(item, name)]));
  }
  return value;
}

export function assertSecretFree(value) {
  if (canonicalJson(redactSecrets(value)) !== canonicalJson(value)) throw new Error("possible secret in persistent lifecycle value");
}

export function assertPersistable(value) {
  const visit = (item, key = "") => {
    if (PRIVATE_REASONING_KEY.test(key)) throw new Error(`forbidden persistent field: ${key}`);
    if (SECRET_KEY.test(key) || (typeof item === "string" && SECRET_VALUE.test(item))) throw new Error(`possible credential in persistent field: ${key || "<value>"}`);
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

export function validateUnsignedDecisionNode(node) {
  const problems = [];
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["node must be an object"];
  for (const key of Object.keys(node)) if (!UNSIGNED_FIELDS.includes(key)) problems.push(`unknown field: ${key}`);
  for (const key of UNSIGNED_FIELDS) if (!(key in node)) problems.push(`missing field: ${key}`);
  if (node.node_version !== "dfm.decision.v1") problems.push("node_version must be dfm.decision.v1");
  if (node.node_type !== "decision") problems.push("node_type must be decision");
  if (!Number.isSafeInteger(node.journal_index) || node.journal_index < 1) problems.push("journal_index must be a positive safe integer");
  if (!(node.previous_journal_ref === null || HASH_REF.test(node.previous_journal_ref ?? ""))) problems.push("previous_journal_ref must be null or a SHA-256 ref");
  if (!cleanString(node.lifecycle_id)) problems.push("lifecycle_id must be a clean non-empty string");
  if (!cleanString(node.stage)) problems.push("stage must be a clean non-empty string");
  if (!node.transition || !["decision", "retry", "mutation", "eye-action"].includes(node.transition.kind) || ![null, "plan", "implementation", "requirement", "policy"].includes(node.transition.mutation_kind) || !(node.transition.target_stage === null || cleanString(node.transition.target_stage)) || Object.keys(node.transition).sort().join(",") !== "kind,mutation_kind,target_stage") problems.push("transition must have the closed kind/mutation_kind/target_stage shape");
  if (!HASH_REF.test(node.artifact_hash ?? "")) problems.push("artifact_hash must be a SHA-256 ref");
  for (const key of ["parent_hashes", "input_refs", "output_refs", "evidence_refs"]) if (!hashArray(node[key])) problems.push(`${key} must contain unique SHA-256 refs`);
  if (!node.actor || !cleanString(node.actor.seat) || !cleanString(node.actor.provider) || !cleanString(node.actor.model) || Object.keys(node.actor).sort().join(",") !== "model,provider,seat") problems.push("actor must contain only clean seat, provider, and model strings");
  if (!(node.provenance_ref === null || HASH_REF.test(node.provenance_ref ?? ""))) problems.push("provenance_ref must be null or a SHA-256 ref");
  if (!(node.operation_prepared_ref === null || HASH_REF.test(node.operation_prepared_ref ?? ""))) problems.push("operation_prepared_ref must be null or a SHA-256 ref");
  if (!(node.authority_ref === null || HASH_REF.test(node.authority_ref ?? ""))) problems.push("authority_ref must be null or a SHA-256 ref");
  if (!node.decision || !["pass", "non-pass", "eye-pause", "eye-cancel", "eye-amend", "eye-adjudicate"].includes(node.decision.verdict) || !Array.isArray(node.decision.findings) || !node.decision.findings.every(validFinding) || !Array.isArray(node.decision.dispositions) || !node.decision.dispositions.every(validDisposition) || Object.keys(node.decision).sort().join(",") !== "dispositions,findings,verdict") problems.push("decision must have closed finding and disposition objects");
  if (node.decision?.verdict === "pass" && (node.decision.findings.length !== 0 || node.decision.dispositions.length !== 0)) problems.push("pass requires empty findings and dispositions");
  if (!HASH_REF.test(node.policy_ref ?? "")) problems.push("policy_ref must be a SHA-256 ref");
  if (!cleanString(node.recorded_at) || Number.isNaN(Date.parse(node.recorded_at))) problems.push("recorded_at must be an ISO date-time string");
  try { assertPersistable(node); } catch (error) { problems.push(error.message); }
  return problems;
}

export function validateDecisionNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["node must be an object"];
  const { controller_signature: signature, ...unsigned } = node;
  const problems = validateUnsignedDecisionNode(unsigned);
  if (!cleanString(signature)) problems.push("controller_signature must be a non-empty base64url string");
  for (const key of Object.keys(node)) if (![...UNSIGNED_FIELDS, "controller_signature"].includes(key) && !problems.includes(`unknown field: ${key}`)) problems.push(`unknown field: ${key}`);
  return problems;
}

export function decisionRef(node) {
  const problems = validateDecisionNode(node);
  if (problems.length) throw new Error(`invalid decision node: ${problems.join("; ")}`);
  return sha256Ref(node);
}
```

- [ ] **Step 3A: Define and test the closed artifact registry**

Create `tests/test-lifecycle-artifacts.mjs`. Build one valid value for every exact artifact version below, require `validateTypedArtifact(value)` to return an empty array, and require `artifactKind(value)` to return the map key. For every fixture, inject `surprise: true` at the top level and into each nested object/array element in turn and assert an `unknown field at <json-pointer>` error. For a fixed implementation fixture, assert `sha256Ref(implementation) !== implementation.tree_root`, changing only `tree_root` changes the artifact ref, and no self-reference is needed. Also reject raw strings/prompts/responses/conversations and credential/private-reasoning fields.

Add core table tests proving literal pass with any finding or disposition fails for model, local-controller, and Eye-produced ordinary decisions; non-pass remains allowed. Add journal-field tests for zero/duplicate/skipped index, wrong/null predecessor, and model decisions without `operation_prepared_ref`.

Create `scripts/lifecycle-artifacts.mjs` and export `artifactKind(value)`, `validateTypedArtifact(value): string[]`, `assertTypedArtifact(value): void`, `validateFinding(value): string[]`, and `validateDisposition(value): string[]`. The registry is closed to these exact envelopes and recursively rejects unknown fields:

| artifact_version | Exact fields after artifact_version |
|---|---|
| dfm.requirement.v1 | lifecycle_id, requirement_text |
| canonical TELOS candidate | exact keys kind (literal candidate), plan; its artifact ref is `sha256Ref({ kind: "candidate", plan })` |
| dfm.implementation.v1 | lifecycle_id, plan_root, tree_root, commit_ref |
| dfm.policy.v1 | lifecycle_id, profile_ref, rule_refs |
| dfm.seat-request.v1 | lifecycle_id, stage, seat, provider, model, subject_ref, input_refs, output_refs, instruction, public_context_refs |
| dfm.evidence.v1 | lifecycle_id, evidence_kind, subject_ref, summary, refs |
| dfm.raw-evidence.v1 | lifecycle_id, raw_ref, byte_count, media_type, subject_ref |
| dfm.provenance.v1 | lifecycle_id, seat, attempt_ref, request_ref, subject_ref, status, validated_provider, validated_model, reported_provider, reported_model, response_id, source, issued_at |
| dfm.eye-authority.v1 | authority_id, issuer, action, scope, target, prefix_root, subject_ref, policy_ref, requirement_root, issued_at, signature |
| dfm.command-evidence.v1 | lifecycle_id, command, args, cwd_ref, status, signal, stdout_ref, stderr_ref |
| dfm.tree-manifest.v1 | lifecycle_id, files |
| dfm.package-manifest.v1 | package_id, version, entries |
| dfm.installation-proof.v1 | lifecycle_id, plugin_id, plugin_version, source_commit_ref, source_manifest_ref, installed_manifest_ref, test_evidence_refs |

Nested shapes are also closed:

- `finding = { code, message, evidence_refs }`; `disposition = { code, action, target_stage, subject_ref }`.
- `issuer = { id: "eye", key_id }`; `signature = { algorithm: "ed25519", key_id, value }`.
- `scope = { lifecycle_id, profile_ref, stage_id }`; `target` is exactly `{ kind: "checkout", path: <normalized absolute realpath>, task_range: "1-11" }` everywhere.
- A tree-manifest file is exactly `{ path, bytes, content_ref }`. A package-manifest entry is exactly `{ path, file_type: "regular", byte_count, content_ref }`; entries are unique path-sorted and symlinks are forbidden. A `refs`, `rule_refs`, finding `evidence_refs`, or installation `test_evidence_refs` array is unique sorted.
- Raw evidence metadata is exactly `{ artifact_version: "dfm.raw-evidence.v1", lifecycle_id, raw_ref, byte_count, media_type, subject_ref }`; `raw_ref` and `subject_ref` are SHA-256 refs, `byte_count` is a non-negative safe integer equal to the stored raw-byte length, and `media_type` is a clean lowercase IANA media type. Unknown metadata keys fail closed.
- `dfm.seat-request.v1` is canonical public input, at most 16 KiB total; `instruction` is a secret-free public instruction of at most 8192 UTF-8 bytes, context/input/output refs are unique sorted, and lifecycle/stage/seat/provider/model/subject must match controller replay/profile. It is never called a raw prompt.
- Provenance `status` is `issued`, `rejected`, or `failed`. Issued requires non-null validated/reported provider/model equality plus trimmed response ID. Rejected requires null validated fields, non-null reported fields and response ID from a complete but invalid/mismatched response. Failed requires all provider/model/report fields and response ID null. `attempt_ref`, `request_ref`, and `subject_ref` are SHA-256 refs.
- `summary` is a bounded public result summary of at most 4096 UTF-8 bytes. Prompts, raw responses, messages, conversations, transcripts, tool traces, scratchpads, and private reasoning are not artifact kinds and are never fields in an allowed envelope.
- `commit_ref` is null, `git:sha1:<40 lowercase hex>`, or `git:sha256:<64 lowercase hex>` only; arbitrary-length hex labels fail. Command status is an integer or null; signal is a clean string or null. Paths are normalized relative paths without `..`.
- Package manifests bind the complete installable regular-file set, package ID, and exact semantic version. Installation proof requires `plugin_id === package_id`, identical source/installed package-manifest bodies and refs, a non-null canonical Git commit ref, and non-empty unique sorted same-lifecycle evidence refs for full cached tests/discovery/hooks/CLI. It is valid handoff evidence only when directly reachable from the production retrospective decision.
- Eye `prefix_root` is a SHA-256 ref authenticated by the Eye signature and later required to equal the lifecycle root immediately before its node. Authority IDs are clean globally unique values; authority refs may appear in at most one Eye decision.
- The governed implementation root is always `sha256Ref(implementationArtifact)`, where `implementationArtifact.artifact_version === "dfm.implementation.v1"`. Its `tree_root` is a separate ref to the exact `dfm.tree-manifest.v1` artifact. Validation requires `plan_root` and `tree_root` to be SHA-256 refs but never requires either to equal the implementation artifact's own ref.

The plan-candidate discriminant is `kind`; all other artifacts use `artifact_version`. The candidate has no wrapper fields so its stored ref is byte-for-byte the TELOS canonical candidate ref; requirement/lifecycle linkage lives in the decision input refs and state. Every validator first calls `assertPersistable`; validation never redacts and accepts. `redactSecrets` is allowed only for an ephemeral diagnostic returned to the caller, never as a way to make an otherwise forbidden artifact persistable.

- [ ] **Step 3B: Add the fail-closed baseline audit**

Create `tests/test-audit-baseline.mjs` with temporary roots proving:

1. the explicit directories `.codex-plugin`, `hooks`, `records`, `scripts`, `skills`, and `tests` pass when their files are public source;
2. an unknown top-level file, symlink, `.env`, `.env.local`, `*.pem`, OpenSSH key, API key, OAuth token, cloud access key, cookie/session value, authorization header, or private-reasoning filename makes the CLI exit nonzero before emitting `BASELINE_AUDIT_OK`;
3. `--files` rejects an absolute path, a path outside the root, a NUL/control path, or a staged path outside the allowlist;
4. no audit output echoes the detected credential value.

Implement `scripts/audit-baseline.mjs --root <absolute-root> --allow "<space-separated-roots>"` and `--files <paths...>` with `lstatSync`/`readFileSync`; reject symlinks and scan bytes without following them. It is read-only, emits one redacted error per rejected path, and emits exactly `BASELINE_AUDIT_OK` only after every selected file passes.

- [ ] **Step 4: Run the focused and baseline tests**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
```

Expected: all core/artifact/audit tests pass; 4 baseline tests pass; 0 failures.

- [ ] **Step 5: Commit**

```bash
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-core.mjs scripts/lifecycle-artifacts.mjs scripts/audit-baseline.mjs tests/test-lifecycle-core.mjs tests/test-lifecycle-artifacts.mjs tests/test-audit-baseline.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: add canonical typed lifecycle records"
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
  assert.deepEqual(profile.telos_handoff.authorization_required_seats, ["claude", "agy", "codex"]);
  assert.deepEqual(profile.telos_handoff.authorization_advisory_seats, ["grok", "gemini"]);
  assert.equal(profile.telos_handoff.profile_gate_results_are_authority, false);
});

test("unknown fields and seat substitution policy fail closed", () => {
  const profile = loadProfile();
  assert.match(validateProfile({ ...profile, surprise: true })[0], /unknown profile field/);
  assert.match(validateProfile({ ...profile, allow_seat_substitution: true }).join(";"), /allow_seat_substitution must be false/);
});

test("transition sentinels and nulls are stage-specific", () => {
  const profile = loadProfile();
  const recovery = profile.stages.find((stage) => stage.id === "daedalus-recovery");
  const closed = profile.stages.find((stage) => stage.id === "closed");
  const p1 = profile.stages.find((stage) => stage.id === "p1-plan-pair");
  assert.deepEqual(validateProfile({ ...profile, stages: profile.stages.map((stage) => stage.id === p1.id ? { ...stage, on_pass: "$reentry" } : stage) }).some((problem) => problem.includes("$reentry is allowed only")), true);
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
    "daedalus": { "provider": "anthropic", "role": "plan-author-architecture-review-recovery" },
    "icarus": { "provider": "openai", "role": "feasibility-review-code-author-remediation" },
    "grok": { "provider": "xai", "role": "cold-adversarial-review" },
    "gemini": { "provider": "google", "role": "cold-independent-verification" },
    "eye": { "provider": "human", "role": "exact-root-authority" },
    "telos-controller": { "provider": "local", "role": "deterministic-controller" }
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
    "authorization_required_seats": ["claude", "agy", "codex"],
    "authorization_advisory_seats": ["grok", "gemini"],
    "profile_gate_results_are_authority": false
  }
}
```

- [ ] **Step 4: Implement the profile loader and closed validator**

Create `scripts/lifecycle-profile.mjs`. It must resolve the default path relative to `import.meta.url`, parse JSON, reject unknown top-level/stage/seat/handoff fields, require unique stage IDs and known seat/transition references, require the exact null `automatic_limits`, require `allow_seat_substitution === false`, and require every nonterminal stage to route non-pass to `daedalus-recovery`. Export the five interfaces listed above and compute `profileRef` with `sha256Ref(profile)`.

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
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats add records/lifecycle-profiles/daedalus-family-v1.json scripts/lifecycle-profile.mjs tests/test-lifecycle-profile.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: define Daedalus family lifecycle profile"
```

Expected: all profile and core tests pass with zero failures; commit succeeds.

### Task 3: Signed Crash-Atomic Merkle-DAG Store

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-journal.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-store.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-operations.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-authority.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/lifecycle-fixtures.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs`

**Interfaces:**
- Consumes: canonical JSON/byte hash helpers and the typed artifact registry from Task 1, validated profiles from Task 2, and the immutable persisted controller/Eye public trust.
- Produces: `publishJournalRecord({ journalDir, unsignedRecord, signer, publicKey }): Promise<{ ref, record }>`, `verifyJournal({ journalDir, kind, publicKey }): JournalVerification`, the store/authority interfaces, `appendOperation`, `operationRef`, `verifyOperation`, `deriveOperationTerminal`, and `verifyOperationsLog`.

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
15. signer output with wrong key, key ID, decoded length, base64url padding/alphabet, altered bytes, or invalid signature is rejected before temp creation; snapshot every runtime byte and signer/provider counters before/after.

Create `tests/test-lifecycle-journal.mjs` with reusable decision/operation/checkpoint fixtures and subprocess fault injection at every publication syscall. Require exclusive final names `<20-digit-index>.json`, canonical `{ ref, record }` bytes, signed `journal_index`/`previous_journal_ref`, in-memory signature/ref/predecessor validation before temp creation, atomic `linkSync(temp, final)` (or a proven equivalent non-overwriting primitive), final-directory fsync, and CAS conflict behavior independent of advisory locks.

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

Create `tests/test-lifecycle-authority.mjs`. Generate independent controller and Eye Ed25519 keys and prove:

- a controller-signed Eye node is rejected without `authority_ref`;
- a trusted Eye signature with exact immutable lifecycle/profile/target scope passes static verification; controller signing, unknown key ID, altered signed byte, altered signature, untracked trust key, wrong lifecycle/profile/target, unknown action, and unsigned artifacts fail;
- a correctly Eye-signed artifact with a semantically wrong but well-formed subject, requirement root, policy root, action/stage pair, or implementation/tree-root choice passes static verification. Mark these fixtures `STATIC_ONLY`; Task 5 must reject each against prefix state;
- every Eye node without `authority_ref`, and every non-Eye node with one, fails static store verification.
- trust bytes must be canonical regular non-symlink bytes whose ref equals immutable `lifecycle.json.eye_trust_ref`; caller-supplied substitute trust, altered target kind/path/range, wrong Eye actor tuple, reused authority ID/ref, and wrong `prefix_root` fail. Mutate-away/mutate-back cannot reuse an earlier authority.

Each test creates a temporary directory with `mkdtempSync`, removes it with `t.after`, and wraps keys from `controllerKeys()` behind the signer interface. No test passes a private key into `createLifecycleStore`.

- [ ] **Step 3: Run the store test and confirm the module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-store.mjs`.

- [ ] **Step 4: Implement the controller-only store**

Implement `scripts/lifecycle-store.mjs` with these exact persistence rules:

```js
const FILES = {
  lifecycle: "lifecycle.json",
  decisions: "decisions",
  operations: "operations",
  journalPending: ".journal-pending",
  publicKey: "controller-public-key.json",
  authorityTrust: "eye-authority-trust.json",
  artifacts: "artifacts",
  raw: "raw"
};
```

- Implement `lifecycle-journal.mjs` once for decisions, operations, and checkpoints. Final records are immutable canonical files named only by zero-padded signed `journal_index`; each signed record contains exact `journal_index` and `previous_journal_ref` (`null` only at index 1). Publication validates the complete existing chain, computes the one next slot/predecessor, validates the unsigned record, obtains the external signature, rejects noncanonical base64url/padding or decoded length other than 64, checks exact key ID/Ed25519 signature/full signed ref/state-machine/predecessor in memory, then writes a same-filesystem temp with `wx`, fsyncs it, exclusively hard-links it to the final index path, fsyncs the journal directory, and removes/fsyncs the temp directory. No byte is published before cryptographic validation. `EEXIST` is a CAS conflict; never overwrite or silently retry with a new predecessor.
- Orphan temp files are never journal members. Verification reports them separately and proves every final filename/index/ref/signature/predecessor byte. Advisory PID locks may reduce contention but grant no authority; the exclusive final index publication is the serialization/fencing CAS. A second writer or resumer must reverify after `JOURNAL_CAS_CONFLICT` and stop if another pending/settled attempt now exists.
- `signDecision` is a test helper using the same in-memory validation. The storage-only `store.publishDecision` assigns the already-reserved next decision journal index/predecessor committed by `invocation-prepared`, signs exact canonical bytes, validates signature/key/ref/predecessor/state in memory, and calls the common atomic publisher. There is no direct append or JSONL authority.
- `createLifecycleStore` creates `dir`, persists only `{ key_type: "ed25519", key_id, public_key_der_base64 }`, and rejects a changed public key/key ID. `initializeLifecycle({ lifecycleId, profileRef, initialRequirementRoot, initialPolicyRef, target, eyeTrust })` writes exact canonical immutable files exclusively; `lifecycle.json` includes `eye_trust_ref = sha256Ref(eyeTrust)` and target exactly `{ kind: "checkout", path, task_range: "1-11" }`. Trust is exactly `{ trust_version: "dfm.eye-trust.v1", keys: [...] }`, canonical, unique-sorted, regular, and non-symlink. None may be replaced/defaulted and replay accepts no alternate trust/target.
- `putArtifact(value)` calls `assertTypedArtifact`, derives exact canonical bytes/ref, then uses crash-atomic immutable content publication: same-filesystem temp `wx`, complete write, file fsync, exclusive hard-link to the content-addressed final name, directory fsync, and temp cleanup/fsync. An existing final is accepted only after exact byte/ref validation; torn finals are corruption and are never overwritten. Fault injection at every syscall leaves either old state or one complete new value plus ignorable orphan temp.
- `putRawEvidence(bytes, metadata)` accepts only closed metadata `{ lifecycle_id, media_type, subject_ref }`, publishes raw bytes under `raw/<hex>.bin` through the same crash-atomic content primitive, constructs/persists the closed envelope through `putArtifact`, and returns `{ artifact_ref, artifact }`. The envelope's `raw_ref = sha256BytesRef(bytes)` and `byte_count = bytes.length`. Caller-supplied raw refs/counts, unknown metadata, media drift, or differing existing bytes fail.
- `readArtifact(ref)` reads raw bytes, parses once, runs `assertTypedArtifact`, recomputes `canonicalBytes(parsed)`, requires byte equality before hashing, and requires both `sha256BytesRef(rawBytes)` and `sha256Ref(parsed)` to equal `ref`. Whitespace and key-order drift therefore fail even if JSON.parse would yield the same value.
- `readEntries` projects `verifyJournal(decisions)` records as decisions: require every final file to equal `canonicalBytes({ ref, record })`, exact filename/index/predecessor continuity, no gaps/duplicates/swaps, and valid signature/ref before DAG checks.
- `store.publishDecision` is a storage primitive, not routing authority. It verifies the complete store and prepared-operation commitment; requires the decision's exact journal index/predecessor and `operation_prepared_ref`; resolves all direct/transitive refs; validates signature in memory; atomically publishes; then re-verifies. Model decisions must equal the prepared unsigned bytes and artifact set. Eye/local decisions require null prepared ref and dedicated controller capabilities.
- `verify()` recomputes all artifact/raw/decision/root refs, validates the decision journal and DAG, and binds every model decision to exactly one prepared operation and provenance. Issued provenance validates response provider/model against request/profile/node; rejected provenance records reported mismatch without pretending validation; failed provenance has no response facts. Attempt/response IDs are unique, literal pass requires issued provenance plus empty findings/dispositions, and failed/rejected require non-pass.
- Every Eye node requires non-null unique authority and exact actor `{ seat: "eye", provider: "human", model: "eye-record-v1" }`; every non-Eye node requires null. Static verification loads trust only from canonical persisted bytes, checks `eye_trust_ref`, signature/static scope/fixed target, globally unique authority ID/ref, and well-formed `prefix_root`. Prefix equality remains Task 5 semantics.
- `verifyLifecycleStore({ dir, profile })` accepts no caller trust/target. It authenticates immutable config/trust/public key, atomic decision chain, content refs, signatures, provenance/request/prepared bindings, parent order, and DAG root. It never repairs or substitutes state.
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
  attempt_ref: "sha256:...",
  request_ref: "sha256:...",
  request_artifact: null | { /* exact closed dfm.seat-request.v1 */ },
  subject_ref: "sha256:...",
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

- Reject every unknown/missing/nested field and run `assertPersistable`. Journal, stage, transition, input/output, request, model, and decision-reservation fields are exact. Start alone has non-null `request_artifact`: the exact canonical closed `dfm.seat-request.v1` body; require `sha256Ref(request_artifact) === request_ref` and exact equality of its lifecycle/stage/seat/provider/model/subject/input/output fields to the signed operation intent. All other body/linkage fields are null/empty, and start reserves the next verified decision journal index/predecessor. Prepared and terminal set `request_artifact: null`, repeat `request_ref`/intent, and resolve the body only through their verified `started_ref`. Prepared contains exact `prepared_decision` plus unique sorted `prepared_artifacts: [{ ref, artifact }]`; terminal names the full signed `prepared_ref`, decision, and provenance and carries no bodies.
- Prepared artifacts are the complete provider-result typed set not already committed before invocation: exactly provenance and every public provider-evidence artifact referenced by the decision. The request is not duplicated there; the materialization set is the exact request body from signed start plus `prepared_artifacts`. Every ref/body is canonical, closed, secret-free, matches its ref, and no body is unreferenced. Use this exact non-circular commitment: construct `prepared_decision_base` with `operation_prepared_ref: null`; compute `prepared_commitment_ref = sha256Ref({ commitment_version: "dfm.prepared-commitment.v1", request: started.request_artifact, decision: prepared_decision_base, artifacts: prepared_artifacts })`; set `prepared_decision.operation_prepared_ref = prepared_commitment_ref`; put that value in prepared; sign the enclosing operation and derive its full `prepared_ref`. Verification reloads signed start, resets the decision field to null, and recomputes the same request+decision+artifacts commitment.
- All operation records use the common sign-validate-atomic-publish protocol. Wrong signature/key/ref/predecessor leaves no final/temp/runtime mutation. A start is the only first record for an attempt; a prepared record is the only second; a terminal is the only final. Each repeats exact intent. A new start is rejected whenever any start lacks a terminal.
- The operation journal's exclusive next-index publish is the cross-process CAS. Only after winning does the controller discard caller request memory, reload/reverify the signed start, derive `canonicalBytes(start.request_artifact)`, and invoke the provider with those bytes. Caller bytes/file are never used after start publication. A loser never invokes. Lock files cannot override this fact.
- `verifyOperationsLog` requires the decision to equal the prepared unsigned bytes plus verified controller signature, `node.operation_prepared_ref === prepared.prepared_commitment_ref`, terminal `prepared_ref` to name the full signed prepared operation, the start request and every prepared ref/body to equal materialized storage, and all request/provenance/actor/intent bindings to match. One attempt owns exactly one signed request body, materialized request artifact, prepared record, provenance, decision, and terminal.
- `deriveOperationTerminal` is the only total terminal rule. Failed provenance plus non-pass `PROVIDER_DIED` derives died. Issued pass (necessarily empty) or issued valid non-pass/refusal/truncation derives finished. Rejected complete response mismatch/malformed non-pass also derives finished. All inconsistent status/verdict/code/terminal combinations reject.
- Return closed `{ operation_refs, attempts, pending }`. Pending kinds are `prepare_missing` (start only), `decision_missing` (prepared exists, decision absent or artifacts partial), and `terminal_missing` (exact decision exists). The attempt projection includes committed prepared bytes/artifacts and reservation. No other orphan/ambiguity is recoverable.
- Recovery is idempotent and never calls a provider: `prepare_missing` reloads/validates the exact request body/ref/intent from signed start, constructs deterministic failed provenance and death decision from those committed bytes, and publishes the request-bound prepared record. All recovery-generated `issued_at`/`recorded_at` values equal signed `start.recorded_at`; recovery never reads a clock. `decision_missing` atomically materializes the start request plus every prepared artifact with byte-equality acceptance, validates/signs/publishes the exact reserved decision; `terminal_missing` derives/publishes only terminal. External request files and caller memory are irrelevant. Repeated fresh processes converge on identical refs/bytes or lose CAS and replay the winner.
- Every model-seat lifecycle decision must be linked by exactly one settled or terminal-missing attempt. Eye/local-controller decisions have no operation. Operations never enter `deriveLifecycleRoot`, lifecycle heads, stage completion, evidence/authority sets, or provider consensus.

Implement `scripts/lifecycle-authority.mjs` so `eyeAuthoritySigningBytes` removes only the closed `signature` object and canonicalizes the remainder. `verifyEyeAuthorityStatic({ artifact, lifecycleConfig, persistedTrust })` accepts no caller trust or target: it verifies canonical regular non-symlink trust bytes against `lifecycleConfig.eye_trust_ref`, resolves `artifact.issuer.key_id` only there, requires signature key-ID equality, verifies Ed25519, checks closed schema plus the immutable exact target `{ kind: "checkout", path: realpath, task_range: "1-11" }`, exact actor `{ seat: "eye", provider: "human", model: "eye-record-v1" }`, and rejects extras. `verifyEyeAuthorityAtPrefix` performs no cryptography; replay calls it only after static verification and supplies the already-derived prefix state/root. It requires `artifact.prefix_root` to equal the lifecycle root immediately before this decision, enforces globally unique `authority_id` and one-time `authority_ref` use across the entire history, and checks the exact action/stage/subject/requirement/policy semantics below:

| Node/stage | authority.action | Exact subject |
|---|---|---|
| requirements-freeze | freeze-requirements | requirement_root |
| eye-plan-authorization | authorize-plan | current plan root |
| eye-implementation-acceptance | accept-implementation | current `dfm.implementation.v1` artifact ref |
| eye-pause | pause | current lifecycle root |
| eye-cancel | cancel | current lifecycle root |
| eye-amend with mutation_kind requirement | amend-requirement | new requirement root |
| eye-amend with mutation_kind policy | amend-policy | new policy root |
| eye-adjudicate | adjudicate | paused lifecycle root |

The authority artifact's `scope`, `target`, `prefix_root`, `requirement_root`, and `policy_ref` are always checked even when the subject is a plan, implementation, or lifecycle root. Mutating away and back never permits reuse of an earlier authority ID or ref.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-journal.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-journal.mjs scripts/lifecycle-store.mjs scripts/lifecycle-operations.mjs scripts/lifecycle-authority.mjs tests/lifecycle-fixtures.mjs tests/test-lifecycle-journal.mjs tests/test-lifecycle-store.mjs tests/test-lifecycle-operations.mjs tests/test-lifecycle-authority.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: add crash-atomic signed lifecycle journals"
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

Create `tests/test-lifecycle-engine.mjs` using `loadProfile()`, `profileRef()`, `unsignedDecision()`, `signDecision()`, and `decisionRef()` to build entries without disk I/O. Include these exact negative and positive cases:

- `P2` entry while state is at `P1` throws `decision stage p2-plan-adversarial does not match active stage p1-plan-pair`.
- A single Daedalus `P1` pass does not advance; the independent Icarus pass against the same `stage_base_hashes` advances to `P2`.
- Icarus cannot supply Grok's `P2` decision; it throws `seat icarus is not required at p2-plan-adversarial`.
- Table-test every producing path (model adapter, disk verifier, retrospective, and Eye action): a literal `pass` with any finding or disposition is invalid before state change. The reducer independently requires both arrays empty even after upstream schema/replay validation.
- `plan-draft` rejects zero or multiple outputs and promotes exactly one stored canonical `{ kind: "candidate", plan }` ref only after Daedalus passes, setting the next stage's `artifact_hash` to that ref. `code-draft` rejects zero or multiple outputs, wrong kind/lifecycle, an unresolved tree ref, or `plan_root !== authorized_plan_root`, and promotes exactly one stored `dfm.implementation.v1` ref plus its embedded tree ref only after Icarus passes, setting the next stage's `artifact_hash` to the implementation ref. Every other ordinary stage rejects any output ref.
- At both producing stages, assert the entry's `artifact_hash` remains the pre-transition `state.artifact_hash`, never the output ref. A non-pass may name the already validated singleton output but does not promote it; Task 6/8 integration tests cover matching provenance and operation subjects.
- A Grok `non-pass` at `P2` moves to `daedalus-recovery`, retains every stage entry as heads, and sets `return_stage` to `p1-plan-pair`.
- A Daedalus `retry` recovery has zero outputs, grows the DAG, keeps the exact artifact root, and re-enters the failed stage's profile-declared `reentry_stage`. It cannot clear or manufacture an authority root.
- A Daedalus plan `mutation` has exactly one typed plan-candidate output, changes both `effective_plan_root` and the re-entered P1 `artifact_hash`, clears implementation state and `authorized_plan_root`, and re-enters `P1`; old `P1`/`P2`/Eye passes cannot satisfy the descendant plan.
- A `C2` non-pass followed by recovery re-enters `C1` while preserving `authorized_plan_root` and invalidating implementation-stage completions.
- An explicit implementation mutation at `C1`, `C2`, disk truth, Eye acceptance, or retrospective sets `effective_implementation_root` and the re-entered C1 `artifact_hash` to the new `dfm.implementation.v1` artifact ref and `effective_implementation_tree_root` to its embedded `tree_root`; it preserves the exact authorized plan root, clears `accepted_implementation_root`/`disk_truth_tree_root`, and re-enters `C1`.
- Attempting `code-draft` before fresh `P1`/`P2`/Eye authorization after a plan mutation fails as `stale plan authorization`; attempting retrospective/closure after implementation mutation fails as `stale implementation acceptance`.
- A disk-truth entry requires `input_refs === [effective_implementation_root]`, `output_refs === []`, and `evidence_refs === uniqueSort([manifest_ref, ...command_evidence_refs])`. Exactly one evidence ref resolves to a same-lifecycle `dfm.tree-manifest.v1`; every other direct evidence ref resolves to a same-lifecycle `dfm.command-evidence.v1` whose `cwd_ref` equals that manifest ref and whose stdout/stderr refs resolve to implementation-bound raw-evidence envelopes. Missing, extra, duplicate, wrong-kind/lifecycle/subject/cwd, ambient-only, stale-pass, or altered refs reject before state change.
- A disk-truth pass requires the named manifest ref to equal `effective_implementation_tree_root` and every named command to have status 0/null signal, then and only then sets `disk_truth_tree_root`. A tree mismatch or command failure must be non-pass with the same complete evidence refs and exact required finding code, routes to Daedalus, and never sets `disk_truth_tree_root`.
- `eye-pause`, `eye-cancel`, `eye-amend`, and `eye-adjudicate` require seat Eye and a preverified authority ref. Pause records `paused_stage_id`; adjudication can resume only that same stage, not a disposition-selected arbitrary stage. Requirement amendment updates the exact requirement root, sets the re-entered plan-draft `artifact_hash` to that root, and invalidates all plan/implementation gates. Policy amendment updates the exact policy root, sets the re-entered requirements-freeze `artifact_hash` to the current requirement root, and invalidates every prior gate.
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
7. Recovery requires Daedalus, pass, and parents equal to every failure head. `transition.kind === "retry"` requires zero outputs and leaves all governed roots unchanged. It returns to the saved profile-declared `return_stage`, never an arbitrary target; therefore a P2 retry re-enters P1 and a C2 retry re-enters C1. The recovery ref becomes the sole base/head and approvals from that return stage onward are cleared.
8. `transition.kind === "mutation"` requires exactly one typed output different from the current root and `mutation_kind` matching the current artifact domain. A plan mutation sets both `effective_plan_root` and the re-entered P1 `artifact_hash` to `output_ref` and clears all implementation/tree/disk/acceptance roots. An implementation mutation resolves its one output as a closed `dfm.implementation.v1`, requires `artifact.plan_root === authorized_plan_root`, sets both `effective_implementation_root` and the re-entered C1 `artifact_hash` to `output_ref` plus `effective_implementation_tree_root = artifact.tree_root`, preserves plan authorization, and clears `disk_truth_tree_root`/`accepted_implementation_root`. Retrospective recovery cannot bypass that.
9. Passing plan draft sets both `effective_plan_root` and the next state's `artifact_hash` to its verified candidate output ref; Eye plan authorization stores that exact plan root. Passing code draft sets the next state's `artifact_hash` to its verified implementation output ref and stores that ref plus its embedded tree ref in the two distinct implementation state fields. The producing decision's own `artifact_hash` remains the prior requirement/authorized-plan subject during application; only successful promotion changes state for the next stage. At `disk-truth`, require exact `input_refs: [effective_implementation_root]` and `output_refs: []`; classify only the node's direct `evidence_refs`, requiring exactly one manifest and treating every other ref as command evidence. Resolve the manifest, every command evidence, and each command's stdout/stderr raw-evidence refs from the supplied verified artifact map; require exact lifecycle, manifest hash/ref, `cwd_ref`, and implementation subject bindings. Ignore every artifact not reachable through those decision refs. Re-derive pass/non-pass from manifest equality and command statuses; require exact empty findings on pass, or the exact ordered mismatch-then-command-failure findings with their manifest/command singleton evidence refs and no additions on non-pass. Set `disk_truth_tree_root = manifest_ref` only on pass. A valid non-pass retains the complete direct evidence refs but leaves `disk_truth_tree_root` unchanged before the general non-pass recovery transition. Eye implementation acceptance binds and stores `effective_implementation_root`, the implementation artifact ref, never the tree ref.
10. An Eye action requires `transition.kind === "eye-action"`, a non-null preverified authority ref, parents equal to current `heads`, and the matching authority action. It makes the Eye-action ref the sole base/head and clears partial stage entries, so no pre-action partial approval survives. Pause stores the current stage in `paused_stage_id`; cancel alone sets cancelled. Adjudicate works only from paused and resumes `paused_stage_id`; `target_stage` must equal that saved stage. It cannot skip or mark gates complete.
11. Eye requirement amendment requires one same-lifecycle `dfm.requirement.v1` output, updates both `requirement_root` and the re-entered plan-draft `artifact_hash` to its ref, clears every plan/implementation authority and completion, and enters plan draft. Eye policy amendment requires one same-lifecycle `dfm.policy.v1` output, updates `policy_ref`, sets the re-entered requirements-freeze `artifact_hash = requirement_root`, clears all completion/authority state, and enters requirements freeze. Other Eye amendments are rejected; plan and implementation changes use governed Daedalus mutation transitions.
12. Closure requires the completed ordered path, a literal retrospective pass, `authorized_plan_root === effective_plan_root`, `accepted_implementation_root === effective_implementation_root`, and independently `disk_truth_tree_root === effective_implementation_tree_root`. The implementation artifact ref and tree ref must both be non-null and must not be required to equal each other. Only then set closed.

Use this exact lineage table as an implementation oracle:

| Event | stage_base_hashes | stage_entries | heads |
|---|---|---|---|
| create | [] | [] | [] |
| first required-seat pass R1 from base B | B | [R1] | [R1] |
| second required-seat pass R2 from same B and advance | sort([R1,R2]) in next stage | [] | sort([R1,R2]) |
| non-pass F after prior stage entry R | sort([R,F]) in recovery | [] | sort([R,F]) |
| retry recovery D | [D] in saved profile reentry stage | [] | [D] |
| mutation recovery M | [M] in required P1 or C1 | [] | [M] |
| Eye action E without stage advance | [E] | [] | [E] |

- [ ] **Step 4: Run engine, store, profile, and core tests**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
```

Expected: every lifecycle test passes with 0 failures.

- [ ] **Step 5: Commit**

```bash
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-engine.mjs tests/test-lifecycle-engine.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: enforce pass-or-return lifecycle transitions"
```

### Task 5: Disk-Only Replay as the Sole Derived State

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-replay.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs`

**Interfaces:**
- Consumes: `verifyLifecycleStore`, `verifyOperationsLog`, canonical lifecycle/operation bytes, typed artifacts, validated profile, the immutable lifecycle config and its pinned Eye trust/target, and `applyDecision`.
- Produces: `replayLifecycleStore({ dir, profile }): ReplayResult` and pure `validateOperationIntentAtState({ state, profile, operation, readArtifact }): void`. Replay accepts no caller trust, target, state, root, evidence, completion, or export fields.

`ReplayResult` is a closed frozen value:

```js
{
  replay_version: "dfm.replay.v1",
  lifecycle_id: "life-...",
  profile_ref: "sha256:...",
  state: LifecycleState,
  decision_refs: ["sha256:..."],
  heads: ["sha256:..."],
  lifecycle_root: "sha256:...",
  evidence_refs: ["sha256:..."],
  provenance_refs: ["sha256:..."],
  authority_refs: ["sha256:..."],
  operation_refs: ["sha256:..."],
  operation_attempts: [{ attempt_ref: "sha256:...", state: "settled" | "prepare_missing" | "decision_missing" | "terminal_missing", started_ref: "sha256:...", prepared_ref: null | "sha256:...", stage: "stage-id", transition: { kind: "decision" | "retry" | "mutation", mutation_kind: null | "plan" | "implementation", target_stage: null }, seat: "seat-id", provider: "provider-id", model: "model-id", request_ref: "sha256:...", subject_ref: "sha256:...", input_refs: ["sha256:..."], output_refs: ["sha256:..."], decision_ref: null | "sha256:..." }],
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
14. exercise all three recovery prefixes across fresh processes. For start-only, delete the external request file and caller state; replay still projects `prepare_missing` from the signed request body and recovery yields one byte-identical request/provenance/death decision/terminal with no provider call. Prepared/partial state completes committed bodies; decision/no-terminal adds only terminal. Tampering with start request body/ref/intent, prepared commitment, reservation, or body fails before settlement;
15. verify no private key or provider credential is needed for read-only replay.
16. table-test `validateOperationIntentAtState` for required singleton candidate/implementation outputs, forbidden review-stage outputs, Daedalus retry zero-output, dedicated mutation singleton output, exact active stage/required seat/pre-transition subject, same-lifecycle implementation/tree, and current authorized plan binding. Require the exact `OUTPUT_ARTIFACT_*` and `RECOVERY_REQUIRES_DEDICATED_PATH` failures used by the controller.

- [ ] **Step 2: Run the test and confirm the replay module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-replay.mjs`.

- [ ] **Step 3: Implement deterministic replay**

Implement `scripts/lifecycle-replay.mjs` in this exact order:

`validateOperationIntentAtState` is the one shared pure route/output validator used by replay and controller preflight. It requires operation lifecycle/stage/required seat/pre-transition subject to equal the supplied state/profile; ordinary decision intent is forbidden at `daedalus-recovery`; plan/code drafts require the exact stored singleton and bindings defined in Task 4; every other ordinary stage requires no output; Daedalus retry requires none; and Daedalus mutation requires one stored artifact of the declared mutation kind, including same-lifecycle/current-plan implementation bindings. It performs only reads and throws the exact controller error codes defined in Task 8.

1. read `lifecycle.json`, pinned Eye-trust bytes, and controller public-key bytes; require exact canonical regular non-symlink files, closed keys/version, matching content refs, the supplied profile ref, and the persisted exact target `{ kind: "checkout", path: realpath, task_range: "1-11" }`; accept no caller replacement;
2. call `verifyLifecycleStore`, then `verifyOperationsLog` over the same verified decision/provenance view. Verify every start's canonical request body/ref and intent even when its request artifact is not yet materialized; prepared/settled attempts additionally require materialized request bytes to equal start. Do not trust cached results;
3. create state only from the lifecycle manifest's initial requirement/policy values;
4. iterate the verified decision chain by signed journal index. For each entry build a read-only artifact map from only its `artifact_hash`, request/input/output/provenance/evidence/authority/policy refs and the transitive refs mandated by those closed artifacts; never add an unreferenced store artifact. For each model entry, find its one signed start/prepared attempt, recompute the non-circular prepared commitment, require exact materialized bodies and decision reservation, call `validateOperationIntentAtState` against the current prefix state, then bind node stage/transition/input/output and provenance to that signed intent/profile/current pre-transition subject. Literal pass again requires empty findings/dispositions. For disk truth, the sole named manifest and command evidence—not any ambient manifest—are the only candidates the reducer can resolve. For Eye entries compute the prefix lifecycle root from only earlier entries and call `verifyEyeAuthorityAtPrefix` with current state/node/root and the pinned lifecycle config/trust; then and only then call `applyDecision(state, entry, profile, artifacts)`;
5. after every transition require reducer heads to equal the DAG leaves derived from the prefix just replayed;
6. derive decision/provenance/authority/evidence sets exclusively from visited disk entries, unique-sort them, and compare final heads/root to full-store verification;
7. for any `prepare_missing`, `decision_missing`, or `terminal_missing` attempt, supply the verified signed-start request body to `validateOperationIntentAtState`, recompute its ref/intent, and reject drift before exposing settlement. Project attempts/pending directly from `verifyOperationsLog`, project lifecycle fields from final state/static verification, deep-freeze, and return. Operation records and embedded start bodies do not enter lifecycle root, heads, completed stages, evidence, or authority arrays.

Replay performs no writes, provider calls, clock reads, random generation, Git commands, environment lookups, or export construction. Any mismatch includes the physical record/ref and fails; it never skips, repairs, reorders, defaults, or substitutes a seat.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-replay.mjs tests/test-lifecycle-replay.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: replay lifecycle state from disk"
```

Expected: every replay/store/operation/engine/authority test passes with zero failures.

### Task 6: Provider Seat Adapter Boundary

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-seat-adapter.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs`

**Interfaces:**
- Consumes: closed typed-artifact helpers, profile seat records, canonical bytes of one closed `dfm.seat-request.v1`, and an injected `invoke(requestBytes): Promise<Buffer>` transport.
- Produces: `invokeLifecycleSeat(options): Promise<{ decision, artifacts }>` where the adapter re-derives `request_ref` from exact validated bytes, `decision` is unsigned, and `artifacts` contains only validated provenance/provider-evidence envelopes. The request body is already committed by signed start and is not duplicated in adapter output. Raw transport output is never returned or persisted.

The accepted successful `SeatResponse` shape is closed; its verdict is `pass` or `non-pass`. A provider refusal uses the same keys with verdict `refuse` and is mapped to a lifecycle non-pass:

```js
{
  provider: "openai",
  model: "recorded-per-call",
  response_id: "provider-issued-id",
  verdict: "pass",
  findings: [],
  dispositions: [],
  evidence_status: "complete",
  evidence: []
}
```

Transport framing is exact: stdin is the canonical seat-request bytes followed by one `\n`; stdout is exactly one canonical JSON object followed by one `\n`, at most 1 MiB total; stderr must be empty and exit status zero. The provider response accepts only the seven keys shown above. `evidence_status` is `complete` or `truncated`; evidence has at most 32 unique closed summaries, each at most 4096 UTF-8 bytes. No request ref, provider, model, stage, subject, or output choice is accepted independently from the request artifact.

- [ ] **Step 1: Write failing adapter tests**

Create `tests/test-lifecycle-seat-adapter.mjs` with these cases:

1. canonical request bytes reloaded from a signed-start fixture for Icarus produce actor `{ seat: "icarus", provider: "openai", model: "gpt-test" }`, the same internally derived request ref, hashed provenance/evidence, and literal pass with empty findings/dispositions; adapter artifacts do not duplicate the request body;
2. a thrown `invoke` error produces verdict `non-pass`, finding code `PROVIDER_DIED`, and `status: "failed", response_id: null` provenance instead of throwing;
3. a missing/blank response ID produces failed provenance and non-pass findings `PROVIDER_DIED` plus `INVALID_PROVENANCE`, so terminal derivation is unambiguous;
4. a complete result claiming provider `xai` or another model for the Icarus/OpenAI request produces rejected provenance plus `PROVIDER_MISMATCH` or `MODEL_MISMATCH`, never changes the actor seat/model, and derives `invocation-finished`;
5. a provider refusal produces issued provenance plus `PROVIDER_REFUSED` non-pass and therefore derives `invocation-finished`;
6. a public evidence summary containing a credential is rejected and replaced by a typed `CREDENTIAL_REJECTED` non-pass finding; the credential and a redacted surrogate are both absent from all returned artifacts;
7. a complete response with chain-of-thought/private-reasoning or any unknown field is not repaired by projection: it produces rejected provenance plus `MALFORMED_RESPONSE`; the raw/forbidden field is discarded and absent from every artifact/journal/error;
8. every issued pass/non-pass/refusal and rejected complete mismatch derives finished; every failed provenance includes `PROVIDER_DIED` and derives died; inconsistent provenance/finding pairs are rejected;
9. controller-supplied `artifactHash`, `inputRefs`, `outputRefs`, and transition are reproduced exactly in the unsigned decision and cannot be supplied or changed by provider output. With one candidate output, assert decision/provenance subject equals the pre-transition requirement ref and is unequal to the candidate ref; with code draft, assert the subject is the authorized plan ref and is unequal to the implementation ref.
10. request bytes with noncanonical JSON, trailing bytes, unknown keys, wrong lifecycle/stage/seat/provider/model/subject/input/output, more than 16 KiB, or an instruction longer than 8192 bytes reject before transport/signer/journal/temp/lock activity. There is no independent caller `request_ref` or model to disagree with them;
11. exact framing tests cover missing/extra newline, multiple JSON values, noncanonical response bytes, stderr, nonzero exit, response larger than 1 MiB, 33 evidence items, overlong summaries, and `evidence_status: "truncated"`. A fully parseable valid-identity truncated response discards all partial evidence, emits issued provenance plus only `TRUNCATED_EVIDENCE`, and finishes non-pass. An incomplete/oversize/unparseable frame discards all partial evidence, emits failed provenance plus `PROVIDER_DIED` and `TRUNCATED_EVIDENCE`, and dies;
12. a response claiming `pass` with any finding or disposition becomes the deterministic non-pass `PASS_HAS_OBJECTIONS`; it can never publish literal pass.

- [ ] **Step 2: Run the test and confirm the adapter is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-seat-adapter.mjs`.

- [ ] **Step 3: Implement the injected adapter**

`invokeLifecycleSeat` must accept `{ lifecycleId, profile, seat, requestBytes, transition, artifactHash, parentHashes, policyRef, attemptRef, invoke, recordedAt }`. It must parse and validate the request artifact once, require canonical byte equality, derive `requestRef = sha256BytesRef(requestBytes)`, and:

- reject an unknown seat before calling the provider;
- call only the injected byte transport and never read provider API keys;
- require request lifecycle/stage/seat/provider/model/subject/input/output fields to equal the replay/profile/controller intent before any invocation;
- validate exact response framing, closed keys, and reported provider/model against the request/profile;
- convert outages, malformed responses, provider mismatches, truncated evidence, and invalid provenance to non-pass findings rather than exceptions;
- require a unique SHA-256 `attemptRef` supplied by the controller; provider/model come only from the validated request;
- create provenance bound to lifecycle, seat, attempt, internally derived request ref, subject, source, and timestamp. A complete matching response is `issued`; a complete response with reported provider/model mismatch is `rejected` with null validated fields and exact reported fields; transport/incomplete/unparseable failure is `failed` with all response/provider/model fields null and `PROVIDER_DIED`;
- create only closed bounded public evidence summaries and use their refs in the decision; credential-bearing evidence becomes `CREDENTIAL_REJECTED` and is not redacted into storage;
- parse only within the byte bound, validate the exact closed response before constructing artifacts, and never repair unknown fields by projection. A complete identifiable but closed-schema-invalid response is rejected with `MALFORMED_RESPONSE`; raw chain-of-thought/private-reasoning and all original response bytes are discarded and never hashed, logged, returned, or persisted;
- set actor seat/provider/model from the validated request/profile, never from provider output;
- require controller-supplied `transition` to be one of the exact closed ordinary decision, Daedalus retry, or Daedalus mutation shapes; copy it, `artifactHash`, `inputRefs`, and `outputRefs` exactly into the unsigned decision, and never accept any of them from provider output. The public ordinary controller path always supplies `transition.kind = "decision"`; only the dedicated recovery/mutation paths can supply the other two;
- return a Task-1-valid unsigned decision node with `authority_ref = null`, `operation_prepared_ref` left for the prepared-commitment builder, and `recorded_at = recordedAt` supplied by the controller. Provenance/request `subject_ref` and node `artifact_hash` all equal the pre-transition `artifactHash`; neither ever equals an authoring-stage output merely because that output may be promoted after a pass. Literal pass is emitted only for a complete issued response with empty findings/dispositions and complete evidence.

Use the Task 1 closed finding shape. Allowed adapter codes are `PROVIDER_DIED`, `PROVIDER_REFUSED`, `MALFORMED_RESPONSE`, `INVALID_PROVENANCE`, `PROVIDER_MISMATCH`, `MODEL_MISMATCH`, `TRUNCATED_EVIDENCE`, `PASS_HAS_OBJECTIONS`, and `CREDENTIAL_REJECTED`.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-seat-adapter.mjs tests/test-lifecycle-seat-adapter.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: normalize lifecycle seat outcomes"
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
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-disk-truth.mjs tests/test-lifecycle-disk-truth.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: re-derive lifecycle disk truth"
```

Expected: all disk-truth/core tests pass; no shell or live provider is used.

### Task 8: Resumable Serialized Production Controller and CLI

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-controller.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-cli.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs`

**Interfaces:**
- Consumes: the store/replay/profile/adapter/disk-truth modules, `signer`, injected byte-framed `seatInvoker`, and optional test-only `diskTruthDeriver` defaulting to Task 7 `deriveDiskTruth`. Eye trust and exact target are accepted only by initialization and thereafter loaded from immutable lifecycle storage.
- Produces: `createLifecycleController({ dir, profile, signer, seatInvoker, diskTruthDeriver = deriveDiskTruth, clock }): Controller`, plus CLI commands `init`, `status`, `resume`, `ingest-artifact`, `invoke-seat`, `recover`, `mutate`, `eye-action`, `verify-disk`, `record-retrospective`, and `export`. There is no generic CLI decision-ingest command; production CLI never supplies the test seam.

Controller methods have three disjoint production invariants:

1. `initialize` requires a nonexistent or empty runtime directory, acquires an exclusive sibling init lock, writes immutable canonical configuration/trust/requirement/policy artifacts with exclusive creates and fsync, then performs the first replay. It appends no decision and never calls replay before the genesis files exist.
2. `ingestArtifact` acquires the operation lock, replays before, writes one canonical typed artifact, replays after, and requires lifecycle state/root/decision count to remain byte-identical. Artifact availability is not a decision.
3. Model transitions first perform read-only replay and exact canonical request/route/output preflight. Invalid input returns before provider/signer invocation, lock creation, artifact/journal mutation, or any runtime byte change. A valid request is embedded as the exact body/ref in the signed start that contends for journal CAS. Only the winner reloads those bytes from the verified start and invokes the provider. It then publishes one request-bound prepared commitment, materializes committed public artifacts, publishes exactly one reserved decision, derives/publishes one terminal, and replays. Fresh-process settlement handles all pending states without provider reinvocation or caller request state.

Read-only `status`/`handoffPreflight` only replay. Task 9's bundle builder, tests, and demo call that same projection.

- [ ] **Step 1: Write controller/CLI failure-first tests**

Create `tests/test-lifecycle-controller.mjs` using temporary directories, an external signer double that exposes only `sign(bytes)`, and injected provider doubles. Cover:

1. `init` rejects a non-empty directory and concurrent initializer, writes canonical immutable lifecycle/public-key/Eye-trust/typed requirement/policy files under an exclusive init lock, appends zero decisions, then succeeds only after its first replay reports requirements-freeze;
2. `ingestArtifact` replays before/after, returns the canonical artifact ref, invokes no lifecycle signer, appends zero decisions, and leaves state, heads, lifecycle root, and decision count unchanged; malformed/non-canonical artifacts fail before write;
3. ingest a canonical plan candidate, invoke Daedalus at `plan-draft` with its exact `outputArtifactRef`, and prove replay promotes that ref to `effective_plan_root` while operation/node/provenance subject remains the pre-transition requirement root. Later ingest a matching tree manifest and `dfm.implementation.v1`, invoke Icarus at `code-draft` with the implementation ref, and prove replay promotes the implementation/tree refs while all three subject bindings remain the pre-transition authorized plan root;
4. restart after partial P1, invoke Icarus with `outputArtifactRef: null`, restart again, and require P2 with exact replayed bases/heads;
5. table-test ordinary invocation with missing output at `plan-draft`/`code-draft`, output at a non-producing stage, wrong kind, wrong lifecycle, unresolved ref, implementation with stale `plan_root`, unresolved/wrong-lifecycle tree, array/second output, repeated CLI output flag, and unknown output argument. Each must fail during read-only preflight. Snapshot replay, the complete runtime tree and exact bytes including lock absence, and signer/invoker counts before/after and require byte-for-byte identity;
6. launch two `invoke-seat` commands concurrently for Grok/Gemini: one holds the operation lock, the other exits with `lifecycle write already in progress`; after the first finishes, the second succeeds and both decisions parent the same P2 base;
7. every successful ordinary transition increases lifecycle decision count by exactly one. `prepare_missing` recovery commits one deterministic death decision; `decision_missing` completes the already prepared exact decision; `terminal_missing` adds zero decisions because it cross-links the persisted match. In all cases a settled attempt links exactly one lifecycle decision;
8. inject process kill immediately after signed start, delete the external request file and all caller state, and resume fresh. Recovery must reload the exact request only from start, make zero provider calls, and converge on one byte-identical materialized request/provenance/death decision/terminal. Repeat after prepared publication, every prepared typed/raw write, decision publication, and before/after terminal. Issued pass/refusal/non-pass, rejected provider/model mismatch, issued truncation, and failed `PROVIDER_DIED` retain the same total mapping;
9. public `invokeSeat` at `daedalus-recovery` rejects with `RECOVERY_REQUIRES_DEDICATED_PATH`. `recover --retry` keeps the artifact and has zero outputs; dedicated plan/implementation `mutate` validates and ingests its one typed artifact, then passes its ref only through the internal mutation attempt. Implementation mutation stores a `dfm.implementation.v1` ref plus its distinct embedded tree ref;
10. `eye-action` rejects a controller signature without trusted signed authority and rejects prefix action/scope/target/root mismatch;
11. exact `verifyDisk` happy path: compare the checkout only to the current implementation artifact's embedded tree ref; persist and reread every predicted raw-evidence envelope, the one manifest, and all command evidence; append exactly one disk decision with `artifact_hash === implementationRef`, `input_refs === [implementationRef]`, `output_refs === []`, and `evidence_refs === uniqueSort([manifestRef, ...commandEvidenceRefs])`. Require every command `cwd_ref === manifestRef`, nested raw envelope subject equals implementation ref, pass sets `disk_truth_tree_root = manifestRef`, and replay/export evidence contains every direct ref;
12. run tree-mismatch and command-failure non-pass cases. Persist the same complete evidence set, require exact finding codes, append one non-pass, route to Daedalus, and prove `disk_truth_tree_root` remains unset;
13. inject disk-derivation results with missing/wrong-kind/wrong-lifecycle/stale/ambient-only manifest, wrong command kind/lifecycle/cwd/subject/status/stdout/stderr ref, altered/duplicate/extra/omitted evidence refs, or pass over mismatch/failure. `verifyDisk` must return `DISK_TRUTH_EVIDENCE_INVALID` before artifact persistence, signer call, decision append, or collaborator-visible output. Snapshot replay, complete runtime bytes including lock absence, artifact inventory, and signer/invoker counts before/after and require exact identity; a suitable pre-existing ambient manifest never repairs the result;
14. call controller `appendDecision` directly with Daedalus, Icarus, Grok, Gemini, Eye, or a disk-truth actor. It must reject before artifact resolution/write, signer call, lock acquisition, decision append, or operation append. Snapshot replay state, the complete runtime directory tree and exact bytes (including absence of lock files), signer/invoker call counts, and artifact filenames/bytes before/after and require identity;
15. `recordRetrospective` is the sole allowed controller-only append path. A direct lookalike retrospective passed to `appendDecision` without the controller's unexported route capability also rejects with the same exact no-change assertion. Eye uses `applyEyeAction`, disk truth uses `verifyDisk`, and all four model seats—including Daedalus recovery/mutation—use the shared capability-gated internal `invokeSeat` transaction with signed request-bearing start/prepared/terminal records;
16. corrupt/swap/delete/duplicate lifecycle or operation records, orphan a terminal, duplicate an attempt, or drift start/prepared/terminal bindings; status/resume must fail through replay or expose only `prepare_missing`, `decision_missing`, or `terminal_missing` before any provider call;
17. inspect runtime files and injected inputs for private keys, credentials, raw prompts/responses, or private reasoning;
18. spawn status and resume in separate Node processes to prove process-local memory is unnecessary;
19. race two controllers and two stale-lock resumers at one next index. Exactly one journal CAS winner invokes the provider and publishes the chain; losers replay, never unlink a newer lock, and never publish a second attempt;
20. return wrong-key, wrong-key-ID, noncanonical base64url, wrong-length, and invalid signature bytes from the signer for every record kind. Each fails in memory before any temp/final/artifact/journal mutation;
21. drive noncanonical request bytes, model/request mismatch, provider/model response mismatch, every truncation framing case, and pass-with-objections through both API and CLI; all preflight failures preserve the complete runtime tree and collaborator counts byte-for-byte;
22. use a post-start test hook to mutate the caller Buffer and delete its source file before provider invocation. The provider must receive a distinct Buffer byte-equal to `canonicalBytes(verifiedStart.request_artifact)`; caller mutation cannot change transport bytes, request ref, prepared commitment, or recovery output.

- [ ] **Step 2: Run the test and confirm the production modules are missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-controller.mjs`.

- [ ] **Step 3: Implement controller serialization and restart semantics**

`createLifecycleController` exposes:

```js
{
  initialize({ lifecycleId, requirement, policy, controllerPublicKey, controllerKeyId, eyeTrust, target }),
  status(),
  resume({ settlePendingAttemptRef }),
  ingestArtifact({ artifact }),
  invokeSeat({ requestBytes, attemptRef, outputArtifactRef = null, recordedAt }),
  appendDecision({ unsignedDecision }),
  recover({ mode: "retry", requestBytes, attemptRef, recordedAt }),
  mutate({ kind: "plan" | "implementation", artifact, requestBytes, attemptRef, recordedAt }),
  applyEyeAction({ authorityArtifact, recordedAt }),
  verifyDisk({ checkout, commands, recordedAt }),
  recordRetrospective({ evidenceRefs, recordedAt }),
  handoffPreflight()
}
```

Rules:

- `initialize` alone uses `<dir>.init.lock` with `openSync(..., "wx")`; it requires empty/nonexistent `dir`, creates each immutable file/artifact with `wx`, fsyncs files and directory, performs first replay, and removes the init lock in `finally`. A partial non-empty initialization fails closed for explicit operator recovery; it is never overwritten.
- `ingestArtifact` uses `operation.lock`, replay-before, `putArtifact`, replay-after, and an exact before/after comparison of state, heads, lifecycle root, and decision refs. It writes no operation or decision record and needs no signer.
- `status` and `handoffPreflight` return only disk ReplayResult projections, including operation attempts/pending. `resume` selects a pending item only from replay; it never scans journal directories separately. Ordinary transitions publish exactly one lifecycle decision; operation records never satisfy a gate.
- `invokeSeat` accepts the exact closed option keys shown above. Parse `requestBytes` once as exact canonical `dfm.seat-request.v1`, derive its ref internally, and reject noncanonical/oversize/secret-bearing bytes or lifecycle/stage/seat/provider/model/subject/input/output drift before provider/signer/lock/write. The request's `output_refs` must equal `outputArtifactRef === null ? [] : [outputArtifactRef]`. Unknown `requestRef`, `requestedModel`, `ephemeralRequest`, `outputRefs`, `outputArtifact`, second-output, or route/transition keys fail with complete zero-change. Preserve exact `OUTPUT_ARTIFACT_REQUIRED`, `OUTPUT_ARTIFACT_FORBIDDEN`, `OUTPUT_ARTIFACT_CARDINALITY`, `OUTPUT_ARTIFACT_UNKNOWN`, `OUTPUT_ARTIFACT_KIND_MISMATCH`, `OUTPUT_ARTIFACT_LIFECYCLE_MISMATCH`, `OUTPUT_ARTIFACT_TREE_INVALID`, and `OUTPUT_ARTIFACT_STALE_PLAN` errors.
- After read-only preflight and a second replay, construct start with the exact parsed request body and internally derived ref, validate the body/ref/intent equality, and publish by exclusive journal CAS. Immediately discard caller bytes, reload/verify the winning signed start from disk, derive canonical request bytes from its body, and pass only those bytes to `invokeLifecycleSeat`. For every stage, signed start/prepared/terminal subject, request/provenance subject, lifecycle node artifact hash, and replay-before governed root agree; authoring output is never an operation subject.
- Controller `appendDecision` is an exposed-but-fail-closed wrapper, not a generic routing API. Implement closure-local `const RETROSPECTIVE_ROUTE = Symbol("record-retrospective")` and `appendDecisionInternal({ unsignedDecision, routeCapability })`. Internal append requires `routeCapability === RETROSPECTIVE_ROUTE` plus the one exact tuple `{ actor: { seat: "telos-controller", provider: "local", model: "lifecycle-controller-v1" }, stage: "iliad-retrospective", transition: { kind: "decision", mutation_kind: null, target_stage: null } }`. The decision must also have null provenance/authority, no output refs, and artifact hash equal to the replayed implementation artifact ref. `recordRetrospective` alone closes over and supplies the symbol while deterministically constructing the unsigned node. The public `appendDecision({ unsignedDecision })` wrapper calls the internal function with no capability; caller input can never serialize, reconstruct, or supply it.
- Classify and reject disallowed actor/stage/transition tuples before checking route capability or resolving/writing artifacts, calling a signer/invoker, acquiring any lock, or publishing to either journal. Any model seat returns `MODEL_DECISION_REQUIRES_INVOKE_SEAT`; Eye returns `EYE_ACTION_REQUIRES_AUTHORITY_PATH`; local disk truth returns `DISK_TRUTH_REQUIRES_VERIFY_DISK`; a direct retrospective lookalike without the capability returns `CONTROLLER_ACTION_REQUIRES_DEDICATED_PATH`. Every rejection leaves the complete runtime tree and injected collaborator counts byte-for-byte unchanged.
- `invokeSeat`, `applyEyeAction`, and `verifyDisk` never call the public wrapper or capability-gated retrospective closure. After their own model-operation, authority, or disk-verification checks respectively, each may call only the Task 3 storage primitive inside its dedicated locked transaction. `recordRetrospective` is the sole caller of `appendDecisionInternal` with `RETROSPECTIVE_ROUTE`, so there is no alternate model, Eye, disk, or local-controller route.
- Implement one capability-gated internal `invokeSeat` transaction taking the controller-selected transition and validated output refs. The public `invokeSeat` wrapper can select only the ordinary decision transition and rejects active `daedalus-recovery` with `RECOVERY_REQUIRES_DEDICATED_PATH`. `recover` alone holds the retry-route capability and selects Daedalus retry with zero outputs. `mutate` alone holds the mutation-route capability, validates and ingests its canonical plan/implementation artifact, then selects the matching Daedalus mutation transition with exactly that stored ref; it never routes the artifact through ordinary `outputArtifactRef`. All model decisions therefore still enter through one `invokeSeat` transaction with signed operation start/terminal records and the pre-transition operation subject, while caller input cannot forge recovery modes.
- Before publishing an Eye transition, `applyEyeAction` loads only the pinned persisted trust/target, enforces the exact Eye actor, unique authority ID/ref, and `prefix_root === replayBefore.lifecycle_root`, then runs static and prefix-semantic verification. Replay-after repeats the check from disk; caller trust/target substitution and semantically wrong signed authority never publish.
- Use `operation.lock` only as a diagnostic optimization. Record a random ownership token plus PID, and unlink only after rereading the identical token. No timeout, stealing, absent-PID cleanup, or stale-lock removal grants authority; a resumer with a dead recorded PID still contends through journal CAS and cannot unlink a replacement lock. Signed index/predecessor publication is the only serialization fence.
- Every production decision route—including Eye, disk truth, retrospective, recovery, and model invocation—uses that one tokenized critical section and replays before publication; none may publish while replay exposes a pending model attempt. The journals remain authoritative: bypassing or losing the advisory lock cannot create two records at one signed index, and any cross-journal reservation drift fails closed as corruption. Race tests interleave every supported route at start/prepared/decision boundaries and prove one total recoverable transaction; CAS losers replay/resume the committed prefix, never call a provider twice, and never silently rebase a prepared decision.
- Use Task 3 journal primitives; never hand-build or tolerantly parse records. Normal order is: publish/fsync request-bearing start by CAS; reload its exact canonical request bytes and invoke once; construct provenance/evidence and exact unsigned decision; compute and publish/fsync the request-bound prepared commitment; materialize the start request and prepared bodies idempotently; validate signer output and publish the exact reserved decision; derive/publish terminal; replay. No final journal byte appears before signature/ref/state/predecessor validation in memory.
- Recovery never calls a provider. `prepare_missing` validates/reloads signed start request bytes and builds the deterministic failed-provenance `PROVIDER_DIED` commitment from that body. `decision_missing` completes the exact start-request plus prepared materialization and publishes the reserved decision. `terminal_missing` publishes only the total terminal. Missing caller files/memory cannot affect bytes or refs; CAS losers replay the winner and repeated processes converge byte-for-byte.
- Operation start/prepared/terminal records repeat lifecycle/stage/transition/seat/provider/model/attempt/request/pre-transition-subject/input/output bindings; prepared commits exact bodies/reservation and terminal names exact prepared/decision/provenance refs. They create no authority, never substitute for a lifecycle decision, never enter the lifecycle root, and never mutate governed artifacts.
- `verifyDisk` holds `operation.lock`, replays, resolves `replay.effective_implementation_root` as same-lifecycle `dfm.implementation.v1`, and passes `artifact.tree_root` only as `expectedTreeRoot` plus the artifact ref only as `implementationRef`. The deriver returns all evidence in memory and performs no write. Run `validateDiskTruthResult` with the exact original closed `commands` before calling the signer or store; invalid results throw `DISK_TRUTH_EVIDENCE_INVALID` and leave no lock/artifact/journal residue.
- After validation, persist each raw write through `putRawEvidence` and require its returned envelope/ref to equal the predicted bytes/metadata/artifact/ref; persist and reread the exact manifest and command evidence; reject any ref drift before decision signing. Construct the sole disk decision deterministically with actor `{ seat: "telos-controller", provider: "local", model: "lifecycle-disk-truth-v1" }`, current disk stage/base/policy, `artifact_hash: implementationRef`, `input_refs: [implementationRef]`, `output_refs: []`, `evidence_refs: result.evidence_refs`, null provenance/authority, and exactly the result verdict/findings. Both pass and non-pass carry the same complete evidence set. Call only the Task 3 storage primitive, then replay; pass must set `disk_truth_tree_root = result.manifest_ref`, while non-pass must route to Daedalus without setting it. No artifact-directory scan or newest/matching-manifest lookup is permitted.
- The production signer is injected. The CLI adapter is `--signer-command <absolute-executable>` plus repeated `--signer-arg`; spawn with `shell: false`, send base64 canonical bytes on stdin, accept exactly one canonical base64url signature line on stdout, and reject stderr/extra output/nonzero exit. Verify key ID, decoded length, signature, signed ref, state machine, and predecessor in memory before any temp/final publication. The executable owns key access; the plugin never receives key material.
- Provider transports use absolute command/no shell and the exact Task 6 byte framing: canonical seat-request bytes plus newline on stdin, exactly one bounded canonical response line on stdout, empty stderr, zero exit. Credentials remain in the child environment; raw provider output is parsed/projected then discarded.
- CLI JSON output is a closed public projection of replay state/refs/codes. Errors contain codes and paths/refs only, never artifact bodies, provider text, signer bytes, or environment values.

- [ ] **Step 4: Implement exact CLI commands and skill-safe syntax**

Use `parseArgs` from `node:util`; reject unknown flags and positional arguments. Commands are:

```bash
node "<plugin-root>/scripts/lifecycle-cli.mjs" init --dir <runtime-dir> --lifecycle-id <id> --requirement <typed-json> --policy <typed-json> --eye-trust <canonical-json> --target-path <absolute-path> --task-range 1-11 --controller-public-key <spki-der-base64> --controller-key-id <id>
node "<plugin-root>/scripts/lifecycle-cli.mjs" status --dir <runtime-dir>
node "<plugin-root>/scripts/lifecycle-cli.mjs" resume --dir <runtime-dir> --settle-pending-attempt <sha256-ref> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" ingest-artifact --dir <runtime-dir> --artifact <typed-json>
node "<plugin-root>/scripts/lifecycle-cli.mjs" invoke-seat --dir <runtime-dir> --request <canonical-seat-request-json> --attempt-ref <sha256-ref> [--output-artifact-ref <sha256-ref>] --transport-command <absolute-command> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" recover --dir <runtime-dir> --retry --request <canonical-seat-request-json> --attempt-ref <sha256-ref> --transport-command <absolute-command> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" mutate --dir <runtime-dir> --kind plan|implementation --artifact <typed-json> --request <canonical-seat-request-json> --attempt-ref <sha256-ref> --transport-command <absolute-command> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" eye-action --dir <runtime-dir> --authority <signed-typed-json> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" verify-disk --dir <runtime-dir> --checkout <absolute-path> --commands <typed-json> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" record-retrospective --dir <runtime-dir> --evidence <typed-json> --signer-command <absolute-command>
node "<plugin-root>/scripts/lifecycle-cli.mjs" export --dir <runtime-dir> --out <new-disjoint-bundle-dir>
```

JSON-file arguments name files, not inline JSON. Require regular non-symlink files and exact canonical bytes. `--request` is the closed seat-request artifact; `--request-ref`, `--model`, inline/raw prompt, and separate seat/provider/stage flags do not exist. Requirement/policy/artifact/authority files use Task 1 validation; `--eye-trust` is initialization-only; `--commands` uses Task 7 validation; retrospective evidence is a unique sorted ref list. `--output-artifact-ref` is one non-repeatable already-ingested ref, mandatory only for authoring stages and required to equal request `output_refs`; review stages forbid it. Governed recovery mutations use only `mutate --artifact`. `export --out` is a fresh physically disjoint bundle directory outside checkout/runtime.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-controller.mjs scripts/lifecycle-cli.mjs tests/test-lifecycle-controller.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: add resumable serialized lifecycle controller"
```

Expected: all controller/replay/adapter/disk tests pass; no provider or private key is required.

### Task 9: Closed Detached-Verifiable Handoff Bundle

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-detached-verify.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`

**Interfaces:**
- Consumes: only `{ runtimeDir, profile, checkoutDir, bundleClass }`; it calls Task 5 replay itself, loads trust/target from immutable runtime configuration, and resolves the exact governed checkout. `bundleClass` is `production` or `synthetic-test`.
- Produces: `buildHandoffBundle({ runtimeDir, profile, checkoutDir, bundleClass }): { manifest, entries }` entirely in memory, `writeHandoffBundle({ bundle, outDir }): { bundle_root }` exactly once to a fresh disjoint directory, and `verifyHandoffBundle({ bundleDir, externalEyeTrustBytes }): BundleVerification` from bundle bytes plus separately supplied pinned Eye trust. There is no caller parameter for replay state, trust, target, roots, refs, evidence, authority claims, or entry lists.

- [ ] **Step 1: Write failing export tests**

Create `tests/test-lifecycle-export.mjs` with these assertions:

- an active, paused, cancelled, corrupted, stale, or incomplete store throws `lifecycle must replay closed before handoff`; `synthetic-test` is permitted only for the named closed demo fixture and is explicitly ineligible for product submission;
- a replay with no exact matching authorized/current plan, accepted/current implementation artifact ref, embedded/current disk tree ref, or required authority ref throws the specific missing or mismatch field;
- the API rejects caller fields named `state`, `verification`, `trust`, `target`, `entries`, `evidenceRefs`, or any root;
- a valid canonical manifest has only `bundle_version`, `bundle_class`, `lifecycle_id`, `profile_ref`, `lifecycle_root`, `target`, `eye_trust_ref`, `authority_claim`, and unique path-sorted `entries`; each entry is exactly `{ path, kind, byte_count, content_ref, logical_ref }` and the bundle root is `sha256Ref(manifest)`;
- the typed-artifact entry at the replay-derived authorized plan ref is exactly `{ kind: "candidate", plan }` and hashes to both `authorized_plan_root` and `effective_plan_root`;
- the typed-artifact entry at `accepted_implementation_root === replay.effective_implementation_root` is closed `dfm.implementation.v1`; its `tree_root === effective_implementation_tree_root === disk_truth_tree_root`, and no test/verifier equates the artifact ref with that distinct tree ref;
- manifest reachability equals the complete closure of immutable lifecycle config/profile/controller public key/Eye trust, every signed decision/operation/lifecycle-round-checkpoint record, every directly or transitively reachable typed artifact, raw blob, and Git object, plus the detached verifier source; no reachable byte may be absent and no ambient/unreachable artifact may be included;
- that union includes every disk decision's explicitly named manifest and command-evidence refs, including non-pass attempts, and excludes unreferenced ambient manifests. Command evidence remains transitively bound to its raw envelopes without silently replacing the direct decision evidence set;
- two in-memory builds from the same verified inputs are byte-identical before any write. `writeHandoffBundle` uses one fresh directory and writes every final path once; it never performs two `wx` writes to prove determinism. Reordered, inserted, deleted, stale, or incomplete journals cannot produce a bundle;
- checkout, runtime, and bundle realpaths are pairwise disjoint: equality, ancestry in either direction, symlink aliases, junction aliases, and unresolved/nonexistent parents fail before build/write. Rehash the checkout before and after and require byte identity;
- a fresh detached process with no runtime checkout, no replay object, and no plugin imports verifies canonical manifest/entry bytes, every content ref, journal chain/signature/state link, typed-artifact/raw closure, pinned Eye trust/signatures/prefix semantics, lifecycle root/state, and every Git object/OID/commit/tree link. Mutating/omitting/adding any byte, ref, trust key, root, authority claim, checkpoint, or Git object fails;
- synthetic-only fixtures cannot satisfy `bundle_class: "production"`. Production requires a closed lifecycle whose target is the exact installable plugin checkout, clean Git status, recorded commit ref, complete tracked-file tree manifest, full reachable commit/tree/blob/tag object closure, and Task 11 installation proof;
- `authority_claim` equals `{ model_consensus_is_authority: false, eye_authorization_required: true, mutates_telos_authority: false }`;

- [ ] **Step 2: Run the test and confirm the export module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-export.mjs`.

- [ ] **Step 3: Implement the closed handoff bundle**

`buildHandoffBundle` calls replay internally and requires closed state, exact plan authorization, `accepted_implementation_root === effective_implementation_root`, and separately `disk_truth_tree_root === effective_implementation_tree_root`. It walks refs from the verified lifecycle/config/journals/checkpoints only, recursively resolves every typed/raw dependency, and for production walks the recorded Git commit through every reachable commit/tree/blob/tag object. Git entry metadata includes exact object type and canonical `git:sha1:` or `git:sha256:` OID; verification recomputes the Git object header hash, not merely the raw-byte SHA-256. Construct nothing from ambient caller lists or previous bundles.

`assertDisjointRoots` resolves existing realpaths and prospective parents before reading/building and rejects equality, containment, symlink/junction aliases, and checkout/runtime descendants. Build the sorted manifest and all entry buffers twice in memory and require byte identity. Only then `writeHandoffBundle` creates a fresh output directory, writes each path once with exclusive creation, fsyncs files/directories, rereads, and byte-verifies it. The caller then launches the self-contained verifier in a fresh process with separately supplied Eye trust. Neither path writes into checkout/runtime, and both re-derive the checkout manifest after writing.

`lifecycle-detached-verify.mjs` is self-contained Node standard-library code copied into and authenticated by the bundle. Given only bundle directory and canonical external Eye-trust bytes, it rejects extras/omissions/noncanonical bytes, recomputes the manifest root, every content/Git ref, the complete decision/operation/checkpoint chains, start-embedded request refs, prepared commitments, provenance/request bindings, the exact six-field minimal checkpoint payload/boundaries, prefix-bound unique Eye authority, deterministic replay, lifecycle root/closure, and production eligibility. The bundled trust copy must byte-equal separately supplied pinned trust and match `eye_trust_ref`. No plugin checkout, runtime directory, replay object, network, provider, or private key is available.

The bundle does not import from TELOS, edit `CURRENT-AUTHORITY.json`, grant authority, or claim enrollment, merge, release, or acceptance. A `synthetic-test` root is never renamed or promoted to production.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-export.mjs scripts/lifecycle-detached-verify.mjs tests/test-lifecycle-export.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: build detached-verifiable lifecycle handoff bundles"
```

### Task 10: Synthetic End-to-End Proof Through the Production Controller

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`

**Interfaces:**
- Consumes: the Task 8 production controller/CLI, injected deterministic seats, external signer wrappers, trusted Eye test key, disk truth, replay, and Task 9 bundle builder/verifier. It must not compose store/engine state directly.
- Produces: CLI `node scripts/lifecycle-demo.mjs --checkout <empty-dir> --runtime <empty-dir> --handoff <empty-dir>` and exported `runDemo({ checkoutDir, runtimeDir, handoffDir }): Promise<object>`. All three realpaths are pairwise disjoint.

- [ ] **Step 1: Write the failing spawned proof test**

Create `tests/test-lifecycle-demo.mjs`. It must create three sibling empty temporary directories, spawn the CLI, require exit 0 and `DAEDALUS_FAMILY_DEMO_OK`, read the closed public summary from stdout rather than writing it into checkout/runtime/handoff, and assert:

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

It must also run the immutable-journal verifier over runtime, then launch the detached verifier over the written bundle with only external Eye trust and assert both roots equal the summary. Assert `bundle_class === "synthetic-test"` and `product_handoff_eligible === false`.

- [ ] **Step 2: Run the test and confirm the demo is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-demo.mjs`.

- [ ] **Step 3: Implement the proof run**

`runDemo` must refuse non-empty or non-disjoint checkout/runtime/handoff directories before any write, generate ephemeral Ed25519 controller/Eye keypairs, load the committed profile, and execute this exact scenario with injected deterministic provider doubles:

1. Persist a typed requirement/policy and a separately Eye-signed `freeze-requirements` artifact; record requirements freeze through the controller.
2. Materialize exact canonical candidate `{ kind: "candidate", plan: planV1 }` from the deterministic Daedalus-authoring fixture, persist it through `ingestArtifact`, construct the canonical Daedalus seat request with that singleton output, then invoke `plan-draft` with exact `requestBytes` and the matching stored `outputArtifactRef`. Assert the internally derived request ref, singleton decision output, and pre-transition request/operation/node/provenance subject; replay alone promotes the candidate after pass.
3. Daedalus and Icarus pass `P1` independently.
4. Grok returns `non-pass` at `P2` with finding `PLAN_TEST_ORACLE_MISSING`; the decision is atomically published.
5. Daedalus explicitly mutates the plan to canonical candidate v2 through the dedicated `mutate` path with its exact canonical request; that path validates and ingests the artifact and never uses ordinary `invoke-seat --output-artifact-ref`. The mutation clears old plan approval and re-enters `P1`. This is not recorded as a retry.
6. Daedalus/Icarus pass `P1`; Grok/Gemini independently pass `P2`; a separately Eye-signed `authorize-plan` artifact authorizes the exact v2 candidate root.
7. Write source/tests, derive same-lifecycle tree manifest T1, and persist it through `ingestArtifact`. Materialize typed `dfm.implementation.v1` I1 with the authorized plan root, `tree_root: T1`, and commit ref; persist I1, construct the canonical Icarus request with singleton implementation output, then invoke `code-draft` using exact request bytes and the matching stored `outputArtifactRef`. Assert the decision output is `sha256Ref(I1)`, deliberately distinct from T1, while request/operation/node/provenance subject remains the authorized plan root. Replay promotes I1/T1 only after pass; Icarus/Daedalus then pass C1 and Grok/Gemini pass C2 with empty request outputs.
8. `verifyDisk` re-derives manifest ref T1 and compares it only to `I1.tree_root`; its command evidence uses `cwd_ref: T1` and implementation-bound raw envelopes. Persist/reread the exact evidence objects, then assert the disk decision has singleton implementation input, empty outputs, and direct evidence exactly `uniqueSort([T1, ...commandEvidenceRefs])`. The decision remains governed by I1's artifact ref and replay sets the disk root only from its named T1 evidence. A separately Eye-signed `accept-implementation` artifact accepts I1's artifact ref, not T1. Retrospective closes only when accepted/current artifact refs match and disk/embedded tree refs separately match.
9. Terminate controller process context, call replay from a fresh import, hash the checkout, build the complete `synthetic-test` bundle twice in memory and require canonical byte identity, then write it once to the fresh handoff directory. Launch the detached verifier with only that directory and external Eye trust; require exact inclusion of disk manifest/command/raw evidence, every journal/checkpoint actually present, and Git objects, plus exclusion of an injected ambient artifact. Zero lifecycle-round checkpoints is allowed only for this pre-Task-11 synthetic proof and makes it product-ineligible. Rehash checkout and require byte identity. Return the public summary in memory/stdout only.

Use controller-supplied ISO timestamps derived from an incrementing fixed base solely for repeatable ordering; timestamps remain non-authoritative. All runtime writes go through the production controller and exact request-byte framing. The demo must pass explicit stored refs at both authoring stages and never select an output by scans, newest files, provider text, or ambient Git. Private keys stay in signer closures. This proof is synthetic test coverage only; it does not satisfy the Task 11 production lifecycle or authorize product handoff.

- [ ] **Step 4: Run the entire lifecycle suite and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-demo.mjs tests/test-lifecycle-demo.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "test: prove Daedalus family lifecycle end to end"
```

Expected: every lifecycle test passes; the demo reports one non-pass return through Daedalus and ends only after the exact ordered passes and Eye records.

### Task 11: Skill Commands, Plugin Metadata, Bootstrap Hygiene, and Installation Proof

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/skills/daedalus-family-lifecycle/SKILL.md`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/checkpoint.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/skills/context-checkpoint/SKILL.md`
- Modify: `/home/colchis/plugins/multi-model-seats/hooks/hooks.json`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/.codex-plugin/plugin.json`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/bootstrap.mjs`

**Interfaces:**
- Consumes: lifecycle CLI, existing provider-seat/Superpowers skills, plugin-owned checkpoint/hook surfaces, the verified source package, and the normal Codex installer.
- Produces: discoverable `multi-model-seats:daedalus-family-lifecycle`, isolated strict `lifecycle-round` checkpoint modes, plugin version `0.6.0`, a byte-exact source/cache package proof, and—only after installation—a separately governed production lifecycle/bundle for the exact installable plugin checkout.

- [ ] **Step 1: Write the failing packaging test**

Create `tests/test-lifecycle-skill.mjs` that asserts:

- `.codex-plugin/plugin.json` version is exactly `0.6.0` and its description mentions `Merkle-DAG lifecycle`;
- the new skill frontmatter name is `daedalus-family-lifecycle`;
- the skill contains all seven actual Superpowers names from Global Constraints;
- the skill contains `P1`, `P2`, `C1`, `C2`, `every non-pass returns to Daedalus`, `model consensus is not authority`, and `The Eye`;
- the skill documents the production `init/status/resume/ingest-artifact/invoke-seat/recover/mutate/eye-action/verify-disk/record-retrospective/export` commands, exact external signer boundary, and separately signed Eye authority requirement;
- it documents `ingest-artifact` followed by the exact singleton `invoke-seat --output-artifact-ref` contract for `plan-draft` and `code-draft`, forbids that flag at review stages, and keeps governed recovery changes on dedicated `mutate --artifact`;
- it documents that `verify-disk` itself re-derives and persists the named manifest/command evidence, produces a decision with singleton implementation input and no outputs, and never selects ambient evidence;
- it names required Claude/Daedalus plus GPT/Icarus at P1/C1, required Grok plus Gemini at P2/C2, and the unchanged TELOS council required trio Claude/Agy/Codex with Grok/Gemini advisory;
- every line invoking a plugin script uses `node "<plugin-root>/scripts/<name>.mjs"` with a quoted resolved path;
- `bootstrap.mjs` generates `.multi-model-seats/lifecycle/` in `.gitignore`;
- every model command uses `--request <canonical-seat-request-json>` and the skill contains no `--request-ref`, independent `--model`, raw prompt, or same-directory handoff syntax;
- the skill states that only Icarus can derive/publish the six-field minimal lifecycle-round checkpoint, open findings set `next_action: daedalus-revise`, all-closed Icarus pass sets `grok-gemini-cold-review`, mechanics/messages are excluded, and every non-pass/death returns to Daedalus without caps.

Create `tests/test-lifecycle-checkpoint.mjs` to prove strict `lifecycle-round` is isolated and existing broad checkpoint behavior remains byte-compatible. Apart from unavoidable signed journal envelope/version fields, the payload is exactly:

```js
{
  candidate: { raw_sha256: "64-lowercase-hex", canonical_ref: "sha256:..." },
  boundary: { authority_ref: null | "sha256:...", predecessor_checkpoint_ref: null | "sha256:..." },
  round_id: "round-...",
  findings: [{
    id: "icarus-<64-lowercase-hex>",
    status: "open" | "closed",
    evidence_refs: ["sha256:..."],
    disposition: null | { code: "...", action: "...", target_stage: null | "stage-id", subject_ref: "sha256:..." }
  }],
  current: { stage: "stage-id", owner: "daedalus" | "icarus" },
  next_action: "daedalus-revise" | "icarus-review" | "grok-gemini-cold-review" | "await-eye"
}
```

The signed envelope is exactly `{ checkpoint_record_version: "dfm.lifecycle-round-record.v1", lifecycle_id, journal_index, previous_journal_ref, payload, controller_key_id, controller_signature }`; envelope metadata is not copied into payload. `boundary.predecessor_checkpoint_ref` must equal the full prior signed checkpoint ref and the envelope's `previous_journal_ref`, or both null only at genesis.

All nested objects are closed and bounded. `raw_sha256` is the lowercase SHA-256 hex of the exact UTF-8 bytes of the resolved canonical candidate's `plan` string; `canonical_ref` must equal `sha256Ref({ kind: "candidate", plan })`. Save/load recompute both from the exact stored candidate artifact and reject normalization, newline, or encoding drift. `authority_ref` is derived—not caller supplied—as the latest replay-verified Eye authority applicable at the checkpoint prefix, or null only when the profile permits no authority yet. `round_id` is exactly `"round-" + sha256hex(canonicalize({ candidate, boundary, stage: current.stage }))`, making it stable and unique for that predecessor/candidate/stage.

Icarus alone derives `findings` from verified decisions at the exact prefix. Each ID is exactly `"icarus-" + sha256hex(canonicalize({ candidate_ref, source_decision_ref, finding_index, finding }))`; IDs are stable, globally unique within the lifecycle, and arrays are sorted by ID. Evidence refs are unique sorted, resolve through replay, and exactly match the source finding. Open findings require `disposition: null`. Closed findings require exactly one matching verified disposition with the closed `{ code, action, target_stage, subject_ref }` shape; its semantic identity is `sha256Ref(disposition)`, `subject_ref` equals the replay-derived governed plan/implementation subject, and non-null `target_stage` equals profile reentry. No message, mechanic note, prompt, transcript, summary prose, hidden reasoning, lifecycle root, duplicate plan/implementation root, head list, timestamp, generic status, or consolidator identity may enter payload.

`current.stage` equals the exact replay stage at the checkpoint prefix, and owner is derived from the Daedalus/Icarus loop, never caller text. `next_action` is derived by a closed table: any open finding means `daedalus-revise`; a Daedalus revision awaiting review means `icarus-review`; an Icarus pass with all findings closed means `grok-gemini-cold-review`; an exact stage awaiting required Eye authority means `await-eye`. Any other combination is invalid.

Tests cover unknown fields and every removed legacy field (`phase`, plan/implementation/lifecycle roots, decision heads, ref arrays, generic status, consolidator, timestamp), missing/unknown next action, altered raw/canonical pair, authority/predecessor drift, duplicate/unstable/unsorted finding IDs, open-with-disposition, closed-without-disposition, evidence/disposition/status drift, stage/owner drift, and mechanic-message injection. Cold load returns exactly a deep-frozen copy of the six payload fields. Missing/stale/mismatched candidate, boundary, predecessor, authority, stage/owner, finding disposition/evidence, or next action fails before model/provider/signer/lock/write. Swapped/gapped/forged checkpoint records and concurrent consolidators fail through journal CAS. Session hooks select strict mode only for an explicit lifecycle runtime; broad non-lifecycle mode remains unchanged.

Create `tests/test-lifecycle-install.mjs` to derive the installable package allowlist from `.codex-plugin/plugin.json` plus plugin conventions, resolve every included regular file under `.codex-plugin`, `hooks`, `records`, `scripts`, `skills`, and `tests`, reject symlinks/extras/missing files, and build the closed `dfm.package-manifest.v1` with entries `{ path, file_type: "regular", byte_count, content_ref }`. Require source and discovered installed cache manifests to match exactly—body, ref, file set, type, bytes, and root—not one sample hash. Cache discovery comes from `codex plugin list --json`/installed metadata, never a hard-coded version path.

`--source-only <root>` performs manifest/schema validation only and spawns nothing. The default source-driver mode authenticates both manifests before spawning anything. It defines `ordinary_test_paths` as the unique lexicographically sorted installed `tests/test-*.mjs` paths excluding exactly `tests/test-lifecycle-install.mjs`, runs each ordinary test exactly once, then invokes the authenticated installed `test-lifecycle-install.mjs` exactly once as `--self-check --installed-root <resolved-root> --expected-manifest-ref <ref>`. Self-check mode accepts only those closed flags, requires `import.meta.url` to resolve to the manifest-named self file, recomputes its own bytes and the installed manifest/ref, emits one `LIFECYCLE_INSTALL_SELF_CHECK_OK`, and has no suite-spawn/discovery/demo/CLI code path. It rejects orchestration flags and cannot recursively invoke itself or another test.

After that single child self-check, the source driver runs skill discovery, hook loading, CLI help, and the three-disjoint-directory demo once each. Its closed public result lists exact `ordinary_test_paths`, `ordinary_test_count`, `self_check_path`, `self_check_count: 1`, auxiliary counts exactly `{ skill_discovery: 1, hook_load: 1, cli_help: 1, demo: 1 }`, and `total_child_process_count === ordinary_test_count + 5`. Duplicates, omissions, unexpected paths, or count drift fail. Tests invoke self-check directly with a spawn recorder and recursion sentinel and require zero descendants, then run the source driver and assert every ordinary installed test once plus one bounded self-check. Emit only this bounded public result as evidence for `dfm.installation-proof.v1`.

- [ ] **Step 2: Run the packaging test and confirm it fails**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs --source-only /home/colchis/plugins/multi-model-seats
```

Expected: failures for missing skill/version, missing strict checkpoint modes, and an incomplete source package manifest.

- [ ] **Step 3: Add the lifecycle skill**

Create `skills/daedalus-family-lifecycle/SKILL.md` with frontmatter name/description and this enforced workflow:

1. Require an approved brainstorm and exact requirement root.
2. Use `superpowers:writing-plans` for Daedalus authorship, canonicalize and `ingest-artifact` the exact candidate, construct the exact public seat-request file whose `output_refs` is `[candidate-ref]`, then record `plan-draft` through `invoke-seat --request <request-file> --output-artifact-ref <candidate-ref>`. Icarus feasibility review and both P1 decisions use requests with empty output refs.
3. Request blind Grok/Gemini plan reviews through their seat skills; record `P2` only when both independently pass the same descendant root.
4. Stop for The Eye's exact-root plan authorization.
5. Use `superpowers:executing-plans` or `superpowers:subagent-driven-development`; canonicalize and ingest the same-lifecycle tree manifest and Icarus-authored `dfm.implementation.v1`, construct the exact request with singleton implementation output, then record `code-draft` through `invoke-seat --request <request-file> --output-artifact-ref <implementation-ref>`. Daedalus architecture review and both C1 decisions use empty request outputs.
6. Use `superpowers:requesting-code-review` and `superpowers:receiving-code-review` for cold Grok/Gemini code review; record `C2` only when both independently pass the same descendant root.
7. Use `superpowers:verification-before-completion`, then call `verify-disk`; document that it re-derives/persists the exact manifest and command evidence, binds them through the disk decision's direct evidence refs, uses the implementation ref as its sole input, and uses no output or ambient artifact selection. Use `superpowers:finishing-a-development-branch` only after disk truth and The Eye acceptance.
8. State exactly: `every non-pass returns to Daedalus`; forbid automatic caps and seat substitution; state that model consensus is not authority.
9. After each Daedalus/Icarus plan or code review-fix round, require Icarus alone to derive and publish the exact minimal `lifecycle-round` payload: candidate raw/canonical identity, authority/predecessor boundary, round ID, stable findings with status/evidence/disposition, current stage/owner, and next action. Open findings must resume at Daedalus; only an all-closed Icarus pass may name Grok/Gemini cold review. Mechanics may cold-load the frozen projection but notes/messages never enter it. Missing/stale payload fails precompact and cold review does not begin.
10. Document every quoted production CLI command from Task 8, including `--request` and the stage-dependent non-repeatable `--output-artifact-ref`, then the quoted demo command with separate checkout/runtime/handoff directories. Explain that outputs are exact refs already ingested and mirrored in request `output_refs`, review stages reject them, provider output cannot select them, `status`/`export` derive only from replay, recovery never invokes the provider automatically, `mutate --artifact` is the only governed recovery mutation, and every Eye command needs separate signed prefix authority.
11. Map seats explicitly: Claude is Daedalus and GPT is Icarus for P1/C1; Grok and Gemini are both required and independent for P2/C2; the exported TELOS council remains required Claude/Agy/Codex and advisory Grok/Gemini.

- [ ] **Step 4: Update metadata and generated-project hygiene**

Change plugin version from `0.5.2` to `0.6.0`, add `Merkle-DAG lifecycle` to the description/long description, and add `Run the Daedalus family lifecycle for this feature.` to `interface.defaultPrompt`.

Add this exact line to the generated `GITIGNORE` string in `scripts/bootstrap.mjs`:

```gitignore
.multi-model-seats/lifecycle/
```

- [ ] **Step 5: Implement strict lifecycle-round checkpointing**

Add explicit `lifecycle-round-save`, `lifecycle-round-load`, and `lifecycle-round-precompact` modes to `scripts/checkpoint.mjs`; do not change existing-mode schema/output. Strict modes use Task 3's atomic signed journal and Task 5 replay. Only an internal capability produced by a verified Icarus review result can call save; role strings, environment variables, hook input, mechanics, and arbitrary payloads cannot mint it. Save accepts no payload body from the caller: it derives the exact six-field minimal payload, candidate raw/canonical pair, applicable authority, predecessor, stable finding IDs/status/evidence/dispositions, current stage/owner, and next action from replay plus the Icarus result.

Before lock or signer activity, save performs read-only derivation and validation; after its tokenized lock it replays and derives again, requiring byte identity before atomic publication. Load verifies the complete signed chain, duplicated predecessor boundary, candidate pair, authority, finding semantics, current owner/stage, and next-action table cold, then returns only the frozen six-field payload. Precompact performs the same cold verification and succeeds for an exact current snapshot whether its derived next action is Daedalus revision, Icarus review, cold review, or Eye wait; it never invents completion. Any missing/stale/mismatch exits nonzero before rotating context.

Update `skills/context-checkpoint/SKILL.md` and `hooks/hooks.json` so an explicit lifecycle session uses strict load at session start and strict precompact before rotation. Hooks are read-only with respect to decisions/checkpoints, pass only runtime path and expected lifecycle ID, and fail closed on missing/stale/invalid state. Mechanic notes/messages remain outside the payload and cannot affect resume. Existing non-lifecycle hooks remain unchanged. Run old checkpoint tests plus the strict suite to prove isolation.

- [ ] **Step 6: Run the full source verification**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-artifacts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-audit-baseline.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-operations.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-authority.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-replay.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-controller.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-checkpoint.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs --source-only /home/colchis/plugins/multi-model-seats
```

Expected: every existing and new test passes with 0 failures.

- [ ] **Step 7: Commit the packaging change**

```bash
git -C /home/colchis/plugins/multi-model-seats add .codex-plugin/plugin.json hooks/hooks.json scripts/bootstrap.mjs scripts/checkpoint.mjs skills/context-checkpoint/SKILL.md skills/daedalus-family-lifecycle/SKILL.md tests/test-lifecycle-checkpoint.mjs tests/test-lifecycle-install.mjs tests/test-lifecycle-skill.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: publish Daedalus family lifecycle skill"
git -C /home/colchis/plugins/multi-model-seats status --short --branch
```

Expected: clean plugin source worktree.

- [ ] **Step 8: Refresh through the normal plugin path and verify complete source/cache identity**

First select the intended Codex profile. A Desktop-launched Windows Codex process uses the UNC marketplace source `\\wsl.localhost\\kali-linux\\home\\colchis\\plugins`; native Kali Codex uses `/home/colchis/plugins` with Windows `CODEX_HOME`/`CODEX_SQLITE_HOME` unset. Validate every configured marketplace before reinstalling because one invalid marketplace blocks all plugin commands.

```bash
test -f /home/colchis/plugins/.agents/plugins/marketplace.json
codex plugin marketplace list
codex plugin remove multi-model-seats@multi-model-local --json
codex plugin add multi-model-seats@multi-model-local --json
codex plugin list
```

Expected: `multi-model-seats@multi-model-local` is installed/enabled at `0.6.0`. If marketplace validation fails, do not copy files into the cache; report the invalid marketplace(s), keep the verified source commit, and resume installation only after the profile/source path is repaired.

Discover the installed root from machine-readable plugin metadata, then verify the complete package without treating installation as provider authentication:

```bash
INSTALL_PROOF_TMP="$(mktemp -d)"
codex plugin list --json > "$INSTALL_PROOF_TMP/installed.json"
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-install.mjs --source /home/colchis/plugins/multi-model-seats --installed-metadata "$INSTALL_PROOF_TMP/installed.json"
```

Expected: source/cache manifests are identical; the source driver reports every ordinary installed test path exactly once, the installed install-test self-check exactly once, zero child descendants from self-check, and each discovery/hook/CLI/demo auxiliary check once. Missing/extra/symlinked files, hard-coded cache paths, duplicate/omitted tests, recursion, child-mode orchestration, or count drift fail. Report provider authentication separately; deterministic plugin usability does not prove live credentials.

- [ ] **Step 9: Run the governed production lifecycle over the exact installable plugin**

Only after Step 8, create physically disjoint checkout/runtime/handoff directories. The lifecycle target is the clean source checkout at the exact committed plugin revision whose complete package manifest matched the installed cache. Run the full Daedalus/Icarus plan and code rounds, Icarus-owned checkpoints, cold Grok/Gemini reviews, disk verification, and fresh prefix-bound Eye actions through the production CLI using exact request files. The implementation artifact records the exact Git commit and complete tracked tree. Re-run full source/cache verification after the last change, ingest the byte-identical source/installed package manifests plus closed installation proof and its full-suite evidence, and make that proof directly reachable from the production retrospective decision. Verify clean status/unchanged manifest; then the handoff builder includes those proofs and full reachable Git object closure. Build twice in memory, write the `production` bundle once, and verify it in a fresh detached process.

If live authenticated Claude/OpenAI/xAI/Google seats, the required Icarus checkpoint, or a fresh Eye signature for an exact prefix is unavailable, stop with `PRODUCTION_LIFECYCLE_PENDING`. Report the last verified root and missing external boundary. Never replace live seats with fixtures, reuse demo authority, label the synthetic bundle production, or claim a product handoff.

## Final Verification and Handoff

- [ ] Re-run TELOS contract verification; this plugin plan must not have changed TELOS authority records.

```bash
node /home/colchis/Projects/TELOS/docs/institutional-memory/verify-contracts.mjs
git -C /home/colchis/Projects/TELOS status --short --branch
```

Expected: `301/301 contracts match system reality`; no implementation artifact has silently modified `CURRENT-AUTHORITY.json`.

- [ ] Record the clean plugin commit, complete source/cache manifest root, profile ref, lifecycle root, latest Icarus checkpoint refs, authorized plan root, accepted `dfm.implementation.v1` artifact ref, its distinct embedded tree root, verified disk tree root, production bundle root, detached-verifier result, test totals, installation version, and provider-authentication gaps.

- [ ] Submit only the exact clean plugin commit and detached-verified `production` handoff bundle to The Eye. A `synthetic-test` bundle is evidence of test coverage only. If the production lifecycle or fresh Eye acceptance is pending, report that boundary and stop. Do not call the work accepted, enrolled, merged, released, handed off, or implementation-complete until the corresponding Eye/TELOS records exist.
