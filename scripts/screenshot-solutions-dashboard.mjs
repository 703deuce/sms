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
    hasSubtitle: /Choose from our library of pre-built solutions/i.test(text),
    hasCards:
      /Catch Missed Calls/i.test(text) &&
      /Capture Leads After Hours/i.test(text) &&
      /Welcome & Wow Customers/i.test(text) &&
      /Nurture New Leads/i.test(text) &&
      /Win Back Lost Leads/i.test(text),
    hasBadges: /125 Runs/i.test(text) && /240 Runs/i.test(text) && /\bDraft\b/i.test(text),
    hasActionNeeded:
      /Action Needed/i.test(text) &&
      /Collect Testimonials/i.test(text) &&
      /Low Account Balance/i.test(text),
    hasActive:
      /The Active Solutions/i.test(text) && /Running/i.test(text),
    hasEvents: /Recent Events/i.test(text) && /Sarah Smith/i.test(text),
    hasStats: /Calls Answered/i.test(text) && /from last week/i.test(text),
    hasRecommended:
      /Recommended Next/i.test(text) && /Bring Back Old Customers/i.test(text),
    hasButtons: /New Solution/i.test(text) && /View All Solutions/i.test(text),
    oldDash:
      /Quickly manage your AI and messaging solutions/i.test(text) ||
      /Cover Missed Calls/i.test(text) ||
      /Ready to Start/i.test(text) ||
      /Needs Attention/i.test(text) ||
      /Top Active Solutions/i.test(text),
  };

  const aside = (await page.locator("aside").count())
    ? await page.locator("aside").first().innerText()
    : "";
  checks.hasSharedSidebar = /Transovo SMS/i.test(aside);

  return {
    ...checks,
    ready:
      checks.hasHero &&
      checks.hasSubtitle &&
      checks.hasCards &&
      checks.hasBadges &&
      checks.hasActionNeeded &&
      checks.hasActive &&
      checks.hasEvents &&
      checks.hasStats &&
      checks.hasRecommended &&
      checks.hasButtons &&
      checks.hasSharedSidebar &&
      !checks.oldDash,
    snippet: text.replace(/\s+/g, " ").slice(0, 280),
  };
}

async function shoot(page, label) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const paths = {
    viewport: `${OUT}/solutions-dashboard-${label}-viewport.png`,
    full: `${OUT}/solutions-dashboard-${label}-full.png`,
    main: `${OUT}/solutions-dashboard-${label}-main.png`,
  };
  await page.screenshot({ path: paths.viewport, fullPage: false });
  await page.screenshot({ path: paths.full, fullPage: true });
  const main = page.locator("main");
  if (await main.count()) {
    await main.first().screenshot({ path: paths.main });
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
