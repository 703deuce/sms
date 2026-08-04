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
  // Scope to main so sidebar labels don't false-positive.
  const mainEl = page.locator("main");
  const text = (await mainEl.count())
    ? await mainEl.first().innerText()
    : await page.locator("body").innerText();
  const checks = {
    hasHero: /What do you want Transovo to handle/i.test(text),
    hasSubtitle: /Quickly manage your AI and messaging solutions/i.test(text),
    hasCards:
      /Cover Missed Calls/i.test(text) &&
      /Welcome New Customers/i.test(text) &&
      /Get More Reviews/i.test(text) &&
      /Answer After Hours/i.test(text) &&
      /12 Calls/i.test(text) &&
      /20 SMS/i.test(text),
    hasBadges:
      /\bWorking\b/i.test(text) &&
      /Ready to Start/i.test(text) &&
      /\bDraft\b/i.test(text),
    hasAttention:
      /Needs Attention/i.test(text) &&
      /Calendar Disconnected/i.test(text) &&
      /SMS Opt-In Missing/i.test(text) &&
      /Low Balance/i.test(text),
    hasActive:
      /Top Active Solutions/i.test(text) && /7 events/i.test(text),
    hasStats: /Total Calls Today/i.test(text) && /from yesterday/i.test(text),
    hasRecommended:
      /Recommended Next/i.test(text) && /Bring Back Past Customers/i.test(text),
    hasButtons: /View All Solutions/i.test(text) && /Add Solution/i.test(text),
    hasMiddotMetrics: /12 Calls\s*·\s*0 SMS/i.test(text) || /12 Calls\s*·\s*0 SMS/.test(text),
    oldDash:
      /A high-level view of your current solutions/i.test(text) ||
      /Qualify New Leads/i.test(text) ||
      /Main Company Menu/i.test(text) ||
      /New Solution/i.test(text) ||
      /Add Number/i.test(text),
  };
  // Sticky header should not repeat the hero title on /outcomes.
  const headerTitleCount = await page.locator("header h1").count();
  const headerTitleText =
    headerTitleCount > 0 ? (await page.locator("header h1").first().innerText()).trim() : "";
  checks.noChromeTitle = !headerTitleText;

  return {
    ...checks,
    ready:
      checks.hasHero &&
      checks.hasSubtitle &&
      checks.hasCards &&
      checks.hasBadges &&
      checks.hasAttention &&
      checks.hasActive &&
      checks.hasStats &&
      checks.hasRecommended &&
      checks.hasButtons &&
      checks.hasMiddotMetrics &&
      checks.noChromeTitle &&
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
      {
        name: "transovo_nav_view",
        value: "solutions",
        url: BASE,
      },
    ]);
    await page.goto(`${BASE}/outcomes`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1000);
    const toggle = page.getByRole("button", { name: /^Solutions$/i });
    if (await toggle.count()) {
      await toggle.first().click().catch(() => null);
      await page.waitForTimeout(400);
      await page.goto(`${BASE}/outcomes`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(800);
    }
    lastStatus = await checkReady(page);
    console.log(
      `[${i}] ready=${lastStatus.ready} subtitle=${lastStatus.hasSubtitle} cards=${lastStatus.hasCards} badges=${lastStatus.hasBadges} old=${lastStatus.oldDash}`,
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
