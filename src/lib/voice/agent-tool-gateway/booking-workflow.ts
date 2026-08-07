import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  assertBookingPermission,
  assertBookingTimingGates,
  findExistingBookingForCaller,
  loadServiceBookingConfig,
} from "@/lib/voice/calendar/booking";
import { assertStartsAtMatchesAvailabilitySlots } from "@/lib/voice/calendar/booking-args";
import type { AgentToolContext, CanonicalBookInput } from "./types";
import { AgentToolError, translateError } from "./errors";
import { toolSuccess } from "./envelope";
import { bookInputToLegacyArgs, validateBookInput } from "./normalize";

export type BookingWorkflowResult = ReturnType<typeof toolSuccess>;

export async function executeBookAppointmentWorkflow(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
  normalized: CanonicalBookInput,
) {
  validateBookInput(normalized);
  const prisma = getPrisma();

  // Idempotency — same operation_id returns prior result.
  const priorRows = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: { notIn: ["cancelled", "canceled"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const prior = priorRows.find(
    (row: { metadata: unknown; status: string }) =>
      (row.metadata as Record<string, unknown> | null)?.operationId ===
      normalized.operation_id,
  );
  if (prior && prior.status !== "cancelled" && prior.status !== "canceled") {
    return toolSuccess({
      status: "already_completed",
      operation_id: normalized.operation_id,
      user_message: "Your appointment is already confirmed.",
      data: {
        appointment_id: prior.id,
        start_time: prior.startsAt.toISOString(),
        alreadyBooked: true,
        sync_status: appointmentSyncStatus(prior.metadata),
      },
    });
  }

  if (ctx.callId) {
    const existingForCall = await prisma.voiceAppointment.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        callId: ctx.callId,
        status: { notIn: ["cancelled", "canceled"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingForCall) {
      return toolSuccess({
        status: "already_completed",
        operation_id: normalized.operation_id,
        user_message: "Your appointment is already confirmed on this call.",
        data: {
          appointment_id: existingForCall.id,
          start_time: existingForCall.startsAt.toISOString(),
          alreadyBooked: true,
          sync_status: appointmentSyncStatus(existingForCall.metadata),
        },
      });
    }
  }

  if (ctx.callId) {
    const callRow = await prisma.voiceCall.findFirst({
      where: { id: ctx.callId, workspaceId: ctx.workspaceId },
      select: { metadata: true },
    });
    const meta = (callRow?.metadata || {}) as Record<string, unknown>;
    const lastSlots = Array.isArray(meta.lastAvailabilitySlots)
      ? (meta.lastAvailabilitySlots as string[])
      : [];
    assertStartsAtMatchesAvailabilitySlots(normalized.start_time, lastSlots);
  }

  if (!ctx.callId) {
    throw new AgentToolError(
      "INVALID_INPUT",
      "callId required for booking — collected fields are stored on the call session",
      false,
      "I need an active call session to complete this booking.",
    );
  }

  const { getWorkflowRequirements, ensureWorkflowFieldSession } = await import(
    "@/lib/voice/field-runtime"
  );
  const { systemFieldValueForBooking } = await import("@/lib/voice/field-runtime/system-fields");

  const requirements = await getWorkflowRequirements({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callId: ctx.callId,
    workflow: "book_appointment",
    serviceName: normalized.service_name,
  });

  if (!requirements.complete) {
    const missing = requirements.missing_fields.map((f) => f.field_id);
    throw new AgentToolError(
      "MISSING_REQUIRED_FIELD",
      `Missing required fields: ${missing.join(", ")}`,
      false,
      requirements.speak || "I still need a few details before I can book.",
      {
        session_id: requirements.session_id,
        missing_fields: requirements.missing_fields,
        active_field: requirements.active_field,
        next_action: requirements.missing_fields[0]
          ? `Call save_collected_fields with fields:[{field_id:"${requirements.missing_fields[0].field_id}", value:"<caller answer>"}] then retry book_appointment.`
          : "Call get_workflow_requirements to see what is still needed.",
      },
    );
  }

  const session = await ensureWorkflowFieldSession({
    callId: ctx.callId,
    workspaceId: ctx.workspaceId,
    workflow: "book_appointment",
    serviceName: normalized.service_name,
  });
  const bookingFields = systemFieldValueForBooking(session.fields);
  normalized.customer_name = normalized.customer_name || bookingFields.name;
  normalized.customer_phone = normalized.customer_phone || bookingFields.phone;
  normalized.customer_email = normalized.customer_email || bookingFields.email;
  normalized.address = normalized.address || bookingFields.address || null;
  if (!normalized.service_name && bookingFields.serviceName) {
    normalized.service_name = bookingFields.serviceName;
  }

  const gates = await loadServiceBookingConfig(ctx.workspaceId, normalized.service_name);
  assertBookingPermission(gates.config);

  const startsAt = new Date(normalized.start_time);
  assertBookingTimingGates({
    startsAt,
    noticeMinutes: gates.noticeMinutes,
    maxDaysAhead: gates.maxDaysAhead,
    sameDayCutoff: gates.config.sameDayCutoff,
    timezone: normalized.timezone,
  });

  const existing = await findExistingBookingForCaller({
    workspaceId: ctx.workspaceId,
    startsAt,
    serviceName: normalized.service_name,
    phone: normalized.customer_phone,
    contactId: normalized.contact_id || undefined,
  });
  if (existing) {
    return toolSuccess({
      status: "already_completed",
      operation_id: normalized.operation_id,
      user_message: "Your appointment is already confirmed.",
      data: {
        appointment_id: existing.id,
        start_time: existing.startsAt.toISOString(),
        alreadyBooked: true,
        sync_status: appointmentSyncStatus(existing.metadata),
      },
    });
  }

  const durationMinutes = gates.service?.durationMinutes || 30;
  const bufferMinutes = gates.service?.bufferMinutes || 0;
  const bufferMs = bufferMinutes * 60_000;
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const { findActiveHoldConflict } = await import("@/lib/voice/calendar/slot-holds");
  const holdClash = await findActiveHoldConflict({
    workspaceId: ctx.workspaceId,
    startsAt,
    endsAt,
    excludeCallId: ctx.callId,
    excludePhone: normalized.customer_phone || undefined,
  });
  if (holdClash) {
    throw new AgentToolError(
      "SLOT_UNAVAILABLE",
      "That time is temporarily held for another caller",
      true,
      "That time is temporarily held. I can check other openings.",
    );
  }

  const conflict = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      startsAt: { lte: new Date(endsAt.getTime() + bufferMs) },
      endsAt: { gte: new Date(startsAt.getTime() - bufferMs) },
      status: { notIn: ["cancelled", "canceled"] },
    },
  });
  if (conflict) {
    throw new AgentToolError(
      "SLOT_UNAVAILABLE",
      "Slot no longer available",
      true,
      "That time is no longer available. I can check other openings.",
    );
  }

  const { getConnectedCalendly } = await import("@/lib/voice/calendar/calendly-voice");
  const calendlyConnected = Boolean(await getConnectedCalendly(ctx.workspaceId));
  const provider = calendlyConnected ? "calendly" : "internal";
  const syncStatus = calendlyConnected ? "pending" : "not_required";

  let contactId = normalized.contact_id || null;
  if (!contactId && normalized.customer_phone) {
    const contact = await prisma.contact.findUnique({
      where: {
        workspaceId_phone: {
          workspaceId: ctx.workspaceId,
          phone: normalized.customer_phone,
        },
      },
    });
    contactId = contact?.id || null;
  }

  const appointment = await prisma.voiceAppointment.create({
    data: {
      workspaceId: ctx.workspaceId,
      callId: ctx.callId || null,
      contactId,
      serviceName: normalized.service_name,
      startsAt,
      endsAt,
      timezone: normalized.timezone,
      status: "confirmed",
      metadata: {
        operationId: normalized.operation_id,
        syncStatus,
        provider,
        inviteeName: normalized.customer_name,
        inviteeEmail: normalized.customer_email,
        inviteePhone: normalized.customer_phone,
        address: normalized.address,
        bookedVia: "agent_tool_gateway",
        workflowSessionId: session.session_id,
        collectedFields: session.fields,
      } as object,
    },
  });

  if (ctx.callId) {
    await prisma.voiceCall
      .update({
        where: { id: ctx.callId },
        data: { appointmentBooked: true, contactId: contactId || undefined },
      })
      .catch(() => undefined);
  }

  const { convertHoldToAppointment } = await import("@/lib/voice/calendar/slot-holds");
  await convertHoldToAppointment({
    workspaceId: ctx.workspaceId,
    appointmentId: appointment.id,
    callId: ctx.callId,
    phone: normalized.customer_phone,
    startsAt,
  }).catch(() => undefined);

  if (syncStatus === "pending") {
    await enqueueJob({
      jobType: "voice_appointment_provider_sync",
      queueName: "voice-calls",
      workspaceId: ctx.workspaceId,
      payload: {
        workspaceId: ctx.workspaceId,
        appointmentId: appointment.id,
        agentId: ctx.agentId || null,
        callId: ctx.callId || null,
        operationId: normalized.operation_id,
      },
      idempotencyKey: `appt-sync-${normalized.operation_id}`,
    });
  }

  const whenLabel = startsAt.toLocaleString("en-US", {
    timeZone: normalized.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return toolSuccess({
    status: "confirmed",
    operation_id: normalized.operation_id,
    user_message: `Appointment confirmed for ${whenLabel}.`,
    data: {
      appointment_id: appointment.id,
      start_time: appointment.startsAt.toISOString(),
      end_time: appointment.endsAt?.toISOString() || null,
      service_name: normalized.service_name,
      sync_status: syncStatus,
      provider,
      // Amy may tell caller they're booked — only when status is confirmed.
      may_confirm_to_caller: true,
    },
  });
}

export function appointmentSyncStatus(metadata: unknown): string {
  const m = (metadata || {}) as Record<string, unknown>;
  return String(m.syncStatus || "unknown");
}

export async function runBookAppointment(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  try {
    const { normalizeBookInput } = await import("./normalize");
    const normalized = normalizeBookInput(raw, { callId: ctx.callId });
    const result = await executeBookAppointmentWorkflow(ctx, raw, normalized);

    // Post-book side effects (notifications, SMS queue) — non-blocking for voice path.
    const appointmentId = result.data.appointment_id as string | undefined;
    if (appointmentId && result.success) {
      const { runPostBookSideEffects } = await import("@/lib/voice/appointment-post-book");
      await runPostBookSideEffects({
        workspaceId: ctx.workspaceId,
        agentId: ctx.agentId,
        callId: ctx.callId,
        appointmentId,
        name: normalized.customer_name || "Caller",
        phone: normalized.customer_phone || "",
        email: normalized.customer_email || "",
        startsAt: normalized.start_time,
        serviceName: normalized.service_name,
      }).catch(() => undefined);
    }

    return result;
  } catch (err) {
    throw translateError(err);
  }
}
