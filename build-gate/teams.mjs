// teams.mjs — agentic-teams roster for the autonomous builder.
//
// TELOS already has two halves: the APPROVAL council (council.mjs -> gate.mjs)
// and the EXECUTION substrate (../merkle-dag: planner -> orchestrate -> ledger).
// A "team" is the missing organizing layer that composes them: a named roster of
// model seats with a lifecycle role and an owned workstream. A build/verify team
// plugs into runBuild as a worker (orchestrate.mjs `dispatch`), so a team's
// self-report can never satisfy the gate — the controller re-derives every fact.
//
// DYNAMIC SIZING mirrors planSeats(dossier) (council.mjs): the always-on meta
// teams convene for every job; a market-bound job additionally convenes one
// build/verify team per required workstream. So the team count is a function of
// the dossier, not a fixed roster. The roster is DATA (TEAMS below) so a new
// model seat or team registers without code changes — just add a row + its
// signer keypair + TELOS_SECRET_*.

// Each team:
//   id         stable identifier (also the Ed25519 ledger signer key_id)
//   mission    one line on what the team owns
//   seats      [{ model, role }] — lead first; role is team-internal (lead/member)
//   workstream the gate workstream this team owns (null for meta teams)
//   lifecycle  "plan" | "build" | "verify" (where it plugs into the flow)
//   signer     ledger key_id used when this team settles a node (defaults to id)
// Each lead is its model's strength (see model-profiles.mjs; a test asserts every
// lead's role is in that model's preferred_roles), paired with a complementary
// member so the composition itself encodes the collaboration.
export const TEAMS = [
  // claude: careful long-horizon design + planning.
  { id: "planning",     mission: "decompose idea+telos into a content-addressed task DAG", seats: [{ model: "claude", role: "lead" }, { model: "codex", role: "member" }, { model: "agy", role: "member" }], workstream: null,                          lifecycle: "plan",   signer: "planning" },
  { id: "architecture", mission: "system shape, module boundaries, file footprints",       seats: [{ model: "claude", role: "lead" }, { model: "codex", role: "member" }],                                    workstream: "product-architecture",        lifecycle: "build",  signer: "architecture" },
  // codex: precise code-gen; paired with agy's deterministic governance.
  { id: "backend",      mission: "data model, services, migrations",                        seats: [{ model: "codex", role: "lead" }, { model: "agy", role: "member" }],                                       workstream: "backend-schema",              lifecycle: "build",  signer: "backend" },
  // claude: UX / brand voice.
  { id: "frontend",     mission: "UI and LEXI-class brand experience",                      seats: [{ model: "claude", role: "lead" }, { model: "codex", role: "member" }],                                    workstream: "frontend-brand-experience",   lifecycle: "build",  signer: "frontend" },
  // codex lead: acceptance tests are a code-gen + strict-output task; claude reviews criteria.
  { id: "evals",        mission: "acceptance tests that decide a node's `meets` verdict",   seats: [{ model: "codex", role: "lead" }, { model: "claude", role: "member" }],                                    workstream: "accuracy-evals",              lifecycle: "verify", signer: "evals" },
  // grok lead: adversarial + real-time threat intel.
  { id: "security",     mission: "threat model, secrets hygiene, abuse cases",              seats: [{ model: "grok", role: "lead" }, { model: "codex", role: "member" }],                                      workstream: "security-trust",              lifecycle: "verify", signer: "security" },
  // agy lead: deterministic deploy/rollback gating.
  { id: "ops",          mission: "deploy, scale, rollback readiness",                       seats: [{ model: "agy", role: "lead" }, { model: "codex", role: "member" }],                                       workstream: "scale-operations",            lifecycle: "verify", signer: "ops" },
  // grok lead: live market/competitive intel; claude shapes the thesis.
  { id: "business",     mission: "thesis, differentiation, market positioning",             seats: [{ model: "grok", role: "lead" }, { model: "claude", role: "member" }],                                     workstream: "business-positioning",        lifecycle: "plan",   signer: "business" },
  // grok lead: adversarial verdict-on-facts.
  { id: "breakout",     mission: "adversarial verdict-on-facts; gate of last resort",       seats: [{ model: "grok", role: "lead" }, { model: "claude", role: "member" }],                                     workstream: null,                          lifecycle: "verify", signer: "breakout" },
  // gemini lead: large-context, deep-think independent verification; codex cross-checks code.
  { id: "integrity",    mission: "independent verification: re-derive facts, cross-check claims", seats: [{ model: "gemini", role: "lead" }, { model: "codex", role: "member" }],                              workstream: null,                          lifecycle: "verify", signer: "integrity" }
];

// Always-on teams: the meta backbone (planning, architecture, breakout) plus the
// gemini-led integrity verifier. Architecture is also a workstream team, so
// dedupe-by-id below prevents a double convene.
const ALWAYS_ON = ["planning", "architecture", "breakout", "integrity"];

const byId = new Map(TEAMS.map((t) => [t.id, t]));
const byWorkstream = new Map(TEAMS.filter((t) => t.workstream).map((t) => [t.workstream, t]));

/**
 * Decide the team roster for a job FROM the dossier — the team analogue of
 * planSeats(dossier) (council.mjs:42-50). Always convene the meta backbone; a
 * market-bound job additionally convenes one team per required workstream.
 * Pure; deduped-by-id; returns roster in TEAMS declaration order.
 */
export function planTeams(dossier) {
  const ids = new Set(ALWAYS_ON);
  if (dossier && dossier.market_bound === true) {
    const workstreams = Array.isArray(dossier.required_market_workstreams) ? dossier.required_market_workstreams : [];
    for (const ws of workstreams) {
      const team = byWorkstream.get(ws);
      if (team) ids.add(team.id);
    }
  }
  return TEAMS.filter((t) => ids.has(t.id));
}

/**
 * Deterministic node -> owning team. Primary key is the node's explicit
 * `workstream` field (set by the Planning team during decomposition); falls back
 * to the first build-lifecycle team in the roster, then to the first team. The
 * mapping is pure data so the same node always routes to the same team.
 */
export function teamForNode(node, teams) {
  const roster = Array.isArray(teams) && teams.length ? teams : TEAMS;
  const ws = node && typeof node.workstream === "string" ? node.workstream : null;
  if (ws) {
    const match = roster.find((t) => t.workstream === ws);
    if (match) return match;
  }
  return roster.find((t) => t.lifecycle === "build") || roster[0];
}

/**
 * Collect the Ed25519 authorized_signers map { key_id: publicJwk } that
 * compileAndHashPlan pins into plan_hash. Only signers present in `keyring`
 * (a { key_id: publicJwk } map) are included — a team whose signer key is absent
 * cannot settle a node (fail-closed at the ledger gate). Deduped by signer.
 */
export function authorizedSignersFor(teams, keyring) {
  const roster = Array.isArray(teams) && teams.length ? teams : TEAMS;
  const signers = {};
  const ring = keyring && typeof keyring === "object" ? keyring : {};
  for (const t of roster) {
    const keyId = t.signer || t.id;
    if (ring[keyId] && !signers[keyId]) signers[keyId] = ring[keyId];
  }
  return signers;
}
