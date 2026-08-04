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
    hasSubtitle: /Centralized view of everything Transovo is doing/i.test(text),
    hasCards:
      /Catch Missed Call/i.test(text) &&
      /Handle After Hours/i.test(text) &&
      /Respond to New Inquiries/i.test(text) &&
      /Win Back Past Plans/i.test(text),
    hasBadges:
      /\bRecommended\b/i.test(text) &&
      /\bHot\b/i.test(text) &&
      /\bNew\b/i.test(text),
    hasActionNeeded:
      /Active Solutions/i.test(text) &&
      /The Latest Statistics/i.test(text) &&
      /View All/i.test(text),
    hasActive: /Service/i.test(text) && /Last Activity/i.test(text),
    hasEvents: /Recent Activity/i.test(text) && /4:15 PM/i.test(text),
    hasStats: /Calls Handled/i.test(text) && /last 7 days/i.test(text),
    hasRecommended:
      /Recommended Apps/i.test(text) && /Appointment Reminders/i.test(text),
    hasButtons: /New Solution/i.test(text) && /Get Started/i.test(text),
    oldDash:
      /Choose from our library of pre-built solutions/i.test(text) ||
      /Action Needed/i.test(text) ||
      /Recommended Next/i.test(text) ||
      /View All Solutions/i.test(text) ||
      /125 Runs/i.test(text),
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
