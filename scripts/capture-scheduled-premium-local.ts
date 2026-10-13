import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

async function main() {
  process.env.DEV_AUTH_BYPASS = "1";
  const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3010";
  const OUT = "/opt/cursor/artifacts/scheduled-list-premium-opus-local.png";
  mkdirSync("/opt/cursor/artifacts", { recursive: true });

  const auth = await authenticate(BASE);
  if (!auth.ok) {
    console.error("auth failed");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/appointments/scheduled`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: OUT, fullPage: false });
  console.log("saved", OUT);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
