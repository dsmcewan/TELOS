import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { browser, BROWSER_ARGS } from "./browser.mjs";
import { serve } from "./server.mjs";
import { GRAPH_PROBE, stills, MOTIONS, ready, button, pause } from "./scenarios.mjs";
const [root, output] = process.argv.slice(2);
if (!root || !output)
    throw Error("Usage: BROWSER_PATH=/absolute/browser node capture.mjs <site-root> <NEW-output-directory>");
await mkdir(output); // fail if it exists: no implicit rebaselining
const server = await serve(path.resolve(root), { publicRoot: path.resolve(root, "../public") });
const b = await browser(process.env.BROWSER_PATH);
const receipt = { created_at: new Date().toISOString(), root: path.resolve(root), executable: process.env.BROWSER_PATH, executable_sha256: createHash("sha256").update(await readFile(process.env.BROWSER_PATH)).digest("hex"), args: BROWSER_ARGS, viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, clock: { still: 1.234, motion: "live browser clock, event timestamps recorded" }, browser: await b.send("Browser.getVersion"), gpu: await b.send("SystemInfo.getInfo"), stills: [], motions: [], errors: [] };
const off = b.onEvent(message => { if (message.method === "Runtime.exceptionThrown")
    receipt.errors.push(message.params.exceptionDetails); });
try {
    const page = await b.page();
    await page.command("Page.addScriptToEvaluateOnNewDocument", { source: GRAPH_PROBE });
    await stills(page, server.url, async (name) => {
        const data = await page.screenshot(path.join(output, name + ".png"));
        receipt.stills.push({ name, sha256: createHash("sha256").update(Buffer.from(data, "base64")).digest("hex"), graphics: await page.evaluate("window.__graphics"), dom: await page.evaluate("document.querySelector('main').outerHTML") });
    });
    await page.close();
    for (const motion of MOTIONS) {
        const p = await b.page();
        await p.command("Page.addScriptToEvaluateOnNewDocument", { source: GRAPH_PROBE });
        const dir = path.join(output, motion.name);
        await mkdir(dir);
        const frames = [], writes = [], actions = [];
        const stop = b.onEvent(message => {
            if (message.method !== "Page.screencastFrame" || message.sessionId !== p.sessionId)
                return;
            const { data, metadata, sessionId } = message.params;
            const file = `${String(frames.length).padStart(5, "0")}.png`;
            frames.push({ file, ...metadata, sha256: createHash("sha256").update(Buffer.from(data, "base64")).digest("hex") });
            writes.push(writeFile(path.join(dir, file), Buffer.from(data, "base64")));
            writes.push(p.command("Page.screencastFrameAck", { sessionId }));
        });
        await p.goto(server.url + motion.path);
        await ready(p);
        await p.command("Page.startScreencast", { format: "png", maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
        for (const [ms, command] of motion.actions) {
            await pause(ms);
            if (command) {
                actions.push({ command, browser_time: await p.evaluate("performance.now()") });
                await p.click(button(command));
            }
        }
        await p.command("Page.stopScreencast");
        stop();
        await Promise.all(writes);
        receipt.motions.push({ name: motion.name, actions, frames, graphics: await p.evaluate("window.__graphics") });
        await p.close();
    }
    if (receipt.errors.length)
        throw Error("Capture has browser exceptions");
    receipt.status = "captured-not-accepted";
}
catch (error) {
    receipt.status = "failed";
    receipt.error = error.stack;
    throw error;
}
finally {
    off();
    await writeFile(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
    await b.close();
    await server.close();
}
