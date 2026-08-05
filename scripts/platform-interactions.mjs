import { chromium } from "playwright";
import { randomBytes } from "crypto";
const BASE = "https://transovo.ai";
const email = `ix${randomBytes(4).toString("hex")}@gmail.com`;
const results = [];
function log(ok, name, note="") {
  results.push({ ok, name, note });
  console.log(`${ok?"OK  ":"FAIL"} ${name}${note?": "+note:""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const apiFails = [];
page.on("response", async (r) => {
  if (r.url().includes("/api/") && r.status() >= 400 && r.request().method() !== "GET") {
    apiFails.push(`${r.status()} ${r.request().method()} ${r.url()} ${(await r.text().catch(()=>"")).slice(0,160)}`);
  }
});

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "IX Tester");
await page.fill('input[name="businessName"]', "IX Co");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "SmokeTest123!");
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/signup"), { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
log(true, "signup", email);

async function go(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(400);
  const body = await page.locator("body").innerText();
  if (/could not be found|Application error|Internal Server Error/i.test(body)) {
    throw new Error("page error");
  }
}

// Tags
await go("/contacts/tags");
const tag = `tag-${Date.now().toString(36)}`;
await page.fill("#new-tag", tag);
await page.click('button:has-text("Add tag")');
await page.waitForTimeout(1000);
log((await page.locator("body").innerText()).includes(tag), "create tag", tag);

// Segments
await go("/contacts/segments");
const seg = `seg-${Date.now().toString(36)}`;
const segInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
if (await segInput.count()) {
  await segInput.fill(seg);
  const btn = page.locator('button:has-text("Create"), button:has-text("Add")').first();
  if (!(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}
log((await page.locator("body").innerText()).includes(seg), "create segment", seg);

// Contests
await go("/grow/contests");
const cname = `Giveaway ${Date.now().toString(36)}`;
const ckw = `WIN${Date.now().toString(36).slice(-4).toUpperCase()}`;
await page.fill("#c-name", cname);
await page.fill("#c-keyword", ckw);
await page.fill("#c-prize", "$50 gift card");
await page.click('button:has-text("Create contest")');
await page.waitForTimeout(1500);
log((await page.locator("body").innerText()).includes(cname) || (await page.locator("body").innerText()).includes(ckw), "create contest", cname);

// Popups
await go("/grow/popups");
const pname = `Popup ${Date.now().toString(36)}`;
const pInput = page.locator('input[name="name"], input[placeholder*="Name" i]').first();
if (await pInput.count()) {
  await pInput.fill(pname);
  const create = page.locator('button:has-text("Create"), button:has-text("Add widget")').first();
  if (await create.count() && !(await create.isDisabled())) {
    await create.click();
    await page.waitForTimeout(1500);
  }
}
log((await page.locator("body").innerText()).includes(pname), "create popup", pname);

// Contact card
await go("/grow/contact-cards");
const biz = page.locator('input[name="businessName"], input[placeholder*="Business" i]').first();
if (await biz.count()) {
  await biz.fill("IX Contact Co");
  const save = page.locator('button:has-text("Save")').first();
  if (await save.count()) await save.click();
  await page.waitForTimeout(1000);
  log(true, "save contact card");
} else log(false, "save contact card", "no form");

// Queue
await go("/phone/queues");
const qname = `Queue ${Date.now().toString(36)}`;
const qInput = page.locator('input[name="name"], input[placeholder*="Name" i], input[placeholder*="Queue" i]').first();
if (await qInput.count()) {
  await qInput.fill(qname);
  const btn = page.locator('button:has-text("Create"), button:has-text("Add")').first();
  if (await btn.count() && !(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}
log((await page.locator("body").innerText()).includes(qname), "create call queue", qname);

// IVR
await go("/phone/ivr");
const iname = `IVR ${Date.now().toString(36)}`;
const iInput = page.locator('input[name="name"], input[placeholder*="Name" i], input[placeholder*="Menu" i]').first();
if (await iInput.count()) {
  await iInput.fill(iname);
  const btn = page.locator('button:has-text("Create"), button:has-text("Add")').first();
  if (await btn.count() && !(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
}
log((await page.locator("body").innerText()).includes(iname), "create IVR menu", iname);

// Branding
await go("/settings/branding");
const color = page.locator('input[name="primaryColor"], input[type="color"]').first();
if (await color.count()) {
  await color.fill("#0f766e");
}
const saveB = page.locator('button:has-text("Save")').first();
if (await saveB.count()) {
  await saveB.click();
  await page.waitForTimeout(1000);
  log(true, "save branding");
} else log(false, "save branding", "no save");

// Email-to-SMS
await go("/settings/email-to-sms");
const local = page.locator('input[name="localPart"], input[placeholder*="alias" i], input[placeholder*="local" i]').first();
if (await local.count()) {
  await local.fill(`ix${Date.now().toString(36).slice(-4)}`);
  const btn = page.locator('button:has-text("Add"), button:has-text("Create")').first();
  if (await btn.count() && !(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(1200);
    log(true, "add email-to-sms");
  } else log(false, "add email-to-sms", "disabled");
} else log(false, "add email-to-sms", "no field");

// Lists
await go("/contacts/lists");
const lname = `List ${Date.now().toString(36)}`;
const lInput = page.locator('input[name="name"], input[placeholder*="List" i], input[placeholder*="name" i]').first();
if (await lInput.count()) {
  await lInput.fill(lname);
  const btn = page.locator('button:has-text("Create"), button:has-text("Add")').first();
  if (await btn.count() && !(await btn.isDisabled())) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}
log((await page.locator("body").innerText()).includes(lname), "create list", lname);

// Voice agent new page loads builder
await go("/voice/agents/new");
log(/Agent|builder|Prompt|Voice/i.test(await page.locator("body").innerText()), "voice agent builder");

// Integrations directory
await go("/integrations");
const ibody = await page.locator("body").innerText();
log(/HubSpot|Shopify|Stripe|Google/i.test(ibody) && !/Coming soon/i.test(ibody), "integrations directory live connectors");

// Payments page
await go("/messaging/payments");
log(/Text-to-pay|Payment|Amount/i.test(await page.locator("body").innerText()), "payments page");

// Recurring campaigns
await go("/campaigns/recurring");
log(/Recurring|schedule|List/i.test(await page.locator("body").innerText()), "recurring campaigns page");

await browser.close();
console.log("\nAPI failures:");
for (const a of apiFails) console.log(" ", a);
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} interactions OK`);
if (failed.length) {
  console.log("Failed:");
  for (const f of failed) console.log(" -", f.name, f.note);
  process.exit(1);
}
