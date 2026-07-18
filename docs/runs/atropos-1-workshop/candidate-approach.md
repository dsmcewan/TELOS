# Candidate approach (rev 2) — Atropos (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-atropos-1.json`.
**Registered meaning (fixed):** Atropos *retires obsolete relationships, artifacts, tools, and processes* —
"handles supersession". Cycle-1 realizes the **VERIFICATION** of that meaning (READ-ONLY), NOT the mutation.
Authoritative scoping: `daedalus/IDENTITY.md`. No extension. Machine-first.

Rev 2 incorporates the round-1 technical resolutions from **codex, the peer planning/dev model** (Claude
deferred to GPT on two design calls — ordinary model collaboration, `decision-round-1-result.json`; The Eye's
consequential authority — merges/authorization/enrollment — is unaffected) and fixes the round-2 objections.
**Design decision, not a governance change:** per The Eye/coordinator, the per-kind surface applicability is a
technical call resolved by the peer model — **no CHANGE-PROTOCOL edit** (that draft is superseded).

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
- **weave-node-backed** — a `SUPERSEDED` record or `supersedes` edge whose retired identity is a 64-hex id
  PRESENT as a weave node id in the snapshot (set-membership — NOT `deriveNodeId` re-derivation; boundary-safe).
- **unrepresented/unknown** — anything else: an id in more than one source with disagreement, an identity
  appearing as BOTH a plan-version and a weave node, a bare edge/record with no resolvable first-class weave-node
  identity, or a malformed shape. NEVER silently assigned the smaller plan surface set.
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

## 4. Ingestion (fail-closed) — `atropos/ingest.mjs`
Reads `CURRENT-AUTHORITY.json` (closed-shape `#superseded` + `active_plan.version`), the committed record set,
and the weave `supersedes`-edge slice (reusing Lachesis's snapshot loader design). Every anomaly throws; no
partial result reaches the verifier. Trust NON-CLAIM: integrity RELATIVE TO the supplied inputs; no durable
authenticated root (HELD for The Eye).

## 5. Oracle + golden
- `scripts/test-verify.mjs`: discriminating fixtures each FAIL a wrong impl — dangling/self/cyclic
  `superseded_by`; `active_plan.version` also superseded; `must_not_govern_new_work:false`; duplicate
  `plan_version`; mistyped/extra key; a node-backed candidate (→ `UNREPRESENTABLE…`); an unknown candidate (→
  `UNSUPPORTED_RETIREMENT_KIND`); an id as both plan-version and weave node (→ unknown). **GOLDEN over the real
  `CURRENT-AUTHORITY.json`:** 4 plan-versions, all `superseded_by=v15`, all `must_not_govern_new_work:true` →
  `consistent`.
- `scripts/test-boundary.mjs`: source-profile boundary oracle (reused from Lachesis + its hardening).
- **`scripts/test-readonly.mjs` (executable READ-ONLY oracle):** static scan of the runtime surface
  (`ingest.mjs`/`verify.mjs`/`detect.mjs`) rejecting any fs-WRITE API (`writeFile*`, `appendFile*`, `rm*`,
  `rename*`, `mkdir*`, `unlink*`, `truncate*`, `chmod*`, `open` with a write flag, `createWriteStream`) +
  fixture negatives — so READ-ONLY is machine-enforced, not merely asserted.

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

## 7. Non-goals (cycle 1)
No mutation of `CURRENT-AUTHORITY`/records (read-only, oracle-enforced); no deletion; no enforcement gate; no
`import` of `clotho/`; no `deriveNodeId` (node-backed identity resolution deferred); no npm dependency; no
Narcissus work; no CHANGE-PROTOCOL edit; no extension of the registered meaning; no invented non-plan
`CURRENT-AUTHORITY` reflection schema; the full weave-node-backed three-surface verifier is deferred to a
future cycle.
