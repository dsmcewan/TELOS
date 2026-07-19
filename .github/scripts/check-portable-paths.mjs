#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const RESERVED_WINDOWS_BASENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const INVALID_WINDOWS_CHAR = /[<>:"\\|?*\u0000-\u001f]/;

export function windowsPathViolation(repositoryPath) {
  if (typeof repositoryPath !== "string" || repositoryPath.length === 0) {
    return "path must be a non-empty string";
  }

  for (const component of repositoryPath.split("/")) {
    if (component.length === 0) return "empty path component";
    if (INVALID_WINDOWS_CHAR.test(component)) return `invalid Windows character in component ${JSON.stringify(component)}`;
    if (/[. ]$/.test(component)) return `component ends in a dot or space: ${JSON.stringify(component)}`;
    if (RESERVED_WINDOWS_BASENAME.test(component)) return `reserved Windows device name: ${JSON.stringify(component)}`;
  }
  return null;
}

export function windowsCaseCollisionViolations(repositoryPaths) {
  const groups = new Map();
  for (const repositoryPath of repositoryPaths) {
    if (typeof repositoryPath !== "string") continue;
    const folded = repositoryPath.normalize("NFC").toLowerCase();
    if (!groups.has(folded)) groups.set(folded, new Set());
    groups.get(folded).add(repositoryPath);
  }

  const violations = [];
  for (const paths of groups.values()) {
    if (paths.size < 2) continue;
    const colliding = [...paths].sort();
    for (const repositoryPath of colliding) {
      const others = colliding.filter((candidate) => candidate !== repositoryPath);
      violations.push({
        repositoryPath,
        reason: `case-insensitive collision with ${others.map((candidate) => JSON.stringify(candidate)).join(", ")}`,
      });
    }
  }
  return violations.sort((a, b) =>
    a.repositoryPath.localeCompare(b.repositoryPath) || a.reason.localeCompare(b.reason));
}

// Keep the oracle itself honest before applying it to the repository.
assert.equal(windowsPathViolation("narcissus/flagship/src/App.tsx"), null);
assert.match(windowsPathViolation("narcissus/flagship/C:\\Users\\profile") || "", /invalid Windows character/);
assert.match(windowsPathViolation("docs/CON.txt") || "", /reserved Windows device name/);
assert.match(windowsPathViolation("docs/trailing.") || "", /ends in a dot or space/);
assert.equal(
  windowsCaseCollisionViolations(["docs/Foo.md", "docs/foo.md"]).length,
  2,
  "both members of a case-insensitive checkout collision must be reported",
);

const listed = spawnSync("git", ["ls-files", "-z"], {
  cwd: new URL("../..", import.meta.url),
  encoding: "utf8",
  shell: false,
});
if (listed.error || listed.status !== 0) {
  console.error(`portable-paths: cannot enumerate tracked files: ${listed.error?.message || listed.stderr || `git exit ${listed.status}`}`);
  process.exit(2);
}

const repositoryPaths = listed.stdout.split("\0").filter(Boolean);
const violations = [
  ...repositoryPaths
  .map((repositoryPath) => ({ repositoryPath, reason: windowsPathViolation(repositoryPath) }))
  .filter(({ reason }) => reason !== null),
  ...windowsCaseCollisionViolations(repositoryPaths),
];

for (const { repositoryPath, reason } of violations) {
  console.error(`portable-paths: ${repositoryPath}: ${reason}`);
}
console.log(`portable-paths: ${violations.length} violation(s)`);
process.exit(violations.length === 0 ? 0 : 1);
