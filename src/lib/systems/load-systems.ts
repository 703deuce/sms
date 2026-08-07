/**
 * Unified inventory of everything created through solutions, builders, or manual setup.
 * Prefers real SolutionSetup links when present.
 */

import { getPrisma } from "@/lib/db";
import {
  getOutcomeSolution,
  outcomeHref,
  outcomeSolutions,
} from "@/lib/outcomes/registry";
import {
  agentTypeFromOutcomeSlug,
  agentTypeLabel as catalogAgentTypeLabel,
  capabilityLabel,
  getAgentType,
} from "@/lib/agents/types";
import {
  resolvePrimaryFlowId,
  workflowEditHref,
} from "@/lib/agents/workflows";

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
  /** Product type e.g. "Appointment Booking Agent". */
  agentType: string;
  /** Canonical agent type id e.g. appointment_booking. */
  agentTypeId: string;
  createdFrom: string;
  status: SystemStatus;
  statusLabel: string;
  channels: string[];
  phoneNumber: string | null;
  lastActivity: string | null;
  nextAction: string | null;
  warning: string | null;
  href: string;
  /** Direct link into the visual workflow builder for this agent. */
  workflowHref?: string | null;
  /** Primary workflow id for diagnostics / activate. */
  primaryFlowId?: string | null;
  primaryFlowName?: string | null;
  /** TriggerDeployment status: draft | test | live | paused | error */
  deploymentStatus?: string | null;
  lastExecutionStatus?: string | null;
  /** Capability toggles (booking, transfers, …) — not used for ownership. */
  capabilities?: string[];
  /** What this agent handles, e.g. "Every call", "After hours". */
  handles?: string | null;
  children?: SystemResource[];
};

function mapStatus(status: string, health?: string | null): SystemStatus {
  if (health && health !== "ok") return "needs_attention";
  const s = status.toUpperCase();
  if (s === "LIVE" || s === "ACTIVE" || s === "PUBLISHED" || s === "RUNNING" || s === "SCHEDULED")
    return "active";
  if (s === "PAUSED") return "paused";
  if (s === "ERROR" || s === "FAILED" || s === "NEEDS_ATTENTION" || s === "CONFIGURATION_ERROR")
    return "needs_attention";
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

function solutionTitle(slug: string): string {
  if (slug === "appointment-receptionist") return "AI Receptionist";
  if (slug === "missed-call-text-back") return "Missed Call Text Back";
  return getOutcomeSolution(slug)?.title || slug;
}

/** Human label for the agent product type. */
function agentTypeLabel(outcomeSlug: string, solutionType: string): string {
  const typeId = agentTypeFromOutcomeSlug(
    outcomeSlug !== solutionType || getOutcomeSolution(outcomeSlug)
      ? outcomeSlug
      : solutionType === "appointment-receptionist"
        ? "appointment-booking"
        : solutionType,
  );
  const catalog = catalogAgentTypeLabel(typeId);
  if (catalog && catalog !== "Custom Agent") return catalog;
  const fromOutcome = solutionTitle(outcomeSlug);
  if (fromOutcome && fromOutcome !== outcomeSlug) return fromOutcome;
  return solutionTitle(solutionType);
}

function answerWhenLabel(answerWhen: string | null | undefined): string | null {
  switch (answerWhen) {
    case "every_call":
      return "Every call";
    case "nobody_answers":
      return "When nobody answers";
    case "line_busy":
      return "When the line is busy";
    case "after_hours":
      return "After hours";
    case "custom_schedule":
      return "Custom schedule";
    default:
      return answerWhen || null;
  }
}

function readCapabilities(configJson: unknown, draftConfig?: unknown): string[] {
  const sources = [configJson, draftConfig];
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    const obj = src as Record<string, unknown>;
    const caps = obj.capabilities;
    if (Array.isArray(caps)) {
      return caps
        .filter((c): c is string => typeof c === "string")
        .map((c) => capabilityLabel(c));
    }
    const wizard = obj.wizard;
    if (wizard && typeof wizard === "object") {
      const wCaps = (wizard as { capabilities?: unknown }).capabilities;
      if (Array.isArray(wCaps)) {
        return wCaps
          .filter((c): c is string => typeof c === "string")
          .map((c) => capabilityLabel(c));
      }
    }
  }
  return [];
}

function readAnswerWhen(configJson: unknown, draftConfig?: unknown): string | null {
  for (const src of [configJson, draftConfig]) {
    if (!src || typeof src !== "object") continue;
    const obj = src as Record<string, unknown>;
    if (typeof obj.answerWhen === "string") return obj.answerWhen;
    const wizard = obj.wizard;
    if (wizard && typeof wizard === "object") {
      const aw = (wizard as { answerWhen?: unknown }).answerWhen;
      if (typeof aw === "string") return aw;
    }
  }
  return null;
}

export async function loadMySystems(
  workspaceId: string,
): Promise<SystemResource[]> {
  const prisma = getPrisma();
  const [setups, agents, flows, campaigns, routingRules, phones, deployments] =
    await Promise.all([
      prisma.solutionSetup.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.voiceAgent.findMany({
        where: { workspaceId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.automationFlow.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: {
          executions: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: {
              startedAt: true,
              nextActionAt: true,
              status: true,
              error: true,
            },
          },
        },
      }),
      prisma.campaign.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.voiceRoutingRule.findMany({
        where: { workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.phoneNumber.findMany({
        where: { workspaceId },
        select: { id: true, e164: true, friendlyName: true },
      }),
      prisma.triggerDeployment
        .findMany({
          where: { workspaceId },
          orderBy: { updatedAt: "desc" },
          take: 200,
          select: {
            id: true,
            flowId: true,
            status: true,
            phoneNumberId: true,
            errorMessage: true,
            updatedAt: true,
          },
        })
        .catch(() => []),
    ]);

  const phoneById = new Map(
    phones.map((p: { id: string; e164: string; friendlyName: string | null }) => [
      p.id,
      p,
    ]),
  );
  const agentById = new Map(agents.map((a: { id: string }) => [a.id, a]));
  const flowById = new Map(flows.map((f: { id: string }) => [f.id, f]));
  const campaignById = new Map(campaigns.map((c: { id: string }) => [c.id, c]));
  const ruleById = new Map(routingRules.map((r: { id: string }) => [r.id, r]));
  const deploymentByFlowId = new Map<
    string,
    {
      id: string;
      flowId: string;
      status: string;
      phoneNumberId: string | null;
      errorMessage: string | null;
    }
  >();
  for (const d of deployments as Array<{
    id: string;
    flowId: string;
    status: string;
    phoneNumberId: string | null;
    errorMessage: string | null;
  }>) {
    if (!deploymentByFlowId.has(d.flowId)) deploymentByFlowId.set(d.flowId, d);
  }

  const linkedAgentIds = new Set<string>();
  const linkedFlowIds = new Set<string>();
  const linkedCampaignIds = new Set<string>();
  const linkedRuleIds = new Set<string>();

  const systems: SystemResource[] = [];

  for (const setup of setups as Array<{
    id: string;
    name: string;
    solutionType: string;
    status: string;
    updatedAt: Date;
    configJson?: unknown;
    linkedAgentIds: string[];
    linkedAutomationIds: string[];
    linkedCampaignIds: string[];
    linkedPhoneNumberIds: string[];
    linkedRoutingRuleIds: string[];
    primaryFlowId?: string | null;
  }>) {
    const cfgJson = (setup as { configJson?: unknown }).configJson as
      | { outcomeSlug?: string }
      | null
      | undefined;
    const outcomeSlugForLabel =
      setup.solutionType === "appointment-receptionist" && cfgJson?.outcomeSlug
        ? cfgJson.outcomeSlug
        : setup.solutionType;

    const solution = getOutcomeSolution(outcomeSlugForLabel);
    const channels = solution?.channels?.length
      ? solution.channels.map((c) =>
          c === "ai-call" ? "AI Voice" : c === "sms" ? "SMS" : "Email",
        )
      : setup.solutionType === "appointment-receptionist"
        ? ["AI Voice"]
        : ["SMS"];

    const children: SystemResource[] = [];

    for (const agentId of setup.linkedAgentIds || []) {
      linkedAgentIds.add(agentId);
      const agent = agentById.get(agentId) as
        | {
            id: string;
            name: string;
            displayName: string | null;
            status: string;
            healthStatus: string | null;
            healthMessage: string | null;
            updatedAt: Date;
            phoneNumberId: string | null;
          }
        | undefined;
      if (!agent) continue;
      const phone = agent.phoneNumberId
        ? phoneById.get(agent.phoneNumberId)
        : null;
      children.push({
        id: `agent-${agent.id}`,
        name: agent.displayName || agent.name,
        type: "ai_agent",
        typeLabel: "Voice Agent",
        agentType: agentTypeLabel(outcomeSlugForLabel, setup.solutionType),
        agentTypeId: agentTypeFromOutcomeSlug(outcomeSlugForLabel),
        createdFrom: agentTypeLabel(outcomeSlugForLabel, setup.solutionType),
        status: mapStatus(agent.status, agent.healthStatus),
        statusLabel: statusLabel(mapStatus(agent.status, agent.healthStatus)),
        channels: ["Voice"],
        phoneNumber:
          (phone as { e164?: string; friendlyName?: string | null } | undefined)
            ?.e164 ||
          (phone as { friendlyName?: string | null } | undefined)?.friendlyName ||
          null,
        lastActivity: relativeTime(agent.updatedAt),
        nextAction: null,
        warning:
          agent.healthStatus && agent.healthStatus !== "ok"
            ? agent.healthMessage || "Needs attention"
            : null,
        href:
          agentTypeFromOutcomeSlug(outcomeSlugForLabel) === "appointment_booking"
            ? `/agents/${agent.id}`
            : `/voice/agents/${agent.id}`,
      });
    }

    for (const flowId of setup.linkedAutomationIds || []) {
      linkedFlowIds.add(flowId);
      const flow = flowById.get(flowId) as
        | {
            id: string;
            name: string;
            status: string;
            advancedCustomized?: boolean;
            updatedAt: Date;
            executions?: Array<{
              startedAt: Date;
              nextActionAt: Date | null;
              error: string | null;
            }>;
          }
        | undefined;
      if (!flow) continue;
      const lastExec = flow.executions?.[0];
      children.push({
        id: `flow-${flow.id}`,
        name: flow.name,
        type: "automation",
        typeLabel: "Automation",
        agentType: solutionTitle(setup.solutionType),
        agentTypeId: agentTypeFromOutcomeSlug(setup.solutionType === "appointment-receptionist" ? "appointment-booking" : setup.solutionType),
        createdFrom: solutionTitle(setup.solutionType),
        status: mapStatus(flow.status),
        statusLabel: statusLabel(mapStatus(flow.status)),
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
        warning:
          lastExec?.error ||
          (flow.advancedCustomized ? "Advanced customizations" : null),
        href: `/automations/${flow.id}`,
      });
    }

    for (const campaignId of setup.linkedCampaignIds || []) {
      linkedCampaignIds.add(campaignId);
      const campaign = campaignById.get(campaignId) as
        | {
            id: string;
            name: string;
            status: string;
            type: string;
            createdAt: Date;
            scheduledAt: Date | null;
          }
        | undefined;
      if (!campaign) continue;
      children.push({
        id: `campaign-${campaign.id}`,
        name: campaign.name,
        type: "campaign",
        typeLabel: "Campaign",
        agentType: solutionTitle(setup.solutionType),
        agentTypeId: agentTypeFromOutcomeSlug(setup.solutionType === "appointment-receptionist" ? "appointment-booking" : setup.solutionType),
        createdFrom: solutionTitle(setup.solutionType),
        status: mapStatus(campaign.status),
        statusLabel: statusLabel(mapStatus(campaign.status)),
        channels: [campaign.type?.toUpperCase() === "EMAIL" ? "Email" : "SMS"],
        phoneNumber: null,
        lastActivity: relativeTime(campaign.createdAt),
        nextAction: campaign.scheduledAt
          ? new Date(campaign.scheduledAt).toLocaleString()
          : null,
        warning: null,
        href: `/campaigns/${campaign.id}`,
      });
    }

    for (const ruleId of setup.linkedRoutingRuleIds || []) {
      linkedRuleIds.add(ruleId);
      const rule = ruleById.get(ruleId) as
        | { id: string; name: string; isActive: boolean; updatedAt: Date }
        | undefined;
      if (!rule) continue;
      children.push({
        id: `routing-${rule.id}`,
        name: rule.name,
        type: "routing",
        typeLabel: "Routing",
        agentType: solutionTitle(setup.solutionType),
        agentTypeId: agentTypeFromOutcomeSlug(setup.solutionType === "appointment-receptionist" ? "appointment-booking" : setup.solutionType),
        createdFrom: solutionTitle(setup.solutionType),
        status: rule.isActive ? "active" : "paused",
        statusLabel: rule.isActive ? "Active" : "Paused",
        channels: ["Voice"],
        phoneNumber: null,
        lastActivity: relativeTime(rule.updatedAt),
        nextAction: null,
        warning: null,
        href: "/phone/queues",
      });
    }

    // Also include flows linked via sourceSolutionSetupId even if array stale.
    for (const flow of flows as Array<{
      id: string;
      name: string;
      status: string;
      sourceSolutionSetupId?: string | null;
      advancedCustomized?: boolean;
      updatedAt: Date;
      executions?: Array<{
        startedAt: Date;
        nextActionAt: Date | null;
        error: string | null;
      }>;
    }>) {
      if (flow.sourceSolutionSetupId !== setup.id) continue;
      if (linkedFlowIds.has(flow.id)) continue;
      linkedFlowIds.add(flow.id);
      const lastExec = flow.executions?.[0];
      children.push({
        id: `flow-${flow.id}`,
        name: flow.name,
        type: "automation",
        typeLabel: "Automation",
        agentType: solutionTitle(setup.solutionType),
        agentTypeId: agentTypeFromOutcomeSlug(setup.solutionType === "appointment-receptionist" ? "appointment-booking" : setup.solutionType),
        createdFrom: solutionTitle(setup.solutionType),
        status: mapStatus(flow.status),
        statusLabel: statusLabel(mapStatus(flow.status)),
        channels: ["SMS"],
        phoneNumber: null,
        lastActivity: relativeTime(lastExec?.startedAt || flow.updatedAt),
        nextAction: lastExec?.nextActionAt
          ? new Date(lastExec.nextActionAt).toLocaleString()
          : null,
        warning:
          lastExec?.error ||
          (flow.advancedCustomized ? "Advanced customizations" : null),
        href: `/automations/${flow.id}`,
      });
    }

    const phoneId = (setup.linkedPhoneNumberIds || [])[0];
    const phone = phoneId ? phoneById.get(phoneId) : null;
    const status = mapStatus(setup.status);

    const setupAgentType = agentTypeLabel(outcomeSlugForLabel, setup.solutionType);
    const linkedVoice = (setup.linkedAgentIds || [])
      .map((id) => agentById.get(id))
      .find(Boolean) as
      | {
          draftConfig?: unknown;
          healthStatus?: string | null;
          healthMessage?: string | null;
          primaryFlowId?: string | null;
          linkedAutomationIds?: string[] | null;
          postCallAutomationId?: string | null;
          fallbackAutomationId?: string | null;
        }
      | undefined;
    const caps = readCapabilities(setup.configJson, linkedVoice?.draftConfig);
    const handles = answerWhenLabel(
      readAnswerWhen(setup.configJson, linkedVoice?.draftConfig),
    );
    const primaryFlowId = resolvePrimaryFlowId({
      primaryFlowId: setup.primaryFlowId,
      linkedAutomationIds: setup.linkedAutomationIds,
      postCallAutomationId: linkedVoice?.postCallAutomationId,
      fallbackAutomationId: linkedVoice?.fallbackAutomationId,
    }) || resolvePrimaryFlowId({
      primaryFlowId: linkedVoice?.primaryFlowId,
      linkedAutomationIds: linkedVoice?.linkedAutomationIds,
      postCallAutomationId: linkedVoice?.postCallAutomationId,
      fallbackAutomationId: linkedVoice?.fallbackAutomationId,
    });
    const primaryFlow = primaryFlowId
      ? (flowById.get(primaryFlowId) as
          | {
              id: string;
              name: string;
              status: string;
              executions?: Array<{ status?: string; error?: string | null }>;
            }
          | undefined)
      : undefined;
    const deployment = primaryFlowId
      ? deploymentByFlowId.get(primaryFlowId)
      : undefined;
    const deployStatus = deployment?.status || null;
    let cardStatus = status;
    if (deployStatus === "live") cardStatus = "active";
    else if (deployStatus === "paused") cardStatus = "paused";
    else if (deployStatus === "error") cardStatus = "needs_attention";
    else if (deployStatus === "draft" || deployStatus === "test") {
      /* keep setup status */
    }
    if (!setup.linkedPhoneNumberIds?.[0] && !phone) {
      // Not ready without a number.
      if (cardStatus === "active") cardStatus = "draft";
    }
    systems.push({
      id: `setup-${setup.id}`,
      name: setup.name,
      type: "solution_setup",
      typeLabel: setupAgentType,
      agentType: setupAgentType,
      agentTypeId: agentTypeFromOutcomeSlug(outcomeSlugForLabel),
      createdFrom: setupAgentType,
      status: cardStatus,
      statusLabel:
        deployStatus === "live"
          ? "Live"
          : deployStatus === "paused"
            ? "Paused"
            : deployStatus === "error"
              ? "Error"
              : deployStatus === "test"
                ? "Test"
                : !phone
                  ? "Draft — phone required"
                  : statusLabel(cardStatus),
      channels,
      phoneNumber:
        (phone as { e164?: string; friendlyName?: string | null } | undefined)
          ?.e164 ||
        (phone as { friendlyName?: string | null } | undefined)?.friendlyName ||
        null,
      lastActivity: relativeTime(setup.updatedAt),
      nextAction: null,
      warning:
        deployment?.errorMessage ||
        (linkedVoice?.healthStatus && linkedVoice.healthStatus !== "ok"
          ? linkedVoice.healthMessage || "Needs attention"
          : null),
      capabilities: caps,
      handles,
      primaryFlowId,
      primaryFlowName: primaryFlow?.name || null,
      deploymentStatus: deployStatus,
      lastExecutionStatus: primaryFlow?.executions?.[0]?.status || null,
      workflowHref: workflowEditHref(primaryFlowId),
      href:
        setup.solutionType === "missed-call-text-back"
          ? `/agents/john`
          : setup.solutionType === "appointment-receptionist"
            ? (() => {
                const outcomeSlug = cfgJson?.outcomeSlug || "appointment-booking";
                const agentId = (setup.linkedAgentIds || [])[0];
                if (agentId && outcomeSlug === "appointment-booking") {
                  return `/agents/${agentId}`;
                }
                const params = new URLSearchParams({ setupId: setup.id });
                if (agentId) params.set("agentId", agentId);
                const presetBySlug: Record<string, string> = {
                  "answer-every-call": "every_call",
                  "missed-overflow": "nobody_answers",
                  "after-hours": "after_hours",
                  "lead-capture": "lead_capture",
                  "service-intake": "service_intake",
                };
                const preset = presetBySlug[outcomeSlug];
                if (preset) params.set("preset", preset);
                return `/solutions/ai-call-handling/appointment-assistant/setup?${params.toString()}`;
              })()
          : outcomeHref(setup.solutionType),
      children,
    });
  }

  for (const agent of agents as Array<{
    id: string;
    name: string;
    displayName: string | null;
    purpose: string | null;
    agentType?: string | null;
    status: string;
    healthStatus: string | null;
    healthMessage: string | null;
    updatedAt: Date;
    phoneNumberId: string | null;
    draftConfig?: unknown;
    sourceSolutionSetupId?: string | null;
    primaryFlowId?: string | null;
    linkedAutomationIds?: string[] | null;
    postCallAutomationId?: string | null;
    fallbackAutomationId?: string | null;
  }>) {
    if (linkedAgentIds.has(agent.id) || agent.sourceSolutionSetupId) continue;
    const status = mapStatus(agent.status, agent.healthStatus);
    const phone = agent.phoneNumberId
      ? phoneById.get(agent.phoneNumberId)
      : null;
    const typeId = agent.agentType
      ? getAgentType(agent.agentType).id
      : "custom";
    const typeLabel =
      typeId !== "custom"
        ? catalogAgentTypeLabel(typeId)
        : outcomeSolutions.find((s) => s.slug === agent.purpose)?.title ||
          agent.purpose ||
          "Voice Agent";
    systems.push({
      id: `agent-${agent.id}`,
      name: agent.displayName || agent.name,
      type: "ai_agent",
      typeLabel: "Voice Agent",
      agentType: typeLabel,
      agentTypeId: typeId,
      createdFrom: typeLabel,
      status,
      statusLabel: statusLabel(status),
      channels: ["Voice"],
      phoneNumber:
        (phone as { e164?: string; friendlyName?: string | null } | undefined)
          ?.e164 || null,
      lastActivity: relativeTime(agent.updatedAt),
      nextAction: null,
      warning:
        agent.healthStatus && agent.healthStatus !== "ok"
          ? agent.healthMessage || "Needs attention"
          : null,
      capabilities: readCapabilities(null, agent.draftConfig),
      handles: answerWhenLabel(readAnswerWhen(null, agent.draftConfig)),
      workflowHref: workflowEditHref(
        resolvePrimaryFlowId({
          primaryFlowId: agent.primaryFlowId,
          linkedAutomationIds: agent.linkedAutomationIds,
          postCallAutomationId: agent.postCallAutomationId,
          fallbackAutomationId: agent.fallbackAutomationId,
        }),
      ),
      href:
        typeId === "appointment_booking"
          ? `/agents/${agent.id}`
          : `/voice/agents/${agent.id}`,
    });
  }

  for (const flow of flows as Array<{
    id: string;
    name: string;
    trigger: string;
    description?: string | null;
    status: string;
    sourceSolutionSetupId?: string | null;
    advancedCustomized?: boolean;
    updatedAt: Date;
    executions?: Array<{
      startedAt: Date;
      nextActionAt: Date | null;
      error: string | null;
    }>;
  }>) {
    if (linkedFlowIds.has(flow.id) || flow.sourceSolutionSetupId) continue;
    const status = mapStatus(flow.status);
    const lastExec = flow.executions?.[0];
    const createdFrom = flow.description?.startsWith("Generated from ")
      ? flow.description.replace(/^Generated from\s+/, "")
      : flow.trigger || "Automation";
    systems.push({
      id: `flow-${flow.id}`,
      name: flow.name,
      type: "automation",
      typeLabel: "Automation",
      agentType: createdFrom,
      agentTypeId: "custom",
      createdFrom,
      status,
      statusLabel: statusLabel(status),
      channels: ["SMS"],
      phoneNumber: null,
      lastActivity: relativeTime(lastExec?.startedAt || flow.updatedAt),
      nextAction: lastExec?.nextActionAt
        ? new Date(lastExec.nextActionAt).toLocaleString()
        : null,
      warning:
        lastExec?.error ||
        (flow.advancedCustomized ? "Advanced customizations" : null),
      href: `/automations/${flow.id}`,
    });
  }

  for (const campaign of campaigns as Array<{
    id: string;
    name: string;
    type: string;
    category: string | null;
    status: string;
    createdAt: Date;
    scheduledAt: Date | null;
  }>) {
    if (linkedCampaignIds.has(campaign.id)) continue;
    const status = mapStatus(campaign.status);
    systems.push({
      id: `campaign-${campaign.id}`,
      name: campaign.name,
      type: "campaign",
      typeLabel: "Campaign",
      agentType: campaign.category || campaign.type || "Campaign",
      agentTypeId: "custom",
      createdFrom: campaign.category || campaign.type || "Campaign",
      status,
      statusLabel: statusLabel(status),
      channels: [campaign.type?.toUpperCase() === "EMAIL" ? "Email" : "SMS"],
      phoneNumber: null,
      lastActivity: relativeTime(campaign.createdAt),
      nextAction: campaign.scheduledAt
        ? new Date(campaign.scheduledAt).toLocaleString()
        : null,
      warning: null,
      href: `/campaigns/${campaign.id}`,
    });
  }

  for (const rule of routingRules as Array<{
    id: string;
    name: string;
    isActive: boolean;
    updatedAt: Date;
  }>) {
    if (linkedRuleIds.has(rule.id)) continue;
    systems.push({
      id: `routing-${rule.id}`,
      name: rule.name,
      type: "routing",
      typeLabel: "Routing",
      agentType: "Phone & Routing",
      agentTypeId: "custom",
      createdFrom: "Phone & Routing",
      status: rule.isActive ? "active" : "paused",
      statusLabel: rule.isActive ? "Active" : "Paused",
      channels: ["Voice"],
      phoneNumber: null,
      lastActivity: relativeTime(rule.updatedAt),
      nextAction: null,
      warning: null,
      href: "/phone/queues",
    });
  }

  return systems;
}
