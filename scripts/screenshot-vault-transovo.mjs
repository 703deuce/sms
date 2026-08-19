/**
 * Vault-only viewport screenshots (smoke-login).
 * PERSONAL_SCREENSHOT_BASE=<app-host> node scripts/screenshot-vault-transovo.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = (
  process.env.PERSONAL_SCREENSHOT_BASE ||
  process.env.APP_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const PERSONAL_WORKSPACE_ID =
  process.env.PERSONAL_WORKSPACE_ID || "cmsu9n9zq3y57165y5c2x3m59";
const OUT =
  process.env.SCREENSHOT_OUT || "/opt/cursor/artifacts/screenshots/transovo-vault";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const VIEWPORT = {
  width: Number(process.env.SCREENSHOT_WIDTH || 1440),
  height: Number(process.env.SCREENSHOT_HEIGHT || 900),
};

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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

console.log(`Base: ${BASE}`);
console.log(`Viewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
console.log(`Out: ${OUT}`);

await smokeLogin(page);
await ensurePersonal(page);

await page.goto(`${BASE}/personal/vault`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

const hasNewUi = await page.getByText("Total Numbers").count();
const hasOldUi = await page.getByText("Monthly Vault Cost").count();
console.log(`UI check: new=${hasNewUi} old=${hasOldUi}`);

await page.screenshot({
  path: `${OUT}/vault-viewport.png`,
  fullPage: false,
});
console.log(`Saved ${OUT}/vault-viewport.png`);

await page.screenshot({
  path: `${OUT}/vault-full.png`,
  fullPage: true,
});
console.log(`Saved ${OUT}/vault-full.png`);

const manage = page.getByRole("button", { name: "Manage" }).first();
if (await manage.count()) {
  await manage.click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${OUT}/vault-manage-viewport.png`,
    fullPage: false,
  });
  console.log(`Saved ${OUT}/vault-manage-viewport.png`);
}

await browser.close();
