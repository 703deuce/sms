import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-setup";

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: "recovery_desktop_1440", width: 1440, height: 900 },
  { name: "recovery_desktop_1280", width: 1280, height: 800 },
  { name: "recovery_tablet_1024", width: 1024, height: 768 },
  { name: "recovery_mobile_390", width: 390, height: 844 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb/setup/recovery")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page
    .locator(".mctb-recovery-section-header__title, .mctb-recovery-status-strip")
    .first()
    .waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(800);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);
    const file = join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: vp.width < 900 });
    console.log(`wrote ${file}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
