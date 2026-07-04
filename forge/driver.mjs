// driver.mjs — the fixed-point convergence driver, generic.
//
// Repeats an invocation until one of these honest terminals:
//   PASS         isTerminal(result) true                          -> {outcome:"pass"}
//   FIXED POINT  two consecutive passes with identical state — the loop stopped
//                learning; more passes would re-buy identical verdicts
//                                                                 -> {outcome:"fixed-point"}
//   COST FUSE    maxPasses reached (a backstop, never the governing bound)
//                                                                 -> {outcome:"fuse"}
//   TRANSIENT-EXHAUSTED  too many transient failures in a row     -> {outcome:"transient-exhausted"}
//
// `invoke(pass)` runs one pass and returns anything; `isTerminal(result)`
// decides success; `stateSnapshot()` returns a JSON-serializable progress
// fingerprint (e.g. {converged, blockers}) compared across passes.
//
// TRANSIENT RESILIENCE: a pass that fails transiently (network timeout, a brief
// DNS hiccup — `isTransient(result)` true) is NOT progress AND NOT a fixed
// point. Two flaky passes in a row must not be mistaken for "the loop stopped
// learning" (they carry identical error state). Such a pass is retried after a
// backoff, bounded by maxTransient consecutive retries — real passes and
// transient retries are counted separately so a flaky network delays but never
// falsely terminates a converging run.

export async function driveUntil({
  invoke, isTerminal, stateSnapshot,
  isTransient = () => false,
  maxPasses = 15, maxTransient = 6, transientBackoffMs = 15000,
  log = () => {}
}) {
  let prevState = null;
  let transientStreak = 0;
  for (let pass = 1; pass <= maxPasses; pass++) {
    log(`pass ${pass}/${maxPasses}`);
    const result = await invoke(pass);
    if (isTerminal(result)) {
      log(`CONVERGED on pass ${pass}`);
      return { outcome: "pass", pass, result };
    }
    if (isTransient(result)) {
      transientStreak++;
      if (transientStreak > maxTransient) {
        log(`transient failures exhausted (${maxTransient} in a row) — stopping; state preserved for resume`);
        return { outcome: "transient-exhausted", pass, result };
      }
      log(`transient failure (${transientStreak}/${maxTransient}) — backing off ${transientBackoffMs / 1000}s, not a fixed point`);
      await new Promise((r) => setTimeout(r, transientBackoffMs));
      pass--; // a transient retry does not consume a real pass
      continue;
    }
    transientStreak = 0;
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
