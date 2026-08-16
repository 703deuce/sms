import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import {
  formatBookedTimeLabel,
  scheduleAppointmentResilientForUserData,
} from "./booking-recovery";
import type { FrontDeskUserData } from "./userdata";
import {
  logRuntimeTransaction,
  transactionContextFromUserData,
  tryConfirmationSpeech,
} from "./runtime-transaction";

const SOURCE = "booking-provider-write";

/**
 * Direct backend calendar write — no AgentSession interrupt, bridge speech, or TTS.
 * Idempotency: callId + slotId (retries recover via DB lookup inside resilient book).
 */
export async function writeBookingToProvider(input: {
  userData: FrontDeskUserData;
  slot: AvailableSlot;
  slotId: string;
  attendeeEmail: string;
}): Promise<{
  booked: Awaited<ReturnType<typeof scheduleAppointmentResilientForUserData>>;
  bookedTimeLabel: string;
}> {
  const ctx = transactionContextFromUserData(input.userData);
  const idempotencyKey = `${input.userData.callId}:${input.slotId}`;
  const startMs = Date.now();

  logRuntimeTransaction(SOURCE, "booking_write_started", ctx, {
    slotId: input.slotId,
    idempotencyKey,
  });

  try {
    const booked = await scheduleAppointmentResilientForUserData({
      userData: input.userData,
      slot: input.slot,
      attendeeEmail: input.attendeeEmail,
    });
    const bookedTimeLabel = formatBookedTimeLabel(booked.slot.startTime, input.userData.timezone);

    logRuntimeTransaction(SOURCE, "booking_write_succeeded", ctx, {
      slotId: input.slotId,
      idempotencyKey,
      providerEventId: booked.eventUri,
      inviteeUri: booked.inviteeUri,
      durationMs: Date.now() - startMs,
      bookedTimeLabel,
    });

    return { booked, bookedTimeLabel };
  } catch (err) {
    logRuntimeTransaction(SOURCE, "booking_write_failed", ctx, {
      slotId: input.slotId,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
      slotUnavailable: err instanceof SlotUnavailableError,
    });
    throw err;
  }
}

export async function trySpeakAfterProviderWrite(
  session: AgentSession<FrontDeskUserData>,
  text: string,
  speak: (session: AgentSession<FrontDeskUserData>, text: string) => Promise<boolean>,
): Promise<boolean> {
  return tryConfirmationSpeech(session, "booking", text, speak);
}
