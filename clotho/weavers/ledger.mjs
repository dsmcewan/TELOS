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
const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;
const warning = (code, warningPath, detail) => ({
  weaver: WEAVER_ID,
  code,
  path: warningPath,
  detail
});

// ---- closed adapter object (no generic JSON fallback) ------------------------
// The clotho-obligation-ledger-v1 adapter reads canonical-JSONL: each line is
// {entryKind, entryHash, evidenceText, dischargeEvidence?, contractClauseRef?,
// prev_hash}. entryHash = sha256(canonicalJson of the content fields); prev_hash
// chains to the prior valid entry's entryHash ("" for the first). Missing required
// integrity fields are INVALID (not legacy). After a parse/hash/chain failure the
// valid prior entries remain usable and the failed line + suffix produce no edges.
// The failure itself is warning data so the driver can enforce D22.
function obligationLedgerV1(bytes, ledgerPath) {
  const text = bytes.toString("utf8");
  const lines = text.length === 0 ? [] : (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
  const entries = [];
  const warnings = [];
  let prev = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    let obj = null;
    try {
      obj = JSON.parse(line);
    } catch {
      warnings.push(warning("invalid-ledger-entry", ledgerPath, `line ${lineNumber}: malformed JSON`));
      break;
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      warnings.push(warning("invalid-ledger-entry", ledgerPath, `line ${lineNumber}: entry must be a JSON object`));
      break;
    }
    const { entryKind, entryHash, evidenceText, dischargeEvidence = null, contractClauseRef = null, prev_hash } = obj;
    if (typeof entryKind !== "string" || typeof entryHash !== "string" ||
        typeof evidenceText !== "string" || typeof prev_hash !== "string") {
      warnings.push(warning("invalid-ledger-entry", ledgerPath, `line ${lineNumber}: entry schema is invalid`));
      break;
    }
    if (entryKind !== "concern" && entryKind !== "obligation") {
      warnings.push(warning("invalid-ledger-entry", ledgerPath, `line ${lineNumber}: unsupported entryKind ${JSON.stringify(entryKind)}`));
      break;
    }
    if (dischargeEvidence !== null && typeof dischargeEvidence !== "string") {
      warnings.push(warning("invalid-ledger-entry", ledgerPath, `line ${lineNumber}: dischargeEvidence must be null or a string`));
      break;
    }
    if (contractClauseRef !== null && !isPlainObject(contractClauseRef)) {
      warnings.push(warning("invalid-ledger-entry", ledgerPath, `line ${lineNumber}: contractClauseRef must be null or a plain object`));
      break;
    }
    if (!HEX64.test(entryHash)) {
      warnings.push(warning("invalid-content-address", ledgerPath, `line ${lineNumber}: entryHash is not lowercase 64-hex`));
      break;
    }
    const content = { entryKind, evidenceText, dischargeEvidence, contractClauseRef };
    if (sha256hex(Buffer.from(canonicalJson(content), "utf8")) !== entryHash) {
      warnings.push(warning("invalid-content-address", ledgerPath, `line ${lineNumber}: entryHash does not match canonical entry content`));
      break;
    }
    if (prev_hash !== prev) {
      warnings.push(warning("chain-failure", ledgerPath, `line ${lineNumber}: prev_hash does not match prior entry hash`));
      break;
    }
    prev = entryHash;
    entries.push({ entryKind, entryHash, evidenceText, dischargeEvidence, contractClauseRef });
  }
  return { entries, warnings };
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
    for (const duplicatePath of [...duplicatePaths].sort()) {
      warnings.push(warning(
        "duplicate-heading-path",
        cf.path,
        `duplicate heading path ${duplicatePath}`
      ));
    }
    for (const sec of sections) {
      const addrKey = JSON.stringify({ path: cf.path, heading_path: sec.heading_path });
      if (duplicatePaths.has(JSON.stringify(sec.heading_path)) || contractIndex.has(addrKey)) {
        ambiguous.add(addrKey); contractIndex.delete(addrKey);
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
    if (!adapter) {
      warnings.push(warning("unsupported-ledger-format", ls.path, `no adapter for id ${JSON.stringify(ls.adapter)}`));
      continue;
    }
    const bytes = readFileSync(path.join(repoRoot, ...ls.path.split("/")));
    const adapted = adapter(bytes, ls.path);
    warnings.push(...adapted.warnings);
    const entries = adapted.entries;
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
          else warnings.push(warning(
            "missing-discharge-evidence",
            ls.path,
            `entry ${e.entryHash} names ${sym.symbol} but has no discharge evidence`
          ));
        }
        // obligation -> contract-clause: exact three-field UNIQUE reference in OWN
        // index. Missing, partial/malformed, stale, and nonunique references all
        // warn with no edge (D31).
        const ref = e.contractClauseRef;
        if (ref === null || ref === undefined) {
          warnings.push(warning(
            "missing-contract-clause-ref",
            ls.path,
            `entry ${e.entryHash} has no contract-clause ref`
          ));
        } else {
          const wellFormed = typeof ref === "object" && typeof ref.path === "string" && Array.isArray(ref.heading_path) && typeof ref.text_sha256 === "string";
          if (wellFormed) {
            const addrKey = JSON.stringify({ path: ref.path, heading_path: ref.heading_path });
            const idx = contractIndex.get(addrKey);
            if (idx && !ambiguous.has(addrKey) && idx.text_sha256 === ref.text_sha256) {
              emit("discharges", obLoc, { kind: "contract-clause", locator: { repository_ref: repositoryRef, path: idx.path, heading_path: idx.heading_path, text_sha256: idx.text_sha256 } }, ledgerSrc);
            } else {
              warnings.push(warning(
                "unresolved-contract-clause",
                ls.path,
                `entry ${e.entryHash} has a stale or nonunique contract-clause ref`
              ));
            }
          } else {
            warnings.push(warning(
              "invalid-contract-clause-ref",
              ls.path,
              `entry ${e.entryHash} has a partial or malformed contract-clause ref`
            ));
          }
        }
      }
    }
  }

  // ---- run-sources: evidenced-by ---------------------------------------------
  for (const rs of sources["run-sources"]) {
    const bytes = readFileSync(path.join(repoRoot, ...rs.summary.split("/")));
    const summary_sha256 = sha256hex(bytes);
    let summary;
    try {
      summary = JSON.parse(bytes.toString("utf8"));
    } catch {
      warnings.push(warning("invalid-run-summary", rs.summary, "run summary is not valid JSON"));
      continue;
    }
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
