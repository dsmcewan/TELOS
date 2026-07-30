#!/usr/bin/env node
// generate-artifacts.mjs — produce the committed demo evidence.
//
// Runs the operator segment of docs/runs/fail-closed-demo/run.mjs once in a
// throwaway tmpdir (the operator writes PRIVATE keys into its workdir — that
// dir must never be inside the repo) and exports only public, verifiable
// artifacts. Manual run-and-commit; never executed in CI.

import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

import { createOperator } from "../forge/operator.mjs";
import { canonical, sha256Hex, verifyDecision, verifyDigest } from "./verify.js";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts");
const workdir = mkdtempSync(path.join(os.tmpdir(), "telos-demo-artifacts-"));

try {
  const op = createOperator({
    workdir,
    signerName: "telos-demo",
    rulebook: [{
      id: "overspend",
      when: () => true,
      act: () => ({
        action: "update_budget",
        args: { campaign_id: "fixture-campaign", daily_budget_cents: 2501 }
      })
    }],
    bounds: {
      update_budget: (args) => args.daily_budget_cents <= 2000
        ? true
        : `daily_budget_cents ${args.daily_budget_cents} over cap 2000`
    },
    actions: { update_budget: async () => ({ ok: true }) }
  });

  const result = await op.runPass({ source: "demo-artifact-generation" });
  if (result.decisions.length !== 1 || result.decisions[0].outcome !== "needs-human") {
    throw new Error("scenario drifted: expected exactly one needs-human decision");
  }

  const ledger = readFileSync(op.ledgerPath, "utf8")
    .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const inboxRecord = JSON.parse(readFileSync(op.inboxPath, "utf8").trim());
  const digest = {
    alg: "SHA-256",
    value: await sha256Hex(new TextEncoder().encode(canonical(inboxRecord)), webcrypto.subtle)
  };

  // Self-check before writing anything: exported evidence must verify.
  for (const rec of ledger) {
    const v = await verifyDecision(rec, op.publicJwk, webcrypto.subtle);
    if (!v.ok) throw new Error(`generated ledger record failed verification: ${v.reason}`);
  }
  const d = await verifyDigest(inboxRecord, digest, webcrypto.subtle);
  if (!d.ok) throw new Error(`generated digest failed verification: ${d.reason}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const save = (name, value) =>
    writeFileSync(path.join(OUT_DIR, name), JSON.stringify(value, null, 2) + "\n");
  save("ledger.json", ledger);
  save("public-key.jwk.json", op.publicJwk);
  save("record.json", { record: inboxRecord, digest });
  process.stdout.write(`artifacts written to ${OUT_DIR}\n`);
} finally {
  rmSync(workdir, { recursive: true, force: true }); // private keys die here
}
