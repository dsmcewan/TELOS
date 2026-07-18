# Agentic orchestration reference

A task-evaluation reference for designing multi-agent / multi-model systems, distilled from Anthropic's
published guidance and mapped to how TELOS actually implements these patterns. Consult it **before**
committing to an orchestration shape: pick the simplest pattern that fits, and only escalate when the task
demonstrably needs it.

Sources (all Anthropic, verified 2026-07-16):
- **Building Effective Agents** — https://www.anthropic.com/engineering/building-effective-agents
- **Writing tools for AI agents** — https://www.anthropic.com/engineering/writing-tools-for-agents
- **Claude Agent SDK overview** — https://code.claude.com/docs/en/agent-sdk/overview
- **Effective context engineering for AI agents** — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- **How we built our multi-agent research system** — https://www.anthropic.com/engineering/multi-agent-research-system
- **Effective harnesses for long-running agents** — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

## 1. The building block

Everything starts from the **augmented LLM**: a model enhanced with retrieval, tools, and memory. Compose
augmented LLMs into workflows or agents — don't reach for orchestration machinery before you need it.

## 2. The pattern taxonomy (simplest → most complex)

| Pattern | What it is | Use it when |
|---|---|---|
| **Prompt chaining** | Fixed sequence of steps, each call consuming the last; optional programmatic "gate" checks between steps | The task cleanly decomposes into fixed subtasks; you'll trade latency for accuracy |
| **Routing** | Classify the input, dispatch to a specialized prompt/process | Distinct categories are better handled separately AND classification is reliable |
| **Parallelization** | Concurrent calls then aggregate — *sectioning* (independent subtasks) or *voting* (same task, diverse attempts) | Independent subtasks can run for speed, or multiple perspectives/attempts raise confidence |
| **Orchestrator-workers** | A central LLM dynamically decomposes the task, delegates to workers, synthesizes results | The subtasks **can't be predicted** up front (the key difference from parallelization) |
| **Evaluator-optimizer** | A generator LLM + an evaluator LLM in a feedback loop | Clear evaluation criteria exist AND iterative refinement measurably helps |
| **Autonomous agent** | Plan + act in a tool loop against environmental feedback, with ground-truth checkpoints | Open-ended problems with an unpredictable step count and no hardcodable path |

## 3. The governing decisions

- **Workflow vs. agent.** *Workflows* orchestrate LLMs/tools through **predefined code paths** — predictable,
  consistent, cheaper; best for well-defined tasks. *Agents* let the LLM **dynamically direct its own process
  and tool use** — flexible; best when model-driven decisions are needed at scale. Default to a workflow; use
  an agent only when open-endedness justifies it.
- **Simplicity first.** "Find the simplest solution possible, and only increase complexity when needed."
  Start with a good prompt + evaluation; add multi-step agentic machinery **only when it demonstrably improves
  outcomes**. Agentic systems trade latency, cost, and compounding-error risk for capability.
- **Prefer the API directly.** Many patterns are a few lines of code — don't add a framework's abstraction
  layer reflexively; it obscures the prompts/responses you need to see.

## 4. Best-practice checklists

**Agent design (3 principles):** (1) keep the design **simple**; (2) prioritize **transparency** — show the
agent's planning/reasoning steps; (3) craft the **agent-computer interface** (thorough tool docs + testing)
as carefully as a human interface.

**Tool design** (*Writing tools for AI agents*): build a few **high-impact consolidated** tools, not one per
API endpoint; **namespace** related tools (`svc_area_action`); return **meaningful, human-readable** context
over cryptic IDs; optimize for **token efficiency** (pagination/filtering/sane truncation defaults); write
descriptions "as you would for a new hire"; **evaluate on real tasks**, measuring runtime + tokens, not just
accuracy.

**Guardrails / reliability:** test in **sandboxed environments** with appropriate guardrails; use
**ground-truth checkpoints** (tests, human review) to stop compounding errors and runaway loops; give agents
**least privilege** (scope tools, read-only where possible).

**Context engineering / long-running:** manage the context window deliberately (compaction/summarization of
older turns), and design **harnesses** that let long-running agents resume, verify, and stay on-budget rather
than drifting.

## 5. How TELOS maps onto this (why the reference is load-bearing here)

- The **Daedalus workshop** = **orchestrator-workers + evaluator-optimizer**: seats decompose/author, and the
  per-seat verifiers are the evaluator loop that must pass before convergence.
- **Parallel authorship** = **parallelization/sectioning** (constraints seat ∥ implementation seat) followed
  by a synthesis (integration) step — never a blend.
- The **held-PR / The Eye** protocol = the **human-in-the-loop ground-truth checkpoint** the autonomous-agent
  guidance calls for; `needs-eye` / `infeasible-under-frame` are its terminals.
- The gate's **fail-closed, content-addressed, distinct-provenance** rules are the **guardrails** layer.
- The **surface-expansion study** is **simplicity-first** applied as a maintenance rule: two repair-induced
  findings in one subsystem trigger redesign-from-invariants, not a third patch.

## 6. Using this to evaluate a task

1. Can a single augmented-LLM call do it? If yes, stop — don't orchestrate.
2. If not, is the decomposition **fixed** (chaining/routing/parallelization = workflow) or **unpredictable**
   (orchestrator-workers / agent)?
3. Is there a **clear evaluation signal**? If yes, add an evaluator-optimizer loop; if no, be wary of an
   autonomous agent (no way to check its work).
4. What's the **ground-truth checkpoint** — test, human review (The Eye), gate? Never run an open loop without
   one.
5. Does the added complexity **demonstrably** beat the simpler option on real eval tasks? If you can't show
   it, don't ship it.
