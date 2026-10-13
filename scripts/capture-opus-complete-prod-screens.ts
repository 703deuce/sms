/**
 * Production screenshots — routes marked opus_complete only.
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-opus-complete-prod-screens.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/opus-complete-prod";

const OPUS_COMPLETE: Array<{ slug: string; path: string }> = [
  { slug: "01-scheduled-list", path: "/appointments/scheduled" },
  { slug: "02-new-appointment", path: "/appointments/new" },
  { slug: "03-clients-directory", path: "/appointments/clients" },
  { slug: "04-staff", path: "/appointments/staff" },
  { slug: "05-locations", path: "/appointments/locations" },
  { slug: "06-resources", path: "/appointments/resources" },
  { slug: "07-services", path: "/appointments/services" },
  { slug: "08-meetings", path: "/appointments/meetings" },
  { slug: "09-ar-reminders", path: "/appointment-reminders/reminders" },
  { slug: "10-ar-responses", path: "/appointment-reminders/responses" },
  { slug: "11-ar-ai-rescheduler", path: "/appointment-reminders/ai-rescheduler" },
  { slug: "12-ar-booking-meetings", path: "/appointment-reminders/booking/meetings" },
];

async function dismissChrome(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click({ timeout: 3000 }).catch(() => {});
  }
}

async function capture(page: Page, slug: string, path: string) {
  const url = `${BASE_URL}${path}`;
  console.log(`→ ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(3000);
  await dismissChrome(page);
  const out = join(OUT_DIR, `${slug}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`  saved ${out}`);
}

async function tryCaptureDetailPages(page: Page) {
  await page.goto(`${BASE_URL}/appointments/clients`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2000);
  const clientLink = page.locator("a[href^='/appointments/clients/']").first();
  if (await clientLink.isVisible().catch(() => false)) {
    await clientLink.click();
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: join(OUT_DIR, "13-client-detail.png"),
      fullPage: false,
    });
    console.log("  saved client detail");
  }

  await page.goto(`${BASE_URL}/appointments/scheduled`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2000);
  const apptLink = page.locator("a[href^='/appointments/']").filter({ hasNotText: /new|clients|scheduled|services|meetings/ }).first();
  const href = await apptLink.getAttribute("href").catch(() => null);
  if (href && /^\/appointments\/[^/]+$/.test(href)) {
    await page.goto(`${BASE_URL}${href}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: join(OUT_DIR, "14-appointment-detail.png"),
      fullPage: false,
    });
    console.log("  saved appointment detail");
  }
}

async function main() {
  if (
    !process.env.CERT_BROWSER_PASSWORD?.trim() &&
    !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()
  ) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }

  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email} at ${BASE_URL}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      /* ignore */
    }
  });

  for (const { slug, path } of OPUS_COMPLETE) {
    try {
      await capture(page, slug, path);
    } catch (e) {
      console.warn(`  failed ${slug}:`, e instanceof Error ? e.message : e);
    }
  }

  try {
    await tryCaptureDetailPages(page);
  } catch (e) {
    console.warn("detail pages skipped:", e instanceof Error ? e.message : e);
  }

  await browser.close();
  console.log(`Done → ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
