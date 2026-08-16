import { getPrisma } from "@/lib/db";
import {
  loadVoicePhoneMinutesSummary,
  sumVoicePhoneMinutesInRange,
} from "./phone-minutes";

export type VoiceOverviewStats = {
  activeAgents: number;
  assignedNumbers: number;
  callsToday: number;
  inboundToday: number;
  outboundToday: number;
  answerRate: number;
  humanConnectionRate: number;
  avgDurationSeconds: number;
  qualifiedLeads: number;
  appointmentsBooked: number;
  transfersCompleted: number;
  transferFailures: number;
  voicemailsDetected: number;
  /** Phone talk minutes in the selected range (voice_calls duration, not TTS). */
  aiMinutesUsed: number;
  phoneMinutesToday: number;
  phoneMinutesYesterday: number;
  phoneMinutesDeltaPct: number | null;
  monthlyCostCents: number;
  runningCampaigns: number;
  agentsWithErrors: number;
  recentCalls: Array<{
    id: string;
    direction: string;
    status: string;
    fromE164: string;
    toE164: string;
    startedAt: string;
    outcome?: string | null;
  }>;
  recentFailures: Array<{ id: string; message: string; at: string }>;
};

export async function loadVoiceOverview(
  workspaceId: string,
  rangeDays = 1,
): Promise<VoiceOverviewStats> {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - rangeDays);
  since.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const phoneMinutesSummary = await loadVoicePhoneMinutesSummary(workspaceId);
  const rangePhoneMinutes = await sumVoicePhoneMinutesInRange(workspaceId, since, tomorrow);

  const [
    activeAgents,
    assignedNumbers,
    callsToday,
    inboundToday,
    outboundToday,
    answered,
    transferred,
    voicemails,
    qualified,
    appointments,
    agentsWithErrors,
    runningCampaigns,
    recentCalls,
    failedCalls,
    usageAgg,
  ] = await Promise.all([
    prisma.voiceAgent.count({
      where: { workspaceId, status: "ACTIVE" },
    }),
    prisma.voiceAgent.count({
      where: { workspaceId, phoneNumberId: { not: null } },
    }),
    prisma.voiceCall.count({
      where: { workspaceId, startedAt: { gte: todayStart }, isTest: false },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        direction: "INBOUND",
        startedAt: { gte: todayStart },
        isTest: false,
      },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        direction: "OUTBOUND",
        startedAt: { gte: todayStart },
        isTest: false,
      },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        startedAt: { gte: since },
        status: { in: ["ANSWERED", "IN_PROGRESS", "COMPLETED", "TRANSFERRED"] },
        isTest: false,
      },
    }),
    prisma.voiceCall.count({
      where: { workspaceId, startedAt: { gte: since }, transferred: true, isTest: false },
    }),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        startedAt: { gte: since },
        voicemailDetected: true,
        isTest: false,
      },
    }),
    (async () => {
      const rows = await prisma.voiceCall.findMany({
        where: { workspaceId, startedAt: { gte: since }, isTest: false },
        select: { leadScore: true },
      });
      return rows.filter((c: { leadScore: number | null }) => (c.leadScore ?? 0) >= 40).length;
    })(),
    prisma.voiceCall.count({
      where: {
        workspaceId,
        startedAt: { gte: since },
        appointmentBooked: true,
        isTest: false,
      },
    }),
    prisma.voiceAgent.count({
      where: {
        workspaceId,
        OR: [{ status: "CONFIGURATION_ERROR" }, { healthStatus: "error" }],
      },
    }),
    prisma.voiceCampaign.count({
      where: { workspaceId, status: "RUNNING" },
    }),
    prisma.voiceCall.findMany({
      where: { workspaceId, isTest: false },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    prisma.voiceCall.findMany({
      where: {
        workspaceId,
        status: { in: ["FAILED", "CANCELLED"] },
        isTest: false,
      },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.voiceUsageRecord.findMany({
      where: { workspaceId, createdAt: { gte: since } },
    }),
  ]);

  const totalCalls = await prisma.voiceCall.count({
    where: { workspaceId, startedAt: { gte: since }, isTest: false },
  });

  const durationAgg = await prisma.voiceCall.findMany({
    where: {
      workspaceId,
      startedAt: { gte: since },
      durationSeconds: { not: null },
      isTest: false,
    },
    select: { durationSeconds: true },
  });
  const avgDuration =
    durationAgg.length
      ? durationAgg.reduce((s: number, c: { durationSeconds: number | null }) => s + (c.durationSeconds || 0), 0) / durationAgg.length
      : 0;

  const monthlyCostCents = usageAgg.reduce((s: number, u: { billedCostCents: number }) => s + (u.billedCostCents || 0), 0);

  return {
    activeAgents,
    assignedNumbers,
    callsToday,
    inboundToday,
    outboundToday,
    answerRate: totalCalls ? answered / totalCalls : 0,
    humanConnectionRate: totalCalls ? transferred / totalCalls : 0,
    avgDurationSeconds: avgDuration,
    qualifiedLeads: qualified,
    appointmentsBooked: appointments,
    transfersCompleted: transferred,
    transferFailures: 0,
    voicemailsDetected: voicemails,
    aiMinutesUsed: rangePhoneMinutes,
    phoneMinutesToday: phoneMinutesSummary.minutesToday,
    phoneMinutesYesterday: phoneMinutesSummary.minutesYesterday,
    phoneMinutesDeltaPct: phoneMinutesSummary.deltaPct,
    monthlyCostCents,
    runningCampaigns,
    agentsWithErrors,
    recentCalls: recentCalls.map((c: {
      id: string;
      direction: string;
      status: string;
      fromE164: string;
      toE164: string;
      startedAt: Date;
      outcome: string | null;
    }) => ({
      id: c.id,
      direction: c.direction,
      status: c.status,
      fromE164: c.fromE164,
      toE164: c.toE164,
      startedAt: c.startedAt.toISOString(),
      outcome: c.outcome,
    })),
    recentFailures: failedCalls.map((c: {
      id: string;
      errorMessage: string | null;
      outcome: string | null;
      startedAt: Date;
    }) => ({
      id: c.id,
      message: c.errorMessage || c.outcome || "Call failed",
      at: c.startedAt.toISOString(),
    })),
  };
}
