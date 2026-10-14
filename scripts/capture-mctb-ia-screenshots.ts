/**
 * Capture MCTB launch-IA pages from production (or any BASE_URL).
 *
 * Usage:
 *   CERT_BROWSER_PASSWORD='…' UI_AGENT_BASE_URL=<production-host> npx tsx scripts/capture-mctb-ia-screenshots.ts
 *   Optional: MCTB_SCREENSHOT_DIR=/opt/cursor/artifacts/screenshots/mctb-ia
 *   Optional: --mobile  (390×844 + open sidebar on overview)
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim();
if (!BASE_URL) {
  console.error("Set UI_AGENT_BASE_URL or BASE_URL (e.g. production app host).");
  process.exit(1);
}
const OUT_DIR =
  process.env.MCTB_SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots/mctb-ia";
const MOBILE = process.argv.includes("--mobile");

/** New launch IA surfaces (post–Setup nav migration). */
const ROUTES: Array<{ slug: string; path: string }> = [
  { slug: "01_overview", path: "/mctb" },
  { slug: "02_missed_calls", path: "/mctb/missed-calls" },
  { slug: "04_conversations", path: "/mctb/conversations" },
  { slug: "05_voicemail_messages", path: "/mctb/voicemail?tab=messages" },
  { slug: "05_voicemail_greeting", path: "/mctb/voicemail?tab=greeting" },
  { slug: "06_analytics", path: "/mctb/analytics" },
  { slug: "10_missed_call_recovery_general", path: "/mctb/missed-call-recovery?tab=general" },
  { slug: "10_missed_call_recovery_rules", path: "/mctb/missed-call-recovery?tab=rules" },
  { slug: "10_missed_call_recovery_consent", path: "/mctb/missed-call-recovery?tab=consent" },
  { slug: "10_missed_call_recovery_exclusions", path: "/mctb/missed-call-recovery?tab=exclusions" },
  { slug: "11_text_back", path: "/mctb/text-back" },
  { slug: "11_text_back_booking", path: "/mctb/text-back?section=booking" },
  { slug: "12_ai_recovery", path: "/mctb/ai-recovery" },
  { slug: "13_notifications", path: "/mctb/notifications" },
  { slug: "14_phone_forwarding", path: "/mctb/phone" },
];

async function dismissOverlays(page: import("playwright").Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  const closeWizard = page.getByRole("button", { name: /close|skip|not now/i }).first();
  if (await closeWizard.isVisible().catch(() => false)) {
    await closeWizard.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function waitForPageReady(page: import("playwright").Page, path: string) {
  await page
    .waitForFunction(
      () => {
        const text = document.body.innerText;
        return (
          !text.includes("Loading setup") &&
          !text.includes("Loading missed call") &&
          !text.includes("Application error")
        );
      },
      { timeout: 60000 },
    )
    .catch(() => undefined);

  const pathOnly = path.split("?")[0];

  if (pathOnly === "/mctb") {
    await page
      .waitForFunction(
        () => !document.querySelector(".mctb-page-inner[aria-busy='true']"),
        { timeout: 60000 },
      )
      .catch(() => undefined);
    await page
      .getByText(/Missed call agenda|Recovery activity|Missed calls today|Overview/i)
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (pathOnly === "/mctb/missed-call-recovery") {
    await page
      .getByRole("tab")
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (pathOnly === "/mctb/text-back") {
    await page
      .getByText(/Text back|Recovery message|Booking/i)
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (pathOnly === "/mctb/voicemail") {
    await page
      .getByRole("tab")
      .first()
      .waitFor({ state: "visible", timeout: 45000 })
      .catch(() => undefined);
  } else if (pathOnly.includes("/mctb/conversations")) {
    await page
      .waitForFunction(() => !document.body.innerText.includes("Loading conversations"), {
        timeout: 90000,
      })
      .catch(() => undefined);
  }

  await page.waitForTimeout(1500);
}

async function captureMobileNav(page: import("playwright").Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/mctb`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dismissOverlays(page);
  await waitForPageReady(page, "/mctb");
  const menu = page.getByRole("button", { name: /menu|open navigation|toggle/i }).first();
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    await page.waitForTimeout(800);
  } else {
    const alt = page.locator('button[aria-label*="menu" i], button[aria-label*="Menu" i]').first();
    if (await alt.isVisible().catch(() => false)) {
      await alt.click();
      await page.waitForTimeout(800);
    }
  }
  const out = join(OUT_DIR, "mctb_mobile_nav_drawer.png");
  await page.screenshot({ path: out, fullPage: false });
  console.log(`  ✓ ${out}`);
}

async function main() {
  if (!process.env.CERT_BROWSER_PASSWORD?.trim() && !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
    console.warn(
      "Using default CERT_BROWSER_PASSWORD from ensure-cert-browser-account — set env for other accounts.",
    );
  }

  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email} at ${BASE_URL}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    storageState: auth.storageState,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/mctb/missed-calls`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await page.waitForTimeout(1500);
    const detailHref = await page
      .locator('table a[href^="/mctb/missed-calls/"], a[href^="/mctb/missed-calls/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    const detailPath = detailHref?.startsWith("/mctb/missed-calls/") ? detailHref : null;

    const allRoutes = [...ROUTES];
    if (detailPath) {
      allRoutes.splice(2, 0, { slug: "03_missed_call_detail", path: detailPath });
    }

    for (const route of allRoutes) {
      const url = `${BASE_URL}${route.path}`;
      console.log(`Capturing ${route.slug} → ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
      await dismissOverlays(page);
      await waitForPageReady(page, route.path);
      const out = join(OUT_DIR, `mctb_${route.slug}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ ${out}`);
    }

    if (MOBILE || process.argv.includes("--with-mobile-nav")) {
      await captureMobileNav(page);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nDone. Screenshots in ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
