// Deterministic functional blade. Exercises EVERY command in the closed registry (coverage == inventory)
// through the DOM-shadowed controls, under ?e2e=1 (seeded, pinned). WebGL is never touched — the DOM is truth.
import { test, expect, Page } from "@playwright/test";

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

test("EXPORT increments the export counter", async ({ page }) => {
  await page.getByTestId("cmd-EXPORT").click();
  await expect(page.getByTestId("cmd-EXPORT")).toContainText("Export (1)");
});

test("RESET returns to the first station", async ({ page }) => {
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.getByTestId("cmd-RESET").click();
  expect(await progress(page)).toBe("01 / 06");
});

test("determinism: two ?e2e=1 loads render the same first station", async ({ page }) => {
  const a = await title(page);
  await page.reload();
  expect(await title(page)).toBe(a);
});
