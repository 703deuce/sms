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
 * then auto-bridge to the inbound PSTN leg when the agent leg answers (`bridge_on_answer`).
 * The PSTN leg stays unanswered until then so the caller's phone keeps ringing normally.
 */
export async function bridgeInboundCallToWebRtc(input: {
  telnyxCallControlId: string;
  businessLineE164: string;
  callerE164: string;
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
    const dialBody = {
      connection_id: callControlConnectionId,
      to,
      from: input.callerE164 || input.businessLineE164,
      client_state: clientState,
      timeout_secs: timeout,
      link_to: input.telnyxCallControlId,
      bridge_intent: true,
      bridge_on_answer: true,
      prevent_double_bridge: true,
      custom_headers: [
        { name: "X-Transovo-Inbound-Caller", value: input.callerE164 },
        { name: "X-Transovo-Business-Line", value: input.businessLineE164 },
      ],
    };

    let dialed: { data?: { call_control_id?: string } };
    try {
      dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
        method: "POST",
        body: dialBody,
      });
    } catch (firstErr) {
      if (input.callerE164 && input.callerE164 !== input.businessLineE164) {
        phoneServerLog("inbound-webrtc-bridge", "dial_retry_business_from", {
          humanCallId: input.humanCallId,
          error: firstErr instanceof Error ? firstErr.message : "dial_failed",
        });
        dialed = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
          method: "POST",
          body: { ...dialBody, from: input.businessLineE164 },
        });
      } else {
        throw firstErr;
      }
    }
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
          inboundDialMode: "bridge_on_answer",
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

export async function markInboundCallBridged(input: {
  humanCallId: string;
  agentCallControlId?: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.humanCall.findUnique({ where: { id: input.humanCallId } });
  if (!existing) return;
  const meta = (existing.metadata || {}) as Record<string, unknown>;
  if (meta.inboundBridge === "bridged") return;

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      status: "in_progress",
      answeredAt: existing.answeredAt || new Date(),
      metadata: patchInboundSession(meta, {
        inboundBridge: "bridged",
        inboundBridgeStatus: "bridged",
        ringTimeoutAt: null,
        browserCallControlId:
          input.agentCallControlId ||
          (typeof meta.browserCallControlId === "string" ? meta.browserCallControlId : null),
      }),
    },
  });
}

/** Fallback if Telnyx `bridge_on_answer` did not connect legs (manual answer + bridge). */
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
    await telnyxCallAction(input.parentCallControlId, "answer");
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

  await markInboundCallBridged({
    humanCallId: input.humanCallId,
    agentCallControlId: input.agentCallControlId,
  });
}
