/**
 * Deterministic certification for Microsoft appointment management (find / cancel / reschedule).
 * Graph I/O is mocked — does not call live Microsoft.
 */
import assert from "node:assert/strict";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import {
  clearDurableBookingStore,
  registerDurableBooking,
} from "../src/lib/voice-v3/calendar/durable-booking-store";
import type { ConfirmedBooking } from "../src/lib/voice-v3/calendar/booking-types";
import {
  appointmentSelectionId,
  findExistingAppointmentFromStore,
  resolveVerifiedAppointmentBySelectionId,
} from "../src/lib/voice-v3/calendar/find-existing-appointment";
import { buildFindExistingAppointmentWindow } from "../src/lib/voice-v3/calendar/find-existing-appointment-window";
import { filterBusyForReschedule } from "../src/lib/voice-v3/calendar/slot-generator";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { dispatchCancellationIfRequired } from "../src/lib/voice-v3/calendar/cancel-dispatch";
import { dispatchRescheduleIfRequired } from "../src/lib/voice-v3/calendar/reschedule-dispatch";
import { existingAppointmentFromConfirmed } from "../src/lib/voice-v3/calendar/appointment-management-types";
import type { AvailabilityOfferSet } from "../src/lib/voice-v3/calendar/offer-set";
import { applySlotSelectionFromMeaning } from "../src/lib/voice-v3/calendar/apply-slot-selection";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { deriveIntakeObjective } from "../src/lib/voice-v3/intake-objective";
import { executeVoiceTool } from "../src/lib/voice-v3/tools/execute-voice-tool";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";

const TZ = "America/New_York";

function seedConfirmed(id: string, startUtc: string, endUtc: string): ConfirmedBooking {
  return {
    bookingAttemptId: id,
    provider: "microsoft",
    providerEventId: `evt_${id}`,
    providerCalendarId: "primary",
    startUtc,
    endUtc,
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
}

async function main() {
  clearDurableBookingStore();

  // FIND: unique by date + identity
  const c1 = seedConfirmed("bka_1", "2026-09-25T18:30:00.000Z", "2026-09-25T19:30:00.000Z");
  registerDurableBooking(c1, { email: "a@b.co", phone: "+15551234567" });
  const found = findExistingAppointmentFromStore({
    callId: "c1",
    email: "a@b.co",
    phone: "+15551234567",
    dateExpression: "2026-09-25",
  });
  assert.equal(found.status, "FOUND");

  // FIND: multiple
  const c2 = seedConfirmed("bka_2", "2026-09-26T18:30:00.000Z", "2026-09-26T19:30:00.000Z");
  registerDurableBooking(c2, { email: "a@b.co" });
  const multi = findExistingAppointmentFromStore({ callId: "c2", email: "a@b.co" });
  assert.equal(multi.status, "MULTIPLE");

  // FIND: not found
  const none = findExistingAppointmentFromStore({ callId: "c3", email: "nobody@x.com" });
  assert.equal(none.status, "NONE");

  // Selection id bypass: raw provider event id rejected when passed as selection
  const appt = existingAppointmentFromConfirmed(c1, { email: "a@b.co" });
  assert.equal(
    resolveVerifiedAppointmentBySelectionId(c1.providerEventId, appt, null),
    null,
  );

  const window = buildFindExistingAppointmentWindow({
    timezone: TZ,
    dateExpression: "2026-09-25",
  });
  assert.ok(new Date(window.rangeEndUtc) > new Date(window.rangeStartUtc));

  // Reschedule busy exclusion keeps other events
  const busy = [
    { calendarId: "primary", startUtc: c1.startUtc, endUtc: c1.endUtc },
    { calendarId: "primary", startUtc: c1.startUtc, endUtc: c1.endUtc },
  ];
  const filtered = filterBusyForReschedule(busy, { startUtc: c1.startUtc, endUtc: c1.endUtc });
  assert.equal(filtered.length, 0);
  const busyOther = [
    ...busy,
    {
      calendarId: "primary",
      startUtc: "2026-09-25T20:00:00.000Z",
      endUtc: "2026-09-25T21:00:00.000Z",
    },
  ];
  const filtered2 = filterBusyForReschedule(busyOther, {
    startUtc: c1.startUtc,
    endUtc: c1.endUtc,
  });
  assert.equal(filtered2.length, 1);

  const clock = buildVoiceV3CallClock(TZ);
  let ctx = createInitialVoiceV3CallContext({
    callId: "mgmt",
    liveSessionId: "live_mgmt",
    timezone: TZ,
    clock,
  });
  const existing = found.status === "FOUND" ? found.appointment : appt;
  ctx = {
    ...ctx,
    dialog: { activeGoal: "CANCEL_APPOINTMENT" },
    intake: {
      values: {
        email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
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
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  };

  let patchCalled = 0;
  let deleteCalled = 0;

  clearVoiceV3CallRuntimeStore();
  const safetyRuntime = createVoiceV3CallRuntime({
    liveSessionId: "live_mgmt_tool",
    callId: "mgmt_tool",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  const toolCtx = {
    callId: "mgmt_tool",
    liveSessionId: "live_mgmt_tool",
    delegationId: null,
    functionCallId: "fc_cancel",
    runtime: safetyRuntime,
    tenantId: "mgmt_tool",
    sendContext: () => {},
  };

  // CANCEL without confirmation rejected at tool layer
  const cancelNoConfirm = await executeVoiceTool(toolCtx, "cancel_appointment", {
    appointment_selection_id: appointmentSelectionId(existing),
    confirmed: false,
  });
  assert.equal(cancelNoConfirm.ok, false);

  // PSTN regression: after find_appointment, cancel_appointment(confirmed=true) must arm cancelReady
  clearVoiceV3CallRuntimeStore();
  const postFindRuntime = createVoiceV3CallRuntime({
    liveSessionId: "live_post_find_cancel",
    callId: "post_find_cancel",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  const postFindCtx = createInitialVoiceV3CallContext({
    callId: "post_find_cancel",
    liveSessionId: "live_post_find_cancel",
    timezone: TZ,
    clock,
  });
  postFindRuntime.replaceContext({
    ...postFindCtx,
    dialog: { activeGoal: "CANCEL_APPOINTMENT" },
    appointmentManagement: {
      ...postFindCtx.appointmentManagement,
      verifiedExisting: existing,
      lookupCompleted: true,
      lastCancellationConfirmation: "NONE",
      cancellation: {
        phase: "CANCELLATION_CONFIRMATION_REQUIRED",
        cancellationAttemptId: null,
        awaitingConfirmation: true,
        boundProviderEventId: existing.providerEventId,
      },
    },
  });
  const rulesPreTool = evaluateVoiceV3Rules(
    postFindRuntime.getSnapshot(),
    VOICE_V3_BOOKING_TEST_CONFIG,
  );
  assert.equal(rulesPreTool.requiredAction, null);

  const postFindToolCtx = {
    callId: "post_find_cancel",
    liveSessionId: "live_post_find_cancel",
    delegationId: null,
    functionCallId: "fc_post_find_cancel",
    runtime: postFindRuntime,
    tenantId: "post_find_cancel",
    sendContext: () => {},
  };
  const cancelViaTool = await executeVoiceTool(postFindToolCtx, "cancel_appointment", {
    appointment_selection_id: appointmentSelectionId(existing),
    confirmed: true,
  });
  const afterTool = postFindRuntime.getSnapshot();
  assert.equal(afterTool.appointmentManagement.lastCancellationConfirmation, "CONFIRM");
  assert.notEqual(
    afterTool.appointmentManagement.cancellation.phase,
    "NONE",
    "cancel_appointment must attempt Graph dispatch (not leave cancellation at NONE)",
  );
  assert.notEqual(
    cancelViaTool.ok && cancelViaTool.status === "pending",
    true,
    "cancel_appointment must not return ok/pending after confirmed=true",
  );

  await dispatchCancellationIfRequired(rt, {
    cancelBooking: async () => {
      deleteCalled += 1;
      return { ok: true, durationMs: 1 };
    },
  });
  assert.equal(deleteCalled, 1);
  assert.equal(ctx.appointmentManagement.cancellation.phase, "CANCELLATION_CONFIRMED");

  // RESCHEDULE PATCH path (mock)
  patchCalled = 0;
  const offer: AvailabilityOfferSet = {
    offerSetId: "offer_mgmt",
    schedulingGeneration: 2,
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
  ctx = {
    ...createInitialVoiceV3CallContext({
      callId: "rsc2",
      liveSessionId: "live_rsc2",
      timezone: TZ,
      clock,
    }),
    dialog: { activeGoal: "RESCHEDULE_APPOINTMENT" },
    scheduling: { generation: 2, normalized: { precision: "DATE_ONLY", localDate: "2026-09-25" } as never },
    intake: {
      values: {
        name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
        email: { value: "a@b.co", source: "caller", updatedAt: new Date().toISOString() },
        phone: { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() },
      },
    },
    appointmentManagement: {
      ...createInitialVoiceV3CallContext({
        callId: "rsc2",
        liveSessionId: "live_rsc2",
        timezone: TZ,
        clock,
      }).appointmentManagement,
      verifiedExisting: existing,
      lookupCompleted: true,
    },
    availability: {
      status: "ready",
      activeOfferSet: offer,
      lastDispatchedRequestKey: null,
      inFlightGeneration: null,
      lastFailure: null,
      findStartedAt: null,
    },
    selection: { selected: null, lastResolutionStatus: null },
  };
  ctx = applySlotSelectionFromMeaning(ctx, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 1,
  }).context;
  assert.equal(evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG).rescheduleReady, true);
  const rt2 = {
    getSnapshot: () => ctx,
    replaceContext: (c: typeof ctx) => {
      ctx = c;
    },
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  };
  await dispatchRescheduleIfRequired(rt2, {
    fetchRevalidateBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    updateBooking: async (input) => {
      patchCalled += 1;
      assert.equal(input.providerEventId, existing.providerEventId);
      return { ok: true, durationMs: 2 };
    },
  });
  assert.equal(patchCalled, 1);
  assert.equal(ctx.appointmentManagement.reschedule.phase, "RESCHEDULE_CONFIRMED");
  assert.equal(ctx.appointmentManagement.verifiedExisting?.providerEventId, existing.providerEventId);

  // PSTN regression (ws_1): reschedule after find must not require full new-booking intake
  let ctxPartialIntake = {
    ...createInitialVoiceV3CallContext({
      callId: "rsc_partial",
      liveSessionId: "live_rsc_partial",
      timezone: TZ,
      clock,
    }),
    dialog: { activeGoal: "RESCHEDULE_APPOINTMENT" },
    scheduling: {
      generation: 2,
      normalized: { precision: "DATE_ONLY", localDate: "2026-09-25" } as never,
    },
    intake: {
      values: {
        name: { value: "Anthony", source: "caller", updatedAt: new Date().toISOString() },
        phone: { value: "+15551234567", source: "caller", updatedAt: new Date().toISOString() },
      },
    },
    appointmentManagement: {
      ...createInitialVoiceV3CallContext({
        callId: "rsc_partial",
        liveSessionId: "live_rsc_partial",
        timezone: TZ,
        clock,
      }).appointmentManagement,
      verifiedExisting: existing,
      lookupCompleted: true,
    },
    availability: {
      status: "ready",
      activeOfferSet: offer,
      lastDispatchedRequestKey: null,
      inFlightGeneration: null,
      lastFailure: null,
      findStartedAt: null,
    },
    selection: { selected: null, lastResolutionStatus: null },
  };
  ctxPartialIntake = applySlotSelectionFromMeaning(ctxPartialIntake, {
    selection_type: "ORDINAL",
    spoken_time: null,
    ordinal: 1,
  }).context;
  assert.equal(
    deriveIntakeObjective(VOICE_V3_BOOKING_TEST_CONFIG, ctxPartialIntake).status,
    "IN_PROGRESS",
  );
  const partialRules = evaluateVoiceV3Rules(ctxPartialIntake, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(partialRules.rescheduleReady, true);
  assert.equal(partialRules.requiredAction, "RESCHEDULE_APPOINTMENT");

  clearVoiceV3CallRuntimeStore();
  const partialRuntime = createVoiceV3CallRuntime({
    liveSessionId: "live_rsc_partial_tool",
    callId: "rsc_partial_tool",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  partialRuntime.replaceContext(ctxPartialIntake);
  const partialToolCtx = {
    callId: "rsc_partial_tool",
    liveSessionId: "live_rsc_partial_tool",
    delegationId: null,
    functionCallId: "fc_rsc_partial",
    runtime: partialRuntime,
    tenantId: "rsc_partial_tool",
    sendContext: () => {},
  };
  const rescheduleViaTool = await executeVoiceTool(partialToolCtx, "reschedule_appointment", {
    appointment_selection_id: appointmentSelectionId(existing),
    offer_set_id: offer.offerSetId,
    slot_id: "slot_1",
  });
  const afterRescheduleTool = partialRuntime.getSnapshot();
  assert.notEqual(
    afterRescheduleTool.appointmentManagement.reschedule.phase,
    "NONE",
    "reschedule_appointment must attempt Graph dispatch",
  );
  assert.notEqual(
    rescheduleViaTool.ok && rescheduleViaTool.status === "pending",
    true,
    "reschedule_appointment must not return ok/pending when slot is bound",
  );

  console.log("PASS voice-v3 microsoft appointment management");
}

main().catch((e) => {
  console.error("FAIL voice-v3 microsoft appointment management", e);
  process.exit(1);
});
