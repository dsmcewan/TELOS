# Candidate approach (draft) — Atropos (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-atropos-1.json`.
**Registered meaning (fixed, the boundary):** Atropos *retires obsolete relationships, artifacts, tools, and
processes* — "handles supersession" (`docs/mythological-vocabulary.md#Atropos`). Authoritatively scoped
(`daedalus/IDENTITY.md`): **expressed via `CURRENT-AUTHORITY.json#superseded` + `must_not_govern_new_work`.**
No extension. Authored AI-centric / machine-first (the first-modules standard).

This is a PHASE-1 draft to be matured by the Daedalus workshop AFTER The Eye rules the open questions. It is
grounded in the REAL surfaces (verified by inspection, not assumed — the Lachesis lesson).

## 0. Reality (verified, not presumed)
Supersession is a THREE-SURFACE discipline (CHANGE-PROTOCOL.md): a retired thing is (1) marked `SUPERSEDED`
with `superseded_by` + `must_not_govern_new_work:true`; (2) recorded as a `supersedes` edge in the weave;
(3) reflected in `CURRENT-AUTHORITY.json`. In the LIVE data:
- **`CURRENT-AUTHORITY.json#superseded`** — the ONLY populated surface: 4 entries (retired Clotho plan
  versions v11/v12/v13/v14), closed key set `{plan_version, sha256, authorization, authz_status,
  superseded_by, must_not_govern_new_work, note}`, **all `superseded_by:"v15"` = the current
  `active_plan.version`**, all `must_not_govern_new_work:true`.
- **weave `supersedes` edges** — 0 present. **record `status:"SUPERSEDED"`** — 0 live (only examples/fixtures).
So the real substrate is `CURRENT-AUTHORITY#superseded`; the other two surfaces are validated on synthetic
fixtures + confirmed-empty real data.

## 1. Boundary + trust posture
Zero-dependency Node ESM `atropos/`; NEVER imports `clotho/`; reads `CURRENT-AUTHORITY.json` (and, for advisory
cross-checks, the committed weave snapshot + the record set) as DATA. Sole sanctioned cross-package import:
`merkle-dag/vendor.mjs` (`canonicalize`/`sha256hex`), boundary-enforced by a source-profile
`scripts/test-boundary.mjs` (reuse the Lachesis oracle design). **READ-ONLY**: Atropos detects/verifies; it
does NOT mutate `CURRENT-AUTHORITY`, retire records, or delete anything (supersession, never deletion).

## 2. Ingestion (fail-closed) — `atropos/ingest.mjs#loadSupersession(currentAuthority)`
- `#superseded` must be an array; each entry must have EXACTLY the closed key set with correct types
  (`plan_version` string, `sha256` `sha256:<64hex>`, `authorization` `authz-N`, `authz_status` ∈
  {AUTHORIZED, NOT_AUTHORIZED}, `superseded_by` string, `must_not_govern_new_work` boolean, `note` string);
  missing/extra/mistyped → throw.
- `active_plan.version` + `active_authorization.id` read as the CURRENT authority anchors.
- Fail-closed on any anomaly; no partial result reaches verification. (Trust posture NON-CLAIM: integrity is
  relative to the supplied `CURRENT-AUTHORITY.json`; NO durable/authenticated root beyond it — same honesty as
  Lachesis; durable anchoring HELD for The Eye.)

## 3. NORMATIVE consistency verdict — `atropos/verify.mjs`
Pinned, deterministic (oracle in `scripts/test-verify.mjs`):
- every `#superseded` entry has `must_not_govern_new_work === true` (a superseded thing must not govern);
- every `superseded_by` **RESOLVES to a CURRENT authority** — i.e. `active_plan.version`, OR another entry
  that itself transitively resolves to current; **no dangling** (superseded_by names nothing that exists) and
  **no cycles** (visited-set); a superseded entry may not be its own successor;
- `authz_status` ∈ the closed set; `sha256` well-formed.
- Verdict = `consistent` | `inconsistent` (with the exact failing entries + reason). NORMATIVE.

## 4. ADVISORY retirement report — `atropos/report.mjs`
- what is retired (entries), what supersedes each, whether the chain resolves to current;
- ADVISORY cross-checks (both empty in current data, validated on fixtures): any weave `supersedes` edge whose
  endpoints/targets disagree with `#superseded`; any record `status:"SUPERSEDED"` lacking `superseded_by` +
  `must_not_govern_new_work:true`; anything superseded still being treated as governing.
- ADVISORY only — an input to The Eye/controller under CHANGE-PROTOCOL, never an enforced action.

## 5. Oracle + golden
- `scripts/test-verify.mjs`: discriminating fixtures (dangling superseded_by, a cycle, a
  `must_not_govern_new_work:false` on a superseded entry, a mistyped/extra field, a chain that resolves via an
  intermediate) each FAIL; plus **GOLDEN over the real `CURRENT-AUTHORITY.json`**: 4 superseded entries, all
  `superseded_by = v15 = active_plan.version`, all `must_not_govern_new_work:true` → verdict `consistent`.
- `scripts/test-boundary.mjs`: source-profile boundary (no `clotho/` import, node:-only + the one sanctioned
  vendor, fail-closed on dynamic/computed loading), reused from Lachesis.

## 6. Memory layout (mirrors lachesis/memory/)
`atropos/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`; `CONTRACTS/supersession.json` (the frozen
verify + ingestion semantics, NORMATIVE, becomes_normative_when the oracle passes, with the authority triple
minted at the TELOS gate); `DECISIONS/` (affirmative + `rejected-alternatives.md`); `NON-CLAIMS.json`/`.md`
(read-only; no mutation/deletion; no durable trust root; does NOT itself perform CHANGE-PROTOCOL retirement;
weave/record cross-checks are advisory + empty in current data); `FAILURE-MODES.md`; `EVIDENCE/`;
`comprehension-queries.json`; `README.md`. `package.json`: `"type":"module"`, `dependencies` empty.

## 7. Open questions (HELD for The Eye — do not decide unilaterally)
1. **Verb: verify vs. act.** Registered meaning "retires" (action) vs. the repo's human/controller
   CHANGE-PROTOCOL retirement + Atropos-as-bookkeeping framing. RECOMMEND cycle-1 = read-only consistency
   verifier + advisory report. Confirm, or does The Eye want Atropos to mutate `CURRENT-AUTHORITY`?
2. **Surface set.** `CURRENT-AUTHORITY#superseded` as primary/NORMATIVE; weave `supersedes` + record
   `SUPERSEDED` as ADVISORY cross-checks (both empty). Confirm.
3. **Data sparsity.** Real substrate = only the 4 `#superseded` entries + synthetic fixtures. Acceptable for
   cycle-1, or wait for more real supersession?

## 8. Non-goals (cycle 1)
No mutation of `CURRENT-AUTHORITY`/records (read-only); no deletion; no enforcement gate; no `import` of
`clotho/`; no npm dependency; no Narcissus work; no extension of the registered meaning.
