#!/usr/bin/env node
// Adversarial code-review round on the REAL Lachesis implementation (Argo cycle 1).
// codex (rigor) + grok (adversary), high effort. Feeds the actual code + reality context;
// collects structured objections. Run from Windows node (HKCU keys).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { askCodex, askGrok } = await imp("connectors/ai-peer-mcp/server.mjs");

const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");
const files = ["lachesis/ingest.mjs", "lachesis/measure.mjs", "lachesis/scripts/test-metrics.mjs", "lachesis/scripts/test-boundary.mjs"];
const code = files.map((f) => `=== ${f} ===\n${read(f)}`).join("\n\n");

const CONTEXT =
`Lachesis is a TELOS module that MEASURES dependencies, relevance, risk, and blast radius over a committed ` +
`Clotho weave SNAPSHOT read as DATA (it NEVER imports clotho/). Registered meaning is exact: it measures; it ` +
`does not authorize/enforce/retire/weave/render. Measurement is NORMATIVE (tested); the risk CLASS is ADVISORY.\n\n` +
`HISTORY: an earlier PLAN survived 10 adversarial Daedalus rounds AND a 5-seat signed council, yet MISMODELED ` +
`its input (assumed sha256:-prefixed node ids, a 'kind' field, standalone node records). Reality: the snapshot ` +
`is a signed Ed25519 thread-ledger = 1 clotho_weave_header line + 4001 signed EDGE records + 1 trailer; nodes ` +
`are IMPLIED by from_locator/to_locator (no standalone node records); node ids are BARE 64-hex; edge kind is ` +
`'edge_kind'. This code was rebuilt against that REAL format and passes 41 self-authored assertions incl. a ` +
`smoke test over the real snapshot.\n\n` +
`DELIBERATELY PARTIAL (known, not defects to re-report unless deeper): trust root is raw-byte digest-pin ONLY ` +
`(no ledger prev_hash/record_hash/Ed25519 signature-chain verification); no institutional-memory record set, ` +
`no CURRENT-AUTHORITY wiring, no coverage-attestation resolver yet.\n\n` +
`Passing self-authored oracles is still self-report. Your job is to find what those tests MISS.`;

const PROMPT =
`${CONTEXT}\n\nAdversarially review the ACTUAL code below. Find, specifically:\n` +
`(1) correctness bugs in the metrics or ingestion (wrong results on some real/edge input);\n` +
`(2) where the metrics FAIL TO CORRESPOND to the real weave's semantics (e.g. locator identity, multi-edge-kind graphs, the header/trailer, hash-chain);\n` +
`(3) metric-semantics errors (direction, transitivity, cycle, weighted normalization, thresholds, coverage floor);\n` +
`(4) ORACLE BLIND SPOTS — properties the tests claim to pin but a wrong implementation could still pass;\n` +
`(5) trust-root / boundary holes that matter even given the stated partial scope.\n\n` +
`Return JSON {"objections":[{"scope":"...","claim":"...","severity":"high|medium|low"}]}. ` +
`An empty list must mean you genuinely found nothing.\n\n${code}`;

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { objections: { type: "array", items: {
    type: "object", additionalProperties: false,
    properties: { scope: { type: "string" }, claim: { type: "string" }, severity: { type: "string", enum: ["high", "medium", "low"] } },
    required: ["scope", "claim", "severity"] } } },
  required: ["objections"]
};

async function reviewer(name, fn, model, schema) {
  try {
    const r = await fn({ prompt: PROMPT, system: `You are the ${model} seat doing an adversarial CODE review. Judge the code as it will run against the real snapshot, not the plan's intentions. Be concrete and correct; cite the exact function/line concern.`, model, effort: "high", max_tokens: 40000, include_provenance: true, response_schema: schema, schema_name: "code_objections" });
    const text = typeof r === "string" ? r : (r.text || r.content || JSON.stringify(r));
    let parsed; try { parsed = JSON.parse(text); } catch { parsed = { objections: [], raw: String(text).slice(0, 2000) }; }
    return { name, ok: true, ...parsed };
  } catch (e) { return { name, ok: false, reason: String(e.message || e).slice(0, 200) }; }
}

const [cod, gro] = await Promise.all([
  reviewer("codex", askCodex, "codex", SCHEMA),
  reviewer("grok", askGrok, "grok", { type: "object", properties: { objections: { type: "array", items: { type: "object", properties: { scope: { type: "string" }, claim: { type: "string" }, severity: { type: "string" } } } } } })
]);

mkdirSync(HERE, { recursive: true });
writeFileSync(path.join(HERE, "review-round-1-result.json"), JSON.stringify({ codex: cod, grok: gro }, null, 2));
for (const r of [cod, gro]) {
  console.log(`\n===== ${r.name} ${r.ok ? "" : "FAILED: " + r.reason} =====`);
  for (const o of (r.objections || [])) console.log(`[${o.severity || "?"}] ${o.scope}: ${o.claim}`);
}
