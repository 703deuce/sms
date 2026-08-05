import { chromium } from "playwright";
import { randomBytes } from "crypto";

const BASE = "https://transovo.ai";
async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const email = `wait${randomBytes(3).toString("hex")}@gmail.com`;
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', "Wait Deploy");
  await page.fill('input[name="businessName"]', "Wait Co");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "SmokeTest123!");
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/signup"), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/phone/queues`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const url = page.url();
  const body = await page.locator("body").innerText();
  const is404 = /could not be found|404/i.test(body) || url.includes("404");
  const hasQueues = /Call Queues|queue|Create queue/i.test(body);
  await page.goto(`${BASE}/grow/contests`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const contests = await page.locator("body").innerText();
  const hasContestCreate = /Create contest|Prize|winnerCount|Winner count/i.test(contests);
  await browser.close();
  return { is404, hasQueues, hasContestCreate, url, snippet: body.slice(0, 120) };
}

for (let i = 1; i <= 30; i++) {
  const r = await check();
  console.log(`[${i}] queues404=${r.is404} hasQueues=${r.hasQueues} contestCRUD=${r.hasContestCreate} ${r.url}`);
  if (!r.is404 && r.hasQueues && r.hasContestCreate) {
    console.log("DEPLOY READY");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 30000));
}
console.log("TIMEOUT waiting for deploy");
process.exit(1);
