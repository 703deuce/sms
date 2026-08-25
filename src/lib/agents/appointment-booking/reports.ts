/**
 * Daily / exception reports for Appointment Booking Agent.
 */

import { getPrisma } from "@/lib/db";
import { loadAppointmentBookingAgent } from "@/lib/agents/appointment-booking/load-agent";
import { buildAgentMetrics } from "@/lib/agents/appointment-booking/metrics";
import { searchAgentActivity } from "@/lib/agents/appointment-booking/execution-trace";

export async function buildAgentDailyReport(input: {
  workspaceId: string;
  agentId: string;
}) {
  const agent = await loadAppointmentBookingAgent(
    input.workspaceId,
    input.agentId,
  );
  if (!agent) throw new Error("Agent not found");

  const metrics = await buildAgentMetrics({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    windowDays: 1,
  });
  const failures = await searchAgentActivity({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    limit: 10,
    failuresOnly: true,
  });

  const recommendations: string[] = [];
  if (metrics.bookingConversionRate < 40 && metrics.callsAnswered >= 5) {
    recommendations.push(
      "Booking conversion is below 40% today — review unavailable-slot offers and required fields.",
    );
  }
  if (metrics.calendarFailures > 0) {
    recommendations.push(
      `${metrics.calendarFailures} calendar/tool failures — check calendar authorization.`,
    );
  }
  if (agent.health.smsConfirmation.status === "degraded") {
    recommendations.push(
      "Confirmation SMS is degraded — booking can continue but confirmations may not send.",
    );
  }
  if (agent.health.overall === "failed" || agent.health.overall === "warning") {
    recommendations.push(`Health is ${agent.health.overall}: ${agent.health.calendar.message}`);
  }

  return {
    agentId: agent.identity.id,
    name: agent.identity.displayName,
    generatedAt: new Date().toISOString(),
    window: "last_24_hours",
    workCompleted: {
      callsAnswered: metrics.callsAnswered,
      appointmentsBooked: metrics.appointmentsBooked,
      transfers: metrics.transfers,
      messagesTaken: metrics.messagesTaken,
      confirmationSmsSent: metrics.confirmationSmsSent,
    },
    unresolved: failures.slice(0, 5).map((f) => ({
      callId: f.callId,
      summary: f.summary,
      outcome: f.outcome,
    })),
    failures: metrics.bookingFailures,
    health: agent.health.overall,
    recommendations,
  };
}

export async function buildAgentExceptionAlerts(input: {
  workspaceId: string;
  agentId: string;
}) {
  const agent = await loadAppointmentBookingAgent(
    input.workspaceId,
    input.agentId,
  );
  if (!agent) throw new Error("Agent not found");
  const alerts: Array<{ severity: "critical" | "high"; message: string }> = [];

  if (agent.health.assignedNumber.status === "failed") {
    alerts.push({
      severity: "critical",
      message: "Main job unavailable: no healthy assigned number",
    });
  }
  if (agent.health.calendar.status === "failed") {
    alerts.push({
      severity: "critical",
      message: "Calendar unavailable — cannot confirm appointments",
    });
  }
  if (agent.health.telnyxAssistant.status === "failed") {
    alerts.push({
      severity: "critical",
      message: "Telnyx assistant not linked",
    });
  }
  if (agent.health.smsConfirmation.status === "degraded") {
    alerts.push({
      severity: "high",
      message: "Confirmation SMS degraded",
    });
  }

  const prisma = getPrisma();
  const row = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId },
    select: { draftConfig: true },
  });
  const pauses =
    row?.draftConfig &&
    typeof row.draftConfig === "object" &&
    (row.draftConfig as {
      advanced?: { agentOperating?: { capabilityPauses?: unknown } };
    }).advanced?.agentOperating?.capabilityPauses;
  if (pauses && typeof pauses === "object") {
    const p = pauses as Record<string, unknown>;
    if (p.confirmationSms) {
      alerts.push({
        severity: "high",
        message: `Confirmation SMS paused: ${String(p.reason || "auto-repair")}`,
      });
    }
    if (p.booking) {
      alerts.push({
        severity: "critical",
        message: `Booking capability paused: ${String(p.reason || "")}`,
      });
    }
  }

  return { alerts, shouldNotifyOwner: alerts.some((a) => a.severity === "critical") };
}
