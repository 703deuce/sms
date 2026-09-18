/**
 * Voice V3 §47 — complete deterministic failure / claim matrix (CI).
 */
import assert from "node:assert/strict";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { evaluateVoiceV3Recovery } from "../src/lib/voice-v3/recovery/evaluate-recovery";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import { evaluateAllowedClaims } from "../src/lib/voice-v3/agent/evaluate-claims";
import { startOperation, transitionOperation } from "../src/lib/voice-v3/operations/registry";
import { mapProviderFailureToRecoveryCode } from "../src/lib/voice-v3/operations/provider-failure-map";
import {
  claimDelegatedAstraResponse,
  clearDelegatedAstraResponseDedup,
} from "../src/lib/voice-v3/intake/delegated-response-dedup";
import { decodeCallerMeaningFromFunctionArguments } from "../src/lib/voice-v3/intake/decode-delegated-caller-meaning";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

function base() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "s47_call",
    liveSessionId: "s47_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function assertClaimsInvariant(ctx: ReturnType<typeof base>) {
  const snap = planAgentState(ctx, CONFIG);
  const ops = Object.values(ctx.operations ?? {});
  const findRunning = ops.some((o) => o.type === "FIND_AVAILABILITY" && o.status === "RUNNING");
  if (findRunning) {
    assert.ok(snap.allowedClaims.includes("CLAIM_CHECKING_AVAILABILITY"));
  } else {
    assert.ok(snap.forbiddenClaims.includes("CLAIM_CHECKING_AVAILABILITY"));
  }
  const bookOk = ops.some((o) => o.type === "BOOK_APPOINTMENT" && o.status === "SUCCEEDED");
  if (!bookOk || ctx.booking.phase !== "BOOKING_CONFIRMED") {
    assert.ok(snap.forbiddenClaims.includes("CLAIM_BOOKED"));
  }
  const outcomeUnk = ops.some((o) => o.status === "OUTCOME_UNKNOWN");
  if (outcomeUnk) {
    assert.ok(snap.forbiddenClaims.includes("CLAIM_BOOKED"));
    assert.ok(snap.forbiddenClaims.includes("CLAIM_CANCELLED"));
    assert.ok(snap.forbiddenClaims.includes("CLAIM_RESCHEDULED"));
  }
}

function microsoftCodes() {
  const cases: { token: string; code: string }[] = [
    { token: "401 unauthorized", code: "MICROSOFT_AUTH_FAILED" },
    { token: "403 forbidden", code: "MICROSOFT_AUTH_FAILED" },
    { token: "404 not_found", code: "APPOINTMENT_NOT_FOUND" },
    { token: "409 conflict", code: "SLOT_NOT_AVAILABLE" },
    { token: "429 throttled", code: "MICROSOFT_THROTTLED" },
    { token: "500 internal", code: "MICROSOFT_TEMPORARY_FAILURE" },
    { token: "502 bad gateway", code: "MICROSOFT_TEMPORARY_FAILURE" },
    { token: "503 unavailable", code: "MICROSOFT_TEMPORARY_FAILURE" },
    { token: "504 gateway timeout", code: "MICROSOFT_TEMPORARY_FAILURE" },
    { token: "ETIMEDOUT", code: "PROVIDER_TIMEOUT" },
    { token: "network ECONNRESET", code: "MICROSOFT_TEMPORARY_FAILURE" },
    { token: "timeout", code: "PROVIDER_TIMEOUT" },
  ];
  for (const c of cases) {
    assert.equal(mapProviderFailureToRecoveryCode(c.token), c.code);
  }
}

function findScenarios() {
  let ctx = base();
  ctx = {
    ...ctx,
    availability: {
      ...ctx.availability,
      status: "empty",
      activeOfferSet: { offerSetId: "o", schedulingGeneration: 1, slots: [], timezone: CONFIG.timezone, presentationOrder: [], createdAt: NOW.toISOString() },
      inFlightGeneration: null,
    },
    scheduling: {
      generation: 1,
      normalized: { precision: "DAYPART", localDate: "2026-09-25" } as never,
      meaning: {
        date_relation: "NEXT_WEEKDAY",
        weekday: "FRIDAY",
        date_expression: "Friday",
        explicit_date: null,
        time_expression: "afternoon",
        time_kind: "DAYPART",
        exact_time: null,
        start_time: null,
        end_time: null,
        daypart: "AFTERNOON",
      },
    },
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
  };
  const rules = evaluateVoiceV3Rules(ctx, CONFIG);
  const r = evaluateVoiceV3Recovery({
    ctx,
    rules,
    config: CONFIG,
    now: NOW,
  });
  assert.equal(r?.code, "NO_AVAILABILITY", `rules may_find=${rules.mayFindAvailability}`);

  ctx = startOperation(ctx, {
    operationId: "find_to",
    type: "FIND_AVAILABILITY",
    schedulingGeneration: 1,
  });
  ctx = transitionOperation(ctx, "find_to", "TIMED_OUT", { failureCode: "timeout" });
  assert.equal(ctx.operations!.find_to.status, "TIMED_OUT");

  ctx = base();
  ctx = startOperation(ctx, { operationId: "find_stale", type: "FIND_AVAILABILITY", schedulingGeneration: 1 });
  ctx = transitionOperation(ctx, "find_stale", "STALE");
  assertClaimsInvariant(ctx);
}

function bookScenarios() {
  let ctx = base();
  ctx = startOperation(ctx, { operationId: "b1", type: "BOOK_APPOINTMENT" });
  ctx = transitionOperation(ctx, "b1", "OUTCOME_UNKNOWN");
  ctx = {
    ...ctx,
    booking: { ...ctx.booking, phase: "BOOKING_OUTCOME_UNKNOWN", lastFailure: { reason: "timeout", message: "x", at: NOW.toISOString() } },
  };
  const claims = evaluateAllowedClaims(ctx);
  assert.ok(claims.forbidden.includes("CLAIM_BOOKED"));
  const rec = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
  });
  assert.equal(rec?.code, "BOOKING_OUTCOME_UNKNOWN");

  ctx = base();
  ctx = startOperation(ctx, { operationId: "b2", type: "BOOK_APPOINTMENT" });
  ctx = transitionOperation(ctx, "b2", "SUCCEEDED");
  ctx = {
    ...ctx,
    booking: {
      ...ctx.booking,
      phase: "BOOKING_CONFIRMED",
      confirmed: {
        bookingAttemptId: "b2",
        provider: "microsoft",
        providerEventId: "e",
        providerCalendarId: "c",
        startUtc: "",
        endUtc: "",
        localStart: "",
        localEnd: "",
        timezone: CONFIG.timezone,
        customerName: "A",
        serviceId: "s",
        confirmedAt: NOW.toISOString(),
        offerSetId: "o",
        slotId: "sl",
        schedulingGeneration: 1,
      },
    },
  };
  assert.ok(evaluateAllowedClaims(ctx).allowed.includes("CLAIM_BOOKED"));
}

function cancelRescheduleScenarios() {
  let ctx = base();
  ctx = {
    ...ctx,
    dialog: { activeGoal: "CANCEL_APPOINTMENT" },
    appointmentManagement: {
      ...ctx.appointmentManagement,
      cancellation: {
        ...ctx.appointmentManagement.cancellation,
        phase: "CANCELLATION_CONFIRMATION_REQUIRED",
        awaitingConfirmation: true,
      },
    },
  };
  const rec = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
  });
  assert.equal(rec?.code, "CANCELLATION_CONFIRMATION_REQUIRED");

  ctx = base();
  ctx = {
    ...ctx,
    appointmentManagement: {
      ...ctx.appointmentManagement,
      candidateSet: [{ providerEventId: "a" }, { providerEventId: "b" }] as never,
    },
    dialog: { activeGoal: "CANCEL_APPOINTMENT" },
  };
  assert.equal(
    evaluateVoiceV3Recovery({
      ctx,
      rules: evaluateVoiceV3Rules(ctx, CONFIG),
      config: CONFIG,
    })?.code,
    "MULTIPLE_APPOINTMENTS_FOUND",
  );
}

function astraScenarios() {
  clearDelegatedAstraResponseDedup("s47_live");
  const nested = { id: "resp_dup", output: [] };
  assert.equal(claimDelegatedAstraResponse("s47_live", nested), true);
  assert.equal(claimDelegatedAstraResponse("s47_live", nested), false);

  const bad = decodeCallerMeaningFromFunctionArguments("not-json", CONFIG, {
    callId: "s47_call",
    liveSessionId: "s47_live",
    stateVersion: 0,
  });
  assert.equal(bad, null);

  const emptyArgs = decodeCallerMeaningFromFunctionArguments("", CONFIG);
  assert.equal(emptyArgs, null);
}

function main() {
  microsoftCodes();
  findScenarios();
  bookScenarios();
  cancelRescheduleScenarios();
  astraScenarios();
  console.log("VOICE_V3_S47_COMPLETE_PASS");
}

main();
