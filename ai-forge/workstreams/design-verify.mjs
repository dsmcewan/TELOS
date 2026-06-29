#!/usr/bin/env node
// design-verify.mjs — verify docs/DESIGN.md against ground truth (plan + ledger +
// disk). Run with cwd = project root. Exit 0 if consistent; exit 1 with a
// "DESIGN_DRIFT: <reason>" message on the first failed check. Zero deps.
import { readFileSync, existsSync } from "node:fs";

function fail(msg) { console.error("DESIGN_DRIFT: " + msg); process.exit(1); }
function eqSet(a, b) { return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()); }

let plan, ledger, designMd;
try { plan = JSON.parse(readFileSync(".telos/plan.json", "utf8")); } catch (e) { fail("cannot read .telos/plan.json: " + e.message); }
try { ledger = readFileSync(".telos/ledger.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { fail("cannot read .telos/ledger.jsonl: " + e.message); }
try { designMd = readFileSync("docs/DESIGN.md", "utf8"); } catch (e) { fail("cannot read docs/DESIGN.md: " + e.message); }

const m = designMd.match(/```json\s*([\s\S]*?)```/);
if (!m) fail("no fenced ```json component block in DESIGN.md");
let components;
try { components = JSON.parse(m[1]); } catch (e) { fail("component block is not valid JSON: " + e.message); }
if (!Array.isArray(components)) fail("component block must be a JSON array");

const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
const nodeById = new Map(nodes.map((n) => [n.id, n]));
const expected = nodes.map((n) => n.id).filter((id) => id !== "design");
const signerByTask = new Map(ledger.map((r) => [r.task_id, r.signer]));

// (a) coverage exact
const got = components.map((c) => c.workstream);
if (!eqSet(got, expected)) fail("coverage: components " + JSON.stringify([...got].sort()) + " != plan workstreams " + JSON.stringify([...expected].sort()));

for (const c of components) {
  const node = nodeById.get(c.workstream);
  if (!node) fail("phantom component: " + c.workstream);
  // (b) data-flow == dep DAG
  if (!eqSet(c.depends_on || [], node.dependencies || [])) fail("data-flow[" + c.workstream + "]: " + JSON.stringify([...(c.depends_on || [])].sort()) + " != plan deps " + JSON.stringify([...(node.dependencies || [])].sort()));
  // (c) realized: artifact in plan files + on disk (no path escape)
  if (typeof c.artifact !== "string" || c.artifact.includes("..")) fail("artifact[" + c.workstream + "]: invalid path " + c.artifact);
  if (!(node.files || []).includes(c.artifact)) fail("artifact[" + c.workstream + "]: " + c.artifact + " not in plan files " + JSON.stringify(node.files));
  if (!existsSync(c.artifact)) fail("artifact[" + c.workstream + "]: " + c.artifact + " not on disk");
  // (d) model == ledger signer
  const signer = signerByTask.get(c.workstream);
  if (signer === undefined) fail("no ledger entry for " + c.workstream);
  if (c.model !== signer) fail("model[" + c.workstream + "]: design says " + c.model + " but ledger signer is " + signer);
}

// (e) sections present + non-empty
const SECTIONS = ["Component boundaries", "Data flow", "Model/infra choices", "Eval plan", "Risks"];
for (const s of SECTIONS) {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(^|\\n)##\\s*" + esc + "\\n([\\s\\S]*?)(?=\\n#+\\s|$)", "i");
  const mm = designMd.match(re);
  if (!mm || mm[2].trim().length === 0) fail("section missing or empty: " + s);
}

console.log("design-verify OK (" + components.length + " components, all checks passed)");
