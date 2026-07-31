import { getPrisma } from "@/lib/db";
import type { VoiceCall, VoiceToolExecution, VoiceUsageRecord } from "@prisma/client";

export async function loadVoiceAnalytics(
  workspaceId: string,
  days = 30,
) {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const calls: VoiceCall[] = await prisma.voiceCall.findMany({
    where: { workspaceId, startedAt: { gte: since }, isTest: false },
  });

  const total = calls.length;
  const inbound = calls.filter((c) => c.direction === "INBOUND").length;
  const outbound = calls.filter((c) => c.direction === "OUTBOUND").length;
  const answered = calls.filter((c) =>
    ["ANSWERED", "IN_PROGRESS", "COMPLETED", "TRANSFERRED"].includes(c.status),
  ).length;
  const voicemail = calls.filter((c) => c.voicemailDetected).length;
  const transferred = calls.filter((c) => c.transferred).length;
  const qualified = calls.filter((c) => (c.leadScore ?? 0) >= 40).length;
  const appointments = calls.filter((c) => c.appointmentBooked).length;
  const totalDuration = calls.reduce((s, c) => s + (c.durationSeconds || 0), 0);
  const totalCost = calls.reduce((s, c) => s + c.costCents, 0);

  const usage: VoiceUsageRecord[] = await prisma.voiceUsageRecord.findMany({
    where: { workspaceId, createdAt: { gte: since } },
  });
  const aiMinutes = usage
    .filter((u) => u.category === "ai_minutes")
    .reduce((s, u) => s + u.quantity, 0);
  const telephonyMinutes = usage
    .filter((u) => u.category === "telephony")
    .reduce((s, u) => s + u.quantity, 0);

  const byDay: Record<string, number> = {};
  for (const c of calls) {
    const key = c.startedAt.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] || 0) + 1;
  }

  const byAgent: Record<string, number> = {};
  for (const c of calls) {
    const k = c.agentId || "none";
    byAgent[k] = (byAgent[k] || 0) + 1;
  }

  const toolExecs: VoiceToolExecution[] = await prisma.voiceToolExecution.findMany({
    where: { workspaceId, createdAt: { gte: since } },
  });
  const toolSuccess = toolExecs.filter((t) => t.status === "completed").length;
  const toolFail = toolExecs.filter((t) => t.status === "failed").length;

  return {
    periodDays: days,
    totalCalls: total,
    inbound,
    outbound,
    answerRate: total ? answered / total : 0,
    voicemailRate: total ? voicemail / total : 0,
    transferRate: total ? transferred / total : 0,
    qualifiedRate: total ? qualified / total : 0,
    appointmentRate: total ? appointments / total : 0,
    avgDurationSeconds: total ? totalDuration / total : 0,
    totalCostCents: totalCost,
    aiMinutes,
    telephonyMinutes,
    costPerQualifiedLead: qualified ? Math.round(totalCost / qualified) : 0,
    costPerAppointment: appointments ? Math.round(totalCost / appointments) : 0,
    byDay,
    byAgent,
    toolSuccessRate: toolExecs.length ? toolSuccess / toolExecs.length : 0,
    toolFailures: toolFail,
  };
}

export function analyticsToCsv(data: Awaited<ReturnType<typeof loadVoiceAnalytics>>): string {
  const lines = [
    "metric,value",
    `total_calls,${data.totalCalls}`,
    `inbound,${data.inbound}`,
    `outbound,${data.outbound}`,
    `answer_rate,${data.answerRate}`,
    `qualified_rate,${data.qualifiedRate}`,
    `total_cost_cents,${data.totalCostCents}`,
    `ai_minutes,${data.aiMinutes}`,
  ];
  for (const [day, count] of Object.entries(data.byDay)) {
    lines.push(`calls_${day},${count}`);
  }
  return lines.join("\n");
}
