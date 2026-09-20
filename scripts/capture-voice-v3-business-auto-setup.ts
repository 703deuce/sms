/**
 * Capture Appointment Receptionist auto-setup panel (desktop + mobile).
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-voice-v3-business-auto-setup.ts
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3000";
/** Must be a user with at least one workspace membership in the linked DB. */
const AUTH_EMAIL =
  process.env.DEV_AUTH_BYPASS_EMAIL ||
  process.env.UI_AGENT_SMOKE_EMAIL ||
  "alex@harborhome.co";
const OUT = process.env.CAPTURE_OUT || "/opt/cursor/artifacts/voice-v3-business-auto-setup";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    const next = "/mctb/voice-agent?step=information";
    const bypass = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent(next)}`;
    const res = await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120_000 });
    if (!res || res.status() >= 400) {
      throw new Error(`dev-bypass failed HTTP ${res?.status()}`);
    }
    await page.getByText(/Auto-setup from website/i).waitFor({ timeout: 90_000 });
    await page.screenshot({ path: path.join(OUT, `${viewport.name}-01-auto-setup.png`), fullPage: true });

    const searchInput = page.getByLabel(/find your business on google/i);
    await searchInput.fill("plumber woodbridge nj");
    await page.locator("#biz-search").locator("..").getByRole("button", { name: /^search$/i }).click();
    await page
      .getByRole("listbox", { name: /business search results/i })
      .getByRole("option")
      .first()
      .waitFor({ timeout: 60_000 })
      .catch(() => page.getByText(/couldn't find a match/i).waitFor({ timeout: 5_000 }));
    await page.screenshot({ path: path.join(OUT, `${viewport.name}-02-google-search.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  console.log(`Captures written to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
