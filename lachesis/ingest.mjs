// ingest.mjs — Lachesis's fail-closed reader for a committed Clotho thread-ledger
// weave SNAPSHOT, consumed as DATA. Lachesis NEVER imports clotho/; the record format
// below is a documented data contract, not Clotho code.
//
// Reality (docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl): canonical-JSON lines =
// one { clotho_weave_header } line + N signed EDGE records + one { clotho_weave_trailer }.
// Nodes are IMPLIED by from_locator/to_locator (no standalone node records); node ids are bare
// 64-hex; edge kind is `edge_kind`.
//
// NON-CLAIMS (cycle 1 — GPT-seat ruling A, delegated by The Eye 2026-07-18):
//  * Does NOT claim from_node == deriveNodeId(from_locator) (no content-address re-derivation);
//    it establishes only intra-snapshot locator<->id BIJECTIVE consistency.
//  * The digest check is integrity RELATIVE TO the supplied manifest only — NOT a durable trust
//    root. Does NOT claim CURRENT-AUTHORITY anchoring, authority continuity, publisher identity,
//    or authorization of the snapshot.
//  * Does NOT verify the Clotho record-hash chain, Ed25519 signatures, header pub_key, or trailer
//    cryptography — those fields are checked for PRESENCE only.
//  * These checks are NOT equivalent to Clotho validation or deriveNodeId validation.

import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";

// Closed Clotho sets — FROZEN mirror of clotho/registry.mjs@ed0e05c034317331e874ac511c4182580c192620
// (Lachesis cannot import the spine). change_rule: re-sync if Clotho's sets change.
export const NODE_KINDS = Object.freeze(["contract-clause", "code-symbol", "repository-file", "test", "commit", "concern", "obligation", "check-contract", "run-evidence", "doc-section", "decision"]);
export const EDGE_KINDS = Object.freeze(["depends-on", "introduced-by", "motivated-by", "verified-by", "documented-in", "evidenced-by", "discharges", "supersedes"]);
const NODE_KIND_SET = new Set(NODE_KINDS);
const EDGE_KIND_SET = new Set(EDGE_KINDS);

// Closed source_ref schemes (SCHEMA.md): sha256: | file:@ | ledger:# | git:
const SOURCE_REF_SCHEMES = [
  /^sha256:[0-9a-f]{64}$/,
  /^file:[^\0]+@[0-9a-f]{40}$/,
  /^ledger:[^\0]+#[0-9a-f]{64}$/,
  /^git:[0-9a-f]{40}$/
];
const HEX64 = /^[0-9a-f]{64}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

const rawDigest = (buf) => "sha256:" + createHash("sha256").update(buf).digest("hex");
const validScheme = (ref) => typeof ref === "string" && SOURCE_REF_SCHEMES.some((re) => re.test(ref));
const hasSignedFields = (r) => HEX64.test(r.prev_hash || "") && HEX64.test(r.record_hash || "") && typeof r.signature === "string" && r.signature.length > 0;

// Canonical bucket key for a locator: object member order IGNORED (keys sorted), array order kept
// (matches isDeepStrictEqual semantics). Internal index only — NOT a content-address claim.
function canonKey(v) {
  if (Array.isArray(v)) return "[" + v.map(canonKey).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonKey(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

// Load + validate a weave snapshot. The authorized path comes FROM the manifest, resolved+contained
// under rootDir (not a caller file arg). Fail-closed: every anomaly throws the whole load.
export function loadWeave(manifest, rootDir) {
  if (!manifest || typeof manifest.snapshot_path !== "string") throw new Error("loadWeave: manifest.snapshot_path required");
  if (!DIGEST.test(manifest.snapshot_digest || "")) throw new Error("loadWeave: snapshot_digest must be sha256:<64hex>");
  if (typeof rootDir !== "string") throw new Error("loadWeave: rootDir required");
  if (path.isAbsolute(manifest.snapshot_path)) throw new Error("loadWeave: snapshot_path must be relative");
  const realRoot = realpathSync(rootDir);
  const snapshotPath = realpathSync(path.resolve(realRoot, manifest.snapshot_path));
  if (snapshotPath !== realRoot && !snapshotPath.startsWith(realRoot + path.sep)) {
    throw new Error(`loadWeave: snapshot_path escapes rootDir: ${manifest.snapshot_path}`);
  }
  const buf = readFileSync(snapshotPath);
  if (rawDigest(buf) !== manifest.snapshot_digest) throw new Error(`snapshot digest mismatch (pinned ${manifest.snapshot_digest})`);

  const lines = buf.toString("utf8").split("\n").filter((l) => l.length > 0);
  let header = null, trailer = null;
  const nodes = new Map();          // id -> locator value
  const locatorToId = new Map();    // canonKey(locator) -> id (bijection, reverse direction)
  const edges = [];                 // { edge_kind, from, to }
  const seenEdge = new Set();

  for (let i = 0; i < lines.length; i++) {
    let r;
    try { r = JSON.parse(lines[i]); } catch { throw new Error(`line ${i + 1}: unparseable JSON`); }
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error(`line ${i + 1}: record must be a JSON object`);
    // structure: header FIRST and only (lone key), trailer LAST and only, edges strictly between
    if (i === 0) {
      if (!r.clotho_weave_header || Object.keys(r).length !== 1) throw new Error("line 1: first record must be a lone clotho_weave_header");
      header = r.clotho_weave_header;
      if (!header || typeof header.pub_key !== "string") throw new Error("line 1: header missing pub_key");
      if (header.weave_version !== 1) throw new Error(`line 1: unsupported weave_version ${JSON.stringify(header.weave_version)}`);
      continue;
    }
    if (r.clotho_weave_header) throw new Error(`line ${i + 1}: misplaced/duplicate header`);
    if (r.clotho_weave_trailer !== undefined) {
      if (i !== lines.length - 1) throw new Error(`line ${i + 1}: trailer must be the last record`);
      if (!hasSignedFields(r)) throw new Error(`line ${i + 1}: trailer missing signed-ledger fields`);
      trailer = r;
      continue;
    }

    // edge record
    const ek = r.edge_kind;
    if (!EDGE_KIND_SET.has(ek)) throw new Error(`line ${i + 1}: unknown edge_kind ${JSON.stringify(ek)}`);
    if (!hasSignedFields(r)) throw new Error(`line ${i + 1}: edge missing signed-ledger fields (prev_hash/record_hash/signature)`);
    if (r.from_node === r.to_node) throw new Error(`line ${i + 1}: self-edge (from_node === to_node) rejected`);
    for (const [n, loc] of [[r.from_node, r.from_locator], [r.to_node, r.to_locator]]) {
      if (!HEX64.test(n)) throw new Error(`line ${i + 1}: node id not bare 64-hex`);
      if (!loc || typeof loc !== "object" || !NODE_KIND_SET.has(loc.kind)) throw new Error(`line ${i + 1}: bad/unknown node locator kind`);
      // bijection — forward: one id must always carry a structurally-equal locator
      if (nodes.has(n)) {
        if (!isDeepStrictEqual(nodes.get(n), loc)) throw new Error(`line ${i + 1}: same node id ${n.slice(0, 8)} with structurally-unequal locators`);
      } else {
        nodes.set(n, loc);
      }
      // bijection — reverse: one locator must map to exactly one id
      const k = canonKey(loc);
      if (locatorToId.has(k)) {
        if (locatorToId.get(k) !== n) throw new Error(`line ${i + 1}: one locator maps to two node ids (${locatorToId.get(k).slice(0, 8)} vs ${n.slice(0, 8)})`);
      } else {
        locatorToId.set(k, n);
      }
    }
    if (r.source_ref !== undefined && !validScheme(r.source_ref)) throw new Error(`line ${i + 1}: disallowed source_ref scheme`);
    const key = `${ek}|${r.from_node}|${r.to_node}`;      // edge identity = (kind, from, to)
    if (seenEdge.has(key)) throw new Error(`line ${i + 1}: duplicate edge (${key})`);
    seenEdge.add(key);
    edges.push({ edge_kind: ek, from: r.from_node, to: r.to_node });
  }

  if (!header) throw new Error("missing clotho_weave_header");
  if (!trailer) throw new Error("missing clotho_weave_trailer");
  return { header, nodes, edges };
}
