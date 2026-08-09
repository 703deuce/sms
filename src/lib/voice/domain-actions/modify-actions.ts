import { getPrisma } from "@/lib/db";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import { refreshSessionFieldState } from "@/lib/voice/realtime-session/init";
import { recordFieldsForLiveKitVoice } from "@/lib/voice/field-runtime/save-voice-fast";
import { invalidateSchedulingState, patchSessionRuntimeExt } from "@/lib/voice/session-runtime/state";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";
import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { reloadLiveKitSchedulingSession } from "./scheduling-session";

async function hydrateSessionFromFoundAppointment(
  ctx: LiveKitCallContext,
  appointmentId: string,
): Promise<LiveKitCallContext> {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findUnique({
    where: { id: appointmentId, workspaceId: ctx.workspaceId },
    include: {
      contact: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
    },
  });
  if (!appointment) return ctx;

  const meta = (appointment.metadata || {}) as Record<string, unknown>;
  const collectedMeta = meta.collectedFields as Record<string, { value?: string }> | undefined;
  const fromCollected = (needle: string): string => {
    if (!collectedMeta) return "";
    for (const [fieldId, entry] of Object.entries(collectedMeta)) {
      if (fieldId.includes(needle) && entry?.value?.trim()) return String(entry.value).trim();
    }
    return "";
  };
  const fullName =
    String(meta.customer_name || meta.inviteeName || "").trim() ||
    [appointment.contact?.firstName, appointment.contact?.lastName].filter(Boolean).join(" ").trim();
  const email = String(appointment.contact?.email || meta.email || meta.inviteeEmail || fromCollected("email") || "").trim();
  const phone = String(
    meta.customerPhone || meta.phone || meta.inviteePhone || appointment.contact?.phone || ctx.session.callerAni || "",
  ).trim();
  const address = String(
    meta.service_address || meta.address || fromCollected("address") || "",
  ).trim();
  const problem = String(
    meta.problem || meta.notes || appointment.serviceName || ctx.session.serviceName || "",
  ).trim();

  const updates: Record<string, string> = {};
  const byId: Record<string, string> = {
    sys_name: fullName,
    sys_email: email,
    sys_phone: phone,
    fld_service_address: address,
    sys_address: address,
    fld_notes: problem,
  };
  for (const field of ctx.session.fieldManifest) {
    const id = field.field_id;
    if (ctx.session.collectedFields[id]?.trim()) continue;
    const direct = byId[id];
    if (direct) {
      updates[id] = direct;
      continue;
    }
    if (id.includes("name") && fullName) updates[id] = fullName;
    else if (id.includes("email") && email) updates[id] = email;
    else if (id.includes("phone") && phone) updates[id] = phone;
    else if (id.includes("address") && address) updates[id] = address;
    else if ((id.includes("notes") || id.includes("problem")) && problem) updates[id] = problem;
  }

  if (!Object.keys(updates).length) return ctx;

  const recorded = await recordFieldsForLiveKitVoice({
    amySession: ctx.session,
    fields: updates,
  });
  ctx.session = refreshSessionFieldState(recorded.amySession);
  return ctx;
}

export async function domainFindAppointments(input: {
  ctx: LiveKitCallContext;
  phone?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "find_appointments");
  if (blocked) return blocked;

  const prisma = getPrisma();
  let phone = input.phone || input.ctx.session.callerAni;
  if (!phone) {
    const call = await prisma.voiceCall.findUnique({
      where: { id: input.ctx.callId },
      select: { fromE164: true },
    });
    phone = call?.fromE164 || null;
  }
  const contactId = input.ctx.contactId || input.ctx.session.contactId;

  if (!phone && !contactId) {
    return structuredFailure({
      speak: "I need a phone number to look up your appointment.",
      code: "MISSING_FIELDS",
      workflowState: input.ctx.session.currentState,
    });
  }

  const result = await executeAgentTool({
    toolType: "find_appointments",
    context: {
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callId: input.ctx.callId,
    },
    raw: { phone, contactId },
  });

  const appointments = Array.isArray(result.appointments) ? result.appointments : [];
  if (!appointments.length) {
    return structuredFailure({
      speak: "I don't see an upcoming appointment on that number.",
      code: "APPOINTMENT_NOT_FOUND",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["lookup_customer", "take_message"],
      data: { appointments: [], found: false },
    });
  }

  const primary = appointments[0] as { appointmentId?: string; id?: string };
  const appointmentId = primary.appointmentId || primary.id;
  if (appointmentId) {
    input.ctx.session = patchSessionRuntimeExt(input.ctx.session, {
      currentTask: "RescheduleTask",
      foundAppointmentId: String(appointmentId),
    });
    input.ctx = await hydrateSessionFromFoundAppointment(input.ctx, String(appointmentId));
  }

  return structuredSuccess({
    speak: `I found ${appointments.length} upcoming appointment${appointments.length === 1 ? "" : "s"}.`,
    data: { appointments, found: true },
    nextAllowedActions: ["check_availability", "cancel_appointment", "reschedule_appointment"],
  });
}

export async function domainRescheduleAppointment(input: {
  ctx: LiveKitCallContext;
  appointmentId: string;
  newStartsAt: string;
  confirmed?: boolean;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "reschedule_appointment");
  if (blocked) return blocked;

  if (!input.confirmed) {
    return structuredFailure({
      speak: "Would you like me to move your appointment to that new time?",
      code: "PRECONDITION_FAILED",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["reschedule_appointment"],
      data: { requiresConfirmation: true },
    });
  }

  const appointmentId =
    input.appointmentId ||
    input.ctx.session.runtime.session_runtime?.foundAppointmentId ||
    "";
  if (!appointmentId) {
    return structuredFailure({
      speak: "I need to find your appointment before I can reschedule it.",
      code: "MISSING_FIELDS",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["find_appointments"],
    });
  }

  const newStartsAt =
    input.newStartsAt ||
    input.ctx.session.heldSlot ||
    input.ctx.session.selectedSlot ||
    input.ctx.session.runtime.held_slot ||
    "";

  if (!newStartsAt) {
    return structuredFailure({
      speak: "I need to know which new time you'd like before I can reschedule.",
      code: "MISSING_FIELDS",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["select_slot", "check_availability"],
    });
  }

  const operationId = `${input.ctx.callId}-reschedule-${appointmentId}-${newStartsAt}`;
  const result = await executeAgentTool({
    toolType: "reschedule_appointment",
    context: {
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callId: input.ctx.callId,
    },
    raw: {
      appointmentId,
      newStartAt: newStartsAt,
      new_starts_at: newStartsAt,
      operation_id: operationId,
      timezone: input.ctx.session.timezone,
    },
  });

  if (result.ok === false) {
    return structuredFailure({
      speak: String(result.message || "I couldn't reschedule that appointment."),
      code: "PROVIDER_UNAVAILABLE",
      workflowState: input.ctx.session.currentState,
      retryable: true,
    });
  }

  input.ctx.session = invalidateSchedulingState(input.ctx.session, "rescheduled");
  await reloadLiveKitSchedulingSession(input.ctx, {
    ok: true,
    workflow_state: "COMPLETE",
    data: result,
  });

  return structuredSuccess({
    speak: "Your appointment has been rescheduled. I'll send an updated confirmation.",
    workflowState: "COMPLETE",
    data: result,
  });
}

export async function domainCancelAppointment(input: {
  ctx: LiveKitCallContext;
  appointmentId: string;
  confirmed?: boolean;
  reason?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "cancel_appointment");
  if (blocked) return blocked;

  if (!input.confirmed) {
    return structuredFailure({
      speak: "Are you sure you'd like to cancel that appointment?",
      code: "PRECONDITION_FAILED",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["cancel_appointment"],
      data: { requiresConfirmation: true },
    });
  }

  const appointmentId =
    input.appointmentId ||
    input.ctx.session.runtime.session_runtime?.foundAppointmentId ||
    "";
  if (!appointmentId) {
    return structuredFailure({
      speak: "I need to find your appointment before I can cancel it.",
      code: "MISSING_FIELDS",
      workflowState: input.ctx.session.currentState,
      nextAllowedActions: ["find_appointments"],
    });
  }

  const operationId = `${input.ctx.callId}-cancel-${appointmentId}`;
  const result = await executeAgentTool({
    toolType: "cancel_appointment",
    context: {
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callId: input.ctx.callId,
    },
    raw: {
      appointmentId,
      reason: input.reason || "Caller requested cancellation",
      operation_id: operationId,
    },
  });

  if (result.ok === false) {
    return structuredFailure({
      speak: String(result.message || "I couldn't cancel that appointment."),
      code: "PROVIDER_UNAVAILABLE",
      workflowState: input.ctx.session.currentState,
    });
  }

  const prisma = getPrisma();
  await prisma.voiceAppointment.updateMany({
    where: { id: appointmentId, workspaceId: input.ctx.workspaceId },
    data: { status: "cancelled" },
  });

  return structuredSuccess({
    speak: "Your appointment has been cancelled.",
    workflowState: "COMPLETE",
    data: result,
  });
}
