// The real, accessible DOM story layer. It tells the WHOLE story and is fully operable without WebGL.
// Every interactive element is a semantic HTML control that dispatches a typed command to the machine.
// data-testid={`cmd-${COMMAND}`} makes the command registry the closed E2E inventory. Two views: the story
// stations, and the LIVE GRAPH (Clotho weave measured by Lachesis + verified by Atropos).
import { useMachine } from "@xstate/react";
import { useEffect, lazy, Suspense } from "react";
import { flagshipMachine } from "../machine";
import { STATIONS, STATION_COUNT, evidenceById } from "../stations";
import { NODES_BY_BLAST, CLOTHO, ATROPOS, SNAPSHOT, riskColor, nodeById } from "../livegraph";

// The WebGL canvases (three.js — the heavy chunk) are lazy-loaded so the DOM story (the LCP content) paints
// immediately; three streams in as an async chunk. WebGL is paint, so a deferred canvas never blocks the app.
const Loom = lazy(() => import("./Loom").then((m) => ({ default: m.Loom })));
const LiveGraphCanvas = lazy(() => import("./LiveGraph").then((m) => ({ default: m.LiveGraphCanvas })));

export function DomLayer() {
  const [state, send] = useMachine(flagshipMachine);
  const c = state.context;
  const inGraph = c.view === "graph";
  const station = STATIONS[c.stationIndex];
  const evidence = c.evidenceOpen && c.evidenceId ? evidenceById(c.evidenceId) : undefined;
  const node = c.selectedNodeId ? nodeById(c.selectedNodeId) : undefined;

  useEffect(() => { document.documentElement.setAttribute("data-theme", c.theme); }, [c.theme]);

  return (
    <>
      <Suspense fallback={null}>
        {inGraph
          ? <LiveGraphCanvas selectedNodeId={c.selectedNodeId} reducedMotion={c.reducedMotion} theme={c.theme} />
          : <Loom stationIndex={c.stationIndex} threadPulled={c.threadPulled} reducedMotion={c.reducedMotion} theme={c.theme} />}
      </Suspense>
      <div className="vignette" aria-hidden="true" />
      <main className="stage">
        <header className="topbar">
          <div className="brand">TELOS · <b>The Loom on Trial</b></div>
          <div className="controls">
            {!inGraph
              ? <button className="primary" data-testid="cmd-ENTER_GRAPH" onClick={() => send({ type: "ENTER_GRAPH" })}>Live weave ▸</button>
              : <button data-testid="cmd-EXIT_GRAPH" onClick={() => send({ type: "EXIT_GRAPH" })}>‹ Story</button>}
            <button data-testid="cmd-TOGGLE_THEME" aria-pressed={c.theme === "light"} onClick={() => send({ type: "TOGGLE_THEME" })}>Theme</button>
            <button data-testid="cmd-TOGGLE_MOTION" aria-pressed={c.reducedMotion} onClick={() => send({ type: "TOGGLE_MOTION" })}>Reduce motion</button>
            <button data-testid="cmd-EXPORT" onClick={() => send({ type: "EXPORT" })}>Export ({c.exports})</button>
            <button data-testid="cmd-RESET" onClick={() => send({ type: "RESET" })}>Reset</button>
          </div>
        </header>

        {inGraph ? (
          <section className="viewport graph-view" aria-live="polite">
            {/* WEAVE IS THE HERO: the canvas fills the frame; these HUD overlays are edge-anchored + translucent, out of the weave's way. */}
            <div className="hud hud-tl">
              <div className="kicker">LIVE · Clotho × Lachesis × Atropos</div>
              <h2 className="hud-title">The live weave</h2>
              <p className="hud-sub">
                <b>{CLOTHO.total_nodes}</b> nodes · <b>{CLOTHO.total_edges}</b> edges — measured by <b>Lachesis</b>,
                verified by <b>Atropos</b>. Sized by blast radius; the tension point is <b>canonicalize</b> (184).
              </p>
              <div className="chips">
                <span className="chip"><b>CLOTHO</b> {CLOTHO.total_nodes}·{CLOTHO.total_edges}·{CLOTHO.depends_on_edges}</span>
                <span className="chip"><b>ATROPOS</b> {ATROPOS.verdict} · v11–14→{ATROPOS.active_plan_version}</span>
              </div>
              <p className="src" data-testid="compound-citation">Measured by Lachesis over the live Clotho weave (snapshot {SNAPSHOT.slice(0, 18)}…); supersession verified by Atropos.</p>
            </div>

            <aside className="hud hud-r node-list" aria-label="Measured nodes by blast radius">
              <div className="hud-r-head">TOP BY BLAST RADIUS</div>
              {NODES_BY_BLAST.map((n) => (
                <button
                  key={n.id} className={"node-row" + (n.id === c.selectedNodeId ? " sel" : "")}
                  data-testid="cmd-SELECT_NODE" data-node={n.id}
                  aria-pressed={n.id === c.selectedNodeId} onClick={() => send({ type: "SELECT_NODE", id: n.id })}
                >
                  <span className="node-label">{n.label}</span>
                  <span className="node-blast" style={{ color: riskColor(n.risk_class) }}>◉ {n.blast_radius}</span>
                </button>
              ))}
            </aside>

            {node && (
              <aside className="hud hud-bl evidence node-detail" data-testid="node-detail" aria-label="Node measurement">
                <div className="src">NODE · <b>{node.label}</b> ({node.kind}) @ {node.id.slice(0, 12)}…</div>
                <div className="metrics">
                  <div><span>blast radius</span><b>{node.blast_radius}</b></div>
                  <div><span>risk</span><b style={{ color: riskColor(node.risk_class) }}>{node.risk_class}</b></div>
                  <div><span>relevance</span><b>{node.relevance.toFixed(2)}</b></div>
                  <div><span>dependencies</span><b>{node.dependencies}</b></div>
                </div>
                <blockquote>Blast radius &amp; risk measured by <b>Lachesis</b>; identity &amp; supersession verified by <b>Atropos</b>, over Clotho&rsquo;s live weave.</blockquote>
                <button data-testid="cmd-CLEAR_NODE" onClick={() => send({ type: "CLEAR_NODE" })}>Clear selection</button>
              </aside>
            )}
          </section>
        ) : (
          <>
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
          </>
        )}
      </main>
    </>
  );
}
