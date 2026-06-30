// patterns/multiagent.mjs — a standalone multi-role agent system as DATA.
// 7 build workstreams (each a self-contained ESM module with an inline --selftest
// run as its nodeTest) + the generic design workstream. Keyless, deterministic.
import { makeDesignWorkstream } from "../workstreams/design.mjs";

function mod({ id, signer, dependencies, file, source, finding, needle }) {
  return {
    id, signer, lens: signer, dependencies,
    files: [file],
    requirements: finding,
    render: () => ({ [file]: source }),
    checks: (ctx) => [
      { type: "file_exists", path: file },
      ...(needle ? [{ type: "file_contains", path: file, needle }] : [])
    ],
    nodeTest: { cmd: "node", args: [file, "--selftest"] },
    findingsKey: "architecture_findings",
    finding
  };
}

export function multiagentContext(params = {}) {
  return { telos: params.telos || "coordinated multi-role agents over a shared blackboard", maxRounds: params.maxRounds || 3 };
}

const ROLES_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
export const ROLES = [
  { id: "researcher", capability: "search", lens: "exploration" },
  { id: "coder", capability: "implement", lens: "synthesis" },
  { id: "reviewer", capability: "verify", lens: "adversarial" }
];
export function getRole(id) { return ROLES.find((r) => r.id === id) || null; }
if (isMain && process.argv.includes("--selftest")) {
  assert.ok(ROLES.length >= 3, "need >=3 roles");
  const ids = ROLES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "role ids must be unique");
  for (const r of ROLES) assert.ok(r.id && r.capability && r.lens, "role missing a field");
  assert.equal(getRole("coder").capability, "implement");
  console.log("roles OK: " + ids.join(","));
}
`;

const PROTOCOL_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
const TYPES = new Set(["task", "result", "error"]);
// message shape: { from, to, type, payload }
export function validate(msg) {
  if (!msg || typeof msg !== "object") return { ok: false, error: "not an object" };
  for (const f of ["from", "to", "type", "payload"]) if (!(f in msg)) return { ok: false, error: "missing " + f };
  if (typeof msg.from !== "string" || typeof msg.to !== "string") return { ok: false, error: "from/to must be strings" };
  if (!TYPES.has(msg.type)) return { ok: false, error: "bad type" };
  return { ok: true };
}
if (isMain && process.argv.includes("--selftest")) {
  assert.equal(validate({ from: "a", to: "b", type: "task", payload: {} }).ok, true, "well-formed passes");
  assert.equal(validate({ from: "a", to: "b", type: "task" }).ok, false, "missing payload rejected");
  assert.equal(validate({ from: "a", to: "b", type: "nope", payload: {} }).ok, false, "bad type rejected");
  assert.equal(validate(null).ok, false, "non-object rejected");
  console.log("protocol OK");
}
`;

const ROUTER_SRC = `import assert from "node:assert/strict";
import { ROLES } from "./roles.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// route a task { capability } to the first role whose capability matches; else null.
export function route(task, roles = ROLES) {
  const match = roles.find((r) => r.capability === task.capability);
  return match ? match.id : null;
}
if (isMain && process.argv.includes("--selftest")) {
  assert.equal(route({ capability: "implement" }), "coder", "routes to coder");
  assert.equal(route({ capability: "verify" }), "reviewer", "routes to reviewer");
  assert.equal(route({ capability: "unknown" }), null, "unmatched -> null fallback");
  console.log("router OK");
}
`;

const BLACKBOARD_SRC = `import assert from "node:assert/strict";
import { validate } from "./protocol.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// shared store: generic put/get + a protocol-validated post().
export function createBlackboard() {
  const store = new Map();
  return {
    put(key, value) { store.set(key, value); return true; },
    get(key) { return store.has(key) ? store.get(key) : null; },
    post(msg) { const v = validate(msg); if (!v.ok) return { ok: false, error: v.error }; store.set(msg.from + ":" + msg.type, msg); return { ok: true }; },
    keys() { return [...store.keys()]; }
  };
}
if (isMain && process.argv.includes("--selftest")) {
  const bb = createBlackboard();
  bb.put("x", 1);
  assert.equal(bb.get("x"), 1, "put/get round-trip");
  assert.equal(bb.get("absent"), null, "absent key -> null");
  assert.equal(bb.post({ from: "a", to: "b", type: "task", payload: {} }).ok, true, "valid message posts");
  assert.equal(bb.post({ bad: true }).ok, false, "invalid message rejected");
  console.log("blackboard OK");
}
`;

const rolesWorkstream = mod({ id: "roles", signer: "codex", dependencies: [], file: "agents/roles.mjs", source: ROLES_SRC, needle: "export const ROLES", finding: "Role registry exposes >=3 unique, well-formed agent roles." });
const protocolWorkstream = mod({ id: "protocol", signer: "codex", dependencies: [], file: "agents/protocol.mjs", source: PROTOCOL_SRC, needle: "export function validate", finding: "Message protocol accepts well-formed messages and rejects malformed ones (fail-closed)." });
const routerWorkstream = mod({ id: "router", signer: "agy", dependencies: ["roles"], file: "agents/router.mjs", source: ROUTER_SRC, needle: "export function route", finding: "Router maps a task to the capability-matching role; unmatched -> null." });
const blackboardWorkstream = mod({ id: "blackboard", signer: "codex", dependencies: ["protocol"], file: "agents/blackboard.mjs", source: BLACKBOARD_SRC, needle: "createBlackboard", finding: "Blackboard round-trips values and gates posted messages through the protocol." });

// NOTE (Task 2 appends orchestrator/aggregator/termination, then assembles the arrays/exports).
export const multiagentBuildWorkstreams = [rolesWorkstream, protocolWorkstream, routerWorkstream, blackboardWorkstream];
