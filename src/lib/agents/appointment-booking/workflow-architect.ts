/**
 * Appointment Workflow Architect — structured drafts only, approved blocks only.
 */

import { createId } from "@/lib/supabase/id";
import { getPrisma } from "@/lib/db";
import { parseVoiceAgentConfig, type VoiceAgentConfig } from "@/lib/voice/types";
import { updateVoiceAgentDraft } from "@/lib/voice/agent-service";
import {
  validateWorkflowDraft,
  type WorkflowDraft,
  type WorkflowDraftEdge,
  type WorkflowDraftNode,
} from "@/lib/agents/appointment-booking/workflow-validator";

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

export function listWorkflowDrafts(draftConfig: unknown): WorkflowDraft[] {
  const config = parseVoiceAgentConfig(draftConfig || {});
  const list = operatingState(config).workflowDrafts;
  return Array.isArray(list) ? (list as WorkflowDraft[]) : [];
}

async function persistDrafts(
  workspaceId: string,
  agentId: string,
  drafts: WorkflowDraft[],
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const config = parseVoiceAgentConfig(agent.draftConfig);
  const op = operatingState(config);
  await updateVoiceAgentDraft(workspaceId, agentId, {
    draftConfig: withOperating(config, { ...op, workflowDrafts: drafts }),
  });
}

function node(
  id: string,
  type: string,
  config: Record<string, unknown> = {},
): WorkflowDraftNode {
  return { id, type, config };
}

function edge(
  fromNodeId: string,
  toNodeId: string,
  condition?: string,
): WorkflowDraftEdge {
  return { fromNodeId, toNodeId, ...(condition ? { condition } : {}) };
}

/**
 * Deterministic architect: maps natural-language intents to approved graphs.
 * Does not call an LLM — keeps drafts valid and auditable.
 */
export function architectWorkflowFromRequest(input: {
  agentId: string;
  userRequest: string;
  phoneNumberId?: string | null;
  timezone?: string;
}): WorkflowDraft {
  const q = input.userRequest.toLowerCase();
  const afterHours = /after[- ]hours|outside (of )?hours|closed/.test(q);
  const emergency = /emergency/.test(q);
  const transferRest = /transfer (everything|all|other)|only book/.test(q);
  const tz = input.timezone || "America/New_York";
  const phoneNumberId = input.phoneNumberId || "";

  const draftName = afterHours
    ? emergency
      ? "After-Hours Emergency Booking"
      : "After-Hours Booking"
    : "Appointment Booking Flow";

  const nodes: WorkflowDraftNode[] = [];
  const edges: WorkflowDraftEdge[] = [];

  const triggerType = afterHours ? "after_hours_call" : "inbound_call";
  nodes.push(
    node("trigger", triggerType, {
      phoneNumberId,
    }),
  );
  nodes.push(node("greet", "greet_caller", {}));
  nodes.push(
    node("intent", "identify_intent", {
      allowed_intents: emergency
        ? ["emergency_service", "normal_service", "other"]
        : ["book", "reschedule", "cancel", "question", "transfer"],
    }),
  );
  edges.push(edge("trigger", "greet"));
  edges.push(edge("greet", "intent"));

  if (emergency && transferRest) {
    nodes.push(
      node("branch", "branch", {
        branches: {
          emergency_service: ["eligibility", "resolve_dt", "availability", "confirm", "hold", "create", "sms", "booked"],
          normal_service: ["message", "notify", "requested"],
          other: ["transfer", "transferred"],
        },
      }),
    );
    edges.push(edge("intent", "branch"));

    nodes.push(node("eligibility", "check_service_eligibility", { emergencyOnly: true }));
    nodes.push(node("resolve_dt", "resolve_datetime", { timezone: tz }));
    nodes.push(node("availability", "check_availability", {}));
    nodes.push(node("confirm", "confirm_field", { fields: ["datetime", "service", "name", "phone"] }));
    nodes.push(node("hold", "hold_appointment_slot", { expiresInSeconds: 180 }));
    nodes.push(node("create", "create_appointment", { requireConfirmation: true }));
    nodes.push(node("sms", "send_confirmation_sms", {}));
    nodes.push(node("booked", "appointment_booked", {}));
    nodes.push(node("fallback", "fallback", { reason: "booking_failed" }));
    nodes.push(node("message", "take_message", {}));
    nodes.push(node("notify", "notify_staff", {}));
    nodes.push(node("requested", "appointment_requested", {}));
    nodes.push(node("transfer", "transfer_call", {}));
    nodes.push(node("transferred", "transferred", {}));

    edges.push(edge("branch", "eligibility", "emergency_service"));
    edges.push(edge("eligibility", "resolve_dt"));
    edges.push(edge("resolve_dt", "availability"));
    edges.push(edge("availability", "confirm"));
    edges.push(edge("confirm", "hold"));
    edges.push(edge("hold", "create"));
    edges.push(edge("create", "sms"));
    edges.push(edge("sms", "booked"));
    edges.push(edge("create", "fallback", "failure"));
    edges.push(edge("fallback", "message"));
    edges.push(edge("message", "notify"));
    edges.push(edge("notify", "requested"));
    edges.push(edge("branch", "message", "normal_service"));
    edges.push(edge("branch", "transfer", "other"));
    edges.push(edge("transfer", "transferred"));
  } else {
    // Standard booking path
    nodes.push(node("eligibility", "check_service_eligibility", {}));
    nodes.push(node("collect", "collect_field", { fields: ["name", "phone", "service"] }));
    nodes.push(node("resolve_dt", "resolve_datetime", { timezone: tz }));
    nodes.push(node("availability", "check_availability", {}));
    nodes.push(node("offer", "offer_slots", { maxSlots: 3 }));
    nodes.push(node("confirm", "confirm_field", { fields: ["datetime", "service", "name", "phone"] }));
    nodes.push(node("hold", "hold_appointment_slot", { expiresInSeconds: 180 }));
    nodes.push(node("create", "create_appointment", { requireConfirmation: true }));
    nodes.push(node("sms", "send_confirmation_sms", {}));
    nodes.push(node("booked", "appointment_booked", {}));
    nodes.push(node("fallback", "fallback", { reason: "booking_failed" }));
    nodes.push(node("message", "take_message", {}));
    nodes.push(node("requested", "appointment_requested", {}));

    edges.push(edge("intent", "eligibility"));
    edges.push(edge("eligibility", "collect"));
    edges.push(edge("collect", "resolve_dt"));
    edges.push(edge("resolve_dt", "availability"));
    edges.push(edge("availability", "offer"));
    edges.push(edge("offer", "confirm"));
    edges.push(edge("confirm", "hold"));
    edges.push(edge("hold", "create"));
    edges.push(edge("create", "sms"));
    edges.push(edge("sms", "booked"));
    edges.push(edge("create", "fallback", "failure"));
    edges.push(edge("fallback", "message"));
    edges.push(edge("message", "requested"));
  }

  const draft: WorkflowDraft = {
    id: createId(),
    agentId: input.agentId,
    name: draftName,
    version: 1,
    triggerNodeId: "trigger",
    nodes,
    edges,
    validationStatus: "not_validated",
    validationErrors: [],
    requiresConfirmation: true,
    status: "draft",
    createdAt: new Date().toISOString(),
    sourceRequest: input.userRequest,
  };

  return validateWorkflowDraft(draft);
}

export async function createWorkflowDraft(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  userRequest: string;
  phoneNumberId?: string | null;
  timezone?: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const draft = architectWorkflowFromRequest({
    agentId: input.agentId,
    userRequest: input.userRequest,
    phoneNumberId: input.phoneNumberId || agent.phoneNumberId,
    timezone: input.timezone,
  });

  const existing = listWorkflowDrafts(agent.draftConfig).filter(
    (d) => d.status === "draft" || d.status === "ready_for_test",
  );
  await persistDrafts(input.workspaceId, input.agentId, [...existing, draft]);
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.workflow_draft_created",
      detail: `agent=${input.agentId} draft=${draft.id} valid=${draft.validationStatus}`,
    },
  });
  return draft;
}

export async function validateStoredWorkflowDraft(input: {
  workspaceId: string;
  agentId: string;
  draftId: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  const drafts = listWorkflowDrafts(agent.draftConfig);
  const idx = drafts.findIndex((d) => d.id === input.draftId);
  if (idx < 0) throw new Error("Workflow draft not found");
  const validated = validateWorkflowDraft(drafts[idx]);
  drafts[idx] = validated;
  await persistDrafts(input.workspaceId, input.agentId, drafts);
  return validated;
}
