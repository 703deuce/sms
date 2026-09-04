/**
 * Extract headings + key text from appointments master pages.
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

const ROUTES = [
  "/appointments/overview",
  "/appointments/calendar",
  "/appointments",
  "/appointments/types",
  "/appointments/reminders",
  "/appointments/booking",
  "/appointments/setup",
  "/appointments/analytics",
  "/conversations",
  "/contacts",
  "/numbers",
  "/compliance",
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/api/auth/dev-bypass?next=/appointments/overview`);
  await page.waitForTimeout(2000);

  for (const path of ROUTES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const h1 = await page.locator("h1").first().innerText().catch(() => "");
    const h2s = await page.locator("h2").allInnerTexts().catch(() => []);
    const buttons = await page.locator("button").allInnerTexts().catch(() => []);
    const links = await page.locator("a[href]").allInnerTexts().catch(() => []);
    const metrics = await page.locator("[class*='metric'], [data-testid*='metric']").allInnerTexts().catch(() => []);

    console.log(`\n## ${path}`);
    console.log(`Title: ${h1 || "(no h1)"}`);
    if (h2s.length) console.log(`Sections: ${h2s.slice(0, 6).join(" | ")}`);
    const actionBtns = [...new Set(buttons.map((b) => b.trim()).filter((b) => b.length < 40))].slice(0, 8);
    if (actionBtns.length) console.log(`Actions: ${actionBtns.join(", ")}`);
    const subnav = [...new Set(links.map((l) => l.trim()).filter((l) => /calendar|scheduled|types|reminder|booking|setup|analytics/i.test(l)))].slice(0, 8);
    if (subnav.length) console.log(`Subnav: ${subnav.join(", ")}`);
    if (metrics.length) console.log(`Metrics: ${metrics.slice(0, 4).join(" | ")}`);
  }

  await browser.close();
}

main();
