/**
 * Proves BOOK / RESCHEDULE / CANCEL register operations at commit boundary before provider hooks run.
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { applySlotSelectionFromMeaning } from "../src/lib/voice-v3/calendar/apply-slot-selection";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { recordPresentedOffer } from "../src/lib/voice-v3/calendar/presentation";
import { dispatchBookingIfRequired } from "../src/lib/voice-v3/calendar/book-dispatch";
import { dispatchCancellationIfRequired } from "../src/lib/voice-v3/calendar/cancel-dispatch";
import { dispatchRescheduleIfRequired } from "../src/lib/voice-v3/calendar/reschedule-dispatch";
import {
  clearBookingAttemptRegistry,
} from "../src/lib/voice-v3/calendar/booking-attempt-registry";
import { registerDurableBooking } from "../src/lib/voice-v3/calendar/durable-booking-store";
import type { ConfirmedBooking } from "../src/lib/voice-v3/calendar/booking-types";
import { findExistingAppointmentFromStore } from "../src/lib/voice-v3/calendar/find-existing-appointment";
import { clearDurableBookingStore } from "../src/lib/voice-v3/calendar/durable-booking-store";

const TZ = "America/New_York";
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function offer(): AvailabilityOfferSet {
  const slots = [
    {
      slotId: "slot_1",
      startUtc: "2026-09-25T17:00:00.000Z",
      endUtc: "2026-09-25T18:00:00.000Z",
      localStart: "2026-09-25T13:00:00-04:00",
      localEnd: "2026-09-25T14:00:00-04:00",
    },
    {
      slotId: "slot_2",
      startUtc: "2026-09-25T18:30:00.000Z",
      endUtc: "2026-09-25T19:30:00.000Z",
      localStart: "2026-09-25T14:30:00-04:00",
      localEnd: "2026-09-25T15:30:00-04:00",
    },
  ];
  return {
    offerSetId: "offer_reg",
    schedulingGeneration: 2,
    createdAt: new Date().toISOString(),
    timezone: TZ,
    presentationOrder: ["slot_1", "slot_2"],
    slots,
  };
}

function bookCtx() {
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "call_reg_book",
    liveSessionId: "live_reg_book",
    timezone: TZ,
    clock,
  });
  const o = offer();
  ctx = {
    ...ctx,
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
    scheduling: { generation: 2, normalized: { precision: "DAYPART", localDate: "2026-09-25" } as never },
    availability: { ...ctx.availability, status: "ready", activeOfferSet: o },
    presentation: { current: recordPresentedOffer({ offerSet: o, presentedSlotIds: ["slot_1", "slot_2"] }) },
    intake: {
      values: {
        name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
        email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
        phone: { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() },
      },
    },
  };
  return applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 2,
  }).context;
}

async function testBookRegistersBeforeProvider() {
  clearBookingAttemptRegistry();
  let ctx = bookCtx();
  const rt = {
    getSnapshot: () => ctx,
    replaceContext: (c: typeof ctx) => {
      ctx = c;
    },
    config: CONFIG,
  };
  let opAtProvider: { status?: string; type?: string } | null = null;
  await dispatchBookingIfRequired(rt, {
    fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    createBooking: async ({ request }) => {
      const snap = rt.getSnapshot();
      const op = snap.operations?.[request.bookingAttemptId];
      opAtProvider = op ? { status: op.status, type: op.type } : null;
      return {
        ok: true,
        providerEventId: "evt_reg",
        providerCalendarId: request.calendarId,
        durationMs: 1,
      };
    },
  });
  assert.equal(opAtProvider?.status, "RUNNING");
  assert.equal(opAtProvider?.type, "BOOK_APPOINTMENT");
  const after = rt.getSnapshot();
  const attemptId = after.booking.confirmed?.bookingAttemptId;
  assert.ok(attemptId);
  assert.equal(after.operations?.[attemptId]?.status, "SUCCEEDED");
}

async function testCancelRegistersBeforeProvider() {
  clearDurableBookingStore();
  const confirmed: ConfirmedBooking = {
    bookingAttemptId: "bka_reg_cxl",
    provider: "microsoft",
    providerEventId: "evt_reg_cxl",
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
  const existing = registerDurableBooking(confirmed, { email: "a@b.co" });
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "call_reg_cxl",
    liveSessionId: "live_reg_cxl",
    timezone: TZ,
    clock,
  });
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
  const rt = {
    getSnapshot: () => ctx,
    replaceContext: (c: typeof ctx) => {
      ctx = c;
    },
    config: CONFIG,
  };
  let opAtProvider: { status?: string; type?: string } | null = null;
  let attemptIdAtProvider = "";
  await dispatchCancellationIfRequired(rt, {
    cancelBooking: async ({ request }) => {
      attemptIdAtProvider = request.cancellationAttemptId;
      const op = rt.getSnapshot().operations?.[request.cancellationAttemptId];
      opAtProvider = op ? { status: op.status, type: op.type } : null;
      return { ok: true, durationMs: 1 };
    },
  });
  assert.equal(opAtProvider?.status, "RUNNING");
  assert.equal(opAtProvider?.type, "CANCEL_APPOINTMENT");
  assert.equal(rt.getSnapshot().operations?.[attemptIdAtProvider]?.status, "SUCCEEDED");
}

async function testRescheduleRegistersBeforeProvider() {
  clearDurableBookingStore();
  const confirmed: ConfirmedBooking = {
    bookingAttemptId: "bka_reg_rsc",
    provider: "microsoft",
    providerEventId: "evt_reg_rsc",
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
  const o: AvailabilityOfferSet = {
    offerSetId: "offer_reg_rsc",
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
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "call_reg_rsc",
    liveSessionId: "live_reg_rsc",
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
    availability: { ...ctx.availability, status: "ready", activeOfferSet: o },
  };
  ctx = applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 1,
  }).context;
  assert.equal(evaluateVoiceV3Rules(ctx, CONFIG).rescheduleReady, true);
  const rt = {
    getSnapshot: () => ctx,
    replaceContext: (c: typeof ctx) => {
      ctx = c;
    },
    config: CONFIG,
  };
  let opAtProvider: { status?: string; type?: string } | null = null;
  let attemptId = "";
  await dispatchRescheduleIfRequired(rt, {
    fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    updateBooking: async () => {
      attemptId = rt.getSnapshot().appointmentManagement.reschedule.attemptId ?? "";
      const op = attemptId ? rt.getSnapshot().operations?.[attemptId] : undefined;
      opAtProvider = op ? { status: op.status, type: op.type } : null;
      return { ok: true, durationMs: 1 };
    },
  });
  assert.equal(opAtProvider?.status, "RUNNING");
  assert.equal(opAtProvider?.type, "RESCHEDULE_APPOINTMENT");
  assert.equal(rt.getSnapshot().operations?.[attemptId]?.status, "SUCCEEDED");
}

async function main() {
  await testBookRegistersBeforeProvider();
  await testCancelRegistersBeforeProvider();
  await testRescheduleRegistersBeforeProvider();
  console.log("VOICE_V3_OPERATION_REGISTRATION_PASS");
}

main().catch((e) => {
  console.error("VOICE_V3_OPERATION_REGISTRATION_FAIL", e);
  process.exit(1);
});
