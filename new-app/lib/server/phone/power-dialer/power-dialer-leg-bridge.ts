import { getPrisma } from "@/lib/server/db";
import { bridgeCalls } from "@/lib/server/phone/routing/telnyx-call-control";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { isConfirmedHumanClassification } from "./answer-classification";
import { mergeAttemptMetadata, readAttemptMetadata } from "./attempt-metadata";
import type { AnswerClassification } from "./types";

export function readPowerDialerLegIds(metadata: Record<string, unknown> | null | undefined) {
  const m = metadata || {};
  const prospect =
    typeof m.prospectCallControlId === "string"
      ? m.prospectCallControlId
      : typeof m.telnyxProspectCallControlId === "string"
        ? m.telnyxProspectCallControlId
        : null;
  const agent =
    typeof m.agentCallControlId === "string"
      ? m.agentCallControlId
      : typeof m.browserCallControlId === "string"
        ? m.browserCallControlId
        : null;
  return { prospectCallControlId: prospect, agentCallControlId: agent };
}

/** Bridge agent WebRTC leg to server-originated prospect PSTN after confirmed human + policy. */
export async function maybeBridgePowerDialerAgentToProspect(input: {
  workspaceId: string;
  humanCallId: string;
  attemptId: string;
  classification: AnswerClassification | string;
  reason: string;
}): Promise<{ bridged: boolean; reason?: string }> {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") {
    return { bridged: false, reason: "not_power_dialer" };
  }

  const callMeta = (call.metadata || {}) as Record<string, unknown>;
  if (callMeta.outboundPstnMode !== "server_ios_screening") {
    return { bridged: false, reason: "not_server_ios_mode" };
  }

  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
  });
  if (!attempt) return { bridged: false, reason: "no_attempt" };

  const attemptMeta = readAttemptMetadata(attempt.metadataJson);
  if (attemptMeta.agentProspectBridged === true) {
    return { bridged: false, reason: "already_bridged" };
  }

  if (attemptMeta.screeningPending === true && !isConfirmedHumanClassification(input.classification)) {
    return { bridged: false, reason: "screening_pending" };
  }

  if (!isConfirmedHumanClassification(input.classification)) {
    return { bridged: false, reason: "not_confirmed_human" };
  }

  const { prospectCallControlId, agentCallControlId } = readPowerDialerLegIds({
    ...callMeta,
    prospectCallControlId:
      callMeta.prospectCallControlId || call.telnyxCallControlId || undefined,
    agentCallControlId: callMeta.agentCallControlId || callMeta.browserCallControlId,
  });

  if (!prospectCallControlId || !agentCallControlId) {
    return { bridged: false, reason: "missing_leg_control_id" };
  }

  try {
    await bridgeCalls(agentCallControlId, prospectCallControlId);
  } catch (err) {
    phoneServerLog("power-dialer-ios-bridge", "bridge_failed", {
      humanCallId: input.humanCallId,
      message: err instanceof Error ? err.message : String(err),
    });
    return { bridged: false, reason: "telnyx_bridge_error" };
  }

  const bridgedAt = new Date().toISOString();
  await prisma.powerDialerAttempt.update({
    where: { id: input.attemptId },
    data: {
      metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
        agentProspectBridged: true,
        agentProspectBridgedAt: bridgedAt,
        bridgeReason: input.reason,
        connectionPhase: "human_connected",
        screeningPending: false,
      }),
    },
  });

  await prisma.humanCall.update({
    where: { id: input.humanCallId },
    data: {
      metadata: {
        ...callMeta,
        outboundAgentLegStatus: "bridged",
        agentProspectBridgedAt: bridgedAt,
      },
    },
  });

  const { maybeStartPowerDialerRecordingOnAnswer } = await import("./power-dialer-recording");
  await maybeStartPowerDialerRecordingOnAnswer({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    telnyxCallControlId: prospectCallControlId,
  }).catch(() => undefined);

  phoneServerLog("power-dialer-ios-bridge", "bridge_ok", {
    humanCallId: input.humanCallId,
    attemptId: input.attemptId,
    reason: input.reason,
  });

  return { bridged: true };
}
