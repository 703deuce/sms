import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-voicemail";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb/voicemail")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(2000);
  await page
    .getByRole("heading", { name: "Voicemail" })
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
    .catch(() => undefined);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "01_default_inbox_desktop.png") });

  const firstRow = page.locator(".mctb-vm-row").first();
  if (await firstRow.isVisible().catch(() => false)) {
    await firstRow.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, "02_selected_voicemail.png") });
  }

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "16_tablet_inbox_detail.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, "18_mobile_inbox.png") });

  await browser.close();
  console.log(`wrote screenshots to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
