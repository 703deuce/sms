/**
 * Extended QA: campaign categories, dynamic routes, more API mutations, auth flows.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

type Fail = { test: string; detail: string };
const failures: Fail[] = [];

async function req(
  path: string,
  opts: { method?: string; cookie?: string; body?: object; expect?: number[] } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  const expect = opts.expect ?? [200, 201, 302, 307];
  if (!expect.includes(res.status)) {
    const text = await res.text().catch(() => "");
    failures.push({ test: `${opts.method || "GET"} ${path}`, detail: `HTTP ${res.status}: ${text.slice(0, 150)}` });
  }
  return res;
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "qa-test-127f@transovo.test", password: "TestPass123!" }),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

const CATEGORIES = [
  "broadcast", "follow_up", "welcome", "appointment", "missed_call", "review",
  "lead_nurture", "win_back", "promotion", "status_update", "payment",
  "event_rsvp", "data_collection", "custom",
];

async function main() {
  console.log("=== Extended QA Audit ===\n");
  const cookie = await login();
  if (!cookie) {
    failures.push({ test: "login", detail: "No session cookie" });
  } else {
    console.log("✓ Login");
  }

  // Auth flows
  await req("/api/auth/logout", { method: "POST", cookie, expect: [200] });
  const cookie2 = await login();
  console.log("✓ Logout + re-login");

  // Campaign categories
  console.log("\n--- Campaign categories ---");
  for (const cat of CATEGORIES) {
    await req(`/campaigns/new/${cat}`, { cookie: cookie2, expect: [200] });
  }
  console.log(`✓ ${CATEGORIES.length} campaign category pages`);

  // Compliance read-only pages
  await req("/compliance/consent", { cookie: cookie2 });
  await req("/compliance/suppression", { cookie: cookie2 });
  console.log("✓ Compliance read-only pages");

  // GET APIs with created resources
  const contactsRes = await fetch(`${BASE}/api/contacts`, { headers: { Cookie: cookie2 } });
  const contacts = (await contactsRes.json()) as { contacts?: Array<{ id: string }> };
  const contactId = contacts.contacts?.[0]?.id;

  const campaignsRes = await fetch(`${BASE}/api/campaigns`, { headers: { Cookie: cookie2 } });
  const campaigns = (await campaignsRes.json()) as { campaigns?: Array<{ id: string }> };

  const templatesRes = await fetch(`${BASE}/api/templates`, { headers: { Cookie: cookie2 } });
  const templates = (await templatesRes.json()) as { templates?: Array<{ id: string }> };

  const automationsRes = await fetch(`${BASE}/api/automations`, { headers: { Cookie: cookie2 } });
  const automations = (await automationsRes.json()) as { flows?: Array<{ id: string }> };

  // Dynamic pages
  if (contactId) {
    await req(`/contacts/${contactId}`, { cookie: cookie2 });
    await req(`/api/contacts/${contactId}`, { cookie: cookie2 });
    console.log("✓ Contact detail page + API");
  }

  // Create campaign draft
  const campRes = await fetch(`${BASE}/api/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie2 },
    body: JSON.stringify({ name: "QA Draft", category: "broadcast", body: "Test message", status: "DRAFT" }),
  });
  if (campRes.status >= 200 && campRes.status < 300) {
    const camp = (await campRes.json()) as { campaign?: { id: string }; id?: string };
    const campId = camp.campaign?.id || camp.id;
    if (campId) {
      await req(`/campaigns/${campId}`, { cookie: cookie2 });
      await req(`/api/campaigns/${campId}`, { cookie: cookie2 });
      console.log("✓ Campaign detail page + API");
    }
  } else {
    failures.push({ test: "POST /api/campaigns", detail: `HTTP ${campRes.status}` });
  }

  // Create automation
  const autoRes = await fetch(`${BASE}/api/automations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie2 },
    body: JSON.stringify({ name: "QA Flow", status: "DRAFT", trigger: { type: "keyword", keyword: "TEST" }, actions: [] }),
  });
  if (autoRes.status >= 200 && autoRes.status < 300) {
    const auto = (await autoRes.json()) as { flow?: { id: string }; id?: string };
    const flowId = auto.flow?.id || auto.id;
    if (flowId) {
      await req(`/automations/${flowId}`, { cookie: cookie2 });
      console.log("✓ Automation detail page");
    }
  } else {
    const text = await autoRes.text();
    failures.push({ test: "POST /api/automations", detail: `HTTP ${autoRes.status}: ${text.slice(0, 150)}` });
  }

  // Workspace update
  await req("/api/workspace", {
    method: "PUT",
    cookie: cookie2,
    body: { name: "QA Test Workspace" },
    expect: [200],
  });
  console.log("✓ Workspace update");

  // Segments POST
  await req("/api/contacts/segments", {
    method: "POST",
    cookie: cookie2,
    body: { name: "QA Segment", rules: [] },
    expect: [200, 201],
  });
  console.log("✓ Segment create");

  // API keys
  await req("/api/keys", {
    method: "POST",
    cookie: cookie2,
    body: { name: "QA Key" },
    expect: [200, 201],
  });
  console.log("✓ API key create");

  // Webhooks config GET
  await req("/api/integrations/webhooks", { cookie: cookie2 });
  console.log("✓ Webhooks API");

  // Admin customer detail
  const wsRes = await fetch(`${BASE}/api/workspace`, { headers: { Cookie: cookie2 } });
  const ws = (await wsRes.json()) as { workspace?: { id: string }; id?: string };
  const wsId = ws.workspace?.id || ws.id;
  if (wsId) {
    await req(`/admin/customers/${wsId}`, { cookie: cookie2 });
    console.log("✓ Admin customer detail");
  }

  // Public form API (GET only - no SMS)
  const formsRes = await fetch(`${BASE}/api/growth/forms`, { headers: { Cookie: cookie2 } });
  const forms = (await formsRes.json()) as { forms?: Array<{ slug: string }> };
  const slug = forms.forms?.[0]?.slug;
  if (slug) {
    await req(`/f/${slug}`, { expect: [200] });
    await req(`/api/public/forms/${slug}`, { expect: [200] });
    console.log("✓ Public form page + API");
  }

  console.log("\n=== SUMMARY ===");
  if (failures.length === 0) {
    console.log("All extended tests passed!");
  } else {
    console.log(`${failures.length} failure(s):`);
    for (const f of failures) console.log(`  ✗ ${f.test}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
