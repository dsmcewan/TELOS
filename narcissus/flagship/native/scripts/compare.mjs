import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { STILL_NAMES } from "./scenarios.mjs";
export const THRESHOLDS = Object.freeze({ width: 1440, height: 900, channelError: 16, maxPixelFraction: .005, maxMeanChannelError: 1, maxDurationErrorFrames: 2 });
export function png(bytes) {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
        throw Error("Not PNG");
    let width, height, type, channels;
    const chunks = [];
    for (let at = 8; at < bytes.length;) {
        const size = bytes.readUInt32BE(at), kind = bytes.toString("ascii", at + 4, at + 8), data = bytes.subarray(at + 8, at + 8 + size);
        at += size + 12;
        if (kind === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            type = data[9];
            channels = type === 2 ? 3 : type === 6 ? 4 : 0;
            if (data[8] !== 8 || data[12] !== 0 || !channels)
                throw Error("Only noninterlaced 8-bit RGB/RGBA PNG supported");
        }
        if (kind === "IDAT")
            chunks.push(data);
    }
    if (!width || !height || width * height > 30000000)
        throw Error("Invalid PNG dimensions");
    const packed = inflateSync(Buffer.concat(chunks), { maxOutputLength: height * (width * channels + 1) }), stride = width * channels;
    if (packed.length !== height * (stride + 1))
        throw Error("Invalid PNG row length");
    const out = new Uint8Array(width * height * channels);
    const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
    for (let y = 0; y < height; y++) {
        const filter = packed[y * (stride + 1)];
        if (filter > 4)
            throw Error("Invalid PNG filter");
        for (let x = 0; x < stride; x++) {
            const i = y * stride + x, a = x >= channels ? out[i - channels] : 0, b = y ? out[i - stride] : 0, c = y && x >= channels ? out[i - stride - channels] : 0;
            out[i] = (packed[y * (stride + 1) + x + 1] + [0, a, b, (a + b) >> 1, paeth(a, b, c)][filter]) & 255;
        }
    }
    return { width, height, channels, data: out };
}
export function comparePixels(a, b) {
    if (a.width !== b.width || a.height !== b.height)
        throw Error("Image dimensions differ");
    let changed = 0, error = 0, max = 0;
    const count = a.width * a.height;
    for (let p = 0; p < count; p++) {
        let pixel = 0;
        for (let c = 0; c < 3; c++) {
            const delta = Math.abs(a.data[p * a.channels + c] - b.data[p * b.channels + c]);
            error += delta;
            pixel = Math.max(pixel, delta);
        }
        if (pixel > THRESHOLDS.channelError)
            changed++;
        max = Math.max(max, pixel);
    }
    const fraction = changed / count, mean = error / (count * 3);
    return { pixels: count, changed_pixels: changed, fraction_over_16: fraction, mean_channel_error: mean, max_channel_error: max, pass: fraction <= THRESHOLDS.maxPixelFraction && mean <= THRESHOLDS.maxMeanChannelError };
}
export async function compareDirectories(baseline, candidate) {
    const baselineReceipt = JSON.parse(await readFile(path.join(baseline, "receipt.json"), "utf8"));
    const candidateReceipt = JSON.parse(await readFile(path.join(candidate, "receipt.json"), "utf8"));
    if (baselineReceipt.browser.product !== candidateReceipt.browser.product
        || baselineReceipt.stills[0]?.graphics?.renderer !== candidateReceipt.stills[0]?.graphics?.renderer
        || JSON.stringify(baselineReceipt.viewport) !== JSON.stringify(candidateReceipt.viewport)) {
        throw Error("Visual baseline browser/backend/viewport mismatch; parity cannot be claimed");
    }
    const results = [];
    for (const name of STILL_NAMES) {
        const aBytes = await readFile(path.join(baseline, name + ".png"));
        const bBytes = await readFile(path.join(candidate, name + ".png"));
        for (const [bytes, receipt, label] of [[aBytes, baselineReceipt, "baseline"], [bBytes, candidateReceipt, "candidate"]]) {
            const expected = receipt.stills.find(row => row.name === name)?.sha256;
            if (createHash("sha256").update(bytes).digest("hex") !== expected)
                throw Error(`${label} image identity drift: ${name}`);
        }
        const a = png(aBytes), b = png(bBytes);
        if (a.width !== 1440 || a.height !== 900)
            throw Error("Baseline dimensions disagree with frozen contract");
        results.push({ name, ...comparePixels(a, b) });
    }
    return { thresholds: THRESHOLDS, baseline, candidate, stills_pass: results.every(r => r.pass), motion_pass: null, status: "still-comparison-only", results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const [baseline, candidate, output] = process.argv.slice(2);
    const report = await compareDirectories(baseline, candidate);
    if (output)
        await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    if (!report.stills_pass)
        process.exitCode = 1;
}
