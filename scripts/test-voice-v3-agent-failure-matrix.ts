/**
 * §47 — production failure classes for FIND / BOOK / RESCHEDULE / CANCEL (deterministic).
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
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const NOW = new Date("2026-09-17T15:00:00.000Z");
const CONFIG = VOICE_V3_BOOKING_TEST_CONFIG;

type FailureClass = {
  token: string;
  expectedRecovery: string;
  expectedConversationAction: string;
};

const PRODUCTION_CLASSES: FailureClass[] = [
  { token: "timeout", expectedRecovery: "PROVIDER_TIMEOUT", expectedConversationAction: "INFORM_TEMPORARY_FAILURE" },
  {
    token: "network ECONNRESET",
    expectedRecovery: "MICROSOFT_TEMPORARY_FAILURE",
    expectedConversationAction: "INFORM_TEMPORARY_FAILURE",
  },
  {
    token: "400 validation error",
    expectedRecovery: "MICROSOFT_TEMPORARY_FAILURE",
    expectedConversationAction: "INFORM_TEMPORARY_FAILURE",
  },
  { token: "401 unauthorized", expectedRecovery: "MICROSOFT_AUTH_FAILED", expectedConversationAction: "INFORM_TEMPORARY_FAILURE" },
  { token: "403 forbidden", expectedRecovery: "MICROSOFT_AUTH_FAILED", expectedConversationAction: "INFORM_TEMPORARY_FAILURE" },
  { token: "404 not_found", expectedRecovery: "APPOINTMENT_NOT_FOUND", expectedConversationAction: "NONE" },
  { token: "409 conflict", expectedRecovery: "SLOT_NOT_AVAILABLE", expectedConversationAction: "NONE" },
  { token: "429 throttled", expectedRecovery: "MICROSOFT_THROTTLED", expectedConversationAction: "INFORM_TEMPORARY_FAILURE" },
  {
    token: "503 server error",
    expectedRecovery: "MICROSOFT_TEMPORARY_FAILURE",
    expectedConversationAction: "INFORM_TEMPORARY_FAILURE",
  },
];

function base() {
  const clock = buildVoiceV3CallClock(CONFIG.timezone, NOW);
  return createInitialVoiceV3CallContext({
    callId: "fail_call",
    liveSessionId: "fail_live",
    timezone: CONFIG.timezone,
    clock,
    now: NOW,
  });
}

function assertFindFailureClass(fc: FailureClass) {
  let ctx = base();
  ctx = {
    ...ctx,
    availability: {
      ...ctx.availability,
      status: "failed",
      lastFailure: {
        reason: fc.token,
        message: fc.token,
        at: NOW.toISOString(),
        schedulingGeneration: 1,
      },
    },
  };
  assert.equal(mapProviderFailureToRecoveryCode(fc.token), fc.expectedRecovery);
  const recovery = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
    now: NOW,
  });
  assert.equal(recovery?.code, fc.expectedRecovery);
  const snap = planAgentState(ctx, CONFIG);
  assert.equal(snap.nextConversationAction.type, fc.expectedConversationAction);
}

function assertBookProviderFailure(fc: FailureClass) {
  let ctx = base();
  ctx = {
    ...ctx,
    dialog: { activeGoal: "BOOK_APPOINTMENT" },
    booking: {
      ...ctx.booking,
      phase: "BOOKING_FAILED",
      lastFailure: {
        reason: fc.token,
        message: fc.token,
        at: NOW.toISOString(),
        bookingAttemptId: "bka_fail",
        schedulingGeneration: 1,
      },
    },
  };
  ctx = startOperation(ctx, { operationId: "bka_fail", type: "BOOK_APPOINTMENT" });
  ctx = transitionOperation(ctx, "bka_fail", "FAILED", { failureCode: fc.expectedRecovery });
  const claims = evaluateAllowedClaims(ctx);
  assert.ok(claims.forbidden.includes("CLAIM_BOOKED"));
  const recovery = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
    now: NOW,
  });
  assert.ok(recovery?.code === "MICROSOFT_TEMPORARY_FAILURE" || recovery?.code === fc.expectedRecovery);
}

function assertMutatingOutcomeUnknown(
  phase: "BOOKING_OUTCOME_UNKNOWN" | "RESCHEDULE_OUTCOME_UNKNOWN" | "CANCELLATION_OUTCOME_UNKNOWN",
  recoveryCode: string,
  opType: "BOOK_APPOINTMENT" | "RESCHEDULE_APPOINTMENT" | "CANCEL_APPOINTMENT",
) {
  let ctx = base();
  if (phase === "BOOKING_OUTCOME_UNKNOWN") {
    ctx = {
      ...ctx,
      booking: {
        ...ctx.booking,
        phase: "BOOKING_OUTCOME_UNKNOWN",
        lastFailure: { reason: "outcome_unknown", message: "x", at: NOW.toISOString() },
      },
    };
  } else if (phase === "RESCHEDULE_OUTCOME_UNKNOWN") {
    ctx = {
      ...ctx,
      appointmentManagement: {
        ...ctx.appointmentManagement,
        reschedule: { phase: "RESCHEDULE_OUTCOME_UNKNOWN", attemptId: "rsc_unk" },
      },
    };
  } else {
    ctx = {
      ...ctx,
      appointmentManagement: {
        ...ctx.appointmentManagement,
        cancellation: {
          ...ctx.appointmentManagement.cancellation,
          phase: "CANCELLATION_OUTCOME_UNKNOWN",
        },
      },
    };
  }
  ctx = startOperation(ctx, { operationId: "op_unk", type: opType });
  ctx = transitionOperation(ctx, "op_unk", "OUTCOME_UNKNOWN");
  const recovery = evaluateVoiceV3Recovery({
    ctx,
    rules: evaluateVoiceV3Rules(ctx, CONFIG),
    config: CONFIG,
    now: NOW,
  });
  assert.equal(recovery?.code, recoveryCode);
  const snap = planAgentState(ctx, CONFIG);
  assert.equal(snap.nextConversationAction.type, "INFORM_TEMPORARY_FAILURE");
}

function assertStaleFindSupersedesClaims() {
  let ctx = base();
  ctx = startOperation(ctx, {
    operationId: "find_stale",
    type: "FIND_AVAILABILITY",
    schedulingGeneration: 1,
  });
  ctx = transitionOperation(ctx, "find_stale", "STALE");
  const claims = evaluateAllowedClaims(ctx);
  assert.ok(claims.forbidden.includes("CLAIM_CHECKING_AVAILABILITY"));
  assert.ok(claims.forbidden.includes("CLAIM_BOOKED"));
}

function main() {
  for (const fc of PRODUCTION_CLASSES) {
    assertFindFailureClass(fc);
  }
  for (const fc of PRODUCTION_CLASSES.slice(0, 6)) {
    assertBookProviderFailure(fc);
  }

  assertMutatingOutcomeUnknown("BOOKING_OUTCOME_UNKNOWN", "BOOKING_OUTCOME_UNKNOWN", "BOOK_APPOINTMENT");
  assertMutatingOutcomeUnknown(
    "RESCHEDULE_OUTCOME_UNKNOWN",
    "RESCHEDULE_OUTCOME_UNKNOWN",
    "RESCHEDULE_APPOINTMENT",
  );
  assertMutatingOutcomeUnknown(
    "CANCELLATION_OUTCOME_UNKNOWN",
    "CANCELLATION_OUTCOME_UNKNOWN",
    "CANCEL_APPOINTMENT",
  );

  assertStaleFindSupersedesClaims();

  let ctx = base();
  const rules = evaluateVoiceV3Rules(ctx, CONFIG);
  const recovery = evaluateVoiceV3Recovery({ ctx, rules, config: CONFIG, now: NOW });
  assert.ok(recovery === null || recovery.code);

  console.log("VOICE_V3_AGENT_FAILURE_MATRIX_PASS");
}

main();
