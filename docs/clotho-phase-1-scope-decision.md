---
title: "Clotho Phase 1 — Human Scope Decision (advisory, non-sandboxed)"
type: reference
tags:
  - topic/clotho
  - workflow/authorization
  - decision/the-eye
author: the-eye
---

# Clotho Phase 1 — Human Scope Decision

**Decision authority:** The Eye (human-held). Consequential authorization
cannot be delegated to a model or inferred from silence
(`docs/mythological-vocabulary.md`). This record is the governance act that
sets Phase 1 scope; it does **not** authorize execution and does **not** alter
any authorization run.

## Standing state (preserved, not modified)

TELOS authorization run **`authz-004`**
(`docs/runs/clotho-authorization-4/`) returned **`NOT_AUTHORIZED`**
(fail-closed) against released plan **v11**. It stays exactly as recorded.

- Required-seat vote: **claude = approve, agy = approve, codex = revise**
  (advisory grok = approve, gemini = approve).
- Under the current runner, authorization requires **every** required seat —
  claude, agy, and codex — to approve; one `revise` yields `NOT_AUTHORIZED`.
- Codex recorded **four independent hard stops** (verbatim summary):
  1. The advisory-boundary scanner does not cover current executable loader
     routes, so it cannot establish the claimed inbound/outbound loader
     isolation.
  2. The query API treats an omitted coverage manifest as an empty
     coverage-unknown set for `threadsOf`/`blastRadius`, allowing incomplete
     results to appear complete.
  3. The complete-weave driver does not derive and enforce module-load closure
     equality at publication time, allowing a changed worktree mechanism to
     publish provenance that omits newly reachable files.
  4. The driver does not require each returned edge's `asserted_by` to equal
     the weaver that produced it, permitting false mechanism attribution.

Only stop **1** is a scope (claim) defect. Stops **2–4** are genuine integrity
defects in Clotho's actual job and are **not** descoped — they are repaired.

## The ruling

Clotho Phase 1 is hereby scoped as:

> An advisory deterministic knowledge-graph extractor operating on trusted
> repository code and potentially hostile data inputs. It is **not** a
> JavaScript sandbox, module-capability boundary, or proof of executable
> loader isolation.

Consequently, the revised plan must **stop claiming** that it can prove a
malicious or compromised Clotho implementation cannot obtain Node loader
authority. It must state plainly that **arbitrary trusted implementation code
runs with ordinary Node authority**. Content addressing proves *which declared
bytes were reviewed and used*; it does not prove those bytes lack every
possible ambient loading route.

### Descope — remove/replace the isolation claims

- **D23** — remove the claim that inbound and outbound isolation is *proven
  against evasion*.
- **D30** — remove the claim that general-purpose loader acquisition is
  *structurally prohibited*.
- **Accepted risk 18** — replace with an explicit non-sandbox statement.
- **D14 / D33** — narrow their meaning. `implementation_refs` and
  `orchestrator_refs` may represent the **exact supported static dependency
  inventory**, but must **not** be described as the complete set of code the
  Node process could possibly execute.

The advisory outbound scanner and closed-allowlist mechanism (D27/D32) may
remain as *advisory hardening* — what is removed is the **claim of proof**, not
necessarily the deterministic checks themselves. No amendment authored under
this decision may add, specify, or require executable loader-evasion coverage.

### Keep and repair — the three integrity blockers

These are central to Clotho's real job (honest provenance over trusted code)
and are **retained and strengthened**, expressed without any sandbox claim:

1. **Coverage honesty.** `threadsOf` and `blastRadius` must require a validated
   coverage manifest or conservatively return producer coverage as **unknown**.
   Missing evidence must never become `coverageUnknown: []`. (Follows the plan's
   existing rule that absence remains classifiable.)
2. **Publication-time provenance integrity.** Immediately before close and
   publication, the driver must re-read the actual mechanism bytes, derive the
   supported static dependency inventory, compare it exactly with the committed
   inventory, and re-check the hashes placed into provenance; **drift aborts
   publication.** The published statement is: *"These references exactly cover
   the supported, statically declared dependency model at publication time"* —
   **not** *"…every module the process could possibly reach."* This is an
   evidence-integrity requirement, not a sandbox claim.
3. **Mechanism attribution.** Every edge returned by a weaver must carry
   `asserted_by` == the invoked weaver id, `assertion_status` ==
   `deterministic-extraction`, and warnings naming that same weaver.
   Cross-weaver, human, or model attribution from a deterministic weaver result
   is rejected.

## Option 2 ("authorize over dissent") is explicitly declined

"Authorize over dissent" is **not** a TELOS authorization under the current
gate; it would be a human governance override of the unanimity contract. The
runner requires all three required seats to approve and emits
`NOT_AUTHORIZED` otherwise. The Eye may amend that governance rule, but only as
a **recorded governance amendment** — never disguised as an ordinary successful
council result. Opening Argo while calling `authz-004` `AUTHORIZED` would
falsify the evidence. This decision does **not** exercise that override.

## Required lifecycle

1. Preserve `authz-004` unchanged as `NOT_AUTHORIZED`.
2. Record this human scope decision (this document): Phase 1 is advisory and
   non-sandboxed.
3. Produce a specification amendment (round 11) that:
   - removes the isolation claims (D23, D30, accepted risk 18);
   - narrows mechanism provenance (D14/D33) to the supported static model;
   - fixes coverage-manifest semantics (`threadsOf`/`blastRadius`);
   - adds publication-time drift enforcement;
   - fixes per-weaver attribution.
4. Run a focused Daedalus delta over that amendment.
5. Release a new content-addressed plan candidate through the normal human
   boundary (The Eye).
6. Convene `authz-005` with the unchanged constituency (claude, agy, codex;
   grok/gemini advisory).
7. Keep **Argo closed** until that new gate returns `AUTHORIZED`.

## Disposition

**Descope and repair.** Do not authorize v11 over dissent. Do not grind another
round trying to prove JavaScript loader isolation.

---

*Feeds:* `docs/clotho-phase-1-plan-amendments-11.md` (the round-11 specification
amendment implementing steps 3 above). *Against:* released plan v11
(`docs/runs/clotho-daedalus-delta10/matured-plan-v11.md`). *Source dissent:*
`docs/runs/clotho-authorization-4/` (`authz-004`, preserved).
