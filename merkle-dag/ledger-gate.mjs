// ledger-gate.mjs — pure done() merge gate. Verdict from plan + ledger + disk + keyring only.
import path from "node:path";
const TEST_TIMEOUT_MS = 60000;
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { recompute, readPlan } from "./merkle.mjs";
import { computeDiskTreeHash, hasEscape } from "./artifact.mjs";
import { readLedger, verifyTransaction } from "./crypto.mjs";
import { resolveUnder, spawnCommand } from "./vendor.mjs";

export function verify(telosDir, { baseDir } = {}) {
  baseDir = baseDir || path.dirname(path.resolve(telosDir)); // workspace root (parent of .telos)
  const stored = readPlan(telosDir);

  // Plan-tamper precheck: recompute all hashes from specs; stored must match (cache, not truth).
  const rc = recompute(stored);
  if (rc.errors) return withExit({ merge_status: "error", reason: "PLAN_INVALID", detail: rc.errors }, 2);
  const recById = new Map(rc.plan.nodes.map((n) => [n.id, n]));
  for (const sn of stored.nodes) {
    const rn = recById.get(sn.id);
    if (!rn || rn.effective_hash !== sn.effective_hash || rn.spec_hash !== sn.spec_hash) {
      return withExit({ merge_status: "error", reason: "PLAN_TAMPERED", node: sn.id }, 2);
    }
  }
  // Whole-plan hash precheck: plan_hash commits to authorized_signers; tampering the signer
  // set in plan.json changes the recomputed plan_hash vs the stored one.
  if (rc.plan.plan_hash !== stored.plan_hash) return withExit({ merge_status: "error", reason: "PLAN_TAMPERED", detail: "plan_hash mismatch" }, 2);

  const ledger = readLedger(path.join(telosDir, "ledger.jsonl"));
  const report = { merge_status: "ready", plan_hash: stored.plan_hash, safe_next_action: "merge",
    summary: { total: rc.plan.nodes.length, passed: 0, blocked: 0 }, nodes: [], blockers: [] };

  for (const node of rc.plan.nodes) {
    const checks = { ledger: "ok", lineage: "ok", signature: "ok", artifact: "ok", test: "ok" };
    const b = [];
    const matches = ledger.filter((r) => r.task_id === node.id);
    const entry = matches.length ? matches[matches.length - 1] : null; // last wins (retries)
    const skip = (...ks) => ks.forEach((k) => (checks[k] = "skipped"));

    if (!entry) { checks.ledger = "MISSING_LEDGER"; skip("lineage","signature","artifact","test"); b.push(`${node.id}: no ledger entry`); }
    else if (entry.effective_hash !== node.effective_hash) {
      checks.lineage = "STALE_LINEAGE"; skip("signature","artifact","test");
      b.push(`${node.id}: ledger ${entry.effective_hash} != recomputed ${node.effective_hash} (spec or ancestor changed)`);
    } else {
      const pub = stored.authorized_signers ? stored.authorized_signers[entry.key_id] : null;
      if (!pub) { checks.signature = "UNKNOWN_SIGNER"; skip("artifact","test"); b.push(`${node.id}: key_id '${entry.key_id}' is not an authorized signer in the plan`); }
      else if (!verifyTransaction(entry, pub)) { checks.signature = "BAD_SIGNATURE"; skip("artifact","test"); b.push(`${node.id}: signature invalid`); }
      else {
        const disk = computeDiskTreeHash(node.files, baseDir);
        if (hasEscape(disk)) { checks.artifact = "PATH_ESCAPE"; skip("test"); b.push(`${node.id}: declared file escapes baseDir`); }
        else if (disk.tree_hash !== entry.artifact_tree_hash) { checks.artifact = "ARTIFACT_MISMATCH"; skip("test"); b.push(`${node.id}: disk artifacts != signed tree (drift)`); }
        else {
          const t = node.test || {};
          const cwd = resolveUnder(baseDir, t.cwd || ".") || baseDir;
          if (!t.cmd) { checks.test = "TEST_FAILED"; b.push(`${node.id}: node has no test command`); }
          else {
            const spec = spawnCommand(t.cmd, t.args || []);
            const res = spawnSync(spec.command, spec.args, { cwd, encoding: "utf8", timeout: TEST_TIMEOUT_MS, killSignal: "SIGTERM" });
            if (res.error || res.status !== 0) { checks.test = "TEST_FAILED"; b.push(`${node.id}: test exit ${res.status}${res.error ? " ("+res.error.message+")" : ""}${res.signal ? " (signal " + res.signal + ")" : ""}`); }
          }
        }
      }
    }
    const ok = b.length === 0;
    report.nodes.push({ id: node.id, ok, checks });
    if (ok) report.summary.passed++; else { report.summary.blocked++; report.blockers.push(...b); }
  }

  if (report.summary.blocked > 0) { report.merge_status = "blocked"; report.safe_next_action = "rebuild-and-resign-blocked-nodes"; }
  return withExit(report, report.summary.blocked > 0 ? 1 : 0);
}

function withExit(report, exit) { return { ...report, exit }; }

// CLI: node ledger-gate.mjs verify <telosDir> [baseDir]
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [cmd, telosDir, baseDir] = process.argv.slice(2);
  if (cmd !== "verify" || !telosDir) { console.error("Usage: node ledger-gate.mjs verify <telosDir> [baseDir]"); process.exitCode = 2; }
  else { const r = verify(telosDir, { baseDir }); console.log(JSON.stringify(r, null, 2)); process.exitCode = r.exit; }
}
