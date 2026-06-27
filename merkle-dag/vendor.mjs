// vendor.mjs — helpers vendored so merkle-dag stands alone (no dependency on the
// unmerged Phase 1/2 ENGINE.patch).
//   canonicalize  <- me/codex/build-gate/sign.mjs  (sorted-KEYS JSON; preserves ARRAY order)
//   resolveUnder  <- me/codex/breakout/verifier.mjs (path confinement)
//   maxConcurrency <- concurrency governance (relocated from council.mjs)
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

// Recursively sorts OBJECT KEYS; ARRAY ORDER IS PRESERVED — callers must pre-sort
// any array whose order is not semantically meaningful (e.g. file lists, parent
// hash lists) before passing it in.
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, k) => { acc[k] = sortValue(value[k]); return acc; }, {});
  }
  return value;
}

export function canonicalize(obj) {
  return JSON.stringify(sortValue(obj));
}

// Raw hex sha256. Accepts a string or Buffer. Callers prefix "sha256:" where stored.
export function sha256hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Clamp a concurrency hint to [1, max(1, cpuCount - 2)].
 * If hint is falsy (undefined / null / 0 / negative), defaults to the upper bound.
 * Ensures the returned value is at least 1 regardless of core count.
 *
 * @param {number|undefined|null} hint  caller-supplied concurrency target
 * @returns {number}                    clamped worker count
 */
export function maxConcurrency(hint) {
  const cores = os.cpus().length;
  const upper = Math.max(1, cores - 2);
  if (hint == null || hint < 1) return upper;
  return Math.max(1, Math.min(Math.floor(hint), upper));
}

// Resolve p under baseDir; return null if it escapes (`..`/absolute). Confinement.
export function resolveUnder(baseDir, p) {
  if (typeof p !== "string" || !p) return null;
  const resolved = path.resolve(baseDir, p);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}
