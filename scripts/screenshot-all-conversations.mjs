import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = "alex@harborhome.co";
const WORKSPACE_ID = "ws_1";
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const TABS = ["all", "mine", "unassigned", "unread", "calls", "sms", "email"];

async function smokeLogin(context) {
  const res = await context.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  if (!res.ok()) throw new Error(`smoke-login failed: ${res.status()}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await smokeLogin(context);
  const page = await context.newPage();

  await page.goto(`${BASE}/realtor/messages`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/all-conversations.png`, fullPage: true });
  console.log("saved all-conversations.png");

  for (const tab of TABS.slice(1, 4)) {
    await page.goto(`${BASE}/realtor/messages?tab=${tab}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/all-conversations-${tab}.png`, fullPage: true });
    console.log(`saved all-conversations-${tab}.png`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
