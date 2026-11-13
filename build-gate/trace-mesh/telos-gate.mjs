// Narrow TELOS authorization adapter for scoped trace admission.
// This does not write source files, mutate the plan, or settle ledger nodes.
// A proposed node delta is admitted as an observation only after the EXISTING
// lifecycle decision is independently reverified. Actual writes must still go
// through runBuild / Rule-3 verifier / signed ledger.
import { readPlan } from '../../merkle-dag/merkle.mjs';
import { checkLifecycleAuthorization } from '../../merkle-dag/orchestrate.mjs';

const denial = (reason) => ({ ok: false, reason });
const safePath = (p) => typeof p === 'string' && p.length > 0 && p.length <= 500 &&
  !p.startsWith('/') && !p.includes('\\') && !p.includes('\0') &&
  !p.split('/').some(seg => !seg || seg === '.' || seg === '..' || seg === '.telos');

export function makeTELOSInvariantGate({
  telosDir, lifecycleVerify, loadPlan = () => readPlan(telosDir),
  authorize = checkLifecycleAuthorization, nowMs = () => Date.now(),
  onEscalation = null
} = {}) {
  if (typeof telosDir !== 'string' || !telosDir.trim()) throw Error('TELOS_DIR_REQUIRED');
  return Object.freeze({
    validateProposedStateChange({ scope, stateChange, invariantLink }) {
      // TELOS's gate is for code/build state. World RPG state requires its OWN
      // domain invariant verifier and must not borrow a build-plan certificate.
      if (!stateChange || typeof stateChange !== 'object' || Array.isArray(stateChange))
        return denial('INVALID_STATE_CHANGE');
      if (stateChange.action !== 'propose_node_delta')
        return denial('UNSUPPORTED_STATE_ACTION');
      if (typeof stateChange.node_id !== 'string' || !safePath(stateChange.file_path) ||
          typeof stateChange.plan_hash !== 'string' || typeof invariantLink !== 'string')
        return denial('INVALID_NODE_DELTA');
      if (scope !== 'node:' + stateChange.node_id) return denial('SCOPE_NODE_MISMATCH');
      let plan;
      try { plan = loadPlan(); } catch { return denial('PLAN_UNAVAILABLE'); }
      if (!plan || typeof plan.plan_hash !== 'string' ||
          stateChange.plan_hash !== plan.plan_hash || invariantLink !== plan.plan_hash)
        return denial('PLAN_HASH_MISMATCH');
      const node = Array.isArray(plan.nodes) ? plan.nodes.find(n => n.id === stateChange.node_id) : null;
      if (!node || !Array.isArray(node.files) || !node.files.includes(stateChange.file_path))
        return denial('NODE_FILE_NOT_DECLARED');
      if (typeof lifecycleVerify !== 'function') return denial('LIFECYCLE_REVERIFY_REQUIRED');
      let auth;
      try { auth = authorize(telosDir, plan, { lifecycleVerify, nowMs: nowMs() }); }
      catch { return denial('TELOS_AUTHORITY_UNAVAILABLE'); }
      if (auth?.ok !== true || auth.planHash !== plan.plan_hash)
        return denial(auth?.error || 'NO_CURRENT_TELOS_AUTHORIZATION');
      return { ok: true, authorized_plan_hash: auth.planHash, decision: 'TRACE_ADMISSION_ONLY' };
    },
    escalate({ scope, author, traceId, reason, requestTraceId }) {
      // No external escalation receiver: fail closed. Never manufacture an
      // accepted TELOS receipt from an agent's claim or a test fixture.
      if (typeof onEscalation !== 'function') return { accepted: false };
      try {
        const receipt = onEscalation({ scope, author, traceId, reason, requestTraceId });
        return receipt && receipt.accepted === true ? receipt : { accepted: false };
      } catch { return { accepted: false }; }
    }
  });
}
