import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-setup";

const VIEWPORTS: Array<{ name: string; width: number; height: number }> = [
  { name: "exclusions_desktop_1440", width: 1440, height: 900 },
  { name: "exclusions_desktop_1280", width: 1280, height: 800 },
  { name: "exclusions_tablet_1024", width: 1024, height: 768 },
  { name: "exclusions_mobile_390", width: 390, height: 844 },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb/setup/exclusions")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForURL(/\/mctb\/setup\/exclusions/, { timeout: 120000 });
  await page
    .locator(".mctb-excl-status-strip, .mctb-excl-empty, button:has-text('Retry')")
    .first()
    .waitFor({ state: "visible", timeout: 120000 });
  await page.waitForTimeout(1200);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);
    const file = join(OUT, `${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: vp.width < 900 });
    console.log(`wrote ${file}`);
  }

  const addBtn = page.getByRole("button", { name: "Add exclusion" }).first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.locator(".mctb-excl-modal").waitFor({ state: "visible" });
    await page.screenshot({
      path: join(OUT, "exclusions_add_modal_1440.png"),
      fullPage: false,
    });
    console.log(`wrote ${join(OUT, "exclusions_add_modal_1440.png")}`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
