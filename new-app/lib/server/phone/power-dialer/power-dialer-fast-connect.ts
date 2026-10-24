import { getPrisma } from "@/lib/server/db";
import { readAttemptMetadata } from "./attempt-metadata";
import { normalizeDialingMode, isMultiLineDialMode, parseDialModeSettings } from "./dial-modes";
import {
  allowsImmediateBridgeOnAnswer,
  bridgeClassificationForFastConnect,
  resolveConnectionPolicy,
} from "./connection-policy";
import { recordLatencyMilestone } from "./latency-timeline";

/**
 * On prospect answer webhook — fast-connect path (parallel without AMD gate, power/preview when safe).
 */
export async function maybeFastConnectPowerDialerOnAnswer(input: {
  workspaceId: string;
  humanCallId: string;
  attemptId: string;
  answeredAt: Date;
}) {
  const prisma = getPrisma();
  const call = await prisma.humanCall.findFirst({
    where: { id: input.humanCallId, workspaceId: input.workspaceId },
  });
  if (!call || call.source !== "power_dialer") return { handled: false as const };

  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (meta.outboundPstnMode !== "server_ios_screening") {
    return { handled: false as const, reason: "not_server_ios" };
  }

  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt?.session?.campaign) return { handled: false as const, reason: "no_attempt" };

  const attemptMeta = readAttemptMetadata(attempt.metadataJson);
  const dialMode = normalizeDialingMode(attempt.session.campaign.dialingMode);
  const dialSettings = parseDialModeSettings(attempt.session.campaign.configJson);
  const amdFilter =
    attemptMeta.amdFilter === true || dialMode === "parallel_amd";
  const iosWire = attemptMeta.iosScreeningWireActive === true;

  const policyCtx = {
    dialMode,
    amdFilterMachines: amdFilter,
    iosScreeningWireActive: iosWire,
    screeningPending: attemptMeta.screeningPending === true,
    answerClassification: attempt.answerClassification,
  };

  if (!allowsImmediateBridgeOnAnswer(policyCtx)) {
    return { handled: false as const, reason: "policy_waits_for_amd" };
  }

  recordLatencyMilestone({
    workspaceId: input.workspaceId,
    attemptId: input.attemptId,
    humanCallId: input.humanCallId,
    sessionId: attempt.sessionId,
    milestone: "prospect_answered",
    payload: { fastConnect: true, policy: resolveConnectionPolicy(policyCtx) },
  });

  if (isMultiLineDialMode(dialMode)) {
    const { onParallelHumanAnswered } = await import("./parallel-orchestrator");
    const bridgeStartedAt = new Date();
    const result = await onParallelHumanAnswered({
      workspaceId: input.workspaceId,
      sessionId: attempt.sessionId,
      attemptId: input.attemptId,
      answeredAt: input.answeredAt,
      bridgeStartedAt,
      classification: bridgeClassificationForFastConnect(),
    });
    return { handled: true as const, parallel: result };
  }

  const classification = bridgeClassificationForFastConnect();
  const { maybeBridgePowerDialerAgentToProspect } = await import("./power-dialer-leg-bridge");
  const bridge = await maybeBridgePowerDialerAgentToProspect({
    workspaceId: input.workspaceId,
    humanCallId: input.humanCallId,
    attemptId: input.attemptId,
    classification,
    reason: "fast_connect_answer",
  });
  return { handled: true as const, bridge };
}
