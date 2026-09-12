import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-onboarding";

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: "onboarding_desktop_1440", width: 1440, height: 900 },
  { name: "onboarding_mobile_390", width: 390, height: 844 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/onboarding/mctb")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForURL(/\/onboarding\/mctb/, { timeout: 120000 });
  await page.locator(".mctb-onb-progress, .mctb-onb-panel").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1000);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.screenshot({ path: join(OUT, `${vp.name}.png`), fullPage: vp.width < 900 });
    console.log(`wrote ${join(OUT, `${vp.name}.png`)}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
