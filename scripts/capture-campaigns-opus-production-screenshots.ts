/**
 * Capture Campaigns service screens from production (Opus UI).
 *
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-campaigns-opus-production-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR =
  process.env.CAMPAIGN_SCREENSHOT_DIR || "/opt/cursor/artifacts/campaigns-opus-prod";

const ROUTES = [
  { slug: "campaigns-home", path: "/campaigns" },
  { slug: "campaigns-all", path: "/campaigns/all" },
  { slug: "campaigns-drafts", path: "/campaigns/drafts" },
  { slug: "campaigns-scheduled", path: "/campaigns/scheduled" },
  { slug: "campaigns-completed", path: "/campaigns/completed" },
  { slug: "campaigns-sending", path: "/campaigns/sending" },
  { slug: "campaigns-paused", path: "/campaigns/paused" },
  { slug: "campaigns-failed", path: "/campaigns/failed" },
  { slug: "campaigns-canceled", path: "/campaigns/canceled" },
  { slug: "campaigns-recurring", path: "/campaigns/recurring" },
  { slug: "campaigns-calendar", path: "/campaigns/calendar" },
  { slug: "campaigns-new", path: "/campaigns/new" },
  { slug: "campaigns-new-review", path: "/campaigns/new/review" },
  { slug: "campaigns-new-queue", path: "/campaigns/new/queue" },
  { slug: "campaigns-new-success", path: "/campaigns/new/success?mode=now" },
  { slug: "templates", path: "/templates" },
  { slug: "sms-analytics", path: "/sms/analytics" },
];

async function main() {
  if (
    !process.env.CERT_BROWSER_PASSWORD?.trim() &&
    !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()
  ) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
    console.warn("Using default cert browser password — set CERT_BROWSER_PASSWORD for other accounts.");
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

  const dismissChrome = async () => {
    await page.evaluate(() => {
      try {
        window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
      } catch {
        // ignore
      }
    });
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click();
      await page.waitForTimeout(300);
    }
  };

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    console.log(`Capturing ${route.slug} → ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await dismissChrome();
      await page.waitForTimeout(3500);
      const out = join(OUT_DIR, `${route.slug}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`  ✓ ${out}`);
    } catch (err) {
      console.error(`  ✗ ${route.slug}:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  console.log(`Done. Screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
