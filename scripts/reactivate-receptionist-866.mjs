/**
 * Republish receptionist on 866 via production API (server-side LiveKit provision).
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmsqtfphh336n4a4q5v4u1a2t";
const PHONE_ID = process.env.PHONE_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";
const VOICE_ID = process.env.VOICE_ID || "shimmer";
const VOICE_LABEL = process.env.VOICE_LABEL || "Shimmer";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";

async function main() {
  if (!BASE) throw new Error("APP_URL required");
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  const login = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  if (!login.ok()) throw new Error(`login failed ${login.status()}`);

  const getRes = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
  const getJson = await getRes.json();
  if (!getRes.ok()) throw new Error(JSON.stringify(getJson));

  const draft = getJson.data.draftConfig || {};
  const wiz = { ...(draft.advanced?.receptionistWizard || {}) };
  wiz.voiceId = VOICE_ID;
  wiz.voiceLabel = VOICE_LABEL;

  draft.voiceLanguage = { ...(draft.voiceLanguage || {}), voiceId: VOICE_ID };
  draft.advanced = {
    ...(draft.advanced || {}),
    realtimeVoice: VOICE_ID,
    receptionistWizard: wiz,
    livekitProfile: "frontdesk_realtime",
  };

  const patchRes = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    data: { draftConfig: draft, phoneNumberId: PHONE_ID },
  });
  if (!patchRes.ok()) throw new Error(`patch: ${JSON.stringify(await patchRes.json())}`);

  const buildRes = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    data: { action: "build_for_test" },
  });
  if (!buildRes.ok()) throw new Error(`build: ${JSON.stringify(await buildRes.json())}`);

  const pubRes = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    data: { action: "publish" },
  });
  const pubJson = await pubRes.json();
  if (!pubRes.ok()) throw new Error(`publish: ${JSON.stringify(pubJson)}`);

  const final = await (await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`)).json();

  const phoneRes = await page.request.get(`${BASE}/api/phone/numbers`);
  const phones = (await phoneRes.json()).data || [];
  const phone = phones.find((p) => p.id === PHONE_ID);

  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId: AGENT_ID,
        name: final.data?.name,
        status: final.data?.status || final.data?.rawStatus,
        phoneNumberId: final.data?.phoneNumberId,
        phoneE164: phone?.e164 || PHONE_E164,
        voiceId: final.data?.draftConfig?.voiceLanguage?.voiceId,
        realtimeVoice: final.data?.draftConfig?.advanced?.realtimeVoice,
        dispatchHint: phone?.aiOwner,
        businessName:
          final.data?.draftConfig?.advanced?.receptionistCompiled?.businessName,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
