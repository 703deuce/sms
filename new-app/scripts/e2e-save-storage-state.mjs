#!/usr/bin/env node
/**
 * Save Playwright storageState after Supabase password sign-in (e2e-rooms user).
 */
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
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const out =
  process.env.ROOMS_E2E_STORAGE_STATE ||
  process.env.E2E_STORAGE_STATE ||
  "/root/.transovo-e2e-storage.json";

if (!email || !password) {
  console.error("E2E_ROOMS_EMAIL / E2E_ROOMS_PASSWORD missing in env file");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ baseURL: base });
const page = await context.newPage();

if (supabaseUrl && anonKey) {
  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error("supabase sign-in failed", tokenRes.status);
    process.exit(1);
  }
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const sessionPayload = JSON.stringify({
    access_token: tokenJson.access_token,
    refresh_token: tokenJson.refresh_token,
    expires_at: tokenJson.expires_at,
    expires_in: tokenJson.expires_in,
    token_type: tokenJson.token_type,
    user: tokenJson.user,
  });
  await context.addCookies([
    {
      name: storageKey,
      value: encodeURIComponent(sessionPayload),
      domain: new URL(base).hostname,
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

await page.goto("/app/clips", { waitUntil: "networkidle", timeout: 120_000 });
await context.storageState({ path: out });
await browser.close();
console.log(`[e2e] storageState → ${out}`);
