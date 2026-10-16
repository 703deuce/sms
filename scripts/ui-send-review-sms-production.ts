/**
 * Front-end path: fill Review Requests form and click Send SMS (production).
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/ui-send-review-sms-production.ts
 */
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

async function main() {
  const base = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
  const phone = process.env.CERT_PHONE?.trim() || "5714776175";
  const auth = await authenticate(base);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ storageState: auth.storageState, viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/reviews/requests`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(3000);
  await page.getByPlaceholder("e.g. Jane Smith").fill("UI review front-end Oct 15");
  await page.locator('button:has-text("sms")').first().click();
  await page.getByPlaceholder("(555) 123-4567").fill(phone);
  await page.getByRole("button", { name: /^send sms$/i }).click();
  await page.waitForTimeout(15000);
  const body = await page.locator("body").innerText();
  const ok =
    (/review request sent|sms sent|successfully/i.test(body) || /sent to/i.test(body)) &&
    !/failed|500|error/i.test(body);
  await page.screenshot({ path: "/opt/cursor/artifacts/ui-review-sms-send-result.png", fullPage: false });
  console.log(ok ? "PASS" : "FAIL", body.slice(0, 400).replace(/\s+/g, " "));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
