# Loader subsystem — redesign-from-invariants frame

**Status:** frozen design frame (the input both parallel-authorship seats author from).
**Authorship:** parallel (`dossier.authorship === "parallel"`), constraints=codex, implementation=claude.
**Provenance of this mandate:** `docs/runs/clotho-harvest-1/surface-expansion-study.md` §4 + methodology rule 3.

This frame is deliberately NOT an invariant set. It states the problem, the machinery
being replaced, the failure the redesign must end, and the success criteria. The
**constraints seat** produces the formal invariant / proof-obligation set from it; the
**implementation seat** produces the architecture. Neither is pre-authored here.

---

## 1. Why this is a redesign, not a fifth patch

The methodology's third rule: *two repair-induced findings in one subsystem trigger
redesign from invariants — reopen and produce a smaller replacement model.* The loader
subsystem crossed that threshold at its **second** finding and was patched twice more
anyway. The record (surface-expansion-study §4):

| Delta | Amendment | The fix | The next finding it produced |
|---|---|---|---|
| 7→ | AM-28 | widen the outbound scanner to all specifier forms | authz-003: D14's closure never followed the widening |
| 8 | AM-31 | prohibit constructed loaders; safe-export allowlist | authz-002 #2: the allowlist is only illustrative ("e.g.") |
| 9 | AM-33 | freeze the exact safe-export mapping | (closed that one) |
| 10 | AM-34 | close provenance over the accepted module-load closure | authz-004 #1: the scanner still misses generated/aliased loader-evasion |

Each repair **preserved the prior machinery and added a distinction on top**; each
distinction exposed the next boundary. This is surface expansion, not convergence.

## 2. The machinery being replaced (the current model)

Four coupled mechanisms, grown one amendment at a time:

1. **Outbound loader-capability scanner** — recognizes prohibited *syntactic forms* of
   module-loader construction (`createRequire`, aliased/namespace/default access to
   loader-capable built-ins) for `node:module` / bare `module`, and fails closed on
   ambiguous construction.
2. **Frozen safe-export allowlist** — `LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS`, the exact
   named-export mapping Clotho may use from the loader-capable built-ins.
3. **Accepted relative module-load closure** — a *separate* derivation of each weaver's
   transitive relative-import closure, used for provenance (`orchestrator_refs`).
4. **Shared-recognizer coupling** — AM-34's requirement that (1) and (3) use the *same*
   recognizer so they cannot drift.

## 3. The boundary that keeps failing — one primitive, three failure modes

The shared root is that the model **enforces by *recognizing* membership in an
enumerated set** (of permitted exports, or of permitted load forms). Recognition of an
enumerated set fails three distinct ways, and the loader dissents are one of each — a
redesign must be shown to kill all three, not just the last:

- **F1 — the set is stated illustratively, not exactly** (authz-002 #2: the safe-export
  allowlist used "e.g."). An enumerated set that is not frozen is not a closed set.
- **F2 — two recognizers of "the set" drift** (authz-003: the provenance closure never
  followed the outbound scanner's widening). One set enforced by two derivations can
  disagree.
- **F3 — the recognizer cannot cover the real set** (authz-004 #1: generated / aliased
  loader-evasion the scanner still misses). Aliased, generated, dynamic, side-effect,
  and require-style loads are each a new form; a recognizer of a growing form-set can
  never be proven complete.

F1 and F2 were each patched by adding precision/coupling on top of the recognizer; F3 is
unpatchable by the same means, because you cannot enumerate your way to completeness over
an open form-set. The redesign must replace recognition-of-an-enumerated-set with a
primitive that is closed **by construction** — so F1 (nothing illustrative left to
tighten), F2 (one artifact, not two derivations), and F3 (nothing to scan) all become
structurally impossible rather than separately defended.

## 4. What the redesign must achieve (success criteria for the seats)

Not solutions — the properties the constraints seat must formalize into invariants and
the implementation seat must realize, jointly. These are mechanism-neutral on purpose:
they say *what must hold*, not *how*.

- **S1 — Capability confinement.** A weaver module must be structurally unable to obtain
  a general-purpose module loader or to load any module outside its own declared load
  set. Enforcement must not depend on enumerating dangerous syntactic forms.
- **S2 — Provenance equals capability (given S1).** Because S1 confines a module's
  loadable set to its declared set, that declared set *is* the provenance: recorded
  provenance must equal exactly the set of modules the module can load — no missing edge
  (under-attribution), no extra (over-attribution). One artifact read two ways
  (capability, provenance), not two derivations kept in sync — this is what structurally
  forecloses F2.
- **S3 — Closed by construction, not by detection.** The permitted load set is a
  positively declared, content-addressed set; membership is decided by *presence in the
  declaration*, not by recognizing a form — so there is nothing to scan and nothing to
  evade (forecloses F1 and F3). The frame does **not** prescribe the enforcement point;
  note only that the TELOS gate re-reads disk ground truth, so a *static* closure checked
  against disk is the idiomatic fit and a runtime loader hook (itself loader machinery,
  and a runtime dependency) is the anti-pattern to avoid. Same discipline as
  `NA_ALLOWED`, `EVIDENCE_KINDS`, and the check-registry.
- **S4 — Net-negative behavioral surface.** The replacement must carry the methodology's
  behavioral-delta accounting and show a *smaller* total model than the four mechanisms
  it retires. That the four collapse into a single closed declaration is the *hypothesis*
  to validate, not a mandated shape — but a redesign whose net surface is not negative is
  refused.
- **S5 — No orphaned machinery, no lost legitimate use.** Every one of the four current
  mechanisms is either subsumed by the new model or explicitly shown unnecessary; none is
  left half-wired. In particular, the legitimate non-loader uses the safe-export allowlist
  served (`builtinModules`, `isBuiltin`, …) must be preserved or shown no longer needed —
  confinement must not become blanket prohibition of a module Clotho legitimately uses.
- **S6 — Defeats the historical findings as must-pass tests.** The constraints seat's
  adversarial acceptance set must include, as explicit must-defeat cases, each evasion the
  old model failed on: an illustrative/underspecified permitted set (F1/authz-002), a
  capability/provenance derivation drift (F2/authz-003), and a **generated or aliased
  loader-evasion** (F3/authz-004) — plus the require-style / dynamic / side-effect forms.
  The redesign is not "done" until it defeats all of them by construction.

## 4a. Deliverable shape

The loader subsystem is currently a **specification** (the Clotho Phase-1 plan, spec
v2.8), not yet implemented code. The workshop's output is therefore a **redesigned loader
spec section** — the constraints seat's invariant/obligation set and the implementation
seat's architecture/interfaces — that re-enters the Clotho plan as a delta, subject to the
proposal lifecycle. It is not a `.mjs` patch. The behavioral-delta accounting (S4) is
measured against the current spec's loader machinery, not against a code diff.

## 5. Conflict routing

Where the constraints contract (what must be forbidden / proven) and the implementation
contract (what is buildable / minimal) cannot both be satisfied, the parallel path
routes to **The Eye** (`terminal: needs-eye`) — the tension is surfaced, never blended
into a compromise that reintroduces a form-scanner.

## 6. Out of scope for this delta

Clotho architecture unrelated to module loading; the recall/materiality pathology
(root-cause-study.md — separate cause); live-key infrastructure; anything LEXI.
