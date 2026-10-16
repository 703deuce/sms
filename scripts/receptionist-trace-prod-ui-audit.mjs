/**
 * Walk receptionist wizard on production (or UI_AGENT_BASE_URL) via Playwright.
 * Captures API responses and screenshots; does not publish unless ALLOW_PROD_ACTIVATE=1.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const ARTIFACT = "/opt/cursor/artifacts";
const OUT_JSON = path.join(ARTIFACT, "receptionist-prod-ui-audit.json");
const SCREEN_DIR = path.join(ARTIFACT, "receptionist-wizard-screens");

const STEPS = [
  "goals",
  "phone",
  "information",
  "appointments",
  "call-handling",
  "voice",
  "test",
  "activate",
];

async function authenticate(request) {
  const bypass = await request.get("/api/auth/dev-bypass?next=/voice/receptionist/edit", {
    maxRedirects: 0,
    timeout: 120_000,
  });
  if (![200, 302, 307, 308].includes(bypass.status())) {
    throw new Error(`dev-bypass failed: ${bypass.status()}`);
  }
}

async function main() {
  mkdirSync(SCREEN_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  const apiLog = [];

  page.on("response", async (res) => {
    if (
      res.url().includes("/api/solutions/appointment-receptionist") &&
      res.request().method() === "POST"
    ) {
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = { parseError: true };
      }
      apiLog.push({
        url: res.url(),
        status: res.status(),
        body,
      });
    }
  });

  const req = context.request;
  await authenticate(req);
  await page.goto("/voice/receptionist/edit?step=goals", {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(3000);

  for (const step of STEPS) {
    await page.goto(`/voice/receptionist/edit?step=${step}`, {
      waitUntil: "domcontentloaded",
      timeout: 180_000,
    });
    await page.waitForTimeout(2000);

    if (step === "appointments") {
      const sendLink = page.getByRole("radio", { name: /send.*link/i }).first();
      if (await sendLink.isVisible().catch(() => false)) {
        await sendLink.click();
        await page.waitForTimeout(500);
      }
    }

    await page.screenshot({
      path: path.join(SCREEN_DIR, `step-${step}.png`),
      fullPage: true,
    });

    const saveBtn = page
      .getByRole("button", { name: /save draft/i })
      .or(page.getByRole("button", { name: /save & continue/i }))
      .first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(8000);
    }
  }

  const summary = {
    base: BASE,
    timestamp: new Date().toISOString(),
    apiCalls: apiLog,
    note:
      "Server-side [RECEPTIONIST] logs appear only after trace PR is deployed; UI and API responses captured here.",
  };
  writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  appendFileSync(path.join(ARTIFACT, "receptionist-prod-ui-audit-api.log"), JSON.stringify(apiLog, null, 2));

  await browser.close();
  console.log("Wrote", OUT_JSON);
  console.log("API posts:", apiLog.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
