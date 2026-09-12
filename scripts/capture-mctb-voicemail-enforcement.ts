import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR || "/opt/cursor/artifacts/screenshots/mctb-voicemail";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(
    `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb/voicemail")}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(2500);
  await page.setViewportSize({ width: 1440, height: 900 });

  const pagination = page.locator(".mctb-vm-inbox-pagination");
  await pagination.waitFor({ state: "visible", timeout: 60000 }).catch(() => undefined);

  const greetingPreview = page.getByRole("button", { name: "Preview" }).first();
  const previewDisabled = await greetingPreview.isDisabled().catch(() => false);

  await page.screenshot({ path: join(OUT, "enforcement_desktop.png"), fullPage: false });

  const footerText = (await pagination.textContent().catch(() => "")) || "";
  const rowText = (await page.locator(".mctb-vm-row").first().textContent().catch(() => "")) || "";
  const hasSwitch = (await page.locator(".mctb-vm-switch").count()) > 0;

  console.log(
    JSON.stringify(
      {
        paginationVisible: await pagination.isVisible().catch(() => false),
        paginationText: footerText.trim(),
        greetingPreviewDisabled: previewDisabled,
        hasSwitchControls: hasSwitch,
        firstRowSnippet: rowText.slice(0, 120),
        screenshot: join(OUT, "enforcement_desktop.png"),
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
