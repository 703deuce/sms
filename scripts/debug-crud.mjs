import { chromium } from "playwright";
import { randomBytes } from "crypto";
const BASE = "https://transovo.ai";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.request().method() !== "GET") {
    console.log(r.status(), r.request().method(), r.url(), (await r.text().catch(()=>"")).slice(0,250));
  }
});
const email = `crud${randomBytes(3).toString("hex")}@gmail.com`;
await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "CRUD");
await page.fill('input[name="businessName"]', "CRUD Co");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "SmokeTest123!");
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/signup"), {timeout:20000}).catch(()=>null),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1000);

// tags
await page.goto(`${BASE}/contacts/tags`, { waitUntil: "networkidle" });
const tag = `vip-${Date.now().toString(36)}`;
await page.fill("#new-tag", tag);
await page.click('button:has-text("Add tag")');
await page.waitForTimeout(1500);
console.log("TAG BODY HAS", (await page.locator("body").innerText()).includes(tag));

// contests
await page.goto(`${BASE}/grow/contests`, { waitUntil: "networkidle" });
console.log("CONTEST INPUTS", await page.locator("input,textarea,select").evaluateAll(els => els.map(e => ({tag:e.tagName,name:e.name,id:e.id,ph:e.placeholder,type:e.type}))));
const name = `Contest ${Date.now().toString(36)}`;
const kw = `WIN${Date.now().toString(36).slice(-3).toUpperCase()}`;
// fill by labels/order
const inputs = page.locator("input");
const count = await inputs.count();
for (let i=0;i<count;i++) {
  const ph = await inputs.nth(i).getAttribute("placeholder");
  const nameAttr = await inputs.nth(i).getAttribute("name");
  console.log("input", i, nameAttr, ph);
}
// try common fields
for (const [sel,val] of [
  ['input[name="name"]', name],
  ['input[placeholder*="Name" i]', name],
  ['input[name="keywordText"]', kw],
  ['input[placeholder*="Keyword" i]', kw],
]) {
  const loc = page.locator(sel).first();
  if (await loc.count()) { await loc.fill(val); console.log("filled", sel); }
}
const btn = page.locator('button:has-text("Create contest"), button:has-text("Create")').first();
console.log("btn disabled?", await btn.isDisabled().catch(()=>null), "text", await btn.innerText().catch(()=>null));
if (!(await btn.isDisabled())) await btn.click();
else {
  // force fill all visible text inputs
  const texts = page.locator('input[type="text"], input:not([type]), input[type="search"]');
  const n = await texts.count();
  for (let i=0;i<n;i++) {
    const v = i===0?name:i===1?kw:`field${i}`;
    await texts.nth(i).fill(v);
  }
  console.log("btn disabled after fill?", await btn.isDisabled());
  if (!(await btn.isDisabled())) await btn.click();
}
await page.waitForTimeout(2000);
console.log("CONTEST SNIP", (await page.locator("body").innerText()).slice(0,500));

// queues create
await page.goto(`${BASE}/phone/queues`, { waitUntil: "networkidle" });
console.log("QUEUES", (await page.locator("body").innerText()).slice(0,300));

await browser.close();
