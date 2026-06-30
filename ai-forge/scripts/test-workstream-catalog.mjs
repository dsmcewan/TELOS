#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { forge } from "../forge.mjs";
import { validatePattern } from "../pattern.mjs";
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
