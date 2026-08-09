import { getPrisma } from "@/lib/db";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import { invalidateSchedulingState } from "@/lib/voice/session-runtime/state";
import { structuredFailure, structuredSuccess } from "@/lib/voice/tool-policy/structured-result";
import { guardToolInvocation } from "./guard";
import type { LiveKitCallContext } from "./session-bootstrap";
import type { DomainActionResult } from "./booking-actions";
import { reloadLiveKitSchedulingSession } from "./scheduling-session";

export async function domainFindAppointments(input: {
  ctx: LiveKitCallContext;
  phone?: string | null;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "find_appointments");
  if (blocked) return blocked;

  const phone = input.phone || input.ctx.session.callerAni;
  if (!phone) {
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
    raw: { phone },
  });

  const appointments = Array.isArray(result.appointments) ? result.appointments : [];
  return structuredSuccess({
    speak: appointments.length
      ? `I found ${appointments.length} upcoming appointment${appointments.length === 1 ? "" : "s"}.`
      : "I don't see an upcoming appointment on that number.",
    data: { appointments },
    nextAllowedActions: appointments.length
      ? ["check_availability", "cancel_appointment", "reschedule_appointment"]
      : ["take_message"],
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

  const operationId = `${input.ctx.callId}-reschedule-${input.appointmentId}-${input.newStartsAt}`;
  const result = await executeAgentTool({
    toolType: "reschedule_appointment",
    context: {
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callId: input.ctx.callId,
    },
    raw: {
      appointmentId: input.appointmentId,
      newStartsAt: input.newStartsAt,
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

  const operationId = `${input.ctx.callId}-cancel-${input.appointmentId}`;
  const result = await executeAgentTool({
    toolType: "cancel_appointment",
    context: {
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callId: input.ctx.callId,
    },
    raw: {
      appointmentId: input.appointmentId,
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
    where: { id: input.appointmentId, workspaceId: input.ctx.workspaceId },
    data: { status: "cancelled" },
  });

  return structuredSuccess({
    speak: "Your appointment has been cancelled.",
    workflowState: "COMPLETE",
    data: result,
  });
}
