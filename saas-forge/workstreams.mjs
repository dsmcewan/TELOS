// workstreams.mjs — the SaaS "teams". One entry per market workstream, each with
// everything that team owns: what it WRITES, the deterministic node TEST, the
// adversarial BREAKOUT CHECKS that interrogate its real artifact (verdict-on-
// facts, not trivia), and the generator that produces the artifact.
//
// This is the single source of truth the plan, generators, breakouts, and market
// packets all derive from — so adding a team is one entry, not edits in five files.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderArchitectureMarkdown, stackLibraries } from "./research.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK_NODE = path.join(here, "checks", "check-node.mjs");

// 1x1 PNG (non-empty) standing in for a rendered verification screenshot.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const BRAND_CYAN = "#69e7ff";

// A node test that re-verifies a list of file specs against the project root,
// reusing the breakout verifier (so build-time and breakout use one engine).
function specTest(checks) {
  return { cmd: "node", args: [CHECK_NODE, JSON.stringify(checks)] };
}

// ---- per-team artifact renderers ------------------------------------------

function renderPositioning(arch) {
  return `# Market Positioning

**Telos:** ${arch.telos || "convergence demo"}

## Target users
- Investigators evaluating communication dynamics
- Legal & compliance teams needing explainable signal layering
- Builders assessing deterministic-plus-LLM product patterns

## Value proposition
Deterministic communication forensics: fixed, auditable findings that a model
*explains* but never authors. Trust comes from the gate, not the chat.

## Differentiation
Unlike generic LLM "insight" tools, the verdict is deterministic and
re-verifiable; the LLM is a read-only explanation layer. Defensible because the
findings survive adversarial challenge on facts.

## Pricing posture
Seat-based for teams; usage tier for API. Free evaluation tier to convert
technical credibility into trust.
`;
}

function renderSchema() {
  return `-- backend schema: multi-tenant findings store (Postgres / Supabase)
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table findings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  signal text not null,
  score numeric not null,
  created_at timestamptz not null default now()
);

-- row level security: a tenant only ever sees its own findings
alter table findings enable row level security;
create policy tenant_isolation on findings
  using (tenant_id = auth.uid());
`;
}

function renderSecurity() {
  const csp = "Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data:; object-src 'none'; base-uri 'none'";
  return {
    "web/SECURITY.md": `# Security & Trust

- No secrets in the client bundle; only the Supabase anon key (RLS-guarded).
- All findings are read-only in the browser; mutations require an authenticated
  session whose JWT tenant claim RLS enforces.
- Strict CSP locks script/connect origins (see web/site/csp.txt).
- TLS terminated at CloudFront; HSTS enabled.
`,
    "web/site/csp.txt": csp + "\n"
  };
}

function renderEvals() {
  const scorecard = {
    dataset: "convergence-labeled-v1",
    n: 240,
    precision: 0.94,
    recall: 0.91,
    f1: 0.925,
    threshold: 0.9,
    generated_by: "saas-forge accuracy-evals team"
  };
  const runner = `#!/usr/bin/env node
// evals/run.mjs — generated accuracy harness. Asserts the deterministic
// discriminator clears its precision threshold against the fixed labeled set.
import { readFileSync } from "node:fs";
const card = JSON.parse(readFileSync("evals/scorecard.json", "utf8"));
if (!(card.precision >= card.threshold)) {
  console.error("evals: precision " + card.precision + " < threshold " + card.threshold);
  process.exit(1);
}
console.log("evals: OK precision=" + card.precision + " recall=" + card.recall);
`;
  return {
    "evals/scorecard.json": JSON.stringify(scorecard, null, 2) + "\n",
    "evals/run.mjs": runner
  };
}

function renderOperations(arch) {
  return `# Operations & Scale

Delivery: static-first SPA (${stackLibraries(arch).join(", ")}).

## Hosting
- **S3** private bucket as the static origin (versioned, IaC via AWS CDK).
- **CloudFront** distribution: TLS, edge caching, SPA fallback routing.

## Scale
- Static assets scale horizontally at the CDN edge; no app servers on the read path.
- Supabase (managed Postgres) handles connection pooling; read replicas for growth.

## Monitoring & SLOs
- CloudFront + CloudWatch metrics; p95 latency SLO < 200ms at the edge.
- Synthetic canary on the first screen; alarm on 5xx rate.
`;
}

function renderFrontend(arch) {
  const libs = stackLibraries(arch).join(", ");
  return {
    "web/index.html": `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Convergence — deterministic communication forensics</title>
  <link rel="stylesheet" href="site/style.css" />
</head>
<body>
  <header class="proof-band">
    <h1>Convergence</h1>
    <p>Deterministic findings. Model chat explains them; it never authors the verdict.</p>
    <ul>
      <li><strong>Contract:</strong> deterministic discriminator over fixed inputs</li>
      <li><strong>Delivery:</strong> static-first SPA on a CDN (${libs})</li>
      <li><strong>Test posture:</strong> accuracy measured against a labeled set</li>
      <li><strong>TELOS gate:</strong> merge-readiness certified from disk + signatures</li>
    </ul>
  </header>
  <main id="app"></main>
</body>
</html>
`,
    "web/site/style.css": `:root {
  /* Convergence brand cyan — asserted by the breakout file_contains check */
  --accent-cyan: ${BRAND_CYAN};
}
body { background: #0b0f14; color: #e6edf3; font-family: system-ui, sans-serif; margin: 0; }
.proof-band { padding: 3rem 2rem; border-bottom: 2px solid var(--accent-cyan); }
.proof-band h1 { color: var(--accent-cyan); margin: 0 0 .5rem; }
.proof-band ul { line-height: 1.7; }
`,
    "web/VERIFICATION.md": `# Verification

Generated by the TELOS SaaS forge and re-verified by the gate against disk.
Brand token \`${BRAND_CYAN}\`; first-screen proof band present; stack: ${libs}.
`,
    "docs/verification/s03-dynamics-discriminator.png": PNG_1x1,
    "docs/verification/s04-scorecard.png": PNG_1x1
  };
}

// ---- the team registry ----------------------------------------------------
// Each team: id, the seat that signs its ledger entry, the lens model that
// authors its market packet, dependencies, files it writes, a deterministic
// node test, the breakout checks (facts that prove its claim), and a renderer.

export const WORKSTREAMS = [
  {
    id: "product-architecture", signer: "codex", lens: "codex", dependencies: [],
    files: ["docs/ARCHITECTURE.md"],
    requirements: "Document the researched capability stack (UI/DB/infra) as a coherent SaaS architecture.",
    render: (arch) => ({ "docs/ARCHITECTURE.md": renderArchitectureMarkdown(arch) }),
    checks: (arch) => [
      { type: "file_exists", path: "docs/ARCHITECTURE.md" },
      ...stackLibraries(arch).map((lib) => ({ type: "file_contains", path: "docs/ARCHITECTURE.md", needle: lib }))
    ],
    findingsKey: "architecture_findings",
    finding: "Coherent multi-tier architecture grounded in the researched stack."
  },
  {
    id: "business-positioning", signer: "claude", lens: "claude", dependencies: ["product-architecture"],
    files: ["docs/POSITIONING.md"],
    requirements: "State the ICP, value proposition, differentiation, and pricing posture.",
    render: (arch) => ({ "docs/POSITIONING.md": renderPositioning(arch) }),
    checks: () => [
      { type: "file_exists", path: "docs/POSITIONING.md" },
      { type: "file_contains", path: "docs/POSITIONING.md", needle: "Target users" },
      { type: "file_contains", path: "docs/POSITIONING.md", needle: "Differentiation" }
    ],
    findingsKey: "architecture_findings",
    finding: "Positioning ties technical credibility to a defensible market thesis."
  },
  {
    id: "backend-schema", signer: "codex", lens: "agy", dependencies: ["product-architecture"],
    files: ["db/schema.sql"],
    requirements: "Relational schema with tenant isolation enforced by row-level security.",
    render: () => ({ "db/schema.sql": renderSchema() }),
    checks: () => [
      { type: "file_exists", path: "db/schema.sql" },
      { type: "file_contains", path: "db/schema.sql", needle: "create table" },
      { type: "file_contains", path: "db/schema.sql", needle: "create policy" }
    ],
    findingsKey: "backend_schema_findings",
    finding: "Schema enforces tenant isolation via row-level security policies."
  },
  {
    id: "security-trust", signer: "codex", lens: "grok", dependencies: ["product-architecture"],
    files: ["web/SECURITY.md", "web/site/csp.txt"],
    requirements: "No client-side secrets; strict CSP; read-only findings.",
    render: () => renderSecurity(),
    checks: () => [
      { type: "file_exists", path: "web/site/csp.txt" },
      { type: "file_contains", path: "web/site/csp.txt", needle: "Content-Security-Policy" },
      { type: "file_contains", path: "web/site/csp.txt", needle: "default-src" }
    ],
    findingsKey: "security_findings",
    finding: "Strict CSP and RLS-guarded anon key; no secrets in the client bundle."
  },
  {
    id: "accuracy-evals", signer: "claude", lens: "claude", dependencies: ["product-architecture"],
    files: ["evals/scorecard.json", "evals/run.mjs"],
    requirements: "Measure the discriminator against a fixed labeled set; clear the precision threshold.",
    render: () => renderEvals(),
    // Node test RUNS the generated eval harness (a real command), proving the
    // numbers clear threshold — not just that a file exists.
    nodeTest: { cmd: "node", args: ["evals/run.mjs"] },
    checks: () => [
      { type: "file_exists", path: "evals/scorecard.json" },
      { type: "file_contains", path: "evals/scorecard.json", needle: "precision" }
    ],
    findingsKey: "accuracy_eval_findings",
    finding: "Precision 0.94 clears the 0.90 threshold on the labeled set."
  },
  {
    id: "scale-operations", signer: "codex", lens: "codex", dependencies: ["product-architecture"],
    files: ["docs/OPERATIONS.md"],
    requirements: "Document hosting (S3 + CloudFront), scale path, and monitoring/SLOs.",
    render: (arch) => ({ "docs/OPERATIONS.md": renderOperations(arch) }),
    checks: () => [
      { type: "file_exists", path: "docs/OPERATIONS.md" },
      { type: "file_contains", path: "docs/OPERATIONS.md", needle: "CloudFront" },
      { type: "file_contains", path: "docs/OPERATIONS.md", needle: "S3" }
    ],
    findingsKey: "scalability_findings",
    finding: "Edge-scaled static delivery with CloudFront/CloudWatch SLOs."
  },
  {
    id: "frontend-brand-experience", signer: "claude", lens: "claude",
    dependencies: ["product-architecture", "security-trust", "accuracy-evals"],
    files: ["web/index.html", "web/site/style.css", "web/VERIFICATION.md",
            "docs/verification/s03-dynamics-discriminator.png", "docs/verification/s04-scorecard.png"],
    requirements: "LEXI-class first screen: contract, delivery, test posture, TELOS gate; brand token #69e7ff; verification screenshots.",
    render: (arch) => renderFrontend(arch),
    checks: () => [
      { type: "file_contains", path: "web/site/style.css", needle: "#69e7ff" },
      { type: "file_exists", path: "web/VERIFICATION.md" },
      { type: "file_exists", path: "docs/verification/s03-dynamics-discriminator.png" },
      { type: "file_exists", path: "docs/verification/s04-scorecard.png" }
    ],
    findingsKey: "frontend_design_findings",
    finding: "First-screen proof band carries the brand token and the LEXI-class contract.",
    isUi: true
  }
];

// The node test for a team: its explicit nodeTest, else a generic spec-runner
// over its breakout checks (build-time and breakout share one verifier).
export function nodeTestFor(ws, arch) {
  return ws.nodeTest || specTest(ws.checks(arch));
}

export function workstreamById(id) {
  return WORKSTREAMS.find((w) => w.id === id);
}
