/**
 * Remaining 13 screenshot views for AR visual review.
 *
 * UI_AGENT_BASE_URL=<production-host> npx tsx scripts/capture-ar-remaining-13.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";
import { wrapReminderEmailHtml } from "../src/lib/appointment-reminders/reminder-email-html";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/ar-remaining-13";

async function dismissChrome(page: import("playwright").Page) {
  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      // ignore
    }
  });
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function shot(page: import("playwright").Page, slug: string, opts?: { fullPage?: boolean }) {
  const path = join(OUT, `${slug}.png`);
  await page.screenshot({ path, fullPage: opts?.fullPage ?? true });
  console.log(`✓ ${path}`);
}

async function gotoAndWait(page: import("playwright").Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dismissChrome(page);
  await page.waitForTimeout(3500);
}

async function openFirstAppointmentDrawer(page: import("playwright").Page) {
  await gotoAndWait(page, "/appointment-reminders/appointments?date=all&pageSize=25");
  const row = page.locator("table tbody tr").first();
  if (!(await row.isVisible().catch(() => false))) {
    console.warn("No appointment rows — drawer tabs skipped");
    return false;
  }
  await row.click();
  await page.locator("[data-slot='sheet-content']").waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1500);
  return true;
}

async function clickDrawerTab(page: import("playwright").Page, label: string) {
  const tab = page.getByRole("tab", { name: label });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(1200);
  }
}

async function main() {
  if (!process.env.CERT_BROWSER_PASSWORD?.trim()) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }
  const auth = await certAuthenticate(BASE);
  if (!auth.ok) process.exit(1);

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
    ignoreHTTPSErrors: true,
  });

  // 1 Business profile
  await gotoAndWait(page, "/appointment-reminders/settings?tab=business");
  await shot(page, "01-settings-business-profile");

  // 2 Analytics
  await gotoAndWait(page, "/appointment-reminders/analytics");
  await shot(page, "02-analytics");

  // 3 Onboarding Activate
  await gotoAndWait(page, "/appointment-reminders/setup/activate");
  await shot(page, "03-onboarding-activate");

  // 4–6 Appointment drawer tabs
  const hasDrawer = await openFirstAppointmentDrawer(page);
  if (hasDrawer) {
    await clickDrawerTab(page, "Reminders");
    await shot(page, "04-appointment-tab-reminders", { fullPage: false });
    await clickDrawerTab(page, "Activity");
    await shot(page, "05-appointment-tab-activity", { fullPage: false });
    await clickDrawerTab(page, "Preferences");
    await shot(page, "06-appointment-tab-preferences", { fullPage: false });
  }

  // 7 Email template preview
  await gotoAndWait(page, "/appointment-reminders/settings?tab=templates");
  const channelSelect = page.getByLabel("Channel");
  if (await channelSelect.isVisible().catch(() => false)) {
    await channelSelect.click();
    await page.getByRole("option", { name: "Email", exact: true }).click();
    await page.waitForTimeout(1500);
  }
  const previewBtn = page.getByRole("button", { name: "Preview" }).first();
  if (await previewBtn.isVisible().catch(() => false)) {
    await previewBtn.click();
    await page.locator("[data-slot='sheet-content']").waitFor({ state: "visible", timeout: 20000 });
    await page.waitForTimeout(2000);
    await shot(page, "07-settings-email-template-preview", { fullPage: false });
  } else {
    await shot(page, "07-settings-email-template-preview-missing");
  }

  // 8 Customer email HTML (production renderer; ICS is attached at send time)
  const sampleHtml = wrapReminderEmailHtml({
    businessName: "Cert Browser Spa",
    bodyHtml:
      "<p>Hi Alex,</p><p>This is a reminder for your <strong>Deep tissue massage</strong> on <strong>Tuesday, March 18 at 2:00 PM</strong>.</p>",
    branding: {
      brandColor: "#0d9488",
      contactPhone: "+1 (703) 555-0142",
      directionsUrl: "https://maps.example.com",
      footerText: "Reply STOP to opt out of reminders.",
    },
    preparationInstructions: "Arrive 10 minutes early and wear comfortable clothing.",
    cancellationPolicyText: "Cancel at least 24 hours in advance to avoid a fee.",
    actionLinks: {
      confirm: "https://example.com/confirm",
      reschedule: "https://example.com/reschedule",
      cancel: "https://example.com/cancel",
    },
  });
  const htmlPath = join(OUT, "08-customer-email-sample.html");
  writeFileSync(
    htmlPath,
    `${sampleHtml}\n<!-- appointment.ics attached on outbound email (see reminder-engine.ts) -->`,
  );
  await page.setContent(sampleHtml, { waitUntil: "load" });
  await page.waitForTimeout(500);
  await shot(page, "08-customer-email-preview", { fullPage: false });

  // 9 Reminders log — open first row
  await gotoAndWait(page, "/appointment-reminders/reminders?horizon=all&status=all");
  const remRow = page.locator("table tbody tr").first();
  if (await remRow.isVisible().catch(() => false)) {
    await remRow.click();
    await page.locator("[data-slot='sheet-content']").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(1000);
    await shot(page, "09-reminders-open-reminder", { fullPage: false });
  } else {
    await shot(page, "09-reminders-empty");
  }

  // 10 Integrations
  await gotoAndWait(page, "/appointment-reminders/settings?tab=integrations");
  await shot(page, "10-settings-integrations");

  // 11 Scheduling scroll down
  await gotoAndWait(page, "/appointment-reminders/settings?tab=scheduling");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await shot(page, "11-settings-scheduling-scrolled");

  // 12 Held SMS replies (conversation thread lives on appointment Activity / shared inbox when routed)
  await gotoAndWait(page, "/appointment-reminders/held-inbound");
  await shot(page, "12-held-sms-replies");
  // If inbox has threads, try conversations filtered view
  await gotoAndWait(page, "/conversations");
  const firstThread = page.locator('[data-testid="conversation-row"], [role="row"], a[href*="/conversations/"]').first();
  if (await firstThread.isVisible().catch(() => false)) {
    await firstThread.click();
    await page.waitForTimeout(2000);
    await shot(page, "12b-conversations-thread", { fullPage: false });
  }

  // 13 Full reminder sequence
  await gotoAndWait(page, "/appointment-reminders/settings?tab=sequence");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await shot(page, "13-settings-reminder-sequence-full");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  await shot(page, "13-settings-reminder-sequence-scrolled");

  await browser.close();
  console.log("done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
