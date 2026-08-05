/**
 * Authenticated Salesforce live checks against production.
 * Signs up a fresh workspace (or uses SMOKE_EMAIL/SMOKE_PASSWORD), then:
 *  - GET /api/crm/env?provider=salesforce
 *  - GET /api/crm/providers
 *  - GET /api/crm/diagnostics?provider=salesforce
 *  - POST diagnostics env + oauth probes
 *  - POST acceptance suite (needs connected Salesforce on that workspace)
 */
import { chromium } from "playwright";
import { randomBytes } from "crypto";
import { writeFileSync } from "fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = process.env.SMOKE_EMAIL || `sfaccept${randomBytes(4).toString("hex")}@gmail.com`;
const PASSWORD = process.env.SMOKE_PASSWORD || "SmokeTest123!";
const NAME = "SF Acceptance Tester";

const out = {
  base: BASE,
  email: EMAIL,
  steps: [],
};

function record(id, ok, detail) {
  out.steps.push({ id, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${id}:`, typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 500));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  // Prefer login if credentials provided; else signup.
  if (process.env.SMOKE_EMAIL) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
  } else {
    await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
    await page.fill('input[name="name"]', NAME);
    await page.fill('input[name="businessName"]', "SF Acceptance Co");
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/signup"), { timeout: 25000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    if (page.url().includes("/signup") || page.url().includes("/login")) {
      await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
      await page.fill('input[name="email"]', EMAIL);
      await page.fill('input[name="password"]', PASSWORD);
      await Promise.all([
        page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25000 }).catch(() => null),
        page.click('button[type="submit"]'),
      ]);
    }
  }

  const authed = !page.url().includes("/login") && !page.url().includes("/signup");
  record("auth", authed, page.url());
  if (!authed) {
    throw new Error("Could not authenticate against production");
  }

  async function api(method, path, body) {
    return page.evaluate(
      async ({ method, path, body }) => {
        const res = await fetch(path, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text.slice(0, 500) };
        }
        return { status: res.status, json };
      },
      { method, path, body },
    );
  }

  const env = await api("GET", "/api/crm/env?provider=salesforce");
  record("crm_env", env.status === 200, {
    status: env.status,
    ok: env.json?.data?.env?.ok,
    callback: env.json?.data?.env?.callbackUrls?.salesforce,
    items: (env.json?.data?.env?.items || []).map((i) => ({
      key: i.key,
      ok: i.ok,
      required: i.required,
      message: i.message,
    })),
    provider: env.json?.data?.env?.providers?.[0],
  });

  const providers = await api("GET", "/api/crm/providers");
  const sf = (providers.json?.data || []).find((p) => p.id === "salesforce");
  record("crm_providers_salesforce", providers.status === 200 && Boolean(sf), {
    status: providers.status,
    envConfigured: sf?.envConfigured,
    oauthReady: sf?.oauthReady,
    missingEnv: sf?.missingEnv,
    callbackUrl: sf?.callbackUrl,
    connectionStatus: sf?.status,
    lastError: sf?.lastError,
    connectedAccountName: sf?.connectedAccountName,
  });

  const diag = await api("GET", `/api/crm/diagnostics?provider=salesforce`);
  record("crm_diagnostics_snapshot", diag.status === 200, {
    status: diag.status,
    snapshot: diag.json?.data?.snapshot
      ? {
          connected: diag.json.data.snapshot.connected,
          tokenValid: diag.json.data.snapshot.tokenValid,
          envReady: diag.json.data.snapshot.envReady,
          callbackUrl: diag.json.data.snapshot.callbackUrl,
          missingEnv: diag.json.data.snapshot.missingEnv,
          envItems: diag.json.data.snapshot.envItems,
          lastError: diag.json.data.snapshot.lastError,
        }
      : diag.json,
  });

  for (const probe of ["env", "oauth", "token_refresh", "api_reachable"]) {
    const r = await api("POST", "/api/crm/diagnostics", {
      provider: "salesforce",
      probe,
    });
    record(`probe_${probe}`, r.status === 200 && Boolean(r.json?.data?.ok || r.json?.data?.skipped), {
      status: r.status,
      result: r.json?.data || r.json,
    });
  }

  const acceptance = await api("POST", "/api/crm/diagnostics", {
    provider: "salesforce",
    action: "acceptance",
  });
  const items = acceptance.json?.data?.items || acceptance.json?.data?.report?.items || [];
  const report = acceptance.json?.data?.report || acceptance.json?.data;
  record("acceptance_suite", acceptance.status === 200, {
    status: acceptance.status,
    error: acceptance.json?.error,
    itemCount: Array.isArray(items) ? items.length : 0,
    items: Array.isArray(items)
      ? items.map((i) => ({ id: i.id, status: i.status, message: i.message }))
      : report,
  });

  // Open Salesforce CRM page for UI confirmation.
  await page.goto(`${BASE}/integrations/crm/salesforce?tab=diagnostics`, {
    waitUntil: "networkidle",
  });
  record("ui_salesforce_diagnostics", page.url().includes("/integrations/crm/salesforce"), page.url());
  await page.screenshot({
    path: "/tmp/cursor/sf-diagnostics.png",
    fullPage: true,
  });
} catch (err) {
  record("fatal", false, err instanceof Error ? err.message : String(err));
} finally {
  writeFileSync("/tmp/cursor/sf-live-acceptance.json", JSON.stringify(out, null, 2));
  console.log("\nWrote /tmp/cursor/sf-live-acceptance.json");
  await browser.close();
}

const failed = out.steps.filter((s) => !s.ok && s.id !== "acceptance_suite");
process.exitCode = failed.length ? 2 : 0;
