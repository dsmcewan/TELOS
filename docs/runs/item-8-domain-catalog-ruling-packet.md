## Item 8 — Closed domain id catalog for Surface B (bind to Production Profile Compiler registry) and closed `must_not_weaken` enum for Surface C

### What is actually at stake

The Artifact shape in the v2 design doc specifies both fields as if a closed set already
exists to bind to: `production[].domain` is commented **"closed id from profile catalog or
`governance-runtime:*`"** (`docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md:571`),
and `workflow_optimization[].must_not_weaken` is commented **"friction | signatures | rule-3 |
eye-gates | ..."** (`:582`) — a trailing ellipsis that admits the list is open, not closed. Neither
comment is backed by an implemented registry on disk. The Production Profile Compiler (PPC) —
the thing Surface B says to bind to — is **HELD design + plan only**: `git log --stat` on
`feature/deterministic-production-profile-compiler` shows every commit on that branch is a doc or
council-authorization-run artifact (`docs(production-profile): add implementation plan`,
`docs: design deterministic production profile compiler`, plus `run-authorization.mjs` /
`test-runner.mjs` council packets under `docs/institutional-memory/`); there is no `.mjs` file
anywhere in the repository, on any branch, that compiles a profile or exposes a domain registry.
`grep -rln "compileProductionProfile\|productionProfileCompiler"` returns nothing. The
authorization council itself has not converged on this plan — the branch's own commit history
shows `Record authz-010 fail-closed council attempt`, `Record authz-011 retry failure`,
`Record authz-012 plan revision verdict`, `Prepare authz-013 council runner` in sequence, i.e. a
still-unresolved authorization loop, not a shipped registry Surface B could import today.

Worse, the domain-id **literal strings** the PPC corpus itself uses are not even internally
consistent. Across the entire PPC design + plan corpus, exactly two literal domain slugs appear:
`"ai-use-and-data-egress"` (kebab-case, matching prose domain 11) in the policy-contract example
(`docs/superpowers/specs/2026-07-20-deterministic-production-profile-compiler-design.md:650,742`),
and the bare word `domain data` (no kebab-case, no "-integrity-and-persistence" suffix) in the
Eye-approved `FILE-INGRESS-001` fixture-matrix row
(`docs/superpowers/plans/2026-07-20-deterministic-production-profile-compiler.md:1293-1298`). The
other nine of the "eleven closed domains" (asserted at design-doc line 151 and 702, and
plan-doc line 55-56 and 1289) are named only in **numbered English prose**, never as machine
identifiers. `grep -n "domain" check-registry.mjs risk-policy.mjs` returns nothing — the closed-set
registries CLAUDE.md already points to for this discipline (`NA_ALLOWED`, `EVIDENCE_KINDS`,
`check-registry.mjs`) have no domain concept at all; they are a different closed set (check-kind
→ executable, and authorization-check-key → pass/n/a), not this one. So "bind to the Production
Profile Compiler registry" is currently an instruction to bind to something that does not exist as
code and whose own two sample literals do not even share a naming convention.

The `must_not_weaken` question has a parallel defect, but sharper: the design doc names this list
**twice with different contents**. The Surface C intro says an optimization "that removes
**friction, signatures, or Rule 3** is non-compliant" — three items, no Eye-gates (`:545`). Stage
1 rule 4, the actual controller-enforcement point, says the controller "rejects dispositions that
mark those `must_not_weaken` controls as skippable" for **friction, signatures, Rule 3, or Eye
gates** — four items (`:625-627`). Grepping `must_not_weaken` across the whole repository
(`grep -rn "must_not_weaken" --include="*.md" --include="*.mjs" --include="*.json"`) returns only
these same three line hits inside this one design doc — no evidence anywhere else on disk of a
prior ruling, prior enum, or prior controller check for this field. There is no
`must_not_weaken.mjs`, no test file, nothing to inherit; item 8 is choosing the enum from scratch.

### Surface B — the domain-id catalog

#### Option A — Mint the eleven domain ids now, directly from the PPC design doc's own numbered list, and reserve `governance-runtime:*` for the seven listed governance-runtime bullets

**The case for it.** The eleven domains are not actually undefined — they are numbered and named
in prose at design-doc line 151-163, and the v2 design doc's own Surface B table
(`daedalus-workflow-v2-design.md:492-504`) already restates the same eleven clusters nearly
verbatim (identity/auth, authz/tenant isolation, payments/billing, data integrity/persistence,
scale/perf/rate-limits, observability/incident-response, CI/CD/envs/rollback/flags,
availability/backups/DR, privacy/retention/deletion, third-parties/supply-chain,
AI-use/egress/agent-authority). Turning eleven already-agreed-on English names into eleven
kebab-case ids is mechanical, reviewable in one sitting, and does not require the PPC
authorization loop to resolve first — Stage 0 research happens long before any obligation-matrix
binding, so a research artifact needs a stable id **today**, independent of whether the checker
ever ships. The `governance-runtime:*` half of the field already has its own closed content to
enumerate: the seven bullets at design-doc line 508-514 (`trust_mode: signed`, secret/key custody,
prompt/data redaction + egress allowlist, provider cost envelope + timeout/429, durable store,
required CI/merge gates, Eye/human SLA) — these can become `governance-runtime:trust-mode`,
`governance-runtime:secret-custody`, `governance-runtime:redaction-egress`,
`governance-runtime:cost-envelope`, `governance-runtime:durable-store`,
`governance-runtime:ci-merge-gates`, `governance-runtime:eye-sla`, closing both halves of the
comment at line 571 in one pass.

**The case against it.** Minting now creates a second source of truth that the PPC's own eventual
registry may not match — and the PPC corpus's own two existing literal examples already disagree
on naming convention (`ai-use-and-data-egress` vs bare `data`), so there is no guarantee the
compiler, once it ships, will use kebab-case-of-the-English-name at all. If Daedalus v2 freezes
eleven ids today and PPC later exports a different eleven, every Stage 0 research artifact's
`production[].domain` values under the old enum become orphaned — not unsafe, since Stage 1
disposition review still gates whether anything reaches the obligation matrix
(`daedalus-workflow-v2-design.md:590-593`: "Suggested obligations are never auto-inserted... without
Seat 2 constraint ownership and controller validation"), but it does mean a mechanical remap of
every prior research artifact the first time PPC actually compiles.

**What it costs.** One small frozen array (11 domain ids + 7 governance-runtime suffixes),
following the `Object.freeze` pattern already used by `EVIDENCE_KINDS`
(`build-gate/evidence.mjs:84-93`) and the closed-array pattern used by `POLICY_CHECK_KEYS`
(`merkle-dag/proposal-ledger.mjs:229-233`). No runtime cost; this is Stage 0 research-artifact
validation, not a hot path.

**What breaks if it is wrong.** If PPC ships with different domain ids, the failure mode is a
one-time migration of research-artifact `domain` values, surfaced by the same content-address
discipline that already protects this repo (an artifact citing a hash whose referent has changed
identity fails closed per invariant 5's "you cannot recurse on a ghost",
`daedalus-workflow-v2-design.md:443-444`) — not a silent security gap. The § Relation to
Production Profile Compiler section already anticipates supersession: "If a deterministic
production profile is compiled for the host, Stage 0 treats its obligation set and profile hash as
prior residue" (`:596-598`). That clause should explicitly extend to domain ids: **the moment PPC
compiles and exports its own registry, that registry supersedes the v2-minted list — this is a
one-time controlled migration cited by hash, not a standing dual-maintenance burden.**

#### Option B — Leave `domain` as free text / `unknown` until PPC ships; enforce only the `governance-runtime:*` prefix today

**The case for it.** Follows the artifact-shape comment literally — "closed id from **profile
catalog**" — by waiting for the actual catalog rather than inventing a stand-in. Avoids the
drift risk in Option A entirely: there is only ever one canonical domain-id source, whenever it
arrives.

**The case against it.** This is not a deferral to a near-term event — the PPC authorization loop
has already failed once and retried at least twice on this branch (`authz-010 fail-closed council
attempt` → `authz-011 retry failure` → `authz-012 plan revision verdict` → `authz-013` in
preparation), so "until PPC ships" has no bound today. Leaving `domain` as free text means Surface
B is not actually closed for however long that authorization loop runs — any seat can write any
string, and Stage 1 rule 2's own enforcement ("Production-bound frames cannot set aside all of
Surface B without an Eye-visible waiver hash", `:621-622`) becomes unenforceable, because there is
no closed set to validate `domain` against in the first place. This defeats the exact discipline
item 8 was raised to install, and is the same class of defect CLAUDE.md names directly: "no
mutable label may key an enforcement decision" — an open string field is a mutable label standing
where a closed identity belongs.

**What it costs.** Nothing today; the cost is deferred, open-ended risk.

**What breaks if it is wrong.** Every Stage 0 research artifact produced before PPC ships records
`production[].domain` as an uncontrolled string. When PPC eventually does ship, none of that prior
research reconciles to its registry without manual reclassification — the exact same migration
cost as Option A's worst case, except paid with zero interim validation instead of validation that
degrades gracefully.

### Surface B — recommended ruling

**Adopt Option A: mint the eleven domain ids now, directly from the PPC design doc's own
already-named eleven domains, plus the seven governance-runtime suffixes already listed in the v2
design doc itself — and add one sentence to § Relation to Production Profile Compiler stating that
PPC's own exported registry supersedes this list on a one-time hash-cited migration, not a
standing parallel source of truth.** The single strongest reason: the PPC authorization loop is
demonstrably not close to done (two recorded failures and a retry already on disk), so "wait for
the real catalog" is not a short deferral — it is an indefinite one that leaves Stage 1 rule 2
unenforceable in the meantime, which is the exact defect the content-address rule exists to
prevent. This recommendation flips if The Eye judges the PPC authorization loop close enough to
resolution (e.g., authz-013 converges) that Surface B can simply wait the remaining distance — in
that case Option B's single-source-of-truth purity is worth the short wait, and Item 8's Surface B
half should be re-opened once PPC's actual registry lands rather than ruled now.

---

### Surface C — the `must_not_weaken` enum

#### Option A — Close the enum to exactly the tokens already written in the design doc: `friction | signatures | rule-3 | eye-gates`

**The case for it.** Zero invention — this is verbatim what the doc already says at Stage 1 rule 4
(`:625-627`), the actual controller-enforcement point. Shipping it as-is requires no new design
work, and a workshop implementer can close the ellipsis by simply deleting it.

**The case against it.** The doc's own two citations of this list **disagree with each other** —
line 545 has three items (drops eye-gates), line 625-627 has four. Picking either verbatim leaves
an unresolved internal inconsistency unaddressed rather than ruled on. More seriously: the doc's
own **Invariants** section (`:679-704`) names twelve numbered mechanisms it calls load-bearing —
governance-first, friction, Seat-5-neutrality, hash-is-law, hash-is-action-and-why,
hashes-are-recursive-data, order-is-compiled, deny-reenters-the-join, provenance-or-burn, Rule-3,
convergence-≠-authorization, and closed-caps — of which the four-token list covers only two
(friction ≈ invariant 1, Rule-3 = invariant 9) plus two concepts from outside the numbered list
entirely (signatures = the inherited build-gate HMAC/`trust_mode` spine per CLAUDE.md's "Security &
trust" section; Eye-gates = The Eye's four-point section, `:115-129`). Seat-5 neutrality,
hash-is-law, hash-recursion, compiled order, provenance-or-burn, and closed caps are **not**
covered by any token in the four-item list. A `workflow_optimization` proposal that, say, thinned
Seat 5's per-transition checkpoint to "spot-check every third transition," or proposed caching
`plan_hash` recomputation across runs in a way that broke recursion's fail-closed-on-drift rule
(invariant 5, `:443-444`), or proposed loosening the closed-caps ceiling (invariant 11) as a
"budget optimization" — none of these would be caught by Stage 1 rule 4's reject check, because
none of the weakened controls is spelled by any of the four recognized strings. The very mechanism
item 8 exists to close would ship with a hole exactly where an "optimization" is most likely to
aim: at the mechanisms that cost rounds or calls (Seat 5 checkpoints, caps, recursion integrity).

**What it costs.** Nothing to build; the cost is the uncaught gap described above.

**What breaks if it is wrong.** A Surface C proposal marked `used` weakens an invariant outside the
four named strings; Stage 1's controller check (as literally scoped to "those `must_not_weaken`
controls," `:626`) has nothing to match against and does not fire; the weakening enters the plan
labeled as compliant optimization. This is quiet in the same way item 7's early-`needs-work` risk
is quiet — nobody audits an optimization that was never flagged as touching a protected mechanism,
because the field-level check by construction only looks at values it recognizes.

#### Option B — Close the enum to one token per invariant the doc's own Invariants section (`:679-704`) already names, retaining `signatures` and `eye-gates` as two additional tokens for the two protected mechanisms the Invariants section references but does not itself number

**The case for it.** This is not new design — it is a restatement of rulings The Eye already
accepted. The Hold record at the bottom of the doc (`:764-775`) explicitly ratifies "primary
friction," "secondary friction," "Seat 5 = neutral," "role R," "Merkle-DAG supplies hash + order,"
"each load-bearing hash is an action and a why," and "those hashes are the data of recursion" — a
`must_not_weaken` enum built from the Invariants section is naming exactly those already-accepted
mechanisms, not inventing new ones. It gives Stage 1 rule 4 a genuinely closed reject-list: any
`workflow_optimization` proposal that claims to touch a load-bearing mechanism must cite one of a
complete, enumerable set of tokens, and the controller can reject "used" dispositions against every
one of them, not just four. Proposed enum (12 tokens, `SCREAMING_SNAKE` to match this codebase's
other frozen constant style, e.g. `EVIDENCE_KINDS`):

```
FRICTION                        // invariant 1 — dual ownership + external deny-back
SEAT5_NEUTRAL                   // invariant 2 — no technical tie-break
HASH_IS_LAW                     // invariant 3 — content addresses, never mutable labels
HASH_ACTION_AND_WHY             // invariant 4 — preimage binds action + why
HASHES_ARE_RECURSIVE_DATA       // invariant 5 — prior residue is next frame's input
ORDER_IS_COMPILED               // invariant 6 — topo_order, not chat turn order
DENY_REENTERS_THE_JOIN          // invariant 7 — deny feeds friction, never silently blends
PROVENANCE_OR_BURN              // invariant 8 — real distinct response ids or burn
RULE_3                          // invariant 9 — controller re-derives disk + tests
CONVERGENCE_NOT_AUTHORIZATION   // invariant 10 — model accept is submission, not authority
CLOSED_CAPS                     // invariant 11 — round/dual-denial ceilings
SIGNATURES                      // inherited spine: packet HMAC / trust_mode discipline
EYE_GATES                       // The Eye's four points (freeze / plan / code / release)
```

**The case against it.** More tokens to maintain, and a real risk of over-breadth: a legitimately
narrow Surface C proposal that only touches a tunable, explicitly-open dial — the referee effort
tier or cadence thresholds that item 7 already treats as unruled and adjustable
(`daedalus-workflow-v2-design.md:292-293`, item-7 packet's Cadence section) — could get swept into
`PROVENANCE_OR_BURN` or `CONVERGENCE_NOT_AUTHORIZATION` by an overcautious reviewer and rejected as
"touching a protected mechanism" when it was not. There is also no evidence on disk today that any
Surface C proposal has ever attempted to weaken a deep invariant like hash-is-law or
order-is-compiled — the risk being closed is hypothetical, not observed, the same evidentiary gap
item 7's ruling flagged for the referee-model question.

**What it costs.** Defining twelve frozen tokens plus one Stage 1 controller check enumerating
them against the doc's own Invariants section — a small, one-time authoring cost, following the
same `Object.freeze` pattern as `EVIDENCE_KINDS` (`build-gate/evidence.mjs:84`) and the same
closed-array pattern as `POLICY_CHECK_KEYS` (`merkle-dag/proposal-ledger.mjs:229-233`).

**What breaks if it is wrong.** An over-broad token match blocks a benign optimization proposal
that merely reorganizes bookkeeping without touching the named mechanism's substance. This is
recoverable and non-safety-relevant: the disposition returns to Stage 1 as friction (the same
"defends or modifies" path any Stage 2/4 deny already uses, `:216-231`), costing a round, not a
governance failure.

### Surface C — recommended ruling

**Adopt Option B: close `must_not_weaken` to one token per numbered invariant in the doc's own
Invariants section, plus `SIGNATURES` and `EYE_GATES` for the two protected mechanisms that section
references but does not itself number — and resolve the line-545/line-625 inconsistency by deleting
the shorter three-item list in favor of this closed set.** The single strongest reason: Option A's
four-token list is not merely incomplete, it is internally inconsistent within the same document,
and it structurally exempts from Stage 1's own reject check exactly the mechanisms — Seat 5
checkpoints, closed caps, hash/order integrity — that a cost- or latency-motivated "optimization"
proposal is most likely to target, since those are the ones that cost rounds and calls. A closed
enum that only catches four named strings while leaving eight load-bearing mechanisms unnamed is
not the closed-set discipline CLAUDE.md requires elsewhere in this repo; it is a partial list
wearing the word "closed." This recommendation flips toward Option A only if The Eye judges the
broader token set's false-positive risk (blocking benign bookkeeping optimizations against
`ORDER_IS_COMPILED` or `HASHES_ARE_RECURSIVE_DATA`) as costlier than the uncaught-weakening risk it
closes — but no evidence on disk today supports that trade being live; both risks are currently
hypothetical, and the closed-set discipline this project already applies everywhere else
(`NA_ALLOWED`, `EVIDENCE_KINDS`, `check-registry.mjs`, per CLAUDE.md) resolves ties toward the
complete enumeration, not the convenient sample.
