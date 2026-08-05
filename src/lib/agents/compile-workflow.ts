/**
 * Compile Outcome wizards into agent primary workflows.
 *
 * Two layers:
 * 1. Agent primary flow — what THIS agent does (SMS steps, or trigger→agent for voice).
 * 2. Overall automations — compose agents via Use Agent nodes that enroll / invoke
 *    those primary flows.
 *
 * Wizards only exist for ease of setup. Every completed wizard must leave a runnable
 * AutomationFlow behind (even if it's just Trigger → Use Agent → End).
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { triggerFromBlockType } from "@/lib/automations/catalog";
import type { AutomationDefinition } from "@/lib/automations/types";
import {
  agentWorkflowName,
  executionTypeForAgentType,
  linkAgentWorkflow,
  ownerLabelForOutcome,
  stampManagedDefinition,
} from "@/lib/agents/workflows";
import { agentTypeFromOutcomeSlug, getAgentType } from "@/lib/agents/types";

export type CompileTriggerBlock =
  | "call_missed"
  | "call_completed"
  | "call_appointment_booked"
  | "call_qualified"
  | "form_submitted"
  | "keyword"
  | "incoming_sms"
  | "scheduled_datetime";

const TEMPLATE_KEYS = {
  TRIGGER: "trigger",
  AGENT: "agent",
  END: "end",
} as const;

/** Minimal composable agent workflow: Trigger → Use Agent → End. */
export function buildTriggerAgentDefinition(input: {
  triggerBlock: CompileTriggerBlock;
  triggerLabel?: string;
  agentId?: string | null;
  setupId?: string | null;
  agentName: string;
  agentType?: string | null;
  purpose?: string | null;
}): AutomationDefinition {
  const triggerId = "TRIGGER_AGENT_WORKFLOW";
  const agentNodeId = "USE_AGENT";
  const endId = "END_AGENT_WORKFLOW";
  const triggerBlock = input.triggerBlock;
  const label =
    input.triggerLabel || triggerFromBlockType(triggerBlock) || "Trigger";

  const def: AutomationDefinition = {
    version: 1,
    nodes: [
      {
        id: triggerId,
        type: "trigger",
        position: { x: 80, y: 120 },
        data: {
          blockType: triggerBlock,
          label,
          config: {},
        },
      },
      {
        id: agentNodeId,
        type: "action",
        position: { x: 360, y: 120 },
        data: {
          blockType: "use_ai_agent",
          label: input.agentName || "Use Agent",
          config: {
            agentId: input.agentId || "",
            setupId: input.setupId || "",
            agentName: input.agentName,
            agentType: input.agentType || "",
            purpose: input.purpose || "",
            mode: "auto",
          },
        },
      },
      {
        id: endId,
        type: "end",
        position: { x: 640, y: 120 },
        data: {
          blockType: "end_automation",
          label: "End",
          config: {},
        },
      },
    ],
    edges: [
      { id: "e_trigger_agent", source: triggerId, target: agentNodeId },
      { id: "e_agent_end", source: agentNodeId, target: endId },
    ],
    viewport: { x: 0, y: 0, zoom: 0.9 },
  };

  return stampManagedDefinition(def, {
    [triggerId]: TEMPLATE_KEYS.TRIGGER,
    [agentNodeId]: TEMPLATE_KEYS.AGENT,
    [endId]: TEMPLATE_KEYS.END,
  });
}

export function triggerBlockFromAnswerWhen(
  answerWhen?: string | null,
): CompileTriggerBlock {
  switch (answerWhen) {
    case "nobody_answers":
    case "line_busy":
      return "call_missed";
    case "after_hours":
    case "custom_schedule":
      return "call_missed";
    case "every_call":
    default:
      return "call_completed";
  }
}

export type EnsurePrimaryWorkflowInput = {
  workspaceId: string;
  agentName: string;
  outcomeSlug: string;
  /** Existing primary flow to update, if any. */
  existingFlowId?: string | null;
  agentId?: string | null;
  setupId?: string | null;
  /** Prefer a prebuilt detailed definition (e.g. MCTB SMS graph). */
  definition?: AutomationDefinition;
  triggerBlock?: CompileTriggerBlock;
  triggerLabel?: string;
  purpose?: string | null;
  /** DRAFT unless activate. */
  activate?: boolean;
  description?: string;
};

/**
 * Create or update the agent's primary AutomationFlow and two-way ownership links.
 * Does not destroy advanced customizations when updating — callers that patch
 * managed nodes should pass an already-patched definition.
 */
export async function ensureAgentPrimaryWorkflow(
  input: EnsurePrimaryWorkflowInput,
): Promise<{ flowId: string; created: boolean }> {
  const prisma = getPrisma();
  const now = new Date().toISOString();
  const agentType = agentTypeFromOutcomeSlug(input.outcomeSlug);
  const typeDef = getAgentType(agentType);
  const ownerLabel = ownerLabelForOutcome(input.outcomeSlug, input.agentName);
  const flowName = agentWorkflowName(input.agentName);
  const triggerBlock =
    input.triggerBlock ||
    (typeDef.family === "sms" ? "call_missed" : "call_completed");

  const definition =
    input.definition ||
    buildTriggerAgentDefinition({
      triggerBlock,
      triggerLabel: input.triggerLabel,
      agentId: input.agentId,
      setupId: input.setupId,
      agentName: input.agentName,
      agentType,
      purpose: input.purpose || typeDef.label,
    });

  const triggerLabel =
    input.triggerLabel ||
    triggerFromBlockType(triggerBlock) ||
    "Trigger";

  const status = input.activate ? "ACTIVE" : "DRAFT";
  let flowId = input.existingFlowId || null;
  let created = false;

  if (flowId) {
    const existing = await prisma.automationFlow.findFirst({
      where: { id: flowId, workspaceId: input.workspaceId },
      select: { id: true, advancedCustomized: true },
    });
    if (!existing) flowId = null;
  }

  if (!flowId && input.setupId) {
    const fromSetup = await prisma.automationFlow.findFirst({
      where: {
        workspaceId: input.workspaceId,
        sourceSolutionSetupId: input.setupId,
      },
      select: { id: true },
    });
    if (fromSetup) flowId = fromSetup.id;
  }

  if (!flowId && input.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { primaryFlowId: true, linkedAutomationIds: true },
    });
    flowId =
      agent?.primaryFlowId || agent?.linkedAutomationIds?.[0] || null;
  }

  if (!flowId) {
    created = true;
    flowId = createId();
    const createData: Record<string, unknown> = {
      id: flowId,
      workspaceId: input.workspaceId,
      name: flowName,
      description:
        input.description || `Generated from ${ownerLabel}`,
      trigger: triggerLabel,
      definition: definition as unknown as Prisma.InputJsonValue,
      version: input.activate ? 1 : 0,
      status,
      sourceSolutionSetupId: input.setupId || null,
      ownerAgentId: input.agentId || null,
      ownershipKind: "agent_workflow",
      ownerLabel,
      linkedAgentIds: input.agentId ? [input.agentId] : [],
      advancedCustomized: false,
      createdAt: now,
      updatedAt: now,
    };
    if (input.activate) {
      createData.publishedDefinition =
        definition as unknown as Prisma.InputJsonValue;
      createData.publishedAt = now;
    }
    await prisma.automationFlow.create({ data: createData });
  } else {
    const existing = await prisma.automationFlow.findFirst({
      where: { id: flowId },
      select: { advancedCustomized: true, status: true, version: true },
    });
    // If advanced customized, only refresh ownership/name — keep graph.
    const keepGraph = Boolean(existing?.advancedCustomized);
    const updateData: Record<string, unknown> = {
      name: flowName,
      description:
        input.description || `Generated from ${ownerLabel}`,
      trigger: triggerLabel,
      ownershipKind: "agent_workflow",
      ownerLabel,
      ownerAgentId: input.agentId || null,
      sourceSolutionSetupId: input.setupId || null,
      linkedAgentIds: input.agentId ? [input.agentId] : [],
      updatedAt: now,
    };
    if (!keepGraph) {
      updateData.definition = definition as unknown as Prisma.InputJsonValue;
    }
    if (input.activate) {
      updateData.status = "ACTIVE";
      updateData.version = Math.max(1, Number(existing?.version || 0) + (existing?.status === "ACTIVE" ? 0 : 1));
      if (!keepGraph) {
        updateData.publishedDefinition =
          definition as unknown as Prisma.InputJsonValue;
        updateData.publishedAt = now;
      }
    }
    await prisma.automationFlow.update({
      where: { id: flowId },
      data: updateData,
    });
  }

  await linkAgentWorkflow({
    workspaceId: input.workspaceId,
    flowId,
    agentName: input.agentName,
    ownerLabel,
    ownerAgentId: input.agentId,
    solutionSetupId: input.setupId,
    agentType,
  });

  if (input.agentId) {
    await prisma.voiceAgent.update({
      where: { id: input.agentId },
      data: {
        executionType: executionTypeForAgentType(agentType),
        primaryFlowId: flowId,
        updatedAt: now,
      },
    });
  }

  return { flowId, created };
}
