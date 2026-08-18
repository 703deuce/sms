/**
 * API smoke test for Personal menu pages (excludes overview).
 * Run: BASE_URL=https://your-app.example npx tsx scripts/test-personal-menu-apis.mjs
 */
const BASE = (
  process.env.BASE_URL ||
  process.env.APP_URL ||
  process.env.LOCAL_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();

const steps = [];

function record(name, ok, detail) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function postJson(path, body, cookies = "") {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  const mergedCookies = mergeCookies(cookies, res.headers.getSetCookie?.() || []);
  return { ok: res.ok, status: res.status, json, cookies: mergedCookies };
}

async function getJson(path, cookies) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookies } });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function mergeCookies(existing, setCookies) {
  const jar = new Map();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [name, ...rest] = part.split("=");
    jar.set(name, rest.join("="));
  }
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    if (name) jar.set(name.trim(), rest.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  console.log(`Personal menu API smoke on ${BASE}`);

  const login = await postJson("/api/auth/smoke-login", { email: EMAIL });
  record("smoke-login", login.ok, login.ok ? EMAIL : JSON.stringify(login.json));
  if (!login.ok) process.exit(1);

  let cookies = login.cookies;
  const personal = await postJson("/api/workspace", { action: "create_personal" }, cookies);
  cookies = personal.cookies || cookies;
  const personalWs = personal.json.data?.id;
  record("personal-workspace", personal.ok && personalWs, personalWs || JSON.stringify(personal.json));

  await postJson("/api/workspace", { workspaceId: personalWs }, cookies);

  const numbers = await getJson("/api/numbers", cookies);
  const rows = numbers.json.data || [];
  record("my-numbers-api", numbers.ok, `count=${rows.length}`);
  const numberId = rows[0]?.id;
  const telnyx = rows.find((n) => n.provider === "telnyx");
  const twilio = rows.find((n) => n.provider === "twilio");
  record("has-telnyx-number", Boolean(telnyx), telnyx?.e164 || "none");
  record("has-twilio-number", Boolean(twilio), twilio?.e164 || "none (import via sync-twilio)");

  if (numberId) {
    const park = await postJson(`/api/personal/numbers/${numberId}`, { action: "park" }, cookies);
    record("vault-park", park.ok, park.ok ? "ok" : JSON.stringify(park.json));

    const react = await postJson(
      `/api/personal/numbers/${numberId}`,
      { action: "reactivate" },
      cookies,
    );
    record("vault-reactivate", react.ok, react.ok ? "ok" : JSON.stringify(react.json));

    const fwdPage = await getJson(`/api/numbers/${numberId}`, cookies);
    record("forwarding-number-get", fwdPage.ok, fwdPage.ok ? "ok" : String(fwdPage.status));

    const vm = await getJson("/api/phone/voicemail", cookies);
    record("voicemail-api", vm.ok, `boxes=${vm.json.data?.boxes?.length ?? 0}`);
  } else {
    record("vault-park", false, "no number");
  }

  const activity = await getJson("/api/personal/activity", cookies);
  record("call-activity", activity.ok, `rows=${activity.json.data?.length ?? 0}`);

  const analytics = await getJson("/api/personal/analytics?days=30", cookies);
  record("analytics", analytics.ok, `totalCalls=${analytics.json.data?.totalCalls ?? "?"}`);

  const blocked = await getJson("/api/personal/blocked", cookies);
  record("blocked-list", blocked.ok, `count=${blocked.json.data?.length ?? 0}`);

  const usage = await getJson("/api/personal/usage", cookies);
  record("usage", usage.ok, `used=${usage.json.data?.forwardingMinutesUsed ?? "?"}`);

  const flows = await getJson("/api/smart-routing/flows", cookies);
  const flowCount = flows.json.data?.length ?? flows.json.flows?.length ?? 0;
  record("smart-routing-api", flows.ok, `flows=${flowCount} (optional v1)`);

  const pages = [
    "/personal",
    "/personal/numbers",
    "/personal/numbers/premium",
    "/personal/vault",
    "/personal/forwarding",
    "/personal/voicemail",
    "/personal/activity",
    "/personal/analytics",
    "/personal/blocked",
    "/personal/usage",
    "/personal/porting",
    "/settings/billing",
    "/settings",
    "/contact",
  ];

  for (const path of pages) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookies } });
    record(`page ${path}`, res.ok, String(res.status));
  }

  const passed = steps.filter((s) => s.ok).length;
  console.log(`\n${passed}/${steps.length} passed`);
  if (steps.some((s) => !s.ok)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
