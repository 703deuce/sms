/**
 * Launch checklist browser walkthrough — clicks through Personal + Business UI
 * using smoke-login and existing workspace numbers. Stops before Stripe checkout
 * and port submission.
 *
 * Usage:
 *   LOCAL_APP_URL=http://localhost:3001 OWNER_EMAIL=... node scripts/launch-checklist-browser-walkthrough.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (
  process.env.LOCAL_APP_URL ||
  process.env.BASE_URL ||
  process.env.APP_URL ||
  "http://localhost:3001"
).replace(/\/$/, "");
const EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.ADMIN_EMAILS?.split(",")[0] ||
  "alex@harborhome.co"
)
  .trim()
  .toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/launch-walkthrough";
const REPORT = `${OUT}/report.json`;

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  email: EMAIL,
  startedAt: new Date().toISOString(),
  ok: false,
  routes: [],
  interactions: [],
  apiErrors: [],
  consoleErrors: [],
  skipped: [],
  errors: [],
};

function log(kind, detail = {}) {
  const row = { kind, at: new Date().toISOString(), ...detail };
  if (kind === "route") report.routes.push(row);
  else if (kind === "interaction") report.interactions.push(row);
  else if (kind === "skip") report.skipped.push(row);
  else report.errors.push(row);
  console.log(`[${kind}]`, detail.path || detail.action || detail.message || "");
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
  log("interaction", { action: "smoke-login", workspaceId: body.workspaceId });
  return body;
}

async function ensurePersonal(page) {
  const res = await page.request.post(`${BASE}/api/workspace`, {
    headers: { "content-type": "application/json" },
    data: { action: "create_personal" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    log("skip", { message: "create_personal failed", status: res.status(), body });
    return null;
  }
  log("interaction", { action: "ensure-personal", workspaceId: body.workspaceId });
  return body;
}

async function switchToBusiness(page) {
  const shell = await page.request.get(`${BASE}/api/workspace`);
  const shellJson = await shell.json().catch(() => ({}));
  const workspaces = shellJson?.data?.workspaces || [];
  const business = workspaces.find((w) => w.type !== "PERSONAL") || workspaces[0];
  if (!business?.id) {
    log("skip", { message: "no business workspace found" });
    return false;
  }
  const res = await page.request.post(`${BASE}/api/workspace`, {
    headers: { "content-type": "application/json" },
    data: { workspaceId: business.id },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    log("skip", { message: "switch to business failed", status: res.status(), body });
    return false;
  }
  log("interaction", { action: "switch-business", workspaceId: business.id });
  return true;
}

async function waitReady(page, maxMs = 45000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) return;
    await page.waitForTimeout(400);
  }
  throw new Error("Page stuck on Working…");
}

async function visitRoute(page, path, label) {
  const url = `${BASE}${path}`;
  const start = Date.now();
  let status = "ok";
  let detail = "";

  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await waitReady(page, 30000);
    await page.waitForTimeout(800);

    const httpStatus = res?.status() ?? 0;
    if (httpStatus >= 400) {
      status = "http-error";
      detail = `HTTP ${httpStatus}`;
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (/Something went wrong|Application error|500|404 Not Found/i.test(bodyText)) {
      status = "page-error";
      detail = bodyText.slice(0, 200);
    }

    await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
    log("route", { path, label, status, ms: Date.now() - start, detail });
    return status === "ok";
  } catch (err) {
    log("route", {
      path,
      label,
      status: "fail",
      ms: Date.now() - start,
      detail: String(err?.message || err),
    });
    return false;
  }
}

async function tryClick(page, namePattern, label) {
  try {
    const btn = page.getByRole("button", { name: namePattern }).first();
    if (!(await btn.isVisible({ timeout: 3000 }).catch(() => false))) {
      log("skip", { action: label, message: "button not visible" });
      return false;
    }
    await btn.click();
    await waitReady(page, 20000);
    await page.waitForTimeout(500);
    log("interaction", { action: label });
    return true;
  } catch (err) {
    log("skip", { action: label, message: String(err?.message || err) });
    return false;
  }
}

async function exercisePremiumSearch(page) {
  await visitRoute(page, "/numbers/premium", "premium-numbers");
  const areaInput = page.getByPlaceholder(/571, 703, 540/i);
  if (await areaInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await areaInput.fill("540");
    log("interaction", { action: "premium-area-code", value: "540" });
  }
  const industryInput = page.getByPlaceholder(/Plumbing, Roofing/i);
  if (await industryInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await industryInput.fill("Lawn care");
    log("interaction", { action: "premium-industry", value: "Lawn care" });
  }
  const searched = await tryClick(page, /find premium numbers/i, "premium-search");
  if (searched) {
    await page.waitForTimeout(15000);
    await page.screenshot({ path: `${OUT}/premium-search-results.png`, fullPage: true });
    const selectBtn = page.getByRole("button", { name: /select|choose|get this/i }).first();
    if (await selectBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await selectBtn.click();
      await waitReady(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${OUT}/premium-selected.png`, fullPage: true });
      log("interaction", { action: "premium-select-number", message: "stopped before checkout" });
    }
  }
}

async function exercisePortFlow(page) {
  await visitRoute(page, "/numbers/port", "port-in");
  // Fill partial form if visible — do NOT submit
  const input = page.locator('input[type="tel"], input[name*="phone"], input[placeholder*="number"]').first();
  if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await input.fill("+15551234567");
    log("interaction", { action: "port-fill-sample", message: "stopped before submit" });
    await page.screenshot({ path: `${OUT}/port-prefilled.png`, fullPage: true });
  }
}

async function exerciseForwarding(page) {
  await visitRoute(page, "/personal/forwarding", "personal-forwarding");
  const select = page.locator("select").first();
  if (await select.isVisible({ timeout: 3000 }).catch(() => false)) {
    const options = await select.locator("option").allTextContents();
    log("interaction", { action: "forwarding-options", count: options.length });
  }
}

async function exerciseVoicemail(page) {
  await visitRoute(page, "/personal/voicemail", "personal-voicemail");
  await tryClick(page, /record|upload|save/i, "voicemail-ui-interact");
}

async function exerciseSmartRouting(page) {
  await visitRoute(page, "/smart-routing", "smart-routing-list");
  await visitRoute(page, "/smart-routing/new", "smart-routing-new");
  const sim = page.getByRole("tab", { name: /simulator/i }).first();
  if (await sim.isVisible({ timeout: 3000 }).catch(() => false)) {
    await sim.click();
    await page.waitForTimeout(1000);
    log("interaction", { action: "smart-routing-simulator-tab" });
  }
}

async function exerciseReceptionist(page) {
  await visitRoute(page, "/voice/receptionist", "voice-receptionist");
  await visitRoute(page, "/voice/overview", "voice-overview");
  await visitRoute(page, "/voice/agents", "voice-agents-list");
}

const PERSONAL_ROUTES = [
  { path: "/personal", label: "personal-overview" },
  { path: "/personal/vault", label: "personal-vault" },
  { path: "/personal/numbers", label: "personal-numbers" },
  { path: "/personal/numbers/find", label: "ordinary-search" },
  { path: "/dashboard", label: "dashboard" },
];

const BUSINESS_ROUTES = [
  { path: "/dashboard", label: "business-dashboard" },
  { path: "/outcomes", label: "solutions-outcomes" },
  { path: "/numbers", label: "business-numbers" },
  { path: "/voice/calls", label: "voice-calls" },
  { path: "/integrations/native/leads", label: "lead-inbox" },
  { path: "/smart-routing", label: "smart-routing-list" },
  { path: "/smart-routing/new", label: "smart-routing-new" },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      report.consoleErrors.push({ text: msg.text().slice(0, 300), url: page.url() });
    }
  });
  page.on("response", async (res) => {
    try {
      if (!res.url().includes("/api/")) return;
      if (res.status() < 400) return;
      const url = res.url();
      if (url.includes("smoke-login")) return;
      report.apiErrors.push({ status: res.status(), url: url.slice(0, 200) });
    } catch {
      /* ignore */
    }
  });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await smokeLogin(page);
    await ensurePersonal(page);

    log("interaction", { action: "phase-personal" });
    for (const r of PERSONAL_ROUTES) {
      await visitRoute(page, r.path, r.label);
    }
    await exercisePremiumSearch(page);
    await exercisePortFlow(page);
    await exerciseForwarding(page);
    await exerciseVoicemail(page);

    log("interaction", { action: "phase-business" });
    const switched = await switchToBusiness(page);
    if (switched) {
      for (const r of BUSINESS_ROUTES) {
        await visitRoute(page, r.path, r.label);
      }
      await exerciseSmartRouting(page);
      await exerciseReceptionist(page);
    }

    const routeFails = report.routes.filter((r) => r.status !== "ok").length;
    report.ok =
      routeFails === 0 &&
      report.errors.length === 0 &&
      report.apiErrors.filter((e) => e.status >= 500).length === 0;
    report.finishedAt = new Date().toISOString();
    report.summary = {
      routesVisited: report.routes.length,
      routeFails,
      apiErrors: report.apiErrors.length,
      consoleErrors: report.consoleErrors.length,
      skipped: report.skipped.length,
    };
  } catch (err) {
    report.ok = false;
    log("error", { message: String(err?.message || err) });
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  await browser.close();

  console.log("\n--- Launch walkthrough ---");
  console.log(`Overall: ${report.ok ? "PASS" : "FAIL"}`);
  console.log(`Routes: ${report.summary?.routesVisited ?? 0}, fails: ${report.summary?.routeFails ?? "?"}`);
  console.log(`API errors: ${report.summary?.apiErrors ?? report.apiErrors.length}`);
  console.log(`Report: ${REPORT}`);
  process.exit(report.ok ? 0 : 1);
}

main();
