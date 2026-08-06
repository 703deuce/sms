/**
 * Business outcome metrics for Appointment Booking Agent.
 */

import { getPrisma } from "@/lib/db";
import type { AgentMetrics } from "@/lib/agents/appointment-booking/types";

export async function buildAgentMetrics(input: {
  workspaceId: string;
  agentId: string;
  windowDays?: number;
}): Promise<AgentMetrics> {
  const prisma = getPrisma();
  const windowDays = Math.max(1, Number(input.windowDays || 7));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60_000);

  const calls = await prisma.voiceCall.findMany({
    where: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      startedAt: { gte: since },
    },
    select: {
      id: true,
      appointmentBooked: true,
      transferred: true,
      voicemailDetected: true,
    },
    take: 500,
  });

  const callIds = calls.map((c: { id: string }) => c.id);
  const bookedCalls = calls.filter((c: { appointmentBooked: boolean }) => c.appointmentBooked).length;
  const transfers = calls.filter((c: { transferred: boolean }) => c.transferred).length;
  const messagesTaken = calls.filter(
    (c: { voicemailDetected: boolean }) => c.voicemailDetected,
  ).length;

  const appointments = callIds.length
    ? await prisma.voiceAppointment.findMany({
        where: {
          workspaceId: input.workspaceId,
          createdAt: { gte: since },
          callId: { in: callIds },
        },
        select: { status: true, callId: true },
        take: 500,
      })
    : [];

  const allRecentAppts = appointments;
  const appointmentsBooked = Math.max(
    bookedCalls,
    appointments.filter((a: { status: string }) => a.status !== "cancelled").length,
  );
  const appointmentsRescheduled = allRecentAppts.filter((a: { status: string }) =>
    /reschedul/i.test(String(a.status)),
  ).length;
  const appointmentsCancelled = allRecentAppts.filter(
    (a: { status: string }) => String(a.status).toLowerCase() === "cancelled",
  ).length;

  const toolFails = callIds.length
    ? await prisma.voiceToolExecution.count({
        where: {
          workspaceId: input.workspaceId,
          callId: { in: callIds },
          status: { in: ["failed", "error", "FAILED"] },
        },
      })
    : 0;

  const toolRows = callIds.length
    ? await prisma.voiceToolExecution.findMany({
        where: {
          workspaceId: input.workspaceId,
          callId: { in: callIds },
          status: { in: ["succeeded", "success", "ok", "COMPLETED", "completed"] },
        },
        select: { toolId: true, input: true, output: true },
        take: 500,
      })
    : [];

  // Resolve tool types when available
  const toolIds = [
    ...new Set(
      toolRows
        .map((t: { toolId?: string | null }) => t.toolId)
        .filter(Boolean) as string[],
    ),
  ];
  const tools =
    toolIds.length > 0
      ? await prisma.voiceTool.findMany({
          where: { id: { in: toolIds } },
          select: { id: true, toolType: true, name: true },
        })
      : [];
  const typeById = new Map(
    tools.map((t: { id: string; toolType: string; name: string }) => [
      t.id,
      String(t.toolType || t.name || ""),
    ]),
  );

  let confirmationSmsSent = 0;
  let confirmationEmailsSent = 0;
  let calendarFailures = 0;
  for (const row of toolRows) {
    const type = String(typeById.get(String(row.toolId || "")) || "");
    if (/send_sms/i.test(type)) confirmationSmsSent += 1;
    if (/send_email|confirmation_email/i.test(type)) confirmationEmailsSent += 1;
  }
  const failRows = callIds.length
    ? await prisma.voiceToolExecution.findMany({
        where: {
          workspaceId: input.workspaceId,
          callId: { in: callIds },
          status: { in: ["failed", "error", "FAILED"] },
        },
        select: { toolId: true },
        take: 200,
      })
    : [];
  for (const row of failRows) {
    const type = String(typeById.get(String(row.toolId || "")) || "");
    if (/calendar|book_appointment|availability/i.test(type)) {
      calendarFailures += 1;
    }
  }

  const bookingConversationsStarted = calls.length;
  const bookingConversionRate =
    bookingConversationsStarted > 0
      ? Math.round((appointmentsBooked / bookingConversationsStarted) * 1000) / 10
      : 0;

  return {
    callsAnswered: calls.length,
    bookingConversationsStarted,
    appointmentsBooked,
    appointmentsRescheduled,
    appointmentsCancelled,
    bookingConversionRate,
    transfers,
    messagesTaken,
    bookingFailures: toolFails,
    calendarFailures: calendarFailures || toolFails,
    confirmationSmsSent,
    confirmationEmailsSent,
    windowDays,
  };
}
