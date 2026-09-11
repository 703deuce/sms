/**
 * Forms & Documents screenshots.
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-forms-documents-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
const AUTH_EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || "appt-mctb-browser@transovo.test";

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function authenticate(page: Page, next: string) {
  const bypass = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent(next)}`;
  const res = await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (res && res.status() >= 400) throw new Error(`dev-bypass failed HTTP ${res.status()}`);
  await page.waitForTimeout(2500);
  await dismissOverlays(page);
}

async function waitForms(page: Page) {
  await page.waitForSelector(".ws-event-title", { timeout: 120000 });
  await page.waitForFunction(
    () => document.body.textContent?.includes("Forms & Documents"),
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(1500);
}

async function shot(page: Page, name: string) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: true });
  console.log("wrote", path);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await authenticate(desktop, "/appointments/forms-documents");
    await waitForms(desktop);
    await shot(desktop, "forms-documents-01-library.png");

    for (const [section, file] of [
      ["assignments", "forms-documents-02-assignments.png"],
      ["submissions", "forms-documents-03-submissions.png"],
      ["documents", "forms-documents-04-documents.png"],
      ["completion", "forms-documents-05-completion.png"],
    ] as const) {
      await desktop.goto(`${BASE}/appointments/forms-documents?section=${section}`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await waitForms(desktop);
      await shot(desktop, file);
    }

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await authenticate(mobile, "/appointments/forms-documents?section=library");
    await waitForms(mobile);
    await shot(mobile, "forms-documents-06-library-mobile.png");
    await mobile.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
