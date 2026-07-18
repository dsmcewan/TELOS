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
};

const clamp = (n: number) => Math.max(0, Math.min(STATION_COUNT - 1, n));

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
  | { type: "RESET" };

export const flagshipMachine = createMachine({
  id: "flagship",
  types: {} as { context: FlagshipContext; events: FlagshipEvent },
  context: initialContext,
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
  },
});
