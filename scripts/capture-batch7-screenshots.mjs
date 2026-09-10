import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const base = process.env.UI_AGENT_BASE_URL || "http://localhost:3000";
const out = "/opt/cursor/artifacts";
mkdirSync(out, { recursive: true });

const shots = [
  ["batch7_recalls", "/appointments/recalls"],
  ["batch7_automations_recall", "/appointments/automations/recall"],
  ["batch7_analytics_revenue", "/appointments/analytics/revenue"],
  ["batch7_analytics_reports", "/appointments/analytics/reports"],
  ["batch7_contacts_segments", "/contacts/segments"],
  ["batch7_contacts_fields", "/contacts/fields"],
  ["batch7_contacts_import", "/contacts/imports"],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

for (const [name, path] of shots) {
  try {
    await page.goto(`${base}/api/auth/dev-bypass?next=${encodeURIComponent(path)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(1200);
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const file = `${out}/${name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log("OK", file);
  } catch (error) {
    console.error("FAIL", name, error instanceof Error ? error.message : error);
  }
}

await browser.close();
