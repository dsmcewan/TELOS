## Item 7 — Referee: distinct model, and cadence

> **Evidence provenance (round 2, 2026-09-19).** All `live-seats-v2.mjs`,
> `daedalus-v2.mjs`, `test-daedalus-v2.mjs`, and `hallucination-metrics.mjs` citations
> in this packet were never committed on any branch — they existed only as
> untracked/dirty scratch in the working tree at ruling time (`c9d543f`). That evidence
> is now quarantined, immutable, and content-addressed at git branch
> `quarantine/evidence-2026-09-19` (manifest: `QUARANTINE-MANIFEST.json` on that
> branch), and is **not part of the mainline tree**. Verify with `git show
> quarantine/evidence-2026-09-19:<path>`:
>
> | Bare filename | Full quarantined path | sha256 |
> |---|---|---|
> | `live-seats-v2.mjs` | `docs/runs/production-profile-compiler-1-workshop/live-seats-v2.mjs` | `28bf31a671cc597ea8b564db41da4b16bbe5c65e65a9135e3b55cb98270989d9` |
> | `daedalus-v2.mjs` | `docs/runs/production-profile-compiler-1-workshop/daedalus-v2.mjs` | `d99426b4a11e4c8016cf6b12488349af354a518dd2d75e5aa993b27ec2642a96` |
> | `test-daedalus-v2.mjs` | `docs/runs/production-profile-compiler-1-workshop/test-daedalus-v2.mjs` | `1b6ab34a5674052e73203978bf6c082b0ae6c1d4d085a4667990d59ed70af2ec` |
> | `hallucination-metrics.mjs` | `docs/runs/production-profile-compiler-1-workshop/hallucination-metrics.mjs` | `ece71b6b9cdc6bc9eaa802986e1f481d2836cd4a3928801d840e515e042dada2` |
>
> The absolute-path form `/home/colchis/Projects/TELOS/docs/runs/production-profile-compiler-1-workshop/live-seats-v2.mjs`
> below resolves to the same quarantined file.

### ROUND-1 CORRECTION (do not rule until resolved)

The "Recommended ruling" says to "ship role R advisory on the current double-rolled
configuration," describing it as "already built and tested." That is true only of the
**quarantined workshop prototype** (`live-seats-v2.mjs`, `daedalus-v2.mjs`,
`test-daedalus-v2.mjs` above) — none of it is committed to mainline. The shipped,
mainline `build-gate/daedalus.mjs` (351 lines) has **no role-R / third-party-referee logic**: it
implements only an author/reviewer loop (`callSeat({..., role: "author", ...})` and
`callSeat({..., role: "reviewer", ...})`), with no role-R call site and no referee cadence check. [ROUND-2 CORRECTION: an earlier draft of this block said "no `stalemate` terminal anywhere in the file" — that is FALSE. `build-gate/daedalus.mjs` DOES have a deterministic `stalemate` terminal (`state: "stalemate"` at lines 78/82, on `repeated-candidate-hash` / `round-cap` convergence). What is absent is a *referee-authored* stalemate, not a stalemate terminal as such. Citation caveat: this packet's `daedalus-v2.mjs` line numbers (e.g. :583, :565-581) are ~8-13 lines stale against the frozen quarantine snapshot, which mutated after drafting (731→767 lines; see item-6); the cited content is correct, the pinpoint line numbers are approximate.] "Ship ... as already built/tested"
should be read as "the mechanics are prototyped and tested in a disposable workshop,
not yet promoted to the trust-sensitive orchestrator" — the recommendation to proceed
on that basis is unaffected in substance (this packet's own evidence never claimed the
referee was already live in `build-gate/`), but the phrasing risks being read as "ready
to ship into `daedalus.mjs` today," which is not supported. Promotion into
`build-gate/daedalus.mjs` remains a separate, unstarted engineering step, consistent
with item 6's recommended workshop-first-then-scoped-extension path.

### What is actually at stake
Role R is the only non-deterministic actor that can end a stage, and it currently sits on gemini — the same model that occupies Seat 4 as a challenger — so a `stalemate` can convert gemini's own live objection into an immediate escalation to The Eye without a further defense round. The independence question is real but small; the larger unresolved fact is that no evidence exists anywhere on disk that *any* model configuration detects a planted semantic loop at v2's log lengths, so the model choice is currently being argued rather than measured.

### Option A — keep gemini double-rolled (Seat 4 + role R)

**The case for it.** It is what is already built and tested: `makeGeminiReferee` exists in `quarantine/evidence-2026-09-19:docs/runs/production-profile-compiler-1-workshop/live-seats-v2.mjs` (sha256:28bf31a671cc597ea8b564db41da4b16bbe5c65e65a9135e3b55cb98270989d9), `readRefereeVerdict` burns on provenance reuse, malformed shape, empty `loop_evidence`, and unresolvable refs (`daedalus-v2.mjs:298-330`), per-seat counters already attribute to `gemini:referee` (`hallucination-metrics.mjs`), and `test-daedalus-v2.mjs` cases 15/16/21 already exercise cadence, stalemate-ends-run, evidence-or-burn, and Seat-4-id reuse. The escape hatch is narrower than first alleged: the both-accepted branch returns before the referee block is reached (`daedalus-v2.mjs:565-581` vs `:583`), so role R can never override a unanimous accept. Rule 2 already burns a verdict that reuses a Seat 4 challenge response id. And no additional provider seat, key, or budget line is required.

**The case against.** The referee reads a ledger containing its own Seat 4 text and is therefore judging an exchange it is a party to. The reachable conflict is *unilateral acceleration*: gemini denies with objection O, grok accepts, the run continues, role R (gemini) rules `stalemate` citing O, and the stage exits `needs-work` with O undisposed — gemini alone converts its own objection into an Eye action instead of taking one more defense round. Separately, finding 4's contamination instrument (`cross_sender_adoption`, 9 adoptions across a speaker boundary vs 0 independent) requires a speaker boundary; double-rolling removes the boundary, so the axis stops being measurable. This is an instrument fact, not a demonstrated harm.

**What it costs.** Nothing new. One controller check if the mitigation below is adopted.

**What breaks if it is wrong.** Runs exit `needs-work` early on self-cited objections. The exit is recoverable — `needs-work` grants nothing and The Eye can reopen the stage — but each occurrence spends one Eye action (the scarcest rationed resource in the design) and truncates up to `cap − round` remaining friction rounds, which at cap 4 firing at round 2 is half the loop. The failure is also quiet: nobody audits a `needs-work` that arrived early.

### Option B — role R on a distinct model

**The case for it.** It removes the conflict of interest structurally rather than by rule, and it preserves the speaker boundary that finding 4's instrument needs, so double-roll contamination remains a measurable question rather than an unfalsifiable one.

**The case against.** It answers an independence concern the chair has already narrowed from "veto" to "acceleration," and it does so before the prior question — whether any model detects a planted loop over a ≤4-round log — has any evidence behind it. It also costs a call on a model whose loop-detection calibration is equally untested; swapping models does not create the evidence. A cheaper mitigation is available that closes the same trace: **a `stalemate` is invalid if any cited entry is one the referee itself authored.** Objection-to-raising-seat is per-seat in the ledger view, so this is a controller check, not a judgment — and the chair states this single mitigation, adopted alone, would make him withdraw the distinct-model demand.

**What it costs.** A second provider seat wired for role R, plus the effort-tier question re-opened on an untested model (role R currently runs at `thinkingLevel: "medium"` while challengers run `"high"` — `live-seats-v2.mjs`, referee comment and `makeGeminiChallenger`).

**What breaks if it is wrong.** Nothing safety-relevant; the cost is a spent seat and the false impression that item 7 was settled on evidence when it was settled on structure. The detection question remains exactly where it is.

### Cadence

**Chair's position on produce ≥3 / challenge ≥2: reject the literal numbers, accept the shape as `⌈cap/2⌉`.** The proposed constants arrive with no derivation, and open item 1 can move the caps — which would silently re-tune item 7. Tying the first watch to `⌈cap/2⌉` makes cadence survive a cap change by construction.

**The substantive cadence finding, which is an inversion.** The *looser* loop (code produce, cap 8) gets the *later* first look than the tighter one (challenge, cap 4). At cap 4 with cadence ≥2, role R sees 2–4 rounds — and two rounds of similar-sounding objections is also the exact signature of a genuine unresolved defect being pressed correctly. Role R's marginal value is highest where the loop is long and the deterministic terminals are weakest, and lowest where it is short and they are strongest. In the 4-round challenge stage, denied-twice plus oscillation plus the cap already cover most loop shapes — and that is the only place role R is implemented (single call site, `daedalus-v2.mjs:583-611`). **The 8-round produce loop, where a semantic watcher would actually earn its call, has no referee call site at all.** Produce-side cadence is specified and unimplemented.

**Effort tier is unruled and under-specified.** The shipped rationale is that repetition detection is cheap. The chair's objection is that medium is **untested and asserted**, not demonstrably worse. Finding 1 (detection 4/4 across four framings, zero false positives) says framing does not move detection on *decidable* questions; finding 2 says framing moves *calibration*. "Is this exchange looping?" has no verifier in the log — it is a threshold judgment about degree of similarity, and every finding-2 retraction was a threshold judgment being revised. Falsifier stated in advance: if medium and high agree on ≥95% of fixture ledgers **and** cite the same evidence refs where they stalemate, the cheap tier is justified on evidence.

### What the chair withdrew or downgraded

- **Concern 1 ("role R is a structural no-op") — withdrawn as to v2.** The "about five equivalent exchanges" threshold exists only in the legacy primitive (`breakout/breakout.mjs:271`); `REFEREE_BRIEF` in `live-seats-v2.mjs` contains no numeric threshold at all. "By construction" was overstated — the correct claim is *biases at an unknown rate*, and the observation is neither confirmed nor falsified on disk. Survives only as a spec-provenance defect: § Referee names the wrong ancestor file.
- **Concern 3 ("evidence-or-burn is unimplementable") — withdrawn as to interface.** Ledger ids *are* passed (`daedalus-v2.mjs:586-605`), and `GEMINI_REFEREE_SCHEMA` already carries `{verdict, loop_evidence:[{kind, refs, why}]}`. Survives only as the type-match gap: the check is resolution-only today, which any two real ids satisfy.
- **Concern 4's "minimum fix: counters" — already implemented.** `hallucination-metrics.mjs` counts `gemini:referee` with burn classes including `stalemate-without-evidence`; `burned_referee_verdicts` is carried in the ledger. Survives only as the K=0 ambiguity.
- **Concern 6 ("worse than referee bias") — retracted as a ranking.** Role R cannot override a unanimous accept; the harm is unilateral acceleration, not unilateral veto, and it is bounded and recoverable.
- **Concern 5 ("harm is bounded is the wrong bound") — downgraded to a wording change.** Conceded: the exit is `needs-work`, which grants nothing and is reopenable.
- **Concern 2 — downgraded to forward-looking risk, not a present bug.** Every live caller passes a cap explicitly (`saas-forge/breakouts.mjs:42`, `forge/ratchet.mjs:231-232`); the 12-round fuse branch is currently unreached.
- **Finding 5's weight — narrowed to direction only.** It predicts assent as the lazy default; it supports no rate, and finding 1 cuts against a large magnitude.
- **Finding 3's instrument — conceded as illustrative.** Register-anomaly needs a per-speaker corpus of hundreds; a handful of one-sentence `why` strings per run is not a population.
- **The 5% target — conceded as unreachable by fixture.** 0/20 bounds the true false-stalemate rate near 14% at 95% confidence, 0/30 near 10%. An afternoon fixture cannot establish a 5% commitment; it can only rule out gross miscalibration.

### Recommended ruling

**Ship role R advisory on the current double-rolled configuration (Option A), with `stalemate` recorded and counted but non-terminal, and defer the distinct-model question until the counters produce data.** The single strongest reason: every argument on both sides currently reduces to an unmeasured claim about whether any model detects a planted semantic loop over a ≤4-round log, and advisory mode is the only configuration that generates that measurement at zero governance risk — an advisory biased referee costs nothing, while two or three real runs produce K, the evidence refs, and The Eye's agreed/premature labels on stalemates that never spent an Eye action. **The recommendation flips if The Eye funds the fixture afternoon**: with a pre-registered pass criterion (≥2/3 recall on the planted-looping ledgers *with* refs naming the planted equivalence, and zero false stalemates on ≥20 non-looping ledgers) run across gemini-double-rolled × gemini-distinct-call × one non-gemini model × medium/high effort, item 7 should be ruled on the fixture result rather than on this recommendation. It also flips toward requiring the distinct model if The Eye declines to adopt the self-citation bar — a `stalemate` is invalid if any cited entry is one the referee itself authored — since that check is the only thing making Option A's conflict of interest structurally closed rather than merely narrow.