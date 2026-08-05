/**
 * AgentDeployment — connects Agents ↔ Numbers under a routing condition.
 *
 * Agents do the work. Numbers receive the communication. Deployments connect them.
 * Voice forwarding from a customer public number does NOT move SMS.
 */

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import {
  agentTypeFromOutcomeSlug,
  agentTypeLabel,
  getAgentType,
  outcomeSlugFromAgentType,
} from "@/lib/agents/types";
import { outcomeSlugFromSetup } from "@/lib/outcomes/instances";

export type DeploymentChannel = "voice" | "sms";
export type DeploymentRoutingMode = "test" | "live" | "paused";
export type DeploymentStatus = "draft" | "test" | "live" | "paused" | "error";
export type DeploymentScheduleKey =
  | "always"
  | "every_call"
  | "after_hours"
  | "nobody_answers"
  | "line_busy"
  | "missed_call"
  | "custom";

export type UpsertDeploymentInput = {
  workspaceId: string;
  agentId?: string | null;
  solutionSetupId?: string | null;
  phoneNumberId?: string | null;
  externalNumberId?: string | null;
  channel: DeploymentChannel;
  routingMode?: DeploymentRoutingMode;
  scheduleKey?: DeploymentScheduleKey | string;
  status?: DeploymentStatus;
  errorMessage?: string | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

export function scheduleKeyFromAnswerWhen(
  answerWhen?: string | null,
): DeploymentScheduleKey {
  switch (answerWhen) {
    case "every_call":
      return "every_call";
    case "after_hours":
    case "custom_schedule":
      return "after_hours";
    case "nobody_answers":
      return "nobody_answers";
    case "line_busy":
      return "line_busy";
    default:
      return "always";
  }
}

export function scheduleLabel(key: string | null | undefined): string {
  switch (key) {
    case "every_call":
      return "Every inbound call";
    case "after_hours":
      return "After hours";
    case "nobody_answers":
      return "When nobody answers";
    case "line_busy":
      return "When the line is busy";
    case "missed_call":
      return "On missed / abandoned call";
    case "always":
      return "Always";
    default:
      return key || "Always";
  }
}

/**
 * Idempotent upsert for one agent+channel+schedule on a workspace.
 * Prefer matching existing row by agentId/channel/scheduleKey (or setupId).
 */
export async function upsertAgentDeployment(
  input: UpsertDeploymentInput,
): Promise<{ id: string; created: boolean }> {
  const prisma = getPrisma();
  const now = new Date();
  const routingMode = input.routingMode || "test";
  const scheduleKey = input.scheduleKey || "always";
  const status =
    input.status ||
    (routingMode === "live" ? "live" : routingMode === "paused" ? "paused" : "test");

  const existing = await prisma.agentDeployment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      channel: input.channel,
      scheduleKey,
      ...(input.agentId
        ? { agentId: input.agentId }
        : input.solutionSetupId
          ? { solutionSetupId: input.solutionSetupId }
          : { id: "__none__" }),
    },
  });

  if (existing) {
    await prisma.agentDeployment.update({
      where: { id: existing.id },
      data: {
        phoneNumberId: input.phoneNumberId ?? existing.phoneNumberId,
        externalNumberId: input.externalNumberId ?? existing.externalNumberId,
        agentId: input.agentId ?? existing.agentId,
        solutionSetupId: input.solutionSetupId ?? existing.solutionSetupId,
        routingMode,
        status,
        errorMessage: input.errorMessage ?? null,
        deployedAt:
          status === "live" ? existing.deployedAt || now : existing.deployedAt,
        updatedAt: now,
      },
    });
    return { id: existing.id, created: false };
  }

  const id = createId();
  await prisma.agentDeployment.create({
    data: {
      id,
      workspaceId: input.workspaceId,
      agentId: input.agentId || null,
      solutionSetupId: input.solutionSetupId || null,
      phoneNumberId: input.phoneNumberId || null,
      externalNumberId: input.externalNumberId || null,
      channel: input.channel,
      routingMode,
      scheduleKey,
      status,
      errorMessage: input.errorMessage || null,
      deployedAt: status === "live" ? now : null,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { id, created: true };
}

/** Sync deployments from current VoiceAgent.phoneNumberId / SolutionSetup links. */
export async function syncDeploymentsFromLegacyLinks(
  workspaceId: string,
): Promise<number> {
  const prisma = getPrisma();
  let touched = 0;

  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, archivedAt: null, phoneNumberId: { not: null } },
    select: {
      id: true,
      status: true,
      agentType: true,
      phoneNumberId: true,
      sourceSolutionSetupId: true,
      draftConfig: true,
    },
  });

  for (const agent of agents) {
    if (!agent.phoneNumberId) continue;
    const cfg = asRecord(agent.draftConfig);
    const advanced = asRecord(cfg?.advanced);
    const snap = asRecord(advanced?.appointmentReceptionistWizard);
    const answerWhen =
      (typeof snap?.answerWhen === "string" && snap.answerWhen) ||
      (typeof cfg?.answerWhen === "string" && cfg.answerWhen) ||
      null;
    const live = agent.status === "ACTIVE" || agent.status === "PUBLISHED";
    await upsertAgentDeployment({
      workspaceId,
      agentId: agent.id,
      solutionSetupId: agent.sourceSolutionSetupId,
      phoneNumberId: agent.phoneNumberId,
      channel: "voice",
      routingMode: live ? "live" : "test",
      scheduleKey: scheduleKeyFromAnswerWhen(answerWhen),
      status: live ? "live" : agent.status === "DRAFT" ? "draft" : "test",
    });
    touched += 1;
  }

  const setups = await prisma.solutionSetup.findMany({
    where: { workspaceId, solutionType: "missed-call-text-back" },
    select: {
      id: true,
      status: true,
      linkedPhoneNumberIds: true,
      configJson: true,
    },
  });
  for (const setup of setups) {
    const phoneId = (setup.linkedPhoneNumberIds || [])[0];
    if (!phoneId) continue;
    const live = setup.status === "ACTIVE" || setup.status === "LIVE";
    await upsertAgentDeployment({
      workspaceId,
      solutionSetupId: setup.id,
      phoneNumberId: phoneId,
      channel: "sms",
      routingMode: live ? "live" : "test",
      scheduleKey: "missed_call",
      status: live ? "live" : "draft",
    });
    touched += 1;
  }

  return touched;
}

export type DeploymentSummary = {
  id: string;
  channel: DeploymentChannel;
  routingMode: string;
  scheduleKey: string;
  scheduleLabel: string;
  status: string;
  agentId: string | null;
  agentName: string | null;
  agentType: string | null;
  agentTypeLabel: string | null;
  solutionSetupId: string | null;
  phoneNumberId: string | null;
  phoneE164: string | null;
  externalNumberId: string | null;
  externalE164: string | null;
  href: string;
};

export async function listDeploymentsForWorkspace(
  workspaceId: string,
): Promise<DeploymentSummary[]> {
  const prisma = getPrisma();
  await syncDeploymentsFromLegacyLinks(workspaceId).catch(() => 0);

  const rows = await prisma.agentDeployment.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      agent: {
        select: {
          id: true,
          name: true,
          displayName: true,
          agentType: true,
        },
      },
      phoneNumber: { select: { id: true, e164: true, friendlyName: true } },
      externalNumber: { select: { id: true, e164: true, displayName: true } },
    },
  });

  return rows.map((row: (typeof rows)[number]) => {
    const typeId =
      row.agent?.agentType ||
      (row.solutionSetupId ? "missed_call_text_back" : "custom");
    const typeLabel = agentTypeLabel(typeId);
    const href = row.agentId
      ? `/voice/agents/${row.agentId}`
      : row.solutionSetupId
        ? `/solutions/missed-call-text-back/setup?setupId=${row.solutionSetupId}`
        : "/systems";
    return {
      id: row.id,
      channel: row.channel as DeploymentChannel,
      routingMode: row.routingMode,
      scheduleKey: row.scheduleKey,
      scheduleLabel: scheduleLabel(row.scheduleKey),
      status: row.status,
      agentId: row.agentId,
      agentName: row.agent?.displayName || row.agent?.name || null,
      agentType: typeId,
      agentTypeLabel: typeLabel,
      solutionSetupId: row.solutionSetupId,
      phoneNumberId: row.phoneNumberId,
      phoneE164: row.phoneNumber?.e164 || null,
      externalNumberId: row.externalNumberId,
      externalE164: row.externalNumber?.e164 || null,
      href,
    };
  });
}

export function deploymentStatusLabel(status: string): string {
  if (status === "live") return "Live";
  if (status === "test") return "Test";
  if (status === "paused") return "Paused";
  if (status === "error") return "Error";
  return "Draft";
}

/** Resolve product type label for an agent using type field first. */
export function resolveAgentProductLabel(agent: {
  agentType?: string | null;
  purpose?: string | null;
}): string {
  if (agent.agentType) {
    const def = getAgentType(agent.agentType);
    if (def.id !== "custom") return def.label;
    const slug = outcomeSlugFromAgentType(agent.agentType);
    if (slug) return agentTypeLabel(agentTypeFromOutcomeSlug(slug));
  }
  return agentTypeLabel("custom");
}

export function resolveSetupProductLabel(setup: {
  solutionType: string;
  configJson?: unknown;
}): string {
  const slug = outcomeSlugFromSetup(setup);
  return agentTypeLabel(agentTypeFromOutcomeSlug(slug));
}
