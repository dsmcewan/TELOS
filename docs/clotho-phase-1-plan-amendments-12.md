# Clotho Phase 1 — Plan amendment 12 (AM-40)

**Status:** normative amendment to the converged plan v12
(`docs/runs/clotho-daedalus-delta11/matured-plan-v12.md`, `sha256:bdc93901…`),
to be integrated by the Daedalus delta-12 workshop into candidate **v13**.

**Origin:** a genuine frozen-scope ambiguity surfaced during Task 4a
implementation and escalated to **The Eye** (not repaired at the implementation
layer). The frozen Task 4a phrase *"inventory every current package root once"*
admits two readings, because the monorepo contains **eight** directories with a
`package.json`: the five TELOS-spine packages named in `CLAUDE.md`'s layout
(`breakout`, `build-gate`, `clotho`, `connectors/ai-peer-mcp`, `merkle-dag`) and
three sibling **products** absent from that layout (`ai-forge`, `forge`,
`saas-forge`). The Eye ruled; this amendment freezes the ruling so the plan — not
an implementation guess — carries the decision.

---

## AM-40 — `PACKAGE_ROOTS` is the TELOS spine, with an explicit, tested exclusion

**The Eye's ruling (FIXED, NON-CHALLENGEABLE):** Clotho Phase 1's target is to
build Clotho and prove it by **weaving TELOS itself**, not every product
physically present in the monorepo. The three forge directories are products
governed *beside* the spine; their filesystem proximity does not make them organs
of TELOS. Therefore Task 4a's closed `PACKAGE_ROOTS` inventory is exactly the five
TELOS-spine packages, and the three products are an **explicit, committed
exclusion** — never a silent omission.

The amendment MUST integrate into the Task 4a inventory clause (and the
`inventory.mjs` file description) the following, without dilution:

1. **Frozen values.**
   ```
   PACKAGE_ROOTS = [
     "breakout",
     "build-gate",
     "clotho",
     "connectors/ai-peer-mcp",
     "merkle-dag"
   ]
   PACKAGE_ROOTS_EXCLUDE = [
     "ai-forge",
     "forge",
     "saas-forge"
   ]
   ```

2. **Completeness + disjointness contract (mechanically enforced by a unit).** The
   test discovers *every* directory in the repository that contains a tracked
   `package.json`, and requires:
   - `discovered roots == PACKAGE_ROOTS ∪ PACKAGE_ROOTS_EXCLUDE` (no root is
     silently omitted, and neither list names a nonexistent package root); and
   - `PACKAGE_ROOTS ∩ PACKAGE_ROOTS_EXCLUDE == ∅`.

   Consequences the contract guarantees: nothing is silently omitted; a newly
   added package makes the suite (and CI) fail until it is consciously classified;
   architectural membership cannot drift merely because someone creates another
   directory; and enrolling a product into the weave requires a deliberate
   amendment.

3. **Scope boundary preserved for later architecture.** `ai-forge`, `forge`, and
   `saas-forge` are *deliberately deferred*, not forgotten. Per The Eye, the
   system-of-systems lifecycle umbrella ("the Iliad") is the layer that will use
   Clotho's weave for cross-plan and cross-system coherence, and is where those
   products are to be **consciously enrolled** — not accidentally absorbed into
   the Phase 1 TELOS self-weave. This amendment does not authorize that
   enrollment; it only fixes the Phase 1 boundary.

**No other scope changes.** AM-40 is narrow: it resolves only the
`PACKAGE_ROOTS` reading. Every other frozen decision (D17/AM-17 inventory
staging, D24/D26/D31 the inventory-id table, D32 the loader-safe-export mapping,
D33 the closure/classifier discipline, the advisory / non-sandbox posture from
AM-35..AM-39, zero-dependency + spine-read-only constraints) is reaffirmed
unchanged.

---

## Hard guards for the delta-12 workshop (FIXED)

The workshop MUST NOT:
- widen or narrow `PACKAGE_ROOTS` beyond the five spine packages, or change the
  exclusion set, or weaken the completeness/disjointness contract;
- reintroduce any descoped claim (loader isolation proven, containment, sandbox,
  capability boundary) — the AM-35..AM-39 advisory / non-sandbox posture stands;
- modify any prior authorization or Daedalus evidence (deltas 1–11 and v12 are
  read-only history);
- describe provider provenance as an HMAC signature;
- start or resume implementation, convene the re-authorization, or open Argo.

Convergence requires the two seats (claude, codex) to integrate AM-40 into the
plan body, delete this amendment appendix once integrated, and bind the exact
converged artifact — producing candidate **v13**.
