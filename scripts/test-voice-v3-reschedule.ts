import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { registerDurableBooking } from "../src/lib/voice-v3/calendar/durable-booking-store";
import { clearDurableBookingStore } from "../src/lib/voice-v3/calendar/durable-booking-store";
import type { ConfirmedBooking } from "../src/lib/voice-v3/calendar/booking-types";
import { filterBusyForReschedule } from "../src/lib/voice-v3/calendar/slot-generator";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { applySlotSelectionFromMeaning } from "../src/lib/voice-v3/calendar/apply-slot-selection";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { dispatchRescheduleIfRequired } from "../src/lib/voice-v3/calendar/reschedule-dispatch";
import { findExistingAppointmentFromStore } from "../src/lib/voice-v3/calendar/find-existing-appointment";

const TZ = "America/New_York";

function seedBooking(): ConfirmedBooking {
  return {
    bookingAttemptId: "bka_test_rsc",
    provider: "microsoft",
    providerEventId: "evt_old",
    providerCalendarId: "primary",
    startUtc: "2026-09-25T18:30:00.000Z",
    endUtc: "2026-09-25T19:30:00.000Z",
    localStart: "2026-09-25T14:30:00-04:00",
    localEnd: "2026-09-25T15:30:00-04:00",
    timezone: TZ,
    customerName: "Anthony",
    serviceId: "consultation",
    confirmedAt: new Date().toISOString(),
    offerSetId: "offer_old",
    slotId: "slot_old",
    schedulingGeneration: 1,
  };
}

async function main() {
  clearDurableBookingStore();
  const confirmed = seedBooking();
  registerDurableBooking(confirmed, {
    name: "Anthony",
    email: "a@b.co",
    phone: "+15551234567",
  });

  const found = findExistingAppointmentFromStore({
    callId: "c1",
    email: "a@b.co",
    phone: "+15551234567",
  });
  assert.equal(found.status, "FOUND");

  const busy = [
    {
      calendarId: "primary",
      startUtc: confirmed.startUtc,
      endUtc: confirmed.endUtc,
    },
    {
      calendarId: "primary",
      startUtc: "2026-09-25T20:00:00.000Z",
      endUtc: "2026-09-25T21:00:00.000Z",
    },
  ];
  const filtered = filterBusyForReschedule(busy, {
    startUtc: confirmed.startUtc,
    endUtc: confirmed.endUtc,
  });
  assert.equal(filtered.length, 1);

  const clock = buildVoiceV3CallClock(TZ);
  const offer: AvailabilityOfferSet = {
    offerSetId: "offer_rsc",
    schedulingGeneration: 3,
    createdAt: new Date().toISOString(),
    timezone: TZ,
    presentationOrder: ["slot_1"],
    slots: [
      {
        slotId: "slot_1",
        startUtc: "2026-09-25T20:00:00.000Z",
        endUtc: "2026-09-25T21:00:00.000Z",
        localStart: "2026-09-25T16:00:00-04:00",
        localEnd: "2026-09-25T17:00:00-04:00",
      },
    ],
  };

  let ctx = createInitialVoiceV3CallContext({
    callId: "rsc",
    liveSessionId: "live_rsc",
    timezone: TZ,
    clock,
  });
  ctx = {
    ...ctx,
    dialog: { activeGoal: "RESCHEDULE_APPOINTMENT" },
    scheduling: { generation: 3, normalized: { precision: "DAYPART", localDate: "2026-09-25" } as never },
    intake: {
      values: {
        name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
        email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
        phone: { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() },
      },
    },
    appointmentManagement: {
      ...ctx.appointmentManagement,
      verifiedExisting: found.status === "FOUND" ? found.appointment : null,
      lookupCompleted: true,
    },
    availability: { ...ctx.availability, status: "ready", activeOfferSet: offer },
  };
  ctx = applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 1,
  }).context;

  const rules = evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(rules.rescheduleReady, true);

  const rt = {
    getSnapshot: () => ctx,
    replaceContext: (c: typeof ctx) => {
      ctx = c;
    },
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  };

  await dispatchRescheduleIfRequired(rt, {
    fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    updateBooking: async () => ({ ok: true, durationMs: 2 }),
  });
  assert.equal(ctx.appointmentManagement.reschedule.phase, "RESCHEDULE_CONFIRMED");
  console.log("PASS voice-v3 reschedule");
}

main().catch((e) => {
  console.error("FAIL voice-v3 reschedule", e);
  process.exit(1);
});
