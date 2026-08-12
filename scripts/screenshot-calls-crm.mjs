import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = "alex@harborhome.co";
const WORKSPACE_ID = "ws_1";
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { slug: "all-calls", path: "/realtor/calls" },
  { slug: "all-calls-inbound", path: "/realtor/calls?tab=inbound" },
  { slug: "all-calls-ai", path: "/realtor/calls?tab=ai" },
  { slug: "voicemails", path: "/realtor/calls/voicemails" },
  { slug: "transcripts", path: "/realtor/calls/transcripts" },
  { slug: "recordings", path: "/realtor/calls/recordings" },
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
    await page.screenshot({ path: `${OUT}/calls-crm-${slug}.png`, fullPage: true });
    console.log(`saved calls-crm-${slug}.png`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
