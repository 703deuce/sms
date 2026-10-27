#!/usr/bin/env node
import { chromium } from "playwright";
import { readFileSync, existsSync } from "node:fs";

const envFile = process.env.E2E_ENV_FILE || "/root/.transovo-e2e.env";
if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}`);
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const base = env.PLAYWRIGHT_BASE_URL || "https://transovo.ai";
const email = env.E2E_ROOMS_EMAIL;
const password = env.E2E_ROOMS_PASSWORD;
const out = process.env.ROOMS_E2E_STORAGE_STATE || "/root/.transovo-e2e-storage.json";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.getByLabel(/email/i).fill(email);
await page.getByLabel(/password/i).fill(password);
await page.getByRole("button", { name: /sign in|log in/i }).click();
await page.waitForURL(/\/app\//, { timeout: 120_000 });
await page.context().storageState({ path: out });
await browser.close();
console.log(`[e2e] storageState → ${out}`);
