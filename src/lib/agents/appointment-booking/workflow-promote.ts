/**
 * Promote a validated Workflow Architect draft into live AutomationFlow + agent config.
 * Conversational blocks stay on the Telnyx voice agent; the AutomationFlow owns
 * inbound trigger routing, call outcome, and optional SMS / missed-call companions.
 */

import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import { ensureAgentPrimaryWorkflow } from "@/lib/agents/compile-workflow";
import {
  activateFlowTriggers,
} from "@/lib/automations/trigger-deployments";
import {
  listWorkflowDrafts,
} from "@/lib/agents/appointment-booking/workflow-architect";
import {
  validateWorkflowDraft,
  type WorkflowDraft,
} from "@/lib/agents/appointment-booking/workflow-validator";
import { attachMissedCallTextBackForAgent } from "@/lib/agents/appointment-booking/missed-call-handoff";
import { compileArchitectDraftToWorkflowDefinition } from "@/lib/voice/workflow-runtime/architect-to-workflow";
import { persistVoiceWorkflowDefinition } from "@/lib/voice/workflow-runtime/persistence";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function operatingState(config: VoiceAgentConfig) {
  return asRecord(asRecord(config.advanced).agentOperating);
}

function withOperating(
  config: VoiceAgentConfig,
  operating: Record<string, unknown>,
): VoiceAgentConfig {
  return {
    ...config,
    advanced: {
      ...asRecord(config.advanced),
      agentOperating: operating,
    },
  };
}

function draftRouting(draft: WorkflowDraft): {
  routingMode: string;
  schedule: string;
  afterHours: boolean;
  wantsMissedCall: boolean;
} {
  const trigger = draft.nodes.find((n) => n.id === draft.triggerNodeId);
  const source = String(draft.sourceRequest || "").toLowerCase();
  const afterHours =
    trigger?.type === "after_hours_call" ||
    /after[- ]hours|outside (of )?hours/.test(source);
  const wantsMissedCall =
    /missed call|text[- ]back|sms (when|if) (they )?miss|no answer/.test(source) ||
    draft.nodes.some((n) => n.type === "callback_request");
  return {
    routingMode: afterHours ? "after_hours" : "every_call",
    schedule: afterHours ? "after_hours" : "always",
    afterHours,
    wantsMissedCall,
  };
}

function ensureBookingTools(config: VoiceAgentConfig): VoiceAgentConfig {
  const tools = new Set(
    Array.isArray(config.enabledBuiltinTools) ? config.enabledBuiltinTools : [],
  );
  for (const t of [
    "resolve_datetime",
    "calendar_availability",
    "hold_appointment_slot",
    "release_appointment_hold",
    "book_appointment",
    "find_appointments",
    "send_sms",
  ]) {
    tools.add(t);
  }
  return { ...config, enabledBuiltinTools: [...tools] };
}

export async function promoteWorkflowDraft(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  draftId: string;
  confirm: boolean;
  activateTriggers?: boolean;
  attachMissedCallTextBack?: boolean;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true is required to promote a workflow draft");
  }

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const drafts = listWorkflowDrafts(agent.draftConfig);
  const idx = drafts.findIndex((d) => d.id === input.draftId);
  if (idx < 0) throw new Error("Workflow draft not found");

  let draft = validateWorkflowDraft(drafts[idx]);
  if (draft.validationStatus !== "valid") {
    throw new Error(
      `Draft is invalid: ${draft.validationErrors.map((e) => e.message).join("; ")}`,
    );
  }

  const routing = draftRouting(draft);
  let config = ensureBookingTools(parseVoiceAgentConfig(agent.draftConfig));

  // Persist architect graph snapshot for audit + builder reference.
  const op = operatingState(config);
  draft = {
    ...draft,
    status: "activated",
  };
  const nextDrafts = drafts.map((d, i) => (i === idx ? draft : d));
  config = withOperating(config, {
    ...op,
    workflowDrafts: nextDrafts,
    activatedWorkflow: {
      draftId: draft.id,
      name: draft.name,
      activatedAt: new Date().toISOString(),
      activatedBy: input.userId,
      nodes: draft.nodes,
      edges: draft.edges,
      routingMode: routing.routingMode,
    },
  });

  await updateVoiceAgentDraft(input.workspaceId, input.agentId, {
    draftConfig: config,
  });

  const voiceWorkflow = compileArchitectDraftToWorkflowDefinition(draft);
  const voiceWorkflowRef = await persistVoiceWorkflowDefinition({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    definition: voiceWorkflow,
    setActive: true,
  });

  const phone = agent.phoneNumberId
    ? await prisma.phoneNumber.findFirst({
        where: { id: agent.phoneNumberId, workspaceId: input.workspaceId },
      })
    : null;

  const ensured = await ensureAgentPrimaryWorkflow({
    workspaceId: input.workspaceId,
    agentName: agent.displayName || agent.name,
    outcomeSlug: "appointment-booking",
    existingFlowId: agent.primaryFlowId,
    agentId: agent.id,
    setupId: agent.sourceSolutionSetupId,
    phoneNumberId: agent.phoneNumberId,
    phoneNumberE164: phone?.e164 || null,
    routingMode: routing.routingMode,
    schedule: routing.schedule,
    includeBookingBranches: true,
    includeSmsConfirmation: true,
    telnyxAssistantId: agent.telnyxAssistantId,
    activate: Boolean(input.activateTriggers),
    purpose: agent.purpose || draft.name,
    description: `Promoted from Workflow Architect draft ${draft.id}`,
  });

  if (ensured.flowId && ensured.flowId !== agent.primaryFlowId) {
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: { primaryFlowId: ensured.flowId },
    });
  }

  // Store architect snapshot on the flow for builder visibility.
  if (ensured.flowId) {
    const flow = await prisma.automationFlow.findFirst({
      where: { id: ensured.flowId, workspaceId: input.workspaceId },
    });
    if (flow) {
      const def = asRecord(flow.definition);
      await prisma.automationFlow.update({
        where: { id: flow.id },
        data: {
          definition: {
            ...def,
            architectDraft: {
              id: draft.id,
              name: draft.name,
              nodes: draft.nodes,
              edges: draft.edges,
              sourceRequest: draft.sourceRequest,
              activatedAt: new Date().toISOString(),
            },
          },
        },
      });
    }
  }

  let triggerResult = null;
  if (input.activateTriggers && ensured.flowId) {
    const flow = await prisma.automationFlow.findFirst({
      where: { id: ensured.flowId },
    });
    if (flow) {
      triggerResult = await activateFlowTriggers(
        input.workspaceId,
        flow.id,
        flow.definition,
        { forceTakeover: true },
      );
      await prisma.automationFlow.update({
        where: { id: flow.id },
        data: { status: "ACTIVE" },
      });
    }
  }

  let missedCall = null;
  if (
    (input.attachMissedCallTextBack || routing.wantsMissedCall || routing.afterHours) &&
    agent.phoneNumberId
  ) {
    missedCall = await attachMissedCallTextBackForAgent({
      workspaceId: input.workspaceId,
      agentId: agent.id,
      phoneNumberId: agent.phoneNumberId,
      activate: Boolean(input.activateTriggers),
      userId: input.userId,
    });
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.workflow_draft_promoted",
      detail: `agent=${input.agentId} draft=${draft.id} flow=${ensured.flowId}`,
    },
  });

  return {
    ok: true,
    draft,
    flowId: ensured.flowId,
    voiceWorkflowRef,
    voiceWorkflowId: voiceWorkflow.id,
    voiceWorkflowVersion: voiceWorkflow.version,
    triggersActivated: Boolean(triggerResult?.telnyxPublished || input.activateTriggers),
    triggerResult,
    missedCall,
    href: `/automations/${ensured.flowId}/edit`,
  };
}
