/**
 * Production screenshots for unified scheduling routes (transovo.ai).
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-unified-scheduling-prod-screens.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/unified-scheduling-prod";

/** Matrix rows still marked legacy / not full native Opus replacement */
const NOT_FULL_OPUS: Array<{ slug: string; path: string; label: string }> = [
  { slug: "booking-share", path: "/appointments/booking/share", label: "Booking share (legacy)" },
  { slug: "reminder-sequences", path: "/appointment-reminders/reminders/sequences", label: "Reminder sequences" },
  { slug: "reminder-templates", path: "/appointment-reminders/reminders/templates", label: "Reminder templates" },
  { slug: "payments", path: "/payments", label: "Payments" },
  { slug: "team-booking", path: "/appointments/team-booking", label: "Team booking (embed)" },
  { slug: "meeting-polls", path: "/appointments/meeting-polls", label: "Meeting polls (embed)" },
  { slug: "ai-booking", path: "/appointments/ai-booking", label: "AI booking (embed)" },
  { slug: "pricing-payments", path: "/appointments/pricing-payments", label: "Pricing & payments (embed)" },
  { slug: "point-of-sale", path: "/appointments/point-of-sale", label: "Point of sale (embed)" },
  { slug: "recalls", path: "/appointments/recalls", label: "Recalls (embed)" },
  { slug: "ar-analytics", path: "/appointment-reminders/analytics", label: "AR analytics (legacy)" },
  { slug: "integrations-calendars", path: "/integrations/calendars", label: "Integrations calendars" },
  { slug: "policies", path: "/appointments/policies", label: "Policies (embed)" },
  { slug: "voice-reminders", path: "/appointments/voice-reminders", label: "Voice reminders (embed)" },
  { slug: "automations-activity", path: "/appointments/automations/activity", label: "Automation activity (embed)" },
];

/** Native Opus surfaces (contrast) */
const OPUS_COMPLETE: Array<{ slug: string; path: string; label: string }> = [
  { slug: "staff", path: "/appointments/staff", label: "Staff Opus" },
  { slug: "clients", path: "/appointments/clients", label: "Clients Opus" },
  { slug: "scheduled", path: "/appointments/scheduled", label: "Scheduled Opus" },
  { slug: "availability", path: "/appointments/availability", label: "Availability Opus shell" },
  { slug: "packages", path: "/appointments/packages", label: "Packages Opus shell" },
];

async function dismissChrome(page: import("playwright").Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click({ timeout: 3000 }).catch(() => {});
}

async function captureRoute(
  page: import("playwright").Page,
  item: { slug: string; path: string; label: string },
  prefix: string,
) {
  const url = `${BASE_URL}${item.path}`;
  console.log(`→ ${item.label}: ${url}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    await dismissChrome(page);
    await page.waitForTimeout(500);
    const path = join(OUT_DIR, `${prefix}-${item.slug}.png`);
    await page.screenshot({ path, fullPage: false });
    console.log(`  saved ${path}`);
  } catch (e) {
    console.warn(`  failed ${item.slug}:`, e instanceof Error ? e.message : e);
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

  for (const item of NOT_FULL_OPUS) {
    await captureRoute(page, item, "legacy-not-full-opus");
  }
  for (const item of OPUS_COMPLETE) {
    await captureRoute(page, item, "opus");
  }

  await browser.close();
  console.log(`Done. Screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
