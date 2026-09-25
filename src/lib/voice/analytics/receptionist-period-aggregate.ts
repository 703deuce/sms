import "server-only";

import { getPrisma } from "@/lib/db";
import {
  aggregateReceptionistCalls,
  type VoiceAnalyticsCallRow,
} from "@/lib/voice/analytics/voice-analytics-aggregate";
import {
  normalizeVoiceAnalyticsDays,
  voiceAnalyticsPeriodBounds,
  type VoiceAnalyticsPeriodDays,
} from "@/lib/voice/analytics/voice-analytics-period";
import { resolveVoiceBusinessTimezone } from "@/lib/voice/analytics/resolve-business-timezone";

export type ReceptionistPeriodAggregate = {
  timezone: string;
  periodDays: VoiceAnalyticsPeriodDays;
  periodStart: Date;
  periodEnd: Date;
  receptionistAgg: ReturnType<typeof aggregateReceptionistCalls>;
};

export async function loadReceptionistPeriodAggregate(
  workspaceId: string,
  days: number,
): Promise<ReceptionistPeriodAggregate> {
  const prisma = getPrisma();
  const periodDays = normalizeVoiceAnalyticsDays(days);
  const timezone = await resolveVoiceBusinessTimezone(workspaceId);
  const { start, end } = voiceAnalyticsPeriodBounds(periodDays, timezone);

  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId,
      startedAt: { gte: start, lt: end },
      isTest: false,
    },
    include: {
      transfers: {
        select: { status: true, answered: true },
      },
    },
  });

  const rows: VoiceAnalyticsCallRow[] = calls.map((c) => ({
    id: c.id,
    startedAt: c.startedAt,
    direction: c.direction,
    isTest: c.isTest,
    outcome: c.outcome,
    appointmentBooked: c.appointmentBooked,
    transferred: c.transferred,
    voicemailDetected: c.voicemailDetected,
    leadScore: c.leadScore,
    status: c.status,
    durationSeconds: c.durationSeconds,
    transfers: c.transfers,
    metadata: c.metadata,
  }));

  const receptionistAgg = aggregateReceptionistCalls(rows, timezone);

  return {
    timezone,
    periodDays,
    periodStart: start,
    periodEnd: end,
    receptionistAgg,
  };
}
