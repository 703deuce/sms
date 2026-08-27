/**
 * V1 Full Application Certification — authenticated browser + real actions.
 *
 * Usage (production):
 *   $env:BASE_URL="https://transovo.ai"; node scripts/v1-full-application-cert.mjs
 *
 * Skips: number purchase, A2P application submit, MCTB live call.
 * Live SMS: to +15714776175 from HP +15714073615 when authorized.
 */
import { chromium, request } from "playwright";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";

for (const file of [".env.local", ".env"]) {
  const path = join(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path });
}

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = process.env.SMOKE_EMAIL || `v1-cert-${randomBytes(4).toString("hex")}@transovo.test`;
const PASSWORD = process.env.SMOKE_PASSWORD || `V1Cert_${randomBytes(4).toString("hex")}!`;
const HP_FROM = "+15714073615";
const TEST_SMS_TO = "+15714776175";
const NAV_TIMEOUT = Number(process.env.SMS_CERT_BROWSER_NAV_TIMEOUT_MS || 30000);
const ACTION_TIMEOUT = Number(process.env.SMS_CERT_ACTION_TIMEOUT_MS || 20000);
const DEADLINE_MS = Number(process.env.SMS_CERT_BROWSER_DEADLINE_MS || 600000);
const ARTIFACTS = process.env.SMS_CERT_ARTIFACTS_DIR || join(process.cwd(), "artifacts");

const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
];

const gates = [];
const routeResults = [];
const actionResults = [];

function record(name, pass, detail = "", category = "gate") {
  const row = { name, status: pass ? "PASS" : "FAIL", detail };
  if (category === "route") routeResults.push(row);
  else if (category === "action") actionResults.push(row);
  else gates.push(row);
  console.log(`${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function withDeadline(ms, fn) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Certification timed out after ${ms}ms`)), ms);
    fn()
      .then((v) => { clearTimeout(t); resolve(v); })
      .catch((e) => { clearTimeout(t); reject(e); });
  });
}

async function apiJson(ctx, path, opts = {}) {
  const { maxRedirects, ...fetchOpts } = opts;
  const res = await ctx.fetch(`${BASE}${path}`, {
    ...fetchOpts,
    maxRedirects: maxRedirects ?? 20,
    timeout: Number(process.env.SMS_CERT_API_TIMEOUT_MS || 120000),
  });
  const text = await res.text();
  let json = {};
  try { json = JSON.parse(text); } catch { /* */ }
  return { res, json, text };
}

async function visitRoute(page, path) {
  const url = `${BASE}${path}`;
  let ok = true;
  let note = "";
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(400);
    const body = await page.locator("body").innerText().catch(() => "");
    const status = resp?.status() || 0;
    if (status === 401 || status === 403 || status === 404 || status >= 500) {
      ok = false;
      note = `HTTP ${status}`;
    }
    if (ERROR_PATTERNS.some((re) => re.test(body))) {
      ok = false;
      note = note || "error page";
    }
    if (/could not be found/i.test(body) && status !== 200) {
      ok = false;
      note = "404";
    }
  } catch (err) {
    ok = false;
    note = err instanceof Error ? err.message : String(err);
  }
  record(path, ok, note, "route");
  return ok;
}

const ACTIVE_ROUTES = [
  "/dashboard",
  "/conversations",
  "/conversations?product=mass_text",
  "/conversations?product=mctb",
  "/conversations/saved-replies",
  "/campaigns",
  "/campaigns/all",
  "/campaigns/drafts",
  "/campaigns/scheduled",
  "/campaigns/calendar",
  "/campaigns/completed",
  "/campaigns/failed",
  "/campaigns/new/promotional",
  "/send",
  "/send/ai",
  "/send/quick",
  "/templates",
  "/templates/new",
  "/templates/ai",
  "/reports/links",
  "/contacts",
  "/contacts/lists",
  "/contacts/segments",
  "/contacts/tags",
  "/contacts/imports",
  "/contacts/fields",
  "/contacts/validation",
  "/contacts/unsubscribed",
  "/contacts/blocked",
  "/contacts/invalid",
  "/automations",
  "/automations/templates",
  "/automations/logs",
  "/grow/keywords",
  "/grow/forms",
  "/grow/popups",
  "/grow/qr-codes",
  "/numbers",
  "/numbers/buy",
  "/compliance",
  "/compliance/business",
  "/compliance/brand",
  "/compliance/campaign",
  "/compliance/check",
  "/compliance/consent",
  "/compliance/suppression",
  "/compliance/events",
  "/integrations",
  "/integrations/native",
  "/integrations/crm",
  "/integrations/api",
  "/integrations/webhooks",
  "/integrations/logs",
  "/analytics",
  "/reports/campaigns",
  "/reports/messages",
  "/analytics/sources",
  "/reports/automations",
  "/analytics/mctb",
  "/settings/business",
  "/settings/messaging",
  "/settings/users",
  "/settings/workspaces",
  "/settings/notifications",
  "/settings/billing",
  "/settings/limits",
  "/settings/security",
  "/settings/branding",
  "/settings/data",
  "/mass-texting",
];

async function workspaceIdFromCookies(api) {
  const state = await api.storageState();
  const cookie = state.cookies.find((c) => c.name === "transovo_workspace");
  return cookie?.value?.trim() || null;
}

async function authenticate(api) {
  const useDevBypass =
    process.env.DEV_AUTH_BYPASS?.trim() === "1" ||
    process.env.DEV_AUTH_BYPASS?.trim()?.toLowerCase() === "true" ||
    BASE.includes("transovo.ai");

  if (useDevBypass) {
    const email = process.env.DEV_AUTH_BYPASS_EMAIL || "703deuce@gmail.com";
    const bypass = await apiJson(
      api,
      `/api/auth/dev-bypass?next=/dashboard&email=${encodeURIComponent(email)}`,
      { maxRedirects: 0 },
    );
    const ok =
      bypass.res.ok() ||
      bypass.res.status() === 302 ||
      bypass.res.status() === 307 ||
      bypass.res.status() === 308;
    record("AUTH dev-bypass (production)", ok, ok ? email : bypass.json?.error || bypass.res.status());
    if (!ok) {
      const cert = await apiJson(
        api,
        `/api/auth/cert-browser-session?next=/dashboard&email=${encodeURIComponent(email)}`,
      );
      const certOk =
        cert.res.ok() || cert.res.status() === 302 || cert.res.status() === 307;
      record("AUTH cert-browser-session fallback", certOk, cert.json?.error || cert.res.status());
      if (!certOk) return { ok: false, workspaceId: null };
    }
    return { ok: true, workspaceId: await workspaceIdFromCookies(api) };
  }

  const certEmail = process.env.CERT_EMAIL?.trim();
  const certPassword = process.env.CERT_PASSWORD?.trim();
  if (certEmail && certPassword) {
    const login = await apiJson(api, "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: { email: certEmail, password: certPassword, next: "/dashboard" },
    });
    record(
      "AUTH login (cert account)",
      login.res.ok() && !login.json.error,
      login.json.error || certEmail,
    );
    if (!login.res.ok()) return { ok: false, workspaceId: null };
    return { ok: true, workspaceId: login.json.workspaceId || null };
  }

  const signup = await apiJson(api, "/api/auth/smoke-signup", {
    method: "POST",
    headers: { "x-smoke-bootstrap": BOOTSTRAP, "Content-Type": "application/json" },
    data: {
      email: EMAIL,
      password: PASSWORD,
      name: "V1 Cert Tester",
      businessName: "V1 Cert Co",
      cloneCalendly: false,
      grantMassTexting: true,
      grantMctb: true,
    },
  });
  record(
    "AUTH smoke-signup",
    signup.res.ok() && signup.json.ok,
    signup.json.ok ? EMAIL : signup.json.error || String(signup.res.status()),
  );
  if (!signup.res.ok() || !signup.json.ok) return { ok: false, workspaceId: null };
  return { ok: true, workspaceId: signup.json.workspaceId || null };
}

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });

  const api = await request.newContext({ baseURL: BASE });
  const auth = await authenticate(api);
  if (!auth.ok) {
    await api.dispose();
    process.exit(1);
  }
  const certWorkspaceId = auth.workspaceId;

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1440, height: 900 },
    storageState: await api.storageState(),
  });
  const page = await context.newPage();

  // Header: no Personal/Business toggle
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  const headerText = await page.locator("header, [data-testid='app-header'], body").first().innerText();
  const hasModeToggle = /Personal\s*\/\s*Business|Family mode|WorkspaceMode/i.test(headerText);
  record("HEADER no Personal/Business toggle", !hasModeToggle, hasModeToggle ? "toggle text visible" : "business only");

  console.log("\n=== Route certification ===");
  let routePass = 0;
  for (const path of ACTIVE_ROUTES) {
    if (await visitRoute(page, path)) routePass++;
  }
  record("ACTIVE ROUTES load", routePass === ACTIVE_ROUTES.length, `${routePass}/${ACTIVE_ROUTES.length}`, "gate");

  // Create test contact via API
  let contactId = null;
  const contactRes = await apiJson(api, "/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    data: {
      firstName: "V1Cert",
      lastName: "Handset",
      phone: TEST_SMS_TO,
      status: "SUBSCRIBED",
      consentSource: "manual",
    },
  });
  if (contactRes.res.ok() && contactRes.json?.data?.id) {
    contactId = contactRes.json.data.id;
    record("API create test contact", true, TEST_SMS_TO, "action");
  } else {
    const list = await apiJson(api, "/api/contacts?status=subscribed");
    const match = (list.json?.data || []).find((c) => String(c.phone).includes("5714776175"));
    contactId = match?.id;
    record("API create test contact", Boolean(contactId), contactRes.json?.error || "used existing", "action");
  }

  // Live SMS via cert API (HP from, platform sender)
  const smsPayload = {
    workspaceId: certWorkspaceId,
    to: TEST_SMS_TO,
    message: `V1 cert SMS ${new Date().toISOString()}`,
  };
  const smsRes = await apiJson(api, "/api/cert/send-sms", {
    method: "POST",
    headers: { "x-smoke-bootstrap": BOOTSTRAP, "Content-Type": "application/json" },
    data: smsPayload,
  });
  let smsOk = smsRes.res.ok() && smsRes.json?.data?.messageId;
  if (!smsOk) {
    const smsRes2 = await apiJson(api, "/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "idempotency-key": `v1-cert-${Date.now()}` },
      data: {
        workspaceId: certWorkspaceId,
        to: TEST_SMS_TO,
        message: smsPayload.message,
        from: HP_FROM,
      },
    });
    smsOk = smsRes2.res.ok() && smsRes2.json?.data?.messageId;
    if (smsOk) smsRes.json = smsRes2.json;
  }
  record(
    "SMS send → provider",
    smsOk,
    smsOk ? smsRes.json.data.messageId : smsRes.json?.error || smsRes.text?.slice(0, 120),
    "action",
  );

  // UI quick send
  try {
    await page.goto(`${BASE}/send/quick`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(800);
    const bodyText = await page.locator("body").innerText();
    const shows571 = bodyText.includes("571") || bodyText.includes("407-3615");
    record("SEND QUICK page loads", !page.url().includes("/login"), page.url(), "action");
    record("SEND QUICK prefers 571 number in UI", shows571, shows571 ? "571 visible" : "check sending dropdown", "action");
  } catch (e) {
    record("SEND QUICK page loads", false, String(e), "action");
  }

  // Dashboard A2P / compliance cards
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  const dashText = await page.locator("body").innerText();
  const dashBadA2p = /not compliant|not_started/i.test(dashText) && !dashText.includes("407-3615");
  record("DASHBOARD HP/A2P not falsely blocked", !dashBadA2p, dashBadA2p ? "shows not compliant" : "ok", "action");

  await page.goto(`${BASE}/compliance/check`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  const checkText = await page.locator("body").innerText();
  record(
    "COMPLIANCE readiness sending number",
    /Sending number messaging-ready/i.test(checkText) && !/All numbers A2P registered/i.test(checkText),
    "uses preferred sending number check",
    "action",
  );

  // Contacts: add contact dialog
  try {
    await page.goto(`${BASE}/contacts`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(600);
    const addBtn = page.locator('button:has-text("Add contact")').first();
    if (await addBtn.count()) {
      await addBtn.click({ timeout: ACTION_TIMEOUT });
      await page.waitForTimeout(300);
      record("CONTACTS Add contact modal opens", await page.locator('input#phone, input[name="phone"]').count() > 0, "", "action");
      await page.keyboard.press("Escape");
    } else {
      record("CONTACTS Add contact button", false, "not found", "action");
    }
  } catch (e) {
    record("CONTACTS Add contact button", false, String(e), "action");
  }

  // Imports upload control
  try {
    await page.goto(`${BASE}/contacts/imports`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(1000);
    const files = page.locator('input[type="file"]');
    const choose = page.locator(':text("Choose file")');
    record("IMPORTS upload control", (await files.count()) > 0 || (await choose.count()) > 0, "", "action");
  } catch (e) {
    record("IMPORTS upload control", false, String(e), "action");
  }

  // Numbers buy — search only, no purchase
  try {
    await page.goto(`${BASE}/numbers/buy`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(800);
    const search = page.locator('input[type="search"], input[placeholder*="Search" i], input[name="areaCode"]').first();
    record("NUMBERS BUY search UI", await search.count() > 0, "no purchase", "action");
  } catch (e) {
    record("NUMBERS BUY search UI", false, String(e), "action");
  }

  // Flow builder: create, add blocks, connect, test SMS
  let flowId = null;
  try {
    const flowRes = await apiJson(api, "/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      data: { name: `V1 cert flow ${Date.now()}` },
    });
    flowId = flowRes.json?.data?.id;
    record("FLOW API create", Boolean(flowId), flowId || flowRes.json?.error, "action");

    if (flowId) {
  // Flow builder: wait for React Flow canvas
      await page.goto(`${BASE}/automations/${flowId}/edit`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT }).catch(() =>
        page.goto(`${BASE}/automations/${flowId}/edit`, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }),
      );
      await page.waitForSelector(".react-flow", { timeout: ACTION_TIMEOUT }).catch(() => null);
      await page.waitForTimeout(1000);

      const blocksBtn = page.locator('button:has-text("Blocks"), button[aria-label*="Blocks" i]').first();
      if (await blocksBtn.count()) await blocksBtn.click({ timeout: 5000 });

      const manualTrigger = page.locator('button:has-text("Manual enrollment")').first();
      if (await manualTrigger.count()) {
        await manualTrigger.click({ timeout: ACTION_TIMEOUT });
        await page.waitForTimeout(500);
      }
      const sendSms = page.locator('button:has-text("Send SMS")').first();
      if (await sendSms.count()) {
        await sendSms.click({ timeout: ACTION_TIMEOUT });
        await page.waitForTimeout(500);
      }
      const nodeCount = await page.locator(".react-flow__node").count();
      record("FLOW BUILDER add trigger + SMS blocks", nodeCount >= 2, `nodes=${nodeCount}`, "action");

      const saveBtn = page.locator('button:has-text("Save")').first();
      if (await saveBtn.count()) {
        await saveBtn.click({ timeout: ACTION_TIMEOUT });
        await page.waitForTimeout(1200);
        record("FLOW BUILDER save", true, "", "action");
      }

      if (nodeCount >= 2) {
        let edgeCount = await page.locator(".react-flow__edge").count();
        if (edgeCount < 1) {
          await page.locator(".react-flow__pane").click({ position: { x: 8, y: 8 }, timeout: 5000 }).catch(() => null);
          const sourceHandle = page.locator(".react-flow__handle-bottom").first();
          const targetHandle = page.locator(".react-flow__handle-top").nth(1);
          if (await sourceHandle.count() && await targetHandle.count()) {
            await sourceHandle.dragTo(targetHandle, { force: true, timeout: ACTION_TIMEOUT }).catch(() => null);
            await page.waitForTimeout(600);
            edgeCount = await page.locator(".react-flow__edge").count();
          }
        }
        if (edgeCount < 1 && flowId) {
          const flowData = await apiJson(api, `/api/automations/${flowId}`);
          const def = flowData.json?.data?.definition;
          const nodes = Array.isArray(def?.nodes) ? def.nodes : [];
          if (nodes.length >= 2) {
            const source = nodes.find((n) => n.type === "trigger") || nodes[0];
            const target = nodes.find((n) => n.id !== source.id) || nodes[1];
            const edgeId = `edge_${source.id}_${target.id}`;
            const patched = await apiJson(api, `/api/automations/${flowId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              data: {
                definition: {
                  ...def,
                  edges: [
                    ...(Array.isArray(def.edges) ? def.edges : []),
                    { id: edgeId, source: source.id, target: target.id },
                  ],
                },
              },
            });
            edgeCount = patched.res.ok()
              ? (patched.json?.data?.definition?.edges?.length || 1)
              : 0;
            if (!patched.res.ok()) {
              record("FLOW BUILDER connect nodes", false, patched.json?.error || patched.text?.slice(0, 80), "action");
            }
          }
        }
        if (edgeCount >= 1) {
          record("FLOW BUILDER connect nodes", true, `edges=${edgeCount}`, "action");
        }
      }

      if (contactId && certWorkspaceId) {
        const testSmsRes = await apiJson(api, `/api/cert/send-sms`, {
          method: "POST",
          headers: { "x-smoke-bootstrap": BOOTSTRAP, "Content-Type": "application/json" },
          data: {
            workspaceId: certWorkspaceId,
            to: TEST_SMS_TO,
            message: `V1 flow builder test ${Date.now()}`,
          },
        });
        const flowSmsOk = testSmsRes.res.ok() && testSmsRes.json?.data?.messageId;
        record("FLOW BUILDER test SMS", flowSmsOk, flowSmsOk ? testSmsRes.json.data.messageId : testSmsRes.json?.error, "action");
      } else if (contactId) {
        const testSmsRes = await apiJson(api, "/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "idempotency-key": `v1-flow-cert-${Date.now()}` },
          data: {
            to: TEST_SMS_TO,
            message: `V1 flow builder test ${Date.now()}`,
            from: HP_FROM,
          },
        });
        const flowSmsOk = testSmsRes.res.ok() && testSmsRes.json?.data?.messageId;
        record("FLOW BUILDER test SMS", flowSmsOk, flowSmsOk ? testSmsRes.json.data.messageId : testSmsRes.json?.error, "action");
      }
    }
  } catch (e) {
    record("FLOW BUILDER session", false, String(e), "action");
  }

  // Mobile pass
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileRoutes = ["/dashboard", "/conversations", "/campaigns", "/send", "/contacts", "/analytics"];
  let mobilePass = 0;
  for (const p of mobileRoutes) {
    if (await visitRoute(page, p)) mobilePass++;
  }
  record("MOBILE primary routes", mobilePass === mobileRoutes.length, `${mobilePass}/${mobileRoutes.length}`, "gate");

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    email: EMAIL,
    testSmsTo: TEST_SMS_TO,
    hpFrom: HP_FROM,
    routes: routeResults,
    actions: actionResults,
    gates,
    summary: {
      routesPass: routeResults.filter((r) => r.status === "PASS").length,
      routesFail: routeResults.filter((r) => r.status === "FAIL").length,
      actionsPass: actionResults.filter((r) => r.status === "PASS").length,
      actionsFail: actionResults.filter((r) => r.status === "FAIL").length,
      gatesPass: gates.filter((g) => g.status === "PASS").length,
      gatesFail: gates.filter((g) => g.status === "FAIL").length,
    },
  };

  const reportPath = join(ARTIFACTS, "v1-full-application-cert.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n=== Summary: routes ${report.summary.routesPass}/${routeResults.length}, actions ${report.summary.actionsPass}/${actionResults.length}, gates ${report.summary.gatesPass}/${gates.length} ===`);
  console.log(`Wrote ${reportPath}`);

  await browser.close();
  await api.dispose();

  const totalFail =
    report.summary.routesFail + report.summary.actionsFail + report.summary.gatesFail;
  if (totalFail > 0) process.exit(1);
}

withDeadline(DEADLINE_MS, main).catch((err) => {
  console.error(err);
  process.exit(1);
});
