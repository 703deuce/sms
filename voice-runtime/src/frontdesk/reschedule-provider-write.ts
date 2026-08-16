import type { AvailableSlot } from "./calendly-calendar";
import { SlotUnavailableError } from "./calendly-calendar";
import {
  formatBookedTimeLabel,
  rescheduleAppointmentResilientForUserData,
} from "./booking-recovery";
import type { FrontDeskUserData } from "./userdata";
import { logRuntimeTransaction, transactionContextFromUserData } from "./runtime-transaction";

const SOURCE = "reschedule-provider-write";

export async function writeRescheduleToProvider(input: {
  userData: FrontDeskUserData;
  appointmentId: string;
  oldEventUri: string | null;
  slot: AvailableSlot;
  slotId: string;
  attendeeEmail: string;
  existingMetadata?: unknown;
}): Promise<{
  rescheduled: Awaited<ReturnType<typeof rescheduleAppointmentResilientForUserData>>;
  bookedTimeLabel: string;
  idempotencyKey: string;
}> {
  const ctx = transactionContextFromUserData(input.userData);
  const idempotencyKey = `${input.userData.callId}:reschedule:${input.appointmentId}:${input.slotId}`;
  const startMs = Date.now();

  logRuntimeTransaction(SOURCE, "reschedule_write_started", ctx, {
    appointmentId: input.appointmentId,
    slotId: input.slotId,
    idempotencyKey,
  });

  try {
    const rescheduled = await rescheduleAppointmentResilientForUserData({
      userData: input.userData,
      appointmentId: input.appointmentId,
      oldEventUri: input.oldEventUri,
      slot: input.slot,
      attendeeEmail: input.attendeeEmail,
      existingMetadata: input.existingMetadata,
      idempotencyKey,
    });
    const bookedTimeLabel = formatBookedTimeLabel(
      rescheduled.slot.startTime,
      input.userData.timezone,
    );

    logRuntimeTransaction(SOURCE, "reschedule_write_succeeded", ctx, {
      appointmentId: input.appointmentId,
      slotId: input.slotId,
      idempotencyKey,
      providerEventId: rescheduled.eventUri,
      durationMs: Date.now() - startMs,
      bookedTimeLabel,
    });
    logRuntimeTransaction(SOURCE, "reschedule_receipt_persisted", ctx, {
      appointmentId: input.appointmentId,
      slotId: input.slotId,
      idempotencyKey,
      providerEventId: rescheduled.eventUri,
      bookedTimeLabel,
    });

    return { rescheduled, bookedTimeLabel, idempotencyKey };
  } catch (err) {
    logRuntimeTransaction(SOURCE, "reschedule_write_failed", ctx, {
      appointmentId: input.appointmentId,
      slotId: input.slotId,
      idempotencyKey,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : String(err),
      slotUnavailable: err instanceof SlotUnavailableError,
    });
    throw err;
  }
}
