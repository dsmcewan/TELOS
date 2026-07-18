#!/usr/bin/env node
// The Eye delegated two Atropos governance decisions to the GPT seat. This asks codex to RULE
// (definitively, implementable) on: (1) supersession SURFACE SCOPE; (2) ANCHORING requirement.
// Rulings are then implemented verbatim. Modeled on docs/runs/lachesis-argo-1/decide-round-3.mjs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const { askCodex } = await import(pathToFileURL(path.join(ROOT, "connectors/ai-peer-mcp/server.mjs")).href);
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

const PROMPT =
`You are the GPT seat. The Eye has delegated TWO Atropos governance decisions to you; rule definitively and\n` +
`give EXACT, implementable specifications. Atropos is a READ-ONLY supersession VERIFIER (The Eye's ruling): it\n` +
`detects + verifies supersession consistency over a committed TELOS repo; it NEVER mutates CURRENT-AUTHORITY\n` +
`and does NOT perform retirement (authoring a supersession stays a human CHANGE-PROTOCOL step). Zero-dep,\n` +
`never imports clotho/, reads data only.\n\n` +
`VERIFIED FACTS (established by inspection, not assumed):\n` +
`  - CHANGE-PROTOCOL.md is status:"living" (NOT frozen); its supersession row: "Retiring an obsolete\n` +
`    relationship/artifact/plan | Mark SUPERSEDED with superseded_by + must_not_govern_new_work:true (Atropos);\n` +
`    record the supersedes edge; update CURRENT-AUTHORITY.json." It also says its scope must not be silently\n` +
`    reinterpreted — route changes through it.\n` +
`  - The committed weave snapshot has 0 supersedes edges and 0 records with live status:"SUPERSEDED".\n` +
`  - CURRENT-AUTHORITY.json#superseded has 4 real entries, ALL plan-versions (v11..v14), closed keys\n` +
`    {plan_version, sha256, authorization, authz_status, superseded_by, must_not_govern_new_work, note},\n` +
`    all superseded_by "v15" = active_plan.version, all must_not_govern_new_work:true.\n` +
`  - A PLAN-VERSION is NOT one of the weave node kinds (code-symbol, repository-file, test, commit, concern,\n` +
`    obligation, contract-clause, doc-section, run-evidence). So a plan-version retirement STRUCTURALLY cannot\n` +
`    carry a weave supersedes edge — that surface is INAPPLICABLE to plans, not a missing/defective surface.\n\n` +
`DECISION 1 — SUPERSESSION SURFACE SCOPE. CHANGE-PROTOCOL names three surfaces (record SUPERSEDED; weave\n` +
`supersedes edge; CURRENT-AUTHORITY update). Choose and specify EXACTLY what the verifier must enforce:\n` +
`  (A) CURRENT-AUTHORITY#superseded is the SINGLE normative surface; weave-edge + SUPERSEDED-record are\n` +
`      advisory cross-checks. (Risk: a verifier could bless an artifact/record retirement missing a mandated\n` +
`      surface.)\n` +
`  (B) PER-ENTITY-KIND scope: the normative surface set depends on WHAT is retired —\n` +
`      plan-version retirement -> {CURRENT-AUTHORITY#superseded entry + superseded_by + must_not_govern_new_work};\n` +
`      weave edge N/A (no weave node for a plan); artifact/record retirement -> {record SUPERSEDED +\n` +
`      superseded_by + must_not_govern_new_work} + {weave supersedes edge} + {CURRENT-AUTHORITY reflection},\n` +
`      all NORMATIVE for that kind. Demotes nothing; scopes each surface to its applicable kind.\n` +
`RULE A or B (or a precise variant). Specify per entity kind: which surfaces are NORMATIVE, what the verifier\n` +
`checks, how it decides an entity's kind, and what makes the verdict 'consistent' vs 'inconsistent'.\n\n` +
`DECISION 2 — ANCHORING. Does formalizing Atropos's supersession-verification scope (a reading of\n` +
`CHANGE-PROTOCOL's supersession rule) require a small ANCHORED CHANGE-PROTOCOL clarification (an anchored\n` +
`decision / amendment), or is the Atropos pre-review + the eventual TELOS authz sufficient to anchor\n` +
`CONTRACTS/supersession.json? Rule + state the EXACT anchoring requirement (what must reference what).\n\n` +
`Return JSON {"surface_scope":{"ruling":"A|B|variant","per_kind":[{"entity_kind":"...","normative_surfaces":["..."],"checks":["..."]}],"consistent_when":"...","kind_detection":"...","rationale":"..."},` +
`"anchoring":{"ruling":"...","requirement":"...","rationale":"..."}}.\n\n` +
`=== Atropos candidate-approach.md ===\n${read("docs/runs/atropos-1-workshop/candidate-approach.md")}`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    surface_scope: {
      type: "object", additionalProperties: false,
      properties: {
        ruling: { type: "string" },
        per_kind: { type: "array", items: { type: "object", additionalProperties: false, properties: { entity_kind: { type: "string" }, normative_surfaces: { type: "array", items: { type: "string" } }, checks: { type: "array", items: { type: "string" } } }, required: ["entity_kind", "normative_surfaces", "checks"] } },
        consistent_when: { type: "string" }, kind_detection: { type: "string" }, rationale: { type: "string" }
      },
      required: ["ruling", "per_kind", "consistent_when", "kind_detection", "rationale"]
    },
    anchoring: { type: "object", additionalProperties: false, properties: { ruling: { type: "string" }, requirement: { type: "string" }, rationale: { type: "string" } }, required: ["ruling", "requirement", "rationale"] }
  },
  required: ["surface_scope", "anchoring"]
};

const r = await askCodex({ prompt: PROMPT, system: "You are the GPT seat making a binding governance ruling for Atropos. Be decisive, exact, implementable. Read CHANGE-PROTOCOL truly; respect that it is living but must not be silently reinterpreted; respect the no-clotho-import boundary and the read-only scope.", model: "codex", effort: "high", max_tokens: 30000, include_provenance: true, response_schema: SCHEMA, schema_name: "atropos_rulings" });
const text = typeof r === "string" ? r : (r.text || r.content || JSON.stringify(r));
let parsed; try { parsed = JSON.parse(text); } catch { parsed = { raw: String(text).slice(0, 4000) }; }
mkdirSync(HERE, { recursive: true });
writeFileSync(path.join(HERE, "decision-round-1-result.json"), JSON.stringify(parsed, null, 2));
console.log(JSON.stringify(parsed, null, 2));
