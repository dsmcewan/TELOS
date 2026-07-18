<!-- GENERATED FILE — do not edit by hand. Rendered by render-workflow.mjs from workflow.json.
     Regenerate: node render-workflow.mjs --write ; verify: node render-workflow.mjs --check -->

# The Iliad-quest workflow — canonical stage order (advisory record, links the enforced invariants)

> **NORMATIVE-CURRENT · normativity: ADVISORY.** The canonical order a new system traverses to become an enrolled part of The Iliad. The Iliad IS the quest (enter -> trials -> enrolled), not a bookend. This record is ADVISORY: it documents the order and, for the stages whose rules are already enforced, AUTHORITY-LINKS the existing NORMATIVE-CURRENT iliad invariants by content-addressed reference — it does not restate or re-enforce them. The new documentation/reference stage is ADVISORY per The Eye's option (b), 2026-07-18.

**Quest premise:** The Iliad is the quest a new system undertakes to become enrolled. Presence in the repository is NOT enrollment; enrollment is earned by completing the quest. (Cf. the AM-40-deferred ai-forge/forge/saas-forge: present on disk, NOT enrolled.)

## The quest — canonical stage order

| # | stage | role | owning module | enforced-by (linked invariant) |
|---|---|---|---|---|
| 1 | **iliad-pre-review** | enter the quest (pre-review + entry-ritual comprehension gate) | `docs/institutional-memory/iliad/IDENTITY.md` | `iliad-pre-review-before-implementation` |
| 2 | **daedalus** | mature the plan (workshop; convergence is submission, not authorization) | `docs/institutional-memory/daedalus/IDENTITY.md` | — |
| 3 | **telos** | authorize (council gate + required-seat review + evidence) | `docs/institutional-memory/telos/IDENTITY.md` | — |
| 4 | **argo** | implement + verify + document the authorized plan | `docs/institutional-memory/argo/IDENTITY.md` | — |
| 5 | **reference-documentation-module** | author/consult the documentation-reference before the weave (NEW stage) | `docs/institutional-memory/REFERENCES/agentic-orchestration/reference.json` | _advisory (option b)_ |
| 6 | **clotho** | weave the result into the knowledge graph | `clotho/memory/IDENTITY.md` | — |
| 7 | **iliad-retrospective** | complete the quest (post-review -> enrolled) | `docs/institutional-memory/iliad/IDENTITY.md` | `iliad-post-review-required` |

**New stage:** The reference-documentation-module stage (order 5) is ADVISORY (The Eye option b). It becomes a SPECIFIED-PENDING/NORMATIVE candidate only after a future Eye decision commissions its oracle in the shared verifier; not this cycle.

**Non-claim:** ADVISORY, not enforced. It does not authorize execution, does not choose stages, does not transfer any stage-module's authority, and does not make the new documentation stage NORMATIVE. Mandatory stage rules (e.g. pre-review-before-implementation, post-review-required) are mandatory solely by their own linked NORMATIVE records, not by this record.

**Authority:** `git:6d16c8ff7cb120910ed0c2968d321269dd1f57cb + file:docs/institutional-memory/iliad/RETROSPECTIVES/agentic-orchestration-reference-1.json@cc24535a45fb4f496ec8962d8b44696cec008785 (The Eye directive 2026-07-18) + file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-iliad-workflow-contract.json@6e9436a2fc6a8ac9cdc892b1a3020159dbc81b6e`
