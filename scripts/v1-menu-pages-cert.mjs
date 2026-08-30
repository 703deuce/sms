/**
 * V1 menu-page certification — every user-facing MCTB + SMS sidebar route.
 * Usage: BASE_URL=http://localhost:3000 node scripts/v1-menu-pages-cert.mjs
 */
import { chromium, request } from "playwright";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.SMOKE_EMAIL || `menu-cert-${randomBytes(4).toString("hex")}@transovo.test`;
const PASSWORD = process.env.SMOKE_PASSWORD || `MenuCert_${randomBytes(4).toString("hex")}!`;
const NAV_TIMEOUT = Number(process.env.MENU_CERT_NAV_TIMEOUT_MS || 45000);
const ARTIFACTS = process.env.MENU_CERT_ARTIFACTS_DIR || "/opt/cursor/artifacts";

const MCTB_MENU_ROUTES = [
  "/voice/missed-calls",
  "/voice/voicemail",
  "/voice/consent-log",
  "/voice/setup",
  "/voice/schedule",
  "/voice/try-it",
  "/settings",
  "/getting-started",
];

const SMS_MENU_ROUTES = [
  "/dashboard",
  "/conversations",
  "/campaigns",
  "/analytics",
  "/contacts",
  "/contacts/lists",
  "/contacts/segments",
  "/grow/qr-codes",
  "/grow/forms",
  "/grow/tap-to-join",
  "/grow/keywords",
  "/auto-replies",
  "/drip-campaigns",
  "/ai-replies",
  "/playbooks",
  "/settings",
  "/getting-started",
];

const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
];

const results = [];

function record(product, path, ok, note = "") {
  results.push({ product, path, ok, note });
  console.log(`${ok ? "OK  " : "FAIL"} [${product}] ${path}${note ? ` — ${note}` : ""}`);
}

async function visitRoute(page, product, path) {
  let ok = true;
  let note = "";
  try {
    const resp = await page.goto(`${BASE}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(600);
    const body = await page.locator("body").innerText().catch(() => "");
    const status = resp?.status() || 0;
    const url = page.url();
    if (url.includes("/login")) {
      ok = false;
      note = "redirected to login";
    } else if (status >= 500) {
      ok = false;
      note = `HTTP ${status}`;
    } else if (ERROR_PATTERNS.some((re) => re.test(body))) {
      ok = false;
      note = "error page";
    } else if (/This page could not be found/i.test(body) && status === 404) {
      ok = false;
      note = "404";
    }
  } catch (err) {
    ok = false;
    note = err instanceof Error ? err.message : String(err);
  }
  record(product, path, ok, note);
  return ok;
}

async function openProduct(api, cookies, product) {
  const res = await api.get(`/api/products/open?product=${product}&next=/`, {
    maxRedirects: 0,
  });
  const setCookies = res.headers()["set-cookie"] || "";
  if (setCookies) {
    for (const c of setCookies.split("\n")) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });

  const api = await request.newContext({ baseURL: BASE });
  const signupRes = await api.post("/api/auth/smoke-signup", {
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    data: {
      email: EMAIL,
      password: PASSWORD,
      name: "Menu Cert Tester",
      businessName: "Menu Cert Co",
      cloneCalendly: false,
      grantMassTexting: true,
    },
  });
  const signup = await signupRes.json();
  if (!signupRes.ok() || !signup.ok) {
    console.error("signup failed", signup);
    process.exit(1);
  }

  const cookies = new Map();
  for (const c of await api.storageState().then((s) => s.cookies)) {
    cookies.set(c.name, c.value);
  }

  await openProduct(api, cookies, "voice");
  await openProduct(api, cookies, "mass_texting");
  await api.post("/api/auth/smoke-login", {
    headers: { "x-smoke-bootstrap": BOOTSTRAP },
    data: { email: EMAIL },
  });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });

  const cookieList = [...cookies.entries()].map(([name, value]) => ({
    name,
    value,
    domain: "localhost",
    path: "/",
  }));

  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies(cookieList);
  const page = await context.newPage();

  console.log("\n=== MCTB menu pages ===");
  for (const path of MCTB_MENU_ROUTES) {
    await visitRoute(page, "mctb", path);
  }

  console.log("\n=== SMS platform menu pages ===");
  for (const path of SMS_MENU_ROUTES) {
    await visitRoute(page, "sms", path);
  }

  const fail = results.filter((r) => !r.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    email: EMAIL,
    results,
    summary: { pass: results.length - fail.length, fail: fail.length },
  };
  const reportPath = join(ARTIFACTS, "v1-menu-pages-cert.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n=== Summary: ${report.summary.pass} PASS, ${report.summary.fail} FAIL ===`);
  console.log(`Report: ${reportPath}`);

  await browser.close();
  await api.dispose();
  if (fail.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
