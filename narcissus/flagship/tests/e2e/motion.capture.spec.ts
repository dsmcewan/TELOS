// Motion evidence — award juries score the LIVING site, and motion can't be judged in stills.
// These captures run WITHOUT ?e2e=1 (live motion, real easing) and make no behavioral assertions
// beyond visibility waits: they are evidence recorders, not the functional blade (that stays
// flagship.spec.ts under ?e2e=1). Videos land in screenshots/motion/*.webm.
import { test, Page } from "@playwright/test";
import path from "node:path";

const dir = path.resolve("screenshots", "motion");
test.use({ video: { mode: "on", size: { width: 1280, height: 800 } } });

async function save(page: Page, name: string) {
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(path.join(dir, `${name}.webm`));
}

test("story to graph transition", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("station-title").waitFor();
  await page.waitForTimeout(1500); // idle loom sway
  await page.getByTestId("cmd-ENTER_GRAPH").click();
  await page.getByTestId("compound-citation").waitFor();
  await page.waitForTimeout(3200); // dolly-in + staggered HUD entrances + label fade
  await save(page, "01-story-to-graph");
});

test("station transition", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("station-title").waitFor();
  await page.waitForTimeout(900);
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.waitForTimeout(1600); // camera pans to the band; text rises
  await page.getByTestId("cmd-NEXT_STATION").click();
  await page.waitForTimeout(1600);
  await page.getByTestId("cmd-PULL_THREAD").click();
  await page.waitForTimeout(1200); // the band bows under tension
  await save(page, "02-station-transition");
});

test("hub selection ripple", async ({ page }) => {
  await page.goto("/?view=graph");
  await page.getByTestId("compound-citation").waitFor();
  await page.waitForTimeout(2400); // dolly-in settles
  await page.locator('[data-testid="cmd-SELECT_NODE"]').first().click(); // canonicalize
  await page.waitForTimeout(1800); // shell pop + thread boost ripple
  await page.getByTestId("cmd-CLEAR_NODE").click();
  await page.waitForTimeout(1000); // release
  await save(page, "03-hub-selection");
});
