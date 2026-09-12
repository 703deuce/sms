import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT =
  process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-missed-calls";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb/missed-calls")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(2000);
  await page
    .getByRole("heading", { name: "Missed Calls" })
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
    .catch(() => undefined);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, "01_default_desktop.png") });
  await page.screenshot({ path: join(OUT, "11_full_viewport_density.png"), fullPage: true });

  const search = page.getByPlaceholder("Search caller or number").first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("571");
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, "09_populated_search.png") });
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "12_tablet.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "14_mobile_summary.png") });

  await browser.close();
  console.log(`wrote screenshots to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
