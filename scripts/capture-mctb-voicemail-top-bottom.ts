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
  await page.waitForTimeout(2500);
  await page
    .getByRole("heading", { name: "Voicemail" })
    .first()
    .waitFor({ state: "visible", timeout: 60000 })
    .catch(() => undefined);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1000);

  // Top of page (viewport)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "voicemail_page_top.png") });

  // Bottom of page (scroll to max)
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  const maxScroll = Math.max(0, scrollHeight - viewportHeight);
  await page.evaluate((y) => window.scrollTo(0, y), maxScroll);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "voicemail_page_bottom.png") });

  // Full page reference
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(OUT, "voicemail_page_full.png"), fullPage: true });

  await browser.close();
  console.log(`wrote:\n  ${join(OUT, "voicemail_page_top.png")}\n  ${join(OUT, "voicemail_page_bottom.png")}\n  ${join(OUT, "voicemail_page_full.png")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
