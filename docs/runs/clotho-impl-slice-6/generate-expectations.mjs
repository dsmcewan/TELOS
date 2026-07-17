#!/usr/bin/env node
// generate-expectations.mjs — Slice 6 audit-assist generator (evidence tooling,
// NOT shipped test surface). Derives CANDIDATE expectations for the flagship
// acceptance artifact `clotho/scripts/expected-flagship.json` from a verified
// real-repository weave plus git, and derives the matching D3 review set
// (fact-set minus expected, deterministically sorted, unscored).
//
// The output is a DRAFT for HAND-AUDIT, never self-certifying: every audited
// value (blob SHAs, content addresses, the full 40-hex introduction SHA, section
// hashes, entry hashes, multiplicities) must be independently confirmed against
// the reviewed repository state, and The Eye reviews the exact committed
// artifact at PR review (matured approach, R1: the artifact STORES the audited
// repository_ref; staleness of stored hashes is the designed re-audit trigger).
//
// Usage: node generate-expectations.mjs --artifact <path> --review-set <path>
// (paths are resolved from the CURRENT WORKING DIRECTORY; omit both to print a
// summary plus the artifact JSON to stdout). Weaves to a unique ignored path
// below .telos/clotho/ and removes it in `finally`.

import { writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runWeave } from "../../../clotho/weave.mjs";
import { verifyLedger } from "../../../clotho/thread-ledger.mjs";
import { canonicalJson, deriveNodeId, deriveRepositoryRef } from "../../../clotho/registry.mjs";
import { why, blastRadius } from "../../../clotho/query.mjs";
import { makeGitRunner } from "../../../clotho/weavers/util.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The frozen flagship target (plan v15 Task 6) and the five expected
// rationale/support kinds of the flagship `why` call.
const FLAGSHIP = { path: "merkle-dag/obligation.mjs", symbol: "deriveExecutableRef" };
const EXPECTED_KINDS = ["introduced-by", "motivated-by", "documented-in", "evidenced-by", "discharges"];

// The eight source groups in their declared order (Task 6).
const GROUPS = ["definition", "consumers", "tests", "introduction", "documentation", "concern", "run-evidence", "contract"];

// AUDIT SELECTION RULE for the `tests` group (documented, reviewable): the
// flagship's audited test expectations are (a) every reachable `verified-by`
// edge FROM the target symbol (import-derived provenance, D25: source_ref = the
// test file's own content address) and (b) the command-inferred `verified-by`
// edge for the flagship obligation's discharge-evidence test file (D25:
// source_ref = the package.json content address). Every other verified-by fact
// in the blast-radius evidence belongs to the review set, not the expected set
// (D3: extra facts are reported, never silently validated).
const DISCHARGE_EVIDENCE_TEST = "merkle-dag/scripts/test-obligation.mjs";

function parseArgs(argv) {
  const out = { artifact: null, reviewSet: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--artifact") out.artifact = argv[++i];
    else if (argv[i] === "--review-set") out.reviewSet = argv[++i];
    else throw new Error(`unknown argument ${JSON.stringify(argv[i])}`);
  }
  return out;
}

// Content-bound fact tuple (identity used for expectation matching and the
// review set): no record hash, no assertor, no score of any kind.
const edgeTuple = (r) => ({
  subject: "edge",
  edge_kind: r.edge_kind,
  from_kind: r.from_locator.kind,
  from_locator: r.from_locator.locator,
  to_kind: r.to_locator.kind,
  to_locator: r.to_locator.locator,
  source_ref: r.source_ref
});
const nodeTuple = (d) => ({ subject: "node", kind: d.kind, locator: d.locator });

const edgeExpectation = (group, t) => ({
  source_group: group,
  subject: "edge",
  edge_kind: t.edge_kind,
  from_kind: t.from_kind,
  from_locator_match: t.from_locator,
  to_kind: t.to_kind,
  to_locator_match: t.to_locator,
  source_ref: t.source_ref
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const git = makeGitRunner(repoRoot);
  const repositoryRef = deriveRepositoryRef(git);
  const blobSha = String(git(["hash-object", "--no-filters", "--", FLAGSHIP.path])).replace(/\r?\n$/, "");
  const target = {
    kind: "code-symbol",
    locator: { repository_ref: repositoryRef, path: FLAGSHIP.path, symbol: FLAGSHIP.symbol, blob_sha: blobSha }
  };
  const targetId = deriveNodeId(target);

  const outRel = `.telos/clotho/generate-expectations-${process.pid}-${Date.now()}.jsonl`;
  const outAbs = path.join(repoRoot, ...outRel.split("/"));
  let published = false;
  try {
    const res = await runWeave({ out: outRel });
    if (!res.ok || res.publication !== "published") {
      throw new Error(`weave failed: ${canonicalJson(res.error ?? res.publication)}`);
    }
    published = true;
    const v = await verifyLedger(outAbs);
    if (!v.ok || v.manifest === null) throw new Error(`verification failed: ${v.errors.join("; ")}`);
    if (v.header.repository_ref !== repositoryRef) throw new Error("header repository_ref != derived");

    const w = why(v.records, targetId, { expectedKinds: EXPECTED_KINDS, manifest: v.manifest });
    const br = blastRadius(v.records, targetId, 3, { manifest: v.manifest });

    // Fact set: stable union of the target node, why.chain, and blastRadius.edges.
    const edgeByHash = new Map();
    for (const r of [...w.chain, ...br.edges]) if (!edgeByHash.has(r.record_hash)) edgeByHash.set(r.record_hash, r);
    const facts = [nodeTuple(target), ...[...edgeByHash.values()].map(edgeTuple)];
    const factKeys = facts.map((t) => canonicalJson(t));
    if (new Set(factKeys).size !== factKeys.length) throw new Error("duplicate fact tuple in the fact set");

    // Classify candidate expectations by the Task 6 group semantics.
    const targetLocKey = canonicalJson(target.locator);
    const isTarget = (kind, loc) => kind === "code-symbol" && canonicalJson(loc) === targetLocKey;
    const byGroup = new Map(GROUPS.map((g) => [g, []]));
    byGroup.get("definition").push({ source_group: "definition", subject: "node", kind: target.kind, locator_match: target.locator });

    const hop1Obligations = [];
    for (const f of facts) {
      if (f.subject !== "edge") continue;
      if (f.edge_kind === "discharges" && isTarget(f.from_kind, f.from_locator) && f.to_kind === "obligation") {
        hop1Obligations.push(canonicalJson(f.to_locator));
      }
    }
    for (const f of facts) {
      if (f.subject !== "edge") continue;
      const fromTarget = isTarget(f.from_kind, f.from_locator);
      if (f.edge_kind === "depends-on" && isTarget(f.to_kind, f.to_locator)) byGroup.get("consumers").push(edgeExpectation("consumers", f));
      else if (f.edge_kind === "verified-by" && (fromTarget || (f.from_kind === "repository-file" && f.from_locator.path === DISCHARGE_EVIDENCE_TEST))) byGroup.get("tests").push(edgeExpectation("tests", f));
      else if (f.edge_kind === "introduced-by" && fromTarget) byGroup.get("introduction").push(edgeExpectation("introduction", f));
      else if (f.edge_kind === "documented-in" && fromTarget && f.to_kind === "doc-section") byGroup.get("documentation").push(edgeExpectation("documentation", f));
      else if (f.edge_kind === "motivated-by" && fromTarget) byGroup.get("concern").push(edgeExpectation("concern", f));
      else if (f.edge_kind === "evidenced-by" && fromTarget) byGroup.get("run-evidence").push(edgeExpectation("run-evidence", f));
      else if (f.edge_kind === "discharges" && (fromTarget || (f.from_kind === "obligation" && hop1Obligations.includes(canonicalJson(f.from_locator))))) byGroup.get("contract").push(edgeExpectation("contract", f));
    }

    const expectations = [];
    for (const g of GROUPS) {
      const entries = byGroup.get(g);
      if (entries.length === 0) throw new Error(`group ${g} derived no candidate expectation — the flagship neighborhood lacks ground truth`);
      entries.sort((a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : 1));
      expectations.push(...entries);
    }

    const artifact = {
      clotho_expected_flagship: {
        task: "clotho plan v15 Task 6 (docs/runs/clotho-daedalus-delta14/matured-plan-v15.md)",
        target: { path: FLAGSHIP.path, symbol: FLAGSHIP.symbol },
        repository_ref: repositoryRef,
        generated_by: "docs/runs/clotho-impl-slice-6/generate-expectations.mjs",
        audit_note: "Hand-audited content-bound expectations from the reviewed repository state; The Eye reviews this exact artifact at PR review. Stored hashes going stale is the designed re-audit trigger: any commit changing the flagship neighborhood invalidates the artifact until regenerated AND re-audited."
      },
      expectations
    };

    // D3 review set: exactly fact-set minus expected, sorted bytewise by
    // canonical JSON. Reported, never scored: no relevance/rank/confidence.
    const expectedKeys = new Set(expectations.map((e) => {
      if (e.subject === "node") return canonicalJson({ subject: "node", kind: e.kind, locator: e.locator_match });
      return canonicalJson({ subject: "edge", edge_kind: e.edge_kind, from_kind: e.from_kind, from_locator: e.from_locator_match, to_kind: e.to_kind, to_locator: e.to_locator_match, source_ref: e.source_ref });
    }));
    const unmatched = facts.filter((t) => !expectedKeys.has(canonicalJson(t)))
      .sort((a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : 1));
    const reviewSet = {
      kind: "clotho-flagship-review-set",
      note: "Unexpected facts in the flagship neighborhood (fact-set minus matched), deterministically sorted; reported for review, never scored (D3 — relevance is Lachesis's domain, non-claimed).",
      repository_ref: repositoryRef,
      target: target.locator,
      fact_count: facts.length,
      matched_count: facts.length - unmatched.length,
      unmatched
    };

    const artifactJson = JSON.stringify(artifact, null, 2) + "\n";
    const reviewJson = JSON.stringify(reviewSet, null, 2) + "\n";
    if (args.artifact) writeFileSync(path.resolve(args.artifact), artifactJson);
    if (args.reviewSet) writeFileSync(path.resolve(args.reviewSet), reviewJson);
    const counts = GROUPS.map((g) => `${g}=${byGroup.get(g).length}`).join(" ");
    process.stderr.write(`generate-expectations: weave ${res.edge_count} edges, ${res.ledger_bytes} bytes; facts=${facts.length} expected=${expectations.length} review-set=${unmatched.length}\n`);
    process.stderr.write(`generate-expectations: ${counts}\n`);
    if (!args.artifact) process.stdout.write(artifactJson);
  } finally {
    if (published) { try { unlinkSync(outAbs); } catch { /* best-effort temp cleanup */ } }
  }
}

await main();
