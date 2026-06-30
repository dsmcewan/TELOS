// patterns/serving.mjs — a serving+guardrails pattern as DATA.
// 7 build workstreams (schema / handler / input-guardrail / output-guardrail / ratelimit /
// authz / audit), each a self-contained ESM module with an inline --selftest run as its
// nodeTest. Keyless, deterministic.
import {
  auditWorkstream,
  designWorkstream,
  guardrailWorkstream,
  moduleWorkstream,
} from "../workstreams/catalog.mjs";

function localServingWorkstream({ id, signer, dependencies = [], file, requirements, source, needle, finding }) {
  return {
    id,
    signer,
    lens: signer,
    dependencies,
    files: [file],
    requirements,
    render: () => ({ [file]: source }),
    checks: () => [
      { type: "file_exists", path: file },
      ...(needle ? [{ type: "file_contains", path: file, needle }] : [])
    ],
    nodeTest: { cmd: "node", args: [file, "--selftest"] },
    findingsKey: "architecture_findings",
    finding
  };
}

export function servingContext(params = {}) {
  return { telos: params.telos || "serve requests through a validated, guarded handler", denylist: ["password", "ssn"], maxBodyLen: 256 };
}

const SCHEMA_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// request: { path:string, method:"GET"|"POST", body:object }
export function validate(req) {
  if (!req || typeof req !== "object") return { ok: false, error: "not an object" };
  if (typeof req.path !== "string" || !req.path.startsWith("/")) return { ok: false, error: "bad path" };
  if (req.method !== "GET" && req.method !== "POST") return { ok: false, error: "bad method" };
  if (typeof req.body !== "object" || req.body === null) return { ok: false, error: "bad body" };
  return { ok: true };
}
if (isMain && process.argv.includes("--selftest")) {
  assert.equal(validate({ path: "/echo", method: "POST", body: {} }).ok, true, "conforming passes");
  assert.equal(validate({ path: "echo", method: "POST", body: {} }).ok, false, "bad path rejected");
  assert.equal(validate({ path: "/x", method: "PUT", body: {} }).ok, false, "bad method rejected");
  console.log("schema OK");
}
`;

const HANDLER_SRC = `import assert from "node:assert/strict";
import { validate } from "./schema.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// pure handler: validate then echo the body with a 200; invalid -> 400.
export function handle(req) {
  const v = validate(req);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  return { status: 200, body: { echo: req.body } };
}
if (isMain && process.argv.includes("--selftest")) {
  const r = handle({ path: "/echo", method: "POST", body: { a: 1 } });
  assert.equal(r.status, 200, "valid -> 200");
  assert.deepEqual(r.body.echo, { a: 1 }, "echoes body");
  assert.equal(handle({ path: "bad", method: "POST", body: {} }).status, 400, "invalid -> 400");
  console.log("handler OK");
}
`;

const RATELIMIT_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// deterministic token bucket; 'now' is injected (ms). capacity tokens per windowMs.
export function createLimiter(capacity, windowMs) {
  const state = new Map();
  return function allow(key, now) {
    const e = state.get(key) || { count: 0, windowStart: now };
    if (now - e.windowStart >= windowMs) { e.count = 0; e.windowStart = now; }
    if (e.count >= capacity) { state.set(key, e); return { allow: false }; }
    e.count++; state.set(key, e); return { allow: true };
  };
}
if (isMain && process.argv.includes("--selftest")) {
  const allow = createLimiter(2, 1000);
  assert.equal(allow("k", 0).allow, true, "1st allowed");
  assert.equal(allow("k", 10).allow, true, "2nd allowed");
  assert.equal(allow("k", 20).allow, false, "3rd blocked in window");
  assert.equal(allow("k", 1100).allow, true, "allowed after refill");
  console.log("ratelimit OK");
}
`;

const AUTHZ_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// keyless capability check over a FAKE token->caps map (NOT real secrets/auth).
const CAPS = { "tok-reader": ["read"], "tok-admin": ["read", "write"] };
export function authorize(token, action) {
  const caps = CAPS[token] || [];
  return { allow: caps.includes(action) };
}
if (isMain && process.argv.includes("--selftest")) {
  assert.equal(authorize("tok-admin", "write").allow, true, "admin can write");
  assert.equal(authorize("tok-reader", "write").allow, false, "reader cannot write");
  assert.equal(authorize("nope", "read").allow, false, "unknown token denied");
  console.log("authz OK");
}
`;

const schemaWorkstream = moduleWorkstream({
  id: "schema",
  signer: "codex",
  dependencies: [],
  file: "serving/schema.mjs",
  requirements: "Request schema accepts conforming requests and rejects malformed ones.",
  source: SCHEMA_SRC,
  needle: "export function validate",
  finding: "Request schema accepts conforming requests and rejects malformed ones."
});
const handlerWorkstream = localServingWorkstream({
  id: "handler",
  signer: "claude",
  dependencies: ["schema"],
  file: "serving/handler.mjs",
  requirements: "Handler validates then echoes; invalid requests get a 400.",
  source: HANDLER_SRC,
  needle: "export function handle",
  finding: "Handler validates then echoes; invalid requests get a 400."
});
const inputGuardWorkstream = guardrailWorkstream({
  id: "input-guardrail",
  signer: "grok",
  dependencies: ["schema"],
  file: "serving/guard-in.mjs",
  mode: "input",
  inputContract: "allow-object",
  inputScope: "body",
  blockedTerms: ["<script", "drop table", "ignore previous"],
  maxBodyLen: 256,
  finding: "Input guardrail rejects oversized and denylisted input (fail-closed)."
});
const outputGuardWorkstream = guardrailWorkstream({
  id: "output-guardrail",
  signer: "grok",
  dependencies: ["handler"],
  file: "serving/guard-out.mjs",
  mode: "output",
  blockedTerms: ["password"],
  blockedPatterns: [{ source: "\\b\\d{3}-\\d{2}-\\d{4}\\b" }],
  finding: "Output guardrail redacts blocked tokens and passes clean output unchanged."
});
const ratelimitWorkstream = localServingWorkstream({
  id: "ratelimit",
  signer: "agy",
  dependencies: ["schema"],
  file: "serving/ratelimit.mjs",
  requirements: "Rate limiter allows N per window and blocks the next, refilling after the window.",
  source: RATELIMIT_SRC,
  needle: "export function createLimiter",
  finding: "Rate limiter allows N per window and blocks the next, refilling after the window."
});
const authzWorkstream = localServingWorkstream({
  id: "authz",
  signer: "agy",
  dependencies: ["schema"],
  file: "serving/authz.mjs",
  requirements: "Authz allows capability-matched actions and denies others (keyless fake map).",
  source: AUTHZ_SRC,
  needle: "export function authorize",
  finding: "Authz allows capability-matched actions and denies others (keyless fake map)."
});
const auditWs = auditWorkstream({
  id: "audit",
  signer: "codex",
  dependencies: ["output-guardrail", "ratelimit", "authz"],
  file: "serving/audit.mjs",
  auditContract: "directory-log",
  finding: "Audit trail did not persist structured events."
});

export const servingBuildWorkstreams = [
  schemaWorkstream, handlerWorkstream, inputGuardWorkstream, outputGuardWorkstream,
  ratelimitWorkstream, authzWorkstream, auditWs
];

export const servingPattern = {
  id: "serving",
  workstreams: [...servingBuildWorkstreams, designWorkstream(servingBuildWorkstreams)]
};
