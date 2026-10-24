import assert from "node:assert/strict";
import { toMicrosoftGraphScheduleWindow } from "../src/lib/voice-v3/calendar/microsoft/microsoft-time-adapter";
import { applyCallerMeaningToContext } from "../src/lib/voice-v3/intake/apply-caller-meaning";
import type { CallerMeaning } from "../src/lib/voice-v3/intake/caller-meaning-schema";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { normalizeSchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-normalizer";
import type { SchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-types";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { evaluateVoiceV3Rules } from "../src/lib/voice-v3/state/call-rules";
import { deriveSchedulingClarification } from "../src/lib/voice-v3/time/scheduling-clarification";

const FROZEN = new Date("2026-09-17T14:00:00.000Z"); // Thu 10:00 America/New_York (EDT)

function clockTz(tz: string) {
  return buildVoiceV3CallClock(tz, FROZEN);
}

function meaning(scheduling: SchedulingMeaning): SchedulingMeaning {
  return scheduling;
}

function norm(sched: SchedulingMeaning, tz = "America/New_York") {
  return normalizeSchedulingMeaning(sched, clockTz(tz));
}

function main() {
  const nyClock = clockTz("America/New_York");
  assert.equal(nyClock.localDate, "2026-09-17");
  assert.equal(nyClock.localWeekday, "Thursday");
  assert.ok(nyClock.nowLocalDateTime.includes("2026-09-17"));
  assert.ok(nyClock.nowLocalDateTime.includes("-04:00") || nyClock.nowLocalDateTime.includes("-05:00"));

  assert.equal(norm(meaning({ date_relation: "TODAY", date_expression: "today", weekday: null, explicit_date: null, time_expression: null, time_kind: "UNSPECIFIED", exact_time: null, start_time: null, end_time: null, daypart: null })).localDate, "2026-09-17");

  assert.equal(
    norm(
      meaning({
        date_relation: "TOMORROW",
        date_expression: "tomorrow",
        weekday: null,
        explicit_date: null,
        time_expression: null,
        time_kind: "UNSPECIFIED",
        exact_time: null,
        start_time: null,
        end_time: null,
        daypart: null,
      }),
    ).localDate,
    "2026-09-18",
  );

  assert.equal(
    norm(
      meaning({
        date_relation: "DAY_AFTER_TOMORROW",
        date_expression: "day after tomorrow",
        weekday: null,
        explicit_date: null,
        time_expression: null,
        time_kind: "UNSPECIFIED",
        exact_time: null,
        start_time: null,
        end_time: null,
        daypart: null,
      }),
    ).localDate,
    "2026-09-19",
  );

  const thisFriday = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      date_expression: "this Friday",
      weekday: "FRIDAY",
      explicit_date: null,
      time_expression: null,
      time_kind: "UNSPECIFIED",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(thisFriday.localDate, "2026-09-18");

  const nextFriday = norm(
    meaning({
      date_relation: "NEXT_WEEKDAY",
      date_expression: "next Friday",
      weekday: "FRIDAY",
      explicit_date: null,
      time_expression: null,
      time_kind: "UNSPECIFIED",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(nextFriday.localDate, "2026-09-25");

  const nextFridayAfternoon = norm(
    meaning({
      date_relation: "NEXT_WEEKDAY",
      date_expression: "next Friday afternoon",
      weekday: "FRIDAY",
      explicit_date: null,
      time_expression: "afternoon",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "AFTERNOON",
    }),
  );
  assert.equal(nextFridayAfternoon.localDate, "2026-09-25");
  assert.equal(nextFridayAfternoon.precision, "DAYPART");
  assert.equal(nextFridayAfternoon.localStartDateTime, "2026-09-25T12:00:00-04:00");
  assert.equal(nextFridayAfternoon.localEndDateTime, "2026-09-25T17:00:00-04:00");
  assert.equal(nextFridayAfternoon.utcStart, "2026-09-25T16:00:00.000Z");
  assert.equal(nextFridayAfternoon.utcEnd, "2026-09-25T21:00:00.000Z");

  const explicit = norm(
    meaning({
      date_relation: "EXPLICIT_DATE",
      date_expression: "September 25",
      weekday: null,
      explicit_date: "2026-09-25",
      time_expression: null,
      time_kind: "UNSPECIFIED",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(explicit.localDate, "2026-09-25");

  const friday9am = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      date_expression: "Friday at 9 AM",
      weekday: "FRIDAY",
      explicit_date: null,
      time_expression: "9 AM",
      time_kind: "EXACT",
      exact_time: "09:00",
      start_time: null,
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(friday9am.localDate, "2026-09-18");
  assert.equal(friday9am.precision, "EXACT_TIME");
  assert.equal(friday9am.localStartDateTime, "2026-09-18T09:00:00-04:00");

  const friday9pm = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      weekday: "FRIDAY",
      date_expression: "Friday at 9 PM",
      explicit_date: null,
      time_expression: "9 PM",
      time_kind: "EXACT",
      exact_time: "21:00",
      start_time: null,
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(friday9pm.localStartDateTime, "2026-09-18T21:00:00-04:00");

  const after3 = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      weekday: "FRIDAY",
      date_expression: "Friday after 3 PM",
      explicit_date: null,
      time_expression: "after 3 PM",
      time_kind: "AFTER",
      exact_time: null,
      start_time: "15:00",
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(after3.precision, "OPEN_RANGE");
  assert.equal(after3.localStartDateTime, "2026-09-18T15:00:00-04:00");
  assert.equal(after3.localEndDateTime, null);

  const beforeNoon = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      weekday: "FRIDAY",
      date_expression: "Friday before noon",
      explicit_date: null,
      time_expression: "before noon",
      time_kind: "BEFORE",
      exact_time: null,
      start_time: null,
      end_time: "12:00",
      daypart: null,
    }),
  );
  assert.equal(beforeNoon.localEndDateTime, "2026-09-18T12:00:00-04:00");

  const between = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      weekday: "FRIDAY",
      date_expression: "between 2 and 4",
      explicit_date: null,
      time_expression: "between 2 and 4 PM",
      time_kind: "BETWEEN",
      exact_time: null,
      start_time: "14:00",
      end_time: "16:00",
      daypart: null,
    }),
  );
  assert.equal(between.precision, "RANGE");
  assert.equal(between.localStartDateTime, "2026-09-18T14:00:00-04:00");
  assert.equal(between.localEndDateTime, "2026-09-18T16:00:00-04:00");

  const graph = toMicrosoftGraphScheduleWindow(nextFridayAfternoon);
  assert.ok(graph);
  assert.equal(graph!.startTime.timeZone, "Eastern Standard Time");
  assert.equal(graph!.startTime.dateTime, "2026-09-25T12:00:00");
  assert.equal(graph!.endTime.dateTime, "2026-09-25T17:00:00");

  for (const tz of ["America/Chicago", "America/Denver", "America/Los_Angeles"]) {
    const c = clockTz(tz);
    const n = norm(
      meaning({
        date_relation: "TOMORROW",
        date_expression: "tomorrow morning",
        weekday: null,
        explicit_date: null,
        time_expression: "morning",
        time_kind: "DAYPART",
        exact_time: null,
        start_time: null,
        end_time: null,
        daypart: "MORNING",
      }),
      tz,
    );
    assert.equal(n.localDate, "2026-09-18");
    assert.ok(n.localStartDateTime?.startsWith("2026-09-18T08:00:00"));
    assert.ok(n.utcStart);
    assert.equal(c.timezone, tz);
  }

  const dstSpring = new Date("2026-03-08T12:00:00.000Z");
  const dstClock = buildVoiceV3CallClock("America/New_York", dstSpring);
  const dstNorm = normalizeSchedulingMeaning(
    meaning({
      date_relation: "TODAY",
      date_expression: "today",
      weekday: null,
      explicit_date: null,
      time_expression: "at 9",
      time_kind: "EXACT",
      exact_time: "09:00",
      start_time: null,
      end_time: null,
      daypart: null,
    }),
    dstClock,
  );
  assert.ok(dstNorm.localStartDateTime?.includes("T09:00:00"));
  assert.ok(dstNorm.utcStart);

  let ctx = createInitialVoiceV3CallContext({
    callId: "c1",
    liveSessionId: "live1",
    timezone: "America/New_York",
    clock: nyClock,
  });

  const callerMeaning = (scheduling: SchedulingMeaning): CallerMeaning => ({
    active_goal: "BOOK_APPOINTMENT",
    captured_fields: [],
    scheduling,
    corrections: [],
    ambiguities: [],
  });

  let applied = applyCallerMeaningToContext(
    ctx,
    VOICE_V3_BOOKING_TEST_CONFIG,
    callerMeaning({
      date_relation: "THIS_WEEKDAY",
      date_expression: "Friday afternoon",
      weekday: "FRIDAY",
      explicit_date: null,
      time_expression: "afternoon",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "AFTERNOON",
    }),
  );
  ctx = applied.context;
  assert.equal(ctx.scheduling.generation, 1);

  applied = applyCallerMeaningToContext(
    ctx,
    VOICE_V3_BOOKING_TEST_CONFIG,
    callerMeaning({
      date_relation: "TODAY",
      date_expression: "Actually Thursday morning",
      weekday: "THURSDAY",
      explicit_date: null,
      time_expression: "morning",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "MORNING",
    }),
  );
  ctx = applied.context;
  assert.equal(ctx.scheduling.generation, 2);
  assert.equal(ctx.scheduling.normalized?.localDate, "2026-09-17");

  applied = applyCallerMeaningToContext(
    ctx,
    VOICE_V3_BOOKING_TEST_CONFIG,
    callerMeaning({
      date_relation: "TODAY",
      date_expression: "Thursday morning",
      weekday: "THURSDAY",
      explicit_date: null,
      time_expression: "morning",
      time_kind: "DAYPART",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: "MORNING",
    }),
  );
  assert.equal(applied.context.scheduling.generation, 2, "identical normalized should not bump generation");

  const thisThursdayAmbiguous = norm(
    meaning({
      date_relation: "THIS_WEEKDAY",
      date_expression: "this Thursday",
      weekday: "THURSDAY",
      explicit_date: null,
      time_expression: null,
      time_kind: "UNSPECIFIED",
      exact_time: null,
      start_time: null,
      end_time: null,
      daypart: null,
    }),
  );
  assert.equal(thisThursdayAmbiguous.precision, "UNRESOLVED");

  const thursdayMorningAmbiguous = meaning({
    date_relation: "THIS_WEEKDAY",
    date_expression: "Thursday morning",
    weekday: "THURSDAY",
    explicit_date: null,
    time_expression: "morning",
    time_kind: "DAYPART",
    exact_time: null,
    start_time: null,
    end_time: null,
    daypart: "MORNING",
  });
  const clarify = deriveSchedulingClarification({
    meaning: thursdayMorningAmbiguous,
    normalized: thisThursdayAmbiguous,
    clock: nyClock,
  });
  assert.equal(clarify.required, true);
  assert.equal(clarify.reason, "SAME_WEEKDAY_AMBIGUOUS");
  assert.equal(clarify.prompt, "Do you mean today, or next Thursday?");

  let clarifyCtx = createInitialVoiceV3CallContext({
    callId: "clarify",
    liveSessionId: "live_clarify",
    timezone: "America/New_York",
    clock: nyClock,
  });
  clarifyCtx = applyCallerMeaningToContext(
    clarifyCtx,
    VOICE_V3_BOOKING_TEST_CONFIG,
    callerMeaning(thursdayMorningAmbiguous),
  ).context;
  const clarifyRules = evaluateVoiceV3Rules(clarifyCtx, VOICE_V3_BOOKING_TEST_CONFIG);
  assert.equal(clarifyRules.schedulingRequiresClarification, true);
  assert.equal(clarifyRules.mayRunCalendarAction, false);
  assert.equal(clarifyRules.hasSchedulingPreference, false);
  assert.equal(clarifyRules.mayFindAvailability, false);

  const chicago = createInitialVoiceV3CallContext({
    callId: "c2",
    liveSessionId: "live2",
    timezone: "America/Chicago",
    clock: clockTz("America/Chicago"),
  });
  const la = createInitialVoiceV3CallContext({
    callId: "c3",
    liveSessionId: "live3",
    timezone: "America/Los_Angeles",
    clock: clockTz("America/Los_Angeles"),
  });
  assert.notEqual(chicago.clock.nowLocalDateTime, la.clock.nowLocalDateTime);

  console.log("PASS voice-v3 datetime normalization");
}

main();
