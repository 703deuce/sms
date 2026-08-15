import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

async function smokeLogin(context) {
  const res = await context.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`smoke-login failed: ${res.status()}`);
  return body;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await smokeLogin(context);
const page = await context.newPage();
await page.goto(`${BASE}/numbers/premium`, { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/premium-numbers-page.png`, fullPage: true });

await page.getByRole("button", { name: /find premium numbers/i }).click();
await page.waitForTimeout(25000);
await page.screenshot({ path: `${OUT}/premium-numbers-search-results.png`, fullPage: true });

await browser.close();
console.log(`Saved ${OUT}/premium-numbers-page.png`);
console.log(`Saved ${OUT}/premium-numbers-search-results.png`);
