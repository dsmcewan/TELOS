# Clotho Phase 1 — Plan Amendments, Round 11 (normative delta to plan v11)

Input to the eleventh Daedalus delta workshop. Source: **the codex required
seat's fourth dissent** in TELOS authorization `authz-004`
(`docs/runs/clotho-authorization-4/`, preserved as `NOT_AUTHORIZED`) against
released plan v11 (`sha256:f5d9cd52…`), **plus a human scope decision by The
Eye** recorded in `docs/clotho-phase-1-scope-decision.md`.

Unlike rounds 2–10 (surgical single-defect repairs), round 11 carries a
**scope change**: Phase 1 is ruled **advisory and non-sandboxed**. Codex raised
four independent hard stops; exactly one (the loader-isolation claim) is
resolved by **descope**, and the other three (coverage honesty, publication-time
provenance integrity, per-weaver attribution) are **kept and repaired** — they
are central to Clotho's actual job.

**Resolution of codex's stop 1 is by claim removal, not by adding coverage.**
Clotho stops *claiming* proven inbound/outbound loader isolation, so it no
longer needs to prove evasion coverage. No amendment in this round adds,
specifies, or requires executable loader-evasion route coverage.

Accepted amendments this round: **AM-35 … AM-39**. Each gives the exact current
text and its replacement so the delta applies unambiguously.

---

## AM-35 — Phase 1 is advisory and non-sandboxed (remove the isolation claims)

### Scope statement (new, normative)

> Clotho Phase 1 is an advisory deterministic knowledge-graph extractor
> operating on trusted repository code and potentially hostile *data* inputs.
> It is **not** a JavaScript sandbox, a module-capability boundary, or a proof
> of executable loader isolation. Arbitrary trusted implementation code runs
> with ordinary Node authority. Content addressing proves *which declared bytes
> were reviewed and used*; it does not prove those bytes lack every possible
> ambient loading route.

The deterministic outbound scanner and the closed loader-capable-builtin
mapping (D27/D32) **remain as advisory hardening** — best-effort, deterministic
over a frozen set of *lexically recognizable* forms. What is removed is the
**claim of proof / structural guarantee**, not the deterministic checks.

### Defect (codex hard stop 1)

> The advisory-boundary scanner does not cover current executable loader-evasion
> routes, so it cannot establish the claimed inbound or outbound isolation.

The plan *claims* the advisory boundary is "proven against evasion" (D23) and
that general-purpose loader acquisition is "structurally prohibited" (D30). The
evidence does not support those claims, and establishing them would require the
evasion-route coverage The Eye has ruled out of Phase 1 scope.

### D23 — remove the "proven against evasion" claim

**Current (plan v11, line 61):**

> | D23 | The advisory boundary is proven against evasion, in both directions. | …

**Amended:**

> | D23 | The advisory boundary is a deterministic, best-effort scanner over
> recognized specifier forms — **not** a proof of isolation. | The outbound
> scanner deterministically flags the lexically recognized specifier forms it
> knows (D27): outside Clotho, nonliteral `require()`/`module.require()` and
> symlink aliases into `clotho/` are reported; inside Clotho, only Node
> built-ins and accepted literal relative forms resolving physically into
> `clotho/` or the permitted `merkle-dag/` closure are recognized as in-policy,
> and every other recognized form is flagged. Forms outside the frozen lexical
> set are reported as **unclassified**, not certified absent. This is advisory
> signal for reviewers; it does **not** establish that a malicious or
> compromised implementation cannot obtain loader authority. |

### D30 — remove the structural-prohibition claim

**Current (plan v11, line 68):**

> | D30 | Constructed module loaders are prohibited inside Clotho (spec v2.6). |
> Clotho may not construct, obtain, alias, or invoke a general-purpose module
> loader. …

**Amended:**

> | D30 | Constructed module loaders are **advised against and lexically
> flagged** inside Clotho; acquisition is **not** claimed to be structurally
> impossible (spec v2.6, narrowed round 11). | The deterministic scanner flags
> the frozen loader-construction forms it recognizes (`createRequire` and
> `process.getBuiltinModule("module"|"node:module")` under the recognized
> spellings, non-safe exports of loader-capable built-ins per the D32 mapping,
> namespace/default imports of those modules). Recognized forms are reported;
> forms outside the frozen lexical set fail *classification* (reported
> unclassified), not *acquisition*. The mapping keeps the recognized surface
> enumerable. This is advisory hardening for trusted-code review — **not** a
> guarantee that loader acquisition is prohibited. |

### Design-doc parallel (clotho-phase-1-design.md, lines 440–464)

**Current:** "No constructed module loaders (v2.6, mapping frozen v2.7). Clotho
may not construct, obtain, alias, or invoke a general-purpose module loader. …"

**Amended:** reframe the heading and lead sentence as **advisory** — "Advisory
loader-construction scanning (v2.6, mapping frozen v2.7). The scanner flags the
recognized loader-construction forms; it does not prove a malicious
implementation cannot obtain a loader." Keep the `LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS`
mapping and the "fails closed on nonlisted *recognized* access" mechanism as
advisory checks; drop the implication that this constitutes a capability
boundary.

### Accepted risk 18 — replace with an explicit non-sandbox statement

**Current (plan v11, lines 1898–1905):** "Loader-scanner syntactic boundary
(D30/D32): the loader-construction prohibition is enforced over the frozen
syntactic forms; genuinely novel or obfuscated construction routes … A future
Node API … would require a specification amendment …"

**Amended:**

> 18. **Non-sandbox boundary (D23/D30/D32):** Clotho is not a sandbox or a
>     module-capability boundary. Trusted implementation code runs with ordinary
>     Node authority and can, in principle, obtain a module loader through routes
>     outside the scanner's frozen lexical form set (obfuscated, computed,
>     aliased, or future-API routes). The deterministic scanner is **advisory
>     signal for human review of trusted code**, not a containment control; it is
>     never relied upon to isolate hostile code. Hostile *data* inputs are
>     handled by the extractor's input discipline, which is a separate concern
>     from loader authority.

---

## AM-36 — Narrow mechanism provenance (D14/D33) to the supported static model

### Defect

D14 says provenance "binds the whole executable mechanism"; D33 says the closure
"describes **bytes capable of executing**" and that "No published manifest may
identify an executed mechanism while omitting a file reachable through an
accepted relative module-loading form." Combined with the non-sandbox ruling,
these overclaim: they read as *the complete set of code the Node process could
possibly execute*, which Clotho cannot establish.

### Change

`implementation_refs` and `orchestrator_refs` represent the **exact supported,
statically declared dependency inventory** — the transitive closure over the
accepted *literal* relative module-loading forms — and must **not** be described
as the complete set of code the Node process could possibly execute.

- **D14 (line 52):** replace "binds the whole executable mechanism" with "binds
  the **supported statically declared dependency model**"; keep the exact-equality
  test between committed inventory and derived closure.
- **D33 (line 71):** replace "the closure describes **bytes capable of
  executing**, not observed branch coverage" with "the closure describes the
  **supported, statically declared dependency model** — the bytes reachable
  through accepted *literal* relative forms — not observed branch coverage and
  **not** every module the process could possibly reach." Replace the final
  sentence "No published manifest may identify an executed mechanism while
  omitting a file reachable through an accepted relative module-loading form"
  with "No published manifest may claim to cover the supported static dependency
  model while omitting a file reachable through an accepted *literal* relative
  module-loading form."

This preserves the deterministic closure and its tests; it only corrects the
scope of the *claim*.

---

## AM-37 — Coverage honesty: a missing manifest must not read as complete (D11)

### Defect (codex hard stop 2)

> The query API treats an omitted coverage manifest as an empty coverage-unknown
> set for `threadsOf` and `blastRadius`, allowing incomplete results to appear
> complete.

**Current (plan v11, Task 4b, lines ~1280–1292):** "A missing manifest leaves
`coverageUnknown` empty for `threadsOf`/`blastRadius` but is an error for
`why`/`reportGaps` when `expectedKinds` is nonempty …"

### Change

`threadsOf` and `blastRadius` must **require a validated coverage manifest or
conservatively report producer coverage as unknown**. A missing manifest must
**never** yield `coverageUnknown: []`.

> When no verified manifest is supplied, `threadsOf` and `blastRadius` report
> **all edge kinds whose producing weavers cannot be confirmed `executed`** in
> `coverageUnknown` (i.e. producer coverage is *unknown*, conservatively), and
> mark the result `coverage: "unverified"`. `coverageUnknown: []` is emitted
> **only** when a verified manifest proves every consulted producer executed.
> This follows the plan's existing rule that **absence remains classifiable** —
> missing evidence is reported as unknown, never silently as complete.

Update the `threadsOf`/`blastRadius` interfaces and add driver tests: a query
with no manifest must not return an empty `coverageUnknown`; a query whose
manifest omits a consulted producer must surface that producer as unknown.

---

## AM-38 — Publication-time provenance integrity: re-derive, compare, abort (D33)

### Defect (codex hard stop 3)

> The complete-weave driver does not derive and enforce module-load closure
> equality at publication time, allowing a changed worktree mechanism to publish
> provenance that omits newly reachable files.

D33 requires inventory/closure equality and AM-34 added a tampered-inventory
test, but the *driver* does not re-establish equality against on-disk bytes at
the moment of publication.

### Change (evidence-integrity requirement, not a sandbox claim)

> Immediately before close and publication, the complete-weave driver must, for
> every weaver and orchestrator entry point: **re-read the actual mechanism bytes
> from disk**, derive the supported static dependency inventory with the shared
> classifier/resolver, **compare it exactly** with the committed inventory, and
> **re-check the content-address hashes** placed into `implementation_refs` /
> `orchestrator_refs` and `repository_ref`. **Any drift aborts publication** — no
> ledger is closed or published. Add a driver test where an on-disk source gains
> a re-export, a literal dynamic import, or an accepted require-style edge absent
> from its committed inventory, and prove nothing is closed or published.

The published provenance statement is:

> "These references exactly cover the **supported, statically declared
> dependency model** at publication time."

and explicitly **not**:

> "These references cover every module the process could possibly reach."

---

## AM-39 — Per-weaver mechanism attribution (D10/D5)

### Defect (codex hard stop 4)

> The driver does not require each returned edge's `asserted_by` value to equal
> the weaver that produced it, permitting false mechanism attribution.

D10 couples `asserted_by` to `assertion_status` at write time, but the driver
does not bind a weaver's returned edges to *that* weaver's id.

### Change

> Before appending any weaver result, the driver must require **every edge** in
> that result to have `asserted_by` **exactly equal to the invoked weaver id**
> and `assertion_status` exactly `deterministic-extraction`; likewise any
> `warning.weaver` must equal that same id. A weaver result asserting a
> different weaver's id, `human`, or `model:<seat>` is **rejected** (append
> fails) — a deterministic weaver cannot attribute its output to another weaver,
> a human, or a model. Add driver-level tests for each rejected case
> (cross-weaver id, human attribution, model attribution, mismatched
> `warning.weaver`).

This composes with the existing trailer invariant (line 596: an edge asserted by
a weaver id requires that weaver's trailer `state: executed`) and the existing
rule that status transitions must be `human` — it adds the missing
**producer==attribution** binding at append time.

---

## Out of scope for this delta

- No executable loader-evasion route coverage is added (The Eye's ruling).
- No change to the code-weaver's knowledge-graph extraction semantics.
- No new architecture; AM-35…AM-39 are confined to the five accepted repairs.
- `authz-004` is **not** modified; it remains `NOT_AUTHORIZED`.

## Exit

A focused Daedalus delta matures these five amendments into plan **v12**; The
Eye releases the content-addressed candidate; `authz-005` convenes with the
unchanged constituency (claude, agy, codex required; grok/gemini advisory).
**Argo stays closed until `authz-005` returns `AUTHORIZED`.**
