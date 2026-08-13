/**
 * Capture live receptionist wizard screenshots for visual QA.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts/receptionist-wizard-qa";
const AGENT_ID = process.env.AGENT_ID || "";

fs.mkdirSync(OUT_DIR, { recursive: true });

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
}

async function shot(page, name) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log("screenshot:", path);
  return path;
}

async function main() {
  if (!BASE) throw new Error("APP_URL required");
  if (!EMAIL) throw new Error("OWNER_EMAIL or ADMIN_EMAILS required");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await smokeLogin(page);

  if (AGENT_ID) {
    await page.goto(`${BASE}/voice/agents/${AGENT_ID}/about`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2000);
    await shot(page, "page1-about");
    await page.goto(`${BASE}/voice/agents/${AGENT_ID}/capabilities`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2000);
    await shot(page, "page2-capabilities");
    await page.goto(`${BASE}/voice/agents/${AGENT_ID}/voice-test`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2000);
    await shot(page, "page3-voice-test");
  } else {
    await page.goto(`${BASE}/voice/agents/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(2000);
    await shot(page, "page1-about-new");

    const agentName = page.locator("#agent-name");
    if (await agentName.count()) {
      await agentName.fill("Amy");
      await page.locator("#business-name").fill("John's Plumbing");
      const industry = page.locator("#industry");
      if (await industry.count()) await industry.selectOption({ index: 1 });
      const desc = page.locator("#business-desc");
      if (await desc.count()) {
        await desc.fill(
          "John's Plumbing is a residential and commercial plumbing contractor serving Northern Virginia.",
        );
      }
      await page.getByRole("button", { name: /^Continue$/i }).click();
      await page.waitForURL(/\/capabilities/, { timeout: 120000 });
      await page.waitForTimeout(2000);
      await shot(page, "page2-capabilities");
      await page.getByRole("button", { name: /^Continue$/i }).click();
      await page.waitForURL(/\/voice-test/, { timeout: 120000 });
      await page.waitForTimeout(2000);
      await shot(page, "page3-voice-test");
    }
  }

  await browser.close();
  console.log("done", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
