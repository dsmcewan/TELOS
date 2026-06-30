// telos.mjs — the TELOS pattern: ai-forge forges a TELOS-like trust system. Each
// component wraps the REAL spine through an absolute file:// spineRoot and ships a
// keyless executable selftest run as its node test. Pure data; mirrors rag.mjs.
import { makeDesignWorkstream } from "../workstreams/design.mjs";

// spineRoot: absolute file:// URL to the repo root (ai-forge/patterns/ -> ../../).
// Ends with "/", so `${spineRoot}build-gate/sign.mjs` is a valid absolute import.
export function telosContext(params = {}) {
  return { spineRoot: new URL("../../", import.meta.url).href, ...params };
}

function componentWorkstream({ id, signer, dependencies, file, makeSelftest, finding }) {
  return {
    id,
    signer,
    lens: signer,
    dependencies,
    files: [file],
    requirements: `Forge the ${id} trust component (wraps the real spine) and prove it executes.`,
    render: (ctx) => ({ [file]: makeSelftest(ctx.spineRoot) }),
    checks: (ctx) => [{ type: "file_exists", path: file }],
    nodeTest: { cmd: "node", args: [file] },
    findingsKey: "architecture_findings",
    finding
  };
}

// --- sign ---
function signSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { signPacket, verifyPacket } from "${spineRoot}build-gate/sign.mjs";
const p = { build_id: "t", model: "claude", decision: "approve" };
const s = signPacket(p, "k");
assert.equal(verifyPacket(s, "k").ok, true, "roundtrip verifies");
assert.equal(verifyPacket({ ...s, decision: "reject" }, "k").ok, false, "tamper fails");
console.log("telos/sign selftest OK");
`;
}

export const signWorkstream = componentWorkstream({
  id: "sign", signer: "codex", dependencies: [], file: "telos/sign.mjs",
  makeSelftest: signSelftest, finding: "HMAC signing verifies and rejects tampering."
});

// --- plan ---
function planSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { computePlan, mutateNode } from "${spineRoot}merkle-dag/merkle.mjs";
const defs = [
  { id: "a", files: ["a.txt"], requirements: "ra", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: [] },
  { id: "b", files: ["b.txt"], requirements: "rb", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["a"] }
];
const r1 = computePlan(defs, {});
assert.ok(r1.plan, "plan built");
const r2 = computePlan(defs, {});
assert.equal(r1.plan.plan_hash, r2.plan.plan_hash, "plan_hash deterministic");
const bEff = r1.plan.nodes.find((n) => n.id === "b").effective_hash;
const m = mutateNode(r1.plan, "a", { files: ["a.txt"], requirements: "CHANGED", test: { cmd: "node", args: ["-e", "process.exit(0)"] } });
assert.ok(m.plan, "mutated plan");
const bEff2 = m.plan.nodes.find((n) => n.id === "b").effective_hash;
assert.notEqual(bEff, bEff2, "downstream effective_hash cascades (forward-invalidation)");
console.log("telos/plan selftest OK");
`;
}
export const planWorkstream = componentWorkstream({
  id: "plan", signer: "codex", dependencies: [], file: "telos/plan.mjs",
  makeSelftest: planSelftest, finding: "Content-addressed plan is deterministic and forward-invalidates."
});

// --- provenance ---
function provenanceSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { agyAttestation, extractOpenAIResult } from "${spineRoot}connectors/ai-peer-mcp/lib.mjs";
const att = agyAttestation({ phase_gate_status: "advance" });
assert.match(att.response_id, /^agy-[0-9a-f]{40}$/, "content-addressed attestation id");
const noId = extractOpenAIResult({ choices: [{ message: { content: "x" } }] });
assert.equal(noId.id, null, "missing response id -> null (fail-closed)");
console.log("telos/provenance selftest OK");
`;
}
export const provenanceWorkstream = componentWorkstream({
  id: "provenance", signer: "codex", dependencies: [], file: "telos/provenance.mjs",
  makeSelftest: provenanceSelftest, finding: "Provenance binds a real id or fails closed to null."
});

// --- gate ---
function gateSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { validateRecords } from "${spineRoot}build-gate/gate.mjs";
const dossier = { build_id: "t", use_case: "u", objective: "o", required_docs: [], write_targets: [], protected_paths: [] };
const pkt = (model, decision = "approve") => ({ build_id: "t", use_case: "u", model, role: "approver", docs_reviewed: [], proposal_ref: "r", decision, required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-30T00:00:00Z" });
const pass = validateRecords(dossier, [pkt("claude"), pkt("agy"), pkt("codex")]);
assert.equal(pass.gate_status, "pass", "all-approve -> pass");
const blocked = validateRecords(dossier, [pkt("claude", "reject"), pkt("agy"), pkt("codex")]);
assert.equal(blocked.gate_status, "blocked", "a reject -> blocked");
console.log("telos/gate selftest OK");
`;
}
export const gateWorkstream = componentWorkstream({
  id: "gate", signer: "agy", dependencies: ["sign", "provenance"], file: "telos/gate.mjs",
  makeSelftest: gateSelftest, finding: "Approval gate passes a unanimous council and blocks a dissent."
});

// --- council ---
function councilSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { runCouncil } from "${spineRoot}build-gate/council.mjs";
import { verifyPacket } from "${spineRoot}build-gate/sign.mjs";
process.env.TELOS_SECRET_CLAUDE = "k"; process.env.TELOS_SECRET_AGY = "k"; process.env.TELOS_SECRET_CODEX = "k";
const seats = [{ model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" }];
const callSeat = async ({ model }) => ({
  packet: { build_id: "t", use_case: "u", model, role: "approver", decision: "approve", docs_reviewed: [], required_edits: [], hard_stops: [], proposal_ref: "r", confidence: "high", timestamp: "2026-06-30T00:00:00Z" },
  provenance: { model, source: "stub", response_id: "r-" + model }
});
const results = await runCouncil({ seats, callSeat, dossier: { build_id: "t" } });
assert.equal(results.length, 3, "all seats");
assert.deepEqual(results.map((r) => r.model), ["claude", "agy", "codex"], "order preserved");
for (const r of results) { assert.equal(r.ok, true, r.model + " ok"); assert.equal(verifyPacket(r.packet, "k").ok, true, r.model + " signed packet verifies"); }
console.log("telos/council selftest OK");
`;
}
export const councilWorkstream = componentWorkstream({
  id: "council", signer: "claude", dependencies: ["sign", "provenance"], file: "telos/council.mjs",
  makeSelftest: councilSelftest, finding: "Council fan-out produces ordered, signed, verifiable packets."
});

// --- ledger (+ done) --- (ISOLATED tmpdir; never the project .telos)
function ledgerSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair, makeRecord, appendLedger } from "${spineRoot}merkle-dag/crypto.mjs";
import { computePlan, writePlan } from "${spineRoot}merkle-dag/merkle.mjs";
import { computeDiskTreeHash } from "${spineRoot}merkle-dag/artifact.mjs";
import { verify } from "${spineRoot}merkle-dag/ledger-gate.mjs";
const root = mkdtempSync(path.join(os.tmpdir(), "telos-ledger-"));   // ISOLATED — never the forge's .telos
const telosDir = path.join(root, ".telos");
mkdirSync(telosDir, { recursive: true });
writeFileSync(path.join(root, "a.txt"), "hello");
const kp = generateKeypair();
const defs = [{ id: "a", files: ["a.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: [] }];
const { plan } = computePlan(defs, { authorizedSigners: { codex: kp.publicJwk } });
writePlan(telosDir, plan);
const node = plan.nodes.find((n) => n.id === "a");
const disk = computeDiskTreeHash(node.files, root);
const rec = makeRecord({ task_id: "a", effective_hash: node.effective_hash, artifact_tree_hash: disk.tree_hash, artifact_files: disk.files }, "codex", kp.privatePem);
appendLedger(path.join(telosDir, "ledger.jsonl"), rec);
assert.equal(verify(telosDir, { baseDir: root }).merge_status, "ready", "settled ledger verifies done()");
writeFileSync(path.join(root, "a.txt"), "TAMPERED");
assert.notEqual(verify(telosDir, { baseDir: root }).merge_status, "ready", "tampered artifact blocked");
console.log("telos/ledger selftest OK");
`;
}
export const ledgerWorkstream = componentWorkstream({
  id: "ledger", signer: "agy", dependencies: ["sign", "plan"], file: "telos/ledger.mjs",
  makeSelftest: ledgerSelftest, finding: "Append-only signed ledger settles and a tamper fails done()."
});

// --- breakout (verdict on facts) ---
function breakoutSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCheck } from "${spineRoot}breakout/verifier.mjs";
const dir = mkdtempSync(path.join(os.tmpdir(), "telos-verify-"));
writeFileSync(path.join(dir, "evidence.txt"), "proof");
const present = await buildCheck({ type: "file_exists", path: "evidence.txt" }, dir).run();
assert.equal(present.ok, true, "present evidence -> meets");
const absent = await buildCheck({ type: "file_exists", path: "NOPE.txt" }, dir).run();
assert.equal(absent.ok, false, "absent evidence -> blocked");
console.log("telos/verify selftest OK");
`;
}
export const breakoutWorkstream = componentWorkstream({
  id: "breakout", signer: "grok", dependencies: ["gate"], file: "telos/verify.mjs",
  makeSelftest: breakoutSelftest, finding: "Verdict-on-facts confirms present evidence and blocks absent."
});

const buildWorkstreams = [
  signWorkstream, planWorkstream, provenanceWorkstream,
  gateWorkstream, councilWorkstream, ledgerWorkstream, breakoutWorkstream
];

export const telosPattern = {
  id: "telos",
  workstreams: [...buildWorkstreams, makeDesignWorkstream(buildWorkstreams)]
};
