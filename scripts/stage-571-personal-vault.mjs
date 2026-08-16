/**
 * Stage a 571 Telnyx line into Personal workspace (optionally park in Number Vault).
 *
 * Default target: +15714073615 (PHONE_ID cmsgtjms84g6l2h0o255w1e3v).
 *
 *   npx tsx scripts/stage-571-personal-vault.mjs
 *   TARGET_E164=+15714073615 PARK=1 BASE_URL=https://your-app.example
 *
 * Requires smoke bootstrap header on the target environment.
 */
const BASE = (
  process.env.BASE_URL ||
  process.env.LOCAL_APP_URL ||
  process.env.PERSONAL_SCREENSHOT_BASE ||
  "http://localhost:3000"
).replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const TARGET_E164 = (process.env.TARGET_E164 || "+15714073615").trim();
const PHONE_ID = (process.env.PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();
const PARK = process.env.PARK !== "0";

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

async function getJson(path, cookies) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookies ? { cookie: cookies } : { "x-smoke-bootstrap": BOOTSTRAP },
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function pick571(numbers) {
  const byE164 = numbers.find(
    (n) => String(n.number || n.e164 || "").replace(/\D/g, "") === TARGET_E164.replace(/\D/g, ""),
  );
  if (byE164) return byE164;
  const byId = numbers.find((n) => n.id === PHONE_ID);
  if (byId) return byId;
  return numbers.find((n) => String(n.number || n.e164 || "").includes("571"));
}

async function main() {
  console.log(`Staging ${TARGET_E164} → Personal (park=${PARK}) on ${BASE}`);

  const login = await postJson("/api/auth/smoke-login", { email: EMAIL });
  if (!login.ok) {
    console.error("smoke-login failed", login.status, login.json);
    process.exit(1);
  }
  let cookies = login.cookies;
  const businessWorkspaceId = login.json.workspaceId;

  const personal = await postJson("/api/workspace", { action: "create_personal" }, cookies);
  cookies = personal.cookies || cookies;
  const personalWorkspaceId = personal.json.data?.id;
  if (!personal.ok || !personalWorkspaceId) {
    console.error("create_personal failed", personal.status, personal.json);
    process.exit(1);
  }

  if (businessWorkspaceId) {
    const switchBiz = await postJson(
      "/api/workspace",
      { workspaceId: businessWorkspaceId },
      cookies,
    );
    cookies = switchBiz.cookies || cookies;
  }

  const bizWs = await getJson("/api/workspace", cookies);
  const businessNumbers = bizWs.json.data?.phoneNumbers || [];
  const donor = pick571(businessNumbers);

  let numberId = donor?.id;
  let numberE164 = donor?.number || donor?.e164;

  if (!numberId && businessWorkspaceId) {
    const bizList = await getJson("/api/numbers", cookies);
    const apiNumbers = bizList.json.data || [];
    const fromApi = pick571(apiNumbers);
    numberId = fromApi?.id;
    numberE164 = fromApi?.e164 || fromApi?.number;
  }

  if (!numberId) {
    console.error(
      `No 571 number found in business workspace. Set TARGET_E164 or PHONE_ID. Business numbers: ${businessNumbers.length}`,
    );
    process.exit(1);
  }

  const currentWs = donor?.workspaceId || businessWorkspaceId;
  if (currentWs !== personalWorkspaceId) {
    const move = await postJson(
      `/api/numbers/${numberId}/move-workspace`,
      { targetWorkspaceId: personalWorkspaceId },
      cookies,
    );
    if (!move.ok) {
      console.error("move-workspace failed", move.status, move.json);
      process.exit(1);
    }
    numberE164 = move.json.data?.e164 || numberE164;
    console.log(`Moved ${numberE164} to personal workspace ${personalWorkspaceId}`);
  } else {
    console.log(`Number ${numberE164} already in personal workspace`);
  }

  const switchPersonal = await postJson(
    "/api/workspace",
    { workspaceId: personalWorkspaceId },
    cookies,
  );
  cookies = switchPersonal.cookies || cookies;

  if (PARK) {
    const park = await postJson(
      `/api/personal/numbers/${numberId}`,
      { action: "park" },
      cookies,
    );
    if (!park.ok) {
      console.error("park failed", park.status, park.json);
      process.exit(1);
    }
    console.log(`Parked ${numberE164} in Number Vault`);
  }

  const summary = {
    ok: true,
    numberId,
    e164: numberE164,
    personalWorkspaceId,
    parked: PARK,
    urls: {
      myNumbers: `${BASE}/personal/numbers`,
      vault: `${BASE}/personal/vault`,
      forwarding: `${BASE}/personal/forwarding?numberId=${numberId}`,
      voicemail: `${BASE}/personal/voicemail?numberId=${numberId}`,
      numberDetail: `${BASE}/personal/numbers/${numberId}`,
    },
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
