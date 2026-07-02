#!/usr/bin/env node

// Claim-typing tests: grade rules render per declared grade, claims group
// correctly, empty/absent claims change nothing, invalid entries are ignored
// by the renderer (validation rejects them upstream), and the bout stage
// injects the ledger into contested contracts only.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderClaimRules, GRADES } from "../claims.mjs";
import { validateManifest } from "../manifest.mjs";
import { openState, runBouts } from "../ratchet.mjs";

// 1. No claims -> empty string (existing bouts byte-identical).
{
  assert.equal(renderClaimRules(undefined), "");
  assert.equal(renderClaimRules([]), "");
  assert.equal(renderClaimRules([{ statement: "x", grade: "vibes" }]), "", "unknown grades render nothing");
}

// 2. Claims group by grade with each grade's adjudication rule, in grade order.
{
  const out = renderClaimRules([
    { statement: "Pricing tiers convert at 2%", grade: "hypothesis" },
    { statement: "schema.sql defines RLS policies", grade: "inspectable" },
    { statement: "evals clear the 0.90 threshold", grade: "executable" },
    { statement: "Next.js static export forbids next/image optimization", grade: "cited" }
  ]);
  assert.ok(out.includes("CLAIM LEDGER"));
  for (const g of GRADES) assert.ok(out.includes(`[${g.toUpperCase()}]`), `${g} rule present`);
  assert.ok(out.indexOf("[EXECUTABLE]") < out.indexOf("[HYPOTHESIS]"), "grade order stable");
  assert.ok(out.includes("Pricing tiers convert at 2%"));
  assert.ok(out.includes("never the truth of the claim") || out.includes("disputing the hypothesis's truth"), "hypothesis rule protects truth-judgment boundary");
}

// 3. Manifest validation: claims accepted with valid grades, rejected otherwise.
{
  const base = {
    build_id: "b", telos: "t", objective: "o",
    workstreams: [{
      id: "a", signer: "codex", lens: "codex", dependencies: [], files: ["a.md"],
      requirements: "R", checks: [{ type: "file_exists", path: "a.md" }],
      claims: [{ statement: "S", grade: "hypothesis" }]
    }]
  };
  validateManifest(structuredClone(base));
  const bad1 = structuredClone(base);
  bad1.workstreams[0].claims[0].grade = "vibes";
  assert.throws(() => validateManifest(bad1), /claim grade "vibes"/);
  const bad2 = structuredClone(base);
  bad2.workstreams[0].claims[0].proof = "trust me";
  assert.throws(() => validateManifest(bad2), /unknown claim field "proof"/);
}

// 4. runBouts injects the ledger into the contested contract (and only there).
{
  const w = mkdtempSync(path.join(os.tmpdir(), "forge-claims-"));
  mkdirSync(path.join(w, ".telos"), { recursive: true });
  const state = openState(w);
  const contracts = [];
  const makeFns = ({ contract }) => {
    contracts.push(contract);
    return { challenge: async () => ({ blockers: [] }), revise: async () => ({ evidence: "e", resolved: [] }) };
  };
  const workstreams = [{
    id: "graded", files: ["g.md"], checks: [], lens: "claude", signer: "claude",
    claims: [{ statement: "The moat is the museum conceit", grade: "hypothesis" }]
  }];
  const defById = new Map([["graded", { id: "graded", requirements: "REQ" }]]);
  await runBouts({ workstreams, state, makeFns, defById, hashById: new Map(), telosDir: path.join(w, ".telos") });
  assert.ok(contracts[0].startsWith("REQ"), "requirements lead the contract");
  assert.ok(contracts[0].includes("CLAIM LEDGER"), "claim ledger joined the contract");
  assert.ok(contracts[0].includes("museum conceit"));
}

console.log("test-claims: all assertions passed");
