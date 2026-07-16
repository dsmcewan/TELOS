# Loader subsystem redesign — frame v2 (Option C: unrepresentability by construction)

**Status:** frozen design frame for Run 2 (the input both parallel-authorship seats author from).
**Authorship:** parallel, constraints=codex, implementation=claude.
**Supersedes as INPUT ONLY:** `docs/runs/clotho-loader-redesign/frame.md` (v1) is unchanged and remains
the Run 1 record; this is a new frame, not an edit of it.
**Commission:** `docs/runs/clotho-loader-redesign-2/adjudication-input.md` (Option C, feasibility problem).

## 0. The problem this frame commissions

Run 1 proved a semantic contradiction: closing aliased loader-value reachability (F-α) by static
gate-time checking alone was shown impossible, and the integrator escaped only by introducing a runtime
`vm.SourceTextModule` compartment — the machinery the frame forbids. Run 2 does **not** ask for a better
merge. It asks a feasibility question:

> Is there a positive construction in which **loader acquisition and loader-capable value transfer are
> unrepresentable** — so that general-purpose loading cannot be obtained, aliased, generated, or
> transferred — while introducing **no runtime loader mediation** and demonstrating an **honest
> net-negative** behavioral surface?

A valid answer may be **`infeasible-under-frame`**: a precise proof that no design satisfies the full
frame. Feasibility is not presumed, and no seat may weaken any criterion below to force a `submit`.

## 1. Non-negotiable repo constraints

Node ≥ 18; ESM; **zero third-party runtime dependencies**; no runtime loader compartment; no
dangerous-form scanner under a new name; race-free binding to verified source bytes; honestly demonstrated
net-negative behavioral surface. The deliverable is a redesigned loader **spec** section (a Clotho plan
delta), not code.

## 2. Revised success criteria (mechanism-neutral; the seats formalize them)

**C1 — Authority boundary.** A unit's permitted authority is its **exact, content-addressed transitive
capability closure**, not merely its direct import-edge set. A value available to a unit is forbidden when
its possible target domain: exceeds that closure; cannot be mechanically bounded; depends on
caller-selected arbitrary resolution; or can manufacture or obtain broader authority.

**C2 — No ambient loader authority.** The execution model must provide no ambient: dynamic module
resolver; `require` / `module.require`; `createRequire`; process-mediated builtin loader acquisition;
code-generation route capable of obtaining module authority; host callback accepting arbitrary module
identifiers; reflective route to an unrestricted loader. This must follow from the **construction**, not
from recognizing source spellings.

**C3 — Closed cross-unit value model.** Values crossing unit boundaries must belong to an exact positive
model. Permitted categories may include: deeply inert canonical data; explicitly modeled immutable
records; sealed finite-domain capabilities whose target set is **mechanically derived** from the addressed
authority graph. Unrestricted functions, constructors, proxies, thenables, raw module namespaces,
executable callbacks, host objects, and service-returned capabilities are **not** permitted unless their
authority is mechanically proven finite and contained within the recipient's closure.

**C4 — No author-asserted safety.** A manifest cannot prove arbitrary executable code is loader-free by
declaring it so. No manually assigned effect label, annotation, allowlist entry, or capability tag
suffices unless a **trusted construction** makes violation impossible.

**C5 — Generated and transferred authority.** The construction must defeat: direct dynamic import;
generated-source acquisition; aliased loader values; multi-hop value transfer;
namespace/default/destructured loader acquisition; require-style routes; process-mediated builtin
acquisition; callbacks or service results carrying broader authority. The tests must **not** depend on
recognizing each attack form as a separate prohibition rule — the attack forms are **test vectors, not the
enforcement model**.

**C6 — Byte acquisition without the path race.** Validation and execution must consume the **same verified
bytes** without path re-resolution after trust is established. Permitted design classes include: immutable
Git-tree/blob acquisition from a pinned commit; descriptor-relative, no-follow traversal and reads; or
another construction with equivalent proof. A repeated `lstat` walk plus ordinary path reopen is expressly
insufficient.

**C7 — Honest surface accounting.** The behavioral-delta ledger must use **one row per independently
meaningful semantic distinction on both sides**. Count separately: schemas and schema branches; authority
stores; parsers or interpreters; resolvers; validation branches; failure outcomes; synchronization
obligations; runtime machinery; snapshot or descriptor machinery; compatibility translations;
proof-specific mechanisms. **Net zero or positive is refusal.**

**C8 — Feasibility is not presumed.** Three legitimate terminal outcomes exist: `submit`, `needs-eye`,
`infeasible-under-frame`. No seat may weaken C1–C7 to force `submit`.

## 3. Obligation namespace (fresh IDs so Run 1 obligations are not silently redefined)

The constraints seat declares a new exact set. Suggested (the seat owns the final set):

- **LOAD-C-INV-1** — canonical closed authority graph
- **LOAD-C-INV-2** — transitive authority boundary
- **LOAD-C-INV-3** — no ambient loader acquisition
- **LOAD-C-INV-4** — closed cross-unit value categories
- **LOAD-C-INV-5** — no manual safety assertions
- **LOAD-C-INV-6** — generated and aliased authority defeat
- **LOAD-C-INV-7** — provenance equals authority
- **LOAD-C-INV-8** — race-free source snapshot
- **LOAD-C-INV-9** — complete retirement of old machinery
- **LOAD-C-INV-10** — symmetric net-negative surface
- **LOAD-C-INV-11** — atomic fail-closed publication
- **LOAD-C-INV-12** — Node 18 and zero-dependency feasibility

The integrator's matrix must be an **exact bijection** over the final declared set.

## 4. Mandatory proof cases (test vectors, not enforcement rules)

The candidate must define executable or mechanically checkable proof cases for:

1. An exported function that attempts `import(argument)`.
2. A loader value transferred across two or more unit boundaries.
3. A loader hidden in a namespace, object property, closure, proxy, thenable, callback, exception,
   prototype, or service result.
4. `new Function`, `eval`, and generated source.
5. `require`, `module.require`, `createRequire`, and process-mediated acquisition.
6. A permitted finite-domain capability that succeeds only within the recipient's transitive closure.
7. A capability whose domain exceeds the recipient closure and is rejected.
8. A filesystem parent swapped to a symlink after initial validation.
9. Source bytes changed between validation and execution.
10. Exact snapshot identity between provenance and consumed execution bytes.
11. Symmetric before/after surface-ledger recomputation.
12. A candidate whose net surface is zero or positive and is refused.
13. No accepted evidence published after any validation or execution denial.
14. No old scanner, safe-export authority path, independent closure derivation, or recognizer-coupling
    path remains authoritative.

## 5. Seat contracts (what each seat owns; encoded into the workshop prompts)

- **Constraints (codex)** owns: exact invariants; trust boundaries; positive-construction proof
  requirements; the filesystem-snapshot obligation; the symmetric surface-accounting methodology;
  adversarial tests; the exact frozen obligation-ID set. **It must not prescribe a runtime compartment as
  the answer.**
- **Implementation (claude)** owns: the candidate positive construction; the authority/value model;
  interfaces; data flow; Node-18 viability; zero-dependency feasibility; task decomposition; the honest
  behavioral-delta ledger. **It may return `infeasible` with a precise impossibility argument** instead of
  inventing machinery that breaks the frame.
- **Integrator (claude)** must produce one candidate descending from both sources. It **may not**:
  substitute runtime mediation; accept a static residual; add a source-form blacklist; replace proof with
  manual annotations; silently alter either source contract. A genuine conflict must **survive to
  verification**.

## 6. Terminal outcomes

- **`submit`** — implementation `feasible`; every obligation has exactly one matrix row (bijection); both
  verifiers `preserved`; no conflict; source-snapshot proof present; surface ledger strictly negative.
- **`infeasible-under-frame`** — the positive construction cannot satisfy the full frame; neither a
  residual static authority nor runtime mediation is smuggled in; both verifiers agree the impossibility
  argument is complete. `infeasible-under-frame` is valid **only** when a seat concludes the *complete
  frame* cannot be satisfied — not merely that its preferred design failed.
- **`needs-eye`** — verifier disagreement; a new frame-level fork; uncertain feasibility; incomplete
  surface accounting; incomplete snapshot proof; or any attempted weakening or substitution.

Routing is to the human-held Eye. No blending; no seat's output is the Eye's decision.
