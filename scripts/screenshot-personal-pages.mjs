import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = (
  process.env.PERSONAL_SCREENSHOT_BASE ||
  process.env.LOCAL_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const OUT = "/opt/cursor/artifacts/screenshots/personal";
mkdirSync(OUT, { recursive: true });

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(`smoke-login failed: ${res.status()} ${JSON.stringify(body)}`);
  }
  return body;
}

async function ensurePersonal(page) {
  const res = await page.request.post(`${BASE}/api/workspace`, {
    headers: { "content-type": "application/json" },
    data: { action: "create_personal" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(
      `create_personal failed: ${res.status()} ${JSON.stringify(body)}`,
    );
  }
  return body;
}

const routes = [
  { path: "/personal/vault", name: "vault" },
  { path: "/personal/forwarding", name: "forwarding" },
  { path: "/personal/voicemail", name: "voicemail" },
  { path: "/personal/activity", name: "activity" },
  { path: "/personal/analytics", name: "analytics" },
  { path: "/personal/blocked", name: "blocked" },
  { path: "/personal/usage", name: "usage" },
  { path: "/personal/porting", name: "porting" },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
await smokeLogin(page);
await ensurePersonal(page);

for (const route of routes) {
  await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: true });
  console.log(`Saved ${OUT}/${route.name}.png`);
}

await browser.close();
