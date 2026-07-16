#!/usr/bin/env node
// test-ledger.mjs — Task 3. Signed thread-ledger lifecycle and verification
// against injected fixture coverage (D19): header/append/status/close/abort,
// chain + Ed25519 signatures, verifyLedger success + tamper/truncation, the D24
// inspected_source_counts schema, skipped-weaver-with-edges rejection, descriptor
// discipline, and readEdges. Plain node:assert/strict; fresh Node process.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLedger, verifyLedger, readEdges } from "../thread-ledger.mjs";
import { deriveNodeId } from "../registry.mjs";

const HEX40A = "0123456789abcdef0123456789abcdef01234567";
const REPO_HEAD = "fedcba9876543210fedcba9876543210fedcba98";
const REPO = "git-root:" + HEX40A;
const SR = "git:" + HEX40A;

const csLoc = { kind: "code-symbol", locator: { repository_ref: REPO, path: "clotho/registry.mjs", symbol: "deriveNodeId", blob_sha: HEX40A } };
const commitLoc = { kind: "commit", locator: { sha: REPO_HEAD } };

function anEdge() {
  return {
    edge_kind: "introduced-by",
    from_node: deriveNodeId(csLoc),
    to_node: deriveNodeId(commitLoc),
    from_locator: csLoc,
    to_locator: commitLoc,
    source_ref: SR,
    asserted_by: "clotho-git-weaver",
    assertion_status: "deterministic-extraction"
  };
}

function coverage({ gitState = "executed" } = {}) {
  const w = (id, state, invId) => ({
    id, version: 1, implementation_refs: ["file:clotho/weavers/x.mjs@" + HEX40A],
    state, inspected_source_counts: [{ inventory_id: invId, count: state === "executed" ? 2 : 0 }]
  });
  return {
    weavers: [
      w("clotho-git-weaver", gitState, "git-sources"),
      w("clotho-code-weaver", "skipped", "code-sources"),
      w("clotho-test-weaver", "skipped", "test-sources"),
      w("clotho-doc-weaver", "skipped", "doc-sources"),
      w("clotho-ledger-weaver", "skipped", "contract-files")
    ],
    orchestrator_refs: ["file:clotho/weave.mjs@" + HEX40A],
    inventories_consumed: [{ id: "git-sources", source_ref: "file:clotho/inventory.mjs@" + HEX40A }]
  };
}

const work = mkdtempSync(path.join(tmpdir(), "clotho-ledger-"));
let n = 0;
const newPath = () => path.join(work, `l${n++}.jsonl`);
const opts = { wovenAt: "2026-07-16T00:00:00.000Z", repoHead: REPO_HEAD, repositoryRef: REPO };

try {
  // ---- 1. happy path: header + edge + status + close, then verify ok --------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    assert.equal(l.header.clotho_weave_header.repository_ref, REPO);
    assert.equal(l.header.clotho_weave_header.weave_version, 1);
    const e = l.appendEdge(anEdge());
    assert.match(e.record_hash, /^[0-9a-f]{64}$/);
    assert.ok(typeof e.signature === "string" && e.signature.length > 0);
    l.appendStatus({ status_of: e.record_hash, new_status: "human-authorized", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR });
    l.close(coverage());
    const v = await verifyLedger(p);
    assert.equal(v.ok, true, "verify ok: " + JSON.stringify(v.errors));
    assert.ok(v.header && v.manifest);
    assert.equal(v.manifest.weavers.length, 5);
  }

  // ---- 2. tamper: flip a byte in a signed line -> verify fails --------------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    l.close(coverage());
    let raw = readFileSync(p, "utf8");
    raw = raw.replace(e.source_ref, "git:" + "f".repeat(40)); // change a signed payload byte on disk
    writeFileSync(p, raw);
    const v = await verifyLedger(p);
    assert.equal(v.ok, false, "tamper must fail verify");
    assert.ok(v.errors.some((x) => /record_hash mismatch|invalid signature|not canonical/.test(x)));
  }

  // ---- 3. truncation: drop the trailer -> verify fails ----------------------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    l.appendEdge(anEdge());
    l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    writeFileSync(p, lines.slice(0, -1).join("\n") + "\n"); // remove trailer
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /no final trailer/.test(x)));
  }

  // ---- 4. appendStatus rejections ------------------------------------------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    assert.throws(() => l.appendStatus({ status_of: e.record_hash, new_status: "human-authorized", asserted_by: "model:x", assertion_status: "human-authorized", source_ref: SR }), /asserted by 'human'/);
    // that poisoned the ledger (append failure); a fresh ledger for more cases
  }
  {
    const p = newPath();
    const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    assert.throws(() => l.appendStatus({ status_of: "f".repeat(64), new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR }), /reference an earlier edge/);
  }
  {
    const p = newPath();
    const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    assert.throws(() => l.appendStatus({ status_of: e.record_hash, new_status: "approved", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR }), /new_status/);
  }

  // ---- 5. close coverage / D24 validation ----------------------------------
  {
    // exactly five weavers
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); c.weavers = c.weavers.slice(0, 4);
    assert.throws(() => l.close(c), /exactly five/);
  }
  {
    // nonzero count on a skipped weaver
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); c.weavers[1].inspected_source_counts = [{ inventory_id: "code-sources", count: 3 }];
    assert.throws(() => l.close(c), /skipped weaver must carry zero counts/);
  }
  {
    // unsorted / duplicate counts
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); c.weavers[0].inspected_source_counts = [{ inventory_id: "z", count: 1 }, { inventory_id: "a", count: 1 }];
    assert.throws(() => l.close(c), /sorted and unique/);
  }
  {
    // 'failed' state rejected (never in published manifest)
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); c.weavers[0].state = "failed";
    assert.throws(() => l.close(c), /executed\|skipped/);
  }
  {
    // a weaver that produced edges cannot be recorded skipped
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    assert.throws(() => l.close(coverage({ gitState: "skipped" })), /produced edges/);
  }
  {
    // implementation_refs must be file: content addresses
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); c.weavers[0].implementation_refs = ["git:" + HEX40A];
    assert.throws(() => l.close(c), /file:<path>@/);
  }

  // ---- 6. lifecycle: exclusive creation, abort, append-after-close ----------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    l.appendEdge(anEdge());
    l.close(coverage());
    assert.throws(() => l.appendEdge(anEdge()), /closed/);
    assert.doesNotThrow(() => l.abort(), "abort() after close is a no-op");
    // exclusive creation refuses an existing path
    assert.throws(() => createLedger(p, opts), /refusing to overwrite/);
  }
  {
    const p = newPath();
    const l = createLedger(p, opts);
    l.abort();
    assert.throws(() => l.appendEdge(anEdge()), /poisoned|aborted/);
    l.abort(); // idempotent
  }

  // ---- 7. readEdges yields only edges --------------------------------------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    l.appendStatus({ status_of: e.record_hash, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR });
    l.close(coverage());
    const edges = [];
    for await (const ed of readEdges(p)) edges.push(ed);
    assert.equal(edges.length, 1, "one edge (header/status/trailer excluded)");
    assert.equal(edges[0].edge_kind, "introduced-by");
  }

  // ---- 8. CRLF and missing final LF are verification errors -----------------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    l.appendEdge(anEdge());
    l.close(coverage());
    const good = readFileSync(p, "utf8");
    writeFileSync(p, good.replace(/\n/g, "\r\n"));
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /CRLF/.test(x)));
  }

  console.log("test-ledger: all assertions passed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
