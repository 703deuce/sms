import type { VoiceV2FrictionSignalType, VoiceV2ResolutionAuditStatus } from "./types";
import { isLegitimateResolutionDenominator, isResolvedForRate } from "./resolution-audit";

export type AfterHoursAnalyticsRow = {
  callId: string;
  resolution: VoiceV2ResolutionAuditStatus;
  operatingState?: string;
  primaryOutcome?: string;
  frictionTypes: VoiceV2FrictionSignalType[];
  recoverySent?: boolean;
  callbackLifecycle?: string;
};

export type AfterHoursAnalyticsSummary = {
  aiHandledCalls: number;
  legitimateCalls: number;
  resolutionRate: number | null;
  resolvedSuccess: number;
  informationOnly: number;
  unresolved: number;
  callbacksCreated: number;
  callbacksOverdue: number;
  recoverySmsSent: number;
  transferFailures: number;
  aiRefusals: number;
  frictionCounts: Partial<Record<VoiceV2FrictionSignalType, number>>;
  bookingsAfterHours: number;
};

export function aggregateAfterHoursAnalytics(rows: AfterHoursAnalyticsRow[]): AfterHoursAnalyticsSummary {
  let legitimate = 0;
  let resolved = 0;
  let resolvedSuccess = 0;
  let informationOnly = 0;
  let unresolved = 0;
  let callbacksCreated = 0;
  let callbacksOverdue = 0;
  let recoverySmsSent = 0;
  let transferFailures = 0;
  let aiRefusals = 0;
  let bookingsAfterHours = 0;
  const frictionCounts: Partial<Record<VoiceV2FrictionSignalType, number>> = {};

  for (const row of rows) {
    if (isLegitimateResolutionDenominator({ resolution: row.resolution })) {
      legitimate += 1;
      if (isResolvedForRate(row.resolution)) resolved += 1;
    }
    if (row.resolution === "RESOLVED_SUCCESS") resolvedSuccess += 1;
    if (row.resolution === "RESOLVED_INFORMATION_ONLY") informationOnly += 1;
    if (
      row.resolution.startsWith("ABANDONED") ||
      row.resolution === "UNRESOLVED_ABANDONED" ||
      row.resolution === "AI_UNABLE_TO_HELP"
    ) {
      unresolved += 1;
    }
    if (row.callbackLifecycle === "PENDING" || row.callbackLifecycle === "ATTEMPTED") {
      callbacksCreated += 1;
    }
    if (row.callbackLifecycle === "OVERDUE") callbacksOverdue += 1;
    if (row.recoverySent) recoverySmsSent += 1;
    if (row.resolution === "TRANSFER_FAILURE") transferFailures += 1;
    if (row.resolution === "AI_REFUSAL") aiRefusals += 1;
    if (row.primaryOutcome === "BOOKED" && row.operatingState !== "OPEN") {
      bookingsAfterHours += 1;
    }
    for (const t of row.frictionTypes) {
      frictionCounts[t] = (frictionCounts[t] || 0) + 1;
    }
  }

  return {
    aiHandledCalls: rows.length,
    legitimateCalls: legitimate,
    resolutionRate:
      legitimate > 0 ? resolved / legitimate : null,
    resolvedSuccess,
    informationOnly,
    unresolved,
    callbacksCreated,
    callbacksOverdue,
    recoverySmsSent,
    transferFailures,
    aiRefusals,
    frictionCounts,
    bookingsAfterHours,
  };
}
