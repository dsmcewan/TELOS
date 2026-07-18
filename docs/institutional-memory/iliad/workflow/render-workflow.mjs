#!/usr/bin/env node
// render-workflow.mjs — deterministic human projection of workflow.json. Pure Node >=18
// ESM, zero deps, no network. Named destination: ./README.md (this directory only).
// Deterministic relationship: README.md is a pure function of workflow.json. --write
// regenerates it; --check renders in memory and exits nonzero unless the committed
// README.md is byte-identical (read-only, fail-closed).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.join(HERE, "README.md");
const wf = JSON.parse(readFileSync(path.join(HERE, "workflow.json"), "utf8"));

const L = [];
L.push("<!-- GENERATED FILE — do not edit by hand. Rendered by render-workflow.mjs from workflow.json.");
L.push("     Regenerate: node render-workflow.mjs --write ; verify: node render-workflow.mjs --check -->");
L.push("");
L.push(`# ${wf.title}`);
L.push("");
L.push(`> **${wf.status} · normativity: ${wf.normativity}.** ${wf.what}`);
L.push("");
L.push(`**Quest premise:** ${wf.quest_premise}`);
L.push("");
L.push("## The quest — canonical stage order");
L.push("");
L.push("| # | stage | role | owning module | enforced-by (linked invariant) |");
L.push("|---|---|---|---|---|");
for (const s of wf.stages) {
  const owner = String(s.owning_module).replace(/^file:/, "").replace(/@[0-9a-f]{40}$/, "");
  const link = s.authority_link ? "`" + String(s.authority_link).replace(/^file:.*#/, "") + "`" : (s.advisory ? "_advisory (option b)_" : "—");
  L.push(`| ${s.order} | **${s.stage}** | ${s.role} | \`${owner}\` | ${link} |`);
}
L.push("");
L.push(`**New stage:** ${wf.new_stage_promotion}`);
L.push("");
L.push(`**Non-claim:** ${wf.non_claim}`);
L.push("");
L.push(`**Authority:** \`${wf.authority}\``);
L.push("");
const rendered = L.join("\n");

if (process.argv.includes("--write")) { writeFileSync(TARGET, rendered); console.log("README.md written"); }
else if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(TARGET, "utf8"); } catch {}
  if (cur !== rendered) { console.error("render-workflow --check: README.md is NOT byte-identical to workflow.json"); process.exit(1); }
  console.log("render-workflow --check OK");
} else { process.stdout.write(rendered); }
