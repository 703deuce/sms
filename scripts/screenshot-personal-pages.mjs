import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = (
  process.env.PERSONAL_SCREENSHOT_BASE ||
  process.env.APP_URL ||
  process.env.BASE_URL ||
  process.env.LOCAL_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const PERSONAL_WORKSPACE_ID =
  process.env.PERSONAL_WORKSPACE_ID || "cmsu9n9zq3y57165y5c2x3m59";
const OUT = process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/screenshots/personal-prod";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
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
    data: { workspaceId: PERSONAL_WORKSPACE_ID },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(
      `select personal workspace failed: ${res.status()} ${JSON.stringify(body)}`,
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

console.log(`Screenshot base: ${BASE}`);
console.log(`Workspace: ${PERSONAL_WORKSPACE_ID}`);
await smokeLogin(page);
await ensurePersonal(page);

for (const route of routes) {
  await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${route.name}.png`, fullPage: true });
  console.log(`Saved ${OUT}/${route.name}.png`);
}

await browser.close();
