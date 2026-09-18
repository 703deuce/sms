import assert from "node:assert/strict";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import {
  applySlotSelectionFromMeaning,
  invalidateSelectionForSchedulingChange,
} from "../src/lib/voice-v3/calendar/apply-slot-selection";
import { recordPresentedOffer } from "../src/lib/voice-v3/calendar/presentation";
import { resolveSlotSelection } from "../src/lib/voice-v3/calendar/resolve-slot-selection";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

const TZ = "America/New_York";

function slot(id: string, localStart: string, startUtc: string) {
  return {
    slotId: id,
    startUtc,
    endUtc: new Date(new Date(startUtc).getTime() + 60 * 60_000).toISOString(),
    localStart,
    localEnd: localStart.replace(/T(\d{2}):(\d{2})/, (_, h, m) => {
      const endH = String(Number(h) + 1).padStart(2, "0");
      return `T${endH}:${m}`;
    }),
  };
}

function offer7(): AvailabilityOfferSet {
  const slots = [
    slot("slot_1", "2026-09-25T13:00:00-04:00", "2026-09-25T17:00:00.000Z"),
    slot("slot_2", "2026-09-25T13:30:00-04:00", "2026-09-25T17:30:00.000Z"),
    slot("slot_3", "2026-09-25T14:00:00-04:00", "2026-09-25T18:00:00.000Z"),
    slot("slot_4", "2026-09-25T14:30:00-04:00", "2026-09-25T18:30:00.000Z"),
    slot("slot_5", "2026-09-25T15:00:00-04:00", "2026-09-25T19:00:00.000Z"),
    slot("slot_6", "2026-09-25T15:30:00-04:00", "2026-09-25T19:30:00.000Z"),
    slot("slot_7", "2026-09-25T16:00:00-04:00", "2026-09-25T20:00:00.000Z"),
  ];
  return {
    offerSetId: "offer_set_test",
    schedulingGeneration: 5,
    createdAt: new Date().toISOString(),
    timezone: TZ,
    presentationOrder: slots.map((s) => s.slotId),
    slots,
  };
}

function baseCtx(offer: AvailabilityOfferSet, presentedIds: string[]) {
  const clock = buildVoiceV3CallClock(TZ);
  const ctx = createInitialVoiceV3CallContext({
    callId: "c_sel",
    liveSessionId: "live_sel",
    timezone: TZ,
    clock,
  });
  return {
    ...ctx,
    scheduling: { ...ctx.scheduling, generation: offer.schedulingGeneration },
    availability: {
      ...ctx.availability,
      status: "ready",
      activeOfferSet: offer,
    },
    presentation: {
      current: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presentedIds }),
    },
  };
}

function meaning(partial: Partial<CallerMeaning>): CallerMeaning {
  return {
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [],
    scheduling: emptySchedulingMeaning(),
    slot_selection: emptySlotSelectionMeaning(),
    corrections: [],
    ambiguities: [],
    ...partial,
  };
}

function testResolver() {
  const offer = offer7();
  const presented = ["slot_1", "slot_4", "slot_7"];

  let r = resolveSlotSelection({
    meaning: { selection_type: "EXACT_TIME", spoken_time: "14:30", ordinal: null },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 5,
    timezone: TZ,
  });
  assert.equal(r.status, "RESOLVED");
  if (r.status === "RESOLVED") assert.equal(r.slotId, "slot_4");

  r = resolveSlotSelection({
    meaning: { selection_type: "ORDINAL", spoken_time: null, ordinal: 2 },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 5,
    timezone: TZ,
  });
  assert.equal(r.status, "RESOLVED");
  if (r.status === "RESOLVED") assert.equal(r.slotId, "slot_4");

  r = resolveSlotSelection({
    meaning: { selection_type: "ORDINAL", spoken_time: null, ordinal: 2 },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 6,
    timezone: TZ,
  });
  assert.equal(r.status, "NO_CURRENT_OFFER_SET");

  r = resolveSlotSelection({
    meaning: { selection_type: "EXACT_TIME", spoken_time: "15:00", ordinal: null },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 5,
    timezone: TZ,
  });
  assert.equal(r.status, "NOT_IN_OFFER_SET");

  r = resolveSlotSelection({
    meaning: { selection_type: "EXACT_TIME", spoken_time: "2", ordinal: null },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 5,
    timezone: TZ,
  });
  assert.equal(r.status, "AMBIGUOUS");

  r = resolveSlotSelection({
    meaning: { selection_type: "EARLIEST", spoken_time: null, ordinal: null },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 5,
    timezone: TZ,
  });
  assert.equal(r.status, "RESOLVED");
  if (r.status === "RESOLVED") assert.equal(r.slotId, "slot_1");

  r = resolveSlotSelection({
    meaning: { selection_type: "LATEST", spoken_time: null, ordinal: null },
    offerSet: offer,
    presented: recordPresentedOffer({ offerSet: offer, presentedSlotIds: presented }),
    schedulingGeneration: 5,
    timezone: TZ,
  });
  assert.equal(r.status, "RESOLVED");
  if (r.status === "RESOLVED") assert.equal(r.slotId, "slot_7");
}

function testApplyPaths() {
  const offer = offer7();
  const presented = ["slot_1", "slot_4", "slot_7"];
  let ctx = baseCtx(offer, presented);

  const applied = applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 2,
  });
  assert.equal(applied.context.selection.selected?.slotId, "slot_4");

  const change = applySlotSelectionFromMeaning(applied.context, {
    selection_type: "EXACT_TIME",
    spoken_time: "16:00",
    ordinal: null,
  });
  assert.equal(change.context.selection.selected?.slotId, "slot_7");

  ctx = invalidateSelectionForSchedulingChange(applied.context, "test");
  assert.equal(ctx.selection.selected, null);
  assert.equal(ctx.availability.activeOfferSet, null);
}

function testSchedulingClearsSelection() {
  const offer = offer7();
  let ctx = baseCtx(offer, ["slot_1", "slot_4", "slot_7"]);
  ctx = applySlotSelectionFromMeaning(ctx, {
    selection_type: "EXACT_TIME",
    spoken_time: "14:30",
    ordinal: null,
  }).context;

  const clock = buildVoiceV3CallClock(TZ);
  const withClock = { ...ctx, clock };
  const next = applyCallerMeaningToContext(
    withClock,
    VOICE_V3_BOOKING_TEST_CONFIG,
    meaning({
      scheduling: {
        ...emptySchedulingMeaning(),
        date_relation: "NEXT_WEEKDAY",
        weekday: "THURSDAY",
        time_kind: "DAYPART",
        daypart: "MORNING",
      },
    }),
  );
  assert.equal(next.context.selection.selected, null);
  assert.equal(next.context.availability.activeOfferSet, null);
  assert.ok(next.context.scheduling.generation > offer.schedulingGeneration);
}

function testRulesSlotSelected() {
  const offer = offer7();
  let ctx = baseCtx(offer, ["slot_1", "slot_4", "slot_7"]);
  ctx = applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 2,
  }).context;
  const rules = evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(rules.slotSelected, true);
  assert.equal(rules.bookingPhase, "SLOT_SELECTED");
  assert.equal(rules.requiredAction, null);
  assert.equal(rules.mayBook, false);
}

function main() {
  testResolver();
  testApplyPaths();
  testSchedulingClearsSelection();
  testRulesSlotSelected();
  console.log("PASS voice-v3 slot selection");
}

main();
