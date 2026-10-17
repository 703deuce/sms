/**
 * Earliest-available scheduling: deterministic layer only (no Live API).
 */
import assert from "node:assert/strict";
import { DEFAULT_SCHEDULING_LOOKAHEAD_DAYS } from "../src/lib/voice-v3/calendar/find-existing-appointment-window";
import { resolveSearchWindowFromNormalized } from "../src/lib/voice-v3/calendar/find-availability";
import { mergeSchedulingMeaningIntoContext } from "../src/lib/voice-v3/intake/merge-scheduling-meaning";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import {
  clearVoiceV3CallRuntimeStore,
  createVoiceV3CallRuntime,
} from "../src/lib/voice-v3/state/call-runtime";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { deriveSchedulingClarification } from "../src/lib/voice-v3/time/scheduling-clarification";
import { normalizeSchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-normalizer";
import { emptySchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { getMissingFieldsForOperation } from "../src/lib/voice-v3/intake-objective/operation-requirements";
import { executeVoiceTool } from "../src/lib/voice-v3/tools/execute-voice-tool";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

const FROZEN = new Date("2026-09-18T14:00:00.000Z"); // Fri 10:00 America/New_York
const TZ = "America/New_York";

function baseCtx() {
  const clock = buildVoiceV3CallClock(TZ, FROZEN);
  return createInitialVoiceV3CallContext({
    callId: "earliest",
    liveSessionId: "live_earliest",
    timezone: TZ,
    clock,
    now: FROZEN,
  });
}

function earliestMeaning(
  dateExpression: string,
  time?: { time_kind: "UNSPECIFIED" | "DAYPART"; daypart?: "MORNING" | "AFTERNOON" | "EVENING" },
) {
  return {
    ...emptySchedulingMeaning(),
    date_relation: "EARLIEST_AVAILABLE" as const,
    date_expression: dateExpression,
    time_kind: time?.time_kind ?? "UNSPECIFIED",
    daypart: time?.daypart ?? null,
    time_expression: time?.daypart ? time.daypart.toLowerCase() : null,
  };
}

function assertReadyForFind(
  label: string,
  meaning: ReturnType<typeof earliestMeaning>,
  inferredOnly = false,
) {
  const clock = buildVoiceV3CallClock(TZ, FROZEN);
  const normalized = normalizeSchedulingMeaning(meaning, clock);
  assert.notEqual(normalized.precision, "UNRESOLVED", `${label}: precision`);
  const clarify = deriveSchedulingClarification({ meaning, normalized, clock });
  assert.equal(clarify.required, false, `${label}: clarification`);

  let ctx = baseCtx();
  const merged = mergeSchedulingMeaningIntoContext(ctx, meaning);
  ctx = merged.context;
  const rules = evaluateVoiceV3Rules(ctx, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(rules.schedulingRequiresClarification, false, `${label}: rules clarification`);
  assert.equal(rules.hasSchedulingPreference, true, `${label}: has preference`);
  assert.equal(rules.mayFindAvailability, true, `${label}: may find`);

  const window = resolveSearchWindowFromNormalized(normalized, TZ, 30);
  assert.ok(window, `${label}: search window`);
  const spanDays =
    (new Date(window!.rangeEndUtc).getTime() - new Date(window!.rangeStartUtc).getTime()) /
    (24 * 60 * 60_000);
  assert.ok(spanDays >= DEFAULT_SCHEDULING_LOOKAHEAD_DAYS - 1, `${label}: lookahead span`);
  assert.ok(
    new Date(window!.rangeStartUtc).getTime() >= FROZEN.getTime() - 60_000,
    `${label}: starts at or after now`,
  );

  if (inferredOnly) {
    assert.equal(meaning.date_relation, "UNSPECIFIED");
    assert.equal(normalizeSchedulingMeaning(meaning, clock).precision, "OPEN_RANGE");
  }
}

async function main() {
  assertReadyForFind(
    "earliest appointment",
    earliestMeaning("What's your earliest appointment?"),
  );

  assertReadyForFind(
    "soonest day",
    earliestMeaning("Whatever day you can get me in soonest."),
  );

  assertReadyForFind(
    "next available morning",
    earliestMeaning("Next available, morning preferred.", {
      time_kind: "DAYPART",
      daypart: "MORNING",
    }),
  );

  const inferred = {
    ...emptySchedulingMeaning(),
    date_relation: "UNSPECIFIED" as const,
    date_expression: "next available please",
    time_kind: "UNSPECIFIED" as const,
  };
  assertReadyForFind("inferred from expression", inferred, true);

  let ctx = baseCtx();
  const first = mergeSchedulingMeaningIntoContext(
    ctx,
    earliestMeaning("Next available, morning preferred.", {
      time_kind: "DAYPART",
      daypart: "MORNING",
    }),
  );
  ctx = first.context;
  assert.equal(ctx.scheduling.generation, 1);

  const monday = mergeSchedulingMeaningIntoContext(ctx, {
    ...emptySchedulingMeaning(),
    date_relation: "NEXT_WEEKDAY",
    weekday: "MONDAY",
    date_expression: "Actually, make it next Monday.",
    time_kind: "UNSPECIFIED",
  });
  ctx = monday.context;
  assert.equal(ctx.scheduling.generation, 2, "Monday correction bumps generation");
  assert.equal(ctx.scheduling.normalized?.localDate, "2026-09-28");
  assert.equal(ctx.scheduling.meaning?.date_relation, "NEXT_WEEKDAY");

  clearVoiceV3CallRuntimeStore();
  const runtime = createVoiceV3CallRuntime({
    liveSessionId: "live_book_gate",
    callId: "call_book_gate",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
  });
  const toolCtx = {
    callId: "call_book_gate",
    liveSessionId: "live_book_gate",
    delegationId: "del",
    functionCallId: "fc_set",
    runtime,
    tenantId: "tenant_test",
    sendContext: () => {},
  };

  const setOk = await executeVoiceTool(toolCtx, "set_scheduling_preference", {
    ...earliestMeaning("earliest opening"),
  });
  assert.equal(setOk.ok, true);

  const missingAfterEarliest = getMissingFieldsForOperation(
    "book_appointment",
    VOICE_V3_BOOKING_TEST_CONFIG,
    runtime.getSnapshot(),
  );
  assert.deepEqual(missingAfterEarliest.sort(), ["email", "name", "phone"]);

  clearVoiceV3CallRuntimeStore();
  console.log("PASS voice-v3 earliest scheduling");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
