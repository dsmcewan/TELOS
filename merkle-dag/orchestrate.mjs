// orchestrate.mjs — reference controller: plan -> delegate -> verify -> sign, over the merkle-dag
// substrate. Enforces the 3 protocol rules. dispatch/verifyNode/signerFor are INJECTED (keyless,
// testable). The controller is the SOLE ledger writer; workers never touch .telos/.
import path from "node:path";
import { spawn } from "node:child_process";
import { recompute, readPlan, writePlan, mutateNode, appendPlanHistory } from "./merkle.mjs";
import { computeDiskTreeHash } from "./artifact.mjs";
import { makeRecord, appendLedger, readLedger } from "./crypto.mjs";
import { verify } from "./ledger-gate.mjs";
import { resolveUnder, maxConcurrency, spawnCommand } from "./vendor.mjs";
import { readProposalEvents, verifyProposalChain, latestDecisionForPlan, readProposalArtifact, verifyAuthorizationResult, PROPOSAL_KEY_ID } from "./proposal-ledger.mjs";

/**
 * Lifecycle authorization check (decision 11): the enforcement key is the plan hash RECOMPUTED
 * from disk — never a caller-supplied selector. Resolve the latest decision bound to that exact
 * hash, require it authorized, and independently re-verify its closed policy-result certificate.
 * @returns { ok:true, planHash } | { ok:false, error, detail }
 */
export function checkLifecycleAuthorization(telosDir, plan, { lifecycleVerify, nowMs = 0 } = {}) {
  const rc = recompute(plan);
  if (rc.errors) return { ok: false, error: "PLAN_INVALID", detail: rc.errors };
  if (rc.plan.plan_hash !== plan.plan_hash) return { ok: false, error: "PLAN_TAMPERED", detail: "stored plan_hash does not recompute" };
  const planHash = rc.plan.plan_hash;
  const pub = (rc.plan.authorized_signers || {})[PROPOSAL_KEY_ID];
  if (!pub) return { ok: false, error: "NO_AUTHORIZED_DECISION", detail: "no proposal-controller signer pinned in plan" };
  const { events, errors } = readProposalEvents(telosDir);
  if (errors.length) return { ok: false, error: "CHAIN_INVALID", detail: errors };
  if (events.length === 0) return { ok: false, error: "NO_AUTHORIZED_DECISION", detail: "empty proposal ledger" };
  const chain = verifyProposalChain(events, pub);
  if (!chain.ok) return { ok: false, error: "CHAIN_INVALID", detail: chain.errors };
  const decision = latestDecisionForPlan(events, planHash);
  if (!decision) return { ok: false, error: "NO_AUTHORIZED_DECISION", detail: `no decision event for plan ${planHash}` };
  if (decision.decision !== "authorized") return { ok: false, error: "DECISION_NOT_AUTHORIZED", detail: `latest decision for plan is '${decision.decision}'` };
  const prRef = decision.policy_result_ref;
  if (!prRef) return { ok: false, error: "MISSING_POLICY_RESULT", detail: "authorized decision has no policy_result_ref" };
  const artifact = readProposalArtifact(telosDir, prRef);
  if (!artifact) return { ok: false, error: "CORRUPT_POLICY_RESULT", detail: `policy-result artifact ${prRef} missing or tampered` };
  if (artifact.plan_hash !== planHash) return { ok: false, error: "WRONG_PLAN_POLICY_RESULT", detail: "policy-result plan_hash != recomputed plan hash" };
  const av = verifyAuthorizationResult(artifact, { planHash });
  if (!av.ok) return { ok: false, error: "NON_AUTHORIZING_POLICY_RESULT", detail: av.errors };
  // Decision 6: MANDATORY execution-time lifecycle-STATE re-verification. The static certificate
  // above proves the authorized decision existed; it does NOT catch a hold appended AFTER that
  // decision. Re-run the ledger-reconstructable lifecycle verification (the injected lifecycleVerify
  // wraps validateProposalLifecycle with requiredModels=[]/packets=[] — the full packets are not on
  // the ledger, so a literal "full" re-run would false-fail proposal_ref_binding/cold_review).
  // merkle-dag must not import build-gate, so this is a REQUIRED injected dependency: absent it, FAIL
  // CLOSED with a DISTINCT error (never conflated with the exact-hash-mismatch refusal above).
  if (typeof lifecycleVerify !== "function") {
    return { ok: false, error: "MISSING_LIFECYCLE_VERIFY", detail: "requireAuthorizedDecision path requires an injected lifecycleVerify (fail-closed)" };
  }
  let live;
  try { live = lifecycleVerify({ telosDir, plan: rc.plan, planHash, nowMs }); }
  catch (e) { return { ok: false, error: "LIFECYCLE_REVERIFY_THREW", detail: String((e && e.message) || e) }; }
  if (!live || live.ok !== true) return { ok: false, error: "LIFECYCLE_STATE_DRIFT", detail: (live && (live.blockers || live.errors)) || "lifecycle re-verification failed" };
  return { ok: true, planHash };
}

const TEST_TIMEOUT_MS = 60000;

// A node is "settled-valid" iff its last ledger entry's effective_hash === the node's (recomputed) eff_hash.
function settledValid(node, ledger) {
  const matches = ledger.filter((r) => r.task_id === node.id);
  const entry = matches.length ? matches[matches.length - 1] : null;
  return !!entry && entry.effective_hash === node.effective_hash;
}

// readySet: nodes NOT yet settled-valid whose EVERY dependency IS settled-valid.
export function readySet(plan, ledger) {
  const byId = new Map(plan.nodes.map((n) => [n.id, n]));
  return plan.nodes
    .filter((n) => !settledValid(n, ledger))
    .filter((n) => (n.dependencies || []).every((d) => { const p = byId.get(d); return p && settledValid(p, ledger); }))
    .map((n) => n.id);
}

// Longest path from each node to a sink (critical-path weight), memoized over the live plan.
// Higher weight = more downstream work blocked on this node; schedule it first.
function criticalWeights(planNodes) {
  const children = new Map(planNodes.map((n) => [n.id, []]));
  for (const n of planNodes) for (const d of n.dependencies || []) if (children.has(d)) children.get(d).push(n.id);
  const memo = new Map();
  const weight = (id) => {
    if (memo.has(id)) return memo.get(id);
    memo.set(id, 0); // guard (DAG — computePlan already rejects cycles)
    let w = 0;
    for (const c of children.get(id) || []) w = Math.max(w, 1 + weight(c));
    memo.set(id, w); return w;
  };
  const w = {};
  for (const n of planNodes) w[n.id] = weight(n.id);
  return w;
}

// Async test runner: spawn cmd+args in cwd; resolve {status} or {status:null, timedOut/error}.
// Non-blocking: the event loop is free while the child process runs (unlike spawnSync).
function runTest(cmd, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    let output = "";
    const spec = spawnCommand(cmd, args);
    const child = spawn(spec.command, spec.args, { cwd });
    // Keep the tail of the test's own words — a failing test's diagnostic is
    // the exact feedback a regenerating builder needs.
    const collect = (chunk) => { output = (output + chunk).slice(-2000); };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    const timer = setTimeout(() => {
      if (!done) { done = true; try { child.kill("SIGTERM"); } catch {} resolve({ status: null, timedOut: true, output }); }
    }, timeoutMs);
    child.on("error", (e) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ status: null, error: e, output }); }
    });
    child.on("close", (code) => {
      if (!done) { done = true; clearTimeout(timer); resolve({ status: code, output }); }
    });
  });
}

// Default Rule-3 handshake: independently recompute artifact-tree-hash + run the node test.
// Async via spawn so multiple verify calls run concurrently in the pool (no event-loop blocking).
export async function defaultVerifyNode(node, baseDir) {
  const disk = computeDiskTreeHash(node.files, baseDir);
  if (disk.files.some((f) => f.status === "escape")) return { ok: false, detail: `${node.id}: path escape` };
  const t = node.test || {};
  if (!t.cmd) return { ok: false, detail: `${node.id}: no test command` };
  const cwd = resolveUnder(baseDir, t.cwd || ".");
  if (cwd === null) return { ok: false, detail: `${node.id}: test cwd escapes baseDir` };
  const res = await runTest(t.cmd, t.args || [], cwd, TEST_TIMEOUT_MS);
  if (res.error || res.status !== 0) {
    // Prefer the diagnostic lines over banners: a regenerating builder needs
    // the FAIL/mismatch text, not the harness header.
    const lines = (res.output || "").trim().split(/\r?\n/).filter(Boolean);
    const salient = lines.filter((l) => /fail|error|mismatch|expected|assert/i.test(l)).slice(-4);
    const said = lines.length ? ` — test said: ${(salient.length ? salient : lines.slice(-3)).join(" | ").slice(0, 600)}` : "";
    return { ok: false, detail: `${node.id}: test exit ${res.status}${res.timedOut ? " (timeout)" : ""}${said}` };
  }
  return { ok: true, tree_hash: disk.tree_hash, files: disk.files };
}

/**
 * Per-node helper: slow work (dispatch + verify + sign). NEVER writes shared state.
 * Returns an outcome object; the caller (post-pool serial section) writes to the ledger / plan.
 *
 *   outcome.kind === "settle"        -> record is ready to appendLedger
 *   outcome.kind === "halt"          -> dispatch rejected; respec may be present
 *   outcome.kind === "verify-failed" -> verifyNode rejected or threw; no ledger entry
 */
async function runOne(node, { dispatch, verifyNode, signerFor, baseDir }) {
  // Rule 1 — spec-injection boundary: dispatch sees ONLY the node spec.
  const injected = {
    id: node.id,
    requirements: node.requirements,
    files: node.files,
    test: node.test,
    effective_hash: node.effective_hash,
  };
  let result;
  try { result = await dispatch(injected); } catch (e) { result = { ok: false, reason: e?.message || String(e) }; }

  if (!result || result.ok === false) {
    return { id: node.id, kind: "halt", reason: result && result.reason, respec: result && result.respec };
  }

  // Rule 3 — verification handshake: independently re-derive facts BEFORE signing.
  // A throwing verifyNode (or makeRecord) becomes a clean verify-failed outcome rather than
  // rejecting Promise.all and skipping the post-pool serial section.
  try {
    const v = await verifyNode(node, baseDir);
    if (!v.ok) return { id: node.id, kind: "verify-failed", detail: v.detail };
    const model = result.signer || "claude";
    const record = makeRecord(
      { task_id: node.id, effective_hash: node.effective_hash, artifact_tree_hash: v.tree_hash, artifact_files: v.files },
      model,
      signerFor(model)
    );
    return { id: node.id, kind: "settle", model, record };
  } catch (e) {
    return { id: node.id, kind: "verify-failed", detail: `verify/sign threw: ${e?.message || String(e)}` };
  }
}

/**
 * Drive the build. Returns { report, trace } (report = ledger-gate.verify at the end).
 *   dispatch(injected) -> { ok:true, signer } | { ok:false, reason, respec? }   (INJECTED)
 *      injected = { id, requirements, files, test, effective_hash }  (Rule 1: spec-injection boundary)
 *   verifyNode(node, baseDir) -> { ok, tree_hash, files } | { ok:false, detail }  (defaults to defaultVerifyNode)
 *   signerFor(model) -> privatePem  (model's public key MUST be in plan.authorized_signers)
 *   concurrency -> worker-pool size hint (clamped via maxConcurrency to [1, cores-2])
 */
export async function runBuild({ telosDir, baseDir, dispatch, verifyNode = defaultVerifyNode, signerFor, maxRounds = 1000, concurrency, authorizedPlanHash, requireAuthorizedDecision, lifecycleVerify, nowMs = 0 }) {
  baseDir = baseDir || path.dirname(path.resolve(telosDir));
  const ledgerPath = path.join(telosDir, "ledger.jsonl");
  let plan = readPlan(telosDir);
  const trace = [];

  // Execution-start authorization (decisions 11/12): re-verify the written plan BEFORE any dispatch.
  // Lifecycle mode reads the authorized decision + policy certificate from disk (no caller selector);
  // legacy callers may pass authorizedPlanHash as a pure TOCTOU strengthening.
  if (requireAuthorizedDecision) {
    const auth = checkLifecycleAuthorization(telosDir, plan, { lifecycleVerify, nowMs });
    if (!auth.ok) return { error: auth.error, detail: auth.detail, trace };
  } else if (typeof authorizedPlanHash === "string" && authorizedPlanHash) {
    const rc0 = recompute(plan);
    if (rc0.errors) return { error: "PLAN_INVALID", detail: rc0.errors, trace };
    if (rc0.plan.plan_hash !== plan.plan_hash) return { error: "PLAN_TAMPERED", detail: "stored plan_hash does not recompute", trace };
    if (rc0.plan.plan_hash !== authorizedPlanHash) return { error: "PLAN_HASH_MISMATCH", detail: `authorized ${authorizedPlanHash} != recomputed ${rc0.plan.plan_hash}`, trace };
  }

  // Change 1: seed in-memory ledger ONCE before the loop (avoids per-round file re-parse).
  // The controller is the sole ledger writer, so ledger.push() after each appendLedger keeps
  // this in sync. The FINAL verify() still reads disk (ground-truth gate).
  const ledger = readLedger(ledgerPath);

  for (let round = 0; round < maxRounds; round++) {
    const rc = recompute(plan);          // never trust stored hashes
    if (rc.errors) return { error: "PLAN_INVALID", detail: rc.errors, trace };
    const livePlan = rc.plan;            // has live eff-hashes + authorized_signers (carried by recompute)

    // Change 1 (cont.): pass in-memory ledger to readySet — no file re-read per round.
    const ready = readySet(livePlan, ledger);
    if (ready.length === 0) break;       // frontier drained

    // Write-disjoint batch (corruption guard): never run two workers that write the same file
    // concurrently. Overlapping ready nodes are deferred to a later round (serial).
    const batch = [];
    const claimed = new Set();
    for (const id of ready) {
      const node = livePlan.nodes.find((n) => n.id === id);
      if ((node.files || []).some((f) => claimed.has(f))) continue;
      (node.files || []).forEach((f) => claimed.add(f));
      batch.push(node);
    }

    // Change 2: critical-path scheduling — sort batch by descending weight (ties broken by id)
    // so high-leverage nodes (longest downstream chain) enter the pool first.
    const cw = criticalWeights(livePlan.nodes);
    batch.sort((a, b) => (cw[b.id] - cw[a.id]) || (a.id < b.id ? -1 : 1));

    // Bounded parallel pool over the disjoint batch (dispatch + verify + sign run concurrently).
    const limit = maxConcurrency(concurrency);
    const outcomes = new Array(batch.length);
    let nextIdx = 0;
    const worker = async () => {
      while (nextIdx < batch.length) {
        const i = nextIdx++;
        outcomes[i] = await runOne(batch[i], { dispatch, verifyNode, signerFor, baseDir });
      }
    };
    const workerCount = Math.min(limit, batch.length);
    if (workerCount > 0) {
      await Promise.all(Array.from({ length: workerCount }, () => worker()));
    }

    // Apply outcomes SERIALLY + deterministically (sole-writer appends; plan mutations cascade).
    let progressed = false;
    for (const oc of outcomes) {
      if (oc.kind === "settle") {
        appendLedger(ledgerPath, oc.record);
        ledger.push(oc.record);          // Change 1: keep in-memory ledger in sync with disk
        trace.push({ id: oc.id, action: "settled", model: oc.model });
        progressed = true;
      } else if (oc.kind === "halt") {
        trace.push({ id: oc.id, action: "halt", reason: oc.reason });
        if (oc.respec) {
          const mut = mutateNode(plan, oc.id, oc.respec, oc.reason || "worker-halt");
          if (mut.errors) return { error: "MUTATE_FAILED", detail: mut.errors, trace };
          plan = mut.plan; writePlan(telosDir, plan); appendPlanHistory(telosDir, mut.historyEvent);
          progressed = true;
        }
      } else {
        // verify-failed or unknown
        trace.push({ id: oc.id, action: oc.kind, detail: oc.detail });
      }
    }
    if (!progressed) break;  // no forward progress this round -> stop; final verify reports the blocks
  }

  return { report: verify(telosDir, { baseDir }), trace };
}
