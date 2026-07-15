// merkle.mjs — Merkle-DAG plan graph: spec/effective hashing, topo-sort, plan I/O, mutation cascade.
import { writeFileSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { canonicalize, sha256hex } from "./vendor.mjs";
import { deriveObligationRef, deriveTestRef, normalizeVerifies } from "./obligation.mjs";

const H = (s) => "sha256:" + sha256hex(s);

// Validate obligation records against the plan nodes. Fail-closed: any inconsistency is a
// compile/recompute error (surfaces as PLAN_INVALID in ledger-gate). See obligation.mjs.
function validateObligations(planNodes, obligations) {
  const errs = [];
  const nodeById = new Map(planNodes.map((n) => [n.id, n]));
  for (const n of planNodes) {
    const v = n.test && n.test.verifies;
    if (v === undefined) continue;
    if (!Array.isArray(v)) { errs.push({ code: "UnsortedVerifies", node: n.id }); continue; }
    const norm = normalizeVerifies(v);
    if (v.length !== norm.length || v.some((x, i) => x !== norm[i])) errs.push({ code: "UnsortedVerifies", node: n.id });
  }
  for (const ob of obligations) {
    const node = nodeById.get(ob.discharge_node_id);
    if (!node) { errs.push({ code: "UnknownDischargeNode", id: ob.discharge_node_id, obligation_id: ob.obligation_id }); continue; }
    let ref;
    try { ref = deriveObligationRef(ob); } catch (e) { errs.push({ code: "ObligationRefMismatch", detail: e.message, obligation_id: ob.obligation_id }); continue; }
    if (ref !== ob.obligation_ref) { errs.push({ code: "ObligationRefMismatch", obligation_id: ob.obligation_id }); continue; }
    if (!node.test || deriveTestRef(node.test) !== ob.discharge_test_ref) { errs.push({ code: "TestRefMismatch", obligation_id: ob.obligation_id }); continue; }
    if (!(node.test.verifies || []).includes(ref)) errs.push({ code: "ObligationNotRegistered", obligation_id: ob.obligation_id });
  }
  return errs;
}

// Validate + normalize lifecycle metadata (proposal_id + node lineages). Returns
// { lifecycle, errors }: node_lineages must cover every node with unique refs.
function normalizeLifecycle(planNodes, lifecycle) {
  if (!lifecycle) return { lifecycle: null, errors: [] };
  const errs = [];
  if (!Array.isArray(lifecycle.node_lineages)) return { lifecycle: null, errors: [{ code: "BadLifecycle", detail: "node_lineages must be an array" }] };
  const nodeIds = new Set(planNodes.map((n) => n.id));
  const seenRef = new Set();
  const covered = new Set();
  for (const e of lifecycle.node_lineages) {
    if (!e || !nodeIds.has(e.node_id)) { errs.push({ code: "UnknownLineageNode", node_id: e && e.node_id }); continue; }
    if (typeof e.node_lineage_ref !== "string" || !e.node_lineage_ref) { errs.push({ code: "BadLifecycle", node_id: e.node_id }); continue; }
    if (seenRef.has(e.node_lineage_ref)) { errs.push({ code: "DuplicateLineageRef", node_lineage_ref: e.node_lineage_ref }); continue; }
    seenRef.add(e.node_lineage_ref); covered.add(e.node_id);
  }
  for (const id of nodeIds) if (!covered.has(id)) errs.push({ code: "IncompleteLineage", node_id: id });
  if (errs.length) return { lifecycle: null, errors: errs };
  const node_lineages = [...lifecycle.node_lineages]
    .map((e) => ({ node_id: e.node_id, node_lineage_ref: e.node_lineage_ref }))
    .sort((a, b) => (a.node_id < b.node_id ? -1 : a.node_id > b.node_id ? 1 : 0));
  return { lifecycle: { contract_ref: lifecycle.contract_ref ?? null, proposal_id: lifecycle.proposal_id ?? null, predecessor_plan_hash: lifecycle.predecessor_plan_hash ?? null, node_lineages }, errors: [] };
}

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

  // Obligations + lifecycle: validate against the nodes (fail-closed), then bind into plan_hash
  // via a CONDITIONAL preimage so obligation-free / lifecycle-free plans stay byte-identical.
  const obligations = [...(opts.obligations || [])].sort((a, b) => (a.obligation_ref < b.obligation_ref ? -1 : a.obligation_ref > b.obligation_ref ? 1 : 0));
  const obErrors = validateObligations(planNodes, obligations);
  if (obErrors.length) return { errors: obErrors };
  const { lifecycle, errors: lcErrors } = normalizeLifecycle(planNodes, opts.lifecycle);
  if (lcErrors.length) return { errors: lcErrors };

  const signerPairs = Object.keys(authorized_signers).sort().map((k) => [k, authorized_signers[k]]);
  const pairs = planNodes.map((n) => [n.id, n.effective_hash]).sort();
  const hasExt = obligations.length > 0 || lifecycle != null;
  const plan_hash = H(canonicalize(hasExt
    ? { pairs, signers: signerPairs, obligations, lifecycle }
    : { pairs, signers: signerPairs }));
  return {
    plan: {
      telos_plan_version: 1, algo: "sha256", canonicalization: "telos-canonical-v1",
      plan_hash, topo_order: sorted.order, keyring_ref: ".telos/keys",
      authorized_signers,
      meta: { revision: 1, prev_plan_root: null, mutated_nodes: [], reason_ref: null },
      obligations, lifecycle,
      nodes: planNodes
    },
    warnings
  };
}

// Recompute hashes from a plan's node specs (ledger-gate uses this — never trusts stored hashes).
// Obligations + lifecycle are passed through so tampering either changes the recomputed plan_hash
// (PLAN_TAMPERED) or fails validation (PLAN_INVALID).
export function recompute(plan) {
  return computePlan(plan.nodes.map((n) => ({
    id: n.id, files: n.files, requirements: n.requirements, test: n.test, dependencies: n.dependencies
  })), { authorizedSigners: plan.authorized_signers || {}, obligations: plan.obligations || [], lifecycle: plan.lifecycle || null });
}

// mutateNode: NEW plan with node's spec replaced + cascade; bumps revision; returns a history event.
export function mutateNode(plan, nodeId, newSpec, reasonRef = null) {
  if (!plan.nodes.some((n) => n.id === nodeId)) return { errors: [{ code: "UnknownNode", id: nodeId }] };
  const defs = plan.nodes.map((n) => n.id === nodeId
    ? { id: n.id, files: newSpec.files ?? n.files, requirements: newSpec.requirements ?? n.requirements, test: newSpec.test ?? n.test, dependencies: n.dependencies }
    : { id: n.id, files: n.files, requirements: n.requirements, test: n.test, dependencies: n.dependencies });
  const res = computePlan(defs, { authorizedSigners: plan.authorized_signers || {}, obligations: plan.obligations || [], lifecycle: plan.lifecycle || null });
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
