#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
