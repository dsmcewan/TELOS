// planner.mjs — auto-fragmentation compiler. Declared {writes,reads} footprints -> dependency
// graph (write-write serial + read-after-write edges; convergence is native multi-parent) ->
// delegate to merkle.computePlan (hashing, topo-sort, cycle detection, signer pinning).
// An optional import-scan ADVISES on likely-undeclared read coupling; it never adds edges.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { computePlan } from "./merkle.mjs";

/**
 * @param tasks [{ id, writes:[file], reads:[file], requirements, test:{cmd,args,cwd?}, baseDependencies?:[id] }]
 * @param authorizedSigners { key_id: jwk }   (pinned into plan_hash by computePlan)
 * @param repoRoot absolute path used to normalize all footprints to one relative key space
 * @returns { plan, warnings, advisories } | { errors, advisories }   (advisories = string[])
 */
export function compileAndHashPlan({ tasks, authorizedSigners, repoRoot, strict }) {
  const norm = (p) => path.relative(repoRoot, path.resolve(repoRoot, p));
  const fileWriters = new Map(); // relPath -> [taskId] (declaration order)
  for (const t of tasks) for (const f of t.writes || []) {
    const r = norm(f); if (!fileWriters.has(r)) fileWriters.set(r, []); fileWriters.get(r).push(t.id);
  }

  // Detect write-write conflicts and build advisories (prepended so they're prominent).
  const conflicts = [];
  for (const [relPath, writers] of fileWriters) {
    if (writers.length > 1) conflicts.push({ file: relPath, tasks: writers });
  }
  const conflictAdvisories = conflicts.map(({ file, tasks }) =>
    `write-write conflict on "${file}" (tasks ${tasks.join(",")}): only the LAST writer can pass ledger-gate (earlier writers' artifacts drift to ARTIFACT_MISMATCH). Prefer one writer per file.`
  );

  // Strict mode: hard-reject when any write-write conflict exists, without calling computePlan.
  if (strict && conflicts.length > 0) {
    const errors = conflicts.map(({ file, tasks }) => ({ code: "WriteWriteConflict", file, tasks }));
    return { errors, advisories: conflictAdvisories };
  }

  const defs = tasks.map((t) => {
    const deps = new Set(t.baseDependencies || []);
    // Rule A — write-write collision: serial chain in declaration order.
    for (const f of t.writes || []) {
      const writers = fileWriters.get(norm(f)) || [];
      if (writers.length > 1) { const i = writers.indexOf(t.id); if (i > 0) deps.add(writers[i - 1]); }
    }
    // Rule B — read-after-write: depend on every (other) writer of a file this task reads.
    for (const f of t.reads || []) {
      for (const w of fileWriters.get(norm(f)) || []) if (w !== t.id) deps.add(w);
    }
    return { id: t.id, files: t.writes || [], requirements: t.requirements, test: t.test, dependencies: [...deps] };
  });

  const scanAdvisories = advisoryScan({ tasks, fileWriters, norm, repoRoot });
  const advisories = [...conflictAdvisories, ...scanAdvisories]; // conflict advisories prepended
  const res = computePlan(defs, { authorizedSigners }); // { plan, warnings } | { errors }
  return { ...res, advisories };
}

// Advisory only: warn when a task's WRITE target statically imports a file another task WRITES,
// but the task didn't DECLARE that read. Returns strings; never mutates the graph. (Best-effort
// regex — misses dynamic import()/re-exports; over-matches are acceptable for an advisory.)
function advisoryScan({ tasks, fileWriters, norm, repoRoot }) {
  const out = [];
  const importRe = /import\s+[^'"]*\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const t of tasks) {
    const declaredReads = new Set((t.reads || []).map(norm));
    for (const f of t.writes || []) {
      const abs = path.resolve(repoRoot, f);
      if (!existsSync(abs)) continue;
      let src; try { src = readFileSync(abs, "utf8"); } catch { continue; }
      let m;
      while ((m = importRe.exec(src)) !== null) {
        const spec = m[1] || m[2];
        if (!spec || !spec.startsWith(".")) continue;
        const rel = norm(path.resolve(path.dirname(abs), spec));
        if (!fileWriters.has(rel) || declaredReads.has(rel)) continue;
        for (const w of fileWriters.get(rel)) {
          if (w !== t.id) out.push(`task "${t.id}" writes "${norm(f)}" which imports "${rel}" (mutated by task "${w}") but does not declare it as a read`);
        }
      }
    }
  }
  return out;
}
