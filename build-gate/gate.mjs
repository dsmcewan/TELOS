#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { reverifyRecord } from "../breakout/verifier.mjs";
import { verifyPacket, secretFor } from "./sign.mjs";

const REQUIRED_MODELS = ["claude", "agy", "codex"];
const DEFAULT_CAPABILITY_MODELS = ["claude", "codex", "agy", "grok"];
const DEFAULT_MARKET_WORKSTREAMS = [
  "business-positioning",
  "product-architecture",
  "backend-schema",
  "security-trust",
  "accuracy-evals",
  "scale-operations",
  "frontend-brand-experience"
];
export const DEFAULT_PROTECTED_PATHS = [
  "CHATGPT/",
  "me/claude-code/",
  "me/claude-desktop/",
  "me/gemini/"
];

const VALID_DECISIONS = new Set(["approve", "revise", "reject", "advisory-note"]);
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
const VALID_GROK_OBJECTION_STATUS = new Set(["dismissed", "accepted-blocker", "resolved"]);
const VALID_PROJECT_STATES = new Set(["concept", "prototype", "demo", "alpha", "beta", "production"]);
const VALID_LEXI_CLASS_UI_STATUS = new Set(["meets", "needs-work", "not-applicable"]);

async function main() {
  const [command, dossierPath, packetDir, ...rest] = process.argv.slice(2);

  if (command !== "validate" || !dossierPath || !packetDir) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  const options = readOptions(rest);
  if (options === false) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  try {
    const report = await validateGate(dossierPath, packetDir, options);
    if (options.ledgerPath) {
      await writeFile(options.ledgerPath, renderLedger(report), "utf8");
    }
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.gate_status === "pass" ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

function printUsage() {
  console.error("Usage: node gate.mjs validate <dossier.json> <packet-dir> [--capabilities <capability-dir>] [--market-readiness <market-dir>] [--ledger <ledger.md>]");
}

function readOptions(args) {
  const options = { ledgerPath: null, capabilityDir: null, marketReadinessDir: null };
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key || !value) return false;
    if (key === "--ledger") {
      options.ledgerPath = value;
    } else if (key === "--capabilities") {
      options.capabilityDir = value;
    } else if (key === "--market-readiness") {
      options.marketReadinessDir = value;
    } else {
      return false;
    }
  }
  return options;
}

export async function validateGate(dossierPath, packetDir, options = {}) {
  const dossier = await readJsonFile(dossierPath);
  const packets = await readPacketDir(packetDir);
  const capabilityPackets = options.capabilityDir ? await readPacketDir(options.capabilityDir) : [];
  const marketPackets = options.marketReadinessDir ? await readPacketDir(options.marketReadinessDir) : [];
  return validateRecords(dossier, packets, {
    dossierPath: normalizeReportPath(dossierPath),
    dossierDir: path.dirname(path.resolve(dossierPath)),
    packetDir: normalizeReportPath(packetDir),
    capabilityDir: options.capabilityDir ? normalizeReportPath(options.capabilityDir) : null,
    marketReadinessDir: options.marketReadinessDir ? normalizeReportPath(options.marketReadinessDir) : null
  }, capabilityPackets, marketPackets);
}

export function validateRecords(dossier, packets, source = {}, capabilityPackets = [], marketPackets = []) {
  const blockers = [];
  const warnings = [];

  validateDossierShape(dossier, blockers);
  const signed = dossier?.trust_mode === "signed";

  const packetsByModel = new Map();
  for (const packet of packets) {
    validatePacketShape(packet, blockers);
    if (packet?.build_id !== dossier.build_id) {
      blockers.push(`Packet for ${packet?.model ?? "unknown"} has build_id '${packet?.build_id}' but dossier requires '${dossier.build_id}'.`);
    }
    if (packet?.use_case !== dossier.use_case) {
      blockers.push(`Packet for ${packet?.model ?? "unknown"} has use_case '${packet?.use_case}' but dossier requires '${dossier.use_case}'.`);
    }
    if (typeof packet?.model === "string") {
      if (packetsByModel.has(packet.model)) {
        warnings.push(`Duplicate packet for model '${packet.model}': more than one packet declares it; only the first is used.`);
      } else {
        packetsByModel.set(packet.model, packet);
      }
    }
  }

  for (const model of REQUIRED_MODELS) {
    const packet = packetsByModel.get(model);
    if (!packet) {
      blockers.push(`Missing required ${model} approval packet.`);
      continue;
    }
    if (packet.decision !== "approve") {
      blockers.push(`${model} decision is '${packet.decision}', not 'approve'.`);
    }
    if (asArray(packet.required_edits).length > 0) {
      blockers.push(`${model} has required edits: ${asArray(packet.required_edits).join("; ")}`);
    }
    if (asArray(packet.hard_stops).length > 0) {
      blockers.push(`${model} has hard stops: ${asArray(packet.hard_stops).join("; ")}`);
    }
  }

  // In signed mode, only signature-verified required packets are trusted as
  // evidence for docs_reviewed / LEXI review below. A duplicate packet (only the
  // first per model reaches packetsByModel and is verified) or a non-required-model
  // packet is never signature-checked, so it must not clear a required-doc or LEXI
  // blocker. Legacy/unsigned mode authenticates nothing, so every packet counts.
  const trustedPackets = [];
  if (signed) {
    for (const model of REQUIRED_MODELS) {
      const packet = packetsByModel.get(model);
      if (!packet) continue; // already blocked as missing above
      const secret = secretFor(model);
      if (!secret) {
        blockers.push(`trust_mode 'signed' but no secret to verify ${model} packet (set TELOS_SECRET_${model.toUpperCase()}).`);
        continue;
      }
      const result = verifyPacket(packet, secret);
      if (!result.ok) {
        blockers.push(`${model} packet signature invalid in signed mode: ${result.reason}.`);
      } else {
        trustedPackets.push(packet);
      }
    }
  }
  const evidencePackets = signed ? trustedPackets : packets;

  // Provenance is advisory: the gate CANNOT cryptographically authenticate which
  // model authored a packet. It surfaces whether each required approval carries a
  // `provenance` block (ideally captured from the real model response — see
  // ai-peer-mcp council_review) and warns when identity is merely self-declared.
  const provenance = [];
  for (const model of REQUIRED_MODELS) {
    const packet = packetsByModel.get(model);
    const prov = packet && packet.provenance && typeof packet.provenance === "object" ? packet.provenance : null;
    const responseId = prov && typeof prov.response_id === "string" ? prov.response_id : null;
    const placeholder = !responseId || /^$|_self$|^self$|placeholder/i.test(responseId);
    provenance.push({
      model,
      has_provenance: !!prov,
      response_model: prov && typeof prov.model === "string" ? prov.model : null,
      response_id: responseId,
      source: prov && typeof prov.source === "string" ? prov.source : null
    });
    if (packet && (!prov || placeholder)) {
      const msg = !prov
        ? `Approval packet for ${model} carries no provenance; model identity is self-declared, not authenticated.`
        : `Approval packet for ${model} has placeholder provenance.response_id '${responseId}'; not bound to a real model response.`;
      if (signed) blockers.push(msg); else if (!prov) warnings.push(msg);
    }
  }

  const requiredDocs = asArray(dossier.required_docs);
  const docsReviewed = unique(evidencePackets.flatMap((packet) => asArray(packet.docs_reviewed)));
  // Membership is path-normalized: separators (\ vs /) and case do not change
  // whether a required doc counts as reviewed.
  const reviewedNormalized = new Set(docsReviewed.map(normalizeDocPath));
  for (const doc of requiredDocs) {
    if (!reviewedNormalized.has(normalizeDocPath(doc))) {
      blockers.push(`Required doc was not reviewed by any packet: ${doc}`);
    }
  }

  validateProtectedPaths(dossier, blockers);
  validateLexiGate(dossier, evidencePackets, blockers);
  validateGrokResolution(packetsByModel.get("grok"), dossier, blockers, warnings);
  validateCapabilityPackets(dossier, capabilityPackets, blockers, warnings, signed);
  validateMarketReadinessPackets(dossier, marketPackets, blockers, warnings, source, signed);

  // Visibility: which optional headline gates actually evaluated anything. A
  // minimal dossier no longer silently runs only the base checks — the report
  // says plainly what did and did not fire.
  const headline_checks = {
    capability_evaluated: requiredCapabilityModels(dossier, capabilityPackets).length > 0,
    market_evaluated: requiredMarketWorkstreams(dossier, marketPackets).length > 0,
    lexi_required: dossier.lexi_required === true,
    breakout_evaluated: marketPackets.some((packet) => packet && packet.lexi_class_ui_status === "meets"),
    signing_enforced: signed,
    provenance_enforced: signed
  };

  const gateStatus = blockers.length === 0 ? "pass" : "blocked";
  return {
    gate_status: gateStatus,
    build_id: dossier.build_id ?? null,
    use_case: dossier.use_case ?? null,
    safe_next_action: gateStatus === "pass" ? "begin-build" : "resolve-blockers-before-build",
    blockers,
    warnings,
    required_models: REQUIRED_MODELS,
    provenance,
    headline_checks,
    required_capability_models: requiredCapabilityModels(dossier, capabilityPackets),
    required_market_workstreams: requiredMarketWorkstreams(dossier, marketPackets),
    packets_seen: unique(packets.map((packet) => packet.model).filter(Boolean)),
    capability_packets_seen: unique(capabilityPackets.map((packet) => packet.model).filter(Boolean)),
    market_packets_seen: unique(marketPackets.map((packet) => packet.model).filter(Boolean)),
    required_docs: requiredDocs,
    docs_reviewed: docsReviewed,
    write_targets: asArray(dossier.write_targets),
    source
  };
}

// In trust_mode "signed", evidence packets that decide gate outcomes (market
// readiness, capability acquisition) must be authenticated exactly like the
// required approval packets: HMAC-verified with the model's secret AND bound to
// real (non-placeholder) provenance. Unverifiable evidence blocks — a
// self-asserted market/capability packet must never satisfy the gate under
// signed mode. Mirrors the required-approval checks in validateRecords.
function enforceSignedPacketAuth(packet, label, blockers) {
  const model = typeof packet?.model === "string" ? packet.model : "unknown";
  const secret = secretFor(model);
  if (!secret) {
    blockers.push(`trust_mode 'signed' but no secret to verify ${label} for '${model}' (set TELOS_SECRET_${model.toUpperCase()}).`);
  } else {
    const result = verifyPacket(packet, secret);
    if (!result.ok) {
      blockers.push(`${label} for ${model} signature invalid in signed mode: ${result.reason}.`);
    }
  }
  const prov = packet && packet.provenance && typeof packet.provenance === "object" ? packet.provenance : null;
  const responseId = prov && typeof prov.response_id === "string" ? prov.response_id : null;
  const placeholder = !responseId || /^$|_self$|^self$|placeholder/i.test(responseId);
  if (!prov) {
    blockers.push(`${label} for ${model} carries no provenance; model identity is self-declared, not authenticated.`);
  } else if (placeholder) {
    blockers.push(`${label} for ${model} has placeholder provenance.response_id '${responseId}'; not bound to a real model response.`);
  }
}

function validateMarketReadinessPackets(dossier, marketPackets, blockers, warnings, source = {}, signed = false) {
  const requiredWorkstreams = requiredMarketWorkstreams(dossier, marketPackets);
  if (requiredWorkstreams.length === 0) return;

  if (dossier.market_bound !== true && marketPackets.length > 0) {
    warnings.push("Market readiness packets were supplied for a dossier that is not marked market_bound.");
  }
  if (typeof dossier.idea_id !== "string" || dossier.idea_id.length === 0) {
    blockers.push("Market readiness validation requires dossier.idea_id.");
  }
  if (marketPackets.length === 0) {
    blockers.push("Market-bound build requires at least one market readiness packet.");
    return;
  }

  const reviewedWorkstreams = [];
  let frontendMeets = false;
  const frontendRequired = dossier.user_facing_frontend !== false
    && requiredWorkstreams.includes("frontend-brand-experience");

  for (const packet of marketPackets) {
    validateMarketReadinessPacketShape(packet, blockers);
    if (signed) enforceSignedPacketAuth(packet, "Market readiness packet", blockers);
    if (packet?.build_id !== dossier.build_id) {
      blockers.push(`Market readiness packet for ${packet?.model ?? "unknown"} has build_id '${packet?.build_id}' but dossier requires '${dossier.build_id}'.`);
    }
    if (dossier.idea_id && packet?.idea_id !== dossier.idea_id) {
      blockers.push(`Market readiness packet for ${packet?.model ?? "unknown"} has idea_id '${packet?.idea_id}' but dossier requires '${dossier.idea_id}'.`);
    }

    reviewedWorkstreams.push(...asArray(packet.workstreams_reviewed));

    if (asArray(packet.go_to_market_blockers).length > 0) {
      blockers.push(`${packet.model ?? "unknown"} has go-to-market blockers: ${asArray(packet.go_to_market_blockers).join("; ")}`);
    }

    if (packet.lexi_class_ui_status === "needs-work" && dossier.user_facing_frontend !== false) {
      blockers.push(`${packet.model ?? "unknown"} says LEXI-class UI needs-work for a user-facing market-bound build.`);
    }

    // Re-verify a breakout record on ANY market packet that carries one — every
    // team's claim is checked on facts, not just the UI team's. A lexi 'meets'
    // packet still REQUIRES a breakout (the missing-record blocker is raised
    // inside validateBreakoutRecord), preserving prior behavior; packets that
    // carry no breakout are unaffected (legacy market packets keep passing).
    if (packet.lexi_class_ui_status === "meets" || (packet.breakout && typeof packet.breakout === "object")) {
      validateBreakoutRecord(packet, blockers, warnings, dossier, source, signed);
    }

    if (
      asArray(packet.workstreams_reviewed).includes("frontend-brand-experience")
      && packet.lexi_class_ui_status === "meets"
    ) {
      frontendMeets = true;
    }
  }

  const reviewedSet = new Set(reviewedWorkstreams);
  for (const workstream of requiredWorkstreams) {
    if (!reviewedSet.has(workstream)) {
      blockers.push(`Required market-readiness workstream was not reviewed: ${workstream}`);
    }
  }

  if (frontendRequired && !frontendMeets) {
    blockers.push("User-facing market-bound build requires a frontend-brand-experience packet with lexi_class_ui_status 'meets'.");
  }
}

// A "meets" claim is not self-asserted. The record's self-reported shape is
// checked for consistency, but the LOAD-BEARING step is re-verification: the gate
// rebuilds the record's declarative read-only checks and RE-RUNS them against the
// real filesystem. The verdict comes from the gate's own re-run, not from the
// packet's `converged` boolean — so fabricated or absent facts cannot pass.
function validateBreakoutRecord(packet, blockers, warnings, dossier, source, signed = false) {
  const model = packet?.model ?? "unknown";
  const record = packet?.breakout;

  if (!record || typeof record !== "object") {
    blockers.push(`${model} claims lexi_class_ui_status 'meets' without a breakout record; a 'meets' must survive a self-challenge breakout.`);
    return;
  }
  if (record.converged !== true || record.finalStatus !== "meets") {
    blockers.push(`${model} breakout record did not converge to 'meets' (converged=${record.converged}, finalStatus='${record.finalStatus}').`);
  }
  if (asArray(record.surviving_blockers).length > 0) {
    blockers.push(`${model} claims 'meets' but its breakout record still has surviving blockers: ${asArray(record.surviving_blockers).join("; ")}.`);
  }
  if (asArray(record.rounds).length === 0) {
    blockers.push(`${model} breakout record has no challenge rounds; 'meets' must survive at least one round.`);
  }
  if (
    typeof record.workstream === "string"
    && asArray(packet.workstreams_reviewed).length > 0
    && !asArray(packet.workstreams_reviewed).includes(record.workstream)
  ) {
    blockers.push(`${model} breakout record targets workstream '${record.workstream}' which is not in workstreams_reviewed.`);
  }

  // The truth test: re-run the record's declarative checks ourselves.
  const baseDir = breakoutBaseDir(dossier, source);
  const result = reverifyRecord(record, baseDir);
  if (result.reverifiable === 0) {
    blockers.push(`${model} breakout record carries no gate-verifiable checks (need file_exists/file_contains specs under record.checks); 'meets' cannot be re-verified by the gate.`);
  } else if (!result.allPass) {
    const detail = result.failing.map((f) => f.detail || f.id).join("; ");
    blockers.push(`${model} breakout record FAILED gate re-verification (${result.failing.length}/${result.reverifiable} checks failed): ${detail}.`);
  }

  // Sufficiency floor (signed mode only — legacy dossiers keep today's behavior).
  if (signed) {
    if (result.reverifiable > 0 && !result.hasFileContains) {
      blockers.push(`${model} 'meets' evidence is existence-only; signed mode requires at least one file_contains check.`);
    }
    for (const empty of result.emptyEvidenceFiles) {
      blockers.push(`${model} 'meets' evidence file is empty (zero-byte): ${empty}.`);
    }
    warnings.push(`${model} breakout re-verify root is dossier-chosen (affected_directories[0]); checks prove truth, not sufficiency.`);
  }
}

// Path-insensitive doc identity: separators and case do not change whether a
// required doc counts as reviewed.
function normalizeDocPath(value) {
  return typeof value === "string" ? value.replace(/\\/g, "/").toLowerCase() : value;
}

// Where the gate resolves a breakout record's relative check paths: the project
// being built (dossier.affected_directories[0]), else the dossier's directory.
// Read-only checks are confined under this dir by the verifier.
function breakoutBaseDir(dossier, source) {
  const dossierDir = source?.dossierDir || process.cwd();
  const affected = asArray(dossier?.affected_directories);
  if (typeof affected[0] === "string" && affected[0]) {
    return path.isAbsolute(affected[0]) ? affected[0] : path.resolve(dossierDir, affected[0]);
  }
  return dossierDir;
}

function validateMarketReadinessPacketShape(packet, blockers) {
  requireStringField(packet, "build_id", "Market readiness packet", blockers);
  requireStringField(packet, "idea_id", "Market readiness packet", blockers);
  requireStringField(packet, "model", "Market readiness packet", blockers);
  requireStringField(packet, "project_state", "Market readiness packet", blockers);
  requireArrayField(packet, "workstreams_reviewed", "Market readiness packet", blockers);
  requireStringField(packet, "business_thesis", "Market readiness packet", blockers);
  requireArrayField(packet, "target_users", "Market readiness packet", blockers);
  requireArrayField(packet, "architecture_findings", "Market readiness packet", blockers);
  requireArrayField(packet, "backend_schema_findings", "Market readiness packet", blockers);
  requireArrayField(packet, "security_findings", "Market readiness packet", blockers);
  requireArrayField(packet, "accuracy_eval_findings", "Market readiness packet", blockers);
  requireArrayField(packet, "scalability_findings", "Market readiness packet", blockers);
  requireArrayField(packet, "frontend_design_findings", "Market readiness packet", blockers);
  requireStringField(packet, "lexi_class_ui_status", "Market readiness packet", blockers);
  requireArrayField(packet, "go_to_market_blockers", "Market readiness packet", blockers);
  requireStringField(packet, "recommendation_to_claude", "Market readiness packet", blockers);
  requireStringField(packet, "timestamp", "Market readiness packet", blockers);

  if (packet?.project_state && !VALID_PROJECT_STATES.has(packet.project_state)) {
    blockers.push(`Market readiness packet for ${packet.model ?? "unknown"} has invalid project_state '${packet.project_state}'.`);
  }
  if (packet?.lexi_class_ui_status && !VALID_LEXI_CLASS_UI_STATUS.has(packet.lexi_class_ui_status)) {
    blockers.push(`Market readiness packet for ${packet.model ?? "unknown"} has invalid lexi_class_ui_status '${packet.lexi_class_ui_status}'.`);
  }
  if (packet?.timestamp && Number.isNaN(Date.parse(packet.timestamp))) {
    blockers.push(`Market readiness packet for ${packet.model ?? "unknown"} has invalid timestamp '${packet.timestamp}'.`);
  }
}

function requiredMarketWorkstreams(dossier, marketPackets) {
  if (Array.isArray(dossier.required_market_workstreams) && dossier.required_market_workstreams.length > 0) {
    return dossier.required_market_workstreams;
  }
  if (dossier.market_bound === true) {
    return DEFAULT_MARKET_WORKSTREAMS;
  }
  return marketPackets.length > 0 ? unique(marketPackets.flatMap((packet) => asArray(packet.workstreams_reviewed))) : [];
}

async function readJsonFile(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

async function readPacketDir(packetDir) {
  let entries;
  try {
    entries = await readdir(packetDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Could not read packet directory ${packetDir}: ${error.message}`);
  }

  const packets = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    packets.push(await readJsonFile(path.join(packetDir, entry.name)));
  }
  return packets;
}

function validateDossierShape(dossier, blockers) {
  requireStringField(dossier, "build_id", "Dossier", blockers);
  requireStringField(dossier, "use_case", "Dossier", blockers);
  requireStringField(dossier, "objective", "Dossier", blockers);
  requireArrayField(dossier, "required_docs", "Dossier", blockers);
  requireArrayField(dossier, "write_targets", "Dossier", blockers);
}

function validateCapabilityPackets(dossier, capabilityPackets, blockers, warnings, signed = false) {
  const requiredModels = requiredCapabilityModels(dossier, capabilityPackets);
  if (requiredModels.length === 0) return;

  if (typeof dossier.telos !== "string" || dossier.telos.length === 0) {
    blockers.push("Prototype capability validation requires dossier.telos.");
  }
  if (typeof dossier.idea_id !== "string" || dossier.idea_id.length === 0) {
    blockers.push("Prototype capability validation requires dossier.idea_id.");
  }

  const packetsByModel = new Map();
  for (const packet of capabilityPackets) {
    validateCapabilityPacketShape(packet, blockers);
    if (signed) enforceSignedPacketAuth(packet, "Capability packet", blockers);
    if (packet?.build_id !== dossier.build_id) {
      blockers.push(`Capability packet for ${packet?.model ?? "unknown"} has build_id '${packet?.build_id}' but dossier requires '${dossier.build_id}'.`);
    }
    if (dossier.idea_id && packet?.idea_id !== dossier.idea_id) {
      blockers.push(`Capability packet for ${packet?.model ?? "unknown"} has idea_id '${packet?.idea_id}' but dossier requires '${dossier.idea_id}'.`);
    }
    if (dossier.telos && packet?.telos !== dossier.telos) {
      blockers.push(`Capability packet for ${packet?.model ?? "unknown"} does not match dossier telos.`);
    }
    if (typeof packet?.model === "string" && !packetsByModel.has(packet.model)) {
      packetsByModel.set(packet.model, packet);
    }
  }

  for (const model of requiredModels) {
    const packet = packetsByModel.get(model);
    if (!packet) {
      blockers.push(`Missing required ${model} capability acquisition packet.`);
      continue;
    }
    if (asArray(packet.missing_capabilities).length > 0 && packet.presented_to_claude !== true) {
      blockers.push(`${model} has missing capabilities that were not presented to Claude.`);
    }
    if (asArray(packet.must_request_user_or_install).length > 0) {
      blockers.push(`${model} requires user/plugin/API setup before build: ${asArray(packet.must_request_user_or_install).join("; ")}`);
    }
  }

  if (capabilityPackets.length === 0) {
    warnings.push("No capability acquisition packets present.");
  }
}

function validateCapabilityPacketShape(packet, blockers) {
  requireStringField(packet, "build_id", "Capability packet", blockers);
  requireStringField(packet, "idea_id", "Capability packet", blockers);
  requireStringField(packet, "model", "Capability packet", blockers);
  requireStringField(packet, "telos", "Capability packet", blockers);
  requireArrayField(packet, "docs_needed", "Capability packet", blockers);
  requireArrayField(packet, "skills_needed", "Capability packet", blockers);
  requireArrayField(packet, "connectors_needed", "Capability packet", blockers);
  requireArrayField(packet, "available_now", "Capability packet", blockers);
  requireArrayField(packet, "missing_capabilities", "Capability packet", blockers);
  requireArrayField(packet, "can_build_during_planning", "Capability packet", blockers);
  requireArrayField(packet, "built_during_planning", "Capability packet", blockers);
  requireArrayField(packet, "must_request_user_or_install", "Capability packet", blockers);
  requireStringField(packet, "recommendation_to_claude", "Capability packet", blockers);
  requireStringField(packet, "timestamp", "Capability packet", blockers);

  if (packet?.presented_to_claude !== true && packet?.presented_to_claude !== false) {
    blockers.push(`Capability packet for ${packet?.model ?? "unknown"} needs boolean field 'presented_to_claude'.`);
  }
  if (packet?.timestamp && Number.isNaN(Date.parse(packet.timestamp))) {
    blockers.push(`Capability packet for ${packet.model ?? "unknown"} has invalid timestamp '${packet.timestamp}'.`);
  }
}

function requiredCapabilityModels(dossier, capabilityPackets) {
  if (Array.isArray(dossier.required_capability_models) && dossier.required_capability_models.length > 0) {
    return dossier.required_capability_models;
  }
  return capabilityPackets.length > 0 ? DEFAULT_CAPABILITY_MODELS : [];
}

function validatePacketShape(packet, blockers) {
  requireStringField(packet, "build_id", "Packet", blockers);
  requireStringField(packet, "use_case", "Packet", blockers);
  requireStringField(packet, "model", "Packet", blockers);
  requireStringField(packet, "role", "Packet", blockers);
  requireArrayField(packet, "docs_reviewed", "Packet", blockers);
  requireStringField(packet, "proposal_ref", "Packet", blockers);
  requireStringField(packet, "decision", "Packet", blockers);
  requireArrayField(packet, "required_edits", "Packet", blockers);
  requireArrayField(packet, "hard_stops", "Packet", blockers);
  requireStringField(packet, "confidence", "Packet", blockers);
  requireStringField(packet, "timestamp", "Packet", blockers);

  if (packet?.decision && !VALID_DECISIONS.has(packet.decision)) {
    blockers.push(`Packet for ${packet.model ?? "unknown"} has invalid decision '${packet.decision}'.`);
  }
  if (packet?.confidence && !VALID_CONFIDENCE.has(packet.confidence)) {
    blockers.push(`Packet for ${packet.model ?? "unknown"} has invalid confidence '${packet.confidence}'.`);
  }
  if (packet?.timestamp && Number.isNaN(Date.parse(packet.timestamp))) {
    blockers.push(`Packet for ${packet.model ?? "unknown"} has invalid timestamp '${packet.timestamp}'.`);
  }
}

function validateProtectedPaths(dossier, blockers) {
  const currentFilePath = fileURLToPath(import.meta.url);
  const vaultRoot = path.resolve(path.dirname(currentFilePath), "../../..");
  
  function safeResolve(root, inputPath) {
    let relativePath = inputPath;
    // A Windows drive designator ("C:" / "C:\" / "C:/") is absolute on Windows
    // but POSIX path.isAbsolute() does not recognize it, which would otherwise
    // leave the drive token as a literal segment and let an attacker-supplied
    // drive path slip past protected-path checks on a non-Windows runner. Strip
    // the drive root and treat the remainder as a tail rebased under `root`, so
    // the flattening below is identical on every platform.
    const driveRoot = /^[A-Za-z]:[/\\]?/;
    if (driveRoot.test(inputPath)) {
      relativePath = inputPath.replace(driveRoot, "");
    } else if (path.isAbsolute(inputPath)) {
      relativePath = path.relative(root, inputPath);
    }
    const segments = relativePath.split(/[/\\]/);
    const stack = [];
    for (const segment of segments) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") {
        if (stack.length > 0) stack.pop();
      } else {
        stack.push(segment);
      }
    }
    return path.resolve(root, ...stack);
  }

  const protectedPaths = unique([...DEFAULT_PROTECTED_PATHS, ...asArray(dossier.protected_paths)]);
  
  for (const target of asArray(dossier.write_targets)) {
    const resolvedTarget = safeResolve(vaultRoot, target);
    for (const protectedPath of protectedPaths) {
      const resolvedProtected = safeResolve(vaultRoot, protectedPath);
      const relative = path.relative(resolvedProtected.toLowerCase(), resolvedTarget.toLowerCase());
      const isInside = relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
      if (isInside) {
        blockers.push(`Write target '${target}' is inside protected path '${protectedPath}'.`);
        break;
      }
    }
  }
}

function validateLexiGate(dossier, packets, blockers) {
  if (dossier.lexi_required === true) {
    if (dossier.lexi_reference_read !== true) {
      blockers.push("LEXI is required but lexi_reference_read is not true.");
    }
    const canonical = "shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md";
    const normalizedCanonical = canonical.replace(/\\/g, "/").toLowerCase();
    const reviewed = packets.some(packet => 
      asArray(packet?.docs_reviewed).some(doc => 
        typeof doc === "string" && doc.replace(/\\/g, "/").toLowerCase() === normalizedCanonical
      )
    );
    if (!reviewed) {
      blockers.push(`LEXI reference document '${canonical}' must be reviewed by at least one packet.`);
    }
  }
}

function validateGrokResolution(grokPacket, dossier, blockers, warnings) {
  if (!grokPacket) {
    warnings.push("No Grok advisory packet present.");
    return;
  }

  const objections = asArray(dossier.grok_objections);
  const objectionByText = new Map();
  for (const objection of objections) {
    if (!objection || typeof objection !== "object") {
      blockers.push("Every Grok objection entry must be an object.");
      continue;
    }
    if (typeof objection.text !== "string" || objection.text.length === 0) {
      blockers.push("Every Grok objection needs non-empty text.");
      continue;
    }
    if (!VALID_GROK_OBJECTION_STATUS.has(objection.status)) {
      blockers.push(`Grok objection '${objection.text}' has invalid status '${objection.status}'.`);
      continue;
    }
    if ((objection.status === "dismissed" || objection.status === "resolved") && typeof objection.resolution !== "string") {
      blockers.push(`Grok objection '${objection.text}' needs a resolution.`);
    }
    objectionByText.set(objection.text, objection);
  }

  for (const hardStop of asArray(grokPacket.hard_stops)) {
    const resolution = objectionByText.get(hardStop);
    if (!resolution) {
      blockers.push(`Grok hard stop is unresolved in dossier: ${hardStop}`);
      continue;
    }
    if (resolution.status === "accepted-blocker") {
      blockers.push(`Accepted Grok blocker remains open: ${hardStop}`);
    }
  }

  if (grokPacket.decision === "reject" || grokPacket.decision === "revise") {
    warnings.push(`Grok advisory decision is '${grokPacket.decision}'. Required models must explicitly resolve any concerns.`);
  }
}

function requireStringField(record, field, label, blockers) {
  if (typeof record?.[field] !== "string" || record[field].length === 0) {
    blockers.push(`${label} missing required string field '${field}'.`);
  }
}

function requireArrayField(record, field, label, blockers) {
  if (!Array.isArray(record?.[field])) {
    blockers.push(`${label} missing required array field '${field}'.`);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeVaultPath(value) {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^[a-zA-Z]:\/Users\/[^/]+\/OneDrive\/Attachments\/Desktop\/V4\//, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function stripTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeReportPath(value) {
  return path.normalize(value).replace(/\\/g, "/");
}

function renderLedger(report) {
  const lines = [
    "---",
    "author: codex",
    "last-edited-by: codex",
    `last-edited-at: ${new Date().toISOString()}`,
    "workflow-status: gate-report",
    "tags:",
    "  - workflow/build-gate",
    "---",
    "",
    `# Build Gate Ledger: ${report.build_id}`,
    "",
    `- use-case: ${report.use_case}`,
    `- gate-status: ${report.gate_status}`,
    `- safe-next-action: ${report.safe_next_action}`,
    `- packets-seen: ${report.packets_seen.join(", ") || "none"}`,
    "",
    "## Blockers",
    ""
  ];

  if (report.blockers.length === 0) {
    lines.push("- none");
  } else {
    lines.push(...report.blockers.map((blocker) => `- ${blocker}`));
  }

  lines.push("", "## Warnings", "");
  if (report.warnings.length === 0) {
    lines.push("- none");
  } else {
    lines.push(...report.warnings.map((warning) => `- ${warning}`));
  }

  lines.push("", "## Required Docs", "");
  lines.push(...report.required_docs.map((doc) => `- ${doc}`));
  lines.push("");
  return lines.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
