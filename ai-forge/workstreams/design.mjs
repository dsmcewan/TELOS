// design.mjs — a generic, pattern-agnostic `design` workstream. Authors
// docs/DESIGN.md (a structured component block + mermaid + 5 narrative sections)
// derived from the build workstreams, and writes the canonical verifier to
// docs/design/verify.mjs. The deep design<->plan<->build gate is that verifier
// (the workstream's nodeTest); checks(ctx) are the surface checks for the breakout.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VERIFY_SRC = readFileSync(fileURLToPath(new URL("./design-verify.mjs", import.meta.url)), "utf8");
const SECTIONS = ["Component boundaries", "Data flow", "Model/infra choices", "Eval plan", "Risks"];

export function makeDesignWorkstream(buildWorkstreams) {
  const components = buildWorkstreams.map((w) => ({
    workstream: w.id,
    model: w.signer,
    artifact: w.files[0],
    depends_on: [...(w.dependencies || [])]
  }));

  function render() {
    const block = "```json\n" + JSON.stringify(components, null, 2) + "\n```";
    const edges = components.flatMap((c) => c.depends_on.map((d) => `  ${d} --> ${c.workstream}`));
    const mermaid = "```mermaid\nflowchart TD\n" + (edges.length ? edges.join("\n") : components.map((c) => `  ${c.workstream}`).join("\n")) + "\n```";
    const bodies = {
      "Component boundaries": components.map((c) => `- **${c.workstream}** (${c.model}) owns \`${c.artifact}\`.`).join("\n"),
      "Data flow": "Build order follows the dependency DAG:\n\n" + mermaid,
      "Model/infra choices": components.map((c) => `- ${c.workstream}: authored by **${c.model}**.`).join("\n"),
      "Eval plan": "Each component's node test gates its artifact on disk (Rule 3); this design is itself gated by `docs/design/verify.mjs` against the plan, ledger, and built tree.",
      "Risks": "Drift between design and build is caught fail-closed by `verify.mjs`; a missing/phantom component, wrong edge, wrong model, or unrealized artifact blocks the run."
    };
    let md = "# Architecture Design\n\n" + block + "\n";
    for (const h of SECTIONS) md += `\n## ${h}\n\n${bodies[h]}\n`;
    return { "docs/DESIGN.md": md, "docs/design/verify.mjs": VERIFY_SRC };
  }

  function checks() {
    return [
      { type: "file_exists", path: "docs/DESIGN.md" },
      { type: "file_exists", path: "docs/design/verify.mjs" },
      ...SECTIONS.map((h) => ({ type: "file_contains", path: "docs/DESIGN.md", needle: h }))
    ];
  }

  return {
    id: "design",
    signer: "claude",
    lens: "claude",
    dependencies: buildWorkstreams.map((w) => w.id),
    files: ["docs/DESIGN.md", "docs/design/verify.mjs"],
    requirements: "Author the architecture design and verify it against the plan, ledger, and built artifacts.",
    render,
    checks,
    nodeTest: { cmd: "node", args: ["docs/design/verify.mjs"] },
    findingsKey: "design_findings",
    finding: "Design is consistent with the content-addressed plan, signed ledger, and built artifacts."
  };
}
