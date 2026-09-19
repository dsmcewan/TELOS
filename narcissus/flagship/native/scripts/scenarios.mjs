export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export const button = command => `[data-testid="cmd-${command}"]`;
export const station = index => `[data-testid="cmd-GO_STATION"][data-index="${index}"]`;
export const STILL_NAMES = ["01-station-distrust-dark", "02-station-loom-evidence", "03-station-ground-truth", "04-light-theme", "05-live-graph", "07-live-graph-light", "06-story-ferrofluid-knots"];
export const GRAPH_PROBE = `(()=>{window.__graphics={draws:0,errors:[],renderer:null}; for(const kind of ['WebGLRenderingContext','WebGL2RenderingContext']){const proto=window[kind]?.prototype;if(!proto)continue;for(const name of ['drawElements','drawArrays']){const old=proto[name];proto[name]=function(...args){window.__graphics.draws++; const ext=this.getExtension('WEBGL_debug_renderer_info');window.__graphics.renderer=ext?this.getParameter(ext.UNMASKED_RENDERER_WEBGL):this.getParameter(this.RENDERER);return old.apply(this,args);};}}})()`;
export async function ready(page) {
    await page.wait('document.querySelector("canvas")?.width === 1440 && document.querySelector("[data-testid=station-title], [data-testid=compound-citation]")');
    await page.evaluate("document.fonts.ready.then(()=>true)");
    await page.wait("window.__graphics?.draws > 0");
    await pause(150);
}
export async function stills(page, url, capture) {
    await page.goto(url + "/?e2e=1");
    await ready(page);
    await capture(STILL_NAMES[0]);
    await page.click(station(2));
    await page.click(button("PULL_THREAD"));
    await page.click(button("OPEN_EVIDENCE"));
    await pause(100);
    await capture(STILL_NAMES[1]);
    await page.click(station(4));
    await page.click(button("OPEN_EVIDENCE"));
    await pause(100);
    await capture(STILL_NAMES[2]);
    await page.click(button("TOGGLE_THEME"));
    await pause(100);
    await capture(STILL_NAMES[3]);
    await page.click(button("TOGGLE_THEME"));
    await page.click(button("ENTER_GRAPH"));
    await ready(page);
    await page.click(button("SELECT_NODE"));
    await pause(150);
    await capture(STILL_NAMES[4]);
    await page.click(button("TOGGLE_THEME"));
    await pause(150);
    await capture(STILL_NAMES[5]);
    await page.click(button("TOGGLE_THEME"));
    await page.click(button("EXIT_GRAPH"));
    await ready(page);
    await page.click(station(2));
    await page.click(button("PULL_THREAD"));
    await pause(150);
    await capture(STILL_NAMES[6]);
}
export const MOTIONS = [
    { name: "01-story-to-graph", path: "/", actions: [[1500, "ENTER_GRAPH"], [3200, null]] },
    { name: "02-station-transition", path: "/", actions: [[900, "NEXT_STATION"], [1600, "NEXT_STATION"], [1600, "PULL_THREAD"], [1200, null]] },
    { name: "03-hub-selection", path: "/?view=graph", actions: [[2400, "SELECT_NODE"], [1800, "CLEAR_NODE"], [1000, null]] }
];
