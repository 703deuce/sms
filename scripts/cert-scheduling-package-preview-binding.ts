/**
 * Browser check: package wizard live preview updates when typing a real name.
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/cert-scheduling-package-preview-binding.ts
 */
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";

async function main() {
  const auth = await authenticate(BASE);
  if (!auth.ok) {
    console.error("AUTH_FAIL");
    process.exit(1);
  }
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });
  await page.goto(`${BASE}/appointments/packages/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);

  const nameInput = page.locator("#pkg-name");
  await nameInput.fill("");
  const emptyPreview = await page.getByRole("heading", { level: 2 }).filter({ hasText: "Untitled package" }).count();
  await nameInput.fill("IT Career Starter");
  await page.waitForTimeout(300);
  const updated = await page.getByRole("heading", { level: 2 }).filter({ hasText: "IT Career Starter" }).count();
  await nameInput.fill("IT Career Starter Plus");
  await page.waitForTimeout(300);
  const updated2 = await page.getByRole("heading", { level: 2 }).filter({ hasText: "IT Career Starter Plus" }).count();

  await browser.close();

  const pass = emptyPreview >= 1 && updated >= 1 && updated2 >= 1;
  console.log(
    JSON.stringify({
      pass,
      emptyPreview,
      afterFirstName: updated,
      afterRename: updated2,
    }),
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
