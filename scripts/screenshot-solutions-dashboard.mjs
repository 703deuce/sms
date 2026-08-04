import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";

const BASE = (process.env.APP_URL || process.env.BASE_URL || "https://transovo.ai").replace(
  /\/$/,
  "",
);
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const LABEL = process.env.SHOT_LABEL || "live";
const OUT = "/opt/cursor/artifacts";
mkdirSync(OUT, { recursive: true });

async function smokeLogin(context) {
  const res = await context.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(`smoke-login failed: ${res.status()} ${JSON.stringify(body).slice(0, 200)}`);
  }
  return body;
}

async function checkReady(page) {
  const mainEl = page.locator("main");
  const text = (await mainEl.count())
    ? await mainEl.first().innerText()
    : await page.locator("body").innerText();
  const checks = {
    hasHero: /What do you want Transovo to handle/i.test(text),
    hasSubtitle: /Choose a solution below to start getting results for your business/i.test(
      text,
    ),
    hasCards:
      /Cover Missed Calls/i.test(text) &&
      /Answer After Hours/i.test(text) &&
      /Missed Call Text Back/i.test(text) &&
      /Bring Back Past Customers/i.test(text),
    hasBadges:
      /AI Voice/i.test(text) &&
      /Automated/i.test(text) &&
      /\bNew\b/i.test(text),
    hasMiddle:
      /Active Solutions/i.test(text) &&
      /Top Active Solutions/i.test(text) &&
      /Recent Activity/i.test(text),
    hasButtons:
      /Setup/i.test(text) &&
      /Open/i.test(text) &&
      /Manage AI Voice/i.test(text),
    hasStats:
      /Missed Calls Saved/i.test(text) &&
      /Appointments Booked/i.test(text) &&
      /New Reviews Collected/i.test(text) &&
      /Estimates Sent/i.test(text),
    hasRecommended:
      /Recommended Next/i.test(text) && /Appointment Reminders/i.test(text),
    hasHeaderActions: /New Solution/i.test(text) && /Manage AI Voice/i.test(text),
    oldDash:
      /Choose from our library of pre-built solutions/i.test(text) ||
      /Action Needed/i.test(text) ||
      /View All Solutions/i.test(text) ||
      /125 Runs/i.test(text) ||
      /Win Back Past Plans/i.test(text) ||
      /Catch Missed Call/i.test(text) ||
      /Get Started/i.test(text) ||
      /Add Channel/i.test(text) ||
      /Your Latest Statistics/i.test(text) ||
      /Enable new solutions or monitor performance/i.test(text),
  };

  const aside = (await page.locator("aside").count())
    ? await page.locator("aside").first().innerText()
    : "";
  checks.hasSharedSidebar =
    /AI Receptionist/i.test(aside) &&
    /SMS & Messaging/i.test(aside) &&
    /Connect With Customers/i.test(aside) &&
    /My Systems/i.test(aside) &&
    /Automations/i.test(aside) &&
    /Capture & Screen Inquiries/i.test(aside) &&
    /Respond & Follow Up/i.test(aside) &&
    !/Client Onboarding/i.test(aside) &&
    !/\bPlatform\b/i.test(aside) &&
    !/Handle New Service Calls/i.test(aside) &&
    !/Run a Contest/i.test(aside);

  return {
    ...checks,
    ready:
      checks.hasHero &&
      checks.hasSubtitle &&
      checks.hasCards &&
      checks.hasBadges &&
      checks.hasMiddle &&
      checks.hasButtons &&
      checks.hasStats &&
      checks.hasRecommended &&
      checks.hasHeaderActions &&
      checks.hasSharedSidebar &&
      !checks.oldDash,
    snippet: text.replace(/\s+/g, " ").slice(0, 280),
    asideSnippet: aside.replace(/\s+/g, " ").slice(0, 280),
  };
}

async function shoot(page, label) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const paths = {
    viewport: `${OUT}/solutions-dashboard-${label}-viewport.png`,
    full: `${OUT}/solutions-dashboard-${label}-full.png`,
    main: `${OUT}/solutions-dashboard-${label}-main.png`,
    sidebar: `${OUT}/solutions-dashboard-${label}-sidebar.png`,
  };
  await page.screenshot({ path: paths.viewport, fullPage: false });
  await page.screenshot({ path: paths.full, fullPage: true });
  const main = page.locator("main");
  if (await main.count()) {
    await main.first().screenshot({ path: paths.main });
  }
  const aside = page.locator("aside");
  if (await aside.count()) {
    await aside.first().screenshot({ path: paths.sidebar });
  }
  console.log(JSON.stringify(paths));
  return paths;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
});

let ready = false;
let lastStatus = null;

for (let i = 1; i <= 48; i++) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await smokeLogin(context);
    await context.addCookies([
      { name: "transovo_nav_view", value: "solutions", url: BASE },
    ]);
    await page.goto(`${BASE}/outcomes?v=${Date.now()}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForTimeout(800);
    lastStatus = await checkReady(page);
    console.log(
      `[${i}] ready=${lastStatus.ready} subtitle=${lastStatus.hasSubtitle} cards=${lastStatus.hasCards} sidebar=${lastStatus.hasSharedSidebar} old=${lastStatus.oldDash}`,
    );
    if (lastStatus.ready) {
      ready = true;
      await shoot(page, LABEL);
      writeFileSync(
        `${OUT}/solutions-dashboard-${LABEL}-status.json`,
        JSON.stringify(lastStatus, null, 2),
      );
      await context.close();
      break;
    }
    console.log("pending:", lastStatus.snippet);
  } catch (err) {
    console.log(`[${i}] error: ${err.message}`);
  }
  await context.close();
  await new Promise((r) => setTimeout(r, 15000));
}

if (!ready) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await smokeLogin(context);
    await context.addCookies([
      { name: "transovo_nav_view", value: "solutions", url: BASE },
    ]);
    await page.goto(`${BASE}/outcomes`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1000);
    await shoot(page, "pending");
    writeFileSync(
      `${OUT}/solutions-dashboard-pending-status.json`,
      JSON.stringify(lastStatus, null, 2),
    );
  } catch (err) {
    console.log("final capture failed:", err.message);
  }
  await context.close();
  await browser.close();
  console.error("TIMEOUT waiting for Solutions dashboard deploy");
  process.exit(1);
}

await browser.close();
console.log("SOLUTIONS DASHBOARD READY");
