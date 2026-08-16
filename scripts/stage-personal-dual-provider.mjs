/**
 * Stage Personal workspace with Telnyx + Twilio test numbers and wire core settings.
 *
 *   BASE_URL=https://your-app.example npx tsx scripts/stage-personal-dual-provider.mjs
 *   TWILIO_E164=+1... TELNYX_E164=+15714073615
 */
const BASE = (
  process.env.BASE_URL ||
  process.env.APP_URL ||
  process.env.LOCAL_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const TELNYX_E164 = (process.env.TELNYX_E164 || "+15714073615").trim();
const TWILIO_E164 = (process.env.TWILIO_E164 || process.env.TWILIO_FROM_NUMBER || "").trim();
const FORWARD_DEST = (process.env.PERSONAL_FORWARD_TO || "+12025550199").trim();

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

async function patchJson(path, body, cookies) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function getJson(path, cookies) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookies ? { cookie: cookies } : { "x-smoke-bootstrap": BOOTSTRAP },
  });
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

function log(step, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${step}: ${detail}`);
  return ok;
}

async function main() {
  console.log(`Staging Personal dual-provider on ${BASE}`);

  const login = await postJson("/api/auth/smoke-login", { email: EMAIL });
  if (!login.ok) {
    console.error("smoke-login failed", login.json);
    process.exit(1);
  }
  let cookies = login.cookies;

  const personal = await postJson("/api/workspace", { action: "create_personal" }, cookies);
  cookies = personal.cookies || cookies;
  const personalWorkspaceId = personal.json.data?.id;
  if (!personal.ok || !personalWorkspaceId) {
    console.error("create_personal failed", personal.json);
    process.exit(1);
  }

  await postJson("/api/workspace", { workspaceId: personalWorkspaceId }, cookies);

  // Telnyx sync
  const telnyxSync = await postJson(
    "/api/numbers/sync-telnyx",
    { e164s: [TELNYX_E164], attachConnection: true },
    cookies,
  );
  log("sync-telnyx", telnyxSync.ok, telnyxSync.ok ? TELNYX_E164 : JSON.stringify(telnyxSync.json));

  // Twilio sync
  if (TWILIO_E164) {
    const twilioSync = await postJson(
      "/api/numbers/sync-twilio",
      { e164s: [TWILIO_E164], transferFromParent: true },
      cookies,
    );
    log("sync-twilio", twilioSync.ok, twilioSync.ok ? TWILIO_E164 : JSON.stringify(twilioSync.json));
  } else {
    log("sync-twilio", false, "Set TWILIO_E164 or TWILIO_FROM_NUMBER");
  }

  const numbers = await getJson("/api/numbers", cookies);
  const rows = numbers.json.data || [];
  log("list-numbers", numbers.ok && rows.length > 0, `count=${rows.length}`);

  const telnyxRow = rows.find(
    (n) => String(n.e164 || n.number).replace(/\D/g, "") === TELNYX_E164.replace(/\D/g, ""),
  );
  const twilioRow = TWILIO_E164
    ? rows.find(
        (n) => String(n.e164 || n.number).replace(/\D/g, "") === TWILIO_E164.replace(/\D/g, ""),
      )
    : null;

  if (telnyxRow) {
    log("telnyx-provider", telnyxRow.provider === "telnyx", `${telnyxRow.e164} id=${telnyxRow.id}`);
  }

  if (twilioRow) {
    log("twilio-provider", twilioRow.provider === "twilio", `${twilioRow.e164} id=${twilioRow.id}`);
  }

  const testNumber = telnyxRow || twilioRow || rows[0];
  if (!testNumber) {
    console.error("No numbers to configure");
    process.exit(1);
  }

  const numberId = testNumber.id;

  // Park + reactivate (vault)
  const park = await postJson(`/api/personal/numbers/${numberId}`, { action: "park" }, cookies);
  log("park", park.ok, park.ok ? "parked" : JSON.stringify(park.json));

  const react = await postJson(
    `/api/personal/numbers/${numberId}`,
    { action: "reactivate" },
    cookies,
  );
  log("reactivate", react.ok, react.ok ? "active" : JSON.stringify(react.json));

  // Voicemail enable
  const vmOn = await postJson(
    `/api/personal/numbers/${numberId}`,
    { action: "enable_voicemail" },
    cookies,
  );
  log("enable-voicemail", vmOn.ok, vmOn.ok ? "on" : JSON.stringify(vmOn.json));

  const vmApi = await getJson("/api/phone/voicemail", cookies);
  log("voicemail-api", vmApi.ok, `boxes=${vmApi.json.boxes?.length ?? 0}`);

  // Forwarding via numbers PATCH (UI path)
  const fwd = await patchJson(
    `/api/numbers/${numberId}`,
    {
      personalCallSettings: {
        forwardingEnabled: true,
        forwardTargets: [FORWARD_DEST],
        forwardMode: "always",
        forwardRingSeconds: 25,
        forwardUnansweredAction: "voicemail",
        voicemailEnabled: true,
      },
    },
    cookies,
  );
  log("forwarding-patch", fwd.ok, fwd.ok ? FORWARD_DEST : JSON.stringify(fwd.json));

  // Blocked list
  const blockedAdd = await postJson(
    "/api/personal/blocked",
    { phone: "+15551234567", numberId, reason: "staging test" },
    cookies,
  );
  log("blocked-add", blockedAdd.ok, blockedAdd.ok ? "added" : JSON.stringify(blockedAdd.json));

  const blockedList = await getJson("/api/personal/blocked?numberId=" + numberId, cookies);
  log("blocked-list", blockedList.ok, `count=${blockedList.json.data?.length ?? 0}`);

  // Analytics + usage + activity
  const analytics = await getJson("/api/personal/analytics?days=30", cookies);
  log("analytics", analytics.ok, `calls=${analytics.json.data?.totalCalls ?? "?"}`);

  const usage = await getJson("/api/personal/usage", cookies);
  log("usage", usage.ok, `minutes=${usage.json.data?.forwardingMinutesUsed ?? "?"}`);

  const activity = await getJson("/api/personal/activity", cookies);
  log("activity", activity.ok, `rows=${activity.json.data?.length ?? 0}`);

  // Smart routing list
  const flows = await getJson("/api/smart-routing/flows", cookies);
  log("smart-routing-flows", flows.ok, `flows=${flows.json.data?.length ?? flows.json.flows?.length ?? 0}`);

  console.log("\n--- Summary ---");
  console.log(
    JSON.stringify(
      {
        personalWorkspaceId,
        numbers: rows.map((n) => ({
          id: n.id,
          e164: n.e164 || n.number,
          provider: n.provider,
        })),
        testNumberId: numberId,
        urls: {
          vault: `${BASE}/personal/vault`,
          forwarding: `${BASE}/personal/forwarding?numberId=${numberId}`,
          voicemail: `${BASE}/personal/voicemail?numberId=${numberId}`,
          analytics: `${BASE}/personal/analytics`,
          blocked: `${BASE}/personal/blocked?numberId=${numberId}`,
          usage: `${BASE}/personal/usage`,
          smartRouting: `${BASE}/smart-routing`,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
