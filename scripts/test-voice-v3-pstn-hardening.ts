#!/usr/bin/env tsx
/**
 * Post-success PSTN hardening regressions (phantom semantic, stale recovery, speak supersede).
 */
import assert from "node:assert/strict";
import { classifySemanticDecodeFailure } from "../src/lib/voice-v3/intake/semantic-disposition";
import {
  clearCallerTurnManager,
  getLatestCommittedCallerTurn,
  noteCallerTranscriptDelta,
} from "../src/lib/voice-v3/conversation/caller-turn-manager";
import { decodeCallerMeaningAttempt } from "../src/lib/voice-v3/intake/decode-delegated-caller-meaning";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { evaluateRecoveryBlocker } from "../src/lib/voice-v3/agent/evaluate-recovery-blocker";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import type { VoiceV3RecoveryDirective } from "../src/lib/voice-v3/recovery/types";
import {
  getVoiceV3LiveResponseCoordinator,
  peekVoiceV3LiveResponseCoordinator,
} from "../src/lib/voice-v3/delegation/live-response-coordinator";
import { markGreetingSpeaking, clearGreetingTurnState } from "../src/lib/voice-v3/greeting/greeting-turn";

const SESSION = "live_pstn_hardening_test";
const TZ = "America/Los_Angeles";
const NOW = new Date("2026-09-18T20:12:00.000Z");

function emptyMeaningJson(): string {
  return JSON.stringify({
    active_goal: "UNKNOWN",
    captured_fields: [],
    corrections: [],
    scheduling: {
      date_relation: "UNSPECIFIED",
      weekday: null,
      date_expression: null,
      explicit_date: null,
      time_expression: null,
      time_kind: "UNSPECIFIED",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: null,
    },
    slot_selection: {
      selection_type: "NONE",
      spoken_time: null,
      ordinal: null,
    },
    post_book_intent: "NONE",
    appointment_selection: { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    ambiguities: [],
  });
}

function testPhantomGreetingDisposition(): void {
  clearCallerTurnManager(SESSION);
  clearGreetingTurnState(SESSION);
  markGreetingSpeaking(SESSION);

  const decoded = decodeCallerMeaningAttempt(
    emptyMeaningJson(),
    VOICE_V3_BOOKING_TEST_CONFIG,
    { liveSessionId: SESSION },
  );
  assert.equal(decoded.ok, false);
  assert.equal(decoded.reason, "empty_signal");

  const disposition = classifySemanticDecodeFailure({
    reason: decoded.reason,
    hasCallerEvidence: false,
  });
  assert.equal(disposition, "EMPTY_NO_CALLER_EVIDENCE");
}

async function testPerTurnTranscriptIsolation(): Promise<void> {
  clearCallerTurnManager(SESSION);
  noteCallerTranscriptDelta(SESSION, "I want to book");
  await new Promise((r) => setTimeout(r, 800));
  const t1 = getLatestCommittedCallerTurn(SESSION);
  assert.ok(t1);
  assert.ok(t1!.transcript.includes("book"));
  assert.ok(t1!.transcript.length < 40);

  noteCallerTranscriptDelta(SESSION, " tomorrow at noon");
  await new Promise((r) => setTimeout(r, 800));
  const t2 = getLatestCommittedCallerTurn(SESSION);
  assert.ok(t2);
  assert.ok(t2!.sequence > t1!.sequence);
  assert.ok(t2!.transcript.includes("noon"));
  assert.ok(!t2!.transcript.includes("I want to book"));
}

function testStaleNoAvailabilitySuperseded(): void {
  const clock = buildVoiceV3CallClock(TZ, NOW);
  let ctx = createInitialVoiceV3CallContext({
    callId: "v3:stale_no_avail",
    liveSessionId: SESSION,
    timezone: TZ,
    clock,
    now: NOW,
  });

  const stale: VoiceV3RecoveryDirective = {
    id: "rec_stale",
    callId: ctx.callId,
    code: "NO_AVAILABILITY",
    status: "ACTIVE",
    userRecoverable: true,
    safeAgentMessage: "none",
    createdAt: NOW.toISOString(),
    schedulingGeneration: 1,
  };
  ctx = {
    ...ctx,
    dialog: { ...ctx.dialog, activeGoal: "BOOK_APPOINTMENT" },
    scheduling: { ...ctx.scheduling, generation: 2 },
    recovery: { active: stale, lastResolved: null },
    availability: {
      ...ctx.availability,
      status: "ready",
      activeOfferSet: {
        offerSetId: "offer_set_test",
        schedulingGeneration: 2,
        timezone: TZ,
        slots: [
          {
            slotId: "slot_1",
            startUtc: "2026-09-21T23:00:00.000Z",
            endUtc: "2026-09-22T00:00:00.000Z",
            localLabel: "Mon 4 PM",
          },
        ],
        createdAt: NOW.toISOString(),
      },
    },
  };

  const rules = evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG);
  const { blocker, directive } = evaluateRecoveryBlocker({
    ctx,
    rules,
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  assert.notEqual(blocker?.code, "NO_AVAILABILITY");
  assert.notEqual(directive?.code, "NO_AVAILABILITY");
  assert.equal(directive?.status === "ACTIVE" && directive?.code === "NO_AVAILABILITY", false);
}

function testInvalidMeaningWithCallerEvidence(): void {
  clearCallerTurnManager(SESSION);
  noteCallerTranscriptDelta(SESSION, "Anthony");
  const disposition = classifySemanticDecodeFailure({
    reason: "empty_signal",
    hasCallerEvidence: true,
  });
  assert.equal(disposition, "INVALID_WITH_CALLER_EVIDENCE");
}

function testEmptySemanticSubmitsOutputWithoutResponseCreate(): void {
  const sent: { type: string }[] = [];
  const send = (event: { type: string }) => {
    sent.push(event);
  };
  const coord = getVoiceV3LiveResponseCoordinator(`${SESSION}_empty`, send);
  coord.registerPendingFunctionCall({
    callId: "call_empty_sem",
    name: "emit_caller_meaning",
    argumentsJson: emptyMeaningJson(),
    delegationId: "del_empty",
  });
  coord.submitFunctionCallOutput(
    "call_empty_sem",
    { accepted: true, disposition: "EMPTY_NO_CALLER_EVIDENCE" },
    { skipScheduleContinuation: true },
  );
  assert.equal(sent.some((e) => e.type === "response.create"), false);
  assert.equal(sent.some((e) => e.type === "response.item.create"), true);
  peekVoiceV3LiveResponseCoordinator(`${SESSION}_empty`)?.clear();
}

function testDuplicateResponseCreateSuppressed(): void {
  const sent: unknown[] = [];
  const send = (event: { type: string }) => {
    sent.push(event);
  };
  const sid = `${SESSION}_dup`;
  const coord = getVoiceV3LiveResponseCoordinator(sid, send);
  coord.requestResponseCreate({
    reason: "planner_test",
    stateVersion: 3,
    actionKey: "3:CLARIFY_INTENT",
    allowBeforeDelegation: true,
  });
  coord.requestResponseCreate({
    reason: "planner_test",
    stateVersion: 3,
    actionKey: "3:CLARIFY_INTENT",
    allowBeforeDelegation: true,
  });
  const creates = sent.filter(
    (e) => (e as { type: string }).type === "response.create",
  );
  assert.equal(creates.length, 1);
  peekVoiceV3LiveResponseCoordinator(sid)?.clear();
}

function testStaleSpeakSupersededOnBookingConfirm(): void {
  const sent: { type: string; event_id?: string }[] = [];
  const send = (event: { type: string; event_id?: string }) => {
    sent.push(event);
  };
  const sid = `${SESSION}_stale_speak`;
  const coord = getVoiceV3LiveResponseCoordinator(sid, send);
  coord.registerPendingFunctionCall({
    callId: "pending_fc_stale",
    name: "emit_caller_meaning",
    argumentsJson: "{}",
    delegationId: "del_stale",
  });
  coord.requestResponseCreate({
    reason: "planner_inform_temporary_failure",
    stateVersion: 2,
    actionKey: "failure:INFORM_TEMPORARY_FAILURE:NO_AVAILABILITY",
    eventId: "stale_failure_speak",
  });
  assert.equal(sent.some((e) => e.type === "response.create"), false);

  coord.supersedeStaleSpeaks({ minStateVersion: 5 });
  coord.submitFunctionCallOutput("pending_fc_stale", { accepted: true });
  assert.equal(sent.some((e) => e.type === "response.create"), false);

  coord.requestResponseCreate({
    reason: "planner_inform_result",
    stateVersion: 5,
    actionKey: "5:INFORM_RESULT",
    eventId: "booking_confirm_speak",
    allowBeforeDelegation: true,
  });
  const creates = sent.filter((e) => e.type === "response.create");
  assert.equal(creates.length, 1);
  assert.equal(creates[0]?.event_id, "booking_confirm_speak");
  peekVoiceV3LiveResponseCoordinator(sid)?.clear();
}

function testSessionCloseBlocksResponseCreate(): void {
  const sent: unknown[] = [];
  const send = (event: { type: string }) => {
    sent.push(event);
  };
  const coord = getVoiceV3LiveResponseCoordinator(SESSION, send);
  coord.markSessionClosed();
  coord.requestResponseCreate({ reason: "stale_failure", eventId: "evt_stale" });
  assert.equal(sent.length, 0);
  peekVoiceV3LiveResponseCoordinator(SESSION)?.clear();
}

async function main(): Promise<void> {
  testPhantomGreetingDisposition();
  testInvalidMeaningWithCallerEvidence();
  testEmptySemanticSubmitsOutputWithoutResponseCreate();
  testDuplicateResponseCreateSuppressed();
  testStaleSpeakSupersededOnBookingConfirm();
  await testPerTurnTranscriptIsolation();
  testStaleNoAvailabilitySuperseded();
  testSessionCloseBlocksResponseCreate();
  console.log("PASS voice-v3-pstn-hardening");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
