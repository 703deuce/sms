/**
 * Complete activation for an existing receptionist agent (voice + phone + publish).
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "cmsqtfphh336n4a4q5v4u1a2t";
const PHONE_ID = process.env.PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v";
const PHONE_E164 = process.env.PHONE_E164 || "+15715550198";
const VOICE_ID = process.env.VOICE_ID || "maya-energetic-us";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const login = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  if (!login.ok()) throw new Error(`login ${login.status()}`);

  const getRes = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
  const getJson = await getRes.json();
  if (!getRes.ok()) throw new Error(JSON.stringify(getJson));

  const draft = getJson.data.draftConfig || {};
  draft.voiceLanguage = { ...draft.voiceLanguage, voiceId: VOICE_ID };
  draft.advanced = {
    ...(draft.advanced || {}),
    receptionistWizard: {
      ...(draft.advanced?.receptionistWizard || {}),
      voiceId: VOICE_ID,
      voiceLabel: "Lily",
    },
  };

  const patchRes = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    data: { draftConfig: draft, phoneNumberId: PHONE_ID },
  });
  const patchJson = await patchRes.json();
  if (!patchRes.ok()) throw new Error(`patch draft: ${JSON.stringify(patchJson)}`);

  const buildRes = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    data: { action: "build_for_test" },
  });
  const buildJson = await buildRes.json();
  if (!buildRes.ok()) throw new Error(`build: ${JSON.stringify(buildJson)}`);

  const pubRes = await page.request.patch(`${BASE}/api/voice/agents/${AGENT_ID}`, {
    data: { action: "publish" },
  });
  const pubJson = await pubRes.json();
  if (!pubRes.ok()) throw new Error(`publish: ${JSON.stringify(pubJson)}`);

  const finalRes = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
  const finalJson = await finalRes.json();
  console.log(
    JSON.stringify(
      {
        ok: true,
        agentId: AGENT_ID,
        status: finalJson.data?.status || finalJson.data?.rawStatus,
        phoneNumberId: finalJson.data?.phoneNumberId,
        phoneE164: PHONE_E164,
        voiceId:
          finalJson.data?.publishedConfig?.voiceLanguage?.voiceId ||
          finalJson.data?.draftConfig?.voiceLanguage?.voiceId,
        businessName:
          finalJson.data?.publishedConfig?.advanced?.receptionistCompiled?.businessName,
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
