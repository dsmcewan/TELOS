// patterns/serving.mjs — a serving+guardrails pattern as DATA.
// 4 build workstreams (schema / handler / input-guardrail / output-guardrail), each a
// self-contained ESM module with an inline --selftest run as its nodeTest. Keyless, deterministic.
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

const GUARD_IN_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
const MAX = 256;
const DENY = ["<script", "drop table", "ignore previous"];
// reject oversized or denylisted input.
export function checkInput(req) {
  const s = JSON.stringify(req.body || {}).toLowerCase();
  if (s.length > MAX) return { allow: false, reason: "oversized" };
  for (const bad of DENY) if (s.includes(bad)) return { allow: false, reason: "denylisted" };
  return { allow: true };
}
if (isMain && process.argv.includes("--selftest")) {
  assert.equal(checkInput({ body: { q: "hello" } }).allow, true, "clean input passes");
  assert.equal(checkInput({ body: { q: "<script>x" } }).allow, false, "denylisted input rejected");
  assert.equal(checkInput({ body: { q: "a".repeat(300) } }).allow, false, "oversized input rejected");
  console.log("input-guardrail OK");
}
`;

const GUARD_OUT_SRC = `import assert from "node:assert/strict";
import { handle } from "./handler.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
const BLOCK = [/password/gi, /\\b\\d{3}-\\d{2}-\\d{4}\\b/g];
// redact blocked tokens in an outgoing response body.
export function redactOutput(res) {
  let s = JSON.stringify(res.body);
  for (const re of BLOCK) s = s.replace(re, "[redacted]");
  return { status: res.status, body: JSON.parse(s) };
}
if (isMain && process.argv.includes("--selftest")) {
  const out = redactOutput({ status: 200, body: { echo: { note: "my password is x", ssn: "123-45-6789" } } });
  const s = JSON.stringify(out.body);
  assert.ok(!/password/i.test(s), "password redacted");
  assert.ok(!/123-45-6789/.test(s), "ssn redacted");
  const clean = redactOutput(handle({ path: "/echo", method: "POST", body: { a: 1 } }));
  assert.deepEqual(clean.body.echo, { a: 1 }, "clean output unchanged");
  console.log("output-guardrail OK");
}
`;

const schemaWorkstream = mod({ id: "schema", signer: "codex", dependencies: [], file: "serving/schema.mjs", source: SCHEMA_SRC, needle: "export function validate", finding: "Request schema accepts conforming requests and rejects malformed ones." });
const handlerWorkstream = mod({ id: "handler", signer: "claude", dependencies: ["schema"], file: "serving/handler.mjs", source: HANDLER_SRC, needle: "export function handle", finding: "Handler validates then echoes; invalid requests get a 400." });
const inputGuardWorkstream = mod({ id: "input-guardrail", signer: "grok", dependencies: ["schema"], file: "serving/guard-in.mjs", source: GUARD_IN_SRC, needle: "export function checkInput", finding: "Input guardrail rejects oversized and denylisted input (fail-closed)." });
const outputGuardWorkstream = mod({ id: "output-guardrail", signer: "grok", dependencies: ["handler"], file: "serving/guard-out.mjs", source: GUARD_OUT_SRC, needle: "export function redactOutput", finding: "Output guardrail redacts blocked tokens and passes clean output unchanged." });

export const servingBuildWorkstreams = [schemaWorkstream, handlerWorkstream, inputGuardWorkstream, outputGuardWorkstream];
