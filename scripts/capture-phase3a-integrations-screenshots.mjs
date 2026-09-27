#!/usr/bin/env node
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3001";
const OUT = process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/phase3a-screenshots";
const AUTH_EMAIL = process.env.SCREENSHOT_AUTH_EMAIL || "alex@harborhome.co";
const TOKEN = "transovo-smoke-bootstrap-b56f-aug2026";

const routes = [
  { name: "integrations-home", path: "/integrations" },
  { name: "integrations-native-tasks", path: "/integrations/native/tasks" },
  { name: "integrations-native-orders", path: "/integrations/native/orders" },
  { name: "integrations-native-appointments", path: "/integrations/native/appointments" },
  { name: "integrations-native-audit", path: "/integrations/native/audit" },
  { name: "integrations-native-ai-policy", path: "/integrations/native/ai-policy" },
  { name: "integrations-native-leads", path: "/integrations/native/leads" },
  { name: "integrations-crm-pipeline", path: "/integrations/crm/pipeline" },
  { name: "integrations-crm-salesforce", path: "/integrations/crm/salesforce" },
  { name: "integrations-native-calendly", path: "/integrations/native/calendly" },
  { name: "integrations-calendar-focus", path: "/integrations?provider=google_calendar" },
  { name: "voice-receptionist-editor", path: "/voice/receptionist/edit" },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const loginUrl = `${BASE}/api/auth/cert-browser-session?token=${encodeURIComponent(
    TOKEN,
  )}&email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent("/integrations")}`;
  const loginRes = await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (!loginRes || loginRes.status() >= 400) {
    throw new Error(`Cert login failed: ${loginRes?.status()}`);
  }
  await page.waitForTimeout(2000);

  for (const r of routes) {
    try {
      await page.goto(`${BASE}${r.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      if (r.path.includes("receptionist/edit")) {
        await page
          .waitForFunction(
            () => {
              const t = document.body?.innerText || "";
              return (
                t.includes("Configure how your AI receptionist") ||
                t.includes("Could not load receptionist") ||
                (t.includes("Receptionist") && !t.includes("Loading receptionist"))
              );
            },
            { timeout: 90000 },
          )
          .catch(() => {});
        await page.waitForTimeout(1500);
      } else {
        await page.waitForTimeout(2500);
      }
      const file = path.join(OUT, `${r.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log("OK", r.name, "->", file);
    } catch (e) {
      console.error("FAIL", r.name, e instanceof Error ? e.message : e);
    }
  }

  await browser.close();
  console.log("Done. Output:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
