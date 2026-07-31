/**
 * QA audit: test all live pages and API routes.
 * Skips SMS send, A2P registration, toll-free, and phone OTP.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

type Result = { path: string; status: number; ok: boolean; note?: string };

const SKIP_API = [
  "/api/sms/send",
  "/api/auth/phone/send-code",
  "/api/auth/phone/verify-code",
  "/api/messaging/registration",
  "/api/messaging/numbers",
  "/api/twilio/",
  "/api/telnyx/",
  "/api/jobs/process",
];

const SKIP_PAGES = [
  "/sms-opt-in",
  "/send/test",
  "/send/quick",
  "/numbers/buy",
  "/numbers/port",
  "/numbers/pools",
  "/compliance",
  "/compliance/business",
  "/compliance/brand",
  "/compliance/campaign",
  "/compliance/check",
  "/compliance/events",
  "/admin/a2p",
];

const PUBLIC_PAGES = [
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/acceptable-use",
  "/contact",
];

const PROTECTED_PAGES = [
  "/dashboard",
  "/getting-started",
  "/send",
  "/inbox",
  "/inbox/mine",
  "/inbox/unassigned",
  "/inbox/archived",
  "/inbox/saved-replies",
  "/contacts",
  "/contacts/lists",
  "/contacts/segments",
  "/contacts/tags",
  "/contacts/imports",
  "/contacts/fields",
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
  "/campaigns/new/broadcast",
  "/automations",
  "/automations/new",
  "/automations/templates",
  "/automations/logs",
  "/templates",
  "/templates/new",
  "/templates/ai",
  "/grow/keywords",
  "/grow/forms",
  "/grow/qr-codes",
  "/grow/click-to-text",
  "/grow/pages",
  "/grow/sources",
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
  "/compliance/consent",
  "/compliance/suppression",
  "/integrations",
  "/integrations/api",
  "/integrations/webhooks",
  "/integrations/logs",
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
  "/admin",
  "/admin/customers",
  "/admin/monitoring",
  "/admin/numbers",
  "/admin/billing",
  "/admin/support",
  "/admin/settings",
];

const API_GET = [
  "/api/workspace",
  "/api/workspace/list",
  "/api/team",
  "/api/contacts",
  "/api/contacts/lists",
  "/api/contacts/segments",
  "/api/contacts/tags",
  "/api/campaigns",
  "/api/templates",
  "/api/automations",
  "/api/inbox",
  "/api/numbers",
  "/api/compliance/consent",
  "/api/compliance/suppression",
  "/api/growth/forms",
  "/api/growth/keywords",
  "/api/growth/qr",
  "/api/growth/click-to-text",
  "/api/keys",
  "/api/integrations/webhooks",
  "/api/reports/summary",
];

async function fetchPage(path: string, cookie?: string): Promise<Result> {
  try {
    const headers: Record<string, string> = {};
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
    const ok = res.status >= 200 && res.status < 400;
    return { path, status: res.status, ok, note: ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { path, status: 0, ok: false, note: String(e) };
  }
}

async function fetchApi(path: string, cookie?: string, method = "GET"): Promise<Result> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(`${BASE}${path}`, { method, headers });
    const ok = res.status >= 200 && res.status < 500;
    let note: string | undefined;
    if (!ok) {
      const body = await res.text();
      note = `HTTP ${res.status}: ${body.slice(0, 200)}`;
    }
    return { path, status: res.status, ok, note };
  } catch (e) {
    return { path, status: 0, ok: false, note: String(e) };
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "QA Audit",
      email: `qa-audit-${Date.now()}@transovo.test`,
      password: "TestPass123!",
      businessName: "QA Audit Workspace",
    }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  const sessionCookie = cookies.find((c) => c.startsWith("transovo_session="));
  const wsCookie = cookies.find((c) => c.startsWith("transovo_workspace="));
  if (!sessionCookie) throw new Error("No session cookie from signup");
  const parts = [sessionCookie.split(";")[0]];
  if (wsCookie) parts.push(wsCookie.split(";")[0]);
  return parts.join("; ");
}

async function main() {
  console.log("=== QA Audit for Transovo SMS ===\n");
  const failures: Result[] = [];

  // Public pages
  console.log("--- Public Pages ---");
  for (const path of PUBLIC_PAGES) {
    const r = await fetchPage(path);
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${path} → ${r.status}${r.note ? ` (${r.note})` : ""}`);
    if (!r.ok) failures.push(r);
  }

  // Unauthenticated protected pages should redirect
  console.log("\n--- Auth Guard (unauthenticated) ---");
  const guardTest = await fetchPage("/dashboard");
  const guardOk = guardTest.status === 307 || guardTest.status === 302;
  console.log(`${guardOk ? "✓" : "✗"} /dashboard without session → ${guardTest.status} (expect redirect)`);
  if (!guardOk) failures.push({ path: "/dashboard (no auth)", status: guardTest.status, ok: false });

  // Login
  console.log("\n--- Authenticating ---");
  const cookie = await login();
  console.log("✓ Created test session");

  // Protected pages
  console.log("\n--- Protected Pages ---");
  for (const path of PROTECTED_PAGES) {
    if (SKIP_PAGES.some((s) => path === s || path.startsWith(s + "/"))) continue;
    const r = await fetchPage(path, cookie);
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${path} → ${r.status}${r.note ? ` (${r.note})` : ""}`);
    if (!r.ok) failures.push(r);
  }

  // API routes
  console.log("\n--- API Routes (GET) ---");
  for (const path of API_GET) {
    if (SKIP_API.some((s) => path.startsWith(s))) continue;
    const r = await fetchApi(path, cookie);
    const mark = r.ok ? "✓" : "✗";
    console.log(`${mark} ${path} → ${r.status}${r.note ? ` (${r.note})` : ""}`);
    if (!r.ok) failures.push(r);
  }

  // API POST smoke tests
  console.log("\n--- API Routes (POST smoke) ---");
  const postTests: Array<{ path: string; body: object; expectStatus?: number }> = [
    { path: "/api/contacts", body: { phone: "+15551234567", firstName: "Test", lastName: "Contact" } },
    { path: "/api/contacts/lists", body: { name: "QA List" } },
    { path: "/api/contacts/tags", body: { name: "qa-tag" } },
    { path: "/api/templates", body: { name: "QA Template", body: "Hello {{firstName}}" } },
    { path: "/api/growth/keywords", body: { keyword: "JOIN", responseMessage: "Thanks!" } },
    { path: "/api/growth/forms", body: { name: "QA Form", slug: `qa-form-${Date.now()}` } },
  ];

  for (const t of postTests) {
    const r = await fetchApi(t.path, cookie, "POST");
    const body = await fetch(`${BASE}${t.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(t.body),
    });
    const status = body.status;
    const ok = status >= 200 && status < 300;
    const mark = ok ? "✓" : "✗";
    let note: string | undefined;
    if (!ok) {
      const text = await body.text();
      note = `HTTP ${status}: ${text.slice(0, 200)}`;
      failures.push({ path: `POST ${t.path}`, status, ok: false, note });
    }
    console.log(`${mark} POST ${t.path} → ${status}${note ? ` (${note})` : ""}`);
  }

  // Summary
  console.log("\n=== SUMMARY ===");
  if (failures.length === 0) {
    console.log("All tests passed!");
  } else {
    console.log(`${failures.length} failure(s):`);
    for (const f of failures) {
      console.log(`  ✗ ${f.path} → ${f.status} ${f.note || ""}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
