import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-analytics";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb/analytics")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("heading", { name: "Analytics" }).waitFor({ state: "visible", timeout: 60000 });
  await page.screenshot({ path: join(OUT, "01_default_30d_desktop.png") });
  await browser.close();
  console.log(`wrote ${join(OUT, "01_default_30d_desktop.png")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
