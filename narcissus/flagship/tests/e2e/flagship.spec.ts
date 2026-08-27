// Deterministic functional blade. Exercises EVERY command in the closed registry (coverage == inventory)
// through the DOM-shadowed controls, under ?e2e=1 (seeded, pinned). WebGL is never touched — the DOM is truth.
import { readFileSync } from "node:fs";
import { test, expect, Page } from "@playwright/test";

// readFileSync (not an import): the generated JSON is data the assertions bind
// to, and Node's ESM loader would demand an import attribute for a JSON import.
const graph = JSON.parse(readFileSync(new URL("../../src/live-graph.json", import.meta.url), "utf8"));

const open = async (page: Page) => {
  await page.goto("/?e2e=1");
  await expect(page.getByTestId("station-title")).toBeVisible();
};
const title = (page: Page) => page.getByTestId("station-title").innerText();
const progress = (page: Page) => page.getByTestId("progress").innerText();

test.beforeEach(async ({ page }) => { await open(page); });

test("NEXT_STATION advances the station", async ({ page }) => {
  const before = await title(page);
  await page.getByTestId("cmd-NEXT_STATION").click();
  expect(await title(page)).not.toBe(before);
  expect(await progress(page)).toBe("02 / 06");
});

test("PREV_STATION goes back", async ({ page }) => {
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.getByTestId("cmd-PREV_STATION").click();
  expect(await progress(page)).toBe("01 / 06");
});

test("GO_STATION jumps to a station by dot", async ({ page }) => {
  await page.locator('[data-testid="cmd-GO_STATION"][data-index="4"]').click();
  expect(await progress(page)).toBe("05 / 06");
});

test("OPEN_EVIDENCE / CLOSE_EVIDENCE toggle the ledger panel with a real source", async ({ page }) => {
  await page.getByTestId("cmd-OPEN_EVIDENCE").click();
  const panel = page.getByTestId("evidence-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("@ "); // full-40-hex blob sha citation
  await page.getByTestId("cmd-CLOSE_EVIDENCE").click();
  await expect(panel).toHaveCount(0);
});

test("PULL_THREAD / RELEASE_THREAD toggle", async ({ page }) => {
  await page.getByTestId("cmd-PULL_THREAD").click();
  await expect(page.getByTestId("cmd-RELEASE_THREAD")).toBeVisible();
  await page.getByTestId("cmd-RELEASE_THREAD").click();
  await expect(page.getByTestId("cmd-PULL_THREAD")).toBeVisible();
});

test("TOGGLE_THEME flips the document theme", async ({ page }) => {
  await page.getByTestId("cmd-TOGGLE_THEME").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByTestId("cmd-TOGGLE_THEME").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("TOGGLE_MOTION sets reduced-motion pressed state", async ({ page }) => {
  const btn = page.getByTestId("cmd-TOGGLE_MOTION");
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
});

test("SCRUB_TIME moves the station via the timeline", async ({ page }) => {
  await page.getByTestId("cmd-SCRUB_TIME").fill("3");
  expect(await progress(page)).toBe("04 / 06");
});

test("EXPORT downloads the evidence payload and increments the counter", async ({ page }) => {
  await page.getByTestId("cmd-NEXT_STATION").click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("cmd-EXPORT").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("narcissus-evidence.json");
  const payload = JSON.parse(readFileSync((await download.path()) as string, "utf8"));
  expect(payload.station.index).toBe(1);
  expect(payload.context.stationIndex).toBe(1);
  expect(payload.live_graph.snapshot).toBe(graph.generated_from_snapshot);
  expect(payload.evidence_ledger.length).toBeGreaterThan(0);
  expect(payload.evidence_ledger[0]).toHaveProperty("blob_sha");
  await expect(page.getByTestId("cmd-EXPORT")).toContainText("Export (1)");
});

test("RESET returns to the first station", async ({ page }) => {
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.getByTestId("cmd-RESET").click();
  expect(await progress(page)).toBe("01 / 06");
});

test("RESET restores the story but preserves motion and theme preferences", async ({ page }) => {
  await page.getByTestId("cmd-TOGGLE_MOTION").click();
  await page.getByTestId("cmd-TOGGLE_THEME").click();
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.getByTestId("cmd-RESET").click();
  expect(await progress(page)).toBe("01 / 06");
  await expect(page.getByTestId("cmd-TOGGLE_MOTION")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("cmd-TOGGLE_THEME")).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-motion"))).toBe("reduced");
  expect(await page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
});

test("ENTER_GRAPH / EXIT_GRAPH switch to the live weave and back, with the compounding citation", async ({ page }) => {
  await page.getByTestId("cmd-ENTER_GRAPH").click();
  const cite = page.getByTestId("compound-citation");
  await expect(cite).toBeVisible();
  await expect(cite).toContainText("Lachesis"); // measured by Lachesis
  await expect(cite).toContainText("Atropos"); // verified by Atropos
  // The HUD's tension-point label and blast radius are BOUND to the generated
  // data, never literals — a regenerated graph can no longer desync the copy.
  const top = [...graph.measured_by_lachesis.top_by_blast_radius].sort((a, b) => b.blast_radius - a.blast_radius)[0];
  const hud = page.locator(".hud-sub");
  await expect(hud).toContainText(top.label);
  await expect(hud).toContainText(`(${top.blast_radius})`);
  await page.getByTestId("cmd-EXIT_GRAPH").click();
  await expect(page.getByTestId("station-title")).toBeVisible();
});

test("SELECT_NODE / CLEAR_NODE inspect a measured node's Lachesis metrics", async ({ page }) => {
  await page.getByTestId("cmd-ENTER_GRAPH").click();
  await page.locator('[data-testid="cmd-SELECT_NODE"]').first().click();
  const detail = page.getByTestId("node-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("blast radius");
  await expect(detail).toContainText("Lachesis");
  await expect(detail).toContainText("Atropos");
  await page.getByTestId("cmd-CLEAR_NODE").click();
  await expect(detail).toHaveCount(0);
});

test("determinism: two ?e2e=1 loads render the same first station", async ({ page }) => {
  const a = await title(page);
  await page.reload();
  expect(await title(page)).toBe(a);
});
