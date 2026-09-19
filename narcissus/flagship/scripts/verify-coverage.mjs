// Coverage means successful browser execution bound to current built bytes.
// Literal command names in a test file are not evidence that actions ran.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { COMMANDS } from "../native/state.js";
import { browserHarnessHash, buildIdentity } from "./verification-identity.mjs";

export function verifyCoverage(receipt, { buildHash, harnessHash }) {
  if (receipt?.status !== "pass") throw Error("Browser run did not pass");
  if (receipt.build_manifest_sha256 !== buildHash || receipt.harness_sha256 !== harnessHash) throw Error("Browser coverage receipt is stale for this build or harness");
  const actual = receipt.commands_executed;
  if (!Array.isArray(actual) || new Set(actual).size !== actual.length || JSON.stringify([...actual].sort()) !== JSON.stringify([...COMMANDS].sort())) throw Error("Executed commands differ from the closed inventory");
  return actual.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw Error("Usage: node scripts/verify-coverage.mjs <browser-run-receipt.json>");
  const sha = bytes => createHash("sha256").update(bytes).digest("hex");
  const count = verifyCoverage(JSON.parse(await readFile(process.argv[2], "utf8")), {
    buildHash: await buildIdentity(new URL("../dist/", import.meta.url)),
    harnessHash: await browserHarnessHash()
  });
  console.log(`verify-coverage: ${count} commands completed against current built bytes`);
}
