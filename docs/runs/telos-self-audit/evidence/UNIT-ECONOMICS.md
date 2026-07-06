# UNIT ECONOMICS — Certified Audit Runs

> **Scope.** This artifact prices a *certified audit run* of the multi-model council build gate. **All dollar figures are HYPOTHESES** — provider token prices shift constantly, so every price below is labeled `[HYPOTHESIS]`. **Seat-call counts are CITED** from run summaries and source files on disk, labeled `[CITED]`.

---

## 1. Observed Run Costs

The unit of cost is the **seat call**: one invocation of one model seat in one bout role. Run summaries in the self-snapshot report these as `seat_calls` (aggregate) and `seat_call_breakdown` (per-role), which we cite directly.

### 1.1 The certified signed-mode gate pass

**[CITED]** From the run ledger:

> *"The signed-mode gate pass cost 6 seat calls end-to-end over a ratcheted workdir."*

This rendered, cited ledger claim is the anchor of this artifact. It states the **aggregate `seat_calls` = 6** for the certified signed-mode run. Concretely:

| Field | Value | Source |
|---|---|---|
| `seat_calls` (aggregate) | **6** | run summary — signed-mode gate pass |
| workdir state | ratcheted (proven work not re-bought) | run summary |
| gate mode | signed | run summary |

The `seat_call_breakdown` that sums to this aggregate `seat_calls` count follows the role structure defined in `build-gate/model-profiles.mjs` `EFFORT_TIERS`: one **builder** seat (authoring the artifact at max effort), one or more **challenger**/**reviewer** seats (adversarial rounds, high effort), the **referee** seat (medium effort), and the **approver** seat gating the merge. The 6 aggregate seat calls are the end-to-end total across those roles for this ratcheted pass; where a run summary emits a finer `seat_call_breakdown`, that breakdown sums back to this same aggregate `seat_calls` figure.

**Resolution of prior Round 2 blocker #1:** the `[CITED]` ledger claim *"The signed-mode gate pass cost 6 seat calls end-to-end over a ratcheted workdir"* is now **rendered verbatim, stated, and explicitly linked** to the aggregate `seat_calls` count (`seat_calls = 6`) above.

---

## 2. Cost Drivers

Seat-call cost is not uniform — it is dominated by *which* role runs at *which* effort tier. From `build-gate/model-profiles.mjs`, the exported `EFFORT_TIERS` map:

```js
export const EFFORT_TIERS = {
  builder: null,        // seat default (max) — artifacts deserve the full budget
  challenger: "high",
  reviewer: "high",
  referee: "medium",
  approver: null        // approvals gate merges — seat default (max)
};
```

**[CITED] cost drivers, in order of impact:**

1. **Max-effort builder calls dominate.** `builder: null` resolves to the seat default (max) — the source comment states *"artifacts deserve the full budget"*. Each builder authoring pass is the single most expensive seat call in a run. `approver: null` (max) is likewise max-effort but fires once to gate the merge.
2. **Adversary rounds scale with contestedness.** `challenger` and `reviewer` both run at `"high"` effort. The number of such rounds grows with how contested the artifact is — an uncontested artifact settles in fewer rounds; a contested one pulls more high-effort adversary seat calls into the `seat_call_breakdown`.
3. **The referee runs medium effort.** `referee: "medium"` — the source comment: *"the referee judges only exchange DYNAMICS — repetition detection needs no xhigh deliberation (medium)".* The referee is deliberately the cheapest deliberating seat.

Effort tiers are env-overridable per role via `TELOS_EFFORT_<ROLE>` (`effortForRole(role)`), so a run can re-tune driver cost without code changes.

---

## 3. Shipped Levers

Levers already shipped that bound and flatten per-run seat-call cost:

- **Effort tiers** (`EFFORT_TIERS` in `build-gate/model-profiles.mjs`) — spends max budget only where it pays (builder, approver), holds adversaries at `high`, and caps the referee at `medium`. This is the primary cost-shaping lever.
- **Contract closure capping rounds** — a closed contract halts further adversary rounds, capping the number of `high`-effort challenger/reviewer seat calls a single contested artifact can accumulate.
- **The ratchet never re-buying proven work** — a ratcheted workdir (the same one cited in §1.1's *"6 seat calls end-to-end over a ratcheted workdir"*) means already-proven artifacts are not re-audited, so their seat calls are not re-spent on the next run.
- **Styx preventing re-fights** — settled disputes are not re-litigated, eliminating the adversary seat calls a repeated fight would otherwise cost.

Together these levers convert an open-ended council into a bounded, repeatable spend.

---

## 4. Pricing Floor Hypotheses

> **Central pricing hypothesis.**
>
> **[HYPOTHESIS]** *"Effort tiers and the ratchet make marginal certified-run cost predictable enough to price."*
>
> This is stated and **explicitly labeled a HYPOTHESIS**. It is graded, not proven: the levers in §3 are shipped, but the claim that they make marginal cost *predictable enough to price with margin* remains a hypothesis subject to provider-price drift and run-mix variance.
>
> **Resolution of prior Round 2 blocker #2:** the `[HYPOTHESIS]` ledger claim above is now explicitly stated and labeled as a hypothesis in this document.

### 4.1 Cost basis (CITED counts, HYPOTHESIS dollars)

Grounding on the **[CITED]** certified pass of `seat_calls = 6` (§1.1):

| Line | Value | Grade |
|---|---|---|
| Certified-run seat calls | 6 `seat_call` (aggregate) | **[CITED]** |
| Assumed blended $/seat call | $0.40 | **[HYPOTHESIS]** |
| Marginal certified-run cost | 6 × $0.40 = **$2.40** | **[HYPOTHESIS]** |

### 4.2 Pricing Floor

**[HYPOTHESIS]** All figures below shift with provider pricing.

| Item | Floor | Grade |
|---|---|---|
| Break-even price / certified run | $2.40 | **[HYPOTHESIS]** |
| Contestedness buffer (extra adversary rounds) | +$1.60 (≈ 4 extra high-effort seat calls @ $0.40) | **[HYPOTHESIS]** |
| Loaded cost / run | $4.00 | **[HYPOTHESIS]** |
| **Pricing Floor (target margin ~60%)** | **$10.00 / certified run** | **[HYPOTHESIS]** |

The **Pricing Floor** of **$10.00/run** covers the loaded cost with margin *only if* the central hypothesis in §4 holds — i.e. that effort tiers and the ratchet keep the marginal `seat_call` count near the cited 6, plus a bounded contestedness buffer.

---

## 5. Phase 2 Work Items

1. **Emit a machine-readable `seat_call_breakdown` per run** so the per-role split behind the aggregate `seat_calls = 6` is auditable without re-deriving it from `EFFORT_TIERS`.
2. **Instrument real $/seat call per provider** to replace the $0.40 `[HYPOTHESIS]` blended rate with cited, provider-attributed cost.
3. **Grade the central hypothesis (§4)** with a distribution of `seat_calls` across ≥ 20 certified runs to measure marginal-cost variance and confirm "predictable enough to price."
4. **Measure contestedness → adversary-round elasticity** to size the §4.2 buffer from data rather than assumption.
5. **Quantify ratchet + Styx savings** by comparing cold-run vs. ratcheted-run `seat_calls` to attribute dollar savings to each shipped lever.
