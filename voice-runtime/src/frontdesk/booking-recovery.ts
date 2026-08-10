import { getPrisma } from "@/lib/db";
import type { AgentSession } from "@livekit/agents";
import { safeInterruptSession } from "../session-utils";
import type { AvailableSlot, BookedAppointment } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import { isBookingConfirmed, markBookingConfirmed, type FrontDeskUserData } from "./userdata";

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
      status: { not: "cancelled" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      startsAt: true,
      endsAt: true,
      externalId: true,
      inviteeEmail: true,
      metadata: true,
    },
  });
  if (!appt?.startsAt || !appt.externalId) return null;

  const meta = appt.metadata as { inviteeUri?: string } | null;
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
    attendeeEmail: appt.inviteeEmail || "",
    inviteeUri: meta?.inviteeUri || "",
    eventUri,
  };
}

/**
 * Book through Calendly without coupling success to LiveKit speech-handle state.
 * Verifies DB after failures so a succeeded-but-interrupted attempt still counts.
 */
export async function scheduleAppointmentResilient(input: {
  session: AgentSession<FrontDeskUserData>;
  slot: AvailableSlot;
  attendeeEmail: string;
}): Promise<BookedAppointment> {
  const { session, slot, attendeeEmail } = input;
  const { workspaceId, callId, cal } = session.userData;

  const markBookedOnUserData = (booked: BookedAppointment, slotId?: string) => {
    const bookedTimeLabel = formatBookedTimeLabel(
      booked.slot.startTime,
      session.userData.timezone,
    );
    markBookingConfirmed(session.userData, {
      slotId: slotId || session.userData.pendingSlotId,
      providerEventId: booked.eventUri,
      bookedTimeLabel,
    });
  };

  const existing = await findExistingBookingForCall(workspaceId, callId);
  if (existing) {
    markBookedOnUserData(existing);
    return existing;
  }

  await safeInterruptSession(session);

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
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

      if (attempt < 1) {
        await new Promise((resolve) => setTimeout(resolve, BOOKING_RETRY_DELAY_MS));
      }
    }
  }

  throw lastError;
}
