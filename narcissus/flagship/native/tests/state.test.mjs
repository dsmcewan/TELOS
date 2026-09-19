import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reduce, bootState, COMMANDS } from "../state.js";
import { STATIONS } from "../stations.js";
import { NODES } from "../livegraph.js";
test("station navigation clamps, synchronizes timeline and closes transient views", () => {
    let state = initialState();
    assert.equal(reduce(state, { type: "PREV_STATION" }).stationIndex, 0);
    state = reduce(state, { type: "GO_STATION", index: 2 });
    state = reduce(state, { type: "OPEN_EVIDENCE" });
    assert.equal(state.evidenceId, STATIONS[2].evidenceId);
    state = reduce(state, { type: "PULL_THREAD" });
    state = reduce(state, { type: "NEXT_STATION" });
    assert.deepEqual([state.stationIndex, state.timeScrub, state.evidenceOpen, state.threadPulled], [3, 3, false, false]);
    assert.equal(reduce(state, { type: "GO_STATION", index: 99 }).stationIndex, 5);
    assert.equal(reduce(state, { type: "SCRUB_TIME", value: -9 }).stationIndex, 0);
});
test("every command preserves immutable inputs and has a defined behavior", () => {
    const payloads = { GO_STATION: { index: 2 }, SCRUB_TIME: { value: 3 }, SELECT_NODE: { id: NODES[0].id } };
    const state = Object.freeze(initialState());
    for (const type of COMMANDS) {
        const next = reduce(state, { type, ...payloads[type] });
        assert.ok(next);
        assert.notEqual(next, state);
    }
    assert.equal(COMMANDS.length, 16);
    assert.equal(reduce(state, { type: "EXPORT" }).exports, 1);
    assert.equal(reduce(state, { type: "TOGGLE_THEME" }).theme, "light");
    assert.equal(reduce(state, { type: "TOGGLE_MOTION" }).reducedMotion, true);
    assert.deepEqual(reduce({ ...state, exports: 9, view: "graph" }, { type: "RESET" }), state);
});
test("malformed commands cannot poison state", () => {
    const s = initialState();
    for (const event of [null, {}, { type: "NOPE" }, { type: "GO_STATION", index: NaN }, { type: "SCRUB_TIME", value: 2.5 }, { type: "SELECT_NODE", id: "missing" }])
        assert.throws(() => reduce(s, event));
});
test("deep links and reduced motion respect deterministic test mode", () => {
    assert.equal(bootState("?view=graph", true).view, "graph");
    assert.equal(bootState("?view=graph", true).reducedMotion, true);
    assert.deepEqual(bootState("?view=graph&e2e=1", true), initialState());
});
