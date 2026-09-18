/**
 * Voice V3 booking scene — deterministic + mocked Microsoft (no live Graph required).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../src/lib/voice-v3/config/booking-agent-config";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { recordPresentedOffer } from "../src/lib/voice-v3/calendar/presentation";
import { applySlotSelectionFromMeaning } from "../src/lib/voice-v3/calendar/apply-slot-selection";
import { dispatchBookingIfRequired } from "../src/lib/voice-v3/calendar/book-dispatch";
import {
  clearBookingAttemptRegistry,
  getConfirmedBookingForSlot,
  bookingSlotKey,
} from "../src/lib/voice-v3/calendar/booking-attempt-registry";
import type { CalendarBusyInterval } from "../src/lib/voice-v3/calendar/types";
import { slotIntervalOverlapsBusy } from "../src/lib/voice-v3/calendar/revalidate-selected-slot";

const TZ = "America/New_York";

const BOOKING_TEST_CONFIG = {
  ...VOICE_V3_BOOKING_AGENT_CONFIG,
  calendar: {
    ...VOICE_V3_BOOKING_AGENT_CONFIG.calendar!,
    connectionId: "booking_test_connection",
  },
};

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
    offerSetId: "offer_book",
    schedulingGeneration: 2,
    createdAt: new Date().toISOString(),
    timezone: TZ,
    presentationOrder: ["slot_1", "slot_2"],
    slots,
  };
}

function baseCtx() {
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "call_book",
    liveSessionId: "live_book",
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
  const sel = applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 2,
  });
  return sel.context;
}

function runtimeFrom(ctx: ReturnType<typeof baseCtx>) {
  let current = ctx;
  return {
    getSnapshot: () => current,
    replaceContext: (c: typeof current) => {
      current = c;
    },
    config: BOOKING_TEST_CONFIG,
  };
}

async function main() {
  clearBookingAttemptRegistry();

  let ctx = baseCtx();
  let rules = evaluateVoiceV3Rules(ctx, BOOKING_TEST_CONFIG);
  assert.equal(rules.bookingReady, true);
  assert.equal(rules.requiredAction, "BOOK_APPOINTMENT");

  const missingEmail = {
    ...ctx,
    intake: {
      values: {
        ...ctx.intake.values,
        email: { value: "", source: "caller", updatedAt: new Date().toISOString() },
      },
    },
  };
  rules = evaluateVoiceV3Rules(missingEmail, BOOKING_TEST_CONFIG);
  assert.equal(rules.bookingReady, false);
  assert.notEqual(rules.requiredAction, "BOOK_APPOINTMENT");

  ctx = baseCtx();
  const rt = runtimeFrom(ctx);
  let createCount = 0;
  const bookingAttemptIds: string[] = [];

  await dispatchBookingIfRequired(rt, {
    fetchRevalidateBusy: async () => ({
      ok: true,
      busy: [],
      durationMs: 1,
    }),
    createBooking: async ({ request }) => {
      createCount += 1;
      bookingAttemptIds.push(request.bookingAttemptId);
      return {
        ok: true,
        providerEventId: "evt_ms_1",
        providerCalendarId: request.calendarId,
        durationMs: 5,
      };
    },
  });

  const snap = rt.getSnapshot();
  assert.equal(snap.booking.phase, "BOOKING_CONFIRMED");
  assert.equal(snap.booking.confirmed?.providerEventId, "evt_ms_1");
  assert.equal(createCount, 1);

  await dispatchBookingIfRequired(rt, {
    fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    createBooking: async () => {
      createCount += 1;
      return {
        ok: true,
        providerEventId: "evt_dup",
        providerCalendarId: "primary",
        durationMs: 1,
      };
    },
  });
  assert.equal(createCount, 1, "duplicate rule evaluation must not double-book");

  const key = bookingSlotKey({
    schedulingGeneration: 2,
    offerSetId: "offer_book",
    slotId: "slot_2",
  });
  assert.ok(getConfirmedBookingForSlot("live_book", key));

  clearBookingAttemptRegistry();
  ctx = baseCtx();
  const rt2 = runtimeFrom(ctx);
  await dispatchBookingIfRequired(rt2, {
    fetchRevalidateBusy: async () => ({
      ok: true,
      busy: [
        {
          calendarId: "primary",
          startUtc: "2026-09-25T18:30:00.000Z",
          endUtc: "2026-09-25T19:30:00.000Z",
        },
      ],
      durationMs: 2,
    }),
    createBooking: async () => {
      throw new Error("must not create when slot busy");
    },
  });
  assert.equal(rt2.getSnapshot().booking.lastFailure?.reason, "SLOT_NO_LONGER_AVAILABLE");
  assert.equal(rt2.getSnapshot().selection.selected, null);

  const selected = baseCtx().selection.selected!;
  assert.equal(
    slotIntervalOverlapsBusy(selected, [
      {
        calendarId: "primary",
        startUtc: selected.startUtc,
        endUtc: selected.endUtc,
      },
    ]),
    true,
  );

  clearBookingAttemptRegistry();
  const ctxA = baseCtx();
  const ctxB = {
    ...baseCtx(),
    callId: "call_b",
    liveSessionId: "live_b",
  };
  const rtA = runtimeFrom(ctxA);
  const rtB = runtimeFrom(ctxB);
  let bCreated = false;
  await dispatchBookingIfRequired(rtA, {
    fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    createBooking: async ({ request }) => ({
      ok: true,
      providerEventId: "evt_a",
      providerCalendarId: request.calendarId,
      durationMs: 3,
    }),
  });
  await dispatchBookingIfRequired(rtB, {
    fetchRevalidateBusy: async () => ({
      ok: true,
      busy: [
        {
          calendarId: "primary",
          startUtc: selected.startUtc,
          endUtc: selected.endUtc,
        },
      ],
      durationMs: 1,
    }),
    createBooking: async () => {
      bCreated = true;
      return {
        ok: true,
        providerEventId: "evt_b",
        providerCalendarId: "primary",
        durationMs: 1,
      };
    },
  });
  assert.equal(rtA.getSnapshot().booking.phase, "BOOKING_CONFIRMED");
  assert.equal(rtB.getSnapshot().booking.lastFailure?.reason, "SLOT_NO_LONGER_AVAILABLE");
  assert.equal(bCreated, false);

  const meaning = (partial: Partial<CallerMeaning>): CallerMeaning => ({
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [],
    scheduling: emptySchedulingMeaning(),
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "CHANGE_CONFIRMED_APPOINTMENT",
    corrections: [],
    ambiguities: [],
    ...partial,
  });

  let confirmedCtx = rt.getSnapshot();
  const post = applyCallerMeaningToContext(confirmedCtx, BOOKING_TEST_CONFIG, meaning({}));
  assert.equal(post.context.booking.postBookChangeRequested, true);
  assert.equal(post.context.booking.confirmed?.providerEventId, "evt_ms_1");

  console.log("PASS voice-v3 booking");
}

main().catch((err) => {
  console.error("FAIL voice-v3 booking", err);
  process.exit(1);
});
