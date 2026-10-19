import { telnyxRequest } from "@/lib/server/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import { encodeTelnyxClientState, telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";

/**
 * When inbound hits Call Control (webhook) but the browser uses WebRTC credentials,
 * Telnyx does not always deliver a client invite unless we bridge the PSTN leg to the
 * credential SIP user. Numbers on the credential connection alone may not need this.
 */
export async function bridgeInboundCallToWebRtc(input: {
  telnyxCallControlId: string;
  businessLineE164: string;
  workspaceId: string;
  humanCallId: string;
  ringTimeoutSec?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isTelnyxPhoneConfigured()) return { ok: false, reason: "telnyx_not_configured" };

  const connectionId = process.env.TELNYX_CONNECTION_ID?.trim();
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
  if (!connectionId || !credentialId) {
    return { ok: false, reason: "missing_connection_or_credential" };
  }

  const sipOverride = process.env.TELNYX_WEBRTC_SIP_USERNAME?.trim();
  let sipUsername = sipOverride;
  if (!sipUsername) {
    const cred = await telnyxRequest<{ data?: { sip_username?: string } }>(
      `/telephony_credentials/${credentialId}`,
    );
    sipUsername = cred.data?.sip_username?.trim() || "";
  }
  if (!sipUsername) return { ok: false, reason: "no_sip_username" };

  const timeout = Math.min(Math.max(input.ringTimeoutSec ?? 25, 10), 120);
  const clientState = encodeTelnyxClientState({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    kind: "human",
    inboundBridge: true,
  });

  await telnyxCallAction(input.telnyxCallControlId, "answer");
  await telnyxCallAction(input.telnyxCallControlId, "dial", {
    to: `sip:${sipUsername}@sip.telnyx.com`,
    from: input.businessLineE164,
    connection_id: connectionId,
    client_state: clientState,
    timeout_secs: timeout,
  });

  return { ok: true };
}
