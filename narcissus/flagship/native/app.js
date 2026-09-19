import { bootState, reduce } from "./state.js";
import { STATIONS, evidenceById } from "./stations.js";
import { NODES_BY_BLAST, CLOTHO, ATROPOS, SNAPSHOT, riskColor, nodeById } from "./livegraph.js";
const e2e = new URLSearchParams(location.search).get("e2e") === "1";
let state = bootState(location.search, matchMedia("(prefers-reduced-motion: reduce)").matches);
let painter;
const root = document.getElementById("root");
root.replaceChildren();
const vignette = document.createElement("div");
vignette.className = "vignette";
vignette.setAttribute("aria-hidden", "true");
const main = document.createElement("main");
main.className = "stage";
root.append(vignette, main);
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const cmd = (name, content, attributes = "") => `<button data-testid="cmd-${name}" ${attributes}>${content}</button>`;
// Patch retained nodes instead of replacing focused controls on every event.
function patch(parent, next) {
    for (let i = 0; i < next.childNodes.length; i++) {
        const n = next.childNodes[i], old = parent.childNodes[i];
        if (!old) {
            parent.append(n.cloneNode(true));
            continue;
        }
        if (old.nodeType !== n.nodeType || old.nodeName !== n.nodeName || old.nodeType === 1 && old.dataset.key !== n.dataset.key) {
            old.replaceWith(n.cloneNode(true));
            continue;
        }
        if (n.nodeType === 3) {
            if (old.nodeValue !== n.nodeValue)
                old.nodeValue = n.nodeValue;
            continue;
        }
        for (const a of [...old.attributes])
            if (!n.hasAttribute(a.name))
                old.removeAttribute(a.name);
        for (const a of n.attributes)
            if (old.getAttribute(a.name) !== a.value)
                old.setAttribute(a.name, a.value);
        if (n instanceof HTMLInputElement)
            old.value = n.value;
        patch(old, n);
    }
    while (parent.childNodes.length > next.childNodes.length)
        parent.lastChild.remove();
}
function render() {
    const c = state, graph = c.view === "graph", station = STATIONS[c.stationIndex];
    const evidence = c.evidenceOpen && c.evidenceId ? evidenceById(c.evidenceId) : undefined;
    const node = nodeById(c.selectedNodeId);
    document.documentElement.dataset.theme = c.theme;
    document.documentElement.dataset.motion = c.reducedMotion ? "reduced" : "full";
    if (e2e)
        document.documentElement.dataset.e2e = "1";
    const top = `<header class="topbar"><div class="brand">TELOS · <b>The Loom on Trial</b></div><div class="controls">${graph ? cmd("EXIT_GRAPH", "‹ Story") : cmd("ENTER_GRAPH", "Live weave ▸", 'class="primary"')}${cmd("TOGGLE_THEME", "Theme", `aria-pressed="${c.theme === "light"}"`)}${cmd("TOGGLE_MOTION", "Reduce motion", `aria-pressed="${c.reducedMotion}"`)}${cmd("EXPORT", `Export (${c.exports})`)}${cmd("RESET", "Reset")}</div></header>`;
    let body;
    if (graph) {
        body = `<section class="viewport graph-view" aria-live="polite"><div class="hud hud-tl"><div class="kicker">LIVE · Clotho × Lachesis × Atropos</div><h2 class="hud-title">The live weave</h2><p class="hud-sub"><b>${CLOTHO.total_nodes}</b> nodes · <b>${CLOTHO.total_edges}</b> edges — measured by <b>Lachesis</b>, verified by <b>Atropos</b>. Sized by blast radius; the tension point is <b>canonicalize</b> (184).</p><div class="chips"><span class="chip"><b>CLOTHO</b> ${CLOTHO.total_nodes}·${CLOTHO.total_edges}·${CLOTHO.depends_on_edges}</span><span class="chip"><b>ATROPOS</b> ${escape(ATROPOS.verdict)} · v11–14→${escape(ATROPOS.active_plan_version)}</span></div><p class="src" data-testid="compound-citation">Measured by Lachesis over the live Clotho weave (snapshot ${escape(SNAPSHOT.slice(0, 18))}…); supersession verified by Atropos.</p></div><aside class="hud hud-r node-list" aria-label="Measured nodes by blast radius"><div class="hud-r-head">TOP BY BLAST RADIUS</div>${NODES_BY_BLAST.map(n => cmd("SELECT_NODE", `<span class="node-label">${escape(n.label)}</span><span class="node-blast" style="color: ${riskColor(n.risk_class)}">◉ ${n.blast_radius}</span>`, `class="node-row${n.id === c.selectedNodeId ? " sel" : ""}" data-node="${escape(n.id)}" aria-pressed="${n.id === c.selectedNodeId}"`)).join("")}</aside>${node ? `<aside class="hud hud-bl evidence node-detail" data-testid="node-detail" aria-label="Node measurement"><div class="src">NODE · <b>${escape(node.label)}</b> (${escape(node.kind)}) @ ${escape(node.id.slice(0, 12))}…</div><div class="metrics"><div><span>blast radius</span><b>${node.blast_radius}</b></div><div><span>risk</span><b style="color: ${riskColor(node.risk_class)}">${escape(node.risk_class)}</b></div><div><span>relevance</span><b>${node.relevance.toFixed(2)}</b></div><div><span>dependencies</span><b>${node.dependencies}</b></div></div><blockquote>Blast radius &amp; risk measured by <b>Lachesis</b>; identity &amp; supersession verified by <b>Atropos</b>, over Clotho’s live weave.</blockquote>${cmd("CLEAR_NODE", "Clear selection")}</aside>` : ""}</section>`;
    }
    else {
        body = `<section class="viewport" aria-live="polite"><article class="station" data-key="${station.id}"><div class="kicker" data-testid="station-kicker">${escape(station.kicker)}</div><h1 data-testid="station-title">${escape(station.title)}</h1><p class="body">${escape(station.body)}</p><div class="actions">${cmd("PREV_STATION", "‹ Prev", c.stationIndex === 0 ? "disabled" : "")}${cmd("NEXT_STATION", "Next ›", `class="primary" ${c.stationIndex === STATIONS.length - 1 ? "disabled" : ""}`)}${c.threadPulled ? cmd("RELEASE_THREAD", "Release thread") : cmd("PULL_THREAD", "Pull thread")}${c.evidenceOpen ? cmd("CLOSE_EVIDENCE", "Hide evidence") : cmd("OPEN_EVIDENCE", "Show evidence")}</div>${evidence ? `<aside class="evidence" data-testid="evidence-panel" aria-label="Evidence ledger source"><div class="src">EVIDENCE · <b>${escape(evidence.source_path)}</b> @ ${escape(evidence.blob_sha)}</div><blockquote>“${escape(evidence.quote)}”</blockquote></aside>` : ""}</article></section><footer class="timeline"><label for="scrub">TIMELINE</label><input id="scrub" type="range" min="0" max="${STATIONS.length - 1}" step="1" value="${c.timeScrub}" data-testid="cmd-SCRUB_TIME" aria-valuetext="Station ${c.stationIndex + 1} of ${STATIONS.length}: ${escape(station.title)}" /><div class="stations-dots" role="tablist" aria-label="Stations">${STATIONS.map(s => cmd("GO_STATION", "", `class="dot" role="tab" data-index="${s.index}" aria-current="${s.index === c.stationIndex}" aria-label="Go to ${escape(s.title)}"`)).join("")}</div><span class="brand" data-testid="progress">${String(c.stationIndex + 1).padStart(2, "0")} / ${String(STATIONS.length).padStart(2, "0")}</span></footer>`;
    }
    const template = document.createElement("template");
    template.innerHTML = top + body;
    patch(main, template.content);
    painter?.update(state);
}
function send(event) { state = reduce(state, event); render(); }
main.addEventListener("click", event => {
    const control = event.target.closest("button[data-testid]");
    if (!control || control.disabled)
        return;
    const type = control.dataset.testid.slice(4);
    send({ type, ...(type === "GO_STATION" ? { index: Number(control.dataset.index) } : {}), ...(type === "SELECT_NODE" ? { id: control.dataset.node } : {}) });
});
main.addEventListener("input", event => { if (event.target.dataset.testid === "cmd-SCRUB_TIME")
    send({ type: "SCRUB_TIME", value: Number(event.target.value) }); });
render();
async function mountPaint() {
    try {
        const { createPainter } = await import("./renderer.js");
        painter = createPainter(root, state, e2e);
    }
    catch (error) {
        document.documentElement.dataset.graphics = "unavailable";
        console.error("Graphics unavailable; story controls remain available", error);
    }
}
if (e2e)
    mountPaint();
else {
    const arm = () => window.requestIdleCallback ? requestIdleCallback(mountPaint, { timeout: 900 }) : setTimeout(mountPaint, 250);
    if (document.readyState === "complete")
        arm();
    else
        addEventListener("load", arm, { once: true });
}
addEventListener("pagehide", () => painter?.dispose(), { once: true });
