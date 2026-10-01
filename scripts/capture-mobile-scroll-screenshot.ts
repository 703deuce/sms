import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (let i = 0; i < 24; i++) {
    const code = await page.goto(`${BASE}/api/health`, { waitUntil: "commit", timeout: 15_000 }).catch(() => null);
    if (code) break;
    await page.waitForTimeout(5000);
  }
  await page.goto(`${BASE}/mctb/setup`, { waitUntil: "commit", timeout: 180_000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const el = document.querySelector("[data-slot='sidebar-inset'] > div:last-child") as HTMLElement | null;
    if (el) el.scrollTop = 500;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/mctb-setup-mobile-scrolled.png`, fullPage: false });
  await browser.close();
  console.log(`saved ${OUT}/mctb-setup-mobile-scrolled.png`);
}

void main();
