#!/usr/bin/env node
// The Eye routed two Lachesis design decisions to "the GPT model". This asks codex to RULE
// (definitively, with exact specs) on: (1) the relevance formula; (2) node-identity + trust-root
// scope for cycle 1. Its rulings are then implemented verbatim.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const { askCodex } = await import(pathToFileURL(path.join(ROOT, "connectors/ai-peer-mcp/server.mjs")).href);
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

const PROMPT =
`You are the GPT seat. The Eye has delegated TWO Lachesis design decisions to you; rule definitively and give\n` +
`EXACT, implementable specifications. Lachesis MEASURES dependencies, relevance, risk, blast radius over a\n` +
`committed Clotho weave SNAPSHOT read as DATA; it NEVER imports clotho/ (frozen spine boundary), and\n` +
`reimplementing clotho logic risks drift.\n\n` +
`REAL weave edge orientations (verified against the snapshot):\n` +
`  depends-on:    from = dependent  -> to = dependency\n` +
`  verified-by:   from = subject(file/symbol) -> to = test  (X verified-by its test)\n` +
`  introduced-by: from = subject(file) -> to = commit\n` +
`  (also present: documented-in, evidenced-by, discharges, motivated-by, supersedes)\n\n` +
`DECISION 1 — relevance formula. In round 3 you argued the fix to the fiction-plan's mis-weighting\n` +
`(depends-on*3+verified-by*2+introduced-by*1, crediting the TO endpoint) is to CREDIT THE FROM endpoint of\n` +
`verified-by/introduced-by, not drop them. My interim code uses relevance = normalized depends-on in-degree\n` +
`only. RULE: give the exact relevance formula — which edge kinds contribute, which ENDPOINT each credits,\n` +
`the exact weights, and the normalization — such that it is a distinct, defensible measure and fully\n` +
`oracle-able against golden real-snapshot values. State whether relevance should feed riskClass.\n\n` +
`DECISION 2 — node-identity + trust-root scope for CYCLE 1. Reviewers (you + grok, 3 rounds) want node ids\n` +
`verified as content-addresses of their locators (from_node == deriveNodeId(from_locator)) and the manifest\n` +
`digest authenticated — but deriveNodeId lives in clotho/registry.mjs (cannot import; reimplement = drift),\n` +
`and durable trust-root anchoring (manifest digest pinned in CURRENT-AUTHORITY) is unwired. Choose ONE and\n` +
`specify exactly what cycle-1 must implement + what it must NON-CLAIM:\n` +
`  (A) pragmatic partial: intra-snapshot consistency (reject locator<->id aliases both directions) + digest-\n` +
`      pin, explicit NON-CLAIMs for full re-derivation + durable anchoring;\n` +
`  (B) full rigor now: reimplement deriveNodeId (pinned+oracled vs clotho) AND wire CURRENT-AUTHORITY;\n` +
`      specify how to bound drift;\n` +
`  (C) stop Argo, back to Daedalus+TELOS for the corrected scope.\n\n` +
`Return JSON {"relevance":{"formula":"...","per_kind":"...","feeds_riskclass":true|false,"rationale":"..."},` +
`"identity_scope":{"ruling":"A|B|C","must_implement":["..."],"must_nonclaim":["..."],"rationale":"..."}}.\n\n` +
`=== current measure.mjs ===\n${read("lachesis/measure.mjs")}\n\n=== current ingest.mjs ===\n${read("lachesis/ingest.mjs")}`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    relevance: { type: "object", additionalProperties: false, properties: { formula: { type: "string" }, per_kind: { type: "string" }, feeds_riskclass: { type: "boolean" }, rationale: { type: "string" } }, required: ["formula", "per_kind", "feeds_riskclass", "rationale"] },
    identity_scope: { type: "object", additionalProperties: false, properties: { ruling: { type: "string", enum: ["A", "B", "C"] }, must_implement: { type: "array", items: { type: "string" } }, must_nonclaim: { type: "array", items: { type: "string" } }, rationale: { type: "string" } }, required: ["ruling", "must_implement", "must_nonclaim", "rationale"] }
  },
  required: ["relevance", "identity_scope"]
};

const r = await askCodex({ prompt: PROMPT, system: "You are the GPT seat making a binding design ruling for Lachesis. Be decisive, exact, and implementable. Prefer the smallest correct construction; respect the frozen no-clotho-import boundary.", model: "codex", effort: "high", max_tokens: 30000, include_provenance: true, response_schema: SCHEMA, schema_name: "lachesis_rulings" });
const text = typeof r === "string" ? r : (r.text || r.content || JSON.stringify(r));
let parsed; try { parsed = JSON.parse(text); } catch { parsed = { raw: String(text).slice(0, 4000) }; }
mkdirSync(HERE, { recursive: true });
writeFileSync(path.join(HERE, "decision-round-3-result.json"), JSON.stringify(parsed, null, 2));
console.log(JSON.stringify(parsed, null, 2));
