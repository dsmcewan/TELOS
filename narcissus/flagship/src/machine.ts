// The single source of truth. ALL state and progression live here (XState v5), driven ONLY by the typed
// command registry. The WebGL canvas reads this state and paints; it never mutates it. This is the NORMATIVE
// "WebGL is paint, never truth" invariant, made structural.
import { createMachine, assign } from "xstate";
import { STATION_COUNT, STATIONS } from "./stations";

export interface FlagshipContext {
  stationIndex: number;
  evidenceOpen: boolean;
  evidenceId: string | null;
  threadPulled: boolean;
  theme: "dark" | "light";
  reducedMotion: boolean;
  timeScrub: number; // 0..(STATION_COUNT-1), the timeline scrubber
  exports: number;
  view: "story" | "graph"; // the story stations, or the live-weave graph view
  selectedNodeId: string | null; // selected node in the live graph
}

export const initialContext: FlagshipContext = {
  stationIndex: 0,
  evidenceOpen: false,
  evidenceId: null,
  threadPulled: false,
  theme: "dark",
  reducedMotion: false,
  timeScrub: 0,
  exports: 0,
  view: "story",
  selectedNodeId: null,
};

const clamp = (n: number) => Math.max(0, Math.min(STATION_COUNT - 1, n));

// Boot context: honors ?view=graph deep links (shareable + Lighthouse-auditable graph view) and the
// system-level prefers-reduced-motion (first-class reduced experience). Under ?e2e=1 both are pinned
// to the deterministic defaults so the E2E suite starts from a reproducible state.
export function bootContext(): FlagshipContext {
  if (typeof location === "undefined") return initialContext;
  const q = new URLSearchParams(location.search);
  const e2e = q.get("e2e") === "1";
  return {
    ...initialContext,
    view: !e2e && q.get("view") === "graph" ? "graph" : initialContext.view,
    reducedMotion: !e2e && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

export type FlagshipEvent =
  | { type: "NEXT_STATION" }
  | { type: "PREV_STATION" }
  | { type: "GO_STATION"; index: number }
  | { type: "OPEN_EVIDENCE" }
  | { type: "CLOSE_EVIDENCE" }
  | { type: "PULL_THREAD" }
  | { type: "RELEASE_THREAD" }
  | { type: "TOGGLE_THEME" }
  | { type: "TOGGLE_MOTION" }
  | { type: "SCRUB_TIME"; value: number }
  | { type: "EXPORT" }
  | { type: "RESET" }
  | { type: "ENTER_GRAPH" }
  | { type: "EXIT_GRAPH" }
  | { type: "SELECT_NODE"; id: string }
  | { type: "CLEAR_NODE" };

export const flagshipMachine = createMachine({
  id: "flagship",
  types: {} as { context: FlagshipContext; events: FlagshipEvent },
  context: bootContext,
  on: {
    NEXT_STATION: {
      actions: assign(({ context }) => {
        const i = clamp(context.stationIndex + 1);
        return { stationIndex: i, timeScrub: i, evidenceOpen: false, threadPulled: false };
      }),
    },
    PREV_STATION: {
      actions: assign(({ context }) => {
        const i = clamp(context.stationIndex - 1);
        return { stationIndex: i, timeScrub: i, evidenceOpen: false, threadPulled: false };
      }),
    },
    GO_STATION: {
      actions: assign(({ event }) => {
        const i = clamp((event as { index: number }).index);
        return { stationIndex: i, timeScrub: i, evidenceOpen: false, threadPulled: false };
      }),
    },
    OPEN_EVIDENCE: {
      actions: assign(({ context }) => ({
        evidenceOpen: true,
        evidenceId: STATIONS[context.stationIndex].evidenceId,
      })),
    },
    CLOSE_EVIDENCE: { actions: assign({ evidenceOpen: false }) },
    PULL_THREAD: { actions: assign({ threadPulled: true }) },
    RELEASE_THREAD: { actions: assign({ threadPulled: false }) },
    TOGGLE_THEME: {
      actions: assign(({ context }) => ({ theme: context.theme === "dark" ? "light" : "dark" })),
    },
    TOGGLE_MOTION: {
      actions: assign(({ context }) => ({ reducedMotion: !context.reducedMotion })),
    },
    SCRUB_TIME: {
      actions: assign(({ event }) => {
        const v = clamp((event as { value: number }).value);
        return { timeScrub: v, stationIndex: v, evidenceOpen: false, threadPulled: false };
      }),
    },
    EXPORT: { actions: assign(({ context }) => ({ exports: context.exports + 1 })) },
    RESET: { actions: assign(() => ({ ...initialContext })) },
    ENTER_GRAPH: { actions: assign({ view: "graph", evidenceOpen: false }) },
    EXIT_GRAPH: { actions: assign({ view: "story", selectedNodeId: null }) },
    SELECT_NODE: { actions: assign(({ event }) => ({ selectedNodeId: (event as { id: string }).id })) },
    CLEAR_NODE: { actions: assign({ selectedNodeId: null }) },
  },
});
