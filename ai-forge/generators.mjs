// generator.mjs — the GENERATOR LAYER wired into merkle-dag's dispatch.
//
// runBuild calls dispatch(injected) per ready node, where injected is ONLY the
// node spec { id, requirements, files, test, effective_hash } (Rule 1). A
// generator dispatch turns that spec into real files and returns the signer;
// runBuild then runs the node's test (verifyNode) and only settles a signed
// ledger entry if it passes. The seat never declares "done" — the test does.

import { generatorDispatch } from "../forge/generators.mjs";
import { workstreamById } from "./pattern.mjs";

export { generatorDispatch };

// Pattern-based generators: render workstreams from the pattern registry.
// Stand-in for live model-seat generation — same dispatch contract, no API keys,
// so research -> generate -> verify -> gate runs in tests and CI.
export function makePatternGenerators(pattern, ctx) {
  return async (injected) => workstreamById(pattern, injected.id).render(ctx);
}
