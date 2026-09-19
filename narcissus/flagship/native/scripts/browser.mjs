// Browser executable is a declared platform prerequisite, never installed here.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
export const BROWSER_ARGS = ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--remote-debugging-pipe", "--no-first-run", "--no-default-browser-check", "--hide-scrollbars"];
export async function browser(executable) {
    if (!executable || !path.isAbsolute(executable))
        throw new Error("BROWSER_PATH must name an absolute, existing browser executable");
    const profile = await mkdtemp(path.join(tmpdir(), "flagship-browser-"));
    const child = spawn(executable, [...BROWSER_ARGS, `--user-data-dir=${profile}`], { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
    let id = 0, tail = "", ended = false, stderr = "";
    const pending = new Map();
    const events = new Set();
    child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-8192); });
    const fail = error => {
        ended = true;
        for (const waiter of pending.values()) {
            clearTimeout(waiter.timer);
            waiter.reject(error);
        }
        pending.clear();
    };
    child.on("error", fail);
    child.on("exit", (code, signal) => fail(new Error(`Browser exited ${code ?? signal}: ${stderr}`)));
    child.stdio[4].setEncoding("utf8");
    child.stdio[4].on("data", chunk => {
        tail += chunk;
        let end;
        while ((end = tail.indexOf("\0")) !== -1) {
            const raw = tail.slice(0, end);
            tail = tail.slice(end + 1);
            let message;
            try {
                message = JSON.parse(raw);
            }
            catch {
                fail(new Error("Malformed browser protocol response"));
                return;
            }
            if (message.id) {
                const waiter = pending.get(message.id);
                if (!waiter)
                    continue;
                pending.delete(message.id);
                clearTimeout(waiter.timer);
                if (message.error)
                    waiter.reject(new Error(JSON.stringify(message.error)));
                else
                    waiter.resolve(message.result);
            }
            else
                for (const receive of events)
                    receive(message);
        }
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        if (ended)
            return reject(new Error("Browser is closed"));
        const request = ++id;
        const timer = setTimeout(() => { pending.delete(request); reject(new Error(`Browser timeout: ${method}`)); }, 20000);
        pending.set(request, { resolve, reject, timer });
        child.stdio[3].write(JSON.stringify({ id: request, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0", error => {
            if (error) {
                pending.delete(request);
                clearTimeout(timer);
                reject(error);
            }
        });
    });
    try {
        await send("Browser.getVersion");
    }
    catch (error) {
        child.kill("SIGKILL");
        await rm(profile, { recursive: true, force: true });
        throw error;
    }
    return {
        send,
        onEvent(fn) { events.add(fn); return () => events.delete(fn); },
        async page() {
            const { targetId } = await send("Target.createTarget", { url: "about:blank" });
            const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
            const command = (method, params) => send(method, params, sessionId);
            await command("Page.enable");
            await command("Runtime.enable");
            await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
            const evaluate = async (expression) => {
                const value = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
                if (value.exceptionDetails)
                    throw new Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text);
                return value.result.value;
            };
            const wait = async (expression) => {
                const deadline = Date.now() + 15000;
                while (Date.now() < deadline) {
                    if (await evaluate(`Boolean(${expression})`))
                        return;
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                throw new Error(`Page condition timed out: ${expression}`);
            };
            return {
                command, evaluate, wait, sessionId,
                async goto(url) { await command("Page.navigate", { url }); await wait("document.readyState === 'complete'"); },
                async click(selector) {
                    const rect = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}); if(!e || e.disabled) throw Error('Control unavailable'); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
                    await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...rect });
                    await command("Input.dispatchMouseEvent", { type: "mousePressed", ...rect, button: "left", clickCount: 1 });
                    await command("Input.dispatchMouseEvent", { type: "mouseReleased", ...rect, button: "left", clickCount: 1 });
                },
                async screenshot(file) { const { data } = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); if (file)
                    await writeFile(file, Buffer.from(data, "base64")); return data; },
                async close() { await send("Target.closeTarget", { targetId }); }
            };
        },
        async close() {
            if (!ended) {
                try {
                    await send("Browser.close");
                }
                catch { }
            }
            if (!ended)
                await Promise.race([new Promise(resolve => child.once("exit", resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
            if (!ended)
                child.kill("SIGKILL");
            await rm(profile, { recursive: true, force: true });
        }
    };
}
