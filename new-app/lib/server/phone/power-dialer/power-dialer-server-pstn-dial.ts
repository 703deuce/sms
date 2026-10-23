import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/server/db";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { encodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import { requireCallControlConnectionId } from "@/lib/server/phone/routing/telnyx-call-control";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { mergeAttemptMetadata } from "./attempt-metadata";
import { buildWebRtcAgentSipUri } from "@/lib/server/phone/telnyx-webrtc-sip";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import { isMultiLineDialMode, normalizeDialingMode } from "./dial-modes";
import {
  loadSharedIosAgentLegForAttempt,
  persistSharedIosAgentLeg,
  readSharedIosAgentLeg,
} from "./ios-shared-agent-leg";

const DEFAULT_PROMPT_END_MS = 45_000;

async function resolveAgentSipUsername(): Promise<string> {
  const credentialId = process.env.TELNYX_TELEPHONY_CREDENTIAL_ID?.trim();
  const sipOverride = process.env.TELNYX_WEBRTC_SIP_USERNAME?.trim();
  if (sipOverride) return sipOverride;
  if (!credentialId) return "";
  const cred = await telnyxRequest<{
    data?: { sip_username?: string };
  }>(`/telephony_credentials/${credentialId}`);
  return cred.data?.sip_username?.trim() || "";
}

export type ServerPstnDialResult =
  | {
      ok: true;
      prospectCallControlId: string;
      agentDialStarted: boolean;
      agentCallControlId?: string;
    }
  | { ok: false; reason: string };

/**
 * Originate prospect PSTN with Telnyx iOS screening AMD (no bridge-on-answer).
 * Then dial agent WebRTC SIP leg (also no bridge-on-answer).
 */
export async function startPowerDialerServerIosScreeningDial(input: {
  workspaceId: string;
  humanCallId: string;
  powerDialerAttemptId: string;
  toE164: string;
  fromE164: string;
  ringTimeoutSec: number;
}): Promise<ServerPstnDialResult> {
  const prisma = getPrisma();
  const connectionId = requireCallControlConnectionId();
  const wsRow = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  void mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );
  const promptEndClamped = DEFAULT_PROMPT_END_MS;

  const prospectClientState = {
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    kind: "pd_prospect_pstn",
    powerDialerAttemptId: input.powerDialerAttemptId,
  };

  const timeout = Math.min(Math.max(input.ringTimeoutSec, 10), 120);
  let prospectControlId: string | undefined;

  try {
    const prospectDial = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        to: input.toE164,
        from: input.fromE164,
        client_state: encodeTelnyxClientState(prospectClientState),
        timeout_secs: timeout,
        answering_machine_detection: "premium_ios_call_screening_detection",
        answering_machine_detection_config: {
          prompt_end_timeout_millis: promptEndClamped,
        },
        bridge_on_answer: false,
        command_id: `pd_ios_prospect_${randomUUID()}`,
      },
    });
    prospectControlId = prospectDial.data?.call_control_id?.trim();
  } catch (err) {
    phoneServerLog("power-dialer-ios-dial", "prospect_dial_failed", {
      humanCallId: input.humanCallId,
      message: err instanceof Error ? err.message : String(err),
    });
    const failRow = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.powerDialerAttemptId },
    });
    await prisma.powerDialerAttempt.update({
      where: { id: input.powerDialerAttemptId },
      data: {
        metadataJson: mergeAttemptMetadata(failRow?.metadataJson, {
          iosScreeningRequested: true,
          iosScreeningWireActive: false,
          iosScreeningWireStatus: "dial_origination_failed",
          iosScreeningDialError: err instanceof Error ? err.message : String(err),
        }),
      },
    });
    return { ok: false, reason: "prospect_dial_failed" };
  }

  if (!prospectControlId) {
    const noIdRow = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.powerDialerAttemptId },
    });
    await prisma.powerDialerAttempt.update({
      where: { id: input.powerDialerAttemptId },
      data: {
        metadataJson: mergeAttemptMetadata(noIdRow?.metadataJson, {
          iosScreeningWireActive: false,
          iosScreeningWireStatus: "dial_origination_no_control_id",
        }),
      },
    });
    return { ok: false, reason: "missing_prospect_control_id" };
  }

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      telnyxCallControlId: prospectControlId,
      mediaMode: "server_pstn_webrtc_agent",
      metadata: {
        ...((
          await prisma.humanCall.findFirst({ where: { id: input.humanCallId }, select: { metadata: true } })
        )?.metadata as Record<string, unknown> | undefined),
        outboundPstnMode: "server_ios_screening",
        prospectCallControlId: prospectControlId,
        outboundAgentLeg: "dial_agent",
        outboundAgentLegStatus: "pending",
        powerDialerAttemptId: input.powerDialerAttemptId,
      },
    },
  });

  const attemptRow = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.powerDialerAttemptId },
    include: { session: { include: { campaign: true } } },
  });
  const dialMode = normalizeDialingMode(attemptRow?.session?.campaign?.dialingMode);
  const multiLine = isMultiLineDialMode(dialMode);
  const sessionParallelState = attemptRow?.session?.parallelStateJson;
  const sharedFromSession = readSharedIosAgentLeg(sessionParallelState);

  await prisma.powerDialerAttempt.update({
    where: { id: input.powerDialerAttemptId },
    data: {
      metadataJson: mergeAttemptMetadata(attemptRow?.metadataJson, {
        outboundPstnMode: "server_ios_screening",
        prospectCallControlId: prospectControlId,
        iosScreeningRequested: true,
        iosScreeningWireActive: true,
        iosScreeningWireStatus: "wire_active_dial_origination",
        iosScreeningDialAcceptedAt: new Date().toISOString(),
        amdDetectionMode: "premium_ios_call_screening",
        amdBillingTier: "premium",
        connectionPhase: "dialing",
      }),
    },
  });

  if (multiLine && sharedFromSession) {
    const call = await prisma.humanCall.findFirst({ where: { id: input.humanCallId } });
    const prev = (call?.metadata || {}) as Record<string, unknown>;
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: {
        metadata: {
          ...prev,
          agentCallControlId: sharedFromSession.agentCallControlId,
          outboundAgentLeg: "dial_agent",
          outboundAgentLegStatus: "shared_session_agent",
          sharedIosAgentLeg: true,
        },
      },
    });
    return {
      ok: true,
      prospectCallControlId: prospectControlId,
      agentDialStarted: true,
      agentCallControlId: sharedFromSession.agentCallControlId,
    };
  }

  const sipUsername = await resolveAgentSipUsername();
  if (!sipUsername) {
    phoneServerLog("power-dialer-ios-dial", "agent_sip_missing", {
      humanCallId: input.humanCallId,
    });
    return { ok: true, prospectCallControlId: prospectControlId, agentDialStarted: false };
  }

  const agentClientState = encodeTelnyxClientState({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    kind: "pd_webrtc_agent_leg",
    parentCallControlId: prospectControlId,
    powerDialerAttemptId: input.powerDialerAttemptId,
  });

  let agentControlId: string | undefined;
  try {
    const agentDial = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        to: buildWebRtcAgentSipUri(sipUsername),
        from: input.fromE164,
        client_state: agentClientState,
        timeout_secs: timeout,
        bridge_on_answer: false,
        prevent_double_bridge: true,
        command_id: `pd_ios_agent_${randomUUID()}`,
      },
    });
    agentControlId = agentDial.data?.call_control_id?.trim();
  } catch (err) {
    phoneServerLog("power-dialer-ios-dial", "agent_dial_failed", {
      humanCallId: input.humanCallId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, prospectCallControlId: prospectControlId, agentDialStarted: false };
  }

  if (agentControlId) {
    const call = await prisma.humanCall.findFirst({ where: { id: input.humanCallId } });
    const prev = (call?.metadata || {}) as Record<string, unknown>;
    await prisma.humanCall.update({
      where: { id: input.humanCallId },
      data: {
        metadata: {
          ...prev,
          agentCallControlId: agentControlId,
          outboundAgentLegStatus: "dialing",
        },
      },
    });
    if (multiLine && attemptRow?.sessionId) {
      await persistSharedIosAgentLeg({
        workspaceId: input.workspaceId,
        sessionId: attemptRow.sessionId,
        agentCallControlId: agentControlId,
        anchorHumanCallId: input.humanCallId,
      });
    }
  }

  phoneServerLog("power-dialer-ios-dial", "origination_ok", {
    humanCallId: input.humanCallId,
    prospectPrefix: prospectControlId.slice(0, 8),
    agentDialStarted: Boolean(agentControlId),
  });

  return {
    ok: true,
    prospectCallControlId: prospectControlId,
    agentDialStarted: Boolean(agentControlId),
    agentCallControlId: agentControlId,
  };
}
