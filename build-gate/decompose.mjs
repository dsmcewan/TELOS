// decompose.mjs — the Planning team: turn an idea + telos statement into a
// content-addressed task list for ../merkle-dag/planner.compileAndHashPlan.
//
// AUTONOMY WITH A FLOOR: this is the autonomous front-end of the builder, but its
// output is DATA ONLY. compileAndHashPlan re-hashes every task, the council
// approval gate must still PASS, and runBuild's Rule-3 verify re-derives every
// artifact fact. So even a fabricated decomposition cannot reach merge — the
// Planning team proposes, the deterministic substrate disposes. A human may also
// hand-author the task list and skip this entirely (buildProject takes `tasks`).

import { planTeams } from "./teams.mjs";

// The minimum a task needs to compile + verify: an id, the files it writes, a
// requirements string, and a test command the controller can run (Rule 3).
function validTask(t) {
  return t && typeof t.id === "string" && t.id.length > 0
    && Array.isArray(t.writes) && t.writes.length > 0
    && typeof t.requirements === "string"
    && t.test && typeof t.test.cmd === "string";
}

// Normalize a Planning-team-proposed task into the shape planner.compileAndHashPlan
// expects, carrying the explicit `workstream` field teamForNode routes on.
function normalizeTask(t) {
  return {
    id: t.id,
    writes: [...t.writes],
    reads: Array.isArray(t.reads) ? [...t.reads] : [],
    requirements: t.requirements,
    test: t.test,
    workstream: typeof t.workstream === "string" ? t.workstream : "product-architecture",
    baseDependencies: Array.isArray(t.baseDependencies) ? [...t.baseDependencies] : []
  };
}

/**
 * Convene the Planning team and return a normalized task list.
 *   callSeat  ({ model, role, dossier, telos, intent }) -> { tasks } | { packet: { tasks } }
 *             the Planning team's lead seat proposes the decomposition; for live
 *             wiring this is built over ai-peer-mcp, for tests it is a deterministic mock.
 * Throws if the team proposes nothing usable (fail-closed: no silent empty plan).
 */
export async function decompose({ dossier, telos, callSeat, teams, conventions }) {
  const roster = Array.isArray(teams) && teams.length ? teams : planTeams(dossier);
  const planning = roster.find((t) => t.id === "planning") || roster[0];
  const lead = planning && planning.seats[0] ? planning.seats[0].model : "claude";

  // `conventions` (project sense) is passed through so the live Planning prompt can
  // prefer the project's real test command; mocks/tests ignore it.
  const out = (await callSeat({ model: lead, role: "lead", team: "planning", intent: "decompose", dossier, telos, conventions })) || {};
  const raw = Array.isArray(out.tasks) ? out.tasks
    : (out.packet && Array.isArray(out.packet.tasks) ? out.packet.tasks : []);

  const tasks = raw.filter(validTask).map(normalizeTask);
  if (tasks.length === 0) {
    throw new Error("decompose: Planning team produced no valid tasks (need id, writes, requirements, test.cmd)");
  }

  // Reject duplicate ids early — compileAndHashPlan would otherwise topo-sort an
  // ambiguous graph. Fail-closed before any plan is written.
  const ids = new Set();
  for (const t of tasks) {
    if (ids.has(t.id)) throw new Error(`decompose: duplicate task id '${t.id}'`);
    ids.add(t.id);
  }
  return tasks;
}
