#!/usr/bin/env tsx
/**
 * Architecture tests for async/concurrency lanes (no PSTN).
 */
import assert from "node:assert/strict";
import { VoiceV3CallRuntime } from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { emptySlotSelectionMeaning } from "../src/lib/voice-v3/intake/slot-selection-schema";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { dispatchFindAvailabilityIfRequired } from "../src/lib/voice-v3/calendar/find-dispatch";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { planAgentState } from "../src/lib/voice-v3/agent/agent-planner";
import {
  getVoiceV3LiveResponseCoordinator,
  peekVoiceV3LiveResponseCoordinator,
} from "../src/lib/voice-v3/delegation/live-response-coordinator";
import { classifyTurnPath } from "../src/lib/voice-v3/telemetry/caller-turn-timing";
import type { CallerTurnTiming } from "../src/lib/voice-v3/telemetry/caller-turn-timing";

const TZ = "America/Los_Angeles";
const NOW = new Date("2026-09-18T20:12:00.000Z");
const FROZEN = NOW;

function fridayAfternoonMeaning(): CallerMeaning {
  return {
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [],
    scheduling: {
      date_relation: "NEXT_WEEKDAY",
      weekday: "FRIDAY",
      date_expression: "next Friday",
      explicit_date: null,
      time_expression: "afternoon",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "AFTERNOON",
    },
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: { selection_type: "NONE", ordinal: null },
    cancellation_confirmation: "NONE",
    corrections: [],
    ambiguities: [],
  };
}

function runtimeWithFridayFindReady(): VoiceV3CallRuntime {
  const clock = buildVoiceV3CallClock(TZ, FROZEN);
  let ctx = createInitialVoiceV3CallContext({
    callId: "v3:async_arch",
    liveSessionId: "live_async_arch",
    timezone: TZ,
    clock,
    now: FROZEN,
  });
  const applied = applyCallerMeaningToContext(ctx, VOICE_V3_BOOKING_TEST_CONFIG, fridayAfternoonMeaning(), FROZEN);
  ctx = { ...applied.context, dialog: { activeGoal: "BOOK_APPOINTMENT" } };
  return new VoiceV3CallRuntime({ config: VOICE_V3_BOOKING_TEST_CONFIG, context: ctx });
}

/** Test A — FIND does not block conversation lane return */
async function testFindDoesNotBlockCaller(): Promise<void> {
  const runtime = runtimeWithFridayFindReady();
  const rulesBefore = evaluateVoiceV3Rules(runtime.getSnapshot(), runtime.config);
  assert.equal(rulesBefore.requiredAction, "FIND_AVAILABILITY");

  let findStarted = false;
  void dispatchFindAvailabilityIfRequired(runtime, {
    fetchBusy: async () => {
      findStarted = true;
      await new Promise((r) => setTimeout(r, 80));
      return { ok: true, busy: [], durationMs: 80 };
    },
    onLiveContext: () => {},
  });

  const t0 = Date.now();
  await new Promise((r) => setTimeout(r, 15));
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 70, "dispatch should return before FIND completes");
  assert.equal(runtime.getSnapshot().availability.status, "pending");
  const planned = planAgentState(runtime.getSnapshot(), runtime.config);
  assert.ok(
    planned.nextConversationAction.type === "ASK_REQUIRED_FIELD" ||
      planned.missingRequiredFieldKeys.length > 0,
    "planner can proceed while FIND pending",
  );
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(findStarted);
}

/** Test B — FIND dispatch does not require Live hooks to resolve first */
async function testFindWithoutLiveSync(): Promise<void> {
  const runtime = runtimeWithFridayFindReady();
  let graphCalled = false;
  await dispatchFindAvailabilityIfRequired(runtime, {
    awaitCompletion: true,
    fetchBusy: async () => {
      graphCalled = true;
      return { ok: true, busy: [], durationMs: 1 };
    },
  });
  assert.ok(graphCalled);
  const status = runtime.getSnapshot().availability.status;
  assert.ok(status === "ready" || status === "empty", `FIND completed with status ${status}`);
}

/** Test C — stale Friday when Monday dispatched */
async function testStaleFindOnGenerationChange(): Promise<void> {
  let context = createInitialVoiceV3CallContext({
    callId: "v3:stale_find",
    liveSessionId: "live_stale_find",
    timezone: TZ,
    clock: buildVoiceV3CallClock(TZ, FROZEN),
    now: FROZEN,
  });
  let applied = applyCallerMeaningToContext(
    context,
    VOICE_V3_BOOKING_TEST_CONFIG,
    fridayAfternoonMeaning(),
    FROZEN,
  );
  context = { ...applied.context, dialog: { activeGoal: "BOOK_APPOINTMENT" } };
  const runtime = new VoiceV3CallRuntime({ config: VOICE_V3_BOOKING_TEST_CONFIG, context });
  const fridayGen = runtime.getSnapshot().scheduling.generation;

  let releaseFriday: () => void = () => {};
  const fridayGate = new Promise<void>((r) => {
    releaseFriday = r;
  });

  void dispatchFindAvailabilityIfRequired(runtime, {
    awaitCompletion: true,
    fetchBusy: async () => {
      await fridayGate;
      return { ok: true, busy: [], durationMs: 1 };
    },
    onLiveContext: () => {},
  });

  await new Promise((r) => setTimeout(r, 10));
  const monday = applyCallerMeaningToContext(
    runtime.getSnapshot(),
    VOICE_V3_BOOKING_TEST_CONFIG,
    {
      ...fridayAfternoonMeaning(),
      scheduling: {
        ...emptySchedulingMeaning(),
        date_relation: "NEXT_WEEKDAY",
        weekday: "MONDAY",
        date_expression: "Monday",
        time_kind: "DAYPART",
        daypart: "AFTERNOON",
        time_expression: "afternoon",
      },
    },
    FROZEN,
  );
  runtime.replaceContext({ ...monday.context, dialog: { activeGoal: "BOOK_APPOINTMENT" } });

  await dispatchFindAvailabilityIfRequired(runtime, {
    awaitCompletion: true,
    fetchBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    onLiveContext: () => {},
  });

  releaseFriday();
  await new Promise((r) => setTimeout(r, 30));

  const snap = runtime.getSnapshot();
  assert.ok(snap.scheduling.generation > fridayGen);
  assert.ok(
    snap.availability.activeOfferSet?.schedulingGeneration === snap.scheduling.generation,
    "authoritative offer must match current generation",
  );
}

function testHappyPathClassification(): void {
  const row: CallerTurnTiming = {
    turnId: "t1",
    turnSequence: 1,
    turnCommittedAt: Date.now(),
    semanticRetryCount: 0,
    delegationCount: 1,
    responseCreateCount: 1,
    transcriptFragmentCount: 2,
    backendOperationsDispatched: ["find_x"],
    recoverySpeakCount: 0,
    semanticSource: "delegation",
  };
  assert.equal(classifyTurnPath(row), "HAPPY_PATH");
  row.semanticRetryCount = 1;
  assert.equal(classifyTurnPath(row), "RETRY");
}

/** Test E — protocol barrier */
async function testProtocolBarrier(): Promise<void> {
  const sent: { type: string }[] = [];
  const send = (e: { type: string }) => sent.push(e);
  const sid = "live_protocol_barrier";
  const coord = getVoiceV3LiveResponseCoordinator(sid, send);
  coord.registerPendingFunctionCall({
    callId: "fc_barrier",
    name: "emit_caller_meaning",
    argumentsJson: "{}",
    delegationId: "del_b",
    outputSubmitted: false,
  });
  coord.requestResponseCreate({ reason: "blocked", allowBeforeDelegation: true });
  assert.equal(sent.filter((e) => e.type === "response.create").length, 0);
  coord.submitFunctionCallOutput("fc_barrier", { accepted: true });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(sent.filter((e) => e.type === "response.create").length, 1);
  peekVoiceV3LiveResponseCoordinator(sid)?.clear();
}

async function main(): Promise<void> {
  await testFindDoesNotBlockCaller();
  await testFindWithoutLiveSync();
  await testStaleFindOnGenerationChange();
  testHappyPathClassification();
  await testProtocolBarrier();
  console.log("PASS voice-v3-async-architecture");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
