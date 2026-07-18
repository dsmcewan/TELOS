// ingest.mjs — Lachesis's fail-closed reader for a committed Clotho thread-ledger
// weave SNAPSHOT, consumed as DATA. Lachesis NEVER imports clotho/; the record
// format below is a documented data contract, not Clotho code.
//
// Reality (docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl, 2026-07-18):
// a canonical-JSON-lines stream = one { clotho_weave_header } line + N signed EDGE
// records + one { clotho_weave_trailer } line. Nodes are NOT standalone records —
// they are implied by the from_locator/to_locator embedded in edges. Node ids are
// bare 64-hex (Clotho content-addresses), edge kind is `edge_kind`.
//
// Trust root (this cycle): pin the snapshot's raw-byte sha256 in a manifest and
// refuse any file that does not match. The snapshot is ALSO a signed Ed25519
// hash-chain (header pub_key + per-record prev_hash/record_hash/signature); full
// chain-signature verification is a NEXT-ROUND question (reimplement vs. boundary)
// and is NOT claimed here — see NON-CLAIMs.

import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

// Closed Clotho sets — a PINNED MIRROR of clotho/registry.mjs@ed0e05c034317331e874ac511c4182580c192620
// (Lachesis cannot import the spine). change_rule: re-sync if Clotho's sets change.
export const NODE_KINDS = new Set([
  "contract-clause", "code-symbol", "repository-file", "test", "commit",
  "concern", "obligation", "check-contract", "run-evidence", "doc-section", "decision"
]);
export const EDGE_KINDS = new Set([
  "depends-on", "introduced-by", "motivated-by", "verified-by",
  "documented-in", "evidenced-by", "discharges", "supersedes"
]);
// Metrics use only this subset; the loader ACCEPTS every known kind and ignores the rest.
export const METRIC_EDGE_KINDS = new Set(["depends-on", "verified-by", "introduced-by"]);

// Closed source_ref schemes (SCHEMA.md): sha256: | file:@ | ledger:# | git:
const SOURCE_REF_SCHEMES = [
  /^sha256:[0-9a-f]{64}$/,
  /^file:[^\0]+@[0-9a-f]{40}$/,
  /^ledger:[^\0]+#[0-9a-f]{64}$/,
  /^git:[0-9a-f]{40}$/
];
const HEX64 = /^[0-9a-f]{64}$/;

const rawDigest = (buf) => "sha256:" + createHash("sha256").update(buf).digest("hex");

function validScheme(ref) {
  return typeof ref === "string" && SOURCE_REF_SCHEMES.some((re) => re.test(ref));
}

// Load + validate a weave snapshot. The authorized path comes FROM the manifest
// (`manifest.snapshot_path`, resolved under `rootDir`) — NOT a caller argument — so the
// manifest binds a file LOCATION, not merely matching bytes. `manifest` =
// { snapshot_path, snapshot_digest }. Fail-closed: every anomaly throws; nothing partial
// reaches the metrics. Ledger STRUCTURE is enforced: exactly one header FIRST, exactly
// one trailer LAST, edges strictly between.
export function loadWeave(manifest, rootDir) {
  if (!manifest || typeof manifest.snapshot_digest !== "string" || typeof manifest.snapshot_path !== "string") {
    throw new Error("loadWeave: manifest must be { snapshot_path, snapshot_digest }");
  }
  if (typeof rootDir !== "string") throw new Error("loadWeave: rootDir required (the manifest binds the path under it)");
  // path containment: the manifest binds a LOCATION under rootDir. Reject absolute paths,
  // `..` traversal, and symlinks whose realpath escapes the root (realpathSync resolves links).
  const realRoot = realpathSync(rootDir);
  const snapshotPath = realpathSync(path.resolve(realRoot, manifest.snapshot_path));
  if (snapshotPath !== realRoot && !snapshotPath.startsWith(realRoot + path.sep)) {
    throw new Error(`snapshot_path escapes rootDir: ${manifest.snapshot_path}`);
  }
  const buf = readFileSync(snapshotPath);
  const digest = rawDigest(buf);
  if (digest !== manifest.snapshot_digest) {
    throw new Error(`snapshot digest mismatch: ${digest} != pinned ${manifest.snapshot_digest}`);
  }

  const lines = buf.toString("utf8").split("\n").filter((l) => l.length > 0);
  let header = null, trailer = null;
  const nodes = new Map();      // id(hex) -> { kind, payload(JSON string) }
  const edges = [];             // { edge_kind, from, to }
  const seenEdge = new Set();

  for (let i = 0; i < lines.length; i++) {
    let r;
    try { r = JSON.parse(lines[i]); } catch { throw new Error(`line ${i + 1}: unparseable JSON`); }
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error(`line ${i + 1}: record must be a JSON object`);
    // structure: header FIRST and only (single key), trailer LAST and only, edges strictly between
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
      trailer = r;
      continue;
    }

    // edge record — structural signed-ledger fields required (presence, not crypto-verified: NON-CLAIM)
    const ek = r.edge_kind;
    if (!EDGE_KINDS.has(ek)) throw new Error(`line ${i + 1}: unknown edge_kind ${JSON.stringify(ek)}`);
    if (!HEX64.test(r.prev_hash || "") || !HEX64.test(r.record_hash || "") || typeof r.signature !== "string" || r.signature.length === 0) {
      throw new Error(`line ${i + 1}: edge missing signed-ledger fields (prev_hash/record_hash/signature)`);
    }
    for (const [n, loc] of [[r.from_node, r.from_locator], [r.to_node, r.to_locator]]) {
      if (!HEX64.test(n)) throw new Error(`line ${i + 1}: node id not bare 64-hex`);
      if (!loc || !NODE_KINDS.has(loc.kind)) throw new Error(`line ${i + 1}: bad/unknown node locator kind`);
      const payload = JSON.stringify(loc);
      if (nodes.has(n)) {
        const prev = nodes.get(n);
        if (prev.kind !== loc.kind || prev.payload !== payload) {
          throw new Error(`line ${i + 1}: locator conflict for node ${n.slice(0, 8)} (same id, different locator)`);
        }
      } else {
        nodes.set(n, { kind: loc.kind, payload });
      }
    }
    if (r.source_ref !== undefined && !validScheme(r.source_ref)) {
      throw new Error(`line ${i + 1}: disallowed source_ref scheme`);
    }
    const key = `${ek}|${r.from_node}|${r.to_node}`;      // edge identity = (kind, from, to)
    if (seenEdge.has(key)) throw new Error(`line ${i + 1}: duplicate edge (${key})`);
    seenEdge.add(key);
    edges.push({ edge_kind: ek, from: r.from_node, to: r.to_node });
  }

  if (!header) throw new Error("missing clotho_weave_header");
  if (!trailer) throw new Error("missing clotho_weave_trailer");
  // NON-CLAIM: metrics measure over the edges PRESENT. `supersedes`/`discharges` are accepted
  // (complete-set discipline) but NOT interpreted as retiring other edges; retirement-aware
  // measurement is future work. (This pinned snapshot contains 0 supersedes/status records, so
  // all edges are live — but a future weave encoding retirement would need that handling.)
  return { header, nodes, edges };
}
