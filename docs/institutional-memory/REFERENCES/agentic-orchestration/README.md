<!-- GENERATED FILE — do not edit by hand.
     Rendered by render.mjs from: reference.json, CONTRACTS/pattern-taxonomy.json,
     CONTRACTS/decision-checklist.json, NON-CLAIMS.json, EVIDENCE/*.json.
     Regenerate: node render.mjs --write ; verify: node render.mjs --check -->

# Agentic-orchestration reference — advisory pattern taxonomy + selection aid

> **NORMATIVE-CURRENT · normativity: ADVISORY.** A system-level ADVISORY reference: (1) Anthropic's orchestration taxonomy (five workflow patterns vs autonomous agents), (2) a TELOS-local advisory selection checklist derived from the cited guidance, and (3) carefully qualified TELOS worked examples. It is a rendered-from-records reference, not a component, role module, runtime, or mythological term.

**Why:** The existing modules document the orchestration TRUST surface (loadout) and specific role INSTANTIATIONS (daedalus, telos, argo), but not the pattern-selection methodology — which named orchestration shape to use when. Naming the patterns gives every module a shared vocabulary and makes each a worked example; this is additive and improves the design of the set (the recursive-improvement principle).

**Scope:** Advises humans and agents choosing an orchestration shape for a task. Does NOT own seat trust (loadout), authorization (TELOS), maturation (Daedalus), implementation (Argo), or lifecycle policy (The Iliad).

**Authority:** `git:9d322ddb9c7d679414b3822c3d8128575ddb3a3e (cycle) + file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-17-agentic-orchestration-reference.json@7ea578d85896a197fce352a6407dacb6f34bcc52 (approved pre-review) + The Eye ruling: accepted 2026-07-17`

## Pattern taxonomy (five workflows + one agent)

| pattern | class | definition | use when | cautions |
|---|---|---|---|---|
| **prompt-chaining** | workflow | Decompose a task into a fixed sequence of steps, each LLM call consuming the prior output; optional programmatic gate checks between steps. | The task cleanly decomposes into fixed subtasks and you can trade latency for higher per-step accuracy. | Fixed path; poor fit when the decomposition can't be known in advance. |
| **routing** | workflow | Classify an input and dispatch it to a specialized follow-up prompt/process. | There are distinct categories better handled separately AND classification can be done reliably. | A misclassification silently routes to the wrong specialist; needs reliable classification. |
| **parallelization** | workflow | Run LLM calls concurrently and aggregate — sectioning (independent subtasks) or voting (same task run multiple times for diverse attempts). | Independent subtasks can run for speed, or multiple perspectives/attempts raise confidence. | Aggregation logic is load-bearing; voting adds cost for confidence. |
| **orchestrator-workers** | workflow | A central LLM dynamically decomposes the task, delegates subtasks to worker LLMs, and synthesizes the results. | The subtasks cannot be predicted up front (the key difference from parallelization). | Dynamic decomposition adds unpredictability and cost; needs a synthesis step. |
| **evaluator-optimizer** | workflow | One LLM generates a response; a second LLM evaluates and returns feedback in a loop. | Clear evaluation criteria exist AND iterative refinement measurably improves the result. | Without a real evaluation signal the loop just adds cost; needs a stopping condition. |
| **autonomous-agent** | agent | An LLM that plans and acts in a tool loop against environmental feedback, deciding its own steps, with ground-truth checkpoints. | Open-ended problems with an unpredictable number of steps and no hardcodable path — when flexibility and model-driven decisions are worth the cost. | Trades latency, cost, and compounding-error risk for flexibility; REQUIRES a ground-truth checkpoint (tests / human review) — but that requirement, where mandatory in TELOS, rests on TELOS/Argo records, not on this advisory reference. |

## Orchestration selection checklist — TELOS-local advisory synthesis

_Local synthesis, not a verbatim Anthropic checklist. It recommends; it does not enforce, does not choose the pattern for you, and creates no governing behavior. Any mandatory authorization or checkpoint remains mandatory only by its own TELOS/Argo authority-anchored record._

1. **Define success and available evaluation evidence.** State what 'good' means and what signal (test, oracle, human review) can measure it. No evaluation signal is a warning against any pattern with a feedback loop or an autonomous agent — you would not be able to check its work.
2. **Test the simplest adequate form first.** Try a single augmented-LLM call (with retrieval/tools) before any multi-step orchestration. If it suffices, stop — do not orchestrate.
3. **Classify the task structure.** Sequential (prompt chaining), routable (routing), parallelizable (parallelization), dynamically decomposable (orchestrator-workers), or feedback-driven (evaluator-optimizer). Only genuinely open-ended, unpredictable-step tasks point at an autonomous agent.
4. **Select the least-complex pattern that addresses the demonstrated failure mode.** Add complexity only when evidence shows the simpler tested form is inadequate — not preemptively. More agentic is not more capable if the task did not need it.
5. **Define stopping conditions, checkpoint behavior, human escalation, and authorization boundaries proportional to risk.** Any autonomous or feedback loop needs an explicit stopping condition and a ground-truth checkpoint. In TELOS, irreversible/outward-facing steps route to The Eye and through the gate — but that requirement lives in the TELOS/Argo records, not here.

## TELOS worked examples (advisory structural correspondences)

- **loadout-harness-parallelization** → _parallelization_. The loadout module records harness-level multi-agent workflows (parallel builders, refuter swarms, verification fan-outs) as trust-free-by-substrate. Structurally this is parallelization/sectioning + a synthesis step — independent workers run concurrently and results aggregate. Non-claim: The loadout module owns the TRUST rules for these harnesses; this correspondence names the pattern only and transfers no authority.
- **daedalus-orchestrator-workers-plus-evaluator** → _orchestrator-workers + evaluator-optimizer_. Daedalus decomposes plan maturation across seats (author/reviewer, or parallel constraint/implementation) and its per-seat verification loop is an evaluate-then-refine step. Structurally this combines worker orchestration with an evaluator-optimizer feedback loop. Non-claim: Daedalus owns maturation; convergence is submission, not authorization (its own record). This correspondence transfers no authority and does not weaken that rule.
- **held-pr-eye-checkpoint** → _autonomous-agent ground-truth checkpoint (human-in-the-loop)_. The held-PR / The Eye protocol is a human ground-truth checkpoint gating autonomous work — structurally the checkpoint the autonomous-agent guidance calls for. Non-claim: The Eye's authority and the held-PR requirement stand on their own TELOS/Argo records; this correspondence names the pattern and transfers nothing.

## Non-claims

- Does NOT enforce behavior — it is advisory; no record here is NORMATIVE-ENFORCED or an executable repository invariant.
- Does NOT grant, transfer, or weaken authority — authorization stays with TELOS/The Eye; 'convergence is not authorization' is linked to its own canonical record, not restated as new.
- Does NOT choose a pattern automatically — there is no selection engine; the checklist is a human/agent aid.
- Does NOT prove containment, safety, or that any pattern choice is optimal — the local checker proves structural + provenance integrity only.
- Does NOT replace component-specific policy — loadout owns the orchestration trust surface; Daedalus/Argo/Iliad own their workflows.
- Does NOT establish that a TELOS mechanism is an exact implementation of an Anthropic pattern — worked examples are advisory structural correspondences (related_example), not instantiated_by declarations.
- Does NOT authorize autonomous execution — naming the autonomous-agent pattern does not imply unlimited execution; stopping conditions, checkpoints, and TELOS authorization boundaries still apply from their own records.

## Sources (provenance metadata — locators, not authority)

- [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) — Anthropic (Engineering)
- [Writing tools for AI agents](https://www.anthropic.com/engineering/writing-tools-for-agents) — Anthropic (Engineering)
- [Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — Anthropic (Claude Docs)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Anthropic (Engineering)
- [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic (Engineering)
- [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) — Anthropic (Engineering)

Evidence is pinned by content-addressed `file:@<sha>` references in the records; a URL is provenance only. Cross-cutting rules (e.g. "convergence is not authorization") are linked to their own canonical authority, not restated here.
