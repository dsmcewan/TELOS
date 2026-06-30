#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { forge } from "../forge.mjs";
import { validatePattern } from "../pattern.mjs";
import { servingBuildWorkstreams } from "../patterns/serving.mjs";
import {
  auditWorkstream,
  designWorkstream,
  guardrailWorkstream,
  moduleWorkstream,
  scorecardWorkstream,
} from "../workstreams/catalog.mjs";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-"));

function writeRendered(root, workstream, ctx = {}) {
  const rendered = workstream.render(ctx);
  for (const [rel, body] of Object.entries(rendered)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
}

function runNodeTest(root, workstream) {
  assert.ok(workstream.nodeTest, `${workstream.id} exposes nodeTest`);
  execFileSync(workstream.nodeTest.cmd, workstream.nodeTest.args, {
    cwd: root,
    stdio: "pipe",
  });
}

function renderAndRun(workstream, ctx = {}) {
  const root = path.join(tmpRoot, workstream.id);
  writeRendered(root, workstream, ctx);
  for (const file of workstream.files) {
    assert.ok(existsSync(path.join(root, file)), `${file} rendered`);
  }
  runNodeTest(root, workstream);
  return root;
}

async function importRendered(root, file) {
  return import(pathToFileURL(path.join(root, file)).href);
}

async function importWithPosixPathSemantics(sourceFile) {
  const source = readFileSync(sourceFile, "utf8");
  const designUrl = pathToFileURL(path.join(path.dirname(sourceFile), "design.mjs")).href;
  const rewritten = source
    .replace('import path from "node:path";', 'import path from "node:path/posix";')
    .replace('import { makeDesignWorkstream } from "./design.mjs";', `import { makeDesignWorkstream } from ${JSON.stringify(designUrl)};`);
  if (rewritten === source) {
    throw new Error(`failed to rewrite path import in ${sourceFile}`);
  }

  const root = mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-posix-"));
  const target = path.join(root, path.basename(sourceFile));
  writeFileSync(target, rewritten, "utf8");
  return import(pathToFileURL(target).href);
}

function toyContext() {
  return {
    dossier: {
      id: "catalog-toy",
      objective: "Exercise catalog factories",
      architecture: "Small generated modules with local selftests",
      acceptance: ["module, guardrail, scorecard, audit, and design slices converge"],
      non_goals: [],
      constraints: [],
      interfaces: [],
      risks: [],
      success_metrics: [],
    },
  };
}

function toyDossierMeta() {
  return {
    build_id: "catalog-toy",
    idea_id: "catalog-toy",
    use_case: "ai-architecture",
    objective: "Forge reusable catalog workstreams",
  };
}

function toyPattern({ broken = false } = {}) {
  const moduleSource = broken
    ? "export function answer(){ return 40; }\nif (process.argv.includes('--selftest')) { if (answer() !== 42) throw new Error('bad answer'); }\n"
    : "export function answer(){ return 42; }\nif (process.argv.includes('--selftest')) { if (answer() !== 42) throw new Error('bad answer'); }\n";

  const buildWorkstreams = [
    moduleWorkstream({
      id: "core",
      signer: "codex",
      file: "toy/core.mjs",
      requirements: "export a deterministic answer",
      source: moduleSource,
      needle: "answer",
      finding: "Core module did not satisfy its local invariant.",
    }),
    guardrailWorkstream({
      id: "guard",
      signer: "claude",
      dependencies: ["core"],
      file: "toy/guard.mjs",
      mode: "input",
      blockedTerms: ["secret"],
      finding: "Input guardrail did not reject blocked terms.",
    }),
    scorecardWorkstream({
      id: "scorecard",
      signer: "agy",
      dependencies: ["guard"],
      file: "toy/scorecard.mjs",
      thresholds: { accuracy: 0.9 },
      finding: "Scorecard threshold enforcement failed.",
    }),
    auditWorkstream({
      id: "audit",
      signer: "codex",
      dependencies: ["scorecard"],
      file: "toy/audit.mjs",
      finding: "Audit writer did not persist append-only events.",
    }),
  ];

  return {
    id: broken ? "catalog-toy-broken" : "catalog-toy",
    name: "Catalog Toy Pattern",
    description: "Exercises reusable catalog workstreams.",
    workstreams: [...buildWorkstreams, designWorkstream(buildWorkstreams)],
  };
}

async function main() {
  assert.throws(
    () =>
      moduleWorkstream({
        signer: "codex",
        file: "x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /id/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad",
        signer: "codex",
        file: path.resolve("x.mjs"),
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      auditWorkstream({
        id: "bad-audit",
        signer: "codex",
        file: "../audit.mjs",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-posix-absolute",
        signer: "codex",
        file: "/tmp/x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-windows-absolute",
        signer: "codex",
        file: "C:/tmp/x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-windows-absolute-backslash",
        signer: "codex",
        file: "C:\\tmp\\x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-windows-drive-relative-parent",
        signer: "codex",
        file: "C:../x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-windows-drive-relative-file",
        signer: "codex",
        file: "C:foo.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-drive-qualified-segment",
        signer: "codex",
        file: "a:b/c.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-unc-backslash",
        signer: "codex",
        file: "\\\\server\\share\\x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad-unc-slash",
        signer: "codex",
        file: "//server/share/x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      scorecardWorkstream({
        id: "bad-zero-thresholds",
        signer: "agy",
        file: "scorecard/zero-thresholds.mjs",
        thresholds: { quality: 0, groundedness: 0 },
        finding: "bad",
      }),
    /greater than 0/
  );

  const catalogPosixModule = await importWithPosixPathSemantics(
    path.resolve("workstreams/catalog.mjs")
  );
  assert.throws(
    () =>
      catalogPosixModule.moduleWorkstream({
        id: "bad-posix-host-backslash-rooted",
        signer: "codex",
        file: "\\tmp\\x.mjs",
        requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );

  const generated = [
    moduleWorkstream({
      id: "module",
      signer: "codex",
      file: "generated/module.mjs",
      requirements: "selftest passes",
      source:
        "export function value(){ return 7; }\nif (process.argv.includes('--selftest')) { if (value() !== 7) throw new Error('bad value'); }\n",
      needle: "value",
      finding: "Generated module selftest failed.",
    }),
    guardrailWorkstream({
      id: "input-guard",
      signer: "grok",
      file: "generated/input-guard.mjs",
      mode: "input",
      blockedTerms: ["password"],
      finding: "Input guardrail did not block password.",
    }),
    guardrailWorkstream({
      id: "output-guard",
      signer: "claude",
      file: "generated/output-guard.mjs",
      mode: "output",
      blockedTerms: ["secret"],
      finding: "Output guardrail did not redact secret.",
    }),
    scorecardWorkstream({
      id: "scorecard",
      signer: "agy",
      file: "generated/scorecard.mjs",
      thresholds: { quality: 0.8 },
      finding: "Scorecard selftest failed.",
    }),
    auditWorkstream({
      id: "audit",
      signer: "codex",
      file: "generated/audit.mjs",
      finding: "Audit selftest failed.",
    }),
  ];

  for (const workstream of generated) {
    const validation = validatePattern({ id: `single-${workstream.id}`, name: "single", workstreams: [workstream] });
    assert.equal(validation.ok, true, JSON.stringify(validation.errors || []));
    renderAndRun(workstream, toyContext());
  }

  renderAndRun(
    guardrailWorkstream({
      id: "input-guard-short-term-selftest",
      signer: "grok",
      file: "generated/input-guard-short-term-selftest.mjs",
      mode: "input",
      blockedTerms: ["hello"],
      finding: "Input guardrail selftest should support short blocked terms.",
    }),
    toyContext()
  );

  const outputGuardShortTermRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-short-term-selftest",
      signer: "claude",
      file: "generated/output-guard-short-term-selftest.mjs",
      mode: "output",
      blockedTerms: ["a"],
      finding: "Output guardrail selftest should support short blocked terms.",
    }),
    toyContext()
  );
  const outputGuardShortTermModule = await importRendered(
    outputGuardShortTermRoot,
    "generated/output-guard-short-term-selftest.mjs"
  );
  assert.deepEqual(
    outputGuardShortTermModule.redactOutput({
      note: "a",
      nested: { value: "A cab" },
      list: ["alpha", "visible"],
    }),
    {
      note: "[REDACTED]",
      nested: { value: "[REDACTED] c[REDACTED]b" },
      list: ["[REDACTED]lph[REDACTED]", "visible"],
    }
  );

  renderAndRun(
    guardrailWorkstream({
      id: "output-guard-unicode-case-selftest",
      signer: "claude",
      file: "generated/output-guard-unicode-case-selftest.mjs",
      mode: "output",
      blockedTerms: ["ß"],
      finding: "Output guardrail selftest should support Unicode blocked terms safely.",
    }),
    toyContext()
  );
  renderAndRun(
    guardrailWorkstream({
      id: "output-guard-brace-open-selftest",
      signer: "claude",
      file: "generated/output-guard-brace-open-selftest.mjs",
      mode: "output",
      blockedTerms: ["{"],
      finding: "Output guardrail selftest should support blocked open braces.",
    }),
    toyContext()
  );
  renderAndRun(
    guardrailWorkstream({
      id: "output-guard-brace-close-selftest",
      signer: "claude",
      file: "generated/output-guard-brace-close-selftest.mjs",
      mode: "output",
      blockedTerms: ["}"],
      finding: "Output guardrail selftest should support blocked close braces.",
    }),
    toyContext()
  );
  renderAndRun(
    guardrailWorkstream({
      id: "output-guard-brace-mixed-selftest",
      signer: "claude",
      file: "generated/output-guard-brace-mixed-selftest.mjs",
      mode: "output",
      blockedTerms: ["a{b}"],
      finding: "Output guardrail selftest should support blocked terms containing braces.",
    }),
    toyContext()
  );
  const outputGuardUnicodeCaseRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-unicode-case-contract",
      signer: "claude",
      file: "generated/output-guard-unicode-case-contract.mjs",
      mode: "output",
      blockedTerms: ["ß"],
      finding: "Output guardrail should redact uppercase Unicode equivalents of blocked terms.",
    }),
    toyContext()
  );
  const outputGuardUnicodeCaseModule = await importRendered(
    outputGuardUnicodeCaseRoot,
    "generated/output-guard-unicode-case-contract.mjs"
  );
  assert.equal(outputGuardUnicodeCaseModule.redactOutput("ẞ"), "[REDACTED]");

  const inputGuardThrowRoot = renderAndRun(
    guardrailWorkstream({
      id: "input-guard-throw-contract",
      signer: "grok",
      file: "generated/input-guard-throw-contract.mjs",
      mode: "input",
      blockedTerms: ["secret"],
      maxBodyLen: 64,
      finding: "Input guardrail default contract regression.",
    }),
    toyContext()
  );
  const inputGuardThrowModule = await importRendered(
    inputGuardThrowRoot,
    "generated/input-guard-throw-contract.mjs"
  );
  const cleanInput = { body: { ok: true } };
  assert.equal(inputGuardThrowModule.checkInput(cleanInput), cleanInput);
  assert.throws(() => inputGuardThrowModule.checkInput({ body: "secret" }), /blocked term/i);
  assert.throws(() => inputGuardThrowModule.checkInput({ body: "x".repeat(128) }), /maximum length/i);
  const throwCycle = {};
  throwCycle.self = throwCycle;
  assert.throws(
    () => inputGuardThrowModule.checkInput({ body: throwCycle }),
    /serializable|circular|bigint/i
  );
  assert.throws(
    () => inputGuardThrowModule.checkInput({ body: { count: 1n } }),
    /serializable|bigint/i
  );
  assert.throws(
    () => inputGuardThrowModule.checkInput(undefined),
    /serializable/i
  );
  const inputGuardBodyThrowRoot = renderAndRun(
    guardrailWorkstream({
      id: "input-guard-body-throw-contract",
      signer: "grok",
      file: "generated/input-guard-body-throw-contract.mjs",
      mode: "input",
      inputScope: "body",
      blockedTerms: ["secret"],
      maxBodyLen: 64,
      finding: "Body-scoped input guard default contract should fail closed on explicit unserializable bodies.",
    }),
    toyContext()
  );
  const inputGuardBodyThrowModule = await importRendered(
    inputGuardBodyThrowRoot,
    "generated/input-guard-body-throw-contract.mjs"
  );
  const missingBodyThrowInput = { path: "/echo", method: "POST" };
  assert.equal(
    inputGuardBodyThrowModule.checkInput(missingBodyThrowInput),
    missingBodyThrowInput,
    "missing body stays on the legacy clean-path contract"
  );
  assert.throws(
    () => inputGuardBodyThrowModule.checkInput({ body: undefined }),
    /serializable|unserializable/i
  );
  assert.throws(
    () => inputGuardBodyThrowModule.checkInput({ body: 0n }),
    /serializable|unserializable/i
  );

  const inputGuardAllowObjectRoot = renderAndRun(
    guardrailWorkstream({
      id: "input-guard-allow-object-body-contract",
      signer: "grok",
      file: "generated/input-guard-allow-object-body-contract.mjs",
      mode: "input",
      inputContract: "allow-object",
      inputScope: "body",
      blockedTerms: ["secret"],
      maxBodyLen: 64,
      finding: "Input guardrail allow-object contract should fail closed on unserializable bodies.",
    }),
    toyContext()
  );
  const inputGuardAllowObjectModule = await importRendered(
    inputGuardAllowObjectRoot,
    "generated/input-guard-allow-object-body-contract.mjs"
  );
  assert.deepEqual(
    inputGuardAllowObjectModule.checkInput({ path: "/echo", method: "POST" }),
    { allow: true },
    "missing body remains allowed for body-scoped allow-object contracts"
  );
  assert.deepEqual(
    inputGuardAllowObjectModule.checkInput({ body: undefined }),
    { allow: false, reason: "unserializable" }
  );
  assert.deepEqual(
    inputGuardAllowObjectModule.checkInput({ body: 0n }),
    { allow: false, reason: "unserializable" }
  );
  const allowObjectCycle = {};
  allowObjectCycle.self = allowObjectCycle;
  assert.deepEqual(
    inputGuardAllowObjectModule.checkInput({ body: allowObjectCycle }),
    { allow: false, reason: "unserializable" }
  );
  assert.deepEqual(
    inputGuardAllowObjectModule.checkInput({ body: { count: 1n } }),
    { allow: false, reason: "unserializable" }
  );
  const inputGuardAllowObjectWholeRoot = renderAndRun(
    guardrailWorkstream({
      id: "input-guard-allow-object-whole-contract",
      signer: "grok",
      file: "generated/input-guard-allow-object-whole-contract.mjs",
      mode: "input",
      inputContract: "allow-object",
      blockedTerms: ["secret"],
      maxBodyLen: 64,
      finding: "Input guardrail allow-object contract should reject unserializable input.",
    }),
    toyContext()
  );
  const inputGuardAllowObjectWholeModule = await importRendered(
    inputGuardAllowObjectWholeRoot,
    "generated/input-guard-allow-object-whole-contract.mjs"
  );
  assert.deepEqual(
    inputGuardAllowObjectWholeModule.checkInput(undefined),
    { allow: false, reason: "unserializable" }
  );

  const scorecardRoot = renderAndRun(
    scorecardWorkstream({
      id: "scorecard-contract",
      signer: "agy",
      file: "generated/scorecard-contract.mjs",
      thresholds: { quality: 0.8, groundedness: 0.6 },
      finding: "Scorecard contract regression.",
    }),
    toyContext()
  );
  const scorecardModule = await importRendered(scorecardRoot, "generated/scorecard-contract.mjs");
  const belowThreshold = { quality: 0.79, groundedness: 0.6 };
  assert.deepEqual(scorecardModule.computeScorecard(belowThreshold), {
    scores: belowThreshold,
    passed: {
      quality: false,
      groundedness: true,
    },
  });
  assert.throws(() => scorecardModule.assertThresholds(belowThreshold), /below threshold/i);

  const protoThresholdRoot = renderAndRun(
    scorecardWorkstream({
      id: "scorecard-proto-threshold-contract",
      signer: "agy",
      file: "generated/scorecard-proto-threshold-contract.mjs",
      thresholds: JSON.parse('{"__proto__":0.5}'),
      finding: "Scorecard should preserve unsafe-looking threshold keys safely.",
    }),
    toyContext()
  );
  const protoThresholdModule = await importRendered(
    protoThresholdRoot,
    "generated/scorecard-proto-threshold-contract.mjs"
  );
  const protoThresholdScores = JSON.parse('{"__proto__":0.75}');
  assert.deepEqual(protoThresholdModule.computeScorecard(protoThresholdScores), {
    scores: protoThresholdScores,
    passed: JSON.parse('{"__proto__":true}'),
  });
  assert.equal(protoThresholdModule.assertThresholds(protoThresholdScores), true);
  assert.throws(() => protoThresholdModule.computeScorecard({}), /missing score: __proto__/i);
  assert.throws(() => protoThresholdModule.assertThresholds({}), /missing score: __proto__/i);

  const outputGuardRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-contract",
      signer: "claude",
      file: "generated/output-guard-contract.mjs",
      mode: "output",
      blockedTerms: ["secret", "123-45-6789"],
      finding: "Output guardrail contract regression.",
    }),
    toyContext()
  );
  const outputGuardModule = await importRendered(outputGuardRoot, "generated/output-guard-contract.mjs");
  const cleanObject = { status: 200, body: { echo: { ok: true, note: "visible" } } };
  assert.deepEqual(outputGuardModule.redactOutput(cleanObject), cleanObject);
  const blockedObject = { status: 200, body: { note: "my SECRET is here", ssn: "123-45-6789" } };
  assert.deepEqual(outputGuardModule.redactOutput(blockedObject), {
    status: 200,
    body: { note: "my [REDACTED] is here", ssn: "[REDACTED]" },
  });
  const blockedString = "This SECRET and 123-45-6789 must disappear.";
  assert.equal(outputGuardModule.redactOutput(blockedString), "This [REDACTED] and [REDACTED] must disappear.");

  const outputGuardContainerRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-container-contract",
      signer: "claude",
      file: "generated/output-guard-container-contract.mjs",
      mode: "output",
      blockedTerms: ["secret"],
      finding: "Output guardrail should redact Map and Set containers.",
    }),
    toyContext()
  );
  const outputGuardContainerModule = await importRendered(
    outputGuardContainerRoot,
    "generated/output-guard-container-contract.mjs"
  );
  const redactedMap = outputGuardContainerModule.redactOutput(new Map([["k", "secret"]]));
  assert.ok(redactedMap instanceof Map, "redacted map preserves Map type");
  assert.equal(redactedMap.get("k"), "[REDACTED]");
  const redactedSet = outputGuardContainerModule.redactOutput(new Set(["secret"]));
  assert.ok(redactedSet instanceof Set, "redacted set preserves Set type");
  assert.deepEqual([...redactedSet], ["[REDACTED]"]);
  const redactedStringKeyMap = outputGuardContainerModule.redactOutput(new Map([["secret", "visible"]]));
  assert.ok(redactedStringKeyMap instanceof Map, "string-key map preserves Map type");
  assert.deepEqual(
    [...redactedStringKeyMap.entries()],
    [["[REDACTED]", "visible"]],
    "string map keys are redacted recursively"
  );
  const originalObjectKey = { note: "secret" };
  const redactedObjectKeyMap = outputGuardContainerModule.redactOutput(new Map([[originalObjectKey, "visible"]]));
  assert.ok(redactedObjectKeyMap instanceof Map, "object-key map preserves Map type");
  const [[redactedObjectKey, redactedObjectKeyValue]] = [...redactedObjectKeyMap.entries()];
  assert.notEqual(redactedObjectKey, originalObjectKey, "object map keys are cloned during redaction");
  assert.deepEqual(redactedObjectKey, { note: "[REDACTED]" });
  assert.equal(redactedObjectKeyValue, "visible");

  const outputGuardKeyRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-key-contract",
      signer: "claude",
      file: "generated/output-guard-key-contract.mjs",
      mode: "output",
      blockedTerms: ["password", "secret", "token"],
      finding: "Output guardrail object-key contract regression.",
    }),
    toyContext()
  );
  const outputGuardKeyModule = await importRendered(outputGuardKeyRoot, "generated/output-guard-key-contract.mjs");
  const keyedBlockedObject = { password: "secret", nested: { token: "secret" } };
  assert.deepEqual(outputGuardKeyModule.redactOutput(keyedBlockedObject), {
    password: "[REDACTED]",
    nested: { token: "[REDACTED]" },
  });
  const undefinedShape = { password: undefined, nested: { token: "secret" }, list: ["secret"] };
  const undefinedShapeRedacted = outputGuardKeyModule.redactOutput(undefinedShape);
  assert.ok(Object.hasOwn(undefinedShapeRedacted, "password"), "undefined-valued keys are preserved");
  assert.equal(undefinedShapeRedacted.password, undefined);
  assert.deepEqual(undefinedShapeRedacted, {
    password: undefined,
    nested: { token: "[REDACTED]" },
    list: ["[REDACTED]"],
  });

  const outputGuardInstanceRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-instance-contract",
      signer: "claude",
      file: "generated/output-guard-instance-contract.mjs",
      mode: "output",
      blockedTerms: ["secret", "token"],
      finding: "Output guardrail instance contract regression.",
    }),
    toyContext()
  );
  const outputGuardInstanceModule = await importRendered(
    outputGuardInstanceRoot,
    "generated/output-guard-instance-contract.mjs"
  );
  class OutputEnvelope {
    constructor(note, nested) {
      this.note = note;
      this.nested = nested;
    }
  }
  const instancePayload = new OutputEnvelope("SECRET token", {
    detail: "visible",
    token: "secret",
  });
  const instanceRedacted = outputGuardInstanceModule.redactOutput(instancePayload);
  assert.ok(instanceRedacted instanceof OutputEnvelope, "class instance prototype is preserved");
  assert.notEqual(instanceRedacted, instancePayload, "class instances are cloned during redaction");
  assert.equal(instanceRedacted.note, "[REDACTED] [REDACTED]");
  assert.deepEqual(instanceRedacted.nested, {
    detail: "visible",
    token: "[REDACTED]",
  });
  const outputGuardAccessorRoot = renderAndRun(
    guardrailWorkstream({
      id: "output-guard-accessor-contract",
      signer: "claude",
      file: "generated/output-guard-accessor-contract.mjs",
      mode: "output",
      blockedTerms: ["secret"],
      finding: "Output guardrail should reject accessor properties.",
    }),
    toyContext()
  );
  const outputGuardAccessorModule = await importRendered(
    outputGuardAccessorRoot,
    "generated/output-guard-accessor-contract.mjs"
  );
  const accessorPayload = {};
  Object.defineProperty(accessorPayload, "note", {
    enumerable: true,
    get() {
      return "secret";
    },
  });
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(accessorPayload),
    /accessor|unsupported property/i
  );
  let arrayGetterReads = 0;
  const arrayAccessorPayload = ["visible", "secret"];
  Object.defineProperty(arrayAccessorPayload, "1", {
    enumerable: true,
    get() {
      arrayGetterReads += 1;
      return "secret";
    },
  });
  Object.defineProperty(arrayAccessorPayload, "meta", {
    value: "secret",
    enumerable: true,
    writable: true,
    configurable: true,
  });
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(arrayAccessorPayload),
    /accessor|unsupported property/i
  );
  assert.equal(arrayGetterReads, 0, "array accessor getter must not be invoked during redaction");
  let inheritedArrayGetterReads = 0;
  class AccessorArray extends Array {
    get note() {
      inheritedArrayGetterReads += 1;
      return "secret";
    }
  }
  const inheritedArrayAccessorPayload = new AccessorArray("visible");
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(inheritedArrayAccessorPayload),
    /inherited|prototype|accessor/i
  );
  assert.equal(
    inheritedArrayGetterReads,
    0,
    "inherited array accessor getter must not be invoked during redaction"
  );
  class InheritedAccessorEnvelope {
    constructor(payload) {
      this.payload = payload;
    }

    get note() {
      return "secret";
    }
  }
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(new InheritedAccessorEnvelope("visible")),
    /inherited|prototype|accessor/i
  );
  let mapEntriesGetterReads = 0;
  const mapAccessorPayload = new Map([["note", "secret"]]);
  Object.defineProperty(mapAccessorPayload, "entries", {
    configurable: true,
    get() {
      mapEntriesGetterReads += 1;
      return Map.prototype.entries;
    },
  });
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(mapAccessorPayload),
    /accessor|unsupported property/i
  );
  assert.equal(mapEntriesGetterReads, 0, "Map entries accessor getter must not be invoked during redaction");
  let setValuesGetterReads = 0;
  const setAccessorPayload = new Set(["secret"]);
  Object.defineProperty(setAccessorPayload, "values", {
    configurable: true,
    get() {
      setValuesGetterReads += 1;
      return Set.prototype.values;
    },
  });
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(setAccessorPayload),
    /accessor|unsupported property/i
  );
  assert.equal(setValuesGetterReads, 0, "Set values accessor getter must not be invoked during redaction");
  let toStringTagGetterReads = 0;
  const inheritedToStringTagPrototype = Object.create(Object.prototype, {
    [Symbol.toStringTag]: {
      configurable: true,
      get() {
        toStringTagGetterReads += 1;
        return "Sensitive";
      },
    },
  });
  const inheritedToStringTagPayload = Object.create(inheritedToStringTagPrototype);
  inheritedToStringTagPayload.note = "secret";
  assert.throws(
    () => outputGuardAccessorModule.redactOutput(inheritedToStringTagPayload),
    /inherited|prototype|accessor|unsupported/i
  );
  assert.equal(
    toStringTagGetterReads,
    0,
    "Inherited Symbol.toStringTag getter must not be invoked during redaction"
  );

  const servingInputGuardWorkstream = servingBuildWorkstreams.find((workstream) => workstream.id === "input-guardrail");
  assert.ok(servingInputGuardWorkstream, "serving input guard workstream exists");
  const servingInputGuardRoot = renderAndRun(servingInputGuardWorkstream);
  const servingInputGuardModule = await importRendered(servingInputGuardRoot, "serving/guard-in.mjs");
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/echo", method: "POST", body: { ok: true } }),
    { allow: true }
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/echo", method: "POST", body: { q: "<script>alert(1)</script>" } }),
    { allow: false, reason: "denylisted" }
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/echo", method: "POST", body: { q: "x".repeat(512) } }),
    { allow: false, reason: "oversized" }
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/<script>", method: "POST", body: { ok: true } }),
    { allow: true },
    "serving input guard only inspects the request body for denylisted terms"
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/" + "x".repeat(512), method: "POST", body: { ok: true } }),
    { allow: true },
    "serving input guard only measures the request body length"
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/echo", method: "POST" }),
    { allow: true },
    "serving input guard keeps missing body on the clean-path contract"
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/echo", method: "POST", body: undefined }),
    { allow: false, reason: "unserializable" }
  );
  assert.deepEqual(
    servingInputGuardModule.checkInput({ path: "/echo", method: "POST", body: 0n }),
    { allow: false, reason: "unserializable" }
  );

  const servingAuditWorkstream = servingBuildWorkstreams.find((workstream) => workstream.id === "audit");
  assert.ok(servingAuditWorkstream, "serving audit workstream exists");
  const servingAuditRoot = renderAndRun(servingAuditWorkstream);
  const servingAuditModule = await importRendered(servingAuditRoot, "serving/audit.mjs");
  const servingAuditDir = mkdtempSync(path.join(tmpdir(), "ai-forge-serving-audit-contract-"));
  const servingAuditEntry = { path: "/echo", action: "serve", status: 200, allow: true };
  servingAuditModule.appendAudit(servingAuditDir, servingAuditEntry);
  const servingAuditLog = readFileSync(path.join(servingAuditDir, "audit.log"), "utf8").trim().split("\n");
  assert.equal(servingAuditLog.length, 1, "serving audit appends one line");
  const servingAuditRecord = JSON.parse(servingAuditLog[0]);
  assert.deepEqual(
    {
      path: servingAuditRecord.path,
      action: servingAuditRecord.action,
      status: servingAuditRecord.status,
      allow: servingAuditRecord.allow,
    },
    servingAuditEntry
  );
  assert.equal("event" in servingAuditRecord, false, "serving audit record is not wrapped in an event envelope");

  const ok = await forge({
    pattern: toyPattern(),
    ctx: toyContext(),
    projectRoot: mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-ok-")),
    dossierMeta: toyDossierMeta(),
    maxCycles: 2,
  });
  assert.equal(ok.converged, true, "catalog toy pattern converges");

  const bad = await forge({
    pattern: toyPattern({ broken: true }),
    ctx: toyContext(),
    projectRoot: mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-bad-")),
    dossierMeta: toyDossierMeta(),
    maxCycles: 1,
  });
  assert.equal(bad.converged, false, "broken catalog toy pattern fails closed");
  assert.notEqual(
    bad.cycles[0].ledger_status,
    "ready",
    `Expected ledger_status !== "ready"; got ${bad.cycles[0].ledger_status}`
  );

  const auditRoot = renderAndRun(
    auditWorkstream({
      id: "audit-read",
      signer: "codex",
      file: "generated/audit-read.mjs",
      finding: "Audit selftest failed.",
    }),
    toyContext()
  );
  const source = readFileSync(path.join(auditRoot, "generated/audit-read.mjs"), "utf8");
  assert.ok(source.includes("appendAudit"), "audit source exposes appendAudit");

  console.log("test-workstream-catalog: ok");
}

await main();
