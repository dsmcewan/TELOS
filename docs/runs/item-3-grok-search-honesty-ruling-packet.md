## Item 3 — Grok search honesty for Stage 0 / Stage 4

### What is actually at stake

The design doc's own promise is narrow and correct: "Grok live-landscape and Gemini
grounding run **upstream** only if transport supports them. Otherwise those seats still
complete Surfaces A–C without false citation claims"
(`docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md:604-608`). That is a
behavioral requirement on the model's prose. Item 3 asks for its enforcement mechanism —
a controller-checkable field, modeled on `empty_list_attestation`, that proves rather than
claims whether live search actually ran.

The investigation found something better and worse than "no evidence exists." Better:
the live transport already fetches real, non-model-asserted telemetry for exactly this
question — xAI's own tool-usage accounting, not text the model composed. Worse: that
telemetry is captured and then thrown away before it reaches anything the controller
validates, hashes, or lets a human or Seat 4 see. The honesty mechanism item 3 asks for
is not missing raw material; it is missing a decision to stop discarding raw material
that is already sitting in memory for every grok call.

A second, load-bearing fact narrows what can be ruled today: `daedalus-v2.mjs` implements
**Stage 0 and Stage 2 only** — its own header says so (`daedalus-v2.mjs:2`, "Daedalus v2
workshop layer — Stages 0 and 2") — and a full-file grep confirms no `plan-produce`→
`code-*` or `code-challenge` transition exists anywhere in the 731-line file. Stage 4 —
half of this item's own title — has zero implementation on disk. Any ruling on Stage 4
is necessarily a design decision for code that doesn't exist yet, not a fix to code that
does.

### Option A — promote existing telemetry into a required, hashed field; stop discarding it (recommended)

**The case for it.** The transport already does the hard part. `makeGrokChallenger`
(`docs/runs/production-profile-compiler-1-workshop/live-seats-v2.mjs:61-165`) attaches
`web_search`/`x_search` tools only when `DAEDALUS_V2_GROK_SEARCH=on`
(`live-seats-v2.mjs:65,116-121` — "search must be opt-in, not default," asserted by
`test-live-seats-v2.mjs:69`), and on every call it captures
`provenance.search_evidence = { citations, server_side_tool_usage }` straight from the
xAI response body (`live-seats-v2.mjs:157-160`) — `json.citations` and
`json.usage.server_side_tool_usage_details`, fields xAI computes from its own tool-call
accounting, not anything the model's JSON payload asserts. `test-live-seats-v2.mjs`
Case 2 (lines 77-92) already exercises this at the transport layer: opt-in search
attaches tools and the resulting `web_search_calls`/`x_search_calls` counts and
`citations` array come through on `result.provenance.search_evidence`.

None of that reaches the controller layer that actually enforces anything. `validProvenance`
(`daedalus-v2.mjs:115-123`) checks `provider`, `model`, `response_id`, `source` — never
`search_evidence`. Stage 0's `validResearchBody` and its closed `RESEARCH_KEYS`
(`daedalus-v2.mjs:20-30, 151-159`) validate only the model's own JSON body — correctly,
since `search_evidence` must never become a field the model supplies about itself, or it
degenerates into exactly the self-report the "Transport honesty" clause exists to rule
out. Stage 0 does at least keep the full `provenance` object, `search_evidence` included,
in the content-addressed store write (`daedalus-v2.mjs:215-220`: `store.write({ kind,
action, why, provenance: result.provenance })`) — so for research artifacts the signal
survives, hashed, even though nothing yet reads or requires it.

Stage 2 is worse: `readChallengeVerdict` (`daedalus-v2.mjs:254-295`) does carry
`provenance: result.provenance` on its return value (lines 276, 294), but the caller that
builds the persisted round entry actively strips it before it ever reaches the ledger —
`roundEntry.verdicts` is built as `{ seat, verdict, objections: [{objection_hash, scope,
claim}] }` only (`daedalus-v2.mjs:527-537`), with no `provenance` and no
`search_evidence` field anywhere in the object that gets pushed into `rounds` and later
fed to role R's `ledger_view` (`daedalus-v2.mjs:584,593-599`). So today, even on the one
stage that is actually implemented and actually calls grok as a challenger, the referee
and The Eye see nothing about whether search fired — the evidence existed for one HTTP
round-trip and then was discarded before the next line of code.

The fix: (1) extend `validProvenance` (or a grok-specific sibling check) to require a
closed `search_evidence` shape — `{ requested: boolean, citations: string[],
server_side_tool_usage: {...} | null }` — on every counted grok response, where
`requested` is set by the controller from the `DAEDALUS_V2_GROK_SEARCH` transport flag at
call time (a fact the harness knows, never something the model's JSON can assert); (2)
stop the Stage 2 `roundEntry` mapping from dropping `verdict.provenance` so
`search_evidence` rides into the hashed, persisted ledger and into role R's `ledger_view`
exactly the way Stage 0 already (incidentally) preserves it in the store; (3) burn on a
missing or malformed `search_evidence` object the same way a missing
`empty_list_attestation` burns today (`daedalus-v2.mjs:272-274`) — a new reason (e.g.
`missing-search-evidence`) slotting into `hallucination-metrics.mjs`'s
`contract_noncompliance` class (`hallucination-metrics.mjs:35-43`), which today has no
search-honesty entry at all.

**The case against.** This proves capability and invocation count — that search tools
were or weren't attached, and how many times the model actually called them — not the
semantic correctness of any specific claim. A grok response can still write "recent
reports show X" in `inclusions[].claim` with `evidence_refs` that don't correspond to any
entry in `search_evidence.citations`, and nothing here catches that; matching a specific
prose claim to a specific citation is a judgment call left to Seat 4's Stage 0 mandate to
"cross-check production claims against frame" (design doc seat-weighting table,
`2026-07-20-daedalus-workflow-v2-design.md:555`) and to The Eye at review — not something
the controller can close mechanically today, the same honest gap already conceded for
`objections[].evidence_refs` never being checked against real citation content.

**What it costs.** A `validProvenance`-adjacent schema change, un-stripping the Stage 2
`roundEntry` construction, one new taxonomy entry, and new test cases in
`test-daedalus-v2.mjs` exercising missing/malformed `search_evidence` — none exist today.
No new API surface, no new model call, search stays opt-in exactly as now.

**What breaks if it is wrong.** If it is adopted only for Stage 0 (where the plumbing
happens to already half-work via `store.write`) and Stage 2's discard bug at
`daedalus-v2.mjs:527-537` is left alone, the one stage that is actually implemented and
actually exercises a live grok challenger keeps the exact blind spot item 3 was raised to
close — role R and The Eye still see nothing about search honesty in the only place they
can currently see anything at all.

### Option B — model self-attestation field, literally mirroring `empty_list_attestation`

**The case for it.** Cheapest possible change: add a closed-enum field — e.g.
`search_attestation: "used-live-search" | "no-search-transport-unavailable" |
"no-search-not-needed"` — next to `empty_list_attestation` in the existing challenge
verdict / research schema. No plumbing through `provenance` or the ledger-stripping bug
is required; it reuses the identical required-field-plus-burn-on-missing mechanism the
design doc already ships for the empty-objections case (`empty_list_attestation:
"genuinely-found-nothing" | null`, design doc lines 206-212, 232-234).

**The case against.** This is precisely the self-report CLAUDE.md's core invariant rules
out — "never let a seat's self-reported status... satisfy the gate" — and the reserved
content-address rule that no mutable label may key an enforcement decision. A string the
model writes into its own JSON is a mutable label with no independent check behind it. A
grok call made with `DAEDALUS_V2_GROK_SEARCH` off — where `tools` was never even attached
to the request (`live-seats-v2.mjs:116-121`), so the model could not possibly have
searched — could still emit `"used-live-search"`, and nothing here would catch it, because
nothing cross-checks the attestation against `provenance.search_evidence` or against
whether `tools` was even present on the wire. That is the exact false citation claim
"Transport honesty" was written to forbid, now wearing a stamp that says it was checked.
Unlike the empty-objections case — where "genuinely found nothing" is a negative
existential no outside observer can verify, so a required attestation is the best
available mechanism — "did the model actually invoke the search tool" is *not*
unverifiable: the provider's own usage accounting already answers it for free on the same
HTTP response. Choosing B without A settles for strictly weaker evidence at no savings.

**What it costs.** One schema field. Nothing else.

**What breaks if it is wrong.** A false `"used-live-search"` attestation becomes the
official, hashed ledger record with no way to detect it after the fact — worse than
today's silence, because it looks audited when it isn't.

### What's on the wire today (and what isn't)

| Signal | Exists on the wire? | Reaches the controller schema? | Reaches the persisted ledger? |
|---|---|---|---|
| `tools` attached only when `DAEDALUS_V2_GROK_SEARCH=on` | Yes — `live-seats-v2.mjs:65,116-121`; asserted by `test-live-seats-v2.mjs:69` | No field checks this | No |
| `provenance.search_evidence.citations` (xAI `json.citations`) | Yes — `live-seats-v2.mjs:157-160`; captured by `test-live-seats-v2.mjs:90` | No — absent from `validProvenance` (`daedalus-v2.mjs:115-123`) and from Stage 0's `RESEARCH_KEYS` (`daedalus-v2.mjs:20-30`) | Stage 0: yes, incidentally, via `store.write` (`daedalus-v2.mjs:215-220`). Stage 2: no — stripped at `daedalus-v2.mjs:527-537` |
| `provenance.search_evidence.server_side_tool_usage` (xAI `usage.server_side_tool_usage_details`) | Yes — `live-seats-v2.mjs:159-160`; captured by `test-live-seats-v2.mjs:91` | No | Same as above |
| A model-supplied claim of "I searched" | No such field exists anywhere in `RESEARCH_KEYS` or the challenge-verdict closed keys | N/A | N/A |
| Stage 4 code-challenge honesty (grok) | No implementation exists — `daedalus-v2.mjs:2` scopes the file to "Stages 0 and 2" only; no `code-challenge` transition anywhere in the file | N/A | N/A |
| Gemini grounding (the doc's other named case) | Not wired at all — `geminiGenerate` (`live-seats-v2.mjs:168-221`) sends no grounding tool in any of its three call sites (challenger, referee, and — by omission — research); its Surface A/B contribution today is static-knowledge only, so it has no honesty gap to close, only an absent capability | N/A | N/A |

No test in `test-daedalus-v2.mjs` exercises `search_evidence` at the orchestrator level —
the only coverage is transport-level (`test-live-seats-v2.mjs`). No burn reason for
search-honesty exists in `hallucination-metrics.mjs`'s `HALLUCINATION_TAXONOMY`
(`hallucination-metrics.mjs:23-49`); its `contract_noncompliance` class is the natural
home for one and currently has none.

### Recommended ruling

**Adopt Option A: require the controller to validate and preserve the real
`search_evidence` telemetry already produced by the grok transport — never a
model-supplied attestation — and rule this a blocking gap for Stage 0 and Stage 2 today,
with the same schema decision binding in advance for whichever future ruling implements
Stage 3/4 (open item 6).** The single strongest reason: independent, provider-computed
proof of whether grok's search tool actually fired already exists on the wire, is already
transport-tested (`test-live-seats-v2.mjs` Case 2), and is already being thrown away one
layer up — at Stage 0 it survives by accident in the content store with no validation,
and at Stage 2 it is actively stripped out of the persisted round entry before role R or
The Eye ever see it (`daedalus-v2.mjs:527-537`). Choosing a model self-attestation field
instead (Option B) would trade that free, unfalsifiable evidence for exactly the kind of
mutable, model-asserted label CLAUDE.md's content-address rule forbids keying an
enforcement decision on, for a problem where a non-self-reported answer is already
computed and sitting in memory. Stage 4 cannot be closed today because it does not exist
in any form on disk; the ruling for Stage 4 is to bind the same `search_evidence`
requirement now, in the design record, so it is inherited rather than re-litigated when
Stage 3/4 lands. **This recommendation flips if a live (non-mocked) xAI Responses call
shows `server_side_tool_usage_details` is unreliable in practice** — null or absent even
when search demonstrably fired — in which case the provider telemetry has no more
evidentiary value than a self-report, and item 3 would need to be reopened as "no
controller-checkable signal exists," with Option B's attestation field (paired with the
existing prompt-level "no false citation claims" instruction) as the only remaining, and
strictly weaker, fallback.
