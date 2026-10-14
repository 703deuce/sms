import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3010";
const out = "/opt/cursor/artifacts/screenshots/mctb-overview-agenda-layout.png";

async function main() {
  mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/api/auth/dev-bypass`, { waitUntil: "networkidle", timeout: 120000 }).catch(() => undefined);
  await page.goto(`${BASE}/mctb`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  await page
    .getByText(/Missed call agenda|Recovery activity/i)
    .first()
    .waitFor({ timeout: 60000 })
    .catch(() => undefined);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`saved ${out}`);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
