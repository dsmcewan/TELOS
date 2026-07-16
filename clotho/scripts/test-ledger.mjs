#!/usr/bin/env node
// test-ledger.mjs — Task 3. Signed thread-ledger lifecycle + verification against
// injected fixture coverage (D19). Covers the frozen unit surface: append/status/
// close/abort, chain + Ed25519 signatures, verifyLedger trust boundary (records
// only-before-first-failure, edge+status only), the D24 counts schema, exact
// weaver-id order, descriptor closure via an injected file handle (D22),
// independently-signed adversarial fixtures, and incremental streaming readEdges.

import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign, createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLedger, verifyLedger, readEdges } from "../thread-ledger.mjs";
import { deriveNodeId, canonicalJson } from "../registry.mjs";

const HEX40A = "0123456789abcdef0123456789abcdef01234567";
const REPO_HEAD = "fedcba9876543210fedcba9876543210fedcba98";
const REPO = "git-root:" + HEX40A;
const SR = "git:" + HEX40A;
const WOVEN = "2026-07-16T00:00:00.000Z";
const opts = { wovenAt: WOVEN, repoHead: REPO_HEAD, repositoryRef: REPO };

const csLoc = { kind: "code-symbol", locator: { repository_ref: REPO, path: "clotho/registry.mjs", symbol: "deriveNodeId", blob_sha: HEX40A } };
const rfLoc = { kind: "repository-file", locator: { repository_ref: REPO, path: "clotho/registry.mjs", blob_sha: HEX40A } };
const commitLoc = { kind: "commit", locator: { sha: REPO_HEAD } };

function anEdge() {
  return { edge_kind: "introduced-by", from_node: deriveNodeId(csLoc), to_node: deriveNodeId(commitLoc), from_locator: csLoc, to_locator: commitLoc, source_ref: SR, asserted_by: "clotho-git-weaver", assertion_status: "deterministic-extraction" };
}
function dependsEdge() {
  return { edge_kind: "depends-on", from_node: deriveNodeId(rfLoc), to_node: deriveNodeId(csLoc), from_locator: rfLoc, to_locator: csLoc, source_ref: SR, asserted_by: "clotho-code-weaver", assertion_status: "deterministic-extraction" };
}
const WEAVER_ORDER = ["clotho-git-weaver", "clotho-code-weaver", "clotho-test-weaver", "clotho-doc-weaver", "clotho-ledger-weaver"];
const REQ = {
  "clotho-git-weaver": ["package-files", "package-symbols"],
  "clotho-code-weaver": ["package-modules"],
  "clotho-test-weaver": ["package-manifests", "test-files"],
  "clotho-doc-weaver": ["doc-files"],
  "clotho-ledger-weaver": ["contract-files", "ledger-sources", "run-sources"]
};
function coverage({ gitState = "executed", codeState = "skipped" } = {}) {
  const stateFor = (id) => id === "clotho-git-weaver" ? gitState : (id === "clotho-code-weaver" ? codeState : "skipped");
  const w = (id) => { const state = stateFor(id); return { id, version: 1, implementation_refs: ["file:clotho/weavers/x.mjs@" + HEX40A], state, inspected_source_counts: REQ[id].map((inv) => ({ inventory_id: inv, count: state === "executed" ? 2 : 0 })) }; };
  return { weavers: WEAVER_ORDER.map(w), orchestrator_refs: ["file:clotho/weave.mjs@" + HEX40A], inventories_consumed: [{ id: "git-sources", source_ref: "file:clotho/inventory.mjs@" + HEX40A }] };
}

// A minimal independent signer to build signed-but-adversarial fixtures.
const hexOf = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
function buildSignedLedger(p, { edges = [], statuses = [], manifest }) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const header = { clotho_weave_header: { pub_key: pub, woven_at: WOVEN, repo_head: REPO_HEAD, repository_ref: REPO, weave_version: 1 } };
  let prevLine = canonicalJson(header);
  const lines = [prevLine];
  const hashes = [];
  const sign = (payload) => {
    const prev_hash = hexOf(prevLine);
    const record_hash = hexOf(canonicalJson({ ...payload, prev_hash }));
    const signature = edSign(null, Buffer.from(record_hash, "hex"), privateKey).toString("base64");
    prevLine = canonicalJson({ ...payload, prev_hash, record_hash, signature });
    lines.push(prevLine);
    return record_hash;
  };
  for (const e of edges) hashes.push(sign({ ...e, woven_at: e.woven_at ?? WOVEN }));
  for (const s of statuses) sign({ ...s, woven_at: WOVEN });
  if (manifest) sign({ clotho_weave_trailer: manifest, woven_at: WOVEN });
  writeFileSync(p, lines.join("\n") + "\n");
  return { hashes };
}

const work = mkdtempSync(path.join(tmpdir(), "clotho-ledger-"));
let n = 0;
const newPath = () => path.join(work, `l${n++}.jsonl`);

try {
  // ---- 1. happy path + injected key: header, edges, status, close, verify ok
  {
    const p = newPath();
    const { privateKey } = generateKeyPairSync("ed25519");
    const l = createLedger(p, { ...opts, signKey: privateKey });
    assert.equal(l.header.clotho_weave_header.weave_version, 1);
    const e = l.appendEdge(anEdge());
    l.appendEdge(dependsEdge());
    l.appendStatus({ status_of: e.record_hash, new_status: "human-authorized", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR });
    l.close(coverage({ codeState: "executed" }));
    const v = await verifyLedger(p);
    assert.equal(v.ok, true, "verify: " + JSON.stringify(v.errors));
    // records = edges + status only (no header, no trailer)
    assert.equal(v.records.length, 3);
    assert.ok(v.header && v.manifest);
    assert.ok(!v.records.some((r) => r.clotho_weave_header || r.clotho_weave_trailer));
  }

  // ---- 2. verify trust boundary: tamper -> ok:false, records truncated ------
  {
    const p = newPath();
    const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge()); l.close(coverage());
    let raw = readFileSync(p, "utf8").replace(e.source_ref, "git:" + "f".repeat(40));
    writeFileSync(p, raw);
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.equal(v.records.length, 0, "no record trusted on/after the failing line");
  }

  // ---- 3. trailer removal / partial final line / middle removal ------------
  for (const mutate of [
    (lines) => lines.slice(0, -1),                        // drop trailer
    (lines) => { const c = [...lines]; c[1] = c[1].slice(0, 10); return c; } // corrupt edge line
  ]) {
    const p = newPath();
    const l = createLedger(p, opts);
    l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    writeFileSync(p, mutate(lines).join("\n") + "\n");
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
  }
  {
    // missing final LF
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const raw = readFileSync(p, "utf8"); writeFileSync(p, raw.slice(0, -1));
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /final LF/.test(x)));
  }
  {
    // empty ledger
    const p = newPath(); writeFileSync(p, "");
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /empty/.test(x)));
  }
  {
    // CRLF
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    writeFileSync(p, readFileSync(p, "utf8").replace(/\n/g, "\r\n"));
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /CRLF/.test(x)));
  }

  // ---- 4. appendStatus: human accept/reject/supersede; reject model/weaver --
  {
    const p = newPath(); const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    for (const st of ["human-authorized", "rejected", "superseded"]) {
      l.appendStatus({ status_of: e.record_hash, new_status: st, asserted_by: "human", assertion_status: "human-authorized", source_ref: SR });
    }
    l.close(coverage());
    assert.equal((await verifyLedger(p)).ok, true);
  }
  for (const bad of [
    { patch: { asserted_by: "model:x" }, re: /'human'/ },
    { patch: { asserted_by: "clotho-git-weaver" }, re: /'human'/ },
    { patch: { new_status: "approved" }, re: /new_status/ },
    { patch: { assertion_status: "deterministic-extraction" }, re: /human-authorized/ }
  ]) {
    const p = newPath(); const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    assert.throws(() => l.appendStatus({ status_of: e.record_hash, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR, ...bad.patch }), bad.re);
  }
  {
    // status_of unknown / references a non-edge
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    assert.throws(() => l.appendStatus({ status_of: "f".repeat(64), new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR }), /reference an earlier edge/);
  }

  // ---- 5. close coverage / D24 rejections ----------------------------------
  const covBad = [
    [(c) => { c.weavers = c.weavers.slice(0, 4); }, /exactly five/],
    [(c) => { c.weavers[1].id = "not-a-weaver"; }, /expected id clotho-code-weaver/],
    [(c) => { const t = c.weavers[0]; c.weavers[0] = c.weavers[1]; c.weavers[1] = t; }, /expected id/],  // wrong order
    [(c) => { c.weavers[0].state = "failed"; }, /executed\|skipped/],
    [(c) => { c.weavers[1].inspected_source_counts = [{ inventory_id: "code-sources", count: 3 }]; }, /zero counts/],
    [(c) => { c.weavers[0].inspected_source_counts = [{ inventory_id: "z", count: 1 }, { inventory_id: "a", count: 1 }]; }, /sorted and unique/],
    [(c) => { c.weavers[0].inspected_source_counts = [{ inventory_id: "a", count: -1 }]; }, /nonnegative/],
    [(c) => { c.weavers[0].implementation_refs = ["git:" + HEX40A]; }, /'file:' content address/],
    [(c) => { c.orchestrator_refs = []; }, /nonempty/],
    [(c) => { c.weavers[0].extra = 1; }, /unexpected field/],
    [(c) => { c.weavers[0].inspected_source_counts = [{ inventory_id: "package-files", count: 1 }]; }, /carry exactly/],       // missing required id
    [(c) => { c.weavers[3].inspected_source_counts = [{ inventory_id: "doc-files", count: 0 }, { inventory_id: "extra", count: 0 }]; }, /carry exactly/], // extra id
    [(c) => { c.orchestrator_refs = ["file:/abs@" + HEX40A]; }, /canonical POSIX/],                    // absolute path
    [(c) => { c.weavers[0].implementation_refs = ["file:../escape.mjs@" + HEX40A]; }, /canonical POSIX/], // traversal
    [(c) => { c.weavers[0].inspected_source_counts[0].count = 1.5; }, /safe integer/],                 // non-integer count
    [(c) => { c.weavers[0].inspected_source_counts[0].count = 2 ** 53; }, /safe integer/],             // unsafe integer count
    [(c) => { c.weavers[0].inspected_source_counts[0].extra = 1; }, /unexpected field/], // extra count field
    [(c) => { c.weavers[0].inspected_source_counts = [{ inventory_id: "package-files", count: 1 }, { inventory_id: "package-files", count: 1 }]; }, /sorted and unique/], // duplicate
    [(c) => { c.weavers[0].implementation_refs = []; }, /nonempty array/],                             // empty implementation_refs
    [(c) => { c.inventories_consumed = [{ id: "x", source_ref: "git:" + HEX40A }]; }, /'file:' content address/] // malformed inventories_consumed ref
  ];
  for (const [mut, re] of covBad) {
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); mut(c);
    assert.throws(() => l.close(c), re);
  }
  {
    // a weaver that asserted an edge cannot be recorded skipped
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    assert.throws(() => l.close(coverage({ gitState: "skipped" })), /asserted an edge/);
  }

  // ---- 5c. header / repository_ref shape + non-final trailer ---------------
  {
    // createLedger validates an injected repositoryRef
    assert.throws(() => createLedger(newPath(), { ...opts, repositoryRef: "not-a-ref" }), /git-root/);
    // type-strict: a non-string repoHead/repositoryRef is rejected (no regex coercion of arrays)
    assert.throws(() => createLedger(newPath(), { ...opts, repoHead: [REPO_HEAD] }), /repo_head/);
    assert.throws(() => createLedger(newPath(), { ...opts, repositoryRef: [REPO] }), /repository_ref/);
  }
  for (const [field, value] of [["repo_head", 123], ["repository_ref", ["x"]], ["woven_at", 5], ["pub_key", 1]]) {
    // verifyLedger rejects a non-string header field rather than coercing it
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    const h0 = JSON.parse(lines[0]).clotho_weave_header; h0[field] = value;
    lines[0] = canonicalJson({ clotho_weave_header: h0 }); writeFileSync(p, lines.join("\n") + "\n");
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => new RegExp(`header|${field}`).test(x)), `non-string ${field} rejected`);
  }
  for (const mutate of [(h) => ({ ...h, extra: 1 }), (h) => ({ ...h, repository_ref: "git-root:xyz" })]) {
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    const h0 = JSON.parse(lines[0]).clotho_weave_header;
    lines[0] = canonicalJson({ clotho_weave_header: mutate(h0) });
    writeFileSync(p, lines.join("\n") + "\n");
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /header/.test(x)), "header shape error reported");
  }
  {
    // a header pub_key that parses but is not canonical base64 is rejected
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    const h0 = JSON.parse(lines[0]).clotho_weave_header;
    h0.pub_key = "\n" + h0.pub_key; // decodes to the same key but is non-canonical
    lines[0] = canonicalJson({ clotho_weave_header: h0 });
    writeFileSync(p, lines.join("\n") + "\n");
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((x) => /pub_key/.test(x)), "non-canonical pub_key rejected");
  }
  {
    // a record after the trailer: not final -> manifest is not trusted
    const p = newPath(); const l = createLedger(p, opts);
    l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n"); // header, edge, trailer
    writeFileSync(p, [...lines, lines[1]].join("\n") + "\n");            // stray record after trailer
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.equal(v.manifest, null, "manifest not trusted when the trailer is not final");
  }

  // ---- 6. lifecycle: exclusive creation, append-after-close, abort ---------
  {
    const p = newPath(); const l = createLedger(p, opts);
    l.appendEdge(anEdge()); l.close(coverage());
    assert.throws(() => l.appendEdge(anEdge()), /closed/);
    assert.doesNotThrow(() => l.abort());
    assert.throws(() => createLedger(p, opts), /refusing to overwrite/);
  }
  {
    const p = newPath(); const l = createLedger(p, opts);
    l.abort();
    assert.throws(() => l.appendEdge(anEdge()), /poisoned|aborted/);
    l.abort();
  }

  // ---- 6b. appendEdge re-derives/checks endpoint ids; close() idempotency --
  {
    // a caller from_node that mismatches the locator-derived id is rejected
    const p = newPath(); const l = createLedger(p, opts);
    assert.throws(() => l.appendEdge({ ...anEdge(), from_node: "0".repeat(64) }), /from_node .* does not match derived/);
  }
  {
    // close() is idempotent after a successful close: same trailer, no re-write
    const p = newPath(); const l = createLedger(p, opts);
    l.appendEdge(anEdge());
    const r1 = l.close(coverage());
    const r2 = l.close(coverage());
    assert.equal(r2.record_hash, r1.record_hash, "second close returns the same trailer record");
    assert.equal((await verifyLedger(p)).ok, true, "no duplicate trailer written");
  }

  // ---- 7. descriptor closure via an INJECTED file handle (D22) -------------
  function spyFile() {
    const calls = { closes: 0 };
    return { calls, openFile: () => ({ write() {}, close() { calls.closes++; } }) };
  }
  {
    // append failure closes the descriptor
    const s = spyFile();
    const l = createLedger(newPath(), { ...opts, openFile: s.openFile });
    assert.throws(() => l.appendStatus({ status_of: "z", new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR }));
    assert.equal(s.calls.closes, 1, "append failure closes fd");
  }
  {
    // close failure closes the descriptor
    const s = spyFile();
    const l = createLedger(newPath(), { ...opts, openFile: s.openFile });
    l.appendEdge(anEdge());
    assert.throws(() => l.close({ bad: true }));
    assert.equal(s.calls.closes, 1, "close failure closes fd");
  }
  {
    // explicit abort closes the descriptor exactly once, idempotently
    const s = spyFile();
    const l = createLedger(newPath(), { ...opts, openFile: s.openFile });
    l.appendEdge(anEdge());
    l.abort(); l.abort();
    assert.equal(s.calls.closes, 1, "abort closes fd once");
  }
  {
    // successful close closes the descriptor
    const s = spyFile();
    const l = createLedger(newPath(), { ...opts, openFile: s.openFile });
    l.appendEdge(anEdge()); l.close(coverage());
    assert.equal(s.calls.closes, 1, "close closes fd");
  }

  // ---- 8. readEdges yields edges+status+trailer (not header) ----------------
  {
    const p = newPath(); const l = createLedger(p, opts);
    const e = l.appendEdge(anEdge());
    l.appendStatus({ status_of: e.record_hash, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR });
    l.close(coverage());
    const out = [];
    for await (const r of readEdges(p)) out.push(r);
    assert.equal(out.length, 3, "edge + status + trailer (header skipped)");
    assert.ok(out.some((r) => r.edge_kind === "introduced-by"));
    assert.ok(out.some((r) => "status_of" in r));
    assert.ok(out.some((r) => r.clotho_weave_trailer));
  }

  // ---- 9. readEdges is incremental: yields before the stream ends ----------
  {
    const p = newPath(); const l = createLedger(p, opts);
    l.appendEdge(anEdge()); l.close(coverage());
    const allLines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n"); // header, edge, trailer
    let release;
    const gate = new Promise((r) => { release = r; });
    async function* gated() {
      yield allLines[0] + "\n"; // header
      yield allLines[1] + "\n"; // first edge
      await gate;               // pause before releasing the rest
      for (let i = 2; i < allLines.length; i++) yield allLines[i] + "\n";
    }
    const it = readEdges(p, { openReadStream: () => gated() });
    // race iterator.next() against a short timeout: the edge must arrive first,
    // proving readEdges yields before the stream ends (the gate is still open).
    const timeout = new Promise((r) => { setTimeout(() => r("TIMEOUT"), 1000); });
    const first = await Promise.race([it.next(), timeout]);
    assert.notEqual(first, "TIMEOUT", "edge yielded before EOF (won the race vs timeout)");
    assert.equal(first.done, false);
    assert.equal(first.value.edge_kind, "introduced-by");
    release();
    const rest = [];
    for (let x = await it.next(); !x.done; x = await it.next()) rest.push(x.value);
    assert.ok(rest.some((r) => r.clotho_weave_trailer), "trailer after release");
  }

  // ---- 10. independently-signed adversarial fixtures fail verification ------
  {
    // a properly-signed manifest with state 'failed'
    const p = newPath();
    buildSignedLedger(p, { edges: [anEdge()], manifest: (() => { const c = coverage(); c.weavers[0].state = "failed"; return c; })() });
    const v = await verifyLedger(p);
    assert.equal(v.ok, false, "signed failed-state manifest fails verify");
  }
  {
    // a signed skipped weaver carrying a nonzero count
    const p = newPath();
    buildSignedLedger(p, { edges: [], manifest: (() => { const c = coverage(); c.weavers[1].inspected_source_counts = [{ inventory_id: "code-sources", count: 5 }]; return c; })() });
    assert.equal((await verifyLedger(p)).ok, false, "signed skipped-but-read manifest fails verify");
  }
  {
    // a signed ledger whose manifest marks a weaver skipped though it asserted an edge
    const p = newPath();
    buildSignedLedger(p, { edges: [anEdge()], manifest: coverage({ gitState: "skipped" }) });
    assert.equal((await verifyLedger(p)).ok, false, "signed skipped-weaver-with-edge fails verify");
  }
  {
    // a signed edge whose woven_at differs from the header fails verification
    const p = newPath();
    buildSignedLedger(p, { edges: [{ ...anEdge(), woven_at: "2020-01-01T00:00:00.000Z" }], manifest: coverage() });
    const v = await verifyLedger(p);
    assert.equal(v.ok, false, "wrong woven_at fails verify");
    assert.ok(v.errors.some((x) => /woven_at/.test(x)));
  }
  {
    // a signed manifest carrying the wrong inventory ids fails verification
    const p = newPath();
    const c = coverage(); c.weavers[0].inspected_source_counts = [{ inventory_id: "nope", count: 2 }, { inventory_id: "zzz", count: 2 }];
    buildSignedLedger(p, { edges: [anEdge()], manifest: c });
    assert.equal((await verifyLedger(p)).ok, false, "wrong inventory ids fail verify");
  }
  {
    // a signed ledger with a valid human supersedes edge verifies ok
    const p = newPath();
    const oldRf = { kind: "repository-file", locator: { repository_ref: REPO, path: "old.mjs", blob_sha: HEX40A } };
    const newRf = { kind: "repository-file", locator: { repository_ref: REPO, path: "new.mjs", blob_sha: "f".repeat(40) } };
    const sup = { edge_kind: "supersedes", from_node: deriveNodeId(oldRf), to_node: deriveNodeId(newRf), from_locator: oldRf, to_locator: newRf, source_ref: SR, asserted_by: "human", assertion_status: "human-authorized" };
    buildSignedLedger(p, { edges: [sup], manifest: coverage() });
    assert.equal((await verifyLedger(p)).ok, true, "human supersedes verifies: " + JSON.stringify((await verifyLedger(p)).errors));
  }

  // ---- 11. more adversarial on-disk tampering + incremental verify ---------
  const build3 = () => { const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage()); return { p, lines: readFileSync(p, "utf8").replace(/\n$/, "").split("\n") }; };
  const expectFail = async (p) => { const v = await verifyLedger(p); assert.equal(v.ok, false); return v; };
  {
    const { p, lines } = build3(); // header, edge, trailer
    writeFileSync(p, [lines[0], lines[0], ...lines.slice(1)].join("\n") + "\n");
    assert.ok((await expectFail(p)).errors.some((x) => /duplicate header/.test(x)));
  }
  {
    const { p, lines } = build3();
    writeFileSync(p, [...lines, lines[2]].join("\n") + "\n"); // duplicate trailer
    assert.equal((await expectFail(p)).manifest, null);
  }
  {
    const { p, lines } = build3();
    writeFileSync(p, [lines[0], lines[2]].join("\n") + "\n"); // middle edge removed -> chain breaks
    await expectFail(p);
  }
  {
    const { p, lines } = build3();
    writeFileSync(p, [lines[0], "null", lines[2]].join("\n") + "\n"); // null record
    assert.ok((await expectFail(p)).errors.some((x) => /JSON object/.test(x)));
  }
  {
    const { p, lines } = build3(); // altered signature on the trailer (last line)
    const t = JSON.parse(lines[2]); t.signature = (t.signature[0] === "A" ? "B" : "A") + t.signature.slice(1);
    lines[2] = canonicalJson(t); writeFileSync(p, lines.join("\n") + "\n");
    assert.ok((await expectFail(p)).errors.some((x) => /signature|record_hash/.test(x)));
  }
  {
    const { p, lines } = build3(); // altered record_hash on the trailer
    const t = JSON.parse(lines[2]); t.record_hash = "0".repeat(64);
    lines[2] = canonicalJson(t); writeFileSync(p, lines.join("\n") + "\n");
    assert.ok((await expectFail(p)).errors.some((x) => /record_hash|signature/.test(x)));
  }
  {
    const p = newPath();
    buildSignedLedger(p, { edges: [{ ...anEdge(), edge_kind: "references" }], manifest: coverage() }); // signed unknown kind
    await expectFail(p);
  }
  {
    // a signed status record whose status_of references a STATUS hash (not an
    // edge) is rejected: the back-reference scope is closed to edges only.
    const p = newPath();
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pub = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    let prev = canonicalJson({ clotho_weave_header: { pub_key: pub, woven_at: WOVEN, repo_head: REPO_HEAD, repository_ref: REPO, weave_version: 1 } });
    const lines = [prev];
    const sign = (payload) => { const prev_hash = hexOf(prev); const record_hash = hexOf(canonicalJson({ ...payload, prev_hash })); const signature = edSign(null, Buffer.from(record_hash, "hex"), privateKey).toString("base64"); prev = canonicalJson({ ...payload, prev_hash, record_hash, signature }); lines.push(prev); return record_hash; };
    const eh = sign({ ...anEdge(), woven_at: WOVEN });
    const sh = sign({ status_of: eh, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR, woven_at: WOVEN });
    sign({ status_of: sh, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR, woven_at: WOVEN }); // refs a status hash
    sign({ clotho_weave_trailer: coverage(), woven_at: WOVEN });
    writeFileSync(p, lines.join("\n") + "\n");
    assert.equal((await verifyLedger(p)).ok, false, "status referencing a status hash is rejected");
  }
  {
    // a non-canonical (whitespace-padded) signature is rejected even though it
    // decodes to the same bytes
    const { p, lines } = build3();
    const t = JSON.parse(lines[2]); t.signature = " " + t.signature;
    lines[2] = canonicalJson(t); writeFileSync(p, lines.join("\n") + "\n");
    assert.ok((await expectFail(p)).errors.some((x) => /signature/.test(x)));
  }
  {
    // verifyLedger consumes an injected stream incrementally (no whole-file buffering)
    const { p, lines } = build3();
    async function* s() { for (const ln of lines) yield ln + "\n"; }
    const v = await verifyLedger(p, { openReadStream: () => s() });
    assert.equal(v.ok, true, "streamed verify ok: " + JSON.stringify(v.errors));
  }

  // ---- 12. D22 descriptor-close failure, endpoint matrix, misc -------------
  {
    // a descriptor-close failure poisons permanently (no idempotent success)
    let closes = 0;
    const openFile = () => ({ write() {}, close() { closes++; throw new Error("close boom"); } });
    const l = createLedger(newPath(), { ...opts, openFile });
    l.appendEdge(anEdge());
    assert.throws(() => l.close(coverage()), /boom/);
    assert.throws(() => l.close(coverage()), /poisoned/, "a failed close is never idempotent-success");
    assert.throws(() => l.appendEdge(anEdge()), /poisoned/);
    assert.equal(closes, 1, "descriptor closed once, not leaked or double-closed");
  }
  {
    // close after abort throws
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.abort();
    assert.throws(() => l.close(coverage()), /poisoned/);
  }
  {
    // every permitted depends-on endpoint verifies; a wrong one is rejected
    const p = newPath(); const l = createLedger(p, opts);
    const dep = (fromL, toL) => ({ edge_kind: "depends-on", from_node: deriveNodeId(fromL), to_node: deriveNodeId(toL), from_locator: fromL, to_locator: toL, source_ref: SR, asserted_by: "clotho-code-weaver", assertion_status: "deterministic-extraction" });
    l.appendEdge(dep(csLoc, csLoc));
    l.appendEdge(dep(csLoc, rfLoc));
    l.appendEdge(dep(rfLoc, csLoc));
    l.appendEdge(dep(rfLoc, rfLoc));
    l.close(coverage({ codeState: "executed" }));
    assert.equal((await verifyLedger(p)).ok, true, "depends-on matrix verifies");
    const l2 = createLedger(newPath(), opts);
    assert.throws(() => l2.appendEdge(dep(csLoc, commitLoc)), /valid depends-on endpoint/);
  }
  {
    // misplaced/duplicate header (a header where a record belongs)
    const { p, lines } = build3();
    writeFileSync(p, [lines[0], lines[0], lines[2]].join("\n") + "\n");
    assert.ok((await expectFail(p)).errors.some((x) => /duplicate header/.test(x)));
  }
  {
    // removal of a complete tail record PLUS the trailer
    const p = newPath(); const l = createLedger(p, opts);
    l.appendEdge(anEdge()); l.appendEdge(dependsEdge()); l.close(coverage({ codeState: "executed" }));
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n"); // header, e1, e2, trailer
    writeFileSync(p, lines.slice(0, 2).join("\n") + "\n"); // keep header + e1 only
    assert.ok((await expectFail(p)).errors.some((x) => /no final trailer/.test(x)));
  }
  {
    // an invalid-UTF-8 line is rejected (byte-exact verification)
    const { p, lines } = build3();
    const bad = Buffer.concat([Buffer.from(lines[0] + "\n", "utf8"), Buffer.from([0xff, 0x0a]), Buffer.from(lines[2] + "\n", "utf8")]);
    writeFileSync(p, bad);
    assert.ok((await expectFail(p)).errors.some((x) => /UTF-8/.test(x)));
  }

  // ---- 12b. strict own-enumerable schema (pollution / non-enumerable) ------
  {
    // close() coverage: an enumerable field inherited via Object.prototype is rejected
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    Object.defineProperty(Object.prototype, "__evil__", { value: 1, enumerable: true, configurable: true });
    try {
      assert.throws(() => l.close(coverage()), /inherited enumerable/);
    } finally { delete Object.prototype.__evil__; }
  }
  {
    // close() coverage: a non-enumerable required field cannot pass
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    const c = coverage(); Object.defineProperty(c, "weavers", { enumerable: false });
    assert.throws(() => l.close(c), /own-enumerable/);
  }
  {
    // appendStatus: a symbol-keyed status input is rejected
    const p = newPath(); const l = createLedger(p, opts); const e = l.appendEdge(anEdge());
    assert.throws(() => l.appendStatus({ status_of: e.record_hash, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR, [Symbol("x")]: 1 }), /symbol/);
  }

  // ---- 13. frozen matrix completion ----------------------------------------
  // Independently-signed D24 rejections (valid signature, invalid manifest).
  const verifyBadCoverage = async (mut) => { const p = newPath(); const c = coverage(); mut(c); buildSignedLedger(p, { edges: [anEdge()], manifest: c }); return (await verifyLedger(p)).ok; };
  for (const mut of [
    (c) => { c.weavers[0].inspected_source_counts = [{ inventory_id: "package-files", count: 2 }]; },            // missing id
    (c) => { c.weavers[0].inspected_source_counts.push({ inventory_id: "zz", count: 1 }); },                     // extra id
    (c) => { c.weavers[0].inspected_source_counts[0].extra = 1; },                                               // extra field
    (c) => { c.weavers[0].inspected_source_counts.reverse(); },                                                  // unsorted
    (c) => { c.weavers[0].inspected_source_counts = [{ inventory_id: "package-files", count: 1 }, { inventory_id: "package-files", count: 1 }]; }, // duplicate
    (c) => { c.weavers[0].inspected_source_counts[0].count = -1; },                                              // negative
    (c) => { c.weavers[0].inspected_source_counts[0].count = 1.5; },                                             // non-integer
    (c) => { c.weavers[0].inspected_source_counts[0].count = 2 ** 53; },                                         // unsafe
    (c) => { c.weavers[1].inspected_source_counts[0].count = 3; },                                               // skipped nonzero
    (c) => { c.weavers[0].state = "failed"; },                                                                   // failed state
    (c) => { c.weavers[0].implementation_refs = []; },                                                           // empty impl_refs
    (c) => { c.orchestrator_refs = []; }                                                                          // empty orchestrator_refs
  ]) {
    assert.equal(await verifyBadCoverage(mut), false, "signed invalid-manifest fixture must fail verify");
  }
  {
    // locator repository_ref disagreement is rejected at append
    const p = newPath(); const l = createLedger(p, opts);
    const wrong = { kind: "code-symbol", locator: { ...csLoc.locator, repository_ref: "git-root:" + "a".repeat(40) } };
    const e = { edge_kind: "introduced-by", from_node: deriveNodeId(wrong), to_node: deriveNodeId(commitLoc), from_locator: wrong, to_locator: commitLoc, source_ref: SR, asserted_by: "clotho-git-weaver", assertion_status: "deterministic-extraction" };
    assert.throws(() => l.appendEdge(e), /does not match/);
  }
  {
    // assertion-status/producer coupling enforced at append
    const p = newPath(); const l = createLedger(p, opts);
    assert.throws(() => l.appendEdge({ ...anEdge(), assertion_status: "human-authorized" }), /requires deterministic-extraction/);
  }
  {
    // to_node id mismatch, appendStatus-after-close, close-with-no-coverage
    const p = newPath(); const l = createLedger(p, opts);
    assert.throws(() => l.appendEdge({ ...anEdge(), to_node: "0".repeat(64) }), /to_node .* does not match derived/);
  }
  {
    const p = newPath(); const l = createLedger(p, opts); const e = l.appendEdge(anEdge()); l.close(coverage());
    assert.throws(() => l.appendStatus({ status_of: e.record_hash, new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR }), /closed/);
  }
  {
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge());
    assert.throws(() => l.close(undefined), /coverage/);
    assert.throws(() => l.appendEdge(anEdge()), /poisoned/);
  }
  {
    // a signed status referencing a non-edge (arbitrary) hash is rejected
    const p = newPath();
    buildSignedLedger(p, { edges: [anEdge()], statuses: [{ status_of: "a".repeat(64), new_status: "rejected", asserted_by: "human", assertion_status: "human-authorized", source_ref: SR }], manifest: coverage() });
    assert.equal((await verifyLedger(p)).ok, false);
  }
  {
    // no-header ledger, non-canonical line, and 'record precedes a valid header'
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    writeFileSync(p, lines.slice(1).join("\n") + "\n"); // drop the header
    assert.ok((await expectFail(p)).errors.some((x) => /header/.test(x)));
  }
  {
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    lines[1] = lines[1].replace(/^\{/, "{ "); // valid JSON, non-canonical (leading space)
    writeFileSync(p, lines.join("\n") + "\n");
    assert.ok((await expectFail(p)).errors.some((x) => /not canonical/.test(x)));
  }
  {
    const p = newPath(); const l = createLedger(p, opts); l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    lines[0] = "{}"; // malformed first line -> every later record 'precedes a valid header'
    writeFileSync(p, lines.join("\n") + "\n");
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.equal(v.records.length, 0, "no records trusted when the header is invalid");
  }
  {
    // records-content on tail defects: prior trusted edge remains before the invariant
    const p = newPath(); const l = createLedger(p, opts); const e = l.appendEdge(anEdge()); l.close(coverage());
    const lines = readFileSync(p, "utf8").replace(/\n$/, "").split("\n");
    writeFileSync(p, lines.slice(0, -1).join("\n") + "\n"); // drop trailer
    const v = await verifyLedger(p);
    assert.equal(v.ok, false);
    assert.equal(v.records.length, 1, "the edge before the missing trailer is still returned");
    assert.equal(v.manifest, null);
  }
  {
    // createLedger: distinct generated keys, parent-dir creation, invalid wovenAt
    const a = createLedger(newPath(), opts); const b = createLedger(newPath(), opts);
    assert.notEqual(a.header.clotho_weave_header.pub_key, b.header.clotho_weave_header.pub_key, "distinct generated keypairs");
    const sub = path.join(work, "nested", "deep", "l.jsonl");
    const l = createLedger(sub, opts); l.appendEdge(anEdge()); l.close(coverage());
    assert.equal((await verifyLedger(sub)).ok, true, "parent directories created for the requested file");
    assert.throws(() => createLedger(newPath(), { ...opts, wovenAt: "not-a-date" }), /invalid wovenAt/);
  }
  {
    // D22: descriptor closure across each write stage (header/edge/trailer)
    const spy = (failOn) => { const s = { calls: 0, closes: 0 }; return { s, openFile: () => ({ write() { s.calls++; if (s.calls === failOn) throw new Error("write boom"); }, close() { s.closes++; } }) }; };
    const hdr = spy(1); assert.throws(() => createLedger(newPath(), { ...opts, openFile: hdr.openFile }), /write boom/); assert.equal(hdr.s.closes, 1);
    const edge = spy(2); const le = createLedger(newPath(), { ...opts, openFile: edge.openFile }); assert.throws(() => le.appendEdge(anEdge()), /write boom/); assert.equal(edge.s.closes, 1);
    const trl = spy(3); const lt = createLedger(newPath(), { ...opts, openFile: trl.openFile }); lt.appendEdge(anEdge()); assert.throws(() => lt.close(coverage()), /write boom/); assert.equal(trl.s.closes, 1);
  }

  console.log("test-ledger: all assertions passed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
