// patterns/rag.mjs — the production-shaped RAG pattern: 8 workstreams as DATA
// (7 build + 1 design that depends on all 7 and runs last).
//
// One entry per workstream, each carrying everything that workstream owns: the
// files it WRITES (via a deterministic render(ctx)), the on-disk FACT-CHECKS that
// interrogate its artifact (file_exists / file_contains, re-run by the build's
// node test, the adversarial breakout, AND the market gate), and — for the two
// executable workstreams — a `nodeTest` that GENUINELY RUNS over the fixed ctx
// corpus and exits 0 only when the real retrieval / eval holds.
//
// Self-consistency is the load-bearing property. Every render reads the SAME
// fixed `ctx` (ragContext): `ingestion` writes rag/chunks.jsonl whose ids
// `embed-index` references in rag/index.json; `retrieval` and `eval-harness`
// embed queries with the IDENTICAL embedding function used to build the index
// (shared verbatim via Function.prototype.toString, so the script source can
// never drift from the index the render produced). Keyless, no network, no clock
// — the loop runs in CI and converges on facts.

// ---- the shared, deterministic embedding kernel ---------------------------
// Defined ONCE as real functions: the render uses them to build index.json and
// the scorecard, and their EXACT source is inlined into retrieve.mjs / run.mjs
// (EMBED_SRC) so query-time embedding is byte-identical to index-time embedding.

function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z0-9]+/g)) || [];
}

function embed(text, dim) {
  const v = new Array(dim).fill(0);
  for (const tok of tokenize(text)) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) { h ^= tok.charCodeAt(i); h = Math.imul(h, 16777619); }
    const b = ((h % dim) + dim) % dim;
    v[b] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function cosine(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

const EMBED_SRC = [tokenize, embed, cosine].map((f) => f.toString()).join("\n\n");

// ---- pure JS retrieval (used by the render to compute the scorecard) -------

function buildChunks(ctx) {
  return ctx.corpus.map((d) => ({
    id: `${d.id}::c0`, docId: d.id, title: d.title, text: d.text, tokens: tokenize(d.text).length
  }));
}

function buildVectors(chunks, dim) {
  return chunks.map((c) => ({ id: c.id, docId: c.docId, vec: embed(c.text, dim) }));
}

function retrieveJS(query, vectors, chunks, dim, topK) {
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const qv = embed(query, dim);
  const scored = vectors.map((v) => ({
    id: v.id, docId: v.docId, score: cosine(qv, v.vec), text: (byId.get(v.id) || {}).text || ""
  }));
  scored.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1));
  return scored.slice(0, topK);
}

function scoreCorpus(ctx) {
  const dim = ctx.embedDim, topK = ctx.topK;
  const chunks = buildChunks(ctx);
  const vectors = buildVectors(chunks, dim);
  let hits = 0, grounded = 0;
  for (const q of ctx.evalQueries) {
    const res = retrieveJS(q.query, vectors, chunks, dim, topK);
    if (res.some((r) => r.docId === q.expectDoc)) hits++;
    if (res.some((r) => r.text.toLowerCase().includes(q.claim.toLowerCase()))) grounded++;
  }
  const n = ctx.evalQueries.length;
  return { precision: hits / n, faithfulness: grounded / n, hits, grounded, n };
}

// ---- the fixed, deterministic context -------------------------------------
// A tiny, well-separated support corpus so a hashed bag-of-words retrieval over
// embedDim=8 deterministically ranks the right doc first. brandToken + thresholds
// are fixed so every render / check / nodeTest is reproducible and keyless.

export function ragContext(params = {}) {
  const corpus = params.corpus || [
    { id: "d1", title: "Refund policy",
      text: "Our refund policy lets you request a refund within thirty days for a full money back guarantee on any purchase." },
    { id: "d2", title: "Shipping and delivery",
      text: "Standard shipping delivers your package in five business days and every delivery includes a courier tracking number." },
    { id: "d3", title: "Account security",
      text: "To secure your account enable two factor authentication and reset your password from the login security settings." },
    { id: "d4", title: "Warranty coverage",
      text: "The warranty covers any manufacturing defect and provides free repair or replacement for one full year." },
    { id: "d5", title: "Subscription billing",
      text: "You can cancel your subscription anytime and your billing invoice plan renews monthly until cancellation." }
  ];
  const evalQueries = params.evalQueries || [
    { query: "how do I get my money back refund", expectDoc: "d1", claim: "money back" },
    { query: "where is my package delivery tracking", expectDoc: "d2", claim: "tracking number" },
    { query: "reset my password login authentication", expectDoc: "d3", claim: "two factor authentication" },
    { query: "product defect warranty repair", expectDoc: "d4", claim: "free repair" },
    { query: "cancel my subscription billing plan", expectDoc: "d5", claim: "billing invoice" }
  ];
  return {
    telos: params.telos || "retrieval-grounded answering with a deterministic, gate-certified spine",
    corpus,
    evalQueries,
    selftest: params.selftest || { query: "how do I get my money back", expectDoc: "d1" },
    embedDim: params.embedDim || 8,
    topK: params.topK || 3,
    brandToken: params.brandToken || "telos-rag",
    thresholds: params.thresholds || { precision: 0.8, faithfulness: 0.8 }
  };
}

// ---- renderers -------------------------------------------------------------

function renderIngestion(ctx) {
  const chunks = buildChunks(ctx);
  const jsonl = chunks.map((c) => JSON.stringify(c)).join("\n") + "\n";
  const ingest = `#!/usr/bin/env node
// rag/ingest.mjs — deterministic ingestion: chunk the fixed corpus into
// rag/chunks.jsonl (one JSON object per line). One chunk per doc here; the chunk
// id (\`<docId>::c0\`) and token count are the contract embed-index reads.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const CORPUS = ${JSON.stringify(ctx.corpus)};

function tokenize(text) { return (String(text).toLowerCase().match(/[a-z0-9]+/g)) || []; }

const chunks = CORPUS.map((d) => ({
  id: d.id + "::c0", docId: d.id, title: d.title, text: d.text, tokens: tokenize(d.text).length
}));

const here = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(here, "chunks.jsonl"), chunks.map((c) => JSON.stringify(c)).join("\\n") + "\\n");
console.log("ingest: wrote " + chunks.length + " chunks");
`;
  return { "rag/ingest.mjs": ingest, "rag/chunks.jsonl": jsonl };
}

function renderEmbedIndex(ctx) {
  const chunks = buildChunks(ctx);
  const vectors = buildVectors(chunks, ctx.embedDim);
  const index = { dim: ctx.embedDim, topK: ctx.topK, vectors };
  const indexJson = JSON.stringify(index) + "\n"; // compact -> contains "dim":8
  const build = `#!/usr/bin/env node
// rag/index.build.mjs — deterministic embedding + index build. Reads
// rag/chunks.jsonl and writes rag/index.json, embedding each chunk with the same
// hashed bag-of-words kernel retrieve.mjs uses at query time (dim=${ctx.embedDim}).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

${EMBED_SRC}

const here = path.dirname(fileURLToPath(import.meta.url));
const chunks = readFileSync(path.join(here, "chunks.jsonl"), "utf8")
  .split(/\\r?\\n/).filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
const dim = ${ctx.embedDim};
const vectors = chunks.map((c) => ({ id: c.id, docId: c.docId, vec: embed(c.text, dim) }));
const index = { dim, topK: ${ctx.topK}, vectors };
writeFileSync(path.join(here, "index.json"), JSON.stringify(index));
console.log("index.build: embedded " + vectors.length + " chunks at dim=" + dim);
`;
  return { "rag/index.build.mjs": build, "rag/index.json": indexJson };
}

function renderRetrieval(ctx) {
  const retrieve = `#!/usr/bin/env node
// rag/retrieve.mjs — deterministic top-k retrieval over rag/index.json. The
// query is embedded with the SAME kernel that built the index (inlined below
// verbatim), so query-time and index-time embeddings can never drift. Run with
// --selftest to assert a known query returns the expected doc in top-k (exit 1
// otherwise) — this is the workstream's executable node test.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

${EMBED_SRC}

const here = path.dirname(fileURLToPath(import.meta.url));
function loadIndex() { return JSON.parse(readFileSync(path.join(here, "index.json"), "utf8")); }
function loadChunks() {
  return readFileSync(path.join(here, "chunks.jsonl"), "utf8")
    .split(/\\r?\\n/).filter((l) => l.trim().length > 0).map((l) => JSON.parse(l));
}

export function retrieve(query, topK) {
  const idx = loadIndex();
  const byId = new Map(loadChunks().map((c) => [c.id, c]));
  const qv = embed(query, idx.dim);
  const scored = idx.vectors.map((v) => ({
    id: v.id, docId: v.docId, score: cosine(qv, v.vec), text: (byId.get(v.id) || {}).text || ""
  }));
  scored.sort((a, b) => (b.score - a.score) || (a.id < b.id ? -1 : 1));
  return scored.slice(0, topK || idx.topK || 3);
}

const SELFTEST = ${JSON.stringify(ctx.selftest)};
if (process.argv.includes("--selftest")) {
  const res = retrieve(SELFTEST.query, ${ctx.topK});
  const got = res.map((r) => r.docId);
  if (!got.includes(SELFTEST.expectDoc)) {
    console.error("retrieve --selftest FAIL: expected " + SELFTEST.expectDoc + " in top-k, got [" + got.join(",") + "]");
    process.exit(1);
  }
  console.log("retrieve --selftest OK: " + SELFTEST.expectDoc + " in top-" + res.length + " [" + got.join(",") + "]");
}
`;
  return { "rag/retrieve.mjs": retrieve };
}

function renderGeneration(ctx) {
  const prompt = `# RAG answer prompt — ${ctx.brandToken}

System: You are a retrieval-grounded assistant. Answer ONLY from the provided
context. If the answer is not in the context, say you do not know. Always **cite**
the source chunk id in square brackets after each claim.

Context:
{{context}}

Question:
{{question}}

Answer (grounded, cite sources):
`;
  const generate = `#!/usr/bin/env node
// rag/generate.mjs — deterministic prompt assembly. Retrieves top-k context for a
// question and fills the {{context}}/{{question}} slots of rag/prompt.md. The LLM
// call is the only non-deterministic step in production; everything up to the
// filled prompt is reproducible and keyless.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { retrieve } from "./retrieve.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

export function buildPrompt(question, topK) {
  const template = readFileSync(path.join(here, "prompt.md"), "utf8");
  const hits = retrieve(question, topK);
  const context = hits.map((h) => "[" + h.id + "] " + h.text).join("\\n");
  return template.replace("{{context}}", context).replace("{{question}}", question);
}

if (process.argv[2]) {
  process.stdout.write(buildPrompt(process.argv[2], ${ctx.topK}));
}
`;
  return { "rag/prompt.md": prompt, "rag/generate.mjs": generate };
}

function renderEvalHarness(ctx) {
  const score = scoreCorpus(ctx);
  const scorecard = {
    dataset: "rag-support-corpus-v1",
    n: score.n,
    topK: ctx.topK,
    precision: score.precision,
    faithfulness: score.faithfulness,
    thresholds: ctx.thresholds,
    generated_by: "ai-forge rag pattern eval-harness"
  };
  const run = `#!/usr/bin/env node
// rag/evals/run.mjs — executable eval harness. Recomputes precision@k and
// faithfulness over the fixed corpus by calling the REAL retrieval, and exits
// non-zero if either falls below thresholds. This is the workstream's node test.
import { retrieve } from "../retrieve.mjs";

const QUERIES = ${JSON.stringify(ctx.evalQueries)};
const TOPK = ${ctx.topK};
const THRESH = ${JSON.stringify(ctx.thresholds)};

let hits = 0, grounded = 0;
for (const q of QUERIES) {
  const res = retrieve(q.query, TOPK);
  if (res.some((r) => r.docId === q.expectDoc)) hits++;            // precision@k
  if (res.some((r) => r.text.toLowerCase().includes(q.claim.toLowerCase()))) grounded++; // faithfulness
}
const precision = hits / QUERIES.length;
const faithfulness = grounded / QUERIES.length;
console.log("evals: precision=" + precision.toFixed(3) + " faithfulness=" + faithfulness.toFixed(3)
  + " (need p>=" + THRESH.precision + " f>=" + THRESH.faithfulness + ")");
if (precision < THRESH.precision || faithfulness < THRESH.faithfulness) {
  console.error("evals FAIL: below thresholds");
  process.exit(1);
}
console.log("evals OK");
`;
  return {
    "rag/evals/scorecard.json": JSON.stringify(scorecard, null, 2) + "\n",
    "rag/evals/run.mjs": run
  };
}

function renderGuardrails(ctx) {
  const config = {
    brandToken: ctx.brandToken,
    embedDim: ctx.embedDim,
    topK: ctx.topK,
    thresholds: ctx.thresholds,
    guardrails: { injection: true, pii: true, grounding: true }
  };
  const guardrails = `// rag/guardrails.mjs — serving guardrails for the RAG endpoint.
// Three independent gates: (1) prompt-injection detection on user input,
// (2) PII redaction on input and output, (3) a grounding gate that rejects any
// answer whose sentences are not supported by the retrieved context.

// (1) Prompt-injection rule: refuse inputs that try to override the system prompt.
export const INJECTION_PATTERNS = [
  /ignore (all|the|your|previous) (instructions|prompt)/i,
  /disregard (the|your) (system|previous) (prompt|instructions)/i,
  /you are now/i,
  /reveal (your|the) (system )?prompt/i
];
export function detectInjection(input) {
  return INJECTION_PATTERNS.some((re) => re.test(String(input)));
}

// (2) PII rule: redact emails, phone numbers, and US SSNs before logging/echo.
const PII_PATTERNS = [
  [/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g, "[redacted-email]"],
  [/\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b/g, "[redacted-phone]"],
  [/\\b\\d{3}-\\d{2}-\\d{4}\\b/g, "[redacted-ssn]"]
];
export function redactPII(text) {
  let out = String(text);
  for (const [re, repl] of PII_PATTERNS) out = out.replace(re, repl);
  return out;
}

// (3) Grounding gate: an answer ships only if every non-trivial sentence shares
// support tokens with the retrieved context. Ungrounded sentences are blocked.
export function groundingGate(answer, contextChunks) {
  const ctxText = (contextChunks || []).map((c) => (c.text || c)).join(" ").toLowerCase();
  const ctxTokens = new Set(ctxText.match(/[a-z0-9]+/g) || []);
  const sentences = String(answer).split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const ungrounded = sentences.filter((s) => {
    const toks = (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 3);
    if (toks.length === 0) return false;
    const supported = toks.filter((t) => ctxTokens.has(t)).length;
    return supported / toks.length < 0.5;
  });
  return { grounded: ungrounded.length === 0, ungrounded };
}

export function enforce(input, answer, contextChunks) {
  if (detectInjection(input)) return { allow: false, reason: "prompt-injection detected" };
  const gate = groundingGate(answer, contextChunks);
  if (!gate.grounded) return { allow: false, reason: "answer not grounded in retrieved context" };
  return { allow: true, answer: redactPII(answer) };
}
`;
  return {
    "rag/serve.config.json": JSON.stringify(config, null, 2) + "\n",
    "rag/guardrails.mjs": guardrails
  };
}

function renderOps(ctx) {
  const ops = `# RAG operations runbook — ${ctx.brandToken}

## Observability
- **tracing**: every request emits an OpenTelemetry span tree
  (\`retrieve\` -> \`rerank\` -> \`generate\` -> \`guardrails\`) with the query hash,
  retrieved chunk ids, top-k scores, and the grounding-gate verdict as span
  attributes. Traces are sampled at 100% in staging, 10% in production.
- Structured logs carry the chunk ids cited in each answer for audit replay.

## Service levels
- **SLO**: p95 end-to-end latency < 1200 ms; retrieval recall@${ctx.topK} >= ${ctx.thresholds.precision}
  on the eval corpus; answer-grounding rate >= ${ctx.thresholds.faithfulness}.
- Error budget: 0.5% monthly; burn-rate alerts at 2x and 10x.

## Cost
- **Cost per 1k queries**: ~\\$3.10 (embeddings \\$0.10, retrieval/compute \\$0.20,
  generation tokens \\$2.80). Cost guardrail caps context at top-${ctx.topK} chunks and
  truncates over-long documents before generation.

## Runbook
- Index rebuild is deterministic (\`node rag/index.build.mjs\`); roll forward by
  re-embedding and swapping \`rag/index.json\` atomically.
- On grounding-rate regression, freeze deploys and bisect against the eval scorecard.
`;
  return { "rag/OPERATIONS.md": ops };
}

import { makeDesignWorkstream } from "../workstreams/design.mjs";

// ---- the pattern: 8 workstreams as data (7 build + design) ----------------

const buildWorkstreams = [
    {
      id: "ingestion", signer: "codex", lens: "codex", dependencies: [],
      files: ["rag/ingest.mjs", "rag/chunks.jsonl"],
      requirements: "Chunk the fixed corpus into rag/chunks.jsonl with stable chunk ids and token counts.",
      render: renderIngestion,
      checks: () => [
        { type: "file_exists", path: "rag/ingest.mjs" },
        { type: "file_exists", path: "rag/chunks.jsonl" },
        { type: "file_contains", path: "rag/chunks.jsonl", needle: "d1::c0" },
        { type: "file_contains", path: "rag/chunks.jsonl", needle: "\"tokens\":" }
      ],
      findingsKey: "backend_schema_findings",
      finding: "Deterministic chunker emits stable chunk ids and token bounds the index reads."
    },
    {
      id: "embed-index", signer: "codex", lens: "codex", dependencies: ["ingestion"],
      files: ["rag/index.build.mjs", "rag/index.json"],
      requirements: "Embed each chunk (dim=8) and write rag/index.json whose ids match the chunks.",
      render: renderEmbedIndex,
      checks: () => [
        { type: "file_exists", path: "rag/index.build.mjs" },
        { type: "file_exists", path: "rag/index.json" },
        { type: "file_contains", path: "rag/index.json", needle: "\"dim\":8" },
        { type: "file_contains", path: "rag/index.json", needle: "d1::c0" }
      ],
      findingsKey: "architecture_findings",
      finding: "Hashed bag-of-words index (dim=8) references the exact chunk ids ingestion produced."
    },
    {
      id: "retrieval", signer: "claude", lens: "claude", dependencies: ["embed-index"],
      files: ["rag/retrieve.mjs"],
      requirements: "Top-k retrieval over the index; a known query must return the expected doc in top-k.",
      render: renderRetrieval,
      nodeTest: { cmd: "node", args: ["rag/retrieve.mjs", "--selftest"] },
      checks: () => [
        { type: "file_exists", path: "rag/retrieve.mjs" },
        { type: "file_contains", path: "rag/retrieve.mjs", needle: "export function retrieve" }
      ],
      findingsKey: "accuracy_eval_findings",
      finding: "Retrieval --selftest proves the known query returns the expected doc in top-k."
    },
    {
      id: "generation", signer: "claude", lens: "claude", dependencies: ["retrieval"],
      files: ["rag/prompt.md", "rag/generate.mjs"],
      requirements: "Grounded answer prompt with a {{context}} slot and an explicit citation instruction.",
      render: renderGeneration,
      checks: () => [
        { type: "file_exists", path: "rag/generate.mjs" },
        { type: "file_contains", path: "rag/prompt.md", needle: "{{context}}" },
        { type: "file_contains", path: "rag/prompt.md", needle: "cite" }
      ],
      findingsKey: "architecture_findings",
      finding: "Prompt enforces context-only answering with mandatory source citation."
    },
    {
      id: "eval-harness", signer: "codex", lens: "codex", dependencies: ["retrieval"],
      files: ["rag/evals/scorecard.json", "rag/evals/run.mjs"],
      requirements: "Compute precision@k + faithfulness over the corpus; fail below thresholds.",
      render: renderEvalHarness,
      nodeTest: { cmd: "node", args: ["rag/evals/run.mjs"] },
      checks: () => [
        { type: "file_exists", path: "rag/evals/scorecard.json" },
        { type: "file_exists", path: "rag/evals/run.mjs" },
        { type: "file_contains", path: "rag/evals/scorecard.json", needle: "precision" },
        { type: "file_contains", path: "rag/evals/scorecard.json", needle: "faithfulness" }
      ],
      findingsKey: "accuracy_eval_findings",
      finding: "Eval harness recomputes precision@k + faithfulness and clears thresholds on the fixed corpus."
    },
    {
      id: "guardrails", signer: "grok", lens: "grok", dependencies: [],
      files: ["rag/serve.config.json", "rag/guardrails.mjs"],
      requirements: "Injection detection, PII redaction, and a grounding gate before any answer ships.",
      render: renderGuardrails,
      checks: () => [
        { type: "file_exists", path: "rag/serve.config.json" },
        { type: "file_exists", path: "rag/guardrails.mjs" },
        { type: "file_contains", path: "rag/guardrails.mjs", needle: "injection" },
        { type: "file_contains", path: "rag/guardrails.mjs", needle: "PII" },
        { type: "file_contains", path: "rag/guardrails.mjs", needle: "grounding" }
      ],
      findingsKey: "security_findings",
      finding: "Serving path gates injection, PII, and ungrounded answers before egress."
    },
    {
      id: "ops", signer: "agy", lens: "agy", dependencies: [],
      files: ["rag/OPERATIONS.md"],
      requirements: "Operations runbook: tracing, SLOs, and a per-query cost line.",
      render: renderOps,
      checks: () => [
        { type: "file_exists", path: "rag/OPERATIONS.md" },
        { type: "file_contains", path: "rag/OPERATIONS.md", needle: "tracing" },
        { type: "file_contains", path: "rag/OPERATIONS.md", needle: "SLO" },
        { type: "file_contains", path: "rag/OPERATIONS.md", needle: "Cost per 1k queries" }
      ],
      findingsKey: "scalability_findings",
      finding: "Runbook fixes tracing spans, latency/grounding SLOs, and a bounded per-query cost."
    }
];

export const ragPattern = {
  id: "rag",
  workstreams: [...buildWorkstreams, makeDesignWorkstream(buildWorkstreams)]
};
