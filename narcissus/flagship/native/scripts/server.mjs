import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };
export async function serve(root, { port = 0, publicRoot } = {}) {
    root = await realpath(root);
    // A built site must serve its own verified font bytes, not a mutable source
    // directory beside it. The public fallback is only for unbuilt development.
    try { if ((await stat(path.join(root, "fonts"))).isDirectory()) publicRoot = null; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    if (publicRoot) {
        try { publicRoot = await realpath(publicRoot); }
        catch (error) { if (error.code !== "ENOENT") throw error; publicRoot = null; }
    }
    const server = createServer(async (request, response) => {
        try {
            if (!["GET", "HEAD"].includes(request.method)) {
                response.writeHead(405);
                response.end();
                return;
            }
            const route = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
            if (route.includes("\0") || route.includes("\\"))
                throw Error("Invalid path");
            const base = route.startsWith("/fonts/") && publicRoot ? publicRoot : root;
            const candidate = path.resolve(base, `.${route === "/" ? "/index.html" : route}`);
            if (!candidate.startsWith(base + path.sep))
                throw Error("Path outside root");
            const file = await realpath(candidate);
            if (!file.startsWith(base + path.sep) || !(await stat(file)).isFile())
                throw Error("Path outside root");
            response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
            response.end(request.method === "HEAD" ? undefined : await readFile(file));
        }
        catch {
            response.writeHead(404);
            response.end("Not found");
        }
    });
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", resolve); });
    return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const server = await serve(path.resolve(process.argv[2] ?? new URL("../", import.meta.url).pathname), { port: Number(process.env.PORT ?? 4317), publicRoot: path.resolve(new URL("../../public/", import.meta.url).pathname) });
    console.log(server.url);
}
