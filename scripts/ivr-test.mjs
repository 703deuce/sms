import { chromium } from "playwright";
import { randomBytes } from "crypto";
const BASE = "https://transovo.ai";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("response", async r => {
  if (r.url().includes("/api/phone/ivr")) console.log(r.status(), r.request().method(), (await r.text()).slice(0,200));
});
const email = `ivr${randomBytes(3).toString("hex")}@gmail.com`;
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "IVR");
await page.fill('input[name="businessName"]', "IVR Co");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "SmokeTest123!");
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/signup"), { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
await page.goto(`${BASE}/phone/ivr`, { waitUntil: "networkidle" });
const name = `Menu ${Date.now().toString(36)}`;
const nameInput = page.getByPlaceholder("Main menu");
await nameInput.click();
await nameInput.fill("");
await nameInput.pressSequentially(name, { delay: 20 });
await page.waitForTimeout(300);
console.log("disabled?", await page.locator('button:has-text("Create menu")').isDisabled());
await page.locator('button:has-text("Create menu")').click();
await page.waitForTimeout(1500);
console.log("body has name?", (await page.locator("body").innerText()).includes(name));
await browser.close();
