import { getPrisma } from "@/lib/server/db";
import { TelnyxApiError, telnyxRequest } from "@/lib/server/telnyx/client";
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
import { patchInboundSession } from "@/lib/server/phone/inbound-session";
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

function resolveCallControlConnectionId(): string | null {
  return (
    process.env.TELNYX_CONNECTION_ID?.trim() ||
    process.env.TELNYX_CALL_CONTROL_APP_ID?.trim() ||
    null
  );
}

/**
 * Telnyx WebRTC + Call Control: originate an agent leg via POST /v2/calls on the **Call Control app**
 * (connection_id must be a Call Control application with a webhook URL), dial the WebRTC SIP user,
 * then bridge to the inbound PSTN leg when the agent leg answers.
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

  const { sipUsername, credentialConnectionId } = await resolveSipUsername();
  if (!sipUsername) return { ok: false, reason: "no_sip_username" };

  const callControlConnectionId = resolveCallControlConnectionId();
  if (!callControlConnectionId) {
    return { ok: false, reason: "no_call_control_connection_id" };
  }

  phoneServerLog("inbound-webrtc-bridge", "dial_context", {
    callControlConnectionId,
    webrtcCredentialConnectionId: credentialConnectionId,
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
    // Satisfy Call Control first_command_timeout; caller stays connected while we ring the browser.
    await telnyxCallAction(input.telnyxCallControlId, "answer");
    phoneServerLog("inbound-webrtc-bridge", "answered_pstn_leg", {
      humanCallId: input.humanCallId,
    });

    const dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: callControlConnectionId,
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
        metadata: patchInboundSession(meta, {
          webrtcAgentLegId: agentLegId,
          browserCallControlId: agentLegId,
          inboundBridge: "dial_agent",
          inboundBridgeStatus: "dialing_browser",
          callerCallControlId: input.telnyxCallControlId,
          parentCallControlId: input.telnyxCallControlId,
        }),
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
    const reason = err instanceof Error ? err.message : "bridge_failed";
    phoneServerLog("inbound-webrtc-bridge", "bridge_failed", {
      humanCallId: input.humanCallId,
      error: reason,
      telnyxBody: err instanceof TelnyxApiError ? err.body : undefined,
    });
    const prisma = getPrisma();
    const call = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
    const meta = (call?.metadata || {}) as Record<string, unknown>;
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: {
        metadata: patchInboundSession(meta, {
          inboundBridgeStatus: "failed",
          inboundBridgeError: reason,
        }),
      },
    });
    await telnyxCallAction(input.telnyxCallControlId, "hangup").catch(() => undefined);
    return { ok: false, reason };
  }
}

export async function completeWebRtcAgentLegAnswer(input: {
  parentCallControlId: string;
  agentCallControlId: string;
  humanCallId: string;
  workspaceId: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
  const meta = (existing?.metadata || {}) as Record<string, unknown>;
  if (meta.inboundBridge === "bridged") {
    phoneServerLog("inbound-webrtc-bridge", "bridge_skipped_duplicate", {
      humanCallId: input.humanCallId,
    });
    return;
  }

  phoneServerLog("inbound-webrtc-bridge", "agent_leg_answered_bridge", {
    humanCallId: input.humanCallId,
    parentPrefix: input.parentCallControlId.slice(0, 8),
    agentPrefix: input.agentCallControlId.slice(0, 8),
  });

  try {
    await telnyxRequest(telnyxCallControlPath(input.parentCallControlId, "/actions/bridge"), {
      method: "POST",
      body: { call_control_id: input.agentCallControlId },
    });
  } catch (err) {
    phoneServerLog("inbound-webrtc-bridge", "bridge_action_failed", {
      humanCallId: input.humanCallId,
      error: err instanceof Error ? err.message : "unknown",
      telnyxBody: err instanceof TelnyxApiError ? err.body : undefined,
    });
    throw err;
  }

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      status: "in_progress",
      answeredAt: new Date(),
      metadata: patchInboundSession(meta, {
        inboundBridge: "bridged",
        inboundBridgeStatus: "bridged",
        ringTimeoutAt: null,
        browserCallControlId: input.agentCallControlId,
      }),
    },
  });
}
