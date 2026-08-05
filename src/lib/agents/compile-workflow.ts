/**
 * Compile Outcome wizards into agent primary workflows.
 *
 * Two layers:
 * 1. Agent primary flow — what THIS agent does.
 *    Voice: Inbound Call → Run Voice Agent → Call Outcome → End
 *    (never Use Agent → self). Activate publishes direct Telnyx routing.
 * 2. Overall automations — compose *other* agents via Use Agent with an
 *    explicit mode (run_primary_workflow | invoke_task | hand_off_conversation).
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import type { Prisma } from "@/lib/domain";
import { triggerFromBlockType } from "@/lib/automations/catalog";
import type { AutomationDefinition } from "@/lib/automations/types";
import { parseAutomationDefinition } from "@/lib/automations/types";
import {
  agentWorkflowName,
  executionTypeForAgentType,
  linkAgentWorkflow,
  ownerLabelForOutcome,
  reconcileManagedNodes,
  stampManagedDefinition,
} from "@/lib/agents/workflows";
import { agentTypeFromOutcomeSlug, getAgentType } from "@/lib/agents/types";

export type CompileTriggerBlock =
  | "inbound_call"
  | "call_missed"
  | "call_completed"
  | "call_appointment_booked"
  | "call_qualified"
  | "form_submitted"
  | "keyword"
  | "incoming_sms"
  | "scheduled_datetime";

export const VOICE_TEMPLATE_KEYS = {
  INBOUND_CALL: "inbound_call",
  RUN_VOICE: "run_voice_agent",
  CALL_OUTCOME: "call_outcome",
  END: "end",
  SEND_BOOKING_SMS: "send_booking_sms",
  END_BOOKED: "end_booked",
} as const;

/** All keys reconcile may add or strip when booking branches toggle. */
export const VOICE_MANAGED_TEMPLATE_KEYS = Object.values(VOICE_TEMPLATE_KEYS);

export const VOICE_NODE_IDS = {
  TRIGGER: "TRIGGER_AGENT_WORKFLOW",
  RUN_VOICE: "RUN_VOICE_AGENT",
  CALL_OUTCOME: "CALL_OUTCOME",
  END: "END_AGENT_WORKFLOW",
} as const;

/**
 * Voice agent primary workflow:
 * Inbound Call (number on trigger) → Run Voice Agent → Call Outcome → End
 *
 * Activate publishes Telnyx routing from the Inbound Call trigger.
 * Run Voice Agent attaches the realtime agent (no outbound dial on inbound).
 * Call Outcome waits for Telnyx call events then branches.
 */
export function buildVoiceAgentPrimaryDefinition(input: {
  triggerBlock?: CompileTriggerBlock;
  triggerLabel?: string;
  agentId?: string | null;
  agentName: string;
  purpose?: string | null;
  phoneNumberId?: string | null;
  phoneNumberE164?: string | null;
  routingMode?: string | null;
  ringSeconds?: number | null;
  schedule?: string | null;
  telnyxAssistantId?: string | null;
  /** When false, omit booked outcome edge (answering / lead agents). */
  includeBookingBranches?: boolean;
  /** Adds SMS confirmation node after booked (booking agents only). */
  includeSmsConfirmation?: boolean;
  outcomeSlug?: string | null;
}): AutomationDefinition {
  const triggerId = VOICE_NODE_IDS.TRIGGER;
  const voiceNodeId = VOICE_NODE_IDS.RUN_VOICE;
  const outcomeId = VOICE_NODE_IDS.CALL_OUTCOME;
  const endId = VOICE_NODE_IDS.END;
  const smsId = "SEND_BOOKING_SMS";
  const endBookedId = "END_BOOKED";
  const triggerBlock = input.triggerBlock || "inbound_call";
  const includeBooking = input.includeBookingBranches === true;
  const includeSms = includeBooking && input.includeSmsConfirmation === true;
  const routingMode = input.routingMode || "every_call";
  const schedule =
    input.schedule ||
    (routingMode === "after_hours" ? "after_hours" : "always");

  const label =
    input.triggerLabel ||
    (routingMode === "overflow"
      ? "Inbound Call (overflow)"
      : routingMode === "after_hours"
        ? "Inbound Call (after hours)"
        : triggerFromBlockType(triggerBlock) || "Inbound Call");

  const triggerConfig =
    triggerBlock === "inbound_call"
      ? {
          phoneNumberId: input.phoneNumberId || "",
          phoneNumberE164: input.phoneNumberE164 || "",
          routingMode,
          schedule,
          ringSeconds: Math.max(1, Number(input.ringSeconds || 20)),
          mode: "live",
          pauseFallback: "human",
          pauseFallbackNumber: "",
          pauseFallbackFlowId: "",
          outcomeSlug: input.outcomeSlug || "",
        }
      : {
          phoneNumberId: input.phoneNumberId || "",
          phoneNumberE164: input.phoneNumberE164 || "",
        };

  const nodes: AutomationDefinition["nodes"] = [
    {
      id: triggerId,
      type: "trigger",
      position: { x: 80, y: 120 },
      data: {
        blockType: triggerBlock,
        label,
        config: triggerConfig,
      },
    },
    {
      id: voiceNodeId,
      type: "action",
      position: { x: 360, y: 120 },
      data: {
        blockType: "run_voice_agent",
        label: `Run Voice Agent: ${input.agentName}`,
        config: {
          agentId: input.agentId || "",
          agentName: input.agentName,
          purpose: input.purpose || input.agentName,
          telnyxAssistantId: input.telnyxAssistantId || "",
          mode: "realtime_voice",
          waitForOutcome: true,
          attachInbound: true,
          timeoutSeconds: 60,
          retryCount: 0,
        },
      },
    },
    {
      id: outcomeId,
      type: "logic",
      position: { x: 640, y: 120 },
      data: {
        blockType: "wait_for_call_result",
        label: "Call Outcome",
        config: {
          timeoutMinutes: 60,
          branchField: "outcome",
          includeBookingBranches: includeBooking,
        },
      },
    },
    {
      id: endId,
      type: "end",
      position: { x: 920, y: includeBooking ? 200 : 120 },
      data: {
        blockType: "end_automation",
        label: includeBooking ? "End (other)" : "End",
        config: {},
      },
    },
  ];

  const edges: AutomationDefinition["edges"] = [
    { id: "e_trigger_voice", source: triggerId, target: voiceNodeId },
    { id: "e_voice_outcome", source: voiceNodeId, target: outcomeId },
    {
      id: "e_outcome_end",
      source: outcomeId,
      target: endId,
      sourceHandle: "default",
    },
    {
      id: "e_outcome_completed",
      source: outcomeId,
      target: endId,
      sourceHandle: "completed",
    },
    {
      id: "e_outcome_failed",
      source: outcomeId,
      target: endId,
      sourceHandle: "failed",
    },
    {
      id: "e_outcome_no_answer",
      source: outcomeId,
      target: endId,
      sourceHandle: "no_answer",
    },
  ];

  if (includeBooking) {
    if (includeSms) {
      nodes.push({
        id: smsId,
        type: "action",
        position: { x: 920, y: 40 },
        data: {
          blockType: "send_sms",
          label: "Send booking confirmation",
          config: {
            body: "You're booked! Reply if you need to reschedule.",
            fromPhoneNumberId: input.phoneNumberId || "",
          },
        },
      });
      nodes.push({
        id: endBookedId,
        type: "end",
        position: { x: 1180, y: 40 },
        data: {
          blockType: "end_automation",
          label: "End (booked)",
          config: {},
        },
      });
      edges.push({
        id: "e_outcome_booked",
        source: outcomeId,
        target: smsId,
        sourceHandle: "booked",
      });
      edges.push({
        id: "e_sms_end_booked",
        source: smsId,
        target: endBookedId,
      });
    } else {
      edges.push({
        id: "e_outcome_booked",
        source: outcomeId,
        target: endId,
        sourceHandle: "booked",
      });
    }
  }

  const def: AutomationDefinition = {
    version: 1,
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };

  const keyMap: Record<string, string> = {
    [triggerId]: VOICE_TEMPLATE_KEYS.INBOUND_CALL,
    [voiceNodeId]: VOICE_TEMPLATE_KEYS.RUN_VOICE,
    [outcomeId]: VOICE_TEMPLATE_KEYS.CALL_OUTCOME,
    [endId]: VOICE_TEMPLATE_KEYS.END,
  };
  if (includeSms) {
    keyMap[smsId] = VOICE_TEMPLATE_KEYS.SEND_BOOKING_SMS;
    keyMap[endBookedId] = VOICE_TEMPLATE_KEYS.END_BOOKED;
  }

  return stampManagedDefinition(def, keyMap);
}

/** @deprecated Prefer buildVoiceAgentPrimaryDefinition for voice agents. */
export function buildTriggerAgentDefinition(input: {
  triggerBlock: CompileTriggerBlock;
  triggerLabel?: string;
  agentId?: string | null;
  setupId?: string | null;
  agentName: string;
  agentType?: string | null;
  purpose?: string | null;
}): AutomationDefinition {
  return buildVoiceAgentPrimaryDefinition(input);
}

export function triggerBlockFromAnswerWhen(
  answerWhen?: string | null,
): CompileTriggerBlock {
  switch (answerWhen) {
    case "nobody_answers":
    case "line_busy":
      return "inbound_call"; // routingMode set separately to overflow/unanswered
    case "after_hours":
    case "custom_schedule":
      return "inbound_call";
    case "every_call":
    default:
      return "inbound_call";
  }
}

export function routingModeFromAnswerWhen(
  answerWhen?: string | null,
): string {
  switch (answerWhen) {
    case "nobody_answers":
    case "line_busy":
      return "overflow";
    case "after_hours":
    case "custom_schedule":
      return "after_hours";
    case "every_call":
    default:
      return "every_call";
  }
}

export type EnsurePrimaryWorkflowInput = {
  workspaceId: string;
  agentName: string;
  outcomeSlug: string;
  existingFlowId?: string | null;
  agentId?: string | null;
  setupId?: string | null;
  /** Prefer a prebuilt detailed definition (e.g. MCTB SMS graph). */
  definition?: AutomationDefinition;
  triggerBlock?: CompileTriggerBlock;
  triggerLabel?: string;
  purpose?: string | null;
  phoneNumberId?: string | null;
  phoneNumberE164?: string | null;
  routingMode?: string | null;
  ringSeconds?: number | null;
  schedule?: string | null;
  includeBookingBranches?: boolean;
  includeSmsConfirmation?: boolean;
  telnyxAssistantId?: string | null;
  activate?: boolean;
  description?: string;
};

/**
 * Create or update the agent's primary AutomationFlow and two-way ownership links.
 * Resaving is idempotent: finds existing flow, reconciles only template-managed nodes.
 */
export async function ensureAgentPrimaryWorkflow(
  input: EnsurePrimaryWorkflowInput,
): Promise<{ flowId: string; created: boolean; phoneReady: boolean }> {
  const prisma = getPrisma();
  const now = new Date().toISOString();
  const agentType = agentTypeFromOutcomeSlug(input.outcomeSlug);
  const typeDef = getAgentType(agentType);
  const ownerLabel = ownerLabelForOutcome(input.outcomeSlug, input.agentName);
  const flowName = agentWorkflowName(input.agentName);
  const triggerBlock =
    input.triggerBlock ||
    (typeDef.family === "sms" ? "call_missed" : "inbound_call");

  let telnyxAssistantId = input.telnyxAssistantId || null;
  if (!telnyxAssistantId && input.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId },
      select: { telnyxAssistantId: true },
    });
    telnyxAssistantId = agent?.telnyxAssistantId || null;
  }

  const templateGraph: AutomationDefinition =
    input.definition ||
    (typeDef.family === "receptionist"
      ? buildVoiceAgentPrimaryDefinition({
          triggerBlock,
          triggerLabel: input.triggerLabel,
          agentId: input.agentId,
          agentName: input.agentName,
          purpose: input.purpose || typeDef.label,
          phoneNumberId: input.phoneNumberId,
          phoneNumberE164: input.phoneNumberE164,
          routingMode: input.routingMode,
          ringSeconds: input.ringSeconds,
          schedule: input.schedule,
          includeBookingBranches: input.includeBookingBranches === true,
          includeSmsConfirmation: input.includeSmsConfirmation === true,
          outcomeSlug: input.outcomeSlug,
          telnyxAssistantId,
        })
      : stampManagedDefinition(
          {
            version: 1,
            nodes: [
              {
                id: "TRIGGER_AGENT_WORKFLOW",
                type: "trigger",
                position: { x: 80, y: 120 },
                data: {
                  blockType: triggerBlock,
                  label:
                    input.triggerLabel ||
                    triggerFromBlockType(triggerBlock) ||
                    "Trigger",
                  config: {},
                },
              },
              {
                id: "END_AGENT_WORKFLOW",
                type: "end",
                position: { x: 360, y: 120 },
                data: {
                  blockType: "end_automation",
                  label: "End — configure steps",
                  config: {},
                },
              },
            ],
            edges: [
              {
                id: "e_trigger_end",
                source: "TRIGGER_AGENT_WORKFLOW",
                target: "END_AGENT_WORKFLOW",
              },
            ],
            viewport: { x: 0, y: 0, zoom: 0.9 },
          },
          {
            TRIGGER_AGENT_WORKFLOW: "trigger",
            END_AGENT_WORKFLOW: "end",
          },
        ));

  const phoneReady = Boolean(input.phoneNumberId);
  const triggerLabel =
    input.triggerLabel ||
    triggerFromBlockType(triggerBlock) ||
    "Trigger";

  // Never auto-activate without a number — draft / not ready.
  const status =
    input.activate && phoneReady ? "ACTIVE" : "DRAFT";
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

  // Idempotent: one agent_workflow per owner agent.
  if (!flowId && input.agentId) {
    const owned = await prisma.automationFlow.findFirst({
      where: {
        workspaceId: input.workspaceId,
        ownerAgentId: input.agentId,
        ownershipKind: "agent_workflow",
      },
      select: { id: true },
      orderBy: { updatedAt: "desc" },
    });
    if (owned) flowId = owned.id;
  }

  if (!flowId) {
    created = true;
    flowId = createId();
    const createData: Record<string, unknown> = {
      id: flowId,
      workspaceId: input.workspaceId,
      name: flowName,
      description:
        input.description ||
        (phoneReady
          ? `Generated from ${ownerLabel}`
          : `Generated from ${ownerLabel} — Phone number required`),
      trigger: triggerLabel,
      definition: templateGraph as unknown as Prisma.InputJsonValue,
      version: status === "ACTIVE" ? 1 : 0,
      status,
      sourceSolutionSetupId: input.setupId || null,
      ownerAgentId: input.agentId || null,
      ownershipKind: "agent_workflow",
      ownerLabel,
      linkedAgentIds: input.agentId ? [input.agentId] : [],
      linkedPhoneNumberIds: input.phoneNumberId ? [input.phoneNumberId] : [],
      advancedCustomized: false,
      createdAt: now,
      updatedAt: now,
    };
    if (status === "ACTIVE") {
      createData.publishedDefinition =
        templateGraph as unknown as Prisma.InputJsonValue;
      createData.publishedAt = now;
    }
    await prisma.automationFlow.create({ data: createData });
  } else {
    const existing = await prisma.automationFlow.findFirst({
      where: { id: flowId },
      select: {
        advancedCustomized: true,
        status: true,
        version: true,
        definition: true,
      },
    });

    let nextGraph = templateGraph;
    if (existing?.definition && typeDef.family === "receptionist") {
      nextGraph = reconcileManagedNodes(
        existing.definition,
        templateGraph,
        VOICE_MANAGED_TEMPLATE_KEYS,
      );
    } else if (existing?.advancedCustomized) {
      // Preserve full custom graph; only stamp ownership below.
      nextGraph = parseAutomationDefinition(existing.definition);
    }

    const updateData: Record<string, unknown> = {
      name: flowName,
      description:
        input.description ||
        (phoneReady
          ? `Generated from ${ownerLabel}`
          : `Generated from ${ownerLabel} — Phone number required`),
      trigger: triggerLabel,
      ownershipKind: "agent_workflow",
      ownerLabel,
      ownerAgentId: input.agentId || null,
      sourceSolutionSetupId: input.setupId || null,
      linkedAgentIds: input.agentId ? [input.agentId] : [],
      linkedPhoneNumberIds: input.phoneNumberId ? [input.phoneNumberId] : [],
      updatedAt: now,
    };

    if (!existing?.advancedCustomized) {
      updateData.definition = nextGraph as unknown as Prisma.InputJsonValue;
    } else {
      // Still patch managed inbound/run_voice configs even when advanced.
      updateData.definition = nextGraph as unknown as Prisma.InputJsonValue;
    }

    if (status === "ACTIVE") {
      updateData.status = "ACTIVE";
      updateData.version = Math.max(
        1,
        Number(existing?.version || 0) +
          (existing?.status === "ACTIVE" ? 0 : 1),
      );
      updateData.publishedDefinition =
        nextGraph as unknown as Prisma.InputJsonValue;
      updateData.publishedAt = now;
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

  return { flowId, created, phoneReady };
}
