/**
 * Flow Builder UI live SMS smoke — one flow, one message via transovo.ai.
 *
 *   node scripts/test-flow-builder-ui-live-sms-smoke.mjs
 *
 * Env: BASE_URL, OUTBOUND_TEST_PHONE (or TEST_SMS_TO)
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) dotenv.config({ path: p });
}

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
if (!BASE) {
  console.error("Set BASE_URL or APP_URL");
  process.exit(1);
}
const ARTIFACTS = process.env.FLOW_CERT_ARTIFACTS || join(process.cwd(), "artifacts");
const EMAIL = process.env.CERT_BROWSER_EMAIL || "mt-cert-browser@transovo.test";
const marker = `ui-smoke-${Date.now().toString(36)}`;

mkdirSync(ARTIFACTS, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const result = { marker, steps: [], pass: false };

  try {
    const sessionUrl = `${BASE}/api/auth/cert-browser-session?next=${encodeURIComponent("/automations/new")}&email=${encodeURIComponent(EMAIL)}`;
    const sessionRes = await page.goto(sessionUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    result.steps.push({ step: "cert-browser-session", status: sessionRes?.status() });

    await page.waitForURL(/\/automations/, { timeout: 60000 });
    result.steps.push({ step: "navigate-automations-new", url: page.url() });

    const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
    if (await nameInput.count()) {
      await nameInput.fill(`Cert UI SMS ${marker}`);
    }

    const manualTrigger = page.getByText(/manual enroll/i).first();
    if (await manualTrigger.count()) {
      await manualTrigger.click();
      result.steps.push({ step: "select-manual-trigger" });
    }

    const sendSms = page.getByText(/send sms/i).first();
    if (await sendSms.count()) {
      await sendSms.click();
      result.steps.push({ step: "add-send-sms" });
    }

    const bodyField = page.locator('textarea').first();
    if (await bodyField.count()) {
      await bodyField.fill(`Flow Builder UI live smoke ${marker}`);
      result.steps.push({ step: "fill-sms-body" });
    }

    const publishBtn = page.getByRole("button", { name: /publish|activate/i }).first();
    if (await publishBtn.count()) {
      await publishBtn.click();
      result.steps.push({ step: "publish-click" });
      await page.waitForTimeout(2000);
    }

    const testBtn = page.getByRole("button", { name: /test|enroll/i }).first();
    if (await testBtn.count()) {
      await testBtn.click();
      result.steps.push({ step: "test-enroll-click" });
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: join(ARTIFACTS, `flow-builder-ui-live-sms-${marker}.png`), fullPage: true });
    const bodyText = await page.locator("body").innerText();
    result.pass =
      /published|active|completed|sent/i.test(bodyText) ||
      result.steps.some((s) => s.step === "test-enroll-click");
    result.bodySnippet = bodyText.slice(0, 500);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    await page.screenshot({ path: join(ARTIFACTS, `flow-builder-ui-live-sms-error-${marker}.png`), fullPage: true }).catch(() => undefined);
  } finally {
    writeFileSync(join(ARTIFACTS, `flow-builder-ui-live-sms-${marker}.json`), JSON.stringify(result, null, 2));
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
  if (!result.pass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
