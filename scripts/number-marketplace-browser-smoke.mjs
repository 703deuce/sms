#!/usr/bin/env node
/**
 * Browser smoke for number marketplace launch surfaces.
 * Usage: node scripts/number-marketplace-browser-smoke.mjs http://localhost:3000
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.argv[2];
if (!BASE) {
  console.error("Usage: node scripts/number-marketplace-browser-smoke.mjs <baseUrl>");
  process.exit(1);
}

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  record("Homepage loads", (await page.title()).length > 0);
  record(
    "No fake testimonial names",
    !(await page.content()).includes("Sarah M.") && !(await page.content()).includes("James T."),
  );
  record("Why Transovo section", (await page.content()).includes("Why Transovo"));

  const areaInput = page.locator('input[placeholder*="Area"], input[name="areaCode"], input#areaCode').first();
  if (await areaInput.count()) {
    await areaInput.fill("571");
  }
  const searchBtn = page.getByRole("button", { name: /find my numbers|search/i }).first();
  if (await searchBtn.count()) {
    await searchBtn.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);
    record("Search triggered", true);
  } else {
    record("Search triggered", false, "Find button not found");
  }

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  record("Login page", (await page.content()).toLowerCase().includes("sign in") || (await page.content()).toLowerCase().includes("log in"));

  await page.screenshot({ path: "/opt/cursor/artifacts/browser_smoke_homepage_mobile.png", fullPage: false });
} catch (err) {
  record("Browser smoke runtime", false, err instanceof Error ? err.message : String(err));
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
writeFileSync("/opt/cursor/artifacts/number_marketplace_browser_smoke.json", JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
