#!/usr/bin/env node
// test-weaver-ledger.mjs — Task 4b. Real coverage of clotho/weavers/ledger.mjs:
// D31 independent contract-files consumption (its OWN index, no doc-weaver map,
// exhausted even when no clause edge results); the discharges matrix
// (code-symbol -> obligation, obligation -> contract-clause on an exact three-field
// unique reference); concern -> motivated-by; run summary -> evidenced-by; a stale
// clause ref warns and emits no clause edge; a duplicate contract heading path is
// ambiguous (no clause edge); a chain break leaves the suffix untrusted while prior
// valid entries emit; an unknown adapter id warns with NO generic fallback;
// malformed JSON/schema/hash/chain failures surface typed fatal warnings while
// preserving valid prior entries; byte-equal over two runs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";

import { weave } from "../weavers/ledger.mjs";
import { makeCountedSource, splitMarkdownSections } from "../weavers/util.mjs";
import { canonicalJson } from "../registry.mjs";

const REPO = "git-root:" + "a".repeat(40);
const A = "11".repeat(20); // alpha blob
const eh = (content) => createHash("sha256").update(Buffer.from(canonicalJson(content), "utf8")).digest("hex");
function entry(prev, { entryKind, evidenceText, dischargeEvidence = null, contractClauseRef = null }) {
  const content = { entryKind, evidenceText, dischargeEvidence, contractClauseRef };
  const entryHash = eh(content);
  return { json: JSON.stringify({ entryKind, entryHash, evidenceText, dischargeEvidence, contractClauseRef, prev_hash: prev }), entryHash };
}

const root = mkdtempSync(path.join(tmpdir(), "clotho-ledger-"));
try {
  // contract files
  const cMd = "# Clause One\nThe alpha obligation clause bytes.\n";
  const dupMd = "# Dup\nalpha one\n# Dup\nalpha two\n";
  mkdirSync(path.join(root, "contracts"), { recursive: true });
  writeFileSync(path.join(root, "contracts", "C.md"), cMd);
  writeFileSync(path.join(root, "contracts", "Dup.md"), dupMd);
  const clause = splitMarkdownSections(cMd).sections[0];
  const validRef = { path: "contracts/C.md", heading_path: clause.heading_path, text_sha256: clause.text_sha256 };
  const staleRef = { path: "contracts/C.md", heading_path: clause.heading_path, text_sha256: "0".repeat(64) };

  // valid ledger: concern, obligation(valid clause), obligation(stale clause)
  const e1 = entry("", { entryKind: "concern", evidenceText: "concerns alpha behavior" });
  const e2 = entry(e1.entryHash, { entryKind: "obligation", evidenceText: "discharge alpha", dischargeEvidence: "proof", contractClauseRef: validRef });
  const e3 = entry(e2.entryHash, { entryKind: "obligation", evidenceText: "stale alpha", dischargeEvidence: "proof2", contractClauseRef: staleRef });
  writeFileSync(path.join(root, "led-valid.jsonl"), [e1.json, e2.json, e3.json].join("\n") + "\n");

  // chain break: valid concern, then an entry with a wrong prev_hash + a suffix
  const b1 = entry("", { entryKind: "concern", evidenceText: "alpha before break" });
  const bBad = entry("deadbeef".repeat(8), { entryKind: "concern", evidenceText: "alpha after break" }); // wrong prev
  writeFileSync(path.join(root, "led-break.jsonl"), [b1.json, bBad.json].join("\n") + "\n");

  // run summary
  mkdirSync(path.join(root, "docs", "runs", "demo"), { recursive: true });
  writeFileSync(path.join(root, "docs", "runs", "demo", "summary.json"), JSON.stringify({ objective: "verifies alpha end to end" }));

  const symbols = [{ path: "clotho/x.mjs", symbol: "alpha", blob_sha: A }];
  const contractFiles = [{ path: "contracts/C.md", blob_sha: "22".repeat(20) }, { path: "contracts/Dup.md", blob_sha: "23".repeat(20) }];
  const ledgerSources = [
    { path: "led-valid.jsonl", adapter: "clotho-obligation-ledger-v1", blob_sha: "31".repeat(20) },
    { path: "led-break.jsonl", adapter: "clotho-obligation-ledger-v1", blob_sha: "32".repeat(20) },
    { path: "led-unknown.jsonl", adapter: "no-such-adapter", blob_sha: "33".repeat(20) }
  ];
  const runSources = [{ id: "demo", dir: "docs/runs/demo", summary: "docs/runs/demo/summary.json", blob_sha: "41".repeat(20) }];
  const mkCtx = (extra = {}) => ({
    repoRoot: root, repositoryRef: REPO, symbols,
    sources: {
      "contract-files": makeCountedSource("contract-files", contractFiles).source,
      "ledger-sources": makeCountedSource("ledger-sources", ledgerSources).source,
      "run-sources": makeCountedSource("run-sources", runSources).source
    }, ...extra
  });

  const { edges, warnings } = weave(mkCtx());
  const of = (kind) => edges.filter((e) => e.edge_kind === kind);

  // concern -> motivated-by (from led-valid e1 + led-break b1)
  const motiv = of("motivated-by");
  assert.ok(motiv.length >= 2, "concern entries emit code-symbol -> concern motivated-by");
  assert.ok(motiv.every((e) => e.from_locator.locator.symbol === "alpha" && e.to_locator.kind === "concern"));
  assert.ok(motiv.some((e) => e.source_ref === `ledger:led-valid.jsonl#${e1.entryHash}`), "concern source_ref is a ledger ref");

  // discharges matrix: code-symbol -> obligation AND obligation -> contract-clause (from e2)
  const disch = of("discharges");
  const cs2ob = disch.filter((e) => e.from_locator.kind === "code-symbol" && e.to_locator.kind === "obligation");
  const ob2clause = disch.filter((e) => e.from_locator.kind === "obligation" && e.to_locator.kind === "contract-clause");
  assert.ok(cs2ob.length >= 1, "obligation with discharge evidence emits code-symbol -> obligation");
  assert.equal(ob2clause.length, 1, "exactly one obligation -> contract-clause from the exact valid clause ref");
  assert.deepEqual(ob2clause[0].to_locator.locator.heading_path, ["Clause One"]);
  assert.equal(ob2clause[0].to_locator.locator.text_sha256, clause.text_sha256);

  // stale clause ref (e3): code-symbol -> obligation present, but NO clause edge for it; warned
  const e3clause = ob2clause.filter((e) => e.from_locator.locator.entry_hash === e3.entryHash);
  assert.equal(e3clause.length, 0, "stale clause ref emits no obligation -> contract-clause edge");
  assert.ok(warnings.some((w) => w.code === "unresolved-contract-clause" && w.path === "led-valid.jsonl"), "stale clause ref emits a typed nonfatal warning");

  // chain break: only b1 trusted (motivated-by exists), bBad + suffix untrusted
  assert.ok(motiv.some((e) => e.source_ref === `ledger:led-break.jsonl#${b1.entryHash}`), "pre-break entry trusted");
  assert.ok(!edges.some((e) => e.source_ref === `ledger:led-break.jsonl#${bBad.entryHash}`), "post-break suffix produces no edges");
  assert.ok(warnings.some((w) => w.code === "chain-failure" && w.path === "led-break.jsonl" && /line 2/.test(w.detail)), "chain break emits a typed fatal warning at the failed line");

  // unknown adapter: no generic fallback, warned
  assert.ok(warnings.some((w) => w.code === "unsupported-ledger-format" && w.path === "led-unknown.jsonl"), "unknown adapter emits a typed fatal warning, no generic fallback");

  // duplicate contract headings are the same canonical fatal code as doc headings
  const duplicateWarnings = warnings.filter((w) => w.code === "duplicate-heading-path" && w.path === "contracts/Dup.md");
  assert.equal(duplicateWarnings.length, 1, "duplicate contract address emits one canonical typed fatal warning");

  // --- regression (gauntlet: adapter-dispatch closed-object integrity) ---
  // An adapter id equal to an inherited Object.prototype member name must be
  // UNKNOWN (own-property lookup), warn, and dispatch nothing — never resolve the
  // prototype function as an "adapter" (silent 0-edge) or crash the weave.
  for (const protoId of ["toString", "constructor", "__proto__", "valueOf", "hasOwnProperty"]) {
    const src = [{ path: "led-proto.jsonl", adapter: protoId, blob_sha: "39".repeat(20) }];
    let w;
    assert.doesNotThrow(() => { w = weave(mkCtx({ sources: { "contract-files": makeCountedSource("contract-files", contractFiles).source, "ledger-sources": makeCountedSource("ledger-sources", src).source, "run-sources": makeCountedSource("run-sources", runSources).source } })); }, `prototype-name adapter '${protoId}' must not crash the weave`);
    assert.ok(w.warnings.some((x) => x.code === "unsupported-ledger-format" && x.path === "led-proto.jsonl" && x.detail.includes(protoId)), `prototype-name adapter '${protoId}' warns as unknown`);
    assert.ok(!w.edges.some((e) => /led-proto\.jsonl/.test(e.source_ref || "")), `prototype-name adapter '${protoId}' dispatches nothing`);
  }

  // --- regression (gauntlet: D31 partial/malformed clause ref must warn, not be silent) ---
  const partialRefs = [
    { path: "contracts/C.md", heading_path: clause.heading_path },                                  // missing text_sha256
    { path: "contracts/C.md", text_sha256: clause.text_sha256 },                                    // missing heading_path
    { path: "contracts/C.md", heading_path: "Clause One", text_sha256: clause.text_sha256 }         // heading_path not an array
  ];
  partialRefs.forEach((pref, i) => {
    const po = entry("", { entryKind: "obligation", evidenceText: "discharge alpha", dischargeEvidence: "proof", contractClauseRef: pref });
    writeFileSync(path.join(root, `led-partial-${i}.jsonl`), po.json + "\n");
    const src = [{ path: `led-partial-${i}.jsonl`, adapter: "clotho-obligation-ledger-v1", blob_sha: "3a".repeat(20) }];
    const w = weave(mkCtx({ sources: { "contract-files": makeCountedSource("contract-files", contractFiles).source, "ledger-sources": makeCountedSource("ledger-sources", src).source, "run-sources": makeCountedSource("run-sources", runSources).source } }));
    assert.ok(!w.edges.some((e) => e.edge_kind === "discharges" && e.to_locator.kind === "contract-clause"), `partial clause ref #${i} emits no contract-clause edge`);
    assert.ok(w.warnings.some((x) => x.code === "invalid-contract-clause-ref" && x.path === `led-partial-${i}.jsonl`), `partial clause ref #${i} emits a typed warning (not silent)`);
    assert.ok(!w.warnings.some((x) => x.code === "invalid-ledger-entry"), `partial plain-object clause ref #${i} remains a nonfatal resolution warning`);
  });
  // A null clause ref is missing and therefore warns, matching D31's
  // stale/partial/missing/nonunique fail-closed matrix.
  const noRefOb = entry("", { entryKind: "obligation", evidenceText: "discharge alpha", dischargeEvidence: "proof", contractClauseRef: null });
  writeFileSync(path.join(root, "led-noref.jsonl"), noRefOb.json + "\n");
  const wNoRef = weave(mkCtx({ sources: { "contract-files": makeCountedSource("contract-files", contractFiles).source, "ledger-sources": makeCountedSource("ledger-sources", [{ path: "led-noref.jsonl", adapter: "clotho-obligation-ledger-v1", blob_sha: "3b".repeat(20) }]).source, "run-sources": makeCountedSource("run-sources", runSources).source } }));
  assert.ok(wNoRef.warnings.some((x) => x.code === "missing-contract-clause-ref" && x.path === "led-noref.jsonl"), "a null clause ref emits a typed missing-reference warning");

  // The adapter normalizes an omitted optional field to null for hashing and
  // weaving, so omission must take the same warning path.
  const omittedContent = {
    entryKind: "obligation",
    evidenceText: "discharge alpha",
    dischargeEvidence: "proof",
    contractClauseRef: null
  };
  const omittedHash = eh(omittedContent);
  writeFileSync(path.join(root, "led-omitted-ref.jsonl"), JSON.stringify({
    entryKind: omittedContent.entryKind,
    entryHash: omittedHash,
    evidenceText: omittedContent.evidenceText,
    dischargeEvidence: omittedContent.dischargeEvidence,
    prev_hash: ""
  }) + "\n");
  const wOmittedRef = weave(mkCtx({ sources: { "contract-files": makeCountedSource("contract-files", contractFiles).source, "ledger-sources": makeCountedSource("ledger-sources", [{ path: "led-omitted-ref.jsonl", adapter: "clotho-obligation-ledger-v1", blob_sha: "3c".repeat(20) }]).source, "run-sources": makeCountedSource("run-sources", runSources).source } }));
  assert.ok(wOmittedRef.warnings.some((x) => x.code === "missing-contract-clause-ref" && x.path === "led-omitted-ref.jsonl"), "an omitted clause ref emits the same typed missing-reference warning");

  // Structural ledger failures must never disappear into an adapter `break`.
  // The real adapter returns trusted prior entries plus exactly one typed fatal
  // warning identifying the first failed line; the suffix remains untrusted.
  const structuralCases = [
    {
      label: "malformed JSON",
      path: "led-malformed-json.jsonl",
      bytes: "{not-json}\n",
      code: "invalid-ledger-entry"
    },
    {
      label: "malformed schema",
      path: "led-malformed-schema.jsonl",
      bytes: JSON.stringify({ entryKind: "concern", evidenceText: "alpha", prev_hash: "" }) + "\n",
      code: "invalid-ledger-entry"
    },
    {
      label: "unknown entry kind",
      path: "led-unknown-entry-kind.jsonl",
      bytes: entry("", { entryKind: "decision", evidenceText: "alpha" }).json + "\n",
      code: "invalid-ledger-entry"
    },
    {
      label: "non-string discharge evidence",
      path: "led-bad-discharge-type.jsonl",
      bytes: entry("", { entryKind: "obligation", evidenceText: "alpha", dischargeEvidence: 7 }).json + "\n",
      code: "invalid-ledger-entry"
    },
    {
      label: "scalar contract clause ref",
      path: "led-scalar-clause-ref.jsonl",
      bytes: entry("", { entryKind: "obligation", evidenceText: "alpha", contractClauseRef: "contracts/C.md" }).json + "\n",
      code: "invalid-ledger-entry"
    },
    {
      label: "array contract clause ref",
      path: "led-array-clause-ref.jsonl",
      bytes: entry("", { entryKind: "obligation", evidenceText: "alpha", contractClauseRef: [] }).json + "\n",
      code: "invalid-ledger-entry"
    },
    {
      label: "content hash mismatch",
      path: "led-bad-hash.jsonl",
      bytes: JSON.stringify({
        entryKind: "concern",
        entryHash: "0".repeat(64),
        evidenceText: "alpha",
        dischargeEvidence: null,
        contractClauseRef: null,
        prev_hash: ""
      }) + "\n",
      code: "invalid-content-address"
    }
  ];
  for (const tc of structuralCases) {
    writeFileSync(path.join(root, tc.path), tc.bytes);
    const source = [{ path: tc.path, adapter: "clotho-obligation-ledger-v1", blob_sha: "3c".repeat(20) }];
    const w = weave(mkCtx({ sources: {
      "contract-files": makeCountedSource("contract-files", contractFiles).source,
      "ledger-sources": makeCountedSource("ledger-sources", source).source,
      "run-sources": makeCountedSource("run-sources", []).source
    } }));
    assert.equal(w.edges.length, 0, `${tc.label}: failed first entry emits no edge`);
    const fatal = w.warnings.filter((x) => x.code === tc.code && x.path === tc.path);
    assert.equal(fatal.length, 1, `${tc.label}: emits exactly one typed ${tc.code} warning`);
    assert.deepEqual(Object.keys(fatal[0]).sort(), ["code", "detail", "path", "weaver"], `${tc.label}: warning obeys the typed warning contract`);
    assert.equal(fatal[0].weaver, "clotho-ledger-weaver");
    assert.match(fatal[0].detail, /line 1/, `${tc.label}: detail identifies the failed line`);
  }

  // run summary -> evidenced-by
  const ev = of("evidenced-by");
  assert.equal(ev.length, 1, "run summary naming the symbol emits code-symbol -> run-evidence evidenced-by");
  assert.equal(ev[0].to_locator.kind, "run-evidence");
  assert.equal(ev[0].to_locator.locator.path, "docs/runs/demo");

  // D31: contract-files consumed + exhausted (even though only C.md produced a clause edge)
  const cc = makeCountedSource("contract-files", contractFiles);
  weave(mkCtx({ sources: { "contract-files": cc.source, "ledger-sources": makeCountedSource("ledger-sources", ledgerSources).source, "run-sources": makeCountedSource("run-sources", runSources).source } }));
  assert.equal(cc.accounting().observed_count, contractFiles.length, "D31: every contract file consumed");
  assert.equal(cc.accounting().exhausted, true, "D31: contract-files iterator exhausted");

  // deterministic
  assert.equal(canonicalJson(weave(mkCtx())), canonicalJson(weave(mkCtx())), "byte-equal over two runs");

  console.log("test-weaver-ledger: all assertions passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
