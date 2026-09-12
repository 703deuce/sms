import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-home";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(2000);
  await page
    .getByRole("heading", { name: "Overview" })
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
    .catch(() => undefined);
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: join(OUT, "01_mctb_home_full_desktop.png"),
    fullPage: false,
  });
  console.log("wrote desktop");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({
    path: join(OUT, "06_mctb_home_mobile.png"),
    fullPage: false,
  });
  console.log("wrote mobile");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
