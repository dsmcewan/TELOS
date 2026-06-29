// pattern.mjs — pattern schema + task-def derivation. A pattern supplies the
// workstream registry (data) that saas-forge hard-codes; the generic forge
// machinery consumes these helpers. render/checks take a pattern-supplied ctx.
import { fileURLToPath } from "node:url";

const CHECK_NODE = fileURLToPath(new URL("./checks/check-node.mjs", import.meta.url));

export function validatePattern(pattern) {
  const errors = [];
  if (!pattern || typeof pattern.id !== "string" || !pattern.id) errors.push("pattern.id must be a non-empty string");
  const ws = pattern && pattern.workstreams;
  if (!Array.isArray(ws) || ws.length === 0) { errors.push("pattern.workstreams must be a non-empty array"); return { ok: false, errors }; }
  const seen = new Set();
  for (const w of ws) {
    const id = w && w.id;
    if (typeof id !== "string" || !id) { errors.push("workstream.id must be a non-empty string"); continue; }
    if (seen.has(id)) errors.push(`duplicate workstream id '${id}'`);
    seen.add(id);
    if (typeof w.signer !== "string" || !w.signer) errors.push(`${id}: signer must be a string`);
    if (typeof w.lens !== "string" || !w.lens) errors.push(`${id}: lens must be a string`);
    if (!Array.isArray(w.files) || w.files.length === 0) errors.push(`${id}: files must be a non-empty array`);
    if (typeof w.requirements !== "string") errors.push(`${id}: requirements must be a string`);
    if (typeof w.render !== "function") errors.push(`${id}: render must be a function`);
    if (typeof w.checks !== "function") errors.push(`${id}: checks must be a function`);
    if (typeof w.findingsKey !== "string") errors.push(`${id}: findingsKey must be a string`);
    if (typeof w.finding !== "string") errors.push(`${id}: finding must be a string`);
    if (w.dependencies != null && !Array.isArray(w.dependencies)) errors.push(`${id}: dependencies must be an array`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function workstreamById(pattern, id) {
  return pattern.workstreams.find((w) => w.id === id);
}

export function nodeTestFor(ws, ctx) {
  if (ws.nodeTest) return ws.nodeTest;
  return { cmd: "node", args: [CHECK_NODE, JSON.stringify(ws.checks(ctx))] };
}

export function signerForTask(pattern) {
  return (id) => workstreamById(pattern, id)?.signer || "claude";
}

export function patternTaskDefs(pattern, ctx) {
  return pattern.workstreams.map((ws) => ({
    id: ws.id,
    files: ws.files,
    requirements: ws.requirements,
    test: nodeTestFor(ws, ctx),
    dependencies: ws.dependencies || []
  }));
}
