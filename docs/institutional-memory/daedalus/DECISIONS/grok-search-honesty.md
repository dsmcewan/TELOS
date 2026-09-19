---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Adopts Option A — the controller must validate and preserve grok's provider-computed search_evidence telemetry instead of a model self-attestation. Machine anchor — docs/runs/item-3-grok-search-honesty-ruling-packet.md (adversarially reviewed, revised, and reverified 2026-07-22).
---

# Decision: grok search-honesty via provider telemetry, not self-attestation

**What.** Daedalus v2 must validate and preserve, as a required controller-checked
field, the search-evidence telemetry xAI already returns on every grok call
(`citations` and `server_side_tool_usage_details`) — never a model-supplied
attestation string. This closes the honesty gap for Stage 0, where the field today
survives only by accident and unvalidated, and for Stage 2, where it is presently
stripped from the persisted round entry before role R or The Eye ever see it. The
same schema requirement is binding in advance for whichever future ruling implements
Stage 3/4, since no Stage 4 code exists yet to fix directly.

**Why.** The transport already captures this telemetry as `provenance.search_evidence`
pulled straight from xAI's response body — computed by the provider from its own
tool-call accounting, not asserted by the model — and it is already transport-tested.
It simply isn't checked or kept: `validProvenance` and Stage 0's closed key set never
look at it, and Stage 2's round-entry construction actively drops `verdict.provenance`
before it reaches the ledger. A model self-attestation field (Option B) was rejected
because it reintroduces exactly the mutable, unverifiable self-report CLAUDE.md's
content-address rule forbids keying an enforcement decision on — a call made with
search off could still claim "used-live-search," and nothing would catch it — trading
away free, provider-computed proof for strictly weaker evidence. The ruling is
contingent: it flips if a live (non-mocked) xAI call shows the provider's tool-usage
telemetry is unreliable in practice, in which case item 3 reopens with Option B's
attestation as the only remaining, strictly weaker, fallback.

**Authority chain:** docs/runs/item-3-grok-search-honesty-ruling-packet.md
(adversarially reviewed, revised, and passed bounded review 2026-07-22) -> Eye
ruling: adopt, 2026-07-22.
