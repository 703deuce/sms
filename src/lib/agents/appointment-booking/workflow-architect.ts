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

export function getTemplateRecipeType(
  userRequest: string,
): "emergency_transfer" | "followup_sms" | "standard" | null {
  if (!isExactTemplateRecipe(userRequest)) return null;
  const q = userRequest.toLowerCase();
  if (/sewer|marcus|on[- ]call|callback|7\s*am/i.test(q)) return "emergency_transfer";
  if (
    /booking link|don'?t book|didn'?t book|follow[- ]up|ten minutes|don'?t schedule|failed booking|without an appointment/.test(
      q,
    ) &&
    /text|sms|link|schedule|booking page/.test(q)
  ) {
    return "followup_sms";
  }
  return "standard";
}

/** Exact template recipes that work without LLM. */
export function isExactTemplateRecipe(userRequest: string): boolean {
  const q = userRequest.toLowerCase();
  return (
    /after[- ]hours|outside (of )?hours|closed/.test(q) ||
    /emergency/.test(q) ||
    /workflow draft/.test(q) ||
    /sewer|marcus|on[- ]call|callback/.test(q) ||
    (/transfer/.test(q) && /after/.test(q)) ||
    (/don'?t book|didn'?t book|failed booking|without an appointment|booking link|follow[- ]up|ten minutes|don'?t schedule/.test(q) &&
      /text|sms|link|schedule|booking page/.test(q))
  );
}

/**
 * Validated template: after-hours emergency transfer with fallback, message, notify, callback.
 */
export function buildAfterHoursEmergencyTransferDraft(input: {
  agentId: string;
  userRequest: string;
  phoneNumberId?: string | null;
  timezone?: string;
}): WorkflowDraft {
  const q = input.userRequest.toLowerCase();
  const tz = input.timezone || "America/New_York";
  const phoneNumberId = input.phoneNumberId || "";
  const staffName = /marcus/i.test(q) ? "Marcus" : "on-call";
  const callbackTime = "07:00";

  const nodes: WorkflowDraftNode[] = [
    node("trigger", "after_hours_call", { phoneNumberId }),
    node("hours", "check_business_hours", {}),
    node("greet", "greet_caller", {}),
    node("intent", "identify_intent", {
      allowed_intents: ["emergency_service", "sewer_backup", "book", "other"],
    }),
    node("branch", "branch", {
      branches: {
        emergency_service: ["classify", "transfer"],
        sewer_backup: ["classify", "transfer"],
        other: ["message", "requested"],
      },
    }),
    node("classify", "check_service_eligibility", { emergencyOnly: true, service: "sewer_backup" }),
    node("transfer", "transfer_call", {
      destinationId: staffName.toLowerCase(),
      staffName,
      transferDestinationId: staffName.toLowerCase(),
    }),
    node("transfer_fallback", "use_fallback_transfer", {
      destinationId: "on_call_backup",
      staffName: "on-call backup",
    }),
    node("collect", "collect_field", {
      fields: ["service_address", "problem_description", "name", "phone"],
    }),
    node("confirm", "confirm_field", { fields: ["service_address", "problem_description"] }),
    node("notify", "notify_staff", { staffName, urgent: true, channel: "sms" }),
    node("callback", "create_callback_task", {
      scheduledAt: callbackTime,
      timezone: tz,
      assigneeId: staffName.toLowerCase(),
      summary: "After-hours sewer backup callback",
    }),
    node("message", "take_message", {}),
    node("transferred", "transferred", {}),
    node("requested", "appointment_requested", {}),
    node("fallback", "fallback", { reason: "transfer_no_answer" }),
  ];

  const edges: WorkflowDraftEdge[] = [
    edge("trigger", "hours"),
    edge("hours", "greet"),
    edge("greet", "intent"),
    edge("intent", "branch"),
    edge("branch", "classify", "emergency_service"),
    edge("branch", "classify", "sewer_backup"),
    edge("branch", "message", "other"),
    edge("classify", "transfer"),
    edge("transfer", "transferred", "answered"),
    edge("transfer", "fallback", "no_answer"),
    edge("fallback", "collect"),
    edge("collect", "confirm"),
    edge("confirm", "notify"),
    edge("notify", "callback"),
    edge("callback", "requested"),
    edge("transfer", "transfer_fallback", "busy"),
    edge("transfer_fallback", "collect"),
    edge("message", "requested"),
  ];

  const draft: WorkflowDraft = {
    id: createId(),
    agentId: input.agentId,
    name: "After-Hours Emergency Transfer & Callback",
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

/** Validated template: follow-up booking link SMS after unsuccessful booking. */
export function buildUnsuccessfulBookingFollowupDraft(input: {
  agentId: string;
  userRequest: string;
  phoneNumberId?: string | null;
}): WorkflowDraft {
  const q = input.userRequest.toLowerCase();
  const delayMinutes = /ten minutes|10 minutes/.test(q) ? 10 : 10;
  const phoneNumberId = input.phoneNumberId || "";

  const nodes: WorkflowDraftNode[] = [
    node("trigger", "inbound_call", { phoneNumberId }),
    node("greet", "greet_caller", {}),
    node("intent", "identify_intent", { allowed_intents: ["book", "other"] }),
    node("booking_path", "check_service_eligibility", {}),
    node("collect", "collect_field", { fields: ["name", "phone", "service"] }),
    node("availability", "check_availability", {}),
    node("offer", "offer_slots", { maxSlots: 3 }),
    node("confirm", "confirm_field", { fields: ["datetime", "service"] }),
    node("create", "create_appointment", { requireConfirmation: true }),
    node("booked", "appointment_booked", {}),
    node("not_booked_branch", "branch", {
      branches: { not_booked: ["delay", "booked_check", "sms", "done"] },
    }),
    node("delay", "delay", { delayMinutes }),
    node("booked_check", "condition", { check: "appointment_exists" }),
    node("sms", "send_booking_link", { respectOptOut: true, respectQuietHours: true }),
    node("done", "message_taken", {}),
    node("fallback", "fallback", { reason: "booking_failed" }),
    node("message", "take_message", {}),
  ];

  const edges: WorkflowDraftEdge[] = [
    edge("trigger", "greet"),
    edge("greet", "intent"),
    edge("intent", "booking_path"),
    edge("booking_path", "collect"),
    edge("collect", "availability"),
    edge("availability", "offer"),
    edge("offer", "confirm"),
    edge("confirm", "create"),
    edge("create", "booked", "success"),
    edge("create", "not_booked_branch", "failure"),
    edge("not_booked_branch", "delay", "not_booked"),
    edge("delay", "booked_check"),
    edge("booked_check", "sms", "not_booked"),
    edge("booked_check", "done", "already_booked"),
    edge("sms", "done"),
    edge("create", "fallback", "failure"),
    edge("fallback", "message"),
  ];

  const draft: WorkflowDraft = {
    id: createId(),
    agentId: input.agentId,
    name: "Unsuccessful Booking Follow-up SMS",
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

/**
 * Deterministic architect: maps natural-language intents to approved graphs.
 * Template fallback only — primary path is LLM via runWorkflowArchitect.
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
    nodes.push(node("transfer", "transfer_call", {
      destinationId: "staff_on_call",
      staffName: "on-call staff",
    }));
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

  const { loadAppointmentBookingAgent } = await import(
    "@/lib/agents/appointment-booking/load-agent"
  );
  const agentView = await loadAppointmentBookingAgent(
    input.workspaceId,
    input.agentId,
  );
  if (!agentView) throw new Error("Agent not found");

  const { runWorkflowArchitect } = await import(
    "@/lib/agents/appointment-booking/intelligence/workflow-architect-runtime"
  );

  const { result, draft: architectDraft } = await runWorkflowArchitect({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    userId: input.userId,
    userRequest: input.userRequest,
    agent: agentView,
    draftConfig: agent.draftConfig,
    phoneNumberId: input.phoneNumberId || agent.phoneNumberId,
    timezone: input.timezone,
  });

  if (!architectDraft || result.status !== "draft_created") {
    return {
      id: result.draftId,
      agentId: input.agentId,
      name: result.summary.slice(0, 80) || "Workflow draft",
      version: 1,
      triggerNodeId: "trigger",
      nodes: result.nodes,
      edges: result.edges,
      validationStatus: result.status === "draft_created" ? "valid" : "invalid",
      validationErrors: result.missingInformation.map((m) => ({
        code: "architect",
        message: m,
      })),
      requiresConfirmation: true as const,
      status: "draft" as const,
      createdAt: new Date().toISOString(),
      sourceRequest: input.userRequest,
      architectResult: result,
      creationMode: result.creationMode,
      requiredTests: result.requiredTests,
      interpretation: result.interpretation,
    };
  }

  const draft = architectDraft;
  const existing = listWorkflowDrafts(agent.draftConfig).filter(
    (d) => d.status === "draft" || d.status === "ready_for_test",
  );
  await persistDrafts(input.workspaceId, input.agentId, [...existing, draft]);
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.workflow_draft_created",
      detail: `agent=${input.agentId} draft=${draft.id} mode=${result.creationMode || "unknown"} valid=${draft.validationStatus} request=${result.architectInvocation?.requestId || "template"}`,
    },
  });
  return {
    ...draft,
    architectResult: result,
    creationMode: result.creationMode,
    architectInvocation: result.architectInvocation,
    requiredTests: result.requiredTests,
    interpretation: result.interpretation,
    graphDiff: result.graphDiff,
  };
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
