#!/usr/bin/env node
// check-frontend.mjs — deterministic test for the `frontend-brand-experience`
// build node. Runs with cwd = project root. Asserts the generated frontend
// meets the LEXI-class bar: brand token present, first-screen proof band markers
// present, verification artifacts non-empty. Exits non-zero on any failure.

import { existsSync, readFileSync, statSync } from "node:fs";

function fail(msg) {
  console.error(`check-frontend: ${msg}`);
  process.exit(1);
}
function needNonEmpty(p) {
  if (!existsSync(p)) fail(`missing ${p}`);
  if (statSync(p).size === 0) fail(`empty (zero-byte) ${p}`);
}

needNonEmpty("web/site/style.css");
const css = readFileSync("web/site/style.css", "utf8");
if (!css.includes("#69e7ff")) fail("style.css is missing the brand token #69e7ff");

needNonEmpty("web/index.html");
const html = readFileSync("web/index.html", "utf8");
for (const marker of ["Contract:", "Delivery:", "Test posture:", "TELOS gate:"]) {
  if (!html.includes(marker)) fail(`first-screen proof band missing marker: ${marker}`);
}

needNonEmpty("web/VERIFICATION.md");
needNonEmpty("docs/verification/s03-dynamics-discriminator.png");
needNonEmpty("docs/verification/s04-scorecard.png");

console.log("check-frontend: OK (brand token + proof band + verification artifacts present)");
