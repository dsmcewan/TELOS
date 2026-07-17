# Slice 6 — ESCALATION to The Eye (2026-07-17)

Per `docs/institutional-memory/CHANGE-PROTOCOL.md`: a genuine defect in a frozen plan is
**escalated, never designed around**. The slice-6 build agent completed full empirical
verification, committed nothing, and left its tree clean. Slice 6 implementation is
PAUSED pending The Eye's ruling.

## ESCALATE 1 (blocking) — Task 6 is unsatisfiable at the current repository state

The clause (v15 lines 1967–1983, 2004–2009) requires all eight expectation groups
matched and ledger-only `why.gaps` EMPTY for the flagship target
`merkle-dag/obligation.mjs#deriveExecutableRef`. Proven from a real published, verified
weave of this exact tree (3,892 trusted records; header `repository_ref` equals the
derived `git-root:8edaa2ed…`):

```
why.gaps = [
  {gap:"missing-edge", expected_kind:"discharges",   at_node:<target>},   // contract group
  {gap:"missing-edge", expected_kind:"evidenced-by", at_node:<target>},   // run-evidence group
  {gap:"missing-edge", expected_kind:"motivated-by", at_node:<target>}]   // concern group
```

**Root cause — two committed, reviewed inventory facts (NOT slice-5 defects):**
1. `clotho/inventory.mjs:72` — `LEDGER_SOURCES = Object.freeze([])` (the reviewed final
   Task-4a value; its own comment says adding a source "is a reviewed inventory change
   with tests"). Zero ledger sources ⇒ the ledger weaver can never emit `motivated-by`
   or either `discharges` hop.
2. `clotho/inventory.mjs:76–78` — the sole run source
   (`docs/runs/plugin-seats/summary.json`) never names `deriveExecutableRef` ⇒ no
   `evidenced-by` fact is derivable.

No task in frozen v15 commits these data sources. Slice-5 code has **zero findings** —
every exercised behavior matched spec (both weave modes published clean at 17.7s/16.3s;
D31/D35 both directions green; the agent pre-audited exact facts for the five
satisfiable groups, ready for the post-resolution artifact).

## Resolution options (The Eye's ruling required)

- **(a) Reviewed-data path** — no plan-text change: a reviewed inventory change adding a
  committed obligation-ledger source (`clotho-obligation-ledger-v1` whose concern/
  obligation entries genuinely name the flagship symbol, with dischargeEvidence and a
  contractClauseRef resolving uniquely in the committed CONTRACT_FILES index) + run
  evidence naming the symbol in a configured run source. Anticipated by inventory.mjs's
  own "reviewed inventory change with tests" comment; Task 6 text stays frozen.
- **(b) Amendment path** — a Daedalus delta matures a Task 6 revision (target or group
  set) → plan v16 → TELOS re-authorization → Eye re-confirms implementation authority.
- **(c) Defer slice 6** (and slice 7's dependent parts).

## ESCALATE 2 — pre-review R1 note contradicted the converged workshop artifact

The slice-6 pre-review (and the build prompt) stated R1 = "repository_ref
RUNTIME-INJECTED". The CONVERGED, codex-bound artifact
(`sha256:782fb3b0…`, matured-approach.md:99) resolves R1 the OPPOSITE way: the artifact
STORES the audited repository_ref. The converged artifact governs. The pre-review is
corrected in the same commit as this record; the integrator's transcription error is
preserved in the slice retrospective (rule: after a workshop converges, re-read the
MATURED text for every seeded risk — never carry the candidate's proposal forward as
the resolution).
