import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/appointments/overview")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector(".appt-overview-pilot .ref-deco-kpi", { timeout: 90000 });
  await page.waitForTimeout(1500);

  const file = join(OUT, "appointments-overview-charcoal-teal-pilot.png");
  await page.screenshot({ path: file, fullPage: false });
  console.log(`saved ${file}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
