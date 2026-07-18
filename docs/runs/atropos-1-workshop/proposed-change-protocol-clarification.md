# PROPOSED CHANGE-PROTOCOL clarification (HELD — for The Eye to commit; NOT applied)

Per the GPT-seat ruling (`decision-round-1-result.json`, delegated by The Eye), Atropos's supersession
contract may become NORMATIVE only after this section is committed into `docs/institutional-memory/CHANGE-PROTOCOL.md`
with the stable anchor `#supersession-surface-applicability`. It is DRAFTED here and HELD — committing it into
CHANGE-PROTOCOL is a governance edit for The Eye/controller, not an action this quest takes unilaterally.

---

## Supersession — surface applicability {#supersession-surface-applicability}

The supersession row's three surfaces (mark the record `SUPERSEDED`; record the `supersedes` weave edge;
update `CURRENT-AUTHORITY.json`) are **cumulative, not alternatives**, and apply **by the kind of thing
retired**:

- **plan-version retirement** — the normative surface is the `CURRENT-AUTHORITY.json#superseded` entry
  (`superseded_by` + `must_not_govern_new_work: true`). A plan-version is **not** a weave node, so the
  `SUPERSEDED`-record and `supersedes`-edge surfaces are **structurally inapplicable** (not advisory, not a
  defect).
- **weave-node-backed relationship / artifact / record retirement** — **all three** surfaces are mandatory
  and must agree: the record `SUPERSEDED` (+ `superseded_by` + `must_not_govern_new_work: true`), a
  `supersedes` weave edge from successor to retired identity, and a `CURRENT-AUTHORITY` reflection.
- **any other / unrepresented kind** — has no authorized reduced surface set; a first-class identity, its
  applicable surface matrix, and its `CURRENT-AUTHORITY` representation must be defined **here** (an anchored
  amendment) before it may be verified `consistent`.

**Atropos** is the READ-ONLY VERIFIER of this applicability rule (it detects + verifies; it never mutates
`CURRENT-AUTHORITY` or authors any surface — authoring retirements remains a human/controller step). Any
future non-plan `CURRENT-AUTHORITY` reflection encoding must be added to this section before Atropos accepts it.
