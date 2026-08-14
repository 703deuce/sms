/**
 * Activate Smart Routing phone menu on the 571 SMS/MCTB number (+15714073615).
 * Leaves +18663464256 on the voice agent (Amy).
 *
 *   BASE_URL=$APP_URL OWNER_EMAIL=... node scripts/smart-routing-activate-571.mjs
 */
const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (
  process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0] || ""
).trim().toLowerCase();
const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const PHONE_ID = (process.env.PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();
const TRANSFER_E164 = (process.env.TRANSFER_E164 || "+15714776175").trim();

async function smokeLogin() {
  const login = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: EMAIL, workspaceId: WORKSPACE_ID }),
  });
  if (!login.ok) throw new Error(`smoke-login ${login.status}: ${await login.text()}`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => String(c).split(";")[0])
    .join("; ");
  return {
    cookie,
    h: {
      cookie,
      accept: "application/json",
      "content-type": "application/json",
    },
  };
}

async function provision(h, action) {
  const res = await fetch(`${BASE}/api/numbers/${PHONE_ID}/provision`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ action }),
  });
  const json = await res.json().catch(() => ({}));
  console.log(`provision ${action}`, res.status, JSON.stringify(json.data?.channels || json, null, 2));
  return { ok: res.ok, json };
}

async function main() {
  if (!BASE) throw new Error("Set BASE_URL or APP_URL");
  const { h } = await smokeLogin();

  console.log("\n=== inbound repair (571) ===");
  const repair = await fetch(`${BASE}/api/numbers/telnyx-inbound-repair`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ e164: "+15714073615", repair: true }),
  });
  console.log("repair", repair.status, (await repair.text()).slice(0, 1200));

  console.log("\n=== enable voice ===");
  await provision(h, "diagnose");
  const voice = await provision(h, "enable_voice");
  if (!voice.ok) {
    await provision(h, "repair");
  }

  console.log("\n=== create smart routing flow ===");
  const createRes = await fetch(`${BASE}/api/smart-routing/flows`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ name: "Main Office Phone Menu", type: "phone_menu" }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok) throw new Error(`create flow: ${JSON.stringify(created)}`);
  const flowId = created.data?.id;
  const draftConfig = created.data?.draftConfigJson || created.data?.draftConfig;
  if (!flowId || !draftConfig) throw new Error("Missing flow id or draft");

  draftConfig.greeting = {
    source: "elevenlabs",
    text: "Thanks for calling Transovo. Press 1 for new service, 2 for appointments, or 3 for billing.",
  };
  draftConfig.menuOptions = [
    { digit: "1", label: "New Service", action: "transfer", phoneNumber: TRANSFER_E164 },
    { digit: "2", label: "Appointments", action: "transfer", phoneNumber: TRANSFER_E164 },
    { digit: "3", label: "Billing", action: "transfer", phoneNumber: TRANSFER_E164 },
  ];
  draftConfig.nodes = draftConfig.nodes.map((n) => {
    if (n.id === "opt1" || n.id === "opt2" || n.id === "opt3") {
      return { ...n, config: { ...n.config, phoneNumber: TRANSFER_E164 } };
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
    headers: h,
    body: JSON.stringify({
      draftConfig,
      assignedPhoneNumberId: PHONE_ID,
      numberMode: "transovo_number",
    }),
  });
  const patched = await patchRes.json().catch(() => ({}));
  if (!patchRes.ok) throw new Error(`patch flow: ${JSON.stringify(patched)}`);

  const validateRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/validate`, {
    method: "POST",
    headers: h,
  });
  console.log("validate", validateRes.status, await validateRes.text());

  const pubRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/publish`, {
    method: "POST",
    headers: h,
  });
  const published = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok) throw new Error(`publish: ${JSON.stringify(published)}`);

  const simRes = await fetch(`${BASE}/api/smart-routing/flows/${flowId}/simulate`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ digits: ["1"] }),
  });
  console.log("simulate", simRes.status, await simRes.text());

  console.log("\n=== READY ===");
  console.log(
    JSON.stringify(
      {
        flowId,
        callThisNumber: "+15714073615",
        transferTarget: TRANSFER_E164,
        amy866: "+18663464256 (unchanged — voice agent)",
        builderUrl: `${BASE}/smart-routing/${flowId}`,
        testUrl: `${BASE}/smart-routing/${flowId}/test`,
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
