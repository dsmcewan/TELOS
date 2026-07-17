#!/usr/bin/env node
// Real run evidence for the flagship symbol (The Eye's reviewed-data ruling,
// 2026-07-17, docs/runs/clotho-impl-slice-6/ESCALATION.md resolution (a)).
//
// This run EXECUTES merkle-dag/obligation.mjs#deriveExecutableRef against two
// genuine check-contract bindings and records the derived content-addressed
// executable refs. The summary's declared fields name the symbol because the run
// genuinely exercised it — this is run evidence, not an assertion file.
//
//   node docs/runs/clotho-flagship-evidence/run-evidence.mjs
// writes summary.json beside this script (deterministic given the bindings).

import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const { deriveExecutableRef } = await import(pathToFileURL(path.join(ROOT, "merkle-dag/obligation.mjs")).href);

// Two real verification bindings from this repository (the merkle-dag and clotho
// package test commands — the executables Rule-3 verification actually runs).
const bindings = [
  { name: "merkle-dag-npm-test", test: { cmd: "npm", args: ["test"], cwd: "merkle-dag" } },
  { name: "clotho-npm-test", test: { cmd: "npm", args: ["test"], cwd: "clotho" } }
];

const derived = bindings.map((b) => ({ name: b.name, test: b.test, executable_ref: deriveExecutableRef(b.test) }));

// Determinism + distinctness are the run's own checks.
for (const d of derived) {
  const again = deriveExecutableRef(d.test);
  if (again !== d.executable_ref) throw new Error(`non-deterministic executable ref for ${d.name}`);
  if (!/^sha256:[0-9a-f]{64}$/.test(d.executable_ref)) throw new Error(`malformed executable ref for ${d.name}`);
}
if (derived[0].executable_ref === derived[1].executable_ref) throw new Error("distinct bindings must derive distinct refs");

const summary = {
  objective: "Execute deriveExecutableRef (merkle-dag/obligation.mjs) against two genuine Rule-3 verification bindings and record the derived content-addressed executable refs.",
  note: "deriveExecutableRef derived deterministic, distinct sha256 executable refs for both bindings; this run is the committed evidence that the symbol executes as the Verification-obligations clause requires.",
  symbols: ["deriveExecutableRef"],
  evidence: derived.map((d) => `${d.name}: ${d.executable_ref}`),
  runner: "docs/runs/clotho-flagship-evidence/run-evidence.mjs"
};
writeFileSync(path.join(HERE, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
