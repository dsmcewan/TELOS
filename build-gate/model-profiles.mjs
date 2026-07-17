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
//
// The data itself lives in seats.json (policy-as-data): a future model takes a
// seat by editing that file, and verify-contracts proves these exports equal it.

import { readFileSync } from "node:fs";

const SEATS = JSON.parse(readFileSync(new URL("./seats.json", import.meta.url), "utf8"));

export const MODEL_PROFILES = Object.fromEntries(
  Object.entries(SEATS.seats).map(([model, s]) => [model, {
    provider: s.provider,
    strengths: s.strengths,
    weaknesses: s.weaknesses,
    preferred_roles: s.preferred_roles
  }])
);

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
export const EFFORT_TIERS = SEATS.effort_tiers;

export function effortForRole(role) {
  const env = process.env[`TELOS_EFFORT_${String(role).toUpperCase()}`];
  if (env) return env;
  return EFFORT_TIERS[role] ?? null;
}
