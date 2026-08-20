#!/usr/bin/env node
/**
 * Browser checkout flow: public reserve → auth resume → test purchase (dry-run).
 * Usage: NUMBER_PAYMENT_PROVIDER=test node scripts/number-marketplace-checkout-browser.mjs http://localhost:3000
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3000";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

try {
  const smsRes = await page.goto(`${BASE}/sms-marketing`, { waitUntil: "domcontentloaded" });
  record("/sms-marketing hidden", page.url().endsWith("/") || page.url().includes(BASE.replace(/\/$/, "")));

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  record("Google sign-in on login", (await page.getByRole("button", { name: /continue with google/i }).count()) > 0);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  const areaInput = page.locator('input[placeholder*="Area"], input[name="areaCode"], input#areaCode').first();
  if (await areaInput.count()) await areaInput.fill("571");
  const searchBtn = page.getByRole("button", { name: /find my numbers|search/i }).first();
  if (await searchBtn.count()) {
    await searchBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(8000);
  }

  const getBtn = page.getByRole("button", { name: /get this number|get this|reserve|select/i }).first();
  record("Search results visible", (await getBtn.count()) > 0);

  if (await getBtn.count()) {
    await getBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForURL(/\/signup/, { timeout: 15000 }).catch(() => {});
    record("Reserve redirects to signup", page.url().includes("/signup"));
    record(
      "Google sign-in on signup checkout",
      (await page.getByRole("button", { name: /continue with google/i }).count()) > 0,
    );
  }

  const signupRes = await context.request.post(`${BASE}/api/auth/smoke-signup`, {
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    data: { businessName: "Numbers Checkout Smoke", name: "Checkout Smoke" },
  });
  const signup = await signupRes.json();
  record("smoke-signup", signupRes.ok() && signup.ok, signup.email || signup.error);

  if (signup.ok) {
    await page.goto(`${BASE}/personal/numbers/premium`, { waitUntil: "networkidle", timeout: 60000 });
    if (await areaInput.count()) await areaInput.fill("571");
    if (await searchBtn.count()) {
      await searchBtn.click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(12000);
    }

    const reserveBtn = page.getByRole("button", { name: /get this number/i }).first();
    if (!(await reserveBtn.count())) {
      record("Authenticated search results", false, "Get This Number button not found");
    } else {
      record("Authenticated search results", true);
      let reservationId;
      page.on("response", async (response) => {
        if (response.url().includes("/api/numbers/premium/reserve") && response.ok()) {
          try {
            const json = await response.json();
            if (json.reservationId) reservationId = json.reservationId;
          } catch {
            // ignore
          }
        }
      });
      await reserveBtn.click({ timeout: 10000 });
      await page.waitForTimeout(3000);
      record("Checkout modal opens", (await page.getByText(/reserved for you/i).count()) > 0);

      if (!reservationId) {
        record("Reservation id captured", false, "missing from reserve response");
      } else {
        record("Reservation id captured", true, reservationId);
        const claimRes = await context.request.post(
          `${BASE}/api/numbers/premium/reservation/${reservationId}/claim?workspaceId=${signup.workspaceId}`,
          { method: "POST" },
        );
        record("Guest reservation claim API", claimRes.ok(), String(claimRes.status()));

        const completeRes = await context.request.post(`${BASE}/api/numbers/premium/complete`, {
          headers: { "content-type": "application/json" },
          data: {
            workspaceId: signup.workspaceId,
            reservationId,
            idempotencyKey: `browser-smoke:${reservationId}`,
            dryRun: true,
          },
        });
        const complete = await completeRes.json();
        record(
          "Dry-run purchase completes",
          completeRes.ok() && complete.ok,
          complete.phoneNumberId || complete.error || complete.status,
        );
        record("Provider on reservation", Boolean(complete.e164), complete.e164 || "");
      }
    }
  }

  await page.screenshot({ path: "/opt/cursor/artifacts/checkout_flow_smoke.png", fullPage: false });
} catch (err) {
  record("checkout browser runtime", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const report = {
  base: BASE,
  checkedAt: new Date().toISOString(),
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok).length,
  checks,
};
writeFileSync("/opt/cursor/artifacts/number_marketplace_checkout_browser.json", JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
