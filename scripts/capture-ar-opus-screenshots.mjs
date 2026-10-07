#!/usr/bin/env node
/**
 * Capture Appointment Reminders Opus pages (requires DEV_AUTH_BYPASS on dev server).
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://127.0.0.1:3000 node scripts/capture-ar-opus-screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const base = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const outDir = "/opt/cursor/artifacts/ar-opus-pages";

const routes = [
  { name: "01-overview", path: "/appointment-reminders" },
  { name: "02-appointments", path: "/appointment-reminders/appointments" },
  { name: "03-reminders-log", path: "/appointment-reminders/reminders" },
  { name: "04-calendars", path: "/appointment-reminders/calendars" },
  { name: "05-settings", path: "/appointment-reminders/settings" },
  { name: "05b-ai-rescheduler", path: "/appointment-reminders/ai-rescheduler" },
  { name: "06-setup-connect", path: "/appointment-reminders/setup/connect" },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${base}/api/auth/dev-bypass`, { waitUntil: "networkidle", timeout: 120_000 });

  for (const route of routes) {
    await page.goto(`${base}${route.path}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const file = join(outDir, `${route.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("wrote", file);
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
