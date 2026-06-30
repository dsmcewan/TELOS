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

export const telosPattern = {
  id: "telos",
  workstreams: [signWorkstream] // full 8-workstream set assembled in Task 4
};
