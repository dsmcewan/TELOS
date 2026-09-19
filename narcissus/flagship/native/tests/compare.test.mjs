import test from "node:test";
import assert from "node:assert/strict";
import { comparePixels } from "../scripts/compare.mjs";
test("visual oracle rejects blank/altered frames rather than blessing candidate", () => {
    const a = { width: 100, height: 100, channels: 3, data: new Uint8Array(30000).fill(100) }, same = { ...a, data: a.data.slice() };
    assert.equal(comparePixels(a, same).pass, true);
    const blank = { ...a, data: new Uint8Array(30000) };
    assert.equal(comparePixels(a, blank).pass, false);
    const sparse = { ...a, data: a.data.slice() };
    for (let i = 0; i < 51 * 3; i++)
        sparse.data[i] = 117;
    assert.equal(comparePixels(a, sparse).pass, false);
    const subtle = { ...a, data: new Uint8Array(30000).fill(102) };
    assert.equal(comparePixels(a, subtle).pass, false);
    assert.throws(() => comparePixels(a, { ...same, width: 99 }));
});
