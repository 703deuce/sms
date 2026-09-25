import { getPrisma } from "@/lib/db";
import type { VoiceCall, VoiceToolExecution, VoiceUsageRecord, VoiceTransfer } from "@prisma/client";
import {
  aggregateReceptionistCalls,
  aggregateResponseLatencyMs,
} from "@/lib/voice/analytics/voice-analytics-aggregate";
import {
  buildDailyCallVolumeSeries,
  normalizeVoiceAnalyticsDays,
  voiceAnalyticsPeriodBounds,
  type VoiceAnalyticsPeriodDays,
} from "@/lib/voice/analytics/voice-analytics-period";
import { resolveVoiceBusinessTimezone } from "@/lib/voice/analytics/resolve-business-timezone";

export type VoiceAnalyticsReceptionist = {
  timezone: string;
  periodDays: VoiceAnalyticsPeriodDays;
  periodStart: string;
  periodEnd: string;
  population: "inbound_non_test";
  totalCalls: number;
  appointmentsBooked: number;
  transfersAnswered: number;
  transfersFailed: number;
  callbacksRequested: number;
  voicemailCount: number;
  voicemailRate: number;
  avgDurationSeconds: number;
  materialOutcomes: Record<string, number>;
  dailyCallVolume: Array<{ date: string; count: number }>;
  responseLatency: {
    medianResponseLatencyMs: number | null;
    p95ResponseLatencyMs: number | null;
    responseLatencySampleSize: number;
    metricDefinition: "caller_end_of_speech_to_first_audible_agent_audio";
  };
  usage: {
    aiMinutes: number;
    telephonyMinutes: number;
  };
  sentimentCounts: {
    positive: number;
    neutral: number;
    negative: number;
    unknown: number;
    analyzedCalls: number;
  };
  openKnowledgeGaps: number;
};

export async function loadVoiceAnalytics(
  workspaceId: string,
  days = 30,
  filters?: {
    agentId?: string;
    campaignId?: string;
    direction?: string;
    outcome?: string;
    phoneNumberId?: string;
  },
) {
  const prisma = getPrisma();
  const periodDays = normalizeVoiceAnalyticsDays(days);
  const timezone = await resolveVoiceBusinessTimezone(workspaceId);
  const { start, end, dayKeys } = voiceAnalyticsPeriodBounds(periodDays, timezone);

  const where: Record<string, unknown> = {
    workspaceId,
    startedAt: { gte: start, lt: end },
    isTest: false,
  };
  if (filters?.agentId) where.agentId = filters.agentId;
  if (filters?.campaignId) where.campaignId = filters.campaignId;
  if (filters?.direction) where.direction = filters.direction;
  if (filters?.outcome) where.outcome = filters.outcome;
  if (filters?.phoneNumberId) where.phoneNumberId = filters.phoneNumberId;

  const calls = await prisma.voiceCall.findMany({
    where,
    include: {
      transfers: {
        select: { status: true, answered: true },
      },
    },
  });

  const receptionistAgg = aggregateReceptionistCalls(
    calls.map((c) => ({
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
    })),
    timezone,
  );

  const latency = aggregateResponseLatencyMs(receptionistAgg.calls);

  const total = calls.length;
  const inbound = calls.filter((c) => c.direction === "INBOUND").length;
  const outbound = calls.filter((c) => c.direction === "OUTBOUND").length;
  const answered = calls.filter((c) =>
    ["ANSWERED", "IN_PROGRESS", "COMPLETED", "TRANSFERRED"].includes(c.status),
  ).length;
  const noAnswer = calls.filter((c) => c.status === "NO_ANSWER").length;
  const failed = calls.filter((c) => c.status === "FAILED" || c.status === "BUSY").length;
  const voicemail = calls.filter((c) => c.voicemailDetected).length;
  const transferred = calls.filter((c) => c.transferred).length;
  const qualified = calls.filter((c) => (c.leadScore ?? 0) >= 40).length;
  const appointments = calls.filter((c) => c.appointmentBooked).length;
  const totalDuration = calls.reduce((s, c) => s + (c.durationSeconds || 0), 0);
  const totalCost = calls.reduce((s, c) => s + c.costCents, 0);

  const transfers: VoiceTransfer[] = await prisma.voiceTransfer.findMany({
    where: {
      workspaceId,
      callId: { in: receptionistAgg.calls.map((c) => c.id) },
    },
  });
  const successfulTransfers = transfers.filter(
    (t) => t.status === "completed" && t.answered,
  ).length;

  const usage: VoiceUsageRecord[] = await prisma.voiceUsageRecord.findMany({
    where: { workspaceId, createdAt: { gte: start, lt: end } },
  });
  const aiMinutes = usage
    .filter((u) => u.category === "ai_minutes")
    .reduce((s, u) => s + u.quantity, 0);
  const telephonyMinutes = usage
    .filter((u) => u.category === "telephony")
    .reduce((s, u) => s + u.quantity, 0);
  const modelCostCents = usage
    .filter((u) => u.category === "model" || u.category === "llm")
    .reduce((s, u) => s + (u.billedCostCents || u.providerCostCents || 0), 0);
  const transcriptionCostCents = usage
    .filter((u) => u.category === "transcription")
    .reduce((s, u) => s + (u.billedCostCents || u.providerCostCents || 0), 0);

  const byDay: Record<string, number> = {};
  for (const c of calls) {
    const key = c.startedAt.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + 1;
  }

  const byAgent: Record<string, { calls: number; qualified: number; costCents: number }> = {};
  for (const c of calls) {
    const k = c.agentId || "none";
    if (!byAgent[k]) byAgent[k] = { calls: 0, qualified: 0, costCents: 0 };
    byAgent[k].calls += 1;
    if ((c.leadScore ?? 0) >= 40) byAgent[k].qualified += 1;
    byAgent[k].costCents += c.costCents;
  }

  const byCampaign: Record<string, number> = {};
  for (const c of calls) {
    const k = c.campaignId || "none";
    byCampaign[k] = (byCampaign[k] || 0) + 1;
  }

  const outcomes: Record<string, number> = {};
  for (const c of calls) {
    const k = c.outcome || c.status || "unknown";
    outcomes[k] = (outcomes[k] || 0) + 1;
  }

  const insights = await prisma.voiceConversationInsight.findMany({
    where: { workspaceId, createdAt: { gte: start, lt: end } },
    select: { sentiment: true, callId: true },
  });
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
  for (const i of insights) {
    const s = String(i.sentiment || "unknown").toLowerCase();
    if (s.includes("pos")) sentimentCounts.positive += 1;
    else if (s.includes("neg")) sentimentCounts.negative += 1;
    else if (s.includes("neu")) sentimentCounts.neutral += 1;
    else sentimentCounts.unknown += 1;
  }

  const toolExecs: VoiceToolExecution[] = await prisma.voiceToolExecution.findMany({
    where: { workspaceId, createdAt: { gte: start, lt: end } },
  });
  const toolSuccess = toolExecs.filter((t) => t.status === "completed").length;
  const toolFail = toolExecs.filter((t) => t.status === "failed").length;
  const toolLatencies = toolExecs
    .map((t) => t.latencyMs)
    .filter((n): n is number => typeof n === "number" && n >= 0);
  const avgToolLatencyMs = toolLatencies.length
    ? Math.round(toolLatencies.reduce((a, b) => a + b, 0) / toolLatencies.length)
    : 0;
  const p95ToolLatencyMs = toolLatencies.length
    ? [...toolLatencies].sort((a, b) => a - b)[
        Math.min(toolLatencies.length - 1, Math.floor(toolLatencies.length * 0.95))
      ]
    : 0;

  const diagnostics = await prisma.voiceFailureDiagnostic.findMany({
    where: { workspaceId, createdAt: { gte: start, lt: end } },
    select: { category: true, code: true },
    take: 500,
  });
  const diagnosticCounts: Record<string, number> = {};
  for (const d of diagnostics) {
    const k = `${d.category}:${d.code || "none"}`;
    diagnosticCounts[k] = (diagnosticCounts[k] || 0) + 1;
  }

  const openKnowledgeGaps = await prisma.voiceKnowledgeGap.count({
    where: { workspaceId, status: "OPEN" },
  });

  const dailyCallVolume = buildDailyCallVolumeSeries(
    dayKeys,
    receptionistAgg.dailyCallVolume,
  );

  const receptionist: VoiceAnalyticsReceptionist = {
    timezone,
    periodDays,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    population: "inbound_non_test",
    totalCalls: receptionistAgg.totalCalls,
    appointmentsBooked: receptionistAgg.appointmentsBooked,
    transfersAnswered: receptionistAgg.transfersAnswered,
    transfersFailed: receptionistAgg.transfersFailedEvents,
    callbacksRequested: receptionistAgg.callbacksRequested,
    voicemailCount: receptionistAgg.voicemailCount,
    voicemailRate:
      receptionistAgg.totalCalls > 0
        ? receptionistAgg.voicemailCount / receptionistAgg.totalCalls
        : 0,
    avgDurationSeconds:
      receptionistAgg.totalCalls > 0
        ? receptionistAgg.totalDurationSeconds / receptionistAgg.totalCalls
        : 0,
    materialOutcomes: receptionistAgg.materialOutcomes as Record<string, number>,
    dailyCallVolume,
    responseLatency: {
      ...latency,
      metricDefinition: "caller_end_of_speech_to_first_audible_agent_audio",
    },
    usage: {
      aiMinutes,
      telephonyMinutes,
    },
    sentimentCounts: {
      ...sentimentCounts,
      analyzedCalls:
        sentimentCounts.positive +
        sentimentCounts.neutral +
        sentimentCounts.negative +
        sentimentCounts.unknown,
    },
    openKnowledgeGaps,
  };

  return {
    periodDays,
    timezone,
    receptionist,
    totalCalls: total,
    inbound,
    outbound,
    answerRate: total ? answered / total : 0,
    humanAnswerRate: total
      ? calls.filter(
          (c) =>
            Boolean(c.answeredAt) &&
            !c.voicemailDetected &&
            !["VOICEMAIL", "NO_ANSWER", "BUSY", "FAILED", "CANCELLED"].includes(c.status),
        ).length / total
      : 0,
    noAnswerRate: total ? noAnswer / total : 0,
    failureRate: total ? failed / total : 0,
    voicemailRate: total ? voicemail / total : 0,
    transferRate: total ? transferred / total : 0,
    successfulTransferRate: transfers.length ? successfulTransfers / transfers.length : 0,
    qualifiedRate: total ? qualified / total : 0,
    appointmentRate: total ? appointments / total : 0,
    avgDurationSeconds: total ? totalDuration / total : 0,
    totalCostCents: totalCost,
    costPerCall: total ? Math.round(totalCost / total) : 0,
    aiMinutes,
    telephonyMinutes,
    modelCostCents,
    transcriptionCostCents,
    costPerQualifiedLead: qualified ? Math.round(totalCost / qualified) : 0,
    costPerAppointment: appointments ? Math.round(totalCost / appointments) : 0,
    byDay,
    byAgent,
    byCampaign,
    outcomes,
    sentimentCounts,
    toolSuccessRate: toolExecs.length ? toolSuccess / toolExecs.length : 0,
    toolFailures: toolFail,
    latency: {
      avgToolLatencyMs,
      p95ToolLatencyMs,
      toolSampleSize: toolLatencies.length,
      responseLatencyMetric: "caller_end_of_speech_to_first_audible_agent_audio",
      avgResponseLatencyMs: latency.medianResponseLatencyMs,
      medianResponseLatencyMs: latency.medianResponseLatencyMs,
      p95ResponseLatencyMs: latency.p95ResponseLatencyMs,
      responseLatencySampleSize: latency.responseLatencySampleSize,
      diagnosticCounts,
    },
    voiceProduct: {
      callbacksRequested: receptionist.callbacksRequested,
      messagesTaken: receptionist.materialOutcomes["Message Taken"] ?? 0,
      emergenciesEscalated: receptionist.materialOutcomes["Emergency"] ?? 0,
      transferAttempts: transfers.length,
      transferCompleted: transfers.filter((t) => t.status === "completed").length,
      transferFailed: receptionist.transfersFailed,
      appointmentsBooked: receptionist.appointmentsBooked,
      openKnowledgeGaps,
      spamOrSolicitorOutcomes:
        (receptionist.materialOutcomes["Spam"] ?? 0) +
        (receptionist.materialOutcomes["Solicitor"] ?? 0),
    },
  };
}

export function analyticsToCsv(data: Awaited<ReturnType<typeof loadVoiceAnalytics>>): string {
  const r = data.receptionist;
  const lines = [
    "metric,value",
    `receptionist_calls,${r.totalCalls}`,
    `appointments_booked,${r.appointmentsBooked}`,
    `transfers_answered,${r.transfersAnswered}`,
    `callbacks_requested,${r.callbacksRequested}`,
    `avg_duration_seconds,${r.avgDurationSeconds}`,
    `timezone,${r.timezone}`,
    `total_calls_legacy_all_directions,${data.totalCalls}`,
  ];
  for (const { date, count } of r.dailyCallVolume) {
    lines.push(`calls_${date},${count}`);
  }
  for (const [outcome, count] of Object.entries(r.materialOutcomes)) {
    lines.push(`outcome_${outcome},${count}`);
  }
  return lines.join("\n");
}
