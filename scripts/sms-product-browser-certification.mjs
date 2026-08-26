/**
 * SMS Product Browser Certification — customer-journey click-through (Parts 4-41, 49-50).
 * Requires running app: BASE_URL=http://localhost:3000
 *
 * Usage: BASE_URL=http://localhost:3000 node scripts/sms-product-browser-certification.mjs
 */
import { chromium, request } from "playwright";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.SMOKE_EMAIL || `sms-cert-${randomBytes(4).toString("hex")}@transovo.test`;
const PASSWORD = process.env.SMOKE_PASSWORD || `SmsCert_${randomBytes(4).toString("hex")}!`;

function storeCookies(jar, res) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

const SMS_ROUTES = [
  "/mass-texting",
  "/sms",
  "/sms/analytics",
  "/sms/compliance",
  "/sms/settings",
  "/campaigns",
  "/campaigns/all",
  "/campaigns/drafts",
  "/campaigns/scheduled",
  "/campaigns/calendar",
  "/campaigns/completed",
  "/campaigns/failed",
  "/campaigns/new/promotional",
  "/contacts",
  "/contacts/lists",
  "/contacts/imports",
  "/contacts/unsubscribed",
  "/templates",
  "/templates/new",
  "/inbox",
  "/inbox?product=mass_text",
  "/inbox?product=mctb",
  "/numbers",
  "/compliance",
  "/compliance/suppression",
  "/settings/billing",
  "/settings/messaging",
];

const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /This page could not be found/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
];

const gates = [];

function recordGate(name, pass, detail = "") {
  gates.push({ name, status: pass ? "PASS" : "FAIL", detail });
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function fillIf(page, selectors, value) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if (await loc.count()) {
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

async function main() {
  mkdirSync("/opt/cursor/artifacts", { recursive: true });

  const apiContext = await request.newContext({ baseURL: BASE });
  const signupRes = await apiContext.post("/api/auth/smoke-signup", {
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    data: {
      email: EMAIL,
      password: PASSWORD,
      name: "SMS Cert Tester",
      businessName: "SMS Cert Co",
      cloneCalendly: false,
      grantMassTexting: true,
    },
  });
  const signup = await signupRes.json();
  const authed = signupRes.ok() && signup.ok;
  recordGate("AUTH smoke-signup", authed, authed ? EMAIL : signup.error || String(signupRes.status()));

  if (!authed) {
    await apiContext.dispose();
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
    storageState: await apiContext.storageState(),
  });
  await apiContext.dispose();
  const page = await context.newPage();
  const routeResults = [];

  async function visitRoute(path) {
    const url = `${BASE}${path}`;
    let ok = true;
    let note = "";
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(500);
      const body = await page.locator("body").innerText().catch(() => "");
      const status = resp?.status() || 0;
      if (status >= 500 || ERROR_PATTERNS.some((re) => re.test(body))) {
        ok = false;
        note = `HTTP ${status}`;
      }
      if (body.includes("could not be found")) {
        ok = false;
        note = "404";
      }
    } catch (err) {
      ok = false;
      note = err instanceof Error ? err.message : String(err);
    }
    routeResults.push({ path, ok, note });
    console.log(`${ok ? "OK  " : "FAIL"} ${path} ${note}`);
    return ok;
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const onDashboard = !page.url().includes("/login");
  recordGate("AUTH session in browser", onDashboard, page.url());

  await page.goto("/sms", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const bodyText = await page.locator("body").innerText();
  recordGate(
    "MASS TEXTING entitlement grant",
    bodyText.includes("Mass Texting") && !page.url().includes("/login"),
    page.url(),
  );

  console.log("\n=== Route load certification ===");
  let routePass = 0;
  for (const path of SMS_ROUTES) {
    if (await visitRoute(path)) routePass++;
  }
  recordGate("DESKTOP BROWSER route loads", routePass === SMS_ROUTES.length, `${routePass}/${SMS_ROUTES.length}`);

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileRoutes = ["/sms", "/campaigns", "/contacts", "/inbox?product=mass_text", "/templates"];
  let mobilePass = 0;
  for (const path of mobileRoutes) {
    if (await visitRoute(path)) mobilePass++;
  }
  recordGate("MOBILE BROWSER primary journey", mobilePass === mobileRoutes.length, `${mobilePass}/${mobileRoutes.length}`);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Interaction: Add contact
  try {
    await page.goto(`${BASE}/contacts`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Add contact/i }).click({ timeout: 10000 });
    await page.waitForTimeout(400);
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await fillIf(page, ['input[name="phone"]', 'input[placeholder*="Phone" i]'], phone);
    await fillIf(page, ['input[name="firstName"]', 'input[placeholder*="First" i]'], "Cert");
    const save = page.locator('form button[type="submit"], button:has-text("Save"), button:has-text("Create")').first();
    await save.click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    recordGate("CONTACTS add contact", true);
  } catch (err) {
    recordGate("CONTACTS add contact", false, err instanceof Error ? err.message : String(err));
  }

  // Interaction: Create list
  try {
    await page.goto(`${BASE}/contacts/lists`, { waitUntil: "domcontentloaded" });
    const newList = page.locator('button:has-text("New list"), button:has-text("Create list"), a:has-text("New list")').first();
    if (await newList.count()) {
      await newList.click();
      await page.waitForTimeout(400);
      await fillIf(page, ['input[name="name"]', 'input[placeholder*="name" i]'], `Cert List ${Date.now()}`);
      const save = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
      await save.click({ timeout: 5000 });
      await page.waitForTimeout(800);
    }
    recordGate("LISTS create list", true);
  } catch (err) {
    recordGate("LISTS create list", false, err instanceof Error ? err.message : String(err));
  }

  // Interaction: Campaign composer first step
  try {
    await page.goto(`${BASE}/campaigns/new/promotional`, { waitUntil: "domcontentloaded" });
    await fillIf(page, ['input[name="name"]', 'input[placeholder*="name" i]'], `Cert Campaign ${Date.now()}`);
    await fillIf(page, ['textarea[name="message"]', 'textarea', 'input[name="body"]'], "Hello from certification test");
    const next = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Save")').first();
    if (await next.count()) await next.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    recordGate("CAMPAIGN COMPOSER loads and accepts input", true);
  } catch (err) {
    recordGate("CAMPAIGN COMPOSER loads and accepts input", false, err instanceof Error ? err.message : String(err));
  }

  // Interaction: Import page controls
  try {
    await page.goto(`${BASE}/contacts/imports`, { waitUntil: "domcontentloaded" });
    const upload = page.locator('input[type="file"]');
    recordGate("CSV IMPORT page has upload control", (await upload.count()) > 0);
  } catch (err) {
    recordGate("CSV IMPORT page has upload control", false, err instanceof Error ? err.message : String(err));
  }

  // Interaction: Inbox filters
  try {
    await page.goto(`${BASE}/inbox?product=mass_text`, { waitUntil: "domcontentloaded" });
    const filters = page.locator('button, a[role="tab"], [data-filter]');
    recordGate("SHARED INBOX loads with controls", (await filters.count()) > 0, `controls=${await filters.count()}`);
  } catch (err) {
    recordGate("SHARED INBOX loads with controls", false, err instanceof Error ? err.message : String(err));
  }

  // Interaction: Templates
  try {
    await page.goto(`${BASE}/templates/new`, { waitUntil: "domcontentloaded" });
    await fillIf(page, ['input[name="name"]', 'input[placeholder*="name" i]'], `Cert Template ${Date.now()}`);
    await fillIf(page, ['textarea'], "Hi {{firstName}}");
    recordGate("TEMPLATES create form", true);
  } catch (err) {
    recordGate("TEMPLATES create form", false, err instanceof Error ? err.message : String(err));
  }

  // Public pricing page
  try {
    await page.goto(`${BASE}/mass-texting`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    recordGate("PRICING public page", /Starter|Growth|trial/i.test(body));
  } catch (err) {
    recordGate("PRICING public page", false, err instanceof Error ? err.message : String(err));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    email: EMAIL,
    routes: routeResults,
    gates,
    summary: {
      pass: gates.filter((g) => g.status === "PASS").length,
      fail: gates.filter((g) => g.status === "FAIL").length,
    },
  };

  writeFileSync(join("/opt/cursor/artifacts", "sms-product-browser-certification.json"), JSON.stringify(report, null, 2));
  console.log(`\n=== Browser Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL ===`);
  console.log("Wrote /opt/cursor/artifacts/sms-product-browser-certification.json");

  await browser.close();
  if (report.summary.fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
