#!/usr/bin/env node
// render.mjs — deterministic README projection of the agentic-orchestration reference
// records. Pure Node >=18 ESM, zero deps, no network, writes ONLY this directory's
// README.md. --write regenerates it; --check renders in memory and exits nonzero unless
// the committed README is byte-identical (read-only, fail-closed).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (rel) => JSON.parse(readFileSync(path.join(HERE, rel), "utf8"));
const ref = load("reference.json");
const tax = load("CONTRACTS/pattern-taxonomy.json");
const cl = load("CONTRACTS/decision-checklist.json");
const nc = load("NON-CLAIMS.json");
const src = load("EVIDENCE/anthropic-sources.json");
const wex = load("EVIDENCE/telos-worked-examples.json");

const L = [];
L.push("<!-- GENERATED FILE — do not edit by hand.");
L.push("     Rendered by render.mjs from: reference.json, CONTRACTS/pattern-taxonomy.json,");
L.push("     CONTRACTS/decision-checklist.json, NON-CLAIMS.json, EVIDENCE/*.json.");
L.push("     Regenerate: node render.mjs --write ; verify: node render.mjs --check -->");
L.push("");
L.push(`# ${ref.title}`);
L.push("");
L.push(`> **${ref.status} · normativity: ${ref.normativity}.** ${ref.what}`);
L.push("");
L.push(`**Why:** ${ref.why}`);
L.push("");
L.push(`**Scope:** ${ref.scope}`);
L.push("");
L.push(`**Authority:** \`${ref.authority}\``);
L.push("");
L.push("## Pattern taxonomy (five workflows + one agent)");
L.push("");
L.push("| pattern | class | definition | use when | cautions |");
L.push("|---|---|---|---|---|");
for (const p of tax.patterns) L.push(`| **${p.key}** | ${p.classification} | ${p.definition} | ${p.use_when} | ${p.cautions} |`);
L.push("");
L.push(`## ${cl.title}`);
L.push("");
L.push(`_${cl.non_claim}_`);
L.push("");
for (const s of cl.steps) L.push(`${s.n}. **${s.step}** ${s.detail}`);
L.push("");
L.push("## TELOS worked examples (advisory structural correspondences)");
L.push("");
for (const e of wex.examples) {
  L.push(`- **${e.key}** → _${e.related_pattern}_. ${e.mapping_basis} Non-claim: ${e.example_non_claim}`);
}
L.push("");
L.push("## Non-claims");
L.push("");
for (const n of nc.non_claims) L.push(`- ${n}`);
L.push("");
L.push("## Sources (provenance metadata — locators, not authority)");
L.push("");
for (const s of src.sources) L.push(`- [${s.title}](${s.url}) — ${s.publisher}`);
L.push(`\nEvidence is pinned by content-addressed \`file:@<sha>\` references in the records; a URL is provenance only. Cross-cutting rules (e.g. "convergence is not authorization") are linked to their own canonical authority, not restated here.`);
L.push("");
const rendered = L.join("\n");

const target = path.join(HERE, "README.md");
if (process.argv.includes("--write")) { writeFileSync(target, rendered); console.log("README.md written"); }
else if (process.argv.includes("--check")) {
  let cur = ""; try { cur = readFileSync(target, "utf8"); } catch {}
  if (cur !== rendered) { console.error("render --check: README.md is NOT byte-identical to the records"); process.exit(1); }
  console.log("render --check OK (README byte-identical to records)");
} else { process.stdout.write(rendered); }
