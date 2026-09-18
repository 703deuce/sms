/**
 * Point +15717491060 at OpenAI Live SIP (Voice V3 Basic).
 *
 * Telnyx: dedicated Call Control app → on inbound, transfer to
 *   sip:proj_…@sip.api.openai.com;transport=tls
 * OpenAI: live.transport.incoming → POST /api/openai/live/incoming → sessions.accept
 *
 * Requires OPENAI_PROJECT_ID, OPENAI_API_KEY, TELNYX_API_KEY, DATABASE_URL.
 *
 * Run:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/setup-voice-v3-basic-5717491060.ts
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { getAppBaseUrl } from "../src/lib/messaging/telnyx/config";
import { ensureTelnyxOutboundVoiceReady } from "../src/lib/phone/telnyx-outbound-voice";
import {
  findOrCreateVoiceV3BasicCallControlApp,
  resolveOpenAiLiveSipTransferUri,
} from "../src/lib/voice-v3-basic/telnyx-sip-forward";

const E164 = process.env.PHONE_E164?.trim() || "+15717491060";
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID?.trim();

async function main() {
  if (!OPENAI_PROJECT_ID || !OPENAI_PROJECT_ID.startsWith("proj_")) {
    throw new Error("Set OPENAI_PROJECT_ID=proj_... from OpenAI Project → General");
  }

  const appUrl = getAppBaseUrl().replace(/\/$/, "");
  const openAiWebhookUrl = `${appUrl}/api/openai/live/incoming`;
  const telnyxWebhookUrl = `${appUrl}/api/telnyx/voice/v3-basic`;

  console.log("VOICE_V3_BASIC_CONFIG", {
    frontend: "gpt-live-1",
    backend: "gpt-6-astra",
    e164: E164,
    openAiSipUri: resolveOpenAiLiveSipTransferUri(OPENAI_PROJECT_ID),
    openAiWebhookUrl,
    telnyxWebhookUrl,
  });

  const callControlAppId = await findOrCreateVoiceV3BasicCallControlApp(telnyxWebhookUrl);

  const outbound = await ensureTelnyxOutboundVoiceReady({
    connectionId: callControlAppId,
    callerIdE164: E164,
  });
  if (!outbound.ready) {
    console.warn("VOICE_V3_BASIC_OUTBOUND_NOT_READY", {
      issues: outbound.issues,
      outboundVoiceProfileId: outbound.outboundVoiceProfileId,
    });
  } else {
    console.log("VOICE_V3_BASIC_OUTBOUND_READY", {
      outboundVoiceProfileId: outbound.outboundVoiceProfileId,
      attachedConnection: outbound.attachedConnection,
    });
  }

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: E164 },
    select: { id: true, workspaceId: true, providerNumberId: true, e164: true, metadata: true },
  });
  if (!phone?.providerNumberId) {
    throw new Error(`Phone ${E164} not found in DB or missing providerNumberId`);
  }

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(phone.providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: callControlAppId },
  });

  const prevMeta = (phone.metadata && typeof phone.metadata === "object" ? phone.metadata : {}) as Record<
    string,
    unknown
  >;
  await prisma.phoneNumber
    .updateMany({
      where: { id: phone.id, workspaceId: phone.workspaceId },
      data: {
        metadata: {
          ...prevMeta,
          voiceV3Basic: true,
          voiceV3BasicSip: resolveOpenAiLiveSipTransferUri(OPENAI_PROJECT_ID),
          voiceV3BasicTelnyxCallControlAppId: callControlAppId,
          voiceV3BasicConfiguredAt: new Date().toISOString(),
        } as object,
      },
    })
    .catch(() => undefined);

  console.log("VOICE_V3_BASIC_TELNYX_READY", {
    e164: E164,
    telnyxCallControlAppId: callControlAppId,
    note: "Inbound: Call Control transfer to OpenAI SIP. Not FQDN / not TeXML / not media WS.",
  });
  console.log("OPENAI_WEBHOOK_SETUP", {
    subscribe: ["live.transport.incoming"],
    url: openAiWebhookUrl,
    webhookSecretEnv: "OPENAI_WEBHOOK_SECRET",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
