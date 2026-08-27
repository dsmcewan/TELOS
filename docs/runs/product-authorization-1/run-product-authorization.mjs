#!/usr/bin/env node
// TELOS authorization run for the product-1 quest (Iliad lifecycle) — the v0.3.0
// Production Quest / PYLAE Gate v1.
//
// Sequence: the Eye commissioned product-1 (2026-08-27) -> Iliad pre-review
// (2026-08-27-product-1.json, S0 rulings recorded) -> Daedalus workshop matured the
// APPROACH over 10 adversarial rounds / 41 discharged objections
// (converged-for-submission) -> TELOS AUTHORIZES (this run) -> Eye grants
// implementation authority -> Argo implements.
//
// A real signed council over the matured approach's content address:
// claude/agy/codex are REQUIRED approvers, grok/gemini advisory. Chat seats run
// over OAUTH SUBSCRIPTION CLIs per the recorded Eye ruling
// `product-1-ruling-oauth-seat-transport` (claude CLI / codex CLI / grok CLI /
// agy CLI) — never metered API keys; provenance is the CLIs' real session ids
// (source "cli-seats/<seat>", honestly weaker than provider API receipts). agy is
// the local deterministic governance checkpoint derived from the dossier
// (imported directly from connectors/ai-peer-mcp/lib.mjs — no server, no keys).
// The gate (trust_mode "signed") certifies from packets + signatures + provenance
// — never a seat's self-report. Fail-closed: any missing required packet, invalid
// signature, placeholder provenance, or non-approve decision leaves product-1
// UNAUTHORIZED.
//
// COMBINED CEREMONY (Eye ruling, S0 gate, Option A): this council run is ALSO the
// live re-authorization that (a) regularizes AM-42's enrollment-flip process debt
// and (b) rules AM-43 — classifying `cli/` and `connectors/meta-ads-mcp/` into
// PACKAGE_ROOTS_EXCLUDE. The BUILD_ID names the flip, per the plan's §3
// successor-plan transition.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const { runCouncil, agyApprovalPacket, agyCheckpointArgs } = await imp("build-gate/council.mjs");
const { validateRecords } = await imp("build-gate/gate.mjs");
const { agyCheckpoint, agyAttestation } = await imp("connectors/ai-peer-mcp/lib.mjs");
const { askClaude, askCodex, askGrok, askGemini } = await imp("docs/institutional-memory/iliad/tools/cli-seats.mjs");

// ---------- bind the exact plan under authorization ----------
const PLAN_PATH = "docs/runs/product-1-workshop/matured-approach.md";
const PREREVIEW_PATH = "docs/institutional-memory/iliad/PRE-REVIEWS/2026-08-27-product-1.json";
const EXPECTED_PLAN_REF = "sha256:72b466d84f21756fcd9c0d7528354c6e0c18b0f0db4464e280225b9e58dba8d1";
const REVIEWED_HEAD = "cfa6395"; // matured-approach.md committed head (S1 re-convergence, round 22, after run-1 council fold)

const planText = readFileSync(path.join(ROOT, PLAN_PATH), "utf8");
const planRef = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: planText }));
if (planRef !== EXPECTED_PLAN_REF) {
  console.error(`PLAN DRIFT: ${PLAN_PATH} recomputes to ${planRef}, expected ${EXPECTED_PLAN_REF}. Refusing to authorize.`);
  process.exit(1);
}

// ---------- signing secrets: real registry values when present, else ephemeral ----------
const EPHEMERAL_SIGNERS = [];
for (const m of ["CLAUDE", "AGY", "CODEX"]) {
  if (!process.env[`TELOS_SECRET_${m}`]) {
    process.env[`TELOS_SECRET_${m}`] = randomBytes(24).toString("hex");
    EPHEMERAL_SIGNERS.push(m.toLowerCase());
  }
}

const BUILD_ID = "iliad-product-1-authz-am42-regularization-am43-exclusions";
const USE_CASE = "iliad-product-1";
const TIMESTAMP = new Date().toISOString();
const OBJECTIVE =
  `Authorize Argo implementation of the product-1 quest matured approach ` +
  `(content address ${planRef}; Daedalus-converged after 22 adversarial rounds with 60 discharged objections ` +
  `plus council run 1's ratified hard stop folded and re-matured; ` +
  `reviewed head ${REVIEWED_HEAD}) — the TELOS v0.3.0 Production Quest shipping PYLAE Gate v1 ` +
  `(the productized local single-user CLI SKU over the TELOS trust spine). ` +
  `The plan's own terms to judge it on: (1) ENFORCEMENT E1-E6 are fail-closed with adversarial regression tests: ` +
  `deterministic pre-merge merge-controller (sole merge credential; models produce dossiers, never merge), ` +
  `memory-gate freshness with authority chained to out-of-tree protected roots (base-anchored verifier closure, ` +
  `Eye-signed authority transitions, Eye-local genesis provisioning), exceptionless auditor (no allow-empty), ` +
  `gate production-profile default flip, discriminating oracles (closed mutation registry, mutation-based ` +
  `negatives, direct execution), verifier hardening (dedupe, root-invariant sweep, draft-status citation gate). ` +
  `(2) GOVERNANCE: a docs/registry-only BOOTSTRAP slice lands first under the sitting v15 authority, executing ` +
  `the successor-plan transition (publish plan hash -> authorize exact hash -> pivot active_plan/active_authorization ` +
  `+ supersede v15 -> Eye implementation-authority confirmation); AM-42 bytes never touched (registry-row linkage ` +
  `only); AM-43 classifies cli/ + connectors/meta-ads-mcp/ as excluded package dirs. THIS COUNCIL IS that ` +
  `re-authorization: its build_id names the enrollment flip. ` +
  `(3) PRODUCT: Phase-0 contract frozen (PD-001..PD-007 ADRs, hard go-live gate with typed item-bound evidence, ` +
  `no report-only release mode); Phase-1a honest install contract (source release with pylae entrypoint, ` +
  `dual checkout/archive doctor semantics, clean-room install proof, draft-first fail-closed release publication, ` +
  `full-assembly reproducibility, out-of-tree signer fingerprint); flagship = future operator console with a ` +
  `bounded Chromium-only qualified-browser contract this round. ` +
  `(4) ATOMIC WEAVE RULE: every slice touching woven inputs carries its own re-weave; PR CI mode-splits ` +
  `historical vs authoritative exact-head verification accordingly. ` +
  `Judge the plan on THESE terms — do NOT require capabilities it explicitly defers to register items ` +
  `(multi-engine browser qualification, self-contained npm distribution, Phase-1b durable state / Auth0 identity / ` +
  `key rotation), and do NOT re-litigate the recorded Eye rulings it cites (PYLAE naming, Option-A combined ` +
  `ceremony, both-strict enforcement, reconcile-and-supersede for draft docs, OAuth seat transport). ` +
  `OUT OF SCOPE (do NOT condition approval on it): identity/tenancy/clustered runtime (excluded by signed ADR ` +
  `PD-001); enrollment flips beyond the two AM-43 exclusions; Phase-1b+ register items. ` +
  `Approve ONLY if the plan is implementation-ready and consistent with its governing pre-review, the repository ` +
  `trust model (fail-closed, closed sets, content-addressed identity, no mutable label keying enforcement, ` +
  `zero-dependency core), and its own decisions and acceptance criteria, with no remaining plan contradiction.`;

// Write targets from the plan's slice decomposition (agy derives protected_path_check from these).
const WRITE_TARGETS = [
  "workflows/", "ai-native-memory/", "build-gate/", "cli/", "connectors/meta-ads-mcp/",
  "docs/institutional-memory/", "docs/runs/product-1-argo/", ".github/", "narcissus/flagship/",
  "demo/", "clotho/", "lachesis/", "docs/"
];

const dossier = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  objective: OBJECTIVE,
  proposal_ref: planRef,
  required_docs: [PLAN_PATH, PREREVIEW_PATH],
  write_targets: WRITE_TARGETS,
  protected_paths: [],
  trust_mode: "signed"
};

const meta = {
  build_id: BUILD_ID,
  use_case: USE_CASE,
  proposal_ref: planRef,
  timestamp: TIMESTAMP,
  docs_reviewed: [PLAN_PATH, PREREVIEW_PATH]
};

// ---------- strict packet schema (instruction-enforced + strict local parse) ----------
const PACKET_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["approve", "revise", "reject"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    required_edits: { type: "array", items: { type: "string" } },
    hard_stops: { type: "array", items: { type: "string" } },
    rationale: { type: "string" }
  },
  required: ["decision", "confidence", "required_edits", "hard_stops", "rationale"]
};

function parsePacket(text, model) {
  let m = null;
  try { m = JSON.parse(text); } catch { /* fall through */ }
  if (!m || typeof m !== "object") m = {};
  return {
    build_id: BUILD_ID,
    use_case: USE_CASE,
    model,
    role: "approver",
    docs_reviewed: meta.docs_reviewed,
    proposal_ref: planRef,
    decision: ["approve", "revise", "reject"].includes(m.decision) ? m.decision : "revise",
    required_edits: Array.isArray(m.required_edits) ? m.required_edits : [],
    hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [],
    confidence: ["low", "medium", "high"].includes(m.confidence) ? m.confidence : "low",
    timestamp: TIMESTAMP,
    rationale: typeof m.rationale === "string" ? m.rationale : "unparsable seat response (fail-closed to revise)"
  };
}

const FIELD_SEMANTICS =
  "Field semantics (STRICT): decision 'approve' means the plan may be implemented AS-IS. " +
  "hard_stops lists ONLY conditions that must BLOCK authorization right now — if you approve unconditionally, hard_stops MUST be []. " +
  "required_edits lists ONLY concrete changes you demand before approval — if you approve, required_edits MUST be []. " +
  "Do NOT restate the plan's invariants, strengths, or constraints in either list; put commentary in rationale.";

// ---------- seat transport: OAuth CLIs for chat seats, local checkpoint for agy ----------
const ASK = { claude: askClaude, codex: askCodex, grok: askGrok, gemini: askGemini };
const PINNED_MODEL = { claude: "claude", codex: "gpt-5.6-sol", grok: "grok-4.5", gemini: "gemini-3.1-pro-high" };
const PROVIDER = { claude: "anthropic", codex: "openai", grok: "xai", gemini: "google" };

async function callSeat({ model, role, dossier: dsr }) {
  if (model === "agy") {
    const checkpoint = agyCheckpoint(agyCheckpointArgs(dsr, "product-1"));
    const provenance = { ...agyAttestation(checkpoint), tool: "agy_checkpoint(local)" };
    return { packet: agyApprovalPacket(checkpoint, meta), provenance };
  }
  const res = await ASK[model]({
    prompt: `Objective:\n${OBJECTIVE}\n\n${FIELD_SEMANTICS}\n\n=== PLAN UNDER AUTHORIZATION (${PLAN_PATH}, ${planRef}) ===\n\n${planText}`,
    system: `You are the ${model} seat on the TELOS authorization council (role: ${role}). Judge the plan on the merits against the objective. Approve only what you would stake your seat's signature on. ${FIELD_SEMANTICS}`,
    model: PINNED_MODEL[model],
    response_schema: PACKET_SCHEMA,
    schema_name: "telos_approval_packet"
  });
  const provenance = {
    provider: PROVIDER[model],
    model: res.model,
    response_id: res.id,
    source: `cli-seats/${model}`,
    transport: "oauth-subscription-cli",
    answered_at: new Date().toISOString(),
    tool: `cli-seats.ask${model[0].toUpperCase()}${model.slice(1)}`
  };
  return { packet: parsePacket(res.text, model), provenance };
}

const seats = [
  { model: "claude", role: "approver" },
  { model: "agy", role: "approver" },
  { model: "codex", role: "approver" },
  { model: "grok", role: "advisory" },
  { model: "gemini", role: "advisory" }
];

const killer = setTimeout(() => { console.error("AUTHZ_TIMEOUT"); process.exit(2); }, 1_800_000);

try {
  const results = await runCouncil({ seats, callSeat, dossier });

  mkdirSync(HERE, { recursive: true });
  const summary = {
    build_id: BUILD_ID,
    use_case: USE_CASE,
    objective: OBJECTIVE,
    plan_ref: planRef,
    reviewed_head: REVIEWED_HEAD,
    combined_ceremony: "AM-42 enrollment-flip regularization + AM-43 exclusions (cli/, connectors/meta-ads-mcp/) — build_id names the flip",
    seat_transport: "OAuth subscription CLIs per product-1-ruling-oauth-seat-transport (agy = local deterministic checkpoint)",
    timestamp: TIMESTAMP,
    trust_mode: "signed",
    ephemeral_signers: EPHEMERAL_SIGNERS,
    seats: []
  };
  const packetsForGate = [];

  for (const r of results) {
    if (r.ok) {
      writeFileSync(path.join(HERE, `${r.model}.json`), JSON.stringify(r.packet, null, 2));
      packetsForGate.push(r.packet);
      summary.seats.push({ model: r.model, role: r.role, ok: true, signed: !!r.signed, decision: r.packet.decision, confidence: r.packet.confidence, provenance: r.packet.provenance });
    } else {
      summary.seats.push({ model: r.model, role: r.role, ok: false, reason: r.reason });
    }
  }

  const gate = validateRecords(dossier, packetsForGate);
  summary.gate = {
    gate_status: gate.gate_status,
    signing_enforced: gate.headline_checks?.signing_enforced,
    provenance_enforced: gate.headline_checks?.provenance_enforced,
    blockers: gate.blockers,
    warnings: gate.warnings,
    provenance: gate.provenance
  };

  const requiredSeats = seats.filter((s) => s.role === "approver").map((s) => s.model);
  const approvals = summary.seats.filter((s) => requiredSeats.includes(s.model) && s.ok && s.decision === "approve");
  const gatePassed = gate.gate_status === "pass";
  summary.authorized = gatePassed && approvals.length === requiredSeats.length;
  summary.authorization = summary.authorized
    ? { status: "AUTHORIZED", id: "authz-product-1", plan_ref: planRef, note: "Argo implementation of the product-1 matured plan is authorized by the signed council under the TELOS gate; this run is also the Option-A re-authorization naming the AM-42 regularization + AM-43 exclusions. The Eye's implementation-authority confirmation (plan §3 step 4) remains a separate, subsequent grant." }
    : { status: "NOT_AUTHORIZED", note: "Fail-closed: see gate.blockers and seat decisions." };

  writeFileSync(path.join(HERE, "authorization-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ authorized: summary.authorized, gate_status: gate.gate_status, blockers: gate.blockers.length, seats: summary.seats.map((s) => ({ model: s.model, ok: s.ok, decision: s.decision ?? null })) }, null, 2));
  process.exit(summary.authorized ? 0 : 3);
} catch (error) {
  console.error("AUTHZ_ERROR: " + (error?.message || String(error)));
  process.exitCode = 1;
} finally {
  clearTimeout(killer);
}
