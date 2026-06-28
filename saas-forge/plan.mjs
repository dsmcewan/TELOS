// plan.mjs — compile the convergence-demo market-readiness build into a
// merkle-dag plan. Each market workstream becomes a node that WRITES concrete
// artifacts and carries a deterministic TEST; dependencies order the build
// (architecture first, then the frontend that depends on it).

import path from "node:path";
import { fileURLToPath } from "node:url";
import { computePlan } from "../merkle-dag/merkle.mjs";
import { stackLibraries } from "./research.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHECK_ARCH = path.join(here, "checks", "check-architecture.mjs");
const CHECK_FRONTEND = path.join(here, "checks", "check-frontend.mjs");

// Build the task defs for this slice (architecture + frontend). The structure
// generalizes: one node per market workstream, each with files + a test.
export function convergenceTaskDefs(architecture) {
  const libs = stackLibraries(architecture);
  return [
    {
      id: "architecture",
      files: ["docs/ARCHITECTURE.md"],
      requirements: "Document the researched capability stack (UI/DB/infra) as a coherent SaaS architecture.",
      // The test asserts the doc references each chosen library — single source
      // of truth: the same stack the research stage resolved.
      test: { cmd: "node", args: [CHECK_ARCH, ...libs] },
      dependencies: []
    },
    {
      id: "frontend-brand-experience",
      files: [
        "web/index.html",
        "web/site/style.css",
        "web/VERIFICATION.md",
        "docs/verification/s03-dynamics-discriminator.png",
        "docs/verification/s04-scorecard.png"
      ],
      requirements: "LEXI-class first screen: contract, delivery shape, test posture, and TELOS gate visible; cyan brand token #69e7ff present; verification screenshots rendered.",
      test: { cmd: "node", args: [CHECK_FRONTEND] },
      dependencies: ["architecture"]
    }
  ];
}

// Which seat signs which task's ledger entry (must be in authorized_signers).
export function signerForTask(id) {
  return id === "architecture" ? "codex" : "claude";
}

export function compileConvergencePlan({ architecture, authorizedSigners }) {
  return computePlan(convergenceTaskDefs(architecture), { authorizedSigners });
}
