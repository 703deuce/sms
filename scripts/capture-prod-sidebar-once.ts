import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

async function main() {
  const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
  const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";
  mkdirSync(OUT_DIR, { recursive: true });

  if (!process.env.CERT_BROWSER_PASSWORD?.trim() && !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }

  const auth = await authenticate(BASE);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email} at ${BASE}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${BASE}/appointments/scheduled`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(5000);
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click({ timeout: 3000 }).catch(() => {});
  }

  const full = `${OUT_DIR}/transovo-prod-sidebar-appointments-scheduled.png`;
  const clip = `${OUT_DIR}/transovo-prod-sidebar-clip.png`;
  await page.screenshot({ path: full, fullPage: false });
  await page.screenshot({ path: clip, clip: { x: 0, y: 0, width: 300, height: 900 } });
  console.log("saved", full);
  console.log("saved", clip);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
