import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = "alex@harborhome.co";
const WORKSPACE_ID = "ws_1";
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { slug: "calendar", path: "/realtor/appointments/calendar" },
  { slug: "appointments", path: "/realtor/appointments" },
  { slug: "appointment-types", path: "/realtor/appointments/types" },
  { slug: "connections", path: "/realtor/appointments/connections" },
  { slug: "availability", path: "/realtor/appointments/availability" },
  { slug: "dialer", path: "/realtor/calls/dialer" },
  { slug: "phone-settings", path: "/realtor/calls/phone-settings" },
];

async function smokeLogin(context) {
  const res = await context.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  if (!res.ok()) throw new Error(`smoke-login failed: ${res.status()}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await smokeLogin(context);
  const page = await context.newPage();

  for (const { slug, path } of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/appointments-phone-${slug}.png`, fullPage: true });
    console.log(`saved appointments-phone-${slug}.png`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
