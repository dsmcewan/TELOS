import { execSync } from "node:child_process";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const grep = (pattern, dir) => {
  try {
    return execSync(`grep -rn "${pattern}" --include="*.mjs" ${dir}`, { encoding: "utf8", cwd: root });
  } catch { return ""; }
};

const aiImportsSaas = grep("from.*saas-forge", "ai-forge/");
const saasImportsAi = grep("from.*ai-forge", "saas-forge/");

assert.equal(aiImportsSaas.trim(), "", "ai-forge must not import from saas-forge:\n" + aiImportsSaas);
assert.equal(saasImportsAi.trim(), "", "saas-forge must not import from ai-forge:\n" + saasImportsAi);

console.log("test-boundaries: OK — no cross-product imports");
