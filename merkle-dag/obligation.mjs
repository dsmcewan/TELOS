// obligation.mjs — verification obligations: content-addressed semantic identity,
// test registration, proposal-gate anchor checks, and the done()-time discharge sweep.
// Pure; depends only on vendor.mjs. Import direction is merkle -> obligation (never the reverse).
//
// An obligation converts a plan-stage concern into a post-build verification duty:
// its identity (`obligation_ref`) is a content address of its SEMANTICS, registered in
// the discharge node's canonical test declaration (`test.verifies`) so that changing
// the semantics mechanically changes the test hash, the node spec_hash, and the plan_hash.
import { canonicalize, sha256hex } from "./vendor.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));

// The four semantic fields, in a fixed key set. discharge_test_ref is DELIBERATELY
// excluded (the test declaration registers obligation_ref, so including it would be circular).
export function deriveObligationRef({ obligation_id, concern_ref, required_result, check_contract_ref }) {
  for (const [k, v] of Object.entries({ obligation_id, concern_ref, required_result, check_contract_ref })) {
    if (typeof v !== "string" || !v) throw new Error(`deriveObligationRef: field '${k}' must be a non-empty string`);
  }
  return H({ obligation_id, concern_ref, required_result, check_contract_ref });
}

// Content address of a node's canonical test declaration (cmd/args/cwd?/verifies?).
// The controller — never the model — computes this from the FINAL test object.
export function deriveTestRef(test) {
  return H(test);
}

// Content address of ONLY the execution-determining subset of a node's test —
// {cmd, args, cwd}, EXCLUDING `verifies`. Used by the proposal gate to bind a
// controller-minted verification node's executable to the concern's check_contract
// (via the check-registry): deriveExecutableRef(node.test) must equal
// deriveExecutableRef(registry.resolve(kind, params)). deriveTestRef canNOT serve
// this purpose — attachObligations injects `verifies` into the node's test, so the
// node's deriveTestRef never equals the bare registry spec's. `cwd` IS included
// (execution-affecting: ledger-gate runs the test in `t.cwd || "."`); the `|| "."`
// / `|| []` normalization matches that resolution so an omitted field and its
// default hash identically on both sides.
export function deriveExecutableRef(test) {
  return H({ cmd: test.cmd, args: test.args || [], cwd: test.cwd || "." });
}

// Controller-derived, content-addressed identities for the dedicated verification
// node and its obligation, both keyed on the concern's content address. The verify
// NODE id uses the FULL concern_ref hex (no truncation) so two distinct concerns can
// never collide into one DuplicateTaskId. The obligation_id is a human-readable
// label with NO enforcement authority (obligation_ref carries identity and hashes
// the full concern_ref), so a truncated slice is safe.
const stripHash = (ref) => String(ref).replace(/^sha256:/, "");
export function deriveVerifyNodeId(concernRef) {
  return "verify-" + stripHash(concernRef);
}
export function deriveObligationId(concernRef) {
  return "obl-" + stripHash(concernRef).slice(0, 16);
}

// Canonical form of a verifies list: deduped + sorted (canonicalize preserves array order,
// so the ordering must be normalized here, at authoring time, to yield one stable hash).
export function normalizeVerifies(verifies) {
  return [...new Set(verifies || [])].sort();
}

/**
 * Attach obligations to task defs: derive each obligation_ref, register it into its
 * discharge node's test.verifies, then compute discharge_test_ref from the FINAL test.
 *
 * @param taskDefs      [{ id, files, requirements, test:{cmd,args,cwd?,verifies?}, dependencies }]
 * @param obligationDefs [{ obligation_id, concern_ref, required_result, check_contract_ref, discharge_node_id }]
 * @returns { defs, obligations } | { errors:[{code,...}] }
 *   obligations (sorted by obligation_ref): { obligation_id, obligation_ref, concern_ref,
 *     discharge_node_id, discharge_test_ref, check_contract_ref, required_result }
 */
export function attachObligations(taskDefs, obligationDefs) {
  const defs = taskDefs.map((t) => ({
    id: t.id, files: t.files, requirements: t.requirements,
    test: t.test ? { ...t.test } : t.test, dependencies: t.dependencies
  }));
  const byId = new Map(defs.map((d) => [d.id, d]));
  const errors = [];

  const specs = [];        // { def(obligation input), obligation_ref, node }
  const seenRefs = new Set();
  for (const od of obligationDefs || []) {
    for (const k of ["obligation_id", "concern_ref", "required_result", "check_contract_ref", "discharge_node_id"]) {
      if (typeof od?.[k] !== "string" || !od[k]) { errors.push({ code: "BadObligationField", field: k, obligation_id: od?.obligation_id }); }
    }
    if (errors.length) continue;
    let obligation_ref;
    try { obligation_ref = deriveObligationRef(od); } catch (e) { errors.push({ code: "BadObligationField", detail: e.message, obligation_id: od.obligation_id }); continue; }
    if (seenRefs.has(obligation_ref)) { errors.push({ code: "DuplicateObligationRef", obligation_ref, obligation_id: od.obligation_id }); continue; }
    seenRefs.add(obligation_ref);
    const node = byId.get(od.discharge_node_id);
    if (!node) { errors.push({ code: "UnknownDischargeNode", discharge_node_id: od.discharge_node_id, obligation_id: od.obligation_id }); continue; }
    if (!node.test || typeof node.test.cmd !== "string" || !node.test.cmd) { errors.push({ code: "MissingDischargeTest", discharge_node_id: od.discharge_node_id, obligation_id: od.obligation_id }); continue; }
    specs.push({ od, obligation_ref, node });
  }
  if (errors.length) return { errors };

  // Register every obligation_ref into its discharge node's test.verifies (all refs for a
  // node injected before that node's discharge_test_ref is computed).
  const refsByNode = new Map();
  for (const { obligation_ref, node } of specs) {
    if (!refsByNode.has(node.id)) refsByNode.set(node.id, new Set(node.test.verifies || []));
    refsByNode.get(node.id).add(obligation_ref);
  }
  for (const [nodeId, refs] of refsByNode) {
    byId.get(nodeId).test.verifies = normalizeVerifies([...refs]);
  }

  const obligations = specs.map(({ od, obligation_ref, node }) => ({
    obligation_id: od.obligation_id,
    obligation_ref,
    concern_ref: od.concern_ref,
    discharge_node_id: od.discharge_node_id,
    discharge_test_ref: deriveTestRef(node.test),
    check_contract_ref: od.check_contract_ref,
    required_result: od.required_result
  })).sort((a, b) => (a.obligation_ref < b.obligation_ref ? -1 : a.obligation_ref > b.obligation_ref ? 1 : 0));

  return { defs, obligations };
}

/**
 * The six proposal-gate anchor checks (contract §Obligation anchor). Mechanical — the gate
 * never infers whether a test "really exercises" a concern; the obligation names its
 * discharge point and registers its content-addressed identity.
 * @returns { ok, failures:[{ obligation_id, obligation_ref, check, detail }] }
 */
export function checkObligationAnchors(plan, { recomputedPlanHash } = {}) {
  const failures = [];
  const nodeById = new Map((plan.nodes || []).map((n) => [n.id, n]));
  for (const ob of plan.obligations || []) {
    const fail = (check, detail) => failures.push({ obligation_id: ob.obligation_id, obligation_ref: ob.obligation_ref, check, detail });
    const node = nodeById.get(ob.discharge_node_id);
    if (!node) { fail("node-exists", `discharge_node_id '${ob.discharge_node_id}' not in plan`); continue; }
    if (!node.test || typeof node.test.cmd !== "string" || !node.test.cmd) { fail("test-exists", `node '${node.id}' has no test command`); continue; }
    if (deriveTestRef(node.test) !== ob.discharge_test_ref) { fail("test-ref-match", `deriveTestRef(node.test) != stored discharge_test_ref`); continue; }
    let recomputedRef;
    try { recomputedRef = deriveObligationRef(ob); } catch (e) { fail("obligation-ref-match", e.message); continue; }
    const verifies = node.test.verifies || [];
    if (!verifies.includes(recomputedRef)) { fail("verifies-registered", `recomputed obligation_ref not in node.test.verifies`); continue; }
    if (recomputedRef !== ob.obligation_ref) { fail("obligation-ref-match", `stored obligation_ref != recomputed from semantics`); continue; }
    if (recomputedPlanHash != null && recomputedPlanHash !== plan.plan_hash) { fail("plan-hash-coverage", `recomputed plan_hash != stored`); continue; }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * done()-time discharge sweep. An obligation is discharged iff required_result === "pass"
 * AND its discharge node has a passing node report (settled + Rule-3-verified). Discharge
 * validity is node-lineage: the node's effective_hash / test / obligation semantics are all
 * re-derived by recompute() before this runs, so this needs only the current node reports.
 * @param nodeReportById  Map<nodeId, { id, ok, checks }>  (from ledger-gate's per-node loop)
 * @returns [{ obligation, reason }] for every UNDISCHARGED obligation
 */
export function undischargedObligations(plan, nodeReportById) {
  const out = [];
  for (const ob of plan.obligations || []) {
    if (ob.required_result !== "pass") { out.push({ obligation: ob, reason: `unsupported required_result '${ob.required_result}' (only "pass" auto-discharges)` }); continue; }
    const rep = nodeReportById.get(ob.discharge_node_id);
    if (!rep || rep.ok !== true) { out.push({ obligation: ob, reason: `discharge node '${ob.discharge_node_id}' not settled + Rule-3-verified` }); }
  }
  return out;
}
