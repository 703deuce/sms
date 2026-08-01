/**
 * Full platform smoke crawl against a running app (default: https://transovo.ai).
 * Skips A2P submit / number purchase / toll-free verification.
 *
 * Usage:
 *   BASE_URL=https://transovo.ai node scripts/platform-smoke.mjs
 */
import { chromium } from "playwright";
import { randomBytes } from "crypto";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = process.env.SMOKE_EMAIL || `smoke${randomBytes(4).toString("hex")}@gmail.com`;
const PASSWORD = process.env.SMOKE_PASSWORD || "SmokeTest123!";
const NAME = "Smoke Tester";

const ROUTES = [
  "/dashboard",
  "/getting-started",
  "/inbox",
  "/inbox/mine",
  "/inbox/unassigned",
  "/inbox/archived",
  "/inbox/saved-replies",
  "/messaging/media",
  "/messaging/links",
  "/messaging/payments",
  "/send",
  "/send/quick",
  "/send/test",
  "/send/ai",
  "/contacts",
  "/contacts/lists",
  "/contacts/segments",
  "/contacts/tags",
  "/contacts/fields",
  "/contacts/imports",
  "/contacts/validation",
  "/contacts/unsubscribed",
  "/contacts/blocked",
  "/contacts/invalid",
  "/campaigns",
  "/campaigns/all",
  "/campaigns/drafts",
  "/campaigns/scheduled",
  "/campaigns/calendar",
  "/campaigns/completed",
  "/campaigns/failed",
  "/campaigns/recurring",
  "/automations",
  "/automations/templates",
  "/automations/new",
  "/automations/logs",
  "/surveys",
  "/templates",
  "/templates/new",
  "/templates/ai",
  "/grow/keywords",
  "/grow/forms",
  "/grow/popups",
  "/grow/pages",
  "/grow/qr-codes",
  "/grow/click-to-text",
  "/grow/contests",
  "/grow/contact-cards",
  "/grow/sources",
  "/voice/overview",
  "/voice/agents",
  "/voice/agents/new",
  "/voice/knowledge",
  "/voice/tools",
  "/voice/calendars",
  "/voice/testing",
  "/voice/numbers",
  "/voice/inbound-routing",
  "/voice/campaigns",
  "/voice/calls",
  "/voice/conversations",
  "/voice/analytics",
  "/voice/billing",
  "/voice/settings",
  "/reports",
  "/reports/campaigns",
  "/reports/messages",
  "/reports/contacts",
  "/reports/inbox",
  "/reports/automations",
  "/reports/links",
  "/reports/usage",
  "/reports/audit-log",
  "/numbers",
  "/numbers/buy", // page load OK — do not purchase
  "/numbers/port",
  "/numbers/pools",
  "/phone",
  "/phone/calls",
  "/phone/queues",
  "/phone/ivr",
  "/phone/settings",
  "/compliance",
  "/compliance/business",
  "/compliance/brand", // load only — do not submit A2P
  "/compliance/campaign",
  "/compliance/check",
  "/compliance/consent",
  "/compliance/suppression",
  "/compliance/events",
  "/integrations",
  "/integrations/api",
  "/integrations/webhooks",
  "/integrations/logs",
  "/settings/business",
  "/settings/messaging",
  "/settings/email-to-sms",
  "/settings/users",
  "/settings/workspaces",
  "/settings/notifications",
  "/settings/billing",
  "/settings/limits",
  "/settings/security",
  "/settings/branding",
  "/settings/data",
];

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/privacy", "/terms", "/acceptable-use", "/contact", "/sms-opt-in"];

const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /This page could not be found/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
  /ENOENT|ECONNREFUSED/i,
  /prisma\./i,
  /Unexpected token/i,
];

function looksBroken(text) {
  return ERROR_PATTERNS.some((re) => re.test(text));
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  const results = [];

  async function visit(path, { expectLoginRedirect = false } = {}) {
    const beforeErrors = consoleErrors.length;
    const url = `${BASE}${path}`;
    let status = 0;
    let finalUrl = url;
    let bodySnippet = "";
    let ok = true;
    let note = "";
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
      status = resp?.status() || 0;
      finalUrl = page.url();
      await page.waitForTimeout(600);
      bodySnippet = (await page.locator("body").innerText().catch(() => "")).slice(0, 500);
      if (status >= 500) {
        ok = false;
        note = `HTTP ${status}`;
      } else if (status === 404 || /could not be found/i.test(bodySnippet)) {
        ok = false;
        note = "404";
      } else if (looksBroken(bodySnippet)) {
        ok = false;
        note = "error text on page";
      } else if (expectLoginRedirect && !finalUrl.includes("/login") && path !== "/login") {
        // ok if already authed
      } else if (
        !expectLoginRedirect &&
        finalUrl.includes("/login") &&
        !path.startsWith("/login") &&
        !PUBLIC_ROUTES.includes(path)
      ) {
        ok = false;
        note = "redirected to login (session lost)";
      }
      const newErrors = consoleErrors.slice(beforeErrors).filter(
        (e) =>
          !/favicon|Failed to load resource.*404|net::ERR_/.test(e) &&
          !/hydration/i.test(e),
      );
      if (newErrors.length) {
        note = (note ? note + "; " : "") + `console: ${newErrors.slice(0, 2).join(" | ")}`;
        // console noise alone is warning unless page also broken
        if (ok && /TypeError|ReferenceError|is not defined|Cannot read/.test(note)) ok = false;
      }
    } catch (err) {
      ok = false;
      note = err instanceof Error ? err.message : String(err);
    }
    results.push({ path, status, finalUrl, ok, note, bodySnippet: bodySnippet.slice(0, 120) });
    const mark = ok ? "OK  " : "FAIL";
    console.log(`${mark} ${path} → ${status} ${note}`);
  }

  console.log(`\n=== Public routes @ ${BASE} ===`);
  for (const path of PUBLIC_ROUTES) {
    await visit(path, { expectLoginRedirect: true });
  }

  console.log(`\n=== Signup ${EMAIL} ===`);
  const fillIf = async (selectors, value) => {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if (await loc.count()) {
        await loc.fill(value);
        return true;
      }
    }
    return false;
  };

  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.fill('input[name="name"]', NAME);
  await page.fill('input[name="businessName"]', "Smoke Test Co");
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/signup"), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  let authed =
    page.url().includes("/dashboard") ||
    page.url().includes("/getting-started") ||
    (!page.url().includes("/signup") && !page.url().includes("/login"));
  if (!authed) {
    const errText = await page.locator("body").innerText();
    console.log("Signup body:", errText.slice(0, 400));
    console.log("Signup may have failed; trying login…", page.url());
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForTimeout(1500);
    authed = !page.url().includes("/login") && !page.url().includes("/signup");
  }
  console.log(authed ? `Authenticated as ${EMAIL} @ ${page.url()}` : `AUTH FAILED @ ${page.url()}`);
  results.push({
    path: "[auth]",
    status: authed ? 200 : 401,
    finalUrl: page.url(),
    ok: authed,
    note: authed ? `signed in ${EMAIL}` : "could not sign up/login",
    bodySnippet: "",
  });
  if (!authed) {
    await browser.close();
    console.log("Aborting crawl — no session");
    process.exit(1);
  }

  console.log(`\n=== App routes (${ROUTES.length}) ===`);
  for (const path of ROUTES) {
    await visit(path);
  }

  // Light interaction tests (no Telnyx / A2P)
  console.log("\n=== Interactions (safe) ===");
  const interactions = [];
  async function interact(name, fn) {
    try {
      await fn();
      interactions.push({ name, ok: true, note: "" });
      console.log(`OK   ${name}`);
    } catch (err) {
      interactions.push({ name, ok: false, note: err instanceof Error ? err.message : String(err) });
      console.log(`FAIL ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  await interact("create contact", async () => {
    await page.goto(`${BASE}/contacts`, { waitUntil: "domcontentloaded" });
    const addBtn = page.locator('button:has-text("Add"), a:has-text("Add contact"), button:has-text("New contact")').first();
    if (!(await addBtn.count())) throw new Error("no add contact button");
    await addBtn.click();
    await page.waitForTimeout(400);
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await fillIf(['input[name="phone"]', 'input[placeholder*="Phone" i]'], phone);
    await fillIf(['input[name="firstName"]', 'input[placeholder*="First" i]'], "Smoke");
    const save = page.locator('button:has-text("Save"), button:has-text("Create"), button[type="submit"]').first();
    await save.click();
    await page.waitForTimeout(1200);
  });

  await interact("create tag", async () => {
    await page.goto(`${BASE}/contacts/tags`, { waitUntil: "domcontentloaded" });
    const name = `smoke-${Date.now().toString(36)}`;
    await fillIf(['input[name="name"]', 'input[placeholder*="Tag" i]', 'input[placeholder*="name" i]'], name);
    const btn = page.locator('button:has-text("Add"), button:has-text("Create"), button[type="submit"]').first();
    if (!(await btn.count())) throw new Error("no create tag control");
    await btn.click();
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    if (!body.includes(name)) throw new Error("tag not visible after create");
  });

  await interact("create keyword", async () => {
    await page.goto(`${BASE}/grow/keywords`, { waitUntil: "domcontentloaded" });
    const kw = `SMOKE${Date.now().toString(36).slice(-4).toUpperCase()}`;
    await fillIf(['input[name="keyword"]', 'input[placeholder*="Keyword" i]'], kw);
    await fillIf(['input[name="replyText"]', 'textarea[name="replyText"]', "textarea"], "Thanks for texting!");
    const btn = page.locator('button:has-text("Add"), button:has-text("Create"), button[type="submit"]').first();
    if (!(await btn.count())) throw new Error("no create keyword control");
    await btn.click();
    await page.waitForTimeout(1200);
  });

  await interact("create contest", async () => {
    await page.goto(`${BASE}/grow/contests`, { waitUntil: "domcontentloaded" });
    const name = `Contest ${Date.now().toString(36)}`;
    await fillIf(['input[name="name"]', 'input[placeholder*="Name" i]'], name);
    await fillIf(['input[name="keywordText"]', 'input[placeholder*="Keyword" i]'], `WIN${Date.now().toString(36).slice(-3).toUpperCase()}`);
    const btn = page.locator('button:has-text("Create"), button:has-text("Add"), button[type="submit"]').first();
    if (!(await btn.count())) throw new Error("no create contest control");
    await btn.click();
    await page.waitForTimeout(1200);
  });

  await interact("save messaging settings", async () => {
    await page.goto(`${BASE}/settings/messaging`, { waitUntil: "domcontentloaded" });
    await fillIf(['textarea[name="awayMessage"]', "textarea"], "We are away — reply soon.");
    const btn = page.locator('button:has-text("Save")').first();
    if (!(await btn.count())) throw new Error("no save button");
    await btn.click();
    await page.waitForTimeout(1000);
  });

  await interact("create survey", async () => {
    await page.goto(`${BASE}/surveys`, { waitUntil: "domcontentloaded" });
    const btn = page.locator('button:has-text("New"), a:has-text("New"), button:has-text("Create")').first();
    if (!(await btn.count())) throw new Error("no new survey control");
    await btn.click();
    await page.waitForTimeout(800);
  });

  await interact("create automation from template page", async () => {
    await page.goto(`${BASE}/automations/templates`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    if (looksBroken(body)) throw new Error("templates page broken");
  });

  await interact("sender pools page CRUD shell", async () => {
    await page.goto(`${BASE}/numbers/pools`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    if (looksBroken(body)) throw new Error("pools page broken");
  });

  await browser.close();

  const failedRoutes = results.filter((r) => !r.ok);
  const failedIx = interactions.filter((i) => !i.ok);
  console.log("\n========== SUMMARY ==========");
  console.log(`Routes: ${results.length - 1} checked, ${failedRoutes.length} failed`);
  console.log(`Interactions: ${interactions.length} checked, ${failedIx.length} failed`);
  if (failedRoutes.length) {
    console.log("\nFailed routes:");
    for (const f of failedRoutes) console.log(` - ${f.path}: ${f.note} (${f.status})`);
  }
  if (failedIx.length) {
    console.log("\nFailed interactions:");
    for (const f of failedIx) console.log(` - ${f.name}: ${f.note}`);
  }

  const report = { base: BASE, email: EMAIL, results, interactions, failedRoutes, failedIx };
  const fs = await import("fs");
  fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
  fs.writeFileSync("/opt/cursor/artifacts/platform-smoke-report.json", JSON.stringify(report, null, 2));
  console.log("\nWrote /opt/cursor/artifacts/platform-smoke-report.json");

  if (failedRoutes.length || failedIx.length || !authed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
