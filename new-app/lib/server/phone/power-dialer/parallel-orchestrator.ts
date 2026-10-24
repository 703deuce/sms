import { getPrisma } from "@/lib/server/db";
import type { DialingMode } from "./dial-modes";
import {
  effectiveParallelLineCount,
  evaluateDialModeGate,
  isMultiLineDialMode,
  parseAdvancedDialEntitlements,
  parseDialModeSettings,
} from "./dial-modes";
import { mergeAttemptMetadata, readAttemptMetadata } from "./attempt-metadata";
import { normalizeDialingMode } from "./dial-modes";
import { evaluateAbandonmentSafeguards, DEFAULT_ABANDONMENT_POLICY } from "./abandonment-policy";
import { computePredictiveLines } from "./predictive-pacing";

export type ParallelDialLeg = {
  attemptId: string;
  contactId: string;
  phoneE164: string;
};

export type TelnyxParallelDeps = {
  hangupAttempt: (attemptId: string, humanCallId: string | null) => Promise<void>;
};

const defaultTelnyxDeps: TelnyxParallelDeps = {
  hangupAttempt: async (attemptId, humanCallId) => {
    if (!humanCallId) return;
    const { getPrisma } = await import("@/lib/server/db");
    const prisma = getPrisma();
    const [call, attempt] = await Promise.all([
      prisma.humanCall.findFirst({ where: { id: humanCallId } }),
      prisma.powerDialerAttempt.findFirst({ where: { id: attemptId } }),
    ]);
    const attemptMeta = readAttemptMetadata(attempt?.metadataJson);
    const callMeta = (call?.metadata || {}) as Record<string, unknown>;
    const prospectId =
      (typeof attemptMeta.prospectCallControlId === "string"
        ? attemptMeta.prospectCallControlId
        : null) ||
      (typeof callMeta.prospectCallControlId === "string"
        ? callMeta.prospectCallControlId
        : null) ||
      call?.telnyxCallControlId;
    if (!prospectId) return;
    const { telnyxCallAction } = await import("@/lib/server/phone/telnyx-call-actions");
    await telnyxCallAction(prospectId, "hangup", {});
  },
};

export function pickBridgeWinner(
  candidates: { attemptId: string; answeredAtMs: number }[],
): string | null {
  if (!candidates.length) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (a.answeredAtMs !== b.answeredAtMs) return a.answeredAtMs - b.answeredAtMs;
    return a.attemptId.localeCompare(b.attemptId);
  });
  return sorted[0]?.attemptId ?? null;
}

/** Mark non-winning parallel legs cancelled; optional Telnyx hangup (mocked in tests). */
export async function cancelParallelLosers(
  workspaceId: string,
  sessionId: string,
  winnerAttemptId: string,
  deps: TelnyxParallelDeps = defaultTelnyxDeps,
) {
  const prisma = getPrisma();
  const losers = await prisma.powerDialerAttempt.findMany({
    where: {
      workspaceId,
      sessionId,
      id: { not: winnerAttemptId },
      status: { in: ["pending", "dialing", "ringing", "answered"] },
    },
  });
  for (const row of losers) {
    await deps.hangupAttempt(row.id, row.humanCallId);
    await prisma.powerDialerAttempt.update({
      where: { id: row.id },
      data: {
        status: "cancelled",
        endedAt: new Date(),
        metadataJson: mergeAttemptMetadata(row.metadataJson, {
          parallelLoser: true,
        }),
      },
    });
  }
}

export async function recordAbandonedAnswer(
  workspaceId: string,
  attemptId: string,
  reason: string,
) {
  const prisma = getPrisma();
  const row = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
  });
  if (!row) return;
  await prisma.powerDialerAttempt.update({
    where: { id: attemptId },
    data: {
      status: "completed",
      endedAt: new Date(),
      disposition: "Abandoned",
      metadataJson: mergeAttemptMetadata(row.metadataJson, {
        abandonedCall: true,
        abandonmentReason: reason,
      }),
    },
  });
}

/** Hang up or cancel a parallel leg classified as machine/screener/uncertain when machine filter is on. */
export async function hangupNonHumanParallelLeg(input: {
  workspaceId: string;
  sessionId: string;
  attemptId: string;
  classification: string;
  deps?: TelnyxParallelDeps;
}) {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId, sessionId: input.sessionId },
  });
  if (!attempt || attempt.status === "cancelled" || attempt.status === "completed") return;

  await (input.deps ?? defaultTelnyxDeps).hangupAttempt(attempt.id, attempt.humanCallId);
  await prisma.powerDialerAttempt.update({
    where: { id: attempt.id },
    data: {
      status: "cancelled",
      endedAt: new Date(),
      answerClassification: input.classification,
      metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
        parallelFiltered: true,
        filterReason: input.classification,
        connectionPhase: "voicemail",
      }),
    },
  });
}

export async function onParallelHumanAnswered(input: {
  workspaceId: string;
  sessionId: string;
  attemptId: string;
  answeredAt: Date;
  bridgeStartedAt?: Date;
  classification?: string;
  deps?: TelnyxParallelDeps;
}) {
  const prisma = getPrisma();
  const eligibility = await assertParallelWinnerEligible(input.workspaceId, input.attemptId);
  if (!eligibility.eligible) {
    return { winnerAttemptId: null, skipped: eligibility.reason };
  }

  const { tryAtomicParallelWinnerClaim } = await import("./parallel-winner-claim");
  const { recordLatencyMilestone } = await import("./latency-timeline");
  recordLatencyMilestone({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    attemptId: input.attemptId,
    milestone: "winner_claim_attempted",
  });

  const claim = await tryAtomicParallelWinnerClaim({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    attemptId: input.attemptId,
    answeredAtMs: input.answeredAt.getTime(),
  });

  if (claim.outcome === "ineligible") {
    return { winnerAttemptId: null, skipped: claim.reason };
  }

  if (claim.outcome === "lost") {
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.attemptId, workspaceId: input.workspaceId },
    });
    if (attempt) {
      await (input.deps ?? defaultTelnyxDeps).hangupAttempt(attempt.id, attempt.humanCallId);
      await prisma.powerDialerAttempt.update({
        where: { id: input.attemptId },
        data: {
          status: "cancelled",
          endedAt: new Date(),
          metadataJson: mergeAttemptMetadata(attempt.metadataJson, { parallelLoser: true }),
        },
      });
    }
    return { winnerAttemptId: claim.winnerAttemptId, skipped: "parallel_loser" };
  }

  recordLatencyMilestone({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    attemptId: input.attemptId,
    milestone: "winner_committed",
  });

  const winnerId = claim.winnerAttemptId;
  const bridgeMs =
    input.bridgeStartedAt
      ? Math.max(0, input.bridgeStartedAt.getTime() - input.answeredAt.getTime())
      : undefined;
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: winnerId, workspaceId: input.workspaceId },
  });
  if (attempt) {
    await prisma.powerDialerAttempt.update({
      where: { id: winnerId },
      data: {
        metadataJson: mergeAttemptMetadata(attempt.metadataJson, {
          bridgeWinner: true,
          answerToBridgeMs: bridgeMs,
        }),
      },
    });
  }
  await prisma.powerDialerSession.update({
    where: { id: input.sessionId },
    data: { currentAttemptId: winnerId },
  });
  await cancelParallelLosers(
    input.workspaceId,
    input.sessionId,
    winnerId,
    input.deps ?? defaultTelnyxDeps,
  );

  const bridgeClass =
    input.classification ||
    attempt?.answerClassification ||
    "human";
  if (attempt?.humanCallId) {
    const { maybeBridgePowerDialerAgentToProspect } = await import("./power-dialer-leg-bridge");
    await maybeBridgePowerDialerAgentToProspect({
      workspaceId: input.workspaceId,
      humanCallId: attempt.humanCallId,
      attemptId: winnerId,
      classification: bridgeClass,
      reason: "parallel_winner",
    }).catch(() => undefined);
  }
  return { winnerAttemptId: winnerId };
}

export async function assertParallelWinnerEligible(
  workspaceId: string,
  attemptId: string,
): Promise<{ eligible: boolean; reason?: string }> {
  const prisma = getPrisma();
  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: attemptId, workspaceId },
    include: { session: { include: { campaign: true } } },
  });
  if (!attempt) return { eligible: false, reason: "not_found" };
  const sessionState =
    attempt.session.parallelStateJson && typeof attempt.session.parallelStateJson === "object"
      ? (attempt.session.parallelStateJson as Record<string, unknown>)
      : {};
  const existingWinner =
    typeof sessionState.winnerAttemptId === "string" ? sessionState.winnerAttemptId : null;
  if (existingWinner && existingWinner !== attemptId) {
    return { eligible: false, reason: "winner_already_selected" };
  }
  const meta = readAttemptMetadata(attempt.metadataJson);
  if (meta.screeningPending) return { eligible: false, reason: "screening_pending" };
  if (meta.parallelLoser) return { eligible: false, reason: "parallel_loser" };
  if (attempt.answerClassification === "screener") {
    return { eligible: false, reason: "screener_not_human" };
  }
  const dialMode = normalizeDialingMode(attempt.session.campaign.dialingMode);
  const amdFilter = meta.amdFilter === true || dialMode === "parallel_amd";
  const iosWire = meta.iosScreeningWireActive === true;
  if (amdFilter || iosWire) {
    if (attempt.answerClassification !== "human") {
      return { eligible: false, reason: "awaiting_human_classification" };
    }
  }
  return { eligible: true };
}

export async function assertParallelOriginationAllowed(
  workspaceId: string,
  mode: DialingMode,
  opts?: { repAvailable?: boolean; jurisdictionPreset?: string },
) {
  const prisma = getPrisma();
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const entitlements = parseAdvancedDialEntitlements(limitsRow?.limits);
  const { getCampaignAbandonedMetrics } = await import("./abandoned-metrics");
  const campaigns = await prisma.powerDialerCampaign.findMany({
    where: { workspaceId, status: "active" },
    select: { id: true },
    take: 1,
  });
  let abandonHardStop = false;
  if (campaigns[0]) {
    const m = await getCampaignAbandonedMetrics(workspaceId, campaigns[0].id, 30);
    const snap = {
      abandonedCount: m.abandonedCount,
      connectedCount: m.totalAttempts - m.abandonedCount,
    };
    const eval_ = evaluateAbandonmentSafeguards(DEFAULT_ABANDONMENT_POLICY, snap);
    abandonHardStop = eval_.hardStop;
  }
  const gate = evaluateDialModeGate({
    mode,
    entitlements,
    abandonHardStop,
    repAvailable: opts?.repAvailable ?? true,
    jurisdictionAllowsParallel: opts?.jurisdictionPreset !== "parallel_blocked",
  });
  if (!gate.allowed) {
    throw new Error(gate.userMessage || "Dialing mode blocked");
  }
  return entitlements;
}

export function resolveLinesForSession(
  mode: DialingMode,
  configJson: unknown,
  entitlements: ReturnType<typeof parseAdvancedDialEntitlements>,
  predictiveCtx?: {
    repsAvailable: number;
    repsOnCall: number;
    answerRate: number;
    currentAbandonPct: number;
  },
): number {
  const settings = parseDialModeSettings(configJson);
  if (mode === "predictive" && predictiveCtx) {
    const pacing = computePredictiveLines({
      repsAvailable: predictiveCtx.repsAvailable,
      repsOnCall: predictiveCtx.repsOnCall,
      historicalAnswerRate: predictiveCtx.answerRate,
      targetAbandonRatePct: settings.abandonRateTargetPct,
      maxLinesPerRep: entitlements.maxParallelLines,
      aggression: settings.pacingAggression,
      currentAbandonRatePct: predictiveCtx.currentAbandonPct,
      hardStopAbandonPct: DEFAULT_ABANDONMENT_POLICY.hardStopPct,
    });
    if (pacing.hardStop || pacing.linesToDial <= 0) return 0;
    return pacing.linesToDial;
  }
  return effectiveParallelLineCount(mode, settings, entitlements);
}

export { isMultiLineDialMode };
