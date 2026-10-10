/**
 * Capture production screenshots for the three previously broken AR routes.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE = process.env.UI_AGENT_BASE_URL?.trim();
if (!BASE) {
  console.error("Set UI_AGENT_BASE_URL");
  process.exit(1);
}
const OUT = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/ar-fixed-production";

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
  });

  const routes = [
    ["01-settings-business-profile", "/appointment-reminders/settings?tab=business"],
    ["02-analytics", "/appointment-reminders/analytics"],
    ["03-onboarding-activate", "/appointment-reminders/setup/activate"],
  ] as const;

  for (const [slug, path] of routes) {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.evaluate(() => {
      try {
        localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
      } catch {
        // ignore
      }
    });
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
    await page.waitForTimeout(4500);
    const bad = await page.getByText(/This page couldn.t load/i).isVisible().catch(() => false);
    const h1 = await page.locator("h1").first().textContent().catch(() => "");
    console.log(slug, { errorPage: bad, h1: (h1 || "").slice(0, 80), jsErrors: errors.slice(0, 3) });
    await page.screenshot({ path: join(OUT, `${slug}.png`), fullPage: true });
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
