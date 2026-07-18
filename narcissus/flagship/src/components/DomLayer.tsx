// The real, accessible DOM story layer. It tells the WHOLE story and is fully operable without WebGL.
// Every interactive element is a semantic HTML control that dispatches a typed command to the machine.
// data-testid={`cmd-${COMMAND}`} makes the command registry the closed E2E inventory.
import { useMachine } from "@xstate/react";
import { useEffect } from "react";
import { flagshipMachine } from "../machine";
import { STATIONS, STATION_COUNT, evidenceById } from "../stations";
import { Loom } from "./Loom";

export function DomLayer() {
  const [state, send] = useMachine(flagshipMachine);
  const c = state.context;
  const station = STATIONS[c.stationIndex];
  const evidence = c.evidenceOpen && c.evidenceId ? evidenceById(c.evidenceId) : undefined;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", c.theme);
  }, [c.theme]);

  return (
    <>
      <Loom stationIndex={c.stationIndex} threadPulled={c.threadPulled} reducedMotion={c.reducedMotion} theme={c.theme} />
      <div className="vignette" aria-hidden="true" />
      <main className="stage">
        <header className="topbar">
          <div className="brand">TELOS · <b>The Loom on Trial</b></div>
          <div className="controls">
            <button data-testid="cmd-TOGGLE_THEME" aria-pressed={c.theme === "light"} onClick={() => send({ type: "TOGGLE_THEME" })}>Theme</button>
            <button data-testid="cmd-TOGGLE_MOTION" aria-pressed={c.reducedMotion} onClick={() => send({ type: "TOGGLE_MOTION" })}>Reduce motion</button>
            <button data-testid="cmd-EXPORT" onClick={() => send({ type: "EXPORT" })}>Export ({c.exports})</button>
            <button data-testid="cmd-RESET" onClick={() => send({ type: "RESET" })}>Reset</button>
          </div>
        </header>

        <section className="viewport" aria-live="polite">
          <article className="station" key={station.id}>
            <div className="kicker" data-testid="station-kicker">{station.kicker}</div>
            <h1 data-testid="station-title">{station.title}</h1>
            <p className="body">{station.body}</p>
            <div className="actions">
              <button data-testid="cmd-PREV_STATION" onClick={() => send({ type: "PREV_STATION" })} disabled={c.stationIndex === 0}>‹ Prev</button>
              <button className="primary" data-testid="cmd-NEXT_STATION" onClick={() => send({ type: "NEXT_STATION" })} disabled={c.stationIndex === STATION_COUNT - 1}>Next ›</button>
              {!c.threadPulled
                ? <button data-testid="cmd-PULL_THREAD" onClick={() => send({ type: "PULL_THREAD" })}>Pull thread</button>
                : <button data-testid="cmd-RELEASE_THREAD" onClick={() => send({ type: "RELEASE_THREAD" })}>Release thread</button>}
              {!c.evidenceOpen
                ? <button data-testid="cmd-OPEN_EVIDENCE" onClick={() => send({ type: "OPEN_EVIDENCE" })}>Show evidence</button>
                : <button data-testid="cmd-CLOSE_EVIDENCE" onClick={() => send({ type: "CLOSE_EVIDENCE" })}>Hide evidence</button>}
            </div>

            {evidence && (
              <aside className="evidence" data-testid="evidence-panel" aria-label="Evidence ledger source">
                <div className="src">EVIDENCE · <b>{evidence.source_path}</b> @ {evidence.blob_sha}</div>
                <blockquote>&ldquo;{evidence.quote}&rdquo;</blockquote>
              </aside>
            )}
          </article>
        </section>

        <footer className="timeline">
          <label htmlFor="scrub">TIMELINE</label>
          <input
            id="scrub" type="range" min={0} max={STATION_COUNT - 1} step={1} value={c.timeScrub}
            data-testid="cmd-SCRUB_TIME"
            onChange={(e) => send({ type: "SCRUB_TIME", value: Number(e.target.value) })}
            aria-valuetext={`Station ${c.stationIndex + 1} of ${STATION_COUNT}: ${station.title}`}
          />
          <div className="stations-dots" role="tablist" aria-label="Stations">
            {STATIONS.map((s) => (
              <button
                key={s.id} className="dot" role="tab" data-testid="cmd-GO_STATION" data-index={s.index}
                aria-current={s.index === c.stationIndex} aria-label={`Go to ${s.title}`}
                onClick={() => send({ type: "GO_STATION", index: s.index })}
              />
            ))}
          </div>
          <span className="brand" data-testid="progress">{String(c.stationIndex + 1).padStart(2, "0")} / {String(STATION_COUNT).padStart(2, "0")}</span>
        </footer>
      </main>
    </>
  );
}
