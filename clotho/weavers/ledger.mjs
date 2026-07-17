// weavers/ledger.mjs — Clotho's ledger weaver (plan v15 Task 4b). Zero deps: Node
// stdlib only; imports clotho/registry.mjs and clotho/weavers/util.mjs (its
// accepted relative module-load closure is {registry.mjs, ledger.mjs, util.mjs}).
//
// Consumes its `contract-files`, `ledger-sources`, and `run-sources` counted
// sources (D31). It builds its OWN current-contract clause-resolution index solely
// from `contract-files` — it never receives the doc-weaver's map and performs no
// uncounted fallback reads, and it exhausts the `contract-files` iterator WHENEVER
// it executes (even if the doc-weaver is skipped, no clause edge is produced, or
// every reference is stale). Each configured ledger path is dispatched through its
// EXACT adapter id from a CLOSED adapter object — there is no generic JSON
// fallback. Emits `code-symbol -> concern` `motivated-by`, `code-symbol ->
// obligation` `discharges`, `obligation -> contract-clause` `discharges` (only on
// an exact three-field reference resolving uniquely in its own index), and
// `code-symbol -> run-evidence` `evidenced-by`. Deterministic; counted-source only.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

import { deriveNodeId, validateEdgeInput, canonicalJson } from "../registry.mjs";
import { splitMarkdownSections, escapeRegExp } from "./util.mjs";

const WEAVER_ID = "clotho-ledger-weaver";
const HEX64 = /^[0-9a-f]{64}$/;
const RUN_PREFIX = "docs/runs/";
const sha256hex = (buf) => createHash("sha256").update(buf).digest("hex");
const symbolToken = (text, sym) => new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(sym)}(?![A-Za-z0-9_$])`).test(text);

// ---- closed adapter object (no generic JSON fallback) ------------------------
// The clotho-obligation-ledger-v1 adapter reads canonical-JSONL: each line is
// {entryKind, entryHash, evidenceText, dischargeEvidence?, contractClauseRef?,
// prev_hash}. entryHash = sha256(canonicalJson of the content fields); prev_hash
// chains to the prior valid entry's entryHash ("" for the first). Missing required
// integrity fields are INVALID (not legacy). After a parse/hash/chain failure the
// valid prior entries remain usable and the failed line + suffix produce no edges.
function obligationLedgerV1(bytes) {
  const text = bytes.toString("utf8");
  const lines = text.length === 0 ? [] : (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
  const entries = [];
  let prev = "";
  for (const line of lines) {
    let obj = null;
    try { obj = JSON.parse(line); } catch { break; } // malformed line -> stop; suffix untrusted
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) break;
    const { entryKind, entryHash, evidenceText, dischargeEvidence = null, contractClauseRef = null, prev_hash } = obj;
    if (typeof entryKind !== "string" || typeof entryHash !== "string" || !HEX64.test(entryHash)) break; // missing integrity -> invalid
    if (typeof evidenceText !== "string") break;
    const content = { entryKind, evidenceText, dischargeEvidence, contractClauseRef };
    if (sha256hex(Buffer.from(canonicalJson(content), "utf8")) !== entryHash) break; // hash mismatch
    if (prev_hash !== prev) break; // chain break -> stop trusting; suffix untrusted
    prev = entryHash;
    entries.push({ entryKind, entryHash, evidenceText, dischargeEvidence, contractClauseRef });
  }
  return entries;
}
const ADAPTERS = Object.freeze({ "clotho-obligation-ledger-v1": obligationLedgerV1 });

export function weave(ctx) {
  const { repoRoot, repositoryRef, sources } = ctx;
  const symbols = ctx.symbols || [];
  const edges = [];
  const warnings = [];
  const seen = new Set();

  const emit = (edge_kind, fromLocator, toLocator, sourceRef) => {
    const edge = { edge_kind, from_node: deriveNodeId(fromLocator), to_node: deriveNodeId(toLocator), from_locator: fromLocator, to_locator: toLocator, source_ref: sourceRef, asserted_by: WEAVER_ID, assertion_status: "deterministic-extraction" };
    const key = `${edge.edge_kind}|${edge.from_node}|${edge.to_node}|${sourceRef}`;
    if (seen.has(key)) return;
    seen.add(key);
    validateEdgeInput(edge, { repositoryRef });
    edges.push(edge);
  };

  // ---- D31: build the OWN contract-files index (always consume+exhaust) -------
  const contractIndex = new Map(); // JSON({path,heading_path}) -> {path, heading_path, text_sha256}
  const ambiguous = new Set();
  for (const cf of sources["contract-files"]) {
    const bytes = readFileSync(path.join(repoRoot, ...cf.path.split("/")));
    const { sections, duplicatePaths } = splitMarkdownSections(bytes);
    for (const sec of sections) {
      const addrKey = JSON.stringify({ path: cf.path, heading_path: sec.heading_path });
      if (duplicatePaths.has(JSON.stringify(sec.heading_path)) || contractIndex.has(addrKey)) {
        ambiguous.add(addrKey); contractIndex.delete(addrKey);
        warnings.push({ weaver: WEAVER_ID, message: `duplicate-heading-path ${cf.path} ${JSON.stringify(sec.heading_path)}` });
        continue;
      }
      contractIndex.set(addrKey, { path: cf.path, heading_path: sec.heading_path, text_sha256: sec.text_sha256 });
    }
  }

  // ---- ledger-sources: closed-adapter dispatch, no generic fallback ----------
  for (const ls of sources["ledger-sources"]) {
    // Closed adapter object: an own-property lookup so an id equal to an inherited
    // name (toString/constructor/__proto__/...) is UNKNOWN and fails closed, never
    // resolving a prototype member as an "adapter" (no generic fallback).
    const adapter = Object.prototype.hasOwnProperty.call(ADAPTERS, ls.adapter) ? ADAPTERS[ls.adapter] : undefined;
    if (!adapter) { warnings.push({ weaver: WEAVER_ID, message: `no adapter for id ${JSON.stringify(ls.adapter)} (${ls.path})` }); continue; }
    const bytes = readFileSync(path.join(repoRoot, ...ls.path.split("/")));
    const entries = adapter(bytes);
    for (const e of entries) {
      const ledgerSrc = `ledger:${ls.path}#${e.entryHash}`;
      if (e.entryKind === "concern") {
        for (const sym of symbols) if (symbolToken(e.evidenceText, sym.symbol)) {
          emit("motivated-by", { kind: "code-symbol", locator: { repository_ref: repositoryRef, path: sym.path, symbol: sym.symbol, blob_sha: sym.blob_sha } }, { kind: "concern", locator: { repository_ref: repositoryRef, ledger_path: ls.path, entry_hash: e.entryHash } }, ledgerSrc);
        }
      } else if (e.entryKind === "obligation") {
        const obLoc = { kind: "obligation", locator: { repository_ref: repositoryRef, ledger_path: ls.path, entry_hash: e.entryHash } };
        const hasDischarge = typeof e.dischargeEvidence === "string" && e.dischargeEvidence.length > 0;
        for (const sym of symbols) if (symbolToken(e.evidenceText, sym.symbol)) {
          if (hasDischarge) emit("discharges", { kind: "code-symbol", locator: { repository_ref: repositoryRef, path: sym.path, symbol: sym.symbol, blob_sha: sym.blob_sha } }, obLoc, ledgerSrc);
          else warnings.push({ weaver: WEAVER_ID, message: `obligation names ${sym.symbol} but has no discharge evidence` });
        }
        // obligation -> contract-clause: exact three-field UNIQUE reference in OWN
        // index. A ref that is PRESENT but partial/malformed (missing or mistyped one
        // of {path, heading_path, text_sha256}) is a partial reference and MUST warn
        // with no edge (D31); only a fully-absent ref is silent (the normal
        // "obligation carries no clause ref" case).
        const ref = e.contractClauseRef;
        if (ref !== null && ref !== undefined) {
          const wellFormed = typeof ref === "object" && typeof ref.path === "string" && Array.isArray(ref.heading_path) && typeof ref.text_sha256 === "string";
          if (wellFormed) {
            const addrKey = JSON.stringify({ path: ref.path, heading_path: ref.heading_path });
            const idx = contractIndex.get(addrKey);
            if (idx && !ambiguous.has(addrKey) && idx.text_sha256 === ref.text_sha256) {
              emit("discharges", obLoc, { kind: "contract-clause", locator: { repository_ref: repositoryRef, path: idx.path, heading_path: idx.heading_path, text_sha256: idx.text_sha256 } }, ledgerSrc);
            } else {
              warnings.push({ weaver: WEAVER_ID, message: `stale or nonunique contract-clause ref in ${ls.path}#${e.entryHash}` });
            }
          } else {
            warnings.push({ weaver: WEAVER_ID, message: `partial or malformed contract-clause ref in ${ls.path}#${e.entryHash}` });
          }
        }
      }
    }
  }

  // ---- run-sources: evidenced-by ---------------------------------------------
  for (const rs of sources["run-sources"]) {
    const bytes = readFileSync(path.join(repoRoot, ...rs.summary.split("/")));
    const summary_sha256 = sha256hex(bytes);
    let summary; try { summary = JSON.parse(bytes.toString("utf8")); } catch { warnings.push({ weaver: WEAVER_ID, message: `unparsable run summary ${rs.summary}` }); continue; }
    const fieldsText = declaredSummaryText(summary);
    const runLoc = { kind: "run-evidence", locator: { repository_ref: repositoryRef, path: rs.dir, summary_sha256 } };
    const src = `file:${rs.summary}@${rs.blob_sha}`;
    for (const sym of symbols) if (symbolToken(fieldsText, sym.symbol)) {
      emit("evidenced-by", { kind: "code-symbol", locator: { repository_ref: repositoryRef, path: sym.path, symbol: sym.symbol, blob_sha: sym.blob_sha } }, runLoc, src);
    }
  }

  return { edges, warnings };
}

// Declared summary fields only: the summary's `objective`, `note`, and any
// `symbols`/`evidence` string arrays — never arbitrary nested bytes.
function declaredSummaryText(summary) {
  if (!summary || typeof summary !== "object") return "";
  const parts = [];
  for (const k of ["objective", "note", "summary", "finding"]) if (typeof summary[k] === "string") parts.push(summary[k]);
  for (const k of ["symbols", "evidence"]) if (Array.isArray(summary[k])) for (const v of summary[k]) if (typeof v === "string") parts.push(v);
  return parts.join("\n");
}
