/**
 * Integration: purchase_number + callHandlingMode + publish (no browser).
 * Run: MESSAGING_PROVIDER=mock npx tsx scripts/test-call-handling-purchase-flow.ts
 */
import assert from "node:assert/strict";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);
const BOOTSTRAP = process.env.SMOKE_BOOTSTRAP || "transovo-smoke-bootstrap-b56f-aug2026";

async function main() {
  const signupRes = await fetch(`${BASE}/api/auth/smoke-signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({
      businessName: `SR purchase ${Date.now()}`,
      cloneCalendly: false,
      provisionNumber: false,
    }),
  });
  const signup = await signupRes.json();
  assert.equal(signupRes.ok, true, `smoke-signup: ${JSON.stringify(signup)}`);
  const cookie = signupRes.headers.getSetCookie?.() ?? [];
  const sessionCookie = cookie.map((c) => c.split(";")[0]).join("; ");
  assert.ok(sessionCookie, "expected session cookies from smoke-signup");

  const searchRes = await fetch(`${BASE}/api/messaging/numbers?areaCode=571`, {
    headers: { cookie: sessionCookie },
  });
  const searchJson = await searchRes.json();
  assert.ok(searchRes.ok, JSON.stringify(searchJson));
  const e164 = searchJson.data?.[0]?.phoneNumber;
  assert.ok(e164, "expected searchable number");

  const purchaseRes = await fetch(`${BASE}/api/messaging/registration`, {
    method: "POST",
    headers: { cookie: sessionCookie, "content-type": "application/json" },
    body: JSON.stringify({
      action: "purchase_number",
      phoneNumber: e164,
      callHandlingMode: "smart_routing",
      upstreamProvider: "telnyx",
    }),
  });
  const purchaseJson = await purchaseRes.json();
  assert.ok(purchaseRes.ok, JSON.stringify(purchaseJson));
  const phoneNumberId = purchaseJson.data?.purchasedPhoneNumberId;
  const flowId = purchaseJson.data?.callHandling?.flowId;
  assert.ok(phoneNumberId, "purchasedPhoneNumberId missing");
  assert.ok(flowId, "flowId missing from call handling apply");

  const numRes = await fetch(`${BASE}/api/numbers/${phoneNumberId}`, {
    headers: { cookie: sessionCookie },
  });
  const numJson = await numRes.json();
  assert.equal(numJson.data?.settingsJson?.callHandlingMode, "smart_routing");
  assert.notEqual(numJson.data?.settingsJson?.mctbSipIngress, true);

  const flowRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}`, {
    headers: { cookie: sessionCookie },
  });
  const flowJson = await flowRes.json();
  const menu = flowJson.data?.draftConfigJson?.menuOptions ?? [];
  assert.equal(menu.length, 2, "expected 2-option starter menu");

  const draft = flowJson.data.draftConfigJson;
  draft.menuOptions[0].phoneNumber = process.env.SR_TEST_SALES_E164 || "+15550101";
  draft.menuOptions[1].phoneNumber = process.env.SR_TEST_SUPPORT_E164 || "+15550102";
  draft.greeting = {
    source: "telnyx_tts",
    text: "Thanks for calling. Press 1 for Sales or 2 for Support.",
  };

  const patchRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}`, {
    method: "PATCH",
    headers: { cookie: sessionCookie, "content-type": "application/json" },
    body: JSON.stringify({
      name: flowJson.data.name,
      draftConfig: draft,
      triggerMode: flowJson.data.triggerMode,
      timezone: flowJson.data.timezone,
      assignedPhoneNumberId: phoneNumberId,
    }),
  });
  assert.ok(patchRes.ok, await patchRes.text());

  const publishRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/publish`, {
    method: "POST",
    headers: { cookie: sessionCookie },
  });
  const publishJson = await publishRes.json();
  assert.ok(publishRes.ok, JSON.stringify(publishJson));

  const modeRes = await fetch(`${BASE}/api/numbers/${phoneNumberId}/call-handling`, {
    headers: { cookie: sessionCookie },
  });
  const modeJson = await modeRes.json();
  assert.equal(modeJson.data?.mode, "smart_routing");

  console.log("test:call-handling-purchase-flow ok", { e164, phoneNumberId, flowId });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
