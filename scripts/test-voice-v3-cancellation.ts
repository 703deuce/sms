import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import {
  clearDurableBookingStore,
  registerDurableBooking,
} from "../src/lib/voice-v3/calendar/durable-booking-store";
import type { ConfirmedBooking } from "../src/lib/voice-v3/calendar/booking-types";
import { findExistingAppointment } from "../src/lib/voice-v3/calendar/find-existing-appointment";
import { verifyCallerForAppointment } from "../src/lib/voice-v3/calendar/verify-appointment-caller";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { dispatchCancellationIfRequired } from "../src/lib/voice-v3/calendar/cancel-dispatch";
import { existingAppointmentFromConfirmed } from "../src/lib/voice-v3/calendar/appointment-management-types";

const TZ = "America/New_York";

async function main() {
  clearDurableBookingStore();
  const confirmed: ConfirmedBooking = {
    bookingAttemptId: "bka_cxl",
    provider: "microsoft",
    providerEventId: "evt_cxl",
    providerCalendarId: "primary",
    startUtc: "2026-09-25T18:30:00.000Z",
    endUtc: "2026-09-25T19:30:00.000Z",
    localStart: "2026-09-25T14:30:00-04:00",
    localEnd: "2026-09-25T15:30:00-04:00",
    timezone: TZ,
    customerName: "Anthony",
    serviceId: "consultation",
    confirmedAt: new Date().toISOString(),
    offerSetId: "o",
    slotId: "s",
    schedulingGeneration: 1,
  };
  registerDurableBooking(confirmed, { name: "John Smith", email: "a@b.co" });

  const appt = existingAppointmentFromConfirmed(confirmed, { name: "John Smith", email: "a@b.co" });
  assert.equal(
    verifyCallerForAppointment(appt, { phone: undefined, email: undefined }),
    false,
    "name alone must not verify",
  );
  assert.equal(verifyCallerForAppointment(appt, { email: "a@b.co" }), true);

  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "cxl",
    liveSessionId: "live_cxl",
    timezone: TZ,
    clock,
  });
  const existing = registerDurableBooking(confirmed, { email: "a@b.co" });
  ctx = {
    ...ctx,
    dialog: { activeGoal: "CANCEL_APPOINTMENT" },
    intake: {
      values: {
        email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
        name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
        mothers_name: { value: "m", source: "caller", updatedAt: new Date().toISOString() },
      },
    },
    appointmentManagement: {
      ...ctx.appointmentManagement,
      verifiedExisting: existing,
      lookupCompleted: true,
      cancellation: {
        phase: "CANCELLATION_READY",
        cancellationAttemptId: null,
        awaitingConfirmation: true,
        boundProviderEventId: existing.providerEventId,
      },
      lastCancellationConfirmation: "CONFIRM",
    },
  };

  let rules = evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(rules.requiredAction, "CANCEL_APPOINTMENT");

  const rt = {
    getSnapshot: () => ctx,
    replaceContext: (c: typeof ctx) => {
      ctx = c;
    },
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  };

  let cancelCount = 0;
  await dispatchCancellationIfRequired(rt, {
    cancelBooking: async () => {
      cancelCount += 1;
      return { ok: true, durationMs: 1 };
    },
  });
  assert.equal(cancelCount, 1);
  await dispatchCancellationIfRequired(rt, {
    cancelBooking: async () => {
      cancelCount += 1;
      return { ok: true, durationMs: 1 };
    },
  });
  assert.equal(cancelCount, 1, "duplicate cancel blocked");

  assert.equal(ctx.appointmentManagement.cancellation.phase, "CANCELLATION_CONFIRMED");

  console.log("PASS voice-v3 cancellation");
}

main().catch((e) => {
  console.error("FAIL voice-v3 cancellation", e);
  process.exit(1);
});
