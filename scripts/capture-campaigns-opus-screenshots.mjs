#!/usr/bin/env node
/**
 * Capture Campaigns service screens (Opus UI) for visual verification.
 * Usage: UI_AGENT_BASE_URL=http://localhost:3000 DEV_AUTH_BYPASS=1 node scripts/capture-campaigns-opus-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3000";
const OUT = process.env.CAMPAIGN_SCREENSHOT_DIR || "/opt/cursor/artifacts/campaigns-opus-screens";

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
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  if (process.env.DEV_AUTH_BYPASS === "1") {
    await context.addCookies([
      {
        name: "dev-auth-bypass",
        value: "1",
        domain: new URL(BASE).hostname,
        path: "/",
      },
    ]);
  }

  const page = await context.newPage();

  for (const { slug, path: routePath } of ROUTES) {
    const url = `${BASE}${routePath}`;
    console.log(`Capturing ${slug} → ${url}`);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.waitForTimeout(2500);
      const file = path.join(OUT, `${slug}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  saved ${file}`);
    } catch (err) {
      console.error(`  FAILED ${slug}:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  console.log(`Done. Screenshots in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
