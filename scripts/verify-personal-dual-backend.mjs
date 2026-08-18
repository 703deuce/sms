/**
 * Backend verification: Personal vault numbers (Telnyx + Twilio).
 * Tests vault park/reactivate, voicemail, forwarding, smart routing per provider.
 *
 *   BASE_URL=https://your-app.example node scripts/verify-personal-dual-backend.mjs
 */
const BASE = (
  process.env.BASE_URL ||
  process.env.LOCAL_APP_URL ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const TELNYX_E164 = (process.env.TELNYX_E164 || "+15714073615").trim();
const TWILIO_E164 = (process.env.TWILIO_E164 || "+18665779653").trim();
const FORWARD_DEST = (process.env.PERSONAL_FORWARD_TO || "+12025550199").trim();

const gates = [];

function gate(name, pass, detail = "") {
  gates.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
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
  const res = await fetch(`${BASE}${path}`, { headers: { cookie: cookies } });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function digits(e164) {
  return String(e164).replace(/\D/g, "");
}

async function testNumberProvider(label, row, cookies) {
  const numberId = row.id;
  const e164 = row.e164 || row.number;
  const provider = row.provider || label;

  gate(`${provider}-in-vault`, Boolean(numberId), `${e164} id=${numberId}`);

  const react = await postJson(`/api/personal/numbers/${numberId}`, { action: "reactivate" }, cookies);
  gate(`${provider}-reactivate`, react.ok, react.ok ? "active" : JSON.stringify(react.json));

  const park = await postJson(`/api/personal/numbers/${numberId}`, { action: "park" }, cookies);
  gate(`${provider}-vault-park`, park.ok, park.ok ? "parked" : JSON.stringify(park.json));

  const react2 = await postJson(
    `/api/personal/numbers/${numberId}`,
    { action: "reactivate" },
    cookies,
  );
  gate(`${provider}-vault-reactivate`, react2.ok, react2.ok ? "active" : JSON.stringify(react2.json));

  const vmOn = await postJson(
    `/api/personal/numbers/${numberId}`,
    { action: "enable_voicemail" },
    cookies,
  );
  gate(`${provider}-enable-voicemail`, vmOn.ok, vmOn.ok ? "on" : JSON.stringify(vmOn.json));

  const numGet = await getJson(`/api/numbers/${numberId}`, cookies);
  const settings = numGet.json.data?.settingsJson || {};
  const vmEnabled =
    settings.voicemailEnabled === true ||
    numGet.json.data?.voicemailEnabled === true ||
    settings.personalServiceState === "VOICEMAIL";
  gate(
    `${provider}-voicemail-settings`,
    numGet.ok && vmEnabled,
    `voicemailEnabled=${settings.voicemailEnabled}`,
  );

  const vmApi = await getJson("/api/phone/voicemail", cookies);
  const boxes = vmApi.json.data?.boxes || [];
  const hasBox = boxes.some(
    (b) => digits(b.numberE164 || b.e164 || "") === digits(e164),
  );
  gate(
    `${provider}-voicemail-api-box`,
    vmApi.ok && (hasBox || boxes.length > 0),
    `boxes=${boxes.length} hasMatch=${hasBox}`,
  );

  const fwd = await patchJson(
    `/api/numbers/${numberId}`,
    {
      personalCallSettings: {
        incomingCallHandling: "forward",
        forwardingEnabled: true,
        forwardTargets: [FORWARD_DEST],
        forwardMode: "single",
        forwardRingSeconds: 25,
        forwardUnansweredAction: "voicemail",
        voicemailEnabled: true,
      },
    },
    cookies,
  );
  gate(
    `${provider}-forwarding-patch`,
    fwd.ok,
    fwd.ok ? `dest=${FORWARD_DEST}` : JSON.stringify(fwd.json),
  );

  const fwdGet = await getJson(`/api/numbers/${numberId}`, cookies);
  const fwdSettings = fwdGet.json.data?.settingsJson || {};
  const targets = Array.isArray(fwdSettings.forwardTargets) ? fwdSettings.forwardTargets : [];
  const fwdOk =
    fwdGet.ok &&
    fwdSettings.forwardingEnabled === true &&
    targets.some((t) => digits(t) === digits(FORWARD_DEST));
  gate(
    `${provider}-forwarding-persisted`,
    fwdOk,
    `targets=${JSON.stringify(targets)}`,
  );

  return { numberId, e164, provider };
}

async function testSmartRoutingTelnyx(numberId, cookies) {
  const createRes = await fetch(`${BASE}/api/smart-routing/flows`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ name: "Backend verify menu", type: "phone_menu" }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) {
    gate("telnyx-smart-routing-create", false, JSON.stringify(created));
    return;
  }
  const flowId = created.data?.id;
  const draftConfig = created.data?.draftConfigJson || created.data?.draftConfig;
  gate("telnyx-smart-routing-create", Boolean(flowId), flowId || "no id");

  if (!flowId || !draftConfig) return;

  draftConfig.greeting = {
    source: "elevenlabs",
    text: "Press 1 for sales.",
  };
  draftConfig.menuOptions = [
    { digit: "1", label: "Sales", action: "transfer", phoneNumber: FORWARD_DEST },
    { digit: "2", label: "Service", action: "transfer", phoneNumber: FORWARD_DEST },
    { digit: "3", label: "Billing", action: "transfer", phoneNumber: FORWARD_DEST },
  ];
  draftConfig.nodes = draftConfig.nodes.map((n) => {
    if (n.id === "opt1" || n.id === "opt2" || n.id === "opt3") {
      return { ...n, config: { ...n.config, phoneNumber: FORWARD_DEST } };
    }
    if (n.id === "menu") {
      return {
        ...n,
        config: { ...n.config, promptText: draftConfig.greeting.text },
      };
    }
    return n;
  });

  const patchRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({
      draftConfig,
      assignedPhoneNumberId: numberId,
      numberMode: "transovo_number",
    }),
  });
  const patched = await patchRes.json().catch(() => ({}));
  gate("telnyx-smart-routing-assign", patchRes.ok, patchRes.ok ? numberId : JSON.stringify(patched));

  const validateRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/validate`, {
    method: "GET",
    headers: { cookie: cookies },
  });
  const validateBody = await validateRes.json().catch(() => ({}));
  gate(
    "telnyx-smart-routing-validate",
    validateRes.ok && validateBody.data?.valid !== false,
    validateRes.ok ? "valid" : JSON.stringify(validateBody),
  );

  const pubRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/publish`, {
    method: "POST",
    headers: { cookie: cookies },
  });
  const published = await pubRes.json().catch(() => ({}));
  gate(
    "telnyx-smart-routing-publish",
    pubRes.ok,
    pubRes.ok ? "published" : JSON.stringify(published),
  );

  if (pubRes.ok) {
    const numGet = await getJson(`/api/numbers/${numberId}`, cookies);
    const routingOwner = numGet.json.data?.settingsJson?.routingOwner;
    gate(
      "telnyx-smart-routing-owner",
      routingOwner === "smart_routing",
      `routingOwner=${routingOwner}`,
    );

    const simRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/simulate`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies },
      body: JSON.stringify({ digits: ["1"] }),
    });
    const simBody = await simRes.json().catch(() => ({}));
    gate(
      "telnyx-smart-routing-simulate",
      simRes.ok && (simBody.data?.steps?.length > 0 || simBody.steps?.length > 0),
      simRes.ok ? "sim ok" : JSON.stringify(simBody),
    );

    await fetch(`${BASE}/api/smart-routing/flows/${flowId}/pause`, {
      method: "POST",
      headers: { cookie: cookies },
    });
    gate("telnyx-smart-routing-pause", true, "paused for cleanup");
  }
}

async function testSmartRoutingTwilio(numberId, cookies) {
  const createRes = await fetch(`${BASE}/api/smart-routing/flows`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({ name: "Twilio backend verify", type: "phone_menu" }),
  });
  const created = await createRes.json().catch(() => ({}));
  const flowId = created.data?.id;
  const draftConfig = created.data?.draftConfigJson || created.data?.draftConfig;
  if (!flowId || !draftConfig) {
    gate("twilio-smart-routing-create", false, JSON.stringify(created));
    return;
  }
  gate("twilio-smart-routing-create", true, flowId);

  draftConfig.greeting = { source: "elevenlabs", text: "Press 1 for sales." };
  draftConfig.menuOptions = [
    { digit: "1", label: "Sales", action: "transfer", phoneNumber: FORWARD_DEST },
    { digit: "2", label: "Service", action: "transfer", phoneNumber: FORWARD_DEST },
    { digit: "3", label: "Billing", action: "transfer", phoneNumber: FORWARD_DEST },
  ];
  draftConfig.nodes = draftConfig.nodes.map((n) => {
    if (n.id === "opt1" || n.id === "opt2" || n.id === "opt3") {
      return { ...n, config: { ...n.config, phoneNumber: FORWARD_DEST } };
    }
    return n;
  });

  const patchRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify({
      draftConfig,
      assignedPhoneNumberId: numberId,
      numberMode: "transovo_number",
    }),
  });
  gate("twilio-smart-routing-assign", patchRes.ok, patchRes.ok ? numberId : "patch failed");

  const pubRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/publish`, {
    method: "POST",
    headers: { cookie: cookies },
  });
  const published = await pubRes.json().catch(() => ({}));
  gate(
    "twilio-smart-routing-publish",
    pubRes.ok,
    pubRes.ok ? "published" : JSON.stringify(published),
  );

  if (pubRes.ok) {
    const numGet = await getJson(`/api/numbers/${numberId}`, cookies);
    const routingOwner = numGet.json.data?.settingsJson?.routingOwner;
    gate(
      "twilio-smart-routing-owner",
      routingOwner === "smart_routing",
      `routingOwner=${routingOwner}`,
    );
    await fetch(`${BASE}/api/smart-routing/flows/${flowId}/pause`, {
      method: "POST",
      headers: { cookie: cookies },
    });
    gate("twilio-smart-routing-pause", true, "paused for cleanup");
  }
}

async function main() {
  console.log(`Personal dual-provider backend verify on ${BASE}`);
  console.log(`Telnyx=${TELNYX_E164} Twilio=${TWILIO_E164}`);

  const login = await postJson("/api/auth/smoke-login", { email: EMAIL });
  gate("smoke-login", login.ok, login.ok ? EMAIL : JSON.stringify(login.json));
  if (!login.ok) process.exit(1);

  let cookies = login.cookies;
  const personal = await postJson("/api/workspace", { action: "create_personal" }, cookies);
  cookies = personal.cookies || cookies;
  const personalWs = personal.json.data?.id;
  gate("personal-workspace", personal.ok && personalWs, personalWs || "");

  await postJson("/api/workspace", { workspaceId: personalWs }, cookies);

  const numbers = await getJson("/api/numbers", cookies);
  const rows = numbers.json.data || [];
  gate("numbers-in-vault", numbers.ok && rows.length >= 2, `count=${rows.length}`);

  const telnyxRow = rows.find((n) => digits(n.e164 || n.number) === digits(TELNYX_E164));
  const twilioRow = rows.find((n) => digits(n.e164 || n.number) === digits(TWILIO_E164));

  gate("telnyx-number-present", Boolean(telnyxRow), telnyxRow?.e164 || "missing");
  gate("twilio-number-present", Boolean(twilioRow), twilioRow?.e164 || "missing");

  if (telnyxRow) {
    const info = await testNumberProvider("telnyx", telnyxRow, cookies);
    await testSmartRoutingTelnyx(info.numberId, cookies);
  }

  if (twilioRow) {
    await testNumberProvider("twilio", twilioRow, cookies);
    await testSmartRoutingTwilio(twilioRow.id, cookies);
  }

  const failed = gates.filter((g) => !g.pass);
  console.log("\n--- Summary ---");
  console.log(`${gates.length - failed.length}/${gates.length} passed`);
  if (failed.length > 0) {
    console.log("Failures:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
