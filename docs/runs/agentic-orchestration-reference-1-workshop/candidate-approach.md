# Candidate approach — agentic-orchestration reference (institutional-memory addition)

**Cycle:** post-Phase-1, Iliad lifecycle. **Normativity:** ADVISORY. **Governing authority:** clotho v15
`sha256:05a48700…` / authz-008 (context only — this addition is not a Clotho plan change).
**Pre-review:** `docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-17-agentic-orchestration-reference.json`.

This is the APPROACH under review, not the final records. The workshop matures it (claude author / codex
reviewer) to `submit`; the record set is authored afterward in the implementation phase.

## 1. What is being added, and why it is disjoint from what exists

A reference record set for the **orchestration-pattern taxonomy + selection methodology** — *which*
orchestration shape to use *when* — grounded in Anthropic's published guidance. It is **disjoint** from the
existing modules:

- `loadout/` documents the orchestration **trust surface** (seat routes, capability packets) and *permits*
  harness swarms. It does **not** name the pattern-selection methodology.
- `daedalus/`, `telos/`, `argo/` document **specific role instantiations**, not the general taxonomy.

So this adds the missing layer: the named patterns and the decision rule. It **improves** every existing
module by giving them shared vocabulary — `loadout` swarms become "parallelization," Daedalus becomes
"orchestrator-workers + evaluator-optimizer," the held-PR/The-Eye protocol becomes the "human-in-the-loop
ground-truth checkpoint." Each existing module becomes a worked example of a named pattern (the
recursive-improvement principle).

## 2. Record set to author (SCHEMA.md format)

A new capability-module-style memory dir `docs/institutional-memory/orchestration/` with the standard set:

- `IDENTITY.md` — what the reference IS (a pattern taxonomy + selection methodology, ADVISORY) and what it
  is NOT (not an enforcement rule, not a new mythological role, not a runtime).
- `INVARIANTS.md` / `INVARIANTS.json` — the load-bearing rules: e.g. *simplicity-first* (add orchestration
  machinery only when it demonstrably beats the simpler option); *a ground-truth checkpoint is mandatory for
  any autonomous loop*; *convergence ≠ authorization* (cross-linked, not restated).
- `NON-CLAIMS.md` / `NON-CLAIMS.json` — honest boundaries: this reference does not enforce, does not choose
  the pattern for you, and is not a substitute for the loadout trust rules.
- `CONTRACTS/pattern-taxonomy.json` — the six patterns (prompt-chaining, routing, parallelization,
  orchestrator-workers, evaluator-optimizer, autonomous-agent) with when-to-use, each anchored to an
  Anthropic source URL and to the TELOS module that instantiates it.
- `CONTRACTS/decision-checklist.json` — the five-step task-evaluation checklist.
- `README.md` — the human projection.
- `comprehension-queries.json` — authority-anchored queries (each expected fact terminates in a stable
  identifier: an Anthropic source, a code export, or a TELOS module record).

## 3. Authority anchoring (every load-bearing claim terminates in a stable id)

- Pattern definitions → the six Anthropic source URLs (verified 2026-07-16), listed in the pre-review.
- TELOS instantiations → the existing module records (`loadout/IDENTITY.md`, `daedalus/IDENTITY.md`, the
  held-PR protocol in `argo/`), by path.
- Cross-cutting invariants → the existing canonical records (`docs/convergence-is-not-authorization.md`),
  cross-linked, never re-asserted as new.

## 4. Seed and reuse

Seed content: PR #128 `docs/agentic-orchestration-reference.md` — reframed into the record set above, not
kept as a loose doc. No rediscovery: the trust-surface material stays owned by `loadout`; this module points
to it rather than duplicating it.

## 5. Verification (how the records prove out)

- `comprehension-queries.json` answerable purely from the records + anchors; a hallucinating reader (e.g.
  "orchestration is enforced" or "the reference picks the pattern") is denied.
- `verify-contracts.mjs` extended (or a local check) so every taxonomy row's `instantiated_by` path exists
  and every `source` is one of the pre-review's verified URLs.
- Terminal is **submit, not authorization** — TELOS authz (or The Eye's acceptance of an ADVISORY reference)
  follows the workshop; the workshop does not authorize.

## 6. Explicit non-goals (this cycle)

- No record flipped NORMATIVE-ENFORCED (ADVISORY only).
- No new mythological term or component boundary (no vocabulary registration; "orchestration" is a plain
  descriptive capability-module name, like `loadout`).
- No change to any frozen Clotho plan or any authz.
- Stale-PR housekeeping (#102/#103 close, #128 reframe) tracked separately, not bundled here.
