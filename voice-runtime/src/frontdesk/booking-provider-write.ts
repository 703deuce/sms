import type { AgentSession } from "@livekit/agents";
import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import {
  formatBookedTimeLabel,
  scheduleAppointmentResilientForUserData,
} from "./booking-recovery";
import type { FrontDeskUserData } from "./userdata";

function logProviderWrite(
  event: string,
  userData: FrontDeskUserData,
  extra?: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      source: "booking-provider-write",
      event,
      callId: userData.callId,
      workspaceId: userData.workspaceId,
      ...extra,
    }),
  );
}

/**
 * Direct backend calendar write — no AgentSession interrupt, bridge speech, or TTS.
 * Idempotency: callId + slotId (retries recover via DB lookup inside resilient book).
 */
export async function writeBookingToProvider(input: {
  userData: FrontDeskUserData;
  slot: AvailableSlot;
  slotId: string;
  attendeeEmail: string;
}): Promise<{ booked: Awaited<ReturnType<typeof scheduleAppointmentResilientForUserData>>; bookedTimeLabel: string }> {
  const idempotencyKey = `${input.userData.callId}:${input.slotId}`;
  const startMs = Date.now();

  logProviderWrite("booking_provider_write_started", input.userData, {
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

    logProviderWrite("booking_provider_write_succeeded", input.userData, {
      slotId: input.slotId,
      idempotencyKey,
      providerEventId: booked.eventUri,
      inviteeUri: booked.inviteeUri,
      durationMs: Date.now() - startMs,
      bookedTimeLabel,
    });

    return { booked, bookedTimeLabel };
  } catch (err) {
    logProviderWrite("booking_provider_write_failed", input.userData, {
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
  const { isAgentSessionAlive } = await import("../session-utils");
  if (!isAgentSessionAlive(session)) {
    console.log(
      JSON.stringify({
        source: "booking-speech",
        event: "confirmation_speech_skipped",
        callId: session.userData.callId,
        reason: "session_not_alive",
        preview: text.slice(0, 80),
      }),
    );
    return false;
  }

  const spoken = await speak(session, text);
  if (!spoken) {
    console.log(
      JSON.stringify({
        source: "booking-speech",
        event: "confirmation_speech_failed",
        callId: session.userData.callId,
        preview: text.slice(0, 80),
      }),
    );
  }
  return spoken;
}
