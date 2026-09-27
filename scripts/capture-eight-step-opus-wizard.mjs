#!/usr/bin/env node
/**
 * Screenshots: 8-step appointment receptionist wizard (Opus presentation) on /voice/receptionist/edit
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3002";
const OUT =
  process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/eight-step-opus-wizard";
const AUTH_EMAIL = process.env.SCREENSHOT_AUTH_EMAIL || process.env.DEV_AUTH_BYPASS_EMAIL || "alex@harborhome.co";

const STEPS = [
  { file: "01-goals", label: "Goals" },
  { file: "02-phone", label: "Phone" },
  { file: "03-information", label: "Information" },
  { file: "04-appointments", label: "Appointments" },
  { file: "05-call-handling", label: "Call Handling" },
  { file: "06-voice", label: "Voice" },
  { file: "07-test", label: "Test" },
  { file: "08-activate", label: "Activate" },
];

async function waitForWizard(page) {
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || "";
      return (
        t.includes("AI receptionist setup") &&
        t.includes("Goals") &&
        !t.includes("Application error")
      );
    },
    { timeout: 180000 },
  );
}

async function gotoStep(page, index) {
  const nav = page.locator('nav[aria-label="Setup progress"]');
  const btn = nav.locator("li button").nth(index);
  await btn.click({ timeout: 60000 });
  await page.waitForTimeout(2500);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loginUrl = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(
    AUTH_EMAIL,
  )}&next=${encodeURIComponent("/voice/receptionist/edit")}`;
  const loginRes = await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 180000 });
  if (!loginRes || loginRes.status() >= 400) {
    throw new Error(`dev-bypass failed: ${loginRes?.status()} ${loginRes?.statusText()}`);
  }

  await waitForWizard(page);
  await page.waitForTimeout(2000);

  for (let i = 0; i < STEPS.length; i++) {
    const s = STEPS[i];
    await gotoStep(page, i);
    const file = path.join(OUT, `${s.file}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("OK", s.file, "->", file);
  }

  await browser.close();
  console.log("Done:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
