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

// Select a schema by stable name. `schema_name` matches ^[A-Za-z0-9_-]+$ (the
// OpenAI/xAI json_schema name constraint). Pass {schema_name, schema} to the
// MCP `*_ask` call as response_schema + schema_name.
export const SCHEMAS = {
  approval: { schema_name: "approval", schema: APPROVAL_PACKET_SCHEMA },
  decompose: { schema_name: "decompose", schema: DECOMPOSE_TASKS_SCHEMA },
  fileset: { schema_name: "fileset", schema: BUILD_FILESET_SCHEMA }
};
