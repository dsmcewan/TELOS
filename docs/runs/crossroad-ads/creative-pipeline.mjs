#!/usr/bin/env node
// creative-pipeline.mjs — exhibits -> Meta ad assets.
//
// Reads the CrossroadThreads clone (designs.json + exhibit PNGs) and produces,
// per selected exhibit: a 1:1 (1080x1080) and 4:5 (1080x1350) JPEG crop, plus
// copy variants derived from the curator placard (headline candidates, primary
// text, description) in copy.json. A manifest indexes everything for the
// provisioning pass.
//
// Uses the source repo's own sharp install (run `npm ci` in workdir/source
// once). Selection: exhibits with curated copy first, capped by --limit.
//
//   node docs/runs/crossroad-ads/creative-pipeline.mjs [--limit 12]

import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(here, "../crossroad-threads/workdir/source");
const outDir = path.join(here, "creative");
const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1]) ||
  (process.argv.includes("--limit") ? Number(process.argv[process.argv.indexOf("--limit") + 1]) : 12);

const require2 = createRequire(path.join(sourceDir, "package.json"));
let sharp;
try {
  sharp = require2("sharp");
} catch {
  console.error("sharp not installed in the source clone — run: cd docs/runs/crossroad-threads/workdir/source && npm ci");
  process.exit(2);
}

// designs.json: { wings: [...], designs: [{ sourceFile, slug, title, tagline,
// wing, status, era, region, medium, edition, placard, audioGuide }] }
const designs = JSON.parse(readFileSync(path.join(sourceDir, "content", "designs.json"), "utf8"));
const entries = designs.designs || [];
if (!entries.length) { console.error("no entries under designs.json .designs"); process.exit(2); }

const imgDir = path.join(sourceDir, "crossroad_imgs");
const imgFiles = new Set(readdirSync(imgDir));

// Curated exhibits with placard copy and an existing source image, on display first.
const picks = entries
  .filter((e) => e && e.slug && e.sourceFile && imgFiles.has(e.sourceFile) && (e.placard || e.tagline))
  .sort((a, b) => (b.status === "ON DISPLAY") - (a.status === "ON DISPLAY"))
  .slice(0, limit);

const manifest = [];
mkdirSync(outDir, { recursive: true });

for (const e of picks) {
  const dir = path.join(outDir, e.slug);
  mkdirSync(dir, { recursive: true });

  const src = path.join(imgDir, e.sourceFile);
  await sharp(src).resize(1080, 1080, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toFile(path.join(dir, "square-1080.jpg"));
  await sharp(src).resize(1080, 1350, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toFile(path.join(dir, "portrait-1080x1350.jpg"));

  const placard = String(e.placard || "").trim();
  const copy = {
    exhibit: e.title,
    slug: e.slug,
    wing: e.wing,
    headlines: [
      e.tagline || e.title,
      `${e.title} — from the Crossroad Archive`,
      e.era ? `${e.title} · ${String(e.era).slice(0, 40)}` : "An exhibit you can wear"
    ],
    primary_text: placard
      ? placard.slice(0, 300) + (placard.length > 300 ? "…" : "")
      : `${e.title} — ${e.tagline || "applied mythology, printed on cotton"}.`,
    description: "The gift shop is the museum. Every shirt is an exhibit with a placard, provenance, and its own audio-guide stop.",
    provenance_line: [e.era, e.region, e.medium, e.edition].filter(Boolean).join(" · "),
    audio_guide_available: !!e.audioGuide,
    cta: "SHOP_NOW",
    source_image: e.sourceFile
  };
  writeFileSync(path.join(dir, "copy.json"), JSON.stringify(copy, null, 2) + "\n");
  manifest.push({ slug: e.slug, wing: e.wing, dir: `creative/${e.slug}`, assets: ["square-1080.jpg", "portrait-1080x1350.jpg"], copy: "copy.json", source_image: e.sourceFile });
  console.log(`ok ${e.slug} (${e.wing})`);
}

writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ generated_from: "designs.json + crossroad_imgs", count: manifest.length, exhibits: manifest }, null, 2) + "\n");
console.log(`creative manifest: ${manifest.length} exhibits -> ${path.join(outDir, "manifest.json")}`);
