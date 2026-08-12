import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = "alex@harborhome.co";
const WORKSPACE_ID = "ws_1";
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { slug: "all-leads", path: "/realtor/leads" },
  { slug: "pipeline", path: "/realtor/leads/pipeline" },
  { slug: "needs-attention", path: "/realtor/leads/needs-attention" },
  { slug: "lists", path: "/realtor/leads/lists" },
  { slug: "tags", path: "/realtor/leads/tags" },
  { slug: "capture", path: "/realtor/leads/capture" },
  { slug: "import", path: "/realtor/leads/import" },
];

async function smokeLogin(context) {
  const res = await context.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  if (!res.ok()) {
    throw new Error(`smoke-login failed: ${res.status()} ${await res.text()}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await smokeLogin(context);
  const page = await context.newPage();

  for (const { slug, path } of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/leads-crm-${slug}.png`, fullPage: true });
    console.log(`saved leads-crm-${slug}.png`);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
