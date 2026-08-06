/**
 * Link the local 571 number to the approved Telnyx 10DLC campaign and send a test SMS.
 *
 *   BASE_URL=https://transovo.ai node scripts/sms-link-campaign-and-test.mjs
 *
 * Optional:
 *   PHONE_E164=+15714073615
 *   TO=+15714776175
 *   BODY="This is a test."
 *   CAMPAIGN_ID=...
 *   BRAND_ID=...
 */
const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const PHONE = (process.env.PHONE_E164 || "+15714073615").trim();
const TO = (process.env.TO || "+15714776175").trim();
const BODY = (process.env.BODY || "This is a test.").trim();
const CAMPAIGN_ID = (process.env.CAMPAIGN_ID || "").trim();
const BRAND_ID = (process.env.BRAND_ID || "").trim();

async function main() {
  const login = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL }),
  });
  if (!login.ok) throw new Error(`smoke-login ${login.status}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => String(c).split(";")[0])
    .join("; ");
  const h = { cookie, accept: "application/json", "content-type": "application/json" };

  const inv = await fetch(`${BASE}/api/messaging/10dlc`, { headers: h });
  const invText = await inv.text();
  if (!inv.ok) {
    throw new Error(
      `10dlc inventory ${inv.status}: ${invText.slice(0, 500)} (deploy the /api/messaging/10dlc route first)`,
    );
  }
  const inventory = JSON.parse(invText)?.data || {};
  console.log(
    JSON.stringify(
      {
        brands: (inventory.brands || []).slice(0, 10),
        campaigns: (inventory.campaigns || []).slice(0, 10),
        phoneNumbers: (inventory.phoneNumbers || []).slice(0, 10),
        assignments: (inventory.assignments || []).slice(0, 10),
      },
      null,
      2,
    ),
  );

  const assign = await fetch(`${BASE}/api/messaging/10dlc`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      action: "assign",
      phoneE164: PHONE,
      ...(CAMPAIGN_ID ? { campaignId: CAMPAIGN_ID } : {}),
      ...(BRAND_ID ? { brandId: BRAND_ID } : {}),
    }),
  });
  const assignJson = await assign.json().catch(() => ({}));
  console.log("assign", assign.status, JSON.stringify(assignJson, null, 2));
  if (!assign.ok) process.exit(1);

  const send = await fetch(`${BASE}/api/messaging/10dlc`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      action: "send_test",
      to: TO,
      body: BODY,
      from: PHONE,
    }),
  });
  const sendJson = await send.json().catch(() => ({}));
  console.log("send_test", send.status, JSON.stringify(sendJson, null, 2));
  if (!send.ok) process.exit(1);
  console.log(
    JSON.stringify(
      {
        ok: true,
        from: PHONE,
        to: TO,
        body: BODY,
        ready: assignJson?.data?.ready,
        campaignId: assignJson?.data?.campaignId,
        messageId: sendJson?.data?.messageId || sendJson?.data?.sid,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
