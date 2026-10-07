/**
 * Capture Appointment Reminders Opus pages from production.
 *
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-ar-opus-production-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/ar-opus-pages";

const ROUTES = [
  { slug: "01-overview", path: "/appointment-reminders" },
  { slug: "02-appointments", path: "/appointment-reminders/appointments" },
  { slug: "03-reminders", path: "/appointment-reminders/reminders" },
  { slug: "04-calendars", path: "/appointment-reminders/calendars" },
  { slug: "05-settings", path: "/appointment-reminders/settings" },
  { slug: "06-setup-connect", path: "/appointment-reminders/setup/connect" },
];

async function main() {
  if (process.env.AR_SCREENSHOT_DEV_BYPASS?.trim() === "1") {
    process.env.DEV_AUTH_BYPASS = "1";
    delete process.env.DEV_AUTH_BYPASS_EMAIL;
  }
  const useBypass =
    process.env.DEV_AUTH_BYPASS?.trim() === "1" ||
    process.env.DEV_AUTH_BYPASS?.trim()?.toLowerCase() === "true";
  if (
    !useBypass &&
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

  for (const route of ROUTES) {
    const url = `${BASE_URL}${route.path}`;
    console.log(`Capturing ${route.slug} → ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2500);
    const out = join(OUT_DIR, `${route.slug}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`  ✓ ${out}`);
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
