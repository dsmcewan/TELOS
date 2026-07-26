import { reverifyRecord } from "../breakout/verifier.mjs";

export function factBreakout({ checks, baseDir, repair }) {
  return {
    challenge: () => {
      const r = reverifyRecord({ checks }, baseDir);
      if (r.reverifiable === 0) return { blockers: ["no re-verifiable product evidence for this team"] };
      return { blockers: r.failing.map((f) => f.detail || f.description || f.id) };
    },
    revise: async (state, blockers) => {
      if (typeof repair === "function") await repair(state.workstream, blockers);
      return { evidence: state.evidence, resolved: [] };
    }
  };
}
