import assert from "node:assert/strict";
import { parseSchedulingExpressionsToMeaning } from "../src/lib/voice-v3/time/parse-scheduling-expressions";
import { normalizeSchedulingMeaning } from "../src/lib/voice-v3/time/scheduling-normalizer";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { deriveSchedulingClarification } from "../src/lib/voice-v3/time/scheduling-clarification";

const FROZEN = new Date("2026-09-17T14:00:00.000Z");
const clock = buildVoiceV3CallClock("America/Los_Angeles", FROZEN);

function mustResolve(date: string, time?: string | null) {
  const meaning = parseSchedulingExpressionsToMeaning({
    dateExpression: date,
    timeExpression: time ?? null,
  });
  const normalized = normalizeSchedulingMeaning(meaning, clock);
  const clarification = deriveSchedulingClarification({ meaning, normalized, clock });
  assert.equal(clarification.required, false, `${date} / ${time ?? ""} should resolve`);
  assert.notEqual(normalized.precision, "UNRESOLVED");
}

mustResolve("Tuesday", "afternoon");
mustResolve("tomorrow", "afternoon");
mustResolve("next Friday", null);
mustResolve("today", null);

console.log("PASS voice-v3 parse scheduling expressions");
