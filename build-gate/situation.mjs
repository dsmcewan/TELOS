// situation.mjs — PROJECT SENSE for the autonomous builder.
//
// Before a build, TELOS reads the real baseDir to understand the project it is
// about to modify: greenfield vs brownfield, which write targets already exist
// (collisions), the project's real test command, and which protected paths are
// present on disk. This is a pure, read-only sense — it mutates nothing, never
// throws on missing/garbled files (it records facts, like artifact.mjs), and adds
// NO new blocker: collisions are advisory (Rule 3 still re-derives every artifact;
// the gate's validateProtectedPaths is still the authority on protected writes).
//
// It reuses the substrate's own read+hash primitive so "does this file exist on
// disk" is answered exactly the way Rule-3 verify answers it.

import { existsSync, readFileSync } from "node:fs";
import { computeDiskTreeHash } from "../merkle-dag/artifact.mjs";
import { resolveUnder } from "../merkle-dag/vendor.mjs";
import { DEFAULT_PROTECTED_PATHS } from "./gate.mjs";

function asArray(v) { return Array.isArray(v) ? v : []; }
function unique(list) { return [...new Set(list)]; }

// Every relative path the build will touch: dossier.write_targets UNION every
// task's `writes`. Deduped + sorted (deterministic). Pure.
export function collectWriteTargets({ dossier, tasks }) {
  const targets = [
    ...asArray(dossier?.write_targets),
    ...asArray(tasks).flatMap((t) => asArray(t?.writes))
  ].filter((p) => typeof p === "string" && p.length > 0);
  return unique(targets).sort();
}

// Read baseDir/package.json (confined via resolveUnder) and detect conventions.
// Never throws: absent/malformed JSON => nulls. `testCmd` is the literal
// scripts.test string (or null) so the Planning team can prefer the real runner.
export function detectConventions({ baseDir }) {
  const empty = { hasPackageJson: false, type: null, testCmd: null, scripts: {} };
  const resolved = resolveUnder(baseDir, "package.json");
  if (!resolved || !existsSync(resolved)) return empty;
  let pkg;
  try { pkg = JSON.parse(readFileSync(resolved, "utf8")); } catch { return { ...empty, hasPackageJson: true }; }
  const scripts = pkg && typeof pkg.scripts === "object" && pkg.scripts ? pkg.scripts : {};
  return {
    hasPackageJson: true,
    type: typeof pkg?.type === "string" ? pkg.type : null,
    testCmd: typeof scripts.test === "string" ? scripts.test : null,
    scripts
  };
}

// Which protected prefixes (gate defaults UNION dossier.protected_paths, mirroring
// gate.mjs's union) actually exist on disk under baseDir. Confined; never throws.
export function detectProtectedOnDisk({ baseDir, dossier }) {
  const prefixes = unique([...DEFAULT_PROTECTED_PATHS, ...asArray(dossier?.protected_paths)]);
  const present = [];
  for (const p of prefixes) {
    const resolved = resolveUnder(baseDir, p);
    if (resolved && existsSync(resolved)) present.push(p);
  }
  return present;
}

/**
 * The public entry point: a read-only situational report for a build. Pure;
 * never throws; creates nothing.
 *   -> { mode, collisions, conventions, protectedOnDisk, advisories }
 *      mode            "greenfield" | "brownfield"
 *      collisions      write targets already PRESENT on disk [{path,filehash,status}]
 *      conventions     detectConventions(...)
 *      protectedOnDisk string[]
 *      advisories      human-readable strings
 */
export function senseProject({ baseDir, dossier, tasks }) {
  const targets = collectWriteTargets({ dossier, tasks });
  const disk = computeDiskTreeHash(targets, baseDir);            // reuse Rule-3's read+hash
  const collisions = disk.files.filter((f) => f.status === "present");
  const escapes = disk.files.filter((f) => f.status === "escape");
  const conventions = detectConventions({ baseDir });
  const protectedOnDisk = detectProtectedOnDisk({ baseDir, dossier });

  const mode = (collisions.length > 0 || conventions.hasPackageJson || protectedOnDisk.length > 0)
    ? "brownfield"
    : "greenfield";

  const advisories = [];
  if (collisions.length > 0) {
    advisories.push(`brownfield: ${collisions.length} of ${targets.length} write target(s) already exist on disk`);
    for (const c of collisions) advisories.push(`collision: ${c.path} already exists (${c.filehash})`);
  }
  for (const e of escapes) advisories.push(`write target escapes baseDir and will be rejected: ${e.path}`);
  advisories.push(conventions.testCmd
    ? `detected test command: "${conventions.testCmd}" (package.json scripts.test)`
    : "no package.json test script detected; nodes must declare their own test");
  for (const p of protectedOnDisk) advisories.push(`protected path present on disk: ${p} — the builder must not write under it`);

  return { mode, collisions, conventions, protectedOnDisk, advisories };
}
