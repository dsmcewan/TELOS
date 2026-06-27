// merkle.mjs — Merkle-DAG plan graph: spec/effective hashing, topo-sort, plan I/O, mutation cascade.
import { writeFileSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { canonicalize, sha256hex } from "./vendor.mjs";

const H = (s) => "sha256:" + sha256hex(s);

// Spec-Hash: files PRE-SORTED (set semantics); requirements + test hashed as authored.
export function specHash(node) {
  return H(canonicalize({ files: [...(node.files || [])].sort(), requirements: node.requirements, test: node.test }));
}

// Effective-Hash: binds spec_hash + the SORTED+DEDUPED parent effective-hashes.
export function effectiveHash(node, effByID) {
  const parents = [...new Set(node.dependencies || [])].map((id) => effByID[id]).sort();
  return H(canonicalize({ spec_hash: node.spec_hash, parent_effective_hashes: parents }));
}

// Kahn topo-sort + validation. Returns { order } or { error }.
export function topoSort(nodes) {
  const byId = new Map();
  for (const n of nodes) {
    if (byId.has(n.id)) return { error: { code: "DuplicateTaskId", id: n.id } };
    byId.set(n.id, n);
  }
  for (const n of nodes) for (const d of n.dependencies || []) {
    if (!byId.has(d)) return { error: { code: "UnknownDependency", id: n.id, dep: d } };
  }
  const indeg = new Map(nodes.map((n) => [n.id, 0]));
  const children = new Map(nodes.map((n) => [n.id, []]));
  for (const n of nodes) for (const d of new Set(n.dependencies || [])) {
    indeg.set(n.id, indeg.get(n.id) + 1);
    children.get(d).push(n.id);
  }
  const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id).sort();
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const c of [...children.get(id)].sort()) {
      indeg.set(c, indeg.get(c) - 1);
      if (indeg.get(c) === 0) { queue.push(c); queue.sort(); }
    }
  }
  if (order.length !== nodes.length) {
    return { error: { code: "Cycle", nodes: nodes.filter((n) => indeg.get(n.id) > 0).map((n) => n.id) } };
  }
  return { order };
}

// computePlan: validate -> topo-sort -> hash in order. Returns { plan, warnings } or { errors }.
export function computePlan(taskDefs, opts = {}) {
  const authorized_signers = (opts.authorizedSigners && typeof opts.authorizedSigners === "object") ? opts.authorizedSigners : {};
  const nodes = taskDefs.map((t) => ({
    id: t.id, files: [...(t.files || [])].sort(), requirements: t.requirements,
    test: t.test, dependencies: [...(t.dependencies || [])]
  }));
  const sorted = topoSort(nodes);
  if (sorted.error) return { errors: [sorted.error] };
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const warnings = [];
  const owner = new Map();
  for (const n of nodes) for (const f of n.files) {
    if (owner.has(f)) warnings.push(`overlapping output: ${f} in ${owner.get(f)},${n.id}`);
    else owner.set(f, n.id);
  }
  const effByID = {};
  for (const id of sorted.order) {
    const n = byId.get(id);
    n.spec_hash = specHash(n);
    n.effective_hash = effectiveHash(n, effByID);
    effByID[id] = n.effective_hash;
  }
  const planNodes = sorted.order.map((id) => byId.get(id));
  const signerPairs = Object.keys(authorized_signers).sort().map((k) => [k, authorized_signers[k]]);
  const plan_hash = H(canonicalize({ pairs: planNodes.map((n) => [n.id, n.effective_hash]).sort(), signers: signerPairs }));
  return {
    plan: {
      telos_plan_version: 1, algo: "sha256", canonicalization: "telos-canonical-v1",
      plan_hash, topo_order: sorted.order, keyring_ref: ".telos/keys",
      authorized_signers,
      meta: { revision: 1, prev_plan_root: null, mutated_nodes: [], reason_ref: null },
      nodes: planNodes
    },
    warnings
  };
}

// Recompute hashes from a plan's node specs (ledger-gate uses this — never trusts stored hashes).
export function recompute(plan) {
  return computePlan(plan.nodes.map((n) => ({
    id: n.id, files: n.files, requirements: n.requirements, test: n.test, dependencies: n.dependencies
  })), { authorizedSigners: plan.authorized_signers || {} });
}

// mutateNode: NEW plan with node's spec replaced + cascade; bumps revision; returns a history event.
export function mutateNode(plan, nodeId, newSpec, reasonRef = null) {
  if (!plan.nodes.some((n) => n.id === nodeId)) return { errors: [{ code: "UnknownNode", id: nodeId }] };
  const defs = plan.nodes.map((n) => n.id === nodeId
    ? { id: n.id, files: newSpec.files ?? n.files, requirements: newSpec.requirements ?? n.requirements, test: newSpec.test ?? n.test, dependencies: n.dependencies }
    : { id: n.id, files: n.files, requirements: n.requirements, test: n.test, dependencies: n.dependencies });
  const res = computePlan(defs, { authorizedSigners: plan.authorized_signers || {} });
  if (res.errors) return res;
  const prev = new Map(plan.nodes.map((n) => [n.id, n.effective_hash]));
  const mutated = res.plan.nodes.filter((n) => prev.get(n.id) !== n.effective_hash)
    .map((n) => ({ id: n.id, prev_effective_hash: prev.get(n.id), new_effective_hash: n.effective_hash }));
  res.plan.meta = { revision: (plan.meta?.revision || 1) + 1, prev_plan_root: plan.plan_hash, mutated_nodes: mutated, reason_ref: reasonRef };
  return { plan: res.plan, warnings: res.warnings, historyEvent: { revision: res.plan.meta.revision, prev_plan_root: plan.plan_hash, plan_hash: res.plan.plan_hash, mutated, reason_ref: reasonRef } };
}

// I/O — "immutable" = never edit in place: keep every version + byte-copy the head.
export function writePlan(telosDir, plan) {
  mkdirSync(path.join(telosDir, "plans"), { recursive: true });
  const body = JSON.stringify(plan, null, 2);
  writeFileSync(path.join(telosDir, "plans", plan.plan_hash.replace(/[:]/g, "_") + ".json"), body);
  writeFileSync(path.join(telosDir, "plan.json"), body);
}
export function readPlan(telosDir) { return JSON.parse(readFileSync(path.join(telosDir, "plan.json"), "utf8")); }
export function appendPlanHistory(telosDir, event) {
  appendFileSync(path.join(telosDir, "plan-history.jsonl"), JSON.stringify(event) + "\n");
}
