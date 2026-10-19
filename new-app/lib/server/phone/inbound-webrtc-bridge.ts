import { getPrisma } from "@/lib/server/db";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { isTelnyxPhoneConfigured } from "@/lib/server/phone/calls-service";
import {
  encodeTelnyxClientState,
  telnyxCallAction,
  telnyxCallControlPath,
} from "@/lib/server/phone/telnyx-call-actions";
import { maskE164, phoneServerLog } from "@/lib/server/phone/phone-log";
import {
  buildWebRtcAgentSipUri,
  parseTelephonyCredentialConnectionId,
} from "@/lib/server/phone/telnyx-webrtc-sip";
import { isWebRtcAgentReachable } from "@/lib/server/phone/webrtc-presence";

async function resolveSipUsername(): Promise<{ sipUsername: string; credentialConnectionId: string | null }> {
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
  if (!credentialId) return { sipUsername: "", credentialConnectionId: null };

  const sipOverride = process.env.TELNYX_WEBRTC_SIP_USERNAME?.trim();
  if (sipOverride) {
    const conn =
      process.env.TELNYX_WEBRTC_CONNECTION_ID?.trim() ||
      parseTelephonyCredentialConnectionId(
        process.env.TELNYX_WEBRTC_CREDENTIAL_RESOURCE_ID?.trim(),
      );
    return { sipUsername: sipOverride, credentialConnectionId: conn };
  }

  const cred = await telnyxRequest<{
    data?: { sip_username?: string; resource_id?: string };
  }>(`/telephony_credentials/${credentialId}`);
  const sipUsername = cred.data?.sip_username?.trim() || "";
  const credentialConnectionId =
    process.env.TELNYX_WEBRTC_CONNECTION_ID?.trim() ||
    parseTelephonyCredentialConnectionId(cred.data?.resource_id) ||
    null;
  return { sipUsername, credentialConnectionId };
}

/**
 * Telnyx WebRTC + Call Control: dial the agent on the **credential SIP connection**
 * (POST /v2/calls), then bridge to the inbound PSTN leg when the agent leg answers.
 * Transfer-to-SIP on the Call Control app alone does not ring cross-connection credentials.
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

  const reachable = await isWebRtcAgentReachable(input.workspaceId);
  if (!reachable) {
    phoneServerLog("inbound-webrtc-bridge", "no_registered_browser", {
      humanCallId: input.humanCallId,
    });
    return { ok: false, reason: "no_browser_softphone_registered" };
  }

  const { sipUsername, credentialConnectionId } = await resolveSipUsername();
  if (!sipUsername) return { ok: false, reason: "no_sip_username" };
  if (!credentialConnectionId) {
    return { ok: false, reason: "no_webrtc_credential_connection_id" };
  }

  phoneServerLog("inbound-webrtc-bridge", "credential_connection", {
    credentialConnectionId,
    callControlAppId: process.env.TELNYX_CONNECTION_ID?.trim() || null,
  });

  const timeout = Math.min(Math.max(input.ringTimeoutSec ?? 25, 10), 120);
  const clientState = encodeTelnyxClientState({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    kind: "webrtc_agent_leg",
    parentCallControlId: input.telnyxCallControlId,
  });

  const to = buildWebRtcAgentSipUri(sipUsername);

  try {
    const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: credentialConnectionId,
        to,
        from: input.businessLineE164,
        client_state: clientState,
        timeout_secs: timeout,
      },
    });
    const agentLegId = dialed.data?.call_control_id?.trim();
    if (!agentLegId) {
      return { ok: false, reason: "dial_missing_agent_leg_id" };
    }

    const prisma = getPrisma();
    const call = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
    const meta = (call?.metadata || {}) as Record<string, unknown>;
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: {
        telnyxCallLegId: agentLegId,
        metadata: {
          ...meta,
          webrtcAgentLegId: agentLegId,
          inboundBridge: "dial_agent",
          parentCallControlId: input.telnyxCallControlId,
        },
      },
    });

    phoneServerLog("inbound-webrtc-bridge", "dialed_agent_leg", {
      humanCallId: input.humanCallId,
      agentLegPrefix: agentLegId.slice(0, 8),
      sipUser: `${sipUsername.slice(0, 4)}…`,
      timeoutSecs: timeout,
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

export async function completeWebRtcAgentLegAnswer(input: {
  parentCallControlId: string;
  agentCallControlId: string;
  humanCallId: string;
  workspaceId: string;
}) {
  phoneServerLog("inbound-webrtc-bridge", "agent_leg_answered_bridge", {
    humanCallId: input.humanCallId,
    parentPrefix: input.parentCallControlId.slice(0, 8),
    agentPrefix: input.agentCallControlId.slice(0, 8),
  });

  await telnyxCallAction(input.parentCallControlId, "answer").catch(() => undefined);
  await telnyxRequest(telnyxCallControlPath(input.parentCallControlId, "/actions/bridge"), {
    method: "POST",
    body: { call_control_id: input.agentCallControlId },
  });

  const prisma = getPrisma();
  const existing = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
  const meta = (existing?.metadata || {}) as Record<string, unknown>;
  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      status: "in_progress",
      answeredAt: new Date(),
      metadata: { ...meta, inboundBridge: "bridged", ringTimeoutAt: null },
    },
  });
}
