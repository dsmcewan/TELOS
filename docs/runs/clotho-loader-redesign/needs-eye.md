# Loader redesign — parallel workshop result: `needs-eye` (for The Eye)

**Run:** 2026-07-16, live, constraints=codex/gpt-5.6-sol + implementation=claude/fable-5, effort high.
**Outcome:** `conflict` / `verification-conflict` / terminal **`needs-eye`**. Both verifiers returned
`violated`; the hardened `deriveParallelState` independently confirms the conflict. Candidate ref
`sha256:b1ef60b3…`. This is not a failure — the two-seat structure refused to blend a contested
integration and surfaced the tension for human adjudication, exactly as the frame's §5 requires.

The workshop ran clean: 10 declared obligations (LOAD-INV-1..10), a 10-row obligation matrix in exact
bijection, five distinct real provenance keys. The disagreement is about the design, not the process.

## The core conflict — CONFLICT-LDR-1: static gate-time vs. runtime mediation

The whole redesign turns on one requirement: **LOAD-INV-3 — a weaver unit must be structurally unable to
obtain a general-purpose loader**, including via an *aliased loader value*, not just an import form. The
two seats reached incompatible ways to satisfy it:

- **Implementation seat (claude) — pure static, gate-time.** Its design enforces authority entirely at
  gate time: `extractImportSurface` + set-equality (declared == actual, both directions), zero runtime
  machinery. Its own §1.6/§7 make "no runtime loader hook, ever" an explicit non-goal — the frame's S3
  anti-pattern.
- **Integrator (claude) — runtime compartment.** To close LOAD-INV-3 it introduced a
  `vm.SourceTextModule` compartment with a link callback + `importModuleDynamically` handler that mediates
  loads **during weaver execution**, and *retired* the static extraction/set-equality model.

Each seat rejected the result, and both are right on their own terms:

- The **implementation verifier** says the integrator **inverted** its contract — replaced pre-execution
  static proof with runtime mediation, i.e. reintroduced exactly the loader-capable runtime machinery it
  (and the frame) forbade. Relabeling it "inside the gate" doesn't change that it resolves/links modules
  at load time.
- The **constraints verifier** says the *static* model alone **cannot** establish LOAD-INV-3: static
  import-graph equality verifies declared==actual *imports*, but cannot stop an aliased loader **value**
  (a unit `v` exporting `load = s => import(s)`) from being passed across a declared edge and invoked by
  `u` to reach `w` outside `u`'s declared set. Closing that needs a *positive construction* the integrated
  spec lacks — a namespace membrane, capability tagging, or forbidding callable load-capable exports.

So the fork is genuine and mutually exclusive:

| Option | Closes aliased-value reachability (F3 hardest form)? | Runtime machinery? | Frame-aligned? |
|---|---|---|---|
| **A. Static-only** (impl seat) | **No** — constraints seat's residual hole stands | None | Yes (S3) |
| **B. Runtime compartment** (integrator) | Yes | **Yes** — the forbidden hook | No (violates S3 + impl contract) |
| **C. Constrain the design so aliased loader values can't exist** | Yes, if achievable | None | Yes — but unproven; needs new positive construction |

Option C is the interesting one neither seat fully authored: if the manifest/model forbids a unit from
*exporting a callable that can load* (no load-capable values crossing edges), static equality may suffice
without a runtime boundary. The constraints seat gestured at it ("namespace membrane, capability
tagging"); nobody built it. That is the most promising direction if The Eye wants both S3 and LOAD-INV-3.

## Two secondary constraints findings (independent of the fork)

- **LOAD-INV-5 — TOCTOU symlink race.** The integrated spec's per-component `lstat` walk is not
  `O_NOFOLLOW`-equivalent: with a mutable untrusted repo FS, a parent component can be swapped between
  `lstat` and the path-based open. Pinned bytes prevent later byte substitution but do not prove no
  symlink was traversed. Real, and orthogonal to the static/runtime fork.
- **LOAD-INV-9 — the behavioral-delta ledger is not honest.** The claimed **net −8** counts each retired
  scanner distinction individually but aggregates many *introduced* validation branches (unknown-field,
  duplicate-key, canonical-byte, runtime-mismatch, path-containment, symlink, regular-file, digest,
  duplicate-identity, dangling-target, duplicate-request, reachability, provenance-mismatch) into a few
  labels. Under the methodology's own counting rules, **S4 (strictly-negative surface) is not proven** —
  the redesign may not actually be smaller, which is the entire point of doing it.

## What The Eye must decide

1. **Enforcement point for LOAD-INV-3:** accept the static model's residual aliased-value hole (A),
   accept a runtime boundary against the frame (B), or commission option C (forbid load-capable exported
   values so static equality closes it). This is the load-bearing decision.
2. Whether LOAD-INV-5 requires a real `O_NOFOLLOW`/openat-style mechanism.
3. Whether the behavioral-delta ledger must be recomputed honestly before S4 can be claimed — and whether
   the redesign is actually surface-negative once it is.

No blending. If A or C, the next workshop re-frames with the decision baked into the frame; if B, the
frame's S3 must be explicitly amended (a runtime boundary is a governing-spec change, not a seat's call).

Full record: `result.json` (both seats' verbatim conflict details), `artifacts/` (both source designs +
the contested integration candidate), `events.jsonl`.
