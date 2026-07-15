// test-check-registry.mjs — the closed check-contract registry: genuineness discriminator, per-kind
// param VALUE guards (strictly stronger than an empty-needle floor), determinism, and the vetted-test
// assertion the proposal gate relies on to reject a no-op swap.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolve, isRegistered, isVettedResolvedTest, checkKinds, checkContractRef, FORBIDDEN_PARAM_KEYS } from "../check-registry.mjs";

const P = (o) => JSON.stringify(o);

// Case 1: closed set — every registered kind resolves to a VETTED test (isVettedResolvedTest) and an
// unregistered kind fails closed.
{
  assert.ok(checkKinds().length >= 1, "registry is non-empty");
  for (const kind of checkKinds()) {
    // a representative valid params set per kind (both current kinds accept a repo-relative target)
    const r = resolve(kind, P({ target: "src/mod.mjs", needle: "GENUINE_MARKER" }));
    assert.ok(r.ok, `kind '${kind}' resolves with representative params`);
    assert.ok(isVettedResolvedTest(kind, r.test), `kind '${kind}' resolves to a vetted executable`);
    // the resolved test's executable is node -e <closed template> -- ... with a repo-relative cwd
    assert.equal(r.test.cmd, "node");
    assert.equal(r.test.args[0], "-e");
    assert.equal(r.test.cwd, ".");
  }
  assert.equal(resolve("not-a-kind", "{}").error, "UNREGISTERED_KIND", "unregistered kind fails closed");
  assert.equal(isRegistered("not-a-kind"), false);
  console.log("Case 1 OK: closed set, every kind vetted, unknown fails closed");
}

// Case 2: param VALUE guards — strictly stronger than an empty-needle floor (round-9/10). An empty OR
// trivially-short OR placeholder needle, a vacuous/always-present target, an escaping/absolute path,
// and a forbidden param key are ALL rejected.
{
  const bad = [
    P({ target: "src/a.mjs", needle: "" }),          // empty
    P({ target: "src/a.mjs", needle: "ab" }),        // too short (below min specificity)
    P({ target: "src/a.mjs", needle: "TODO" }),      // placeholder
    P({ target: "package.json", needle: "scripts" }), // always-present vacuous target
    P({ target: "../escape", needle: "GENUINE" }),   // escaping-relative
    P({ target: "/etc/passwd", needle: "GENUINE" }), // absolute
    P({ target: "src/a.mjs", needle: "GENUINE", cmd: "rm -rf /" }) // forbidden param key
  ];
  for (const b of bad) assert.notEqual(resolve("assert-file-contains", b).ok, true, `rejected: ${b}`);
  assert.ok(FORBIDDEN_PARAM_KEYS.has("cmd") && FORBIDDEN_PARAM_KEYS.has("script"), "forbidden keys include executable overrides");
  // a genuine, specific needle + a real repo-relative target passes
  assert.ok(resolve("assert-file-contains", P({ target: "src/auth.mjs", needle: "AUTH_GUARD" })).ok, "genuine params pass");
  console.log("Case 2 OK: param value guards reject vacuous/steered checks");
}

// Case 3: determinism + the resolved test genuinely verifies (executes) — passes when present, fails
// when absent. This is what makes the obligation load-bearing.
{
  const a = resolve("assert-file-contains", P({ target: "x.mjs", needle: "AUTH_GUARD" }));
  const b = resolve("assert-file-contains", P({ target: "x.mjs", needle: "AUTH_GUARD" }));
  assert.deepEqual(a.test, b.test, "resolve is deterministic (gate re-resolution is stable)");
  assert.equal(checkContractRef({ kind: "assert-file-contains", params_json: P({ target: "x.mjs", needle: "AUTH_GUARD" }) }),
    checkContractRef({ kind: "assert-file-contains", params_json: P({ target: "x.mjs", needle: "AUTH_GUARD" }) }), "check_contract_ref deterministic");
  const dir = mkdtempSync(path.join(os.tmpdir(), "reg-"));
  writeFileSync(path.join(dir, "x.mjs"), "function f(){ AUTH_GUARD(); }");
  assert.equal(spawnSync(a.test.cmd, a.test.args, { cwd: dir }).status, 0, "genuine check PASSES when the marker is present");
  const c = resolve("assert-file-contains", P({ target: "x.mjs", needle: "NOT_THERE_MARKER" }));
  assert.equal(spawnSync(c.test.cmd, c.test.args, { cwd: dir }).status, 1, "genuine check FAILS when the marker is absent");
  // a no-op swap is NOT a vetted test (the gate uses this to reject a swapped discharge node)
  assert.equal(isVettedResolvedTest("assert-file-contains", { cmd: "node", args: ["-e", "process.exit(0)"], cwd: "." }), false, "a no-op is not vetted");
  console.log("Case 3 OK: deterministic + genuinely verifies + no-op is not vetted");
}

console.log("test-check-registry.mjs OK");
