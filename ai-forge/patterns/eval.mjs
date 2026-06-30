// patterns/eval.mjs — an eval-harness pattern as DATA.
// 4 build workstreams (dataset / target / runner / metrics), each a self-contained
// ESM module with an inline --selftest run as its nodeTest. Keyless, deterministic.
import { makeDesignWorkstream } from "../workstreams/design.mjs";

function mod({ id, signer, dependencies, file, source, finding, needle }) {
  return {
    id, signer, lens: signer, dependencies,
    files: [file],
    requirements: finding,
    render: () => ({ [file]: source }),
    checks: (ctx) => [
      { type: "file_exists", path: file },
      ...(needle ? [{ type: "file_contains", path: file, needle }] : [])
    ],
    nodeTest: { cmd: "node", args: [file, "--selftest"] },
    findingsKey: "architecture_findings",
    finding
  };
}

export function evalContext(params = {}) {
  return { telos: params.telos || "score a target system against a labelled eval set", epsilon: 1e-9 };
}

const DATASET_SRC = `import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// fixed labelled eval set (binary sentiment). expected in {positive, negative}.
export const DATASET = [
  { id: "c1", input: "great product love it", expected: "positive" },
  { id: "c2", input: "terrible broke immediately", expected: "negative" },
  { id: "c3", input: "works as described happy", expected: "positive" },
  { id: "c4", input: "awful waste of money", expected: "negative" }
];
if (isMain && process.argv.includes("--selftest")) {
  assert.ok(DATASET.length >= 4, "need >=4 cases");
  const ids = DATASET.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "case ids unique");
  for (const c of DATASET) assert.ok(c.input && c.expected, "case missing input/expected");
  console.log("dataset OK: " + DATASET.length + " cases");
}
`;

const TARGET_SRC = `import assert from "node:assert/strict";
import { DATASET } from "./dataset.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
const POS = new Set(["great", "love", "works", "happy", "good", "excellent"]);
const NEG = new Set(["terrible", "broke", "awful", "waste", "bad", "horrible"]);
// deterministic keyword classifier; ties -> negative.
export function predict(input) {
  const toks = String(input).toLowerCase().match(/[a-z]+/g) || [];
  let p = 0, n = 0;
  for (const t of toks) { if (POS.has(t)) p++; if (NEG.has(t)) n++; }
  return p > n ? "positive" : "negative";
}
if (isMain && process.argv.includes("--selftest")) {
  const a = DATASET.map((c) => predict(c.input));
  const b = DATASET.map((c) => predict(c.input));
  assert.deepEqual(a, b, "predict is deterministic");
  assert.equal(a.length, DATASET.length, "total over dataset inputs");
  assert.equal(predict("great love"), "positive");
  console.log("target OK");
}
`;

const RUNNER_SRC = `import assert from "node:assert/strict";
import { DATASET } from "./dataset.mjs";
import { predict } from "./target.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// run the target over the dataset -> one prediction per case, aligned by id.
export function runTarget() {
  return DATASET.map((c) => ({ id: c.id, predicted: predict(c.input), expected: c.expected }));
}
if (isMain && process.argv.includes("--selftest")) {
  const preds = runTarget();
  assert.equal(preds.length, DATASET.length, "one prediction per case");
  assert.deepEqual(preds.map((p) => p.id), DATASET.map((c) => c.id), "aligned by id, in order");
  for (const p of preds) assert.ok(p.predicted === "positive" || p.predicted === "negative", "valid label");
  console.log("runner OK");
}
`;

const METRICS_SRC = `import assert from "node:assert/strict";
import { runTarget } from "./run-target.mjs";
import { pathToFileURL } from "node:url";
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
// accuracy + precision/recall for the "positive" class. predictions/expected: label arrays.
export function computeMetrics(predicted, expected) {
  let correct = 0, tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < expected.length; i++) {
    if (predicted[i] === expected[i]) correct++;
    if (predicted[i] === "positive" && expected[i] === "positive") tp++;
    if (predicted[i] === "positive" && expected[i] === "negative") fp++;
    if (predicted[i] === "negative" && expected[i] === "positive") fn++;
  }
  const n = expected.length;
  return {
    accuracy: correct / n,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn)
  };
}
if (isMain && process.argv.includes("--selftest")) {
  // hand-computed fixture: TP=1, FP=1, FN=1, TN=1 -> all 0.5
  const m = computeMetrics(["positive", "negative", "negative", "positive"], ["positive", "positive", "negative", "negative"]);
  assert.equal(m.accuracy, 0.5, "accuracy 0.5");
  assert.equal(m.precision, 0.5, "precision 0.5");
  assert.equal(m.recall, 0.5, "recall 0.5");
  // over the real runner: perfect target -> 1.0
  const preds = runTarget();
  const real = computeMetrics(preds.map((p) => p.predicted), preds.map((p) => p.expected));
  assert.equal(real.accuracy, 1, "target is perfect on the fixed dataset");
  console.log("metrics OK");
}
`;

const datasetWorkstream = mod({ id: "dataset", signer: "codex", dependencies: [], file: "eval/dataset.mjs", source: DATASET_SRC, needle: "export const DATASET", finding: "Eval dataset has >=4 unique, well-formed labelled cases." });
const targetWorkstream = mod({ id: "target", signer: "claude", dependencies: ["dataset"], file: "eval/target.mjs", source: TARGET_SRC, needle: "export function predict", finding: "Target classifier is total over the dataset and deterministic." });
const runnerWorkstream = mod({ id: "runner", signer: "codex", dependencies: ["dataset", "target"], file: "eval/run-target.mjs", source: RUNNER_SRC, needle: "export function runTarget", finding: "Runner produces one id-aligned prediction per case." });
const metricsWorkstream = mod({ id: "metrics", signer: "agy", dependencies: ["runner"], file: "eval/metrics.mjs", source: METRICS_SRC, needle: "export function computeMetrics", finding: "Metrics compute accuracy/precision/recall, proven against a hand-computed fixture." });

export const evalBuildWorkstreams = [datasetWorkstream, targetWorkstream, runnerWorkstream, metricsWorkstream];
