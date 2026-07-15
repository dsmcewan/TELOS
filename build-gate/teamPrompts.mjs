// teamPrompts.mjs — LIVE wiring for the agentic teams over ai-peer-mcp.
//
// The orchestrator (build-orchestrator.mjs) is transport-agnostic: it takes an
// injected `callSeat` (council approval + Planning-team decompose) and `callTeam`
// (build execution). This module builds all of them over a minimal MCP client
// (../breakout/mcp_client.mjs), giving each team its own system prompt. It is
// opt-in: a seat with no API key fail-closes (the server returns no provenance →
// the gate honest-blocks), mirroring the existing `smoke` scripts. The pure
// prompt/parse helpers are unit-tested without a network.

import { agyApprovalPacket, agyCheckpointArgs, agyLifecycleCheckpointArgs } from "./council.mjs";
import { SCHEMAS, validateAgainstSchema, PROPOSAL_REVIEW_PACKET_SCHEMA, DAEDALUS_RESPONSE_SCHEMA } from "./schemas.mjs";

// Chat seats expose an `<model>_ask` tool; agy is structured (no code generation).
const ASK_MODELS = new Set(["claude", "grok", "codex", "gemini"]);
const VALID_DECISIONS = new Set(["approve", "revise", "reject", "advisory-note"]);

// Per-provider prompt framing that LEANS INTO each model's strength (see
// model-profiles.mjs) — the schema now carries the JSON contract, so the prompt is
// free to invoke what the model is best at, not just repeat a format instruction.
const PROVIDER_PROFILES = {
  claude: { frame: (body) => `<task>\n${body}\n</task>\n<approach>Architect and reason carefully; own the design. Be rigorous and concise.</approach>` },
  codex: { frame: (body) => `${body}\n\n# Approach\nImplement precisely and correctly. The output schema is enforced.` },
  grok: { frame: (body) => `${body}\n\nApproach: challenge it — find what's wrong, draw on the live landscape you know, be the adversary.` },
  gemini: { frame: (body) => `${body}\n\nApproach: independently verify. Cross-check the claim against first principles; don't trust — re-derive.` }
};

export function profileFor(model) {
  return PROVIDER_PROFILES[model] || { frame: (b) => b };
}
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

// Robustly pull the first {...} or [...] JSON value out of a model's answer
// (handles ```json fences and surrounding prose).
export function extractJson(text, open = "{", close = "}") {
  if (typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf(open);
  const end = body.lastIndexOf(close);
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

// A team's buildable lead: the first seat whose model has an _ask tool (so e.g.
// the ops team, led by the structured agy seat, still builds via its codex seat).
export function buildableSeat(team) {
  const seats = team && Array.isArray(team.seats) ? team.seats : [];
  const seat = seats.find((s) => ASK_MODELS.has(s.model));
  return seat ? seat.model : "claude";
}

// System prompt for a team: mission + the strict JSON contract the builder parses.
export function promptForTeam(team) {
  const mission = team && team.mission ? team.mission : "build the requested node";
  return [
    `You are the TELOS "${team?.id ?? "build"}" team. Mission: ${mission}.`,
    "You implement EXACTLY one task node. You see only its spec — never the wider plan.",
    "Return ONLY a JSON object of the form {\"files\":[{\"path\":\"<one of the node's declared files>\",\"content\":\"<file contents>\"}]}.",
    "Write every file the node declares and no others. No prose, no markdown fences."
  ].join(" ");
}

// Build the per-node user prompt from the injected spec (Rule 1: spec only).
// On a retry, `priorFailure` carries THIS node's OWN previous test failure so the
// team can self-correct — still own-node-only, no plan/other-node leak.
export function nodeBuildPrompt(node, priorFailure = null) {
  const lines = [
    `Task id: ${node.id}`,
    `Requirements: ${node.requirements}`,
    `Files to write (exactly these): ${JSON.stringify(node.files)}`
  ];
  if (priorFailure) {
    lines.push(
      "",
      `Your previous attempt FAILED its own test (exit ${priorFailure.status}).`,
      "Test output (truncated):",
      (priorFailure.stderr || priorFailure.stdout || priorFailure.detail || "").trim(),
      "Fix the files so the test passes."
    );
  }
  lines.push("Emit the JSON {files:[...]} now.");
  return lines.join("\n");
}

// Parse a team's response into a files array, CLAMPED to the node's declared
// files (a team cannot write outside its node spec — the orchestrator also
// re-checks path escapes, and Rule-3 verify re-derives the artifact hash).
export function parseTeamFiles(text, node) {
  let parsed;
  try { parsed = typeof text === "string" ? JSON.parse(text) : text; } catch { return []; }
  const body = parsed && typeof parsed.text === "string" ? safeJson(parsed.text) : parsed;
  const files = body && Array.isArray(body.files) ? body.files : [];
  const declared = new Set(node.files || []);
  return files
    .filter((f) => f && typeof f.path === "string" && declared.has(f.path) && typeof f.content === "string")
    .map((f) => ({ path: f.path, content: f.content }));
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Build a live callTeam({team,node,dossier}) over an MCP client. The team's
 * buildable lead is asked to emit the node's files as JSON; the result is parsed
 * and clamped. A response with no usable files becomes a fail-closed decline (the
 * orchestrator turns ok:false into a halt — never a silent empty write).
 *   client { callTool(name, args) -> Promise<string> }  (../breakout/mcp_client.mjs)
 */
export function makeLiveCallTeam({ client }) {
  return async ({ team, node, priorFailure }) => {
    const model = buildableSeat(team);
    const text = await client.callTool(`${model}_ask`, {
      system: profileFor(model).frame(promptForTeam(team)),
      prompt: nodeBuildPrompt(node, priorFailure),
      include_provenance: true,
      response_schema: SCHEMAS.fileset.schema,
      schema_name: SCHEMAS.fileset.schema_name
    });
    const files = parseTeamFiles(text, node);
    if (files.length === 0) {
      return { ok: false, reason: `team ${team.id} (${model}) returned no usable files for ${node.id}` };
    }
    return { files };
  };
}

// The schema now carries the JSON contract (response_schema), so this is a light
// hint, not the load-bearing format spec it used to be.
const PACKET_INSTRUCTION =
  "Provide your judgment as the structured fields: decision, confidence, required_edits, hard_stops, rationale.";

/**
 * Build a promptFor(model, role, dossier, workstream) for liveSeatCaller
 * (council.mjs) so the approval council emits gate-valid JSON packets. agy stays
 * structured (a real agy_checkpoint); chat seats get a strict decision-packet
 * instruction. `models` optionally overrides the per-seat model id (else the
 * server default applies).
 */
export function approvalPromptFor(dossier, { models = {} } = {}) {
  return (model, role, _dossier, workstream) => {
    if (model === "agy") {
      // Governance checkpoint DERIVED from the dossier (protected paths + LEXI),
      // not asserted — so agy can actually dissent (see council.agyCheckpointArgs).
      return { tool: "agy_checkpoint", args: agyCheckpointArgs(dossier, dossier?.use_case) };
    }
    const lens = workstream ? `, workstream lens: ${workstream}` : "";
    return {
      tool: `${model}_ask`,
      model: models[model],
      // profileFor leans the framing into the model's strength; the schema enforces shape.
      system: profileFor(model).frame(`You are ${model}, a council ${role} for TELOS${lens}. Judge the objective on the merits. ${PACKET_INSTRUCTION}`),
      prompt: `Objective:\n${dossier?.objective ?? ""}\n\n${PACKET_INSTRUCTION}`,
      response_schema: SCHEMAS.approval.schema,
      schema_name: SCHEMAS.approval.schema_name
    };
  };
}

/**
 * Turn a seat's response text into a gate-valid approval packet. agy's checkpoint
 * is adapted via agyApprovalPacket; a chat seat's JSON contributes ONLY its
 * judgment (decision/confidence/edits/stops/rationale) while identity fields
 * (build_id/use_case/proposal_ref/timestamp/docs_reviewed) are injected
 * authoritatively from the dossier so a sloppy model can't fail the gate's
 * identity checks. An unparseable answer degrades to a non-approving
 * 'advisory-note' (fail-closed), never a fabricated approve.
 */
// Parse a PROPOSAL-LIFECYCLE review packet. FAIL-CLOSED (decision 14): a malformed concern / unknown
// enum / unexpected field makes the whole packet invalid rather than being silently sanitized.
// Identity + proposal_ref/review-input bindings are injected by trusted wiring, never model-authored.
export function parseReviewPacket(text, model, dossier, meta = {}) {
  const raw = (() => { try { return JSON.parse(text); } catch { return null; } })() || (extractJson(text) || {});
  const judgment = {
    decision: raw.decision, confidence: raw.confidence,
    required_edits: raw.required_edits, considerations: raw.considerations,
    concerns: raw.concerns, rationale: raw.rationale
  };
  const v = validateAgainstSchema(PROPOSAL_REVIEW_PACKET_SCHEMA, judgment);
  if (!v.ok) {
    return { build_id: dossier?.build_id, use_case: dossier?.use_case, model, role: "approver",
      proposal_ref: meta.proposal_ref ?? dossier?.build_id, hard_stops: [],
      parse_ok: false, parse_error: v.violations.slice(0, 3), timestamp: meta.timestamp ?? new Date(0).toISOString() };
  }
  return {
    build_id: dossier?.build_id, use_case: dossier?.use_case, model, role: "approver",
    docs_reviewed: Array.isArray(meta.docs_reviewed) ? meta.docs_reviewed : [],
    proposal_ref: meta.proposal_ref ?? dossier?.build_id,
    review_input_hash: meta.review_input_hash ?? null,
    review_manifest_ref: meta.review_manifest_ref ?? null,
    review_call_ref: meta.review_call_ref ?? null,
    decision: judgment.decision, confidence: judgment.confidence,
    required_edits: judgment.required_edits, considerations: judgment.considerations,
    concerns: judgment.concerns, rationale: judgment.rationale,
    hard_stops: [],                          // deprecated; always injected empty for shape compat
    parse_ok: true,
    timestamp: meta.timestamp ?? new Date(0).toISOString()
  };
}

const REVIEW_INSTRUCTION =
  "Review the compiled candidate plan. Provide: decision (approve/revise/reject), confidence, required_edits, " +
  "considerations, and concerns. Each concern is typed {scope, claim, severity, judgment_class, evidence_refs, " +
  "required_verification}. To require a post-build verification, set required_verification.requested=true and name " +
  "ONLY a check_contract.kind (from the repo's closed check-registry) + params_json — never a node id; the " +
  "controller mints the discharge node.";

const DAEDALUS_INSTRUCTION =
  "You are negotiating an implementation plan. Return {plan_revision, objections, dispositions, rationale}. " +
  "plan_revision is the full candidate task list as canonical JSON (or \"\" to keep it). Each objection is " +
  "{scope, claim, evidence_refs} — do NOT include an objection_hash; identity is computed by the controller. " +
  "Dispositions resolve/supersede/withdraw an OPEN objection from the menu by its objection_hash.";

/** Live REVIEW prompt (mirrors approvalPromptFor but emits a proposal-lifecycle review packet). The
 *  agy branch derives its checkpoint from the RECOMPUTED plan via agyLifecycleCheckpointArgs. */
export function reviewPromptFor(dossier, { models = {}, plan = null } = {}) {
  return (model, role, _dossier, workstream) => {
    if (model === "agy") {
      const args = plan ? agyLifecycleCheckpointArgs(plan, dossier, dossier?.use_case) : agyCheckpointArgs(dossier, dossier?.use_case);
      return { tool: "agy_checkpoint", args };
    }
    const lens = workstream ? `, workstream lens: ${workstream}` : "";
    return {
      tool: `${model}_ask`,
      model: models[model],
      system: profileFor(model).frame(`You are ${model}, a council ${role} for TELOS${lens}. Judge the candidate plan on the merits. ${REVIEW_INSTRUCTION}`),
      prompt: `Objective:\n${dossier?.objective ?? ""}\n\n${REVIEW_INSTRUCTION}`,
      response_schema: SCHEMAS.review.schema,
      schema_name: SCHEMAS.review.schema_name
    };
  };
}

/** Live DAEDALUS workshop prompt for one seat/round. Emits the {plan_revision,objections,dispositions}
 *  contract; the parser (parseDaedalusResponse) strips any model-supplied objection_hash so objection
 *  identity is unconditionally controller-recomputed (round-7/8). */
export function daedalusPromptFor({ seat, candidateBody, openMenu = [], model }) {
  const menu = openMenu.length
    ? `\n\nOPEN objections you may dispose (by objection_hash, only those you raised):\n${JSON.stringify(openMenu)}`
    : "\n\nNo open objections yet.";
  return {
    tool: `${seat}_ask`,
    model,
    system: profileFor(seat).frame(`You are ${seat}, negotiating a TELOS implementation plan. ${DAEDALUS_INSTRUCTION}`),
    prompt: `Current candidate (canonical JSON task body):\n${candidateBody}${menu}\n\n${DAEDALUS_INSTRUCTION}`,
    response_schema: SCHEMAS.daedalus.schema,
    schema_name: SCHEMAS.daedalus.schema_name
  };
}

/** Parse a Daedalus seat response into the workshop callSeat contract. Fail-closed: an unparseable /
 *  schema-violating response yields an empty no-op round (plan unchanged, no objections). Objections
 *  carry NO objection_hash (the workshop recomputes it); a model-supplied one is dropped here. */
export function parseDaedalusResponse(text, { provenance = null } = {}) {
  const raw = (() => { try { return JSON.parse(text); } catch { return null; } })() || (extractJson(text) || {});
  const v = validateAgainstSchema(DAEDALUS_RESPONSE_SCHEMA, {
    plan_revision: raw.plan_revision, objections: raw.objections, dispositions: raw.dispositions, rationale: raw.rationale
  });
  if (!v.ok) return { plan_revision: "", objections: [], dispositions: [], rationale: "", provenance, parse_ok: false, parse_error: v.violations.slice(0, 3) };
  const objections = (raw.objections || []).map((o) => ({ scope: o.scope, claim: o.claim, evidence_refs: [...(o.evidence_refs || [])] })); // NO objection_hash passed through
  return { plan_revision: raw.plan_revision || "", objections, dispositions: raw.dispositions || [], rationale: raw.rationale || "", provenance, parse_ok: true };
}

export function parseApprovalPacket(text, model, dossier, meta = {}) {
  const direct = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (direct && direct.phase_gate_status) {
    return agyApprovalPacket(direct, { build_id: dossier?.build_id, use_case: dossier?.use_case, proposal_ref: meta.proposal_ref ?? dossier?.build_id, timestamp: meta.timestamp, docs_reviewed: meta.docs_reviewed ?? [] });
  }
  const m = (direct && !direct.phase_gate_status ? direct : extractJson(text)) || {};
  return {
    build_id: dossier?.build_id,
    use_case: dossier?.use_case,
    model,
    role: "approver",
    docs_reviewed: Array.isArray(meta.docs_reviewed) ? meta.docs_reviewed : [],
    proposal_ref: meta.proposal_ref ?? dossier?.build_id,
    decision: VALID_DECISIONS.has(m.decision) ? m.decision : "advisory-note",
    required_edits: Array.isArray(m.required_edits) ? m.required_edits : [],
    hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [],
    confidence: VALID_CONFIDENCE.has(m.confidence) ? m.confidence : "medium",
    timestamp: meta.timestamp ?? new Date(0).toISOString(),
    rationale: typeof m.rationale === "string" ? m.rationale : undefined
  };
}

// The Planning team's decompose prompt: ask for a strict JSON task list whose
// nodes carry the footprints + test the merkle-dag planner needs.
export function decomposePrompt(dossier, telos, conventions = null) {
  const system = [
    "You are the TELOS Planning team. Decompose the objective into a build plan.",
    'Return an object {"tasks":[ ... ]} where each task has id, writes[], reads[], requirements,',
    'test{cmd,args[]}, and workstream (backend-schema|frontend-brand-experience|security-trust|scale-operations|product-architecture).',
    "One writer per file. Declare reads for cross-file dependencies."
  ].join(" ");
  // Project sense: if the real project has a test command, steer node tests toward it.
  const conventionLine = conventions?.testCmd
    ? `\n\nThis is an existing project; its real test command is "${conventions.testCmd}". Prefer node tests that invoke it (e.g. {"cmd":"npm","args":["test"]}) over a no-op.`
    : "";
  const prompt = `Objective:\n${dossier?.objective ?? ""}\n\nTelos statement:\n${telos ?? ""}${conventionLine}\n\nEmit the task plan now.`;
  return { system, prompt, response_schema: SCHEMAS.decompose.schema, schema_name: SCHEMAS.decompose.schema_name };
}

// Parse a decompose response into a raw task array (validation/normalization is
// the job of decompose.mjs, which is fail-closed on anything unusable). With the
// schema the model returns {tasks:[...]}; fall back to a legacy bare array or a
// fenced/prose array so older responses still work.
export function parseDecomposeTasks(text) {
  const direct = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (direct && Array.isArray(direct.tasks)) return direct.tasks;
  if (Array.isArray(direct)) return direct;
  const arr = extractJson(text, "[", "]");
  return Array.isArray(arr) ? arr : [];
}

/**
 * Build the full live callSeat for buildProject over an MCP client: it routes
 * intent==="decompose" to the Planning team's lead and everything else to the
 * approval council. signing/provenance are handled by runCouncil/liveSeatCaller
 * downstream for the approval path.
 *   client      MCP client
 *   liveSeatCaller  the council.mjs factory (injected to avoid a hard import cycle)
 *   dossier, meta   identity/context for approval packets
 *   models      optional per-seat model id overrides
 *   planningModel  model used for live decomposition (default "claude")
 */
export function makeLiveCallSeat({ client, liveSeatCaller, dossier, meta = {}, models = {}, planningModel = "claude" }) {
  const promptFor = approvalPromptFor(dossier, { models });
  const approval = (seatArg) =>
    liveSeatCaller({ client, promptFor, parsePacket: (t) => parseApprovalPacket(t, seatArg.model, dossier, meta) })(seatArg);

  return async (args) => {
    if (args && args.intent === "decompose") {
      const { system, prompt, response_schema, schema_name } = decomposePrompt(dossier, args.telos, args.conventions);
      const text = await client.callTool(`${planningModel}_ask`, { system, prompt, model: models[planningModel], include_provenance: true, response_schema, schema_name });
      const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
      const inner = body && typeof body.text === "string" ? body.text : text;
      // Keep the decompose provenance (creation lineage) instead of discarding it. Honest-null when
      // the server did not attest one.
      const provenance = body && typeof body.provenance === "object" && body.provenance
        ? body.provenance : { model: planningModel, response_id: null, source: "ai-peer-mcp" };
      return { tasks: parseDecomposeTasks(inner), provenance };
    }
    return approval(args);
  };
}
