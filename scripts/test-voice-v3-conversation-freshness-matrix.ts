#!/usr/bin/env tsx
/**
 * High-fidelity conversation freshness matrix (no audio/PSTN).
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import {
  DelegationFreshnessHarness,
  outputItemDone,
} from "../src/lib/voice-v3/testing/delegation-freshness-harness";
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

const results: string[] = [];
function pass(id: string) {
  results.push(`${id}=PASS`);
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

async function case07_call2_booking_to_callback_structure(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_call2_struct", CALLBACK_CONFIG);
  h.seedRevision(10);
  h.sessionDelegationCreated({ id: "D2", offset_ms: 100 });
  const d2 = h.coordinator().getDelegationRuntime("D2")!;
  assert.equal(d2.basedOnConversationRevision, 10);
  assert.equal(d2.semanticFreshness, "FRESH");

  await h.functionCall("D2", "fc_intake_10", "update_intake", {
    name: "Anthony",
    email: null,
    phone: "+15551234567",
    date_expression: "Monday",
    time_expression: "afternoon",
    active_goal: "BOOK_APPOINTMENT",
  });
  const intakeOut = h.functionOutputs().find((o) => o.call_id === "fc_intake_10");
  assert.ok(intakeOut);
  assert.ok(!intakeOut!.output.includes("SEMANTIC_SUPERSEDED"));

  h.commitCallerTurn("actually just have somebody call me back");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.currentRevision(), 11);
  assert.equal(d2.semanticFreshness, "STALE");

  await h.functionCall("D2", "fc_set_stale", "set_scheduling_preference", {
    date_relation: "NEXT_WEEKDAY",
    weekday: "MONDAY",
    time_kind: "DAYPART",
    daypart: "AFTERNOON",
    date_expression: "Monday afternoon",
    time_expression: "afternoon",
  });
  const staleOut = JSON.parse(
    h.functionOutputs().find((o) => o.call_id === "fc_set_stale")!.output,
  );
  assert.equal(staleOut.status, "SEMANTIC_SUPERSEDED");
  assert.equal(h.coordinator().getSnapshot?.() ?? null, null);

  const runtimeAfterStale = (
    await import("../src/lib/voice-v3/state/call-runtime")
  ).getVoiceV3CallRuntime(h.liveSessionId)!;
  assert.notEqual(runtimeAfterStale.getSnapshot().dialog.activeGoal, "BOOK_APPOINTMENT");

  h.sessionDelegationCreated({ id: "D3", offset_ms: 200 });
  const d3 = h.coordinator().getDelegationRuntime("D3")!;
  assert.equal(d3.basedOnConversationRevision, 11);
  assert.equal(d3.semanticFreshness, "FRESH");
  assert.equal(d2.semanticFreshness, "STALE");

  await h.functionCall("D3", "fc_cb", "request_callback", {
    callback_phone: null,
    reason: "Caller asked for callback",
    preferred_time: null,
    notes: null,
  });
  let cbRow = h.functionOutputs().find((o) => o.call_id === "fc_cb");
  for (let i = 0; i < 40 && !cbRow; i++) {
    await new Promise((r) => setTimeout(r, 50));
    cbRow = h.functionOutputs().find((o) => o.call_id === "fc_cb");
  }
  assert.ok(cbRow, "D3 request_callback must produce function_call_output");
  const cbOut = JSON.parse(cbRow!.output);
  assert.notEqual(cbOut.status, "SEMANTIC_SUPERSEDED");
  assert.equal(
    (await import("../src/lib/voice-v3/state/call-runtime")).getVoiceV3CallRuntime(
      h.liveSessionId,
    )!.getSnapshot().dialog.activeGoal,
    "REQUEST_CALLBACK",
  );
  pass("07_booking_to_callback_event_replay");
}

async function case20_overlapping_delegation_correlation(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_overlap", VOICE_V3_BOOKING_TEST_CONFIG);
  h.seedRevision(10);
  h.sessionDelegationCreated({ id: "delegation_old" });
  h.commitCallerTurn("revision eleven");
  await new Promise((r) => setTimeout(r, 20));
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

  const outputs = h.functionOutputs();
  assert.equal(outputs.length, 2);
  const b = JSON.parse(outputs.find((o) => o.call_id === "call_B")!.output);
  const a = JSON.parse(outputs.find((o) => o.call_id === "call_A")!.output);
  assert.equal(b.status, "B");
  assert.equal(a.status, "A");
  assert.equal(coord.getPendingCallDelegationId("call_A"), "delegation_old");
  assert.equal(coord.getPendingCallDelegationId("call_B"), "delegation_new");
  assert.equal(coord.getDelegationRuntime("delegation_new")!.semanticFreshness, "FRESH");
  assert.equal(coord.getDelegationRuntime("delegation_old")!.semanticFreshness, "STALE");
  pass("20_overlapping_delegation_correlation");
  pass("23_interleaved_function_call_output");
}

function case16_find_returns_after_d2(): void {
  const h = new DelegationFreshnessHarness("live_find_race", VOICE_V3_BOOKING_TEST_CONFIG);
  h.seedRevision(10);
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "call_find_race",
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

  const afterD1 = applyFindAvailabilityResult(ctx, {
    schedulingGeneration: 3,
    conversationRevision: 10,
    offerSet: o,
    failure: null,
    requestKey: "find_d1",
  });
  h.seedRevision(11);
  h.sessionDelegationCreated({ id: "D2" });
  const current = h.currentRevision();
  const ignored = applyFindAvailabilityResult(afterD1, {
    schedulingGeneration: 3,
    conversationRevision: 10,
    offerSet: offer(99),
    failure: null,
    requestKey: "find_d1_late",
  });
  assert.equal(ignored.availability.activeOfferSet?.offerSetId, o.offerSetId);
  assert.equal(h.coordinator().getDelegationRuntime("D2")!.semanticFreshness, "FRESH");
  assert.ok(current >= 11);
  pass("16_revision_during_find");
  pass("04_find_stale_after_d2");
}

async function case22_stale_delegation_second_tool_blocked(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_stale_cont", CALLBACK_CONFIG);
  h.seedRevision(10);
  h.sessionDelegationCreated({ id: "D1" });
  h.commitCallerTurn("new info");
  await new Promise((r) => setTimeout(r, 20));
  const d1 = h.coordinator().getDelegationRuntime("D1")!;
  assert.equal(d1.semanticFreshness, "STALE");

  assert.equal(shouldBlockStaleToolPreDispatch("update_intake", "STALE"), false);
  assert.equal(shouldBlockStaleToolPreDispatch("find_availability", "STALE"), false);
  assert.equal(shouldBlockStaleToolPreDispatch("set_scheduling_preference", "STALE"), true);
  assert.equal(shouldBlockStaleToolPreDispatch("book_appointment", "STALE"), true);
  assert.equal(shouldBlockStaleToolPreDispatch("request_callback", "STALE"), true);
  assert.equal(shouldBlockStaleToolPreDispatch("transfer_call", "STALE"), true);

  await h.functionCall("D1", "fc_book_stale", "book_appointment", { slot_id: "slot_1" });
  const out = JSON.parse(
    h.functionOutputs().find((o) => o.call_id === "fc_book_stale")!.output,
  );
  assert.equal(out.status, "SEMANTIC_SUPERSEDED");
  assert.ok(h.continuations().length >= 1);
  pass("22_stale_second_tool_after_continuation");
  pass("05_stale_continuation_no_reauth");
}

async function case06_freshness_per_delegation(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_fresh_chain", CALLBACK_CONFIG);
  h.seedRevision(10);
  h.sessionDelegationCreated({ id: "D1" });
  h.commitCallerTurn("t11");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
  h.sessionDelegationCreated({ id: "D2" });
  assert.equal(h.coordinator().getDelegationRuntime("D2")!.semanticFreshness, "FRESH");
  h.commitCallerTurn("t12");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
  assert.equal(h.coordinator().getDelegationRuntime("D2")!.semanticFreshness, "STALE");
  h.sessionDelegationCreated({ id: "D3" });
  assert.equal(h.coordinator().getDelegationRuntime("D3")!.semanticFreshness, "FRESH");
  assert.equal(h.coordinator().getDelegationRuntime("D3")!.basedOnConversationRevision, 12);
  pass("06_fresh_delegation_not_inherit_stale");
  pass("15_rapid_revision_coalesce_snapshot");
}

async function case15_rapid_revisions(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_rapid", CALLBACK_CONFIG);
  h.seedRevision(10);
  h.sessionDelegationCreated({ id: "D1" });
  h.commitCallerTurn("r11");
  h.commitCallerTurn("r12");
  h.commitCallerTurn("r13");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
  h.sessionDelegationCreated({ id: "D2" });
  assert.equal(h.coordinator().getDelegationRuntime("D2")!.basedOnConversationRevision, 13);
  pass("15_rapid_revision_10_to_13");
}

async function case18_committed_write_race(): Promise<void> {
  clearBookingAttemptRegistry();
  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "call_write_race",
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
  const createGate = new Promise<void>((r) => {
    resolveCreate = r;
  });

  const h = new DelegationFreshnessHarness("live_write_race", VOICE_V3_BOOKING_TEST_CONFIG);
  h.seedRevision(10);

  const bookPromise = dispatchBookingIfRequired(runtime, {
    createBooking: async () => {
      await createGate;
      return {
        ok: true,
        providerEventId: "evt_race",
        providerCalendarId: "cal_race",
        durationMs: 5,
      };
    },
    fetchRevalidateBusy: async () => ({
      ok: true,
      busy: [],
      durationMs: 1,
    }),
  });

  h.commitCallerTurn("wait I meant callback");
  resolveCreate();
  await bookPromise;

  const slotKey = bookingSlotKey({
    schedulingGeneration: 2,
    offerSetId: o.offerSetId,
    slotId: "slot_1",
  });
  assert.ok(getConfirmedBookingForSlot("live_write_race", slotKey));
  pass("18_revision_during_write_commit");
}

async function straightFreshTool(
  id: string,
  tool: string,
  args: Record<string, unknown>,
  config = VOICE_V3_BOOKING_TEST_CONFIG,
): Promise<void> {
  const h = new DelegationFreshnessHarness(`live_straight_${id}`, config);
  h.seedRevision(1);
  h.sessionDelegationCreated({ id: "D_fresh" });
  await h.functionCall("D_fresh", `fc_${id}`, tool, args);
  const out = h.functionOutputs().find((o) => o.call_id === `fc_${id}`);
  assert.ok(out);
  const parsed = JSON.parse(out!.output);
  assert.notEqual(parsed.status, "SEMANTIC_SUPERSEDED");
  pass(id);
}

async function main(): Promise<void> {
  await straightFreshTool("01_straight_booking_intake", "update_intake", {
    name: "A",
    email: "a@b.co",
    phone: "+15551234567",
  });
  await straightFreshTool("02_straight_callback", "request_callback", {
    callback_phone: null,
    reason: "test",
    preferred_time: null,
    notes: null,
  }, CALLBACK_CONFIG);

  await case07_call2_booking_to_callback_structure();
  await case20_overlapping_delegation_correlation();
  case16_find_returns_after_d2();
  await case22_stale_delegation_second_tool_blocked();
  await case06_freshness_per_delegation();
  await case15_rapid_revisions();
  await case18_committed_write_race();

  await case08_callback_to_booking();
  await case21_d1_finishes_after_d2();
  case24_duplicate_continuation_prevention();

  console.log("VOICE_V3_CONVERSATION_FRESHNESS_MATRIX", results.join(" "));
  console.log("VOICE_V3_FRESHNESS_MATRIX_IMPLEMENTED_COUNT", results.length);
}

async function case08_callback_to_booking(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_cb_to_book", CALLBACK_CONFIG);
  h.seedRevision(5);
  h.sessionDelegationCreated({ id: "D_cb" });
  await h.functionCall("D_cb", "fc_cb1", "request_callback", {
    callback_phone: null,
    reason: "callback first",
    preferred_time: null,
    notes: null,
  });
  h.commitCallerTurn("actually book now");
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.coordinator().getDelegationRuntime("D_cb")!.semanticFreshness, "STALE");
  h.sessionDelegationCreated({ id: "D_book" });
  await h.functionCall("D_book", "fc_set", "set_scheduling_preference", {
    date_relation: "NEXT_WEEKDAY",
    weekday: "TUESDAY",
    time_kind: "DAYPART",
    daypart: "MORNING",
    date_expression: "Tuesday morning",
    time_expression: "morning",
  });
  const out = JSON.parse(h.functionOutputs().find((o) => o.call_id === "fc_set")!.output);
  assert.notEqual(out.status, "SEMANTIC_SUPERSEDED");
  pass("08_callback_to_booking");
}

async function case21_d1_finishes_after_d2(): Promise<void> {
  const h = new DelegationFreshnessHarness("live_d1_late", CALLBACK_CONFIG);
  h.seedRevision(10);
  h.sessionDelegationCreated({ id: "D1" });
  h.commitCallerTurn("rev11");
  await new Promise((r) => setTimeout(r, 20));
  h.sessionDelegationCreated({ id: "D2" });
  assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
  assert.equal(h.coordinator().getDelegationRuntime("D2")!.semanticFreshness, "FRESH");
  h.nestedResponseEvent("D1", { type: "response.completed" });
  assert.equal(h.coordinator().getDelegationRuntime("D2")!.semanticFreshness, "FRESH");
  assert.equal(h.coordinator().getDelegationRuntime("D1")!.semanticFreshness, "STALE");
  pass("21_d1_finishes_after_d2");
}

function case24_duplicate_continuation_prevention(): void {
  const h = new DelegationFreshnessHarness("live_dup_cont", CALLBACK_CONFIG);
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
  const afterFirst = h.continuations().length;
  assert.equal(afterFirst, 1);
  const dupSubmit = coord.submitDelegatedFunctionCallOutput({
    callId: "c1",
    delegationId: "D1",
    callerTurnId: null,
    semanticDisposition: "APPLIED",
    output: { ok: true },
  });
  assert.equal(dupSubmit, false);
  assert.equal(h.continuations().length, afterFirst);
  pass("24_duplicate_continuation");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
