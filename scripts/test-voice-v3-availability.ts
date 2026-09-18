import assert from "node:assert/strict";
import type { VoiceV3AgentConfig } from "../src/lib/voice-v3/config/agent-config";
import { TEST_AGENT_CONFIG } from "../src/lib/voice-v3/config/test-agent-config";
import {
  applyFindAvailabilityResult,
  dispatchFindAvailabilityIfRequired,
} from "../src/lib/voice-v3/calendar/find-dispatch";
import { buildFindAvailabilityRequest } from "../src/lib/voice-v3/calendar/find-availability";
import { generateAvailabilitySlots } from "../src/lib/voice-v3/calendar/slot-generator";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { VoiceV3CallRuntime } from "../src/lib/voice-v3/state/call-runtime";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { normalizeSchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-normalizer";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";

const TZ = "America/New_York";
const FROZEN = new Date("2026-09-17T14:00:00.000Z"); // Thursday afternoon UTC

function config(overrides: Partial<VoiceV3AgentConfig> = {}): VoiceV3AgentConfig {
  return { ...TEST_AGENT_CONFIG, ...overrides };
}

function ctx(at = FROZEN) {
  const clock = buildVoiceV3CallClock(TZ, at);
  return createInitialVoiceV3CallContext({
    callId: "call_avail",
    liveSessionId: "live_avail",
    timezone: TZ,
    clock,
    now: at,
  });
}

function meaning(partial: Partial<CallerMeaning>): CallerMeaning {
  return {
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [],
    scheduling: emptySchedulingMeaning(),
    corrections: [],
    ambiguities: [],
    ...partial,
  };
}

function fridayAfternoonMeaning() {
  return meaning({
    scheduling: {
      ...emptySchedulingMeaning(),
      date_relation: "NEXT_WEEKDAY",
      weekday: "FRIDAY",
      time_kind: "DAYPART",
      daypart: "AFTERNOON",
      date_expression: "next Friday afternoon",
      time_expression: "afternoon",
    },
  });
}

async function testSlotGeneration() {
  const rangeStart = "2026-09-25T16:00:00.000Z"; // noon ET approx
  const rangeEnd = "2026-09-25T21:00:00.000Z";

  const free = generateAvailabilitySlots({
    timezone: TZ,
    rangeStartUtc: rangeStart,
    rangeEndUtc: rangeEnd,
    durationMinutes: 60,
    slotStepMinutes: 30,
    businessHours: config().businessHours,
    busyIntervals: [],
  });
  assert.ok(free.length >= 3, "expected multiple free afternoon slots");

  const busyOne = generateAvailabilitySlots({
    timezone: TZ,
    rangeStartUtc: rangeStart,
    rangeEndUtc: rangeEnd,
    durationMinutes: 60,
    slotStepMinutes: 30,
    businessHours: config().businessHours,
    busyIntervals: [
      {
        calendarId: "primary",
        startUtc: "2026-09-25T17:00:00.000Z",
        endUtc: "2026-09-25T18:30:00.000Z",
      },
    ],
  });
  assert.ok(busyOne.length < free.length, "busy interval should reduce slots");

  const fullBusy = generateAvailabilitySlots({
    timezone: TZ,
    rangeStartUtc: rangeStart,
    rangeEndUtc: rangeEnd,
    durationMinutes: 60,
    slotStepMinutes: 30,
    businessHours: config().businessHours,
    busyIntervals: [
      {
        calendarId: "primary",
        startUtc: rangeStart,
        endUtc: rangeEnd,
      },
    ],
  });
  assert.equal(fullBusy.length, 0);

  const noFit = generateAvailabilitySlots({
    timezone: TZ,
    rangeStartUtc: rangeStart,
    rangeEndUtc: "2026-09-25T16:45:00.000Z",
    durationMinutes: 60,
    slotStepMinutes: 30,
    businessHours: config().businessHours,
    busyIntervals: [],
  });
  assert.equal(noFit.length, 0, "window too short for 60m duration");
}

function testRulesDispatch() {
  let base = ctx();
  const applied = applyCallerMeaningToContext(base, config(), fridayAfternoonMeaning(), FROZEN);
  base = applied.context;
  base = { ...base, dialog: { activeGoal: "BOOK_APPOINTMENT" } };

  const rules = evaluateVoiceV3Rules(base, config());
  assert.equal(rules.mayFindAvailability, true);
  assert.equal(rules.requiredAction, "FIND_AVAILABILITY");

  const req = buildFindAvailabilityRequest(base, config());
  assert.ok(req);
  assert.equal(req!.durationMinutes, 60);
}

async function testStaleRace() {
  let context = ctx();
  const applied = applyCallerMeaningToContext(context, config(), fridayAfternoonMeaning(), FROZEN);
  context = { ...applied.context, dialog: { activeGoal: "BOOK_APPOINTMENT" } };
  const gen7 = context.scheduling.generation;

  const runtime = new VoiceV3CallRuntime({ config: config(), context });
  const sent: string[] = [];

  await dispatchFindAvailabilityIfRequired(runtime, {
    fetchBusy: async () => ({
      ok: true,
      busy: [],
      durationMs: 5,
    }),
    onLiveContext: (e) => {
      sent.push(e.content);
    },
  });

  const afterFirst = runtime.getSnapshot();
  assert.ok(afterFirst.availability.activeOfferSet);
  assert.equal(afterFirst.availability.activeOfferSet!.schedulingGeneration, gen7);

  const thursday = applyCallerMeaningToContext(
    afterFirst,
    config(),
    meaning({
      scheduling: {
        ...emptySchedulingMeaning(),
        date_relation: "NEXT_WEEKDAY",
        weekday: "THURSDAY",
        time_kind: "DAYPART",
        daypart: "MORNING",
      },
    }),
    FROZEN,
  ).context;
  runtime.replaceContext({ ...thursday, dialog: { activeGoal: "BOOK_APPOINTMENT" } });
  const gen8 = runtime.getSnapshot().scheduling.generation;
  assert.ok(gen8 > gen7);

  await dispatchFindAvailabilityIfRequired(runtime, {
    fetchBusy: async () => ({
      ok: true,
      busy: [],
      durationMs: 3,
    }),
    onLiveContext: () => {},
  });

  const staleApplied = applyFindAvailabilityResult(runtime.getSnapshot(), {
    schedulingGeneration: gen7,
    offerSet: {
      offerSetId: "offer_set_stale",
      schedulingGeneration: gen7,
      createdAt: new Date().toISOString(),
      timezone: TZ,
      slots: [
        {
          slotId: "slot_1",
          startUtc: "2026-09-25T17:00:00.000Z",
          endUtc: "2026-09-25T18:00:00.000Z",
          localStart: "2026-09-25T13:00:00-04:00",
          localEnd: "2026-09-25T14:00:00-04:00",
        },
      ],
    },
    failure: null,
    requestKey: "stale",
  });
  assert.equal(
    staleApplied.availability.activeOfferSet?.schedulingGeneration,
    gen8,
    "stale generation-7 must not replace generation-8 offer set",
  );
}

async function testSpeakContinuationAfterFind() {
  let context = ctx();
  context = applyCallerMeaningToContext(context, config(), fridayAfternoonMeaning(), FROZEN).context;
  context = { ...context, dialog: { activeGoal: "BOOK_APPOINTMENT" } };
  const runtime = new VoiceV3CallRuntime({ config: config(), context });
  const speakReasons: string[] = [];

  await dispatchFindAvailabilityIfRequired(runtime, {
    fetchBusy: async () => ({ ok: true, busy: [], durationMs: 1 }),
    onLiveContext: (e) => {
      assert.ok(e.content.includes("Availability search completed"));
    },
    requestSpeak: (reason) => speakReasons.push(reason),
  });

  assert.deepEqual(speakReasons, ["availability_ready"]);
}

async function testDuplicateDispatch() {
  let context = ctx();
  context = applyCallerMeaningToContext(context, config(), fridayAfternoonMeaning(), FROZEN).context;
  context = { ...context, dialog: { activeGoal: "BOOK_APPOINTMENT" } };
  const runtime = new VoiceV3CallRuntime({ config: config(), context });
  let dispatchCount = 0;

  await dispatchFindAvailabilityIfRequired(runtime, {
    fetchBusy: async () => {
      dispatchCount += 1;
      return { ok: true, busy: [], durationMs: 1 };
    },
    onLiveContext: () => {},
  });
  await dispatchFindAvailabilityIfRequired(runtime, {
    fetchBusy: async () => {
      dispatchCount += 1;
      return { ok: true, busy: [], durationMs: 1 };
    },
    onLiveContext: () => {},
  });
  assert.equal(dispatchCount, 1, "unchanged state must not re-dispatch FIND");
}

function testNormalizationFriday() {
  const clock = buildVoiceV3CallClock(TZ, FROZEN);
  const normalized = normalizeSchedulingMeaning(
    {
      ...emptySchedulingMeaning(),
      date_relation: "NEXT_WEEKDAY",
      weekday: "FRIDAY",
      time_kind: "DAYPART",
      daypart: "AFTERNOON",
    },
    clock,
  );
  assert.equal(normalized.localDate, "2026-09-25");
  assert.equal(normalized.precision, "DAYPART");
  assert.ok(normalized.utcStart && normalized.utcEnd);
}

async function main() {
  testNormalizationFriday();
  await testSlotGeneration();
  testRulesDispatch();
  await testStaleRace();
  await testSpeakContinuationAfterFind();
  await testDuplicateDispatch();
  console.log("PASS voice-v3 availability");
}

main().catch((err) => {
  console.error("FAIL voice-v3 availability", err);
  process.exit(1);
});
