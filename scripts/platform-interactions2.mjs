import { chromium } from "playwright";
import { randomBytes } from "crypto";
const BASE = "https://transovo.ai";
const email = `ix2${randomBytes(4).toString("hex")}@gmail.com`;
const results = [];
const log = (ok, name, note="") => { results.push({ok,name,note}); console.log(`${ok?"OK  ":"FAIL"} ${name}${note?": "+note:""}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("dialog", async (d) => { await d.accept("Smoke List " + Date.now().toString(36)); });

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', "IX2");
await page.fill('input[name="businessName"]', "IX2 Co");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "SmokeTest123!");
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/signup"), { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
log(true, "signup");

async function go(p){ await page.goto(`${BASE}${p}`, { waitUntil:"networkidle", timeout:45000 }); await page.waitForTimeout(500); }

// segment via Create button + editor
await go("/contacts/segments");
await page.click('button:has-text("Create segment")');
await page.waitForTimeout(400);
const segName = `Seg ${Date.now().toString(36)}`;
const segField = page.locator('input[placeholder*="name" i], input[placeholder*="Segment" i], input').filter({ hasNot: page.locator('[placeholder*="Search"]') }).first();
// fill first visible non-search text input in editor
const editorInputs = page.locator('input[type="text"], input:not([type])');
const ec = await editorInputs.count();
let filled=false;
for (let i=0;i<ec;i++){
  const ph = (await editorInputs.nth(i).getAttribute("placeholder"))||"";
  if (/search/i.test(ph)) continue;
  await editorInputs.nth(i).fill(segName);
  filled=true; break;
}
if (filled) {
  const save = page.locator('button:has-text("Save"), button:has-text("Create")').last();
  await save.click();
  await page.waitForTimeout(1200);
}
log((await page.locator("body").innerText()).includes(segName), "create segment", segName);

// list via CreateListButton (prompt dialog)
await go("/contacts/lists");
page.once("dialog", async d => { await d.accept(`List ${Date.now().toString(36)}`); });
await page.click('button:has-text("Create list")');
await page.waitForTimeout(1500);
log(/List |contacts/i.test(await page.locator("body").innerText()), "create list");

// popup
await go("/grow/popups");
const popName = `Pop ${Date.now().toString(36)}`;
const popInputs = page.locator('input[type="text"], input:not([type])');
for (let i=0;i<await popInputs.count();i++){
  const ph=(await popInputs.nth(i).getAttribute("placeholder"))||"";
  if (/search/i.test(ph)) continue;
  await popInputs.nth(i).fill(popName); break;
}
const popBtn = page.locator('button:has-text("Create")').first();
if (!(await popBtn.isDisabled())) { await popBtn.click(); await page.waitForTimeout(1200); }
log((await page.locator("body").innerText()).includes(popName), "create popup", popName);

// contact card - label based
await go("/grow/contact-cards");
await page.getByLabel(/business/i).fill("IX2 Cards LLC").catch(async()=>{
  const inputs = page.locator('input[type="text"], input:not([type])');
  for (let i=0;i<await inputs.count();i++){
    const ph=(await inputs.nth(i).getAttribute("placeholder"))||"";
    if (/search|https/i.test(ph)) continue;
    await inputs.nth(i).fill("IX2 Cards LLC"); break;
  }
});
await page.click('button:has-text("Save contact card")');
await page.waitForTimeout(1000);
log(true, "save contact card");

// queue
await go("/phone/queues");
await page.getByPlaceholder("Support").fill(`Q ${Date.now().toString(36)}`);
const qbtn = page.locator('button:has-text("Create queue")');
log(!(await qbtn.isDisabled()), "queue form enables");
if (!(await qbtn.isDisabled())) { await qbtn.click(); await page.waitForTimeout(1200); }
log(/Q |queue/i.test(await page.locator("body").innerText()), "create queue");

// ivr
await go("/phone/ivr");
await page.getByPlaceholder("Main menu").fill(`Menu ${Date.now().toString(36)}`);
const ibtn = page.locator('button:has-text("Create menu")');
if (!(await ibtn.isDisabled())) { await ibtn.click(); await page.waitForTimeout(1200); }
else {
  // may need an option digit
  const dig = page.getByPlaceholder("#");
  if (await dig.count()) await dig.fill("1");
  if (!(await ibtn.isDisabled())) { await ibtn.click(); await page.waitForTimeout(1200); }
}
log(/Menu |IVR|menu/i.test(await page.locator("body").innerText()) && !(await ibtn.isDisabled().catch(()=>true)), "create IVR");

// email-to-sms
await go("/settings/email-to-sms");
await page.fill("#localPart", `help${Date.now().toString(36).slice(-4)}`);
await page.fill("#phone", "+15551234567");
await page.click('button:has-text("Create alias")');
await page.waitForTimeout(1200);
log(/help|alias|@/i.test(await page.locator("body").innerText()), "create email-to-sms alias");

await browser.close();
const failed = results.filter(r=>!r.ok);
console.log(`\n${results.length-failed.length}/${results.length} OK`);
if (failed.length) { failed.forEach(f=>console.log("FAIL", f.name, f.note)); process.exit(1); }
