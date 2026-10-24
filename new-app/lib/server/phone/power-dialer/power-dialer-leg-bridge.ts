import { getPrisma } from "@/lib/server/db";
import { phoneServerLog } from "@/lib/server/phone/phone-log";
import { isConfirmedHumanClassification } from "./answer-classification";
import { mergeAttemptMetadata, readAttemptMetadata } from "./attempt-metadata";
import type { AnswerClassification } from "./types";
import { loadSharedIosAgentLegForAttempt } from "./ios-shared-agent-leg";
import { classificationSatisfiesBridgeGate, resolveConnectionPolicy } from "./connection-policy";
import { normalizeDialingMode, parseDialModeSettings } from "./dial-modes";
import { recordLatencyMilestone } from "./latency-timeline";
import { bridgeCallsWithBenchmark } from "@/lib/server/phone/routing/telnyx-call-control";

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
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) return { bridged: false, reason: "no_attempt" };

  const attemptMeta = readAttemptMetadata(attempt.metadataJson);
  if (attemptMeta.agentProspectBridged === true) {
    return { bridged: false, reason: "already_bridged" };
  }

  if (attemptMeta.screeningPending === true && !isConfirmedHumanClassification(input.classification)) {
    return { bridged: false, reason: "screening_pending" };
  }

  const dialMode = normalizeDialingMode(attempt.session?.campaign?.dialingMode);
  const dialSettings = parseDialModeSettings(attempt.session?.campaign?.configJson);
  const amdFilter = attemptMeta.amdFilter === true || dialMode === "parallel_amd";
  const policyCtx = {
    dialMode,
    amdFilterMachines: amdFilter,
    iosScreeningWireActive: attemptMeta.iosScreeningWireActive === true,
    screeningPending: attemptMeta.screeningPending === true,
    answerClassification: input.classification,
  };
  if (!classificationSatisfiesBridgeGate(input.classification, policyCtx)) {
    return { bridged: false, reason: "not_confirmed_human" };
  }

  let agentFromMeta =
    callMeta.agentCallControlId || callMeta.browserCallControlId;
  if (!agentFromMeta) {
    const shared = await loadSharedIosAgentLegForAttempt(input.workspaceId, input.attemptId);
    agentFromMeta = shared?.agentCallControlId;
  }

  const { prospectCallControlId, agentCallControlId } = readPowerDialerLegIds({
    ...callMeta,
    prospectCallControlId:
      callMeta.prospectCallControlId || call.telnyxCallControlId || undefined,
    agentCallControlId: agentFromMeta,
  });

  if (!prospectCallControlId || !agentCallControlId) {
    return { bridged: false, reason: "missing_leg_control_id" };
  }

  recordLatencyMilestone({
    workspaceId: input.workspaceId,
    attemptId: input.attemptId,
    humanCallId: input.humanCallId,
    sessionId: attempt.sessionId,
    milestone: "bridge_command_issued",
    payload: { reason: input.reason, policy: resolveConnectionPolicy(policyCtx) },
  });

  try {
    await bridgeCallsWithBenchmark(agentCallControlId, prospectCallControlId);
    recordLatencyMilestone({
      workspaceId: input.workspaceId,
      attemptId: input.attemptId,
      humanCallId: input.humanCallId,
      sessionId: attempt.sessionId,
      milestone: "bridge_api_response",
      payload: { ok: true },
    });
  } catch (err) {
    recordLatencyMilestone({
      workspaceId: input.workspaceId,
      attemptId: input.attemptId,
      humanCallId: input.humanCallId,
      sessionId: attempt.sessionId,
      milestone: "bridge_api_response",
      payload: { ok: false, message: err instanceof Error ? err.message : String(err) },
    });
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
