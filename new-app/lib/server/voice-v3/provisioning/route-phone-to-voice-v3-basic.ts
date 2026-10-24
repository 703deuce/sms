import "server-only";

import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { ensureTelnyxOutboundVoiceReady } from "@/lib/phone/telnyx-outbound-voice";
import {
  findOrCreateVoiceV3BasicCallControlApp,
  requireOpenAiProjectId,
  resolveOpenAiLiveSipTransferUri,
} from "@/lib/voice-v3-basic/telnyx-sip-forward";

/**
 * Point a DID at the certified Voice V3 Basic Call Control app
 * (`/api/telnyx/voice/v3-basic` → answer → transfer OpenAI SIP).
 * See docs/voice-v3/NEW_NUMBER_PROVISIONING.md.
 */
export async function routePhoneToVoiceV3BasicCallControl(input: {
  e164: string;
  providerNumberId?: string | null;
  workspaceId?: string;
  phoneNumberId?: string;
}): Promise<{
  e164: string;
  connectionId: string;
  providerNumberId: string;
  liveConnectionId: string | null;
  matched: boolean;
  path: string;
  outboundVoiceProfileId?: string;
}> {
  const e164 = String(input.e164 || "").trim();
  if (!e164) throw new Error("e164 required for Voice V3 Basic Call Control route");

  const projectId = requireOpenAiProjectId();
  const appUrl = getAppBaseUrl().replace(/\/$/, "");
  const telnyxWebhookUrl = `${appUrl}/api/telnyx/voice/v3-basic`;

  const callControlAppId = await findOrCreateVoiceV3BasicCallControlApp(telnyxWebhookUrl);

  const outbound = await ensureTelnyxOutboundVoiceReady({
    connectionId: callControlAppId,
    callerIdE164: e164,
  });
  if (!outbound.ready) {
    console.warn("VOICE_V3_BASIC_OUTBOUND_NOT_READY_ON_ROUTE", {
      e164,
      issues: outbound.issues,
      outboundVoiceProfileId: outbound.outboundVoiceProfileId,
    });
  }

  let providerNumberId = String(input.providerNumberId || "").trim();
  if (!providerNumberId) {
    const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
      "/phone_numbers",
      { query: { "filter[phone_number]": e164, "page[size]": 5 } },
    );
    const rows = Array.isArray(listed.data) ? listed.data : [];
    providerNumberId = String(rows[0]?.id || "");
  }
  if (!providerNumberId) {
    throw new Error(`Phone ${e164} missing providerNumberId`);
  }

  await telnyxRequest(`/phone_numbers/${encodeURIComponent(providerNumberId)}`, {
    method: "PATCH",
    body: { connection_id: callControlAppId },
  });

  const phoneVerify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(providerNumberId)}`,
  );
  const liveConnectionId =
    String(phoneVerify.data?.connection_id || "") || null;
  const matched = liveConnectionId === callControlAppId;

  const prisma = getPrisma();
  const phoneRow = input.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: input.phoneNumberId },
        select: { id: true, workspaceId: true, metadata: true },
      })
    : await prisma.phoneNumber.findFirst({
        where: { e164 },
        select: { id: true, workspaceId: true, metadata: true },
      });

  if (phoneRow) {
    const prevMeta = (phoneRow.metadata && typeof phoneRow.metadata === "object"
      ? phoneRow.metadata
      : {}) as Record<string, unknown>;
    await prisma.phoneNumber
      .updateMany({
        where: { id: phoneRow.id, workspaceId: phoneRow.workspaceId },
        data: {
          metadata: {
            ...prevMeta,
            voiceV3Basic: true,
            voiceV3BasicSip: resolveOpenAiLiveSipTransferUri(projectId),
            voiceV3BasicTelnyxCallControlAppId: callControlAppId,
            voiceV3BasicConfiguredAt: new Date().toISOString(),
          } as object,
        },
      })
      .catch(() => undefined);
  }

  console.log("VOICE_V3_BASIC_PHONE_ROUTED", {
    e164,
    telnyxCallControlAppId: callControlAppId,
    telnyxWebhookUrl,
    matched,
    outboundReady: outbound.ready,
  });

  return {
    e164,
    connectionId: callControlAppId,
    providerNumberId,
    liveConnectionId,
    matched,
    outboundVoiceProfileId: outbound.outboundVoiceProfileId,
    path: `${e164} → Voice V3 Basic Call Control ${callControlAppId} (${telnyxWebhookUrl})`,
  };
}
