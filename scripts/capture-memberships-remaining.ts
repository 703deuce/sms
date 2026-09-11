import { join } from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/opt/cursor/artifacts/screenshots";
const EMAIL = "appt-mctb-browser@transovo.test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(
    `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(EMAIL)}&next=${encodeURIComponent("/appointments/memberships")}`,
  );
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click().catch(() => undefined);

  const listRes = await page.request.get(`${BASE}/api/appointments/service-booking/memberships`);
  const listJson = (await listRes.json()) as { data?: Array<{ id: string }> };
  const id = listJson.data?.[0]?.id;
  if (!id) throw new Error("no membership");

  for (const [section, file] of [
    ["lifecycle", "memberships-editor-lifecycle.png"],
    ["activity", "memberships-editor-activity.png"],
  ] as const) {
    await page.goto(`${BASE}/appointments/memberships/${id}?section=${section}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".ws-section-tabs", { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, file), fullPage: false });
    console.log(`saved ${file}`);
  }

  await page.goto(`${BASE}/appointments/memberships/new`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "memberships-wizard-basics.png"), fullPage: false });
  console.log("saved memberships-wizard-basics.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
