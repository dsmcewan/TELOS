// schemas.mjs — TELOS's JSON contracts as strict-mode JSON Schemas.
//
// Today the council/teams ask models for JSON in prose and scrape it back with a
// regex. These schemas let each provider emit schema-valid JSON NATIVELY (OpenAI/
// xAI json_schema strict mode, Anthropic forced tool input_schema, Gemini
// responseSchema). build-gate owns the contract semantics, so the schemas live
// here and are PASSED AS DATA into the ai-peer-mcp `*_ask` call — the connector
// never imports build-gate.
//
// Authored to the lowest common denominator (OpenAI/xAI strict mode), which the
// other providers also accept: every object lists ALL its properties in `required`
// and sets `additionalProperties:false`; types are limited to the JSON primitives;
// no `pattern`/`format`/`default`/`minimum`/`maximum`. (enum IS allowed.)

// The approval packet the model AUTHORS — judgment only. Identity fields
// (build_id/use_case/proposal_ref/timestamp/docs_reviewed) are deliberately NOT
// here: parseApprovalPacket injects them from the dossier so a model can never
// self-assert its own identity. Omitting them is a trust feature.
export const APPROVAL_PACKET_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["approve", "revise", "reject"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    required_edits: { type: "array", items: { type: "string" } },
    hard_stops: { type: "array", items: { type: "string" } },
    rationale: { type: "string" }
  },
  required: ["decision", "confidence", "required_edits", "hard_stops", "rationale"],
  additionalProperties: false
};

// The Planning team's decomposition. Wrapped in an object ({tasks:[...]}) because
// strict mode wants an object root. `workstream` is a plain string (not an enum) —
// teamForNode validates routing, and an enum would be brittle as workstreams change.
export const DECOMPOSE_TASKS_SCHEMA = {
  type: "object",
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          writes: { type: "array", items: { type: "string" } },
          reads: { type: "array", items: { type: "string" } },
          requirements: { type: "string" },
          test: {
            type: "object",
            properties: {
              cmd: { type: "string" },
              args: { type: "array", items: { type: "string" } }
            },
            required: ["cmd", "args"],
            additionalProperties: false
          },
          workstream: { type: "string" }
        },
        required: ["id", "writes", "reads", "requirements", "test", "workstream"],
        additionalProperties: false
      }
    }
  },
  required: ["tasks"],
  additionalProperties: false
};

// A build team's output. `content` is an unconstrained string — strict mode allows
// free-form string payloads; only the envelope shape is constrained.
export const BUILD_FILESET_SCHEMA = {
  type: "object",
  properties: {
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: ["path", "content"],
        additionalProperties: false
      }
    }
  },
  required: ["files"],
  additionalProperties: false
};

// The Daedalus workshop response a planning seat AUTHORS. `dispositions[].objection_hash`
// ECHOES a controller-supplied open-objection menu entry (never a self-asserted hash).
export const DAEDALUS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    plan_revision: { type: "string" },
    objections: {
      type: "array",
      items: {
        type: "object",
        properties: { scope: { type: "string" }, claim: { type: "string" }, evidence_refs: { type: "array", items: { type: "string" } } },
        required: ["scope", "claim", "evidence_refs"], additionalProperties: false
      }
    },
    dispositions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          objection_hash: { type: "string" },
          action: { type: "string", enum: ["resolved", "superseded", "withdrawn"] },
          note: { type: "string" },
          replacement_scope: { type: "string" }, replacement_claim: { type: "string" },
          replacement_evidence_refs: { type: "array", items: { type: "string" } }
        },
        required: ["objection_hash", "action", "note", "replacement_scope", "replacement_claim", "replacement_evidence_refs"],
        additionalProperties: false
      }
    },
    rationale: { type: "string" }
  },
  required: ["plan_revision", "objections", "dispositions", "rationale"],
  additionalProperties: false
};

// The proposal-lifecycle review packet a seat AUTHORS. `hard_stops` is deliberately ABSENT
// (deprecated). Each concern carries a NESTED `required_verification` — the typed concern->
// obligation route — so an obligation is never inferred from prose or an array index.
export const PROPOSAL_REVIEW_PACKET_SCHEMA = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["approve", "revise", "reject"] },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    required_edits: { type: "array", items: { type: "string" } },
    considerations: { type: "array", items: { type: "string" } },
    concerns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scope: { type: "string" }, claim: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          judgment_class: { type: "string", enum: ["consideration", "hold-request", "evidence-claim"] },
          evidence_refs: { type: "array", items: { type: "string" } },
          required_verification: {
            type: "object",
            properties: {
              requested: { type: "boolean" },
              discharge_node_id: { type: "string" },
              check_contract: {
                type: "object",
                // params_json is a JSON STRING (strict mode forbids open objects); the controller
                // parses + validates it, keeping model-authored params out of the schema surface.
                properties: { kind: { type: "string" }, params_json: { type: "string" } },
                required: ["kind", "params_json"], additionalProperties: false
              },
              required_result: { type: "string" }
            },
            required: ["requested", "discharge_node_id", "check_contract", "required_result"], additionalProperties: false
          }
        },
        required: ["scope", "claim", "severity", "judgment_class", "evidence_refs", "required_verification"],
        additionalProperties: false
      }
    },
    rationale: { type: "string" }
  },
  required: ["decision", "confidence", "required_edits", "considerations", "concerns", "rationale"],
  additionalProperties: false
};

// The evidence claim a seat AUTHORS (envelope injected by trusted wiring). `params` is
// per-kind-validated by evidence.mjs against a closed whitelist.
export const EVIDENCE_CLAIM_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string" },
    concern_ref: { type: "string" },
    // params_json is a JSON STRING; the controller parses it and the evidence verifier applies its
    // per-kind param whitelist to the parsed object (a model never emits an open object here).
    params_json: { type: "string" }
  },
  required: ["kind", "concern_ref", "params_json"],
  additionalProperties: false
};

// Select a schema by stable name. `schema_name` matches ^[A-Za-z0-9_-]+$ (the
// OpenAI/xAI json_schema name constraint). Pass {schema_name, schema} to the
// MCP `*_ask` call as response_schema + schema_name.
export const SCHEMAS = {
  approval: { schema_name: "approval", schema: APPROVAL_PACKET_SCHEMA },
  decompose: { schema_name: "decompose", schema: DECOMPOSE_TASKS_SCHEMA },
  fileset: { schema_name: "fileset", schema: BUILD_FILESET_SCHEMA },
  daedalus: { schema_name: "daedalus", schema: DAEDALUS_RESPONSE_SCHEMA },
  review: { schema_name: "review", schema: PROPOSAL_REVIEW_PACKET_SCHEMA },
  evidence_claim: { schema_name: "evidence_claim", schema: EVIDENCE_CLAIM_SCHEMA }
};

// Minimal validator for the strict-mode subset these schemas use (type / properties /
// required / additionalProperties:false / items / enum). Returns { ok, violations:[{path,detail}] }.
// Used by the `schema-violation` evidence kind against the closed SCHEMAS registry only.
export function validateAgainstSchema(schema, value, at = "$") {
  const violations = [];
  const walk = (sch, val, p) => {
    if (!sch || typeof sch !== "object") return;
    const t = sch.type;
    if (t === "object") {
      if (val === null || typeof val !== "object" || Array.isArray(val)) { violations.push({ path: p, detail: "expected object" }); return; }
      const props = sch.properties || {};
      for (const req of sch.required || []) if (!(req in val)) violations.push({ path: `${p}.${req}`, detail: "missing required property" });
      if (sch.additionalProperties === false) for (const k of Object.keys(val)) if (!(k in props)) violations.push({ path: `${p}.${k}`, detail: "additional property not allowed" });
      for (const [k, subsch] of Object.entries(props)) if (k in val) walk(subsch, val[k], `${p}.${k}`);
    } else if (t === "array") {
      if (!Array.isArray(val)) { violations.push({ path: p, detail: "expected array" }); return; }
      if (sch.items) val.forEach((item, i) => walk(sch.items, item, `${p}[${i}]`));
    } else if (t === "string") {
      if (typeof val !== "string") violations.push({ path: p, detail: "expected string" });
      else if (Array.isArray(sch.enum) && !sch.enum.includes(val)) violations.push({ path: p, detail: `not in enum` });
    } else if (t === "boolean") {
      if (typeof val !== "boolean") violations.push({ path: p, detail: "expected boolean" });
    } else if (t === "number" || t === "integer") {
      if (typeof val !== "number") violations.push({ path: p, detail: "expected number" });
    }
  };
  walk(schema, value, at);
  return { ok: violations.length === 0, violations };
}
