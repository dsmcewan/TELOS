---
name: memory-standard
description: Use when authoring or evaluating documentation intended to be inherited by an AI model — machine-first records, executable oracles, closed taxonomies
---

# The AI-native institutional-memory standard

## Purpose

Documentation whose inheritor is an AI model: a memoryless successor must reconstruct
the system's intended reality without filling gaps with plausible invention.

A model that inherits a codebase has no memory of how it got that way. It did not sit
in the meetings, did not watch the failed attempts, does not know which alternatives
were tried and rejected for good reasons. If the documentation is ambiguous, ordinary
prose, or simply absent, a capable model will not stop and ask — it will infer, and its
inference will be plausible, confident, and frequently wrong. This standard exists to
close that gap: every load-bearing fact is written down in a form a machine can check,
not a form a machine must interpret. Human-readable documents are a rendered projection
of the machine records, never the source of truth themselves.

## The five disciplines

1. **Authority-anchored.** Every load-bearing statement terminates in a stable
   identifier — a content hash, a decision id, a commit, a ledger entry — never a
   mutable label or bare prose. "The config file" is not an anchor; `sha256:<hex>` of
   that file's bytes is. If the anchor can change without anyone noticing, it is not an
   anchor. The repository's current binding lives in `CURRENT-AUTHORITY.json`.

2. **`NORMATIVE` requires an oracle.** A claim may only carry `NORMATIVE-CURRENT` status
   if it has an executable verification — a test, a property check, a fixture — that
   currently passes. A claim without a passing oracle behind it is, at best, `ADVISORY`:
   documented intent, never enforced. This is the rule that stops the memory layer
   itself from becoming a new source of drift. The structural audit validates that a
   declared oracle path resolves to a regular file; verification executes each
   contract's declared oracle and requires exit `0`.

3. **Three representations.** Every load-bearing claim exists in three forms: human
   prose (why this is true, why it matters), a machine-readable contract (the exact
   data — field names, values, shapes), and an executable verification (the oracle that
   proves the contract matches reality). A claim missing any one of the three is
   incomplete, no matter how well the prose reads.

4. **Machine-first, human-rendered.** The machine records (JSON, or any structured
   format a script can parse) are the source of truth. `INVARIANTS.md` and
   `NON-CLAIMS.md` are byte-derived from their JSON records by a deterministic renderer,
   so they cannot silently drift out of sync with what is actually enforced.
   `INVARIANTS.json` contains only `kind: "invariant"` records and
   `NON-CLAIMS.json` only `kind: "non-claim"` records; a valid record of another kind
   is still invalid in the wrong container. After changing a record, recompute its
   content-addressed `id` and regenerate the rendered Markdown. Never hand-edit facts
   into a rendered `.md` file.

5. **Reading ≠ understanding.** A model having read the documentation is not the same
   as a model having understood it correctly enough to act. No implementation authority
   is granted until a reader submits an answer set and a deterministic comprehension
   gate grades it against machine-derived expected answers and returns GRANTED. A
   confident wrong answer is still DENIED. The gate exits `0` for GRANTED, `2` for
   DENIED, and `1` only when it cannot run.

## Closed record kinds

Every record has a `kind`, drawn from a closed set. Unknown kinds are rejected —
this is not a place for ad hoc invention:

```
mechanism · decision · rejected-alternative · non-claim · invariant ·
open-question · contract · evidence
```

- **mechanism** — how something actually works, mechanically.
- **decision** — a ruling that was made, and why.
- **rejected-alternative** — a path that was considered and NOT taken, preserved so a
  successor does not waste effort rediscovering and re-proposing it.
- **non-claim** — something this component deliberately does NOT do or prove. Silence
  invites a successor to assume capability that was never built.
- **invariant** — a load-bearing property that must always hold.
- **open-question** — a genuinely unresolved matter, recorded rather than papered over.
- **contract** — the frozen, exact semantics of an interface or protocol.
- **evidence** — a pointer to an oracle run, a fixture, or golden data proving a claim.

## The six-dimension record

Every record, regardless of kind, is built from the same field set: `id` (a content
address, not an author-chosen label), `kind`, `title`, `what`, `why`, `scope`,
`authority` (the anchor this record derives from), `evidence` (oracle references),
`non_claim`, `change_rule`, `status`, `normativity`, `superseded_by`,
`effective_from_commit`, `must_not_govern_new_work`. Not every field applies to every
kind, but the vocabulary is shared and closed — do not invent parallel field names for
the same concept.

## The status taxonomy (closed set)

```
NORMATIVE-CURRENT · SUPERSEDED · SPECIFIED-PENDING-IMPLEMENTATION (+becomes_normative_when) ·
RATIFICATION-PENDING · MODEL-PROPOSAL · REJECTED-ALTERNATIVE · OPEN-QUESTION ·
HUMAN-AUTHORIZED-EXCEPTION · ADVISORY
```

- **`NORMATIVE-CURRENT`** — true now, and it has a passing oracle proving it.
- **`SUPERSEDED`** — no longer governs. MUST carry `superseded_by` (pointing to the
  successor record) and `must_not_govern_new_work: true`. A superseded record that
  lacks both fields is indistinguishable from a second valid authority, and that
  ambiguity is exactly what a successor model will exploit by accident.
- **`SPECIFIED-PENDING-IMPLEMENTATION`** — the design-substrate state: the rule is
  frozen and authority-anchored, but the code implementing it does not exist yet, so
  there is no passing oracle. This status MUST carry `becomes_normative_when` as a
  canonical, portable repository-relative `.js`, `.cjs`, or `.mjs` path naming the
  executable oracle that will exist once the work is done. The path may be absent while
  the record remains pending; blank values, placeholders, prose, absolute paths, and
  traversal are invalid. This is documentation-first by design: an implementer loads
  the record, treats it as the target to build against, and the record flips to
  `NORMATIVE-CURRENT` only when that named oracle exists and passes.
- **`RATIFICATION-PENDING`** — the deferred-ratification path: work proceeded
  build-first, ahead of the normal docs-first order, under explicit human direction. The
  record documents what was built and states plainly that ratification (the formal
  human sign-off making it authoritative) has not yet happened. This is a recorded
  exception, not a silent skip — see `memory-lifecycle` for the supersession and
  ratification protocol this status participates in.
- **`MODEL-PROPOSAL`** — a model authored this content and it has not yet been adopted
  by a human. Advisory until a human decision record adopts it.
- **`REJECTED-ALTERNATIVE`** — considered, and explicitly not taken. Preserved
  permanently; never deleted, so a later model does not propose it again as novel.
- **`OPEN-QUESTION`** — genuinely unresolved. Recording it as open is more honest, and
  more useful to a successor, than forcing a premature answer.
- **`HUMAN-AUTHORIZED-EXCEPTION`** — a human explicitly authorized a departure from the
  otherwise-governing rule. The exception lives in the record, not in an unwritten
  understanding.
- **`ADVISORY`** — documented, but not backed by a passing oracle, and not claiming to
  be enforced. Prose without an oracle is `ADVISORY`, never `NORMATIVE`, no matter how
  confidently it reads.

## The eight hardenings

These are additions earned from real failures in operating this standard, not
speculative extras. Each is a first-class rule, not a suggestion.

1. **Query-freshness oracle.** Comprehension queries' `expected` facts must be derived
   from, and checked against, the machine contracts they anchor to — never hand-typed
   and left to rot. *Origin: in the source project, comprehension queries and their
   example answers drifted in lockstep with the system they described — the queries
   still named five components after growth had made it seven, and nothing caught it.*
   A comprehension document must contain at least one query, plus nonempty
   `required_invariants` and `required_non_claims` arrays. Those arrays contain unique,
   valid content addresses that resolve to sibling machine records of the correct kind.
   Each query has a unique nonempty trimmed `id`, nonempty trimmed `query` text,
   `answer_kind` exactly `boolean`, `enum`, or `set`, and an `expected` value whose
   type is respectively boolean, string, or array. A submitted answer must have that
   same exact type before the gate compares it; two equally mistyped values never
   constitute comprehension.
   A missing, malformed, unreadable, or unresolved `derived_from` pointer is a FAIL, as
   is a resolved value that does not equal `expected`.

2. **Three-representation auditor.** A load-bearing claim missing its machine record or
   its oracle reference is a FAIL, not a warning. *Origin: in the source project, two
   components shipped prose-only invariants and non-claims documents whose
   comprehension queries cited invariant IDs that existed in no machine-readable file
   at all.*

3. **Truthful-lifecycle field.** Every hashed record states the ACTUAL build order —
   `docs-first` or `build-first-then-ratified` — and exceptions live inside the hash,
   not beside it as an unverified footnote. *Origin: in the source project, an
   authorization review rejected a plan because its content hash asserted a docs-first
   build history that had not actually happened.*

4. **Mirror-sync checks.** A record that declares itself a mirror of another
   component's closed set must carry a checkable source anchor plus an equality check —
   a promise to "stay in sync" with nothing enforcing it is not a mirror, it is a claim.
   *Origin: in the source project, one component's record set declared itself a mirror
   of another's closed set, with a change rule promising manual re-sync — nothing
   enforced the promise, and the mirror rotted.*

5. **Staleness sweep.** Anchors must be checked for whether they still resolve at HEAD,
   how far `as_of` distance has drifted, and whether snapshots are current. An `as_of`
   commit that resolves but trails HEAD produces WARN; a supplied but unresolved commit
   FAILs. A snapshot whose source is missing, whose hash is malformed, or whose current
   bytes do not match its pinned hash FAILs. Contracts declare document anchors via
   `authority.source_path`, which must resolve. *Origin: in the source project, a
   session-state anchor was found seventy commits stale, and a working record went a
   full day stale before anyone noticed.*

6. **Reviewer-drift monitor.** Adversarial review loops self-score against proven
   discriminators rather than running indefinitely on faith. *Origin: in the source
   project, roughly half the rounds of one adversarial review workshop were spent
   re-litigating a point already settled, with one reviewer twice re-raising a claim
   that had already been proven false.* See `memory-lifecycle` for the discriminators.

7. **Load-order manifest.** "Complete at load" requires a defined minimal reading
   order, not an assumption that a model will find the right files on its own. *Origin:
   preventive design — 'complete at load' is unbounded without a defined minimal
   reading order; adopted before a failure occurred.*

8. **Decision provenance.** Every ruling records `decided_by: human |
   model-advisory-adopted-by-human`. Human authority is never silently delegated to a
   model. *Origin: preventive design — attribution of rulings (human vs. model-advised)
   was made explicit so authority can never be inferred or misread from prose.*

Record discovery is also fail-closed. A conventionally named `memory` directory may
not be a symlink, and primary record files must remain physically contained beneath
the repository before they are parsed. A symlink cannot hide records from audit or
verification.

## Preserve rejected alternatives

Never delete a `REJECTED-ALTERNATIVE` record. A successor model that cannot see what
was already tried and rejected will propose it again as if it were novel, and the
project pays the cost of re-litigating a settled question. The record of rejection is
part of the institutional memory, not clutter to be cleaned up.
