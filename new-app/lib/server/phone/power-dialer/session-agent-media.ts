import { randomUUID } from "crypto";
import { getPrisma } from "@/lib/server/db";
import { telnyxRequest } from "@/lib/server/telnyx/client";
import { encodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import { requireCallControlConnectionId } from "@/lib/server/phone/routing/telnyx-call-control";
import { buildWebRtcAgentSipUri } from "@/lib/server/phone/telnyx-webrtc-sip";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { readSharedIosAgentLeg, persistSharedIosAgentLeg } from "./ios-shared-agent-leg";
import { recordLatencyMilestone } from "./latency-timeline";
import { telnyxCallAction } from "@/lib/server/phone/telnyx-call-actions";

export type SessionAgentMediaState = {
  agentMediaReady: boolean;
  agentMediaReadyAt?: string;
  warmAgentHumanCallId?: string;
  sharedIosAgentCallControlId?: string;
};

export function readSessionAgentMedia(parallelStateJson: unknown): SessionAgentMediaState {
  if (!parallelStateJson || typeof parallelStateJson !== "object") {
    return { agentMediaReady: false };
  }
  const row = parallelStateJson as Record<string, unknown>;
  return {
    agentMediaReady: row.agentMediaReady === true,
    agentMediaReadyAt:
      typeof row.agentMediaReadyAt === "string" ? row.agentMediaReadyAt : undefined,
    warmAgentHumanCallId:
      typeof row.warmAgentHumanCallId === "string" ? row.warmAgentHumanCallId : undefined,
    sharedIosAgentCallControlId:
      typeof row.sharedIosAgentCallControlId === "string"
        ? row.sharedIosAgentCallControlId
        : undefined,
  };
}

export async function sessionRequiresWarmAgentMedia(
  workspaceId: string,
): Promise<boolean> {
  if (process.env.POWER_DIALER_SESSION_WARM_AGENT === "0") return false;
  if (process.env.POWER_DIALER_IOS_SCREENING_DIAL_ORIGINATION !== "1") return false;
  const { resolvePowerDialerIosOrigination } = await import("./ios-origination-policy");
  const plan = await resolvePowerDialerIosOrigination({ workspaceId, powerDialerAttemptId: null });
  return plan.iosScreeningRequested;
}

export async function assertAgentMediaReadyForServerDial(
  workspaceId: string,
  sessionId: string,
): Promise<void> {
  const needs = await sessionRequiresWarmAgentMedia(workspaceId);
  if (!needs) return;
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { parallelStateJson: true },
  });
  if (!session) throw new Error("Session not found");
  const media = readSessionAgentMedia(session.parallelStateJson);
  if (!media.agentMediaReady) {
    throw new Error(
      "Agent media is not ready — wait for the browser to connect before dialing.",
    );
  }
}

export async function markSessionAgentMediaReady(input: {
  workspaceId: string;
  sessionId: string;
  agentCallControlId?: string;
  humanCallId?: string;
}) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    select: { parallelStateJson: true },
  });
  if (!session) return;
  const prev =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};
  const readyAt = new Date().toISOString();
  await prisma.powerDialerSession.update({
    where: { id: input.sessionId },
    data: {
      parallelStateJson: {
        ...prev,
        agentMediaReady: true,
        agentMediaReadyAt: readyAt,
        ...(input.agentCallControlId
          ? { sharedIosAgentCallControlId: input.agentCallControlId }
          : {}),
        ...(input.humanCallId ? { warmAgentHumanCallId: input.humanCallId } : {}),
      },
    },
  });
  recordLatencyMilestone({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    humanCallId: input.humanCallId,
    milestone: "agent_media_ready",
    payload: { agentCallControlId: input.agentCallControlId },
  });
}

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

/** Originate persistent agent SIP leg for the dialing session (server-iOS path). */
export async function prepareSessionAgentMedia(input: {
  workspaceId: string;
  sessionId: string;
  fromE164: string;
}): Promise<{ started: boolean; reason?: string; humanCallId?: string }> {
  const needs = await sessionRequiresWarmAgentMedia(input.workspaceId);
  if (!needs) {
    await markSessionAgentMediaReady({
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
    });
    return { started: false, reason: "warm_agent_not_required" };
  }

  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    select: { parallelStateJson: true, repUserId: true },
  });
  if (!session) return { started: false, reason: "session_not_found" };

  const media = readSessionAgentMedia(session.parallelStateJson);
  if (media.agentMediaReady && readSharedIosAgentLeg(session.parallelStateJson)) {
    return { started: false, reason: "already_ready" };
  }

  const shared = readSharedIosAgentLeg(session.parallelStateJson);
  if (shared?.agentCallControlId) {
    return { started: false, reason: "agent_leg_pending_answer", humanCallId: media.warmAgentHumanCallId };
  }

  const sipUsername = await resolveAgentSipUsername();
  if (!sipUsername) return { started: false, reason: "agent_sip_missing" };

  const humanCall = await prisma.humanCall.create({
    data: {
      workspaceId: input.workspaceId,
      from: input.fromE164,
      to: buildWebRtcAgentSipUri(sipUsername),
      direction: "outbound",
      status: "initiated",
      agentUserId: session.repUserId,
      callerIdNumber: input.fromE164,
      mediaMode: "server_pstn_webrtc_agent",
      source: "power_dialer",
      notes: "session_warm_agent",
      metadata: {
        outboundPstnMode: "server_ios_screening",
        sessionWarmAgent: true,
        powerDialerSessionId: input.sessionId,
        outboundAgentLeg: "session_warm",
        outboundAgentLegStatus: "dialing",
      },
    },
  });

  const connectionId = requireCallControlConnectionId();
  const clientState = encodeTelnyxClientState({
    workspaceId: input.workspaceId,
    humanCallId: humanCall.id,
    kind: "pd_session_warm_agent",
    powerDialerSessionId: input.sessionId,
  });

  let agentControlId: string | undefined;
  try {
    const agentDial = await telnyxRequest<{ data?: { call_control_id?: string } }>("/calls", {
      method: "POST",
      body: {
        connection_id: connectionId,
        to: buildWebRtcAgentSipUri(sipUsername),
        from: input.fromE164,
        client_state: clientState,
        timeout_secs: 120,
        bridge_on_answer: false,
        prevent_double_bridge: true,
        command_id: `pd_session_agent_${randomUUID()}`,
      },
    });
    agentControlId = agentDial.data?.call_control_id?.trim();
  } catch (err) {
    phoneServerLog("session-agent-media", "warm_dial_failed", {
      sessionId: input.sessionId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { started: false, reason: "agent_dial_failed" };
  }

  if (!agentControlId) return { started: false, reason: "missing_agent_control_id" };

  await prisma.humanCall.update({
    where: { id: humanCall.id },
    data: {
      telnyxCallControlId: agentControlId,
      metadata: {
        ...(humanCall.metadata as Record<string, unknown>),
        agentCallControlId: agentControlId,
      },
    },
  });

  await persistSharedIosAgentLeg({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    agentCallControlId: agentControlId,
    anchorHumanCallId: humanCall.id,
  });

  const prev =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};
  await prisma.powerDialerSession.update({
    where: { id: input.sessionId },
    data: {
      parallelStateJson: {
        ...prev,
        warmAgentHumanCallId: humanCall.id,
        agentMediaReady: false,
      },
    },
  });

  recordLatencyMilestone({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    humanCallId: humanCall.id,
    milestone: "agent_media_established",
    payload: { agentCallControlId: agentControlId },
  });

  return { started: true, humanCallId: humanCall.id };
}

export async function teardownSessionAgentMedia(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: sessionId, workspaceId },
    select: { parallelStateJson: true },
  });
  if (!session) return;
  const shared = readSharedIosAgentLeg(session.parallelStateJson);
  if (shared?.agentCallControlId) {
    await telnyxCallAction(shared.agentCallControlId, "hangup", {}).catch(() => undefined);
  }
  const media = readSessionAgentMedia(session.parallelStateJson);
  if (media.warmAgentHumanCallId) {
    await prisma.humanCall.updateMany({
      where: { id: media.warmAgentHumanCallId, workspaceId },
      data: { status: "completed", endedAt: new Date() },
    });
  }
  const prev =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};
  await prisma.powerDialerSession.update({
    where: { id: sessionId },
    data: {
      parallelStateJson: {
        sharedIosAgentCallControlId: prev.sharedIosAgentCallControlId,
        sharedIosAgentHumanCallId: prev.sharedIosAgentHumanCallId,
        agentMediaReady: false,
      },
    },
  });
}
