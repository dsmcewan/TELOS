// model-profiles.mjs — what each model seat is GOOD and BAD at, as data.
//
// The functional point of a multi-model council is not redundancy — it is placing
// each model where it is strongest and prompting it in the mode it does best. This
// matrix is the single source of that rationale: teams.mjs places leads from it
// (a test asserts every team lead's role is in its preferred_roles), and
// teamPrompts.mjs frames each provider's prompt to invoke its strength.
//
// Grounded in each provider's published agentic guidance (Anthropic, OpenAI, xAI,
// Google). Capabilities evolve and model ids stay env-overridable; this is about
// each model's DURABLE shape, not a specific snapshot id.

export const MODEL_PROFILES = {
  claude: {
    provider: "anthropic",
    strengths: [
      "long-horizon agentic coding",
      "careful structured reasoning and instruction-following",
      "system architecture and code quality",
      "clear writing and UX / brand voice",
      "safety and adversarial robustness"
    ],
    weaknesses: ["can be verbose / over-cautious", "no live/real-time data"],
    preferred_roles: ["planning", "architecture", "frontend", "evals"]
  },
  codex: {
    provider: "openai",
    strengths: [
      "strong code generation and refactoring",
      "broad API / library knowledge",
      "best-in-class tool-calling and strict structured outputs",
      "deep logic and step-by-step planning (reasoning models)"
    ],
    weaknesses: ["terse", "occasionally over-confident"],
    preferred_roles: ["backend", "evals", "ops", "architecture", "security", "integrity"]
  },
  grok: {
    provider: "xai",
    strengths: [
      "real-time web / X search for live market and threat intel",
      "contrarian, multi-agent adversarial reasoning",
      "genuine red-teaming (less filtered)",
      "large context"
    ],
    weaknesses: ["less-proven code correctness", "favors freshness over rigor"],
    preferred_roles: ["breakout", "security", "business"]
  },
  gemini: {
    provider: "google",
    strengths: [
      "very large context",
      "deep-think verification and cross-checking",
      "strong factual grounding",
      "structured output"
    ],
    weaknesses: ["newer agentic tooling", "response id not always provided"],
    preferred_roles: ["integrity"]
  },
  agy: {
    provider: "local",
    strengths: [
      "deterministic, reproducible, content-addressed governance",
      "cannot hallucinate — verdicts are computed, not generated"
    ],
    weaknesses: ["no generative ability"],
    preferred_roles: ["ops", "backend", "planning"]
  }
};

// Does `model` list `role` among its preferred roles? Used by teams.mjs's rationale
// test so the roster cannot silently drift from this matrix.
export function isPreferredRole(model, role) {
  const p = MODEL_PROFILES[model];
  return !!p && Array.isArray(p.preferred_roles) && p.preferred_roles.includes(role);
}

// SEAT ECONOMICS — reasoning-effort tier per BOUT ROLE, not per model. The
// builder authors artifacts (worth maximum thought — omitted here so each
// seat's own max-effort default applies); adversaries hunt real defects
// (high); the reviewer judges proposals against blockers (high); the referee
// judges only exchange DYNAMICS — repetition detection needs no xhigh
// deliberation (medium). Every ai-peer ask tool honors the arg, clamping to
// what the target model supports and dropping it for models without a
// thinking-depth control. Env-overridable per role: TELOS_EFFORT_<ROLE>.
export const EFFORT_TIERS = {
  builder: null,        // seat default (max) — artifacts deserve the full budget
  challenger: "high",
  reviewer: "high",
  referee: "medium",
  approver: null        // approvals gate merges — seat default (max)
};

export function effortForRole(role) {
  const env = process.env[`TELOS_EFFORT_${String(role).toUpperCase()}`];
  if (env) return env;
  return EFFORT_TIERS[role] ?? null;
}
