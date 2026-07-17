#!/usr/bin/env node
// Audit-assist generator for docs/ledgers/clotho-obligation-ledger.jsonl (The
// Eye's reviewed-data ruling). Uses the SAME canonicalJson/sha256/section-split
// machinery the ledger weaver validates with, so the committed artifact is
// valid-by-construction — but its CONTENT is authored governance data and is
// reviewed by The Eye at PR, alongside expected-flagship.json.
//
//   node docs/runs/clotho-impl-slice-6/generate-obligation-ledger.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { canonicalJson } = await imp("clotho/registry.mjs");
const { splitMarkdownSections } = await imp("clotho/weavers/util.mjs");
const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");

// Resolve the REAL clause address + section hash from the committed contract.
const contractPath = "contracts/Proposal Lifecycle.md";
const { sections } = splitMarkdownSections(readFileSync(path.join(ROOT, contractPath), "utf8"));
const clause = sections.find((s) => s.heading_path[s.heading_path.length - 1] === "Verification obligations — the bridge to Rule 3");
if (!clause) throw new Error("clause not found — heading changed? re-audit required");
const contractClauseRef = { path: contractPath, heading_path: clause.heading_path, text_sha256: clause.text_sha256 };

const entries = [
  {
    entryKind: "concern",
    evidenceText: "Concern: a verification obligation whose executable is not content-address-bound can drift from the check contract it discharges. deriveExecutableRef is the binding primitive: every obligation's {cmd, args, cwd} must derive a stable executable ref before the gate trusts its discharge (consumers: build-gate/proposal-gate.mjs).",
    dischargeEvidence: null,
    contractClauseRef: null
  },
  {
    entryKind: "obligation",
    evidenceText: "Obligation: deriveExecutableRef must derive a deterministic, content-addressed executable ref for every Rule-3 verification binding, so an obligation's executable identity is frozen at mint time.",
    dischargeEvidence: "merkle-dag/scripts/test-obligation.mjs",
    contractClauseRef
  }
];

let prev = "";
const lines = entries.map((e) => {
  const content = { entryKind: e.entryKind, evidenceText: e.evidenceText, dischargeEvidence: e.dischargeEvidence, contractClauseRef: e.contractClauseRef };
  const entryHash = sha256hex(Buffer.from(canonicalJson(content), "utf8"));
  const line = JSON.stringify({ ...content, entryHash, prev_hash: prev });
  prev = entryHash;
  return line;
});

mkdirSync(path.join(ROOT, "docs/ledgers"), { recursive: true });
const out = path.join(ROOT, "docs/ledgers/clotho-obligation-ledger.jsonl");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`wrote ${out}`);
console.log(`clause: ${JSON.stringify(contractClauseRef.heading_path)} text_sha256=${contractClauseRef.text_sha256.slice(0, 16)}…`);
console.log(lines.map((l) => JSON.parse(l).entryHash).join("\n"));
