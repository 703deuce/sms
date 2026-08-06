/**
 * Business outcome metrics for Appointment Booking Agent.
 */

import { getPrisma } from "@/lib/db";
import type { AgentMetrics } from "@/lib/agents/appointment-booking/types";

export async function buildAgentMetrics(input: {
  workspaceId: string;
  agentId: string;
  windowDays?: number;
  includePreviousWindow?: boolean;
}): Promise<AgentMetrics> {
  const prisma = getPrisma();
  const windowDays = Math.max(1, Number(input.windowDays || 7));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60_000);
  const prevSince = new Date(since.getTime() - windowDays * 24 * 60 * 60_000);

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
      startedAt: true,
      endedAt: true,
      metadata: true,
    },
    take: 500,
  });

  const callIds = calls.map((c: { id: string }) => c.id);
  const bookedCalls = calls.filter((c: { appointmentBooked: boolean }) => c.appointmentBooked);
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
        select: { status: true, serviceName: true, callId: true, createdAt: true },
        take: 500,
      })
    : [];

  const appointmentsBooked = Math.max(
    bookedCalls.length,
    appointments.filter((a: { status: string }) => a.status !== "cancelled").length,
  );
  const appointmentsRescheduled = appointments.filter((a: { status: string }) =>
    /reschedul/i.test(String(a.status)),
  ).length;
  const appointmentsCancelled = appointments.filter(
    (a: { status: string }) => String(a.status).toLowerCase() === "cancelled",
  ).length;

  // Abandoned: booking intent in metadata / started booking tools but no book
  let abandonedBookingConversations = 0;
  const callById = new Map(calls.map((c: { id: string }) => [c.id, c]));
  for (const call of calls) {
    const meta =
      call.metadata && typeof call.metadata === "object"
        ? (call.metadata as Record<string, unknown>)
        : {};
    const state =
      meta.bookingConversationState && typeof meta.bookingConversationState === "object"
        ? (meta.bookingConversationState as Record<string, unknown>)
        : null;
    const startedBooking =
      state?.intent === "book" || Boolean(state?.spokenDateExpression);
    if (startedBooking && !call.appointmentBooked) abandonedBookingConversations += 1;
  }

  // Avg time to booking from call start → appointment created
  const durations: number[] = [];
  for (const appt of appointments) {
    if (!appt.callId || appt.status === "cancelled") continue;
    const call = callById.get(appt.callId) as
      | { startedAt?: Date }
      | undefined;
    if (!call?.startedAt || !appt.createdAt) continue;
    const ms = new Date(appt.createdAt).getTime() - new Date(call.startedAt).getTime();
    if (ms > 0 && ms < 60 * 60_000) durations.push(ms / 1000);
  }
  const averageTimeToBookingSeconds = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const serviceCounts = new Map<string, number>();
  for (const appt of appointments) {
    const name = String(appt.serviceName || "Unknown").trim() || "Unknown";
    serviceCounts.set(name, (serviceCounts.get(name) || 0) + 1);
  }
  const mostRequestedServices = [...serviceCounts.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

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
        select: { toolId: true },
        take: 500,
      })
    : [];

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
  let calendarFailures = 0;
  for (const row of failRows) {
    const type = String(typeById.get(String(row.toolId || "")) || "");
    if (/calendar|book_appointment|availability/i.test(type)) calendarFailures += 1;
  }

  const bookingConversationsStarted = calls.length;
  const bookingConversionRate =
    bookingConversationsStarted > 0
      ? Math.round((appointmentsBooked / bookingConversationsStarted) * 1000) / 10
      : 0;

  let previousWindow: AgentMetrics["previousWindow"];
  if (input.includePreviousWindow) {
    const prevCalls = await prisma.voiceCall.findMany({
      where: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        startedAt: { gte: prevSince, lt: since },
      },
      select: { id: true, appointmentBooked: true },
      take: 500,
    });
    const prevBooked = prevCalls.filter(
      (c: { appointmentBooked: boolean }) => c.appointmentBooked,
    ).length;
    previousWindow = {
      callsAnswered: prevCalls.length,
      appointmentsBooked: prevBooked,
      bookingConversionRate:
        prevCalls.length > 0
          ? Math.round((prevBooked / prevCalls.length) * 1000) / 10
          : 0,
    };
  }

  return {
    callsAnswered: calls.length,
    bookingConversationsStarted,
    appointmentsBooked,
    appointmentsRescheduled,
    appointmentsCancelled,
    abandonedBookingConversations,
    averageTimeToBookingSeconds,
    mostRequestedServices,
    bookingConversionRate,
    transfers,
    messagesTaken,
    bookingFailures: toolFails,
    calendarFailures: calendarFailures || toolFails,
    confirmationSmsSent,
    confirmationEmailsSent,
    windowDays,
    previousWindow,
  };
}
