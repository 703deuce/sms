#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { interpretSchedulingUtterance } from "../src/lib/mctb/ai-booking/scheduling-interpreter";

const tz = "America/New_York";
const now = new Date("2026-09-15T14:00:00.000Z");

function interp(text: string, hasSession = false) {
  return interpretSchedulingUtterance({ text, timezone: tz, now, hasActiveBookingSession: hasSession });
}

const tomorrowAfternoon = interp("tomorrow afternoon");
assert.equal(tomorrowAfternoon.intent, "CHECK_AVAILABILITY");
assert.ok(tomorrowAfternoon.windowStartUtc);
assert.ok(tomorrowAfternoon.windowEndUtc);

const fridayAfter2 = interp("Friday after 2");
assert.equal(fridayAfter2.intent, "CHECK_AVAILABILITY");

const specific = interp("do you have 10 tomorrow?");
assert.equal(specific.intent, "CHECK_AVAILABILITY");
assert.ok(specific.preferredTimeUtc);

const select = interp("3 works", true);
assert.equal(select.intent, "SELECT_OFFERED_SLOT");

const none = interp("how much does this cost?");
assert.equal(none.intent, "NONE");

console.log("test-mctb-ai-booking-interpreter: OK");
