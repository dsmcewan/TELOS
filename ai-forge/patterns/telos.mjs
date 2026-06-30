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
    checks: () => [{ type: "file_exists", path: file }],
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

export const telosPattern = {
  id: "telos",
  workstreams: [signWorkstream, planWorkstream, provenanceWorkstream, gateWorkstream] // full 8-workstream set assembled in Task 4
};
