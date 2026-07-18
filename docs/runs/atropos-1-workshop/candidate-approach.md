# Candidate approach (rev 7) — Atropos (enrollment quest, cycle 1)

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
  array; each entry has EXACTLY the closed keys `{plan_version, sha256(sha256:<64hex>), authorization(authz-N),
  authz_status∈{AUTHORIZED,NOT_AUTHORIZED}, superseded_by, must_not_govern_new_work(bool), note}`; **unique
  `plan_version`**; `active_plan.version` MUST NOT also appear superseded; `must_not_govern_new_work===true`;
  `superseded_by` resolves only to `active_plan.version` or another unique superseded `plan_version` — reject
  self/dangling/cycles (visited-set); every chain TERMINATES at `active_plan.version` (a stable
  `sha256:`-anchored current authority). No `SUPERSEDED` record / weave edge required (structurally inapplicable).
  **This CHANGE-PROTOCOL(living)/schema tension was EXPLICITLY ESCALATED to The Eye and RULED a design-level
  applicability determination** — plan-version weave-edge/record surfaces are structurally inapplicable
  (verified fact), not a spec defect, resolved as a technical call (peer-model input), NOT a CHANGE-PROTOCOL
  amendment. **Its authority terminates in STABLE artifacts, not prose:** the content-addressed affirmative
  decision record `DECISIONS/decision-atropos-cycle-1.json` (authored in Argo; captures The Eye's ruling + the
  adopted peer-model resolution) + the git-commit-pinned peer-model resolution
  `git:7c769d0261dedd363f506bca635786677e7d49f6:docs/runs/atropos-1-workshop/decision-round-1-result.json`
  (codex's resolution WITH real provenance) + the pre-review + the eventual `authz-N`.
  **WORKSHOP-STAGE anchoring (honest):** at this pre-authorization stage the EXISTING committed evidence is the
  git-pinned peer-model resolution + this quest's escalation/round evidence; the FULL Eye-authority anchor
  (a committed record of The Eye's design ruling) does NOT yet exist as an artifact — it is HELD for The Eye /
  coordinator to commit (analogous to how the authority triple is minted at TELOS/Argo). NOT designed-around;
  ruled — its committed authority record is a HELD item, not a placeholder.
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
  **NON-CLAIM (completeness-of-universe):** Atropos verifies consistency over the manifest-authoritative
  inventory it is given; it does NOT independently prove no retirement exists OUTSIDE the manifest's declared
  roots — same honesty as the trust NON-CLAIM.
- **weave `supersedes` edges** — read via a PINNED `atropos/config/snapshot-manifest.json` using Lachesis's
  exact `loadWeave` (path bound to the manifest + realpath-contained; raw-byte digest; canonical-JSON;
  fail-closed), restricted to `edge_kind === "supersedes"`.
**Ingestion vs. verifier split (removes the round-7 contradiction):** ingestion throws ONLY on FILE-LEVEL
anomalies that prevent producing ANY verdict — `CURRENT-AUTHORITY.json` unparseable, `#superseded` not an
array, a snapshot digest/canonical/containment failure. It does NOT throw on an individual malformed
`#superseded` ENTRY — per-entry shape is validated by the VERIFIER, which returns `inconsistent`
(`UNSUPPORTED_RETIREMENT_KIND`) as a VERDICT. (So malformed entries reach classification exactly as §§2/3/5
require; only file-level anomalies fail-closed to a throw.) **Discovery is discriminating: because the candidate
set is the closed UNION of all three sources, a `SUPERSEDED` record or `supersedes` edge that IS present forces
a node-backed candidate → `UNREPRESENTABLE…` → `inconsistent` — the verifier cannot omit it and return
`consistent`.** Trust NON-CLAIM: integrity RELATIVE TO the supplied inputs; no durable authenticated root (HELD
for The Eye).

## 5. Oracle + golden
- `scripts/test-verify.mjs`: discriminating fixtures each FAIL a wrong impl — dangling/self/cyclic
  `superseded_by`; `active_plan.version` also superseded; `must_not_govern_new_work:false`; duplicate
  `plan_version`; mistyped/extra key; a `SUPERSEDED`-record candidate + a `supersedes`-edge candidate (each →
  `UNREPRESENTABLE…`); a malformed `#superseded` entry (→ `UNSUPPORTED_RETIREMENT_KIND`); **a MULTI-HOP chain
  `v11→v13→v15` where v13 is itself a valid superseded entry → `consistent`** (discriminates transitive
  resolution — an impl requiring every `superseded_by`===`active_plan.version` FAILS this); a chain that does
  NOT terminate at `active_plan.version` → `inconsistent`. **GOLDEN over the real `CURRENT-AUTHORITY.json`:** 4
  plan-versions, all `superseded_by=v15`, all `must_not_govern_new_work:true` → `consistent`.
- `scripts/test-boundary.mjs`: source-profile boundary oracle (reused from Lachesis + its hardening).
- **`scripts/test-readonly.mjs` (executable READ-ONLY oracle) — ALLOWLIST posture (sounder than a denylist):**
  scans ALL runtime `.mjs`/`.js`/`.cjs` recursively (excluding `scripts/`), comment-stripped, and requires:
  (a) every `node:fs` import is a NAMED import drawn from a closed READ allowlist (`readFileSync`, `readdirSync`,
  `realpathSync`, `statSync`, `lstatSync`, `existsSync`) — `openSync` is EXCLUDED (write-capable via its flag
  argument, which a name scan cannot constrain); the runtime reads with `readFileSync` only; any other `node:fs`
  named import → fail; (b) NO namespace import of `node:fs` (`import * as fs`)
  and no `node:fs/promises` (defeats name-based checking / exposes FileHandle writers); (c) NO import of
  `node:child_process`, `node:worker_threads`, `node:vm`, `process.binding`, `process.dlopen`; (d) deny known
  GLOBAL write paths that need no import — `process.report.writeReport`, `process.report.directory`/`filename`
  assignment, `process.chdir`; (e) the boundary oracle already bans dynamic
  `import()`/`require`/`createRequire`/`Module._load`/`eval`. Plus branch-isolating fixture negatives (each
  flagged). **NON-CLAIM (honest — corrects the rev-4 overclaim):** a FAIL-CLOSED STATIC check over the KNOWN
  import + named-global write surface — NOT a proof of no-write and NOT a runtime sandbox; a determined write
  via an unenumerated global/API is not provably excluded (e.g. built-in global surfaces evolve). The read-only
  guarantee rests on the SMALL reviewed runtime surface + zero-`dependencies` + the import allowlist + no
  dynamic loading; the oracle is strong evidence, not a proof.

## 6. Anchoring + memory layout
No CHANGE-PROTOCOL edit (design decision, per ruling). `atropos/memory/CONTRACTS/supersession.json` starts
**`SPECIFIED-PENDING-IMPLEMENTATION`** with its authority triple = {plan `sha256:` of the matured approach,
`authz-N` minted at the TELOS gate, the affirmative `decision-atropos-cycle-1` id} (all EXIST by the time the
contract is authored in Argo, post-authorization — Lachesis pattern). It becomes `NORMATIVE-CURRENT` ONLY WHEN
`scripts/test-verify.mjs` passes **AND** the enrollment integrates with `docs/institutional-memory/verify-contracts.mjs`
(the atropos manifest entry + the `future-atropos-unimplemented`→implemented check flip). Anchors to the
pre-review + authz; NO CHANGE-PROTOCOL anchor.

`atropos/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`; `CONTRACTS/supersession.json`;
`DECISIONS/{decision-atropos-cycle-1.json, rejected-alternatives.md}`; `NON-CLAIMS.json`/`.md`;
`FAILURE-MODES.md`; `EVIDENCE/`; `comprehension-queries.json`; `README.md`. **Machine-first + human-rendered
with a renderer + drift oracle:** `scripts/render.mjs` + `scripts/test-render.mjs` (`--check`) so the `.md`
projections cannot drift from the machine records. `package.json`: `"type":"module"`, `dependencies` empty.

**COMPREHENSION GATE (frozen "Reading ≠ understanding" — precondition to implementation authority):** a
PASSING artifact from `docs/institutional-memory/comprehension-gate.mjs` over `atropos/memory/comprehension-queries.json`
(GRANTED, with the negatives DENIED) MUST be produced AND preserved (as `docs/runs/atropos-1/reader-validation-artifact.json`)
BEFORE Argo exercises implementation authority — same gate Lachesis passed. Acceptance order: author the
memory set + SPECIFIED-PENDING contract → comprehension gate GRANTED (preserved) → Argo implements
ingest/detect/verify + oracles until `test-verify.mjs`/`test-boundary.mjs`/`test-readonly.mjs`/`test-render.mjs`
pass → contract flips NORMATIVE-CURRENT + verify-contracts integration → submit (not authorization).

## 7. Non-goals (cycle 1)
No mutation of `CURRENT-AUTHORITY`/records (read-only, oracle-enforced); no deletion; no enforcement gate; no
`import` of `clotho/`; no `deriveNodeId` (node-backed identity resolution deferred); no npm dependency; no
Narcissus work; no CHANGE-PROTOCOL edit; no extension of the registered meaning; no invented non-plan
`CURRENT-AUTHORITY` reflection schema; the full weave-node-backed three-surface verifier is deferred to a
future cycle.
