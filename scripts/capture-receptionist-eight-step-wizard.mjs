#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3002";
const OUT =
  process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/receptionist-eight-step-wizard";
const AUTH_EMAIL = process.env.SCREENSHOT_AUTH_EMAIL || "alex@harborhome.co";

const STEPS = [
  { file: "01-goals", step: "goals" },
  { file: "02-phone", step: "phone" },
  { file: "03-information", step: "information" },
  { file: "04-appointments", step: "appointments" },
  { file: "05-call-handling", step: "call-handling" },
  { file: "06-voice", step: "voice" },
  { file: "07-test", step: "test" },
  { file: "08-activate", step: "activate" },
];

async function waitForWizard(page) {
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || "";
      return t.includes("Receptionist") && !t.includes("Loading receptionist");
    },
    { timeout: 180000 },
  );
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loginUrl = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(
    AUTH_EMAIL,
  )}&next=${encodeURIComponent("/voice/receptionist/edit?step=goals")}`;
  const loginRes = await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!loginRes || loginRes.status() >= 400) {
    throw new Error(`Login failed: ${loginRes?.status()}`);
  }

  await waitForWizard(page);
  await page.waitForTimeout(2000);

  for (const s of STEPS) {
    await page.goto(`${BASE}/voice/receptionist/edit?step=${s.step}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await waitForWizard(page);
    await page.waitForTimeout(2500);
    const file = path.join(OUT, `${s.file}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log("OK", s.file);
  }

  await browser.close();
  console.log("Done:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
