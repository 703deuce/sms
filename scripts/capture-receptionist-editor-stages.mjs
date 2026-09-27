#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3002";
const OUT =
  process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/receptionist-editor-opus-screenshots";
const AUTH_EMAIL = process.env.SCREENSHOT_AUTH_EMAIL || "alex@harborhome.co";
const STAGES = [
  { file: "01-identity-conversation", label: /Identity & Conversation/ },
  { file: "02-responsibilities-call-flow", label: /Responsibilities & Call Flow/ },
  { file: "03-review-test", label: /Review & Test/ },
];

async function waitForEditor(page) {
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || "";
      return (
        t.includes("Identity & Conversation") &&
        t.includes("Configure how your AI receptionist") &&
        !t.includes("Loading receptionist")
      );
    },
    { timeout: 180000 },
  );
}

async function gotoStage(page, label) {
  await page.getByRole("button", { name: label }).click();
  await page.waitForTimeout(2000);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loginUrl = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(
    AUTH_EMAIL,
  )}&next=${encodeURIComponent("/voice/receptionist/edit")}`;
  const loginRes = await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!loginRes || loginRes.status() >= 400) {
    throw new Error(`Cert login failed: ${loginRes?.status()}`);
  }

  await waitForEditor(page);
  await page.waitForTimeout(3000);

  for (const s of STAGES) {
    await gotoStage(page, s.label);
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
