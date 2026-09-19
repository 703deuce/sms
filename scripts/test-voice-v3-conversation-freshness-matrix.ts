#!/usr/bin/env tsx
/**
 * Voice V3 conversation freshness — 25/25 certification matrix (no PSTN).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-conversation-freshness-matrix.ts
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { VOICE_V3_SEND_LINK_TEST_CONFIG } from "./voice-v3-send-link-test-config";
import { DelegationFreshnessHarness } from "../src/lib/voice-v3/testing/delegation-freshness-harness";
import { applyFindAvailabilityResult } from "../src/lib/voice-v3/calendar/find-dispatch";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { dispatchBookingIfRequired } from "../src/lib/voice-v3/calendar/book-dispatch";
import {
  bookingSlotKey,
  clearBookingAttemptRegistry,
  getConfirmedBookingForSlot,
} from "../src/lib/voice-v3/calendar/booking-attempt-registry";
import { recordPresentedOffer } from "../src/lib/voice-v3/calendar/presentation";
import { applySlotSelectionFromMeaning } from "../src/lib/voice-v3/calendar/apply-slot-selection";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { shouldBlockStaleToolPreDispatch } from "../src/lib/voice-v3/delegation/conversation-freshness";

const TZ = "America/New_York";
const CALLBACK_CONFIG = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  workspaceId: "ws_freshness_test",
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
    callbackUseAniByDefault: true,
  },
};

const MGMT_CONFIG = {
  ...CALLBACK_CONFIG,
  transferDestinations: [
    {
      id: "front_desk",
      label: "Front desk",
      enabled: true,
      e164: "+15550001111",
    },
  ],
};

const CASE_IDS = [
  "C01_STRAIGHT_BOOKING",
  "C02_STRAIGHT_CALLBACK",
  "C03_STRAIGHT_TRANSFER",
  "C04_STRAIGHT_CANCEL",
  "C05_STRAIGHT_RESCHEDULE",
  "C06_STRAIGHT_SEND_LINK",
  "C07_BOOK_TO_CALLBACK",
  "C08_CALLBACK_TO_BOOK",
  "C09_BOOK_TO_TRANSFER",
  "C10_CALLBACK_TO_TRANSFER",
  "C11_RESCHEDULE_TO_CALLBACK",
  "C12_CANCEL_TO_BOOK",
  "C13_MONDAY_TO_TUESDAY",
  "C14_BOOK_FAQ_BOOK",
  "C15_RAPID_REVISIONS_DURING_READ",
  "C16_REVISION_DURING_FIND",
  "C17_REVISION_BEFORE_WRITE_DISPATCH",
  "C18_REVISION_DURING_WRITE_COMMIT",
  "C19_POST_SUCCESS_BEFORE_CLAIM",
  "C20_OVERLAP_D1_D2_CORRELATION",
  "C21_D1_COMPLETES_AFTER_D2",
  "C22_D2_COMPLETES_AFTER_D1",
  "C23_STALE_CONTINUATION_BLOCKS_WRITE",
  "C24_DUPLICATE_FUNCTION_OUTPUT",
  "C25_DUPLICATE_COMMITTED_WRITE",
] as const;

const results = new Map<string, "PASS">();

function pass(id: string): void {
  results.set(id, "PASS");
}

function offer(gen = 2): AvailabilityOfferSet {
  const slots = [
    {
      slotId: "slot_1",
      startUtc: "2026-09-25T17:00:00.000Z",
      endUtc: "2026-09-25T18:00:00.000Z",
      localStart: "2026-09-25T13:00:00-04:00",
      localEnd: "2026-09-25T14:00:00-04:00",
      displayLabel: "1:00 PM",
    },
  ];
  return {
    offerSetId: "offer_matrix",
    schedulingGeneration: gen,
    createdAt: new Date().toISOString(),
    timezone: TZ,
    presentationOrder: ["slot_1"],
    slots,
  };
}

async function microWait(): Promise<void> {
  await new Promise((r) => setTimeout(r, 25));
}

async function freshTool(
  session: string,
  config: typeof VOICE_V3_BOOKING_TEST_CONFIG,
  callId: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<DelegationFreshnessHarness> {
  const h = new DelegationFreshnessHarness(session, config);
  h.seedRevision(1);
  h.sessionDelegationCreated({ id: "D_fresh" });
  await h.functionCall("D_fresh", callId, tool, args);
  await h.waitForOutput(callId);
  h.assertNotSuperseded(callId);
  return h;
}

async function switchPattern(input: {
  session: string;
  config: typeof VOICE_V3_BOOKING_TEST_CONFIG;
  d1Tool: { callId: string; name: string; args: Record<string, unknown> };
  turn: string;
  d2Tool: { callId: string; name: string; args: Record<string, unknown> };
}): Promise<void> {
  const h = new DelegationFreshnessHarness(input.session, input.config);
  h.seedRevision(4);
  h.sessionDelegationCreated({ id: "D1" });
  await h.functionCall("D1", input.d1Tool.callId, input.d1Tool.name, input.d1Tool.args);
  await h.waitForOutput(input.d1Tool.callId);
  h.commitCallerTurn(input.turn);
  await microWait();
  assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
  h.sessionDelegationCreated({ id: "D2" });
  await h.functionCall("D2", input.d2Tool.callId, input.d2Tool.name, input.d2Tool.args);
  await h.waitForOutput(input.d2Tool.callId);
  h.assertNotSuperseded(input.d2Tool.callId);
}

async function runAll(): Promise<void> {
  await freshTool("c01", VOICE_V3_BOOKING_TEST_CONFIG, "fc_book", "set_scheduling_preference", {
    date_relation: "NEXT_WEEKDAY",
    weekday: "MONDAY",
    time_kind: "DAYPART",
    daypart: "MORNING",
    date_expression: "Monday morning",
    time_expression: "morning",
  });
  pass("C01_STRAIGHT_BOOKING");

  await freshTool("c02", CALLBACK_CONFIG, "fc_cb", "request_callback", {
    callback_phone: null,
    reason: "cert test",
    preferred_time: null,
    notes: null,
  });
  pass("C02_STRAIGHT_CALLBACK");

  await freshTool("c03", MGMT_CONFIG, "fc_xfer", "transfer_call", {
    destination_id: "front_desk",
    reason: "caller asked",
  });
  pass("C03_STRAIGHT_TRANSFER");

  await freshTool("c04", MGMT_CONFIG, "fc_cancel", "cancel_appointment", {
    confirmed: false,
    appointment_selection_id: null,
  });
  pass("C04_STRAIGHT_CANCEL");

  await freshTool("c05", MGMT_CONFIG, "fc_resched", "reschedule_appointment", {
    appointment_selection_id: null,
    scheduling_preference: null,
  });
  pass("C05_STRAIGHT_RESCHEDULE");

  await freshTool("c06", VOICE_V3_SEND_LINK_TEST_CONFIG, "fc_link", "send_booking_link", {
    confirmed: true,
    destination_phone: null,
  });
  pass("C06_STRAIGHT_SEND_LINK");

  // C07 Call 2 structural replay
  {
    const h = new DelegationFreshnessHarness("c07", CALLBACK_CONFIG);
    h.seedRevision(10);
    h.sessionDelegationCreated({ id: "D2", offset_ms: 100 });
    await h.functionCall("D2", "fc_intake", "update_intake", {
      name: "Anthony",
      email: null,
      phone: "+15551234567",
      date_expression: "Monday",
      time_expression: "afternoon",
      active_goal: "BOOK_APPOINTMENT",
    });
    h.commitCallerTurn("actually just have somebody call me back");
    await microWait();
    await h.functionCall("D2", "fc_set_stale", "set_scheduling_preference", {
      date_relation: "NEXT_WEEKDAY",
      weekday: "MONDAY",
      time_kind: "DAYPART",
      daypart: "AFTERNOON",
      date_expression: "Monday afternoon",
      time_expression: "afternoon",
    });
    h.assertSuperseded("fc_set_stale");
    h.sessionDelegationCreated({ id: "D3", offset_ms: 200 });
    await h.functionCall("D3", "fc_cb", "request_callback", {
      callback_phone: null,
      reason: "Caller asked for callback",
      preferred_time: null,
      notes: null,
    });
    await h.waitForOutput("fc_cb");
    h.assertNotSuperseded("fc_cb");
    pass("C07_BOOK_TO_CALLBACK");
  }

  await switchPattern({
    session: "c08",
    config: CALLBACK_CONFIG,
    d1Tool: {
      callId: "fc_cb1",
      name: "request_callback",
      args: { callback_phone: null, reason: "first", preferred_time: null, notes: null },
    },
    turn: "actually book now",
    d2Tool: {
      callId: "fc_set",
      name: "set_scheduling_preference",
      args: {
        date_relation: "NEXT_WEEKDAY",
        weekday: "TUESDAY",
        time_kind: "DAYPART",
        daypart: "MORNING",
        date_expression: "Tuesday morning",
        time_expression: "morning",
      },
    },
  });
  pass("C08_CALLBACK_TO_BOOK");

  await switchPattern({
    session: "c09",
    config: MGMT_CONFIG,
    d1Tool: {
      callId: "fc_set1",
      name: "set_scheduling_preference",
      args: {
        date_relation: "NEXT_WEEKDAY",
        weekday: "MONDAY",
        time_kind: "DAYPART",
        daypart: "MORNING",
        date_expression: "Monday",
        time_expression: "morning",
      },
    },
    turn: "transfer me to the front desk",
    d2Tool: {
      callId: "fc_xfer",
      name: "transfer_call",
      args: { destination_id: "front_desk", reason: "caller asked" },
    },
  });
  pass("C09_BOOK_TO_TRANSFER");

  await switchPattern({
    session: "c10",
    config: MGMT_CONFIG,
    d1Tool: {
      callId: "fc_cb",
      name: "request_callback",
      args: { callback_phone: null, reason: "callback", preferred_time: null, notes: null },
    },
    turn: "transfer me please",
    d2Tool: {
      callId: "fc_xfer",
      name: "transfer_call",
      args: { destination_id: "front_desk", reason: "transfer" },
    },
  });
  pass("C10_CALLBACK_TO_TRANSFER");

  await switchPattern({
    session: "c11",
    config: MGMT_CONFIG,
    d1Tool: {
      callId: "fc_resched",
      name: "reschedule_appointment",
      args: { appointment_selection_id: null, scheduling_preference: null },
    },
    turn: "have someone call me back",
    d2Tool: {
      callId: "fc_cb",
      name: "request_callback",
      args: { callback_phone: null, reason: "callback", preferred_time: null, notes: null },
    },
  });
  pass("C11_RESCHEDULE_TO_CALLBACK");

  await switchPattern({
    session: "c12",
    config: MGMT_CONFIG,
    d1Tool: {
      callId: "fc_cancel",
      name: "cancel_appointment",
      args: { confirmed: false, appointment_selection_id: null },
    },
    turn: "actually I want to book",
    d2Tool: {
      callId: "fc_set",
      name: "set_scheduling_preference",
      args: {
        date_relation: "NEXT_WEEKDAY",
        weekday: "WEDNESDAY",
        time_kind: "DAYPART",
        daypart: "AFTERNOON",
        date_expression: "Wednesday afternoon",
        time_expression: "afternoon",
      },
    },
  });
  pass("C12_CANCEL_TO_BOOK");

  {
    const h = new DelegationFreshnessHarness("c13", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(8);
    h.sessionDelegationCreated({ id: "D1" });
    await h.functionCall("D1", "fc_mon", "set_scheduling_preference", {
      date_relation: "NEXT_WEEKDAY",
      weekday: "MONDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
      date_expression: "Monday",
      time_expression: "morning",
    });
    h.commitCallerTurn("actually Tuesday instead");
    await microWait();
    await h.functionCall("D1", "fc_mon2", "set_scheduling_preference", {
      date_relation: "NEXT_WEEKDAY",
      weekday: "MONDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
      date_expression: "Monday",
      time_expression: "morning",
    });
    h.assertSuperseded("fc_mon2");
    h.sessionDelegationCreated({ id: "D2" });
    await h.functionCall("D2", "fc_tue", "set_scheduling_preference", {
      date_relation: "NEXT_WEEKDAY",
      weekday: "TUESDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
      date_expression: "Tuesday",
      time_expression: "morning",
    });
    h.assertNotSuperseded("fc_tue");
    pass("C13_MONDAY_TO_TUESDAY");
  }

  {
    const h = new DelegationFreshnessHarness("c14", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(2);
    h.sessionDelegationCreated({ id: "D1" });
    await h.functionCall("D1", "fc_set", "set_scheduling_preference", {
      date_relation: "NEXT_WEEKDAY",
      weekday: "MONDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
      date_expression: "Monday",
      time_expression: "morning",
    });
    h.commitCallerTurn("what are your hours");
    await microWait();
    h.commitCallerTurn("ok lets book Monday morning");
    await microWait();
    h.sessionDelegationCreated({ id: "D2" });
    await h.functionCall("D2", "fc_set2", "set_scheduling_preference", {
      date_relation: "NEXT_WEEKDAY",
      weekday: "MONDAY",
      time_kind: "DAYPART",
      daypart: "MORNING",
      date_expression: "Monday morning",
      time_expression: "morning",
    });
    h.assertNotSuperseded("fc_set2");
    pass("C14_BOOK_FAQ_BOOK");
  }

  {
    const h = new DelegationFreshnessHarness("c15", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(10);
    h.sessionDelegationCreated({ id: "D1" });
    h.commitCallerTurn("r11");
    h.commitCallerTurn("r12");
    h.commitCallerTurn("r13");
    await microWait();
    assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
    h.sessionDelegationCreated({ id: "D2" });
    assert.equal(h.coordinator().getDelegationRuntime("D2")!.basedOnConversationRevision, 13);
    pass("C15_RAPID_REVISIONS_DURING_READ");
  }

  {
    const h = new DelegationFreshnessHarness("c16", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(10);
    const clock = buildVoiceV3CallClock(TZ);
    let ctx = createInitialVoiceV3CallContext({
      callId: "c16",
      liveSessionId: h.liveSessionId,
      timezone: TZ,
      clock,
    });
    const o = offer(3);
    ctx = {
      ...ctx,
      scheduling: { generation: 3, normalized: { precision: "DAYPART", localDate: "2026-09-25" } as never },
      availability: { ...ctx.availability, status: "ready", activeOfferSet: null },
    };
    const applied = applyFindAvailabilityResult(ctx, {
      schedulingGeneration: 3,
      conversationRevision: 10,
      offerSet: o,
      failure: null,
      requestKey: "find_d1",
    });
    h.seedRevision(11);
    h.sessionDelegationCreated({ id: "D2" });
    const late = applyFindAvailabilityResult(applied, {
      schedulingGeneration: 3,
      conversationRevision: 10,
      offerSet: offer(99),
      failure: null,
      requestKey: "find_late",
    });
    assert.equal(late.availability.activeOfferSet?.offerSetId, o.offerSetId);
    pass("C16_REVISION_DURING_FIND");
  }

  {
    const h = new DelegationFreshnessHarness("c17", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(5);
    h.sessionDelegationCreated({ id: "D1" });
    h.commitCallerTurn("changed mind");
    await microWait();
    await h.functionCall("D1", "fc_book", "book_appointment", { slot_id: "slot_1" });
    h.assertSuperseded("fc_book");
    pass("C17_REVISION_BEFORE_WRITE_DISPATCH");
  }

  {
    clearBookingAttemptRegistry();
    const clock = buildVoiceV3CallClock(TZ);
    let ctx = createInitialVoiceV3CallContext({
      callId: "c18",
      liveSessionId: "live_write_race",
      timezone: TZ,
      clock,
    });
    const o = offer(2);
    ctx = {
      ...ctx,
      dialog: { activeGoal: "BOOK_APPOINTMENT" },
      scheduling: { generation: 2, normalized: { precision: "DAYPART", localDate: "2026-09-25" } as never },
      availability: { ...ctx.availability, status: "ready", activeOfferSet: o },
      presentation: {
        current: recordPresentedOffer({ offerSet: o, presentedSlotIds: ["slot_1"] }),
      },
      intake: {
        values: {
          name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
          email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
          phone: { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() },
        },
      },
    };
    ctx = applySlotSelectionFromMeaning(ctx, {
      selection_type: "ORDINAL",
      spoken_time: null,
      ordinal: 1,
    }).context;
    let current = ctx;
    const runtime = {
      getSnapshot: () => current,
      replaceContext: (c: typeof current) => {
        current = c;
      },
      config: VOICE_V3_BOOKING_TEST_CONFIG,
    };
    let resolveCreate!: () => void;
    const gate = new Promise<void>((r) => {
      resolveCreate = r;
    });
    const h = new DelegationFreshnessHarness("live_write_race", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(10);
    const bookPromise = dispatchBookingIfRequired(runtime, {
      createBooking: async () => {
        await gate;
        return {
          ok: true,
          providerEventId: "evt_race",
          providerCalendarId: "cal_race",
          durationMs: 5,
        };
      },
      fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    });
    h.commitCallerTurn("revision during commit");
    resolveCreate();
    await bookPromise;
    const slotKey = bookingSlotKey({
      schedulingGeneration: 2,
      offerSetId: o.offerSetId,
      slotId: "slot_1",
    });
    assert.ok(getConfirmedBookingForSlot("live_write_race", slotKey));
    pass("C18_REVISION_DURING_WRITE_COMMIT");
  }

  {
    const h = new DelegationFreshnessHarness("c19", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(3);
    h.sessionDelegationCreated({ id: "D1" });
    const runtime = (
      await import("../src/lib/voice-v3/state/call-runtime")
    ).getVoiceV3CallRuntime(h.liveSessionId)!;
    const snap = runtime.getSnapshot();
    runtime.replaceContext({
      ...snap,
      booking: { ...snap.booking, phase: "BOOKING_CONFIRMED", confirmed: { providerEventId: "e1" } as never },
    });
    h.commitCallerTurn("wait actually");
    await microWait();
    await h.functionCall("D1", "fc_book", "book_appointment", { slot_id: "slot_1" });
    h.assertSuperseded("fc_book");
    assert.equal(runtime.getSnapshot().booking.phase, "BOOKING_CONFIRMED");
    pass("C19_POST_SUCCESS_BEFORE_CLAIM");
  }

  {
    const h = new DelegationFreshnessHarness("c20", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(10);
    h.sessionDelegationCreated({ id: "delegation_old" });
    h.commitCallerTurn("revision eleven");
    await microWait();
    h.sessionDelegationCreated({ id: "delegation_new" });
    const coord = h.coordinator();
    coord.registerPendingFunctionCall({
      callId: "call_A",
      name: "update_intake",
      argumentsJson: "{}",
      delegationId: "delegation_old",
      outputSubmitted: false,
    });
    coord.registerPendingFunctionCall({
      callId: "call_B",
      name: "update_intake",
      argumentsJson: "{}",
      delegationId: "delegation_new",
      outputSubmitted: false,
    });
    h.clearOutbound();
    coord.submitDelegatedFunctionCallOutput({
      callId: "call_B",
      delegationId: "delegation_new",
      callerTurnId: null,
      semanticDisposition: "APPLIED",
      output: { ok: true, status: "B" },
    });
    coord.submitDelegatedFunctionCallOutput({
      callId: "call_A",
      delegationId: "delegation_old",
      callerTurnId: null,
      semanticDisposition: "APPLIED",
      output: { ok: true, status: "A" },
    });
    assert.equal(h.parseOutput("call_B").status, "B");
    pass("C20_OVERLAP_D1_D2_CORRELATION");
  }

  {
    const h = new DelegationFreshnessHarness("c21", CALLBACK_CONFIG);
    h.seedRevision(10);
    h.sessionDelegationCreated({ id: "D1" });
    h.commitCallerTurn("rev11");
    await microWait();
    h.sessionDelegationCreated({ id: "D2" });
    h.nestedResponseEvent("D1", { type: "response.completed" });
    assert.equal(h.coordinator().getDelegationRuntime("D2")!.semanticFreshness, "FRESH");
    pass("C21_D1_COMPLETES_AFTER_D2");
  }

  {
    const h = new DelegationFreshnessHarness("c22", VOICE_V3_BOOKING_TEST_CONFIG);
    h.seedRevision(10);
    h.sessionDelegationCreated({ id: "D1" });
    h.commitCallerTurn("rev11");
    await microWait();
    h.sessionDelegationCreated({ id: "D2" });
    const coord = h.coordinator();
    coord.registerPendingFunctionCall({
      callId: "call_D2",
      name: "update_intake",
      argumentsJson: "{}",
      delegationId: "D2",
      outputSubmitted: false,
    });
    coord.registerPendingFunctionCall({
      callId: "call_D1",
      name: "update_intake",
      argumentsJson: "{}",
      delegationId: "D1",
      outputSubmitted: false,
    });
    coord.submitDelegatedFunctionCallOutput({
      callId: "call_D2",
      delegationId: "D2",
      callerTurnId: null,
      semanticDisposition: "APPLIED",
      output: { ok: true, status: "D2_FIRST" },
    });
    coord.submitDelegatedFunctionCallOutput({
      callId: "call_D1",
      delegationId: "D1",
      callerTurnId: null,
      semanticDisposition: "APPLIED",
      output: { ok: true, status: "D1_LATE" },
    });
    assert.equal(h.parseOutput("call_D2").status, "D2_FIRST");
    pass("C22_D2_COMPLETES_AFTER_D1");
  }

  {
    const h = new DelegationFreshnessHarness("c23", CALLBACK_CONFIG);
    h.seedRevision(10);
    h.sessionDelegationCreated({ id: "D1" });
    h.commitCallerTurn("new");
    await microWait();
    assert.equal(shouldBlockStaleToolPreDispatch("book_appointment", "STALE"), true);
    await h.functionCall("D1", "fc_book", "book_appointment", { slot_id: "slot_1" });
    h.assertSuperseded("fc_book");
    assert.ok(h.continuations().length >= 1);
    pass("C23_STALE_CONTINUATION_BLOCKS_WRITE");
  }

  {
    const h = new DelegationFreshnessHarness("c24", CALLBACK_CONFIG);
    h.seedRevision(1);
    h.sessionDelegationCreated({ id: "D1" });
    const coord = h.coordinator();
    coord.registerPendingFunctionCall({
      callId: "c1",
      name: "update_intake",
      argumentsJson: "{}",
      delegationId: "D1",
      outputSubmitted: false,
    });
    coord.submitDelegatedFunctionCallOutput({
      callId: "c1",
      delegationId: "D1",
      callerTurnId: null,
      semanticDisposition: "APPLIED",
      output: { ok: true },
    });
    const n = h.continuations().length;
    assert.equal(coord.submitDelegatedFunctionCallOutput({
      callId: "c1",
      delegationId: "D1",
      callerTurnId: null,
      semanticDisposition: "APPLIED",
      output: { ok: true },
    }), false);
    assert.equal(h.continuations().length, n);
    pass("C24_DUPLICATE_FUNCTION_OUTPUT");
  }

  {
    clearBookingAttemptRegistry();
    const clock = buildVoiceV3CallClock(TZ);
    let ctx = createInitialVoiceV3CallContext({
      callId: "c25",
      liveSessionId: "live_dup_write",
      timezone: TZ,
      clock,
    });
    const o = offer(2);
    ctx = {
      ...ctx,
      dialog: { activeGoal: "BOOK_APPOINTMENT" },
      scheduling: { generation: 2, normalized: { precision: "DAYPART", localDate: "2026-09-25" } as never },
      availability: { ...ctx.availability, status: "ready", activeOfferSet: o },
      presentation: {
        current: recordPresentedOffer({ offerSet: o, presentedSlotIds: ["slot_1"] }),
      },
      intake: {
        values: {
          name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
          email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
          phone: { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() },
        },
      },
    };
    ctx = applySlotSelectionFromMeaning(ctx, {
      selection_type: "ORDINAL",
      spoken_time: null,
      ordinal: 1,
    }).context;
    let current = ctx;
    const runtime = {
      getSnapshot: () => current,
      replaceContext: (c: typeof current) => {
        current = c;
      },
      config: VOICE_V3_BOOKING_TEST_CONFIG,
    };
    await dispatchBookingIfRequired(runtime, {
      createBooking: async () => ({
        ok: true,
        providerEventId: "evt_dup",
        providerCalendarId: "cal_dup",
        durationMs: 3,
      }),
      fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    });
    const slotKey = bookingSlotKey({
      schedulingGeneration: 2,
      offerSetId: o.offerSetId,
      slotId: "slot_1",
    });
    assert.ok(getConfirmedBookingForSlot("live_dup_write", slotKey));
    await dispatchBookingIfRequired(runtime, {
      createBooking: async () => ({
        ok: true,
        providerEventId: "evt_dup2",
        providerCalendarId: "cal_dup2",
        durationMs: 3,
      }),
      fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    });
    assert.equal(
      getConfirmedBookingForSlot("live_dup_write", slotKey)?.providerEventId,
      "evt_dup",
    );
    pass("C25_DUPLICATE_COMMITTED_WRITE");
  }

  for (const id of CASE_IDS) {
    assert.equal(results.get(id), "PASS", `missing PASS for ${id}`);
  }
  console.log(
    "VOICE_V3_CONVERSATION_FRESHNESS_MATRIX_25_25",
    CASE_IDS.map((id) => `${id}=PASS`).join(" "),
  );
}

runAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
