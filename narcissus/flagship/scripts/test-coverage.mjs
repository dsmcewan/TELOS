import test from "node:test";
import assert from "node:assert/strict";
import { verifyCoverage } from "./verify-coverage.mjs";
import { COMMANDS } from "../native/state.js";
import { buildIdentity } from "./verification-identity.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
test("command coverage rejects stale, missing, failed and duplicated execution evidence", () => {
  const receipt={status:"pass",commands_executed:[...COMMANDS],build_manifest_sha256:"build",harness_sha256:"harness"};
  const expected={buildHash:"build",harnessHash:"harness"};
  assert.equal(verifyCoverage(receipt,expected),16);
  for(const changed of [{status:"failed"},{build_manifest_sha256:"old"},{harness_sha256:"old"},{commands_executed:COMMANDS.slice(1)},{commands_executed:[...COMMANDS,COMMANDS[0]]}])assert.throws(()=>verifyCoverage({...receipt,...changed},expected));
});
test("coverage rehashes built files rather than trusting an unchanged manifest", async t => {
  const root=await mkdtemp(path.join(tmpdir(),"coverage-drift-"));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,"app.js"),"original");
  await writeFile(path.join(root,"build-manifest.json"),JSON.stringify({kind:"native-static-build",files:{"app.js":createHash("sha256").update("original").digest("hex")}}));
  assert.match(await buildIdentity(root),/^[a-f0-9]{64}$/);
  await writeFile(path.join(root,"app.js"),"changed after browser run");
  await assert.rejects(buildIdentity(root),/Built bytes drifted/);
});
