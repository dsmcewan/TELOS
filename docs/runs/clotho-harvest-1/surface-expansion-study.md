# Clotho — Repair-Induced Surface-Expansion Study

**Hypothesis (The Eye, 2026-07-15):** the confirmed defects are not unrelated
misses but **repair-induced surface expansion** — Daedalus preserves too much
local design while repairing it, so each amendment adds states/interfaces/
grammars/accounting, and the next review finds an undefined boundary in that
newly added behavior. Prediction: later findings disproportionately attach to
recent amendments.

**Method:** zero model calls. Every confirmed authorization finding (authz-001..004)
plus the three verified harvest survivors was tagged with the amendment/delta
that introduced the behavior it attacks (`attacks_delta`; 0 = the original v6
architecture), against the committed amendment map (AM-1..34 across delta-1..10).
`review_delta` = the workshop state at which the review occurred.

## Result: confirmed, and quantified

### 1. Findings track the newest machinery, not the old architecture

| Authorization | Reviewed after | Introduction-delta of behavior attacked | Mean |
|---|---|---|---|
| authz-001 (v6) | delta-5 | [0] — original architecture | 0.0 |
| authz-002 (v9) | delta-8 | [8, 8] | **8.0** |
| authz-003 (v10) | delta-9 | [7] | 7.0 |
| authz-004 (v11) | delta-10 | [6, 8, 10, 10] | **8.5** |

The first authorization found defects in the **original** plan (introduction-delta 0
— the foundational surface). Every authorization after that found defects almost
entirely in behavior **added by the repairs themselves**, and the introduction-delta
*rose with the review delta* — the target moved forward in lockstep with the patching.

### 2. The dissent-to-amendment lag is ~1 delta

For the 10 findings that attack repair-introduced behavior, the mean lag
(`review_delta − attacks_delta`) is **1.1 deltas**. Reviews are not finding old
latent bugs — they are finding undefined boundaries in machinery added **one or two
deltas earlier**. authz-002 attacked AM-30/AM-31 (delta-8) at the very next
authorization; authz-004 attacked AM-34 (delta-10, the immediately-preceding single
amendment) twice.

### 3. Repair-induced share: 10 of 11

**10 of 11 confirmed findings attack repair-introduced behavior**; only the six
authz-001 findings (counted as one original-architecture batch) target the plan as
first built. The confirmed defect stream is overwhelmingly self-inflicted by the
repair process, not residual from the initial design.

### 4. One subsystem generated a finding in three consecutive authorizations

**The loader subsystem was patched three times and dissented on three times:**

| Delta | Amendment | The fix | The next finding it produced |
|---|---|---|---|
| 8 | AM-31 | prohibit constructed loaders; safe-export allowlist | authz-002 #2: the allowlist is only illustrative ("e.g.") |
| 9 | AM-33 | freeze the exact safe-export mapping | (closed that one) |
| 7→ | AM-28 | widen the outbound scanner to all specifier forms | authz-003: D14's closure never followed the widening |
| 10 | AM-34 | close provenance over the accepted module-load closure | authz-004 #1: the scanner still misses generated/aliased loader-evasion |

Each loader repair preserved the prior loader machinery and added another
distinction on top; each addition exposed the next boundary. This is the exact
pattern your third methodology rule predicts should have triggered **redesign
from invariants, not another surgical amendment**, after the second loader finding.

## Diagnosis

Two causes, now both evidenced:

1. **Confirmed defects = repair-induced surface expansion** (this study). Daedalus's
   current objective — *preserve the plan, make the smallest textual amendment* — is
   good for provenance and diff review but accumulates scar tissue: the behavioral
   state space grows monotonically (plan text 900 → 1,920 lines), and the review
   frontier chases the newest addition at ~1-delta lag.
2. **Recall explosion = search-objective pathology** (root-cause-study.md). Separate
   cause; the finder swarm invents interpretations without a materiality constraint.

## Corrective (methodology-level, for the next delta)

Change Daedalus's objective from *smallest textual amendment* to **smallest total
behavioral model**, and require every amendment to carry a **behavioral delta
accounting**:

```
behavior added / removed · new states · new transitions · new input forms
new trust boundaries · new runtime obligations · new negative tests
net behavioral-surface change
```

with three rules:

1. **No new state without its complete state machine** in the same delta (every
   caller, exit code, evidence path, cleanup path, test derived at once).
2. **Repairs are surface-neutral by default** — a fix adding N concepts must justify
   why the original mechanism cannot instead be simplified.
3. **Two repair-induced findings in one subsystem trigger redesign**, not a third
   surgical patch — reopen from invariants and produce a smaller replacement model.
   *(The loader subsystem already crossed this threshold at finding #2.)*

## Corollary for authorization structure

Surface expansion strengthens the case for **executable, per-increment authorization**
later: the four authz-004 findings are all "nothing makes this true at runtime" —
questions a small implementation with tests answers by demonstration, where a
2,000-line prospective behavioral model can only keep answering with more text that
expands the surface again.
