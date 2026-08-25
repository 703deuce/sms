/**
 * Load the customer-facing Appointment Booking Agent view from VoiceAgent.
 */

import { getPrisma } from "@/lib/db";
import { getAgentType } from "@/lib/agents/types";
import { loadBusinessBrain } from "@/lib/agents/appointment-booking/business-brain";
import {
  buildAppointmentAgentProfile,
  extractBookingPolicyFromConfig,
} from "@/lib/agents/appointment-booking/profile";
import { buildAgentHealth } from "@/lib/agents/appointment-booking/health";
import { buildAgentMetrics } from "@/lib/agents/appointment-booking/metrics";
import { buildLiveReadiness } from "@/lib/agents/appointment-booking/readiness";
import { resolveAgentIdentity } from "@/lib/agents/appointment-booking/identity";
import { budgetToMode } from "@/lib/agents/appointment-booking/autonomy-policy";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import {
  APPOINTMENT_BOOKING_ROLE,
  type AgentIdentity,
  type AgentProductStatus,
  type AppointmentBookingAgentView,
} from "@/lib/agents/appointment-booking/types";

function mapProductStatus(
  status: string,
  healthOverall: string,
): AgentProductStatus {
  if (healthOverall === "failed") return "needs_attention";
  if (healthOverall === "warning" || healthOverall === "degraded") {
    if (String(status).toUpperCase() === "ACTIVE") return "needs_attention";
  }
  switch (String(status).toUpperCase()) {
    case "ACTIVE":
    case "LIVE":
    case "PUBLISHED":
      return "active";
    case "PAUSED":
      return "paused";
    case "TESTING":
      return "testing";
    case "ARCHIVED":
      return "archived";
    case "CONFIGURATION_ERROR":
    case "FAILED":
      return "failed";
    case "DRAFT":
    default:
      return "draft";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isAppointmentBookingAgent(agent: {
  agentType?: string | null;
}): boolean {
  const type = getAgentType(String(agent.agentType || "custom"));
  return type.id === "appointment_booking" || type.family === "receptionist";
}

export async function loadAppointmentBookingAgent(
  workspaceId: string,
  agentId: string,
): Promise<AppointmentBookingAgentView | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) return null;

  const type = getAgentType(String(agent.agentType || "custom"));
  const allowed =
    type.id === "appointment_booking" ||
    type.id === "receptionist" ||
    String(agent.agentType || "") === "appointment_receptionist";
  if (!allowed) return null;

  const phoneIds = [
    ...(agent.phoneNumberId ? [agent.phoneNumberId] : []),
    ...((agent.linkedPhoneNumberIds as string[]) || []),
  ].filter(Boolean);

  const [phone, calendars, flow, versions] = await Promise.all([
    phoneIds[0]
      ? prisma.phoneNumber.findFirst({
          where: { id: phoneIds[0], workspaceId },
        })
      : Promise.resolve(null),
    (agent.linkedCalendarIds as string[])?.length
      ? prisma.voiceCalendarConnection.findMany({
          where: {
            workspaceId,
            id: { in: agent.linkedCalendarIds as string[] },
          },
        })
      : prisma.voiceCalendarConnection.findMany({
          where: { workspaceId },
          take: 3,
        }),
    agent.primaryFlowId
      ? prisma.automationFlow.findFirst({
          where: { id: agent.primaryFlowId, workspaceId },
        })
      : Promise.resolve(null),
    prisma.voiceAgentVersion.findMany({
      where: { agentId: agent.id, workspaceId },
      orderBy: { version: "desc" },
      take: 20,
    }),
  ]);

  const bookingPolicy = extractBookingPolicyFromConfig(agent.draftConfig);
  const profile = buildAppointmentAgentProfile({
    agentId: agent.id,
    draftConfig: agent.draftConfig,
    calendarConnectionIds: (calendars || []).map((c: { id: string }) => c.id),
  });
  const businessBrain = await loadBusinessBrain(workspaceId, {
    agentId: agent.id,
    draftConfig: agent.draftConfig,
  });
  const health = await buildAgentHealth({
    workspaceId,
    agentId: agent.id,
    telnyxAssistantId: agent.telnyxAssistantId,
    phoneNumberId: agent.phoneNumberId,
    linkedPhoneNumberIds: agent.linkedPhoneNumberIds as string[],
    linkedCalendarIds: agent.linkedCalendarIds as string[],
    primaryFlowId: agent.primaryFlowId,
    agentHealthStatus: agent.healthStatus,
    agentHealthMessage: agent.healthMessage,
    sendSmsConfirmation: bookingPolicy.sendSmsConfirmation,
  });
  const metrics = await buildAgentMetrics({
    workspaceId,
    agentId: agent.id,
    windowDays: 7,
    includePreviousWindow: true,
  });

  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = asRecord(asRecord(config.advanced).agentOperating);
  const identityFields = asRecord(op.identity);
  const resolved = resolveAgentIdentity({
    name: agent.name,
    displayName: agent.displayName,
    description: agent.description,
    purpose: agent.purpose,
    customerFacingName: identityFields.customerFacingName as string | undefined,
    pronouns: identityFields.pronouns as
      | { subject?: string; object?: string; possessive?: string }
      | undefined,
    avatarId: (identityFields.avatarId as string) || undefined,
    roleLabel: (identityFields.roleLabel as string) || undefined,
  });

  const productStatus = mapProductStatus(String(agent.status), health.overall);
  const identity: AgentIdentity = {
    id: agent.id,
    workspaceId,
    name: resolved.name,
    displayName: resolved.displayName,
    role: APPOINTMENT_BOOKING_ROLE,
    roleLabel: resolved.roleLabel,
    channel: "voice",
    description: resolved.description,
    customerFacingName: resolved.customerFacingName,
    pronouns: resolved.pronouns,
    avatarId: resolved.avatarId,
    status: productStatus,
  };

  const autonomyMode = budgetToMode(
    String(op.autonomyBudget || "standard") as "conservative" | "standard" | "high",
  );

  const readiness = await buildLiveReadiness({
    workspaceId,
    agentStatus: productStatus,
    health,
    telnyxAssistantId: agent.telnyxAssistantId,
    phoneNumberE164: phone?.e164 || null,
    calendarConnectionIds: (calendars || []).map((c: { id: string }) => c.id),
    primaryFlowId: agent.primaryFlowId,
    currentVersionId: agent.publishedVersionId,
  });

  const automationFlowIds = [
    ...(agent.primaryFlowId ? [agent.primaryFlowId] : []),
    ...((agent.linkedAutomationIds as string[]) || []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  return {
    identity,
    voiceAgentId: agent.id,
    telnyxAssistantId: agent.telnyxAssistantId,
    solutionSetupId: agent.sourceSolutionSetupId,
    primaryFlowId: agent.primaryFlowId,
    phoneNumberIds: phoneIds,
    phoneNumberE164: phone?.e164 || null,
    calendarConnectionIds: (calendars || []).map((c: { id: string }) => c.id),
    automationFlowIds,
    executionMode: "conversational_with_deterministic_tools",
    profile,
    bookingPolicy,
    businessBrain,
    health,
    metrics,
    readiness,
    autonomyMode,
    currentVersionId: agent.publishedVersionId,
    versions: versions.map(
      (v: {
        id: string;
        version: number;
        changeLog?: string | null;
        publishedAt: Date;
        isMain: boolean;
        deploymentStatus?: string | null;
        testStatus?: string | null;
      }) => ({
        id: v.id,
        version: v.version,
        changeLog: v.changeLog,
        publishedAt: new Date(v.publishedAt).toISOString(),
        isMain: v.isMain,
        deploymentStatus: v.deploymentStatus,
        testStatus: v.testStatus,
      }),
    ),
    resources: {
      numberLabel: phone?.e164 || "Not assigned",
      calendarLabel: calendars?.[0]
        ? `${calendars[0].name} (${calendars[0].provider})`
        : "Not connected",
      workflowLabel: flow?.name || "No primary workflow",
      locationLabel: businessBrain.locations[0]?.name || "Primary location",
    },
    createdAt: new Date(agent.createdAt).toISOString(),
    updatedAt: new Date(agent.updatedAt).toISOString(),
  };
}
