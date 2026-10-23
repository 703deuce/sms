import { getPrisma } from "@/lib/server/db";
import type { DialingMode } from "./dial-modes";
import {
  effectiveParallelLineCount,
  evaluateDialModeGate,
  isMultiLineDialMode,
  parseAdvancedDialEntitlements,
  parseDialModeSettings,
} from "./dial-modes";
import { mergeAttemptMetadata } from "./attempt-metadata";
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
  hangupAttempt: async (_attemptId, humanCallId) => {
    if (!humanCallId) return;
    const { getPrisma } = await import("@/lib/server/db");
    const prisma = getPrisma();
    const call = await prisma.humanCall.findFirst({ where: { id: humanCallId } });
    if (!call?.telnyxCallControlId) return;
    const { telnyxCallAction } = await import("@/lib/server/phone/telnyx-call-actions");
    await telnyxCallAction(call.telnyxCallControlId, "hangup", {});
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

export async function onParallelHumanAnswered(input: {
  workspaceId: string;
  sessionId: string;
  attemptId: string;
  answeredAt: Date;
  bridgeStartedAt?: Date;
  deps?: TelnyxParallelDeps;
}) {
  const prisma = getPrisma();
  const session = await prisma.powerDialerSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
  });
  if (!session) throw new Error("Session not found");
  const parallelState =
    session.parallelStateJson && typeof session.parallelStateJson === "object"
      ? (session.parallelStateJson as Record<string, unknown>)
      : {};
  const pending = Array.isArray(parallelState.pendingAnswers)
    ? (parallelState.pendingAnswers as { attemptId: string; answeredAtMs: number }[])
    : [];
  pending.push({
    attemptId: input.attemptId,
    answeredAtMs: input.answeredAt.getTime(),
  });
  const winnerId = pickBridgeWinner(pending);
  if (!winnerId) return { winnerAttemptId: null as string | null };

  if (winnerId === input.attemptId) {
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
    await cancelParallelLosers(
      input.workspaceId,
      input.sessionId,
      winnerId,
      input.deps ?? defaultTelnyxDeps,
    );
    await prisma.powerDialerSession.update({
      where: { id: input.sessionId },
      data: {
        currentAttemptId: winnerId,
        parallelStateJson: { roundComplete: true, winnerAttemptId: winnerId },
      },
    });
    return { winnerAttemptId: winnerId };
  }

  const attempt = await prisma.powerDialerAttempt.findFirst({
    where: { id: input.attemptId, workspaceId: input.workspaceId },
  });
  if (attempt) {
    await prisma.powerDialerAttempt.update({
      where: { id: input.attemptId },
      data: {
        status: "cancelled",
        endedAt: new Date(),
        metadataJson: mergeAttemptMetadata(attempt.metadataJson, { parallelLoser: true }),
      },
    });
  }
  return { winnerAttemptId: winnerId };
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
