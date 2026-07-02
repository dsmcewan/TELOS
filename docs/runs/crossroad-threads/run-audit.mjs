#!/usr/bin/env node
// run-audit.mjs — Crossroad Threads, Phase 1: the LAUNCH AUDIT gate.
//
// The product already exists (a live static-export museum-storefront on GitHub
// Pages). This run treats it as LAUNCHING ON ITS OWN DOMAIN and convenes the
// council to author six audit artifacts grounded in the actual repository
// (cloned at workdir/source), fight them adversarially against that evidence,
// and gate-certify the result. Surviving blockers are the Phase-2 build spec.
//
// Same machinery as the saas-forge ratchet run: ledger ratchet, Styx rule
// (wins permanent), blocker respec recursion, contract-bounded bouts, gemini
// referee, defeat memory, market gate. Research here is a pinned REPO BRIEF
// (deterministic extraction from the source tree) instead of Context7.
//
//   node docs/runs/crossroad-threads/run-audit.mjs   (re-run to resume; exits 0 only on a passed gate)

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePlan, writePlan } from "../../../merkle-dag/merkle.mjs";
import { runBuild } from "../../../merkle-dag/orchestrate.mjs";
import { openState, foldDefs, styxGenerateFiles, bankVerifyFailures, runBouts, approvalEvidenceDigest, loadKeys } from "../../../forge/ratchet.mjs";
import { createSeatRouter } from "../../../breakout/seat_router.mjs";
import { defaultSeatRegistry } from "../../../build-gate/seat-registry.mjs";
import { generatorDispatch } from "../../../saas-forge/generator.mjs";
import { runMarketGate } from "../../../saas-forge/forge.mjs";
import { liveGenerators, makeCouncilFactFns, councilApprovals } from "../../../saas-forge/live.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const workdir = path.join(here, "workdir");
const telosDir = path.join(workdir, ".telos");
const sourceDir = path.join(workdir, "source");
await mkdir(telosDir, { recursive: true });
const CHECK_NODE = fileURLToPath(new URL("../../../saas-forge/checks/check-node.mjs", import.meta.url));

const loadJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");
const log = (m) => console.log(`[audit] ${m}`);
const readSource = (rel, cap = 6000) => {
  try { return readFileSync(path.join(sourceDir, rel), "utf8").slice(0, cap); } catch { return `(missing: ${rel})`; }
};

// ---- pinned REPO BRIEF (the research phase: deterministic, from the source tree) ----
const briefPath = path.join(workdir, "brief.json");
let brief = loadJson(briefPath, null);
if (!brief) {
  const walk = (dir, depth = 0) => {
    if (depth > 2) return [];
    let out = [];
    for (const e of readdirSync(path.join(sourceDir, dir), { withFileTypes: true })) {
      if (e.name === ".git" || e.name === "node_modules" || e.name === "crossroad_imgs") continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      out.push(e.isDirectory() ? `${rel}/` : rel);
      if (e.isDirectory()) out = out.concat(walk(rel, depth + 1));
    }
    return out;
  };
  const scanFor = (words) => {
    const hits = {};
    const scanDir = (dir) => {
      for (const e of readdirSync(path.join(sourceDir, dir), { withFileTypes: true })) {
        if (e.name === ".git" || e.name === "node_modules" || e.name === "crossroad_imgs" || e.name === "public") continue;
        const rel = dir ? `${dir}/${e.name}` : e.name;
        if (e.isDirectory()) { scanDir(rel); continue; }
        if (!/\.(ts|tsx|js|jsx|json|md|yml|yaml|css)$/.test(e.name)) continue;
        let text = "";
        try { text = readFileSync(path.join(sourceDir, rel), "utf8"); } catch { continue; }
        for (const w of words) {
          if (text.toLowerCase().includes(w)) (hits[w] ||= []).push(rel);
        }
      }
    };
    scanDir("");
    return Object.fromEntries(Object.entries(hits).map(([w, files]) => [w, files.slice(0, 8)]));
  };
  const dirSize = (rel) => {
    let bytes = 0;
    const rec = (d) => {
      let entries;
      try { entries = readdirSync(path.join(sourceDir, d), { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const r = `${d}/${e.name}`;
        if (e.isDirectory()) rec(r);
        else { try { bytes += statSync(path.join(sourceDir, r)).size; } catch {} }
      }
    };
    rec(rel);
    return bytes;
  };
  brief = {
    tree: walk(""),
    readme: readSource("README.md", 12000),
    packageJson: readSource("package.json", 4000),
    nextConfig: readSource("next.config.ts", 3000),
    deployWorkflow: readSource(".github/workflows/deploy.yml", 5000),
    commerceScan: scanFor(["checkout", "cart", "stripe", "paypal", "purchase", "buy now", "price", "shop"]),
    assetBytes: { crossroad_imgs: dirSize("crossroad_imgs"), public: dirSize("public") }
  };
  saveJson(briefPath, brief);
  log(`brief: pinned (tree ${brief.tree.length} entries; imgs ${(brief.assetBytes.crossroad_imgs / 1e6).toFixed(0)}MB; public ${(brief.assetBytes.public / 1e6).toFixed(0)}MB; commerce hits: ${Object.keys(brief.commerceScan).join(",") || "none"})`);
} else {
  log("brief: reusing pinned repo brief");
}

const COMMON =
  "POSTURE: Crossroad Threads is launching on ITS OWN DOMAIN as a real storefront (today it is a static " +
  "Next.js export on GitHub Pages under a basePath). Audit the PRODUCT AS IT EXISTS in the repository " +
  "excerpts below and in the bout evidence (workdir/source). Every market claim must be an explicitly-labeled " +
  "HYPOTHESIS with assumptions and a validation plan; every technical claim must cite the repository. " +
  "Findings end in a numbered GAP LIST: concrete, buildable items for Phase 2.\n\n" +
  `REPO FACTS (deterministic): assets crossroad_imgs=${(brief.assetBytes.crossroad_imgs / 1e6).toFixed(0)}MB, ` +
  `public=${(brief.assetBytes.public / 1e6).toFixed(0)}MB; commerce keyword hits: ${JSON.stringify(brief.commerceScan).slice(0, 800)}\n` +
  `PACKAGE.JSON:\n${brief.packageJson.slice(0, 2000)}\n`;

const AUDIT_WORKSTREAMS = [
  {
    id: "commerce-gap", signer: "codex", lens: "codex", dependencies: [],
    files: ["audit/COMMERCE-GAP.md"], isUi: false,
    findingsKey: "architecture_findings", finding: "Commerce gap audit: what selling on its own domain actually requires.",
    requirements: COMMON +
      "Audit the COMMERCE GAP: the site presents itself as a store, so determine from the repo what purchase path exists today " +
      "(cite files) and specify every capability an own-domain storefront needs that is absent. OPERATOR-PINNED LAUNCH STACK: " +
      "the launch requires (a) an ORDER PIPELINE — order lifecycle from cart through payment capture to fulfillment handoff and " +
      "customer notification, with explicit states and failure handling; (b) a TRANSACTION PIPELINE — payment provider integration, " +
      "webhook verification, idempotency, refunds/disputes; (c) a POD PIPELINE — print-on-demand integration (product/variant sync " +
      "to the POD catalog, order submission, shipment tracking webhooks back to the customer). Spec each pipeline's stages, the " +
      "AWS services or containers they run on, and the events between them. Sections required: Current Purchase Path, Gap Analysis, " +
      "Checkout, Payment, Order Pipeline, Transaction Pipeline, POD Pipeline, Phase 2 Work Items.",
    needles: ["Checkout", "Payment", "Order Pipeline", "Transaction Pipeline", "POD"],
    anchors: ["source/package.json", "source/README.md"]
  },
  {
    id: "positioning-launch", signer: "claude", lens: "claude", dependencies: [],
    files: ["audit/POSITIONING.md"], isUi: false,
    findingsKey: "accuracy_eval_findings", finding: "Launch positioning: hypothesis-framed ICP, pricing, and differentiation for a real, shipped brand.",
    requirements: COMMON +
      "Audit LAUNCH POSITIONING for the real brand ('a publishing house that prints on cotton' — Southern Gothic Americana x " +
      "mythology, museum conceit with 103 exhibits and an audio tour). As LABELED HYPOTHESES with assumptions and validation " +
      "plans: ICP segments, price architecture for premium graphic tees, differentiation (the museum experience IS the moat — " +
      "argue it), channel strategy for an own-domain launch, and the riskiest assumption to test first. Ground every claim in " +
      "what the repo/product actually contains. Sections required: ICP, Pricing, Differentiation, Riskiest Hypothesis, Validation Plan.",
    needles: ["Hypothesis", "ICP", "Pricing", "Validation"],
    anchors: ["source/README.md"]
  },
  {
    id: "launch-architecture", signer: "codex", lens: "gemini", dependencies: [],
    files: ["audit/LAUNCH-ARCHITECTURE.md"], isUi: false,
    findingsKey: "scalability_findings", finding: "Own-domain launch architecture: hosting, DNS, CDN, basePath migration, asset strategy.",
    requirements: COMMON +
      `NEXT.CONFIG.TS:\n${brief.nextConfig.slice(0, 1500)}\nDEPLOY WORKFLOW:\n${brief.deployWorkflow.slice(0, 2000)}\n` +
      "Audit LAUNCH ARCHITECTURE for moving from GitHub Pages to an own domain. OPERATOR-PINNED TARGET: AWS. Specify the AWS " +
      "topology: static export on S3 + CloudFront (TLS via ACM, Route 53 DNS), and the commerce services (order/transaction/POD " +
      "pipelines from the commerce audit) as DOCKER CONTAINERS — state where they run (ECS Fargate vs Lambda-container trade-off, " +
      "with a recommendation), how images are built and stored (ECR), and how the static site talks to them (API Gateway/ALB). " +
      "Also: what in the current config binds the site to the Pages basePath (cite lines), redirect strategy from the Pages URL, " +
      "and how CI deploy changes for AWS. Sections required: Current Coupling, AWS Topology, Docker, DNS, CDN, Migration Steps, " +
      "Phase 2 Work Items.",
    needles: ["AWS", "Docker", "DNS", "CDN", "basePath"],
    anchors: ["source/next.config.ts", "source/.github/workflows/deploy.yml"]
  },
  {
    id: "security-trust", signer: "codex", lens: "grok", dependencies: [],
    files: ["audit/SECURITY.md"], isUi: false,
    findingsKey: "security_findings", finding: "Security and trust posture for a commerce-bearing own-domain launch.",
    requirements: COMMON +
      "Audit SECURITY AND TRUST for an own-domain storefront on the OPERATOR-PINNED AWS/Docker stack: current static-site " +
      "posture (headers, CSP, TLS), what changes the moment payments exist (PCI scope boundaries under hosted-checkout vs " +
      "self-hosted), securing the order/transaction/POD pipelines (webhook signature verification, idempotency keys, secrets " +
      "in AWS Secrets Manager, least-privilege IAM for the containers, ECR image scanning), privacy posture, and a threat " +
      "sketch for a small commerce site. Sections required: Current Posture, CSP, Payment Security Boundary, Pipeline Security, " +
      "IAM, Privacy, Threats, Phase 2 Work Items.",
    needles: ["CSP", "TLS", "payment", "IAM", "webhook"],
    anchors: ["source/next.config.ts"]
  },
  {
    id: "ops-content", signer: "claude", lens: "agy", dependencies: [],
    files: ["audit/OPERATIONS.md"], isUi: false,
    findingsKey: "backend_schema_findings", finding: "Operations audit: CI, image/audio pipelines, content accessioning, asset budget.",
    requirements: COMMON +
      "Audit OPERATIONS AND CONTENT for an own-domain launch on the OPERATOR-PINNED AWS/Docker stack: the CI build (image " +
      "pipeline with content-addressed caching, TTS generation) retargeted to AWS (build Docker images -> ECR -> deploy; " +
      "static export -> S3/CloudFront invalidation), the accessioning flow (drop a PNG -> it appears -> POD variant sync), " +
      "the 344MB-source/89MB-derivative asset budget and its S3/CloudFront cost meaning, operational runbooks for the order/ " +
      "transaction/POD pipelines (monitoring, alerts, dead-letter handling), and the single-editor content workflow's launch " +
      "risks. Sections required: CI Pipeline, Docker Build, Content Workflow, Asset Budget, Pipeline Operations, Launch Risks, " +
      "Phase 2 Work Items.",
    needles: ["CI", "Docker", "pipeline", "budget", "runbook"],
    anchors: ["source/.github/workflows/deploy.yml", "source/package.json"]
  },
  {
    id: "brand-experience", signer: "claude", lens: "gemini", dependencies: [],
    files: ["audit/BRAND-EXPERIENCE.md"], isUi: true,
    findingsKey: "frontend_design_findings", finding: "Brand experience audit: does the museum conceit survive contact with commerce?",
    requirements: COMMON +
      "Audit the BRAND EXPERIENCE for the own-domain launch: how the museum conceit (wings, placards, provenance, conservation " +
      "status, audio-guide stops) currently carries the storefront, where the conceit will COLLIDE with commerce mechanics " +
      "(cart, prices, checkout language — 'gift shop' framing as the resolution?), what an own domain changes about first-visit " +
      "comprehension, and accessibility considerations for the audio tour. Sections required: Conceit Inventory, Commerce " +
      "Collisions, First Visit, Accessibility, Phase 2 Work Items.",
    needles: ["wing", "placard", "audio", "conceit"],
    anchors: ["source/README.md"]
  },
  {
    id: "advertising-launch", signer: "claude", lens: "grok", dependencies: [],
    files: ["audit/ADVERTISING.md"], isUi: false,
    findingsKey: "accuracy_eval_findings", finding: "Digital advertising launch plan: hypothesis-framed demographics, channel strategy, creative system, measurement.",
    requirements: COMMON +
      "Author the DIGITAL ADVERTISING LAUNCH PLAN for the own-domain launch. All audience and performance claims are " +
      "LABELED HYPOTHESES (pre-launch: no campaign data exists) with assumptions and a validation plan. Required content: " +
      "(1) TARGET DEMOGRAPHICS — hypothesis segments for premium narrative graphic tees (Southern Gothic Americana x " +
      "mythology, museum conceit): age bands, interests/affinities, purchase occasions (self-expression vs gifting), with " +
      "the reasoning grounded in what the product actually is; (2) CHANNEL PLAN across the current paid-social landscape — " +
      "Meta (Facebook + Instagram, Advantage+ catalog-style prospecting), TikTok (the audio-tour and exhibit lore are " +
      "native short-video material — say how), Pinterest (visual discovery for apparel/gifting), X/Twitter (niche lore/" +
      "mythology communities, modest role), and YouTube Shorts — for each: role in the funnel, hypothesis audience, " +
      "creative format, and a starting budget SHARE (percentages of a total, not invented dollar results); (3) CREATIVE " +
      "SYSTEM — how the museum conceit converts to ad creative (exhibit placards as carousel cards, audio-guide clips as " +
      "voiceover video, 'Recent Acquisitions' as drop announcements); (4) MEASUREMENT — pixels/Conversion APIs per platform, " +
      "UTM discipline, the KPI ladder (CTR -> CVR -> AOV -> ROAS) with target hypotheses and the kill/scale rules; " +
      "(5) BUDGET STRUCTURE — phased test->prove->scale plan in budget shares and decision gates; (6) Phase 2 Work Items " +
      "(pixel/CAPI install, catalog feed, creative asset pipeline from existing exhibit imagery). Sections required: " +
      "Target Demographics, Channel Plan, Creative System, Measurement, Budget Structure, Phase 2 Work Items.",
    needles: ["Hypothesis", "Meta", "TikTok", "Pinterest", "Measurement", "Budget"],
    anchors: ["source/README.md", "source/content/designs.json"]
  }
];
const ALL = AUDIT_WORKSTREAMS.map((w) => w.id);

const dossierMeta = {
  build_id: "crossroad-threads-launch-audit",
  idea_id: "crossroad-threads",
  use_case: "launch-audit",
  objective:
    "Certify the launch audit of Crossroad Threads for its own domain. " +
    "PRODUCT & SURFACE: Crossroad Threads (github.com/dsmcewan/CrossroadThreads) — a live Next.js static-export " +
    "apparel storefront styled as a museum (103 exhibits, five wings, narrated audio tour), today on GitHub Pages, " +
    "auditing its launch as a standalone storefront on its OWN DOMAIN with the operator-pinned stack: AWS hosting, " +
    "Docker-containerized services, and order/transaction/print-on-demand pipelines. TARGET USERS: collectors of " +
    "narrative apparel, Southern Gothic / mythology enthusiasts, story-rich gift buyers. SOURCE MATERIALS: the full " +
    "repository clone at workdir/source (README, next.config.ts, deploy workflow, content/designs.json, package.json) " +
    "plus a pinned deterministic repo brief — every technical claim cites these. " +
    "THE SEVEN AUDIT ARTIFACTS (each with contract-required sections and deterministic content checks, re-verified from " +
    "disk): audit/COMMERCE-GAP.md (purchase path + order/transaction/POD pipeline specs), audit/POSITIONING.md " +
    "(hypothesis-framed ICP/pricing/differentiation), audit/LAUNCH-ARCHITECTURE.md (AWS topology, Docker, DNS/CDN, " +
    "migration), audit/SECURITY.md (CSP/TLS, PCI boundary, pipeline security, IAM), audit/OPERATIONS.md (CI, Docker " +
    "build, content workflow, asset budget, runbooks), audit/BRAND-EXPERIENCE.md (conceit-vs-commerce collisions, " +
    "accessibility), audit/ADVERTISING.md (hypothesis demographics, channel plan, creative system, measurement, budget " +
    "gates). ADVERSARIAL GROUNDING STANDARD: every artifact survived a dual-adversary breakout (grok + agy) reading the " +
    "complete artifact text and source anchors under a contract-bounded scope, with a gemini referee ending unproductive " +
    "loops and a durable defeat memory; market claims are admissible only as labeled hypotheses with assumptions and " +
    "validation plans; technical claims only with repository citations. " +
    "GATE THRESHOLDS: acceptable Phase-2 gaps are enumerated, buildable work items inside each artifact's 'Phase 2 Work " +
    "Items' section (missing commerce/infra the audit exists to specify); HARD STOPS are unresolved adversary blockers, " +
    "any artifact failing its deterministic checks on disk, or any approval packet lacking real per-seat provenance — " +
    "each blocks certification. This audit certifies the GAP MAP is complete and grounded, not that the launch is done.",
  business_thesis: "The museum conceit is the moat: an e-commerce site disguised as a gallery of applied mythology converts narrative depth into premium apparel sales.",
  target_users: ["collectors of narrative apparel", "Southern Gothic / mythology enthusiasts", "gift buyers seeking story-rich objects"],
  required_market_workstreams: ALL
};
const telos = "Launch Crossroad Threads on its own domain.";

const keys = loadKeys(workdir, ["claude", "codex"], log);

const router = createSeatRouter(defaultSeatRegistry());
let seatCalls = 0;
const callTool = (name, args) => { seatCalls++; return router.callTool(name, args); };

let summary = { generated_for: dossierMeta.build_id, live: true, phase: "audit",
  transport: "seat-router default (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)" };

try {
  const state = openState(workdir);

  const checksFor = (ws) => [
    ...ws.files.map((p) => ({ type: "file_exists", path: p })),
    ...ws.needles.map((needle) => ({ type: "file_contains", path: ws.files[0], needle })),
    // Anchors pull the real repository into the bout evidence (and trivially
    // hold on disk): adversaries attack the audit AGAINST the source.
    ...ws.anchors.map((p) => ({ type: "file_exists", path: p }))
  ];
  const wsWithChecks = AUDIT_WORKSTREAMS.map((ws) => ({ ...ws, checks: checksFor(ws) }));

  const rawDefs = wsWithChecks.map((ws) => ({
    id: ws.id,
    files: ws.files,
    requirements: ws.requirements,
    test: { cmd: "node", args: [CHECK_NODE, JSON.stringify(ws.checks)] },
    dependencies: ws.dependencies
  }));
  const defs = foldDefs(rawDefs, state, log);
  const defById = new Map(defs.map((d) => [d.id, d]));
  const { plan, errors } = computePlan(defs, {
    authorizedSigners: { claude: keys.claude.publicJwk, codex: keys.codex.publicJwk }
  });
  if (errors) throw new Error(`plan invalid: ${JSON.stringify(errors)}`);
  writePlan(telosDir, plan);

  const generateFiles = styxGenerateFiles({
    state,
    generate: liveGenerators({ callTool })({ stack: [] }),
    binary: () => false,
    log
  });
  const { report, trace } = await runBuild({
    telosDir, baseDir: workdir,
    dispatch: generatorDispatch({ baseDir: workdir, generateFiles, signerForTask: (id) => AUDIT_WORKSTREAMS.find((w) => w.id === id)?.signer || "claude" }),
    signerFor: (m) => keys[m]?.privatePem
  });
  const settledNow = trace.filter((t) => t.action === "settled").map((t) => t.id);
  const halts = trace.filter((t) => t.action !== "settled").map((t) => ({ id: t.id, action: t.action, reason: (t.reason || t.detail || "").toString().slice(0, 400) }));
  for (const h of halts) log(`build halt ${h.id}: ${h.action} ${h.reason}`);
  log(`build: merge_status=${report.merge_status}; settled: ${settledNow.join(", ") || "(none — ratcheted)"}`);
  summary.build = { merge_status: report.merge_status, settled_this_invocation: settledNow, halts };

  if (report.merge_status !== "ready") {
    bankVerifyFailures(halts, state, log);
    summary.result = "build-incomplete (re-run to continue from the ledger)";
    summary.blockers = report.blockers || [];
    process.exitCode = 1;
  } else {
    const makeFns = makeCouncilFactFns({ callTool });
    const hashById = new Map(plan.nodes.map((n) => [n.id, n.effective_hash]));
    const records = await runBouts({ workstreams: wsWithChecks, state, makeFns, defById, hashById, telosDir, log });
    summary.teams = records.map((t) => ({
      workstream: t.workstream, converged: t.converged, finalStatus: t.finalStatus,
      rounds: t.rounds?.length ?? 0, referee: t.referee ?? null
    }));

    const allConverged = records.length === ALL.length && records.every((t) => t.converged);
    if (!allConverged) {
      summary.result = "bouts-incomplete (re-run to continue; converged teams are ratcheted)";
      process.exitCode = 1;
    } else if (process.env.TELOS_SKIP_GATE === "1") {
      // Replay/verification mode: prove the ratchet + Styx stages alone.
      summary.result = "ALL-CONVERGED (gate skipped by TELOS_SKIP_GATE)";
      process.exitCode = 0;
    } else {
      log("gate: collecting council approvals...");
      const approvalMeta = {
        ...dossierMeta,
        objective: dossierMeta.objective + approvalEvidenceDigest(records, workdir)
      };
      const approvals = await councilApprovals({ callTool })({ dossierMeta: approvalMeta, architecture: { stack: [] } });
      const verdict = runMarketGate({ projectRoot: workdir, dossierMeta, teamRecords: records, approvals });
      summary.gate_status = verdict.gate_status;
      summary.approvals_provenance = (verdict.provenance || []).map((p) => ({
        model: p.model, has_provenance: p.has_provenance, response_id: p.response_id
      }));
      summary.blockers = verdict.blockers || [];
      summary.result = verdict.gate_status === "pass" ? "PASS" : "gate-blocked";
      process.exitCode = verdict.gate_status === "pass" ? 0 : 1;
    }
  }
} catch (error) {
  summary.error = error?.message || String(error);
  summary.result = "error (re-run to resume from the last checkpoint)";
  process.exitCode = 1;
} finally {
  router.close();
}

summary.seat_calls = seatCalls;
saveJson(path.join(here, "run-summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
log(`result: ${summary.result} (seat calls this invocation: ${seatCalls})`);
process.exit(process.exitCode || 0);
