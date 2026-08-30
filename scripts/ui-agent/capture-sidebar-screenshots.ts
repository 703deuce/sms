import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { generatedDirForSession } from "./generated-sandbox";
import { startPreviewServer } from "./preview";

const SESSION_ID = "2026-08-30T22-24-04-122Z-b95821";
const OUT_DIR = "/opt/cursor/artifacts/kimi_sidebar";

async function capture(label: string, beforeShot: (page: import("playwright").Page) => Promise<void>): Promise<string> {
  const { url, close } = await startPreviewServer(SESSION_ID);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    await beforeShot(page);
    await page.waitForTimeout(300);
    const out = join(OUT_DIR, `${label}.png`);
    await page.screenshot({ path: out, fullPage: false });
    return out;
  } finally {
    await browser.close();
    await close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const generatedDir = generatedDirForSession(SESSION_ID);

  const expanded = await capture("01_sidebar_expanded", async () => {});
  copyFileSync(expanded, join(generatedDir, "screenshot-expanded.png"));

  const collapsed = await capture("02_sidebar_collapsed", async (page) => {
    await page.getByTitle("Collapse sidebar").click();
  });
  copyFileSync(collapsed, join(generatedDir, "screenshot-collapsed.png"));

  console.log("Expanded:", expanded);
  console.log("Collapsed:", collapsed);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
