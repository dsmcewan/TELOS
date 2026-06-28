// plan.mjs — compile the SaaS market-readiness build into a merkle-dag plan.
// One node per team (workstream): each WRITES its artifacts and carries a
// deterministic TEST; dependencies order the build (architecture first).

import { computePlan } from "../merkle-dag/merkle.mjs";
import { WORKSTREAMS, nodeTestFor, workstreamById } from "./workstreams.mjs";

export function convergenceTaskDefs(architecture) {
  return WORKSTREAMS.map((ws) => ({
    id: ws.id,
    files: ws.files,
    requirements: ws.requirements,
    test: nodeTestFor(ws, architecture),
    dependencies: ws.dependencies
  }));
}

// Which seat signs which team's ledger entry (must be in authorized_signers).
export function signerForTask(id) {
  return workstreamById(id)?.signer || "claude";
}

export function compileConvergencePlan({ architecture, authorizedSigners }) {
  return computePlan(convergenceTaskDefs(architecture), { authorizedSigners });
}
