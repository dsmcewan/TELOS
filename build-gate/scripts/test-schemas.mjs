#!/usr/bin/env node
// test-schemas.mjs — the JSON contracts must be valid in OpenAI/xAI STRICT mode
// (the lowest common denominator all four providers accept), and the model-profiles
// matrix must be well-formed.
import assert from "node:assert/strict";
import { SCHEMAS, APPROVAL_PACKET_SCHEMA } from "../schemas.mjs";
import { MODEL_PROFILES, isPreferredRole } from "../model-profiles.mjs";

const ALLOWED_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object", "null"]);
const FORBIDDEN_KEYWORDS = ["pattern", "format", "default", "minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems"];

// Recursively assert a schema obeys strict-mode rules.
function checkStrict(node, path) {
  assert.equal(typeof node, "object", `${path}: schema node must be an object`);
  for (const k of FORBIDDEN_KEYWORDS) {
    assert.ok(!(k in node), `${path}: forbidden keyword '${k}' in strict mode`);
  }
  if (node.type) {
    assert.ok(ALLOWED_TYPES.has(node.type), `${path}: type '${node.type}' not allowed`);
  }
  if (node.type === "object") {
    assert.equal(node.additionalProperties, false, `${path}: object must set additionalProperties:false`);
    const props = Object.keys(node.properties || {});
    assert.ok(props.length > 0, `${path}: object must declare properties`);
    const required = new Set(node.required || []);
    for (const p of props) {
      assert.ok(required.has(p), `${path}: property '${p}' must be in required (strict mode)`);
      checkStrict(node.properties[p], `${path}.${p}`);
    }
    assert.equal(required.size, props.length, `${path}: required must list exactly the properties`);
  }
  if (node.type === "array") {
    assert.ok(node.items, `${path}: array must declare items`);
    checkStrict(node.items, `${path}[]`);
  }
}

// --- every registered schema is strict-mode-valid and well-named ---
{
  for (const [name, entry] of Object.entries(SCHEMAS)) {
    assert.match(entry.schema_name, /^[A-Za-z0-9_-]+$/, `${name}: schema_name must match the json_schema name constraint`);
    checkStrict(entry.schema, name);
  }
  console.log("OK: all schemas pass strict-mode validation");
}

// --- the approval schema is JUDGMENT ONLY (no identity fields the gate injects) ---
{
  const props = Object.keys(APPROVAL_PACKET_SCHEMA.properties);
  for (const identity of ["build_id", "use_case", "proposal_ref", "timestamp", "docs_reviewed", "model", "role"]) {
    assert.ok(!props.includes(identity), `approval schema must NOT let the model author identity field '${identity}'`);
  }
  assert.deepEqual(props.sort(), ["confidence", "decision", "hard_stops", "rationale", "required_edits"], "approval schema is judgment-only");
  console.log("OK: approval schema omits identity (trust feature)");
}

// --- model profiles are well-formed ---
{
  for (const [model, p] of Object.entries(MODEL_PROFILES)) {
    assert.ok(Array.isArray(p.strengths) && p.strengths.length > 0, `${model}: has strengths`);
    assert.ok(Array.isArray(p.weaknesses) && p.weaknesses.length > 0, `${model}: has weaknesses`);
    assert.ok(Array.isArray(p.preferred_roles) && p.preferred_roles.length > 0, `${model}: has preferred roles`);
  }
  assert.equal(isPreferredRole("grok", "breakout"), true, "grok prefers the adversarial breakout role");
  assert.equal(isPreferredRole("gemini", "integrity"), true, "gemini prefers independent verification");
  assert.equal(isPreferredRole("claude", "backend"), false, "claude does not claim backend lead");
  console.log("OK: model profiles well-formed");
}

console.log("test-schemas.mjs OK");
