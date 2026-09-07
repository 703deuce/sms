import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots/decorative-rollout";

const routes: Array<[string, string]> = [
  ["/mctb", "mctb_overview"],
  ["/mctb/missed-calls", "mctb_missed_calls"],
  ["/mctb/analytics", "mctb_analytics"],
  ["/mctb/setup", "mctb_setup"],
  ["/appointments/overview", "appt_overview"],
  ["/appointments/calendar", "appt_calendar"],
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/api/auth/dev-bypass`);
  for (const [path, name] of routes) {
    console.log(`Capturing ${path}`);
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`  ✓ ${OUT}/${name}.png`);
  }
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
