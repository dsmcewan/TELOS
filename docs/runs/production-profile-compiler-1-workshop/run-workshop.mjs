#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";

import { askClaude, askCodex } from "../../../connectors/ai-peer-mcp/server.mjs";
import { callClaudeCode } from "./claude-code-seat.mjs";
import { callCodexCli } from "./codex-cli-seat.mjs";
import { prepareWorkshopFrame, runWorkshop } from "./workshop-lib.mjs";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const DEFAULT_RUN_DIR = "docs/runs/production-profile-compiler-1-workshop";
const PATHS = Object.freeze({
  candidate: "docs/superpowers/plans/2026-07-20-deterministic-production-profile-compiler.md",
  design: "docs/superpowers/specs/2026-07-20-deterministic-production-profile-compiler-design.md",
  preReview: "docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-20-production-profile-compiler-1.json",
  methodology: "docs/daedalus-methodology.md",
  comprehension: "docs/runs/production-profile-compiler-1-workshop/reader-validation-artifact.json",
  ruling: "docs/runs/production-profile-compiler-1-workshop/controller-ruling-file-ingress.json"
});

const AUTHOR_CONSTRAINTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan: {
      type: "string",
      description: "Constraint contract in Markdown: invariants, trust boundaries, failure semantics, normative schemas, proof obligations, and discriminating negative tests."
    },
    obligations: {
      type: "array",
      items: { type: "string" },
      description: "Unique stable PPC-WNN obligation IDs owned by the constraints seat and covered exactly by the integration matrix."
    }
  },
  required: ["plan", "obligations"]
};

const AUTHOR_IMPLEMENTATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plan: {
      type: "string",
      description: "Implementation-design assessment in Markdown: architecture, interfaces, data flow, task decomposition, sequencing, compatibility, delivery, and exact candidate-plan changes if any."
    }
  },
  required: ["plan"]
};

const MATRIX_ROW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    obligation_id: { type: "string" },
    invariant: { type: "string" },
    mechanism: { type: "string" },
    task: { type: "string" },
    negative_test: { type: "string" },
    exit_criterion: { type: "string" }
  },
  required: [
    "obligation_id",
    "invariant",
    "mechanism",
    "task",
    "negative_test",
    "exit_criterion"
  ]
};

const INTEGRATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "string",
      enum: ["preserve", "revise"],
      description: "Use preserve only when the candidate plan is already complete; use revise only with exact unique replacements."
    },
    maturation_summary: {
      type: "string",
      description: "Concise explanation of why the candidate is preserved or revised."
    },
    replacements: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          old: {
            type: "string",
            description: "Exact candidate-plan text that occurs once. Include enough surrounding context to make it unique."
          },
          new: {
            type: "string",
            description: "Complete replacement text."
          },
          reason: {
            type: "string",
            description: "The source obligation or implementation defect this replacement resolves."
          }
        },
        required: ["old", "new", "reason"]
      }
    },
    obligation_matrix: {
      type: "array",
      items: MATRIX_ROW_SCHEMA,
      description: "Strict bijection over the constraints-declared obligation IDs."
    }
  },
  required: ["decision", "maturation_summary", "replacements", "obligation_matrix"]
};

const VERIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    verdict: {
      type: "string",
      enum: ["preserved", "violated"],
      description: "Literal preserved only if the seat's complete source contract survived integration without weakening."
    },
    conflicts: {
      type: "array",
      items: { type: "string" },
      description: "Specific conflicts when violated; empty only when preserved."
    }
  },
  required: ["verdict", "conflicts"]
};

const SYSTEM = [
  "You are a specification engineer in the TELOS Daedalus parallel-authorship workshop.",
  "This run matures an implementation plan only. It cannot authorize the plan, alter CURRENT-AUTHORITY.json, start Argo, or implement product code.",
  "The approved design, Iliad pre-review, Eye rulings, and Daedalus methodology in the frozen frame are binding inputs.",
  "Precision over politeness. Reject vacuous checks, self-certified evidence, hidden skip jurisdiction, stale-hash acceptance, open schemas, and claims broader than executable predicates.",
  "Repository constraints are binding: Node 18 and 20, ESM, zero runtime dependencies, fail-closed behavior, controller jurisdiction, host portability, and no real personal data or live provider calls in tests."
].join("\n");

function authorPrompt(role, frame) {
  if (role === "constraints") {
    return [
      "You own the CONSTRAINT DESIGN.",
      "Read the complete frozen frame and derive the smallest complete behavioral model the candidate must satisfy.",
      "Audit every trust boundary and state machine end to end: inputs, hashes, artifacts, failure paths, recovery, settlement, dogfood, lifecycle evidence, and portability.",
      "Declare a closed, unique set of stable obligation IDs named PPC-W01, PPC-W02, and so on. Each must be load-bearing and discriminated by a negative test.",
      "Do not rewrite the candidate plan. Return a constraint contract that an integrator can map exactly.",
      "",
      frame
    ].join("\n");
  }
  return [
    "You own the IMPLEMENTATION DESIGN.",
    "Read the complete frozen frame and adversarially test the candidate against current TELOS interfaces and executable reality.",
    "Check file ownership, function signatures, task ordering, TDD steps, command contracts, state transitions, cleanup, evidence publication, Node portability, and whether every snippet can actually compose.",
    "Prefer preserving a complete candidate. Recommend a change only for a material defect, contradiction, unimplementable interface, missing negative oracle, or unjustified behavioral surface.",
    "Do not emit a full replacement plan. Return an implementation assessment with exact candidate passages that need revision, if any.",
    "",
    frame
  ].join("\n");
}

function integrationPrompt(frame, sources) {
  const constraints = sources.find((source) => source.role === "constraints");
  const implementation = sources.find((source) => source.role === "implementation");
  return [
    "You are the INTEGRATOR. Preserve both independently authored contracts in one candidate.",
    "The controller, not you, materializes the final full plan. Return decision=preserve with zero replacements if the existing candidate already satisfies both contracts.",
    "If and only if a material defect remains, return decision=revise and the smallest set of exact replacements. Every old string must be copied byte-for-byte from the candidate and occur exactly once; include enough context for uniqueness. Do not use line numbers, ellipses, placeholders, or prose instructions.",
    "Produce exactly one obligation_matrix row for every constraints-declared ID, with no missing, invented, or duplicate IDs.",
    "",
    `Declared obligation IDs: ${JSON.stringify(constraints?.obligations ?? [])}`,
    "",
    "=== CONSTRAINT SOURCE ===",
    constraints?.body ?? "(missing)",
    "",
    "=== IMPLEMENTATION SOURCE ===",
    implementation?.body ?? "(missing)",
    "",
    "=== FROZEN FRAME, INCLUDING CANDIDATE ===",
    frame
  ].join("\n");
}

function verifyPrompt(role, frame, source, integration) {
  const ownership = role === "constraints"
    ? "Verify every declared invariant and proof obligation is present without weaker wording, missing coverage, vacuous evidence, or new model jurisdiction."
    : "Verify the architecture, interfaces, sequencing, compatibility, and delivery mechanics survived without becoming unimplementable or behaviorally wider.";
  return [
    `You are the ${role.toUpperCase()} VERIFIER checking your own source contract after integration.`,
    ownership,
    "Return verdict=preserved only if the entire contract survives. Any real conflict must be verdict=violated with exact conflicts; that routes to The Eye and must not be blended.",
    "",
    "=== YOUR SOURCE ===",
    source?.body ?? "(missing)",
    "",
    "=== INTEGRATED FULL PLAN ===",
    integration?.plan ?? "(missing)",
    "",
    "=== OBLIGATION MATRIX ===",
    JSON.stringify(integration?.obligation_matrix ?? [], null, 2),
    "",
    "=== FROZEN FRAME ===",
    frame
  ].join("\n");
}

function askFor(seat) {
  if (seat === "claude" && process.env.CLAUDE_CODE_OAUTH === "1") return callClaudeCode;
  if (seat === "codex" && process.env.CODEX_CLI_OAUTH === "1") return callCodexCli;
  return seat === "claude" ? askClaude : askCodex;
}

function providerFor(seat) {
  return seat === "claude" ? "anthropic" : "openai";
}

async function liveCallSeat({ seat, role, phase, frame, sources, integration }) {
  let prompt;
  let schema;
  let schemaName;
  let maxTokens;
  if (phase === "author") {
    prompt = authorPrompt(role, frame);
    schema = role === "constraints" ? AUTHOR_CONSTRAINTS_SCHEMA : AUTHOR_IMPLEMENTATION_SCHEMA;
    schemaName = `production_profile_workshop_author_${role}`;
    maxTokens = 24000;
  } else if (phase === "integrate") {
    prompt = integrationPrompt(frame, sources || []);
    schema = INTEGRATE_SCHEMA;
    schemaName = "production_profile_workshop_integration";
    maxTokens = 32000;
  } else {
    prompt = verifyPrompt(role, frame, (sources || [])[0], integration);
    schema = VERIFY_SCHEMA;
    schemaName = `production_profile_workshop_verify_${role}`;
    maxTokens = 12000;
  }

  const claudeCode = seat === "claude" && process.env.CLAUDE_CODE_OAUTH === "1";
  const codexCli = seat === "codex" && process.env.CODEX_CLI_OAUTH === "1";
  const response = await askFor(seat)({
    prompt,
    system: SYSTEM,
    model: claudeCode
      ? (process.env.CLAUDE_CODE_MODEL || "sonnet")
      : codexCli
        ? (process.env.CODEX_CLI_MODEL || "gpt-5.6-sol")
        : seat,
    effort: "high",
    max_tokens: maxTokens,
    response_schema: schema,
    schema_name: schemaName
  });
  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch (error) {
    throw new Error(`${seat}/${role}/${phase} returned invalid structured JSON: ${error.message}`);
  }
  const provenance = {
    provider: providerFor(seat),
    model: response.model,
    response_id: response.id,
    source: claudeCode
      ? "claude-code/print"
      : codexCli
        ? "codex-cli/exec"
        : `ai-peer-mcp/${seat === "claude" ? "claude_ask" : "codex_ask"}`
  };
  if (phase === "author") {
    return {
      plan: parsed.plan,
      ...(role === "constraints" ? { obligations: parsed.obligations } : {}),
      provenance,
      response: parsed
    };
  }
  if (phase === "integrate") return { provenance, response: parsed };
  return {
    verdict: parsed.verdict,
    conflicts: parsed.conflicts,
    provenance,
    response: parsed
  };
}

function makeSmokeCallSeat() {
  let call = 0;
  const obligations = ["PPC-W01"];
  return async ({ seat, role, phase }) => {
    call += 1;
    const provenance = {
      provider: providerFor(seat),
      model: `${seat}-smoke`,
      response_id: `smoke-${seat}-${role}-${phase}-${call}`,
      source: "workshop-smoke"
    };
    if (phase === "author" && role === "constraints") {
      const response = { plan: "# Smoke constraint source\n", obligations };
      return { ...response, provenance, response };
    }
    if (phase === "author") {
      const response = { plan: "# Smoke implementation source\n" };
      return { ...response, provenance, response };
    }
    if (phase === "integrate") {
      return {
        provenance,
        response: {
          decision: "preserve",
          maturation_summary: "Smoke integration preserves the candidate.",
          replacements: [],
          obligation_matrix: [{
            obligation_id: "PPC-W01",
            invariant: "the candidate is content-bound",
            mechanism: "controller materialization",
            task: "retain the candidate bytes",
            negative_test: "tampering changes the verified hash",
            exit_criterion: "the integrated candidate verifies"
          }]
        }
      };
    }
    const response = { verdict: "preserved", conflicts: [] };
    return { ...response, provenance, response };
  };
}

function parseArgs(argv) {
  const args = {
    smoke: false,
    preflight: false,
    runDir: DEFAULT_RUN_DIR,
    approvedMaxBudgetUsd: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--smoke") args.smoke = true;
    else if (value === "--preflight") args.preflight = true;
    else if (value === "--attempt") args.attempt = argv[++index];
    else if (value === "--run-dir") args.runDir = argv[++index];
    else if (value === "--approved-max-budget-usd") {
      const raw = argv[++index];
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("--approved-max-budget-usd must be a positive finite number");
      }
      args.approvedMaxBudgetUsd = amount;
    }
    else throw new Error(`unknown argument: ${value}`);
  }
  if (args.preflight) {
    if (args.smoke || args.attempt || args.runDir !== DEFAULT_RUN_DIR) {
      throw new Error("--preflight cannot be combined with --smoke, --attempt, or --run-dir");
    }
    return args;
  }
  if (args.approvedMaxBudgetUsd !== null) {
    throw new Error("--approved-max-budget-usd is accepted only with --preflight");
  }
  if (!args.attempt) {
    throw new Error("usage: run-workshop.mjs [--smoke] --attempt attempt-NNN [--run-dir <repo-relative-dir>] | --preflight [--approved-max-budget-usd <amount>]");
  }
  if (args.smoke && args.runDir === DEFAULT_RUN_DIR) {
    throw new Error("smoke output is prohibited in the governed workshop directory; pass an explicit test-only --run-dir");
  }
  if (!args.smoke && args.runDir !== DEFAULT_RUN_DIR) {
    throw new Error("live workshop output is fixed to the governed run directory");
  }
  return args;
}

function utf8Bytes(text) {
  return Buffer.byteLength(text, "utf8");
}

function preflightReport(approvedMaxBudgetUsd) {
  const prepared = prepareWorkshopFrame({
    repoRoot: ROOT,
    paths: PATHS,
    mode: "live"
  });
  const calls = [
    {
      sequence_group: 1,
      seat: "codex",
      role: "constraints",
      phase: "author",
      prompt_bytes: utf8Bytes(authorPrompt("constraints", prepared.frame)),
      system_bytes: utf8Bytes(SYSTEM),
      schema_bytes: utf8Bytes(JSON.stringify(AUTHOR_CONSTRAINTS_SCHEMA)),
      max_output_tokens: 24000,
      depends_on: []
    },
    {
      sequence_group: 1,
      seat: "claude",
      role: "implementation",
      phase: "author",
      prompt_bytes: utf8Bytes(authorPrompt("implementation", prepared.frame)),
      system_bytes: utf8Bytes(SYSTEM),
      schema_bytes: utf8Bytes(JSON.stringify(AUTHOR_IMPLEMENTATION_SCHEMA)),
      max_output_tokens: 24000,
      depends_on: []
    },
    {
      sequence_group: 2,
      seat: "claude",
      role: "integration",
      phase: "integrate",
      prompt_bytes: null,
      system_bytes: utf8Bytes(SYSTEM),
      schema_bytes: utf8Bytes(JSON.stringify(INTEGRATE_SCHEMA)),
      max_output_tokens: 32000,
      depends_on: ["constraints/author output", "implementation/author output"]
    },
    {
      sequence_group: 3,
      seat: "codex",
      role: "constraints",
      phase: "verify",
      prompt_bytes: null,
      system_bytes: utf8Bytes(SYSTEM),
      schema_bytes: utf8Bytes(JSON.stringify(VERIFY_SCHEMA)),
      max_output_tokens: 12000,
      depends_on: ["constraints/author output", "integration output"]
    },
    {
      sequence_group: 3,
      seat: "claude",
      role: "implementation",
      phase: "verify",
      prompt_bytes: null,
      system_bytes: utf8Bytes(SYSTEM),
      schema_bytes: utf8Bytes(JSON.stringify(VERIFY_SCHEMA)),
      max_output_tokens: 12000,
      depends_on: ["implementation/author output", "integration output"]
    }
  ];
  return {
    kind: "workshop-preflight",
    contract: prepared.contract,
    provider_calls_authorized: false,
    aggregate_spending_limit_usd: approvedMaxBudgetUsd,
    budget_status: approvedMaxBudgetUsd === null ? "awaiting-eye-approval" : "eye-approved-for-future-run",
    call_count: calls.length,
    frozen_frame: {
      bytes: utf8Bytes(prepared.frame),
      candidate_raw_sha256: prepared.inputSummary.candidate.raw_sha256,
      ruling_raw_sha256: prepared.inputSummary.ruling.raw_sha256
    },
    known_prompt_bytes: calls.reduce((total, call) => total + (call.prompt_bytes ?? 0), 0),
    all_prompt_sizes_exact: false,
    downstream_size_note: "Integration and verification prompt bytes become exact only after their declared model-output dependencies exist; no estimate is represented as exact.",
    call_plan: calls
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.preflight) {
    process.stdout.write(`${JSON.stringify(preflightReport(args.approvedMaxBudgetUsd), null, 2)}\n`);
    return;
  }
  if (!args.smoke) {
    if (process.env.CODEX_CLI_OAUTH !== "1" && !process.env.OPENAI_API_KEY) {
      throw new Error("missing OPENAI_API_KEY or CODEX_CLI_OAUTH=1; live workshop cannot substitute smoke provenance");
    }
    if (process.env.CLAUDE_CODE_OAUTH !== "1" && !process.env.ANTHROPIC_API_KEY) {
      throw new Error("missing ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH=1; live workshop cannot substitute smoke provenance");
    }
  }
  const runDir = path.resolve(ROOT, ...args.runDir.split("/"));
  const summary = await runWorkshop({
    repoRoot: ROOT,
    runDir,
    attemptId: args.attempt,
    mode: args.smoke ? "smoke" : "live",
    paths: PATHS,
    callSeat: args.smoke ? makeSmokeCallSeat() : liveCallSeat
  });
  process.stdout.write(`${JSON.stringify({
    state: summary.state,
    mode: summary.mode,
    reason: summary.reason,
    terminal: summary.terminal,
    selected_attempt: summary.selected_attempt,
    matured_plan_changed: summary.matured_plan_changed,
    matured_plan_sha256: summary.matured_plan?.raw_sha256 ?? null,
    authorization_granted: summary.authorization_granted,
    implementation_started: summary.implementation_started
  }, null, 2)}\n`);
  if (summary.state !== "converged-parallel" || summary.terminal !== "submit") {
    process.exitCode = 3;
  }
}

main().catch((error) => {
  console.error(`WORKSHOP_BLOCKED: ${error.message}`);
  process.exitCode = 2;
});
