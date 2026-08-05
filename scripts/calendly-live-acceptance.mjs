/**
 * Authenticated Calendly live checks against production.
 * Signs up a fresh workspace (or SMOKE_EMAIL/SMOKE_PASSWORD), then probes
 * native env/diagnostics/oauth_start/acceptance for calendly.
 */
import { chromium } from "playwright";
import { randomBytes, createHmac } from "crypto";
import { writeFileSync } from "fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = process.env.SMOKE_EMAIL || `calaccept${randomBytes(4).toString("hex")}@gmail.com`;
const PASSWORD = process.env.SMOKE_PASSWORD || "SmokeTest123!";
const NAME = "Calendly Acceptance Tester";

const out = { base: BASE, email: EMAIL, steps: [] };

function record(id, ok, detail) {
  out.steps.push({ id, ok, detail });
  console.log(
    `${ok ? "✓" : "✗"} ${id}:`,
    typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 800),
  );
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
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
    await page.fill('input[name="businessName"]', "Cal Acceptance Co");
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await Promise.all([
      page.waitForURL((u) => !u.pathname.includes("/signup"), { timeout: 25000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    if (page.url().includes("/signup") || page.url().includes("/login")) {
      // Signup may require SMS OTP — try login path next.
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
    // Public route probes still useful without auth
    const cb = await fetch(`${BASE}/api/integrations/native/calendly/callback`);
    record("public_callback", cb.status === 307 || cb.status === 302, {
      status: cb.status,
      location: cb.headers.get("location"),
    });
    const wh = await fetch(`${BASE}/api/integrations/native/webhooks/calendly`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "invitee.created" }),
    });
    const whText = await wh.text();
    record("public_webhook_rejects_unsigned", wh.status === 401, {
      status: wh.status,
      body: whText.slice(0, 200),
    });
    throw new Error("Could not authenticate against production (likely SMS OTP)");
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

  const env = await api("GET", "/api/integrations/native/env");
  record("native_env", env.status === 200, {
    status: env.status,
    calendlyCallback: env.json?.callbacks?.calendly || env.json?.data?.callbacks?.calendly,
    body: env.json,
  });

  const diag = await api("POST", "/api/integrations/native", {
    provider: "calendly",
    action: "diagnostics",
  });
  const snap = diag.json?.snapshot || diag.json?.data || diag.json;
  record("diagnostics", diag.status === 200, {
    status: diag.status,
    envReady: snap?.env?.ready,
    missing: snap?.env?.missing,
    callbackUrl: snap?.env?.callbackUrl,
    calendly: snap?.calendly,
    statusConn: snap?.status,
    secretsPresent: snap?.secretsPresent,
  });

  const oauth = await api("POST", "/api/integrations/native", {
    provider: "calendly",
    action: "oauth_start",
  });
  const authUrl =
    oauth.json?.url || oauth.json?.authorizeUrl || oauth.json?.data?.url || null;
  record("oauth_start", oauth.status === 200 && Boolean(authUrl), {
    status: oauth.status,
    url: authUrl,
    body: oauth.json,
  });
  if (authUrl) {
    const u = new URL(authUrl);
    record("oauth_authorize_host", u.hostname === "auth.calendly.com", u.hostname);
    record("oauth_redirect_uri", u.searchParams.get("redirect_uri"), null);
    record(
      "oauth_scopes",
      (u.searchParams.get("scope") || "").includes("users:read"),
      u.searchParams.get("scope"),
    );
  }

  // Unsigned webhook must fail (signature required when key configured / always for calendly)
  const wh = await fetch(`${BASE}/api/integrations/native/webhooks/calendly`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "invitee.created" }),
  });
  record("webhook_unsigned_rejected", wh.status === 401, { status: wh.status });

  // Bad signature rejected
  const body = JSON.stringify({ event: "invitee.created", payload: { email: "x@y.com" } });
  const bad = await fetch(`${BASE}/api/integrations/native/webhooks/calendly?token=test`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "calendly-webhook-signature": `t=${Math.floor(Date.now() / 1000)},v1=${createHmac("sha256", "wrong").update("x").digest("hex")}`,
    },
    body,
  });
  record("webhook_bad_signature_rejected", bad.status === 401, { status: bad.status });

  // Acceptance only meaningful if connected — still run to capture statuses
  const acceptance = await api("POST", "/api/integrations/native", {
    provider: "calendly",
    action: "acceptance",
  });
  record("acceptance", acceptance.status === 200, acceptance.json);

  // If already connected on this workspace, run probes
  if (snap?.status === "connected") {
    for (const probe of ["validate", "identify", "read", "register_webhooks", "force_sync"]) {
      const r = await api("POST", "/api/integrations/native", {
        provider: "calendly",
        action: "probe",
        probe,
      });
      record(`probe_${probe}`, r.status === 200 && r.json?.ok !== false, r.json);
    }
  } else {
    record(
      "connected_probes",
      false,
      "Workspace not connected to Calendly — complete Connect in UI with your Calendly account, then re-run",
    );
  }
} catch (err) {
  record("fatal", false, err instanceof Error ? err.message : String(err));
} finally {
  writeFileSync("/tmp/calendly-live-acceptance.json", JSON.stringify(out, null, 2));
  console.log("\nWrote /tmp/calendly-live-acceptance.json");
  await browser.close();
  const failed = out.steps.filter((s) => !s.ok && s.id !== "connected_probes");
  process.exit(failed.some((s) => s.id === "fatal" || s.id === "auth") ? 1 : 0);
}
