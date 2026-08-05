import { chromium } from "playwright";
import { randomBytes } from "crypto";
const BASE = "https://transovo.ai";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const email = `insp${randomBytes(3).toString("hex")}@gmail.com`;
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "Insp");
await page.fill('input[name="businessName"]', "Insp Co");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "SmokeTest123!");
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/signup"), { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);

for (const path of [
  "/contacts/segments",
  "/contacts/lists",
  "/grow/popups",
  "/grow/contact-cards",
  "/phone/queues",
  "/phone/ivr",
  "/settings/email-to-sms",
]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  const fields = await page.locator("input,textarea,select,button").evaluateAll((els) =>
    els.slice(0, 40).map((e) => ({
      tag: e.tagName,
      name: e.getAttribute("name"),
      id: e.id,
      type: e.getAttribute("type"),
      ph: e.getAttribute("placeholder"),
      text: e.tagName === "BUTTON" ? e.innerText.slice(0, 40) : "",
      disabled: e.disabled,
    })),
  );
  console.log("\n===", path, "===");
  console.log(JSON.stringify(fields, null, 2));
}
await browser.close();
