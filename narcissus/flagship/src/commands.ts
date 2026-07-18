// The typed command registry — the CLOSED INVENTORY of every interactive action on the surface.
// This is the functional-blade contract: the WebGL canvas carries NO interaction absent from this list,
// and scripts/verify-coverage.mjs asserts every command here has at least one E2E test (coverage == inventory).
export const COMMANDS = [
  "NEXT_STATION",
  "PREV_STATION",
  "GO_STATION",
  "OPEN_EVIDENCE",
  "CLOSE_EVIDENCE",
  "PULL_THREAD",
  "RELEASE_THREAD",
  "TOGGLE_THEME",
  "TOGGLE_MOTION",
  "SCRUB_TIME",
  "EXPORT",
  "RESET",
] as const;
export type Command = (typeof COMMANDS)[number];
