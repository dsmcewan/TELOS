import { STATIONS } from "./stations.js";
import { nodeById } from "./livegraph.js";
export const COMMANDS = Object.freeze(["NEXT_STATION", "PREV_STATION", "GO_STATION", "OPEN_EVIDENCE", "CLOSE_EVIDENCE", "PULL_THREAD", "RELEASE_THREAD", "TOGGLE_THEME", "TOGGLE_MOTION", "SCRUB_TIME", "EXPORT", "RESET", "ENTER_GRAPH", "EXIT_GRAPH", "SELECT_NODE", "CLEAR_NODE"]);
export const initialState = () => ({ stationIndex: 0, evidenceOpen: false, evidenceId: null, threadPulled: false, theme: "dark", reducedMotion: false, timeScrub: 0, exports: 0, view: "story", selectedNodeId: null });
export function bootState(search = "", reduced = false) {
    const q = new URLSearchParams(search), e2e = q.get("e2e") === "1";
    return { ...initialState(), view: !e2e && q.get("view") === "graph" ? "graph" : "story", reducedMotion: !e2e && reduced };
}
export function reduce(state, event) {
    if (!event || !COMMANDS.includes(event.type))
        throw Error("Unknown command");
    const next = { ...state };
    const move = n => { if (!Number.isInteger(n))
        throw Error("Station must be a finite integer"); next.stationIndex = next.timeScrub = Math.max(0, Math.min(STATIONS.length - 1, n)); next.evidenceOpen = next.threadPulled = false; };
    switch (event.type) {
        case "NEXT_STATION":
            move(state.stationIndex + 1);
            break;
        case "PREV_STATION":
            move(state.stationIndex - 1);
            break;
        case "GO_STATION":
            move(event.index);
            break;
        case "SCRUB_TIME":
            move(event.value);
            break;
        case "OPEN_EVIDENCE":
            next.evidenceOpen = true;
            next.evidenceId = STATIONS[state.stationIndex].evidenceId;
            break;
        case "CLOSE_EVIDENCE":
            next.evidenceOpen = false;
            break;
        case "PULL_THREAD":
            next.threadPulled = true;
            break;
        case "RELEASE_THREAD":
            next.threadPulled = false;
            break;
        case "TOGGLE_THEME":
            next.theme = state.theme === "dark" ? "light" : "dark";
            break;
        case "TOGGLE_MOTION":
            next.reducedMotion = !state.reducedMotion;
            break;
        case "EXPORT":
            next.exports++;
            break;
        case "RESET": return initialState();
        case "ENTER_GRAPH":
            next.view = "graph";
            next.evidenceOpen = false;
            break;
        case "EXIT_GRAPH":
            next.view = "story";
            next.selectedNodeId = null;
            break;
        case "SELECT_NODE":
            if (!nodeById(event.id))
                throw Error("Unknown graph node");
            next.selectedNodeId = event.id;
            break;
        case "CLEAR_NODE":
            next.selectedNodeId = null;
            break;
    }
    return next;
}
