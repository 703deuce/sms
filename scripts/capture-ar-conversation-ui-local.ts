/**
 * Local screenshots: AR Overview + Responses conversation thread.
 * UI_AGENT_BASE_URL=http://127.0.0.1:3000 AR_SCREENSHOT_DEV_BYPASS=1 npx tsx scripts/capture-ar-conversation-ui-local.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3000";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/api/auth/dev-bypass?next=/appointment-reminders/overview`, {
    waitUntil: "commit",
    timeout: 120_000,
  });

  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      // ignore
    }
  });

  await page.goto(`${BASE_URL}/appointment-reminders/overview`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT_DIR, "ar-overview-conversations-verify.png"), fullPage: true });

  await page.goto(`${BASE_URL}/appointment-reminders/responses`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT_DIR, "ar-responses-list-verify.png"), fullPage: true });

  const openBtn = page.getByRole("button", { name: /read conversation/i }).first();
  const row = page.getByRole("row").nth(1);
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
  } else if (await row.isVisible().catch(() => false)) {
    await row.click();
  }
  await page.waitForTimeout(1500);
  const sheet = page.getByRole("dialog").or(page.locator('[data-state="open"]'));
  if (await sheet.first().isVisible().catch(() => false)) {
    await page.screenshot({ path: join(OUT_DIR, "ar-conversation-thread-verify.png"), fullPage: false });
  }

  await browser.close();
  console.log("capture-ar-conversation-ui-local: wrote screenshots to", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
