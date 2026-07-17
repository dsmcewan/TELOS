---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: The Eye's stopping-rule acceptance of slice 4a, and the dissent asymmetry it establishes against authz-007. The single most misread pair of precedents in the repo — recorded together on purpose.
---

# Decision: slice-4a acceptance under the stopping rule

**What happened.** Task 4a (closed inventory, substrate, git + code weavers) went
through 13 rounds of signed required-seat review (PR #117, head `0e73ca6`). claude
and agy (required) plus grok and gemini (advisory) approved; the deterministic
slice gate converged at `meets`; the committed-closure equality was proven by test.
The **codex seat remained a lone `revise`** through all 13 rounds, mining an
asymptotically-shrinking tail of shared-lexer edge cases (11 → 3 → 2 → 4 items).

**The Eye's ruling (2026-07-17):** *"Finish the round it's on. If it finds
something else, start a minor fix artifact list to revisit outside of feature
development."* — 4a **accepted**, with the tail recorded in
`docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md` (merge anchor
`git:f12e5d2`).

**The asymmetry this establishes (do not "fix" it):**

| scope | lone codex `revise` | why |
|---|---|---|
| authorization (authz-007) | **BLOCKS** | the model gate is fail-closed; models never outrank The Eye |
| slice acceptance (4a) | **The Eye may accept**, bounding the dissent with a stopping rule + recorded backlog | acceptance IS The Eye exercising the human authority the gate protects |

Both directions preserve the same principle: **no model outranks the human.** A
future model noticing the "inconsistency" and harmonizing either direction —
making dissent always block, or letting the gate accept over dissent — would break
the design. The correct reading: fail-closed applies to *model* decisions;
judgment over a bounded, recorded dissent belongs to *The Eye alone*.

**Anchors:** `docs/runs/clotho-impl-slice-4a/` (rounds 1–13 + gate result +
backlog) · `CURRENT-AUTHORITY.json#implementation_authority.accepted_slices` ·
`docs/runs/clotho-authorization-7/authorization-summary.json` (the contrasting
block) · `CONTRACTS/implementation-protocol.json#dissent_asymmetry`.
