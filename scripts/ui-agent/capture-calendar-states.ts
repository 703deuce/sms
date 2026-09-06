#!/usr/bin/env tsx
/** Quick capture of calendar interaction states for review. */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { seedSandboxFromDraft } from "./kimi-persist";
import { startPreviewServer } from "./preview";

const SESSION_ID = "2026-09-06T18-52-01-001Z-ba74e3";
const DRAFT = "src/kimi-drafts/appointments-calendar/2026-09-06T18-52-01-001Z-ba74e3";
const OUT = "/opt/cursor/artifacts/calendar-states";

function port(sessionId: string): number {
  return 5174 + (sessionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 500);
}

async function shot(page: import("playwright").Page, name: string): Promise<string> {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  seedSandboxFromDraft(SESSION_ID, DRAFT);
  const { url, close } = await startPreviewServer(SESSION_ID, port(SESSION_ID));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1200);

    const paths: string[] = [];
    paths.push(await shot(page, "01-week-default.png"));

    await page.getByRole("button", { name: /Initial Consultation/i }).first().click();
    await page.waitForTimeout(400);
    paths.push(await shot(page, "02-appointment-popover.png"));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "New appointment", exact: true }).click();
    await page.waitForTimeout(400);
    paths.push(await shot(page, "03-new-appointment-drawer.png"));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "Calendar settings" }).click();
    await page.waitForTimeout(400);
    paths.push(await shot(page, "04-calendar-settings-modal.png"));

    for (const p of paths) {
      console.log(p);
    }
  } finally {
    await browser.close();
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
