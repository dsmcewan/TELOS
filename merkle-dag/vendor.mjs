// vendor.mjs — helpers vendored so merkle-dag stands alone (no dependency on the
// unmerged Phase 1/2 ENGINE.patch).
//   canonicalize  <- me/codex/build-gate/sign.mjs  (sorted-KEYS JSON; preserves ARRAY order)
//   resolveUnder  <- me/codex/breakout/verifier.mjs (path confinement)
//   maxConcurrency <- concurrency governance (relocated from council.mjs)
import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Recursively sorts OBJECT KEYS; ARRAY ORDER IS PRESERVED — callers must pre-sort
// any array whose order is not semantically meaningful (e.g. file lists, parent
// hash lists) before passing it in.
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const sorted = Object.create(null);
    for (const k of Object.keys(value).sort()) sorted[k] = sortValue(value[k]);
    return sorted;
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

function isPathUnder(base, candidate) {
  const rel = path.relative(base, candidate);
  return rel === "" || (!path.isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${path.sep}`));
}

// Resolve p under baseDir with physical confinement. Every existing component
// from baseDir downward is lstat-checked in the caller's original component
// order, before normalization can erase a symlink followed by "..". Missing
// components (including a final file that a worker will create) are allowed
// beneath safe existing parents. Any ambiguity or filesystem error fails closed.
export function resolveUnder(baseDir, p) {
  if (typeof baseDir !== "string" || !baseDir || typeof p !== "string" || !p) return null;
  if (path.isAbsolute(p) || path.parse(p).root !== "") return null;

  let base;
  let baseReal;
  try {
    base = path.resolve(baseDir);
    const baseStat = lstatSync(base);
    if (!baseStat.isDirectory() || baseStat.isSymbolicLink()) return null;
    baseReal = (realpathSync.native || realpathSync)(base);
  } catch {
    return null;
  }

  const original = process.platform === "win32" ? p.replaceAll("/", path.sep) : p;
  let cursor = base;
  for (const component of original.split(path.sep)) {
    if (component === "" || component === ".") continue;
    if (component === "..") {
      cursor = path.dirname(cursor);
      continue;
    }
    cursor = path.join(cursor, component);
    try {
      const stat = lstatSync(cursor);
      if (stat.isSymbolicLink()) return null;
      const real = (realpathSync.native || realpathSync)(cursor);
      if (!isPathUnder(baseReal, real)) return null;
    } catch (error) {
      if (error?.code !== "ENOENT") return null;
    }
  }

  const resolved = path.resolve(base, p);
  if (!isPathUnder(base, resolved)) return null;
  return resolved;
}

// True when `cmd` resolves to a Windows batch shim (.cmd/.bat — npm, npx, yarn).
// Node cannot spawn a batch file directly since the CVE-2024-27980 hardening, so
// such commands must go through cmd.exe; a real executable (.exe/.com, e.g. node)
// must NOT, so its args pass literally rather than being re-parsed by a shell.
// Always false off win32 (POSIX spawns npm's shebang script directly).
function isWin32BatchShim(cmd) {
  if (process.platform !== "win32" || typeof cmd !== "string" || !cmd) return false;
  const isBatch = (name) => /\.(cmd|bat)$/i.test(name);
  if (path.extname(cmd)) return isBatch(cmd);            // explicit extension: trust it
  if (cmd.includes("/") || cmd.includes("\\")) {          // explicit path, no extension
    return existsSync(cmd + ".cmd") || existsSync(cmd + ".bat");
  }
  const exts = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  for (const dir of (process.env.PATH || "").split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      if (existsSync(path.join(dir, cmd + ext))) return isBatch(ext); // first PATHEXT match wins
    }
  }
  return false;                                           // not found: spawn directly (ENOENT, fail-closed)
}

// Normalize a { cmd, args } test command into a spawn-ready { command, args } that
// works cross-platform WITHOUT `shell: true` (which is deprecated and mangles args
// like `-e "a; b"`). On win32 a batch shim is routed through `cmd.exe /d /s /c`;
// everything else — and all of POSIX — is passed through unchanged so args stay
// literal. Use for both spawn and spawnSync.
export function spawnCommand(cmd, args = []) {
  if (isWin32BatchShim(cmd)) {
    return { command: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", cmd, ...args] };
  }
  return { command: cmd, args };
}
