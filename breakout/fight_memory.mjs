// fight_memory.mjs — durable memory of DEFEATED solutions across bouts, cycles
// and runs. An append-only JSONL of {workstream, blocker, solution, outcome}
// entries; builder teams are shown the beaten list so they do not re-propose an
// approach that already lost. Two defeat outcomes are recorded:
//   "rejected-by-review"          the reviewer did not accept the proposal
//   "fix-did-not-survive-reattack" a claimed resolution was re-broken next round
//
// The memory NEVER decides anything — it only informs prompts. Verdicts stay
// with the challenger/facts/gate. Best-effort on IO errors: a broken memory
// must not break a bout.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function defaultFightMemoryDir() {
  return process.env.TELOS_FIGHT_MEMORY || path.join(os.homedir(), ".telos", "fight-memory");
}

/**
 * @param {object} [cfg] { dir } — storage directory (created on first write).
 * @returns {{ record(entries: Array<{workstream, blocker, solution, outcome}>): void,
 *             beatenFor(workstream: string, limit?: number): Array<{blocker, solution, outcome}> }}
 */
export function createFightMemory({ dir = defaultFightMemoryDir() } = {}) {
  const file = path.join(dir, "fights.jsonl");

  function record(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    try {
      mkdirSync(dir, { recursive: true });
      const lines = entries
        .filter((e) => e && e.workstream && typeof e.solution === "string" && e.solution.trim())
        .map((e) => JSON.stringify({
          workstream: e.workstream,
          blocker: typeof e.blocker === "string" ? e.blocker : null,
          solution: e.solution.slice(0, 2000),
          outcome: e.outcome || "beaten",
          ts: new Date().toISOString()
        }));
      if (lines.length) appendFileSync(file, lines.join("\n") + "\n");
    } catch { /* best-effort */ }
  }

  function beatenFor(workstream, limit = 20) {
    try {
      const seen = new Set();
      const out = [];
      const lines = readFileSync(file, "utf8").split("\n");
      for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        if (e.workstream !== workstream) continue;
        const key = e.solution;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ blocker: e.blocker, solution: e.solution, outcome: e.outcome });
      }
      return out.reverse();
    } catch {
      return [];
    }
  }

  return { record, beatenFor };
}
