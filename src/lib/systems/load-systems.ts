/**
 * Unified inventory of everything created through solutions, builders, or manual setup.
 */

import { getPrisma } from "@/lib/db";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import {
  getOutcomeSolution,
  outcomeHref,
  outcomeSolutions,
} from "@/lib/outcomes/registry";

export type SystemType =
  | "solution_setup"
  | "ai_agent"
  | "automation"
  | "campaign"
  | "routing";

export type SystemStatus = "active" | "draft" | "paused" | "needs_attention";

export type SystemResource = {
  id: string;
  name: string;
  type: SystemType;
  typeLabel: string;
  createdFrom: string;
  status: SystemStatus;
  statusLabel: string;
  channels: string[];
  phoneNumber: string | null;
  lastActivity: string | null;
  nextAction: string | null;
  warning: string | null;
  href: string;
  children?: SystemResource[];
};

function mapAgentStatus(status: string, health?: string | null): SystemStatus {
  if (health && health !== "ok") return "needs_attention";
  const s = status.toUpperCase();
  if (s === "LIVE" || s === "ACTIVE" || s === "PUBLISHED") return "active";
  if (s === "PAUSED") return "paused";
  return "draft";
}

function mapFlowStatus(status: string): SystemStatus {
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "PAUSED") return "paused";
  if (s === "ERROR" || s === "FAILED") return "needs_attention";
  return "draft";
}

function mapCampaignStatus(status: string): SystemStatus {
  const s = status.toUpperCase();
  if (s === "RUNNING" || s === "ACTIVE" || s === "SCHEDULED") return "active";
  if (s === "PAUSED") return "paused";
  if (s === "FAILED") return "needs_attention";
  return "draft";
}

function statusLabel(status: SystemStatus): string {
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  if (status === "needs_attention") return "Needs Attention";
  return "Draft";
}

function relativeTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function solutionTitleForPurpose(purpose: string | null): string {
  if (!purpose) return "AI Agent";
  const match = outcomeSolutions.find(
    (s) => s.slug === purpose || s.title.toLowerCase() === purpose.toLowerCase(),
  );
  return match?.title || purpose;
}

export async function loadMySystems(
  workspaceId: string,
): Promise<SystemResource[]> {
  const prisma = getPrisma();
  const [agents, flows, campaigns, instancesBySolution] = await Promise.all([
    prisma.voiceAgent.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        phoneAssignments: { take: 1 },
      },
    }),
    prisma.automationFlow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: { startedAt: true, nextActionAt: true, status: true, error: true },
        },
      },
    }),
    prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    loadOutcomeInstances(workspaceId),
  ]);

  const systems: SystemResource[] = [];

  // Packaged solution setups (grouped by outcome slug from agent instances).
  for (const [slug, instances] of Object.entries(instancesBySolution)) {
    const solution = getOutcomeSolution(slug);
    if (!solution || !instances.length) continue;
    const childResources: SystemResource[] = instances.map((inst) => ({
      id: `agent-child-${inst.id}`,
      name: inst.label,
      type: "ai_agent" as const,
      typeLabel: "AI Agent",
      createdFrom: solution.title,
      status: mapAgentStatus(inst.status),
      statusLabel: statusLabel(mapAgentStatus(inst.status)),
      channels: ["Voice"],
      phoneNumber: null,
      lastActivity: null,
      nextAction: null,
      warning: null,
      href: inst.href,
    }));

    const anyPaused = childResources.some((c) => c.status === "paused");
    const anyDraft = childResources.every((c) => c.status === "draft");
    const status: SystemStatus = anyDraft
      ? "draft"
      : anyPaused
        ? "paused"
        : "active";

    systems.push({
      id: `setup-${slug}`,
      name:
        instances.length === 1
          ? instances[0]!.label
          : `${solution.title} (${instances.length})`,
      type: "solution_setup",
      typeLabel: "Solution Setup",
      createdFrom: solution.title,
      status,
      statusLabel: statusLabel(status),
      channels: solution.channels?.length
        ? solution.channels.map((c) =>
            c === "ai-call" ? "AI Voice" : c === "sms" ? "SMS" : "Email",
          )
        : ["Voice"],
      phoneNumber: null,
      lastActivity: null,
      nextAction: null,
      warning: null,
      href: outcomeHref(slug),
      children: childResources,
    });
  }

  const phoneIds = [
    ...new Set(
      agents
        .map(
          (a: { phoneAssignments: Array<{ phoneNumberId: string }>; phoneNumberId: string | null }) =>
            a.phoneAssignments[0]?.phoneNumberId || a.phoneNumberId,
        )
        .filter((id: string | null | undefined): id is string => Boolean(id)),
    ),
  ];
  const phones =
    phoneIds.length > 0
      ? await prisma.phoneNumber.findMany({
          where: { id: { in: phoneIds } },
          select: { id: true, e164: true, friendlyName: true },
        })
      : ([] as Array<{ id: string; e164: string; friendlyName: string | null }>);
  const phoneById = new Map<
    string,
    { id: string; e164: string; friendlyName: string | null }
  >(phones.map((p: { id: string; e164: string; friendlyName: string | null }) => [p.id, p]));

  const coveredAgentIds = new Set(
    Object.values(instancesBySolution)
      .flat()
      .map((i) => i.id),
  );

  for (const agent of agents as Array<{
    id: string;
    name: string;
    displayName: string | null;
    purpose: string | null;
    status: string;
    healthStatus: string | null;
    healthMessage: string | null;
    updatedAt: Date;
    phoneNumberId: string | null;
    phoneAssignments: Array<{ phoneNumberId: string }>;
  }>) {
    if (coveredAgentIds.has(agent.id)) continue;
    const status = mapAgentStatus(agent.status, agent.healthStatus);
    const phoneId =
      agent.phoneAssignments[0]?.phoneNumberId || agent.phoneNumberId || null;
    const phoneRow = phoneId ? phoneById.get(phoneId) : undefined;
    const phone = phoneRow?.e164 || phoneRow?.friendlyName || null;
    systems.push({
      id: `agent-${agent.id}`,
      name: agent.displayName || agent.name,
      type: "ai_agent",
      typeLabel: "AI Agent",
      createdFrom: solutionTitleForPurpose(agent.purpose),
      status,
      statusLabel: statusLabel(status),
      channels: ["Voice"],
      phoneNumber: phone,
      lastActivity: relativeTime(agent.updatedAt),
      nextAction: null,
      warning:
        agent.healthStatus && agent.healthStatus !== "ok"
          ? agent.healthMessage || "Needs attention"
          : null,
      href: `/voice/agents/${agent.id}`,
    });
  }

  for (const flow of flows) {
    const status = mapFlowStatus(flow.status);
    const lastExec = flow.executions[0];
    systems.push({
      id: `flow-${flow.id}`,
      name: flow.name,
      type: "automation",
      typeLabel: "Automation",
      createdFrom: flow.trigger || "Automation",
      status,
      statusLabel: statusLabel(status),
      channels: ["SMS"],
      phoneNumber: null,
      lastActivity: relativeTime(lastExec?.startedAt || flow.updatedAt),
      nextAction: lastExec?.nextActionAt
        ? new Date(lastExec.nextActionAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null,
      warning: lastExec?.error || null,
      href: `/automations/${flow.id}`,
    });
  }

  for (const campaign of campaigns) {
    const status = mapCampaignStatus(campaign.status);
    systems.push({
      id: `campaign-${campaign.id}`,
      name: campaign.name,
      type: "campaign",
      typeLabel: "Campaign",
      createdFrom: campaign.category || campaign.type || "Campaign",
      status,
      statusLabel: statusLabel(status),
      channels: [campaign.type?.toUpperCase() === "EMAIL" ? "Email" : "SMS"],
      phoneNumber: null,
      lastActivity: relativeTime(campaign.createdAt),
      nextAction: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null,
      warning: null,
      href: `/campaigns/${campaign.id}`,
    });
  }

  return systems;
}
