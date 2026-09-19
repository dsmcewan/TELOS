# Daedalus Workflow v2 — Governance by Friction, Hash, Order

**Status: HELD** (The Eye, 2026-07-20). **Canonical location: this file —
`docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md` — by The
Eye's explicit instruction it does not move.** Aligns with the HELD parallel
methodology and the Merkle-DAG trust spine as implemented under
`C:\Users\dsmce\telos` / this repository. This document is methodology, not
implementation authorization; open items 1–7 remain open for The Eye's later
rulings.

Registered meaning is unchanged: **Daedalus collaboratively matures
implementation plans** (`docs/mythological-vocabulary.md`). The methods
(friction, hash, order, recursion) serve one goal: **governance**.

---

## Goal: Governance

**Govern AI work** so models may propose, implement, and challenge, but cannot
silently invent reality, rewrite the past, or ship outside the rules.

| Threat | What it looks like | Mitigation in this workflow |
|--------|--------------------|-----------------------------|
| **Hallucination** | Fluent false claims; empty “approvals”; invented files, APIs, or evidence | Dual-seat friction; challenger empty-list attestation; Rule 3 re-derive from disk; provenance or burn; no self-certify |
| **Drift** | Spec quietly mutates; “we meant X”; chat supersedes the plan; ancestor change ignored | Frozen requirement frame; `plan_hash` / `effective_hash` cascade; action+why in preimage; predecessor hashes as recursive data; missing/drifted bytes fail closed |
| **Non-compliance** | Skip seats, skip tests, unsigned packets, unauthorized merge, process theater | Required seat cast; Seat 5 neutral process gates; signed/trust modes; obligation bijection; caps + Eye gates; convergence ≠ authorization |

AI is the workforce. **Governance is the product.** Disk evidence, content
hashes, friction joins, and human Eye gates outrank model consensus and
self-report — same TELOS spine as the public fail-closed proof.

**Stage 0 research pre-flight** is the place production envelope and agentic
workflow optimization enter as first-class research — so Stage 1 cannot
“optimize” them away by never seeing them.

---

## Governing idea (load-bearing)

```text
  GOAL = GOVERNANCE
      mitigate hallucination · resist drift · enforce compliance with AI

  FRICTION drives thorough, unambiguous plans (and code joins)
      │
      ├─ Seats 1 ∥ 2   primary — constraints × implementation must meet
      │
      └─ Seats 3 + 4   secondary — deny re-enters the join

  Seat 5 NEUTRAL — process only; no technical tie-break
  Role R (gemini referee) — shorten-only loop watch; never grants convergence

  MERKLE-DAG — HASH (identity) + ORDER (topo / parent-linked effective hashes)

  EACH HASH = ACTION + WHY   (incomplete without either)

  HASHES = DATA FOR RECURSION   (next run consumes prior residue, not chat)

  Seats never self-certify. Convergence is submission. The Eye authorizes.
```

Serial author→reviewer (objection ledger, absence ≠ disposition) remains for
**genuinely small deltas only** (`docs/daedalus-methodology.md`, HELD). It is
not the default produce path for real plan design.

---

## Seat cast

| Seat | Model | Stance | Role |
|------|--------|--------|------|
| **1** | claude | produce (impl) | Implementation design; code under plan nodes |
| **2** | codex (GPT) | produce (constraints) | Constraint design; obligation IDs; code constraint fidelity |
| **3** | grok | challenge | Stage 0 research; plan + code adversarial attack |
| **4** | gemini | challenge | Stage 0 research; plan + code re-derive / verify |
| **5** | **agy** (local) | **neutral** | No authorship stake, no adversarial stake — process only |

### Seat 5 — neutral (agy)

Seat 5 does **not** participate in friction as a party. It does not draft the
plan, own constraints or implementation, or deny as an adversary. It is the
**neutral process seat**:

| May | Must not |
|-----|----------|
| Record phase / handoff / queue completeness | Prefer Seat 1 over 2 (or 3 over 4) on technical merit |
| Emit content-addressed checkpoints / attestations (`agy_checkpoint`) | Author plan text, code, or challenge objections |
| Block advancement when **process** preconditions fail (missing hash, missing dual parentage, incomplete packet, stage not entered lawfully) | "Approve" a design the way a challenger accepts |
| Recompute deterministic predicates the controller already owns (presence, shape, hash equality) | Hallucinate — verdicts are computed, not generated (`seats.json`) |

Neutrality means: when Seats 1∥2 disagree, or Seats 3+4 deny, Seat 5 does not
break the tie on substance. Substance returns to friction (re-join) or The Eye.
Seat 5 only answers: *is the stage transition, provenance set, and hashed
artifact set process-valid?*

Composed with the build gate, Seat 5 is the required governance seat already
named `agy` in council packets — same identity, explicit **neutral** stance in
this workflow.

**Structural rhyme**

| Phase | Produce (friction join) | Challenge (accept \| deny) | Neutral |
|-------|-------------------------|----------------------------|---------|
| **Plan** | Stage 1 · Seats **1 ∥ 2** | Stage 2 · Seats **3 + 4** | Stage gates · **Seat 5** |
| **Code** | Stage 3 · Seats **1 ∥ 2** under `plan_hash` | Stage 4 · Seats **3 + 4** | Stage gates · **Seat 5** |

When Seats 3 or 4 **deny**, work returns to the produce stage. That return is
**not a soft reject** — it is **additional friction** that must be absorbed by
another parallel join (or an explicit defend disposition that the same
challenger re-judges). Seat 5 records the deny→return transition; it does not
dispose the objection.

---

## The Eye (four points only)

1. **Freeze requirements** → content-addressed requirement frame (re-hashed
   every stage; no stage may reinterpret it).
2. **Approve planning** → authorizes exact matured **`plan_hash`** after Stage 2
   both accept (or rejects / sends `needs-work` ledger).
3. **Approve coding** → optional separate go-ahead; default may collapse into
   (2) if The Eye so rules. No Stage 3 without an authorized plan hash.
4. **Approve release** → after Stage 4 accept **and** controller Rule-3
   re-verify (disk tree + tests). Merge is never autonomous.

Early `needs-work` terminals (caps, dual-denial of same objection hash,
unresolvable parallel conflict) return the ledger to The Eye — they grant
nothing.

---

## End-to-end flow

```text
Eye freezes requirement frame
        │
        ▼
 Stage 0  Research pre-flight        Seats 1–4 isolated (one call each)
        │                            A feature · B production · C workflow optimization
        │                            Seat 5: frame / process check only
        ▼
 Stage 1  Plan PRODUCE               Seats 1 ∥ 2  + friction
        │     dual source hashes · integrate · plan_hash + topo_order
        │     Seat 5: process-valid join only — never a technical tie-break
        │
        │◄──────── deny = friction back ────────┐
        ▼                                         │
 Stage 2  Plan CHALLENGE             Seats 3 + 4  │
        │     Seat 5 records transition; not a third vote on the plan
        └──── denied ─────────────────────────────┘
        │ both accepted + Seat 5 process OK
        ▼
 Eye — planning gate (authorize this plan_hash)
        │
        ▼
 Stage 3  Code PRODUCE               Seats 1 ∥ 2 under plan_hash
        │     Seat 5: lawful stage entry / packet completeness
        │◄──────── deny = friction back ────────┐
        ▼                                         │
 Stage 4  Code CHALLENGE             Seats 3 + 4  │
        └──── denied ─────────────────────────────┘
        │ both accepted + Seat 5 process OK
        ▼
 Controller Rule-3 re-verify (disk + tests)   ← not replaced by Seat 5
        ▼
 Eye — release gate
```

Optional mechanical preflight (0 provider calls) may run before Stage 0.

---

## Friction (two sources, one engine)

### A. Primary — Seats 1 ∥ 2 (parallel ownership)

From HELD methodology + `build-gate/daedalus.mjs` parallel path:

- **Seat 2 (codex)** owns constraints: invariants, trust boundaries, failure
  semantics, normative schemas, **proof-obligation ID set**, adversarial
  acceptance tests.
- **Seat 1 (claude)** owns implementation design: architecture, interfaces,
  data flow, task decomposition, sequencing intent, integration, delivery.
- Same frozen frame; **not** an author→reviewer sequence.
- Each emits a **separate content-addressed Merkle source node**.
- Integrator produces one candidate that **must**
  `descends_from` **exactly** both source refs (parentage hashed into the
  candidate body — not an in-memory label).
- Obligation matrix: every row  
  `invariant → mechanism → task → negative test → exit criterion`, and a
  **strict bijection** over the constraints-declared obligation IDs.
- Verifiers: Seat 2 attests constraints **preserved**; Seat 1 attests
  implementation **preserved**. Missing/unknown verdict ≠ approval.
  **`violated` or any conflict → The Eye** (never silent blend).
- Five real, pairwise-distinct provenance keys (2 authors, integrator, 2
  verifiers) or the round does not converge.

**Optimization target:** smallest complete behavioral model that satisfies the
invariant — not the smallest textual patch. Friction is what forces that model
to be jointly survivable.

### B. Secondary — Seats 3 + 4 deny → back to produce

Stage 2 (plan) and Stage 4 (code) use the same closed shape:

```js
{
  verdict: "accepted" | "denied",
  objections: [{ scope, claim, evidence_refs }],  // controller-hashed
  empty_list_attestation: "genuinely-found-nothing" | null
}
```

Rules:

1. **Both** challengers must `accepted` to advance.
2. One `denied` returns to Stage 1 (plan) or Stage 3 (code).
3. On return, produce either:
   - **defends** — explicit rationale disposition; **same** challenger re-judges
     that objection hash; or
   - **modifies** — new dual source work and/or new integration (new hashes),
     full parallel re-join, new `plan_hash` or tree hash, then **both**
     challengers again.

   A defense is the controller-hashed disposition record of § Meaning
   (action = `disposition` on the exact `objection_hash`; why = rationale +
   `answered_by_seat` + evidence refs; both produce seats' provenance on the
   record — one seat cannot paper a deny alone). A defend + re-judge consumes
   one challenge round; a modify re-enters produce and, on return, resumes the
   **same** stage-scoped round counter (counters are global per stage, never
   reset by re-entry).
4. Empty objection list must mean genuine silence (seats.json Grok frame as
   **gate rule**, with controller-required attestation).

**Why this is friction, not just a gate:**  
Challenger objections re-enter the same dual-ownership join. Seat 2 must still
own constraint survival; Seat 1 must still own implementation survival. A deny
cannot be papered by one seat alone. That is the second friction loop — external
attack applied to the join that primary friction already produced.

### Deny-loop termination (both challenge stages)

| Condition | Terminal |
|-----------|----------|
| Both challengers accepted | advance (Eye gate or Rule-3 path) |
| Challenge rounds ≥ cap (default **4**) | `needs-work` |
| Same controller `objection_hash` **denied twice** | `needs-work` |
| Hash lineage oscillates with open challenge objections | `needs-work` |
| Parallel conflict at re-join (`violated` / unblendable) | `needs-eye` / `needs-work` |

Counting keys (controller-owned, over the stage ledger):

- **Denied twice** = the same controller `objection_hash` carries two `denied`
  judgments in one stage's ledger, from either challenger, whether the second
  came after a defend or after a modify. Lineage changes never reset the count;
  only The Eye reopening the stage does.
- **Oscillation** = a candidate `plan_hash` / tree hash recurs in the stage
  ledger (exact hash already seen this stage) while at least one challenge
  objection is open. Same predicate family as the serial repeated-hash
  stalemate, scoped to open objections.

Without caps, Seats 3 & 4 and the produce pair can spin. Caps bound the friction
loop; they do not replace The Eye.

### Referee (role R · gemini) — semantic loop watch

Deterministic terminals catch loops the controller can *compute* (caps,
denied-twice, oscillation, repeated hashes). The referee watches for loops
those checks cannot see: an objection reworded each round so its hash changes
while its substance does not; defend/deny ping-pong whose dispositions restate
earlier rationales; modifies whose behavioral delta is empty. This is The
Eye's directed fifth watcher — *"Gemini acts as referee, watching for
never-ending loops"* — realized as a **role**, not a sixth seat, because the
neutral Seat 5 (agy) is definitionally computed-only and cannot judge
semantic non-progress.

Promoted from the primitive already on disk: `makeGeminiReferee`
(`breakout/breakout.mjs`) — verdicts `continue | stalemate`, judges exchange
dynamics only, fail-open on error, can never grant convergence. v2 rules:

1. **Process only, shorten only.** `stalemate` forces early `needs-work` to
   The Eye with the referee's evidence attached. The referee never disposes an
   objection, never accepts/denies a candidate, never extends a cap.
2. **Distinct calls.** Referee calls carry their own provenance; reusing a
   Seat 4 response id burns the verdict. (Whether role R should sit on a
   distinct model instead of gemini double-rolled is an open item; harm is
   bounded either way — a biased referee can only send work to the human.)
3. **Evidence or burn.** A `stalemate` verdict must cite ledger entries it was
   shown; unresolvable refs or a malformed verdict burn it and the loop
   continues under the deterministic caps alone. Referee failure can never
   block a run.
4. Cadence (proposed): after each produce round ≥ 3 and each challenge round
   ≥ 2; at most one referee call per watched round.

---

## Merkle-DAG — HASH, ORDER, and MEANING

Friction produces the **task model and obligation map**. The DAG does not
argue; it **pins, orders, and remembers why**.

### Each hash is an action and a why

A content address is not a bare blob id. The preimage of every load-bearing
hash must bind **both**:

| Field | Meaning |
|-------|---------|
| **action** | What was done — the claim, artifact body, task spec, disposition, verdict, write set, test, stage transition |
| **why** | Why it was done — the rationale, invariant link, parent refs that justify the act, objection being answered, research disposition reason, defense note |

```text
hash = H(canonicalize({ action, why, …typed fields, parent_hashes? }))
```

Rules:

1. **No action-only hash** for enforcement decisions — a plan node, research
   disposition, objection disposal, challenge deny, or defend record without a
   non-empty **why** is incomplete and cannot converge.
2. **No why-only hash** — rationale without a concrete action (what changed or
   what was asserted) is not an artifact.
3. **Why is in the preimage** — changing the rationale **must** change the hash
   (same as changing the action). Post-hoc “explanation” outside the hash is
   commentary, not evidence.
4. **Parents are part of why when descent matters** — `descends_from`, parent
   `effective_hash`es, and “answers objection_hash X” are why-structure, not
   decoration.
5. **Seat 5 neutral checkpoints** also bind action+why: e.g. action =
   `stage-transition plan-challenge→eye-gate`, why = `both challengers
   accepted; dual parentage present; provenance set complete` — computed, not
   narrated.

Illustrative shapes (controller-hashed; models never supply the hash):

```js
// Research set-aside (Stage 0 → Stage 1)
{ action: { kind: "research-disposition", seat, artifact_ref, status: "set-aside" },
  why: { note: "out of scope for phase-1; covered by obligation O-12" } }

// Parallel source node
{ action: { kind: "source-node", role: "constraints", body, obligations },
  why: { frame_ref, intent: "constraint surface for this frame" } }

// Integration
{ action: { kind: "integration-candidate", plan, obligation_matrix },
  why: { descends_from: [constraints_ref, implementation_ref] } }

// Defend after Seat 3/4 deny
{ action: { kind: "disposition", objection_hash, verb: "resolved" },
  why: { rationale, answered_by_seat, evidence_refs } }

// Plan / code task node (merkle)
{ action: { files, requirements, test },
  why: { obligation_ids, parent_effective_hashes } }  // parents fold into effective_hash
```

The obligation matrix row is the same idea at plan grain:

```text
invariant (why-class) → mechanism + task (action) → negative test + exit (how we know)
```

A row missing action-side or why-side fields is unfinished — already HELD for
parallel coverage; this rule generalizes it to **every** hashed step.

### Identity (HASH)

```text
spec_hash(node)      = H(action-bearing spec fields …)
effective_hash(node) = H({ spec_hash, parent_effective_hashes (sorted) })
                       // parents = prior actions this node is ordered after / justified by
plan_hash            = H(sorted (id, effective_hash) pairs + signers + …)
```

- Dual Daedalus source nodes and the integration candidate are content-addressed
  with action+why in the preimage (role, body, obligations, `descends_from`).
- Spec or ancestor change cascades effective hashes; ledger-gate fails closed on
  mismatch (`PLAN_TAMPERED`, lineage drift).
- Lineage of **actions and whys** is reconstructible by walking parent hashes —
  not by re-reading chat logs.

### Order (topo + parent fold)

After integration, `compileAndHashPlan` / `computePlan`:

1. Derive dependency edges (write–write serial, read-after-write, base deps).
2. Kahn **topo_order** (cycles fail closed) — order of **actions**.
3. Compute `effective_hash` **in topo order**, folding parent hashes — each step
   is “this action, given those prior actions/whys.”
4. Emit `plan_hash` + `topo_order` for execution and settlement.

**Parallel does not order by speaking turn.**  
**Order is the compiled graph of hashed actions under the whys friction made.**

Build/settlement (`runBuild`, ledger-gate) walk that order; Rule 3 re-derives
tree hashes and re-runs tests. Seats never certify their own output.

### Hashes become data for recursion

A finished run does not evaporate into transcript. Its **hashes are the next
inputs**. The same friction → hash → order engine can run again *on the residue
of prior runs*.

```text
run N     produces  { plan_hash, node effective_hashes, objection hashes,
                      disposition hashes, research refs, ledger lines, … }
                │
                ▼
run N+1   freezes a frame that *includes those refs*
          (predecessor_plan_hash, node_lineage_ref, answered objection_hash,
           authz record, weave edge to prior artifact, …)
                │
                ▼
friction again on a world that already has pinned actions+whys
                │
                ▼
new hashes  ──►  data for run N+2 …
```

What recursion can consume (all content-addressed):

| Residue | Recursive use |
|---------|----------------|
| `plan_hash` / `predecessor_plan_hash` | Next delta must descend or explicitly supersede |
| Node `effective_hash` / `node_lineage_ref` | Carry-forward concerns bound to stable lineage, not chat |
| Obligation / objection / disposition hashes | “Already answered” is data; re-open only with new action+why |
| Research artifact refs | Later stages cite or set aside by hash, not by memory |
| Challenge accept/deny records | Corpus review: repeated claim-to-proof gaps, thrash patterns |
| Settlement ledger lines | Atropos/Clotho-class consumers: what was done, in order, why |
| Seat 5 process checkpoints | Prove stage transitions were lawful across runs |

Consequences:

1. **No reliance on model memory** — the recursive input is disk + hashes.
2. **Behavioral delta accounting** (HELD methodology) becomes mechanical: compare
   hash sets and preimages, not prose “what changed.”
3. **Corpus-level Daedalus** (methodology: review the full lineage once Clotho
   weaves it) is this rule at scale — friction over *prior hashes as data*.
4. **Iliad / enrollment / retrospectives** terminate in the same kind of
   identifiers so the lifecycle can re-enter without re-deriving the world from
   scratch.
5. Recursion is still fail-closed: a recursive frame that cites a hash whose
   bytes are missing or drifted is blocked — you cannot recurse on a ghost.

Friction makes plan N thorough and unambiguous; **hashes make plan N+1 able to
start from truth instead of story.**

---

## Stage 0 — Research pre-flight (mandatory breakout)

**Name:** *Research pre-flight* (human language) / Stage 0 research breakout
(stage number). Not to be confused with **mechanical preflight** (deterministic,
zero provider calls, may run *before* Stage 0).

Stage 0 is where production reality and workflow design enter **before** Seats
1∥2 invent a plan. Forgetting either half is how you get thorough feature plans
that still fail in the wild, or clever agent graphs that still skip compliance.

### Dispatch

| Rule | Detail |
|------|--------|
| Seats | 1–4 isolated; **one call each** on the same frozen requirement frame |
| Seat 5 | Process-validates frame hash and that all four artifacts (or burn policy) are present — no research authorship |
| Output | Content-addressed research artifact + real provenance per seat |
| Authority | **Inputs only** — Stage 1 must record `used \| partially-used \| set-aside` + **why** per artifact (and per major section if set aside partially) |
| Burn | Placeholder / shared provenance burns that seat’s artifact |

### Three research surfaces (all required)

Every seat’s artifact must address **all three** surfaces. Seats weight them by
strength; none may leave a surface empty without an explicit `not-applicable`
**why** (hashed).

#### Surface A — Feature / scope research (original ask)

What the plan must include for the product goal:

- mechanisms, interfaces, constraints;
- use cases, failure cases, adversarial cases planning must consider;
- open questions that must not be papered over.

#### Surface B — Production envelope research (**required; was forgotten in thin asks**)

What production must prove so governance is not feature-only theater. Aligns
with the Production Profile Compiler domains and governance-runtime needs.
Seats research **applicability, evidence, and risks** for this frame — they do
not invent legal classifications.

| Domain cluster | Research must surface |
|----------------|------------------------|
| Identity & authentication | Who acts; session/MFA implications if user-facing |
| Authorization & tenant isolation | Multi-party / multi-tenant blast radius |
| Payments & billing | Money paths, if any |
| Data integrity & persistence | Stores, migrations, consistency |
| Scale, performance, rate limits | Product limits **and** seat/API budgets for *this* workflow run |
| Observability & incident response | How failures of product **and** of the agentic run are seen |
| CI/CD, envs, rollback, flags | How this change ships and rolls back |
| Availability, backups, DR | Continuity requirements if in scope |
| Privacy, retention, deletion | Data classes, retention, deletion, regulatory *flags* (not legal advice) |
| Third parties & supply chain | Deps, plugins, MCP seats, vendor egress |
| **AI use, egress, agent authority, provenance, consequential decisions** | What leaves the perimeter; which agents may write/act; how outputs are proven |

Plus **governance-runtime production** (how *this* TELOS/Daedalus run is safe):

- `trust_mode: signed` (or explicit waiver hash — never silent unsigned);
- secret/key custody assumptions;
- prompt/data redaction and egress allowlist;
- provider cost envelope and timeout/429 fail-closed policy;
- durable store for every hash recursion will cite;
- required CI / merge gates for the host;
- Eye / human SLA for `needs-work` if consequential.

Where the host already has a **compiled production profile** or prior
`plan_hash` residues, Stage 0 research **cites those hashes** (recursion) and
only researches deltas — it does not rediscover from chat memory.

Controller expectation for Stage 1: production-applicable domains either map
into the obligation matrix / production obligations or are set-aside with a
hashed why. A plan that only absorbs Surface A is incomplete for
production-bound frames (market-bound, production-profile builds, or Eye-tagged
production scope).

#### Surface C — Agentic workflow optimization (**required**)

How *this* work should be run under multi-seat / agentic constraints so friction
is real and cost/latency are bounded:

| Topic | Research must surface |
|-------|------------------------|
| Seat & role fit | Which strengths of 1–4 apply; where Seat 5 process gates bite |
| Parallel vs serial carve-out | Is this real plan design (1∥2 friction) or a small-delta serial path? |
| Stage budget | Suggested round caps, when to escalate to Eye early |
| Decomposition | Task/team split so Rule 1 isolation and Merkle topo stay clean (one writer per file where possible) |
| Tooling / MCP / plugins | Required connectors; pin versions; avoid split-brain backends |
| Context & capsule strategy | What must stay in the frozen frame vs sparse capsules (avoid dumping whole repos into every seat) |
| Caching vs authority | Prompt cache is transport only — never proof of coverage |
| Verification strategy | Which checks are controller/mechanical vs seat judgment; dogfood path |
| Failure modes of the workflow itself | Hang, 429, thrash, empty accept, shared provenance — how this run fails closed |
| Optimization proposals | Fewer rounds, better split, precomputed registries — each as action+why candidates for Stage 1, not silent skips of stages |

Surface C is **not** permission to drop Stage 2/4 or Seat 5. Optimization that
removes friction, signatures, or Rule 3 is non-compliant; the research must
flag such proposals as **rejected alternatives** with why.

### Seat weighting (strengths, not silos)

| Seat | Emphasize in Stage 0 |
|------|----------------------|
| **1 claude** | Architecture + delivery shape (A); agentic orchestration patterns (C); product UX/ops continuity (B) |
| **2 codex** | Constraint & test obligations (A); CI/supply-chain/check contracts (B); structured workflow feasibility (C) |
| **3 grok** | Adversarial & live-landscape (A/B); abuse, egress, market/threat intel if search is real (B); challenge-loop cost realism (C) |
| **4 gemini** | Factual re-derive & large-context inventory (A/B); cross-check production claims against frame (B); verify optimization claims (C) |

### Artifact shape (controller-hashed; models do not supply the hash)

```js
{
  research_version: 2,
  seat,
  requirement_frame_ref,
  // Surface A
  inclusions: [{ topic, claim, evidence_refs }],
  use_cases: [{ name, why_planning_must_consider }],
  failure_cases: [...],
  adversarial_cases: [...],
  // Surface B
  production: [{
    domain,              // closed id from profile catalog or "governance-runtime:*"
    applicability: "in-scope" | "not-applicable" | "unknown",
    risk_notes,
    evidence_refs,       // prior plan_hash / profile hash / docs
    suggested_obligations: [{ invariant_hint, check_hint }]  // advisory only
  }],
  // Surface C
  workflow_optimization: [{
    topic,               // seat-fit | budget | decomposition | tooling | verification | ...
    claim,
    expected_saving,     // optional: rounds | tokens | latency | risk
    must_not_weaken,     // friction | signatures | rule-3 | eye-gates | ...
    evidence_refs
  }],
  open_questions: [...],
  citations: [...]
}
```

Every `production[]` and `workflow_optimization[]` entry is subject to Stage 1
disposition (used / partial / set-aside + why). Suggested obligations are
**never** auto-inserted into the matrix without Seat 2 constraint ownership and
controller validation (production profile compiler / check registry when present).

### Relation to Production Profile Compiler

- If a **deterministic production profile** is compiled for the host, Stage 0
  treats its obligation set and profile hash as **prior residue** (Surface B
  starts from that hash).
- Stage 0 research may propose *gaps* or *deltas*; it may not replace the
  compiler or waive registry checks.
- TELOS dogfood: self-profile hash cited in Stage 0 when the host is TELOS.

### Transport honesty

Grok live-landscape and Gemini grounding run **upstream** only if transport
supports them. Otherwise those seats still complete Surfaces A–C without false
citation claims.

---

## Stage 1 — Plan produce (Seats 1 ∥ 2)

Primary friction path (see Friction §A). Terminal of a successful join:

1. Parallel structural convergence (methodology + `deriveParallelState`).
2. Research accounted: the integration candidate carries research-disposition
   records (`used | partially-used | set-aside` + why) covering each surviving
   Stage 0 artifact **and** the three surfaces (A feature / B production /
   C workflow optimization). Controller presence check; missing disposition
   blocks the join. Production-bound frames cannot set aside all of Surface B
   without an Eye-visible waiver hash.
3. Production-applicable items that are `used` must appear in the obligation
   matrix and/or compiled production obligations — not only in prose.
4. Workflow optimizations that are `used` must not remove friction, signatures,
   Rule 3, or Eye gates; controller rejects dispositions that mark those
   `must_not_weaken` controls as skippable.
5. `compileAndHashPlan` → **`plan_hash` + `topo_order`**.
6. Submission to Stage 2 (not authorization).

Parallel produce cap / conflict routing follows existing parallel workshop
rules; serial small-delta path remains available under methodology carve-out.

---

## Stage 2 — Plan challenge (Seats 3 + 4)

Secondary friction (see Friction §B) aimed at the **hashed plan**.  
Both accept → The Eye planning gate on that **`plan_hash`**.  
Deny → back to Stage 1 as friction.

---

## Stage 3 — Code produce (Seats 1 ∥ 2 under authorized plan)

- Preconditions: Eye-authorized **`plan_hash`**; frame re-hash matches.
- Work proceeds **node-by-node** in `topo_order` (Rule 1 isolation when composed
  with agentic teams / merkle workers).
- Seat 1 / Seat 2 retain dual pressure where design says so (e.g. constraint
  fidelity vs implementation), or map to plan-owned team leads — but **do not**
  replace controller test re-run or tree hash.
- Convergence for leaving Stage 3: produce-side agreement **and** controller
  tests green for settled nodes; artifact / tree hashes recorded.
- **Floor failure after agreement** (test red or tree-hash mismatch when the
  seats already agreed) returns the node to produce as friction, with the
  failing evidence as the objection; it consumes a produce cycle. The same
  tree hash failing the floor twice → `needs-work`.

Deny from Stage 4 returns here as friction: defend or modify (new tree hash /
re-settle nodes), not a unilateral patch by one seat.

---

## Stage 4 — Code challenge (Seats 3 + 4)

Same accept/deny protocol as Stage 2, subject = **code tree vs authorized
`plan_hash`**.  

- Seat 3: adversarial / abuse / live landscape (if real).  
- Seat 4: re-derive plan obligations from disk.  

Both accept → controller final Rule-3 → Eye release gate.  
Deny → Stage 3 as friction.

---

## Invariants

0. **Governance first** — every mechanism exists to mitigate hallucination,
   resist drift, and enforce compliance; convenience never overrides fail-closed.
1. **Friction before polish** — dual ownership + external deny-back are the
   planning engine; serial ledger is the small-delta tool.
2. **Seat 5 is neutral** — no technical tie-break; process attestation and
   lawful stage transitions only; never a sixth author or third adversary.
3. **Hash is law** — enforcement keys off controller-computed content addresses,
   never mutable labels or model-asserted ids.
4. **Each hash is an action and a why** — preimage binds what was done and why;
   either side missing ⇒ incomplete; changing why changes the hash.
5. **Hashes are recursive data** — prior run residue is the next frame’s inputs;
   the engine runs on pinned history, not chat memory.
6. **Order is compiled** — `topo_order` / parent-linked effective hashes, not
   chat turn order.
7. **Deny re-enters the join** — challenge stages feed friction into produce;
   they do not authorize and do not silently blend. Deny and defend are themselves
   hashed actions with whys.
8. **Provenance or burn** — real distinct response ids; shared/placeholder burns
   the round. Seat 5's attestation is content-addressed over checkpoint bytes
   (local-deterministic), not a remote model id.
9. **Rule 3** — disk + tests re-derived by the controller (Seat 5 does not
   replace Rule 3).
10. **Convergence ≠ authorization** at every model terminal.
11. **Closed caps** on challenge rounds and dual-denial of the same objection
    hash.

### Call accounting (bounds)

| Stage | Bound |
|-------|--------|
| 0 research | 4 calls |
| 1 parallel produce | per existing parallel workshop accounting |
| 2 plan challenge | ≤ 2 × `ADVERSARIAL_MAX_ROUNDS` challenger calls + ≤ 1 produce-pair defense record per denied round (default 4 rounds) |
| 3 code produce | ≤ `CODE_MAX_ROUNDS` (default 8) produce cycles |
| 4 code challenge | ≤ 2 × `CODE_REVIEW_MAX_ROUNDS` challenger calls + defenses as Stage 2 (default 4 rounds) |
| R referee | ≤ 1 call per watched round (produce rounds ≥ 3, challenge rounds ≥ 2) |

Round counters are **global per stage**: defend, modify, and re-entry never
reset them. The table is therefore a hard derivable ceiling per run.

---

## Mapping to `C:\Users\dsmce\telos` (current truth)

| Concern | On disk today | v2 |
|---------|---------------|-----|
| Parallel friction produce | HELD + `runParallelDaedalus` | Stage 1 |
| Serial objection ledger | small deltas only | unchanged carve-out |
| Merkle hash + topo order | `merkle-dag` `compileAndHashPlan` | after Stage 1 join; Stage 3 executes under it |
| Challenge as gate + deny-back friction | **not** full Stage 2/4 yet (Grok often advisory) | Stages 2 & 4 |
| Research breakout | missing | Stage 0 |
| Referee | `makeGeminiReferee` (`breakout/breakout.mjs`), default-wired in `saas-forge/live.mjs` — `continue \| stalemate`, fail-open, never grants convergence | role R over both friction loops |
| Build / Rule 3 / Eye | proposal lifecycle + ledger-gate | retained |

---

## Open items for The Eye

1. Caps (challenge 4 / code produce 8).  
2. Planning-gate vs coding-gate: one Eye action or two.  
3. Grok search honesty for Stage 0 / 4.  
4. How tightly Stage 3 maps to parallel dual seats vs team-leads under the DAG.  
5. Whether Stage 0 is mandatory for all plans or skippable for small-delta serial
   (if skipped, Surfaces B+C still need a prior production-profile hash + workflow
   residue or an Eye waiver).  
6. Implementation: extend `daedalus.mjs` + orchestrator vs workshop-first proof.  
7. Referee (role R): cadence thresholds, and whether it should sit on a
   distinct model rather than gemini double-rolled (challenge Seat 4 + role R).  
8. Closed domain id catalog for Surface B (bind to Production Profile Compiler
   registry) and closed `must_not_weaken` enum for Surface C.

## Non-claims

- Methodology is HELD; this file is not implementation authorization.
- Challenger `accepted` is not TELOS authorization or compliance certification.
- Research artifacts are not obligations.
- Caps bound friction loops; they do not prove absence of all hallucination or
  all process failure.
- A referee `continue` is not proof of progress — only deterministic terminals
  prove anything; the referee only ends runs early, with evidence.
- Seat 5 neutrality and Rule 3 reduce risk; they do not make models truthful.
- **Governance mitigates; The Eye and disk still decide.**

---

**Hold record:** The Eye ACCEPTED (2026-07-20): **primary friction = Seats
1 ∥ 2**, **secondary friction = Seats 3+4 deny→produce**, **Seat 5 = neutral
(agy)**, **role R = gemini referee watching for never-ending loops
(shorten-only)**, **Merkle-DAG supplies hash + order**, **each load-bearing
hash is an action and a why**, and **those hashes are the data of recursion**.
**Goal clarification (same hold lineage):** the purpose of that stack is
**governance** — mitigate hallucination, resist drift, enforce compliance with
AI. **Stage 0 research pre-flight** includes **production envelope** and
**agentic workflow optimization** as required research surfaces alongside
feature/scope research, so production and workflow design are not forgotten
until after planning. Open items 1–8 await separate rulings. Amendments proceed
under CHANGE-PROTOCOL. This file is the canonical record and does not move.
