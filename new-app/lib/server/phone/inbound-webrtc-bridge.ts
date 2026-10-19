import { telnyxRequest } from "@/lib/server/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import {
  encodeTelnyxClientState,
  telnyxCallAction,
  telnyxCallControlPath,
} from "@/lib/server/phone/telnyx-call-actions";
import { maskE164, phoneServerLog } from "@/lib/server/phone/phone-log";
import { buildWebRtcAgentSipUri } from "@/lib/server/phone/telnyx-webrtc-sip";

/**
 * Inbound on a Call Control application does not ring WebRTC clients by itself.
 * Telnyx docs: answer the PSTN leg, then transfer to the agent's telephony-credential SIP URI.
 */
export async function bridgeInboundCallToWebRtc(input: {
  telnyxCallControlId: string;
  businessLineE164: string;
  workspaceId: string;
  humanCallId: string;
  ringTimeoutSec?: number;
}): Promise<{ ok: boolean; reason?: string }> {
  phoneServerLog("inbound-webrtc-bridge", "start", {
    humanCallId: input.humanCallId,
    workspaceId: input.workspaceId,
    businessLine: maskE164(input.businessLineE164),
    callControlPrefix: input.telnyxCallControlId.slice(0, 8),
  });

  if (!isTelnyxPhoneConfigured()) return { ok: false, reason: "telnyx_not_configured" };

  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
  if (!credentialId) {
    return { ok: false, reason: "missing_telephony_credential_id" };
  }

  const sipOverride = process.env.TELNYX_WEBRTC_SIP_USERNAME?.trim();
  let sipUsername = sipOverride;
  if (!sipUsername) {
    const cred = await telnyxRequest<{
      data?: { sip_username?: string; resource_id?: string };
    }>(`/telephony_credentials/${credentialId}`);
    sipUsername = cred.data?.sip_username?.trim() || "";
    const credConn = cred.data?.resource_id;
    if (credConn) {
      phoneServerLog("inbound-webrtc-bridge", "credential_connection", {
        resourceId: credConn,
        callControlAppId: process.env.TELNYX_CONNECTION_ID?.trim() || null,
      });
    }
  }
  if (!sipUsername) return { ok: false, reason: "no_sip_username" };

  const timeout = Math.min(Math.max(input.ringTimeoutSec ?? 25, 10), 120);
  const clientState = encodeTelnyxClientState({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    kind: "human",
    inboundBridge: true,
  });

  const to = buildWebRtcAgentSipUri(sipUsername);

  try {
    await telnyxCallAction(input.telnyxCallControlId, "answer");
    phoneServerLog("inbound-webrtc-bridge", "answered_pstn_leg", {
      humanCallId: input.humanCallId,
    });

    await telnyxRequest(telnyxCallControlPath(input.telnyxCallControlId, "/actions/transfer"), {
      method: "POST",
      body: {
        to,
        from: input.businessLineE164,
        timeout_secs: timeout,
        client_state: clientState,
        media_encryption: "SRTP",
      },
    });
    phoneServerLog("inbound-webrtc-bridge", "transferred_to_webrtc_sip", {
      humanCallId: input.humanCallId,
      sipUser: `${sipUsername.slice(0, 4)}…`,
      timeoutSecs: timeout,
      toPattern: "sip:***@sip.telnyx.com;secure=srtp",
    });
    return { ok: true };
  } catch (err) {
    phoneServerLog("inbound-webrtc-bridge", "bridge_failed", {
      humanCallId: input.humanCallId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "bridge_failed",
    };
  }
}
