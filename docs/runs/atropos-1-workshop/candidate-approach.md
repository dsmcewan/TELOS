# Candidate approach (rev 13, MATURED — build-mode finalize) — Atropos (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-atropos-1.json`.
**Registered meaning (fixed):** Atropos *retires obsolete relationships, artifacts, tools, and processes* —
"handles supersession". Cycle-1 realizes the **VERIFICATION** of that meaning (READ-ONLY), NOT the mutation.
Authoritative scoping: `daedalus/IDENTITY.md`. No extension. Machine-first.

Rev 2 incorporates the round-1 technical resolutions from **codex, the peer planning/dev model** (Claude
deferred to GPT on two design calls — ordinary model collaboration, `decision-round-1-result.json`; The Eye's
consequential authority — merges/authorization/enrollment — is unaffected) and fixes the round-2 objections.
**Design decision, not a governance change:** per The Eye/coordinator, the per-kind surface applicability is a
technical call resolved by the peer model — **no CHANGE-PROTOCOL edit** (that draft is superseded). Rev 3 fixes
the round-2 objections and, per round-3, (a) shows The Eye's ruling on the CHANGE-PROTOCOL/schema tension so it
reads as ruled not designed-around, (b) makes edge classification direction-free, (c) closes + anchors
ingestion discovery, (d) hardens the READ-ONLY oracle across the whole runtime surface.

## 0. Reality (verified, not presumed)
`CHANGE-PROTOCOL.md` (`status: living`) names three supersession surfaces (record `SUPERSEDED`; weave
`supersedes` edge; `CURRENT-AUTHORITY.json` update). LIVE data: `CURRENT-AUTHORITY.json#superseded` = 4
entries, all **plan-versions** (v11..v14), all `superseded_by:"v15"` = `active_plan.version`, all
`must_not_govern_new_work:true`. Weave `supersedes` edges = 0; live `status:"SUPERSEDED"` records = 0. A
plan-version is NOT a weave node kind (structurally cannot carry a weave `supersedes` edge — a verified fact).

## 1. Boundary + trust + NON-CLAIM
Zero-dependency Node ESM `atropos/`; NEVER imports `clotho/`; reads `CURRENT-AUTHORITY.json` (+ committed
records + the weave snapshot) as DATA. Sole sanctioned cross-package import: `merkle-dag/vendor.mjs`
(`canonicalize`/`sha256hex`) for machine-record content-addressing, boundary-enforced by
`scripts/test-boundary.mjs`. **READ-ONLY**: Atropos realizes the VERIFICATION of "retires", NOT the mutation —
never mutates `CURRENT-AUTHORITY`, authors a `SUPERSEDED` record/edge, or deletes anything. Authoring a
retirement stays a human/controller CHANGE-PROTOCOL step.

## 2. Kind detection (per codex, by candidate SOURCE + membership — no deriveNodeId, no cross-taxonomy string match)
Candidate set = UNION of: `CURRENT-AUTHORITY.json#superseded` entries; committed records with `status` exactly
`SUPERSEDED`; committed weave edges with `edge_kind` exactly `supersedes`. Classify each into exactly ONE kind:
- **plan-version** — a valid closed-shape `#superseded` entry whose authoritative identity is its `plan_version`
  field (a `vN`-looking string elsewhere is NOT sufficient).
- **weave-node-backed** — classified by SOURCE ONLY (no field extraction, no identity resolution — both are
  part of the DEFERRED full verifier): **any** candidate from the `status:"SUPERSEDED"`-record source OR the
  `supersedes`-edge source. A record/edge retirement is node-backed by construction; identifying WHICH field is
  the retired identity, and which edge endpoint is retired, is deferred → all such candidates take the
  deterministic short-circuit below. (This removes the round-5 ambiguity: a `SUPERSEDED` record can carry many
  64-hex ids; cycle-1 does not extract one — it defers the whole node-backed path.)
- **unrepresented/unknown** — a `#superseded` entry that is NOT a valid closed-shape plan-version (malformed
  shape / missing `plan_version`). (Cross-source disagreement + plan/node identity overlap detection REQUIRE
  identity resolution, which is DEFERRED with the full node-backed verifier — so cycle-1 detection is purely
  SOURCE + SHAPE, with no identity resolution anywhere; the round-6 contradiction is removed.)
The complete Clotho node-kind set (for documentation; NOT a cross-taxonomy match) is the 11 `NODE_KINDS`:
{contract-clause, code-symbol, repository-file, test, commit, concern, obligation, **check-contract**,
run-evidence, doc-section, **decision**} — the round-2 objection correctly caught that rev1 omitted
`check-contract` and `decision` and conflated record kinds with node kinds; cycle-1 avoids the conflation by
detecting via source+membership, not by matching the (distinct) record-kind and node-kind taxonomies.

## 3. NORMATIVE verifier — `atropos/verify.mjs` (plan-version full; node-backed DEFERRED)
- **plan-version (full, cycle-1):** normative surface = the `#superseded` entry. Checks: `#superseded` is an
  array; each entry has EXACTLY the closed keys with PINNED SCALAR TYPES: `plan_version` (non-empty string),
  `sha256` (string `sha256:<64hex>`), `authorization` (string `authz-N`), `authz_status`
  (string ∈ {AUTHORIZED, NOT_AUTHORIZED}), `superseded_by` (non-empty string), `must_not_govern_new_work`
  (boolean, and === true), `note` (string) — an object/number/null/empty-string in any field → `inconsistent`;
  **`active_plan` must HAVE `{version: non-empty string, sha256: sha256:<64hex>, path: repo-relative string}`**
  (the fields Atropos uses; the system's `active_plan` legitimately carries others e.g. `component` — Atropos
  validates the fields it consumes, it does NOT impose a closed shape on the system object). The terminal
  authority is content-addressed by `active_plan.sha256`, disk-resolved via `active_plan.path` (below).
  **unique `plan_version`**; `active_plan.version` MUST NOT also appear superseded; `must_not_govern_new_work===true`;
  `superseded_by` resolves only to `active_plan.version` or another unique superseded `plan_version` — reject
  self/dangling/cycles (visited-set); every chain TERMINATES at `active_plan.version`. **The terminal authority
  is DISK-RESOLVED, not just syntactic: `active_plan.sha256` is RECOMPUTED over the on-disk active plan file
  (`active_plan.path`, `sha256:` + `sha256hex(canonicalize({kind:"candidate", plan: <file text>}))` — the
  frozen plan-hash scheme) and must equal the recorded digest; a corrupted/arbitrary `active_plan.sha256` →
  `inconsistent`. `active_plan.path` is realpath-CONTAINED under the repo root and required to be a REGULAR
  FILE before reading (reject absolute/`..`-traversal/symlink-escape — same containment policy as the snapshot
  + discovery roots).** (NON-CLAIM: a SUPERSEDED entry's own `sha256` is syntax-checked only — historical
  superseded-plan bytes are not re-fetched/present; Atropos does not resurrect retired plan files.) No
  `SUPERSEDED` record / weave edge required for a plan-version (structurally inapplicable).
  **This CHANGE-PROTOCOL(living)/schema tension was EXPLICITLY ESCALATED to The Eye and RULED a design-level
  applicability determination** — plan-version weave-edge/record surfaces are structurally inapplicable
  (verified fact), not a spec defect, resolved as a technical call (peer-model input), NOT a CHANGE-PROTOCOL
  amendment. **Its authority terminates in STABLE artifacts, not prose:** the content-addressed affirmative
  decision record `DECISIONS/decision-atropos-cycle-1.json` (authored in Argo; captures The Eye's ruling + the
  adopted peer-model resolution) + the git-commit-pinned peer-model resolution
  `git:7c769d0261dedd363f506bca635786677e7d49f6:docs/runs/atropos-1-workshop/decision-round-1-result.json`
  (codex's resolution WITH real provenance) + the pre-review + the eventual `authz-N`.
  **Anchoring (resolved in BUILD MODE):** per The Eye's recalibration (2026-07-18 — internal-governance
  micro-decisions are portfolio set-dressing; the build controller makes them in build mode, Eye-governance
  re-engages at ship), this is a DESIGN determination and now has a committed, content-addressed authority
  artifact: `docs/runs/atropos-1-workshop/design-ruling-surface-applicability.json`
  (`sha256:f147d05a5c8bce846d84a4ea5a69c29d2a3de22e94b53ab58fe22132616e9602`), which records the ruling +
  cites the peer-model resolution. It EXISTS now (not future, not a placeholder) — no circularity. NO
  CHANGE-PROTOCOL amendment (design decision, not governance). Full Eye-governance (enrollment, durable
  trust-root) re-engages at ship.
- **weave-node-backed → deterministic `UNREPRESENTABLE_CURRENT_AUTHORITY_REFLECTION` (DEFERRED, cycle-1):** the
  current committed `CURRENT-AUTHORITY` closed schema represents ONLY plan-versions, so a node-backed retirement's
  required `CURRENT-AUTHORITY` reflection cannot be represented → `inconsistent` reason
  `UNREPRESENTABLE_CURRENT_AUTHORITY_REFLECTION`. The FULL three-surface node-backed verifier (record + edge
  direction + reflection + recursion + terminal authority + identity resolution) is **SPECIFIED but DEFERRED to a
  future cycle** — it needs both a `CURRENT-AUTHORITY` schema that can represent non-plan reflections AND a
  sanctioned `deriveNodeId` reuse path (the Lachesis boundary tension). Deferring it makes it non-dead: cycle-1
  emits the deterministic short-circuit, tested.
- **unrepresented/unknown → `inconsistent` reason `UNSUPPORTED_RETIREMENT_KIND`.**

**`consistent` iff:** ingestion succeeds; every candidate has exactly one unambiguous kind; every plan-version
passes its checks; NO node-backed or unknown candidate is present (both short-circuit to `inconsistent`). Real
data → 4 plan-versions, all → v15 → `consistent`.

## 4. Ingestion (fail-closed, CLOSED + anchored discovery) — `atropos/ingest.mjs`
Inputs are EXACT + closed (a verifier cannot silently omit a surface and still pass):
- **CURRENT-AUTHORITY** — the repo-root `CURRENT-AUTHORITY.json`, closed-shape `#superseded` + `active_plan.version`;
  path pinned in `CONTRACTS/supersession.json`.
- **SUPERSEDED records** — the root set is DERIVED from the AUTHORITATIVE manifest
  (`docs/institutional-memory/**` + `docs/institutional-memory/manifest.json#entry_points.memory_dirs` — the
  enrolled components' memory dirs), NOT a hard-coded list, so a newly enrolled component's memory dir is
  automatically in scope (closes the "omitted new component" gap); `*.json` with `status === "SUPERSEDED"`.
  **Realpath-CONTAINMENT applies to EVERY recursively discovered entry — each declared `memory_dir` AND each
  descendant subdirectory AND each `*.json` file — not just the declared roots: any entry whose realpath
  resolves outside the repo (a symlinked file/dir, an escaping descendant) → throw (fail-closed), so a symlink
  inside a contained root cannot smuggle in an outside record source.**
  **NON-CLAIM (completeness-of-universe):** Atropos verifies consistency over the manifest-authoritative
  inventory it is given; it does NOT independently prove no retirement exists OUTSIDE the manifest's declared
  roots — same honesty as the trust NON-CLAIM.
- **weave `supersedes` edges** — read via a PINNED `atropos/config/snapshot-manifest.json` using Lachesis's
  exact `loadWeave` (path bound to the manifest + realpath-contained; raw-byte digest; canonical-JSON;
  fail-closed), restricted to `edge_kind === "supersedes"`.
**Ingestion vs. verifier split (removes the round-7 contradiction):** ingestion throws ONLY on FILE-LEVEL
anomalies that prevent producing ANY verdict — `CURRENT-AUTHORITY.json` unparseable, `#superseded` not an
array, a snapshot digest/canonical/containment failure, **a malformed/unreadable manifest (cannot enumerate the
discovery roots), or any unparseable/unreadable `*.json` under a manifest-declared discovery root (a retirement
record must never be silently SKIPPED — an unreadable candidate source fails closed).** It does NOT throw on an
individual malformed `#superseded` ENTRY (well-formed file, bad entry) — per-entry shape is validated by the
VERIFIER, which returns `inconsistent` (`UNSUPPORTED_RETIREMENT_KIND`) as a VERDICT. **The oracle exercises
discovery END-TO-END:** a fixture memory dir declared by the manifest containing a `status:"SUPERSEDED"` record
must be DISCOVERED (→ node-backed → `UNREPRESENTABLE`); an unparseable record under a declared root → throw; a
newly-declared manifest root is picked up. An ingester that skips either would fail these. (So malformed entries reach classification exactly as §§2/3/5
require; only file-level anomalies fail-closed to a throw.) **Discovery is discriminating: because the candidate
set is the closed UNION of all three sources, a `SUPERSEDED` record or `supersedes` edge that IS present forces
a node-backed candidate → `UNREPRESENTABLE…` → `inconsistent` — the verifier cannot omit it and return
`consistent`.** Trust NON-CLAIM: integrity RELATIVE TO the supplied inputs; no durable authenticated root (HELD
for The Eye).

## 5. Oracle + golden
- `scripts/test-verify.mjs`: discriminating fixtures each FAIL a wrong impl — dangling/self/cyclic
  `superseded_by`; `active_plan.version` also superseded; `must_not_govern_new_work:false`; duplicate
  `plan_version`; **a per-field negative for EACH pinned check — `active_plan` missing `version`/`sha256`/`path` or with a
  wrong-typed one; `active_plan.sha256` that mismatches the on-disk plan bytes; malformed entry `sha256`; malformed
  `authorization`; invalid `authz_status`; empty `superseded_by`; non-boolean/false `must_not_govern_new_work`;
  non-string `note`** (each → `inconsistent`, so an impl omitting any check fails); mistyped/extra entry key; a
  `SUPERSEDED`-record candidate + a `supersedes`-edge candidate (each →
  `UNREPRESENTABLE…`); a malformed `#superseded` entry (→ `UNSUPPORTED_RETIREMENT_KIND`); **a MULTI-HOP chain
  `v11→v13→v15` where v13 is itself a valid superseded entry → `consistent`** (discriminates transitive
  resolution — an impl requiring every `superseded_by`===`active_plan.version` FAILS this); a chain that does
  NOT terminate at `active_plan.version` → `inconsistent`. **GOLDEN over the real `CURRENT-AUTHORITY.json`:** 4
  plan-versions, all `superseded_by=v15`, all `must_not_govern_new_work:true` → `consistent`.
- `scripts/test-boundary.mjs`: source-profile boundary oracle (reused from Lachesis + its hardening).
- **`scripts/test-readonly.mjs` (executable READ-ONLY oracle) — ALLOWLIST posture (sounder than a denylist):**
  scans ALL runtime `.mjs`/`.js`/`.cjs` recursively (excluding `scripts/`), comment-stripped, and requires:
  (a) fs specifiers are NORMALIZED — `fs` ≡ `node:fs` and `fs/promises` ≡ `node:fs/promises` (Node accepts the
  bare forms; the boundary oracle also bans bare imports as defense-in-depth) — and every fs import must be a
  NAMED import drawn from a closed READ allowlist (`readFileSync`, `readdirSync`, `realpathSync`, `statSync`,
  `lstatSync`, `existsSync`); `openSync` is EXCLUDED (write-capable via its flag argument); the runtime reads
  with `readFileSync` only; any other fs named import → fail; the SAME checks apply to `export … from` RE-EXPORT
  forms (`export { writeFileSync as x } from 'fs'`, `export * from 'node:fs'`) — a re-exported writer is a
  violation; (b) NO namespace import of fs (`import * as fs`) and NO `fs/promises` in either form (defeats
  name-based checking / exposes FileHandle writers); (c) NO import of
  `node:child_process`, `node:worker_threads`, `node:vm`, `process.binding`, `process.dlopen`; (d) deny known
  GLOBAL write paths that need no import — `process.report.writeReport`, `process.report.directory`/`filename`
  assignment, `process.chdir`, and **`process.getBuiltinModule`** (a global dynamic built-in loader —
  `process.getBuiltinModule('node:fs').writeFileSync` bypasses import checks on Node ≥18 where present); (d2) **NO runtime import resolves under `scripts/`** (the excluded dev-only tree)
  — closes the hole where a runtime module imports a write-capable helper from an unscanned file; (e) the
  boundary oracle already bans dynamic
  `import()`/`require`/`createRequire`/`Module._load`/`eval`. Plus branch-isolating fixture negatives (each
  flagged). **NON-CLAIM (honest — corrects the rev-4 overclaim):** a FAIL-CLOSED STATIC check over the KNOWN
  import + named-global write surface — NOT a proof of no-write and NOT a runtime sandbox; a determined write
  via an unenumerated global/API is not provably excluded (e.g. built-in global surfaces evolve). The read-only
  guarantee rests on the SMALL reviewed runtime surface + zero-`dependencies` + the import allowlist + no
  dynamic loading; the oracle is strong evidence, not a proof.

## 6. Anchoring + memory layout — ACTUAL lifecycle (deferred ratification, recorded truthfully)
No CHANGE-PROTOCOL edit (design decision, per ruling). **The real sequence this cycle followed, encoded here
so the content-addressed plan tells the truth about its own provenance:** under The Eye's explicit build-mode
directive, the implementation (`atropos/verify.mjs` + oracles, 31 passing assertions incl. the golden run over
the real `CURRENT-AUTHORITY`) and the memory records were produced BEFORE the TELOS gate. This council is
therefore a **DEFERRED RATIFICATION**: it ratifies or rejects the plan-as-implemented; `authz-N` and the
authority triple {plan `sha256:` of this matured approach, `authz-N`, the `decision-atropos-cycle-1` id}
attach AFTER ratification. The contract does NOT claim documentation preceded code — the comprehension gate
and contract are **post-build validation**, and the contract's status reflects reality:
`RATIFICATION-PENDING` until this council authorizes; upon authorization + the authority triple attaching, it
may claim `NORMATIVE-CURRENT` ONLY WHEN `scripts/test-verify.mjs` passes **AND** the enrollment integrates
with `docs/institutional-memory/verify-contracts.mjs` (the atropos manifest entry + the
`future-atropos-unimplemented`→implemented check flip). Anchors to the pre-review + the (post-hoc) authz; NO
CHANGE-PROTOCOL anchor. The build-mode exception is The Eye's recorded directive, not a precedent: the
default order for future cycles remains contract → comprehension → implementation.

`atropos/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`; `CONTRACTS/supersession.json`;
`DECISIONS/{decision-atropos-cycle-1.json, rejected-alternatives.md}`; `NON-CLAIMS.json`/`.md`;
`FAILURE-MODES.md`; `EVIDENCE/`; `comprehension-queries.json`; `README.md`. **Machine-first + human-rendered
with a renderer + drift oracle:** `scripts/render.mjs` + `scripts/test-render.mjs` (`--check`) so the `.md`
projections cannot drift from the machine records. `package.json`: `"type":"module"`, `dependencies` empty.

**COMPREHENSION GATE — post-build validation (truthful ordering):** in THIS cycle the implementation preceded
the gate (build-mode). Therefore the comprehension artifact from `docs/institutional-memory/comprehension-gate.mjs`
over `atropos/memory/comprehension-queries.json` (GRANTED, negatives DENIED, preserved as
`docs/runs/atropos-1/reader-validation-artifact.json`) is a **required validation BEFORE normative activation
and enrollment take effect** — not a claimed historical pre-implementation condition. Actual acceptance
sequence as executed + remaining: implementation + oracles built (DONE, 31 assertions green) → memory set
authored (DONE) → THIS deferred ratification council → comprehension gate GRANTED (post-build, preserved) →
contract claims NORMATIVE-CURRENT + verify-contracts integration → complete. Future cycles revert to the
default contract-first order.

## 7. Non-goals (cycle 1)
No mutation of `CURRENT-AUTHORITY`/records (read-only, oracle-enforced); no deletion; no enforcement gate; no
`import` of `clotho/`; no `deriveNodeId` (node-backed identity resolution deferred); no npm dependency; no
Narcissus work; no CHANGE-PROTOCOL edit; no extension of the registered meaning; no invented non-plan
`CURRENT-AUTHORITY` reflection schema; the full weave-node-backed three-surface verifier is deferred to a
future cycle.
