/**
 * Front-end mass texting: compose message, audience = cert phone contact, Send Now.
 *   DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/ui-mass-text-live-production.ts
 */
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

const base = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const phoneDigits = (process.env.CERT_PHONE?.trim() || "5714776175").replace(/\D/g, "");
const message =
  process.env.MASS_MESSAGE?.trim() ||
  `Transovo mass UI test Oct 15 ${new Date().toISOString().slice(11, 16)} UTC — reply STOP to opt out`;

async function main() {
  const auth = await authenticate(base);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    storageState: auth.storageState,
    viewport: { width: 1440, height: 900 },
  });

  await page.goto(`${base}/contacts?q=${phoneDigits}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.waitForTimeout(2500);

  const bodyText = await page.locator("body").innerText();
  if (!bodyText.includes(phoneDigits.slice(-4)) && !bodyText.includes("477")) {
    await page.getByRole("button", { name: /create contact/i }).click();
    await page.waitForTimeout(800);
    await page.getByLabel(/first name/i).fill("Anthony");
    await page.getByLabel(/mobile|phone/i).first().fill(phoneDigits);
    await page.getByRole("button", { name: /save|create/i }).click();
    await page.waitForTimeout(2000);
  }

  await page.goto(`${base}/campaigns/new`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2000);

  const nameInput = page.locator('input[placeholder*="Campaign"], input[name="name"]').first();
  await nameInput.fill(`Mass UI live Oct 15 ${Date.now().toString(36).slice(-4)}`);

  const msg = page.locator("textarea").first();
  await msg.fill(message);

  const audienceBtn = page.getByRole("button", { name: /select audience|audience/i }).first();
  if (await audienceBtn.isVisible().catch(() => false)) {
    await audienceBtn.click();
  } else {
    await page.locator("text=Select audience").first().click({ timeout: 5000 }).catch(() => undefined);
    await page.locator('[class*="audience"]').first().click({ timeout: 3000 }).catch(() => undefined);
  }
  await page.waitForTimeout(500);

  const search = page.locator('input[placeholder*="Search"], input[type="search"]').first();
  await search.fill(phoneDigits.slice(-7));
  await page.waitForTimeout(1500);

  const contactRow = page
    .getByRole("button", { name: new RegExp(phoneDigits.slice(-4)) })
    .or(page.locator(`text=${phoneDigits.slice(-4)}`).first());
  await contactRow.click({ timeout: 10_000 }).catch(async () => {
    await page.getByText(/anthony|6175|477/i).first().click({ timeout: 8000 });
  });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  await page.getByRole("button", { name: /review/i }).click();
  await page.waitForURL(/\/campaigns\/new\/review/, { timeout: 60_000 });
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: /send now|continue to queue/i }).click();
  await page.waitForURL(/queue|campaigns/, { timeout: 90_000 });
  await page.waitForTimeout(3000);

  const launch = page.getByRole("button", { name: /send now|launch|confirm/i });
  if (await launch.isVisible().catch(() => false)) {
    await launch.click();
    await page.waitForTimeout(8000);
  }

  await page.goto(`${base}/campaigns`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const resultText = await page.locator("body").innerText();
  const ok =
    /delivered|sent|100%|complete/i.test(resultText) &&
    !/failed to launch|error 500/i.test(resultText);

  await page.screenshot({
    path: "/opt/cursor/artifacts/ui-mass-text-live-result.png",
    fullPage: false,
  });
  console.log(ok ? "PASS" : "PARTIAL", resultText.slice(0, 500).replace(/\s+/g, " "));
  await browser.close();
  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
