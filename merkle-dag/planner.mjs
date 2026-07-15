// planner.mjs — auto-fragmentation compiler. Declared {writes,reads} footprints -> dependency
// graph (write-write serial + read-after-write edges; convergence is native multi-parent) ->
// delegate to merkle.computePlan (hashing, topo-sort, cycle detection, signer pinning).
// An optional import-scan ADVISES on likely-undeclared read coupling; it never adds edges.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { computePlan, specHash } from "./merkle.mjs";
import { canonicalize, sha256hex } from "./vendor.mjs";
import { attachObligations } from "./obligation.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));

/**
 * Assign node-lineage identities (decision 2): a surviving node (same id) carries its
 * predecessor's node_lineage_ref; a node new to this revision gets an origin address
 * H({proposal_id, initial_node_id, initial_spec_hash}). Lineage is stable across revisions
 * so a concern's carry-forward never depends on a mutable effective_hash.
 * @param defs [{ id, files, requirements, test, dependencies }]
 * @returns { node_lineages:[{ node_id, node_lineage_ref }] }
 */
export function assignNodeLineages(defs, { proposalId, predecessorPlan = null } = {}) {
  const prev = new Map();
  if (predecessorPlan && predecessorPlan.lifecycle) {
    for (const e of predecessorPlan.lifecycle.node_lineages || []) prev.set(e.node_id, e.node_lineage_ref);
  }
  const node_lineages = defs.map((d) => {
    if (prev.has(d.id)) return { node_id: d.id, node_lineage_ref: prev.get(d.id) };
    const initial_spec_hash = specHash({ files: d.files, requirements: d.requirements, test: d.test });
    return { node_id: d.id, node_lineage_ref: H({ proposal_id: proposalId, initial_node_id: d.id, initial_spec_hash }) };
  });
  return { node_lineages };
}

/**
 * @param tasks [{ id, writes:[file], reads:[file], requirements, test:{cmd,args,cwd?,verifies?}, baseDependencies?:[id] }]
 * @param authorizedSigners { key_id: jwk }   (pinned into plan_hash by computePlan)
 * @param repoRoot absolute path used to normalize all footprints to one relative key space
 * @param obligations optional [{ obligation_id, concern_ref, required_result, check_contract_ref, discharge_node_id }]
 * @param lifecycle optional { contract_ref, proposal_id, predecessor_plan_hash, node_lineages }
 * @returns { plan, warnings, advisories } | { errors, advisories }   (advisories = string[])
 */
export function compileAndHashPlan({ tasks, authorizedSigners, repoRoot, strict, obligations, lifecycle }) {
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

  // Attach verification obligations (registers obligation_ref into each discharge node's
  // test.verifies, then computes discharge_test_ref from the final test) before hashing.
  let planDefs = defs;
  let computedObligations = [];
  if (obligations && obligations.length) {
    const att = attachObligations(defs, obligations);
    if (att.errors) return { errors: att.errors, advisories };
    planDefs = att.defs;
    computedObligations = att.obligations;
  }

  const res = computePlan(planDefs, { authorizedSigners, obligations: computedObligations, lifecycle }); // { plan, warnings } | { errors }
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
