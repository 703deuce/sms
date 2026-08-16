import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import {
  emailFromAppointmentMetadata,
  resolveVoiceAppointmentForBridge,
} from "@/lib/voice/frontdesk/resolve-voice-appointment";
import { buildBookingSuccessLine } from "../../../../voice-runtime/src/booking-completion-messages";
import {
  formatBookedTimeLabel,
  lookupAppointmentIdForCallWithRetry,
  rescheduleAppointmentResilientForUserData,
} from "../../../../voice-runtime/src/frontdesk/booking-recovery";
import { CalendlyCalendar } from "../../../../voice-runtime/src/frontdesk/calendly-calendar";
import type { FrontDeskUserData } from "../../../../voice-runtime/src/frontdesk/userdata";
import { getAvailabilityForPython } from "./get-availability-for-python";
import type { PythonRuntimeError } from "./types";

function buildMinimalUserData(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  timezone: string;
  businessName: string;
  callerE164?: string;
  eventTypeUri?: string | null;
}): FrontDeskUserData {
  const cal = CalendlyCalendar.create({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    timezone: input.timezone,
    eventTypeUri: input.eventTypeUri,
  });
  return {
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    businessName: input.businessName,
    timezone: input.timezone,
    cal,
    slotUnavailableCount: 0,
    callerE164: input.callerE164,
  };
}

function externalEventUri(externalId: string | null | undefined): string | null {
  if (!externalId) return null;
  const raw = externalId.startsWith("calendly:") ? externalId.slice("calendly:".length) : externalId;
  return raw.trim() || null;
}

/** Reschedule via Calendly book-new + cancel-old — CRM sync on success. */
export async function rescheduleBookingForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  slotId: string;
  timezone: string;
  businessName: string;
  callerE164?: string;
  appointmentId?: string;
  attendeeEmail?: string;
  eventTypeUri?: string | null;
  offeredSlotIds?: string[];
  confirmed?: boolean;
  bookingConfirmedOnCall?: boolean;
  pendingSlotId?: string;
}): Promise<
  | {
      ok: true;
      bookedTimeLabel: string;
      confirmationSpeech: string;
      appointmentId: string;
      providerEventId?: string;
    }
  | PythonRuntimeError
> {
  if (!input.confirmed) {
    return {
      ok: false,
      error: "Caller must confirm the new time before rescheduling",
      code: "CONFIRMATION_REQUIRED",
    };
  }

  if (input.offeredSlotIds?.length && !input.offeredSlotIds.includes(input.slotId)) {
    return { ok: false, error: "Slot was not in the offered set", code: "INVALID_SLOT" };
  }

  const resolved = await resolveVoiceAppointmentForBridge({
    workspaceId: input.workspaceId,
    callId: input.callId,
    timezone: input.timezone,
    callerE164: input.callerE164,
    appointmentId: input.appointmentId,
    action: "reschedule",
    bookingConfirmedOnCall: input.bookingConfirmedOnCall,
    pendingSlotId: input.pendingSlotId,
  });
  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.message,
      code: resolved.code,
      ...(resolved.appointmentOptions
        ? { appointmentOptions: resolved.appointmentOptions }
        : {}),
    };
  }

  const appointment = resolved.appointment;
  const availability = await getAvailabilityForPython({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    timezone: input.timezone,
    eventTypeUri: input.eventTypeUri,
  });
  if (!availability.ok) return availability;

  const slot = availability.slots.find((s) => s.slotId === input.slotId);
  if (!slot) {
    return { ok: false, error: "Slot not found", code: "INVALID_SLOT" };
  }

  const attendeeEmail =
    input.attendeeEmail?.trim() ||
    emailFromAppointmentMetadata(appointment.metadata) ||
    "";
  if (!attendeeEmail) {
    return { ok: false, error: "Email required for reschedule", code: "MISSING_EMAIL" };
  }

  const userData = buildMinimalUserData(input);
  const calSlot = {
    slotId: slot.slotId,
    startTime: new Date(slot.startTimeIso),
    durationMin: slot.durationMin,
  };
  const oldEventUri = externalEventUri(appointment.externalId);

  try {
    const booked = await rescheduleAppointmentResilientForUserData({
      userData,
      appointmentId: appointment.id,
      oldEventUri,
      slot: calSlot,
      attendeeEmail,
      existingMetadata: appointment.metadata,
      idempotencyKey: `${input.callId}:reschedule:${appointment.id}:${input.slotId}`,
    });

    const bookedTimeLabel = formatBookedTimeLabel(booked.slot.startTime, input.timezone);
    const confirmationSpeech = buildBookingSuccessLine(bookedTimeLabel);

    void lookupAppointmentIdForCallWithRetry({
      workspaceId: input.workspaceId,
      callId: input.callId,
      eventUri: booked.eventUri,
    }).then((appointmentId) => {
      if (!appointmentId) return;
      void syncFrontDeskBookingToCrm({
        workspaceId: input.workspaceId,
        callId: input.callId,
        appointmentId,
        callerE164: input.callerE164,
        email: attendeeEmail,
        businessName: input.businessName,
      }).catch(() => undefined);
    });

    return {
      ok: true,
      bookedTimeLabel,
      confirmationSpeech,
      appointmentId: appointment.id,
      providerEventId: booked.eventUri,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "RESCHEDULE_FAILED",
    };
  }
}
