import { createHash } from "node:crypto";

import { canonicalize, sha256hex } from "../../../merkle-dag/vendor.mjs";

const REGISTRY_KEYS = Object.freeze([
  "review_registry_version",
  "contract",
  "obligations"
]);
const OBLIGATION_KEYS = Object.freeze([
  "obligation_id",
  "invariant",
  "negative_test",
  "exit_criterion",
  "source_bindings",
  "mechanical_checks"
]);
const SOURCE_BINDING_KEYS = Object.freeze(["input", "literal"]);
const MECHANICAL_CHECK_KEYS = Object.freeze([
  "check_id",
  "kind",
  "input",
  "scope",
  "values",
  "expected_count"
]);
const SCOPE_KEYS = Object.freeze(["start_literal", "end_literal"]);
const CHECK_KINDS = new Set(["contains-all", "excludes-all", "exact-count"]);
const OBLIGATION_ID_RE = /^PPC-W[0-9]{2,}$/;
const INTEGRATION_KEYS = Object.freeze([
  "decision",
  "maturation_summary",
  "replacements",
  "mappings"
]);
const REPLACEMENT_KEYS = Object.freeze([
  "old",
  "new",
  "reason",
  "obligation_ids"
]);
const MAPPING_KEYS = Object.freeze([
  "obligation_id",
  "mechanism_quote",
  "task_quote"
]);
const CAPSULE_ROLES = new Set([
  "constraints",
  "implementation",
  "integration",
  "verify-constraints",
  "verify-implementation"
]);

function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function nonempty(value) {
  return typeof value === "string" && value === value.trim() && value.length > 0;
}

function codeUnitCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function countOccurrences(text, literal) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(literal, offset);
    if (index === -1) return count;
    count += 1;
    offset = index + literal.length;
  }
}

function rawSha256Ref(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function evidenceRef(inputName, text, start, end) {
  const startByte = Buffer.byteLength(text.slice(0, start));
  const passageBytes = Buffer.from(text.slice(start, end));
  return {
    input: inputName,
    start: startByte,
    end: startByte + passageBytes.length,
    bytes_sha256: rawSha256Ref(passageBytes)
  };
}

function occurrenceOffsets(text, literal) {
  const offsets = [];
  let offset = 0;
  while (true) {
    const index = text.indexOf(literal, offset);
    if (index === -1) return offsets;
    offsets.push(index);
    offset = index + literal.length;
  }
}

function validateScope(scope, label) {
  if (scope === null) return;
  if (!exactKeys(scope, SCOPE_KEYS)
    || !nonempty(scope.start_literal)
    || !nonempty(scope.end_literal)
    || scope.start_literal === scope.end_literal) {
    throw new Error(`${label}: scope must be null or a closed pair of distinct literals`);
  }
}

function validateCheck(check, label, inputs) {
  if (!exactKeys(check, MECHANICAL_CHECK_KEYS)) {
    throw new Error(`${label}: mechanical check must have a closed shape`);
  }
  if (!nonempty(check.check_id)) {
    throw new Error(`${label}: mechanical check ID must be nonempty`);
  }
  if (!CHECK_KINDS.has(check.kind)) {
    throw new Error(`${label}: unknown mechanical check kind`);
  }
  if (!nonempty(check.input) || !Object.hasOwn(inputs, check.input)) {
    throw new Error(`${label}: mechanical check input is unknown`);
  }
  validateScope(check.scope, label);
  if (!Array.isArray(check.values)
    || check.values.length === 0
    || check.values.some((value) => !nonempty(value))
    || new Set(check.values).size !== check.values.length
    || JSON.stringify(check.values) !== JSON.stringify([...check.values].sort(codeUnitCompare))) {
    throw new Error(`${label}: mechanical check values must be unique, sorted, nonempty strings`);
  }
  if (check.kind === "exact-count") {
    if (!Number.isSafeInteger(check.expected_count) || check.expected_count < 0) {
      throw new Error(`${label}: exact-count requires a nonnegative safe expected_count`);
    }
  } else if (check.expected_count !== null) {
    throw new Error(`${label}: only exact-count accepts expected_count`);
  }
}

function validateRegistry(registry, inputs) {
  if (!exactKeys(registry, REGISTRY_KEYS)) {
    throw new Error("review registry must have a closed shape");
  }
  if (registry.review_registry_version !== 1
    || registry.contract !== "production-profile-compiler-review/1") {
    throw new Error("review registry version or contract is unsupported");
  }
  if (!Array.isArray(registry.obligations) || registry.obligations.length === 0) {
    throw new Error("review registry obligations must be a nonempty array");
  }

  const obligationIds = [];
  for (const [index, obligation] of registry.obligations.entries()) {
    const label = `review obligation ${index}`;
    if (!exactKeys(obligation, OBLIGATION_KEYS)) {
      throw new Error(`${label}: obligation must have a closed shape`);
    }
    if (!nonempty(obligation.obligation_id) || !OBLIGATION_ID_RE.test(obligation.obligation_id)) {
      throw new Error(`${label}: obligation ID must match PPC-WNN`);
    }
    obligationIds.push(obligation.obligation_id);
    for (const field of ["invariant", "negative_test", "exit_criterion"]) {
      if (!nonempty(obligation[field])) throw new Error(`${label}: ${field} must be nonempty`);
    }
    if (!Array.isArray(obligation.source_bindings) || obligation.source_bindings.length === 0) {
      throw new Error(`${label}: source_bindings must be nonempty`);
    }
    for (const [bindingIndex, binding] of obligation.source_bindings.entries()) {
      if (!exactKeys(binding, SOURCE_BINDING_KEYS)
        || !nonempty(binding.input)
        || !Object.hasOwn(inputs, binding.input)
        || !nonempty(binding.literal)) {
        throw new Error(`${label}: source binding ${bindingIndex} is invalid`);
      }
    }
    if (!Array.isArray(obligation.mechanical_checks)) {
      throw new Error(`${label}: mechanical_checks must be an array`);
    }
    const checkIds = obligation.mechanical_checks.map((check) => check?.check_id);
    if (new Set(checkIds).size !== checkIds.length) {
      throw new Error(`${label}: mechanical check IDs must be unique`);
    }
    if (JSON.stringify(checkIds) !== JSON.stringify([...checkIds].sort(codeUnitCompare))) {
      throw new Error(`${label}: mechanical check IDs must be sorted`);
    }
    obligation.mechanical_checks.forEach((check, checkIndex) => {
      validateCheck(check, `${label} check ${checkIndex}`, inputs);
    });
  }
  if (new Set(obligationIds).size !== obligationIds.length) {
    throw new Error("review registry obligation IDs must be unique");
  }
  if (JSON.stringify(obligationIds) !== JSON.stringify([...obligationIds].sort(codeUnitCompare))) {
    throw new Error("review registry obligation IDs must be sorted");
  }
}

function bindLiteral(input, literal, { label, inputName }) {
  if (countOccurrences(input.text, literal) !== 1) {
    throw new Error(`${label}: source binding literal must occur exactly once`);
  }
  const start = input.text.indexOf(literal);
  const startByte = Buffer.byteLength(input.text.slice(0, start));
  const passageBytes = Buffer.from(literal);
  return {
    input: inputName,
    start: startByte,
    end: startByte + passageBytes.length,
    bytes_sha256: rawSha256Ref(passageBytes),
    text: literal
  };
}

export function loadReviewRegistry({ registryText, inputs }) {
  if (typeof registryText !== "string" || registryText.length === 0) {
    throw new Error("review registry text must be nonempty");
  }
  if (inputs === null || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new Error("review registry inputs must be an object");
  }
  let registry;
  try {
    registry = JSON.parse(registryText);
  } catch (error) {
    throw new Error(`review registry is not JSON: ${error.message}`);
  }
  validateRegistry(registry, inputs);
  const bindings = {};
  for (const obligation of registry.obligations) {
    bindings[obligation.obligation_id] = obligation.source_bindings.map((binding, index) => {
      const input = inputs[binding.input];
      return bindLiteral(input, binding.literal, {
        label: `${obligation.obligation_id} source binding ${index}`,
        inputName: binding.input
      });
    });
  }
  return {
    registry,
    registry_ref: `sha256:${sha256hex(Buffer.from(canonicalize(registry)))}`,
    bindings
  };
}

function verifyLoadedBindings(loadedRegistry, inputs) {
  for (const obligation of loadedRegistry.registry.obligations) {
    const expected = loadedRegistry.bindings?.[obligation.obligation_id];
    if (!Array.isArray(expected) || expected.length !== obligation.source_bindings.length) {
      throw new Error(`${obligation.obligation_id}: loaded source bindings are incomplete`);
    }
    obligation.source_bindings.forEach((binding, index) => {
      const actual = bindLiteral(inputs[binding.input], binding.literal, {
        label: `${obligation.obligation_id} source binding ${index}`,
        inputName: binding.input
      });
      if (canonicalize(actual) !== canonicalize(expected[index])) {
        throw new Error(`${obligation.obligation_id}: loaded source binding is stale`);
      }
    });
  }
}

function scopedText(check, inputs) {
  const input = inputs[check.input];
  if (!input || typeof input.text !== "string") {
    throw new Error(`${check.check_id}: mechanical check input is unavailable`);
  }
  if (check.scope === null) {
    return {
      inputName: check.input,
      fullText: input.text,
      text: input.text,
      start: 0,
      end: input.text.length
    };
  }
  const starts = occurrenceOffsets(input.text, check.scope.start_literal);
  const ends = occurrenceOffsets(input.text, check.scope.end_literal);
  if (starts.length !== 1 || ends.length !== 1) {
    throw new Error(`${check.check_id}: mechanical check scope literals must each occur exactly once`);
  }
  const start = starts[0];
  const end = ends[0] + check.scope.end_literal.length;
  if (end <= start) throw new Error(`${check.check_id}: mechanical check scope is reversed`);
  return {
    inputName: check.input,
    fullText: input.text,
    text: input.text.slice(start, end),
    start,
    end
  };
}

function evaluateMechanicalCheck(obligationId, check, inputs) {
  const scope = scopedText(check, inputs);
  const matches = check.values.map((value) => ({
    value,
    offsets: occurrenceOffsets(scope.text, value)
  }));
  let passed;
  if (check.kind === "contains-all") {
    passed = matches.every((match) => match.offsets.length > 0);
  } else if (check.kind === "excludes-all") {
    passed = matches.every((match) => match.offsets.length === 0);
  } else {
    passed = matches.every((match) => match.offsets.length === check.expected_count);
  }
  const matchRefs = matches.flatMap((match) => match.offsets.map((offset) => evidenceRef(
    scope.inputName,
    scope.fullText,
    scope.start + offset,
    scope.start + offset + match.value.length
  )));
  const evidence_refs = matchRefs.length > 0
    ? matchRefs
    : [evidenceRef(scope.inputName, scope.fullText, scope.start, scope.end)];
  const counts = matches.map((match) => `${JSON.stringify(match.value)}=${match.offsets.length}`).join(", ");
  return {
    obligation_id: obligationId,
    check_id: check.check_id,
    status: passed ? "pass" : "fail",
    evidence_refs,
    detail: `${check.kind}: ${counts}`
  };
}

export function runReviewPreflight({ loadedRegistry, inputs }) {
  if (!loadedRegistry
    || !loadedRegistry.registry
    || !nonempty(loadedRegistry.registry_ref)
    || !loadedRegistry.bindings) {
    throw new Error("loaded review registry is incomplete");
  }
  verifyLoadedBindings(loadedRegistry, inputs);
  const checks = loadedRegistry.registry.obligations.flatMap((obligation) => (
    obligation.mechanical_checks.map((check) => (
      evaluateMechanicalCheck(obligation.obligation_id, check, inputs)
    ))
  ));
  const input_refs = Object.fromEntries(Object.keys(inputs).sort(codeUnitCompare).map((inputName) => [
    inputName,
    {
      path: inputs[inputName].path,
      raw_sha256: rawSha256Ref(Buffer.from(inputs[inputName].text))
    }
  ]));
  return {
    review_preflight_version: 1,
    registry_ref: loadedRegistry.registry_ref,
    input_refs,
    checks,
    status: checks.some((check) => check.status === "fail") ? "blocked" : "pass"
  };
}

function validateObligationIds(ids, registryIds, label, { allowMany = true } = {}) {
  if (!Array.isArray(ids)
    || ids.length === 0
    || (!allowMany && ids.length !== 1)
    || ids.some((id) => !nonempty(id) || !registryIds.has(id))
    || new Set(ids).size !== ids.length
    || JSON.stringify(ids) !== JSON.stringify([...ids].sort(codeUnitCompare))) {
    throw new Error(`${label}: obligation IDs must be known, unique, sorted, and nonempty`);
  }
}

function validateSparseIntegrationResponse(response, registryIds) {
  if (!exactKeys(response, INTEGRATION_KEYS)) {
    throw new Error("sparse integration response must have a closed shape");
  }
  if (!["preserve", "revise", "needs-eye"].includes(response.decision)) {
    throw new Error("sparse integration decision is invalid");
  }
  if (!nonempty(response.maturation_summary)
    || !Array.isArray(response.replacements)
    || !Array.isArray(response.mappings)) {
    throw new Error("sparse integration summary, replacements, or mappings are invalid");
  }
  if (response.decision === "preserve" && response.replacements.length !== 0) {
    throw new Error("sparse integration preserve requires zero replacements");
  }
  if (response.decision === "revise" && response.replacements.length === 0) {
    throw new Error("sparse integration revise requires replacements");
  }
  if (response.decision === "needs-eye") {
    throw new Error("sparse integration requires The Eye");
  }
  response.replacements.forEach((replacement, index) => {
    if (!exactKeys(replacement, REPLACEMENT_KEYS)
      || typeof replacement.old !== "string"
      || replacement.old.length === 0
      || typeof replacement.new !== "string"
      || replacement.old === replacement.new
      || !nonempty(replacement.reason)) {
      throw new Error(`sparse integration replacement ${index} is invalid`);
    }
    validateObligationIds(
      replacement.obligation_ids,
      registryIds,
      `sparse integration replacement ${index}`
    );
  });
  response.mappings.forEach((mapping, index) => {
    if (!exactKeys(mapping, MAPPING_KEYS)
      || !nonempty(mapping.obligation_id)
      || !registryIds.has(mapping.obligation_id)
      || !nonempty(mapping.mechanism_quote)
      || !nonempty(mapping.task_quote)) {
      throw new Error(`sparse integration mapping ${index} is invalid`);
    }
  });
  const mappingIds = response.mappings.map((mapping) => mapping.obligation_id);
  if (mappingIds.length !== registryIds.size
    || new Set(mappingIds).size !== mappingIds.length
    || mappingIds.some((id) => !registryIds.has(id))
    || [...registryIds].some((id) => !mappingIds.includes(id))) {
    throw new Error("sparse integration mapping coverage must exactly match the registry");
  }
  if (JSON.stringify(mappingIds) !== JSON.stringify([...mappingIds].sort(codeUnitCompare))) {
    throw new Error("sparse integration mappings must be sorted by obligation ID");
  }
}

function applyExactReplacements(candidate, replacements) {
  const indexed = replacements.map((replacement, index) => {
    if (countOccurrences(candidate, replacement.old) !== 1) {
      throw new Error(`sparse integration replacement ${index} old text must occur exactly once`);
    }
    const start = candidate.indexOf(replacement.old);
    return {
      ...replacement,
      start,
      end: start + replacement.old.length
    };
  }).sort((left, right) => left.start - right.start);
  for (let index = 1; index < indexed.length; index += 1) {
    if (indexed[index].start < indexed[index - 1].end) {
      throw new Error(`sparse integration replacement ${index} overlaps an earlier replacement`);
    }
  }
  let plan = candidate;
  for (const replacement of [...indexed].sort((left, right) => right.start - left.start)) {
    plan = `${plan.slice(0, replacement.start)}${replacement.new}${plan.slice(replacement.end)}`;
  }
  return {
    plan,
    replacements: indexed.map(({ start, end, ...replacement }) => replacement)
  };
}

function resolveCandidateQuote(plan, quote, label) {
  if (countOccurrences(plan, quote) !== 1) {
    throw new Error(`${label} quote must occur exactly once in the integrated candidate`);
  }
  const start = plan.indexOf(quote);
  return {
    text: quote,
    ...evidenceRef("candidate", plan, start, start + quote.length)
  };
}

export function applySparseIntegration({ candidate, registry, response }) {
  if (typeof candidate !== "string") throw new Error("sparse integration candidate must be a string");
  if (!registry || !Array.isArray(registry.obligations) || registry.obligations.length === 0) {
    throw new Error("sparse integration registry is invalid");
  }
  const registryIds = new Set(registry.obligations.map((obligation) => obligation.obligation_id));
  validateSparseIntegrationResponse(response, registryIds);
  const applied = applyExactReplacements(candidate, response.replacements);
  const obligationById = new Map(
    registry.obligations.map((obligation) => [obligation.obligation_id, obligation])
  );
  const mapping_evidence = response.mappings.map((mapping) => ({
    obligation_id: mapping.obligation_id,
    mechanism: resolveCandidateQuote(
      applied.plan,
      mapping.mechanism_quote,
      `${mapping.obligation_id} mechanism`
    ),
    task: resolveCandidateQuote(
      applied.plan,
      mapping.task_quote,
      `${mapping.obligation_id} task`
    )
  }));
  const evidenceById = new Map(
    mapping_evidence.map((evidence) => [evidence.obligation_id, evidence])
  );
  const obligation_matrix = [...registryIds].sort(codeUnitCompare).map((obligationId) => {
    const obligation = obligationById.get(obligationId);
    const evidence = evidenceById.get(obligationId);
    return {
      obligation_id: obligationId,
      invariant: obligation.invariant,
      mechanism: evidence.mechanism.text,
      task: evidence.task.text,
      negative_test: obligation.negative_test,
      exit_criterion: obligation.exit_criterion
    };
  });
  return {
    plan: applied.plan,
    changed: applied.plan !== candidate,
    replacements: applied.replacements,
    obligation_matrix,
    maturation_summary: response.maturation_summary,
    mapping_evidence
  };
}

function hashCanonicalRef(value) {
  return `sha256:${sha256hex(Buffer.from(canonicalize(value)))}`;
}

function passageKey(passage) {
  return [
    passage.input,
    String(passage.start).padStart(20, "0"),
    String(passage.end).padStart(20, "0"),
    passage.bytes_sha256
  ].join(":");
}

export function createReviewCapsule({
  role,
  loadedRegistry,
  preflight,
  inputs,
  dependencyRefs = []
}) {
  if (!CAPSULE_ROLES.has(role)) throw new Error("review capsule role is invalid");
  if (preflight?.registry_ref !== loadedRegistry?.registry_ref) {
    throw new Error("review capsule preflight does not bind the registry");
  }
  verifyLoadedBindings(loadedRegistry, inputs);
  if (!Array.isArray(dependencyRefs)
    || dependencyRefs.some((ref) => !nonempty(ref))
    || new Set(dependencyRefs).size !== dependencyRefs.length
    || JSON.stringify(dependencyRefs) !== JSON.stringify([...dependencyRefs].sort(codeUnitCompare))) {
    throw new Error("review capsule dependency refs must be unique sorted strings");
  }
  const passageMap = new Map();
  for (const obligation of loadedRegistry.registry.obligations) {
    for (const binding of loadedRegistry.bindings[obligation.obligation_id]) {
      const passage = { ...binding };
      passageMap.set(passageKey(passage), passage);
    }
  }
  const passages = [...passageMap.values()].sort((left, right) => (
    codeUnitCompare(passageKey(left), passageKey(right))
  ));
  const capsule = {
    review_capsule_version: 1,
    role,
    registry_ref: loadedRegistry.registry_ref,
    input_refs: preflight.input_refs,
    preflight_ref: hashCanonicalRef(preflight),
    obligations: loadedRegistry.registry.obligations.map((obligation) => ({
      obligation_id: obligation.obligation_id,
      invariant: obligation.invariant,
      negative_test: obligation.negative_test,
      exit_criterion: obligation.exit_criterion,
      evidence_refs: loadedRegistry.bindings[obligation.obligation_id].map((binding) => ({
        input: binding.input,
        start: binding.start,
        end: binding.end,
        bytes_sha256: binding.bytes_sha256
      }))
    })),
    passages,
    dependency_refs: dependencyRefs
  };
  return {
    capsule,
    capsule_ref: hashCanonicalRef(capsule)
  };
}

export function verifyReviewCapsule({
  capsule,
  loadedRegistry,
  preflight,
  inputs
}) {
  if (!capsule || !Array.isArray(capsule.passages)) {
    throw new Error("review capsule is incomplete");
  }
  for (const [index, passage] of capsule.passages.entries()) {
    const input = inputs[passage.input];
    if (!input || typeof input.text !== "string") {
      throw new Error(`capsule passage ${index} input is unavailable`);
    }
    const bytes = Buffer.from(input.text);
    if (!Number.isSafeInteger(passage.start)
      || !Number.isSafeInteger(passage.end)
      || passage.start < 0
      || passage.end <= passage.start
      || passage.end > bytes.length) {
      throw new Error(`capsule passage ${index} range is invalid`);
    }
    const actualBytes = bytes.subarray(passage.start, passage.end);
    if (rawSha256Ref(actualBytes) !== passage.bytes_sha256
      || actualBytes.toString("utf8") !== passage.text) {
      throw new Error(`capsule passage ${index} is stale`);
    }
  }
  const expected = createReviewCapsule({
    role: capsule.role,
    loadedRegistry,
    preflight,
    inputs,
    dependencyRefs: capsule.dependency_refs
  });
  if (canonicalize(expected.capsule) !== canonicalize(capsule)) {
    throw new Error("review capsule does not match deterministic materialization");
  }
  return {
    ok: true,
    capsule_ref: expected.capsule_ref
  };
}
