import "server-only";

import { verifyMctbTexmlIngressRoute } from "@/lib/mctb/texml-ingress/texml-route";
import { findOrCreateVoiceV3BasicCallControlApp } from "@/lib/voice-v3-basic/telnyx-sip-forward";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { TRANSOVO_TELNYX_FQDN_CONNECTION_NAME } from "@/lib/telephony/provisioning/config";
import { findFqdnConnectionByName } from "@/lib/telephony/provisioning/telnyx/sip-connection";
import type { ActiveCallHandler } from "./types";

export async function resolveEffectiveCallHandler(input: {
  e164: string;
  providerNumberId: string;
}): Promise<ActiveCallHandler | null> {
  const mctbVerify = await verifyMctbTexmlIngressRoute({
    e164: input.e164,
    providerNumberId: input.providerNumberId,
  });
  if (mctbVerify.ok) return "mctb";

  const phoneVerify = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/phone_numbers/${encodeURIComponent(input.providerNumberId)}`,
  );
  const liveConnectionId = String(phoneVerify.data?.connection_id || "");

  const liveKitFqdn = await findFqdnConnectionByName(TRANSOVO_TELNYX_FQDN_CONNECTION_NAME);
  if (
    liveConnectionId &&
    liveKitFqdn?.id &&
    String(liveKitFqdn.id) === liveConnectionId
  ) {
    return "ai_receptionist";
  }

  const appUrl = getAppBaseUrl().replace(/\/$/, "");
  const telnyxWebhookUrl = `${appUrl}/api/telnyx/voice/v3-basic`;
  const v3AppId = await findOrCreateVoiceV3BasicCallControlApp(telnyxWebhookUrl);
  if (liveConnectionId && liveConnectionId === v3AppId) {
    return "ai_receptionist";
  }

  return null;
}
