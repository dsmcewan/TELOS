# Loader redesign Run 2 — adjudication input

## The human decision is still held

The Eye has **not** selected an enforcement point. Run 1 terminated `needs-eye`
(PR #102, head `fee9d63b950ed5c7b473cd71d625c1896c2401ed`) and remains there. Option A
(accept the static residual) and Option B (accept a runtime loader compartment) are **not
accepted**. This document does not merge Run 1, does not authorize a runtime compartment,
and does not accept a known residual hole.

## What is commissioned

Option C, as a **feasibility-and-construction problem**:

> Explore a positive construction in which loader acquisition and loader-capable value
> transfer are unrepresentable; do not accept a residual hole and do not introduce runtime
> loader mediation.

A valid conclusion of Run 2 may be that **no design satisfies the full frame**
(`infeasible-under-frame`). Feasibility is not presumed.

## Why merge is not the problem (the reframing)

Run 1's integrator *did* combine the two source designs into one candidate — the mechanical
merge succeeded. The failure came at **acceptance**: each author re-checked whether the
integrated candidate still preserved its own contract, and both said no. The integrator had
silently resolved a *semantic contradiction* — "you must mediate the real loading boundary"
vs. "you must not introduce runtime loading machinery" — by selecting one parent's design
(a `vm.SourceTextModule` compartment) over the other. An integrator cannot make both
statements true by combining prose; its job is to merge compatible contracts and **expose**
incompatible ones. Run 2 asks the different question: does a *third* construction exist under
which both contracts are simultaneously true?

## Three accepted technical findings from Run 1 (bound, not paraphrased)

These are quoted verbatim from the constraints verifier, recorded in PR #102 @
`fee9d63b950ed5c7b473cd71d625c1896c2401ed`,
`docs/runs/clotho-loader-redesign/result.json` (blob `1cf3e16f39085ab4442d1904c87fff6ab2453e1a`),
`conflicts[0]` (role = constraints), against candidate
`sha256:b1ef60b394be0288e482568486c1e55dbb57f03108ed343eff62cf82d327316d`.

**F-α (aliased loader-value reachability — the load-bearing one), verbatim:**

> "LOAD-INV-3 is not established by the per-defining-module linker. A declared unit `v` can
> export `load = s => import(s)`; a unit `u` whose only direct edge targets `v` can import
> and invoke that function, and the callback resolves using `v.imports`, potentially loading
> `w` even though `w` is absent from `u.imports`. Thus `u` can obtain through an imported
> namespace an aliased loader value whose target domain exceeds `u`'s declared direct
> capability. The integrated spec provides no namespace membrane, capability tagging, or
> other positive construction preventing this transfer; freezing globals and excluding Node
> loaders does not satisfy the broader value-reachability obligation."

Accepted finding: static import-surface equality alone does **not** prove that imported or
generated *values* cannot carry broader loader authority.

**F-β (mutable-filesystem race), verbatim:**

> "LOAD-INV-5 is weakened by treating a per-component `lstat` walk as `O_NOFOLLOW`-equivalent.
> With the repository filesystem declared mutable and untrusted, an attacker can replace a
> checked parent component between `lstat` and the subsequent path-based open. Pinned source
> bytes prevent later byte substitution, but they do not prove that validation traversed no
> symbolic link, particularly when the substituted target has the expected bytes. The
> specified mechanism therefore does not close the required symlink/validation race."

Accepted finding: a path-component `lstat` followed by a path-based reopen does **not** close
the mutable-filesystem race.

**F-γ (dishonest surface ledger), verbatim:**

> "LOAD-INV-9's ledger is not methodology-compatible. It counts retired scanner distinctions
> individually while aggregating numerous introduced validation branches and failure modes
> into six broad labels … Consequently the asserted net −8 is unsupported and does not prove
> a strictly negative behavioral surface under the declared counting rules."

Accepted finding: the claimed −8 surface reduction was **not** demonstrated using symmetrical
counting.

## Immutable Run 1 anchors (evidence, not working material)

- PR: **#102**, exact head `fee9d63b950ed5c7b473cd71d625c1896c2401ed`
- Run 1 evidence tree: `62e964af8f10ec5d15ef7ec1de1703da743f5c02`
- Run state `conflict` / reason `verification-conflict` / terminal `needs-eye`
- Contested candidate `sha256:b1ef60b394be0288e482568486c1e55dbb57f03108ed343eff62cf82d327316d`
- Obligations LOAD-INV-1 … LOAD-INV-10; matrix rows 10; verdicts constraints=violated, implementation=violated

Run 2 must not edit any Run 1 artifact, event, result, or brief, and must not treat the Run 1
integrated candidate as an accepted base design.
