/**
 * Reminders page screenshots.
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-reminders-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
const AUTH_EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || "appt-mctb-browser@transovo.test";

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function authenticate(page: Page, next = "/appointments/reminders") {
  const bypass = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent(next)}`;
  const res = await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (res && res.status() >= 400) throw new Error(`dev-bypass failed HTTP ${res.status()}`);
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
}

async function waitLoaded(page: Page) {
  await page.waitForSelector(".ws-event-title", { timeout: 90000 });
  await page.waitForFunction(
    () => !document.body.textContent?.includes("Could not load reminder"),
    undefined,
    { timeout: 90000 },
  );
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: true });
  console.log("wrote", path);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await authenticate(page);
    await waitLoaded(page);
    await shot(page, "reminders-01-overview.png");

    await page.goto(`${BASE}/appointments/reminders?section=sequence`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitLoaded(page);
    await shot(page, "reminders-02-sequence.png");

    const editBtn = page.getByRole("button", { name: "Edit" }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForTimeout(800);
      await shot(page, "reminders-03-edit-drawer.png");
      await page.getByRole("button", { name: "Close" }).click().catch(() => page.keyboard.press("Escape"));
    }

    await page.goto(`${BASE}/appointments/reminders?section=assignment`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitLoaded(page);
    await shot(page, "reminders-04-assignment.png");

    await page.goto(`${BASE}/appointments/reminders?section=activity`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitLoaded(page);
    await shot(page, "reminders-05-activity.png");

    await page.goto(`${BASE}/appointments/reminders?section=settings`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitLoaded(page);
    await shot(page, "reminders-06-settings.png");

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await authenticate(mobile, "/appointments/reminders?section=sequence");
    await waitLoaded(mobile);
    await shot(mobile, "reminders-07-sequence-mobile.png");
    await mobile.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
