import "server-only";

import { getPrisma } from "@/lib/db";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export type AfterHoursAnalyticsSnapshot = {
  range: { from: string; to: string };
  kpis: {
    afterHoursCalls: number;
    appointmentsBooked: number;
    messagesAndCallbacks: number;
    emergencyEscalations: number;
    successfulTransfers: number;
    failedTransfers: number;
    spamOrSolicitors: number;
    needsAttention: number;
    avgDurationSeconds: number;
  };
  outcomes: Array<{ label: string; count: number }>;
  callsByDay: Array<{ day: string; count: number }>;
  callsByHour: Array<{ hour: number; count: number }>;
  topReasons: Array<{ reason: string; count: number }>;
  knowledgeGaps: { open: number; newThisWeek: number };
};

function outcomeBucket(call: {
  outcome: string | null;
  appointmentBooked: boolean;
  transferred: boolean;
  metadata: unknown;
}): string {
  const meta = asRecord(call.metadata);
  const analytics = asRecord(meta.voiceV3Analytics);
  const v3Outcome = String(analytics.outcome || "");
  if (v3Outcome === "SOLICITOR" || v3Outcome === "SPAM") return "Spam/solicitors";
  if (v3Outcome === "APPOINTMENT_BOOKED" || call.appointmentBooked) return "Appointments";
  if (v3Outcome === "CALLBACK_REQUESTED" || v3Outcome === "MESSAGE_TAKEN") {
    return "Messages/callbacks";
  }
  if (v3Outcome === "FAQ_RESOLVED") return "FAQ resolved";
  if (v3Outcome === "TRANSFER_CONNECTED" || call.transferred) return "Transfers";
  if (v3Outcome === "TRANSFER_FAILED") return "Transfer failed";
  if (v3Outcome === "EMERGENCY_ESCALATED") return "Emergency escalations";
  const o = String(call.outcome || "").toLowerCase();
  if (o.includes("spam") || o.includes("solicit")) return "Spam/solicitors";
  if (o.includes("callback") || o.includes("message")) return "Messages/callbacks";
  if (o.includes("book")) return "Appointments";
  if (o.includes("emergency")) return "Emergency escalations";
  if (o.includes("transfer")) return "Transfers";
  return "Other";
}

function needsAttention(call: {
  outcome: string | null;
  appointmentBooked: boolean;
  transferred: boolean;
  metadata: unknown;
}): boolean {
  const meta = asRecord(call.metadata);
  const analytics = asRecord(meta.voiceV3Analytics);
  if (analytics.actionRequired === true) return true;
  const v3Outcome = String(analytics.outcome || "");
  return (
    v3Outcome === "TRANSFER_FAILED" ||
    v3Outcome === "EMERGENCY_ESCALATED" ||
    String(call.outcome || "").toLowerCase().includes("transfer_failed")
  );
}

export async function queryAfterHoursAnalytics(input: {
  workspaceId: string;
  from: Date;
  to: Date;
}): Promise<AfterHoursAnalyticsSnapshot> {
  const prisma = getPrisma();
  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: input.workspaceId,
      isTest: false,
      startedAt: { gte: input.from, lt: input.to },
    },
    select: {
      id: true,
      outcome: true,
      appointmentBooked: true,
      transferred: true,
      durationSeconds: true,
      startedAt: true,
      metadata: true,
    },
  });

  const outcomeMap = new Map<string, number>();
  const reasonMap = new Map<string, number>();
  const dayMap = new Map<string, number>();
  const hourMap = new Map<number, number>();
  let appointments = 0;
  let messages = 0;
  let emergencies = 0;
  let transfersOk = 0;
  let transfersFail = 0;
  let spam = 0;
  let attention = 0;
  let durationTotal = 0;
  let durationCount = 0;

  for (const c of calls) {
    const bucket = outcomeBucket(c);
    outcomeMap.set(bucket, (outcomeMap.get(bucket) || 0) + 1);
    if (bucket === "Appointments") appointments += 1;
    if (bucket === "Messages/callbacks") messages += 1;
    if (bucket === "Emergency escalations") emergencies += 1;
    if (bucket === "Transfers") transfersOk += 1;
    if (bucket === "Transfer failed") transfersFail += 1;
    if (bucket === "Spam/solicitors") spam += 1;
    if (needsAttention(c)) attention += 1;

    const meta = asRecord(c.metadata);
    const analytics = asRecord(meta.voiceV3Analytics);
    const reason = String(analytics.reasonForCall || analytics.reasonCategory || "").trim();
    if (reason) reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);

    const dayKey = c.startedAt.toISOString().slice(0, 10);
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
    const hour = c.startedAt.getUTCHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);

    if (c.durationSeconds != null) {
      durationTotal += c.durationSeconds;
      durationCount += 1;
    }
  }

  const weekAgo = new Date(input.to);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const [openGaps, newGaps] = await Promise.all([
    prisma.voiceKnowledgeGap.count({
      where: { workspaceId: input.workspaceId, status: "OPEN" },
    }),
    prisma.voiceKnowledgeGap.count({
      where: {
        workspaceId: input.workspaceId,
        status: "OPEN",
        firstAskedAt: { gte: weekAgo },
      },
    }),
  ]);

  return {
    range: { from: input.from.toISOString(), to: input.to.toISOString() },
    kpis: {
      afterHoursCalls: calls.length,
      appointmentsBooked: appointments,
      messagesAndCallbacks: messages,
      emergencyEscalations: emergencies,
      successfulTransfers: transfersOk,
      failedTransfers: transfersFail,
      spamOrSolicitors: spam,
      needsAttention: attention,
      avgDurationSeconds: durationCount ? Math.round(durationTotal / durationCount) : 0,
    },
    outcomes: [...outcomeMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    callsByDay: [...dayMap.entries()]
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    callsByHour: [...hourMap.entries()]
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour),
    topReasons: [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    knowledgeGaps: { open: openGaps, newThisWeek: newGaps },
  };
}
