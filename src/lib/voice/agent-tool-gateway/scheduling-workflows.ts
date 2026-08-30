import { randomUUID } from "crypto";
import type { AgentToolContext } from "./types";
import { AgentToolError } from "./errors";
import { toolSuccess } from "./envelope";
import { recordOperationReceipt } from "@/lib/voice/workflow-engine/receipts";
import { appendTraceEvent } from "@/lib/voice/workflow-engine/trace";

export function deriveOperationId(
  raw: Record<string, unknown>,
  ctx: AgentToolContext,
  prefix: string,
): string {
  if (raw.operation_id) return String(raw.operation_id);
  if (raw.operationId) return String(raw.operationId);
  return `${prefix}_${ctx.callId || "nocall"}_${randomUUID().slice(0, 8)}`;
}

export async function runHoldAppointmentSlot(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  const operationId = deriveOperationId(raw, ctx, "hold");
  const { normalizeBookingToolArgs } = await import("@/lib/voice/calendar/booking-args");
  const args = normalizeBookingToolArgs(raw);
  const startsAt = new Date(String(args.startsAt || ""));
  if (Number.isNaN(startsAt.getTime())) {
    throw new AgentToolError("INVALID_INPUT", "startsAt required", false, "I need a valid time to hold.");
  }
  const serviceName = String(args.serviceName || args.service || "Appointment");
  const { loadServiceBookingConfig, assertBookingTimingGates } = await import("@/lib/voice/calendar/booking");
  const gates = await loadServiceBookingConfig(ctx.workspaceId, serviceName);
  const durationMinutes = Number(args.durationMinutes || gates.service?.durationMinutes || 30);
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  assertBookingTimingGates({
    startsAt,
    noticeMinutes: gates.noticeMinutes,
    maxDaysAhead: gates.maxDaysAhead,
    sameDayCutoff: gates.config.sameDayCutoff,
    timezone: String(args.timezone || gates.config.timezone || "America/New_York"),
  });
  const { holdAppointmentSlot } = await import("@/lib/voice/calendar/slot-holds");
  const hold = await holdAppointmentSlot({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callId: ctx.callId,
    contactId: args.contactId ? String(args.contactId) : undefined,
    phone: args.phone ? String(args.phone) : undefined,
    serviceName,
    staffName: args.staffName ? String(args.staffName) : undefined,
    startsAt,
    endsAt,
    timezone: args.timezone ? String(args.timezone) : undefined,
    expiresInSeconds: Number(args.expiresInSeconds || 180),
  });
  if (ctx.callId) {
    await recordOperationReceipt(ctx.callId, {
      operation_id: operationId,
      type: "HOLD_SLOT",
      status: "confirmed",
      provider: "internal",
      provider_reference: hold.id,
    });
    await appendTraceEvent(ctx.callId, {
      kind: "tool_success",
      tool: "hold_appointment_slot",
      operation_id: operationId,
      detail: { holdId: hold.id, startsAt: hold.startsAt },
    });
  }
  return toolSuccess({
    status: "confirmed",
    operation_id: operationId,
    user_message: "I've reserved that time while we finish the details.",
    data: {
      holdId: hold.id,
      startsAt: hold.startsAt,
      endsAt: hold.endsAt,
      expiresAt: hold.expiresAt,
      may_confirm_to_caller: true,
    },
  });
}

export async function runReleaseAppointmentHold(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  const { releaseAppointmentHold } = await import("@/lib/voice/calendar/slot-holds");
  const result = await releaseAppointmentHold({
    workspaceId: ctx.workspaceId,
    holdId: raw.holdId ? String(raw.holdId) : undefined,
    callId: ctx.callId || (raw.callId ? String(raw.callId) : undefined),
    startsAt: raw.startsAt ? new Date(String(raw.startsAt)) : undefined,
  });
  const speak =
    result.released > 0
      ? "I've released the reserved time."
      : "There was no active hold to release.";
  if (ctx.callId) {
    await appendTraceEvent(ctx.callId, {
      kind: "tool_success",
      tool: "release_appointment_hold",
      detail: result,
    });
  }
  return toolSuccess({
    status: "confirmed",
    operation_id: null,
    user_message: speak,
    data: { ...result, may_confirm_to_caller: true },
  });
}

export async function runFindAppointments(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  const { findAppointmentsForCaller } = await import("@/lib/voice/calendar/booking");
  const { normalizeE164 } = await import("@/lib/messaging/twilio-mappings");
  let phone = "";
  try {
    phone = raw.phone || raw.customerPhone || raw.customer_phone
      ? normalizeE164(String(raw.phone || raw.customerPhone || raw.customer_phone))
      : "";
  } catch {
    phone = "";
  }
  const contactId = raw.contactId ? String(raw.contactId) : "";
  if (!phone && !contactId) {
    throw new AgentToolError(
      "INVALID_INPUT",
      "phone required",
      false,
      "What phone number should I look up the appointment under?",
    );
  }
  const rows = await findAppointmentsForCaller({
    workspaceId: ctx.workspaceId,
    phone: phone || undefined,
    contactId: contactId || undefined,
    includePast: raw.includePast === true,
    limit: Number(raw.limit) || 5,
  });
  const appointments = rows.map((a) => ({
    appointmentId: a.id,
    serviceName: a.serviceName,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    timezone: a.timezone,
    status: a.status,
    staffName: a.staffName,
  }));
  if (!appointments.length) {
    return toolSuccess({
      status: "not_found",
      operation_id: null,
      user_message: "I don't see an upcoming appointment on that number. Would you like to book one?",
      data: { found: false, appointments: [] },
    });
  }
  const first = appointments[0];
  const when = new Date(first.startsAt).toLocaleString("en-US", {
    timeZone: first.timezone || "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const speak =
    appointments.length === 1
      ? `I found your ${first.serviceName || "appointment"} on ${when}.`
      : `I found ${appointments.length} upcoming appointments. The next is ${first.serviceName || "an appointment"} on ${when}.`;
  return toolSuccess({
    status: "confirmed",
    operation_id: null,
    user_message: speak,
    data: { found: true, appointments, may_confirm_to_caller: true },
  });
}

export async function runRescheduleAppointment(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const operationId = deriveOperationId(raw, ctx, "reschedule");
  const newStartAt = String(
    raw.newStartAt || raw.new_starts_at || raw.newStartsAt || raw.startsAt || "",
  );
  const appointmentId = String(raw.appointmentId || raw.appointment_id || "");
  if (!appointmentId || !newStartAt) {
    throw new AgentToolError(
      "INVALID_INPUT",
      "appointmentId and newStartAt required",
      false,
      "I need the appointment and the new time to reschedule.",
    );
  }
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId: ctx.workspaceId },
  });
  if (!appt) {
    throw new AgentToolError("CUSTOMER_NOT_FOUND", "Appointment not found", false, "I couldn't find that appointment.");
  }
  const startsAt = new Date(newStartAt);
  if (Number.isNaN(startsAt.getTime())) {
    throw new AgentToolError("INVALID_INPUT", "newStartAt invalid", false, "That doesn't look like a valid time.");
  }
  if (
    appt.startsAt &&
    Math.abs(appt.startsAt.getTime() - startsAt.getTime()) < 60_000 &&
    appt.status !== "cancelled"
  ) {
    return toolSuccess({
      status: "already_completed",
      operation_id: operationId,
      user_message: "That appointment is already at the requested time.",
      data: {
        appointmentId: appt.id,
        startsAt: appt.startsAt,
        alreadyRescheduled: true,
        may_confirm_to_caller: true,
      },
    });
  }
  const durationMs =
    appt.endsAt && appt.startsAt
      ? appt.endsAt.getTime() - appt.startsAt.getTime()
      : 30 * 60 * 1000;
  const updated = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      startsAt,
      endsAt: new Date(startsAt.getTime() + durationMs),
      status: "rescheduled",
    },
  });
  const meta = (updated.metadata || {}) as Record<string, unknown>;
  if (updated.externalId) {
    const { enqueueVoiceOutbox } = await import("@/lib/voice/outbox/voice-outbox");
    await enqueueVoiceOutbox({
      workspaceId: ctx.workspaceId,
      callId: ctx.callId,
      jobType: "voice_appointment_provider_reschedule",
      payload: {
        workspaceId: ctx.workspaceId,
        appointmentId: updated.id,
        externalId: updated.externalId,
        newStartTime: startsAt.toISOString(),
        timezone: updated.timezone || "America/New_York",
        operationId,
      },
      idempotencyKey: `reschedule-${operationId}`,
    });
  }
  if (ctx.callId) {
    await recordOperationReceipt(ctx.callId, {
      operation_id: operationId,
      type: "RESCHEDULE_APPOINTMENT",
      status: "confirmed",
      provider: String(meta.provider || "internal"),
      provider_reference: updated.externalId,
    });
  }
  return toolSuccess({
    status: "confirmed",
    operation_id: operationId,
    user_message: "I've moved that appointment. Confirm the new date and time with the caller.",
    data: {
      appointmentId: updated.id,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      serviceName: updated.serviceName,
      sync_status: updated.externalId ? "pending" : "not_required",
      may_confirm_to_caller: true,
    },
  });
}

export async function runCancelAppointment(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const operationId = deriveOperationId(raw, ctx, "cancel");
  const appointmentId = String(raw.appointmentId || "");
  if (!appointmentId) {
    throw new AgentToolError("INVALID_INPUT", "appointmentId required", false, "I need the appointment to cancel.");
  }
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId: ctx.workspaceId },
  });
  if (!appt) {
    throw new AgentToolError("CUSTOMER_NOT_FOUND", "Appointment not found", false, "I couldn't find that appointment.");
  }
  if (appt.status === "cancelled" || appt.status === "canceled") {
    return toolSuccess({
      status: "already_completed",
      operation_id: operationId,
      user_message: "That appointment is already cancelled.",
      data: { appointmentId: appt.id, alreadyCancelled: true, may_confirm_to_caller: true },
    });
  }
  const updated = await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "cancelled",
      metadata: {
        ...((appt.metadata || {}) as object),
        cancelReason: raw.reason ? String(raw.reason) : null,
        cancelledAt: new Date().toISOString(),
        operationId,
      } as object,
    },
  });
  if (updated.externalId) {
    const { enqueueVoiceOutbox } = await import("@/lib/voice/outbox/voice-outbox");
    await enqueueVoiceOutbox({
      workspaceId: ctx.workspaceId,
      callId: ctx.callId,
      jobType: "voice_appointment_provider_cancel",
      payload: {
        workspaceId: ctx.workspaceId,
        appointmentId: updated.id,
        externalId: updated.externalId,
        reason: raw.reason ? String(raw.reason) : undefined,
        operationId,
      },
      idempotencyKey: `cancel-${operationId}`,
    });
  }
  if (ctx.callId) {
    await recordOperationReceipt(ctx.callId, {
      operation_id: operationId,
      type: "CANCEL_APPOINTMENT",
      status: "confirmed",
      provider: String(((updated.metadata || {}) as Record<string, unknown>).provider || "internal"),
      provider_reference: updated.externalId,
    });
  }
  return toolSuccess({
    status: "confirmed",
    operation_id: operationId,
    user_message: "I've cancelled that appointment.",
    data: {
      appointmentId: updated.id,
      may_confirm_to_caller: true,
    },
  });
}

export async function runSendSms(ctx: AgentToolContext, raw: Record<string, unknown>) {
  const operationId = deriveOperationId(raw, ctx, "sms");
  const { getPrisma } = await import("@/lib/db");
  const { resolveVoiceSmsTemplate } = await import("@/lib/voice/sms/voice-sms-templates");
  const { sendQuickSms } = await import("@/lib/sms/send-quick");

  let to = String(raw.to || raw.phone || "").trim();
  let body = String(raw.body || "").trim();
  let idempotencyKey = `sms-${operationId}`;

  if (raw.template_id && ctx.callId) {
    const call = await getPrisma().voiceCall.findFirst({
      where: { id: ctx.callId, workspaceId: ctx.workspaceId },
      select: { fromE164: true, agentId: true },
    });
    const agent = call?.agentId
      ? await getPrisma().voiceAgent.findFirst({
          where: { id: call.agentId },
          select: { draftConfig: true },
        })
      : null;
    const cfg = agent?.draftConfig as Record<string, unknown> | undefined;
    const wizard = (cfg?.advanced as Record<string, unknown> | undefined)
      ?.appointmentReceptionistWizard as { businessName?: string; websiteUrl?: string } | undefined;
    const resolved = resolveVoiceSmsTemplate({
      templateId: String(raw.template_id),
      callId: ctx.callId,
      businessName: wizard?.businessName,
      websiteUrl: wizard?.websiteUrl,
    });
    body = resolved.body;
    idempotencyKey = resolved.idempotencyKey;
    if (!to && call?.fromE164 && call.fromE164 !== "unknown") {
      to = call.fromE164;
    }
  }

  if (!to || !body) {
    return toolSuccess({
      status: "failed",
      operation_id: operationId,
      user_message: "I need a valid number to send that text.",
      data: { ok: false, may_confirm_to_caller: false },
    });
  }

  try {
    const result = await sendQuickSms({
      workspaceId: ctx.workspaceId,
      to,
      body,
      idempotencyKey,
    });
    if (ctx.callId) {
      await recordOperationReceipt(ctx.callId, {
        operation_id: operationId,
        type: "SEND_SMS",
        status: "confirmed",
        provider: "twilio",
        provider_reference: result.sid,
      });
    }
    return toolSuccess({
      status: "confirmed",
      operation_id: operationId,
      user_message: "I just texted that to you.",
      data: {
        ok: true,
        messageId: result.sid,
        may_confirm_to_caller: true,
        template_id: raw.template_id || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (ctx.callId) {
      await recordOperationReceipt(ctx.callId, {
        operation_id: operationId,
        type: "SEND_SMS",
        status: "failed",
        provider: "twilio",
      });
    }
    return toolSuccess({
      status: "failed",
      operation_id: operationId,
      user_message: "I'm having trouble sending that text right now.",
      data: { ok: false, error: message, may_confirm_to_caller: false },
    });
  }
}
