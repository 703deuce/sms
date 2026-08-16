import type { AgentSession } from "@livekit/agents";
import { getPrisma } from "@/lib/db";
import type { AvailableSlot, BookedAppointment } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import { isBookingConfirmed, markBookingConfirmed, type FrontDeskUserData } from "./userdata";
import {
  CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS,
  isCalendlyAlreadyCancelledError,
  isCalendlyRateLimitError,
} from "../booking-error";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { cancelAppointment as cancelCalendlyEvent } from "@/lib/integrations/adapters/calendly-actions";

const BOOKING_RETRY_DELAY_MS = 400;

export function formatBookedTimeLabel(
  startTime: Date,
  timezone: string,
): string {
  return startTime.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** Caller-visible success when booking already completed this call. */
export function alreadyBookedToolMessage(userData: FrontDeskUserData): string | null {
  if (!isBookingConfirmed(userData)) return null;
  const when =
    userData.booking?.bookedTimeLabel || userData.bookedTimeLabel || "the time you chose";
  return (
    `already_completed: The appointment is already confirmed for ${when}. ` +
    "Tell the caller they're all set and a confirmation text was sent — do not book again or re-ask for email."
  );
}

async function findExistingBookingForCall(
  workspaceId: string,
  callId: string,
): Promise<BookedAppointment | null> {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      callId,
      status: { notIn: ["cancelled", "canceled"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      startsAt: true,
      endsAt: true,
      externalId: true,
      metadata: true,
    },
  });
  if (!appt?.startsAt || !appt.externalId) return null;

  const meta = appt.metadata as { inviteeUri?: string; inviteeEmail?: string } | null;
  const durationMin = appt.endsAt
    ? Math.max(1, Math.round((appt.endsAt.getTime() - appt.startsAt.getTime()) / 60_000))
    : 30;
  const eventUri = appt.externalId.startsWith("calendly:")
    ? appt.externalId.slice("calendly:".length)
    : appt.externalId;

  return {
    slot: {
      startTime: appt.startsAt,
      durationMin,
      slotId: "",
    },
    attendeeEmail: meta?.inviteeEmail || "",
    inviteeUri: meta?.inviteeUri || "",
    eventUri,
  };
}

/**
 * Book through Calendly without coupling success to LiveKit speech-handle state.
 * Verifies DB after failures so a succeeded-but-interrupted attempt still counts.
 */
export async function scheduleAppointmentResilientForUserData(input: {
  userData: FrontDeskUserData;
  slot: AvailableSlot;
  attendeeEmail: string;
}): Promise<BookedAppointment> {
  const { userData, slot, attendeeEmail } = input;
  const { workspaceId, callId, cal } = userData;

  const markBookedOnUserData = (booked: BookedAppointment, slotId?: string) => {
    const bookedTimeLabel = formatBookedTimeLabel(booked.slot.startTime, userData.timezone);
    markBookingConfirmed(userData, {
      slotId: slotId || userData.pendingSlotId,
      providerEventId: booked.eventUri,
      bookedTimeLabel,
    });
  };

  const existing = await findExistingBookingForCall(workspaceId, callId);
  if (existing) {
    markBookedOnUserData(existing);
    return existing;
  }

  let lastError: unknown;
  const maxAttempts = 1 + CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS.length;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const booked = await cal.scheduleAppointment({ slot, attendeeEmail });
      markBookedOnUserData(booked, slot.slotId);
      return booked;
    } catch (err) {
      lastError = err;
      if (err instanceof SlotUnavailableError) throw err;

      const recovered = await findExistingBookingForCall(workspaceId, callId);
      if (recovered) {
        markBookedOnUserData(recovered);
        return recovered;
      }

      if (isCalendlyRateLimitError(err) && attempt < CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS[attempt]),
        );
        continue;
      }

      if (attempt < maxAttempts - 1 && !isCalendlyRateLimitError(err)) {
        await new Promise((resolve) => setTimeout(resolve, BOOKING_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}

/** Session wrapper — provider write uses userData only (no AgentSession lifecycle). */
export async function scheduleAppointmentResilient(input: {
  session: AgentSession<FrontDeskUserData>;
  slot: AvailableSlot;
  attendeeEmail: string;
}): Promise<BookedAppointment> {
  return scheduleAppointmentResilientForUserData({
    userData: input.session.userData,
    slot: input.slot,
    attendeeEmail: input.attendeeEmail,
  });
}

export async function lookupAppointmentIdForCall(input: {
  workspaceId: string;
  callId: string;
  eventUri?: string | null;
}): Promise<string | null> {
  const prisma = getPrisma();
  const externalId = input.eventUri
    ? input.eventUri.startsWith("calendly:")
      ? input.eventUri
      : `calendly:${input.eventUri}`
    : null;

  const appt = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      ...(externalId ? { externalId } : {}),
      status: { notIn: ["cancelled", "canceled"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return appt?.id || null;
}

/** Product persist after Calendly book can lag briefly — retry before CRM sync. */
export async function lookupAppointmentIdForCallWithRetry(input: {
  workspaceId: string;
  callId: string;
  eventUri?: string | null;
  attempts?: number;
  delayMs?: number;
}): Promise<string | null> {
  const attempts = input.attempts ?? 6;
  const delayMs = input.delayMs ?? 250;
  for (let i = 0; i < attempts; i++) {
    const id = await lookupAppointmentIdForCall(input);
    if (id) return id;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return lookupAppointmentIdForCall({
    workspaceId: input.workspaceId,
    callId: input.callId,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Reschedule: book new slot first, update canonical row, cancel old Calendly event. */
export async function rescheduleAppointmentResilient(input: {
  session: AgentSession<FrontDeskUserData>;
  appointmentId: string;
  oldEventUri: string | null;
  slot: AvailableSlot;
  attendeeEmail: string;
  existingMetadata?: unknown;
}): Promise<BookedAppointment> {
  const { session, slot, attendeeEmail, appointmentId, oldEventUri, existingMetadata } = input;
  const { workspaceId, callId, cal } = session.userData;

  const booked = await cal.scheduleAppointment({ slot, attendeeEmail });
  const bookedTimeLabel = formatBookedTimeLabel(booked.slot.startTime, session.userData.timezone);

  const prisma = getPrisma();
  const externalId = booked.eventUri.startsWith("calendly:")
    ? booked.eventUri
    : `calendly:${booked.eventUri}`;
  const endsAt = new Date(booked.slot.startTime.getTime() + booked.slot.durationMin * 60_000);
  const priorMeta = asRecord(existingMetadata);

  // appointment.book write-through may create a duplicate row — keep the canonical one.
  await prisma.voiceAppointment.deleteMany({
    where: {
      workspaceId,
      callId,
      externalId,
      id: { not: appointmentId },
    },
  });

  await prisma.voiceAppointment.update({
    where: { id: appointmentId, workspaceId },
    data: {
      startsAt: booked.slot.startTime,
      endsAt,
      externalId,
      status: "confirmed",
      metadata: {
        ...priorMeta,
        inviteeUri: booked.inviteeUri,
        inviteeEmail: attendeeEmail,
        rescheduledAt: new Date().toISOString(),
        rescheduledVia: "frontdesk_voice",
        previousExternalId: oldEventUri || priorMeta.previousExternalId || null,
      },
    },
  });

  if (oldEventUri) {
    try {
      await cancelCalendlyEventResilient({
        workspaceId,
        eventUri: oldEventUri,
        reason: "Rescheduled by caller on phone",
      });
    } catch (err) {
      console.warn(
        JSON.stringify({
          source: "frontdesk-reschedule",
          event: "old_event_cancel_failed",
          callId,
          appointmentId,
          oldEventUri,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  markBookingConfirmed(session.userData, {
    slotId: slot.slotId,
    providerEventId: booked.eventUri,
    appointmentId,
    bookedTimeLabel,
  });

  await prisma.voiceCall
    .update({
      where: { id: callId },
      data: { appointmentBooked: true, outcome: "appointment_rescheduled" },
    })
    .catch(() => undefined);

  return booked;
}

/** Cancel on Calendly with timeout, retries, and idempotent already-cancelled handling. */
export async function cancelCalendlyEventResilient(input: {
  workspaceId: string;
  eventUri: string;
  reason?: string;
}): Promise<void> {
  const ctx = await buildAdapterContext(input.workspaceId, "calendly");
  let lastError: unknown;
  const maxAttempts = 1 + CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS.length;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await cancelCalendlyEvent(ctx, {
        eventUri: input.eventUri,
        reason: input.reason || "Canceled by caller on phone",
      });
      return;
    } catch (err) {
      if (isCalendlyAlreadyCancelledError(err)) return;
      lastError = err;
      if (isCalendlyRateLimitError(err) && attempt < CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, CALENDLY_RATE_LIMIT_RETRY_DELAYS_MS[attempt]),
        );
        continue;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, BOOKING_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}
