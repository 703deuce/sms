import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = "alex@harborhome.co";
const WORKSPACE_ID = "ws_1";
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { slug: "front-desk", path: "/realtor/agents/front-desk" },
  { slug: "speed-to-lead", path: "/realtor/agents/speed-to-lead" },
  { slug: "knowledge", path: "/realtor/agents/knowledge" },
  { slug: "activity", path: "/realtor/agents/activity" },
  { slug: "test-agent", path: "/realtor/test" },
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
    await page.screenshot({ path: `${OUT}/ai-agents-crm-${slug}.png`, fullPage: true });
    console.log(`saved ai-agents-crm-${slug}.png`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
