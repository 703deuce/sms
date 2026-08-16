import { getPrisma } from "@/lib/db";
import { markVoiceCallBooked } from "@/lib/voice/runtime-provider/livekit-call-telemetry";
import { syncFrontDeskBookingToCrm } from "@/lib/voice/crm/frontdesk-crm-sync";
import { buildBookingSuccessLine } from "../../../../voice-runtime/src/booking-completion-messages";
import {
  formatBookedTimeLabel,
  lookupAppointmentIdForCallWithRetry,
  scheduleAppointmentResilientForUserData,
} from "../../../../voice-runtime/src/frontdesk/booking-recovery";
import { CalendlyCalendar } from "../../../../voice-runtime/src/frontdesk/calendly-calendar";
import { markBookingConfirmed, type FrontDeskUserData } from "../../../../voice-runtime/src/frontdesk/userdata";
import { getAvailabilityForPython } from "./get-availability-for-python";
import type { PythonRuntimeError } from "./types";

function buildMinimalUserData(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  timezone: string;
  businessName: string;
  callerE164?: string;
  fields: Record<string, string>;
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
    receptionistFields: { ...input.fields },
  };
}

/** Lightweight Calendly commit — no handlers.ts / booking-provider-write chain. */
export async function commitBookingForPython(input: {
  workspaceId: string;
  agentId: string;
  callId: string;
  slotId: string;
  timezone: string;
  businessName: string;
  callerE164?: string;
  fields: Record<string, string>;
  attendeeEmail?: string;
  eventTypeUri?: string | null;
  offeredSlotIds?: string[];
}): Promise<
  | {
      ok: true;
      bookedTimeLabel: string;
      confirmationSpeech: string;
      providerEventId?: string;
      alreadyBooked?: boolean;
      receiptPersisted?: boolean;
    }
  | PythonRuntimeError
> {
  if (input.offeredSlotIds?.length && !input.offeredSlotIds.includes(input.slotId)) {
    return { ok: false, error: "Slot was not in the offered set", code: "INVALID_SLOT" };
  }

  const prisma = getPrisma();
  const callRow = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const priorMeta =
    callRow?.metadata && typeof callRow.metadata === "object" && !Array.isArray(callRow.metadata)
      ? (callRow.metadata as Record<string, unknown>)
      : {};
  const existingReceipt = priorMeta.pythonBookingReceipt as
    | { bookedTimeLabel?: string; slotId?: string }
    | undefined;
  if (existingReceipt?.slotId) {
    const label = existingReceipt.bookedTimeLabel || "your appointment";
    return {
      ok: true,
      bookedTimeLabel: label,
      confirmationSpeech: buildBookingSuccessLine(label),
      alreadyBooked: true,
      receiptPersisted: true,
    };
  }

  const existingAppt = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      status: { notIn: ["cancelled", "canceled"] },
    },
    select: { startsAt: true },
  });
  if (existingAppt?.startsAt) {
    const label = existingAppt.startsAt.toLocaleString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: input.timezone,
    });
    return {
      ok: true,
      bookedTimeLabel: label,
      confirmationSpeech: buildBookingSuccessLine(label),
      alreadyBooked: true,
      receiptPersisted: true,
    };
  }

  const userData = buildMinimalUserData(input);
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

  const emailField = Object.entries(input.fields).find(([id]) => id === "email" || id.endsWith("_email"));
  const attendeeEmail = input.attendeeEmail?.trim() || emailField?.[1]?.trim();
  if (!attendeeEmail) {
    return { ok: false, error: "Email required for booking", code: "MISSING_EMAIL" };
  }

  const calSlot = {
    slotId: slot.slotId,
    startTime: new Date(slot.startTimeIso),
    durationMin: slot.durationMin,
  };

  try {
    const booked = await scheduleAppointmentResilientForUserData({
      userData,
      slot: calSlot,
      attendeeEmail,
    });
    const bookedTimeLabel = formatBookedTimeLabel(booked.slot.startTime, input.timezone);

    markBookingConfirmed(userData, {
      slotId: input.slotId,
      bookedTimeLabel,
      providerEventId: booked.eventUri,
      appointmentId: booked.inviteeUri,
    });

    void markVoiceCallBooked({
      workspaceId: input.workspaceId,
      callId: input.callId,
      appointmentId: booked.inviteeUri,
      externalId: booked.eventUri,
    });

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

    const { sendVoiceBookingConfirmationSms } = await import("@/lib/voice/booking-confirmation-sms");
    void sendVoiceBookingConfirmationSms({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      startsAt: calSlot.startTime,
      businessName: input.businessName,
      timezone: input.timezone,
    }).catch((err) => {
      console.warn(
        JSON.stringify({
          source: "python-voice-runtime-bridge",
          event: "booking_confirmation_sms_failed",
          callId: input.callId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    });

    const confirmationSpeech = buildBookingSuccessLine(bookedTimeLabel);

    const existing = await prisma.voiceCall.findFirst({
      where: { id: input.callId },
      select: { metadata: true },
    });
    const callMeta =
      existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};

    await prisma.voiceCall.update({
      where: { id: input.callId },
      data: {
        status: "COMPLETED",
        metadata: {
          ...callMeta,
          pythonBookingReceipt: {
            slotId: input.slotId,
            bookedTimeLabel,
            providerEventId: booked.eventUri,
            appointmentId: booked.inviteeUri,
            committedAt: new Date().toISOString(),
          },
        } as object,
      },
    });

    console.log(
      JSON.stringify({
        source: "voice-python",
        event: "receipt_persisted",
        callId: input.callId,
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        slotId: input.slotId,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      ok: true,
      bookedTimeLabel,
      confirmationSpeech,
      providerEventId: booked.eventUri,
      receiptPersisted: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: "BOOKING_WRITE_FAILED",
    };
  }
}
