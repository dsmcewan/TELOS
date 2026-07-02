// driver.mjs — the fixed-point convergence driver, generic.
//
// Repeats an invocation until one of three honest terminals:
//   PASS         isTerminal(result) true                          -> {outcome:"pass"}
//   FIXED POINT  two consecutive passes with identical state — the loop stopped
//                learning; more passes would re-buy identical verdicts
//                                                                 -> {outcome:"fixed-point"}
//   COST FUSE    maxPasses reached (a backstop, never the governing bound)
//                                                                 -> {outcome:"fuse"}
//
// `invoke(pass)` runs one pass and returns anything; `isTerminal(result)`
// decides success; `stateSnapshot()` returns a JSON-serializable progress
// fingerprint (e.g. {converged, blockers}) compared across passes.

export async function driveUntil({ invoke, isTerminal, stateSnapshot, maxPasses = 15, log = () => {} }) {
  let prevState = null;
  for (let pass = 1; pass <= maxPasses; pass++) {
    log(`pass ${pass}/${maxPasses}`);
    const result = await invoke(pass);
    if (isTerminal(result)) {
      log(`CONVERGED on pass ${pass}`);
      return { outcome: "pass", pass, result };
    }
    const state = JSON.stringify(await stateSnapshot());
    if (state === prevState) {
      log("FIXED POINT: no progress between consecutive passes — stopping honestly");
      return { outcome: "fixed-point", pass, result };
    }
    prevState = state;
  }
  log(`cost fuse reached (${maxPasses} passes)`);
  return { outcome: "fuse", pass: maxPasses };
}
