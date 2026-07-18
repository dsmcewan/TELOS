// Test-mode determinism. `?e2e=1` freezes RNG (seeded PRNG) and pins motion so the surface is reproducible
// under a deterministic E2E run, while staying alive in production.
export function isE2E(): boolean {
  if (typeof location === "undefined") return false;
  return new URLSearchParams(location.search).get("e2e") === "1";
}

// mulberry32 — a small seeded PRNG. In e2e mode every "random" value is reproducible.
let _seed = 0x9e3779b9 >>> 0;
export function resetSeed(s = 0x9e3779b9): void {
  _seed = s >>> 0;
}
export function seededRandom(): number {
  _seed = (_seed + 0x6d2b79f5) >>> 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function rand(): number {
  return isE2E() ? seededRandom() : Math.random();
}

// Fixed physics timestep under e2e (no spring/settle drift).
export const FIXED_DT = 1 / 60;
