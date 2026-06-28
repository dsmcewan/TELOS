#!/usr/bin/env node
// check-node.mjs — generic deterministic node test. Re-verifies a list of file
// specs (passed as a JSON arg) against the project root (cwd), reusing the
// breakout verifier so build-time verification and the team breakout run on ONE
// engine. Exits non-zero on any failing/zero check so the node never settles.

import { reverifyRecord } from "../../breakout/verifier.mjs";

let specs;
try {
  specs = JSON.parse(process.argv[2] || "[]");
} catch (e) {
  console.error("check-node: bad specs arg: " + (e?.message || e));
  process.exit(2);
}

const result = reverifyRecord({ checks: specs }, process.cwd());
if (result.reverifiable === 0) {
  console.error("check-node: no re-verifiable checks");
  process.exit(1);
}
if (!result.allPass) {
  for (const f of result.failing) console.error("check-node FAIL: " + (f.detail || f.description || f.id));
  process.exit(1);
}
console.log(`check-node: OK (${result.reverifiable} checks verified on disk)`);
