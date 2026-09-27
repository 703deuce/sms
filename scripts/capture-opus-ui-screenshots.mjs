#!/usr/bin/env node
/**
 * One-off: capture Opus transplant shell screenshots (desktop + mobile).
 * Requires local dev with DEV_AUTH_BYPASS=1.
 */
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3001";
const OUT = process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts";

const routes = [
  { name: "opus-mctb-missed-calls", path: "/mctb/missed-calls" },
  { name: "opus-mctb-setup", path: "/mctb/setup" },
  { name: "opus-voice-overview", path: "/voice/overview" },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await desktop.newPage();
  await page.goto(`${BASE}/api/auth/dev-bypass?next=/mctb/missed-calls`, { waitUntil: "networkidle" });
  if (page.url().includes("/login")) {
    console.error("Dev bypass failed — still on login");
    process.exit(1);
  }

  for (const r of routes) {
    await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUT, `${r.name}-desktop.png`),
      fullPage: true,
    });
    console.log("wrote", `${r.name}-desktop.png`);
  }

  const iphone = devices["iPhone 13"];
  const mobile = await browser.newContext({ ...iphone });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/api/auth/dev-bypass?next=/mctb/missed-calls`, { waitUntil: "networkidle" });
  await mpage.goto(`${BASE}/mctb/missed-calls`, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(1500);
  await mpage.screenshot({
    path: path.join(OUT, "opus-mctb-missed-calls-mobile.png"),
    fullPage: true,
  });
  console.log("wrote opus-mctb-missed-calls-mobile.png");

  const trigger = mpage.locator('[data-sidebar="trigger"], button').filter({ hasText: /menu/i }).first();
  const sidebarBtn = mpage.locator('button[data-sidebar="trigger"]').first();
  if (await sidebarBtn.count()) {
    await sidebarBtn.click();
    await mpage.waitForTimeout(800);
    await mpage.screenshot({
      path: path.join(OUT, "opus-mobile-sidebar-sheet.png"),
      fullPage: false,
    });
    console.log("wrote opus-mobile-sidebar-sheet.png");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
