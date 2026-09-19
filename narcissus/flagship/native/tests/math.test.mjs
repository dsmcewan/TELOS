import test from "node:test";
import assert from "node:assert/strict";
import { sphere, tube, perspective, viewMatrix, multiply, transform, normalMatrix, rotation, identity, ease } from "../math.js";
test("camera projects target centrally and near/far depths correctly", () => {
    const camera = multiply(perspective(48, 1.6), viewMatrix([0, 0, 10.5], [0, 0, 0]));
    const p = transform(camera, [0, 0, 0]);
    assert.deepEqual(p.slice(0, 2), [0, 0]);
    assert.ok(p[3] > 0);
    assert.deepEqual(multiply(identity(), camera), camera);
});
test("sphere and transported tube have finite unit normals and valid indexed triangles", () => {
    for (const geometry of [sphere(.86, 48), tube([0, -4, -2], [0, 0, -1], [0, 4, -2], 16, .028)]) {
        assert.equal(geometry.positions.length, geometry.normals.length);
        assert.ok(geometry.positions.every(Number.isFinite));
        assert.equal(geometry.indices.length % 3, 0);
        assert.ok(Math.max(...geometry.indices) < geometry.positions.length / 3);
        for (let i = 0; i < geometry.normals.length; i += 3)
            assert.ok(Math.abs(Math.hypot(...geometry.normals.slice(i, i + 3)) - 1) < 1e-10);
    }
});
test("normal transformation remains orthonormal for camera rotation", () => {
    const n = normalMatrix(rotation(.2, .4));
    for (let i = 0; i < 9; i += 3)
        assert.ok(Math.abs(Math.hypot(...n.slice(i, i + 3)) - 1) < 1e-10);
});
test("bounded motion easing has exact settled endpoints", () => { assert.equal(ease(-1), 0); assert.equal(ease(0), 0); assert.equal(ease(1), 1); assert.equal(ease(2), 1); assert.equal(ease(.5), .875); });
