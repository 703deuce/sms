/**
 * Agent health — aggregates real dependencies (Telnyx, number, calendar, workflow).
 */

import { getPrisma } from "@/lib/db";
import { getRegistrationByWorkspace } from "@/lib/messaging/store";
import { isMessagingReady } from "@/lib/messaging/status";
import type {
  AgentHealth,
  HealthCheck,
  HealthLevel,
} from "@/lib/agents/appointment-booking/types";

function check(
  status: HealthLevel,
  message: string,
  required: boolean,
): HealthCheck {
  return {
    status,
    message,
    required,
    checkedAt: new Date().toISOString(),
  };
}

function worst(...levels: HealthLevel[]): HealthLevel {
  const order: HealthLevel[] = ["failed", "warning", "degraded", "unknown", "healthy"];
  for (const level of order) {
    if (levels.includes(level)) return level;
  }
  return "unknown";
}

export async function buildAgentHealth(input: {
  workspaceId: string;
  agentId: string;
  telnyxAssistantId?: string | null;
  phoneNumberId?: string | null;
  linkedPhoneNumberIds?: string[];
  linkedCalendarIds?: string[];
  primaryFlowId?: string | null;
  agentHealthStatus?: string | null;
  agentHealthMessage?: string | null;
  sendSmsConfirmation?: boolean;
}): Promise<AgentHealth> {
  const prisma = getPrisma();
  const now = new Date().toISOString();

  const phoneIds = [
    ...(input.phoneNumberId ? [input.phoneNumberId] : []),
    ...(input.linkedPhoneNumberIds || []),
  ].filter(Boolean);

  const [phone, calendars, flow, deployment, reg] = await Promise.all([
    phoneIds[0]
      ? prisma.phoneNumber.findFirst({
          where: { id: phoneIds[0], workspaceId: input.workspaceId },
        })
      : Promise.resolve(null),
    (input.linkedCalendarIds || []).length
      ? prisma.voiceCalendarConnection.findMany({
          where: {
            workspaceId: input.workspaceId,
            id: { in: input.linkedCalendarIds },
          },
        })
      : prisma.voiceCalendarConnection.findMany({
          where: { workspaceId: input.workspaceId },
          take: 5,
        }),
    input.primaryFlowId
      ? prisma.automationFlow.findFirst({
          where: { id: input.primaryFlowId, workspaceId: input.workspaceId },
        })
      : Promise.resolve(null),
    input.primaryFlowId
      ? prisma.triggerDeployment.findFirst({
          where: {
            workspaceId: input.workspaceId,
            flowId: input.primaryFlowId,
          },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve(null),
    getRegistrationByWorkspace(input.workspaceId).catch(() => null),
  ]);

  const messagingReady = isMessagingReady(reg);

  const telnyxAssistant = input.telnyxAssistantId
    ? check("healthy", `Assistant ${input.telnyxAssistantId}`, true)
    : check("failed", "Telnyx assistant is not linked", true);

  const assignedNumber = phone
    ? check(
        String(phone.status) === "Active" ? "healthy" : "warning",
        `${phone.e164} (${phone.status})`,
        true,
      )
    : check("failed", "No phone number assigned", true);

  const liveCal = (calendars || []).find(
    (c: { status: string }) => String(c.status).toLowerCase() === "connected",
  );
  const calendar = liveCal
    ? check("healthy", `${liveCal.name} · ${liveCal.provider}`, true)
    : (calendars || []).length
      ? check("warning", "Calendar present but not connected", true)
      : check("failed", "No calendar connection", true);

  const bookingTools = input.telnyxAssistantId
    ? check("healthy", "Booking tools deploy with the Telnyx assistant", true)
    : check(
        "warning",
        "Booking tools unavailable until assistant is published",
        true,
      );

  const transferTargets = check(
    "healthy",
    "Transfer targets follow agent call-handling settings",
    false,
  );

  const smsConfirmation = input.sendSmsConfirmation
    ? messagingReady
      ? check("healthy", "SMS confirmation ready", false)
      : check(
          "degraded",
          "SMS confirmation enabled but messaging is not ready",
          false,
        )
    : check("healthy", "SMS confirmation disabled", false);

  const webhookEndpoint = check(
    "healthy",
    "Voice webhooks served at /api/telnyx/voice",
    true,
  );

  const deployStatus = String(deployment?.status || "").toLowerCase();
  const latestDeployment =
    deployStatus === "live"
      ? check("healthy", "Trigger deployment live", true)
      : deployStatus === "test"
        ? check("warning", "Trigger deployment in test mode", true)
        : deployment
          ? check("warning", `Deployment status: ${deployment.status}`, true)
          : check("failed", "No trigger deployment", true);

  const primaryWorkflow = flow
    ? String(flow.status) === "ACTIVE"
      ? check("healthy", `${flow.name} · ACTIVE`, true)
      : check("warning", `${flow.name} · ${flow.status}`, true)
    : check("failed", "No primary workflow linked", true);

  const agentSelf =
    input.agentHealthStatus && input.agentHealthStatus !== "ok"
      ? check(
          "warning",
          input.agentHealthMessage || `Agent health: ${input.agentHealthStatus}`,
          true,
        )
      : null;

  const requiredStatuses = [
    telnyxAssistant.status,
    assignedNumber.status,
    calendar.status,
    bookingTools.status,
    latestDeployment.status,
    primaryWorkflow.status,
    ...(agentSelf ? [agentSelf.status] : []),
  ];

  let overall = worst(...requiredStatuses);
  if (overall === "healthy" && smsConfirmation.status === "degraded") {
    overall = "degraded";
  }

  return {
    overall,
    telnyxAssistant,
    assignedNumber,
    calendar,
    bookingTools,
    transferTargets,
    smsConfirmation,
    webhookEndpoint,
    latestDeployment,
    primaryWorkflow,
    lastCheckedAt: now,
  };
}
