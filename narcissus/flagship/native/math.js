export const add = (a, b) => a.map((x, i) => x + b[i]);
export const sub = (a, b) => a.map((x, i) => x - b[i]);
export const scale = (a, k) => a.map(x => x * k);
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = a => Math.hypot(...a);
export const norm = a => scale(a, 1 / (length(a) || 1));
export const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function multiply(a, b) { const c = Array(16).fill(0); for (let col = 0; col < 4; col++)
    for (let row = 0; row < 4; row++)
        for (let k = 0; k < 4; k++)
            c[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k]; return c; }
export function transform(m, v, w = 1) { return [0, 1, 2, 3].map(row => m[row] * v[0] + m[4 + row] * v[1] + m[8 + row] * v[2] + m[12 + row] * w); }
export function translation(x, y, z) { const m = identity(); m[12] = x; m[13] = y; m[14] = z; return m; }
export function rotation(x, y) { const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y); return [c, b * d, -a * d, 0, 0, a, b, 0, d, -b * c, a * c, 0, 0, 0, 0, 1]; }
export function perspective(degrees, aspect, near = .1, far = 1000) { const f = 1 / Math.tan(degrees * Math.PI / 360), nf = 1 / (near - far); return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]; }
export function viewMatrix(eye, target) { const z = norm(sub(eye, target)), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]; }
export function normalMatrix(m) {
    const a = [m[0], m[1], m[2]], b = [m[4], m[5], m[6]], c = [m[8], m[9], m[10]];
    const x = cross(b, c), y = cross(c, a), z = cross(a, b), d = dot(a, x);
    if (Math.abs(d) < 1e-12)
        throw Error("Singular normal matrix");
    return [...scale(x, 1 / d), ...scale(y, 1 / d), ...scale(z, 1 / d)];
}
export const ease = k => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
export const linearColor = hex => [1, 3, 5].map(i => { const s = parseInt(hex.slice(i, i + 2), 16) / 255; return s <= .04045 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4); });
export const displayColor = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
export function sphere(radius, segments) {
    const positions = [], normals = [], uvs = [], indices = [];
    for (let y = 0; y <= segments; y++)
        for (let x = 0; x <= segments; x++) {
            const u = x / segments, v = y / segments, p = [-Math.cos(u * Math.PI * 2) * Math.sin(v * Math.PI), Math.cos(v * Math.PI), Math.sin(u * Math.PI * 2) * Math.sin(v * Math.PI)];
            positions.push(...scale(p, radius));
            normals.push(...p);
            uvs.push(u + (y === 0 ? .5 / segments : y === segments ? -.5 / segments : 0), 1 - v);
        }
    for (let y = 0; y < segments; y++)
        for (let x = 0; x < segments; x++) {
            const a = y * (segments + 1) + x + 1, b = a - 1, c = b + segments + 1, d = c + 1;
            if (y !== 0)
                indices.push(a, b, d);
            if (y !== segments - 1)
                indices.push(b, c, d);
        }
    return { positions, normals, uvs, indices };
}
// Quadratic curve sampled by approximate arc length, with a transported frame.
// This implementation is owned by the application; no geometry library is vendored.
export function tube(a, b, c, segments, radius, sides = 6) {
    const point = t => add(add(scale(a, (1 - t) ** 2), scale(b, 2 * (1 - t) * t)), scale(c, t * t));
    const tangent = t => norm(add(scale(sub(b, a), 2 * (1 - t)), scale(sub(c, b), 2 * t)));
    const lengths = [0];
    let previous = point(0);
    for (let i = 1; i <= 200; i++) {
        const p = point(i / 200);
        lengths.push(lengths[i - 1] + length(sub(p, previous)));
        previous = p;
    }
    const parameter = u => { const target = u * lengths[200]; let low = 0, high = 200; while (low <= high) {
        const mid = (low + high) >> 1;
        if (lengths[mid] < target)
            low = mid + 1;
        else
            high = mid - 1;
    } if (low === 0)
        return 0; if (low === 201)
        return 1; return (low - 1 + (target - lengths[low - 1]) / (lengths[low] - lengths[low - 1])) / 200; };
    const ts = Array.from({ length: segments + 1 }, (_, i) => parameter(i / segments));
    const tangents = ts.map(tangent), normal = [], binormal = [];
    const t0 = tangents[0];
    let axis = 0;
    for (let i = 1; i < 3; i++)
        if (Math.abs(t0[i]) <= Math.abs(t0[axis]))
            axis = i;
    const seed = [0, 0, 0];
    seed[axis] = 1;
    normal[0] = cross(t0, norm(cross(t0, seed)));
    binormal[0] = cross(t0, normal[0]);
    for (let i = 1; i <= segments; i++) {
        const v = cross(tangents[i - 1], tangents[i]), s = length(v), cos = Math.max(-1, Math.min(1, dot(tangents[i - 1], tangents[i])));
        if (s > Number.EPSILON) {
            const axis = scale(v, 1 / s), n = normal[i - 1];
            normal[i] = add(add(scale(n, cos), scale(cross(axis, n), s)), scale(axis, dot(axis, n) * (1 - cos)));
        }
        else
            normal[i] = normal[i - 1].slice();
        binormal[i] = cross(tangents[i], normal[i]);
    }
    const positions = [], normals = [], uvs = [], indices = [];
    for (let i = 0; i <= segments; i++)
        for (let j = 0; j <= sides; j++) {
            const angle = j / sides * Math.PI * 2, n = norm(add(scale(normal[i], -Math.cos(angle)), scale(binormal[i], Math.sin(angle))));
            positions.push(...add(point(ts[i]), scale(n, radius)));
            normals.push(...n);
            uvs.push(i / segments, j / sides);
        }
    for (let j = 1; j <= segments; j++)
        for (let i = 1; i <= sides; i++) {
            const a = (sides + 1) * (j - 1) + i - 1, b = (sides + 1) * j + i - 1, c = b + 1, d = a + 1;
            indices.push(a, b, d, b, c, d);
        }
    return { positions, normals, uvs, indices };
}
