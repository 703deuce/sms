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
    ? await prisma.voiceAppointment.count({
        where: {
          workspaceId: input.workspaceId,
          createdAt: { gte: since },
          callId: { in: callIds },
        },
      })
    : 0;

  const toolFails = callIds.length
    ? await prisma.voiceToolExecution.count({
        where: {
          workspaceId: input.workspaceId,
          callId: { in: callIds },
          status: { in: ["failed", "error", "FAILED"] },
        },
      })
    : 0;

  const appointmentsBooked = Math.max(bookedCalls, appointments);
  const bookingConversationsStarted = calls.length;
  const bookingConversionRate =
    bookingConversationsStarted > 0
      ? Math.round((appointmentsBooked / bookingConversationsStarted) * 1000) / 10
      : 0;

  return {
    callsAnswered: calls.length,
    bookingConversationsStarted,
    appointmentsBooked,
    bookingConversionRate,
    transfers,
    messagesTaken,
    bookingFailures: toolFails,
    calendarFailures: toolFails,
    windowDays,
  };
}
